/**
 * Texturas procedurales generadas en el navegador (sin descargar imágenes ni usar fotos de
 * referencia). Cada textura representa un tramo de tamaño real conocido (`size`, en metros) y
 * se repite; las geometrías usan UV en metros (ver `uvBox`), así la escala es la misma en todo
 * el modelo. Se generan una vez y se comparten entre materiales.
 *
 * Los colores van casi en blanco y se tiñen con el color del acabado elegido, de modo que el
 * mismo despiece sirve para cualquier tono.
 */
import * as THREE from 'three';

export interface TexturePair {
  map: THREE.Texture;
  bump: THREE.Texture;
  /** metros que cubre una repetición */
  size: number;
}

const cache = new Map<string, TexturePair | null>();

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(px: number) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  return ctx ? { c, ctx } : null;
}

function toTex(c: HTMLCanvasElement, color: boolean, size: number) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  // la textura cubre `size` metros: con UV en metros se repite 1/size veces por metro
  t.repeat.set(1 / size, 1 / size);
  return t;
}

/** ruido de valor suave (para variaciones de tono grandes sin repetición evidente) */
function smoothNoise(ctx: CanvasRenderingContext2D, px: number, r: () => number, cells: number, amp: number, alpha = 1) {
  const g: number[] = [];
  for (let i = 0; i < (cells + 1) * (cells + 1); i++) g.push(r());
  const at = (x: number, y: number) => g[(y % cells) * (cells + 1) + (x % cells)];
  const img = ctx.getImageData(0, 0, px, px);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const fx = (x / px) * cells;
      const fy = (y / px) * cells;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const v = (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
      const d = (v - 0.5) * amp * alpha;
      const i = (y * px + x) * 4;
      img.data[i] += d;
      img.data[i + 1] += d;
      img.data[i + 2] += d;
    }
  ctx.putImageData(img, 0, 0);
}

function grain(ctx: CanvasRenderingContext2D, px: number, r: () => number, amp: number) {
  const img = ctx.getImageData(0, 0, px, px);
  for (let i = 0; i < img.data.length; i += 4) {
    const d = (r() - 0.5) * amp;
    img.data[i] += d;
    img.data[i + 1] += d;
    img.data[i + 2] += d;
  }
  ctx.putImageData(img, 0, 0);
}

function make(key: string, build: () => TexturePair | null): TexturePair | null {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key)!;
}

/** Cal / revoco mate: grano fino y nubes de tono muy suaves (tramo de 2 m). */
export function plasterTex() {
  return make('plaster', () => {
    const px = 512;
    const a = canvas(px);
    const b = canvas(px);
    if (!a || !b) return null;
    const r = rng(11);
    a.ctx.fillStyle = '#f4f4f4';
    a.ctx.fillRect(0, 0, px, px);
    smoothNoise(a.ctx, px, r, 6, 7);
    smoothNoise(a.ctx, px, r, 24, 4);
    grain(a.ctx, px, r, 7);
    b.ctx.fillStyle = '#808080';
    b.ctx.fillRect(0, 0, px, px);
    smoothNoise(b.ctx, px, r, 40, 60);
    grain(b.ctx, px, r, 40);
    return { map: toTex(a.c, true, 2), bump: toTex(b.c, false, 2), size: 2 };
  });
}

/**
 * Piezas cerámicas en hileras: despiece con juntas, variación de tono entre piezas y relieve.
 * `w` × `h` = medidas de la pieza (m); `bond` = desplazamiento de hiladas (0,5 = a matajunta).
 */
