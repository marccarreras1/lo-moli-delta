/**
 * Alzados de las cuatro fachadas, vistos desde fuera (proyección ortogonal sobre el plano de la
 * fachada), con presentación de plano de arquitectura: jerarquía de grosores, tramas de material,
 * carpinterías con hojas y símbolo de apertura, códigos de hueco, marcas de nivel, cotas con trazo
 * oblicuo, rótulos de material con línea de referencia, cuadro de carpinterías, cajetín con plano
 * de situación de la fachada y escala gráfica.
 *
 * Unidades en metros: x a lo largo de la fachada (de izquierda a derecha según se mira) e y = −altura.
 * El SVG exportado sale a escala 1:50 (20 mm por metro).
 */
import type { Layout, Opening, Vec2, Wall } from '../data/types';
import { FINISHES } from '../data/acabados';
import { fmtM, pointOnWall } from '../model/geometry';
import { roofTopAt } from '../model/roof';
import { groundTopAt } from '../model/ground';

export type FacadeId = 'A' | 'B' | 'izquierdo' | 'derecho';

export const FACADES: { id: FacadeId; label: string; short: string; sheet: string }[] = [
  { id: 'B', label: 'Frontal B · puertas', short: 'B', sheet: 'AL-01' },
  { id: 'A', label: 'Frontal A · ventanal', short: 'A', sheet: 'AL-02' },
  { id: 'izquierdo', label: 'Lateral izquierdo · cuarto técnico', short: 'Izq.', sheet: 'AL-03' },
  { id: 'derecho', label: 'Lateral derecho · algarrobo', short: 'Der.', sheet: 'AL-04' },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n4 = (x: number) => Math.round(x * 1e4) / 1e4;
/** puntos en coordenadas de alzado (u, altura) → SVG */
const pts = (p: Vec2[]) => p.map(([x, y]) => `${n4(x)},${n4(-y)}`).join(' ');
const lvl = (h: number) => (Math.abs(h) < 0.005 ? '±0,00' : `${h > 0 ? '+' : '−'}${fmtM(Math.abs(h))}`);

// grosores (m de dibujo; a 1:50, 0,02 m ≈ 0,4 mm)
const LW = { terrain: 0.05, outline: 0.032, opening: 0.02, leaf: 0.011, fine: 0.007, hidden: 0.01 };
const INK = '#1f2320';
const GREY = '#5f655f';
const LIGHT = '#9aa09a';

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

/** `o.sill` se da sobre el terreno (antepecho + cota del nivel del muro); `rawSill`, sobre el suelo interior */
interface PlacedOpening { o: Opening; w: Wall; a: number; b: number; hingeLeft: boolean; rawSill: number; base: number }

function placedOpenings(layout: Layout, f: FacadeId): PlacedOpening[] {
  const u = along(layout, f);
  const out: PlacedOpening[] = [];
  for (const w of layout.walls.filter((x) => x.facade === f)) {
    for (const op of layout.openings.filter((x) => x.wallId === w.id && x.kind !== 'paso')) {
      const us = u(pointOnWall(w, op.offset));
      const ue = u(pointOnWall(w, op.offset + op.width));
      const hingeAtStart = (op.swing?.hinge ?? 'inicio') === 'inicio';
      const base = layout.levels.find((l) => l.id === w.levelId)?.elevation ?? 0;
      out.push({ o: { ...op, sill: op.sill + base }, w, a: Math.min(us, ue), b: Math.max(us, ue), hingeLeft: hingeAtStart ? us < ue : ue < us, rawSill: op.sill, base });
    }
  }
  return out.sort((p, q) => p.a - q.a);
}

/** códigos de carpintería comunes a los cuatro alzados: P-01… puertas, V-01… ventanas y cristaleras */
export function openingCodes(layout: Layout): Map<string, string> {
  const codes = new Map<string, string>();
  let p = 0;
  let v = 0;
  for (const f of FACADES) for (const { o } of placedOpenings(layout, f.id)) {
    codes.set(o.id, o.kind === 'puerta' ? `P-${String(++p).padStart(2, '0')}` : `V-${String(++v).padStart(2, '0')}`);
  }
  return codes;
}

const SYSTEM_LABEL: Record<string, string> = { abatible: 'Abatible', corredera: 'Corredera', plegable: 'Plegable', fijo: 'Fijo' };

export function elevationSvg(layout: Layout, f: FacadeId, o: { showDims?: boolean; showLabels?: boolean; forExport?: boolean; variantName?: string; finishes?: Partial<Record<string, string>> } = {}): string {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const u = along(layout, f);
  const front = f === 'A' || f === 'B';
  const len = front ? maxX - minX : maxY - minY;
  const H = layout.topHeight;
  const r = layout.roof;
  const t = r?.thickness ?? 0.25;
  const sloped = !!r && r.type !== 'plana' && r.type !== 'plana-peto';
  const ov = sloped ? r!.overhang : 0;
  const yEdge = f === 'A' ? minY : f === 'B' ? maxY : null;
  const labels = o.showLabels !== false;
  const dims = o.showDims !== false;
  const meta = FACADES.find((x) => x.id === f)!;
  const codes = openingCodes(layout);
  const fin = (slot: keyof typeof FINISHES) => FINISHES[slot].find((x) => x.id === o.finishes?.[slot])?.label;

  // perfil de cubierta: en los frentes, lo más alto que asoma; en los laterales, la línea del faldón
  const N = 48;
  const profile: Vec2[] = front
    ? [[-ov, Math.max(...Array.from({ length: N + 1 }, (_, i) => roofProfile(layout, minY + ((maxY - minY) * i) / N)))], [len + ov, 0]]
    : Array.from({ length: N + 1 }, (_, i) => {
        const y = minY + ((maxY - minY) * i) / N;
        return [u([0, y]), roofProfile(layout, y)] as Vec2;
      }).sort((a, b) => a[0] - b[0]);
  const top = front ? profile[0][1] : Math.max(...profile.map((p) => p[1]));
  const wallTop = (uu: number): number => {
    if (!r || r.type === 'plana') return H;
    if (r.type === 'plana-peto') return H + (r.parapet ?? 0);
    if (front) return r.eaves && yEdge !== null ? Math.max(H, roofTopAt(layout, yEdge) - t) : H;
    const p = profile.reduce((best, q) => (Math.abs(q[0] - uu) < Math.abs(best[0] - uu) ? q : best), profile[0]);
    return Math.max(H, p[1] - t);
  };

  const annex = (layout.outdoor?.annexes ?? []).map((an) => {
    const [ax0, ay0, ax1, ay1] = an.rect;
    if (front) return { an, a: Math.min(u([ax0, 0]), u([ax1, 0])), b: Math.max(u([ax0, 0]), u([ax1, 0])) };
    if (f === 'izquierdo') return { an, a: u([0, ay0]), b: u([0, ay1]) };
    return null; // desde el lateral derecho queda detrás de la casa
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const u0 = Math.min(-ov, ...annex.map((x) => x.a));
  const u1 = Math.max(len + ov, ...annex.map((x) => x.b));
  const ops = placedOpenings(layout, f);

  // ---------------------------------------------------------------- lámina
  const drawW = u1 - u0;
  const sheetW = Math.max(drawW + 5.2, 15.5);
  const left = (sheetW - drawW) / 2 + 0.4; // desplazamiento del dibujo (sitio para las marcas de nivel a la izquierda)
  const X = (uu: number) => uu - u0 + left; // u → x de lámina
  const notesBand = 1.5;
  const yTop = -(top + notesBand + 0.6);
  const blockH = 3.1;
  const scheduleRows = ops.length;
  const tableH = 0.42 + 0.3 * Math.max(1, scheduleRows);
  const bottomBlock = Math.max(blockH, tableH) + 0.3;
  const yDimsEnd = dims ? 1.75 : 0.6;
  const titleY = yDimsEnd + 0.75;
  const sheetH = -yTop + titleY + 0.55 + bottomBlock + 0.4;
  const vb = { x: 0, y: yTop, w: sheetW, h: sheetH };
  const out: string[] = [];
  const size = o.forExport ? `width="${n4(vb.w * 20)}mm" height="${n4(vb.h * 20)}mm"` : 'width="100%" height="100%"';
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n4(vb.x)} ${n4(vb.y)} ${n4(vb.w)} ${n4(vb.h)}" ${size} font-family="'Helvetica Neue', Arial, system-ui, sans-serif" preserveAspectRatio="xMidYMid meet" data-units="m" data-facade="${f}">`);
  out.push(`<title>${esc(`${layout.name} · alzado ${meta.label}`)}</title>`);
  out.push(`<style>.tnum{font-variant-numeric:tabular-nums}text{fill:${INK}}</style>`);
  out.push(`<defs>
<pattern id="tile-${f}" patternUnits="userSpaceOnUse" width="0.2" height="0.36"><rect width="0.2" height="0.36" fill="#f2efe9"/><path d="M0 0.36 Q0.1 0.27 0.2 0.36" fill="none" stroke="${GREY}" stroke-width="0.008"/><line x1="0.1" y1="0.05" x2="0.1" y2="0.3" stroke="${LIGHT}" stroke-width="0.005"/></pattern>
<pattern id="cal-${f}" patternUnits="userSpaceOnUse" width="0.5" height="0.5"><rect width="0.5" height="0.5" fill="#ffffff"/><circle cx="0.12" cy="0.17" r="0.008" fill="#c9ccc6"/><circle cx="0.37" cy="0.08" r="0.006" fill="#d3d6d0"/><circle cx="0.29" cy="0.41" r="0.007" fill="#c9ccc6"/><circle cx="0.05" cy="0.44" r="0.005" fill="#d3d6d0"/></pattern>
<pattern id="earth-${f}" patternUnits="userSpaceOnUse" width="0.16" height="0.16" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="0.16" stroke="${GREY}" stroke-width="0.008"/></pattern>
<pattern id="louver-${f}" patternUnits="userSpaceOnUse" width="0.1" height="0.07"><rect width="0.1" height="0.07" fill="#f6f6f3"/><line x1="0" y1="0.05" x2="0.1" y2="0.05" stroke="${GREY}" stroke-width="0.007"/></pattern>
<clipPath id="draw-${f}"><rect x="0" y="${n4(yTop)}" width="${n4(sheetW)}" height="${n4(-yTop + 0.45)}"/></clipPath>
</defs>`);
  out.push(`<rect x="${n4(vb.x)}" y="${n4(vb.y)}" width="${n4(vb.w)}" height="${n4(vb.h)}" fill="#ffffff"/>`);
  // marco de la lámina
  out.push(`<rect x="0.15" y="${n4(yTop + 0.15)}" width="${n4(sheetW - 0.3)}" height="${n4(sheetH - 0.3)}" fill="none" stroke="${INK}" stroke-width="0.025"/>`);

  const g: string[] = [];
  // ---------------------------------------------------------------- terreno
  const gx0 = X(u0) - 1.0;
  const gx1 = X(u1) + 1.0;
  g.push(`<rect x="${n4(gx0)}" y="0" width="${n4(gx1 - gx0)}" height="0.3" fill="url(#earth-${f})"/>`);
  g.push(`<line x1="${n4(gx0)}" y1="0" x2="${n4(gx1)}" y2="0" stroke="${INK}" stroke-width="${LW.terrain}"/>`);

  // soleras elevadas delante de la fachada: su canto se ve como una franja sobre el terreno
  const pavBands: string[] = [];
  let pavTop = 0;
  for (const pv of layout.outdoor?.pavements ?? []) {
    if (pv.joints === 0 || !pv.top) continue;
    const [px0, py0, px1, py1] = pv.rect;
    const inFront = f === 'A' ? py0 < minY - 0.01 : f === 'B' ? py1 > maxY + 0.01 : f === 'izquierdo' ? px0 < minX - 0.01 : px1 > maxX + 0.01;
    if (!inFront) continue;
    const us = [u([px0, py0]), u([px1, py0]), u([px0, py1]), u([px1, py1])];
    const a = Math.max(Math.min(...us), u0 - 0.9);
    const b = Math.min(Math.max(...us), u1 + 0.9);
    if (b - a > 0.05) pavTop = Math.max(pavTop, pv.top);
    if (b - a > 0.05) pavBands.push(`<rect x="${n4(X(a))}" y="${n4(-pv.top)}" width="${n4(b - a)}" height="${n4(pv.top)}" fill="#efede7" stroke="${INK}" stroke-width="${LW.leaf}" data-pavement="${esc(pv.id)}"/>`);
  }

  // ---------------------------------------------------------------- muro de fachada
  const wallPoly: Vec2[] = [[X(0), 0], [X(len), 0]];
  const steps = front ? [len, 0] : Array.from({ length: N + 1 }, (_, i) => len - (len * i) / N);
  for (const uu of steps) wallPoly.push([X(uu), wallTop(uu)]);
  g.push(`<polygon points="${pts(wallPoly)}" fill="url(#cal-${f})" stroke="none"/>`);
  g.push(...pavBands);

  // líneas ocultas: forjado del altell y forjado de cubierta
  const hiddenLine = (h: number) => `<line x1="${n4(X(0) + 0.3)}" y1="${n4(-h)}" x2="${n4(X(len) - 0.3)}" y2="${n4(-h)}" stroke="${LIGHT}" stroke-width="${LW.hidden}" stroke-dasharray="0.12 0.07"/>`;
  // nivel alto (altell): el de mayor cota si hay más de uno; el de planta baja puede estar elevado sobre el terreno
  const sortedLv = [...layout.levels].sort((a, b) => a.elevation - b.elevation);
  const altell = sortedLv.length > 1 ? sortedLv[sortedLv.length - 1] : undefined;
  if (sortedLv[0] && sortedLv[0].elevation > 0.02) g.push(hiddenLine(sortedLv[0].elevation));
  const hidden = (h: number) => `<line x1="${n4(X(0) + 0.3)}" y1="${n4(-h)}" x2="${n4(X(len) - 0.3)}" y2="${n4(-h)}" stroke="${LIGHT}" stroke-width="${LW.hidden}" stroke-dasharray="0.12 0.07"/>`;
  if (altell) {
    const slab = layout.slabs.find((s) => s.levelId === altell.id)?.thickness ?? 0.3;
    g.push(hidden(altell.elevation), hidden(altell.elevation - slab));
  }
  if (!sloped) g.push(hidden(H - t));

  // ---------------------------------------------------------------- huecos
  for (const p of ops) {
    const { o: op, a, b } = p;
    const xa = X(a);
    const xb = X(b);
    const y0 = op.sill;
    const y1 = op.sill + op.height;
    const glass = op.kind !== 'puerta' || !!op.glazed;
    const mf = 0.05; // marco
    const fx0 = xa + mf;
    const fx1 = xb - mf;
    const fy0 = y0 + (op.kind === 'puerta' ? 0 : mf);
    const fy1 = y1 - mf;
    g.push(`<g data-opening="${esc(op.id)}">`);
    // hueco (jamba y dintel) y marco
    g.push(`<rect x="${n4(xa)}" y="${n4(-y1)}" width="${n4(xb - xa)}" height="${n4(y1 - y0)}" fill="#ffffff" stroke="${INK}" stroke-width="${LW.opening}"/>`);
    g.push(`<rect x="${n4(fx0)}" y="${n4(-fy1)}" width="${n4(fx1 - fx0)}" height="${n4(fy1 - fy0)}" fill="${glass ? (op.glazed === 'mate' ? '#eceeed' : '#e4ebee') : '#ffffff'}" stroke="${GREY}" stroke-width="${LW.leaf}"/>`);
    const leaves = Math.max(1, op.system?.leaves ?? (op.kind === 'cristalera' || (glass && b - a > 2.4) ? Math.max(2, Math.round((b - a) / 1.2)) : 1));
    const lw = (fx1 - fx0) / leaves;
    for (let k = 0; k < leaves; k++) {
      const lx0 = fx0 + k * lw;
      const lx1 = lx0 + lw;
      if (k > 0) g.push(`<line x1="${n4(lx0)}" y1="${n4(-fy1)}" x2="${n4(lx0)}" y2="${n4(-fy0)}" stroke="${GREY}" stroke-width="${LW.leaf * 1.6}"/>`);
      if (glass) {
        // reflejos del vidrio
        const w = lx1 - lx0;
        const h = fy1 - fy0;
        const s = Math.min(w, h) * 0.35;
        const cx = lx0 + w * 0.62;
        const cy = fy0 + h * 0.62;
        g.push(`<line x1="${n4(cx - s / 2)}" y1="${n4(-(cy - s / 2))}" x2="${n4(cx + s / 2)}" y2="${n4(-(cy + s / 2))}" stroke="#aeb9bd" stroke-width="${LW.fine}"/><line x1="${n4(cx - s / 4)}" y1="${n4(-(cy - s / 2))}" x2="${n4(cx + s / 2 + s / 4 - s / 2)}" y2="${n4(-(cy))}" stroke="#aeb9bd" stroke-width="${LW.fine}"/>`);
      } else {
        // puerta de tablones verticales
        for (let x = lx0 + 0.14; x < lx1 - 0.04; x += 0.14) g.push(`<line x1="${n4(x)}" y1="${n4(-fy1)}" x2="${n4(x)}" y2="${n4(-fy0)}" stroke="${LIGHT}" stroke-width="${LW.fine}"/>`);
      }
      // símbolo de apertura (líneas discontinuas hacia el lado de las bisagras)
      const sys = op.system?.type;
      if (sys === 'abatible' || sys === 'plegable') {
        const hingeLeft = leaves === 1 ? p.hingeLeft : k < leaves / 2;
        const hx = hingeLeft ? lx0 : lx1;
        const fxp = hingeLeft ? lx1 : lx0;
        g.push(`<polyline points="${pts([[fxp, fy1], [hx, (fy0 + fy1) / 2], [fxp, fy0]])}" fill="none" stroke="${GREY}" stroke-width="${LW.fine}" stroke-dasharray="0.06 0.04"/>`);
        // tirador
        const tx = hingeLeft ? lx1 - 0.07 : lx0 + 0.04;
        const ty = op.kind === 'puerta' ? 1.05 : (fy0 + fy1) / 2 - 0.08;
        g.push(`<rect x="${n4(tx)}" y="${n4(-(ty + 0.16))}" width="0.03" height="0.16" fill="${INK}"/>`);
      } else if (sys === 'corredera') {
        const ym = -(fy0 + fy1) / 2;
        const d = k % 2 ? -1 : 1;
        g.push(`<path d="M ${n4(lx0 + lw * 0.25)} ${n4(ym)} L ${n4(lx0 + lw * 0.75)} ${n4(ym)} M ${n4(lx0 + lw * (0.5 + 0.25 * d) - d * 0.08)} ${n4(ym - 0.05)} L ${n4(lx0 + lw * (0.5 + 0.25 * d))} ${n4(ym)} L ${n4(lx0 + lw * (0.5 + 0.25 * d) - d * 0.08)} ${n4(ym + 0.05)}" fill="none" stroke="${GREY}" stroke-width="${LW.fine}"/>`);
      }
    }
    // escalones delante de los huecos a ras del suelo interior elevado
    if (p.rawSill < 0.05 && p.base > 0.05) {
      // arrancan de la superficie exterior delante del hueco (solera elevada o terreno)
      const mid = pointOnWall(p.w, p.o.offset + p.o.width / 2);
      const out = 0.4 + p.w.thickness / 2;
      const probe: Vec2 = f === 'A' ? [mid[0], minY - out] : f === 'B' ? [mid[0], maxY + out] : f === 'izquierdo' ? [minX - out, mid[1]] : [maxX + out, mid[1]];
      const g0 = groundTopAt(layout.outdoor, probe[0], probe[1]);
      const rise = p.base - g0;
      if (rise > 0.05) {
        const n = Math.max(1, Math.round(rise / 0.19));
        for (let k = 0; k < n; k++) {
          const hTop = g0 + (rise * (k + 1)) / n;
          g.push(`<rect x="${n4(xa - 0.1)}" y="${n4(-hTop)}" width="${n4(xb - xa + 0.2)}" height="${n4(rise / n)}" fill="#ffffff" stroke="${INK}" stroke-width="${LW.leaf}"/>`);
        }
      }
    }
    // vierteaguas
    if (op.kind !== 'puerta' && p.rawSill > 0.05) g.push(`<rect x="${n4(xa - 0.04)}" y="${n4(-y0)}" width="${n4(xb - xa + 0.08)}" height="0.04" fill="#ffffff" stroke="${INK}" stroke-width="${LW.leaf}"/>`);
    // contraventanas de lamas abiertas contra la fachada
    if (op.shutters) {
      const sw = (xb - xa) / 2;
      for (const sx of [xa - sw - 0.02, xb + 0.02]) g.push(`<rect x="${n4(sx)}" y="${n4(-y1)}" width="${n4(sw)}" height="${n4(y1 - y0)}" fill="url(#louver-${f})" stroke="${GREY}" stroke-width="${LW.leaf}"/>`);
    }
    // código del hueco
    const code = codes.get(op.id);
    if (code && labels) {
      const cx = (xa + xb) / 2;
      const cy = -(y1 + 0.24);
      g.push(`<g class="tag"><rect x="${n4(cx - 0.27)}" y="${n4(cy - 0.11)}" width="0.54" height="0.22" rx="0.11" fill="#ffffff" stroke="${INK}" stroke-width="${LW.leaf}"/><text x="${n4(cx)}" y="${n4(cy + 0.045)}" font-size="0.13" font-weight="600" text-anchor="middle">${code}</text></g>`);
    }
    g.push('</g>');
  }

  // contorno del muro (encima de los huecos para que el canto quede limpio)
  g.push(`<polygon points="${pts(wallPoly)}" fill="none" stroke="${INK}" stroke-width="${LW.outline}" stroke-linejoin="miter"/>`);

  // ---------------------------------------------------------------- cubierta
  if (!r || r.type === 'plana') {
    // coronación del muro (albardilla)
    g.push(`<rect x="${n4(X(0) - 0.03)}" y="${n4(-H - 0.05)}" width="${n4(len + 0.06)}" height="0.05" fill="#ffffff" stroke="${INK}" stroke-width="${LW.leaf}"/>`);
  } else if (r.type === 'plana-peto') {
    g.push(`<line x1="${n4(X(0))}" y1="${n4(-H)}" x2="${n4(X(len))}" y2="${n4(-H)}" stroke="${LIGHT}" stroke-width="${LW.hidden}" stroke-dasharray="0.12 0.07"/>`);
  } else if (front) {
    const wt = wallTop(0);
    const rt = profile[0][1];
    if (rt - wt > t + 0.02) {
      // faldón visto por encima del alero
      g.push(`<polygon points="${pts([[X(-ov), wt], [X(len + ov), wt], [X(len + ov), rt], [X(-ov), rt]])}" fill="${r.tiles ? `url(#tile-${f})` : '#f2efe9'}" stroke="${INK}" stroke-width="${LW.outline}"/>`);
      g.push(`<rect x="${n4(X(-ov))}" y="${n4(-(wt + 0.06))}" width="${n4(len + 2 * ov)}" height="0.1" fill="#ffffff" stroke="${INK}" stroke-width="${LW.leaf}"/>`);
    } else {
      g.push(`<rect x="${n4(X(-ov))}" y="${n4(-rt)}" width="${n4(len + 2 * ov)}" height="${n4(rt - wt)}" fill="#ffffff" stroke="${INK}" stroke-width="${LW.outline}"/>`);
      if (r.tiles) for (let x = X(-ov) + 0.1; x < X(len + ov); x += 0.2) g.push(`<path d="M ${n4(x - 0.09)} ${n4(-rt + 0.01)} Q ${n4(x)} ${n4(-rt - 0.06)} ${n4(x + 0.09)} ${n4(-rt + 0.01)}" fill="none" stroke="${GREY}" stroke-width="${LW.fine}"/>`);
    }
  } else {
    // canto inclinado del faldón en el lateral, con su vuelo, y piezas de teja vistas de canto
    const a = profile[0];
    const b = profile[profile.length - 1];
    const sl = (b[1] - a[1]) / (b[0] - a[0]);
    const A: Vec2 = [X(a[0] - ov), a[1] - sl * ov];
    const B: Vec2 = [X(b[0] + ov), b[1] + sl * ov];
    g.push(`<polygon points="${pts([A, B, [B[0], B[1] - t], [A[0], A[1] - t]])}" fill="#ffffff" stroke="${INK}" stroke-width="${LW.outline}"/>`);
    if (r.tiles) {
      const n = Math.floor(Math.hypot(B[0] - A[0], B[1] - A[1]) / 0.36);
      for (let i = 0; i <= n; i++) {
        const x = A[0] + ((B[0] - A[0]) * i) / n;
        const y = A[1] + ((B[1] - A[1]) * i) / n;
        g.push(`<path d="M ${n4(x - 0.16)} ${n4(-y)} Q ${n4(x)} ${n4(-y - 0.08)} ${n4(x + 0.16)} ${n4(-(y + sl * 0.32))}" fill="none" stroke="${GREY}" stroke-width="${LW.fine}"/>`);
      }
    }
  }

  // ---------------------------------------------------------------- cuarto técnico y terraza
  for (const { an, a, b } of annex) {
    const pe = an.terrace?.parapet ?? 0;
    const xa = X(a);
    const xb = X(b);
    const ext = front ? 0 : 0.08;
    g.push(`<g data-annex="${esc(an.id)}">`);
    g.push(`<rect x="${n4(xa)}" y="${n4(-an.height)}" width="${n4(xb - xa)}" height="${n4(an.height)}" fill="url(#cal-${f})" stroke="${INK}" stroke-width="${LW.outline}"/>`);
    if (pe > 0) {
      g.push(`<rect x="${n4(xa - ext)}" y="${n4(-(an.height + pe))}" width="${n4(xb - xa + 2 * ext)}" height="${n4(pe)}" fill="url(#cal-${f})" stroke="${INK}" stroke-width="${LW.outline}"/>`);
      g.push(`<rect x="${n4(xa - ext - 0.03)}" y="${n4(-(an.height + pe + 0.05))}" width="${n4(xb - xa + 2 * ext + 0.06)}" height="0.05" fill="#ffffff" stroke="${INK}" stroke-width="${LW.leaf}"/>`);
      g.push(`<line x1="${n4(xa + 0.1)}" y1="${n4(-an.height)}" x2="${n4(xb - 0.1)}" y2="${n4(-an.height)}" stroke="${LIGHT}" stroke-width="${LW.hidden}" stroke-dasharray="0.12 0.07"/>`);
    }
    const d = an.door;
    const doorFacade = d.side === 'y1' ? 'B' : d.side === 'y0' ? 'A' : d.side === 'x0' ? 'izquierdo' : 'derecho';
    if (doorFacade === f) {
      const dc = X(front ? u([d.at, 0]) : u([0, d.at]));
      g.push(`<rect x="${n4(dc - d.width / 2)}" y="${n4(-d.height)}" width="${n4(d.width)}" height="${n4(d.height)}" fill="#ffffff" stroke="${INK}" stroke-width="${LW.opening}"/>`);
      g.push(`<rect x="${n4(dc - d.width / 2 + 0.12)}" y="-0.45" width="${n4(d.width - 0.24)}" height="0.25" fill="url(#louver-${f})" stroke="${GREY}" stroke-width="${LW.fine}"/>`);
      g.push(`<rect x="${n4(dc + d.width / 2 - 0.12)}" y="-1.12" width="0.03" height="0.16" fill="${INK}"/>`);
    }
    g.push('</g>');
  }

  out.push(`<g clip-path="url(#draw-${f})">${g.join('')}</g>`);

  // ---------------------------------------------------------------- marcas de nivel (izquierda)
  const pbLevel = layout.levels.find((l) => l.elevation >= 0 && !layout.levels.some((m) => m.elevation >= 0 && m.elevation < l.elevation));
  const levelMarks: { h: number; text: string }[] = [{ h: 0, text: (pbLevel?.elevation ?? 0) > 0.02 ? 'terreno' : 'suelo planta baja' }];
  if (pbLevel && pbLevel.elevation > 0.02) levelMarks.push({ h: pbLevel.elevation, text: 'suelo planta baja (interior elevado)' });
  if (pavTop > 0.02) levelMarks.push({ h: pavTop, text: 'solera exterior' });
  if (altell) levelMarks.push({ h: altell.elevation, text: `suelo ${altell.name.toLowerCase()}` });
  const wtMax = front ? wallTop(0) : Math.max(...wallPoly.map((p) => p[1]));
  if (sloped) {
    const wtMin = front ? wallTop(0) : Math.min(...wallPoly.slice(2).map((p) => p[1]));
    levelMarks.push({ h: wtMin, text: front ? 'apoyo del faldón' : 'alero bajo' });
    if (front && r!.eaves && yEdge !== null) levelMarks.push({ h: roofTopAt(layout, yEdge), text: 'alero' });
    if (!front && wtMax - wtMin > 0.05) levelMarks.push({ h: wtMax, text: 'alero alto' });
    levelMarks.push({ h: top, text: front && top - wtMin > t + 0.05 ? 'faldón (más alto)' : 'cara superior de cubierta' });
  } else {
    levelMarks.push({ h: top, text: r?.type === 'plana-peto' ? 'coronación del peto' : 'coronación' });
  }
  for (const { an } of annex) {
    levelMarks.push({ h: an.height, text: an.terrace ? 'terraza (cuarto técnico)' : 'cubierta cuarto técnico' });
    if (an.terrace) levelMarks.push({ h: an.height + an.terrace.parapet, text: 'peto terraza' });
  }
  // niveles a menos de 10 cm se agrupan en una sola marca
  const lm: { h: number; text: string }[] = [];
  for (const m of [...levelMarks].sort((p, q) => p.h - q.h)) {
    const prev = lm[lm.length - 1];
    if (prev && m.h - prev.h < 0.1) { if (!prev.text.includes(m.text)) prev.text = `${prev.text} / ${m.text}`; prev.h = Math.max(prev.h, m.h); }
    else lm.push({ ...m });
  }
  const mx = X(u0) - 0.65;
  let lastY = -Infinity;
  for (const m of lm) {
    const yy = Math.max(m.h, lastY + 0.32); // separa los rótulos muy próximos
    lastY = yy;
    out.push(`<g class="level"><line x1="${n4(mx - 0.05)}" y1="${n4(-m.h)}" x2="${n4(X(u0) - 0.08)}" y2="${n4(-m.h)}" stroke="${GREY}" stroke-width="${LW.fine}"/><path d="M ${n4(mx - 0.1)} ${n4(-m.h - 0.14)} L ${n4(mx + 0.1)} ${n4(-m.h - 0.14)} L ${n4(mx)} ${n4(-m.h)} Z" fill="${INK}"/>${labels ? `<text x="${n4(mx - 0.16)}" y="${n4(-yy - 0.02)}" font-size="0.15" font-weight="600" text-anchor="end" class="tnum">${lvl(m.h)}</text><text x="${n4(mx - 0.16)}" y="${n4(-yy + 0.14)}" font-size="0.1" text-anchor="end" fill="${GREY}">${esc(m.text)}</text>` : ''}</g>`);
  }

  // ---------------------------------------------------------------- cotas
  if (dims) {
    const dimH = (a: number, b: number, y: number, label: string, ref = 0) => {
      const x0 = X(a);
      const x1 = X(b);
      const tick = (x: number) => `<line x1="${n4(x - 0.06)}" y1="${n4(y + 0.06)}" x2="${n4(x + 0.06)}" y2="${n4(y - 0.06)}" stroke-width="${LW.leaf * 1.6}"/>`;
      return `<g class="dim" stroke="${GREY}" stroke-width="${LW.fine}"><line x1="${n4(x0)}" y1="${n4(ref + 0.08)}" x2="${n4(x0)}" y2="${n4(y + 0.1)}"/><line x1="${n4(x1)}" y1="${n4(ref + 0.08)}" x2="${n4(x1)}" y2="${n4(y + 0.1)}"/><line x1="${n4(x0 - 0.1)}" y1="${n4(y)}" x2="${n4(x1 + 0.1)}" y2="${n4(y)}"/>${tick(x0)}${tick(x1)}<text x="${n4((x0 + x1) / 2)}" y="${n4(y - 0.07)}" font-size="0.15" text-anchor="middle" stroke="none" class="tnum">${esc(label)}</text></g>`;
    };
    const dimV = (x: number, h0: number, h1: number, label: string) => {
      const tick = (h: number) => `<line x1="${n4(x - 0.06)}" y1="${n4(-h + 0.06)}" x2="${n4(x + 0.06)}" y2="${n4(-h - 0.06)}" stroke-width="${LW.leaf * 1.6}"/>`;
      const ym = -(h0 + h1) / 2;
      return `<g class="dim" stroke="${GREY}" stroke-width="${LW.fine}"><line x1="${n4(x)}" y1="${n4(-h0 + 0.1)}" x2="${n4(x)}" y2="${n4(-h1 - 0.1)}"/>${tick(h0)}${tick(h1)}<text x="${n4(x - 0.08)}" y="${n4(ym)}" font-size="0.15" text-anchor="middle" stroke="none" class="tnum" transform="rotate(-90 ${n4(x - 0.08)} ${n4(ym)})">${esc(label)}</text></g>`;
    };
    // cadena de huecos y largo total (abajo)
    const chain = [0, ...ops.flatMap((p) => [p.a, p.b]), len].map((x) => Math.min(len, Math.max(0, x))).sort((p, q) => p - q).filter((x, i, arr) => i === 0 || x - arr[i - 1] > 0.02);
    // cadena de huecos (si no hay huecos, basta con el largo total)
    if (chain.length > 2) for (let i = 0; i < chain.length - 1; i++) out.push(dimH(chain[i], chain[i + 1], 0.75, fmtM(chain[i + 1] - chain[i])));
    out.push(dimH(0, len, 1.3, fmtM(len)));
    if (front) for (const { a, b } of annex) out.push(dimH(a, b, 0.75, fmtM(b - a)));
    // alturas (derecha): huecos, muro y total
    const xr = X(u1) + 0.45;
    const hs = [...new Set([0, ...ops.flatMap((p) => [p.o.sill, p.o.sill + p.o.height]), wtMax, top].map((v) => Math.round(v * 100) / 100))].sort((p, q) => p - q);
    if (hs.length > 2) for (let i = 0; i < hs.length - 1; i++) if (hs[i + 1] - hs[i] > 0.04) out.push(dimV(xr, hs[i], hs[i + 1], fmtM(hs[i + 1] - hs[i])));
    out.push(dimV(xr + 0.55, 0, top, fmtM(top)));
  }

  // ---------------------------------------------------------------- rótulos de material
  if (labels) {
    type Note = { at: Vec2; text: string };
    const notes: Note[] = [];
    // punto de muro lejos de los huecos para el rótulo del revoco
    const free = (uu: number, h: number) => ops.every((p) => uu < p.a - 0.25 || uu > p.b + 0.25 || h < p.o.sill - 0.25 || h > p.o.sill + p.o.height + 0.25);
    const wallAt = [0.82, 0.62, 0.45, 0.3, 0.15].map((k) => [len * k, Math.min(wtMax - 0.8, wallTop(len * k) - 0.6) * 0.85] as Vec2).find(([uu, h]) => free(uu, h)) ?? [len * 0.5, 0.5];
    notes.push({ at: [X(wallAt[0]), wallAt[1]], text: `Revoco de ${(fin('fachada') ?? 'cal').replace(/\s*\(.*\)$/, '').toLowerCase()}` });
    if (sloped && (front ? profile[0][1] - wallTop(0) > t + 0.02 : true)) {
      const rt = front ? (wallTop(0) + profile[0][1]) / 2 : profile[Math.floor(profile.length * 0.3)][1] - t / 2;
      notes.push({ at: [X(front ? len * 0.35 : len * 0.3), rt], text: r!.tiles ? 'Teja cerámica curva sobre lámina impermeable' : 'Faldón de cubierta' });
    }
    const door = ops.find((p) => p.o.entrance);
    if (door) notes.push({ at: [X((door.a + door.b) / 2), door.o.sill + door.o.height * 0.55], text: 'Puerta de entrada de madera' });
    const win = ops.find((p) => p.o.kind !== 'puerta');
    if (win) notes.push({ at: [X(win.a + (win.b - win.a) * 0.3), win.o.sill + win.o.height * 0.5], text: `Carpintería ${(fin('carpinteria') ?? '').replace(/\s*\(.*\)$/, '').toLowerCase()}` });
    for (const { an, a, b } of annex) if (an.terrace) notes.push({ at: [X((a + b) / 2), an.height + an.terrace.parapet * 0.6], text: `Peto encalado de la terraza h ${fmtM(an.terrace.parapet)}` });
    // reparto en la banda superior, sin solapes
    const sorted = notes.sort((p, q) => p.at[0] - q.at[0]);
    const ny = top + 0.75;
    let lastX = -Infinity;
    const minGap = 3.1;
    for (const n of sorted) {
      const tx = Math.max(n.at[0] - 0.3, lastX + minGap, 0.6);
      lastX = tx;
      out.push(`<g class="note"><polyline points="${pts([[tx, ny - 0.06], [tx, ny - 0.2], [n.at[0], n.at[1]]])}" fill="none" stroke="${GREY}" stroke-width="${LW.fine}"/><circle cx="${n4(n.at[0])}" cy="${n4(-n.at[1])}" r="0.035" fill="${INK}"/><text x="${n4(tx)}" y="${n4(-ny)}" font-size="0.13">${esc(n.text)}</text></g>`);
    }
  }

  // ---------------------------------------------------------------- título del dibujo
  const tx0 = X(u0);
  out.push(`<g class="drawing-title"><circle cx="${n4(tx0 + 0.25)}" cy="${n4(titleY - 0.1)}" r="0.25" fill="none" stroke="${INK}" stroke-width="0.02"/><text x="${n4(tx0 + 0.25)}" y="${n4(titleY - 0.04)}" font-size="0.17" font-weight="700" text-anchor="middle">${meta.short.replace('.', '')}</text><text x="${n4(tx0 + 0.65)}" y="${n4(titleY - 0.03)}" font-size="0.3" font-weight="700" letter-spacing="0.01">ALZADO ${esc(meta.label.toUpperCase())}</text><line x1="${n4(tx0 + 0.65)}" y1="${n4(titleY + 0.07)}" x2="${n4(tx0 + 0.65 + 0.2 * (8 + meta.label.length))}" y2="${n4(titleY + 0.07)}" stroke="${INK}" stroke-width="0.02"/><text x="${n4(tx0 + 0.65)}" y="${n4(titleY + 0.27)}" font-size="0.13" fill="${GREY}">Visto desde el exterior · ${o.forExport ? 'escala 1:50' : 'escala gráfica en el cajetín'}</text></g>`);

  // ---------------------------------------------------------------- cuadro de carpinterías y cajetín
  const by = titleY + 0.65;
  const bx1 = sheetW - 0.35;
  const cw = 6.6;
  const cx0 = bx1 - cw;
  // cuadro de carpinterías (izquierda)
  const tw = Math.min(cx0 - 0.6 - 0.35, 8.6);
  const tX = 0.35;
  const cols = [0, 0.7, 4.0, 5.55, 6.7].map((c) => (c * tw) / 8.6);
  const tr: string[] = [`<g class="schedule"><text x="${n4(tX)}" y="${n4(by + 0.02)}" font-size="0.15" font-weight="700">CUADRO DE CARPINTERÍAS DE ESTA FACHADA</text>`];
  const head = ['Código', 'Hueco', 'Ancho × alto', 'Antepecho', 'Sistema'];
  const rowY = (i: number) => by + 0.12 + 0.3 * i;
  tr.push(`<rect x="${n4(tX)}" y="${n4(rowY(0))}" width="${n4(tw)}" height="0.3" fill="#f0f0ec"/>`);
  head.forEach((h, i) => tr.push(`<text x="${n4(tX + cols[i] + 0.06)}" y="${n4(rowY(0) + 0.2)}" font-size="0.12" font-weight="600">${h}</text>`));
  const rows = ops.length ? ops : [];
  rows.forEach((p, i) => {
    const y = rowY(i + 1);
    const cells = [codes.get(p.o.id) ?? '', p.o.label.replace(/\s*\(.*\)$/, ''), `${fmtM(p.o.width)} × ${fmtM(p.o.height)}`, p.rawSill > 0.005 ? fmtM(p.rawSill) : '—', p.o.system ? `${SYSTEM_LABEL[p.o.system.type] ?? p.o.system.type}${p.o.system.leaves > 1 ? ` · ${p.o.system.leaves} hojas` : ''}` : 'Por definir'];
    cells.forEach((c, k) => {
      const maxChars = Math.floor(((k < 4 ? cols[k + 1] : tw) - cols[k]) / 0.068);
      const s = c.length > maxChars ? `${c.slice(0, Math.max(1, maxChars - 1))}…` : c;
      tr.push(`<text x="${n4(tX + cols[k] + 0.06)}" y="${n4(y + 0.2)}" font-size="0.12" class="tnum"${k === 0 ? ' font-weight="600"' : ''}>${esc(s)}</text>`);
    });
    tr.push(`<line x1="${n4(tX)}" y1="${n4(y)}" x2="${n4(tX + tw)}" y2="${n4(y)}" stroke="${LIGHT}" stroke-width="${LW.fine}"/>`);
  });
  if (!rows.length) tr.push(`<text x="${n4(tX + 0.06)}" y="${n4(rowY(1) + 0.2)}" font-size="0.12" fill="${GREY}">Sin huecos en esta fachada.</text>`);
  const tEnd = rowY(Math.max(1, rows.length) + 1);
  tr.push(`<rect x="${n4(tX)}" y="${n4(rowY(0))}" width="${n4(tw)}" height="${n4(tEnd - rowY(0))}" fill="none" stroke="${INK}" stroke-width="0.015"/>`);
  tr.push(`<text x="${n4(tX)}" y="${n4(tEnd + 0.22)}" font-size="0.1" fill="${GREY}">Medidas de hueco en metros. Carpinterías y sistemas propuestos salvo indicación; a definir con el arquitecto y el carpintero.</text></g>`);
  out.push(tr.join(''));

  // cajetín (derecha)
  const ch = blockH;
  const cb: string[] = [`<g class="title-block"><rect x="${n4(cx0)}" y="${n4(by)}" width="${n4(cw)}" height="${n4(ch)}" fill="#ffffff" stroke="${INK}" stroke-width="0.025"/>`];
  // plano de situación de la fachada
  const kw = 1.9;
  const kx = cx0 + 0.2;
  const ky = by + 0.35;
  const L = maxX - minX;
  const W = maxY - minY;
  const ks = Math.min((kw - 1.0) / L, (kw - 1.0) / W);
  const kcx = kx + kw / 2;
  const kcy = ky + 0.95;
  const KX = (x: number) => kcx + (x - (minX + L / 2)) * ks;
  const KY = (y: number) => kcy + (y - (minY + W / 2)) * ks;
  cb.push(`<text x="${n4(kx)}" y="${n4(by + 0.22)}" font-size="0.1" fill="${GREY}">SITUACIÓN DE LA FACHADA</text>`);
  for (const { an } of annex) cb.push(`<rect x="${n4(KX(an.rect[0]))}" y="${n4(KY(an.rect[1]))}" width="${n4((an.rect[2] - an.rect[0]) * ks)}" height="${n4((an.rect[3] - an.rect[1]) * ks)}" fill="#f0f0ec" stroke="${GREY}" stroke-width="0.01"/>`);
  cb.push(`<rect x="${n4(KX(minX))}" y="${n4(KY(minY))}" width="${n4(L * ks)}" height="${n4(W * ks)}" fill="#f0f0ec" stroke="${INK}" stroke-width="0.015"/>`);
  const edge: [Vec2, Vec2, Vec2] = f === 'A' ? [[minX, minY], [maxX, minY], [0, -1]] : f === 'B' ? [[minX, maxY], [maxX, maxY], [0, 1]] : f === 'izquierdo' ? [[minX, minY], [minX, maxY], [-1, 0]] : [[maxX, minY], [maxX, maxY], [1, 0]];
  const [e0, e1, nrm] = edge;
  cb.push(`<line x1="${n4(KX(e0[0]))}" y1="${n4(KY(e0[1]))}" x2="${n4(KX(e1[0]))}" y2="${n4(KY(e1[1]))}" stroke="${INK}" stroke-width="0.06"/>`);
  const ex = (KX(e0[0]) + KX(e1[0])) / 2 + nrm[0] * 0.38;
  const ey = (KY(e0[1]) + KY(e1[1])) / 2 + nrm[1] * 0.38;
  cb.push(`<path d="M ${n4(ex + nrm[0] * 0.12 - nrm[1] * 0.1)} ${n4(ey + nrm[1] * 0.12 + nrm[0] * 0.1)} L ${n4(ex - nrm[0] * 0.12)} ${n4(ey - nrm[1] * 0.12)} L ${n4(ex + nrm[0] * 0.12 + nrm[1] * 0.1)} ${n4(ey + nrm[1] * 0.12 - nrm[0] * 0.1)} Z" fill="${INK}"/>`);
  // norte del proyecto en el plano de situación
  if (layout.northDeg !== null && layout.northDeg !== undefined) {
    const a = (layout.northDeg * Math.PI) / 180;
    const nx = kx + kw - 0.25;
    const ny = by + 0.5;
    const dx = Math.sin(a) * 0.18;
    const dy = -Math.cos(a) * 0.18;
    cb.push(`<line x1="${n4(nx - dx)}" y1="${n4(ny - dy)}" x2="${n4(nx + dx)}" y2="${n4(ny + dy)}" stroke="${INK}" stroke-width="0.015"/><circle cx="${n4(nx + dx)}" cy="${n4(ny + dy)}" r="0.03" fill="${INK}"/><text x="${n4(nx + dx * 1.7)}" y="${n4(ny + dy * 1.7 + 0.04)}" font-size="0.1" text-anchor="middle" font-weight="700">N</text>`);
  }
  // datos
  const dx0 = kx + kw + 0.15;
  cb.push(`<line x1="${n4(dx0 - 0.08)}" y1="${n4(by)}" x2="${n4(dx0 - 0.08)}" y2="${n4(by + ch)}" stroke="${INK}" stroke-width="0.012"/>`);
  const rowsC: [string, string, number, boolean?][] = [
    ['PROYECTO', layout.name, 0.2, true],
    ['PLANO', `Alzado ${meta.label}`, 0.15],
    ['VARIANTE', o.variantName ?? 'Base', 0.13],
    ['CUBIERTA', (r?.label ?? 'sin definir').replace(/\s*\(.*\)$/, ''), 0.12],
  ];
  let yy = by + 0.26;
  for (const [k, v, fs, bold] of rowsC) {
    cb.push(`<text x="${n4(dx0)}" y="${n4(yy)}" font-size="0.085" fill="${GREY}" letter-spacing="0.02">${k}</text><text x="${n4(dx0)}" y="${n4(yy + fs + 0.04)}" font-size="${fs}"${bold ? ' font-weight="700"' : ''}>${esc(v.length > 46 ? `${v.slice(0, 45)}…` : v)}</text>`);
    yy += fs + 0.36;
  }
  // escala, fecha y número de plano
  const sy = by + ch - 0.62;
  cb.push(`<line x1="${n4(dx0 - 0.08)}" y1="${n4(sy - 0.12)}" x2="${n4(bx1)}" y2="${n4(sy - 0.12)}" stroke="${INK}" stroke-width="0.012"/>`);
  const bar = [0, 1, 2, 3, 4, 5];
  for (let i = 0; i < bar.length - 1; i++) cb.push(`<rect x="${n4(dx0 + bar[i] * 0.42)}" y="${n4(sy + 0.05)}" width="0.42" height="0.07" fill="${i % 2 ? '#ffffff' : INK}" stroke="${INK}" stroke-width="0.008"/>`);
  for (const v of [0, 1, 5]) cb.push(`<text x="${n4(dx0 + v * 0.42)}" y="${n4(sy + 0.25)}" font-size="0.085" text-anchor="middle">${v}${v === 5 ? ' m' : ''}</text>`);
  cb.push(`<text x="${n4(dx0)}" y="${n4(sy - 0.01)}" font-size="0.085" fill="${GREY}">ESCALA ${o.forExport ? '1:50' : 'GRÁFICA'}</text>`);
  const date = new Date().toLocaleDateString('es-ES');
  cb.push(`<text x="${n4(dx0 + 2.6)}" y="${n4(sy - 0.01)}" font-size="0.085" fill="${GREY}">FECHA</text><text x="${n4(dx0 + 2.6)}" y="${n4(sy + 0.15)}" font-size="0.12" class="tnum">${date}</text>`);
  cb.push(`<text x="${n4(bx1 - 0.15)}" y="${n4(sy - 0.01)}" font-size="0.085" fill="${GREY}" text-anchor="end">PLANO</text><text x="${n4(bx1 - 0.15)}" y="${n4(sy + 0.24)}" font-size="0.26" font-weight="700" text-anchor="end">${meta.sheet}</text>`);
  cb.push(`<text x="${n4(cx0 + 0.2)}" y="${n4(by + ch - 0.12)}" font-size="0.085" fill="${GREY}">Estudio de visualización a partir del modelo · cotas en metros · no es proyecto técnico de ejecución</text>`);
  cb.push('</g>');
  out.push(cb.join(''));
  out.push('</svg>');
  return out.join('');
}
