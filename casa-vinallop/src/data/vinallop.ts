/**
 * CASA VINALLOP — definición del proyecto a partir de las fotografías de los bocetos
 * (planta baixa, frontal A, frontal B y altell), recibidas el 4 de octubre de 2026.
 *
 * ORIENTACIÓN: la de los textos del boceto («PLANTA BAIXA» legible, hoja girada
 * 90° a la izquierda respecto a la foto). X crece hacia la derecha del papel
 * (el dormitorio queda a la izquierda) e Y hacia abajo. Y = 0 es la cara exterior
 * del frontal A (lado superior); Y = ancho es la cara exterior del frontal B.
 *
 * ESTADOS: documentado = cota escrita en el boceto · interpretado = medido o
 * deducido del dibujo (sin cota) · propuesto = decisión de diseño · pendiente =
 * no se distingue o falta. Las medidas interpretadas se redondean a 0,05 m y
 * tienen una incertidumbre de unos ±0,2 m: el boceto está dibujado a mano.
 */
import type { Furniture, Opening, ProjectData, Room, Vec2, Wall } from './types';

const r2 = (x: number) => Math.round(x * 100) / 100;
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[r2(x0), r2(y0)], [r2(x1), r2(y0)], [r2(x1), r2(y1)], [r2(x0), r2(y1)]];

// ---------- cotas principales ----------
/** Cadena de cotas del frontal B en la planta: 3,5 + 2,5 + 3,5 + 1,20 + 5 = 15,70 m (documentado). */
const CHAIN = [3.5, 2.5, 3.5, 1.2, 5];
const L = r2(CHAIN.reduce((a, b) => a + b, 0)); // 15,70
/** Ancho: sin cota escrita. Medido sobre el boceto con la escala gráfica de 1 m (interpretado). */
const W = 5.1;
/** Espesor de muros: no figura (pendiente). */
const T = 0.3;
const TP = 0.1;
/** Altura total del frontal A: 6,20 m (documentado). */
const H_TOTAL = 6.2;
/** Cota del suelo del altell: no figura; entre la coronación de los huecos de planta baja (≈3,15) y el antepecho del hueco alto (≈3,70). */
const ALTELL = 3.3;
const SLAB = 0.12;
const H_PB = r2(ALTELL - SLAB);
/** Altura de los huecos de planta baja: proporción de los alzados (sin cota). */
const H_HUECO = 3.15;

const h = T / 2;
const x0 = T, x1 = r2(L - T), y0 = T, y1 = r2(W - T);
const X_DORM = CHAIN[0]; // 3,50 tabique dormitorio
const X_BANO = 5.1; // fin del bloque del baño (medido)
const X_ESC = r2(CHAIN[0] + CHAIN[1]); // 6,00 inicio de la escalera
const X_PUERTA = r2(CHAIN[0] + CHAIN[1] + CHAIN[2]); // 9,50 puerta de entrada
const Y_PASILLO = 1.0; // línea del pasillo junto al frontal A (medida)
const Y_FRANJA = 1.8; // segunda línea paralela (medida)

const S = {
  planta: 'boceto-planta-baixa',
  fa: 'boceto-frontal-a',
  fb: 'boceto-frontal-b',
  altell: 'boceto-altell',
  hip: 'hipotesis',
};

const ext = { levelId: 'pb', thickness: T, height: H_TOTAL, kind: 'exterior' as const, status: 'interpretado' as const, sourceId: S.planta };
const tab = { levelId: 'pb', thickness: TP, height: H_PB, kind: 'tabique' as const, status: 'interpretado' as const, sourceId: S.planta };

const walls: Wall[] = [
  { ...ext, id: 'muro-A', facade: 'A', a: [h, h], b: [L - h, h], ext: [h, h] },
  { ...ext, id: 'muro-derecho', facade: 'derecho', a: [L - h, h], b: [L - h, W - h], ext: [-h, -h] },
  { ...ext, id: 'muro-B', facade: 'B', a: [h, W - h], b: [L - h, W - h], ext: [h, h] },
  { ...ext, id: 'muro-izquierdo', facade: 'izquierdo', a: [h, h], b: [h, W - h], ext: [-h, -h] },
  { ...tab, id: 'tab-dormitorio', a: [X_DORM, Y_PASILLO - TP / 2], b: [X_DORM, y1] },
  { ...tab, id: 'tab-pasillo', a: [X_DORM + TP / 2, Y_PASILLO], b: [X_BANO + TP / 2, Y_PASILLO] },
  { ...tab, id: 'tab-franja', a: [X_DORM + TP / 2, Y_FRANJA], b: [X_BANO + TP / 2, Y_FRANJA] },
  { ...tab, id: 'tab-franja-fin', a: [X_BANO, Y_PASILLO - TP / 2], b: [X_BANO, Y_FRANJA + TP / 2] },
];

