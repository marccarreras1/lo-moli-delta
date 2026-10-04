import { describe, expect, it } from 'vitest';
import { VINALLOP } from '../data/vinallop';
import type { Vec2 } from '../data/types';
import { distPointSegment, pointInPolygon, wallDir } from '../model/geometry';
import { resolveLayout } from '../model/resolve';
import { baseVariant } from '../state/store';
import { installationsSvg } from '../instalaciones/planLayer';
import { proposedPoints } from '../instalaciones/seed';
import { exportInstalaciones, importInstalaciones, resolvePoints, useInstalaciones } from '../instalaciones/store';
import { LAYERS, emptyEdits, kindFitsLayer, type Layer } from '../instalaciones/types';

const layout = resolveLayout(VINALLOP, baseVariant());
const points = proposedPoints(layout);

const distToPoly = (p: Vec2, poly: Vec2[]) => (pointInPolygon(p, poly) ? 0 : Math.min(...poly.map((a, i) => distPointSegment(p, a, poly[(i + 1) % poly.length]))));

describe('instalaciones: propuesta generada desde la geometría', () => {
  it('hay puntos en las seis capas y cada tipo pertenece a su capa', () => {
    for (const l of LAYERS) expect(points.some((p) => p.layer === l), l).toBe(true);
    for (const p of points) expect(kindFitsLayer(p.layer, p.kind), p.id).toBe(true);
  });

  it('ids únicos y estables entre dos llamadas', () => {
    const ids = points.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(proposedPoints(layout)).toEqual(points);
    expect(ids).toContain('elec-cuadro');
    expect(ids).toContain('bodega-sensor-th');
  });

  it('ningún punto sale validado por el instalador; todas las notas dicen que es una propuesta', () => {
    for (const p of points) {
      expect(p.status, p.id).not.toBe('validado por instalador');
      expect(p.note, p.id).toMatch(/propuesta/i);
    }
  });

  it('la bodega queda pendiente y sin posición', () => {
    const b = points.filter((p) => p.layer === 'bodega');
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ kind: 'sensor-th', x: null, y: null, roomId: null, status: 'pendiente' });
    expect(b[0].note).toMatch(/no identificada en el plano/);
  });

  it('cada punto con posición está en su estancia o sobre su muro (0,35 m); los exteriores, fuera de la casa', () => {
    for (const p of points) {
      if (p.x === null || p.y === null) continue;
      const P: Vec2 = [p.x, p.y];
      if (p.roomId) {
        const room = layout.rooms.find((r) => r.id === p.roomId);
        expect(room, p.id).toBeTruthy();
        expect(room!.levelId, p.id).toBe(p.levelId);
        expect(distToPoly(P, room!.polygon), p.id).toBeLessThanOrEqual(0.35);
      } else {
        expect(['audio', 'ajax', 'electricidad'] as Layer[], p.id).toContain(p.layer);
        const inside = layout.rooms.some((r) => r.levelId === p.levelId && pointInPolygon(P, r.polygon, -1e-6));
        expect(inside, p.id).toBe(false);
      }
    }
  });

  it('audio en tres zonas: interior, terraza delantera (fachada de la entrada, 2,40 m) y comedor del algarrobo', () => {
    const a = points.filter((p) => p.layer === 'audio');
    const zones = new Set(a.map((p) => p.zone));
    expect(zones).toEqual(new Set(['Interior', 'Terraza delantera', 'Comedor del algarrobo']));
    const entrance = layout.openings.find((o) => o.entrance)!;
    const w = layout.walls.find((x) => x.id === entrance.wallId)!;
    for (const p of a.filter((q) => q.zone === 'Terraza delantera')) {
      expect(p.height).toBe(2.4);
      expect(Math.abs(distPointSegment([p.x!, p.y!], w.a, w.b) - w.thickness / 2)).toBeLessThan(0.02);
    }
  });

  it('dos rociadores de ducha, enfrentados en lados opuestos del baño', () => {
    const r = points.filter((p) => p.kind === 'rociador');
    expect(r).toHaveLength(2);
    const [a, b] = r;
    expect(a.roomId).toBe(b.roomId);
    const dx = Math.abs(a.x! - b.x!);
    const dy = Math.abs(a.y! - b.y!);
    // separados claramente en un eje y alineados en el otro
    expect(Math.max(dx, dy)).toBeGreaterThan(1.2);
    expect(Math.min(dx, dy)).toBeLessThan(0.3);
    // cada uno junto a un muro distinto (o extremo opuesto de la ducha)
    const near = (p: typeof a) => layout.walls
      .map((w) => ({ w, d: Math.abs(distPointSegment([p.x!, p.y!], w.a, w.b) - w.thickness / 2) }))
      .sort((m, n) => m.d - n.d)[0];
    const na = near(a);
    const nb = near(b);
    if (na.d < 0.1 && nb.d < 0.1) {
      expect(na.w.id).not.toBe(nb.w.id);
      const da = wallDir(na.w);
      const db = wallDir(nb.w);
      expect(Math.abs(da[0] * db[0] + da[1] * db[1])).toBeGreaterThan(0.99); // muros paralelos, opuestos
    }
    expect(points.filter((p) => p.kind === 'mando-ducha')).toHaveLength(2);
  });

  it('cuadro junto a la entrada, a 1,60 m, con la central Ajax y los actuadores KNX', () => {
    const c = points.find((p) => p.id === 'elec-cuadro')!;
    expect(c.height).toBe(1.6);
    expect(c.roomId).not.toBeNull();
    const hub = points.find((p) => p.kind === 'ajax-hub')!;
    expect(Math.hypot(hub.x! - c.x!, hub.y! - c.y!)).toBeLessThan(1);
    expect(points.some((p) => p.kind === 'knx-actuador')).toBe(true);
  });
});

