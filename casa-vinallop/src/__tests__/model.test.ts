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

describe('Casa Vinallop (bocetos del 04/10/2026)', () => {
  const layout = resolveLayout(VINALLOP, baseVariant());
  const issues = validateLayout(layout);
  const room = (id: string) => layout.rooms.find((r) => r.id === id)!;
  const op = (id: string) => layout.openings.find((o) => o.id === id)!;
  const x0 = (id: string) => Math.min(...room(id).polygon.map((p) => p[0]));

  it('tiene geometría y no tiene errores; el único conflicto es el hueco de 3 m contra el forjado del altell', () => {
    expect(hasGeometry(VINALLOP)).toBe(true);
    const bad = issues.filter((i) => i.level !== 'aviso');
    expect(bad.map((i) => i.elementId), JSON.stringify(bad, null, 2)).toEqual(['obertura-225-pb']);
    expect(bad[0].message).toContain('forjado');
  });
  it('altell diáfano con cama de matrimonio', () => {
    const camas = layout.furniture.filter((f) => f.type === 'cama' && f.roomId === 'altell');
    expect(camas).toHaveLength(1);
    expect(layout.walls.filter((w) => w.levelId === 'altell')).toEqual([]);
  });
  it('largo = suma de la cadena de cotas documentada (15,70 m) y altura 6,20 m', () => {
    expect(layout.bounds.maxX - layout.bounds.minX).toBeCloseTo(15.7, 5);
    expect(layout.topHeight).toBeCloseTo(6.2, 5);
  });
  it('el dormitorio está en el extremo izquierdo y la cama en la mitad inferior', () => {
    const order = layout.rooms.filter((r) => r.levelId === 'pb').sort((a, b) => x0(a.id) - x0(b.id)).map((r) => r.id);
    expect(order[0]).toBe('dormitorio');
    const d = room('dormitorio').polygon;
    const midY = (Math.min(...d.map((p) => p[1])) + Math.max(...d.map((p) => p[1]))) / 2;
    expect(layout.furniture.find((f) => f.id === 'cama')!.y).toBeGreaterThan(midY);
  });
  it('las oberturas documentadas tienen su anchura y su fachada', () => {
    expect(op('obertura-7m').width).toBe(7);
    expect(op('obertura-7m').wallId).toBe('muro-A');
    expect(op('obertura-225-pb').width).toBe(2.25);
    expect(op('obertura-225-altell').width).toBe(2.25);
    expect(op('puerta-120').width).toBe(1.2);
    expect(op('puerta-120').wallId).toBe('muro-B');
    expect(op('puerta-70').width).toBe(0.7);
    expect(op('puerta-70').kind).toBe('puerta');
  });
  it('la puerta de 1,20 m está donde marca la cadena (9,50–10,70 m)', () => {
    expect(op('puerta-120').offset + 0.15).toBeCloseTo(9.5, 5);
  });
  it('la obertura de 7 m queda en la zona de día y no corta tabiques', () => {
    const o = op('obertura-7m');
    const start = o.offset + 0.15;
    expect(start).toBeGreaterThanOrEqual(x0('dia'));
    expect(issues.some((i) => i.elementId === o.id && i.level === 'conflicto')).toBe(false);
    expect(op('obertura-225-pb').height).toBe(3);
  });
  it('los huecos son reales en los muros (también el del altell)', () => {
    for (const o of layout.openings) {
      const w = layout.walls.find((x) => x.id === o.wallId)!;
      const block = wallPieces(w, layout.openings).filter((p) => p.s0 < o.offset + o.width - 1e-6 && p.s1 > o.offset + 1e-6 && p.z0 < o.sill + o.height - 1e-6 && p.z1 > o.sill + 1e-6);
      expect(block, o.id).toEqual([]);
    }
  });
  it('dos niveles: planta baja y altell con escalera entre ambos', () => {
    expect(layout.levels.map((l) => l.id)).toEqual(['pb', 'altell']);
    expect(layout.stairs[0].fromLevel).toBe('pb');
    expect(layout.stairs[0].toLevel).toBe('altell');
  });
  it('los trazos y marcas no interpretados se conservan como pendientes, no como estancias', () => {
    expect(layout.traces.map((t) => t.id)).toContain('borde-altell');
    expect(layout.traces.filter((t) => t.cross).length).toBeGreaterThan(3);
    expect(layout.rooms.some((r) => r.id.includes('trazo'))).toBe(false);
  });
  it('la escalera arranca junto al pasillo y sube hacia el frontal B (indicación de la propiedad)', () => {
    const st = layout.stairs[0];
    expect(st.up).toBe('+y');
    expect(st.upStatus).toBe('documentado');
    expect(st.rect[0]).toBeGreaterThanOrEqual(6);
  });
  it('entrada al baño desde el pasillo y armario al lado abierto al pasillo (propiedad)', () => {
    const b = room('bano').polygon;
    expect(Math.max(...b.map((p) => p[0]))).toBeCloseTo(5.95, 5);
    expect(op('puerta-bano').wallId).toBe('tab-pasillo');
    expect(op('puertas-armario').wallId).toBe('tab-pasillo');
    const arm = room('armario-pasillo').polygon;
    expect(Math.max(...arm.map((p) => p[0]))).toBeLessThan(op('puerta-bano').offset + 3.55);
    expect(['ducha', 'inodoro', 'lavabo'].every((id) => layout.furniture.some((f) => f.id === id && f.roomId === 'bano'))).toBe(true);
  });
  it('acabados de la propiedad por defecto: cal muy clara, carpintería verde-gris, microcemento terracota claro', () => {
    const v = baseVariant();
    expect(v.presetId).toBe('ibicenca-griega');
    expect(v.finishes.carpinteria).toBe('verde-gris-claro');
    expect(v.finishes.suelo).toBe('microcemento-terracota-claro');
    expect(v.finishes.paredes).toBe('cal-muy-clara');
  });
  it('sofá en L, estufa, cocina e isla central (indicaciones de la propiedad)', () => {
    expect(layout.furniture.filter((f) => f.type === 'sofa-l')).toHaveLength(2);
    expect(layout.furniture.some((f) => f.type === 'estufa')).toBe(true);
    expect(layout.furniture.some((f) => f.type === 'isla')).toBe(true);
    expect(layout.furniture.some((f) => f.id === 'encimera')).toBe(true);
  });
  it('5 m de ancho, muro del frontal B de 0,60 m y resto de 0,30 m', () => {
    expect(layout.bounds.maxY - layout.bounds.minY).toBeCloseTo(5, 5);
    expect(layout.walls.find((w) => w.id === 'muro-B')!.thickness).toBe(0.6);
    expect(layout.walls.filter((w) => w.kind === 'exterior' && w.id !== 'muro-B').every((w) => w.thickness === 0.3)).toBe(true);
  });
  it('altell a 2,60 m solo sobre dormitorio y baño; la zona de día es doble altura', () => {
    expect(layout.levels.find((l) => l.id === 'altell')!.elevation).toBe(2.6);
    const alt = room('altell').polygon;
    expect(Math.max(...alt.map((p) => p[0]))).toBeLessThanOrEqual(6.05);
  });
  it('cubierta plana con vuelta catalana por dentro', () => {
    expect(layout.roofOptions).toHaveLength(1);
    expect(layout.roof?.type).toBe('plana');
    expect(layout.roof?.ceiling?.type).toBe('vuelta-catalana');
  });
  it('la puerta de 70 cm está en el baño', () => {
    const o = op('puerta-70');
    const x = o.offset + 0.15;
    expect(x).toBeGreaterThanOrEqual(3.55);
    expect(x + o.width).toBeLessThanOrEqual(5.95);
  });
  it('sin orientación definida', () => expect(layout.northDeg).toBeNull());
  it('genera vistas interiores por estancia, incluido el altell a su cota', () => {
    const cams = cameraPresets(layout);
    const alt = cams.find((c) => c.id === 'int-altell');
    expect(alt?.elevation).toBeCloseTo(2.6, 5);
    expect(cams.some((c) => c.id === 'fachada-A')).toBe(true);
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
