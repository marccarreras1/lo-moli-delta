/**
 * Planta 2D vectorial generada desde el mismo Layout que el modelo 3D.
 * Devuelve el SVG como texto: se usa en pantalla y en la exportación.
 * Unidades: metros (viewBox en metros, Y hacia abajo = sentido del papel).
 */
import type { DataStatus, Layout, Vec2 } from '../data/types';
import {
  bbox, centroid, doorSwing, fmtM, furnitureFootprint, pointOnWall, polygonArea, wallDir, wallLength, wallNormal, wallPieces, wallSegmentRect,
} from '../model/geometry';
import { FRAME, leafPose } from '../model/openings';
import { passages } from '../model/passages';
import { soleraQuantities } from '../model/solera';
import { gardenPlants, pathSlabs } from '../model/garden';
import type { Issue } from '../model/validate';
import { ACCENT, AMBER, STATUS_STYLE } from '../ui/status';

export interface PlanOverlay {
  href: string;
  /** posición (m) de la esquina superior izquierda de la imagen, giro (°) y tamaño (m) */
  x: number;
  y: number;
  rotation: number;
  widthM: number;
  heightM: number;
  opacity: number;
}

export interface PlanOptions {
  selection: { kind: 'room' | 'opening' | 'furniture'; id: string } | null;
  showDims: boolean;
  showAreas: boolean;
  showFurniture: boolean;
  showLabels: boolean;
  issues: Issue[];
  openFractions: Record<string, number>;
  overlay?: PlanOverlay | null;
  /** nivel que se dibuja; por defecto el primero */
  levelId?: string | null;
  forExport?: { title: string; subtitle: string };
  /** distancias libres entre muebles y muros (ver src/model/passages.ts) */
  showPassages?: boolean;
  /** dibuja el exterior (solera en L, comedor) en la planta baja; por defecto sí */
  showOutdoor?: boolean;
  /** recorte de la vista (m), p. ej. la planta acotada del baño */
  crop?: { x0: number; y0: number; x1: number; y1: number };
  /** cotas adicionales (a, b, desplazamiento, texto, estado) */
  extraDims?: { a: Vec2; b: Vec2; off: number; label: string; status: DataStatus }[];
}

const CUT_REL = 1.0; // plano de corte a 1,00 m sobre el suelo del nivel
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n4 = (x: number) => Math.round(x * 1e4) / 1e4;
const pts = (p: Vec2[]) => p.map(([x, y]) => `${n4(x)},${n4(y)}`).join(' ');

export function dim(a: Vec2, b: Vec2, off: number, label: string, status: DataStatus) {
  const st = STATUS_STYLE[status];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return '';
  const u: Vec2 = [dx / L, dy / L];
  const nrm: Vec2 = [-u[1], u[0]];
  const A: Vec2 = [a[0] + nrm[0] * off, a[1] + nrm[1] * off];
  const B: Vec2 = [b[0] + nrm[0] * off, b[1] + nrm[1] * off];
  const t = 0.08;
  const sg = Math.sign(off) || 1;
  const tick = (p: Vec2) => `<line x1="${n4(p[0] - (u[0] + nrm[0]) * t)}" y1="${n4(p[1] - (u[1] + nrm[1]) * t)}" x2="${n4(p[0] + (u[0] + nrm[0]) * t)}" y2="${n4(p[1] + (u[1] + nrm[1]) * t)}"/>`;
  const ext = (p: Vec2, P: Vec2) => `<line x1="${n4(p[0] + nrm[0] * sg * 0.06)}" y1="${n4(p[1] + nrm[1] * sg * 0.06)}" x2="${n4(P[0] + nrm[0] * sg * 0.08)}" y2="${n4(P[1] + nrm[1] * sg * 0.08)}" stroke-width="0.008"/>`;
  const mx = (A[0] + B[0]) / 2 + nrm[0] * sg * 0.14;
  const my = (A[1] + B[1]) / 2 + nrm[1] * sg * 0.14;
  let ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
  if (ang > 90 || ang < -90) ang += 180;
  return `<g class="dim" stroke="${st.color}" fill="${st.color}" stroke-width="0.012">${ext(a, A)}${ext(b, B)}<line x1="${n4(A[0])}" y1="${n4(A[1])}" x2="${n4(B[0])}" y2="${n4(B[1])}" ${st.dash ? `stroke-dasharray="${st.dash}"` : ''}/>${tick(A)}${tick(B)}<text x="${n4(mx)}" y="${n4(my)}" font-size="0.19" text-anchor="middle" dominant-baseline="middle" stroke="none" class="tnum" transform="rotate(${n4(ang)} ${n4(mx)} ${n4(my)})">${esc(label)}</text></g>`;
}

