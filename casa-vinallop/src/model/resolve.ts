/**
 * Aplica una variante de diseño sobre la definición del proyecto.
 * La geometría base nunca se modifica: las variantes guardan solo diferencias.
 */
import type { FinishSelection, Layout, Opening, OpeningSystem, ProjectData, RoofType } from '../data/types';
import { normalizeLeaves } from './openings';

export interface OpeningOverride {
  width?: number;
  height?: number;
  offset?: number;
  sill?: number;
  system?: OpeningSystem;
  leaves?: number;
}

export interface Variant {
  id: string;
  name: string;
  createdAt: string;
  openingOverrides: Record<string, OpeningOverride>;
  roofType: RoofType | null;
  finishes: FinishSelection;
  presetId: string | null;
}

export function resolveLayout(p: ProjectData, v: Variant | null): Layout {
  const ov = v?.openingOverrides ?? {};
  const openings: Opening[] = p.openings.map((o) => {
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
  const roof = p.roofOptions.length ? p.roofOptions.find((r) => r.type === v?.roofType) ?? p.roofOptions[0] : null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const w of p.walls) {
    xs.push(w.a[0] - w.thickness / 2, w.b[0] + w.thickness / 2, w.a[0] + w.thickness / 2, w.b[0] - w.thickness / 2);
    ys.push(w.a[1] - w.thickness / 2, w.b[1] + w.thickness / 2, w.a[1] + w.thickness / 2, w.b[1] - w.thickness / 2);
  }
  for (const r of p.rooms) for (const [x, y] of r.polygon) { xs.push(x); ys.push(y); }
  const bounds = xs.length ? { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { ...p, openings, roof, bounds };
}

export const hasGeometry = (p: ProjectData) => p.walls.length > 0;
