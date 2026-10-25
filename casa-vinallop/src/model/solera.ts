/**
 * Cantidades de la solera exterior en L (frontal A de punta a punta + lateral del algarrobo).
 * La superficie es la unión geométrica de los tramos: la esquina se cuenta una sola vez y solo se
 * descuentan las zonas que no se pavimentan (alcorque alrededor del tronco).
 */
import { pitsOf } from './pits';
import type { Layout, OutdoorPavement } from '../data/types';

export interface SoleraQuantities {
  /** superficie pavimentada (m²), unión de tramos menos zonas sin pavimentar */
  area: number;
  /** suma bruta de tramos (m²), solo informativa: cuenta la esquina dos veces */
  grossSum: number;
  /** superficie de la esquina común (m²) */
  overlap: number;
  /** superficie descontada por zonas permeables (m²) */
  excluded: number;
  /** longitud de borde exterior aproximada (m), para rigolas o bordillos */
  perimeter: number;
  tramos: { id: string; label: string; width: number; depth: number; area: number }[];
  status: 'interpretado';
  note: string;
}

const inRect = (x: number, y: number, r: [number, number, number, number]) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

/** Tramos de solera del proyecto (pavimentos cuyo id empieza por «solera-l»). */
export const soleraTramos = (layout: Pick<Layout, 'outdoor'>): OutdoorPavement[] => (layout.outdoor?.pavements ?? []).filter((p) => p.id.startsWith('solera-l'));

export function soleraQuantities(layout: Pick<Layout, 'outdoor'>, step = 0.05): SoleraQuantities | null {
  const tramos = soleraTramos(layout);
  if (!tramos.length) return null;
  const minX = Math.min(...tramos.map((t) => t.rect[0]));
  const minY = Math.min(...tramos.map((t) => t.rect[1]));
  const maxX = Math.max(...tramos.map((t) => t.rect[2]));
  const maxY = Math.max(...tramos.map((t) => t.rect[3]));
  const holes = tramos.flatMap((t) => pitsOf(t));
  let union = 0;
  let overlapCells = 0;
  let excludedCells = 0;
  const cell = step * step;
  for (let x = minX + step / 2; x < maxX; x += step)
    for (let y = minY + step / 2; y < maxY; y += step) {
      const n = tramos.filter((t) => inRect(x, y, t.rect)).length;
      if (!n) continue;
      if (n > 1) overlapCells++;
      if (holes.some((h) => Math.hypot(x - h.c[0], y - h.c[1]) < h.r)) { excludedCells++; continue; }
      union++;
    }
  const tr = tramos.map((t) => ({ id: t.id, label: t.label, width: t.rect[2] - t.rect[0], depth: t.rect[3] - t.rect[1], area: (t.rect[2] - t.rect[0]) * (t.rect[3] - t.rect[1]) }));
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    area: r2(union * cell),
    grossSum: r2(tr.reduce((a, t) => a + t.area, 0)),
    overlap: r2(overlapCells * cell),
    excluded: r2(excludedCells * cell),
    perimeter: r2(2 * (maxX - minX) + 2 * (maxY - minY)),
    tramos: tr.map((t) => ({ ...t, width: r2(t.width), depth: r2(t.depth), area: r2(t.area) })),
    status: 'interpretado',
    note: 'Calculada sobre el modelo (unión de tramos, esquina contada una vez, alcorque descontado). Medidas propuestas, no tomadas en obra.',
  };
}
