/**
 * Juego de planos: láminas de planta (interior) con la misma presentación que los alzados
 * (marco, título del dibujo, cuadro de superficies y cajetín con norte, variante, escala gráfica,
 * fecha y número de plano) y exportación del juego completo (plantas + cuatro alzados).
 * El SVG exportado sale a escala 1:50 (20 mm por metro).
 */
import type { Layout } from '../data/types';
import { bbox, fmtM, polygonArea } from '../model/geometry';
import { planSvg } from './planSvg';
import { elevationSvg, FACADES, type FacadeId } from './elevationSvg';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n4 = (x: number) => Math.round(x * 1e4) / 1e4;
const INK = '#1f2320';
const GREY = '#5f655f';
const LIGHT = '#9aa09a';

export interface SheetOptions { forExport?: boolean; variantName?: string; finishes?: Partial<Record<string, string>> }

/** número de plano de cada planta: P-01, P-02… por orden de cota */
export function planSheetCode(layout: Layout, levelId: string) {
  const i = [...layout.levels].sort((a, b) => a.elevation - b.elevation).findIndex((l) => l.id === levelId);
  return `P-${String(i + 1).padStart(2, '0')}`;
}

export function planSheetSvg(layout: Layout, levelId: string, o: SheetOptions = {}): string {
  const level = layout.levels.find((l) => l.id === levelId) ?? layout.levels[0];
  const { minX, minY, maxX, maxY } = layout.bounds;
  const annexX0 = Math.min(minX, ...(layout.outdoor?.annexes ?? []).map((a) => a.rect[0]));
  // recorte del dibujo: la casa con el cuarto técnico, sus cotas y una franja del exterior
  const tankX0 = Math.min(Infinity, ...(layout.outdoor?.tanks ?? []).map((tk) => tk.c[0] - (tk.axis === 'y' ? tk.diameter : tk.length) / 2));
  const crop = { x0: Math.min(annexX0 - 2.6, tankX0 - 1.0), y0: minY - 2.2, x1: maxX + 1.4, y1: maxY + 1.9 };
  const inner = planSvg(layout, {
    selection: null, showDims: true, showAreas: false, showFurniture: true, showLabels: true, issues: [], openFractions: {},
    levelId: level.id, showPassages: false, crop,
  });
  const dw = crop.x1 - crop.x0;
  const dh = crop.y1 - crop.y0;
  const sheetW = Math.max(dw + 1.2, 20);
  const dx = (sheetW - dw) / 2;
  const dy = 0.9;
  const rooms = layout.rooms.filter((r) => r.levelId === level.id);
  const tableH = 0.45 + 0.3 * (rooms.length + 1);
  const blockH = 3.1;
  const by = dy + dh + 1.25;
  const sheetH = by + Math.max(blockH, tableH + 0.4) + 0.5;
  const code = planSheetCode(layout, level.id);
  const out: string[] = [];
  const size = o.forExport ? `width="${n4(sheetW * 20)}mm" height="${n4(sheetH * 20)}mm"` : 'width="100%" height="100%"';
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n4(sheetW)} ${n4(sheetH)}" ${size} font-family="'Helvetica Neue', Arial, system-ui, sans-serif" preserveAspectRatio="xMidYMid meet" data-units="m" data-sheet="${code}">`);
  out.push(`<title>${esc(`${layout.name} · planta ${level.name.toLowerCase()}`)}</title>`);
  out.push(`<style>.tnum{font-variant-numeric:tabular-nums}</style>`);
  out.push(`<rect width="${n4(sheetW)}" height="${n4(sheetH)}" fill="#ffffff"/>`);
  out.push(`<rect x="0.15" y="0.15" width="${n4(sheetW - 0.3)}" height="${n4(sheetH - 0.3)}" fill="none" stroke="${INK}" stroke-width="0.025"/>`);
  // dibujo de la planta (anidado con su propio sistema de coordenadas en metros)
  out.push(inner.replace(/^<svg ([^>]*?)width="100%" height="100%"/, `<svg $1x="${n4(dx)}" y="${n4(dy)}" width="${n4(dw)}" height="${n4(dh)}"`));

  // título del dibujo
  const tx = dx;
  const ty = dy + dh + 0.55;
  const name = (/^planta\b/i.test(level.name) ? level.name : `Planta ${level.name}`).toUpperCase();
  out.push(`<g class="drawing-title"><circle cx="${n4(tx + 0.25)}" cy="${n4(ty - 0.1)}" r="0.25" fill="none" stroke="${INK}" stroke-width="0.02"/><text x="${n4(tx + 0.25)}" y="${n4(ty - 0.04)}" font-size="0.15" font-weight="700" text-anchor="middle" fill="${INK}">${code.slice(2)}</text><text x="${n4(tx + 0.65)}" y="${n4(ty - 0.03)}" font-size="0.3" font-weight="700" fill="${INK}">${esc(name)}</text><line x1="${n4(tx + 0.65)}" y1="${n4(ty + 0.07)}" x2="${n4(tx + 0.65 + 0.21 * name.length)}" y2="${n4(ty + 0.07)}" stroke="${INK}" stroke-width="0.02"/><text x="${n4(tx + 0.65)}" y="${n4(ty + 0.27)}" font-size="0.13" fill="${GREY}">Suelo a ${level.elevation >= 0 ? '+' : '−'}${fmtM(Math.abs(level.elevation))} sobre el terreno · planta cortada a 1,00 m · ${o.forExport ? 'escala 1:50' : 'escala gráfica en el cajetín'}</text></g>`);

  // cuadro de superficies
  const tX = 0.35;
  const tw = Math.min(8.4, sheetW - 7.4 - 0.9);
  const cols = [0, 3.6, 6.0].map((c) => (c * tw) / 8.4);
  const t: string[] = [`<g class="areas"><text x="${n4(tX)}" y="${n4(by + 0.02)}" font-size="0.15" font-weight="700" fill="${INK}">CUADRO DE SUPERFICIES ÚTILES</text>`];
  const rowY = (i: number) => by + 0.12 + 0.3 * i;
  t.push(`<rect x="${n4(tX)}" y="${n4(rowY(0))}" width="${n4(tw)}" height="0.3" fill="#f0f0ec"/>`);
  ['Estancia', 'Dimensiones', 'Superficie'].forEach((h, i) => t.push(`<text x="${n4(tX + cols[i] + 0.06)}" y="${n4(rowY(0) + 0.2)}" font-size="0.12" font-weight="600" fill="${INK}">${h}</text>`));
  let total = 0;
  rooms.forEach((r, i) => {
    const b = bbox(r.polygon);
    const a = polygonArea(r.polygon);
    total += a;
    const y = rowY(i + 1);
    t.push(`<line x1="${n4(tX)}" y1="${n4(y)}" x2="${n4(tX + tw)}" y2="${n4(y)}" stroke="${LIGHT}" stroke-width="0.007"/>`);
    t.push(`<text x="${n4(tX + cols[0] + 0.06)}" y="${n4(y + 0.2)}" font-size="0.12" fill="${INK}">${esc(r.name)}</text><text x="${n4(tX + cols[1] + 0.06)}" y="${n4(y + 0.2)}" font-size="0.12" class="tnum" fill="${INK}">${fmtM(b.maxX - b.minX)} × ${fmtM(b.maxY - b.minY)} m</text><text x="${n4(tX + tw - 0.08)}" y="${n4(y + 0.2)}" font-size="0.12" class="tnum" text-anchor="end" fill="${INK}">${fmtM(a)} m²</text>`);
  });
  const yt = rowY(rooms.length + 1);
  t.push(`<line x1="${n4(tX)}" y1="${n4(yt)}" x2="${n4(tX + tw)}" y2="${n4(yt)}" stroke="${INK}" stroke-width="0.012"/><text x="${n4(tX + 0.06)}" y="${n4(yt + 0.2)}" font-size="0.12" font-weight="700" fill="${INK}">Total útil de la planta</text><text x="${n4(tX + tw - 0.08)}" y="${n4(yt + 0.2)}" font-size="0.12" font-weight="700" class="tnum" text-anchor="end" fill="${INK}">${fmtM(total)} m²</text>`);
  t.push(`<rect x="${n4(tX)}" y="${n4(rowY(0))}" width="${n4(tw)}" height="${n4(yt + 0.3 - rowY(0))}" fill="none" stroke="${INK}" stroke-width="0.015"/>`);
  t.push(`<text x="${n4(tX)}" y="${n4(yt + 0.52)}" font-size="0.1" fill="${GREY}">Superficies calculadas sobre el modelo por la cara interior de los muros; no son una medición.</text></g>`);
  out.push(t.join(''));

  out.push(titleBlock({ x1: sheetW - 0.35, y: by, h: blockH, layout, plano: /^planta\b/i.test(level.name) ? level.name : `Planta ${level.name.toLowerCase()}`, sheet: code, o }));
  out.push('</svg>');
  return out.join('');
}