const onA = (x: number) => r2(x - h); // offset sobre el eje del muro A o B (empieza en x = h)
const openings: Opening[] = [
  {
    id: 'obertura-7m', label: 'Obertura de 7 m', wallId: 'muro-A', kind: 'cristalera', offset: onA(7.4), width: 7, sill: 0, height: H_HUECO,
    system: null, status: 'interpretado', sourceId: S.planta,
    note: 'Anchura documentada (7 m, planta y frontal A). Posición interpretada: empieza tras la escalera y termina a ≈1,3 m del extremo. Altura por proporción del alzado. Carpintería no definida.',
  },
  {
    id: 'obertura-225-pb', label: 'Obertura de 2,25 m (dormitorio)', wallId: 'muro-A', kind: 'cristalera', offset: onA(1.15), width: 2.25, sill: 0, height: H_HUECO,
    system: null, status: 'interpretado', sourceId: S.planta,
    note: 'Anchura documentada (225 cm). Posición según la planta; el frontal A la dibuja más a la derecha. Altura por proporción del alzado.',
  },
  {
    id: 'obertura-225-altell', label: 'Obertura de 2,25 m (altell)', wallId: 'muro-A', kind: 'cristalera', offset: onA(1.15), width: 2.25, sill: 3.7, height: 2.45,
    system: null, status: 'interpretado', sourceId: S.fa,
    note: 'Anchura documentada (2,25 m en el frontal A, alineada con la de planta baja). Antepecho y altura por proporción. Bordes en zigzag sin interpretar.',
  },
  {
    id: 'puerta-120', label: 'Puerta de entrada (1,20 m)', wallId: 'muro-B', kind: 'puerta', offset: onA(X_PUERTA), width: 1.2, sill: 0, height: H_HUECO,
    system: { type: 'abatible', leaves: 1, status: 'interpretado' }, swing: { hinge: 'inicio', dir: -1 }, status: 'documentado', sourceId: S.planta,
    note: 'Anchura y posición documentadas (cadena de cotas, frontal B «120 cm»). Hoja y giro según el arco dibujado. Altura por proporción.',
  },
  {
    id: 'obertura-70', label: 'Obertura de 70 cm (frontal B)', wallId: 'muro-B', kind: 'ventana', offset: onA(4.25), width: 0.7, sill: 0, height: H_HUECO,
    system: null, status: 'pendiente', sourceId: S.fb,
    note: 'Anchura documentada (70 cm). Posición estimada desde el frontal B (no aparece en la planta). Dibujada desde el suelo: ¿ventana o puerta?',
  },
  {
    id: 'puerta-franja', label: 'Puerta junto al baño', wallId: 'tab-franja-fin', kind: 'puerta', offset: 0.1, width: 0.7, sill: 0, height: 2.1,
    system: { type: 'abatible', leaves: 1, status: 'interpretado' }, swing: { hinge: 'fin', dir: -1 }, status: 'interpretado', sourceId: S.planta,
    note: 'Arco de puerta dibujado; anchura medida. Altura de puerta estándar (2,10 m, hipótesis).',
  },
];

const room = (id: string, name: string, poly: Vec2[], status: Room['status'], note: string, extra: Partial<Room> = {}): Room => ({
  id, levelId: 'pb', name, polygon: poly, status, sourceId: S.planta, note, ...extra,
});
const rooms: Room[] = [
  room('dormitorio', 'Dormitorio', rect(x0, y0, X_DORM - TP / 2, y1), 'interpretado', 'Cama dibujada en el extremo izquierdo, cabecero contra el frontal B. Sin rótulo en el boceto.', { openTo: ['pasillo'] }),
  room('pasillo', 'Pasillo', rect(X_DORM - TP / 2, y0, X_BANO + TP / 2, Y_PASILLO - TP / 2), 'interpretado', 'Franja junto al frontal A que une la zona de día con el dormitorio (no hay puerta dibujada).', { openTo: ['dormitorio', 'dia'] }),
  room('franja', 'Franja con puerta', rect(X_DORM + TP / 2, Y_PASILLO + TP / 2, X_BANO - TP / 2, Y_FRANJA - TP / 2), 'pendiente', 'Espacio estrecho (≈0,70 m) con la puerta dibujada. Uso pendiente.'),
  room('bano', 'Baño', rect(X_DORM + TP / 2, Y_FRANJA + TP / 2, X_BANO + TP / 2, y1), 'interpretado', 'Interpretado por los elementos dibujados (posible ducha y lavabo). Sin rótulo. El lado hacia la zona de día no tiene trazo.', { openTo: ['dia'] }),
  room('dia', 'Zona de día', rect(X_BANO + TP / 2, y0, x1, y1), 'interpretado', 'Espacio sin tabiques: escalera, encimera, mesa y zona de estar (trazos en U pendientes).', { openTo: ['pasillo', 'bano'] }),
  {
    id: 'altell', levelId: 'altell', name: 'Altell', status: 'pendiente', sourceId: S.altell,
    polygon: [[x0, y0], [x1, y0], [x1, y1], [7.2, y1], [7.2, 1.1], [X_ESC, 1.1], [X_ESC, y1], [x0, y1]],
    note: 'El boceto del altell dibuja todo el contorno. Pendiente confirmar si cubre toda la planta o si parte es doble altura.',
  },
];

