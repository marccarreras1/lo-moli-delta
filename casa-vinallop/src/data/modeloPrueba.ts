/**
 * MODELO DE PRUEBA — geometría FICTICIA para probar la interfaz.
 * No representa Casa Vinallop ni ninguna vivienda real. La interfaz lo
 * identifica siempre como «Modelo de prueba».
 */
import type { Furniture, Opening, ProjectData, Room, Vec2, Wall } from './types';

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  [r4(x0), r4(y0)], [r4(x1), r4(y0)], [r4(x1), r4(y1)], [r4(x0), r4(y1)],
];

export function buildTestModel(): ProjectData {
  const L = 12;
  const W = 6;
  const t = 0.3;
  const tp = 0.1;
  const H = 2.7;
  const h = t / 2;
  const x0 = t, x1 = L - t, y0 = t, y1 = W - t;
  const xd = 3.8; // tabique dormitorio
  const xb1 = 6.0; // tabique baño / día
  const yb = 2.6; // frente del baño
  const xs0 = xb1 + tp;
  const xc = 8.6; // límite cocina / sala
  const lv = 'pb';
  const ext = { levelId: lv, thickness: t, height: H, kind: 'exterior' as const, status: 'interpretado' as const, sourceId: 'prueba' };
  const tab = { levelId: lv, thickness: tp, height: H, kind: 'tabique' as const, status: 'propuesto' as const, sourceId: 'prueba' };
  const walls: Wall[] = [
    { ...ext, id: 'muro-posterior', facade: 'posterior', a: [h, h], b: [L - h, h], ext: [h, h] },
    { ...ext, id: 'muro-derecho', facade: 'derecho', a: [L - h, h], b: [L - h, W - h], ext: [-h, -h] },
    { ...ext, id: 'muro-principal', facade: 'principal', a: [h, W - h], b: [L - h, W - h], ext: [h, h] },
    { ...ext, id: 'muro-izquierdo', facade: 'izquierdo', a: [h, h], b: [h, W - h], ext: [-h, -h] },
    { ...tab, id: 'tab-dormitorio', a: [xd + tp / 2, y0], b: [xd + tp / 2, y1] },
    { ...tab, id: 'tab-bano-dia', a: [xb1 + tp / 2, y0], b: [xb1 + tp / 2, yb + tp] },
    { ...tab, id: 'tab-bano-paso', a: [xd + tp, yb + tp / 2], b: [xb1, yb + tp / 2] },
  ];
  const op = (o: Omit<Opening, 'status' | 'sourceId'> & Partial<Pick<Opening, 'status'>>): Opening => ({ status: 'propuesto', sourceId: 'prueba', ...o });
  const openings: Opening[] = [
    op({ id: 'cristalera', label: 'Cristalera de la sala', wallId: 'muro-principal', kind: 'cristalera', offset: r4(6.4 - h), width: 5.0, sill: 0, height: 2.2, system: { type: 'corredera', leaves: 4, status: 'propuesto' } }),
    op({ id: 'ventana-dormitorio', label: 'Ventana del dormitorio', wallId: 'muro-principal', kind: 'ventana', offset: r4(1.2 - h), width: 1.2, sill: 0.9, height: 1.2, system: { type: 'abatible', leaves: 2, status: 'propuesto' } }),
    op({ id: 'ventana-bano', label: 'Ventana del baño', wallId: 'muro-posterior', kind: 'ventana', offset: r4(4.5 - h), width: 0.6, sill: 1.5, height: 0.7, system: { type: 'abatible', leaves: 1, status: 'pendiente' }, status: 'pendiente' }),
    op({ id: 'ventana-cocina', label: 'Ventana de la cocina', wallId: 'muro-posterior', kind: 'ventana', offset: r4(7.0 - h), width: 1.0, sill: 1.1, height: 1.0, system: null, status: 'pendiente', note: 'Sistema de apertura no definido.' }),
    op({ id: 'puerta-entrada', label: 'Puerta de entrada', wallId: 'muro-posterior', kind: 'puerta', offset: r4(9.6 - h), width: 0.9, sill: 0, height: 2.1, system: { type: 'abatible', leaves: 1, status: 'propuesto' }, swing: { hinge: 'fin', dir: 1 } }),
    op({ id: 'puerta-dormitorio', label: 'Puerta del dormitorio', wallId: 'tab-dormitorio', kind: 'puerta', offset: r4(y1 - 1.2 - y0), width: 0.8, sill: 0, height: 2.1, system: { type: 'abatible', leaves: 1, status: 'propuesto' }, swing: { hinge: 'fin', dir: 1 } }),
    op({ id: 'puerta-bano', label: 'Puerta del baño', wallId: 'tab-bano-paso', kind: 'puerta', offset: 0.4, width: 0.7, sill: 0, height: 2.1, system: { type: 'abatible', leaves: 1, status: 'propuesto' }, swing: { hinge: 'inicio', dir: -1 } }),
  ];
  const room = (id: string, name: string, poly: Vec2[], extra: Partial<Room> = {}): Room => ({ id, levelId: lv, name, polygon: poly, status: 'propuesto', sourceId: 'prueba', ...extra });
  const rooms: Room[] = [
    room('dormitorio', 'Dormitorio', rect(x0, y0, xd, y1)),
    room('bano', 'Baño', rect(xd + tp, y0, xb1, yb)),
    room('paso', 'Paso', rect(xd + tp, yb + tp, xs0, y1), { openTo: ['cocina'] }),
    room('cocina', 'Cocina', rect(xs0, y0, xc, y1), { openTo: ['sala', 'paso'] }),
    room('sala', 'Sala', rect(xc, y0, x1, y1), { openTo: ['cocina'], status: 'pendiente', note: 'Ejemplo de estancia con medidas pendientes.' }),
  ];
  const f = (x: Furniture) => x;
  const bedCy = y1 - 1.2;
  const furniture: Furniture[] = [
    f({ id: 'cama', type: 'cama', label: 'Cama 150 × 200', roomId: 'dormitorio', x: x0 + 1.0, y: bedCy, w: 1.5, d: 2.0, h: 0.55, rot: 270 }),
    f({ id: 'mesita-1', type: 'mesita', label: 'Mesita', roomId: 'dormitorio', x: x0 + 0.2, y: bedCy + 0.75 + 0.225, w: 0.4, d: 0.45, h: 0.5, rot: 0 }),
    f({ id: 'mesita-2', type: 'mesita', label: 'Mesita', roomId: 'dormitorio', x: x0 + 0.2, y: bedCy - 0.75 - 0.225, w: 0.4, d: 0.45, h: 0.5, rot: 0 }),
    f({ id: 'armario', type: 'armario', label: 'Armario', roomId: 'dormitorio', x: x0 + 1.3, y: y0 + 0.3, w: 2.0, d: 0.6, h: 2.2, rot: 0 }),
    f({ id: 'ducha', type: 'ducha', label: 'Plato de ducha', roomId: 'bano', x: (xd + tp + xb1) / 2, y: y0 + 0.4, w: xb1 - xd - tp, d: 0.8, h: 2.0, rot: 0 }),
    f({ id: 'lavabo', type: 'lavabo', label: 'Lavabo', roomId: 'bano', x: xd + tp + 0.225, y: y0 + 1.4, w: 0.6, d: 0.45, h: 0.85, rot: 270 }),
    f({ id: 'inodoro', type: 'inodoro', label: 'Inodoro', roomId: 'bano', x: xb1 - 0.325, y: y0 + 1.35, w: 0.38, d: 0.65, h: 0.42, rot: 90 }),
    f({ id: 'encimera', type: 'encimera', label: 'Cocina lineal', roomId: 'cocina', x: xs0 + 0.9, y: y0 + 0.31, w: 1.8, d: 0.62, h: 0.9, rot: 0 }),
    f({ id: 'nevera', type: 'nevera', label: 'Frigorífico', roomId: 'cocina', x: xs0 + 2.15, y: y0 + 0.325, w: 0.6, d: 0.65, h: 1.85, rot: 0 }),
    f({ id: 'mesa', type: 'mesa', label: 'Mesa', roomId: 'cocina', x: xs0 + 1.25, y: 3.4, w: 1.4, d: 0.8, h: 0.75, rot: 0 }),
    f({ id: 'silla-1', type: 'silla', label: 'Silla', roomId: 'cocina', x: xs0 + 0.9, y: 2.75, w: 0.45, d: 0.48, h: 0.8, rot: 0 }),
    f({ id: 'silla-2', type: 'silla', label: 'Silla', roomId: 'cocina', x: xs0 + 1.6, y: 2.75, w: 0.45, d: 0.48, h: 0.8, rot: 0 }),
    f({ id: 'silla-3', type: 'silla', label: 'Silla', roomId: 'cocina', x: xs0 + 0.9, y: 4.05, w: 0.45, d: 0.48, h: 0.8, rot: 180 }),
    f({ id: 'silla-4', type: 'silla', label: 'Silla', roomId: 'cocina', x: xs0 + 1.6, y: 4.05, w: 0.45, d: 0.48, h: 0.8, rot: 180 }),
    f({ id: 'alfombra', type: 'alfombra', label: 'Alfombra', roomId: 'sala', x: 10.15, y: 3.0, w: 2.2, d: 1.6, h: 0.01, rot: 0 }),
    f({ id: 'sofa', type: 'sofa', label: 'Sofá', roomId: 'sala', x: 10.15, y: 1.85, w: 2.1, d: 0.9, h: 0.8, rot: 0 }),
    f({ id: 'mesa-centro', type: 'mesa-centro', label: 'Mesa baja', roomId: 'sala', x: 10.15, y: 3.15, w: 1.0, d: 0.6, h: 0.4, rot: 0 }),
  ];
  return {
    id: 'modelo-prueba',
    name: 'Modelo de prueba',
    isTest: true,
    version: 'prueba',
    levels: [{ id: lv, name: 'Planta baja', elevation: 0, wallHeight: H }],
    walls, openings, rooms, furniture,
    slabs: [], stairs: [], traces: [], readings: [], discrepancies: [], questions: [],
    roofOptions: [
      { type: 'dos-aguas', label: 'Dos aguas', pitchDeg: 18, overhang: 0.25, thickness: 0.18, status: 'propuesto', note: 'Alternativa del modelo de prueba.' },
      { type: 'un-agua', label: 'Un agua', pitchDeg: 8, overhang: 0.25, thickness: 0.18, status: 'propuesto', note: 'Alternativa del modelo de prueba.' },
      { type: 'plana', label: 'Plana', pitchDeg: 0, overhang: 0, thickness: 0.25, status: 'propuesto', note: 'Alternativa del modelo de prueba.', parapet: 0.4 },
    ],
    measures: [
      { id: 'largo', label: 'Largo exterior', value: L, unit: 'm', decimals: 2, sourceId: 'prueba', status: 'interpretado' },
      { id: 'ancho', label: 'Ancho exterior', value: W, unit: 'm', decimals: 2, sourceId: 'prueba', status: 'interpretado' },
      { id: 'altura', label: 'Altura de muros', value: H, unit: 'm', decimals: 2, sourceId: 'prueba', status: 'pendiente' },
    ],
    sources: [{ id: 'prueba', label: 'Geometría ficticia de prueba', detail: 'No procede de ningún documento.' }],
    northDeg: null,
    facades: { principal: 'Fachada principal', derecho: 'Lateral derecho', posterior: 'Fachada posterior', izquierdo: 'Lateral izquierdo' },
    notices: ['Modelo de prueba: geometría ficticia para probar la interfaz. No es Casa Vinallop.'],
  };
}
