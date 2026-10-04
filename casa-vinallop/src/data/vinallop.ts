/**
 * CASA VINALLOP — definición del proyecto a partir de las fotografías de los bocetos
 * (planta baixa, frontal A, frontal B y altell) del 4 de octubre de 2026,
 * revisadas con ampliación y la indicación de la propiedad sobre la escalera.
 *
 * ORIENTACIÓN: la de los textos del boceto («PLANTA BAIXA» legible). X crece hacia
 * la derecha del papel (el dormitorio queda a la izquierda) e Y hacia abajo.
 * Y = 0 es la cara exterior del frontal A (lado superior); Y = ancho, la del frontal B.
 *
 * ESTADOS: documentado = cota escrita o indicación de la propiedad · interpretado =
 * medido o deducido del dibujo (sin cota) · propuesto = decisión de diseño ·
 * pendiente = no se distingue o falta. Las medidas interpretadas se redondean a
 * 0,05 m y tienen una incertidumbre de unos ±0,2 m: el boceto está dibujado a mano.
 *
 * Método de medida: cada elemento se sitúa respecto a las marcas de la cadena de
 * cotas más próximas (0 · 3,50 · 6,00 · 9,50 · 10,70 · 15,70 m), porque la escala
 * del dibujo varía de un tramo a otro. Los alzados se escalan con su longitud total.
 */
import type { Furniture, Opening, ProjectData, Room, Trace, Vec2, Wall } from './types';

const r2 = (x: number) => Math.round(x * 100) / 100;
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[r2(x0), r2(y0)], [r2(x1), r2(y0)], [r2(x1), r2(y1)], [r2(x0), r2(y1)]];

// ---------- cotas principales ----------
/** Cadena de cotas del frontal B: 3,5 + 2,5 + 3,5 + 1,20 + 5 = 15,70 m (documentado). */
const CHAIN = [3.5, 2.5, 3.5, 1.2, 5];
const L = r2(CHAIN.reduce((a, b) => a + b, 0)); // 15,70
/** Ancho: sin cota escrita. Medido con la escala gráfica de 1 m del boceto (interpretado). */
const W = 5.1;
/** Espesor de muros: no figura. Las líneas discontinuas del altell sugieren ≈0,3–0,4 m. */
const T = 0.3;
const TP = 0.1;
/** Altura total de los alzados: 6,20 m (documentado). */
const H_TOTAL = 6.2;
/** Cota del suelo del altell: no figura (hipótesis entre la coronación de los huecos bajos y el antepecho del alto). */
const ALTELL = 3.3;
const SLAB = 0.12;
const H_PB = r2(ALTELL - SLAB);

const h = T / 2;
const x0 = T, x1 = r2(L - T), y0 = T, y1 = r2(W - T);
const X_DORM = CHAIN[0]; // 3,50 tabique dormitorio / baño
const X_ESC = r2(CHAIN[0] + CHAIN[1]); // 6,00 tabique baño / escalera
const X_PUERTA = r2(CHAIN[0] + CHAIN[1] + CHAIN[2]); // 9,50 puerta de entrada
const Y_PASILLO = 1.0; // línea del pasillo junto al frontal A (medida)
/** Armario del pasillo: entre el bloque de la bañera y la escalera. Fondo pendiente (≥0,90 m para que abra la hoja dibujada). */
const ARM_X0 = 5.05;
const ARM_Y1 = 2.0;
const ESC: [number, number, number, number] = [r2(X_ESC + TP / 2), 1.05, 7.25, y1];

const S = {
  planta: 'boceto-planta-baixa',
  fa: 'boceto-frontal-a',
  fb: 'boceto-frontal-b',
  altell: 'boceto-altell',
  prop: 'indicacion-propiedad',
  hip: 'hipotesis',
};

const ext = { levelId: 'pb', thickness: T, height: H_TOTAL, kind: 'exterior' as const, status: 'interpretado' as const, sourceId: S.planta };
const tab = { levelId: 'pb', thickness: TP, height: H_PB, kind: 'tabique' as const, status: 'interpretado' as const, sourceId: S.planta };