/** Cajetín común: norte del proyecto, datos del plano, escala gráfica, fecha y número. */
function titleBlock(a: { x1: number; y: number; h: number; layout: Layout; plano: string; sheet: string; o: SheetOptions }) {
  const cw = 6.6;
  const x0 = a.x1 - cw;
  const { y, h, layout } = a;
  const r = layout.roof;
  const g: string[] = [`<g class="title-block"><rect x="${n4(x0)}" y="${n4(y)}" width="${n4(cw)}" height="${n4(h)}" fill="#ffffff" stroke="${INK}" stroke-width="0.025"/>`];
  // norte
  const nx = x0 + 1.05;
  const ny = y + 1.25;
  const ang = ((layout.northDeg ?? 0) * Math.PI) / 180;
  const px = (d: number, side = 0) => [nx + Math.sin(ang) * d + Math.cos(ang) * side, ny - Math.cos(ang) * d + Math.sin(ang) * side];
  const [ax, ay] = px(0.62);
  const [bx, by] = px(-0.45, -0.28);
  const [cx, cy] = px(-0.45, 0.28);
  const [mx, my] = px(-0.2);
  g.push(`<text x="${n4(x0 + 0.2)}" y="${n4(y + 0.22)}" font-size="0.1" fill="${GREY}">NORTE DEL PROYECTO</text>`);
  g.push(`<circle cx="${n4(nx)}" cy="${n4(ny)}" r="0.62" fill="none" stroke="${LIGHT}" stroke-width="0.01"/><path d="M ${n4(ax)} ${n4(ay)} L ${n4(bx)} ${n4(by)} L ${n4(mx)} ${n4(my)} Z" fill="${INK}"/><path d="M ${n4(ax)} ${n4(ay)} L ${n4(cx)} ${n4(cy)} L ${n4(mx)} ${n4(my)} Z" fill="#ffffff" stroke="${INK}" stroke-width="0.012"/>`);
  const [tx, ty] = px(0.82);
  g.push(`<text x="${n4(tx)}" y="${n4(ty + 0.06)}" font-size="0.18" font-weight="700" text-anchor="middle" fill="${INK}">N</text>`);
  if (layout.northDeg != null) g.push(`<text x="${n4(nx)}" y="${n4(y + h - 0.85)}" font-size="0.09" text-anchor="middle" fill="${GREY}">${Math.round(layout.northDeg)}° respecto al frontal A</text>`);
  const dx0 = x0 + 2.25;
  g.push(`<line x1="${n4(dx0 - 0.08)}" y1="${n4(y)}" x2="${n4(dx0 - 0.08)}" y2="${n4(y + h)}" stroke="${INK}" stroke-width="0.012"/>`);
  const rows: [string, string, number, boolean?][] = [
    ['PROYECTO', layout.name, 0.2, true],
    ['PLANO', a.plano, 0.15],
    ['VARIANTE', a.o.variantName ?? 'Base', 0.13],
    ['CUBIERTA', (r?.label ?? 'sin definir').replace(/\s*\(.*\)$/, ''), 0.12],
  ];
  let yy = y + 0.26;
  for (const [k, v, fs, bold] of rows) {
    g.push(`<text x="${n4(dx0)}" y="${n4(yy)}" font-size="0.085" fill="${GREY}" letter-spacing="0.02">${k}</text><text x="${n4(dx0)}" y="${n4(yy + fs + 0.04)}" font-size="${fs}"${bold ? ' font-weight="700"' : ''} fill="${INK}">${esc(v.length > 46 ? `${v.slice(0, 45)}…` : v)}</text>`);
    yy += fs + 0.36;
  }
  const sy = y + h - 0.62;
  g.push(`<line x1="${n4(dx0 - 0.08)}" y1="${n4(sy - 0.12)}" x2="${n4(a.x1)}" y2="${n4(sy - 0.12)}" stroke="${INK}" stroke-width="0.012"/>`);
  for (let i = 0; i < 5; i++) g.push(`<rect x="${n4(dx0 + i * 0.42)}" y="${n4(sy + 0.05)}" width="0.42" height="0.07" fill="${i % 2 ? '#ffffff' : INK}" stroke="${INK}" stroke-width="0.008"/>`);
  for (const v of [0, 1, 5]) g.push(`<text x="${n4(dx0 + v * 0.42)}" y="${n4(sy + 0.25)}" font-size="0.085" text-anchor="middle" fill="${INK}">${v}${v === 5 ? ' m' : ''}</text>`);
  g.push(`<text x="${n4(dx0)}" y="${n4(sy - 0.01)}" font-size="0.085" fill="${GREY}">ESCALA ${a.o.forExport ? '1:50' : 'GRÁFICA'}</text>`);
  g.push(`<text x="${n4(dx0 + 2.6)}" y="${n4(sy - 0.01)}" font-size="0.085" fill="${GREY}">FECHA</text><text x="${n4(dx0 + 2.6)}" y="${n4(sy + 0.15)}" font-size="0.12" class="tnum" fill="${INK}">${new Date().toLocaleDateString('es-ES')}</text>`);
  g.push(`<text x="${n4(a.x1 - 0.15)}" y="${n4(sy - 0.01)}" font-size="0.085" fill="${GREY}" text-anchor="end">PLANO</text><text x="${n4(a.x1 - 0.15)}" y="${n4(sy + 0.24)}" font-size="0.26" font-weight="700" text-anchor="end" fill="${INK}">${a.sheet}</text>`);
  g.push(`<text x="${n4(x0 + 0.2)}" y="${n4(y + h - 0.12)}" font-size="0.085" fill="${GREY}">Estudio de visualización a partir del modelo · cotas en metros · no es proyecto técnico de ejecución</text>`);
  g.push('</g>');
  return g.join('');
}

/** Juego completo: plantas de abajo arriba y los cuatro alzados. */
export function sheetSet(layout: Layout, o: SheetOptions = {}): { id: string; name: string; svg: string }[] {
  const levels = [...layout.levels].sort((a, b) => a.elevation - b.elevation);
  return [
    ...levels.map((l) => ({ id: planSheetCode(layout, l.id), name: `planta-${l.id}`, svg: planSheetSvg(layout, l.id, o) })),
    ...FACADES.map((f) => ({ id: f.sheet, name: `alzado-${f.id === 'A' || f.id === 'B' ? `frontal-${f.id}` : `lateral-${f.id}`}`, svg: elevationSvg(layout, f.id as FacadeId, { ...o }) })),
  ];
}