const furniture: Furniture[] = [
  { id: 'cama', type: 'cama', label: 'Cama', roomId: 'dormitorio', x: 2.0, y: r2(y1 - 1.0), w: 1.6, d: 2.0, h: 0.55, rot: 180 },
  { id: 'ducha', type: 'ducha', label: 'Ducha (interpretada)', roomId: 'bano', x: 4.3, y: r2(y1 - 0.38), w: 1.5, d: 0.75, h: 2.0, rot: 0 },
  { id: 'lavabo', type: 'lavabo', label: 'Mueble de lavabo (interpretado)', roomId: 'bano', x: 3.9, y: 2.43, w: 1.15, d: 0.7, h: 0.85, rot: 270 },
  { id: 'encimera', type: 'encimera', label: 'Encimera (interpretada)', roomId: 'dia', x: 8.35, y: r2(y1 - 0.3), w: 2.2, d: 0.6, h: 0.9, rot: 180 },
  { id: 'mesa', type: 'mesa', label: 'Mesa', roomId: 'dia', x: 8.73, y: 2.7, w: 1.45, d: 2.0, h: 0.75, rot: 0 },
];

export const VINALLOP: ProjectData = {
  id: 'casa-vinallop',
  name: 'Casa Vinallop',
  isTest: false,
  version: '0.3 · bocetos 04/10/2026',
  levels: [
    { id: 'pb', name: 'Planta baja', elevation: 0, wallHeight: H_PB, elevationStatus: 'documentado' },
    { id: 'altell', name: 'Altell', elevation: ALTELL, wallHeight: r2(H_TOTAL - ALTELL), elevationStatus: 'pendiente' },
  ],
  walls,
  openings,
  rooms,
  furniture,
  slabs: [
    {
      id: 'forjado-altell', levelId: 'altell', thickness: SLAB, status: 'pendiente', sourceId: S.hip,
      polygon: rooms.find((r) => r.id === 'altell')!.polygon,
      note: 'Cota y canto del forjado no figuran. Hueco de escalera según la planta.',
    },
  ],
  stairs: [
    {
      id: 'escalera', fromLevel: 'pb', toLevel: 'altell', rect: [X_ESC, 1.1, 7.2, y1], up: '-y', risers: 14, status: 'interpretado', sourceId: S.planta,
      note: 'Posición documentada (empieza en la cota 6,00 de la cadena). Ancho ≈1,20 y ≈14 peldaños medidos en el dibujo. Sentido de subida y peldaños compensados del arranque pendientes.',
    },
  ],
  traces: [
    {
      id: 'trazo-u', levelId: 'pb', label: 'Trazo en U', sourceId: S.planta,
      points: [[10.7, 4.4], [13.25, 4.4], [13.25, 1.9], [15.2, 1.9], [15.2, 0.4], [13.0, 0.4]],
      note: 'Línea continua desde la jamba de la puerta hasta el extremo derecho. No se interpreta (¿cocina en L, anexo, banco?).',
    },
    { id: 'trazo-circulo', levelId: 'pb', label: 'Círculo', sourceId: S.planta, circle: { c: [13.2, 1.05], r: 0.4 }, note: 'Círculo de ≈0,8 m de diámetro junto al frontal A. No se interpreta.' },
    { id: 'trazo-dormitorio', levelId: 'pb', label: 'Línea paralela al lateral', sourceId: S.planta, points: [[0.9, y0], [0.9, y1]], note: 'Línea a ≈0,9 m del lateral izquierdo en todo el ancho (¿armario?).' },
  ],
  roofOptions: [
    { type: 'plana', label: 'Plana', pitchDeg: 0, overhang: 0, thickness: 0.25, status: 'pendiente', note: 'Los alzados A y B terminan en una línea recta a 6,20 m: compatible con cubierta plana o a dos aguas con cumbrera longitudinal. Sin dato.' },
    { type: 'dos-aguas', label: 'Dos aguas', pitchDeg: 17, overhang: 0.25, thickness: 0.18, status: 'pendiente', note: 'Alternativa de visualización; pendiente sin dato.' },
    { type: 'un-agua', label: 'Un agua', pitchDeg: 8, overhang: 0.25, thickness: 0.18, status: 'pendiente', note: 'Alternativa de visualización; pendiente sin dato.' },
  ],
  measures: [
    { id: 'largo', label: 'Largo total (suma de la cadena de cotas)', value: L, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '3,5 + 2,5 + 3,5 + 1,20 + 5. Se toma como medida exterior; pendiente confirmar.' },
    { id: 'tramo-1', label: 'Tramo dormitorio', value: 3.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«3\'5 METRES»' },
    { id: 'tramo-2', label: 'Tramo baño', value: 2.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«2\'5 M»' },
    { id: 'tramo-3', label: 'Tramo escalera y cocina', value: 3.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«3\'5 M»' },
    { id: 'tramo-4', label: 'Puerta de entrada', value: 1.2, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '«1\'20 M» y «120 cm» en el frontal B' },
    { id: 'tramo-5', label: 'Tramo final', value: 5, unit: 'm', decimals: 0, sourceId: S.planta, status: 'documentado', note: '«5 METRES»' },
    { id: 'ancho', label: 'Ancho exterior', value: W, unit: 'm', decimals: 1, sourceId: S.planta, status: 'interpretado', note: 'Sin cota escrita. Medido con la escala gráfica de 1 m del boceto (±0,3 m).' },
    { id: 'altura', label: 'Altura total (frontal A)', value: H_TOTAL, unit: 'm', decimals: 2, sourceId: S.fa, status: 'documentado', note: '«6\'20 METRES»' },
    { id: 'obertura-7', label: 'Obertura del frontal A', value: 7, unit: 'm', decimals: 0, sourceId: S.fa, status: 'documentado', note: '«OBERTURA 7 M» (planta) y «7 metres» (frontal A)' },
    { id: 'obertura-225', label: 'Obertura del dormitorio', value: 2.25, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '«OBERTURA: 225 CM»; «2,25 m» dos veces en el frontal A' },
    { id: 'obertura-70', label: 'Obertura del frontal B', value: 0.7, unit: 'm', decimals: 2, sourceId: S.fb, status: 'documentado', note: '«70 cm»' },
    { id: 'altura-huecos', label: 'Altura de los huecos de planta baja', value: H_HUECO, unit: 'm', decimals: 2, sourceId: S.fa, status: 'interpretado', note: 'Proporción de los alzados A y B; sin cota.' },
    { id: 'cota-altell', label: 'Cota del suelo del altell', value: ALTELL, unit: 'm', decimals: 2, sourceId: S.hip, status: 'pendiente', note: 'Hipótesis entre la coronación de los huecos bajos y el antepecho del hueco alto.' },
    { id: 'espesor', label: 'Espesor de muros exteriores', value: T, unit: 'm', decimals: 2, sourceId: S.hip, status: 'pendiente' },
    { id: 'inicio-7m', label: 'Inicio de la obertura de 7 m', value: 7.4, unit: 'm', decimals: 1, sourceId: S.planta, status: 'interpretado', note: 'Medido en planta y coherente con el frontal A (termina cerca del extremo).' },
  ],
  sources: [
    { id: S.planta, label: 'Foto del boceto «PLANTA BAIXA»', detail: 'Papel milimetrado A3, con escala gráfica de 1 m y cotas manuscritas.' },
    { id: S.fa, label: 'Foto del boceto «FRONTAL A»', detail: 'Alzado del lado superior de la planta (visto desde fuera, invertido izquierda-derecha).' },
    { id: S.fb, label: 'Foto del boceto «FRONTAL B»', detail: 'Alzado del lado inferior de la planta.' },
    { id: S.altell, label: 'Foto del boceto «ALTELL»', detail: 'Contorno del nivel superior con la escalera; sin cotas.' },
    { id: S.hip, label: 'Hipótesis de visualización', detail: 'Valor provisional para poder dibujar; no figura en los bocetos.' },
  ],
  readings: [
    { sourceId: S.planta, read: '«PLANTA BAIXA», escala «1 METRE»', interpreted: 'Planta baja. La escala gráfica permite estimar medidas sin cota (ancho ≈5,1 m).' },
    { sourceId: S.planta, read: '«3\'5 METRES» · «2\'5 M» · «3\'5 M» · «1\'20 M» · «5 METRES» a lo largo del lado inferior', interpreted: 'Cadena de cotas del frontal B: dormitorio, baño, escalera y cocina, puerta y tramo final. Total 15,70 m.' },
    { sourceId: S.planta, read: '«OBERTURA: 225 CM» junto al dormitorio, lado superior', interpreted: 'Hueco de 2,25 m en el frontal A del dormitorio.' },
    { sourceId: S.planta, read: '«OBERTURA 7 M» en el lado superior, tramo derecho', interpreted: 'Hueco de 7 m en el frontal A de la zona de día.' },
    { sourceId: S.planta, read: 'Rectángulo con dos almohadas en el extremo izquierdo', interpreted: 'Cama; dormitorio. Cabecero contra el lado inferior.' },
    { sourceId: S.planta, read: 'Rectángulo con peldaños y triángulo de arranque', interpreted: 'Escalera al altell (≈14 peldaños).' },
    { sourceId: S.planta, read: 'Arco de puerta en el hueco de 1,20 m', interpreted: 'Puerta de entrada de una hoja que abre hacia dentro.' },
    { sourceId: S.planta, read: 'Rectángulos en el tramo de 2,5 m y arco de puerta pequeño', interpreted: 'Baño con ducha y lavabo (interpretado) y franja estrecha con puerta (uso pendiente).' },
    { sourceId: S.planta, read: 'Rectángulo grande en el tramo de 3,5 m', interpreted: 'Mesa de comedor.' },
    { sourceId: S.planta, read: 'Línea en U en el tramo de 5 m y círculo junto al lado superior', interpreted: 'Sin interpretar: se dibujan tal cual como trazos pendientes.' },
    { sourceId: S.fa, read: '«FRONTAL A.», «7 metres», «2,25 m» (dos), «6\'20 METRES»', interpreted: 'Altura total 6,20 m; hueco de 7 m y dos huecos de 2,25 m (planta baja y altell) alineados.' },
    { sourceId: S.fb, read: '«FRONTAL B», «70 cm», «120 cm»', interpreted: 'Puerta de 1,20 m y hueco de 70 cm, ambos desde el suelo.' },
    { sourceId: S.altell, read: '«ALTELL», contorno completo y escalera', interpreted: 'Nivel superior; extensión real pendiente.' },
  ],
  discrepancies: [
    'Posición del hueco de 2,25 m: la planta lo sitúa en el dormitorio (≈1,15–3,40 m); el frontal A lo dibuja más hacia el centro. Se usa la planta.',
    'Proporciones de los alzados: con 7 m de hueco a escala, el frontal A mediría unos 19–20 m frente a los 15,70 m de la planta. Las posiciones se toman de la planta.',
    'El frontal B sitúa la puerta de 1,20 m algo antes que la cadena de cotas de la planta; se usa la cadena (documentada).',
    'En el tramo de 5 m el lado inferior aparece desplazado ≈0,2 m hacia fuera; se mantiene alineado con el resto.',
  ],
  questions: [
    '¿Cuál es el ancho real de la casa? No hay cota; con la escala gráfica sale ≈5,10 m.',
    '¿La cadena 3,5 + 2,5 + 3,5 + 1,20 + 5 está medida por fuera (15,70 m exteriores)? ¿Qué espesor tienen los muros?',
    '¿Qué es el trazo en U del tramo de 5 m y el círculo junto al frontal A?',
    '¿Dónde empieza exactamente la obertura de 7 m?',
    '¿El altell ocupa toda la planta o la zona de día es de doble altura? ¿A qué altura está su suelo?',
    'En el tramo del baño: ¿qué es la franja estrecha con puerta y el hueco sin trazo en el tabique del dormitorio (≈3,0–4,0 m)?',
    'El hueco de 70 cm del frontal B, ¿es ventana o puerta? ¿Dónde está exactamente?',
    '¿Qué indican los bordes en zigzag del hueco alto del frontal A? ¿Cómo es la cubierta?',
  ],
  northDeg: null,
  facades: { A: 'Frontal A', B: 'Frontal B', izquierdo: 'Lateral izquierdo', derecho: 'Lateral derecho' },
  notices: ['Geometría interpretada de los bocetos fotografiados. Revisa la lista de preguntas en «Medidas y documentación».'],
};
