/**
 * Render fotográfico del mismo modelo con trazado de rayos progresivo (three-gpu-pathtracer):
 * iluminación indirecta, sombras suaves de contacto, reflejos y transparencias físicas a partir
 * de la escena que se ve en el visor. Cada pasada añade una muestra por píxel y la imagen se
 * va limpiando de ruido. Es mucho más lento que el visor interactivo: se lanza bajo demanda.
 */
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface PhotoOptions {
  samples: number;
  sky?: 'dia' | 'tarde' | 'noche';
  /** resolución relativa al visor (1 = la misma) */
  scale?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** exposición (como en una cámara: los interiores necesitan más que el exterior) */
  exposure?: number;
  /** luces de estudio (posiciones en el mundo): ayuda de visualización en interiores sin ventanas */
  studioLights?: [number, number, number][];
  /** filtro de ruido que conserva bordes (bilateral) aplicado al resultado */
  denoise?: boolean;
  /** usar las texturas procedurales (por defecto sí) */
  textures?: boolean;
}

/** Objetos que el trazador no puede usar o que no deben salir en la foto (líneas, rótulos, ayudas). */
function prepare(scene: THREE.Scene, textures = true) {
  const hidden: THREE.Object3D[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    const isHelper = o.userData?.helper === true || (o as THREE.Line).isLine || (o as THREE.Points).isPoints || o.type === 'GridHelper' || (o as unknown as { isCSS2DObject?: boolean }).isCSS2DObject;
    const wire = m.isMesh && !Array.isArray(m.material) && (m.material as THREE.MeshBasicMaterial)?.wireframe;
    if ((isHelper || wire) && o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  });
  // reflejos en tiempo real (cubemaps del espejo): el trazador calcula los reflejos reales y no admite
  // texturas cúbicas en los materiales, así que se quitan mientras dura el render
  const envs: [THREE.MeshStandardMaterial, THREE.Texture][] = [];
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
      if (mat.envMap) { envs.push([mat, mat.envMap]); mat.envMap = null; mat.needsUpdate = true; }
    }
  });
  // el trazador no dibuja InstancedMesh (olivos, juntas, celosía): se fusionan en mallas normales
  const merged: THREE.Mesh[] = [];
  const instanced: THREE.InstancedMesh[] = [];
  scene.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh || !im.visible || !im.parent || im.count === 0) return;
    let vis = true;
    for (let p: THREE.Object3D | null = im; p; p = p.parent) if (!p.visible) vis = false;
    if (!vis) return;
    instanced.push(im);
  });
  for (const im of instanced) {
    const base = im.geometry.index ? im.geometry.toNonIndexed() : im.geometry.clone();
    for (const k of Object.keys(base.attributes)) if (!['position', 'normal', 'uv'].includes(k)) base.deleteAttribute(k);
    const parts: THREE.BufferGeometry[] = [];
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, mtx);
      parts.push(base.clone().applyMatrix4(mtx));
    }
    const g = mergeGeometries(parts, false);
    parts.forEach((x) => x.dispose());
    base.dispose();
    if (!g) continue;
    const mesh = new THREE.Mesh(g, im.material);
    mesh.position.copy(im.position);
    mesh.quaternion.copy(im.quaternion);
    mesh.scale.copy(im.scale);
    im.parent!.add(mesh);
    im.visible = false;
    merged.push(mesh);
  }
  // materiales marcados como transparentes pero opacos: el trazador los trataría como vidrio
  const opaque: THREE.Material[] = [];
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) if (mat.transparent && mat.opacity >= 0.99 && !(mat as THREE.MeshPhysicalMaterial).transmission) { mat.transparent = false; opaque.push(mat); }
  });
  // copas que se atenúan cuando tapan la cámara: en la foto, opacas
  const faded: [THREE.Material, number][] = [];
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && !Array.isArray(m) && m.userData?.fade && m.opacity < 1) { faded.push([m, m.opacity]); m.opacity = 1; m.transparent = false; }
  });
  // sin texturas (diagnóstico o navegadores donde el atlas de texturas falla)
  const maps: [THREE.MeshStandardMaterial, THREE.Texture | null, THREE.Texture | null][] = [];
  if (!textures) scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && !Array.isArray(m) && (m.map || m.bumpMap)) { maps.push([m, m.map, m.bumpMap]); m.map = null; m.bumpMap = null; m.needsUpdate = true; }
  });
  return () => {
    faded.forEach(([m, op]) => { m.opacity = op; m.transparent = true; });
    maps.forEach(([m, a, b]) => { m.map = a; m.bumpMap = b; m.needsUpdate = true; });
    hidden.forEach((o) => { o.visible = true; });
    merged.forEach((m) => { m.parent?.remove(m); m.geometry.dispose(); });
    instanced.forEach((im) => { im.visible = true; });
    opaque.forEach((m) => { m.transparent = true; });
    envs.forEach(([mat, t]) => { mat.envMap = t; mat.needsUpdate = true; });
  };
}

/**
 * Cielo procedural equirectangular (sin descargas) para el trazador: degradado de horizonte a
 * cénit y suelo cálido. La luz directa la aporta el sol de la escena.
 */
