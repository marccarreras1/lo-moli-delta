/**
 * Alzados de las cuatro fachadas, vistos desde fuera (proyección ortogonal sobre el plano de la
 * fachada). Unidades en metros: x a lo largo de la fachada (de izquierda a derecha según se mira),
 * y = −altura. Dibuja el contorno de los muros con la cubierta elegida, los huecos (puertas,
 * ventanas y cristaleras), el cuarto técnico adosado con su terraza, la cota del altell y las cotas.
 */
import type { Layout, Opening, Vec2, Wall } from '../data/types';
import { fmtM, pointOnWall } from '../model/geometry';
import { roofTopAt } from '../model/roof';
import { STATUS_STYLE } from '../ui/status';
import { dim } from './planSvg';

export type FacadeId = 'A' | 'B' | 'izquierdo' | 'derecho';

export const FACADES: { id: FacadeId; label: string; short: string }[] = [
  { id: 'B', label: 'Frontal B · puertas', short: 'B' },
  { id: 'A', label: 'Frontal A · ventanal', short: 'A' },
  { id: 'izquierdo', label: 'Lateral izquierdo · cuarto técnico', short: 'Izq.' },
  { id: 'derecho', label: 'Lateral derecho · algarrobo', short: 'Der.' },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n4 = (x: number) => Math.round(x * 1e4) / 1e4;
const pts = (p: Vec2[]) => p.map(([x, y]) => `${n4(x)},${n4(-y)}`).join(' ');

/** coordenada horizontal del alzado para un punto de planta (mirando la fachada desde fuera) */
function along(layout: Layout, f: FacadeId) {
  const { minX, minY, maxX, maxY } = layout.bounds;
  switch (f) {
    case 'A': return (p: Vec2) => maxX - p[0]; // se mira hacia +y: la derecha es −x
    case 'B': return (p: Vec2) => p[0] - minX;
    case 'izquierdo': return (p: Vec2) => p[1] - minY;
    case 'derecho': return (p: Vec2) => maxY - p[1];
  }
}

/** cara superior de la cubierta (o del peto) sobre la coordenada y de planta */
function roofProfile(layout: Layout, y: number): number {
  const r = layout.roof;
  const H = layout.topHeight;
  if (!r) return H;
  if (r.eaves) return roofTopAt(layout, y);
  if (r.type === 'plana') return H;
  if (r.type === 'plana-peto') return H + (r.parapet ?? 0);
  const { minY, maxY } = layout.bounds;
  const W = maxY - minY;
  const p = (r.pitchDeg * Math.PI) / 180;
  if (r.type === 'un-agua') return H + r.thickness + Math.tan(p) * (y - minY);
  return H + r.thickness + Math.tan(p) * (W / 2 - Math.abs(y - (minY + W / 2)));
}

function openingFill(o: Opening) {
  if (o.kind === 'puerta' && !o.glazed) return { fill: '#c9a27c', stroke: '#6b4e33' };
  if (o.glazed === 'mate') return { fill: '#e3e8e6', stroke: '#5b6b66' };
  return { fill: '#cfe0e6', stroke: '#4f6a7a' };
}

export function elevationSvg(layout: Layout, f: FacadeId, o: { showDims?: boolean; showLabels?: boolean; forExport?: boolean } = {}): string {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const u = along(layout, f);
  const front = f === 'A' || f === 'B';
  const len = front ? maxX - minX : maxY - minY;
  const H = layout.topHeight;
  const r = layout.roof;
  const t = r?.thickness ?? 0.25;
  const ov = r && r.type !== 'plana' && r.type !== 'plana-peto' ? r.overhang : 0;
  const yEdge = f === 'A' ? minY : f === 'B' ? maxY : null;
  // silueta de la cubierta: en los frentes, lo más alto que asoma; en los laterales, el perfil
  const N = 48;
  const profile: Vec2[] = front
    ? [[-ov, Math.max(...Array.from({ length: N + 1 }, (_, i) => roofProfile(layout, minY + ((maxY - minY) * i) / N)))], [len + ov, 0]]
    : Array.from({ length: N + 1 }, (_, i) => {
        const y = minY + ((maxY - minY) * i) / N;
        return [u([0, y]), roofProfile(layout, y)] as Vec2;
      }).sort((a, b) => a[0] - b[0]);
  const top = front ? profile[0][1] : Math.max(...profile.map((p) => p[1]));
  const annex = layout.outdoor?.annexes ?? [];
  // extensión horizontal: la casa y el cuarto técnico, con el vuelo
  const annexU = annex.flatMap((a) => (front ? [u([a.rect[0], 0]), u([a.rect[2], 0])] : []));
  const u0 = Math.min(-ov, ...annexU);
  const u1 = Math.max(len + ov, ...annexU);
  const m = 1.6;
  // a la derecha, sitio para las cotas de altura (y para la barra de herramientas del plano)
  const vb = { x: u0 - m, y: -(top + 1.3), w: u1 - u0 + m + 3.4, h: top + 1.3 + 2.4 };
  const out: string[] = [];
  const size = o.forExport ? `width="${n4(vb.w * 20)}mm" height="${n4(vb.h * 20)}mm"` : 'width="100%" height="100%"';
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n4(vb.x)} ${n4(vb.y)} ${n4(vb.w)} ${n4(vb.h)}" ${size} font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" preserveAspectRatio="xMidYMid meet" data-units="m" data-facade="${f}">`);
  const label = FACADES.find((x) => x.id === f)!.label;
  out.push(`<title>${esc(`${layout.name} · alzado ${label}`)}</title>`);
  out.push(`<defs><pattern id="tile-${f}" patternUnits="userSpaceOnUse" width="0.2" height="0.36"><rect width="0.2" height="0.36" fill="#d8a888"/><path d="M0 0.36 Q0.1 0.28 0.2 0.36" fill="none" stroke="#9c6446" stroke-width="0.012"/><line x1="0" y1="0" x2="0" y2="0.36" stroke="#b07a5a" stroke-width="0.008"/></pattern></defs>`);
  out.push(`<rect x="${n4(vb.x)}" y="${n4(vb.y)}" width="${n4(vb.w)}" height="${n4(vb.h)}" fill="#fefdfb"/>`);

  // terreno
  out.push(`<rect x="${n4(vb.x)}" y="0" width="${n4(vb.w)}" height="0.35" fill="#ece3d3"/><line x1="${n4(vb.x)}" y1="0" x2="${n4(vb.x + vb.w)}" y2="0" stroke="#2f3430" stroke-width="0.03"/>`);

  // muro de fachada (hasta la cara inferior de la cubierta o el alero)
  const wallTop = (uu: number): number => {
    if (front) {
      if (r?.eaves && yEdge !== null) return Math.max(H, roofTopAt(layout, yEdge) - t);
      if (r?.type === 'plana-peto') return H + (r.parapet ?? 0);
      return H;
    }
    // laterales: bajo el perfil de cubierta (hastial) o hasta el forjado/peto
    const p = profile.reduce((best, q) => (Math.abs(q[0] - uu) < Math.abs(best[0] - uu) ? q : best), profile[0]);
    if (r?.type === 'plana' || !r) return H;
    if (r.type === 'plana-peto') return H + (r.parapet ?? 0);
    return Math.max(H, p[1] - t);
  };
  const wallPoly: Vec2[] = [[0, 0], [len, 0]];
  const steps = front ? [len, 0] : Array.from({ length: N + 1 }, (_, i) => len - (len * i) / N);
  for (const uu of steps) wallPoly.push([uu, wallTop(uu)]);
  out.push(`<polygon points="${pts(wallPoly)}" fill="#f6f3ec" stroke="#2f3430" stroke-width="0.035"/>`);

  // cubierta
  if (r?.type === 'plana' || !r) {
    out.push(`<line x1="0" y1="${n4(-(H - t))}" x2="${n4(len)}" y2="${n4(-(H - t))}" stroke="#9fa39a" stroke-width="0.012" stroke-dasharray="0.12 0.08"/>`);
  } else if (r.type === 'plana-peto') {
    out.push(`<line x1="0" y1="${n4(-H)}" x2="${n4(len)}" y2="${n4(-H)}" stroke="#9fa39a" stroke-width="0.012" stroke-dasharray="0.12 0.08"/>`);
  } else if (front) {
    const wt = wallTop(0);
    const rt = profile[0][1];
    if (rt - wt > t + 0.02) {
      // se ve el faldón por encima del alero
      out.push(`<polygon points="${pts([[-ov, wt], [len + ov, wt], [len + ov, rt], [-ov, rt]])}" fill="${r.tiles ? `url(#tile-${f})` : '#d9d6ce'}" stroke="#2f3430" stroke-width="0.03"/>`);
    } else {
      out.push(`<rect x="${n4(-ov)}" y="${n4(-rt)}" width="${n4(len + 2 * ov)}" height="${n4(rt - wt)}" fill="${r.tiles ? '#b07a5a' : '#d9d6ce'}" stroke="#2f3430" stroke-width="0.03"/>`);
    }
    if (r.eaves && yEdge !== null && roofTopAt(layout, yEdge) < top - 0.01) {
      // canalón en el alero bajo
      out.push(`<rect x="${n4(-ov)}" y="${n4(-(wt + 0.02))}" width="${n4(len + 2 * ov)}" height="0.12" fill="#9aa09c" stroke="#5b625e" stroke-width="0.01"/>`);
    }
  } else {
    // canto inclinado del faldón en el lateral, con su vuelo
    const a = profile[0];
    const b = profile[profile.length - 1];
    const sl = (b[1] - a[1]) / (b[0] - a[0]);
    const A: Vec2 = [a[0] - ov, a[1] - sl * ov];
    const B: Vec2 = [b[0] + ov, b[1] + sl * ov];
    out.push(`<polygon points="${pts([A, B, [B[0], B[1] - t], [A[0], A[1] - t]])}" fill="${r.tiles ? '#b07a5a' : '#d9d6ce'}" stroke="#2f3430" stroke-width="0.03"/>`);
  }

  // forjado del altell (línea oculta) y cota
  const altell = layout.levels.find((l) => l.elevation > 0);
  if (altell) {
    out.push(`<line x1="0.3" y1="${n4(-altell.elevation)}" x2="${n4(len - 0.3)}" y2="${n4(-altell.elevation)}" stroke="#9fa39a" stroke-width="0.012" stroke-dasharray="0.1 0.08"/>`);
    if (o.showLabels !== false) out.push(`<text x="${n4(len - 0.4)}" y="${n4(-altell.elevation - 0.08)}" font-size="0.13" text-anchor="end" fill="#9fa39a">suelo del ${esc(altell.name.toLowerCase())} +${fmtM(altell.elevation)} (oculto)</text>`);
  }

  // huecos de la fachada
  const walls = layout.walls.filter((w) => w.facade === f);
  const ops: { o: Opening; w: Wall; a: number; b: number }[] = [];
  for (const w of walls) {
    for (const op of layout.openings.filter((x) => x.wallId === w.id && x.kind !== 'paso')) {
      const ua = u(pointOnWall(w, op.offset));
      const ub = u(pointOnWall(w, op.offset + op.width));
      ops.push({ o: op, w, a: Math.min(ua, ub), b: Math.max(ua, ub) });
    }
  }
  ops.sort((p, q) => p.a - q.a);
  for (const { o: op, a, b } of ops) {
    const st = STATUS_STYLE[op.status];
    const c = openingFill(op);
    const y0 = op.sill;
    const y1 = op.sill + op.height;
    out.push(`<g data-opening="${esc(op.id)}">`);
    out.push(`<rect x="${n4(a)}" y="${n4(-y1)}" width="${n4(b - a)}" height="${n4(y1 - y0)}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="0.03"/>`);
    // particiones de la carpintería
    const leaves = op.system?.leaves ?? (op.kind === 'cristalera' ? Math.max(2, Math.round((b - a) / 1.2)) : 1);
    for (let k = 1; k < leaves; k++) {
      const x = a + ((b - a) * k) / leaves;
      out.push(`<line x1="${n4(x)}" y1="${n4(-y1)}" x2="${n4(x)}" y2="${n4(-y0)}" stroke="${c.stroke}" stroke-width="0.02"/>`);
    }
    if (op.kind === 'puerta' && !op.glazed) {
      // tablas verticales y tirador
      for (let x = a + 0.15; x < b - 0.05; x += 0.15) out.push(`<line x1="${n4(x)}" y1="${n4(-y1 + 0.03)}" x2="${n4(x)}" y2="${n4(-y0 - 0.03)}" stroke="#a9835f" stroke-width="0.008"/>`);
      out.push(`<rect x="${n4(b - 0.14)}" y="${n4(-(y0 + 1.05))}" width="0.025" height="0.2" fill="#2f3430"/>`);
    }
    if (op.shutters) {
      // contraventanas abiertas contra la fachada
      const sw = (b - a) / 2;
      out.push(`<rect x="${n4(a - sw)}" y="${n4(-y1)}" width="${n4(sw)}" height="${n4(y1 - y0)}" fill="#c9d3cc" stroke="#5b6b66" stroke-width="0.015"/><rect x="${n4(b)}" y="${n4(-y1)}" width="${n4(sw)}" height="${n4(y1 - y0)}" fill="#c9d3cc" stroke="#5b6b66" stroke-width="0.015"/>`);
    }
    if (st.dash) out.push(`<rect x="${n4(a - 0.04)}" y="${n4(-y1 - 0.04)}" width="${n4(b - a + 0.08)}" height="${n4(y1 - y0 + 0.08)}" fill="none" stroke="${st.color}" stroke-width="0.012" stroke-dasharray="${st.dash}"/>`);
    if (o.showLabels !== false) out.push(`<text x="${n4((a + b) / 2)}" y="${n4(-y1 - 0.1)}" font-size="0.12" text-anchor="middle" fill="#3d433b">${esc(op.label.replace(/\s*\(.*\)$/, ''))}</text>`);
    out.push('</g>');
  }

  // cuarto técnico adosado (lateral izquierdo) con la terraza del altell encima
  for (const an of annex) {
    const [ax0, ay0, ax1, ay1] = an.rect;
    const pe = an.terrace?.parapet ?? 0;
    const hTop = an.height + pe;
    let a: number;
    let b: number;
    if (front) {
      a = Math.min(u([ax0, 0]), u([ax1, 0]));
      b = Math.max(u([ax0, 0]), u([ax1, 0]));
    } else if (f === 'izquierdo') {
      a = u([0, ay0]);
      b = u([0, ay1]);
    } else continue; // desde el lateral derecho queda oculto detrás de la casa
    out.push(`<g data-annex="${esc(an.id)}">`);
    out.push(`<rect x="${n4(a)}" y="${n4(-an.height)}" width="${n4(b - a)}" height="${n4(an.height)}" fill="#efebe2" stroke="#2f3430" stroke-width="0.03"/>`);
    if (pe > 0) {
      out.push(`<rect x="${n4(a - (front ? 0 : 0.08))}" y="${n4(-hTop)}" width="${n4(b - a + (front ? 0 : 0.16))}" height="${n4(pe)}" fill="#f6f3ec" stroke="#2f3430" stroke-width="0.025"/>`);
      out.push(`<line x1="${n4(a)}" y1="${n4(-an.height)}" x2="${n4(b)}" y2="${n4(-an.height)}" stroke="#7d8277" stroke-width="0.01" stroke-dasharray="0.08 0.05"/>`);
    }
    const d = an.door;
    const doorFacade = d.side === 'y1' ? 'B' : d.side === 'y0' ? 'A' : d.side === 'x0' ? 'izquierdo' : 'derecho';
    if (doorFacade === f) {
      const dc = front ? u([d.at, 0]) : u([0, d.at]);
      out.push(`<rect x="${n4(dc - d.width / 2)}" y="${n4(-d.height)}" width="${n4(d.width)}" height="${n4(d.height)}" fill="#9aa09c" stroke="#4d534f" stroke-width="0.02"/><rect x="${n4(dc - d.width * 0.3)}" y="${n4(-0.4)}" width="${n4(d.width * 0.6)}" height="0.22" fill="#4d534f"/>`);
    }
    if (o.showLabels !== false) out.push(`<text x="${n4((a + b) / 2)}" y="${n4(-an.height / 2)}" font-size="0.14" text-anchor="middle" fill="#3d433b">${esc(an.label)}</text>${pe > 0 ? `<text x="${n4((a + b) / 2)}" y="${n4(-hTop - 0.12)}" font-size="0.12" text-anchor="middle" fill="#b5654a">${esc(an.terrace!.label)} · peto ${fmtM(pe)}</text>` : ''}`);
    out.push('</g>');
  }

  // cotas
  if (o.showDims !== false) {
    const dl: string[] = [];
    // largo total y cadena de huecos (abajo)
    dl.push(dim([0, 0], [len, 0], 1.25, `${fmtM(len)} m`, 'documentado'));
    const chain = [0, ...ops.flatMap((p) => [p.a, p.b]), len].filter((x, i, arr) => x >= -1e-6 && x <= len + 1e-6 && (i === 0 || Math.abs(x - arr[i - 1]) > 0.02)).sort((p, q) => p - q);
    for (let i = 0; i < chain.length - 1; i++) if (chain[i + 1] - chain[i] > 0.05) dl.push(dim([chain[i], 0], [chain[i + 1], 0], 0.7, fmtM(chain[i + 1] - chain[i]), 'documentado'));
    // alturas a la derecha: muro, cubierta y huecos
    const xr = Math.max(len + ov, u1) + 0.5;
    const levels = [...new Set([0, ...ops.flatMap((p) => [p.o.sill, p.o.sill + p.o.height]), front ? wallTop(0) : Math.max(...wallPoly.map((p) => p[1])), top].map((v) => Math.round(v * 100) / 100))].sort((p, q) => p - q);
    for (let i = 0; i < levels.length - 1; i++) if (levels[i + 1] - levels[i] > 0.05) dl.push(dim([xr, -levels[i]], [xr, -levels[i + 1]], 0, fmtM(levels[i + 1] - levels[i]), 'documentado'));
    dl.push(dim([xr + 0.7, 0], [xr + 0.7, -top], 0, `${fmtM(top)} m`, r?.status ?? 'documentado'));
    // dim() trabaja en coordenadas SVG: las alturas van con signo negativo
    out.push(...dl);
  }

  // rótulo
  if (o.showLabels !== false) {
    out.push(`<text x="${n4(u0)}" y="${n4(-(top + 0.75))}" font-size="0.3" font-weight="650" fill="#252923">Alzado · ${esc(label)}</text>`);
    out.push(`<text x="${n4(u0)}" y="${n4(-(top + 0.4))}" font-size="0.15" fill="#687066">Visto desde fuera · cubierta: ${esc(r?.label ?? 'sin definir')} · cotas en metros sobre el modelo · no es proyecto técnico</text>`);
  }
  out.push('</svg>');
  return out.join('');
}
