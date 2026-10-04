/**
 * Render fotográfico del mismo modelo con trazado de rayos progresivo (three-gpu-pathtracer):
 * iluminación indirecta, sombras suaves de contacto, reflejos y transparencias físicas a partir
 * de la escena que se ve en el visor. Cada pasada añade una muestra por píxel y la imagen se
 * va limpiando de ruido. Es mucho más lento que el visor interactivo: se lanza bajo demanda.
 */
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';

export interface PhotoOptions {
  samples: number;
  sky?: 'dia' | 'tarde' | 'noche';
  /** resolución relativa al visor (1 = la misma) */
  scale?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** Objetos que el trazador no puede usar o que no deben salir en la foto (líneas, rótulos, ayudas). */
function prepare(scene: THREE.Scene) {
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
  return () => hidden.forEach((o) => { o.visible = true; });
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
    const v = 1 - (y + 0.5) / H; // 1 = cénit, 0 = nadir
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

export async function renderPhoto(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, o: PhotoOptions): Promise<HTMLCanvasElement> {
  const restore = prepare(scene);
  const prevRatio = gl.getPixelRatio();
  const w = Math.round(gl.domElement.width / prevRatio);
  const h = Math.round(gl.domElement.height / prevRatio);
  if (o.scale && o.scale !== 1) {
    gl.setPixelRatio(o.scale);
    gl.setSize(w, h, false);
  }
  const pt = new WebGLPathTracer(gl);
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
    pt.setScene(scene, camera);
    for (let i = 0; i < o.samples; i++) {
      if (o.signal?.aborted) throw new DOMException('Render cancelado', 'AbortError');
      // con teselas 2×2, cuatro llamadas completan una muestra por píxel
      for (let t = 0; t < 4; t++) pt.renderSample();
      o.onProgress?.(i + 1, o.samples);
      await new Promise((r) => setTimeout(r, 0));
    }
    const out = document.createElement('canvas');
    out.width = gl.domElement.width;
    out.height = gl.domElement.height;
    out.getContext('2d')!.drawImage(gl.domElement, 0, 0);
    return out;
  } finally {
    pt.dispose();
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
