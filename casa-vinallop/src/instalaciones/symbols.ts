/**
 * Código gráfico de las instalaciones: color discreto por capa (legible sobre el plano
 * claro) y forma por capa, de modo que no dependa solo del color; glifo propio por tipo.
 * Los glifos se dibujan en metros (≈0,18 m), en el mismo sistema que el plano.
 */
import { KINDS_BY_LAYER, KIND_LABEL, LAYERS, LAYER_LABEL, type InstallKind, type InstallPoint, type Layer } from './types';

export type LayerShape = 'circulo' | 'cuadrado' | 'rombo' | 'triangulo' | 'gota' | 'hexagono';

export const LAYER_STYLE: Record<Layer, { color: string; soft: string; shape: LayerShape; shapeLabel: string }> = {
  electricidad: { color: '#a8741a', soft: '#f6ecd8', shape: 'circulo', shapeLabel: 'círculo' },
  knx: { color: '#4a5a8c', soft: '#e3e7f2', shape: 'cuadrado', shapeLabel: 'cuadrado' },
  ajax: { color: '#8a3f62', soft: '#f3e2ea', shape: 'rombo', shapeLabel: 'rombo' },
  audio: { color: '#2f7a6c', soft: '#dff0ec', shape: 'triangulo', shapeLabel: 'triángulo' },
  agua: { color: '#2a6f9e', soft: '#dfecf5', shape: 'gota', shapeLabel: 'gota' },
  bodega: { color: '#6b7330', soft: '#eef0dc', shape: 'hexagono', shapeLabel: 'hexágono' },
};

/** tamaño nominal del glifo (m) */
export const GLYPH = 0.18;

const n4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** contorno de la forma de la capa, centrado en (x, y), radio r */
function shapePath(shape: LayerShape, x: number, y: number, r: number): string {
  const poly = (pts: [number, number][]) => `M ${pts.map(([a, b]) => `${n4(x + a)} ${n4(y + b)}`).join(' L ')} Z`;
  switch (shape) {
    case 'circulo':
      return `M ${n4(x - r)} ${n4(y)} A ${n4(r)} ${n4(r)} 0 1 0 ${n4(x + r)} ${n4(y)} A ${n4(r)} ${n4(r)} 0 1 0 ${n4(x - r)} ${n4(y)} Z`;
    case 'cuadrado': { const k = r * 0.86; return poly([[-k, -k], [k, -k], [k, k], [-k, k]]); }
    case 'rombo': return poly([[0, -r * 1.1], [r * 1.1, 0], [0, r * 1.1], [-r * 1.1, 0]]);
    case 'triangulo': return poly([[0, -r * 1.1], [r * 1.05, r * 0.75], [-r * 1.05, r * 0.75]]);
    case 'gota': return `M ${n4(x)} ${n4(y - r * 1.15)} C ${n4(x + r * 0.9)} ${n4(y - r * 0.2)} ${n4(x + r * 0.95)} ${n4(y + r * 0.9)} ${n4(x)} ${n4(y + r * 0.9)} C ${n4(x - r * 0.95)} ${n4(y + r * 0.9)} ${n4(x - r * 0.9)} ${n4(y - r * 0.2)} ${n4(x)} ${n4(y - r * 1.15)} Z`;
    case 'hexagono': return poly(Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i; return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]; }));
  }
}

