/**
 * Espacios de paso: distancias libres entre muebles enfrentados y entre muebles y los límites de
 * su estancia, para evaluar la circulación. Usa las huellas en planta (rectángulos alineados con
 * los ejes tras el giro). Criterio orientativo: ≥ 0,90 m cómodo · 0,70–0,90 m justo · < 0,70 m
 * estrecho. No sustituye a la normativa de accesibilidad.
 */
import type { Furniture, Layout, Vec2 } from '../data/types';
import { bbox, furnitureFootprint } from './geometry';

export interface Passage {
  a: Vec2;
  b: Vec2;
  width: number;
  level: 'ok' | 'justo' | 'estrecho';
  between: string;
  levelId: string;
}

/** piezas que no ocupan el suelo de paso */
const IGNORE = new Set(['alfombra', 'aplique', 'jarron', 'balda']);
const MAX = 1.3;
/** por debajo de 0,30 m no es un paso: son piezas juntas (taburetes, mesitas) */
const MIN = 0.3;
/** parejas que se usan juntas y no forman paso (sofá y su mesa baja) */
const PAIRED = (a: string, b: string) => (a === 'sofa-l' && b === 'mesa-centro') || (a === 'mesa-centro' && b === 'sofa-l');

export function passages(layout: Layout): Passage[] {
  const out: Passage[] = [];
  for (const room of layout.rooms) {
    const rb = bbox(room.polygon);
    const items = layout.furniture.filter((f) => f.roomId === room.id && !IGNORE.has(f.type) && !(f.type === 'mesita' && f.w < 0.32));
    const boxes = items.map((f) => ({ f, b: bbox(furnitureFootprint(f)) }));
    for (const { f, b } of boxes) {
      // en cada dirección se busca el obstáculo más próximo (otro mueble o el límite de la estancia)
      for (const dir of ['+x', '-x', '+y', '-y'] as const) {
        const alongX = dir === '+x' || dir === '-x';
        const sign = dir[0] === '+' ? 1 : -1;
        const from = alongX ? (sign > 0 ? b.maxX : b.minX) : sign > 0 ? b.maxY : b.minY;
        let best = { gap: Infinity, label: 'muro', at: 0 };
        const lo = alongX ? b.minY : b.minX;
        const hi = alongX ? b.maxY : b.maxX;
        // límite de la estancia
        const wall = alongX ? (sign > 0 ? rb.maxX : rb.minX) : sign > 0 ? rb.maxY : rb.minY;
        const wg = (wall - from) * sign;
        if (wg >= 0) best = { gap: wg, label: room.name.toLowerCase(), at: (lo + hi) / 2 };
        for (const o of boxes) {
          if (o.f === f || PAIRED(f.type, o.f.type)) continue;
          const olo = alongX ? o.b.minY : o.b.minX;
          const ohi = alongX ? o.b.maxY : o.b.maxX;
          const overlap = Math.min(hi, ohi) - Math.max(lo, olo);
          if (overlap < 0.25) continue;
          const near = alongX ? (sign > 0 ? o.b.minX : o.b.maxX) : sign > 0 ? o.b.minY : o.b.maxY;
          const g = (near - from) * sign;
          if (g >= -0.01 && g < best.gap) best = { gap: Math.max(0, g), label: o.f.label.toLowerCase(), at: (Math.max(lo, olo) + Math.min(hi, ohi)) / 2 };
        }
        if (best.gap < MIN || best.gap > MAX) continue;
        const a: Vec2 = alongX ? [from, best.at] : [best.at, from];
        const e: Vec2 = alongX ? [from + sign * best.gap, best.at] : [best.at, from + sign * best.gap];
        // sin duplicados (el mismo hueco medido desde los dos muebles)
        if (out.some((p) => Math.abs(p.width - best.gap) < 0.02 && Math.hypot((p.a[0] + p.b[0]) / 2 - (a[0] + e[0]) / 2, (p.a[1] + p.b[1]) / 2 - (a[1] + e[1]) / 2) < 0.3)) continue;
        out.push({ a, b: e, width: best.gap, level: best.gap >= 0.9 ? 'ok' : best.gap >= 0.7 ? 'justo' : 'estrecho', between: `${f.label.toLowerCase()} · ${best.label}`, levelId: room.levelId });
      }
    }
  }
  return out;
}

export const passageOf = (layout: Layout, f: Furniture) => passages(layout).filter((p) => p.between.startsWith(f.label.toLowerCase()));
