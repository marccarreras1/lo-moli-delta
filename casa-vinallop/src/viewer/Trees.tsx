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
  const S = kind === 'algarrobo' ? 512 : 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(kind === 'olivo' ? 7 : 19);
  const pal = kind === 'olivo'
    ? ['#a3ad92', '#b4bca4', '#96a185', '#c6ccb8', '#d4d8c8', '#8a9678']
    : ['#3b5230', '#4a6238', '#33472a', '#566d40', '#2c3d24', '#8aa85c'];
  const n = kind === 'olivo' ? 520 : 380;
  if (kind === 'algarrobo') {
    // hojas compuestas: raquis con 3–5 pares de folíolos redondeados (fotos del algarrobo)
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * S * 0.42;
      const young = r() < 0.12;
      g.save();
      g.translate(S / 2 + Math.cos(a) * rad, S / 2 + Math.sin(a) * rad);
      g.rotate(r() * Math.PI * 2);
      const pairs = 3 + Math.floor(r() * 3);
      const col = young ? pal[5] : pal[Math.floor(r() * 5)];
      g.strokeStyle = 'rgba(60,70,40,0.7)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(pairs * 16 + 10, 0);
      g.stroke();
      for (let k = 0; k < pairs; k++) {
        for (const side of [-1, 1]) {
          // folíolo con luz en el haz y algo más oscuro en el borde
          const x = 10 + k * 16;
          const y = side * 11;
          const grd = g.createRadialGradient(x - 2, y - 2, 1, x, y, 11);
          grd.addColorStop(0, col);
          grd.addColorStop(1, 'rgba(30,40,22,0.95)');
          g.fillStyle = grd;
          g.beginPath();
          g.ellipse(x, y, 10 + r() * 2.5, 7 + r() * 1.5, side * 0.5, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
    }
  }
  for (let i = 0; i < (kind === 'algarrobo' ? 0 : n); i++) {
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
  g.fillStyle = kind === 'olivo' ? '#7a7062' : '#8a8073';
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
/** caja de un volumen de la casa en coordenadas del árbol: [x0, z0, x1, z1, cota superior] */
export type TreeObstacle = [number, number, number, number, number];

/** tronco de un árbol concreto (medido o según fotos): radio en el pie y altura hasta la cruz; `viejo` = retorcido y con rebordes */
export interface TreeTrunk { r: number; h: number; viejo?: boolean }

export function buildTree(kind: TreeKind, seed: number, width: number, height: number, obstacles: TreeObstacle[] = [], trunk?: TreeTrunk) {
  const r = rng(seed);
  // ramas y hojas no pueden entrar en la casa: lo que caería dentro se poda (como se haría en la obra)
  const inside = (p: THREE.Vector3, m: number) => obstacles.some(([x0, z0, x1, z1, top]) => p.x > x0 - m && p.x < x1 + m && p.z > z0 - m && p.z < z1 + m && p.y < top + m);
  const wood: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  const olive = kind === 'olivo';
  // algarrobo (fotos): tronco de ≈1 m en la base, retorcido, que se abre en ramas gruesas a 2–2,5 m
  const trunkH = trunk?.h ?? (olive ? height * 0.32 : height * 0.29);
  const trunkR = trunk?.r ?? (olive ? 0.22 + r() * 0.08 : 0.44);
  // olivo viejo (foto del olivo grande): tronco grueso y retorcido como el del algarrobo
  const gnarled = !olive || !!trunk?.viejo;
  const base = new THREE.Vector3(0, 0, 0);
  // tronco inclinado y retorcido: varios tramos con desvíos (más en el algarrobo)
  const steps = gnarled ? 4 : 2;
  let prev = base;
  let rad = trunkR * 1.3;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const lean = gnarled ? 0.32 : 0.18;
    const next = new THREE.Vector3(prev.x + (r() - 0.5) * lean + (olive ? 0 : 0.06), trunkH * t, prev.z + (r() - 0.5) * lean);
    const nr = trunkR * (1.3 - 0.45 * t);
    wood.push(limb(prev, next, rad, nr, 11));
    // rebordes del tronco retorcido: tiras más finas que giran alrededor
    if (gnarled) for (let k = 0; k < 3; k++) {
      const a0 = (k / 3) * Math.PI * 2 + t * 1.4;
      const a1 = a0 + 0.5;
      const o0 = new THREE.Vector3(Math.cos(a0) * rad * 0.8, 0, Math.sin(a0) * rad * 0.8);
      const o1 = new THREE.Vector3(Math.cos(a1) * nr * 0.8, 0, Math.sin(a1) * nr * 0.8);
      wood.push(limb(prev.clone().add(o0), next.clone().add(o1), rad * 0.38, nr * 0.38, 6));
    }
    prev = next;
    rad = nr;
  }
  const top = prev;
  // raíces vistas que se abren en el pie
  const roots = olive ? 4 : 7;
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + r() * 0.5;
    const reach = (olive ? 0.55 : 1.15) * (0.7 + r() * 0.5);
    const from = new THREE.Vector3(Math.cos(a) * trunkR * 0.5, olive ? 0.25 : 0.45, Math.sin(a) * trunkR * 0.5);
    const to = new THREE.Vector3(Math.cos(a) * reach, -0.04, Math.sin(a) * reach);
    wood.push(limb(from, to, trunkR * (olive ? 0.35 : 0.4), 0.05, 6));
  }
  const canopyR = width / 2;
  const leafSize = olive ? 1.1 : 1.0;
  const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    const to = from.clone().add(dir.clone().multiplyScalar(len));
    // la copa no pasa del contorno previsto
    to.y = Math.min(to.y, height - leafSize * 0.4);
    if (inside(to, 0.25) || inside(from.clone().lerp(to, 0.5), 0.2)) return;
    wood.push(limb(from, to, rad, rad * 0.7, depth > 1 ? 7 : 5));
    if (depth === 0) {
      const n = olive ? 4 : 5;
      for (let i = 0; i < n; i++) {
        const off = new THREE.Vector3((r() - 0.5) * 1.2, (r() - 0.2) * 0.7, (r() - 0.5) * 1.2);
        const c = to.clone().add(off);
        const size = leafSize * (0.8 + r() * 0.5);
        if (!inside(c, size)) cluster(c, size, r, leaves);
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
  const fill = olive ? 34 : 360;
  // el algarrobo tiene la copa baja y ancha, con ramas que cuelgan por los bordes
  const cy = trunkH + (height - trunkH) * (olive ? 0.55 : 0.5);
  const ry = (height - trunkH) * (olive ? 0.42 : 0.42);
  for (let i = 0; i < fill; i++) {
    const a = r() * Math.PI * 2;
    const u = Math.sqrt(r());
    const droop = olive ? 0 : u * u * 1.6;
    const p = new THREE.Vector3(Math.cos(a) * u * canopyR * 0.95, cy + (r() - 0.5) * 2 * ry * (1 - u * 0.5) - droop, Math.sin(a) * u * canopyR * 0.95);
    p.y = Math.max(p.y, olive ? 1.75 : 1.7);
    const size = leafSize * (0.9 + r() * 0.5);
    if (!inside(p, size)) cluster(p, size, r, leaves);
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
    map: leafTexture(kind), alphaTest: 0.5, side: THREE.DoubleSide, roughness: kind === 'olivo' ? 0.75 : 0.65,
    color: kind === 'olivo' ? '#f4f6ee' : '#ffffff',
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

/** Hojarasca: hojas y vainas secas sobre la tierra (bajo el algarrobo). */
export function litterTexture(): THREE.Texture {
  const hit = texCache.get('hojarasca');
  if (hit) return hit;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(53);
  g.fillStyle = '#8a7462';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const v = 50 + r() * 90;
    g.fillStyle = `rgba(${v + 20},${v + 8},${v - 5},0.9)`;
    g.save();
    g.translate(r() * S, r() * S);
    g.rotate(r() * Math.PI);
    g.fillRect(-3, -1.2, 6 + r() * 8, 2.4);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  texCache.set('hojarasca', t);
  return t;
}

/** Máscara de disco con borde suave (canal verde, para alphaMap). */
export function discAlphaTexture(): THREE.Texture {
  const hit = texCache.get('disco');
  if (hit) return hit;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, '#fff');
  grd.addColorStop(0.6, '#e0e0e0');
  grd.addColorStop(1, '#000');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  texCache.set('disco', t);
  return t;
}

/** Mata de hierba seca: hojas finas amarillentas con algo de verde, fondo transparente. */
export function grassTexture(): THREE.Texture {
  const hit = texCache.get('hierba');
  if (hit) return hit;
  const W = 256;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const r = rng(61);
  for (let i = 0; i < 70; i++) {
    const x0 = W / 2 + (r() - 0.5) * W * 0.35;
    const len = H * (0.35 + r() * 0.6);
    const bend = (r() - 0.5) * W * 0.5;
    const v = r();
    g.strokeStyle = v < 0.15 ? `rgba(120,128,88,0.95)` : `rgba(${175 + r() * 35},${162 + r() * 30},${125 + r() * 25},0.95)`;
    g.lineWidth = 0.8 + r() * 1.1;
    g.beginPath();
    g.moveTo(x0, H);
    g.quadraticCurveTo(x0 + bend * 0.3, H - len * 0.6, x0 + bend, H - len);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set('hierba', t);
  return t;
}

/** Piedra caliza baja: icosaedro deformado y aplastado. */
export function rockGeometry(seed: number) {
  const r = rng(seed);
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const k = 0.75 + r() * 0.5;
    p.setXYZ(i, p.getX(i) * k, Math.max(-0.2, p.getY(i) * k * 0.55), p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}
