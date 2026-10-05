import type { Stair } from '../data/types';

/** Pieza de una escalera en U: peldaño, rellano intermedio o meseta de llegada. */
export interface StairPiece {
  rect: [number, number, number, number];
  /** cota de la cara superior, relativa al nivel de arranque */
  top: number;
  kind: 'peldaño' | 'rellano' | 'meseta';
  flight: 1 | 2;
  /** sentido de subida de la pieza en planta (+1 / −1 sobre el eje y) */
  dir: 1 | -1;
}

/**
 * Escalera en U a lo largo del eje y: el primer tramo sube por una mitad del ancho hasta el rellano
 * del fondo (todo el ancho), el segundo vuelve por la otra mitad y termina en una meseta al nivel
 * de llegada. Las huellas se miden desde el rellano.
 */
export function uStairPieces(st: Stair, height: number): StairPiece[] {
  if (!st.u || (st.up !== '+y' && st.up !== '-y')) return [];
  const [ax, ay, bx, by] = st.rect;
  const { landing, firstRisers: r1, tread: t, firstSide } = st.u;
  const n = Math.max(2, st.risers);
  const r2 = n - r1;
  const rise = height / n;
  const mid = (ax + bx) / 2;
  const s1: [number, number] = firstSide === 'x1' ? [mid, bx] : [ax, mid];
  const s2: [number, number] = firstSide === 'x1' ? [ax, mid] : [mid, bx];
  // d = +1: sube hacia y crecientes (rellano en el lado by)
  const d: 1 | -1 = st.up === '+y' ? 1 : -1;
  const edge = d > 0 ? by - landing : ay + landing; // borde del rellano hacia los tramos
  const span = (a: number, b: number): [number, number] => (a < b ? [a, b] : [b, a]);
  const out: StairPiece[] = [];
  for (let k = 0; k < r1 - 1; k++) {
    const [y0, y1] = span(edge - d * (r1 - 1 - k) * t, edge - d * (r1 - 2 - k) * t);
    out.push({ rect: [s1[0], y0, s1[1], y1], top: rise * (k + 1), kind: 'peldaño', flight: 1, dir: d });
  }
  const [l0, l1] = d > 0 ? [edge, by] : [ay, edge];
  out.push({ rect: [ax, l0, bx, l1], top: rise * r1, kind: 'rellano', flight: 1, dir: d });
  for (let j = 0; j < r2 - 1; j++) {
    const [y0, y1] = span(edge - d * j * t, edge - d * (j + 1) * t);
    out.push({ rect: [s2[0], y0, s2[1], y1], top: rise * (r1 + j + 1), kind: 'peldaño', flight: 2, dir: d > 0 ? -1 : 1 });
  }
  const end = edge - d * (r2 - 1) * t;
  const [m0, m1] = d > 0 ? [ay, end] : [end, by];
  out.push({ rect: [s2[0], m0, s2[1], m1], top: height, kind: 'meseta', flight: 2, dir: d > 0 ? -1 : 1 });
  return out;
}
