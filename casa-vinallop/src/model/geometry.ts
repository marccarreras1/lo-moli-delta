import type { Furniture, Opening, Vec2, Wall } from '../data/types';

export const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export function fmtM(x: number, d = 2) {
  return x.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function wallLength(w: Wall) {
  return Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
}

export function wallDir(w: Wall): Vec2 {
  const L = wallLength(w);
  return [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
}

/** normal n = (-dy, dx). Con Y hacia abajo del papel, para un muro a→b hacia la derecha apunta hacia abajo. */
export function wallNormal(w: Wall): Vec2 {
  const [dx, dy] = wallDir(w);
  return [-dy, dx];
}

export function pointOnWall(w: Wall, s: number, side = 0): Vec2 {
  const d = wallDir(w);
  const n = wallNormal(w);
  return [w.a[0] + d[0] * s + n[0] * side, w.a[1] + d[1] * s + n[1] * side];
}

/** Rectángulo (4 vértices) de un tramo de muro entre s0 y s1 a lo largo del eje. */
export function wallSegmentRect(w: Wall, s0: number, s1: number): Vec2[] {
  const h = w.thickness / 2;
  return [pointOnWall(w, s0, -h), pointOnWall(w, s1, -h), pointOnWall(w, s1, h), pointOnWall(w, s0, h)];
}

export interface WallPiece {
  s0: number;
  s1: number;
  z0: number;
  z1: number;
}

/**
 * Descompone un muro en piezas macizas dejando los huecos reales:
 * tramos completos entre huecos, antepechos, dinteles y macizos entre huecos
 * superpuestos en vertical (p. ej. un hueco de planta baja y otro del altell).
 */
export function wallPieces(w: Wall, openings: Opening[]): WallPiece[] {
  const [e0, e1] = w.ext ?? [0, 0];
  const start = -e0;
  const end = wallLength(w) + e1;
  const ops = openings
    .filter((o) => o.wallId === w.id)
    .map((o) => ({ s0: Math.max(start, o.offset), s1: Math.min(end, o.offset + o.width), z0: Math.max(0, o.sill), z1: Math.min(w.height, o.sill + o.height) }))
    .filter((o) => o.s1 > o.s0 && o.z1 > o.z0);
  const cuts = [...new Set([start, end, ...ops.flatMap((o) => [o.s0, o.s1])])].sort((a, b) => a - b);
  const pieces: WallPiece[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const s0 = cuts[i];
    const s1 = cuts[i + 1];
    if (s1 - s0 < 1e-6) continue;
    const mid = (s0 + s1) / 2;
    const holes = ops.filter((o) => o.s0 < mid && o.s1 > mid).sort((a, b) => a.z0 - b.z0);
    let z = 0;
    const solids: [number, number][] = [];
    for (const hole of holes) {
      if (hole.z0 > z) solids.push([z, hole.z0]);
      z = Math.max(z, hole.z1);
    }
    if (z < w.height) solids.push([z, w.height]);
    for (const [z0, z1] of solids) {
      // une con la pieza anterior si continúa a la misma altura
      const prev = pieces.find((p) => Math.abs(p.s1 - s0) < 1e-6 && Math.abs(p.z0 - z0) < 1e-6 && Math.abs(p.z1 - z1) < 1e-6);
      if (prev) prev.s1 = s1;
      else pieces.push({ s0, s1, z0, z1 });
    }
  }
  return pieces.filter((p) => p.s1 - p.s0 > 1e-4 && p.z1 - p.z0 > 1e-4);
}

/** Área con signo (fórmula del lazo). */
export function signedArea(poly: Vec2[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export const polygonArea = (poly: Vec2[]) => Math.abs(signedArea(poly));

export function centroid(poly: Vec2[]): Vec2 {
  const A = signedArea(poly);
  if (Math.abs(A) < 1e-9) {
    const n = poly.length || 1;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return [cx / (6 * A), cy / (6 * A)];
}

export function bbox(poly: Vec2[]) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function pointInPolygon([x, y]: Vec2, poly: Vec2[], eps = 1e-6): boolean {
  // en el borde cuenta como dentro
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (distPointSegment([x, y], a, b) < eps) return true;
  }
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distPointSegment(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function segmentsCross(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2) {
  const d = (a: Vec2, b: Vec2, c: Vec2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return d1 * d2 < -1e-12 && d3 * d4 < -1e-12;
}

export function isSelfIntersecting(poly: Vec2[]) {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Área de solape aproximada entre dos polígonos por muestreo (suficiente para validar). */
export function overlapArea(a: Vec2[], b: Vec2[], step = 0.05) {
  const A = bbox(a);
  const B = bbox(b);
  const minX = Math.max(A.minX, B.minX);
  const maxX = Math.min(A.maxX, B.maxX);
  const minY = Math.max(A.minY, B.minY);
  const maxY = Math.min(A.maxY, B.maxY);
  if (maxX - minX <= step || maxY - minY <= step) return 0;
  let n = 0;
  for (let x = minX + step / 2; x < maxX; x += step)
    for (let y = minY + step / 2; y < maxY; y += step)
      if (pointInPolygon([x, y], a, -1) && pointInPolygon([x, y], b, -1)) n++;
  return n * step * step;
}

/** Huella en planta de un mueble ya girado. */
export function furnitureFootprint(f: Furniture): Vec2[] {
  const r = (f.rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const hw = f.w / 2;
  const hd = f.d / 2;
  // mesa redonda de comedor: polígono de 24 lados (las sillas en diagonal entran bajo el tablero)
  const local: Vec2[] = f.type === 'mesa-redonda'
    ? Array.from({ length: 24 }, (_, i) => [hw * Math.cos((i / 24) * Math.PI * 2), hd * Math.sin((i / 24) * Math.PI * 2)] as Vec2)
    : [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  return local.map(([lx, ly]) => [round(f.x + lx * c - ly * s, 4), round(f.y + lx * s + ly * c, 4)] as Vec2);
}

/** Zona barrida por una puerta (cuadrado lado = anchura) y datos para dibujar el arco. */
export function doorSwing(o: Opening, w: Wall) {
  if (!o.swing) return null;
  const n = wallNormal(w);
  const half = w.thickness / 2;
  const dir = o.swing.dir;
  const hingeS = o.swing.hinge === 'inicio' ? o.offset : o.offset + o.width;
  const freeS = o.swing.hinge === 'inicio' ? o.offset + o.width : o.offset;
  const hinge = pointOnWall(w, hingeS, dir * half);
  const closedEnd = pointOnWall(w, freeS, dir * half);
  const openEnd: Vec2 = [hinge[0] + n[0] * dir * o.width, hinge[1] + n[1] * dir * o.width];
  const zone: Vec2[] = [hinge, closedEnd, [closedEnd[0] + n[0] * dir * o.width, closedEnd[1] + n[1] * dir * o.width], openEnd];
  return { hinge, closedEnd, openEnd, zone, radius: o.width };
}
