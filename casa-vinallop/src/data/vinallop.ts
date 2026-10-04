/**
 * CASA VINALLOP — definición del proyecto a partir de las fotografías de los bocetos
 * (planta baixa, frontal A, frontal B y altell) del 4 de octubre de 2026 y de las
 * respuestas de la propiedad.
 *
 * ORIENTACIÓN: la de los textos del boceto («PLANTA BAIXA» legible). X crece hacia
 * la derecha del papel (el dormitorio queda a la izquierda) e Y hacia abajo.
 * Y = 0 es la cara exterior del frontal A (lado superior); Y = 5,00 m, la del frontal B.
 *
 * ESTADOS: documentado = cota escrita o indicación de la propiedad · interpretado =
 * medido o deducido del dibujo (sin cota) · propuesto = decisión de diseño ·
 * pendiente = no se distingue o falta. Las medidas interpretadas se redondean a
 * 0,05 m y tienen una incertidumbre de unos ±0,2 m: el boceto está dibujado a mano.
 *
 * MÉTODO: en X, cada elemento se sitúa respecto a las marcas de la cadena de cotas más
 * próximas (0 · 3,50 · 6,00 · 9,50 · 10,70 · 15,70 m). En Y, las líneas largas del
 * boceto se toman como caras interiores de los muros (con ese criterio la encimera
 * sale de 0,60 m y el sofá de 0,85 m de fondo): Y = 0,30 + fracción × 4,10 m.
 */
import type { Furniture, Opening, ProjectData, Room, Trace, Vec2, Wall } from './types';

const r2 = (x: number) => Math.round(x * 100) / 100;
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[r2(x0), r2(y0)], [r2(x1), r2(y0)], [r2(x1), r2(y1)], [r2(x0), r2(y1)]];

// ---------- cotas principales ----------
/** Cadena de cotas del frontal B: 3,5 + 2,5 + 3,5 + 1,20 + 5 = 15,70 m (documentado). */
const CHAIN = [3.5, 2.5, 3.5, 1.2, 5];
const L = r2(CHAIN.reduce((a, b) => a + b, 0)); // 15,70
/** Ancho: 5 m (propiedad). */
const W = 5;
/** Muro del frontal B (el de la puerta de entrada): 0,60 m; el resto, 0,30 m (propiedad). */
const T = 0.3;
const TB = 0.6;
const TP = 0.1;
/** Altura total de los alzados: 6,20 m (documentado). */
const H_TOTAL = 6.2;
/** Suelo del altell a 2,60 m (propiedad). Canto del forjado: pendiente. */
const ALTELL = 2.6;
const SLAB = 0.12;
const H_PB = r2(ALTELL - SLAB);

const h = T / 2;
const x0 = T, x1 = r2(L - T), y0 = T, y1 = r2(W - TB); // interior: 0,30–15,40 × 0,30–4,40
const X_DORM = CHAIN[0]; // 3,50 tabique dormitorio / baño
const X_ESC = r2(CHAIN[0] + CHAIN[1]); // 6,00 tabique baño / escalera
const X_PUERTA = r2(CHAIN[0] + CHAIN[1] + CHAIN[2]); // 9,50 puerta de entrada
const Y_PASILLO = 1.2; // línea del pasillo junto al frontal A (medida)
/** Armario del pasillo: el rectángulo junto a la línea del pasillo (≈1,40 × 0,65), abierto al pasillo (propiedad). */
const ARM_X1 = 5.0; // eje del tabique entre armario y entrada al baño
const ARM_Y1 = 1.95; // eje del fondo del armario
/** Puerta del baño: el arco dibujado en la línea del pasillo, junto a la escalera (propiedad). */
const BANO_PUERTA_X0 = 5.05;
const ALT_X1 = r2(X_ESC + TP / 2); // 6,05 borde del altell
const ESC: [number, number, number, number] = [ALT_X1, r2(Y_PASILLO + TP / 2), 7.25, y1];

const S = {
  planta: 'boceto-planta-baixa',
  fa: 'boceto-frontal-a',
  fb: 'boceto-frontal-b',
  altell: 'boceto-altell',
  prop: 'indicacion-propiedad',
  hip: 'hipotesis',
};

