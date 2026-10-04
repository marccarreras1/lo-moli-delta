/**
 * CASA VINALLOP · ESTADO ACTUAL (antes de la reforma), interpretado a partir de las
 * fotografías de la propiedad (dron y suelo, 04/10/2026).
 *
 * Mismo sistema de coordenadas que la reforma (src/data/vinallop.ts): X hacia la
 * derecha del papel, Y hacia abajo; Y = 0 frontal A, Y = 5,22 frontal B (el de las
 * puertas y la solera). Envolvente de 16,33 × 5,22 m del informe del arquitecto (cifras
 * transmitidas por la propiedad); el informe da 79,48 m² construidos, menos que el
 * rectángulo (85,24 m²): la diferencia está pendiente de contrastar.
 *
 * LECTURA DE LAS FOTOS
 * - Casa de una planta, encalada, con tres volúmenes y cubiertas de fibrocemento a un
 *   agua que caen hacia el frontal B (canalón y bajante en ese lado).
 * - De izquierda a derecha: volumen del extremo (bajo), anexo, volumen principal (el
 *   más alto, con hastial que asoma sobre el anexo) y habitación pequeña bajo el faldón
 *   bajo junto al algarrobo (propiedad).
 * - Proporciones medidas en la vista cenital y escaladas al largo de 16,33 m del informe
 *   (antes, a los 15,70 m de los bocetos); puertas situadas con una corrección de
 *   perspectiva sobre la vista oblicua.
 * - Alturas estimadas tomando una puerta como ≈2,00 m de referencia.
 * - Espesores de la propiedad: frontal B 0,60 m y el resto 0,40 m.
 *
 * Todo es INTERPRETADO (±0,3 m en planta y ±0,2 m en altura) salvo el muro del frontal B
 * (0,60 m, propiedad) y lo que se marca como pendiente. No hay medidas escritas del estado actual.
 */
import { FOTOS_PARCELA, PARCELA } from './parcela';
import type { Opening, ProjectData, Room, RoofSegment, Vec2, Wall } from './types';

/** informe del arquitecto: 16,33 × 5,22 m exteriores */
const L = 16.33;
const W = 5.22;
/** las posiciones leídas en las fotos se midieron sobre 15,70 m: se escalan al largo del informe */
const K = L / 15.7;
const k = (x: number) => Math.round(x * K * 100) / 100;
/** resto de muros existentes: 0,40 m (propiedad) */
const T = 0.4;
const TB = 0.6;
const h = T / 2;
const yB = W - TB / 2; // eje del frontal B
/** límites entre volúmenes (ejes de los muros transversales) */
const X1 = k(1.8);
const X2 = k(5.6);
/** habitación pequeña bajo el faldón bajo junto al algarrobo (propiedad: «hay una pequeña habitación») */
const X3 = k(14.2);
/** aleros: alto en el frontal A, bajo en el frontal B */
const H = {
  extremo: { a: 2.45, b: 2.3 },
  anexo: { a: 2.95, b: 2.45 },
  principal: { a: 3.55, b: 2.75 },
  habitacion: { a: 2.6, b: 2.35 },
};

const F = FOTOS_PARCELA.id;
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// espesores de la propiedad: frontal B 0,60 m y el resto 0,40 m; la posición de cada muro sale de las fotos
const ext = { levelId: 'pb', thickness: T, kind: 'exterior' as const, status: 'interpretado' as const, sourceId: F };
const extB = { ...ext, thickness: TB, status: 'confirmado' as const, sourceId: 'indicacion-propiedad' };

const walls: Wall[] = [
  { ...ext, id: 'a-extremo', facade: 'A', a: [h, h], b: [X1, h], ext: [h, 0], height: H.extremo.a },
  { ...ext, id: 'a-anexo', facade: 'A', a: [X1, h], b: [X2, h], height: H.anexo.a },
  { ...ext, id: 'a-principal', facade: 'A', a: [X2, h], b: [X3, h], height: H.principal.a },
  { ...ext, id: 'a-habitacion', facade: 'A', a: [X3, h], b: [L - h, h], ext: [0, h], height: H.habitacion.a },
  { ...extB, id: 'b-principal', facade: 'B', a: [X2, yB], b: [X3, yB], height: H.principal.b },
  { ...extB, id: 'b-extremo', facade: 'B', a: [h, yB], b: [X1, yB], ext: [h, 0], height: H.extremo.b },
  { ...extB, id: 'b-anexo', facade: 'B', a: [X1, yB], b: [X2, yB], height: H.anexo.b },
  { ...extB, id: 'b-habitacion', facade: 'B', a: [X3, yB], b: [L - h, yB], ext: [0, h], height: H.habitacion.b },
  { ...ext, id: 'lateral-izquierdo', facade: 'izquierdo', a: [h, h], b: [h, yB], ext: [-h, -TB / 2], height: H.extremo.b },
  { ...ext, id: 'lateral-derecho', facade: 'derecho', a: [L - h, h], b: [L - h, yB], ext: [-h, -TB / 2], height: H.habitacion.b },
  // muros entre volúmenes (los hastiales que asoman sobre la cubierta vecina los dibuja la cubierta)
  { ...ext, kind: 'tabique', id: 'muro-extremo-anexo', a: [X1, T], b: [X1, W - TB], height: H.anexo.b },
  { ...ext, kind: 'tabique', id: 'muro-anexo-principal', a: [X2, T], b: [X2, W - TB], height: H.principal.b },
  { ...ext, kind: 'tabique', id: 'muro-principal-habitacion', a: [X3, T], b: [X3, W - TB], height: H.principal.b },
];