export function skyTexture(kind: 'dia' | 'tarde' | 'noche') {
  const W = 256;
  const H = 128;
  const data = new Float32Array(W * H * 4);
  const pal = {
    dia: { zen: [0.42, 0.62, 0.95], hor: [0.95, 0.96, 0.98], gnd: [0.42, 0.33, 0.25], k: 1.1 },
    tarde: { zen: [0.42, 0.5, 0.78], hor: [1.0, 0.78, 0.55], gnd: [0.38, 0.27, 0.2], k: 0.8 },
    noche: { zen: [0.02, 0.03, 0.07], hor: [0.06, 0.07, 0.11], gnd: [0.02, 0.02, 0.02], k: 0.4 },
  }[kind];
  for (let y = 0; y < H; y++) {
    // en WebGL la fila 0 de la textura es la parte inferior: v = 0 nadir, v = 1 cénit
    const v = (y + 0.5) / H;
    const el = (v - 0.5) * Math.PI;
    for (let x = 0; x < W; x++) {
      let c: number[];
      if (el >= 0) {
        const t = Math.pow(Math.sin(el), 0.45);
        c = pal.hor.map((h, i) => h * (1 - t) + pal.zen[i] * t);
      } else {
        const t = Math.min(1, -el * 6);
        c = pal.hor.map((h, i) => h * (1 - t) * 0.6 + pal.gnd[i] * t);
      }
      const i = (y * W + x) * 4;
      data[i] = c[0] * pal.k;
      data[i + 1] = c[1] * pal.k;
      data[i + 2] = c[2] * pal.k;
      data[i + 3] = 1;
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.LinearSRGBColorSpace;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * Escena de trazado: una malla fusionada por material (en coordenadas del mundo) y copias de las
 * luces. El trazador guarda un material por malla; con miles de mallas el índice de material pasa a
 * 16 bits y en algunos navegadores se lee mal (colores cruzados). Fusionando quedan unas decenas.
 */
function buildTraceScene(scene: THREE.Scene) {
  const out = new THREE.Scene();
  out.background = scene.background;
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  scene.updateMatrixWorld(true);
  const visible = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; };
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || !visible(m) || !m.geometry?.attributes.position) return;
    const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(src.attributes)) if (!['position', 'normal', 'uv'].includes(k)) src.deleteAttribute(k);
    if (!src.attributes.normal) src.computeVertexNormals();
    if (!src.attributes.uv) src.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    src.applyMatrix4(m.matrixWorld);
    // un determinante negativo invierte las caras
    if (m.matrixWorld.determinant() < 0) {
      const pos = src.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
    }
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (Array.isArray(m.material) && src.groups.length) {
      for (const g of src.groups) {
        const part = new THREE.BufferGeometry();
        for (const k of Object.keys(src.attributes)) {
          const a = src.attributes[k] as THREE.BufferAttribute;
          part.setAttribute(k, new THREE.BufferAttribute((a.array as Float32Array).slice(g.start * a.itemSize, (g.start + g.count) * a.itemSize), a.itemSize));
        }
        const mat = mats[g.materialIndex ?? 0];
        if (mat) (byMat.get(mat) ?? byMat.set(mat, []).get(mat)!).push(part);
      }
      src.dispose();
    } else {
      src.clearGroups();
      (byMat.get(mats[0]) ?? byMat.set(mats[0], []).get(mats[0])!).push(src);
    }
  });
  const geos: THREE.BufferGeometry[] = [];
  for (const [mat, list] of byMat) {
    const g = mergeGeometries(list, false);
    list.forEach((x) => x.dispose());
    if (!g) continue;
    geos.push(g);
    out.add(new THREE.Mesh(g, mat));
  }
  // luces: copias en su posición del mundo
  scene.traverse((o) => {
    const l = o as THREE.Light;
    if (!l.isLight || !visible(l) || (l as THREE.AmbientLight).isAmbientLight || (l as THREE.HemisphereLight).isHemisphereLight) return;
    const c = l.clone() as THREE.Light;
    l.getWorldPosition(c.position);
    const t = (l as THREE.DirectionalLight).target;
    if (t) {
      const ct = new THREE.Object3D();
      t.getWorldPosition(ct.position);
      out.add(ct);
      (c as THREE.DirectionalLight).target = ct;
    }
    out.add(c);
  });
  out.updateMatrixWorld(true);
  return { scene: out, dispose: () => geos.forEach((g) => g.dispose()) };
}