const ext = { levelId: 'pb', thickness: T, height: H_TOTAL, kind: 'exterior' as const, status: 'documentado' as const, sourceId: S.prop };
const tab = { levelId: 'pb', thickness: TP, height: H_PB, kind: 'tabique' as const, status: 'interpretado' as const, sourceId: S.planta };

const walls: Wall[] = [
  { ...ext, id: 'muro-A', facade: 'A', a: [h, h], b: [L - h, h], ext: [h, h] },
  { ...ext, id: 'muro-derecho', facade: 'derecho', a: [L - h, h], b: [L - h, W - TB / 2], ext: [-h, -TB / 2] },
  { ...ext, id: 'muro-B', facade: 'B', thickness: TB, a: [h, W - TB / 2], b: [L - h, W - TB / 2], ext: [h, h] },
  { ...ext, id: 'muro-izquierdo', facade: 'izquierdo', a: [h, h], b: [h, W - TB / 2], ext: [-h, -TB / 2] },
  // tabique dormitorio / baño (cadena 3,50), desde la línea del pasillo hasta el frontal B
  { ...tab, id: 'tab-dormitorio', a: [X_DORM, Y_PASILLO - TP / 2], b: [X_DORM, y1] },
  // línea del pasillo: separa el pasillo (junto al frontal A) del baño y del armario
  { ...tab, id: 'tab-pasillo', a: [X_DORM + TP / 2, Y_PASILLO], b: [ALT_X1, Y_PASILLO] },
  // borde izquierdo de la escalera (cadena 6,00): cierra el baño
  { ...tab, id: 'tab-escalera', a: [X_ESC, Y_PASILLO + TP / 2], b: [X_ESC, y1] },
  // armario con puerta desde el pasillo (indicación de la propiedad); su fondo no está dibujado
  { ...tab, id: 'tab-armario-lado', a: [ARM_X1, Y_PASILLO + TP / 2], b: [ARM_X1, ARM_Y1 + TP / 2] },
  { ...tab, id: 'tab-armario-fondo', a: [X_DORM + TP / 2, ARM_Y1], b: [ARM_X1 + TP / 2, ARM_Y1] },
];

const onAB = (x: number) => r2(x - h); // offset sobre el eje de los muros A y B (empieza en x = 0,15)
const openings: Opening[] = [
  {
    id: 'obertura-7m', label: 'Obertura de 7 m', wallId: 'muro-A', kind: 'cristalera', offset: onAB(7.4), width: 7, sill: 0, height: 3.15,
    system: null, status: 'interpretado', sourceId: S.planta,
    note: 'Anchura documentada (7 m). En planta empieza junto a la escalera (≈7,3 m) y en el alzado A termina a ≈1,4 m del extremo: se toma 7,40–14,40 m. Altura medida en el alzado A (≈3,15 m), en la zona de doble altura. Carpintería no definida.',
  },
  {
    id: 'obertura-225-pb', label: 'Obertura de 2,25 m (planta baja)', wallId: 'muro-A', kind: 'cristalera', offset: onAB(1.4), width: 2.25, sill: 0, height: 2.4,
    system: null, status: 'interpretado', sourceId: S.planta,
    note: 'Anchura documentada (225 cm). Posición: media entre la planta, el alzado A y el altell. El alzado la dibuja de ≈3,15 m, pero queda bajo el altell (2,60 m): se limita a 2,40 m hasta confirmar.',
  },
  {
    id: 'obertura-225-altell', label: 'Obertura de 2,25 m (altell)', wallId: 'muro-A', kind: 'cristalera', offset: onAB(1.4), width: 2.25, sill: 3.7, height: 2.2,
    system: null, status: 'interpretado', sourceId: S.fa,
    note: 'Anchura documentada (2,25 m), alineada con la de planta baja. Antepecho ≈3,70 m (1,10 m sobre el suelo del altell); dintel a ≈5,90 m. Los bordes en zigzag se ignoran (propiedad).',
  },
  {
    id: 'puerta-120', label: 'Puerta de entrada (1,20 m)', wallId: 'muro-B', kind: 'puerta', offset: onAB(X_PUERTA), width: 1.2, sill: 0, height: 3.0,
    system: { type: 'abatible', leaves: 1, status: 'interpretado' }, swing: { hinge: 'inicio', dir: -1 }, status: 'documentado', sourceId: S.planta,
    note: 'Anchura y posición documentadas (cadena de cotas y «120 cm» del frontal B). En el muro de 0,60 m. Una hoja con bisagra en el lado del 9,50, abre hacia dentro. Altura medida en el alzado B (≈3,0 m).',
  },
  {
    id: 'puerta-70', label: 'Puerta de 70 cm (baño)', wallId: 'muro-B', kind: 'puerta', offset: onAB(5.2), width: 0.7, sill: 0, height: 2.2,
    system: { type: 'abatible', leaves: 1, status: 'pendiente' }, status: 'documentado', sourceId: S.prop,
    note: 'Puerta (propiedad) de 70 cm del frontal B. Posición según el alzado B y la marca «×» de la planta (5,20–5,90 m). Bajo el altell: altura 2,20 m (hipótesis). Giro no dibujado.',
  },
  {
    id: 'puerta-bano', label: 'Puerta del baño', wallId: 'tab-pasillo', kind: 'puerta', offset: r2(BANO_PUERTA_X0 - (X_DORM + TP / 2)), width: 0.9, sill: 0, height: 2.1,
    system: { type: 'abatible', leaves: 1, status: 'interpretado' }, swing: { hinge: 'inicio', dir: 1 }, status: 'documentado', sourceId: S.prop,
    note: 'Entrada al baño desde el pasillo (propiedad). Bisagra y giro según el arco dibujado; altura estándar (hipótesis).',
  },
  {
    id: 'puertas-armario', label: 'Puertas del armario', wallId: 'tab-pasillo', kind: 'puerta', offset: 0.05, width: r2(ARM_X1 - TP / 2 - (X_DORM + TP / 2) - 0.05), sill: 0, height: 2.1,
    system: { type: 'abatible', leaves: 2, status: 'pendiente' }, status: 'documentado', sourceId: S.prop,
    note: 'Armario que se abre desde el pasillo (propiedad). Tipo de puertas no indicado: dos hojas provisionales.',
  },
];