/** marca interior propia de cada tipo (trazo fino del color de la capa) */
function kindMark(kind: InstallKind, x: number, y: number, r: number, c: string): string {
  const k = r * 0.55;
  const line = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${n4(x + x1)}" y1="${n4(y + y1)}" x2="${n4(x + x2)}" y2="${n4(y + y2)}"/>`;
  const dot = (dx: number, dy: number, rr: number) => `<circle cx="${n4(x + dx)}" cy="${n4(y + dy)}" r="${n4(rr)}" fill="${c}" stroke="none"/>`;
  switch (kind) {
    case 'luz': return line(-k, -k, k, k) + line(-k, k, k, -k);
    case 'interruptor': return line(0, 0, k, -k) + dot(0, 0, r * 0.14);
    case 'enchufe': return line(-k * 0.45, -k * 0.6, -k * 0.45, k * 0.6) + line(k * 0.45, -k * 0.6, k * 0.45, k * 0.6);
    case 'cuadro': return `<rect x="${n4(x - k)}" y="${n4(y - k * 0.7)}" width="${n4(2 * k)}" height="${n4(1.4 * k)}" fill="${c}" stroke="none"/>`;
    case 'knx-actuador': return line(-k, -k * 0.4, k, -k * 0.4) + line(-k, k * 0.4, k, k * 0.4);
    case 'knx-pulsador': return dot(-k * 0.45, 0, r * 0.14) + dot(k * 0.45, 0, r * 0.14);
    case 'knx-sensor': return `<circle cx="${n4(x)}" cy="${n4(y)}" r="${n4(k * 0.7)}" fill="none"/>` + dot(0, 0, r * 0.12);
    case 'ajax-hub': return dot(0, 0, r * 0.3);
    case 'ajax-movimiento': return `<path d="M ${n4(x - k)} ${n4(y + k * 0.3)} Q ${n4(x)} ${n4(y - k * 1.1)} ${n4(x + k)} ${n4(y + k * 0.3)}" fill="none"/>`;
    case 'ajax-contacto': return line(-k * 0.6, 0, -k * 0.1, 0) + line(k * 0.1, 0, k * 0.6, 0);
    case 'ajax-sirena': return line(0, -k, 0, k * 0.2) + dot(0, k * 0.6, r * 0.12);
    case 'altavoz': return `<circle cx="${n4(x)}" cy="${n4(y + r * 0.1)}" r="${n4(k * 0.55)}" fill="none"/>`;
    case 'toma-agua': return line(0, -k * 0.8, 0, k * 0.6) + line(-k * 0.5, k * 0.6, k * 0.5, k * 0.6);
    case 'desague': return `<circle cx="${n4(x)}" cy="${n4(y + r * 0.1)}" r="${n4(k * 0.5)}" fill="none"/>` + line(-k * 0.5, r * 0.1, k * 0.5, r * 0.1);
    case 'extraccion': return line(-k * 0.6, -k * 0.2, k * 0.6, -k * 0.2) + line(-k * 0.6, k * 0.3, k * 0.6, k * 0.3) + line(0, -k * 0.6, 0, k * 0.7);
    case 'rociador': return dot(-k * 0.4, k * 0.2, r * 0.09) + dot(0, k * 0.2, r * 0.09) + dot(k * 0.4, k * 0.2, r * 0.09) + dot(-k * 0.2, -k * 0.2, r * 0.09) + dot(k * 0.2, -k * 0.2, r * 0.09);
    case 'mando-ducha': return `<circle cx="${n4(x)}" cy="${n4(y + r * 0.1)}" r="${n4(k * 0.45)}" fill="none"/>` + line(0, r * 0.1, k * 0.45, -k * 0.35);
    case 'sensor-th': return line(0, -k * 0.8, 0, k * 0.3) + dot(0, k * 0.5, r * 0.16);
  }
}

/** Glifo SVG de un punto (sin envoltorio), centrado en (x, y). */
export function glyphSvg(layer: Layer, kind: InstallKind, x: number, y: number, size = GLYPH, opts: { pending?: boolean } = {}): string {
  const st = LAYER_STYLE[layer];
  const r = size / 2;
  const dash = opts.pending ? ` stroke-dasharray="${n4(r * 0.35)} ${n4(r * 0.25)}"` : '';
  return `<path d="${shapePath(st.shape, x, y, r)}" fill="#fefdfb" fill-opacity="0.92" stroke="${st.color}" stroke-width="${n4(size * 0.09)}"${dash}/>`
    + `<g stroke="${st.color}" stroke-width="${n4(size * 0.075)}" stroke-linecap="round" fill="none">${kindMark(kind, x, y, r, st.color)}</g>`;
}

/** SVG autónomo de un glifo (para leyendas en la interfaz), en píxeles. */
export function glyphIconSvg(layer: Layer, kind: InstallKind, px = 22): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.12 -0.12 0.24 0.24" width="${px}" height="${px}" aria-hidden="true">${glyphSvg(layer, kind, 0, 0, GLYPH)}</svg>`;
}

export interface LegendEntry {
  layer: Layer;
  layerLabel: string;
  color: string;
  shapeLabel: string;
  kinds: { kind: InstallKind; label: string }[];
}

/** Leyenda: una entrada por capa con sus tipos. */
export function legend(layers: readonly Layer[] = LAYERS): LegendEntry[] {
  return layers.map((layer) => ({
    layer,
    layerLabel: LAYER_LABEL[layer],
    color: LAYER_STYLE[layer].color,
    shapeLabel: LAYER_STYLE[layer].shapeLabel,
    kinds: KINDS_BY_LAYER[layer].map((kind) => ({ kind, label: KIND_LABEL[kind] })),
  }));
}

/**
 * Desplazamientos de dibujo para puntos que coinciden en planta (p. ej. cuadro y actuadores
 * KNX): se reparten en corona para que se vean todos. No cambia los datos.
 */
export function spreadOverlapping(points: InstallPoint[], radius = GLYPH * 0.75, eps = 0.06): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  const placed = points.filter((p) => p.x !== null && p.y !== null);
  const used = new Set<string>();
  for (const p of placed) {
    if (used.has(p.id)) continue;
    const group = placed.filter((q) => !used.has(q.id) && Math.hypot((q.x as number) - (p.x as number), (q.y as number) - (p.y as number)) < eps);
    group.forEach((q) => used.add(q.id));
    if (group.length < 2) continue;
    group.forEach((q, i) => {
      const a = -Math.PI / 2 + (i / group.length) * Math.PI * 2;
      out.set(q.id, [Math.cos(a) * radius, Math.sin(a) * radius]);
    });
  }
  return out;
}
