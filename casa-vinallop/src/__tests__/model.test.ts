import { describe, expect, it } from 'vitest';
import { buildTestModel } from '../data/modeloPrueba';
import { VINALLOP } from '../data/vinallop';
import { VINALLOP_ACTUAL } from '../data/vinallopActual';
import { cameraPresets } from '../model/cameras';
import { furnitureFootprint, pointInPolygon, polygonArea, wallPieces, wallSegmentRect } from '../model/geometry';
import { passages } from '../model/passages';
import { gardenPlants, pathSlabs } from '../model/garden';
import { soleraQuantities } from '../model/solera';
import { leafPose } from '../model/openings';
import { hasGeometry, resolveLayout, type Variant } from '../model/resolve';
import { validateLayout } from '../model/validate';
import { baseVariant } from '../state/store';
import { PROPUESTA_VENTANAS } from '../data/types';

const test = buildTestModel();
const variant = (o: Partial<Variant> = {}): Variant => ({ ...baseVariant(), id: 'v1', name: 'V1', ...o });

describe('Casa Vinallop (bocetos del 04/10/2026)', () => {
  const layout = resolveLayout(VINALLOP, baseVariant());
  const issues = validateLayout(layout);
  const room = (id: string) => layout.rooms.find((r) => r.id === id)!;
  const op = (id: string) => layout.openings.find((o) => o.id === id)!;
  const x0 = (id: string) => Math.min(...room(id).polygon.map((p) => p[0]));

  it('sin errores ni conflictos: la obertura de 2,40 m queda bajo el forjado (cara inferior a 2,50 m)', () => {
    expect(hasGeometry(VINALLOP)).toBe(true);
    const bad = issues.filter((i) => i.level !== 'aviso');
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
    expect(layout.slabs[0].thickness).toBe(0.3);
  });
  it('dos duchas enfrentadas: zona húmeda común al fondo del baño, de pared a pared (2,40 × 1,20 m)', () => {
    const d = layout.furniture.find((f) => f.id === 'ducha')!;
    const b = room('bano').polygon;
    expect(d.status).toBe('confirmado');
    expect(d.rot).toBe(0);
    expect(d.w).toBeCloseTo(2.4, 5);
    expect(d.d).toBeCloseTo(1.2, 5);
    expect(d.x - d.w / 2).toBeCloseTo(Math.min(...b.map((p) => p[0])), 5);
    expect(d.x + d.w / 2).toBeCloseTo(Math.max(...b.map((p) => p[0])), 5);
    expect(d.y + d.d / 2).toBeCloseTo(Math.max(...b.map((p) => p[1])), 5);
    // lavabo a la izquierda según se entra (lado de la escalera) e inodoro a la derecha
    const lav = layout.furniture.find((f) => f.id === 'lavabo')!;
    const wc = layout.furniture.find((f) => f.id === 'inodoro')!;
    expect(lav.x).toBeGreaterThan(d.x);
    expect(wc.x).toBeLessThan(d.x);
  });
  it('puerta de 70 cm abre hacia fuera y el armario del pasillo no tiene puertas', () => {
    expect(op('puerta-70').swing).toEqual({ hinge: 'fin', dir: 1 });
    expect(op('puertas-armario').kind).toBe('paso');
    expect(op('puertas-armario').system).toBeNull();
    const arm = layout.furniture.find((f) => f.id === 'armario-pasillo-mueble')!;
    expect(arm.open).toBe(true);
    expect(arm.color).toBeTruthy();
  });
  it('barandillas de cristal en el altell (libre en la llegada) y en el lado abierto de la escalera', () => {
    const st = layout.stairs[0];
    const r = layout.railings!.find((x) => x.id === 'barandilla-altell')!;
    const e = layout.railings!.find((x) => x.id === 'barandilla-escalera')!;
    expect([r.material, e.material]).toEqual(['vidrio', 'vidrio']);
    expect(e.points.every((p) => p[1] === st.rect[1])).toBe(true);
    expect(e.rise![1]).toBe(2.8);
    expect(r.levelId).toBe('altell');
    expect(r.points.every((p) => p[0] === 6.35)).toBe(true);
    // el borde del altell queda abierto justo en la llegada de la escalera
    expect(Math.max(...r.points.map((p) => p[1]))).toBeCloseTo(st.rect[1], 5);
  });
  it('altell diáfano con cama de matrimonio', () => {
    const camas = layout.furniture.filter((f) => f.type === 'cama' && f.roomId === 'altell');
    expect(camas).toHaveLength(1);
    expect(layout.walls.filter((w) => w.levelId === 'altell')).toEqual([]);
  });
  it('envolvente del informe: 16,33 m de largo (la cadena de 15,70 m es interior) y altura 6,20 m', () => {
    expect(layout.bounds.maxX - layout.bounds.minX).toBeCloseTo(16.33, 5);
    expect(layout.measures.find((m) => m.id === 'cadena')!.value).toBe(15.7);
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
    // la propiedad pasa a 7 m; el de 9 m queda como variante
    expect(op('obertura-7m').width).toBe(7);
    expect(op('obertura-7m').wallId).toBe('muro-A');
    expect(op('obertura-7m').status).toBe('confirmado');
    expect(layout.openings.some((o) => o.id === 'obertura-9m')).toBe(false);
    expect(resolveLayout(VINALLOP, variant({ options: { ...baseVariant().options, ventanal: '9' } })).openings.find((o) => o.id === 'obertura-9m')!.width).toBe(9);
    expect(op('obertura-225-pb').width).toBe(2.25);
    expect(op('obertura-225-altell').width).toBe(2.25);
    expect(op('puerta-120').width).toBe(1.2);
    expect(op('puerta-120').height).toBe(2.6);
    // puerta del baño: de vidrio y abierta a la zona húmeda de las duchas
    expect(op('puerta-70').glazed).toBe('mate');
    expect(op('puerta-120').wallId).toBe('muro-B');
    expect(op('puerta-70').width).toBe(0.7);
    expect(op('puerta-70').kind).toBe('puerta');
  });
  it('la puerta de 1,20 m está donde marca la cadena (9,50 m desde la cara interior del lateral)', () => {
    expect(op('puerta-120').offset + 0.15).toBeCloseTo(9.8, 5);
  });
  it('el ventanal de 7 m queda en la zona de día y no corta tabiques; la variante de 9 m sigue pendiente de cálculo', () => {
    const l9 = resolveLayout(VINALLOP, variant({ options: { ...baseVariant().options, ventanal: '9' } }));
    const o9 = l9.openings.find((x) => x.id === 'obertura-9m')!;
    expect(o9.status).not.toBe('confirmado');
    expect(validateLayout(l9).some((i) => i.elementId === o9.id && i.level === 'aviso')).toBe(true);
    const o = op('obertura-7m');
    const start = o.offset + 0.15;
    expect(start).toBeGreaterThanOrEqual(x0('dia'));
    expect(issues.some((i) => i.elementId === o.id && i.level === 'conflicto')).toBe(false);
    expect(op('obertura-225-pb').height).toBe(2.4);
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
    expect(layout.railings!.map((t) => t.id)).toContain('barandilla-altell');
    expect(layout.traces.filter((t) => t.cross).length).toBeGreaterThan(3);
    expect(layout.rooms.some((r) => r.id.includes('trazo'))).toBe(false);
  });
  it('la escalera arranca junto a la puerta y sube hacia el altell (propuesta que sustituye al sentido inicial)', () => {
    const st = layout.stairs[0];
    expect(st.up).toBe('-x');
    expect(st.upStatus).toBe('propuesto');
    expect(st.rect[0]).toBeGreaterThanOrEqual(6);
  });
  it('entrada al baño desde el pasillo y armario al lado abierto al pasillo (propiedad)', () => {
    const b = room('bano').polygon;
    expect(Math.max(...b.map((p) => p[0]))).toBeCloseTo(6.25, 5);
    expect(op('puerta-bano').wallId).toBe('tab-pasillo');
    expect(op('puertas-armario').wallId).toBe('tab-pasillo');
    const arm = room('armario-pasillo').polygon;
    expect(Math.max(...arm.map((p) => p[0]))).toBeLessThan(op('puerta-bano').offset + 3.85);
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
  it('5,22 m de ancho (informe), muro del frontal B de 0,60 m y resto de 0,30 m', () => {
    expect(layout.bounds.maxY - layout.bounds.minY).toBeCloseTo(5.22, 5);
    expect(layout.walls.find((w) => w.id === 'muro-B')!.thickness).toBe(0.6);
    expect(layout.walls.filter((w) => w.kind === 'exterior' && w.id !== 'muro-B').every((w) => w.thickness === 0.3)).toBe(true);
  });
  it('altell a 2,80 m (2,50 m libres por planta con forjado de 0,30 m) solo sobre dormitorio y baño', () => {
    const lvl = layout.levels.find((l) => l.id === 'altell')!;
    expect(lvl.elevation).toBe(2.8);
    expect(lvl.elevation - layout.slabs[0].thickness).toBeGreaterThanOrEqual(2.5);
    // altura libre del altell hasta la cubierta (descontando canto de cubierta y flecha de la bóveda)
    expect(layout.topHeight - (layout.roof?.thickness ?? 0) - (layout.roof?.ceiling?.rise ?? 0) - lvl.elevation).toBeGreaterThanOrEqual(2.5);
    const alt = room('altell').polygon;
    expect(Math.max(...alt.map((p) => p[0]))).toBeLessThanOrEqual(6.35);
  });
  it('cubierta plana (propiedad) con vuelta catalana por dentro; remate ibicenco propuesto e inclinada del informe para contrastar', () => {
    expect(layout.roofOptions.map((r) => r.type)).toEqual(['plana', 'plana-peto', 'un-agua']);
    expect(layout.roofOptions[0].status).toBe('confirmado');
    expect(layout.roofOptions[0].note).toMatch(/No está validada técnicamente/);
    expect(layout.roofOptions[1].status).toBe('propuesto');
    expect(layout.roofOptions[2].note).toMatch(/informe/);
    expect(layout.roof?.type).toBe('plana');
    expect(layout.roof?.ceiling?.type).toBe('vuelta-catalana');
    expect(layout.roof?.ceiling?.spacing).toBe(0.55);
  });
  it('la puerta de 70 cm está en el baño', () => {
    const o = op('puerta-70');
    const x = o.offset + 0.15;
    expect(x).toBeGreaterThanOrEqual(3.85);
    expect(x + o.width).toBeLessThanOrEqual(6.25);
  });
  it('norte a ≈22° en sentido horario desde el frontal A (captura de Mapas de Apple)', () => expect(layout.northDeg).toBe(22));
  it('genera vistas interiores por estancia, incluido el altell a su cota', () => {
    const cams = cameraPresets(layout);
    const alt = cams.find((c) => c.id === 'int-altell');
    expect(alt?.elevation).toBeCloseTo(2.8, 5);
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

describe('Casa Vinallop · estado actual (fotos antes de la reforma)', () => {
  const layout = resolveLayout(VINALLOP_ACTUAL, baseVariant());
  it('sin errores ni conflictos y con la misma huella que la reforma', () => {
    const bad = validateLayout(layout).filter((i) => i.level !== 'aviso');
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
    const ref = resolveLayout(VINALLOP, baseVariant()).bounds;
    expect(layout.bounds).toEqual(ref);
  });
  it('cuatro volúmenes (con la habitación pequeña) y cubiertas a un agua escalonadas hacia el frontal B', () => {
    const segs = layout.roofSegments!;
    expect(segs.map((s) => s.id)).toEqual(['cub-extremo', 'cub-anexo', 'cub-principal', 'cub-habitacion']);
    expect(segs[3].hy0).toBeLessThan(segs[2].hy0);
    expect(layout.rooms.map((r) => r.id)).toContain('habitacion-pequena');
    expect(layout.openings.find((o) => o.id === 'puerta-gris')!.wallId).toBe('b-habitacion');
    for (const s of segs) expect(s.hy0).toBeGreaterThan(s.hy1);
    expect(segs[0].hy0).toBeLessThan(segs[1].hy0);
    expect(segs[1].hy0).toBeLessThan(segs[2].hy0);
    expect(layout.roof).toBeNull();
    expect(layout.levels).toHaveLength(1);
  });
  it('solo el frontal B (0,60 m) es documentado; el resto, interpretado o pendiente; entorno de la parcela', () => {
    for (const w of layout.walls.filter((x) => x.facade === 'B')) {
      expect(w.thickness).toBe(0.6);
      expect(w.status).toBe('confirmado');
    }
    expect(layout.measures.find((m) => m.id === 'espesor-resto')!.status).toBe('confirmado');
    expect(layout.walls.filter((x) => x.facade !== 'B').every((x) => x.thickness === 0.4)).toBe(true);
    const rest = [...layout.walls.filter((x) => x.facade !== 'B'), ...layout.openings, ...layout.rooms, ...layout.roofSegments!];
    for (const x of rest) expect(['interpretado', 'pendiente']).toContain(x.status);
    expect(layout.site?.status).toBe('interpretado');
    // la reforma conserva el entorno pero sustituye la solera antigua por la solera en L
    expect(layout.site!.pavements.length).toBeGreaterThan(0);
    const reforma = resolveLayout(VINALLOP, baseVariant());
    expect(reforma.site!.pavements).toEqual([]);
    expect(reforma.site!.trees[0].c).toEqual(layout.site!.trees[0].c);
    expect(layout.phase).toBe('actual');
    expect(VINALLOP.phase).toBe('reforma');
  });
  it('la puerta de madera actual coincide con la entrada de 1,20 m de la reforma', () => {
    const w = layout.walls.find((x) => x.id === 'b-principal')!;
    const o = layout.openings.find((x) => x.id === 'puerta-madera')!;
    const x0 = w.a[0] + o.offset;
    expect(Math.abs(x0 - 9.8)).toBeLessThan(0.2);
    expect(Math.abs(x0 + o.width - 11.0)).toBeLessThan(0.2);
  });
  it('muros de las fachadas a la altura de su volumen', () => {
    const hA = (id: string) => layout.walls.find((x) => x.id === id)!.height;
    expect(hA('a-principal')).toBeGreaterThan(hA('b-principal'));
    expect(cameraPresets(layout).find((c) => c.id === 'fachada-B')!.target[0]).toBeCloseTo(16.33 / 2, 1);
  });
});

describe('Casa Vinallop · vistas, propuestas y mobiliario', () => {
  const layout = resolveLayout(VINALLOP, baseVariant());
  const views = layout.views ?? [];
  const inWall = (p: [number, number]) => layout.walls.some((w) => {
    const r = wallSegmentRect(w, -(w.ext?.[0] ?? 0), Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) + (w.ext?.[1] ?? 0));
    return pointInPolygon(p, r, -1e-3);
  });
  it('doce vistas preparadas (con detalle de celosía y corte)', () => {
    expect(views.length).toBeGreaterThanOrEqual(13);
    expect(views.some((v) => v.section)).toBe(true);
    expect(views.some((v) => v.hideRoof)).toBe(true);
  });
  it('ninguna cámara atraviesa muros ni muebles; las interiores están dentro de su estancia a ≈1,60 m', () => {
    // la zona húmeda de las duchas es transitable: no cuenta como mueble
    const fps = [...layout.furniture, ...(layout.outdoor?.furniture ?? [])].filter((f) => f.type !== 'alfombra' && f.type !== 'ducha').map((f) => furnitureFootprint(f));
    for (const v of views) {
      const p: [number, number] = [v.position[0], v.position[1]];
      expect(inWall(p), v.id).toBe(false);
      expect(fps.some((fp) => pointInPolygon(p, fp, -1e-3)), v.id).toBe(false);
      if (v.group === 'interior' && v.topDown) {
        // vista cenital 3D del interior: por encima de la casa, mirando a la planta
        expect(v.position[2]).toBeGreaterThan(8);
        expect(v.target[2]).toBe(0);
      } else if (v.group === 'interior') {
        const room = layout.rooms.find((r) => r.id === v.roomId)!;
        expect(pointInPolygon(p, room.polygon), v.id).toBe(true);
        expect(v.position[2]).toBeCloseTo(1.6, 1);
      } else {
        const b = layout.bounds;
        expect(p[0] < b.minX || p[0] > b.maxX || p[1] < b.minY || p[1] > b.maxY, v.id).toBe(true);
      }
    }
  });
  it('alternativas A/B de celosía y lámparas sin borrar lo confirmado', () => {
    const v = { ...baseVariant(), id: 'v', name: 'V', options: { ...baseVariant().options, celosia: 'B' as const, lamparas: 'B' as const, lamparasUbicacion: 'salon' as const } };
    const l2 = resolveLayout(VINALLOP, v);
    expect(l2.options.celosia).toBe('B');
    expect(l2.furniture.find((f) => f.id === 'ducha')!.status).toBe('confirmado');
    expect(l2.pendants!.find((g) => g.location === 'salon')!.points).toHaveLength(3);
  });
  it('la isla deja ≥ 0,90 m de paso hasta la cocina y la mesa del salón es de 110 × 80', () => {
    const p = passages(layout).find((x) => x.between === 'cocina · isla de obra' || x.between === 'isla de obra · cocina');
    expect(p!.width).toBeGreaterThanOrEqual(0.9);
    const mesa = layout.furniture.find((f) => f.id === 'mesa-salon')!;
    expect([mesa.w, mesa.d]).toEqual([1.1, 0.8]);
  });
  it('propuesta de ventanas: todas en su muro, sin conflictos y con el sol del sur-suroeste', () => {
    const v = { ...baseVariant(), options: { ...baseVariant().options, aberturas: PROPUESTA_VENTANAS } };
    const l2 = resolveLayout(VINALLOP, v);
    const nuevas = l2.openings.filter((o) => o.variantKey && PROPUESTA_VENTANAS.includes(o.variantKey));
    expect(nuevas.length).toBeGreaterThanOrEqual(9);
    expect(nuevas.every((o) => o.status === 'propuesto')).toBe(true);
    const ids = new Set(nuevas.map((o) => o.id));
    expect(validateLayout(l2).filter((i) => ids.has(i.elementId) && i.level !== 'aviso')).toEqual([]);
    // las ventanas altas quedan por debajo de la coronación del muro
    for (const o of nuevas) expect(o.sill + o.height).toBeLessThanOrEqual(l2.walls.find((w) => w.id === o.wallId)!.height);
  });
  it('variante de chimenea de obra: sustituye a la estufa y continúa el sofá de obra del lateral', () => {
    expect(layout.furniture.some((f) => f.id === 'estufa')).toBe(true);
    expect(layout.furniture.some((f) => f.id === 'chimenea-obra')).toBe(false);
    const l2 = resolveLayout(VINALLOP, { ...baseVariant(), options: { ...baseVariant().options, chimenea: 'obra' } });
    expect(l2.furniture.some((f) => f.id === 'estufa')).toBe(false);
    const ch = l2.furniture.find((f) => f.id === 'chimenea-obra')!;
    const sofa = l2.furniture.find((f) => f.id === 'sofa-lateral')!;
    expect(ch.y + ch.w / 2).toBeLessThanOrEqual(sofa.y - sofa.w / 2 + 1e-6);
    expect(validateLayout(l2).filter((i) => i.elementId === 'chimenea-obra')).toEqual([]);
  });
  it('variante de mesa redonda: sustituye a la rectangular, cuatro sillas y más paso hasta el ventanal', () => {
    const l2 = resolveLayout(VINALLOP, { ...baseVariant(), options: { ...baseVariant().options, mesaComedor: 'redonda' } });
    expect(l2.furniture.some((f) => f.id === 'mesa-comedor')).toBe(false);
    expect(l2.furniture.filter((f) => f.id.startsWith('silla-redonda'))).toHaveLength(4);
    expect(l2.furniture.filter((f) => f.id.startsWith('silla-comedor'))).toHaveLength(0);
    const ids = new Set(l2.furniture.filter((f) => f.onlyIf?.mesaComedor === 'redonda').map((f) => f.id));
    expect(validateLayout(l2).filter((i) => ids.has(i.elementId))).toEqual([]);
    const minY = (l: typeof l2, pre: string) => Math.min(...l.furniture.filter((f) => f.id.startsWith(pre)).flatMap((f) => furnitureFootprint(f).map((p) => p[1])));
    expect(minY(l2, 'silla-redonda')).toBeGreaterThan(minY(layout, 'silla-comedor') + 0.1);
  });
  it('variante de salón con sofás enfrentados y comedor en el rincón de la cristalera, sin conflictos', () => {
    const l2 = resolveLayout(VINALLOP, { ...baseVariant(), options: { ...baseVariant().options, salon: 'enfrentados' } });
    for (const id of ['sofa-b', 'sofa-lateral', 'estufa', 'mesa-comedor', 'mesa-salon']) expect(l2.furniture.some((f) => f.id === id), id).toBe(false);
    const [s1, s2] = ['sofa-enfrentado-1', 'sofa-enfrentado-2'].map((id) => l2.furniture.find((f) => f.id === id)!);
    // perpendiculares a los frontales (largo según Y) y mirándose
    expect([s1.rot, s2.rot].sort()).toEqual([270, 90].sort());
    expect(Math.abs(s1.y - s2.y)).toBeLessThan(1e-6);
    const ids = new Set(l2.furniture.filter((f) => f.onlyIf?.salon === 'enfrentados').map((f) => f.id));
    expect(ids.size).toBe(8);
    expect(validateLayout(l2).filter((i) => ids.has(i.elementId))).toEqual([]);
  });
  it('jardín seco de la entrada hasta los olivos, con paseos de losas a las dos puertas del frontal B', () => {
    const g = layout.outdoor!.garden!;
    const plants = gardenPlants(g);
    expect(plants.length).toBeGreaterThan(150);
    expect(new Set(plants.map((p) => p.s)).size).toBe(6);
    // ninguna mata sobre los paseos
    for (const p of g.paths) expect(plants.some((pl) => Math.abs(pl.x - p.x) < p.width / 2 && pl.y > p.y0 && pl.y < p.y1)).toBe(false);
    // cada paseo arranca delante de una puerta del frontal B
    const doors = layout.openings.filter((o) => o.wallId === 'muro-B' && o.kind === 'puerta');
    for (const p of g.paths) expect(doors.some((d) => p.x > d.offset + 0.15 && p.x < d.offset + 0.15 + d.width)).toBe(true);
    // las bajas delante y las altas al fondo
    const depth = (id: string) => { const l = plants.filter((p) => p.s === id); return l.reduce((a, p) => a + p.y, 0) / l.length; };
    expect(depth('lavanda')).toBeLessThan(depth('verbena'));
    expect(pathSlabs(g.paths[0]).length).toBeGreaterThan(8);
  });
  it('cambios de la propiedad: dormitorio, inodoro, recibidor, alcorque y cuarto técnico', () => {
    const f = (id: string) => layout.furniture.find((x) => x.id === id)!;
    const box = (id: string) => { const fp = furnitureFootprint(f(id)); return { x0: Math.min(...fp.map((p) => p[0])), x1: Math.max(...fp.map((p) => p[0])), y0: Math.min(...fp.map((p) => p[1])), y1: Math.max(...fp.map((p) => p[1])) }; };
    // el armario ya no queda junto a la cama: paso libre de ≥ 1 m al lado de la cama
    const cama = box('cama');
    const arm = box('armario');
    expect(arm.y1).toBeLessThan(cama.y0);
    expect(cama.x0 - 0.3).toBeGreaterThanOrEqual(1.0);
    expect(f('armario-cristal').w).toBeLessThan(1);
    expect(box('armario-cristal').y0).toBeCloseTo(0.3, 5);
    // inodoro a ≥ 0,75 m de la zona húmeda
    expect(box('ducha').y0 - box('inodoro').y1).toBeGreaterThanOrEqual(0.75);
    // recibidor: banco junto a la puerta, sofá 50 cm más allá
    expect(box('banco-recibidor').x0).toBeGreaterThanOrEqual(9.8 + 1.2);
    expect(box('sofa-b').x0).toBeGreaterThanOrEqual(box('banco-recibidor').x1);
    // alcorque más grande que antes pero por debajo de 4 m de diámetro
    const r = layout.outdoor!.pavements.find((p) => p.permeable)!.permeable!.r;
    expect(r * 2).toBeGreaterThan(2.4);
    expect(r * 2).toBeLessThan(4);
    // cuarto técnico de 2,50 × ancho de la casa, bajado a 2,75 m (terraza enrasada con el altell), con acceso exterior
    const ct = layout.outdoor!.annexes![0];
    expect(ct.rect[2] - ct.rect[0]).toBeCloseTo(2.5, 5);
    expect(ct.rect[3] - ct.rect[1]).toBeCloseTo(layout.bounds.maxY - layout.bounds.minY, 5);
    expect(ct.height).toBe(2.75);
    // cristalera de 7 m por defecto
    expect(layout.options.ventanal).toBe('7');
  });
  it('escalera recta contra el frontal B que desembarca en el altell: 15 tabicas ≤ 0,20 m, 14 huellas ≥ 0,24 m, sin compensados; cocina e isla sin conflictos', () => {
    const esc = layout.stairs[0];
    expect(esc.up).toBe('-x');
    expect(esc.winderEnd).toBeUndefined();
    expect(esc.topFlush).toBe(true);
    expect(2.8 / esc.risers).toBeLessThanOrEqual(0.2);
    const tread = (esc.rect[2] - esc.rect[0]) / (esc.risers - 1);
    expect(tread).toBeGreaterThanOrEqual(0.24);
    // llega al borde del altell, contra el frontal B, y no invade el barrido de la puerta de entrada
    expect(esc.rect[0]).toBe(6.35);
    expect(esc.rect[3]).toBeCloseTo(4.62, 5);
    expect(esc.rect[3] - esc.rect[1]).toBeGreaterThanOrEqual(0.9 - 1e-9);
    const door = layout.openings.find((o) => o.id === 'puerta-120')!;
    expect(esc.rect[2]).toBeLessThanOrEqual(0.15 + door.offset);
    expect(door.swing!.hinge).toBe('fin');
    // cocina contra el tabique del baño, entre el pasillo y la escalera; isla a 1,00 m
    const enc = layout.furniture.find((f) => f.id === 'encimera')!;
    const fe = furnitureFootprint(enc);
    expect(Math.min(...fe.map((p) => p[0]))).toBeCloseTo(6.35, 5);
    expect(Math.max(...fe.map((p) => p[1]))).toBeLessThanOrEqual(esc.rect[1] + 1e-6);
    expect(Math.min(...fe.map((p) => p[1]))).toBeGreaterThanOrEqual(1.25);
    const isla = furnitureFootprint(layout.furniture.find((f) => f.id === 'isla')!);
    expect(Math.min(...isla.map((p) => p[0])) - Math.max(...fe.map((p) => p[0]))).toBeGreaterThanOrEqual(1.0 - 1e-6);
    expect(esc.rect[1] - Math.max(...isla.map((p) => p[1]))).toBeGreaterThanOrEqual(0.7);
    expect(layout.furniture.some((f) => f.underStair)).toBe(false);
    expect(layout.furniture.filter((f) => f.id.startsWith('silla-comedor'))).toHaveLength(4);
    const ids = new Set(['mesa-comedor', 'encimera', 'isla', ...[1, 2, 3].map((i) => `taburete-${i}`), ...[1, 2, 3, 4].map((i) => `silla-comedor-${i}`)]);
    expect(validateLayout(layout).filter((i) => ids.has(i.elementId))).toEqual([]);
  });
  it('terraza del altell sobre el cuarto técnico bajado, enrasada con el altell, con puerta en el lateral izquierdo y sin escalones exteriores', () => {
    const ct = layout.outdoor!.annexes![0];
    expect(ct.height).toBe(2.75);
    expect(ct.terrace!.parapet).toBeGreaterThanOrEqual(1.0);
    expect(ct.terrace!.gap).toBeUndefined();
    expect(layout.outdoor!.wallSteps ?? []).toEqual([]);
    const door = layout.openings.find((o) => o.id === 'puerta-terraza')!;
    expect(door.wallId).toBe('muro-izquierdo');
    // la terraza (cubierta + pavimento) queda a menos de 5 cm del suelo del altell
    expect(Math.abs(ct.height + 0.03 - 2.8)).toBeLessThan(0.05);
    expect(door.sill).toBe(2.8);
    expect(door.sill + door.height).toBeLessThan(6.2 - 0.3);
    const cama = layout.furniture.find((f) => f.id === 'cama-altell')!;
    expect(0.15 + door.offset + door.width).toBeLessThan(cama.y - cama.d / 2);
  });
  it('editar un mueble en una variante lo marca como propuesto sin tocar la base', () => {
    const v = { ...baseVariant(), id: 'v', name: 'V', furnitureOverrides: { isla: { x: 9.0, w: 1.8 } } };
    const l2 = resolveLayout(VINALLOP, v);
    const isla = l2.furniture.find((f) => f.id === 'isla')!;
    expect([isla.x, isla.w, isla.status]).toEqual([9.0, 1.8, 'propuesto']);
    expect(layout.furniture.find((f) => f.id === 'isla')!.x).toBe(8.45);
  });
  it('solera en L confirmada: frontal A de punta a punta y 4 m en el lateral, sin solera en la entrada, esquina contada una vez y alcorque permeable', () => {
    const o = layout.outdoor!;
    expect(o.furniture.filter((f) => f.type === 'silla-exterior')).toHaveLength(8);
    const fr = o.pavements.find((p) => p.id === 'solera-l-frontal-a')!;
    const la = o.pavements.find((p) => p.id === 'solera-l-lateral')!;
    expect([fr.status, la.status]).toEqual(['confirmado', 'confirmado']);
    expect(fr.rect[0]).toBe(layout.bounds.minX);
    expect(fr.rect[2]).toBe(layout.bounds.maxX);
    expect(fr.rect[3]).toBe(layout.bounds.minY);
    // ningún tramo de solera delante del frontal B (puerta de entrada) a lo largo de la casa
    expect(o.pavements.filter((p) => p.joints > 0 && p.rect[3] > layout.bounds.maxY && p.rect[0] < layout.bounds.maxX)).toEqual([]);
    expect(la.rect[2] - la.rect[0]).toBeCloseTo(4, 5);
    expect(la.permeable!.r).toBeGreaterThan(1);
    expect(layout.site!.trees[0].c).toEqual(la.permeable!.c);
    const q = soleraQuantities(layout)!;
    expect(q.overlap).toBeCloseTo(0, 1); // los tramos se tocan en la esquina sin solaparse
    expect(q.area).toBeCloseTo(q.grossSum - q.overlap - q.excluded, 1);
    // mesa redonda de Ø 1,80 con pie cilíndrico y lámpara de cúpula con anclaje sin resolver
    const mesa = o.furniture.find((f) => f.type === 'mesa-exterior')!;
    expect(mesa.w).toBe(1.8);
    // mesa bajo la copa del algarrobo, sobre el tramo lateral y sin pisar el alcorque
    const arbol = layout.site!.trees[0];
    expect(Math.hypot(mesa.x - arbol.c[0], mesa.y - arbol.c[1])).toBeLessThan(arbol.r - 1);
    for (const sl of o.furniture.filter((f) => f.type === 'silla-exterior')) {
      expect(Math.hypot(sl.x - la.permeable!.c[0], sl.y - la.permeable!.c[1])).toBeGreaterThan(la.permeable!.r + 0.5);
      expect(sl.x - 0.3).toBeGreaterThan(la.rect[0]);
      expect(sl.x + 0.3).toBeLessThan(la.rect[2]);
      expect(sl.y - 0.3).toBeGreaterThan(la.rect[1]);
    }
    // el tramo lateral termina al ras del frontal B
    expect(la.rect[3]).toBe(layout.bounds.maxY);
    expect(o.domeLamp!.note).toMatch(/SIN RESOLVER/);
    expect(o.lights).toEqual([]);
  });
  it('sin planta decorativa en el comedor', () => {
    expect(layout.furniture.some((f) => f.type === 'maceta')).toBe(false);
  });
  it('volta catalana confirmada en terracota con vigas cada 0,55 m; contraste de dimensiones pendiente', () => {
    expect(layout.roof!.ceiling!.status).toBe('confirmado');
    expect(baseVariant().finishes.boveda).toBe('terracota-volta');
    expect(baseVariant().finishes.vigas).toBe('cemento-gris');
    expect(layout.checks!.find((c) => c.label.startsWith('Dimensiones'))!.status).toBe('documentado');
    expect(layout.checks!.find((c) => c.label.startsWith('Superficie construida'))!.status).toBe('pendiente');
    expect(layout.references!.filter((r) => !r.consulted).map((r) => r.id)).toEqual(['ref-color-techo']);
  });
});
