/**
 * Aplica una variante de diseño sobre la definición del proyecto.
 * La geometría base nunca se modifica: las variantes guardan solo diferencias.
 */
import { DEFAULT_OPTIONS, type DesignOptions, type FinishSelection, type Furniture, type Layout, type Opening, type OpeningSystem, type ProjectData, type RoofType, type Wall } from '../data/types';
import { wallLength, wallSegmentRect } from './geometry';
import { normalizeLeaves } from './openings';

export interface OpeningOverride {
  width?: number;
  height?: number;
  offset?: number;
  sill?: number;
  system?: OpeningSystem;
  leaves?: number;
}

export interface FurnitureOverride {
  x?: number;
  y?: number;
  w?: number;
  d?: number;
  rot?: number;
}

export interface Variant {
  id: string;
  name: string;
  createdAt: string;
  openingOverrides: Record<string, OpeningOverride>;
  roofType: RoofType | null;
  finishes: FinishSelection;
  presetId: string | null;
  options: DesignOptions;
  furnitureOverrides: Record<string, FurnitureOverride>;
}

export function resolveLayout(p: ProjectData, v: Variant | null): Layout {
  const ov = v?.openingOverrides ?? {};
  const options = { ...DEFAULT_OPTIONS, ...(v?.options ?? {}) };
  // aberturas alternativas: solo las que la variante activa
  const active = (o: Opening) => {
    if (!o.variantKey) return true;
    if (o.variantKey.startsWith('ventanal-')) return o.variantKey === `ventanal-${options.ventanal}`;
    return options.aberturas.includes(o.variantKey);
  };
  const openings: Opening[] = p.openings.filter(active).map((o) => {
    const x = ov[o.id];
    if (!x) return o;
    const system = x.system || x.leaves
      ? {
          type: x.system ?? o.system?.type ?? 'fijo',
          leaves: normalizeLeaves(x.system ?? o.system?.type ?? 'fijo', x.leaves ?? o.system?.leaves ?? 1),
          status: 'propuesto' as const,
        }
      : o.system;
    const changedGeom = x.width !== undefined || x.height !== undefined || x.offset !== undefined || x.sill !== undefined;
    return {
      ...o,
      width: x.width ?? o.width,
      height: x.height ?? o.height,
      offset: x.offset ?? o.offset,
      sill: x.sill ?? o.sill,
      system,
      status: changedGeom ? 'propuesto' : o.status,
    };
  });
  const fo = v?.furnitureOverrides ?? {};
  const applyF = (f: Furniture): Furniture => {
    const x = fo[f.id];
    return x ? { ...f, ...x, status: 'propuesto' } : f;
  };
  const shown = (f: Furniture) => !f.onlyIf || (Object.entries(f.onlyIf) as [keyof DesignOptions, string | string[]][]).every(([k, v]) => (Array.isArray(v) ? v.includes(options[k] as never) : options[k] === v));
  const furniture = p.furniture.filter(shown).map(applyF);
  const outdoor = p.outdoor ? { ...p.outdoor, furniture: p.outdoor.furniture.map(applyF) } : undefined;
  const roof = p.roofOptions.length ? p.roofOptions.find((r) => r.type === v?.roofType) ?? p.roofOptions[0] : null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const w of p.walls) {
    const [e0, e1] = w.ext ?? [0, 0];
    for (const [x, y] of wallSegmentRect(w, -e0, wallLength(w) + e1)) {
      xs.push(x);
      ys.push(y);
    }
  }
  for (const r of p.rooms) for (const [x, y] of r.polygon) { xs.push(x); ys.push(y); }
  const bounds = xs.length ? { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const elev = (id: string) => p.levels.find((l) => l.id === id)?.elevation ?? 0;
  // cubierta con aleros a distinta altura: los muros exteriores llegan al alero bajo (bajo el faldón);
  // por encima se cierran con hastiales y con el recrecido del frontal alto. Los huecos que quedarían
  // por encima del muro no caben con esa cubierta.
  const eaveTop = roof?.eaves ? Math.min(roof.eaves.y0, roof.eaves.y1) - roof.thickness : null;
  const walls = eaveTop === null ? p.walls : p.walls.map((w) => (w.kind === 'exterior' ? { ...w, height: Math.min(w.height, eaveTop - elev(w.levelId)) } : w));
  const wallH = new Map(walls.map((w) => [w.id, w.height]));
  // las puertas se rebajan hasta el muro si les queda al menos 1,90 m de paso; el resto de huecos que no caben se quitan
  const fitted = eaveTop === null ? openings : openings.flatMap((o) => {
    const top = wallH.get(o.wallId) ?? Infinity;
    if (o.sill + o.height <= top + 1e-6) return [o];
    if (o.kind === 'puerta' && top - o.sill >= 1.9) return [{ ...o, height: Math.round((top - o.sill) * 100) / 100, status: 'propuesto' as const }];
    return [];
  });
  const topHeight = walls.filter((w) => w.kind === 'exterior').reduce((m, w) => Math.max(m, elev(w.levelId) + w.height), 0) || 2.5;
  // zona de comedor bajada (opción): desde x la casa corona más baja; solo con cubierta plana
  const ec = p.escalonComedor;
  if (ec && options.alturaComedor === 'baja' && roof && (roof.type === 'plana' || roof.type === 'plana-peto') && ec.top < topHeight) {
    const escalon = { x: ec.x, top: ec.top };
    const conEscalon = aplicarEscalon(walls, fitted, furniture, escalon, elev, roof.thickness, bounds);
    return { ...p, ...conEscalon, outdoor, roof, bounds, topHeight, options, escalon };
  }
  return { ...p, walls, openings: fitted, furniture, outdoor, roof, bounds, topHeight, options };
}

