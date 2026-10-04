/**
 * CASA VINALLOP · ESTADO ACTUAL (antes de la reforma), interpretado a partir de las
 * fotografías de la propiedad (dron y suelo, 04/10/2026).
 *
 * Mismo sistema de coordenadas que la reforma (src/data/vinallop.ts): X hacia la
 * derecha del papel, Y hacia abajo; Y = 0 frontal A, Y = 5,00 frontal B (el de las
 * puertas y la solera).
 *
 * LECTURA DE LAS FOTOS
 * - Casa de una planta, encalada, con tres volúmenes y cubiertas de fibrocemento a un
 *   agua que caen hacia el frontal B (canalón y bajante en ese lado).
 * - De izquierda a derecha: volumen del extremo (bajo), anexo y volumen principal (el
 *   más alto, con hastial que asoma sobre el anexo).
 * - Proporciones medidas en la vista cenital y escaladas al largo de 15,70 m de los
 *   bocetos; puertas situadas con una corrección de perspectiva sobre la vista oblicua.
 * - Alturas estimadas tomando una puerta como ≈2,00 m de referencia.
 *
 * Todo es INTERPRETADO (±0,3 m en planta y ±0,2 m en altura) salvo lo que se marca
 * como pendiente. No hay medidas escritas del estado actual.
 */
import { FOTOS_PARCELA, PARCELA } from './parcela';
import type { Opening, ProjectData, Room, RoofSegment, Vec2, Wall } from './types';

const L = 15.7;
const W = 5;
const T = 0.3;
const TB = 0.6;
const h = T / 2;
const yB = W - TB / 2; // eje del frontal B
/** límites entre volúmenes (ejes de los muros transversales) */
const X1 = 1.8;
const X2 = 5.6;
/** aleros: alto en el frontal A, bajo en el frontal B */
const H = {
  extremo: { a: 2.45, b: 2.3 },
  anexo: { a: 2.95, b: 2.45 },
  principal: { a: 3.55, b: 2.75 },
};

const F = FOTOS_PARCELA.id;
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const ext = { levelId: 'pb', thickness: T, kind: 'exterior' as const, status: 'interpretado' as const, sourceId: F };

const walls: Wall[] = [
  { ...ext, id: 'a-extremo', facade: 'A', a: [h, h], b: [X1, h], ext: [h, 0], height: H.extremo.a },
  { ...ext, id: 'a-anexo', facade: 'A', a: [X1, h], b: [X2, h], height: H.anexo.a },
  { ...ext, id: 'a-principal', facade: 'A', a: [X2, h], b: [L - h, h], ext: [0, h], height: H.principal.a },
  { ...ext, id: 'b-principal', facade: 'B', thickness: TB, a: [X2, yB], b: [L - h, yB], ext: [0, h], height: H.principal.b },
  { ...ext, id: 'b-extremo', facade: 'B', thickness: TB, a: [h, yB], b: [X1, yB], ext: [h, 0], height: H.extremo.b },
  { ...ext, id: 'b-anexo', facade: 'B', thickness: TB, a: [X1, yB], b: [X2, yB], height: H.anexo.b },
  { ...ext, id: 'lateral-izquierdo', facade: 'izquierdo', a: [h, h], b: [h, yB], ext: [-h, -TB / 2], height: H.extremo.b },
  { ...ext, id: 'lateral-derecho', facade: 'derecho', a: [L - h, h], b: [L - h, yB], ext: [-h, -TB / 2], height: H.principal.b },
  // muros entre volúmenes (los hastiales que asoman sobre la cubierta vecina los dibuja la cubierta)
  { ...ext, kind: 'tabique', id: 'muro-extremo-anexo', a: [X1, T], b: [X1, W - TB], height: H.anexo.b },
  { ...ext, kind: 'tabique', id: 'muro-anexo-principal', a: [X2, T], b: [X2, W - TB], height: H.principal.b },
];

const door = (id: string, label: string, wallId: string, x0: number, x1: number, wallA: number, height: number, leaves: number, note: string): Opening => ({
  id, label, wallId, kind: 'puerta', offset: Math.round((x0 - wallA) * 100) / 100, width: Math.round((x1 - x0) * 100) / 100, sill: 0, height,
  system: { type: 'abatible', leaves, status: 'interpretado' }, status: 'interpretado', sourceId: F, note,
});

const openings: Opening[] = [
  door('puerta-extremo', 'Puerta del volumen del extremo', 'b-extremo', 0.85, 1.55, h, 2.0, 1, 'Puerta metálica gris (vista oblicua).'),
  door('puerta-anexo', 'Puerta del anexo', 'b-anexo', 3.55, 4.55, X1, 2.0, 2, 'Hueco con dos hojas abiertas hacia fuera: una metálica gris y otra de madera (vista oblicua).'),
  door('puerta-madera', 'Puerta de madera (volumen principal)', 'b-principal', 9.4, 10.6, X2, 2.1, 2, 'Puerta de madera de dos hojas. Coincide con la posición de la puerta de entrada de 1,20 m de la reforma (9,50–10,70 m).'),
  door('puerta-gris', 'Puerta metálica (extremo derecho)', 'b-principal', 13.5, 14.4, X2, 2.0, 1, 'Puerta metálica gris cerca del extremo derecho (vista oblicua).'),
  {
    id: 'ventana-a', label: 'Ventana del frontal A', wallId: 'a-principal', kind: 'ventana', offset: 5.4, width: 0.6, sill: 1.3, height: 0.6,
    system: null, status: 'pendiente', sourceId: F, note: 'Ventana pequeña vista desde el lado del frontal A; posición y tamaño sin comprobar.',
  },
];