const door = (id: string, label: string, wallId: string, x0: number, x1: number, wallA: number, height: number, leaves: number, note: string): Opening => ({
  id, label, wallId, kind: 'puerta', offset: Math.round((x0 - wallA) * 100) / 100, width: Math.round((x1 - x0) * 100) / 100, sill: 0, height,
  system: { type: 'abatible', leaves, status: 'interpretado' }, status: 'interpretado', sourceId: F, note,
});

const openings: Opening[] = [
  door('puerta-extremo', 'Puerta del volumen del extremo', 'b-extremo', k(0.85), k(1.55), h, 2.0, 1, 'Puerta metálica gris (vista oblicua).'),
  door('puerta-anexo', 'Puerta del anexo', 'b-anexo', k(3.55), k(4.55), X1, 2.0, 2, 'Hueco con dos hojas abiertas hacia fuera: una metálica gris y otra de madera (vista oblicua).'),
  door('puerta-madera', 'Puerta de madera (volumen principal)', 'b-principal', k(9.4), k(10.6), X2, 2.1, 2, 'Puerta de madera de dos hojas. Coincide aproximadamente con la puerta de entrada de 1,20 m de la reforma (9,80–11,00 m con las medidas del informe).'),
  door('puerta-gris', 'Puerta de la habitación pequeña', 'b-habitacion', k(14.55), k(15.25), X3, 2.0, 1, 'Puerta metálica gris del extremo derecho (vista oblicua), en el volumen bajo de la habitación pequeña.'),
  {
    id: 'ventana-a', label: 'Ventana del frontal A', wallId: 'a-principal', kind: 'ventana', offset: k(5.4), width: 0.6, sill: 1.3, height: 0.6,
    system: null, status: 'pendiente', sourceId: F, note: 'Ventana pequeña vista desde el lado del frontal A; posición y tamaño sin comprobar.',
  },
];

const room = (id: string, name: string, x0: number, x1: number, note: string): Room => ({
  id, levelId: 'pb', name, polygon: rect(x0, T, x1, W - TB), status: 'interpretado', sourceId: F, note,
});

const rooms: Room[] = [
  room('vol-extremo', 'Volumen del extremo', T, X1 - h, 'Interior no fotografiado: distribución y uso desconocidos.'),
  room('vol-anexo', 'Anexo', X1 + h, X2 - h, 'Interior no fotografiado: distribución y uso desconocidos.'),
  room('vol-principal', 'Volumen principal', X2 + h, X3 - h, 'Interior no fotografiado: tabiques, si los hay, desconocidos.'),
  room('habitacion-pequena', 'Habitación pequeña', X3 + h, L - T, 'Habitación pequeña (propiedad) bajo el faldón bajo junto al algarrobo. Largo según la vista cenital (≈1,5 m); ancho supuesto igual al de la casa.'),
];

const roofSegments: RoofSegment[] = [
  { id: 'cub-extremo', label: 'Cubierta del volumen del extremo', rect: [0, 0, X1, W], hy0: H.extremo.a, hy1: H.extremo.b, overhang: 0.1, gableThickness: T, material: 'fibrocemento', status: 'interpretado', sourceId: F, note: 'Fibrocemento, casi plana, la más baja.' },
  { id: 'cub-anexo', label: 'Cubierta del anexo', rect: [X1, 0, X2, W], hy0: H.anexo.a, hy1: H.anexo.b, overhang: 0.15, gableThickness: T, material: 'fibrocemento', status: 'interpretado', sourceId: F, note: 'Fibrocemento a un agua hacia el frontal B.' },
  { id: 'cub-principal', label: 'Cubierta del volumen principal', rect: [X2, 0, X3, W], hy0: H.principal.a, hy1: H.principal.b, overhang: 0.15, gableThickness: T, material: 'fibrocemento', status: 'interpretado', sourceId: F, note: 'Fibrocemento a un agua hacia el frontal B, con chimenea; su hastial asoma sobre el anexo.' },
  { id: 'cub-habitacion', label: 'Cubierta de la habitación pequeña', rect: [X3, 0, L, W], hy0: H.habitacion.a, hy1: H.habitacion.b, overhang: 0.1, gableThickness: T, material: 'fibrocemento', status: 'interpretado', sourceId: F, note: 'Faldón bajo de fibrocemento junto al algarrobo (vista cenital).' },
];