export function tileTex(key: string, o: { w: number; h: number; joint: number; bond: number; jointTone: number; vary: number; seed: number; size: number }) {
  return make(`tile-${key}`, () => {
    const px = 1024;
    const a = canvas(px);
    const b = canvas(px);
    if (!a || !b) return null;
    const r = rng(o.seed);
    const k = px / o.size;
    const jt = Math.round(o.jointTone * 255);
    a.ctx.fillStyle = `rgb(${jt},${jt},${jt - 6})`;
    a.ctx.fillRect(0, 0, px, px);
    b.ctx.fillStyle = '#3a3a3a';
    b.ctx.fillRect(0, 0, px, px);
    const rows = Math.round(o.size / o.h);
    const cols = Math.round(o.size / o.w);
    const pw = px / cols;
    const ph = px / rows;
    const jp = Math.max(1, o.joint * k);
    for (let row = 0; row < rows; row++) {
      const off = ((row * o.bond) % 1) * pw;
      for (let col = -1; col <= cols; col++) {
        const x = col * pw + off;
        const y = row * ph;
        // tono de cada pieza: variación de cocción (más clara / más tostada) y un leve cambio de matiz
        const v = 1 - r() * o.vary;
        const warm = (r() - 0.5) * o.vary * 0.6;
        const R = Math.min(255, Math.round(250 * v * (1 + warm)));
        const G = Math.round(244 * v);
        const B = Math.round(236 * v * (1 - warm));
        a.ctx.fillStyle = `rgb(${R},${G},${B})`;
        a.ctx.fillRect(x + jp / 2, y + jp / 2, pw - jp, ph - jp);
        // relieve: cara de la pieza más alta que la junta, con el borde algo redondeado
        const grd = b.ctx.createLinearGradient(x, y, x, y + ph);
        grd.addColorStop(0, '#bdbdbd');
        grd.addColorStop(0.5, '#d8d8d8');
        grd.addColorStop(1, '#b4b4b4');
        b.ctx.fillStyle = grd;
        b.ctx.fillRect(x + jp / 2, y + jp / 2, pw - jp, ph - jp);
      }
    }
    // poros y manchas de barro dentro de las piezas
    smoothNoise(a.ctx, px, r, 30, 14);
    grain(a.ctx, px, r, 10);
    grain(b.ctx, px, r, 26);
    return { map: toTex(a.c, true, o.size), bump: toTex(b.c, false, o.size), size: o.size };
  });
}

/** Ladrillo de rasilla de la volta catalana (≈28 × 14 cm a matajunta, juntas de mortero claro). */
export const voltaTex = () => tileTex('volta', { w: 0.28, h: 0.14, joint: 0.012, bond: 0.5, jointTone: 0.86, vary: 0.24, seed: 5, size: 1.12 });
/** Piezas estrechas verticales de terracota (≈7,5 × 30 cm) con junta clara: isla y franja del baño. */
export const vertTileTex = () => tileTex('vert', { w: 0.075, h: 0.3, joint: 0.005, bond: 0, jointTone: 1.0, vary: 0.22, seed: 9, size: 0.6 });