/**
 * Rebaja de la zona de comedor: los muros exteriores se coronan a `top` desde x (tramo `tope`), los laterales que quedan
 * enteros en esa zona bajan, se añade el frente del escalón (sobre la cubierta baja) y se quitan los huecos y se recortan
 * los muebles que ya no caben bajo el techo bajo.
 */
function aplicarEscalon(walls: Wall[], openings: Opening[], furniture: Furniture[], e: { x: number; top: number }, elev: (id: string) => number, t: number, bounds: Layout['bounds']) {
  const exterior = walls.filter((w) => w.kind === 'exterior');
  const out: Wall[] = walls.map((w) => {
    if (w.kind !== 'exterior') return w;
    const hBaja = e.top - elev(w.levelId);
    const len = wallLength(w);
    const [x0, x1] = [w.a[0], w.b[0]];
    if (Math.abs(x1 - x0) < 1e-6) return x0 >= e.x ? { ...w, height: Math.min(w.height, hBaja) } : w;
    // tramo del eje (con sus prolongaciones) que cae en la zona baja
    const s = (x: number) => ((x - x0) / (x1 - x0)) * len;
    const sE = s(e.x);
    const [s0, s1] = x1 > x0 ? [sE, len + 10] : [-10, sE];
    return { ...w, tope: { s0, s1, height: hBaja } };
  });
  // frente del escalón: de la cara inferior de la cubierta baja a la coronación, entre los frontales
  const ref = exterior.find((w) => Math.abs(w.a[1] - w.b[1]) < 1e-6) ?? exterior[0];
  const lv = ref?.levelId ?? 'pb';
  const T = ref?.thickness ?? 0.3;
  out.push({
    id: 'muro-escalon', levelId: lv, kind: 'exterior', thickness: T, status: 'propuesto', sourceId: ref?.sourceId ?? '',
    a: [e.x - T / 2, bounds.minY + T / 2], b: [e.x - T / 2, bounds.maxY - T / 2], ext: [-T / 2, -T / 2],
    base: e.top - t - elev(lv), height: Math.max(...exterior.map((w) => w.height)),
  });
  const wallById = new Map(out.map((w) => [w.id, w]));
  const fits = (o: Opening) => {
    const w = wallById.get(o.wallId);
    if (!w || !w.tope || w.kind !== 'exterior') return !w || !(w.a[0] === w.b[0] && w.a[0] >= e.x) || o.sill + o.height <= w.height + 1e-6;
    const enBaja = o.offset + o.width > w.tope.s0 && o.offset < w.tope.s1;
    return !enBaja || o.sill + o.height <= w.tope.height - t + 1e-6;
  };
  const techo = e.top - t;
  const muebles = furniture.map((f) => {
    if (f.x < e.x) return f;
    // la salida de humos de la estufa sale por la cubierta baja
    const g = f.type === 'estufa' ? { ...f, techo: Math.round((e.top - elev('pb')) * 100) / 100 } : f;
    return elev('pb') + g.h > techo ? { ...g, h: Math.round((techo - elev('pb')) * 100) / 100 } : g;
  });
  return { walls: out, openings: openings.filter(fits), furniture: muebles };
}

/** cota de la base de un muro (cota de su nivel) */
export const wallBase = (l: Pick<ProjectData, 'levels'>, w: { levelId: string }) => l.levels.find((x) => x.id === w.levelId)?.elevation ?? 0;
export const levelElev = (l: Pick<ProjectData, 'levels'>, id: string) => l.levels.find((x) => x.id === id)?.elevation ?? 0;

export const hasGeometry = (p: ProjectData) => p.walls.length > 0;