const room = (id: string, levelId: string, name: string, poly: Vec2[], status: Room['status'], sourceId: string, note: string, extra: Partial<Room> = {}): Room => ({
  id, levelId, name, polygon: poly, status, sourceId, note, ...extra,
});
const rooms: Room[] = [
  room('dormitorio', 'pb', 'Dormitorio', rect(x0, y0, X_DORM - TP / 2, y1), 'interpretado', S.planta, 'Cama en el extremo izquierdo, cabecero contra el frontal B, y armario empotrado en el lateral.', { openTo: ['pasillo'] }),
  room('pasillo', 'pb', 'Pasillo', rect(X_DORM - TP / 2, y0, ALT_X1, Y_PASILLO - TP / 2), 'interpretado', S.planta, 'Franja de ≈0,85 m libres junto al frontal A: une la zona de día y el arranque de la escalera con el dormitorio.', { openTo: ['dormitorio', 'dia'] }),
  room('bano', 'pb', 'Baño', [
    [ARM_X1 + TP / 2, Y_PASILLO + TP / 2], [X_ESC - TP / 2, Y_PASILLO + TP / 2], [X_ESC - TP / 2, y1], [X_DORM + TP / 2, y1], [X_DORM + TP / 2, ARM_Y1 + TP / 2], [ARM_X1 + TP / 2, ARM_Y1 + TP / 2],
  ], 'documentado', S.prop, 'Entrada desde el pasillo, junto a la escalera (propiedad). Ducha doble, inodoro y lavabo. Puerta de 70 cm al frontal B.'),
  room('armario-pasillo', 'pb', 'Armario', rect(X_DORM + TP / 2, Y_PASILLO + TP / 2, ARM_X1 - TP / 2, ARM_Y1 - TP / 2), 'documentado', S.prop, 'Armario que se abre desde el pasillo (propiedad), en el rectángulo dibujado junto a la línea del pasillo.'),
  room('dia', 'pb', 'Cocina y estar', rect(ALT_X1, y0, x1, y1), 'documentado', S.prop, 'Doble altura (propiedad). Escalera en L, cocina junto a la escalera con isla central, sofá en L y estufa.', { openTo: ['pasillo'] }),
  room('altell', 'altell', 'Altell', rect(x0, y0, ALT_X1, y1), 'documentado', S.prop, 'A 2,60 m sobre el dormitorio, el pasillo y el baño (propiedad). La zona de día es de doble altura. Borde hacia la doble altura en el 6,05 (barandilla no dibujada).'),
];

