/**
 * Árboles procedurales (sin descargas): tronco y ramas que se bifurcan, y copa formada por racimos
 * de tarjetas de hojas con transparencia recortada. Olivo: tronco corto y retorcido, hoja estrecha
 * gris verdosa; algarrobo: tronco más alto, copa ancha y aparasolada de hoja redonda verde oscura.
 * El suelo de la parcela usa una textura de tierra rojiza con piedras y hierba seca.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type TreeKind = 'olivo' | 'algarrobo';

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const texCache = new Map<string, THREE.Texture>();

/** Textura de hojas con canal alfa: muchas hojas pequeñas sobre fondo transparente. */
export function leafTexture(kind: TreeKind): THREE.Texture {
  const key = `hojas-${kind}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(kind === 'olivo' ? 7 : 19);
  const pal = kind === 'olivo'
    ? ['#a3ad92', '#b4bca4', '#96a185', '#c6ccb8', '#d4d8c8', '#8a9678']
    : ['#2f5a1e', '#3c6d26', '#264c18', '#4d8030', '#1f3d14', '#5f9038'];
  const n = kind === 'olivo' ? 520 : 380;
  for (let i = 0; i < n; i++) {
    // las hojas se concentran hacia el centro de la tarjeta (borde irregular)
    const a = r() * Math.PI * 2;
    const rad = Math.sqrt(r()) * S * 0.46;
    const x = S / 2 + Math.cos(a) * rad;
    const y = S / 2 + Math.sin(a) * rad;
    g.save();
    g.translate(x, y);
    g.rotate(r() * Math.PI * 2);
    g.fillStyle = pal[Math.floor(r() * pal.length)];
    g.beginPath();
    if (kind === 'olivo') g.ellipse(0, 0, 9 + r() * 6, 2 + r() * 1.2, 0, 0, Math.PI * 2);
    else g.ellipse(0, 0, 7 + r() * 4, 5 + r() * 2.5, 0, 0, Math.PI * 2);
    g.fill();
    // nervio central
    g.strokeStyle = 'rgba(30,35,20,0.25)';
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(-6, 0);
    g.lineTo(6, 0);
    g.stroke();
    g.restore();
  }
  // ramillas
  g.strokeStyle = kind === 'olivo' ? 'rgba(90,80,62,0.8)' : 'rgba(70,55,40,0.8)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(S / 2, S / 2);
    const a = r() * Math.PI * 2;
    g.lineTo(S / 2 + Math.cos(a) * S * 0.35, S / 2 + Math.sin(a) * S * 0.35);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Corteza: vetas verticales con grietas (gris pardo en el olivo, más oscura en el algarrobo). */
export function barkTexture(kind: TreeKind): THREE.Texture {
  const key = `corteza-${kind}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const W = 128;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const r = rng(kind === 'olivo' ? 3 : 5);
  g.fillStyle = kind === 'olivo' ? '#7a7062' : '#5f5246';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) {
    const x = r() * W;
    const v = Math.floor(70 + r() * 70);
    g.strokeStyle = `rgba(${v},${v - 8},${v - 18},${0.25 + r() * 0.4})`;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    g.moveTo(x, 0);
    let y = 0;
    let xx = x;
    while (y < H) { y += 8 + r() * 20; xx += (r() - 0.5) * 6; g.lineTo(xx, y); }
    g.stroke();
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = 'rgba(25,20,15,0.45)';
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 6 + r() * 26);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}

