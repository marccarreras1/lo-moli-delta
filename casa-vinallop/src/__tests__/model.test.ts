import { describe, expect, it } from 'vitest';
import { buildTestModel } from '../data/modeloPrueba';
import { VINALLOP } from '../data/vinallop';
import { cameraPresets } from '../model/cameras';
import { polygonArea, wallPieces } from '../model/geometry';
import { leafPose } from '../model/openings';
import { hasGeometry, resolveLayout, type Variant } from '../model/resolve';
import { validateLayout } from '../model/validate';
import { baseVariant } from '../state/store';

const test = buildTestModel();
const variant = (o: Partial<Variant> = {}): Variant => ({ ...baseVariant(), id: 'v1', name: 'V1', ...o });

describe('Casa Vinallop', () => {
  it('no contiene geometría inventada mientras no lleguen los bocetos', () => {
    expect(hasGeometry(VINALLOP)).toBe(false);
    expect(VINALLOP.rooms).toEqual([]);
    expect(VINALLOP.measures).toEqual([]);
    expect(VINALLOP.northDeg).toBeNull();
  });
  it('sin geometría no hay cámaras ni estancias', () => {
    expect(cameraPresets(resolveLayout(VINALLOP, null))).toEqual([]);
  });
});

describe('modelo de prueba', () => {
  const layout = resolveLayout(test, baseVariant());
  it('está marcado como prueba', () => expect(test.isTest).toBe(true));
  it('no tiene errores ni conflictos', () => {
    const bad = validateLayout(layout).filter((i) => i.level !== 'aviso');
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });
  it('los huecos son reales en los muros', () => {
    for (const o of layout.openings) {
      const w = layout.walls.find((x) => x.id === o.wallId)!;
      const block = wallPieces(w, layout.openings).filter((p) => p.s0 < o.offset + o.width - 1e-6 && p.s1 > o.offset + 1e-6 && p.z0 < o.sill + o.height - 1e-6 && p.z1 > o.sill + 1e-6);
      expect(block, o.id).toEqual([]);
    }
  });
  it('superficies desde polígonos', () => {
    const total = layout.rooms.reduce((s, r) => s + polygonArea(r.polygon), 0);
    expect(total).toBeGreaterThan(50);
    expect(total).toBeLessThan(12 * 6);
  });
  it('genera cámaras de fachadas identificadas y de cada estancia', () => {
    const ids = cameraPresets(layout).map((c) => c.id);
    expect(ids).toContain('fachada-principal');
    expect(ids).toContain('int-sala');
  });
});

describe('variantes', () => {
  it('una variante cambia el hueco sin tocar la base ni los muros', () => {
    const v = variant({ openingOverrides: { cristalera: { width: 5.6 } } });
    const a = resolveLayout(test, baseVariant());
    const b = resolveLayout(test, v);
    expect(b.walls).toEqual(a.walls);
    expect(a.openings.find((o) => o.id === 'cristalera')!.width).toBe(5);
    expect(b.openings.find((o) => o.id === 'cristalera')!.width).toBe(5.6);
    expect(b.openings.find((o) => o.id === 'cristalera')!.status).toBe('propuesto');
  });
  it('si el hueco sale del muro se señala el conflicto', () => {
    const b = resolveLayout(test, variant({ openingOverrides: { cristalera: { width: 9 } } }));
    expect(validateLayout(b).some((i) => i.elementId === 'cristalera' && i.level !== 'aviso')).toBe(true);
  });
  it('si invade un tabique se señala el conflicto', () => {
    const b = resolveLayout(test, variant({ openingOverrides: { 'ventana-dormitorio': { width: 3.0 } } }));
    expect(validateLayout(b).some((i) => i.elementId === 'ventana-dormitorio' && i.level === 'conflicto')).toBe(true);
  });
});

describe('carpinterías', () => {
  it('corredera de 4 hojas: máximo aprox. la mitad, sin hacer desaparecer hojas', () => {
    const p = leafPose('corredera', 4, 5, 1);
    expect(p.leaves).toHaveLength(4);
    expect(p.maxFree / p.clear).toBeGreaterThan(0.45);
    expect(p.maxFree / p.clear).toBeLessThan(0.52);
  });
  it('abatible gira sobre su bisagra', () => {
    const p = leafPose('abatible', 1, 0.9, 1);
    expect(p.leaves[0].angle).toBe(90);
    expect(p.leaves[0].s).toBe(0);
  });
  it('fijo no abre', () => expect(leafPose('fijo', 2, 2, 1).free).toBe(0));
  it('cerrado no deja paso', () => expect(leafPose('plegable', 6, 4, 0).free).toBe(0));
});
