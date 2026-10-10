/**
 * Plantación del jardín seco: reparto determinista de matas por la superficie, en grupos de la misma
 * especie (como en la referencia), con las bajas delante y las altas al fondo, sin pisar los caminos.
 */
import type { Outdoor, GardenSpeciesId } from '../data/types';

export interface GardenPlant { x: number; y: number; s: GardenSpeciesId; k: number; rot: number }

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function gardenPlants(g: NonNullable<Outdoor['garden']>, avoid: { x: number; y: number; r: number }[] = []): GardenPlant[] {
  const r = rng(29);
  const [x0, y0, x1, y1] = g.rect;
  const out: GardenPlant[] = [];
  const step = 0.52;
  for (let y = y0 + 0.3; y < y1 - 0.2; y += step * 0.87) {
    const row = Math.round((y - y0) / (step * 0.87));
    for (let x = x0 + 0.25 + (row % 2) * step * 0.5; x < x1 - 0.2; x += step) {
      const px = x + (r() - 0.5) * 0.3;
      const py = y + (r() - 0.5) * 0.3;
      // fuera de los caminos (con margen) y de lo que haya que evitar (macetas, troncos)
      if (g.paths.some((p) => Math.abs(px - p.x) < p.width / 2 + 0.28 && py > p.y0 - 0.2 && py < p.y1 + 0.2)) continue;
      if (avoid.some((a) => Math.hypot(px - a.x, py - a.y) < a.r)) continue;
      if ((g.clearings ?? []).some(([cx0, cy0, cx1, cy1]) => px > cx0 - 0.25 && px < cx1 + 0.25 && py > cy0 - 0.25 && py < cy1 + 0.25)) continue;
      // claros de grava entre grupos
      const n = Math.sin(px * 1.3 + py * 0.7) + Math.sin(px * 0.47 - py * 1.9 + 1.7);
      if (n > 1.35) continue;
      // profundidad relativa (0 delante, 1 al fondo) y cercanía a un camino: las bajas bordean
      const depth = (py - y0) / (y1 - y0);
      const nearPath = g.paths.some((p) => Math.abs(px - p.x) < p.width / 2 + 0.75);
      const t = Math.min(1, Math.max(0, (nearPath ? depth * 0.5 : depth) + Math.sin(px * 0.9 + 3.1 * Math.floor(py / 1.4)) * 0.18 + (r() - 0.5) * 0.12));
      const sp = [...g.species].sort((a, b) => Math.abs(a.band - t) - Math.abs(b.band - t))[0];
      out.push({ x: Math.round(px * 1000) / 1000, y: Math.round(py * 1000) / 1000, s: sp.id, k: 0.8 + r() * 0.4, rot: r() * Math.PI * 2 });
    }
  }
  return out;
}

/** losas de un camino: centro, ancho, fondo y un ligero giro */
export function pathSlabs(p: NonNullable<Outdoor['garden']>['paths'][number]) {
  const r = rng(Math.round(p.x * 100));
  const out: { x: number; y: number; w: number; d: number; rot: number }[] = [];
  for (let y = p.y0 + p.slab / 2; y + p.slab / 2 <= p.y1 + 1e-6; y += p.slab + p.gap)
    out.push({ x: p.x + (r() - 0.5) * 0.04, y, w: p.width, d: p.slab, rot: (r() - 0.5) * 0.05 });
  return out;
}