/** Tierra rojiza con piedras, terrones y matas de hierba seca (se repite cada pocos metros). */
export function soilTexture(): THREE.Texture {
  const hit = texCache.get('suelo');
  if (hit) return hit;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(23);
  // tierra salmón clara (fotos de dron), con zonas de grava gris
  g.fillStyle = '#c5a487';
  g.fillRect(0, 0, S, S);
  // manchas grandes (humedad, tierra removida)
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, rad = 20 + r() * 70;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const k = r();
    const tone = k < 0.35 ? '182,138,108' : k < 0.75 ? '216,196,172' : '176,172,164';
    grd.addColorStop(0, `rgba(${tone},0.35)`);
    grd.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // grano fino
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 26;
    img.data[i] += n; img.data[i + 1] += n * 0.85; img.data[i + 2] += n * 0.7;
  }
  g.putImageData(img, 0, 0);
  // piedras claras y oscuras
  for (let i = 0; i < 900; i++) {
    const x = r() * S, y = r() * S, s = 0.8 + r() * 3.2;
    const v = r() < 0.7 ? 205 + r() * 40 : 120 + r() * 30;
    g.fillStyle = `rgba(${v},${v - 6},${v - 12},${0.55 + r() * 0.4})`;
    g.beginPath();
    g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // matas de hierba seca y algo verde
  for (let i = 0; i < 90; i++) {
    const x = r() * S, y = r() * S;
    const green = r() < 0.12;
    g.strokeStyle = green ? 'rgba(115,125,80,0.6)' : 'rgba(196,176,128,0.6)';
    g.lineWidth = 0.8;
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      g.moveTo(x, y);
      const a = r() * Math.PI * 2;
      const l = 3 + r() * 7;
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  texCache.set('suelo', t);
  return t;
}

/** Segmento de rama: cilindro troncocónico de a a b, con UV de corteza en metros. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, sides: number) {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r1, r0, len, sides, 1, true);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r0 * 6, uv.getY(i) * len * 0.8);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  geo.applyQuaternion(q);
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

/** Racimo de hojas: tres tarjetas cruzadas orientadas al azar. */
function cluster(c: THREE.Vector3, size: number, r: () => number, out: THREE.BufferGeometry[]) {
  for (let k = 0; k < 3; k++) {
    const p = new THREE.PlaneGeometry(size * (0.8 + r() * 0.5), size * (0.7 + r() * 0.4));
    p.rotateY(r() * Math.PI);
    p.rotateX((r() - 0.5) * 1.2);
    p.rotateZ((r() - 0.5) * 0.8);
    p.translate(c.x + (r() - 0.5) * size * 0.4, c.y + (r() - 0.5) * size * 0.3, c.z + (r() - 0.5) * size * 0.4);
    // normales hacia fuera del centro de la copa: iluminación más suave que la de una tarjeta plana
    out.push(p);
  }
}

/**
 * Árbol procedural en coordenadas locales (base en el origen). Devuelve la madera y las hojas por
 * separado (dos materiales). `width` y `height` son el diámetro y la altura aproximados de la copa.
 */
export function buildTree(kind: TreeKind, seed: number, width: number, height: number) {
  const r = rng(seed);
  const wood: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  const olive = kind === 'olivo';
  const trunkH = olive ? height * 0.28 : height * 0.32;
  const trunkR = olive ? 0.22 + r() * 0.08 : 0.32;
  const base = new THREE.Vector3(0, 0, 0);
  // tronco algo inclinado y retorcido (dos tramos)
  const mid = new THREE.Vector3((r() - 0.5) * 0.3, trunkH * 0.55, (r() - 0.5) * 0.3);
  const top = new THREE.Vector3(mid.x + (r() - 0.5) * 0.35, trunkH, mid.z + (r() - 0.5) * 0.35);
  wood.push(limb(base, mid, trunkR * 1.25, trunkR, 9), limb(mid, top, trunkR, trunkR * 0.85, 9));
  const canopyR = width / 2;
  const leafSize = olive ? 1.1 : 1.45;
  const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    const to = from.clone().add(dir.clone().multiplyScalar(len));
    // la copa no pasa del contorno previsto
    to.y = Math.min(to.y, height - leafSize * 0.4);
    wood.push(limb(from, to, rad, rad * 0.7, depth > 1 ? 7 : 5));
    if (depth === 0) {
      const n = olive ? 4 : 5;
      for (let i = 0; i < n; i++) {
        const off = new THREE.Vector3((r() - 0.5) * 1.2, (r() - 0.2) * 0.7, (r() - 0.5) * 1.2);
        cluster(to.clone().add(off), leafSize * (0.8 + r() * 0.5), r, leaves);
      }
      return;
    }
    const kids = depth === 3 ? (olive ? 3 + Math.floor(r() * 2) : 4) : 2 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const az = (i / kids) * Math.PI * 2 + r() * 0.9;
      const spread = olive ? 0.55 + r() * 0.35 : 0.85 + r() * 0.35; // el algarrobo abre más
      const nd = new THREE.Vector3(Math.cos(az) * Math.sin(spread), Math.cos(spread), Math.sin(az) * Math.sin(spread));
      nd.lerp(dir, 0.35).normalize();
      grow(to, nd, len * (0.62 + r() * 0.15), rad * 0.62, depth - 1);
    }
  };
  const firstLen = olive ? Math.min(canopyR, height - trunkH) * 0.55 : canopyR * 0.5;
  grow(top, new THREE.Vector3(0, 1, 0), firstLen, trunkR * 0.8, 3);
  // relleno de la copa: racimos repartidos por un elipsoide para que no se vea hueca
  // copas densas como en las fotos de dron: el olivo casi no deja ver el interior y el algarrobo es una bóveda cerrada
  const fill = olive ? 34 : 170;
  const cy = trunkH + (height - trunkH) * (olive ? 0.55 : 0.62);
  const ry = (height - trunkH) * (olive ? 0.42 : 0.3);
  for (let i = 0; i < fill; i++) {
    const a = r() * Math.PI * 2;
    const u = Math.sqrt(r());
    const p = new THREE.Vector3(Math.cos(a) * u * canopyR * 0.92, cy + (r() - 0.5) * 2 * ry * (1 - u * 0.5), Math.sin(a) * u * canopyR * 0.92);
    cluster(p, leafSize * (0.9 + r() * 0.5), r, leaves);
  }
  const w = mergeGeometries(wood.map((g) => g.toNonIndexed()), false)!;
  const l = mergeGeometries(leaves.map((g) => g.toNonIndexed()), false)!;
  wood.forEach((g) => g.dispose());
  leaves.forEach((g) => g.dispose());
  // normales de las hojas hacia fuera del centro de la copa (sombreado de copa, no de tarjeta)
  const pos = l.attributes.position as THREE.BufferAttribute;
  const nrm = l.attributes.normal as THREE.BufferAttribute;
  const centre = new THREE.Vector3(0, cy, 0);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(centre);
    v.y *= 1.6;
    v.normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  return { wood: w, leaves: l };
}

export function leafMaterial(kind: TreeKind) {
  return new THREE.MeshStandardMaterial({
    map: leafTexture(kind), alphaTest: 0.45, side: THREE.DoubleSide, roughness: kind === 'olivo' ? 0.75 : 0.65,
    color: kind === 'olivo' ? '#f4f6ee' : '#e8efe2',
  });
}

export function barkMaterial(kind: TreeKind) {
  return new THREE.MeshStandardMaterial({ map: barkTexture(kind), roughness: 0.95 });
}

/** Mancha de sombra suave (gradiente radial) para las sombras lejanas de los árboles. */
export function blobTexture(): THREE.Texture {
  const hit = texCache.get('mancha');
  if (hit) return hit;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.85)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  texCache.set('mancha', t);
  return t;
}