export async function renderPhoto(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, o: PhotoOptions): Promise<HTMLCanvasElement> {
  const restore = prepare(scene, o.textures !== false);
  const prevRatio = gl.getPixelRatio();
  const w = Math.round(gl.domElement.width / prevRatio);
  const h = Math.round(gl.domElement.height / prevRatio);
  if (o.scale && o.scale !== 1) {
    gl.setPixelRatio(o.scale);
    gl.setSize(w, h, false);
  }
  const prevExposure = gl.toneMappingExposure;
  if (o.exposure) gl.toneMappingExposure = o.exposure;
  const pt = new WebGLPathTracer(gl);
  let trace: ReturnType<typeof buildTraceScene> | null = null;
  const prevEnv = scene.environment;
  const prevIntensity = scene.environmentIntensity;
  const sky = skyTexture(o.sky ?? 'dia');
  scene.environment = sky;
  scene.environmentIntensity = 1;
  try {
    pt.renderToCanvas = true;
    pt.minSamples = 0;
    pt.renderDelay = 0;
    pt.fadeDuration = 0;
    pt.tiles.set(2, 2);
    pt.filterGlossyFactor = 0.5;
    pt.bounces = 5;
    pt.transmissiveBounces = 4;
    // la luz de entorno de la escena actúa como cielo; el fondo se conserva
    trace = buildTraceScene(scene);
    for (const p of o.studioLights ?? []) {
      // plafón cálido de ≈1000 lm (≈80 cd) por estancia
      const l = new THREE.PointLight(0xffd9b0, 80, 0, 2);
      l.position.set(p[0], p[1], p[2]);
      trace.scene.add(l);
    }
    trace.scene.environment = sky;
    trace.scene.environmentIntensity = 1;
    pt.setScene(trace.scene, camera);
    // las primeras llamadas pueden no sumar muestras mientras se compilan los shaders: se cuenta
    // por las muestras reales del trazador (con teselas 2×2, cuatro llamadas = una muestra)
    let guard = 0;
    const ctx = gl.getContext();
    const px = new Uint8Array(4);
    while (pt.samples < o.samples && guard < o.samples * 8 + 200) {
      if (o.signal?.aborted) throw new DOMException('Render cancelado', 'AbortError');
      pt.renderSample();
      guard++;
      // la GPU trabaja en diferido: leer un píxel obliga a terminar la muestra (progreso real y cancelable)
      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      if (guard % 4 === 0) {
        o.onProgress?.(Math.min(o.samples, Math.floor(pt.samples)), o.samples);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    if (pt.samples < 1) throw new Error('El trazador no ha producido ninguna muestra en este navegador.');
    const out = document.createElement('canvas');
    out.width = gl.domElement.width;
    out.height = gl.domElement.height;
    out.getContext('2d')!.drawImage(gl.domElement, 0, 0);
    if (o.denoise) denoiseCanvas(out);
    return out;
  } finally {
    gl.toneMappingExposure = prevExposure;
    pt.dispose();
    trace?.dispose();
    sky.dispose();
    scene.environment = prevEnv;
    scene.environmentIntensity = prevIntensity;
    restore();
    if (gl.getPixelRatio() !== prevRatio) {
      gl.setPixelRatio(prevRatio);
      gl.setSize(w, h, false);
    }
  }
}

/** Una luz de estudio en el techo de cada estancia (a 0,3 m del techo del nivel). */
export function studioLights(layout: { rooms: { levelId: string; polygon: [number, number][] }[]; levels: { id: string; elevation: number; wallHeight: number }[] }): [number, number, number][] {
  return layout.rooms.map((r) => {
    const l = layout.levels.find((x) => x.id === r.levelId);
    const xs = r.polygon.map((p) => p[0]);
    const ys = r.polygon.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (l?.elevation ?? 0) + Math.max(2.2, (l?.wallHeight ?? 2.5) - 0.3), (Math.min(...ys) + Math.max(...ys)) / 2] as [number, number, number];
  });
}

/**
 * Filtro bilateral (dos pasadas, ventana 5 × 5): promedia píxeles vecinos de color parecido, de modo
 * que reduce el ruido de pocas muestras sin borrar los bordes. Es un postproceso, no añade detalle.
 */
export function denoiseCanvas(c: HTMLCanvasElement, passes = 2) {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h);
  let src = new Float32Array(img.data);
  const R = 2;
  const ss = 2 * 1.6 * 1.6;
  const sr = 2 * 38 * 38;
  const sw: number[] = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) sw.push(Math.exp(-(dx * dx + dy * dy) / ss));
  for (let p = 0; p < passes; p++) {
    const dst = new Float32Array(src.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // referencia: media 3 × 3 (más estable que el píxel ruidoso)
        let mr = 0, mg = 0, mb = 0, mn = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          const j = (yy * w + xx) * 4;
          mr += src[j]; mg += src[j + 1]; mb += src[j + 2]; mn++;
        }
        mr /= mn; mg /= mn; mb /= mn;
        let r = 0, g = 0, b = 0, ws = 0, k = 0;
        for (let dy = -R; dy <= R; dy++)
          for (let dx = -R; dx <= R; dx++, k++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            const j = (yy * w + xx) * 4;
            const d2 = (src[j] - mr) ** 2 + (src[j + 1] - mg) ** 2 + (src[j + 2] - mb) ** 2;
            const wt = sw[k] * Math.exp(-d2 / sr);
            r += src[j] * wt; g += src[j + 1] * wt; b += src[j + 2] * wt; ws += wt;
          }
        dst[i] = r / ws; dst[i + 1] = g / ws; dst[i + 2] = b / ws; dst[i + 3] = 255;
      }
    src = dst;
  }
  for (let i = 0; i < src.length; i++) img.data[i] = src[i];
  ctx.putImageData(img, 0, 0);
}