const walls: Wall[] = [
  { ...ext, id: 'muro-A', facade: 'A', a: [h, h], b: [L - h, h], ext: [h, h] },
  { ...ext, id: 'muro-derecho', facade: 'derecho', a: [L - h, h], b: [L - h, W - h], ext: [-h, -h] },
  { ...ext, id: 'muro-B', facade: 'B', a: [h, W - h], b: [L - h, W - h], ext: [h, h] },
  { ...ext, id: 'muro-izquierdo', facade: 'izquierdo', a: [h, h], b: [h, W - h], ext: [-h, -h] },
  // tabique dormitorio / baño (cadena 3,50), desde la línea del pasillo hasta el frontal B
  { ...tab, id: 'tab-dormitorio', a: [X_DORM, Y_PASILLO - TP / 2], b: [X_DORM, y1] },
  // línea del pasillo: separa el pasillo (junto al frontal A) del baño; lleva la puerta del baño
  { ...tab, id: 'tab-pasillo', a: [X_DORM + TP / 2, Y_PASILLO], b: [X_ESC + TP / 2, Y_PASILLO] },
  // borde izquierdo de la escalera (cadena 6,00): cierra el baño
  { ...tab, id: 'tab-escalera', a: [X_ESC, Y_PASILLO + TP / 2], b: [X_ESC, y1] },
  // armario con puerta desde el pasillo (indicación de la propiedad); su fondo no está dibujado
  { ...tab, id: 'tab-armario-lado', a: [ARM_X0 - TP / 2, Y_PASILLO + TP / 2], b: [ARM_X0 - TP / 2, ARM_Y1 + TP] },
  { ...tab, id: 'tab-armario-fondo', a: [ARM_X0 - TP / 2, ARM_Y1 + TP / 2], b: [X_ESC - TP / 2, ARM_Y1 + TP / 2], status: 'pendiente' },
];

const onA = (x: number) => r2(x - h); // offset sobre el eje de los muros A y B (empieza en x = h)
const openings: Opening[] = [
  {
    id: 'obertura-7m', label: 'Obertura de 7 m', wallId: 'muro-A', kind: 'cristalera', offset: onA(7.4), width: 7, sill: 0, height: 3.15,
    system: null, status: 'interpretado', sourceId: S.planta,
    note: 'Anchura documentada (7 m). En planta empieza junto a la escalera (≈7,3 m) y en el alzado A termina a ≈1,4 m del extremo: se toma 7,40–14,40 m. Altura medida en el alzado A (≈3,15 m). Carpintería no definida.',
  },
  {
    id: 'obertura-225-pb', label: 'Obertura de 2,25 m (planta baja)', wallId: 'muro-A', kind: 'cristalera', offset: onA(1.4), width: 2.25, sill: 0, height: 3.15,
    system: null, status: 'interpretado', sourceId: S.planta,
    note: 'Anchura documentada (225 cm). Posición: media entre la planta (≈1,25–3,50), el alzado A (≈1,45–3,85) y el altell (≈1,55–3,95). Abre al dormitorio y al arranque del pasillo. Altura medida en el alzado A.',
  },
  {
    id: 'obertura-225-altell', label: 'Obertura de 2,25 m (altell)', wallId: 'muro-A', kind: 'cristalera', offset: onA(1.4), width: 2.25, sill: 3.7, height: 2.1,
    system: null, status: 'interpretado', sourceId: S.fa,
    note: 'Anchura documentada (2,25 m), alineada con la de planta baja y con el hueco del boceto del altell. Antepecho ≈3,70 m; el dintel se toma en la línea discontinua (≈5,80 m). Los bordes en zigzag no se interpretan.',
  },
  {
    id: 'puerta-120', label: 'Puerta de entrada (1,20 m)', wallId: 'muro-B', kind: 'puerta', offset: onA(X_PUERTA), width: 1.2, sill: 0, height: 3.0,
    system: { type: 'abatible', leaves: 1, status: 'interpretado' }, swing: { hinge: 'inicio', dir: -1 }, status: 'documentado', sourceId: S.planta,
    note: 'Anchura y posición documentadas (cadena de cotas y «120 cm» del frontal B, que la sitúa en el mismo punto). Una hoja con bisagra en el lado del 9,50, abre hacia dentro (arco dibujado). Altura medida en el alzado B (≈3,0 m).',
  },
  {
    id: 'obertura-70', label: 'Obertura de 70 cm (baño)', wallId: 'muro-B', kind: 'ventana', offset: onA(5.2), width: 0.7, sill: 0, height: 2.9,
    system: null, status: 'interpretado', sourceId: S.fb,
    note: 'Anchura documentada (70 cm). El frontal B la centra en ≈5,5 m y la planta tiene una marca «×» en ≈5,6 m junto al frontal B: se toma 5,20–5,90 m, en el baño. Dibujada desde el suelo hasta ≈2,9 m.',
  },
  {
    id: 'puerta-armario', label: 'Puerta del armario', wallId: 'tab-pasillo', kind: 'puerta', offset: r2(ARM_X0 - (X_DORM + TP / 2)), width: 0.9, sill: 0, height: 2.1,
    system: { type: 'abatible', leaves: 1, status: 'interpretado' }, swing: { hinge: 'inicio', dir: 1 }, status: 'documentado', sourceId: S.prop,
    note: 'La propiedad indica que el arco dibujado en la línea del pasillo es la puerta de un armario, no la entrada al baño. Bisagra y giro según el dibujo; altura estándar (hipótesis).',
  },
];