export const VINALLOP_ACTUAL: ProjectData = {
  id: 'casa-vinallop-actual',
  name: 'Casa Vinallop · estado actual',
  isTest: false,
  phase: 'actual',
  version: '0.2 · fotos de la casa antes de la reforma y medidas del informe (16,33 × 5,22 m)',
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
    { id: 'ancho', label: 'Ancho', value: W, unit: 'm', decimals: 2, sourceId: 'indicacion-propiedad', status: 'confirmado' },
    { id: 'vol-extremo', label: 'Largo del volumen del extremo', value: X1, unit: 'm', decimals: 1, sourceId: F, status: 'interpretado', note: 'Proporción de la vista cenital.' },
    { id: 'vol-anexo', label: 'Largo del anexo', value: X2 - X1, unit: 'm', decimals: 1, sourceId: F, status: 'interpretado', note: 'Proporción de la vista cenital.' },
    { id: 'vol-principal', label: 'Largo del volumen principal', value: X3 - X2, unit: 'm', decimals: 1, sourceId: F, status: 'interpretado', note: 'Proporción de la vista cenital.' },
    { id: 'vol-habitacion', label: 'Largo de la habitación pequeña', value: L - X3, unit: 'm', decimals: 1, sourceId: F, status: 'interpretado', note: 'Proporción de la vista cenital.' },
    { id: 'espesor-b', label: 'Muro del frontal B (existente)', value: TB, unit: 'm', decimals: 2, sourceId: 'indicacion-propiedad', status: 'confirmado', note: '«El espesor de 0,6 sí» (propiedad). Se conserva en la reforma.' },
    { id: 'espesor-resto', label: 'Resto de muros existentes', value: T, unit: 'm', decimals: 2, sourceId: 'indicacion-propiedad', status: 'confirmado', note: '«0,40 m» (propiedad).' },
    { id: 'alero-principal', label: 'Aleros del volumen principal (A / B)', value: H.principal.a, unit: 'm', decimals: 1, sourceId: F, status: 'interpretado', note: `${H.principal.a} m en el frontal A y ${H.principal.b} m en el frontal B, estimados con una puerta como referencia.` },
  ],
  sources: [
    FOTOS_PARCELA,
    { id: 'informe-arquitecto', label: 'Informe del arquitecto (cifras transmitidas)', detail: '16,33 × 5,22 m exteriores y 79,48 m² construidos; cubierta inclinada.' },
    { id: 'indicacion-propiedad', label: 'Indicaciones de la propiedad (04/10/2026)', detail: '5 m de ancho; el muro existente del frontal B es de 0,60 m y el resto de 0,40 m; hay una pequeña habitación.' },
  ],
  readings: [
    { sourceId: F, read: 'Vista cenital: tres faldones de fibrocemento escalonados y un faldón bajo bajo el algarrobo', interpreted: 'Cuatro volúmenes de una planta: el faldón bajo junto al algarrobo cubre una habitación pequeña (propiedad).' },
    { sourceId: F, read: 'Vista oblicua del frontal B: cinco hojas de puerta (gris, gris y madera, madera doble, gris)', interpreted: 'Cuatro huecos de puerta; la de madera doble coincide con la entrada de la reforma.' },
    { sourceId: F, read: 'Canalón y bajante en el frontal B; hastial del volumen principal sobre el anexo', interpreted: 'Cubiertas a un agua que caen hacia el frontal B.' },
  ],
  discrepancies: [
    'Sin corregir la perspectiva, la vista cenital da un largo de ≈12,7 m para el conjunto; se escala al largo de 16,33 m del informe manteniendo las proporciones.',
    'Superficie: 79,48 m² construidos (informe) frente a 85,24 m² del rectángulo de 16,33 × 5,22 m. Puede que algún volumen sea más estrecho: pendiente.',
    'La habitación pequeña se incluye dentro de los 16,33 m (el volumen principal termina en ≈14,77 m).',
    'El anexo parece algo más estrecho que el volumen principal en la vista cenital; se dibuja con el mismo ancho.',
  ],
  questions: [
    'Habitación pequeña: se ha situado bajo el tejado bajo del extremo derecho, junto al algarrobo (≈1,5 m de largo, todo el ancho). ¿Es ahí donde está?',
  ],
  northDeg: null,
  facades: { B: 'Frontal B (puertas)', A: 'Frontal A', izquierdo: 'Lateral izquierdo', derecho: 'Lateral derecho' },
  notices: ['Estado actual interpretado a partir de fotografías: sin medidas tomadas en obra. Para comparar con la reforma, cambia de fase.'],
};