/** Exterior en planta: grava, solera en L con juntas, alcorque, canaletas, árbol, mesa y lámpara. */
function outdoorSvg(layout: Layout, od: NonNullable<Layout['outdoor']>, labels: boolean): string {
  const g: string[] = ['<g class="outdoor" pointer-events="none">'];
  const q = soleraQuantities(layout);
  for (const p of od.pavements) {
    const [x0, y0, x1, y1] = p.rect;
    if (p.joints === 0) {
      g.push(`<rect x="${n4(x0)}" y="${n4(y0)}" width="${n4(x1 - x0)}" height="${n4(y1 - y0)}" fill="#efe9de" stroke="none"/>`);
      continue;
    }
    g.push(`<rect x="${n4(x0)}" y="${n4(y0)}" width="${n4(x1 - x0)}" height="${n4(y1 - y0)}" fill="#e4e1da" stroke="#a8a59d" stroke-width="0.02" data-pavement="${esc(p.id)}"/>`);
  }
  // juntas (sobre la unión, una sola vez en la esquina)
  for (const p of od.pavements.filter((x) => x.joints > 0)) {
    const [x0, y0, x1, y1] = p.rect;
    for (let x = x0 + p.joints; x < x1 - 1e-6; x += p.joints) g.push(`<line x1="${n4(x)}" y1="${n4(y0)}" x2="${n4(x)}" y2="${n4(y1)}" stroke="#b9b5ab" stroke-width="0.012"/>`);
    for (let y = y0 + p.joints; y < y1 - 1e-6; y += p.joints) g.push(`<line x1="${n4(x0)}" y1="${n4(y)}" x2="${n4(x1)}" y2="${n4(y)}" stroke="#b9b5ab" stroke-width="0.012"/>`);
  }
  // jardín seco: acolchado de grava, matas por especie y paseos de losas
  if (od.garden) {
    const gd = od.garden;
    const [gx0, gy0, gx1, gy1] = gd.rect;
    g.push(`<rect x="${n4(gx0)}" y="${n4(gy0)}" width="${n4(gx1 - gx0)}" height="${n4(gy1 - gy0)}" fill="#eceee2" stroke="#b9bfa8" stroke-width="0.015" stroke-dasharray="0.1 0.06" data-garden="${esc(gd.id)}"/>`);
    const col = new Map(gd.species.map((s) => [s.id, s]));
    for (const pl of gardenPlants(gd)) {
      const sp = col.get(pl.s)!;
      g.push(`<circle cx="${n4(pl.x)}" cy="${n4(pl.y)}" r="${n4((sp.d / 2) * pl.k * 0.8)}" fill="${sp.color}" fill-opacity="0.55" stroke="#7d8a6a" stroke-width="0.006"/>`);
    }
    for (const p of gd.paths) for (const s of pathSlabs(p)) g.push(`<rect x="${n4(s.x - s.w / 2)}" y="${n4(s.y - s.d / 2)}" width="${n4(s.w)}" height="${n4(s.d)}" fill="#d9d6ce" stroke="#9c988d" stroke-width="0.012"/>`);
    if (labels) {
      g.push(`<text x="${n4(gx0 + 0.3)}" y="${n4(gy1 - 0.35)}" font-size="0.2" fill="#56663f">${esc(gd.label)} · sin riego una vez arraigado</text>`);
      gd.species.forEach((s, i) => g.push(`<circle cx="${n4(gx0 + 0.42 + i * 2.4)}" cy="${n4(gy1 - 0.08 + 0.3)}" r="0.09" fill="${s.color}" stroke="#7d8a6a" stroke-width="0.008"/><text x="${n4(gx0 + 0.58 + i * 2.4)}" y="${n4(gy1 + 0.26)}" font-size="0.13" fill="#56663f">${esc(s.label)}</text>`));
      for (const p of gd.paths) g.push(`<text x="${n4(p.x + p.width / 2 + 0.1)}" y="${n4((p.y0 + p.y1) / 2)}" font-size="0.11" fill="#687066" transform="rotate(-90 ${n4(p.x + p.width / 2 + 0.1)} ${n4((p.y0 + p.y1) / 2)})" text-anchor="middle">losas de cemento ${fmtM(p.width)} × ${fmtM(p.slab)}</text>`);
    }
  }
  // volúmenes anexos (cuarto técnico): muros, puerta exterior con su giro, medidas
  for (const an of od.annexes ?? []) {
    const [ax0, ay0, ax1, ay1] = an.rect;
    const t = an.wall;
    g.push(`<rect x="${n4(ax0)}" y="${n4(ay0)}" width="${n4(ax1 - ax0)}" height="${n4(ay1 - ay0)}" fill="#2f3430" data-annex="${esc(an.id)}"/>`);
    g.push(`<rect x="${n4(ax0 + t)}" y="${n4(ay0 + t)}" width="${n4(ax1 - ax0 - t)}" height="${n4(ay1 - ay0 - 2 * t)}" fill="#f4f2ec"/>`);
    const d = an.door;
    if (d.side === 'y1' || d.side === 'y0') {
      const yw = d.side === 'y1' ? ay1 - t : ay0;
      g.push(`<rect x="${n4(d.at - d.width / 2)}" y="${n4(yw)}" width="${n4(d.width)}" height="${n4(t)}" fill="#fefdfb"/>`);
      const yo = d.side === 'y1' ? ay1 : ay0;
      const sg = d.side === 'y1' ? 1 : -1;
      g.push(`<path d="M ${n4(d.at - d.width / 2)} ${n4(yo)} L ${n4(d.at - d.width / 2)} ${n4(yo + sg * d.width)} A ${n4(d.width)} ${n4(d.width)} 0 0 ${sg > 0 ? 0 : 1} ${n4(d.at + d.width / 2)} ${n4(yo)}" fill="none" stroke="#7d8277" stroke-width="0.012" stroke-dasharray="0.05 0.04"/>`);
    }
    for (const h of an.hatches ?? []) {
      const hs = h.size / 2;
      g.push(`<rect x="${n4(h.c[0] - hs)}" y="${n4(h.c[1] - hs)}" width="${n4(h.size)}" height="${n4(h.size)}" fill="#e3edf1" stroke="#2f5d6b" stroke-width="0.02" data-hatch="${esc(h.id)}"/>`);
      g.push(`<path d="M ${n4(h.c[0] - hs)} ${n4(h.c[1] - hs)} L ${n4(h.c[0] + hs)} ${n4(h.c[1] + hs)} M ${n4(h.c[0] + hs)} ${n4(h.c[1] - hs)} L ${n4(h.c[0] - hs)} ${n4(h.c[1] + hs)}" stroke="#2f5d6b" stroke-width="0.012"/>`);
      if (labels) {
        const ly = h.c[1] - hs - 0.2;
        g.push(`<text x="${n4(h.c[0])}" y="${n4(ly)}" font-size="0.1" text-anchor="middle" fill="#2f5d6b"><tspan x="${n4(h.c[0])}">registro aljibe</tspan><tspan x="${n4(h.c[0])}" dy="0.12">pluviales (fosa)</tspan></text>`);
      }
    }
    const cxA = (ax0 + t + ax1) / 2;
    const cyA = (ay0 + ay1) / 2;
    if (labels) {
      g.push(`<text x="${n4(cxA)}" y="${n4(cyA - 0.2)}" font-size="0.17" font-weight="600" text-anchor="middle" fill="#252923" transform="rotate(-90 ${n4(cxA)} ${n4(cyA - 0.2)})">${esc(an.label)}</text>`);
      g.push(`<text x="${n4(cxA + 0.28)}" y="${n4(cyA)}" font-size="0.12" text-anchor="middle" fill="#2f5d6b" class="tnum" transform="rotate(-90 ${n4(cxA + 0.28)} ${n4(cyA)})">${fmtM(ax1 - ax0 - t)} × ${fmtM(ay1 - ay0 - 2 * t)} m · h ${fmtM(an.height)} · acceso exterior</text>`);
    }
    if (an.terrace) {
      // cubierta transitable: línea del peto (discontinua: está por encima del corte) y rótulo
      const pt = 0.15;
      const e0 = ax0 - 0.1 + pt;
      const gp = an.terrace.gap;
      const peto = `M ${n4(ax1)} ${n4(ay0 - 0.08 + pt)} L ${n4(e0)} ${n4(ay0 - 0.08 + pt)} L ${n4(e0)} ${n4(gp ? gp[0] : ay1 + 0.08 - pt)}${gp ? ` M ${n4(e0)} ${n4(gp[1])}` : ''} L ${n4(e0)} ${n4(ay1 + 0.08 - pt)} L ${n4(ax1)} ${n4(ay1 + 0.08 - pt)}`;
      g.push(`<path d="${peto}" fill="none" stroke="#b5654a" stroke-width="0.02" stroke-dasharray="0.12 0.06"/>`);
      if (labels) g.push(`<text x="${n4(cxA - 0.3)}" y="${n4(cyA)}" font-size="0.12" text-anchor="middle" fill="#b5654a" transform="rotate(-90 ${n4(cxA - 0.3)} ${n4(cyA)})">cubierta: ${esc(an.terrace.label.toLowerCase())} · peto ${fmtM(an.terrace.parapet)} m</text>`);
    }
    g.push(dim([ax0, ay0], [ax1, ay0], -0.45, `${fmtM(ax1 - ax0)} m`, an.status));
  }
  // escalones volados en zigzag (en planta: las piezas que salen de la fachada)
  for (const ws of od.wallSteps ?? []) {
    for (let i = 0; i < ws.steps; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const along = ws.start + ws.dir * (i * ws.run + side * 0.13);
      const o0 = ws.face.at;
      const o1 = ws.face.at + ws.face.outward * ws.projection;
      const [rx0, rx1] = [Math.min(o0, o1), Math.max(o0, o1)];
      if (ws.face.axis === 'x') g.push(`<rect x="${n4(rx0)}" y="${n4(along - ws.width / 2)}" width="${n4(rx1 - rx0)}" height="${n4(ws.width)}" fill="#cbbd9e" stroke="#6d6048" stroke-width="0.01"/>`);
      else g.push(`<rect x="${n4(along - ws.width / 2)}" y="${n4(rx0)}" width="${n4(ws.width)}" height="${n4(rx1 - rx0)}" fill="#cbbd9e" stroke="#6d6048" stroke-width="0.01"/>`);
    }
    if (labels && ws.face.axis === 'x') {
      const lx = ws.face.at + ws.face.outward * (ws.projection + 0.2);
      const ly = ws.start + ws.dir * ws.steps * ws.run / 2;
      g.push(`<text x="${n4(lx)}" y="${n4(ly)}" font-size="0.12" fill="#6d6048" text-anchor="middle" transform="rotate(-90 ${n4(lx)} ${n4(ly)})">${esc(ws.label)} · sube a ${fmtM(ws.top)} m</text>`);
    }
  }
  for (const p of od.pavements.filter((x) => x.permeable)) {
    const { c, r } = p.permeable!;
    g.push(`<circle cx="${n4(c[0])}" cy="${n4(c[1])}" r="${n4(r)}" fill="#efe9de" stroke="#3a3833" stroke-width="0.02"/>`);
    if (labels) g.push(`<text x="${n4(c[0])}" y="${n4(c[1] + r + 0.22)}" font-size="0.13" fill="#687066" text-anchor="middle">alcorque permeable Ø ${fmtM(2 * r)}</text>`);
  }
  // depósitos enterrados: contorno oculto (discontinuo), boca de hombre y medidas
  for (const tk of od.tanks ?? []) {
    const [w, h] = tk.axis === 'y' ? [tk.diameter, tk.length] : [tk.length, tk.diameter];
    const x0 = tk.c[0] - w / 2;
    const y0 = tk.c[1] - h / 2;
    g.push(`<rect x="${n4(x0)}" y="${n4(y0)}" width="${n4(w)}" height="${n4(h)}" rx="${n4(Math.min(w, h) * 0.12)}" fill="#e3edf1" fill-opacity="0.6" stroke="#2f5d6b" stroke-width="0.025" stroke-dasharray="0.12 0.06" data-tank="${esc(tk.id)}"/>`);
    g.push(`<circle cx="${n4(tk.c[0])}" cy="${n4(tk.c[1])}" r="${n4(tk.manhole / 2)}" fill="#fefdfb" stroke="#2f5d6b" stroke-width="0.02"/>`);
    if (labels) {
      const lx = x0 - 0.25;
      g.push(`<text x="${n4(lx)}" y="${n4(tk.c[1])}" font-size="0.15" font-weight="600" text-anchor="middle" fill="#2f5d6b" transform="rotate(-90 ${n4(lx)} ${n4(tk.c[1])})">${esc(tk.label)}</text>`);
      g.push(`<text x="${n4(lx + 0.2)}" y="${n4(tk.c[1])}" font-size="0.11" text-anchor="middle" fill="#2f5d6b" class="tnum" transform="rotate(-90 ${n4(lx + 0.2)} ${n4(tk.c[1])})">${(tk.capacity / 1000).toLocaleString('es-ES')} m³ · Ø ${fmtM(tk.diameter)} × ${fmtM(tk.length)} m · boca ${Math.round(tk.manhole * 100)} cm</text>`);
    }
    g.push(dim([x0, y0], [x0 + w, y0], -0.35, `${fmtM(w)} m`, tk.status));
  }
  for (const d of od.drains ?? []) g.push(`<line x1="${n4(d.a[0])}" y1="${n4(d.a[1])}" x2="${n4(d.b[0])}" y2="${n4(d.b[1])}" stroke="#3a3833" stroke-width="0.08" stroke-dasharray="0.04 0.02"/>`);
  // zona de aparcamiento (grava) delante del frontal B
  for (const pv of (layout.site?.pavements ?? []).filter((x) => x.firme === 'grava')) {
    const [ax, ay, bx, by] = pv.rect;
    g.push(`<rect x="${n4(ax)}" y="${n4(ay)}" width="${n4(bx - ax)}" height="${n4(by - ay)}" fill="#e6dccb" stroke="#9c8d74" stroke-width="0.02" stroke-dasharray="0.15 0.08" data-site="${esc(pv.id)}"/>`);
    if (labels) g.push(`<text x="${n4((ax + bx) / 2)}" y="${n4((ay + by) / 2 + 0.07)}" font-size="0.2" fill="#6d5c42" text-anchor="middle">${esc(pv.label)}</text>`);
  }
  // camino de acceso a la entrada de la finca (trazado aproximado): sale del dibujo hacia la entrada
  const acc = layout.site?.acceso;
  if (acc) {
    const d = acc.camino.map((p, i) => `${i ? 'L' : 'M'} ${n4(p[0])} ${n4(p[1])}`).join(' ');
    g.push(`<path d="${d}" fill="none" stroke="#c9b79c" stroke-opacity="0.55" stroke-width="${n4(acc.anchoCamino)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    g.push(`<path d="${d}" fill="none" stroke="#8c7a5e" stroke-width="0.02" stroke-dasharray="0.3 0.15"/>`);
    if (labels) {
      const [a0, a1] = acc.camino;
      const ang = (Math.atan2(a1[1] - a0[1], a1[0] - a0[0]) * 180) / Math.PI;
      const mx = a0[0] + (a1[0] - a0[0]) * 0.45;
      const my = a0[1] + (a1[1] - a0[1]) * 0.45;
      const total = acc.camino.slice(1).reduce((s2, p, i) => s2 + Math.hypot(p[0] - acc.camino[i][0], p[1] - acc.camino[i][1]), 0);
      g.push(`<text x="${n4(mx)}" y="${n4(my - 0.1)}" font-size="0.2" fill="#6d5c42" text-anchor="middle" transform="rotate(${n4(ang)} ${n4(mx)} ${n4(my)})">camino a la entrada de la finca (≈${Math.round(total)} m; entrada de ${fmtM(acc.anchoEntrada)} m) · trazado aproximado →</text>`);
    }
  }
  // huella del edificio en el Catastro (antes de la reforma): referencia para comparar con el levantamiento
  const ec = layout.site?.edificioCatastro;
  if (ec) {
    g.push(`<polygon points="${ec.poligono.map((p) => `${n4(p[0])},${n4(p[1])}`).join(' ')}" fill="none" stroke="#3d6fa8" stroke-width="0.025" stroke-dasharray="0.18 0.07 0.03 0.07" pointer-events="none" data-catastro="edificio"/>`);
    if (labels) {
      const lx = ec.poligono.reduce((a2, p) => a2 + p[0], 0) / ec.poligono.length;
      const ly = Math.max(...ec.poligono.map((p) => p[1])) + 0.2;
      g.push(`<text x="${n4(lx)}" y="${n4(ly)}" font-size="0.11" fill="#3d6fa8" text-anchor="middle" pointer-events="none">huella catastral antes de la reforma · ${ec.area} m² construidos</text>`);
    }
  }
  for (const t of layout.site?.trees ?? []) {
    // copa: círculo recortado por los límites medidos (si los hay), con la línea del límite marcada
    const k = t.copa;
    const clip = k ? `tree-clip-${t.id}` : '';
    if (k) {
      const x0 = k.xMin ?? t.c[0] - t.r - 1, x1 = k.xMax ?? t.c[0] + t.r + 1, y0 = k.yMin ?? t.c[1] - t.r - 1, y1 = k.yMax ?? t.c[1] + t.r + 1;
      g.push(`<clipPath id="${clip}"><rect x="${n4(x0)}" y="${n4(y0)}" width="${n4(x1 - x0)}" height="${n4(y1 - y0)}"/></clipPath>`);
      for (const yy of [k.yMin, k.yMax]) if (yy != null && Math.abs(yy - t.c[1]) < t.r) {
        const hw = Math.sqrt(t.r * t.r - (yy - t.c[1]) ** 2);
        g.push(`<line x1="${n4(t.c[0] - hw)}" y1="${n4(yy)}" x2="${n4(t.c[0] + hw)}" y2="${n4(yy)}" stroke="#6f7f52" stroke-width="0.025" stroke-dasharray="0.15 0.08"/>`);
        if (labels) g.push(`<text x="${n4(t.c[0] + hw + 0.1)}" y="${n4(yy + 0.05)}" font-size="0.12" fill="#56663f">límite de copa medido</text>`);
      }
    }
    g.push(`<circle cx="${n4(t.c[0])}" cy="${n4(t.c[1])}" r="${n4(t.r)}" fill="none" stroke="#6f7f52" stroke-width="0.025" stroke-dasharray="0.15 0.08"${clip ? ` clip-path="url(#${clip})"` : ''}/><circle cx="${n4(t.c[0])}" cy="${n4(t.c[1])}" r="${t.kind === 'olivo' ? 0.2 : 0.3}" fill="#8a7a64" stroke="none"/>`);
    if (labels) g.push(`<text x="${n4(t.c[0])}" y="${n4(t.c[1] - 0.45)}" font-size="0.16" fill="#56663f" text-anchor="middle">${esc(t.label)} (${t.medido ? 'posición medida' : 'posición aproximada'})</text>`);
  }
  for (const f of od.furniture) {
    if (f.type === 'mesa-exterior') g.push(`<circle cx="${n4(f.x)}" cy="${n4(f.y)}" r="${n4(f.w / 2)}" fill="#f4f1ea" stroke="#9fa39a" stroke-width="0.015"/>`);
    else g.push(`<polygon points="${pts(furnitureFootprint(f))}" fill="#fefdfb" stroke="#9fa39a" stroke-width="0.012"/>`);
  }
  if (od.domeLamp) {
    const l = od.domeLamp;
    g.push(`<circle cx="${n4(l.c[0])}" cy="${n4(l.c[1])}" r="${n4(l.diameter / 2)}" fill="none" stroke="#3a3833" stroke-width="0.02" stroke-dasharray="0.06 0.04"/>`);
    g.push(`<circle cx="${n4(l.treeAnchor.c[0])}" cy="${n4(l.treeAnchor.c[1])}" r="0.07" fill="${AMBER}" stroke="none"/><circle cx="${n4(l.post[0])}" cy="${n4(l.post[1])}" r="0.06" fill="none" stroke="${AMBER}" stroke-width="0.02"/>`);
    if (labels) g.push(`<text x="${n4(l.c[0])}" y="${n4(l.c[1] + 1.8)}" font-size="0.13" fill="${AMBER}" text-anchor="middle">lámpara de cúpula · anclaje sin resolver</text>`);
  }
  // porche: proyección de la cubierta de cañizo (discontinua), pilares de obra y fondo acotado
  for (const pr of od.porches ?? []) {
    const [x0, , x1] = pr.rect;
    const wallY = pr.wallSide === 'y1' ? pr.rect[3] : pr.rect[1];
    const fy = pr.posts[0][1];
    const out = fy + Math.sign(fy - wallY) * 0.3;
    const ya = Math.min(out, wallY);
    g.push(`<rect x="${n4(x0)}" y="${n4(ya)}" width="${n4(x1 - x0)}" height="${n4(Math.abs(wallY - out))}" fill="none" stroke="#7a5a3a" stroke-width="0.02" stroke-dasharray="0.12 0.06" data-porch="${esc(pr.id)}"/>`);
    g.push(`<line x1="${n4(x0)}" y1="${n4(fy)}" x2="${n4(x1)}" y2="${n4(fy)}" stroke="#7a5a3a" stroke-width="0.015" stroke-dasharray="0.05 0.04"/>`);
    for (const [x, y] of pr.posts) g.push(`<rect x="${n4(x - pr.postSize / 2)}" y="${n4(y - pr.postSize / 2)}" width="${n4(pr.postSize)}" height="${n4(pr.postSize)}" fill="#3a3833" stroke="none"/>`);
    g.push(dim([x0, wallY], [x0, fy], -0.45, `${fmtM(Math.abs(wallY - fy))} m`, pr.status));
    if (labels) g.push(`<text x="${n4((x0 + x1) / 2)}" y="${n4((wallY + fy) / 2 + 0.05)}" font-size="0.2" fill="#5e4630" text-anchor="middle">${esc(pr.label)} · cañizo sobre viguetas de madera</text>`);
  }
  // cotas de los tramos de la solera y superficie (esquina contada una vez)
  const fa = od.pavements.find((p) => p.id === 'solera-l-frontal-a');
  const la = od.pavements.find((p) => p.id === 'solera-l-lateral');
  if (fa) g.push(dim([fa.rect[0], fa.rect[1]], [fa.rect[0], fa.rect[3]], 0.5, `${fmtM(fa.rect[3] - fa.rect[1])} m`, fa.status));
  if (la) g.push(dim([la.rect[0], la.rect[1]], [la.rect[2], la.rect[1]], -0.45, `${fmtM(la.rect[2] - la.rect[0])} m`, la.status));
  if (q && fa && labels) {
    const tx = fa.rect[0] + Math.min(3.3, (fa.rect[2] - fa.rect[0]) / 2);
    const ty = (fa.rect[1] + fa.rect[3]) / 2;
    g.push(`<text x="${n4(tx)}" y="${n4(ty - 0.1)}" font-size="0.2" fill="#3d433b" text-anchor="middle">Solera en L · ${fmtM(q.area)} m²</text><text x="${n4(tx)}" y="${n4(ty + 0.2)}" font-size="0.13" fill="#687066" text-anchor="middle">unión de tramos, esquina una vez, sin alcorque</text><text x="${n4(tx)}" y="${n4(ty + 0.42)}" font-size="0.13" fill="#687066" text-anchor="middle">pendiente 1,5–2 % hacia la canaleta (propuesta)</text>`);
  }
  g.push('</g>');
  return g.join('');
}

export function planSvg(layout: Layout, o: PlanOptions): string {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const L = maxX - minX;
  const W = maxY - minY;
  const margin = 1.8;
  const extraBottom = o.forExport ? 2.0 : 1.0;
  // nivel más bajo (planta baja, aunque el interior esté elevado sobre el terreno)
  const levelFirst = ((layout.levels.find((l) => l.id === o.levelId) ?? layout.levels[0])?.elevation ?? 0) <= Math.min(...layout.levels.map((l) => l.elevation)) + 0.01;
  const outdoor = o.showOutdoor !== false && levelFirst ? layout.outdoor : undefined;
  // en una planta alta: cubiertas transitables de los anexos a la altura del nivel (terraza del altell)
  const lvElev = (layout.levels.find((l) => l.id === o.levelId) ?? layout.levels[0])?.elevation ?? 0;
  const terraces = !levelFirst && o.showOutdoor !== false ? (layout.outdoor?.annexes ?? []).filter((a) => a.terrace && Math.abs(a.height - lvElev) < 0.6) : [];
  const tankRects = (outdoor?.tanks ?? []).map((tk) => {
    const [w, h] = tk.axis === 'y' ? [tk.diameter, tk.length] : [tk.length, tk.diameter];
    return { rect: [tk.c[0] - w / 2 - 0.5, tk.c[1] - h / 2, tk.c[0] + w / 2, tk.c[1] + h / 2] as [number, number, number, number] };
  });
  const solera = [...(outdoor?.pavements.filter((p) => p.joints > 0) ?? []), ...(outdoor?.garden ? [{ rect: outdoor.garden.rect }] : []), ...(outdoor?.annexes ?? []), ...tankRects, ...terraces];
  // extensión del dibujo: la casa y, si se muestra, la solera exterior
  const ex = {
    minX: Math.min(minX, ...solera.map((p) => p.rect[0])), minY: Math.min(minY, ...solera.map((p) => p.rect[1])),
    maxX: Math.max(maxX, ...solera.map((p) => p.rect[2])), maxY: Math.max(maxY, ...solera.map((p) => p.rect[3])),
  };
  const vb = o.crop
    ? { x: o.crop.x0, y: o.crop.y0, w: o.crop.x1 - o.crop.x0, h: o.crop.y1 - o.crop.y0 }
    : { x: ex.minX - margin, y: ex.minY - margin, w: ex.maxX - ex.minX + 2 * margin, h: ex.maxY - ex.minY + 2 * margin + extraBottom };
  const wallById = new Map(layout.walls.map((w) => [w.id, w]));
  const conflictIds = new Set(o.issues.filter((i) => i.level !== 'aviso').map((i) => i.elementId));
  const selRoom = o.selection?.kind === 'room' ? o.selection.id : null;
  const selOpening = o.selection?.kind === 'opening' ? o.selection.id : null;
  const level = layout.levels.find((l) => l.id === o.levelId) ?? layout.levels[0];
  const lvlElev = level?.elevation ?? 0;
  const CUT = lvlElev + CUT_REL;
  const elevOf = (id: string) => layout.levels.find((l) => l.id === id)?.elevation ?? 0;
  const rooms = layout.rooms.filter((r) => r.levelId === level?.id);
  const roomIds = new Set(rooms.map((r) => r.id));
  const furniture = layout.furniture.filter((f) => roomIds.has(f.roomId));
  const walls = layout.walls.filter((w) => {
    const b = elevOf(w.levelId);
    return b <= CUT && CUT < b + w.height;
  });
  const shownWall = new Set(walls.map((w) => w.id));
  const openings = layout.openings.filter((op) => {
    const w = wallById.get(op.wallId);
    if (!w || !shownWall.has(w.id)) return false;
    const rel = CUT - elevOf(w.levelId);
    return op.sill < rel + 0.8 && op.sill + op.height > rel;
  });
  const out: string[] = [];
  const size = o.forExport ? `width="${n4(vb.w * 20)}mm" height="${n4(vb.h * 20)}mm"` : 'width="100%" height="100%"';
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n4(vb.x)} ${n4(vb.y)} ${n4(vb.w)} ${n4(vb.h)}" ${size} font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" preserveAspectRatio="xMidYMid meet" data-units="m">`);
  out.push(`<title>${esc(o.forExport?.title ?? `${layout.name} · planta`)}${layout.levels.length > 1 ? ` · ${esc((layout.levels.find((l) => l.id === o.levelId) ?? layout.levels[0]).name)}` : ''}</title>`);
  out.push(`<style>.tnum{font-variant-numeric:tabular-nums}</style>`);
  out.push(`<defs><pattern id="hatch-prop" patternUnits="userSpaceOnUse" width="0.08" height="0.08" patternTransform="rotate(45)"><rect width="0.08" height="0.08" fill="#efe3c9"/><line x1="0" y1="0" x2="0" y2="0.08" stroke="${AMBER}" stroke-width="0.022"/></pattern></defs>`);
  out.push(`<rect x="${n4(vb.x)}" y="${n4(vb.y)}" width="${n4(vb.w)}" height="${n4(vb.h)}" fill="#fefdfb"/>`);

  if (outdoor) out.push(outdoorSvg(layout, outdoor, !!o.showLabels));
  for (const an of terraces) {
    const [ax0, ay0, ax1, ay1] = an.rect;
    const tr = an.terrace!;
    const pt = 0.15;
    const e0 = ax0 - 0.1;
    const f0 = ay0 - 0.08;
    const f1 = ay1 + 0.08;
    out.push(`<g data-terrace="${esc(an.id)}" pointer-events="none">`);
    out.push(`<rect x="${n4(e0)}" y="${n4(f0)}" width="${n4(ax1 - e0)}" height="${n4(f1 - f0)}" fill="#f1dccd" stroke="#b5654a" stroke-width="0.01"/>`);
    // retícula del pavimento de terracota (piezas de 0,30 m)
    for (let x = e0 + pt + 0.3; x < ax1 - 0.05; x += 0.3) out.push(`<line x1="${n4(x)}" y1="${n4(f0 + pt)}" x2="${n4(x)}" y2="${n4(f1 - pt)}" stroke="#d9b39c" stroke-width="0.006"/>`);
    for (let y = f0 + pt + 0.3; y < f1 - pt - 0.05; y += 0.3) out.push(`<line x1="${n4(e0 + pt)}" y1="${n4(y)}" x2="${n4(ax1)}" y2="${n4(y)}" stroke="#d9b39c" stroke-width="0.006"/>`);
    // peto encalado (cortado): tres lados, con el hueco de la llegada de los escalones
    const segs: [number, number, number, number][] = [[e0, f0, ax1, f0 + pt], [e0, f1 - pt, ax1, f1]];
    if (tr.gap) segs.push([e0, f0 + pt, e0 + pt, tr.gap[0]], [e0, tr.gap[1], e0 + pt, f1 - pt]);
    else segs.push([e0, f0 + pt, e0 + pt, f1 - pt]);
    for (const [a, b, c, d] of segs) out.push(`<rect x="${n4(a)}" y="${n4(b)}" width="${n4(c - a)}" height="${n4(d - b)}" fill="#2f3430"/>`);
    if (o.showLabels) {
      const cx = (e0 + ax1) / 2;
      const cy = (ay0 + ay1) / 2;
      out.push(`<text x="${n4(cx)}" y="${n4(cy)}" font-size="0.18" font-weight="600" text-anchor="middle" fill="#7a3f2c" transform="rotate(-90 ${n4(cx)} ${n4(cy)})">${esc(tr.label)}</text>`);
      out.push(`<text x="${n4(cx + 0.3)}" y="${n4(cy)}" font-size="0.12" text-anchor="middle" fill="#7a3f2c" class="tnum" transform="rotate(-90 ${n4(cx + 0.3)} ${n4(cy)})">+${fmtM(an.height + 0.03)} · ${fmtM(ax1 - e0 - pt)} × ${fmtM(f1 - f0 - 2 * pt)} m · peto ${fmtM(tr.parapet)} m · sobre el cuarto técnico</text>`);
      if (tr.gap) out.push(`<text x="${n4(e0 - 0.15)}" y="${n4((tr.gap[0] + tr.gap[1]) / 2)}" font-size="0.11" text-anchor="middle" fill="#687066" transform="rotate(-90 ${n4(e0 - 0.15)} ${n4((tr.gap[0] + tr.gap[1]) / 2)})">escalones</text>`);
    }
    out.push('</g>');
  }

  // Estancias
  out.push('<g class="rooms">');
  for (const r of rooms) {
    const sel = r.id === selRoom;
    out.push(`<polygon class="room${sel ? ' selected' : ''}" data-room="${esc(r.id)}" points="${pts(r.polygon)}" fill="${sel ? '#dfe7d8' : '#f6f4ef'}" stroke="${sel ? ACCENT : 'none'}" stroke-width="${sel ? 0.05 : 0}"/>`);
  }
  for (const r of rooms)
    for (const other of r.openTo ?? []) {
      if (other < r.id) continue;
      const b = rooms.find((x) => x.id === other);
      if (!b) continue;
      const A = bbox(r.polygon);
      const B = bbox(b.polygon);
      const touch = Math.abs(A.maxX - B.minX) < 1e-3 ? A.maxX : Math.abs(B.maxX - A.minX) < 1e-3 ? A.minX : null;
      if (touch !== null) out.push(`<line x1="${n4(touch)}" y1="${n4(Math.max(A.minY, B.minY))}" x2="${n4(touch)}" y2="${n4(Math.min(A.maxY, B.maxY))}" stroke="#b9bcb2" stroke-width="0.012" stroke-dasharray="0.12 0.08"/>`);
    }
  out.push('</g>');

  // Superposición de boceto (solo pantalla, nunca en exportaciones)
  if (o.overlay && !o.forExport) {
    const ov = o.overlay;
    out.push(`<image href="${esc(ov.href)}" x="${n4(ov.x)}" y="${n4(ov.y)}" width="${n4(ov.widthM)}" height="${n4(ov.heightM)}" opacity="${n4(ov.opacity)}" preserveAspectRatio="none" transform="rotate(${n4(ov.rotation)} ${n4(ov.x)} ${n4(ov.y)})" pointer-events="none"/>`);
  }

  // Mobiliario (trazo secundario)
  if (o.showFurniture) {
    out.push('<g class="furniture" stroke="#9fa39a" stroke-width="0.012" fill="#fefdfb">');
    const selFurniture = o.selection?.kind === 'furniture' ? o.selection.id : null;
    for (const f of furniture) {
      const fp = furnitureFootprint(f);
      const bad = conflictIds.has(f.id) ? ' stroke="#b3261e" stroke-width="0.03"' : f.id === selFurniture ? ` stroke="${ACCENT}" stroke-width="0.035"` : '';
      const hit = o.forExport ? '' : ` data-furniture="${esc(f.id)}" class="furniture-hit"`;
      const round = f.type === 'estufa' || f.type === 'taburete' || f.type === 'mesa-exterior' || f.type === 'maceta' || f.type === 'jarron';
      if (round) out.push(`<circle cx="${n4(f.x)}" cy="${n4(f.y)}" r="${n4(f.w / 2)}"${bad}${hit}/>`);
      else out.push(`<polygon points="${pts(fp)}"${f.type === 'alfombra' ? ' fill="none" stroke-dasharray="0.05 0.05" pointer-events="none"' : ''}${bad}${f.type === 'alfombra' ? '' : hit}/>`);
      if (f.type === 'cama') {
        const r = (f.rot * Math.PI) / 180;
        const back = (k: number): Vec2 => [Math.sin(r) * (f.d / 2 - k), -Math.cos(r) * (f.d / 2 - k)];
        const p = back(0.25);
        out.push(`<polygon points="${pts(furnitureFootprint({ ...f, x: f.x + p[0], y: f.y + p[1], d: 0.3, w: f.w - 0.2 }))}" fill="#f6f4ef"/>`);
        const q = back(0.65);
        const a = furnitureFootprint({ ...f, x: f.x + q[0], y: f.y + q[1], d: 0.001 });
        out.push(`<line x1="${n4(a[0][0])}" y1="${n4(a[0][1])}" x2="${n4(a[1][0])}" y2="${n4(a[1][1])}"/>`);
      }
      if (f.type === 'ducha') {
        out.push(`<line x1="${n4(fp[0][0])}" y1="${n4(fp[0][1])}" x2="${n4(fp[2][0])}" y2="${n4(fp[2][1])}" stroke-width="0.008" pointer-events="none"/><line x1="${n4(fp[1][0])}" y1="${n4(fp[1][1])}" x2="${n4(fp[3][0])}" y2="${n4(fp[3][1])}" stroke-width="0.008" pointer-events="none"/>`);
        // dos rociadores enfrentados (paredes ±x), celosía hacia la zona seca (−z) con acceso central de 0,90 m,
        // vidrio fijo por la cara húmeda y cortina en carril propio
        const r = (f.rot * Math.PI) / 180;
        const P = (lx: number, lz: number): Vec2 => [f.x + lx * Math.cos(r) - lz * Math.sin(r), f.y + lx * Math.sin(r) + lz * Math.cos(r)];
        const L = (a: Vec2, b: Vec2, attrs: string) => out.push(`<line x1="${n4(a[0])}" y1="${n4(a[1])}" x2="${n4(b[0])}" y2="${n4(b[1])}" ${attrs} pointer-events="none"/>`);
        const acc = 0.9;
        const zl = -f.d / 2 - 0.05;
        for (const k of [-1, 1]) {
          L(P(k * (acc / 2), zl), P(k * (f.w / 2), zl), 'stroke="#b5653f" stroke-width="0.09" stroke-dasharray="0.03 0.025"');
          L(P(k * (acc / 2), -f.d / 2 + 0.015), P(k * (f.w / 2), -f.d / 2 + 0.015), 'stroke="#8fb3b5" stroke-width="0.012"');
          const h = P(k * (f.w / 2 - 0.12), 0.05);
          out.push(`<circle cx="${n4(h[0])}" cy="${n4(h[1])}" r="0.09" fill="#e9dfcf" stroke="#9a7a45" stroke-width="0.012" pointer-events="none"/>`);
          L(P(k * (f.w / 2 - 0.24), 0.05), P(k * (f.w / 2 - 0.5), 0.05), 'stroke="#9a7a45" stroke-width="0.01" marker-end="none"');
          const m = P(k * (f.w / 2 - 0.03), -0.25);
          out.push(`<rect x="${n4(m[0] - 0.03)}" y="${n4(m[1] - 0.03)}" width="0.06" height="0.06" fill="#9a7a45" stroke="none" pointer-events="none"/>`);
        }
        L(P(-acc / 2, -f.d / 2 + 0.06), P(acc / 2, -f.d / 2 + 0.06), `stroke="${AMBER}" stroke-width="0.012" stroke-dasharray="0.04 0.03"`);
        L(P(-f.w / 2 + 0.3, f.d / 2 - 0.12), P(f.w / 2 - 0.3, f.d / 2 - 0.12), 'stroke="#9a7a45" stroke-width="0.02"');
        if (o.showLabels) {
          const lp = P(0, zl - 0.14);
          out.push(`<text x="${n4(lp[0])}" y="${n4(lp[1])}" font-size="0.1" fill="#687066" stroke="none" text-anchor="middle" pointer-events="none">acceso 0,90 · cortina</text>`);
          const lq = P(0, 0.12);
          out.push(`<text x="${n4(lq[0])}" y="${n4(lq[1])}" font-size="0.1" fill="#687066" stroke="none" text-anchor="middle" pointer-events="none">2 duchas enfrentadas</text>`);
        }
      }
      if (f.type === 'banera') {
        out.push(`<polygon points="${pts(furnitureFootprint({ ...f, w: f.w - 0.14, d: f.d - 0.14 }))}" fill="none" stroke-width="0.01"/>`);
      }
      if (f.type === 'isla') {
        out.push(`<polygon points="${pts(furnitureFootprint({ ...f, w: f.w - 0.08, d: f.d - 0.08 }))}" fill="none" stroke-width="0.008"/>`);
      }
      if (f.type === 'estufa') {
        out.push(`<circle cx="${n4(f.x)}" cy="${n4(f.y)}" r="${n4(f.w * 0.34)}" fill="#3a3833" stroke="none"/><circle cx="${n4(f.x)}" cy="${n4(f.y)}" r="0.075" fill="#bdbab3" stroke="none"/>`);
      }
      if (f.type === 'banco' || f.type === 'sofa-l') {
        // respaldo contra el muro (lado local -y)
        const r = (f.rot * Math.PI) / 180;
        const k = f.d / 2 - 0.12;
        const back: Vec2 = [Math.sin(r) * k, -Math.cos(r) * k];
        const a = furnitureFootprint({ ...f, x: f.x + back[0], y: f.y + back[1], d: 0.001 });
        out.push(`<line x1="${n4(a[0][0])}" y1="${n4(a[0][1])}" x2="${n4(a[1][0])}" y2="${n4(a[1][1])}" stroke-width="0.01"/>`);
      }
      if (f.type === 'inodoro' || f.type === 'lavabo') {
        const [cx, cy] = centroid(fp);
        out.push(`<circle cx="${n4(cx)}" cy="${n4(cy)}" r="${n4(Math.min(f.w, f.d) * 0.32)}" fill="none"/>`);
      }
    }
    out.push('</g>');
    // medidas de cada mueble (ancho × fondo) con las cotas activadas
    if (o.showDims) {
      out.push('<g class="furniture-dims" pointer-events="none">');
      for (const f of furniture) {
        if (f.type === 'alfombra' || f.type === 'ducha' || f.type === 'jarron' || f.type === 'aplique' || Math.max(f.w, f.d) < 0.35) continue;
        const [cx, cy] = centroid(furnitureFootprint(f));
        const fs = Math.min(0.1, Math.max(0.06, Math.min(f.w, f.d) * 0.16));
        const label = f.type === 'mesa-redonda' || f.type === 'mesa-exterior' || f.type === 'estufa' ? `Ø ${fmtM(f.w)}` : `${fmtM(f.w)} × ${fmtM(f.d)}`;
        out.push(`<text x="${n4(cx)}" y="${n4(cy + fs * 0.35)}" font-size="${n4(fs)}" text-anchor="middle" fill="#2f5d6b" class="tnum" paint-order="stroke" stroke="#fefdfb" stroke-width="${n4(fs * 0.35)}">${label}</text>`);
      }
      out.push('</g>');
    }
  }

  // Espacios de paso entre muebles y muros (también con las cotas activadas)
  if ((o.showPassages || o.showDims) && o.showFurniture) {
    const col = { ok: '#3f7a4a', justo: AMBER, estrecho: '#b3261e' } as const;
    out.push('<g class="passages" pointer-events="none">');
    for (const p of passages(layout).filter((x) => x.levelId === level?.id)) {
      const c = col[p.level];
      const mx = (p.a[0] + p.b[0]) / 2;
      const my = (p.a[1] + p.b[1]) / 2;
      const vertical = Math.abs(p.a[0] - p.b[0]) < 1e-6;
      out.push(`<g data-passage="${p.level}"><line x1="${n4(p.a[0])}" y1="${n4(p.a[1])}" x2="${n4(p.b[0])}" y2="${n4(p.b[1])}" stroke="${c}" stroke-width="0.02"/>`
        + `<text x="${n4(mx + (vertical ? 0.06 : 0))}" y="${n4(my - (vertical ? 0 : 0.06))}" font-size="0.12" fill="${c}" paint-order="stroke" stroke="#fefdfb" stroke-width="0.04" ${vertical ? '' : 'text-anchor="middle"'}>${fmtM(p.width)}</text></g>`);
    }
    out.push('</g>');
  }

  // Muros cortados a 1,00 m: exteriores con trazo grueso, tabiques propuestos con rayado
  out.push('<g class="walls">');
  for (const w of walls) {
    const all = wallPieces(w, layout.openings);
    const cutRel = CUT - elevOf(w.levelId);
    const relBottom = lvlElev - elevOf(w.levelId);
    const fill = w.kind === 'exterior' ? '#2f3430' : w.status === 'propuesto' ? 'url(#hatch-prop)' : '#5d625b';
    const stroke = w.kind === 'exterior' ? '#2f3430' : w.status === 'propuesto' ? AMBER : '#5d625b';
    for (const p of all.filter((p) => p.z0 <= cutRel && p.z1 > cutRel))
      out.push(`<polygon data-wall="${esc(w.id)}" points="${pts(wallSegmentRect(w, p.s0, p.s1))}" fill="${fill}" stroke="${stroke}" stroke-width="${w.kind === 'exterior' ? 0.012 : 0.008}"/>`);
    for (const p of all.filter((p) => p.z1 <= cutRel && p.z1 > relBottom + 1e-6 && p.z0 <= relBottom + 1e-6))
      out.push(`<polygon points="${pts(wallSegmentRect(w, p.s0, p.s1))}" fill="#dedfd7" stroke="#2f3430" stroke-width="0.008"/>`);
  }
  out.push('</g>');

  // Huecos
  // Escaleras: tramo completo en el nivel de arranque; hueco en el de llegada
  out.push('<g class="stairs" pointer-events="none">');
  for (const st of layout.stairs) {
    const [ax, ay, bx, by] = st.rect;
    const box: Vec2[] = [[ax, ay], [bx, ay], [bx, by], [ax, by]];
    const stc = STATUS_STYLE[st.status];
    if (st.fromLevel === level?.id) {
      out.push(`<polygon points="${pts(box)}" fill="#fefdfb" stroke="#2f3430" stroke-width="0.014"/>`);
      const alongX = st.up === '+x' || st.up === '-x';
      const nSteps = st.topFlush ? st.risers - 1 : st.risers;
      for (let i = 1; i < nSteps; i++) {
        const t = i / nSteps;
        out.push(alongX
          ? `<line x1="${n4(ax + (bx - ax) * t)}" y1="${n4(ay)}" x2="${n4(ax + (bx - ax) * t)}" y2="${n4(by)}" stroke="#7d8277" stroke-width="0.008"/>`
          : `<line x1="${n4(ax)}" y1="${n4(ay + (by - ay) * t)}" x2="${n4(bx)}" y2="${n4(ay + (by - ay) * t)}" stroke="#7d8277" stroke-width="0.008"/>`);
      }
      const cx = (ax + bx) / 2;
      const cy = (ay + by) / 2;
      const dir: Vec2 = st.up === '+x' ? [1, 0] : st.up === '-x' ? [-1, 0] : st.up === '+y' ? [0, 1] : [0, -1];
      const half = (alongX ? bx - ax : by - ay) * 0.38;
      const a: Vec2 = [cx - dir[0] * half, cy - dir[1] * half];
      const b: Vec2 = [cx + dir[0] * half, cy + dir[1] * half];
      out.push(`<line x1="${n4(a[0])}" y1="${n4(a[1])}" x2="${n4(b[0])}" y2="${n4(b[1])}" stroke="${stc.color}" stroke-width="0.02"/><circle cx="${n4(a[0])}" cy="${n4(a[1])}" r="0.05" fill="${stc.color}"/><path d="M ${n4(b[0] - dir[0] * 0.18 - dir[1] * 0.1)} ${n4(b[1] - dir[1] * 0.18 + dir[0] * 0.1)} L ${n4(b[0])} ${n4(b[1])} L ${n4(b[0] - dir[0] * 0.18 + dir[1] * 0.1)} ${n4(b[1] - dir[1] * 0.18 - dir[0] * 0.1)}" fill="none" stroke="${stc.color}" stroke-width="0.02"/>`);
      if (st.winderEnd) {
        // tramo final con peldaños compensados (triángulo del boceto)
        const wl = st.winderEnd;
        const seg = st.up === '+y' ? `<line x1="${n4(ax)}" y1="${n4(by - wl)}" x2="${n4(bx)}" y2="${n4(by)}"/>`
          : st.up === '-y' ? `<line x1="${n4(ax)}" y1="${n4(ay + wl)}" x2="${n4(bx)}" y2="${n4(ay)}"/>`
          : st.up === '+x' ? `<line x1="${n4(bx - wl)}" y1="${n4(ay)}" x2="${n4(bx)}" y2="${n4(by)}"/>`
          : `<line x1="${n4(ax + wl)}" y1="${n4(ay)}" x2="${n4(ax)}" y2="${n4(by)}"/>`;
        out.push(`<g stroke="#2f3430" stroke-width="0.012">${seg}</g>`);
      }
      const confirmed = ['documentado', 'confirmado'].includes(st.upStatus ?? st.status);
      const sube = `sube${confirmed ? '' : (st.upStatus ?? st.status) === 'propuesto' ? ' (propuesta)' : ' (sentido pendiente)'}`;
      out.push(alongX ? `<text x="${n4(cx)}" y="${n4(cy - 0.12)}" font-size="0.15" fill="${stc.color}" text-anchor="middle">${sube}</text>` : `<text x="${n4(cx + 0.14)}" y="${n4(cy)}" font-size="0.15" fill="${stc.color}" transform="rotate(${st.up === '+y' ? 90 : -90} ${n4(cx + 0.14)} ${n4(cy)})" text-anchor="middle">${sube}</text>`);
    } else if (st.toLevel === level?.id) {
      out.push(`<polygon points="${pts(box)}" fill="#ecebe5" stroke="#7d8277" stroke-width="0.012" stroke-dasharray="0.1 0.06"/><line x1="${n4(ax)}" y1="${n4(ay)}" x2="${n4(bx)}" y2="${n4(by)}" stroke="#9fa39a" stroke-width="0.008"/><text x="${n4((ax + bx) / 2)}" y="${n4((ay + by) / 2)}" font-size="0.15" fill="#687066" text-anchor="middle" dominant-baseline="middle"${bx - ax < by - ay ? ` transform="rotate(-90 ${n4((ax + bx) / 2)} ${n4((ay + by) / 2)})"` : ''}>escalera · llega al altell</text>`);
    }
  }
  out.push('</g>');
  // muebles bajo la escalera: contorno discontinuo por encima del dibujo de los peldaños
  if (o.showFurniture) for (const f of furniture.filter((x) => x.underStair)) {
    const fp = furnitureFootprint(f);
    out.push(`<polygon points="${pts(fp)}" fill="#fefdfb" fill-opacity="0.7" stroke="#2f3430" stroke-width="0.014" stroke-dasharray="0.08 0.05" pointer-events="none"/>`);
    if (o.showLabels) {
      const c = fp.reduce<Vec2>((m, p) => [m[0] + p[0] / fp.length, m[1] + p[1] / fp.length], [0, 0]);
      out.push(`<text x="${n4(c[0])}" y="${n4(c[1])}" font-size="0.12" fill="#3d433b" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${n4(c[0])} ${n4(c[1])})" pointer-events="none">cocina bajo la escalera</text>`);
    }
  }

  // Barandillas del nivel: doble línea continua
  for (const r of (layout.railings ?? []).filter((x) => x.levelId === level?.id)) {
    const edge = r.material === 'vidrio' ? '#6f8a94' : '#3d4239';
    out.push(`<g data-railing="${esc(r.id)}" pointer-events="none"><polyline points="${pts(r.points)}" fill="none" stroke="${edge}" stroke-width="0.05"/><polyline points="${pts(r.points)}" fill="none" stroke="${r.material === 'vidrio' ? '#dce8ec' : '#fefdfb'}" stroke-width="0.02"/></g>`);
    // las barandillas de escalera (con pendiente) no se rotulan: se superpondrían al dibujo de los peldaños
    if (o.showLabels && !r.rise && r.points.length === 2 && Math.hypot(r.points[1][0] - r.points[0][0], r.points[1][1] - r.points[0][1]) >= 2.4) {
      const [[ax, ay], [bx, by]] = r.points;
      const vertical = Math.abs(bx - ax) < 1e-6;
      const lx = (ax + bx) / 2 + (vertical ? 0.18 : 0);
      const ly = (ay + by) / 2 + (vertical ? 0 : 0.18);
      out.push(`<text x="${n4(lx)}" y="${n4(ly)}" font-size="0.15" fill="#687066" text-anchor="middle" dominant-baseline="middle"${vertical ? ` transform="rotate(-90 ${n4(lx)} ${n4(ly)})"` : ''}>${esc(r.label)}${r.material === 'vidrio' ? ' de cristal' : ''} · h ${fmtM(r.height)} m</text>`);
    }
  }

  // Trazos del boceto sin interpretar
  out.push('<g class="traces" pointer-events="none">');
  for (const t of layout.traces.filter((x) => x.levelId === level?.id)) {
    if (t.cross) {
      const [cx, cy] = t.cross;
      const k = 0.1;
      out.push(`<g stroke="${AMBER}" stroke-width="0.025" data-trace="${esc(t.id)}"><line x1="${n4(cx - k)}" y1="${n4(cy - k)}" x2="${n4(cx + k)}" y2="${n4(cy + k)}"/><line x1="${n4(cx - k)}" y1="${n4(cy + k)}" x2="${n4(cx + k)}" y2="${n4(cy - k)}"/></g>`);
      continue;
    }
    if (t.circle) out.push(`<circle cx="${n4(t.circle.c[0])}" cy="${n4(t.circle.c[1])}" r="${n4(t.circle.r)}" fill="none" stroke="${AMBER}" stroke-width="0.025" stroke-dasharray="0.1 0.06"/>`);
    if (t.points && t.points.length > 1) out.push(`<${t.closed ? 'polygon' : 'polyline'} points="${pts(t.points)}" fill="none" stroke="${t.kind === 'nota' ? '#9fa39a' : AMBER}" stroke-width="0.025" stroke-dasharray="0.1 0.06"/>`);
    const nota = t.kind === 'nota';
    const pts2 = t.points ?? [];
    // trazos cortos: rótulo a un lado para no tapar los nombres de las estancias
    const short = !t.circle && pts2.length === 2 && Math.hypot(pts2[1][0] - pts2[0][0], pts2[1][1] - pts2[0][1]) < 1.2;
    const vertical2 = pts2.length === 2 && Math.abs(pts2[1][0] - pts2[0][0]) < 1e-6;
    const anchor: Vec2 = t.circle ? [t.circle.c[0], t.circle.c[1] + t.circle.r + 0.22]
      : short ? [Math.min(pts2[0][0], pts2[1][0]) - 0.12, (pts2[0][1] + pts2[1][1]) / 2 + 0.05]
      : pts2.length === 2 ? [(pts2[0][0] + pts2[1][0]) / 2 - (vertical2 ? 0.18 : 0), (pts2[0][1] + pts2[1][1]) / 2]
      : pts2[Math.floor((pts2.length - 1) / 2)];
    const rot = vertical2 && !short ? ` transform="rotate(-90 ${n4(anchor[0])} ${n4(anchor[1])})"` : '';
    const text = nota ? esc(t.label) : `? ${esc(t.label)}${short ? '' : ' · sin interpretar'}`;
    const size = pts2.length === 1 ? 0.22 : 0.15;
    if (o.showLabels || pts2.length === 1) out.push(`<text x="${n4(anchor[0])}" y="${n4(anchor[1])}" font-size="${size}" fill="${nota ? '#687066' : AMBER}" text-anchor="${short ? 'end' : 'middle'}" dominant-baseline="middle" paint-order="stroke" stroke="#fefdfb" stroke-width="0.05"${rot}>${text}</text>`);
  }
  out.push('</g>');

  out.push('<g class="openings">');
  for (const op of openings) {
    const w = wallById.get(op.wallId);
    if (!w) continue;
    const sel = op.id === selOpening;
    const h = w.thickness / 2;
    const hit = wallSegmentRect(w, op.offset, op.offset + op.width).map(([x, y], i) => {
      const n = wallNormal(w);
      const k = i < 2 ? -0.15 : 0.15;
      return [x + n[0] * k, y + n[1] * k] as Vec2;
    });
    out.push(`<polygon class="opening-hit" data-opening="${esc(op.id)}" points="${pts(hit)}" fill="${sel ? 'rgba(104,118,94,0.22)' : 'transparent'}" stroke="${sel ? ACCENT : 'none'}" stroke-width="0.03"/>`);
    const g: string[] = [];
    if (op.kind === 'paso') {
      // hueco de paso sin puerta: solo las jambas
      for (const s of [op.offset, op.offset + op.width]) {
        const a = pointOnWall(w, s, -h);
        const b = pointOnWall(w, s, h);
        g.push(`<line x1="${n4(a[0])}" y1="${n4(a[1])}" x2="${n4(b[0])}" y2="${n4(b[1])}" stroke-width="0.012"/>`);
      }
    } else if (op.kind === 'puerta') {
      const sw = doorSwing(op, w);
      if (!sw) {
        // giro no definido: hoja(s) cerrada(s) en el plano del muro
        const a = pointOnWall(w, op.offset);
        const b = pointOnWall(w, op.offset + op.width);
        g.push(`<line x1="${n4(a[0])}" y1="${n4(a[1])}" x2="${n4(b[0])}" y2="${n4(b[1])}" stroke-width="0.03"/>`);
        if ((op.system?.leaves ?? 1) === 2) {
          const m = pointOnWall(w, op.offset + op.width / 2, -h);
          const m2 = pointOnWall(w, op.offset + op.width / 2, h);
          g.push(`<line x1="${n4(m[0])}" y1="${n4(m[1])}" x2="${n4(m2[0])}" y2="${n4(m2[1])}" stroke-width="0.01"/>`);
        }
      }
      if (sw) {
        const cross = (sw.openEnd[0] - sw.hinge[0]) * (sw.closedEnd[1] - sw.hinge[1]) - (sw.openEnd[1] - sw.hinge[1]) * (sw.closedEnd[0] - sw.hinge[0]);
        g.push(`<line x1="${n4(sw.hinge[0])}" y1="${n4(sw.hinge[1])}" x2="${n4(sw.openEnd[0])}" y2="${n4(sw.openEnd[1])}" stroke-width="0.03"/>`);
        g.push(`<path d="M ${n4(sw.openEnd[0])} ${n4(sw.openEnd[1])} A ${n4(sw.radius)} ${n4(sw.radius)} 0 0 ${cross > 0 ? 1 : 0} ${n4(sw.closedEnd[0])} ${n4(sw.closedEnd[1])}" fill="none" stroke-dasharray="0.04 0.03" stroke-width="0.01"/>`);
      }
    } else {
      for (const k of [-0.2, 0.2]) {
        const a = pointOnWall(w, op.offset, h * k * 2);
        const b = pointOnWall(w, op.offset + op.width, h * k * 2);
        g.push(`<line x1="${n4(a[0])}" y1="${n4(a[1])}" x2="${n4(b[0])}" y2="${n4(b[1])}"/>`);
      }
      for (const s of [op.offset, op.offset + op.width]) {
        const a = pointOnWall(w, s, -h);
        const b = pointOnWall(w, s, h);
        g.push(`<line x1="${n4(a[0])}" y1="${n4(a[1])}" x2="${n4(b[0])}" y2="${n4(b[1])}"/>`);
      }
      if (op.system && op.system.type !== 'abatible') {
        const pose = leafPose(op.system.type, op.system.leaves, op.width, o.openFractions[op.id] ?? 0);
        const d = wallDir(w);
        const nn = wallNormal(w);
        for (const lf of pose.leaves) {
          const a = (lf.angle * Math.PI) / 180;
          const u: Vec2 = [d[0] * Math.cos(a) + nn[0] * Math.sin(a), d[1] * Math.cos(a) + nn[1] * Math.sin(a)];
          const s = pointOnWall(w, op.offset + FRAME + lf.s, lf.depth);
          g.push(`<line x1="${n4(s[0])}" y1="${n4(s[1])}" x2="${n4(s[0] + u[0] * lf.width)}" y2="${n4(s[1] + u[1] * lf.width)}" stroke="${op.status === 'propuesto' ? AMBER : '#2f3430'}" stroke-width="0.03" stroke-linecap="round"/>`);
        }
      }
    }
    out.push(`<g stroke="#2f3430" stroke-width="0.012" pointer-events="none">${g.join('')}</g>`);
    if (conflictIds.has(op.id)) {
      // marco discontinuo alrededor del hueco en conflicto (forma + texto, no solo color)
      const r = wallSegmentRect(w, op.offset - 0.15, op.offset + op.width + 0.15).map(([x, y], i) => {
        const n = wallNormal(w);
        const k = i < 2 ? -0.25 : 0.25;
        return [x + n[0] * k, y + n[1] * k] as Vec2;
      });
      const m = pointOnWall(w, op.offset + op.width / 2);
      const c: Vec2 = [(minX + maxX) / 2, (minY + maxY) / 2];
      const n = wallNormal(w);
      const out1 = (c[0] - m[0]) * n[0] + (c[1] - m[1]) * n[1] > 0 ? -1 : 1;
      const t = pointOnWall(w, op.offset + op.width / 2, out1 * (w.thickness / 2 + 0.42));
      out.push(`<polygon points="${pts(r)}" fill="none" stroke="#b3261e" stroke-width="0.035" stroke-dasharray="0.12 0.07" pointer-events="none"/><text x="${n4(t[0])}" y="${n4(t[1])}" font-size="0.18" text-anchor="middle" dominant-baseline="middle" fill="#b3261e" paint-order="stroke" stroke="#fefdfb" stroke-width="0.05">⚠ conflicto: ${esc(op.label.toLowerCase())}</text>`);
    }
  }
  out.push('</g>');

  // Rótulos
  if (o.showLabels || o.showAreas) {
    out.push('<g class="room-labels" pointer-events="none">');
    for (const r of rooms) {
      const b = bbox(r.polygon);
      const [cx, cy] = centroid(r.polygon);
      const small = Math.min(b.maxX - b.minX, b.maxY - b.minY) < 1.8;
      const fs = small ? 0.17 : 0.23;
      let y = cy - (o.showAreas ? fs * 0.4 : 0);
      if (o.showLabels) {
        out.push(`<text x="${n4(cx)}" y="${n4(y)}" font-size="${fs}" font-weight="600" text-anchor="middle" fill="#252923" paint-order="stroke" stroke="#f6f4ef" stroke-width="0.06">${esc(r.name)}</text>`);
        y += fs * 1.05;
      }
      if (o.showAreas) {
        const area = polygonArea(r.polygon);
        out.push(`<text x="${n4(cx)}" y="${n4(y)}" font-size="${fs * 0.72}" text-anchor="middle" fill="#687066" class="tnum" paint-order="stroke" stroke="#f6f4ef" stroke-width="0.05">${area > 0 ? `${fmtM(area, 1)} m² calculados` : 'superficie pendiente'}</text>`);
        if (r.documentedArea) out.push(`<text x="${n4(cx)}" y="${n4(y + fs * 0.85)}" font-size="${fs * 0.62}" text-anchor="middle" fill="#33403a" class="tnum">${fmtM(r.documentedArea.value, r.documentedArea.decimals)} m² en la fuente</text>`);
      }
    }
    out.push('</g>');
  }

  // Cotas: totales + estancia u hueco seleccionado (sin amontonarse)
  if (o.showDims) {
    const m = (id: string) => layout.measures.find((x) => x.id === id)?.status ?? 'interpretado';
    out.push('<g class="dims">');
    out.push(outdoor ? dim([minX, minY], [maxX, minY], -1.2 - (minY - ex.minY), `${fmtM(L)} m`, m('largo')) : dim([minX, maxY], [maxX, maxY], 1.0, `${fmtM(L)} m`, m('largo')));
    // si hay un anexo pegado al lateral izquierdo, las cotas verticales se apartan por fuera de él
    const leftExtra = Math.max(0, ...[...(outdoor?.annexes ?? []), ...terraces].filter((x) => x.rect[2] <= minX + 0.01).map((x) => minX - x.rect[0]));
    out.push(dim([minX, minY], [minX, maxY], 0.8 + leftExtra, `${fmtM(W)} m`, m('ancho')));
    // cadenas de cotas por fachada: esquinas exteriores y bordes de cada hueco de este nivel
    const lvlTop = lvlElev + (level?.wallHeight ?? 2.5) + 0.3;
    const center: Vec2 = [(minX + maxX) / 2, (minY + maxY) / 2];
    for (const w of walls.filter((x) => x.kind === 'exterior')) {
      const base = elevOf(w.levelId);
      const ops = layout.openings.filter((x) => x.wallId === w.id && x.kind !== 'paso' && base + x.sill >= lvlElev - 1e-6 && base + x.sill < lvlTop);
      const wm = pointOnWall(w, wallLength(w) / 2);
      const n = wallNormal(w);
      const outward = (center[0] - wm[0]) * n[0] + (center[1] - wm[1]) * n[1] > 0 ? -1 : 1;
      const [e0, e1] = w.ext ?? [0, 0];
      const ss = [...new Set([-e0, wallLength(w) + e1, ...ops.flatMap((x) => [x.offset, x.offset + x.width])].map((v) => Math.round(v * 1000) / 1000))].sort((p, q) => p - q);
      const dd = wallDir(w);
      const sign = ((-dd[1]) * n[0] + dd[0] * n[1]) * outward > 0 ? 1 : -1;
      const fo = (outward * w.thickness) / 2;
      if (ops.length) for (let i = 0; i < ss.length - 1; i++) {
        const a = pointOnWall(w, ss[i], fo);
        const b = pointOnWall(w, ss[i + 1], fo);
        const isOp = ops.some((x) => Math.abs(x.offset - ss[i]) < 1e-3 && Math.abs(x.offset + x.width - ss[i + 1]) < 1e-3);
        out.push(dim(a, b, sign * 0.5, fmtM(ss[i + 1] - ss[i]), isOp ? 'documentado' : 'interpretado'));
      }
      // alto y antepecho de cada hueco, por la cara interior
      for (const x of ops) {
        const c = pointOnWall(w, x.offset + x.width / 2, -outward * (w.thickness / 2 + 0.16));
        out.push(`<text x="${n4(c[0])}" y="${n4(c[1])}" font-size="0.11" text-anchor="middle" dominant-baseline="middle" fill="#55605a" class="tnum" paint-order="stroke" stroke="#fefdfb" stroke-width="0.04">h ${fmtM(x.height)}${x.sill - (lvlElev - elevOf(w.levelId)) > 0.01 ? ` · ant. ${fmtM(x.sill - (lvlElev - elevOf(w.levelId)))}` : ''}</text>`);
      }
    }
    // espesores de los muros y fondo interior (lateral izquierdo)
    {
      const tA = Math.min(...walls.filter((x) => x.kind === 'exterior' && Math.abs(x.a[1] - x.b[1]) < 1e-6 && x.a[1] < (minY + maxY) / 2).map((x) => x.thickness), 0.3);
      const tB = Math.max(...walls.filter((x) => x.kind === 'exterior' && Math.abs(x.a[1] - x.b[1]) < 1e-6 && x.a[1] > (minY + maxY) / 2).map((x) => x.thickness), 0.3);
      const ys = [minY, minY + tA, maxY - tB, maxY];
      for (let i = 0; i < 3; i++) out.push(dim([minX, ys[i]], [minX, ys[i + 1]], 1.45 + leftExtra, fmtM(ys[i + 1] - ys[i]), 'documentado'));
    }
    // medidas interiores de cada estancia (ancho × fondo por las caras de los muros)
    for (const r of rooms) {
      const b = bbox(r.polygon);
      const [cx, cy] = centroid(r.polygon);
      const small = Math.min(b.maxX - b.minX, b.maxY - b.minY) < 1.8;
      const fs = small ? 0.12 : 0.15;
      const yy = cy + (small ? 0.3 : 0.48);
      out.push(`<text x="${n4(cx)}" y="${n4(yy)}" font-size="${fs}" text-anchor="middle" fill="#2f5d6b" class="tnum" paint-order="stroke" stroke="#fefdfb" stroke-width="0.05">${fmtM(b.maxX - b.minX)} × ${fmtM(b.maxY - b.minY)} m</text>`);
    }
    // escalera: ancho y largo en planta
    for (const st of layout.stairs.filter((x) => x.fromLevel === level?.id)) {
      const [ax, ay, bx, by] = st.rect;
      out.push(dim([ax, ay], [bx, ay], 0.22, fmtM(bx - ax), st.status));
      out.push(dim([bx, ay], [bx, by], 0.22, fmtM(by - ay), st.status));
    }
    const rs = rooms.find((r) => r.id === selRoom);
    if (rs) {
      const b = bbox(rs.polygon);
      out.push(dim([b.maxX, minY], [b.minX, minY], 0.55, `${fmtM(b.maxX - b.minX)} m`, rs.status));
      out.push(dim([maxX, b.minY], [maxX, b.maxY], -0.55, `${fmtM(b.maxY - b.minY)} m`, rs.status));
    }
    const os = openings.find((x) => x.id === selOpening);
    const ws = os && wallById.get(os.wallId);
    if (os && ws) {
      const c: Vec2 = [(minX + maxX) / 2, (minY + maxY) / 2];
      const mid = pointOnWall(ws, os.offset + os.width / 2);
      const n = wallNormal(ws);
      const outward = (c[0] - mid[0]) * n[0] + (c[1] - mid[1]) * n[1] > 0 ? -1 : 1;
      const a = pointOnWall(ws, os.offset, (outward * ws.thickness) / 2);
      const b = pointOnWall(ws, os.offset + os.width, (outward * ws.thickness) / 2);
      const off = 0.45;
      // el desplazamiento se aplica según la normal del segmento a→b
      const dd = wallDir(ws);
      const segN: Vec2 = [-dd[1], dd[0]];
      const sign = (segN[0] * n[0] + segN[1] * n[1]) * outward > 0 ? 1 : -1;
      out.push(dim(a, b, sign * off, `${fmtM(os.width)} m`, os.status));
    }
    out.push('</g>');
  }

  if (o.extraDims?.length) {
    out.push('<g class="extra-dims">');
    for (const d of o.extraDims) out.push(dim(d.a, d.b, d.off, d.label, d.status));
    out.push('</g>');
  }

  // Leyenda y escala gráfica (la geometría está en metros: escala válida)
  if (o.crop) {
    out.push('</svg>');
    return out.join('');
  }
  const ly = ex.maxY + 1.75;
  out.push(`<g class="legend" font-size="0.16" fill="#3d433b">`);
  let lx = minX;
  for (const s of ['confirmado', 'documentado', 'interpretado', 'propuesto', 'pendiente'] as DataStatus[]) {
    const st = STATUS_STYLE[s];
    out.push(`<line x1="${n4(lx)}" y1="${n4(ly)}" x2="${n4(lx + 0.5)}" y2="${n4(ly)}" stroke="${st.color}" stroke-width="0.03" ${st.dash ? `stroke-dasharray="${st.dash}"` : ''}/><text x="${n4(lx + 0.6)}" y="${n4(ly + 0.055)}">${st.label}</text>`);
    lx += st.label.length * 0.085 + 0.8;
  }
  out.push('</g>');
  const sx = ex.maxX - 5;
  out.push(`<g class="scale" font-size="0.15" fill="#2f3430">`);
  for (let i = 0; i < 5; i++) out.push(`<rect x="${n4(sx + i)}" y="${n4(ly - 0.05)}" width="1" height="0.1" fill="${i % 2 ? '#fefdfb' : '#2f3430'}" stroke="#2f3430" stroke-width="0.01"/>`);
  for (const k of [0, 1, 2, 5]) out.push(`<text x="${n4(sx + k)}" y="${n4(ly + 0.3)}" text-anchor="middle">${k}</text>`);
  out.push(`<text x="${n4(sx + 5.2)}" y="${n4(ly + 0.05)}">m</text></g>`);

  if (o.forExport) {
    const ty = ex.maxY + 2.45;
    out.push(`<g fill="#252923"><text x="${n4(minX)}" y="${n4(ty)}" font-size="0.26" font-weight="650">${esc(o.forExport.title)}</text><text x="${n4(minX)}" y="${n4(ty + 0.34)}" font-size="0.17" fill="#687066">${esc(o.forExport.subtitle)}</text><text x="${n4(minX)}" y="${n4(ty + 0.62)}" font-size="0.15" fill="#687066">Escala 1:50 al imprimir a tamaño real (${n4(vb.w * 20)} × ${n4(vb.h * 20)} mm) · Planta cortada a 1,00 m · Cotas en metros · Modelo de estudio, no proyecto técnico.</text></g>`);
  }
  out.push('</svg>');
  return out.join('\n');
}