const room = (id: string, levelId: string, name: string, poly: Vec2[], status: Room['status'], sourceId: string, note: string, extra: Partial<Room> = {}): Room => ({
  id, levelId, name, polygon: poly, status, sourceId, note, ...extra,
});
const ALT_IZQ_X1 = r2(X_ESC + TP / 2); // 6,05
const rooms: Room[] = [
  room('dormitorio', 'pb', 'Dormitorio', rect(x0, y0, X_DORM - TP / 2, y1), 'interpretado', S.planta, 'Cama dibujada en el extremo izquierdo, cabecero contra el frontal B. Sin rótulo en el boceto.', { openTo: ['pasillo'] }),
  room('pasillo', 'pb', 'Pasillo', rect(X_DORM - TP / 2, y0, ALT_IZQ_X1, Y_PASILLO - TP / 2), 'interpretado', S.planta, 'Franja de ≈0,65 m libres junto al frontal A: une la zona de día (y el arranque de la escalera) con el dormitorio, abierto a él.', { openTo: ['dormitorio', 'dia'] }),
  room('bano', 'pb', 'Baño', [
    [X_DORM + TP / 2, Y_PASILLO + TP / 2], [ARM_X0 - TP, Y_PASILLO + TP / 2], [ARM_X0 - TP, ARM_Y1 + TP], [X_ESC - TP / 2, ARM_Y1 + TP], [X_ESC - TP / 2, y1], [X_DORM + TP / 2, y1],
  ], 'interpretado', S.planta, 'Tramo de 2,5 m bajo el pasillo, menos el armario. Interpretado por la bañera, la ducha, el lavabo y las marcas. Acceso pendiente: la puerta del pasillo es de un armario; el tabique del dormitorio tiene un tramo sin trazo (≈3,1–3,65 m).'),
  room('armario-pasillo', 'pb', 'Armario', rect(ARM_X0, Y_PASILLO + TP / 2, X_ESC - TP / 2, ARM_Y1), 'interpretado', S.prop, 'Armario con puerta desde el pasillo (indicación de la propiedad). Ancho según el dibujo; fondo pendiente.'),
  room('dia', 'pb', 'Zona de día', rect(ALT_IZQ_X1, y0, x1, y1), 'interpretado', S.planta, 'Espacio sin tabiques: escalera, cocina lineal, mesa, banco corrido en L y círculo junto al frontal A.', { openTo: ['pasillo'] }),
  room('altell-izq', 'altell', 'Altell · sobre dormitorio y baño', rect(x0, y0, ALT_IZQ_X1, y1), 'pendiente', S.altell, 'Parte del altell con marcas interiores en el boceto (líneas discontinuas a ≈0,4 m de los muros).', { openTo: ['altell-paso'] }),
  room('altell-paso', 'altell', 'Altell · paso', rect(ALT_IZQ_X1, y0, ESC[2], ESC[1]), 'pendiente', S.altell, 'Franja sobre el arranque de la escalera que une las dos partes del altell.', { openTo: ['altell-izq', 'altell-der'] }),
  room('altell-der', 'altell', 'Altell · sobre la zona de día', rect(ESC[2], y0, x1, y1), 'pendiente', S.altell, 'El boceto dibuja el contorno pero sin ninguna marca interior. Pendiente confirmar si es altell o doble altura.', { openTo: ['altell-paso'] }),
];

