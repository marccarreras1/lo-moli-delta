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
    trace.scene.environment = sky;
    trace.scene.environmentIntensity = 1;
    pt.setScene(trace.scene, camera);
    // las primeras llamadas pueden no sumar muestras mientras se compilan los shaders: se cuenta
    // por las muestras reales del trazador (con teselas 2×2, cuatro llamadas = una muestra)
    let guard = 0;
    while (pt.samples < o.samples && guard < o.samples * 8 + 200) {
      if (o.signal?.aborted) throw new DOMException('Render cancelado', 'AbortError');
      pt.renderSample();
      guard++;
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
