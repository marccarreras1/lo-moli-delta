/**
 * Cielos reales (HDRI) para la luz de entorno y el modo fotografía. Vienen del paquete
 * @pmndrs/assets (CC0, procedentes de Poly Haven), a 512 × 256 px: bastan para iluminar y reflejar.
 *   tarde → «sunset» (sol a ≈3° sobre el horizonte, luz dorada)
 *   dia   → «park» (cielo despejado)
 * Se cargan bajo demanda (≈200 KB cada uno) y se guardan en memoria.
 */
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export type HdriName = 'sunset' | 'park';
const cache = new Map<HdriName, Promise<THREE.DataTexture>>();

async function dataUrl(name: HdriName): Promise<string> {
  if (name === 'sunset') return (await import('@pmndrs/assets/hdri/sunset.exr')).default;
  return (await import('@pmndrs/assets/hdri/park.exr')).default;
}

export function loadHdri(name: HdriName): Promise<THREE.DataTexture> {
  const hit = cache.get(name);
  if (hit) return hit;
  const p = (async () => {
    const url = await dataUrl(name);
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const loader = new EXRLoader();
    loader.setDataType(THREE.FloatType);
    const d = loader.parse(buf.buffer);
    const t = new THREE.DataTexture(d.data as Float32Array, d.width, d.height, THREE.RGBAFormat, THREE.FloatType);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    // los datos del EXR ya vienen de abajo arriba (fila 0 = nadir), como espera WebGL
    t.flipY = false;
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  })();
  cache.set(name, p);
  return p;
}

export const hdriFor = (ambience: 'dia' | 'tarde' | 'noche'): HdriName | null => (ambience === 'tarde' ? 'sunset' : ambience === 'dia' ? 'park' : null);