const f = (x: Furniture) => x;
const furniture: Furniture[] = [
  // dormitorio
  f({ id: 'armario', type: 'armario', label: 'Armario empotrado', roomId: 'dormitorio', x: 0.55, y: 2.55, w: 4.5, d: 0.5, h: 2.4, rot: 270, status: 'interpretado', note: 'Franja de ≈0,5 m libre entre el lateral izquierdo y una línea paralela en todo el ancho, con marcas de división. También podría ser un muro más grueso.' }),
  f({ id: 'cama', type: 'cama', label: 'Cama 160 × 200', roomId: 'dormitorio', x: 1.98, y: r2(y1 - 1.0), w: 1.6, d: 2.0, h: 0.55, rot: 180, status: 'interpretado', note: 'Dibujada de ≈1,65 × 2,05 m con dos almohadas y el embozo; cabecero contra el frontal B.' }),
  // baño
  f({ id: 'banera', type: 'banera', label: 'Bañera 140 × 80', roomId: 'bano', x: 4.25, y: 1.45, w: 1.4, d: 0.8, h: 0.55, rot: 0, status: 'interpretado', note: 'Rectángulo de ≈1,50 × 0,80 contra la línea del pasillo; se ajusta a 1,40 m para dejar el tabique del armario.' }),
  f({ id: 'ducha', type: 'ducha', label: 'Plato de ducha 75 × 120', roomId: 'bano', x: 3.93, y: 2.5, w: 1.2, d: 0.75, h: 2.0, rot: 270, status: 'interpretado', note: 'Rectángulo de ≈0,75 × 1,20 bajo la bañera, contra el tabique del dormitorio, con una marca «×» (posible desagüe).' }),
  f({ id: 'lavabo', type: 'lavabo', label: 'Mueble de lavabo', roomId: 'bano', x: 4.28, y: r2(y1 - 0.3), w: 1.45, d: 0.6, h: 0.85, rot: 180, status: 'interpretado', note: 'Rectángulo de ≈1,45 m contra el frontal B con una marca «×» (posible lavabo).' }),
  // zona de día
  f({ id: 'encimera', type: 'encimera', label: 'Cocina lineal', roomId: 'dia', x: 8.35, y: r2(y1 - 0.33), w: 2.2, d: 0.65, h: 0.9, rot: 180, status: 'interpretado', note: 'Encimera de ≈0,65 m entre la escalera y la puerta, contra el frontal B, con dos marcas «×» (¿fregadero y placa?).' }),
  f({ id: 'mesa', type: 'mesa', label: 'Mesa ≈155 × 205', roomId: 'dia', x: 8.83, y: 2.38, w: 1.55, d: 2.05, h: 0.75, rot: 0, status: 'interpretado', note: 'Rectángulo grande en el centro del tramo de 3,5 m.' }),
  f({ id: 'banco-b', type: 'banco', label: 'Banco corrido (frontal B)', roomId: 'dia', x: 12.78, y: r2(y1 - 0.38), w: 4.05, d: 0.75, h: 0.45, rot: 180, status: 'interpretado', note: 'Trazo en U: franja de ≈0,75 m desde la jamba de la puerta hasta ≈14,80 m. Interpretado como banco o sofá corrido de obra.' }),
  f({ id: 'banco-lateral', type: 'banco', label: 'Banco corrido (lateral derecho)', roomId: 'dia', x: 15.1, y: 3.2, w: 3.2, d: 0.6, h: 0.45, rot: 90, status: 'interpretado', note: 'Continuación del trazo en U contra el lateral derecho, desde ≈1,60 m hasta el frontal B.' }),
];

