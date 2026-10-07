import type { Layout } from '../data/types';

/**
 * Cubierta a un agua con aleros a distinta altura (opción `eaves`): cota de la cara superior del
 * faldón en el borde exterior de y0 (frontal A) y de y1 (frontal B). Fuera de esa opción, plana.
 */
export function roofTopAt(layout: Layout, y: number): number {
  const e = layout.roof?.eaves;
  if (!e) return layout.topHeight;
  const { minY, maxY } = layout.bounds;
  const t = Math.min(1, Math.max(0, (y - minY) / (maxY - minY)));
  return e.y0 + (e.y1 - e.y0) * t;
}

/** cota del intradós de la cubierta (clave de la volta, si la hay) sobre la coordenada y de planta */
export function roofUndersideAt(layout: Layout, y: number): number {
  const t = layout.roof?.thickness ?? 0.25;
  return roofTopAt(layout, y) - t - (layout.roof?.ceiling?.rise ?? 0);
}
