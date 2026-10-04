/**
 * Planta 2D vectorial generada desde el mismo Layout que el modelo 3D.
 * Devuelve el SVG como texto: se usa en pantalla y en la exportación.
 * Unidades: metros (viewBox en metros, Y hacia abajo = sentido del papel).
 */
import type { DataStatus, Layout, Vec2 } from '../data/types';
import {
  bbox, centroid, doorSwing, fmtM, furnitureFootprint, pointOnWall, polygonArea, wallDir, wallNormal, wallPieces, wallSegmentRect,
} from '../model/geometry';
import { FRAME, leafPose } from '../model/openings';
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
  selection: { kind: 'room' | 'opening'; id: string } | null;
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
}

const CUT_REL = 1.0; // plano de corte a 1,00 m sobre el suelo del nivel
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n4 = (x: number) => Math.round(x * 1e4) / 1e4;
const pts = (p: Vec2[]) => p.map(([x, y]) => `${n4(x)},${n4(y)}`).join(' ');

function dim(a: Vec2, b: Vec2, off: number, label: string, status: DataStatus) {
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

export function planSvg(layout: Layout, o: PlanOptions): string {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const L = maxX - minX;
  const W = maxY - minY;
  const margin = 1.8;
  const extraBottom = o.forExport ? 2.0 : 1.0;
  const vb = { x: minX - margin, y: minY - margin, w: L + 2 * margin, h: W + 2 * margin + extraBottom };
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
    out.push('<g class="furniture" stroke="#9fa39a" stroke-width="0.012" fill="#fefdfb" pointer-events="none">');
    for (const f of furniture) {
      const fp = furnitureFootprint(f);
      const bad = conflictIds.has(f.id) ? ' stroke="#b3261e" stroke-width="0.03"' : '';
      if (f.type === 'estufa') out.push(`<circle cx="${n4(f.x)}" cy="${n4(f.y)}" r="${n4(f.w / 2)}"${bad}/>`);
      else out.push(`<polygon points="${pts(fp)}"${f.type === 'alfombra' ? ' fill="none" stroke-dasharray="0.05 0.05"' : ''}${bad}/>`);
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
        out.push(`<line x1="${n4(fp[0][0])}" y1="${n4(fp[0][1])}" x2="${n4(fp[2][0])}" y2="${n4(fp[2][1])}" stroke-width="0.008"/><line x1="${n4(fp[1][0])}" y1="${n4(fp[1][1])}" x2="${n4(fp[3][0])}" y2="${n4(fp[3][1])}" stroke-width="0.008"/>`);
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
      for (let i = 1; i < st.risers; i++) {
        const t = i / st.risers;
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
      const confirmed = (st.upStatus ?? st.status) === 'documentado';
      out.push(`<text x="${n4(cx + 0.14)}" y="${n4(cy)}" font-size="0.15" fill="${stc.color}" transform="rotate(${st.up === '+y' ? 90 : -90} ${n4(cx + 0.14)} ${n4(cy)})" text-anchor="middle">sube${confirmed ? '' : ' (sentido pendiente)'}</text>`);
    } else if (st.toLevel === level?.id) {
      out.push(`<polygon points="${pts(box)}" fill="#ecebe5" stroke="#7d8277" stroke-width="0.012" stroke-dasharray="0.1 0.06"/><line x1="${n4(ax)}" y1="${n4(ay)}" x2="${n4(bx)}" y2="${n4(by)}" stroke="#9fa39a" stroke-width="0.008"/><text x="${n4((ax + bx) / 2)}" y="${n4((ay + by) / 2)}" font-size="0.15" fill="#687066" text-anchor="middle" transform="rotate(-90 ${n4((ax + bx) / 2)} ${n4((ay + by) / 2)})">escalera · desembarco</text>`);
    }
  }
  out.push('</g>');

  // Barandillas del nivel: doble línea continua
  for (const r of (layout.railings ?? []).filter((x) => x.levelId === level?.id)) {
    const edge = r.material === 'vidrio' ? '#6f8a94' : '#3d4239';
    out.push(`<g data-railing="${esc(r.id)}" pointer-events="none"><polyline points="${pts(r.points)}" fill="none" stroke="${edge}" stroke-width="0.05"/><polyline points="${pts(r.points)}" fill="none" stroke="${r.material === 'vidrio' ? '#dce8ec' : '#fefdfb'}" stroke-width="0.02"/></g>`);
    if (o.showLabels && r.points.length === 2) {
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
    out.push(dim([minX, maxY], [maxX, maxY], 1.0, `${fmtM(L)} m`, m('largo')));
    out.push(dim([minX, minY], [minX, maxY], 0.8, `${fmtM(W)} m`, m('ancho')));
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

  // Leyenda y escala gráfica (la geometría está en metros: escala válida)
  const ly = maxY + 1.75;
  out.push(`<g class="legend" font-size="0.16" fill="#3d433b">`);
  let lx = minX;
  for (const s of ['documentado', 'interpretado', 'propuesto', 'pendiente'] as DataStatus[]) {
    const st = STATUS_STYLE[s];
    out.push(`<line x1="${n4(lx)}" y1="${n4(ly)}" x2="${n4(lx + 0.5)}" y2="${n4(ly)}" stroke="${st.color}" stroke-width="0.03" ${st.dash ? `stroke-dasharray="${st.dash}"` : ''}/><text x="${n4(lx + 0.6)}" y="${n4(ly + 0.055)}">${st.label}</text>`);
    lx += 1.95;
  }
  out.push('</g>');
  const sx = maxX - 5;
  out.push(`<g class="scale" font-size="0.15" fill="#2f3430">`);
  for (let i = 0; i < 5; i++) out.push(`<rect x="${n4(sx + i)}" y="${n4(ly - 0.05)}" width="1" height="0.1" fill="${i % 2 ? '#fefdfb' : '#2f3430'}" stroke="#2f3430" stroke-width="0.01"/>`);
  for (const k of [0, 1, 2, 5]) out.push(`<text x="${n4(sx + k)}" y="${n4(ly + 0.3)}" text-anchor="middle">${k}</text>`);
  out.push(`<text x="${n4(sx + 5.2)}" y="${n4(ly + 0.05)}">m</text></g>`);

  if (o.forExport) {
    const ty = maxY + 2.45;
    out.push(`<g fill="#252923"><text x="${n4(minX)}" y="${n4(ty)}" font-size="0.26" font-weight="650">${esc(o.forExport.title)}</text><text x="${n4(minX)}" y="${n4(ty + 0.34)}" font-size="0.17" fill="#687066">${esc(o.forExport.subtitle)}</text><text x="${n4(minX)}" y="${n4(ty + 0.62)}" font-size="0.15" fill="#687066">Escala 1:50 al imprimir a tamaño real (${n4(vb.w * 20)} × ${n4(vb.h * 20)} mm) · Planta cortada a 1,00 m · Cotas en metros · Modelo de estudio, no proyecto técnico.</text></g>`);
  }
  out.push('</svg>');
  return out.join('\n');
}