const cross = (id: string, label: string, levelId: string, p: Vec2, note: string, sourceId = S.planta): Trace => ({ id, levelId, label, cross: p, sourceId, note });
const traces: Trace[] = [
  { id: 'trazo-circulo', levelId: 'pb', label: 'Círculo', sourceId: S.planta, circle: { c: [14.4, 0.85], r: 0.5 }, note: 'Círculo de ≈1 m de diámetro junto al frontal A, al final de la obertura de 7 m (trazo derecho más marcado). ¿Chimenea, estufa, mesa redonda?' },
  { id: 'trazo-hueco-dormitorio', levelId: 'pb', label: 'Tramo sin trazo', sourceId: S.planta, points: [[X_DORM, 3.1], [X_DORM, 3.65]], note: 'Interrupción del tabique dormitorio / baño (≈3,10–3,65 m). ¿Es la entrada al baño desde el dormitorio?' },
  cross('x-bano-wc', 'Marca × (baño)', 'pb', [3.72, 3.6], 'Entre la ducha y el lavabo, contra el tabique del dormitorio. ¿Inodoro?'),
  cross('x-bano-frontal-a', 'Marca × (frontal A, baño)', 'pb', [4.65, 0.15], 'Sobre la línea del frontal A en el tramo del baño; el alzado A tiene otra «×» a ≈1,1 m de altura en esa zona. ¿Ventana del baño?'),
  cross('x-cocina-1', 'Marca × (cocina)', 'pb', [7.55, 4.15], 'En el borde de la encimera.'),
  cross('x-cocina-2', 'Marca × (cocina)', 'pb', [8.35, 4.15], 'En el borde de la encimera.'),
  cross('x-altell', 'Marca × (altell)', 'altell', [0.6, 0.6], 'Junto a la esquina del lateral izquierdo y el frontal A.', S.altell),
];