const f = (x: Furniture) => x;
const furniture: Furniture[] = [
  // dormitorio
  f({ id: 'armario', type: 'armario', label: 'Armario empotrado', roomId: 'dormitorio', x: 0.55, y: r2((y0 + y1) / 2), w: r2(y1 - y0), d: 0.5, h: 2.4, rot: 270, status: 'documentado', note: 'Franja del lateral izquierdo (propiedad). Fondo ≈0,5 m medido.' }),
  f({ id: 'cama', type: 'cama', label: 'Cama 160 × 200', roomId: 'dormitorio', x: 1.98, y: r2(y1 - 1.0), w: 1.6, d: 2.0, h: 0.55, rot: 180, status: 'interpretado', note: 'Dibujada de ≈1,65 × 2,05 m con dos almohadas y el embozo; cabecero contra el frontal B.' }),
  // baño
  f({ id: 'armario-pasillo-mueble', type: 'armario', label: 'Armario del pasillo', roomId: 'armario-pasillo', x: 4.23, y: 1.57, w: 1.3, d: 0.6, h: 2.2, rot: 180, status: 'documentado', note: 'Rectángulo de ≈1,40 × 0,65 junto a la línea del pasillo; se abre desde el pasillo (propiedad).' }),
  f({ id: 'ducha', type: 'ducha', label: 'Ducha doble', roomId: 'bano', x: 3.93, y: 2.5, w: 1.0, d: 0.75, h: 2.0, rot: 270, status: 'documentado', note: 'Rectángulo de ≈0,75 × 1,00 con punto de agua. La propiedad indica dos duchas, una delante de la otra: se interpreta como ducha doble en este recinto.' }),
  f({ id: 'inodoro', type: 'inodoro', label: 'Inodoro', roomId: 'bano', x: 3.88, y: 3.22, w: 0.38, d: 0.65, h: 0.42, rot: 270, status: 'documentado', note: 'En la marca «×» contra el tabique del dormitorio (propiedad: las «×» marcan agua, inodoro y lavabo).' }),
  f({ id: 'lavabo', type: 'lavabo', label: 'Lavabo', roomId: 'bano', x: 4.28, y: r2(y1 - 0.3), w: 1.45, d: 0.6, h: 0.85, rot: 180, status: 'documentado', note: 'Mueble dibujado contra el frontal B, con la marca «×» del lavabo.' }),
  // cocina y estar
  f({ id: 'encimera', type: 'encimera', label: 'Cocina', roomId: 'dia', x: 8.35, y: r2(y1 - 0.3), w: 2.2, d: 0.6, h: 0.9, rot: 180, status: 'documentado', note: 'Cocina junto a la escalera (propiedad), contra el frontal B, con dos puntos de agua «×».' }),
  f({ id: 'isla', type: 'isla', label: 'Isla central', roomId: 'dia', x: 8.8, y: 2.38, w: 1.5, d: 1.65, h: 0.9, rot: 0, status: 'documentado', note: 'Isla central de la cocina (propiedad). Medidas del dibujo (≈1,55 × 1,65).' }),
  f({ id: 'sofa-b', type: 'sofa-l', label: 'Sofá en L (frontal B)', roomId: 'dia', x: 12.75, y: 3.97, w: 4.0, d: 0.85, h: 0.8, rot: 180, status: 'documentado', note: 'Sofá (propiedad): tramo desde la jamba de la puerta hasta ≈14,75 m, fondo ≈0,85 m.' }),
  f({ id: 'sofa-lateral', type: 'sofa-l', label: 'Sofá en L (lateral derecho)', roomId: 'dia', x: 15.07, y: 3.0, w: 2.8, d: 0.65, h: 0.8, rot: 90, status: 'documentado', note: 'Segundo tramo del sofá contra el lateral derecho, desde ≈1,60 m; fondo dibujado ≈0,65 m.' }),
  f({ id: 'estufa', type: 'estufa', label: 'Estufa', roomId: 'dia', x: 14.43, y: 0.9, w: 0.8, d: 0.8, h: 1.0, rot: 0, status: 'documentado', note: 'El círculo del boceto (propiedad), junto al frontal A al final de la obertura de 7 m. Dibujado de ≈1 m de diámetro; salida de humos supuesta.' }),
];