const room = (id: string, name: string, x0: number, x1: number, note: string): Room => ({
  id, levelId: 'pb', name, polygon: rect(x0, T, x1, W - TB), status: 'interpretado', sourceId: F, note,
});

const rooms: Room[] = [
  room('vol-extremo', 'Volumen del extremo', T, X1 - h, 'Interior no fotografiado: distribución y uso desconocidos.'),
  room('vol-anexo', 'Anexo', X1 + h, X2 - h, 'Interior no fotografiado: distribución y uso desconocidos.'),
  room('vol-principal', 'Volumen principal', X2 + h, L - T, 'Interior no fotografiado: tabiques, si los hay, desconocidos.'),
];

const roofSegments: RoofSegment[] = [
  { id: 'cub-extremo', label: 'Cubierta del volumen del extremo', rect: [0, 0, X1, W], hy0: H.extremo.a, hy1: H.extremo.b, overhang: 0.1, material: 'fibrocemento', status: 'interpretado', sourceId: F, note: 'Fibrocemento, casi plana, la más baja.' },
  { id: 'cub-anexo', label: 'Cubierta del anexo', rect: [X1, 0, X2, W], hy0: H.anexo.a, hy1: H.anexo.b, overhang: 0.15, material: 'fibrocemento', status: 'interpretado', sourceId: F, note: 'Fibrocemento a un agua hacia el frontal B.' },
  { id: 'cub-principal', label: 'Cubierta del volumen principal', rect: [X2, 0, L, W], hy0: H.principal.a, hy1: H.principal.b, overhang: 0.15, material: 'fibrocemento', status: 'interpretado', sourceId: F, note: 'Fibrocemento a un agua hacia el frontal B, con chimenea; su hastial asoma sobre el anexo.' },
];

export const VINALLOP_ACTUAL: ProjectData = {
  id: 'casa-vinallop-actual',
  name: 'Casa Vinallop · estado actual',
  isTest: false,
  phase: 'actual',
  version: '0.1 · fotos de la casa antes de la reforma (04/10/2026)',
  levels: [{ id: 'pb', name: 'Planta baja', elevation: 0, wallHeight: H.principal.b, elevationStatus: 'interpretado' }],
  walls,
  openings,
  rooms,
  furniture: [],
  slabs: [],
  stairs: [],
  traces: [],
  roofOptions: [],
  roofSegments,
  site: PARCELA,
  measures: [
    { id: 'largo', label: 'Largo total', value: L, unit: 'm', decimals: 2, sourceId: 'boceto-planta-baixa', status: 'documentado', note: 'Se toma el de los bocetos (cadena de cotas).' },
    { id: 'ancho', label: 'Ancho', value: W, unit: 'm', decimals: 2, sourceId: 'indicacion-propiedad', status: 'documentado' },
    { id: 'vol-extremo', label: 'Largo del volumen del extremo', value: X1, unit: 'm', decimals: 1, sourceId: F, status: 'interpretado', note: 'Proporción de la vista cenital.' },
    { id: 'vol-anexo', label: 'Largo del anexo', value: X2 - X1, unit: 'm', decimals: 1, sourceId: F, status: 'interpretado', note: 'Proporción de la vista cenital.' },
    { id: 'vol-principal', label: 'Largo del volumen principal', value: L - X2, unit: 'm', decimals: 1, sourceId: F, status: 'interpretado', note: 'Proporción de la vista cenital.' },
    { id: 'alero-principal', label: 'Aleros del volumen principal (A / B)', value: H.principal.a, unit: 'm', decimals: 1, sourceId: F, status: 'interpretado', note: `${H.principal.a} m en el frontal A y ${H.principal.b} m en el frontal B, estimados con una puerta como referencia.` },
  ],
  sources: [
    FOTOS_PARCELA,
    { id: 'boceto-planta-baixa', label: 'Foto del boceto «PLANTA BAIXA»', detail: 'Largo total de la casa (15,70 m).' },
    { id: 'indicacion-propiedad', label: 'Indicaciones de la propiedad (04/10/2026)', detail: '5 m de ancho; muro del frontal B de 0,60 m y el resto de 0,30 m.' },
  ],
  readings: [
    { sourceId: F, read: 'Vista cenital: tres faldones de fibrocemento escalonados y un faldón bajo bajo el algarrobo', interpreted: 'Tres volúmenes de una planta. El faldón bajo junto al algarrobo no se modela (sin medidas).' },
    { sourceId: F, read: 'Vista oblicua del frontal B: cinco hojas de puerta (gris, gris y madera, madera doble, gris)', interpreted: 'Cuatro huecos de puerta; la de madera doble coincide con la entrada de la reforma.' },
    { sourceId: F, read: 'Canalón y bajante en el frontal B; hastial del volumen principal sobre el anexo', interpreted: 'Cubiertas a un agua que caen hacia el frontal B.' },
  ],
  discrepancies: [
    'Sin corregir la perspectiva, la vista cenital da un largo de ≈12,7 m para el conjunto; se escala al largo de 15,70 m de los bocetos manteniendo las proporciones.',
    'El anexo parece algo más estrecho que el volumen principal en la vista cenital; se dibuja con el mismo ancho.',
  ],
  questions: [
    '¿Los muros actuales se conservan en la reforma (frontal B de 0,60 m)? Aquí se suponen los mismos espesores.',
    '¿Qué hay bajo el faldón bajo junto al algarrobo (extremo derecho)? No se ha dibujado.',
  ],
  northDeg: null,
  facades: { B: 'Frontal B (puertas)', A: 'Frontal A', izquierdo: 'Lateral izquierdo', derecho: 'Lateral derecho' },
  notices: ['Estado actual interpretado a partir de fotografías: sin medidas tomadas en obra. Para comparar con la reforma, cambia de fase.'],
};