export const VINALLOP: ProjectData = {
  id: 'casa-vinallop',
  name: 'Casa Vinallop',
  isTest: false,
  version: '0.5 · bocetos 04/10/2026 revisados',
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
      polygon: [[x0, y0], [x1, y0], [x1, y1], [ESC[2], y1], [ESC[2], ESC[1]], [ESC[0], ESC[1]], [ESC[0], y1], [x0, y1]],
      note: 'Cota y canto no figuran. Hueco sobre el tramo de escalera.',
    },
  ],
  stairs: [
    {
      id: 'escalera', fromLevel: 'pb', toLevel: 'altell', rect: ESC, up: '+y', upStatus: 'documentado', winderEnd: 0.65, risers: 14, status: 'interpretado', sourceId: S.planta,
      note: 'Arranca junto al pasillo (lado del frontal A) y sube hacia el frontal B, según la indicación de la propiedad. Posición documentada (cadena 6,00); ancho ≈1,20 m y 13 peldaños rectos dibujados más el triángulo final (peldaños compensados o meseta) medidos en el boceto.',
    },
  ],
  traces,
  roofOptions: [
    { type: 'plana', label: 'Plana', pitchDeg: 0, overhang: 0, thickness: 0.25, status: 'pendiente', note: 'Los alzados A y B terminan en una línea recta a 6,20 m: compatible con cubierta plana o a dos aguas con cumbrera longitudinal. Sin dato.' },
    { type: 'dos-aguas', label: 'Dos aguas', pitchDeg: 17, overhang: 0.25, thickness: 0.18, status: 'pendiente', note: 'Alternativa de visualización; pendiente sin dato.' },
    { type: 'un-agua', label: 'Un agua', pitchDeg: 8, overhang: 0.25, thickness: 0.18, status: 'pendiente', note: 'Alternativa de visualización; pendiente sin dato.' },
  ],
  measures: [
    { id: 'largo', label: 'Largo total (suma de la cadena de cotas)', value: L, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '3,5 + 2,5 + 3,5 + 1,20 + 5. Se toma como medida exterior; pendiente confirmar. El frontal B, escalado a esta longitud, sitúa la puerta justo donde marca la cadena.' },
    { id: 'tramo-1', label: 'Tramo dormitorio', value: 3.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«3\'5 METRES»' },
    { id: 'tramo-2', label: 'Tramo baño', value: 2.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«2\'5 M»' },
    { id: 'tramo-3', label: 'Tramo escalera, cocina y mesa', value: 3.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«3\'5 M»' },
    { id: 'tramo-4', label: 'Puerta de entrada', value: 1.2, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '«1\'20 M» y «120 cm» en el frontal B' },
    { id: 'tramo-5', label: 'Tramo final (estar)', value: 5, unit: 'm', decimals: 0, sourceId: S.planta, status: 'documentado', note: '«5 METRES»' },
    { id: 'ancho', label: 'Ancho exterior', value: W, unit: 'm', decimals: 1, sourceId: S.planta, status: 'interpretado', note: 'Sin cota escrita. Medido con la escala gráfica de 1 m del boceto (±0,3 m).' },
    { id: 'altura', label: 'Altura total (alzados A y B)', value: H_TOTAL, unit: 'm', decimals: 2, sourceId: S.fa, status: 'documentado', note: '«6\'20 METRES»' },
    { id: 'obertura-7', label: 'Obertura del frontal A', value: 7, unit: 'm', decimals: 0, sourceId: S.fa, status: 'documentado', note: '«OBERTURA 7 M» (planta) y «7 metres» (frontal A)' },
    { id: 'obertura-225', label: 'Oberturas de 2,25 m', value: 2.25, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '«OBERTURA: 225 CM»; «2,25 m» dos veces en el frontal A' },
    { id: 'obertura-70', label: 'Obertura del frontal B', value: 0.7, unit: 'm', decimals: 2, sourceId: S.fb, status: 'documentado', note: '«70 cm»' },
    { id: 'altura-huecos-a', label: 'Altura de los huecos bajos del frontal A', value: 3.15, unit: 'm', decimals: 2, sourceId: S.fa, status: 'interpretado', note: 'Medida en el alzado a escala de su altura total.' },
    { id: 'altura-huecos-b', label: 'Altura de los huecos del frontal B', value: 2.95, unit: 'm', decimals: 2, sourceId: S.fb, status: 'interpretado', note: 'Puerta ≈3,0 m; hueco de 70 cm ≈2,9 m.' },
    { id: 'hueco-alto', label: 'Antepecho del hueco alto del frontal A', value: 3.7, unit: 'm', decimals: 2, sourceId: S.fa, status: 'interpretado', note: 'La línea discontinua (≈5,80 m) se toma como dintel.' },
    { id: 'cota-altell', label: 'Cota del suelo del altell', value: ALTELL, unit: 'm', decimals: 2, sourceId: S.hip, status: 'pendiente', note: 'Hipótesis entre la coronación de los huecos bajos (≈3,15) y el antepecho del hueco alto (≈3,70).' },
    { id: 'espesor', label: 'Espesor de muros exteriores', value: T, unit: 'm', decimals: 2, sourceId: S.hip, status: 'pendiente', note: 'Las líneas discontinuas del altell, a ≈0,4 m de los muros, sugieren ≈0,3–0,4 m.' },
    { id: 'pasillo', label: 'Fondo del pasillo junto al frontal A', value: 1, unit: 'm', decimals: 1, sourceId: S.planta, status: 'interpretado', note: 'Desde la cara exterior del frontal A hasta la línea del pasillo.' },
    { id: 'escalera-ancho', label: 'Ancho de la escalera', value: 1.2, unit: 'm', decimals: 1, sourceId: S.planta, status: 'interpretado' },
    { id: 'escalera-peldanos', label: 'Peldaños de la escalera', value: 14, unit: 'ud', decimals: 0, sourceId: S.planta, status: 'interpretado', note: '13 rectos dibujados + tramo final compensado.' },
  ],
  sources: [
    { id: S.planta, label: 'Foto del boceto «PLANTA BAIXA»', detail: 'Papel milimetrado A3, con escala gráfica de 1 m y cotas manuscritas.' },
    { id: S.fa, label: 'Foto del boceto «FRONTAL A»', detail: 'Alzado del lado superior de la planta, visto desde fuera (invertido izquierda-derecha).' },
    { id: S.fb, label: 'Foto del boceto «FRONTAL B»', detail: 'Alzado del lado inferior de la planta, visto desde fuera.' },
    { id: S.altell, label: 'Foto del boceto «ALTELL»', detail: 'Contorno del nivel superior con la escalera; sin cotas.' },
    { id: S.prop, label: 'Indicación de la propiedad (04/10/2026)', detail: '«La escalera se sube al revés»: arranca junto al pasillo y sube hacia el frontal B.' },
    { id: S.hip, label: 'Hipótesis de visualización', detail: 'Valor provisional para poder dibujar; no figura en los bocetos.' },
  ],
  readings: [
    { sourceId: S.planta, read: '«PLANTA BAIXA», escala «1 METRE»', interpreted: 'Planta baja. La escala gráfica permite estimar medidas sin cota (ancho ≈5,1 m).' },
    { sourceId: S.planta, read: '«3\'5 METRES» · «2\'5 M» · «3\'5 M» · «1\'20 M» · «5 METRES» bajo el lado inferior', interpreted: 'Cadena de cotas del frontal B. Total 15,70 m.' },
    { sourceId: S.planta, read: '«OBERTURA: 225 CM» y hueco en la línea superior del dormitorio', interpreted: 'Hueco de 2,25 m en el frontal A.' },
    { sourceId: S.planta, read: '«OBERTURA 7 M»; línea superior interrumpida desde la escalera hasta ≈1,4 m del extremo', interpreted: 'Hueco de 7 m en el frontal A de la zona de día.' },
    { sourceId: S.planta, read: 'Línea paralela al lateral izquierdo a ≈0,8 m, con marcas', interpreted: 'Armario empotrado de ≈0,5 m (o muro grueso).' },
    { sourceId: S.planta, read: 'Rectángulo con dos almohadas y embozo', interpreted: 'Cama de ≈1,60 × 2,00 con el cabecero contra el frontal B.' },
    { sourceId: S.planta, read: 'Línea paralela al frontal A a ≈1 m, desde el dormitorio hasta la escalera, con un arco de puerta', interpreted: 'Pasillo junto al frontal A. El arco es la puerta de un armario (indicación de la propiedad).' },
    { sourceId: S.planta, read: 'Rectángulos de ≈1,50 × 0,80 y ≈0,75 × 1,20 en L, otro de ≈1,45 × 0,60 junto al frontal B, marcas «×»', interpreted: 'Baño con bañera, plato de ducha y mueble de lavabo. Las «×» se conservan como marcas.' },
    { sourceId: S.planta, read: 'Escalera con 13 peldaños y un triángulo junto al lado inferior', interpreted: 'Escalera de ≈1,20 m; el triángulo es el tramo compensado del desembarco.' },
    { sourceId: S.planta, read: 'Rectángulo largo entre la escalera y la puerta, junto al lado inferior, con dos «×»', interpreted: 'Cocina lineal de ≈2,20 × 0,65.' },
    { sourceId: S.planta, read: 'Rectángulo grande en el tramo de 3,5 m', interpreted: 'Mesa de ≈1,55 × 2,05.' },
    { sourceId: S.planta, read: 'Arco de puerta en el hueco de 1,20 m', interpreted: 'Puerta de entrada de una hoja que abre hacia dentro, bisagra en el lado del 9,50.' },
    { sourceId: S.planta, read: 'Línea en U desde la jamba de la puerta, paralela al lado inferior y al lateral derecho', interpreted: 'Banco o sofá corrido en L (≈0,75 y ≈0,60 m de fondo).' },
    { sourceId: S.planta, read: 'Círculo de ≈1 m junto al lado superior, al final de la obertura de 7 m', interpreted: 'Sin interpretar.' },
    { sourceId: S.fa, read: '«FRONTAL A.», «7 metres», «2,25 m» (dos), «6\'20 METRES», bordes en zigzag y línea discontinua en el hueco alto, una «×»', interpreted: 'Altura 6,20 m. Huecos bajos de ≈3,15 m de alto; hueco alto alineado con el bajo de 2,25 m.' },
    { sourceId: S.fb, read: '«FRONTAL B», «70 cm», «120 cm»', interpreted: 'Puerta de 1,20 m (≈3,0 m de alto) y hueco de 70 cm (≈2,9 m) en el baño.' },
    { sourceId: S.altell, read: '«ALTELL», contorno completo, hueco en el lado superior izquierdo, escalera, líneas discontinuas solo en la mitad izquierda', interpreted: 'Nivel superior; la mitad derecha no tiene marcas (¿doble altura?).' },
    { sourceId: S.prop, read: '«La escalera se sube al revés»', interpreted: 'La escalera arranca junto al pasillo y desembarca hacia el frontal B.' },
    { sourceId: S.prop, read: '«La entrada que hay en el baño es un armario»', interpreted: 'La puerta dibujada en la línea del pasillo abre a un armario; el acceso al baño queda pendiente.' },
  ],
  discrepancies: [
    'Posición del hueco de 2,25 m: planta ≈1,25–3,50 m, alzado A ≈1,45–3,85 m y altell ≈1,55–3,95 m. Se usa la media (1,40–3,65 m).',
    'Los anchos de los huecos de los alzados no están a escala (en el frontal B los de 70 y 120 cm se dibujan iguales). Se usan las cotas escritas.',
    'La obertura de 7 m: en planta empieza en ≈7,3 m y en el alzado A termina en ≈14,25 m. Se usa 7,40–14,40 m.',
    'En el tramo de 5 m el lado inferior aparece desplazado ≈0,2 m hacia fuera (pliegue del papel); se mantiene alineado.',
  ],
  questions: [
    '¿Cuál es el ancho real de la casa? No hay cota; con la escala gráfica sale ≈5,10 m.',
    '¿La cadena 3,5 + 2,5 + 3,5 + 1,20 + 5 está medida por fuera (15,70 m exteriores)? ¿Qué espesor tienen los muros?',
    '¿La franja del lateral izquierdo del dormitorio es un armario empotrado o un muro más grueso?',
    '¿El trazo en U del estar es un banco o sofá corrido de obra? ¿Y el círculo junto al frontal A?',
    '¿Por dónde se entra al baño? ¿Por el tramo sin trazo del tabique del dormitorio (≈3,1–3,65 m)? ¿Qué fondo tiene el armario del pasillo?',
    'Baño: ¿bañera y ducha a la vez? ¿Las «×» marcan inodoro y lavabo? ¿La «×» del frontal A es una ventana del baño?',
    '¿El altell ocupa toda la planta o la parte sobre la zona de día es de doble altura? ¿A qué altura está su suelo?',
    'El hueco de 70 cm del baño, ¿es ventana o puerta? Está dibujado desde el suelo.',
    '¿Qué indican los bordes en zigzag del hueco alto del frontal A? ¿Cómo es la cubierta?',
  ],
  northDeg: null,
  facades: { A: 'Frontal A', B: 'Frontal B', izquierdo: 'Lateral izquierdo', derecho: 'Lateral derecho' },
  notices: ['Geometría interpretada de los bocetos fotografiados. Revisa la lista de preguntas en «Medidas y documentación».'],
};