const water = (id: string, levelId: string, p: Vec2, note: string, sourceId = S.planta): Trace => ({ id, levelId, label: 'Punto de agua (×)', cross: p, sourceId, note });
const traces: Trace[] = [
  water('x-ducha', 'pb', [3.72, 2.3], 'En la ducha.'),
  water('x-frontal-a', 'pb', [4.65, y0], 'Sobre la línea del frontal A en el tramo del baño.'),
  water('x-cocina-1', 'pb', [7.57, 3.8], 'En el borde de la encimera.'),
  water('x-cocina-2', 'pb', [8.35, 3.8], 'En el borde de la encimera.'),
  water('x-altell', 'altell', [0.6, 0.6], 'Junto a la esquina del lateral izquierdo y el frontal A.', S.altell),
  { id: 'borde-altell', levelId: 'altell', label: 'Borde sobre la doble altura', sourceId: S.prop, points: [[ALT_X1, y0], [ALT_X1, r2(y1 - 0.65)]], note: 'Borde del altell hacia la zona de día. La barandilla no está dibujada.' },
];

export const VINALLOP: ProjectData = {
  id: 'casa-vinallop',
  name: 'Casa Vinallop',
  isTest: false,
  version: '0.7 · bocetos y respuestas del 04/10/2026',
  levels: [
    { id: 'pb', name: 'Planta baja', elevation: 0, wallHeight: H_PB, elevationStatus: 'documentado' },
    { id: 'altell', name: 'Altell', elevation: ALTELL, wallHeight: r2(H_TOTAL - ALTELL), elevationStatus: 'documentado' },
  ],
  walls,
  openings,
  rooms,
  furniture,
  slabs: [
    { id: 'forjado-altell', levelId: 'altell', thickness: SLAB, status: 'pendiente', sourceId: S.hip, polygon: rect(x0, y0, ALT_X1, y1), note: 'Suelo a 2,60 m (propiedad). Canto del forjado no indicado (0,12 m provisional).' },
  ],
  stairs: [
    {
      id: 'escalera', fromLevel: 'pb', toLevel: 'altell', rect: ESC, up: '+y', upStatus: 'documentado', winderEnd: 0.65, risers: 14, status: 'interpretado', sourceId: S.planta,
      note: 'Escalera en L: arranca junto al pasillo (lado del frontal A), sube hacia el frontal B y en el tramo final gira con peldaños compensados para desembarcar en el altell. Sentido indicado por la propiedad; ancho ≈1,20 m y 14 peldaños hasta 2,60 m (≈0,19 m de tabica).',
    },
  ],
  traces,
  roofOptions: [
    {
      type: 'plana', label: 'Plana', pitchDeg: 0, overhang: 0, thickness: 0.25, parapet: 0, status: 'documentado',
      note: 'Cubierta plana (propiedad), coronada a 6,20 m como los alzados. Canto provisional.',
      ceiling: { type: 'vuelta-catalana', spacing: 0.8, rise: 0.1, status: 'pendiente', note: 'Por dentro, vuelta catalana (propiedad). Separación de vigas (0,80 m), flecha (0,10 m) y dirección de las bovedillas: hipótesis de visualización.' },
    },
  ],
  measures: [
    { id: 'largo', label: 'Largo total (suma de la cadena de cotas)', value: L, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '3,5 + 2,5 + 3,5 + 1,20 + 5. Se toma como medida exterior.' },
    { id: 'tramo-1', label: 'Tramo dormitorio', value: 3.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«3\'5 METRES»' },
    { id: 'tramo-2', label: 'Tramo baño', value: 2.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«2\'5 M»' },
    { id: 'tramo-3', label: 'Tramo escalera y cocina', value: 3.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«3\'5 M»' },
    { id: 'tramo-4', label: 'Puerta de entrada', value: 1.2, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '«1\'20 M» y «120 cm» en el frontal B' },
    { id: 'tramo-5', label: 'Tramo final (estar)', value: 5, unit: 'm', decimals: 0, sourceId: S.planta, status: 'documentado', note: '«5 METRES»' },
    { id: 'ancho', label: 'Ancho exterior', value: W, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado', note: '«5 de ancho» (propiedad).' },
    { id: 'espesor-b', label: 'Muro del frontal B (puerta de entrada)', value: TB, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado' },
    { id: 'espesor', label: 'Resto de muros exteriores', value: T, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado' },
    { id: 'altura', label: 'Altura total (alzados A y B)', value: H_TOTAL, unit: 'm', decimals: 2, sourceId: S.fa, status: 'documentado', note: '«6\'20 METRES»' },
    { id: 'cota-altell', label: 'Suelo del altell', value: ALTELL, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado', note: '«está a 260 cm de altura»' },
    { id: 'canto-altell', label: 'Canto del forjado del altell', value: SLAB, unit: 'm', decimals: 2, sourceId: S.hip, status: 'pendiente' },
    { id: 'obertura-7', label: 'Obertura del frontal A', value: 7, unit: 'm', decimals: 0, sourceId: S.fa, status: 'documentado', note: '«OBERTURA 7 M» (planta) y «7 metres» (frontal A)' },
    { id: 'obertura-225', label: 'Oberturas de 2,25 m', value: 2.25, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '«OBERTURA: 225 CM»; «2,25 m» dos veces en el frontal A' },
    { id: 'puerta-70', label: 'Puerta del frontal B', value: 0.7, unit: 'm', decimals: 2, sourceId: S.fb, status: 'documentado', note: '«70 cm»; es una puerta (propiedad)' },
    { id: 'altura-7m', label: 'Altura de la obertura de 7 m', value: 3.15, unit: 'm', decimals: 2, sourceId: S.fa, status: 'interpretado', note: 'Medida en el alzado A.' },
    { id: 'altura-225', label: 'Altura de la obertura de 2,25 m (planta baja)', value: 2.4, unit: 'm', decimals: 2, sourceId: S.hip, status: 'pendiente', note: 'Bajo el altell; el alzado la dibuja como la de 7 m.' },
    { id: 'pasillo', label: 'Fondo del pasillo junto al frontal A', value: 0.85, unit: 'm', decimals: 2, sourceId: S.planta, status: 'interpretado', note: 'Libre entre el frontal A y la línea del pasillo.' },
    { id: 'escalera-ancho', label: 'Ancho de la escalera', value: 1.2, unit: 'm', decimals: 1, sourceId: S.planta, status: 'interpretado' },
    { id: 'escalera-peldanos', label: 'Peldaños de la escalera', value: 14, unit: 'ud', decimals: 0, sourceId: S.planta, status: 'interpretado', note: '13 rectos dibujados + giro final.' },
  ],
  sources: [
    { id: S.planta, label: 'Foto del boceto «PLANTA BAIXA»', detail: 'Papel milimetrado A3, con escala gráfica de 1 m y cotas manuscritas.' },
    { id: S.fa, label: 'Foto del boceto «FRONTAL A»', detail: 'Alzado del lado superior de la planta, visto desde fuera (invertido izquierda-derecha).' },
    { id: S.fb, label: 'Foto del boceto «FRONTAL B»', detail: 'Alzado del lado inferior de la planta, visto desde fuera.' },
    { id: S.altell, label: 'Foto del boceto «ALTELL»', detail: 'Contorno del nivel superior con la escalera; sin cotas.' },
    { id: S.prop, label: 'Indicaciones de la propiedad (04/10/2026)', detail: 'Escalera al revés; entrada al baño desde el pasillo y armario al lado; 5 m de ancho; muros de 0,60 m (frontal B) y 0,30 m; armario empotrado; sofá y estufa; cocina con isla; dos duchas, inodoro y lavabo; doble altura y altell a 2,60 m; puerta de 70 cm; cubierta plana con vuelta catalana.' },
    { id: S.hip, label: 'Hipótesis de visualización', detail: 'Valor provisional para poder dibujar; no figura en los bocetos.' },
  ],
  readings: [
    { sourceId: S.planta, read: '«PLANTA BAIXA», escala «1 METRE»', interpreted: 'Planta baja.' },
    { sourceId: S.planta, read: '«3\'5 METRES» · «2\'5 M» · «3\'5 M» · «1\'20 M» · «5 METRES» bajo el lado inferior', interpreted: 'Cadena de cotas del frontal B. Total 15,70 m.' },
    { sourceId: S.planta, read: '«OBERTURA: 225 CM» y «OBERTURA 7 M» en el lado superior', interpreted: 'Huecos de 2,25 m y 7 m en el frontal A.' },
    { sourceId: S.planta, read: 'Línea paralela al lateral izquierdo con marcas', interpreted: 'Armario empotrado (propiedad).' },
    { sourceId: S.planta, read: 'Rectángulo con dos almohadas y embozo', interpreted: 'Cama de ≈1,60 × 2,00 con el cabecero contra el frontal B.' },
    { sourceId: S.planta, read: 'Línea paralela al frontal A con un arco de puerta junto a la escalera', interpreted: 'Pasillo; el arco es la entrada al baño (propiedad).' },
    { sourceId: S.planta, read: 'Rectángulo junto a la línea del pasillo (≈1,40 × 0,65)', interpreted: 'Armario que se abre desde el pasillo (propiedad).' },
    { sourceId: S.planta, read: 'Rectángulo de ≈0,75 × 1,00, otro junto al frontal B y marcas «×» en el tramo de 2,5 m', interpreted: 'Baño: ducha (dos duchas, una delante de la otra), inodoro y lavabo; las «×» son puntos de agua (propiedad).' },
    { sourceId: S.planta, read: 'Escalera con 13 peldaños y un triángulo junto al lado inferior', interpreted: 'Escalera en L que sube hacia el frontal B y gira al altell (propiedad).' },
    { sourceId: S.planta, read: 'Rectángulo largo junto al lado inferior con dos «×» y rectángulo grande en el centro', interpreted: 'Cocina junto a la escalera con isla central (propiedad).' },
    { sourceId: S.planta, read: 'Línea en U desde la jamba de la puerta y círculo junto al lado superior', interpreted: 'Sofá en L y estufa (propiedad).' },
    { sourceId: S.fa, read: '«FRONTAL A.», «7 metres», «2,25 m» (dos), «6\'20 METRES», bordes en zigzag', interpreted: 'Altura 6,20 m; huecos alineados. El zigzag se ignora (propiedad).' },
    { sourceId: S.fb, read: '«FRONTAL B», «70 cm», «120 cm»', interpreted: 'Puerta de entrada de 1,20 m y puerta de 70 cm en el baño.' },
    { sourceId: S.altell, read: '«ALTELL», contorno, hueco superior izquierdo, escalera; marcas solo en la mitad izquierda', interpreted: 'Altell sobre dormitorio y baño; la mitad derecha es doble altura (propiedad).' },
  ],
  discrepancies: [
    'Posición del hueco de 2,25 m: planta ≈1,25–3,50 m, alzado A ≈1,45–3,85 m y altell ≈1,55–3,95 m. Se usa la media (1,40–3,65 m).',
    'El alzado A dibuja el hueco de 2,25 m de planta baja tan alto como el de 7 m (≈3,15 m), pero queda bajo el altell a 2,60 m. Se limita a 2,40 m.',
    'El alzado B dibuja la puerta de 70 cm de ≈2,9 m de alto, también bajo el altell. Se toma 2,20 m.',
    'Los anchos de los huecos de los alzados no están a escala. Se usan las cotas escritas.',
  ],
  questions: [
    '¿Qué altura tiene la obertura de 2,25 m de planta baja, bajo el altell?',
    'Vuelta catalana: ¿en qué dirección van las vigas y cada cuánto?',
    'Ducha: ¿las dos duchas, una delante de la otra, están en el rectángulo de ≈0,75 × 1,00 junto al tabique del dormitorio (ducha doble)?',
    '¿Se añade una barandilla en el borde del altell hacia la doble altura? No está dibujada.',
  ],
  northDeg: null,
  facades: { A: 'Frontal A', B: 'Frontal B', izquierdo: 'Lateral izquierdo', derecho: 'Lateral derecho' },
  notices: ['Geometría de los bocetos fotografiados y de las respuestas de la propiedad. Revisa las preguntas en «Medidas y documentación».'],
};