/** Madera con veta continua en V (eje vertical de la textura) y algunos nudos (tramo de 1 m). */
export function woodTex() {
  return make('wood', () => {
    const px = 1024;
    const a = canvas(px);
    const b = canvas(px);
    if (!a || !b) return null;
    const r = rng(23);
    a.ctx.fillStyle = '#f2ece2';
    a.ctx.fillRect(0, 0, px, px);
    b.ctx.fillStyle = '#808080';
    b.ctx.fillRect(0, 0, px, px);
    // tablas de ≈20 cm con tono algo distinto
    const boards = 5;
    for (let i = 0; i < boards; i++) {
      const v = 0.92 + r() * 0.08;
      a.ctx.fillStyle = `rgba(${Math.round(240 * v)},${Math.round(228 * v)},${Math.round(210 * v)},0.6)`;
      a.ctx.fillRect((i * px) / boards, 0, px / boards, px);
    }
    const knots: { x: number; y: number; s: number }[] = Array.from({ length: 2 }, () => ({ x: r() * px, y: r() * px, s: 5 + r() * 8 }));
    // vetas: líneas casi verticales que se curvan alrededor de los nudos
    for (let l = 0; l < 150; l++) {
      const x0 = r() * px;
      const dark = 0.35 + r() * 0.45;
      a.ctx.strokeStyle = `rgba(150,110,70,${0.05 + dark * 0.12})`;
      b.ctx.strokeStyle = `rgba(40,40,40,${0.12 + dark * 0.2})`;
      a.ctx.lineWidth = b.ctx.lineWidth = 0.6 + r() * 1.8;
      const ph = r() * 6;
      for (const ctx of [a.ctx, b.ctx]) {
        ctx.beginPath();
        for (let y = 0; y <= px; y += 8) {
          let x = x0 + Math.sin(y / 140 + ph) * 6 + Math.sin(y / 37 + ph * 2) * 1.5;
          for (const k of knots) {
            const dy = y - k.y;
            const dx = x - k.x;
            const d2 = dx * dx + dy * dy;
            x += (dx / Math.sqrt(d2 + 1)) * k.s * 4 * Math.exp(-d2 / (k.s * k.s * 30));
          }
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    for (const k of knots) {
      for (let ring = 4; ring > 0; ring--) {
        a.ctx.fillStyle = `rgba(${150 - ring * 10},${108 - ring * 6},${70 - ring * 4},0.1)`;
        a.ctx.beginPath();
        a.ctx.ellipse(k.x, k.y, (k.s * ring) / 3, (k.s * ring) / 1.6, 0, 0, Math.PI * 2);
        a.ctx.fill();
      }
      b.ctx.fillStyle = 'rgba(30,30,30,0.25)';
      b.ctx.beginPath();
      b.ctx.ellipse(k.x, k.y, k.s / 2, k.s, 0, 0, Math.PI * 2);
      b.ctx.fill();
    }
    grain(a.ctx, px, r, 6);
    return { map: toTex(a.c, true, 1), bump: toTex(b.c, false, 1), size: 1 };
  });
}

/** Tejido (lino / algodón) con trama visible de cerca (tramo de 0,25 m). */
export function fabricTex() {
  return make('fabric', () => {
    const px = 256;
    const a = canvas(px);
    const b = canvas(px);
    if (!a || !b) return null;
    const r = rng(31);
    a.ctx.fillStyle = '#f3f1ec';
    a.ctx.fillRect(0, 0, px, px);
    b.ctx.fillStyle = '#808080';
    b.ctx.fillRect(0, 0, px, px);
    for (let i = 0; i < px; i += 2) {
      const t = 0.03 + r() * 0.05;
      a.ctx.fillStyle = `rgba(120,110,95,${t})`;
      a.ctx.fillRect(i, 0, 1, px);
      a.ctx.fillRect(0, i, px, 1);
      b.ctx.fillStyle = `rgba(0,0,0,${0.12 + r() * 0.1})`;
      b.ctx.fillRect(i, 0, 1, px);
      b.ctx.fillRect(0, i + 1, px, 1);
    }
    smoothNoise(a.ctx, px, r, 4, 8);
    return { map: toTex(a.c, true, 0.25), bump: toTex(b.c, false, 0.25), size: 0.25 };
  });
}

/** Fibra natural trenzada (yute / sisal) en espiga (tramo de 0,5 m). */
export function rugTex() {
  return make('rug', () => {
    const px = 512;
    const a = canvas(px);
    const b = canvas(px);
    if (!a || !b) return null;
    const r = rng(41);
    a.ctx.fillStyle = '#e9dcc4';
    a.ctx.fillRect(0, 0, px, px);
    b.ctx.fillStyle = '#606060';
    b.ctx.fillRect(0, 0, px, px);
    const s = 16;
    for (let y = 0; y < px; y += s)
      for (let x = 0; x < px; x += s) {
        const flip = ((x / s + y / s) % 2) === 0;
        const v = 0.85 + r() * 0.15;
        a.ctx.fillStyle = `rgb(${Math.round(214 * v)},${Math.round(190 * v)},${Math.round(150 * v)})`;
        a.ctx.save();
        a.ctx.translate(x + s / 2, y + s / 2);
        a.ctx.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
        a.ctx.fillRect(-s * 0.7, -s * 0.18, s * 1.4, s * 0.36);
        a.ctx.restore();
        b.ctx.save();
        b.ctx.translate(x + s / 2, y + s / 2);
        b.ctx.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
        b.ctx.fillStyle = '#d0d0d0';
        b.ctx.fillRect(-s * 0.7, -s * 0.18, s * 1.4, s * 0.36);
        b.ctx.restore();
      }
    grain(a.ctx, px, r, 14);
    return { map: toTex(a.c, true, 0.5), bump: toTex(b.c, false, 0.5), size: 0.5 };
  });
}

/** Superficie mineral (microcemento, encimera, solera): moteado fino y nubes suaves (tramo de 2 m). */
export function mineralTex(key: string, speck: number, seed: number) {
  return make(`mineral-${key}`, () => {
    const px = 512;
    const a = canvas(px);
    const b = canvas(px);
    if (!a || !b) return null;
    const r = rng(seed);
    a.ctx.fillStyle = '#f2f2f2';
    a.ctx.fillRect(0, 0, px, px);
    smoothNoise(a.ctx, px, r, 5, 18);
    smoothNoise(a.ctx, px, r, 18, 8);
    for (let i = 0; i < 2600 * speck; i++) {
      const v = r() < 0.5 ? 70 : 255;
      a.ctx.fillStyle = `rgba(${v},${v},${v},${0.08 + r() * 0.12})`;
      a.ctx.fillRect(r() * px, r() * px, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    b.ctx.fillStyle = '#808080';
    b.ctx.fillRect(0, 0, px, px);
    grain(b.ctx, px, r, 30);
    smoothNoise(b.ctx, px, r, 30, 30);
    return { map: toTex(a.c, true, 2), bump: toTex(b.c, false, 2), size: 2 };
  });
}

/** Grava suelta (tramo de 1 m). */
export function gravelTex() {
  return make('gravel', () => {
    const px = 512;
    const a = canvas(px);
    const b = canvas(px);
    if (!a || !b) return null;
    const r = rng(53);
    a.ctx.fillStyle = '#d9cfbf';
    a.ctx.fillRect(0, 0, px, px);
    b.ctx.fillStyle = '#404040';
    b.ctx.fillRect(0, 0, px, px);
    for (let i = 0; i < 5000; i++) {
      const x = r() * px;
      const y = r() * px;
      const s = 2 + r() * 5;
      const v = 150 + r() * 90;
      a.ctx.fillStyle = `rgb(${v},${v * 0.95},${v * 0.86})`;
      a.ctx.beginPath();
      a.ctx.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2);
      a.ctx.fill();
      b.ctx.fillStyle = `rgb(${180 + r() * 60},${180 + r() * 60},${180 + r() * 60})`;
      b.ctx.beginPath();
      b.ctx.ellipse(x, y, s * 0.8, s * 0.6, 0, 0, Math.PI * 2);
      b.ctx.fill();
    }
    return { map: toTex(a.c, true, 1), bump: toTex(b.c, false, 1), size: 1 };
  });
}

/** Tierra rojiza con piedras pequeñas para el terreno de la parcela (tramo de 4 m). */
export function soilTex() {
  return make('soil', () => {
    const px = 512;
    const a = canvas(px);
    if (!a) return null;
    const r = rng(61);
    a.ctx.fillStyle = '#f0f0f0';
    a.ctx.fillRect(0, 0, px, px);
    smoothNoise(a.ctx, px, r, 8, 40);
    smoothNoise(a.ctx, px, r, 32, 18);
    for (let i = 0; i < 2500; i++) {
      const v = 180 + r() * 75;
      a.ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
      a.ctx.fillRect(r() * px, r() * px, 1 + r() * 2.5, 1 + r() * 2);
    }
    const t = toTex(a.c, true, 4);
    return { map: t, bump: t, size: 4 };
  });
}

/**
 * Caja con UV en metros (cada cara mapeada a su tamaño real), para que las texturas mantengan
 * la escala en cualquier pieza. Cacheada por medidas.
 */
const boxCache = new Map<string, THREE.BoxGeometry>();
export function uvBox(w: number, h: number, d: number) {
  const key = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}`;
  let g = boxCache.get(key);
  if (g) return g;
  g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z (4 vértices cada una)
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
    }
  uv.needsUpdate = true;
  boxCache.set(key, g);
  return g;
}
