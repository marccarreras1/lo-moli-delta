/**
 * Planta acotada del baño: recorte de la planta general con las cotas de la zona húmeda (dos duchas
 * enfrentadas), el acceso por la celosía, el lavabo, el inodoro, los pasos libres y las puertas.
 * Todo se mide sobre el mismo modelo que el 3D: cambiar un mueble cambia las cotas.
 */
import type { DataStatus, Layout, Vec2 } from '../data/types';
import { bbox, fmtM, furnitureFootprint } from '../model/geometry';
import { planSvg, type PlanOptions } from './planSvg';

type Dim = NonNullable<PlanOptions['extraDims']>[number];

export interface BathPlanData {
  room: { x0: number; y0: number; x1: number; y1: number };
  dims: Dim[];
  notes: string[];
}

export function bathPlanData(layout: Layout): BathPlanData | null {
  const room = layout.rooms.find((r) => r.id === 'bano');
  if (!room) return null;
  const b = bbox(room.polygon);
  const R = { x0: b.minX, y0: b.minY, x1: b.maxX, y1: b.maxY };
  const fur = (id: string) => layout.furniture.find((f) => f.id === id && f.roomId === 'bano');
  const box = (id: string) => {
    const f = fur(id);
    return f ? { f, st: (f.status ?? 'propuesto') as DataStatus, ...bbox(furnitureFootprint(f)) } : null;
  };
  const dims: Dim[] = [];
  const d = (a: Vec2, bb: Vec2, off: number, status: DataStatus, label?: string) => dims.push({ a, b: bb, off, status, label: label ?? fmtM(Math.hypot(bb[0] - a[0], bb[1] - a[1])) });
  // ancho interior (bajo el muro del frontal B) y fondo interior (lado del dormitorio)
  d([R.x0, R.y1], [R.x1, R.y1], 0.85, 'interpretado');
  d([R.x0, R.y0], [R.x0, R.y1], 0.55, 'interpretado');
  const sh = box('ducha');
  const notes: string[] = [];
  if (sh) {
    const cy = (sh.minY + sh.maxY) / 2;
    d([sh.minX, cy - 0.12], [sh.maxX, cy - 0.12], 0, sh.st, `rociadores enfrentados · ${fmtM(sh.maxX - sh.minX)}`);
    d([sh.minX, sh.minY], [sh.minX, sh.maxY], 0.22, sh.st);
    const cx = (sh.minX + sh.maxX) / 2;
    d([cx - 0.45, sh.minY - 0.1], [cx + 0.45, sh.minY - 0.1], 0.3, 'propuesto', 'acceso 0,90');
    notes.push(`Zona húmeda común de ${fmtM(sh.maxX - sh.minX)} × ${fmtM(sh.maxY - sh.minY)} m con dos rociadores en paredes opuestas y mandos independientes (confirmado).`);
  }
  const lav = box('lavabo');
  const wc = box('inodoro');
  if (lav) {
    d([lav.minX, lav.minY], [lav.minX, lav.maxY], 0.14, lav.st);
    d([lav.minX, lav.minY], [lav.maxX, lav.minY], -0.16, lav.st);
  }
  if (wc) {
    d([wc.maxX, wc.minY], [wc.maxX, wc.maxY], -0.14, wc.st);
    d([wc.minX, wc.minY], [wc.maxX, wc.minY], -0.16, wc.st);
  }
  if (lav && wc) {
    const y = (Math.max(lav.minY, wc.minY) + Math.min(lav.maxY, wc.maxY)) / 2 - 0.1;
    const free = lav.minX - wc.maxX;
    d([wc.maxX, y], [lav.minX, y], 0, free >= 0.8 ? 'interpretado' : 'pendiente', `paso ${fmtM(free)}`);
    notes.push(`Paso libre entre inodoro y lavabo: ${fmtM(free)} m${free < 0.7 ? ' (estrecho)' : ''}.`);
    if (sh) notes.push(`Distancia del lavabo y del inodoro a la celosía: ${fmtM(sh.minY - 0.1 - lav.maxY)} y ${fmtM(sh.minY - 0.1 - wc.maxY)} m.`);
  }
  notes.push('Celosía A o B, vidrio fijo por la cara húmeda y cortina en carril independiente: propuesta.');
  notes.push('La puerta de 70 cm del frontal B cae en la zona húmeda: pendiente de decidir.');
  return { room: R, dims, notes };
}

/** SVG de la planta acotada del baño (pantalla o exportación). */
export function bathPlanSvg(layout: Layout, opts: { forExport?: boolean; showLabels?: boolean } = {}): string | null {
  const data = bathPlanData(layout);
  if (!data) return null;
  const m = 1.2;
  const crop = { x0: data.room.x0 - m, y0: data.room.y0 - m - 0.9, x1: data.room.x1 + m, y1: data.room.y1 + m + 0.4 };
  // el rectángulo sin interpretar del boceto se omite en esta lámina (sigue en la planta general)
  let svg = planSvg({ ...layout, traces: layout.traces?.filter((t) => t.id !== 'rect-bano') }, {
    selection: null, showDims: false, showAreas: false, showFurniture: true, showLabels: opts.showLabels ?? true, issues: [], openFractions: {},
    levelId: 'pb', showPassages: false, crop, extraDims: data.dims,
  });
  const title = `<g fill="#252923"><rect x="${crop.x0}" y="${crop.y0}" width="${crop.x1 - crop.x0}" height="0.75" fill="#fefdfb"/><text x="${crop.x0 + 0.15}" y="${crop.y0 + 0.32}" font-size="0.2" font-weight="650">${layout.name} · baño acotado</text><text x="${crop.x0 + 0.15}" y="${crop.y0 + 0.58}" font-size="0.13" fill="#687066">Cotas en metros sobre el modelo · planta cortada a 1,00 m · no es proyecto técnico</text></g>`;
  svg = svg.replace(/<\/svg>$/, `${title}</svg>`);
  if (opts.forExport) {
    const w = (crop.x1 - crop.x0) * 50;
    const h = (crop.y1 - crop.y0) * 50;
    svg = svg.replace('width="100%" height="100%"', `width="${Math.round(w)}mm" height="${Math.round(h)}mm"`);
  }
  return svg;
}