describe('instalaciones: ediciones, exportación e importación', () => {
  it('resolvePoints combina generados, ediciones, añadidos y eliminados', () => {
    const edits = emptyEdits();
    edits.overrides['elec-cuadro'] = { height: 1.8, status: 'validado por instalador', circuit: 'X' };
    edits.removed.push('audio-interior-1');
    edits.added.push({ ...points[0], id: 'usr-agua-1', layer: 'agua', kind: 'toma-agua', label: 'Grifo' });
    const res = resolvePoints(layout, edits);
    expect(res.find((p) => p.id === 'elec-cuadro')).toMatchObject({ height: 1.8, status: 'validado por instalador', circuit: 'X' });
    expect(res.some((p) => p.id === 'audio-interior-1')).toBe(false);
    expect(res.some((p) => p.id === 'usr-agua-1')).toBe(true);
    expect(res).toHaveLength(points.length);
  });

  it('importInstalaciones rechaza datos inválidos y no cambia el estado', () => {
    useInstalaciones.getState().resetAll();
    const good = exportInstalaciones();
    const bads: unknown[] = [
      null, 42, 'x', {}, [],
      { ...good, app: 'otra' },
      { ...good, version: 99 },
      { ...good, visible: ['gas'] },
      { ...good, edits: { overrides: [], added: [], removed: [] } },
      { ...good, edits: { overrides: { 'elec-cuadro': { height: 'alto' } }, added: [], removed: [] } },
      { ...good, edits: { overrides: { 'elec-cuadro': { status: 'contratado' } }, added: [], removed: [] } },
      { ...good, edits: { overrides: { 'elec-cuadro': { id: 'otro' } }, added: [], removed: [] } },
      { ...good, edits: { overrides: { 'ID MALO': {} }, added: [], removed: [] } },
      { ...good, edits: { overrides: {}, added: [{ ...points[0], id: 'usr-1', layer: 'gas' }], removed: [] } },
      { ...good, edits: { overrides: {}, added: [{ ...points[0], id: 'usr-1', kind: 'altavoz' }], removed: [] } },
      { ...good, edits: { overrides: {}, added: [{ ...points[0], id: 'usr-1', x: Number.NaN }], removed: [] } },
      { ...good, edits: { overrides: {}, added: [], removed: [3] } },
    ];
    for (const b of bads) expect(importInstalaciones(b).ok, JSON.stringify(b)?.slice(0, 120)).toBe(false);
    expect(useInstalaciones.getState().edits).toEqual(emptyEdits());
    const withEdit = { ...good, visible: ['agua'], edits: { overrides: { 'elec-cuadro': { note: 'ok' } }, added: [], removed: ['audio-terraza-1'] } };
    expect(importInstalaciones(JSON.parse(JSON.stringify(withEdit)))).toEqual({ ok: true });
    expect(useInstalaciones.getState().visible).toEqual(['agua']);
    expect(useInstalaciones.getState().edits.removed).toEqual(['audio-terraza-1']);
    useInstalaciones.getState().resetAll();
    useInstalaciones.getState().setAllLayers(false);
  });

  it('las capas están ocultas por defecto', () => {
    expect(useInstalaciones.getState().visible).toEqual([]);
  });

  it('addPoint crea puntos propuestos (o pendientes sin posición), nunca validados', () => {
    const s = useInstalaciones.getState();
    const id1 = s.addPoint({ layer: 'audio', kind: 'altavoz', roomId: 'dia', levelId: 'pb', x: 10, y: 2, height: 2.4 });
    const id2 = s.addPoint({ layer: 'bodega', kind: 'sensor-th', roomId: null, levelId: 'pb', x: null, y: null, height: 1.5 });
    const added = useInstalaciones.getState().edits.added;
    expect(added.find((p) => p.id === id1)?.status).toBe('propuesto');
    expect(added.find((p) => p.id === id2)?.status).toBe('pendiente');
    useInstalaciones.getState().resetAll();
  });
});

describe('instalaciones: capa SVG del plano', () => {
  it('un data-install por punto visible del nivel', () => {
    for (const level of layout.levels) {
      const visible = new Set<Layer>(LAYERS);
      const svg = installationsSvg(points, visible, level.id, 'elec-cuadro', { walls: layout.walls, labels: true });
      expect(svg.startsWith('<g class="installations">')).toBe(true);
      const expected = points.filter((p) => p.levelId === level.id && p.x !== null);
      const found = [...svg.matchAll(/data-install="([^"]+)"/g)].map((m) => m[1]);
      expect(found.sort()).toEqual(expected.map((p) => p.id).sort());
    }
    const only = installationsSvg(points, new Set<Layer>(['agua']), 'pb');
    const n = (only.match(/data-install=/g) ?? []).length;
    expect(n).toBe(points.filter((p) => p.layer === 'agua' && p.levelId === 'pb' && p.x !== null).length);
    expect(installationsSvg(points, new Set(), 'pb')).not.toContain('data-install');
  });
});
