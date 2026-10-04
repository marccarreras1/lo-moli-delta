/**
 * Capa SVG de instalaciones para el plano (fragmento <g> en metros, mismo sistema que
 * planSvg: X a la derecha, Y hacia abajo). Cada punto va en <g data-install="id">.
 */
import type { Vec2, Wall } from '../data/types';
import { distPointSegment } from '../model/geometry';
import { GLYPH, LAYER_STYLE, glyphSvg, spreadOverlapping } from './symbols';
import { KIND_LABEL, LAYERS, STATUS_LABEL, type InstallPoint, type Layer } from './types';

export interface InstallationsSvgOptions {
  /** etiquetas cortas junto a cada símbolo */
  labels?: boolean;
  /** muros del nivel: si se pasan, se dibujan recorridos punteados (solo agua) hasta el muro más cercano */
  walls?: Wall[];
  /** tamaño del glifo (m) */
  size?: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** punto más cercano sobre la cara de algún muro */
function nearestWallFace(p: Vec2, walls: Wall[]): Vec2 | null {
  let best: Vec2 | null = null;
  let bd = Infinity;
  for (const w of walls) {
    const dx = w.b[0] - w.a[0];
    const dy = w.b[1] - w.a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) continue;
    const ux = dx / L;
    const uy = dy / L;
    const s = Math.max(0, Math.min(L, (p[0] - w.a[0]) * ux + (p[1] - w.a[1]) * uy));
    const off = (p[0] - w.a[0]) * -uy + (p[1] - w.a[1]) * ux;
    const side = off >= 0 ? 1 : -1;
    const q: Vec2 = [w.a[0] + ux * s - uy * side * (w.thickness / 2), w.a[1] + uy * s + ux * side * (w.thickness / 2)];
    const d = Math.abs(distPointSegment(p, w.a, w.b) - w.thickness / 2);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}

/** abreviatura corta del tipo (etiquetas) */
const SHORT: Partial<Record<InstallPoint['kind'], string>> = {
  luz: 'L', interruptor: 'I', enchufe: 'E', cuadro: 'CGMP', 'knx-actuador': 'KNX', 'knx-pulsador': 'P', 'knx-sensor': 'SP',
  'ajax-hub': 'HUB', 'ajax-movimiento': 'M', 'ajax-contacto': 'C', 'ajax-sirena': 'S', altavoz: 'A',
  'toma-agua': 'T', desague: 'D', extraccion: 'EX', rociador: 'R', 'mando-ducha': 'MD', 'sensor-th': 'TH',
};

export function installationsSvg(points: InstallPoint[], visibleLayers: Set<Layer>, levelId: string, selectedId?: string, options: InstallationsSvgOptions = {}): string {
  const size = options.size ?? GLYPH;
  const pts = points.filter((p) => visibleLayers.has(p.layer) && p.levelId === levelId && p.x !== null && p.y !== null);
  if (!pts.length) return '<g class="installations"></g>';
  const offs = spreadOverlapping(pts, size * 0.75);
  const out: string[] = ['<g class="installations">'];

  // recorridos propuestos (solo agua y saneamiento), discretos y bajo los símbolos
  if (options.walls?.length && visibleLayers.has('agua')) {
    const c = LAYER_STYLE.agua.color;
    out.push(`<g class="install-routes" stroke="${c}" stroke-width="0.012" stroke-dasharray="0.05 0.04" stroke-opacity="0.7" fill="none" pointer-events="none">`);
    for (const p of pts.filter((q) => q.layer === 'agua')) {
      const P: Vec2 = [p.x as number, p.y as number];
      const q = nearestWallFace(P, options.walls);
      if (!q || Math.hypot(q[0] - P[0], q[1] - P[1]) < 0.08) continue;
      out.push(`<line x1="${n4(P[0])}" y1="${n4(P[1])}" x2="${n4(q[0])}" y2="${n4(q[1])}"/>`);
    }
    out.push('</g>');
  }

  // por capas, en orden fijo (el seleccionado al final para que quede encima)
  const ordered = [...pts].sort((a, b) => (a.id === selectedId ? 1 : 0) - (b.id === selectedId ? 1 : 0) || LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer));
  for (const p of ordered) {
    const [dx, dy] = offs.get(p.id) ?? [0, 0];
    const x = (p.x as number) + dx;
    const y = (p.y as number) + dy;
    const sel = p.id === selectedId;
    const title = `${p.label} · ${KIND_LABEL[p.kind]} · ${STATUS_LABEL[p.status]} · ${p.id}`;
    const g: string[] = [`<g data-install="${esc(p.id)}" data-layer="${p.layer}" data-kind="${p.kind}" class="install-pt${sel ? ' selected' : ''}" style="cursor:pointer"><title>${esc(title)}</title>`];
    if (dx || dy) g.push(`<line x1="${n4(p.x as number)}" y1="${n4(p.y as number)}" x2="${n4(x)}" y2="${n4(y)}" stroke="${LAYER_STYLE[p.layer].color}" stroke-width="0.008" pointer-events="none"/>`);
    // zona de toque generosa (invisible)
    g.push(`<circle cx="${n4(x)}" cy="${n4(y)}" r="${n4(size * 0.85)}" fill="transparent" stroke="none"/>`);
    if (sel) g.push(`<circle cx="${n4(x)}" cy="${n4(y)}" r="${n4(size * 0.85)}" fill="none" stroke="#68765e" stroke-width="0.03"/>`);
    g.push(glyphSvg(p.layer, p.kind, x, y, size, { pending: p.status === 'pendiente' }));
    if (options.labels) {
      const t = SHORT[p.kind] ?? '';
      g.push(`<text x="${n4(x + size * 0.62)}" y="${n4(y - size * 0.45)}" font-size="0.085" fill="${LAYER_STYLE[p.layer].color}" paint-order="stroke" stroke="#fefdfb" stroke-width="0.025" pointer-events="none">${esc(t)}</text>`);
    }
    g.push('</g>');
    out.push(g.join(''));
  }
  out.push('</g>');
  return out.join('');
}
