/**
 * Aplica una variante de diseño sobre la definición del proyecto.
 * La geometría base nunca se modifica: las variantes guardan solo diferencias.
 */
import { DEFAULT_OPTIONS, type DesignOptions, type FinishSelection, type Furniture, type Layout, type Opening, type OpeningSystem, type ProjectData, type RoofType } from '../data/types';
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
  const shown = (f: Furniture) => !f.onlyIf || ((!f.onlyIf.chimenea || f.onlyIf.chimenea === options.chimenea) && (!f.onlyIf.mesaComedor || f.onlyIf.mesaComedor === options.mesaComedor));
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
  const topHeight = p.walls.filter((w) => w.kind === 'exterior').reduce((m, w) => Math.max(m, elev(w.levelId) + w.height), 0) || 2.5;
  return { ...p, openings, furniture, outdoor, roof, bounds, topHeight, options };
}

/** cota de la base de un muro (cota de su nivel) */
export const wallBase = (l: Pick<ProjectData, 'levels'>, w: { levelId: string }) => l.levels.find((x) => x.id === w.levelId)?.elevation ?? 0;
export const levelElev = (l: Pick<ProjectData, 'levels'>, id: string) => l.levels.find((x) => x.id === id)?.elevation ?? 0;

export const hasGeometry = (p: ProjectData) => p.walls.length > 0;
