/**
 * Recorrido a pie con colisiones: obstáculos en planta para un nivel (muros macizos con sus huecos
 * de paso, muebles, celosía de la ducha, barandillas) y movimiento con deslizamiento a lo largo de
 * ellos. La altura de los ojos es fija sobre el nivel (no se atraviesan techos ni forjados).
 */
import type { Layout, Vec2 } from '../data/types';
import { distPointSegment, furnitureFootprint, pointInPolygon, wallPieces, wallSegmentRect } from './geometry';

export const WALK_RADIUS = 0.22;
/** muebles que no impiden el paso (o están por encima de la cabeza) */
const PASSABLE = new Set(['alfombra', 'balda', 'aplique', 'jarron', 'ducha']);

export interface Obstacles {
  polys: Vec2[][];
  segs: [Vec2, Vec2][];
}

export function walkObstacles(layout: Layout, levelId: string): Obstacles {
  const lvl = layout.levels.find((l) => l.id === levelId);
  const elev = lvl?.elevation ?? 0;
  const elevOf = (id: string) => layout.levels.find((l) => l.id === id)?.elevation ?? 0;
  const polys: Vec2[][] = [];
  const segs: [Vec2, Vec2][] = [];
  // franja del cuerpo: de 0,25 a 1,70 m sobre el suelo del nivel
  const b0 = elev + 0.25;
  const b1 = elev + 1.7;
  for (const w of layout.walls) {
    const base = elevOf(w.levelId);
    if (base > b1 || base + w.height < b0) continue;
    for (const p of wallPieces(w, layout.openings)) if (base + p.z0 < b1 && base + p.z1 > b0) polys.push(wallSegmentRect(w, p.s0, p.s1));
  }
  const roomIds = new Set(layout.rooms.filter((r) => r.levelId === levelId).map((r) => r.id));
  for (const f of layout.furniture) {
    if (!roomIds.has(f.roomId)) continue;
    if (f.type === 'ducha') {
      // celosía hacia la zona seca con acceso central de 0,90 m
      const r = (f.rot * Math.PI) / 180;
      const P = (lx: number, lz: number): Vec2 => [f.x + lx * Math.cos(r) - lz * Math.sin(r), f.y + lx * Math.sin(r) + lz * Math.cos(r)];
      const z = -f.d / 2 - 0.05;
      segs.push([P(-f.w / 2, z), P(-0.45, z)], [P(0.45, z), P(f.w / 2, z)]);
      continue;
    }
    if (PASSABLE.has(f.type) || f.h < 0.3) continue;
    polys.push(furnitureFootprint(f));
  }
  for (const r of layout.railings ?? []) {
    if (r.levelId !== levelId) continue;
    for (let i = 0; i < r.points.length - 1; i++) segs.push([r.points[i], r.points[i + 1]]);
  }
  // hueco de la escalera visto desde el altell: no se puede pisar
  if (elev > 0) for (const st of layout.stairs) if (st.toLevel === levelId) {
    const [x0, y0, x1, y1] = st.rect;
    polys.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  }
  return { polys, segs };
}

export function blocked(p: Vec2, o: Obstacles, radius = WALK_RADIUS): boolean {
  for (const poly of o.polys) {
    if (pointInPolygon(p, poly)) return true;
    for (let i = 0; i < poly.length; i++) if (distPointSegment(p, poly[i], poly[(i + 1) % poly.length]) < radius) return true;
  }
  for (const [a, b] of o.segs) if (distPointSegment(p, a, b) < radius) return true;
  return false;
}

/** Intenta mover de `from` a `from + d`; si choca, desliza por un eje. Devuelve la nueva posición. */
export function walkStep(from: Vec2, d: Vec2, o: Obstacles): Vec2 {
  const full: Vec2 = [from[0] + d[0], from[1] + d[1]];
  if (!blocked(full, o)) return full;
  const xs: Vec2 = [from[0] + d[0], from[1]];
  if (Math.abs(d[0]) > 1e-6 && !blocked(xs, o)) return xs;
  const zs: Vec2 = [from[0], from[1] + d[1]];
  if (Math.abs(d[1]) > 1e-6 && !blocked(zs, o)) return zs;
  return from;
}

/** Punto libre cerca del centro de una estancia (para los atajos de habitación). */
export function freeSpotIn(layout: Layout, roomId: string): Vec2 | null {
  const room = layout.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const o = walkObstacles(layout, room.levelId);
  const xs = room.polygon.map((p) => p[0]);
  const ys = room.polygon.map((p) => p[1]);
  const c: Vec2 = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  for (let rr = 0; rr < 3; rr += 0.1)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const p: Vec2 = [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr];
      if (pointInPolygon(p, room.polygon) && !blocked(p, o, WALK_RADIUS + 0.05)) return p;
      if (rr === 0) break;
    }
  return null;
}
