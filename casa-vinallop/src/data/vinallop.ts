/**
 * CASA VINALLOP — definición del proyecto a partir de las fotografías de los bocetos
 * (planta baixa, frontal A, frontal B y altell) del 4 de octubre de 2026 y de las
 * respuestas de la propiedad.
 *
 * ORIENTACIÓN: la de los textos del boceto («PLANTA BAIXA» legible). X crece hacia
 * la derecha del papel (el dormitorio queda a la izquierda) e Y hacia abajo.
 * Y = 0 es la cara exterior del frontal A (lado superior); Y = 5,22 m, la del frontal B.
 *
 * MEDIDAS: envolvente exterior de 16,33 × 5,22 m según el informe del arquitecto (cifras
 * transmitidas por la propiedad; el informe no se ha adjuntado). La cadena de cotas del boceto
 * (15,70 m) se interpreta como medida interior desde la cara interior del lateral izquierdo:
 * 15,70 + 2 × 0,30 = 16,30 m, a 3 cm del informe; esos 3 cm quedan en el extremo del estar.
 * El dormitorio, el baño y la escalera mantienen sus marcas de la cadena.
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
import { FOTOS_PARCELA, PARCELA, VISTAS_DRON } from './parcela';
import type { CameraPreset, DataStatus, DesignReference, Furniture, Opening, Outdoor, PendantGroup, ProjectData, Room, Trace, Vec2, Wall } from './types';

const r2 = (x: number) => Math.round(x * 100) / 100;
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[r2(x0), r2(y0)], [r2(x1), r2(y0)], [r2(x1), r2(y1)], [r2(x0), r2(y1)]];

// ---------- cotas principales ----------
/** Cadena de cotas del frontal B: 3,5 + 2,5 + 3,5 + 1,20 + 5 = 15,70 m (documentado, interpretada como interior). */
const CHAIN = [3.5, 2.5, 3.5, 1.2, 5];
/** Largo y ancho exteriores del informe del arquitecto: 16,33 × 5,22 m. */
const L = 16.33;
const W = 5.22;
/** origen de la cadena: cara interior del lateral izquierdo */
const XI = 0.3;
/** el estar gana los 3 cm de diferencia entre la cadena y el informe */
const XR = r2(L - 0.3 - (XI + CHAIN.reduce((a, b) => a + b, 0)));
/** Muro del frontal B (el de la puerta de entrada): 0,60 m; el resto, 0,30 m (propiedad). */
const T = 0.3;
const TB = 0.6;
const TP = 0.1;
/** Altura total de los alzados: 6,20 m (documentado). */
const H_TOTAL = 6.2;
/** Altura libre mínima de 2,50 m por planta (propiedad): con el forjado de 0,30 m el suelo del altell sube a 2,80 m. */
const H_LIBRE = 2.5;
const ALTELL = r2(H_LIBRE + 0.3);
/** Canto del forjado del altell: 0,30 m (propiedad). */
const SLAB = r2(ALTELL - H_LIBRE);
const H_PB = r2(ALTELL - SLAB);

const h = T / 2;
const x0 = T, x1 = r2(L - T), y0 = T, y1 = r2(W - TB); // interior: 0,30–16,03 × 0,30–4,62
/** posición sobre la cadena de cotas (medida desde la cara interior del lateral izquierdo) */
const cx = (v: number) => r2(XI + v);
/** posición en el estar, referida al lateral derecho (gana los 3 cm del informe) */
const rx = (v: number) => r2(XI + v + XR);
const X_DORM = cx(CHAIN[0]); // 3,80 tabique dormitorio / baño
const X_ESC = cx(CHAIN[0] + CHAIN[1]); // 6,30 tabique baño / escalera
const X_PUERTA = cx(CHAIN[0] + CHAIN[1] + CHAIN[2]); // 9,80 puerta de entrada
const Y_PASILLO = 1.2; // línea del pasillo junto al frontal A (≈0,85 m libres, se conserva)
/** Armario del pasillo: el rectángulo junto a la línea del pasillo (≈1,40 × 0,65), abierto al pasillo (propiedad). */
const ARM_X1 = cx(5.0); // eje del tabique entre armario y entrada al baño
const ARM_Y1 = 1.95; // eje del fondo del armario
/** Puerta del baño: el arco dibujado en la línea del pasillo, junto a la escalera (propiedad). */
const BANO_PUERTA_X0 = cx(5.05);
const ALT_X1 = r2(X_ESC + TP / 2); // 6,35 borde del altell
const ESC: [number, number, number, number] = [ALT_X1, r2(Y_PASILLO + TP / 2), cx(7.25), y1];
/** baño: zona húmeda de 1,20 m al fondo (contra el frontal B), con las dos duchas enfrentadas */
const B_X0 = r2(X_DORM + TP / 2); // 3,85 cara del tabique del dormitorio
const B_X1 = r2(X_ESC - TP / 2); // 6,25 cara del tabique de la escalera
const B_WET = r2(y1 - 1.2); // 3,42 límite de la zona húmeda

const S = {
  planta: 'boceto-planta-baixa',
  fa: 'boceto-frontal-a',
  fb: 'boceto-frontal-b',
  altell: 'boceto-altell',
  prop: 'indicacion-propiedad',
  informe: 'informe-arquitecto',
  presupuesto: 'presupuesto-pac26-0052',
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
    id: 'obertura-7m', label: 'Ventanal de 7 m (bocetos)', wallId: 'muro-A', kind: 'cristalera', offset: onAB(cx(7.4)), width: 7, sill: 0, height: 3.15,
    system: null, status: 'documentado', sourceId: S.planta, variantKey: 'ventanal-7',
    note: 'Anchura escrita en los bocetos («OBERTURA 7 M»). En planta empieza junto a la escalera y en el alzado A termina a ≈1,4 m del extremo. Altura medida en el alzado A (≈3,15 m). Carpintería no definida.',
  },
  {
    id: 'obertura-9m', label: 'Ventanal de 9 m (solicitado)', wallId: 'muro-A', kind: 'cristalera', offset: onAB(r2(ALT_X1 + 0.5)), width: 9, sill: 0, height: 3.15,
    system: null, status: 'propuesto', sourceId: S.prop, variantKey: 'ventanal-9',
    note: 'Solicitado por la propiedad y presupuestado (PAC26-0052: demolición para abertura de 9 m y zuncho de 9 m de 40 × 70 cm con triple armado, propuesta del constructor). Encaje en el modelo: de 6,85 a 15,85 m; deja un machón de 0,50 m junto al borde del altell y 0,48 m en la esquina (0,18 m de jamba interior más el lateral de 0,30 m). Apoyos, machones y zuncho pendientes de cálculo del arquitecto. La estufa queda delante del vidrio.',
  },
  {
    id: 'obertura-225-pb', label: 'Obertura de 2,25 m (planta baja)', wallId: 'muro-A', kind: 'cristalera', offset: onAB(cx(1.4)), width: 2.25, sill: 0, height: 2.4,
    system: null, status: 'documentado', sourceId: S.prop,
    note: 'Anchura documentada (225 cm) y altura de 2,40 m (propiedad: «es ok 2,40 m»), por debajo del forjado del altell (cara inferior a 2,50 m). Posición: media entre la planta, el alzado A y el altell.',
  },
  {
    id: 'obertura-225-altell', label: 'Obertura de 2,25 m (altell)', wallId: 'muro-A', kind: 'cristalera', offset: onAB(cx(1.4)), width: 2.25, sill: r2(ALTELL + 1.1), height: 2.0,
    system: null, status: 'interpretado', sourceId: S.fa,
    note: 'Anchura documentada (2,25 m), alineada con la de planta baja. Antepecho a 1,10 m sobre el suelo del altell (3,90 m) y dintel a ≈5,90 m, como en el alzado A; al subir el altell a 2,80 m el hueco queda de 2,00 m de alto. Los bordes en zigzag se ignoran (propiedad).',
  },
  {
    id: 'puerta-120', label: 'Puerta de entrada (1,20 m)', wallId: 'muro-B', kind: 'puerta', offset: onAB(X_PUERTA), width: 1.2, sill: 0, height: 3.0,
    system: { type: 'abatible', leaves: 1, status: 'interpretado' }, swing: { hinge: 'inicio', dir: -1 }, entrance: true, status: 'documentado', sourceId: S.planta,
    note: 'Anchura y posición documentadas (cadena de cotas y «120 cm» del frontal B). En el muro de 0,60 m. Una hoja con bisagra en el lado del 9,50, abre hacia dentro. Altura medida en el alzado B (≈3,0 m).',
  },
  {
    id: 'puerta-70', label: 'Puerta de 70 cm (baño)', wallId: 'muro-B', kind: 'puerta', offset: onAB(cx(5.2)), width: 0.7, sill: 0, height: 2.2,
    system: { type: 'abatible', leaves: 1, status: 'documentado' }, swing: { hinge: 'fin', dir: 1 }, status: 'documentado', sourceId: S.prop,
    note: 'Puerta (propiedad) de 70 cm del frontal B. Posición según el alzado B y la marca «×» de la planta (5,20–5,90 m). Abre hacia fuera (propiedad), con la bisagra en la jamba derecha en el plano. Bajo el altell: altura 2,20 m (hipótesis). Con la nueva distribución queda en la zona húmeda de las duchas: necesita umbral estanco o revisar su posición (pendiente).',
  },
  {
    id: 'puerta-bano', label: 'Puerta del baño', wallId: 'tab-pasillo', kind: 'puerta', offset: r2(BANO_PUERTA_X0 - (X_DORM + TP / 2)), width: 0.9, sill: 0, height: 2.1,
    system: { type: 'abatible', leaves: 1, status: 'interpretado' }, swing: { hinge: 'inicio', dir: 1 }, status: 'documentado', sourceId: S.prop,
    note: 'Entrada al baño desde el pasillo (propiedad). Bisagra y giro según el arco dibujado; altura estándar (hipótesis).',
  },
  // ---- aberturas adicionales: variantes para comparar (no confirmadas) ----
  {
    id: 'var-acceso-comedor', label: 'Puerta acristalada al comedor exterior (variante)', wallId: 'muro-derecho', kind: 'puerta', offset: 0.15, width: 0.9, sill: 0, height: 2.3,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, swing: { hinge: 'inicio', dir: -1 }, status: 'propuesto', sourceId: S.prop, variantKey: 'acceso-comedor',
    note: 'Acceso desde la zona de día al comedor del algarrobo por el lateral derecho (el ventanal está en el frontal A, no en ese lado). Entre la fachada A y el sofá; la estufa queda a ≈0,55 m: comprobar paso y distancias de seguridad. Lateral portante: hueco pendiente de cálculo.',
  },
  {
    id: 'var-ventana-comedor', label: 'Ventana del comedor · ventilación cruzada (variante)', wallId: 'muro-B', kind: 'ventana', offset: onAB(rx(13.0)), width: 1.2, sill: 1.1, height: 1.0,
    system: { type: 'abatible', leaves: 2, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventilacion-cruzada',
    note: 'Ventana practicable en el frontal B, opuesta al ventanal, sobre el respaldo del sofá (antepecho 1,10 m). El presupuesto PAC26-0052 incluye «una ventana más en el comedor». Posición propuesta.',
  },
  {
    id: 'var-ventana-dormitorio', label: 'Ventana con contraventana en el dormitorio (variante)', wallId: 'muro-B', kind: 'ventana', offset: onAB(cx(2.75)), width: 0.6, sill: 0.9, height: 1.3,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventana-dormitorio', shutters: true,
    note: 'Ventana practicable con contraventana de madera junto a la cama, sobre la mesita. El presupuesto habla de dos ventanas en la habitación de abajo; la segunda no tiene sitio claro (armario empotrado en el lateral, cabecero en el frontal B): pendiente.',
  },
  {
    id: 'var-ventana-bano', label: 'Ventana alta del baño (variante)', wallId: 'muro-B', kind: 'ventana', offset: onAB(cx(3.85)), width: 0.7, sill: 1.85, height: 0.5,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventana-bano',
    note: 'Ventana alta sobre la zona húmeda (presupuesto: «una ventana pequeña en el baño»), con extracción mecánica compatible con dos duchas (≈15 l/s, propuesta pendiente de proyecto de instalaciones).',
  },
  {
    id: 'var-ventana-altell-1', label: 'Ventana del altell 1 (variante)', wallId: 'muro-B', kind: 'ventana', offset: onAB(cx(0.6)), width: 0.6, sill: r2(ALTELL + 0.9), height: 1.2,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventanas-altell',
    note: 'El presupuesto incluye dos ventanas en la habitación de arriba. Propuesta: a ambos lados del cabecero, en el frontal B.',
  },
  {
    id: 'var-ventana-altell-2', label: 'Ventana del altell 2 (variante)', wallId: 'muro-B', kind: 'ventana', offset: onAB(cx(3.55)), width: 0.6, sill: r2(ALTELL + 0.9), height: 1.2,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventanas-altell',
    note: 'Segunda ventana del altell (presupuesto). Posición propuesta.',
  },
  {
    id: 'puertas-armario', label: 'Hueco del armario (sin puertas)', wallId: 'tab-pasillo', kind: 'paso', offset: 0.05, width: r2(ARM_X1 - TP / 2 - (X_DORM + TP / 2) - 0.05), sill: 0, height: 2.1,
    system: null, status: 'documentado', sourceId: S.prop,
    note: 'Armario abierto al pasillo, sin puertas (propiedad).',
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
  ], 'documentado', S.prop, 'Entrada desde el pasillo, junto a la escalera (propiedad). Al fondo, zona húmeda común de 2,40 × 1,20 m con dos duchas enfrentadas (confirmado); lavabo a la izquierda e inodoro a la derecha según se entra (propuesta). La puerta exterior de 70 cm cae en la zona húmeda: pendiente.'),
  room('armario-pasillo', 'pb', 'Armario', rect(X_DORM + TP / 2, Y_PASILLO + TP / 2, ARM_X1 - TP / 2, ARM_Y1 - TP / 2), 'documentado', S.prop, 'Armario que se abre desde el pasillo (propiedad), en el rectángulo dibujado junto a la línea del pasillo.'),
  room('dia', 'pb', 'Cocina y estar', rect(ALT_X1, y0, x1, y1), 'documentado', S.prop, 'Doble altura (propiedad). Entrada al baño por el pasillo. Escalera en L, cocina junto a la escalera con isla central, sofá en L y estufa.', { openTo: ['pasillo'] }),
  room('altell', 'altell', 'Altell', rect(x0, y0, ALT_X1, y1), 'documentado', S.prop, 'Zona diáfana a 2,80 m con cama de matrimonio (propiedad), sobre el dormitorio, el pasillo y el baño. La zona de día es de doble altura. Borde hacia la doble altura en el 6,05, con barandilla.'),
];

const f = (x: Furniture) => x;
/** cara interior del frontal B y del frontal A */
const YB = y1;
const furniture: Furniture[] = [
  // dormitorio (posición de los bocetos, sin cambios respecto a la cadena de cotas)
  f({ id: 'armario', type: 'armario', label: 'Armario empotrado', roomId: 'dormitorio', x: r2(x0 + 0.25), y: r2((y0 + y1) / 2), w: r2(y1 - y0), d: 0.5, h: 2.4, rot: 270, status: 'documentado', note: 'Franja del lateral izquierdo (propiedad). Fondo ≈0,5 m medido.' }),
  f({ id: 'cama', type: 'cama', label: 'Cama 160 × 200', roomId: 'dormitorio', x: cx(1.98), y: r2(YB - 1.0), w: 1.6, d: 2.0, h: 0.55, rot: 180, status: 'interpretado', note: 'Dibujada de ≈1,65 × 2,05 m con dos almohadas y el embozo; cabecero contra el frontal B.' }),
  f({ id: 'mesita-dorm', type: 'mesita', label: 'Mesita', roomId: 'dormitorio', x: cx(3.05), y: r2(YB - 0.22), w: 0.4, d: 0.36, h: 0.5, rot: 180, status: 'propuesto', note: 'Al lado libre de la cama (el otro lado queda junto al armario empotrado).' }),
  f({ id: 'balda-dorm', type: 'balda', label: 'Balda de apoyo', roomId: 'dormitorio', x: cx(1.0), y: r2(YB - 0.15), w: 0.3, d: 0.25, h: 0.55, rot: 180, status: 'propuesto', note: 'Balda volada de madera entre el armario y la cama: deja libre el suelo y el paso al armario.' }),
  f({ id: 'aplique-dorm-1', type: 'aplique', label: 'Aplique de pared', roomId: 'dormitorio', x: cx(0.98), y: r2(YB - 0.04), w: 0.16, d: 0.08, h: 1.3, rot: 180, status: 'propuesto' }),
  f({ id: 'aplique-dorm-2', type: 'aplique', label: 'Aplique de pared', roomId: 'dormitorio', x: cx(2.98), y: r2(YB - 0.04), w: 0.16, d: 0.08, h: 1.3, rot: 180, status: 'propuesto' }),
  // altell (zona diáfana)
  f({ id: 'cama-altell', type: 'cama', label: 'Cama de matrimonio 160 × 200', roomId: 'altell', x: cx(2.5), y: r2(YB - 1.0), w: 1.6, d: 2.0, h: 0.55, rot: 180, status: 'propuesto', note: 'Cama de matrimonio en el altell (propiedad). Posición propuesta: cabecero contra el frontal B, mirando a la obertura de 2,25 m.' }),
  f({ id: 'mesita-altell-1', type: 'mesita', label: 'Mesita', roomId: 'altell', x: cx(1.45), y: r2(YB - 0.23), w: 0.45, d: 0.45, h: 0.5, rot: 180, status: 'propuesto' }),
  f({ id: 'mesita-altell-2', type: 'mesita', label: 'Mesita', roomId: 'altell', x: cx(3.55), y: r2(YB - 0.23), w: 0.45, d: 0.45, h: 0.5, rot: 180, status: 'propuesto' }),
  // armario del pasillo
  f({ id: 'armario-pasillo-mueble', type: 'armario', label: 'Armario del pasillo', roomId: 'armario-pasillo', x: cx(4.23), y: 1.57, w: 1.3, d: 0.6, h: 2.2, rot: 180, status: 'documentado', open: true, color: '#d9b98f', note: 'Rectángulo de ≈1,40 × 0,65 junto a la línea del pasillo; abierto al pasillo, sin puertas, en madera de haya o pino (propiedad). Tono aproximado.' }),
  // baño: dos duchas enfrentadas al fondo (propiedad), lavabo de obra a la izquierda y inodoro a la derecha
  // (izquierda y derecha según se entra desde el pasillo, mirando hacia el frontal B)
  f({ id: 'ducha', type: 'ducha', label: 'Zona húmeda · dos duchas enfrentadas', roomId: 'bano', x: r2((B_X0 + B_X1) / 2), y: r2((B_WET + YB) / 2), w: r2(B_X1 - B_X0), d: r2(YB - B_WET), h: 2.0, rot: 0, status: 'confirmado',
    note: 'Dos duchas una frente a la otra (propiedad): rociadores en los tabiques opuestos (dormitorio y escalera), orientados hacia la zona húmeda común de 2,40 × 1,20 m, con mandos independientes. Separación con celosía cerámica (A o B), vidrio fijo por la cara húmeda y cortina en el acceso con carril propio (propuesta).' }),
  f({ id: 'lavabo', type: 'lavabo', label: 'Lavabo de obra', roomId: 'bano', x: r2(B_X1 - 0.28), y: 2.68, w: 1.05, d: 0.55, h: 0.85, rot: 90, status: 'propuesto', note: 'Lavabo de obra con un seno, dos cajones de madera, hueco inferior y espejo grande (referencia del baño). En el lateral izquierdo según se entra, contra el tabique de la escalera.' }),
  f({ id: 'inodoro', type: 'inodoro', label: 'Inodoro', roomId: 'bano', x: r2(B_X0 + 0.325), y: 2.72, w: 0.38, d: 0.65, h: 0.42, rot: 270, status: 'propuesto', note: 'En el lateral derecho según se entra, fuera del eje de la puerta para dar privacidad. Saneamiento a comprobar (el boceto marcaba «×» de agua en este tabique).' }),
  // cocina lineal contra el frontal B (propiedad), entre la escalera y la puerta de entrada.
  // Con rot 180 el eje local va de la puerta hacia la escalera: frigorífico, placa y horno, lavavajillas, fregadero.
  f({ id: 'encimera', type: 'encimera', label: 'Cocina', roomId: 'dia', x: cx(8.35), y: r2(YB - 0.3), w: 2.2, d: 0.6, h: 0.9, rot: 180, status: 'confirmado',
    modules: [{ kind: 'frigorifico', w: 0.55 }, { kind: 'placa-horno', w: 0.6 }, { kind: 'lavavajillas', w: 0.45 }, { kind: 'fregadero', w: 0.6 }],
    note: 'Cocina junto a la escalera (propiedad), contra el frontal B. Módulos propuestos sobre los dos puntos de agua del boceto: fregadero y lavavajillas; placa con horno debajo y frigorífico integrado bajo encimera (no cabe una columna: al lado está la puerta de entrada). Frentes de roble con nudos dentro de una envolvente mineral clara, encimera y salpicadero coordinados, balda corrida gruesa y grifo extraíble negro mate (referencia 01).' }),
  // isla de obra: estructura de la referencia 05 y acabado de la 06; deja 1,00 m de paso hasta la cocina
  f({ id: 'isla', type: 'isla', label: 'Isla de obra', roomId: 'dia', x: cx(8.8), y: r2(YB - 0.6 - 1.0 - 0.475), w: 1.6, d: 0.95, h: 0.9, rot: 0, status: 'propuesto',
    note: 'Isla central (propiedad). Estructura de la referencia 05: hueco de 1,00 m para tres taburetes y dos estantes abiertos de 0,30 m en el mismo frente (hacia el frontal A), apoyos macizos. Acabado de la referencia 06: piezas verticales de terracota a junta corrida con juntas claras y encimera clara de esquinas suavizadas. 1,60 × 0,95 m, altura 0,90 m: deja 1,00 m de paso hasta la cocina y ≈1,3 m detrás de los taburetes. El boceto dibuja ≈1,55 × 1,65 m (se conserva como trazo).' }),
  ...[8.15, 8.55, 8.95].map((x, i) => f({ id: `taburete-${i + 1}`, type: 'taburete', label: 'Taburete', roomId: 'dia', x: cx(x), y: r2(YB - 0.6 - 1.0 - 0.95 - 0.2), w: 0.38, d: 0.38, h: 0.65, rot: 0, status: 'propuesto' })),
  f({ id: 'sofa-b', type: 'sofa-l', label: 'Sofá en L (frontal B)', roomId: 'dia', x: rx(12.75), y: r2(YB - 0.43), w: 4.0, d: 0.85, h: 0.8, rot: 180, status: 'documentado', note: 'Sofá (propiedad): tramo desde la jamba de la puerta, fondo ≈0,85 m. Colchonetas gruesas y cojines blancos y crudos (referencia 03).' }),
  f({ id: 'sofa-lateral', type: 'sofa-l', label: 'Sofá en L (lateral derecho)', roomId: 'dia', x: r2(x1 - 0.33), y: r2(YB - 1.4), w: 2.8, d: 0.65, h: 0.8, rot: 90, status: 'documentado', note: 'Segundo tramo del sofá contra el lateral derecho; fondo dibujado ≈0,65 m.' }),
  f({ id: 'estufa', type: 'estufa', label: 'Estufa', roomId: 'dia', x: rx(14.43), y: 0.9, w: 0.8, d: 0.8, h: 1.0, rot: 0, status: 'documentado', note: 'El círculo del boceto (propiedad), junto al frontal A al final de la obertura. Dibujado de ≈1 m de diámetro; salida de humos supuesta. Con el ventanal de 9 m queda delante del vidrio.' }),
  f({ id: 'alfombra-salon', type: 'alfombra', label: 'Alfombra de yute', roomId: 'dia', x: rx(12.85), y: r2(YB - 0.85 - 0.8), w: 2.4, d: 1.7, h: 0.012, rot: 0, status: 'propuesto', note: 'Alfombra de fibra natural con dibujo (referencia 03).' }),
  f({ id: 'mesa-salon', type: 'mesa-centro', label: 'Mesa de madera 110 × 80', roomId: 'dia', x: rx(12.85), y: r2(YB - 0.85 - 0.8), w: 1.1, d: 0.8, h: 0.42, rot: 0, status: 'propuesto', color: '#8d5c3c', note: 'Mesa de madera maciza de ≈110 × 80 cm (indicación de la propiedad), baja como en la referencia 03, a 0,40 m del sofá.' }),
  f({ id: 'jarron-salon', type: 'jarron', label: 'Cuenco de barro', roomId: 'dia', x: rx(13.15), y: r2(YB - 0.85 - 0.85), w: 0.22, d: 0.22, h: 0.42, rot: 0, status: 'propuesto' }),
];

const water = (id: string, levelId: string, p: Vec2, note: string, sourceId = S.planta): Trace => ({ id, levelId, label: 'Punto de agua (×)', cross: p, sourceId, note });
const traces: Trace[] = [
  water('x-ducha', 'pb', [cx(3.72), 2.3], 'Marca «×» del boceto junto al tabique del dormitorio, en el baño. Con la nueva distribución queda junto al inodoro.'),
  { id: 'rect-bano', levelId: 'pb', label: 'Rectángulo del baño', sourceId: S.planta, points: [[cx(3.55), 2.0], [cx(4.3), 2.0], [cx(4.3), 3.0], [cx(3.55), 3.0]], closed: true, note: 'Rectángulo de ≈0,75 × 1,00 m dibujado en el baño, sin uso asignado (pendiente).' },
  { id: 'isla-boceto', levelId: 'pb', kind: 'nota', label: 'Isla del boceto', sourceId: S.planta, points: [[cx(8.05), 1.55], [cx(9.55), 1.55], [cx(9.55), 3.2], [cx(8.05), 3.2]], closed: true, note: 'Rectángulo de ≈1,55 × 1,65 m dibujado como isla. Con ese fondo quedaría poco paso hasta la cocina; la propuesta lo reduce a 0,95 m.' },
  water('x-frontal-a', 'pb', [cx(4.65), y0], 'Sobre la línea del frontal A en el tramo del baño.'),
  water('x-cocina-1', 'pb', [cx(7.57), r2(YB - 0.6)], 'En el borde de la encimera.'),
  water('x-cocina-2', 'pb', [cx(8.35), r2(YB - 0.6)], 'En el borde de la encimera.'),
  water('x-altell', 'altell', [cx(0.6), 0.6], 'Junto a la esquina del lateral izquierdo y el frontal A.', S.altell),
  { id: 'doble-altura', levelId: 'altell', kind: 'nota', label: 'Doble altura (cocina y estar)', sourceId: S.prop, points: [[rx(10.7), 2.46]], note: 'Zona de día de doble altura (propiedad).' },
];

// ---------- exterior: solera en L y comedor bajo el algarrobo (decisiones confirmadas; medidas propuestas) ----------
/** algarrobo: posición aproximada sobre la vista cenital (src/data/parcela.ts) */
const ALGARROBO: Vec2 = [18.9, 1.0];
/** solera en L: 3 m delante (frontal B) y 4 m en el lateral del algarrobo (variante editable, dentro del rango 3–4 m) */
const SOL_FRENTE = 3;
const SOL_LATERAL = 4;
const MESA_EXT: Vec2 = [r2(L + SOL_LATERAL / 2 + 0.05), 3.65];
const outdoor: Outdoor = {
  pavements: [
    { id: 'grava-comedor', label: 'Transición de grava', rect: [-0.5, -0.5, r2(L + SOL_LATERAL + 0.5), r2(W + SOL_FRENTE + 0.5)], joints: 0, status: 'propuesto', note: 'Borde de grava de 0,50 m entre la solera y la tierra; también junto a los frentes sin solera.' },
    {
      id: 'solera-l-frente', label: 'Solera en L · tramo delantero', rect: [0, W, r2(L + SOL_LATERAL), r2(W + SOL_FRENTE)], joints: 3, status: 'confirmado',
      note: 'Solera continua en L (confirmada; anchos de la variante 3 m delante / 4 m lateral, dentro del rango 3–4 m). Tramo de 3 m de fondo a lo largo de todo el frontal B (puerta de entrada). Cemento claro mate con juntas cada ≈3 m; pendiente del 1,5–2 % hacia fuera y rigola en el borde (propuesta de evacuación, pendiente de desarrollo técnico).',
    },
    {
      id: 'solera-l-lateral', label: 'Solera en L · tramo lateral', rect: [L, 0, r2(L + SOL_LATERAL), r2(W + SOL_FRENTE)], joints: 2, permeable: { c: ALGARROBO, r: 1.4 }, status: 'confirmado',
      note: 'Tramo de 4 m junto al lateral derecho, bajo el algarrobo, continuo con el delantero y al mismo nivel. Se recorta alrededor del tronco para dejar zona permeable sobre las raíces; la posición del árbol es aproximada.',
    },
  ],
  furniture: [
    f({ id: 'mesa-exterior', type: 'mesa-exterior', label: 'Mesa redonda Ø 1,80', roomId: 'exterior', x: MESA_EXT[0], y: MESA_EXT[1], w: 1.8, d: 1.8, h: 0.75, rot: 0, status: 'propuesto', note: 'Mesa circular de tablero mineral claro grueso (≈10 cm) sobre pie central cilíndrico (referencia 11). Ocho plazas; diámetro orientativo.' }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return f({ id: `silla-exterior-${i + 1}`, type: 'silla-exterior', label: 'Silla plegable de bistró', roomId: 'exterior', x: r2(MESA_EXT[0] + Math.cos(a) * 1.18), y: r2(MESA_EXT[1] + Math.sin(a) * 1.18), w: 0.44, d: 0.48, h: 0.82, rot: r2((Math.atan2(Math.cos(a), Math.sin(a)) * 180) / Math.PI + 180), status: 'propuesto' });
    }),
  ],
  lights: [],
  domeLamp: {
    c: MESA_EXT, bottom: 1.95, diameter: 0.6, treeAnchor: { c: [r2(MESA_EXT[0] + 0.15), r2(MESA_EXT[1] - 0.2)], h: 3.3 },
    post: [r2(MESA_EXT[0] + 1.75), r2(MESA_EXT[1] + 0.35)], status: 'propuesto',
    note: 'Cúpula grande de metal oscuro centrada sobre la mesa, luz cálida regulable (referencia 11). Suspensión desde una rama del algarrobo o desde un pie independiente: el anclaje está SIN RESOLVER (resistencia de la rama, crecimiento, viento y alimentación eléctrica exterior por comprobar).',
  },
  drains: [
    { id: 'rigola-frente', a: [0.3, r2(W + SOL_FRENTE - 0.15)], b: [r2(L + SOL_LATERAL - 0.15), r2(W + SOL_FRENTE - 0.15)], status: 'propuesto', note: 'Canaleta lineal en el borde exterior del tramo delantero; pendiente del 1,5–2 % desde la fachada.' },
    { id: 'rigola-lateral', a: [r2(L + SOL_LATERAL - 0.15), 0.3], b: [r2(L + SOL_LATERAL - 0.15), r2(W + SOL_FRENTE - 0.15)], status: 'propuesto', note: 'Canaleta en el borde exterior del tramo lateral, hacia el terreno (lejos del alcorque).' },
  ],
};

// ---------- lámparas colgantes interiores (alternativas A y B; ubicación sin elegir) ----------
const ISLA_Y = r2(YB - 0.6 - 1.0 - 0.475);
const MESA_Y = r2(YB - 0.85 - 0.8);
const pendants: PendantGroup[] = [
  { id: 'lamparas-isla', location: 'isla', label: 'Sobre la isla', points: [[cx(8.3), ISLA_Y], [cx(8.8), ISLA_Y], [cx(9.3), ISLA_Y]], bottom: 1.65, status: 'propuesto', note: 'Tres piezas a 0,50 m sobre la isla de 1,60 m; parte baja a ≈0,75 m de la encimera.' },
  { id: 'lamparas-salon', location: 'salon', label: 'Sobre la mesa', points: [[rx(12.45), MESA_Y], [rx(12.85), MESA_Y], [rx(13.25), MESA_Y]], bottom: 2.0, status: 'propuesto', note: 'Tres piezas sobre la mesa de 110 × 80 cm. Con mesa baja se cuelgan a 2,00 m para no estorbar al pasar.' },
];

// ---------- vistas preparadas ----------
const view = (v: CameraPreset): CameraPreset => ({ fixed: true, ...v });
const views: CameraPreset[] = [
  view({ id: 'v01-exterior', label: '1 · Exterior a tres cuartos', group: 'exterior', position: [29, 17.5, 8], target: [10.5, 3, 1.6], fov: 36 }),
  view({ id: 'v02-fachada-delantera', label: '2 · Fachada delantera (frontal B)', group: 'exterior', position: [8.6, 21, 2.0], target: [8.6, 5.2, 2.6], fov: 40 }),
  view({ id: 'v02b-fachada-a', label: '2b · Fachada A y ventanal', group: 'exterior', position: [11.2, -14, 2.0], target: [11, 0, 2.6], fov: 42 }),
  view({ id: 'v03-entrada', label: '3 · Entrada y puerta de madera', group: 'exterior', position: [12.9, 8.9, 1.6], target: [10.4, 5.2, 1.6], fov: 40 }),
  view({ id: 'v04-solera', label: '4 · Solera completa en L', group: 'exterior', position: [-3.5, 14.5, 4.2], target: [11, 5.5, 0], fov: 44 }),
  view({ id: 'v05-algarrobo', label: '5 · Mesa y lámpara bajo el algarrobo', group: 'exterior', position: [16.9, 7.4, 1.6], target: [MESA_EXT[0] + 0.3, MESA_EXT[1] - 0.4, 1.1], fov: 52 }),
  view({ id: 'v06-desde-comedor', label: '6 · La casa desde el comedor exterior', group: 'exterior', position: [19.6, 5.9, 1.6], target: [11, 6.4, 2.0], fov: 54 }),
  view({ id: 'v07-salon-ventanal', label: '7 · Salón: sofá de obra y ventanal', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: 0, position: [10.9, 1.5, 1.6], target: [15.2, 3.9, 0.7], fov: 66 }),
  view({ id: 'v08-ventanal-cocina', label: '8 · Del ventanal hacia cocina e isla', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: 0, position: [12.4, 0.8, 1.6], target: [9.2, 3.6, 1.0], fov: 60 }),
  view({ id: 'v09-cocina-taburetes', label: '9 · Cocina desde el lado de los taburetes', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: 0, position: [10.7, 0.75, 1.6], target: [8.9, 3.2, 0.75], fov: 56 }),
  view({ id: 'v10-cocina-encimera', label: '10 · Isla desde la cocina', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: 0, position: [10.35, 3.75, 1.6], target: [8.7, 1.4, 0.7], fov: 58 }),
  view({ id: 'v11-dormitorio', label: '11 · Dormitorio', group: 'interior', eyeLevel: true, roomId: 'dormitorio', elevation: 0, position: [3.45, 0.7, 1.6], target: [1.8, 3.9, 0.9], fov: 60 }),
  view({ id: 'v12-bano-entrada', label: '12 · Baño desde la entrada', group: 'interior', eyeLevel: true, roomId: 'bano', elevation: 0, position: [5.5, 2.05, 1.6], target: [4.7, 4.6, 1.05], fov: 72 }),
  view({ id: 'v12b-bano-ducha', label: '12b · Baño desde la ducha (duchas enfrentadas)', group: 'interior', eyeLevel: true, roomId: 'bano', elevation: 0, position: [5.05, 4.25, 1.6], target: [5.05, 1.6, 1.2], fov: 66 }),
  view({ id: 'v12c-celosia', label: '12c · Detalle de la celosía', group: 'interior', eyeLevel: true, roomId: 'bano', elevation: 0, position: [4.45, 2.35, 1.6], target: [4.15, 3.6, 1.15], fov: 52 }),
  view({ id: 'v13-altell', label: '13 · Altell, vigas cemento y volta terracota', group: 'interior', eyeLevel: true, roomId: 'altell', elevation: 2.8, position: [4.9, 2.46, 1.6], target: [12, 2.46, 1.6], fov: 64 }),
  view({ id: 'v13b-volta', label: '13b · Vigas y volta desde la zona de día', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: 0, position: [12.2, 2.7, 1.6], target: [10.2, 2.46, 5.6], fov: 60 }),
  view({ id: 'v14-sin-cubierta', label: '14 · Vista sin cubierta', group: 'exterior', hideRoof: true, position: [9.2, 12, 25], target: [9.2, 3.2, 0], fov: 40 }),
  view({ id: 'v15-corte', label: '15 · Corte longitudinal', group: 'exterior', position: [8.9, -22, 3.4], target: [8.9, 2.46, 3.1], fov: 34, section: true }),
  ...VISTAS_DRON.map(view),
];

// ---------- referencias de diseño (fotos adjuntadas por la propiedad; los enlaces solo indican la procedencia) ----------
const REF_META: Record<string, [string | undefined, string[]]> = {
  'ref-cocina': ['01', ['v09-cocina-taburetes', 'v10-cocina-encimera']], 'ref-puerta': ['02', ['v03-entrada', 'v02-fachada-delantera']], 'ref-salon': ['03', ['v07-salon-ventanal']],
  'ref-bano': ['04', ['v12-bano-entrada', 'v12b-bano-ducha']], 'ref-isla-estructura': ['05', ['v09-cocina-taburetes']], 'ref-isla-acabado': ['06', ['v10-cocina-encimera']],
  'ref-celosia-a': ['07', ['v12c-celosia']], 'ref-celosia-b': ['08', ['v12c-celosia']], 'ref-lamparas-a': ['09', ['v09-cocina-taburetes']], 'ref-lamparas-b': ['10', ['v08-ventanal-cocina']],
  'ref-color-techo': [undefined, ['v13b-volta']], 'ref-comedor-exterior': ['11', ['v05-algarrobo', 'v04-solera']],
};
/** referencias: las imágenes las aportó la propiedad (ZIP); los enlaces de Pinterest no se pueden abrir desde aquí */
const ref = (id: string, space: string, url: string, use: string, consulted = true): DesignReference => ({ id, space, url, use, consulted, refNo: REF_META[id]?.[0], views: REF_META[id]?.[1] });
const references: DesignReference[] = [
  ref('ref-cocina', 'Cocina', 'https://pin.it/wgLbpxrAO', 'Frentes lisos de madera clara con veta y nudos, encimera y salpicadero minerales claros, balda corrida de madera, grifo negro mate, muebles dentro de una envolvente mineral.'),
  ref('ref-puerta', 'Puerta y fachada', 'https://pin.it/1XBtdMDQr', 'Volúmenes blancos mates, puerta de tablones verticales de madera natural en hueco profundo; volumen saliente de entrada como variante.'),
  ref('ref-salon', 'Salón', 'https://pin.it/6qqQwbqFc', 'Sofá de obra en L con colchonetas y cojines crudos, mesa de madera, alfombra de fibra, paredes arena muy clara. Su techo no se copia.'),
  ref('ref-bano', 'Baño', 'https://pin.it/6CBWKrJoy', 'Lavabo de obra claro con cajones de madera y hueco inferior, espejo grande, franja de piezas terracota verticales, grifería de latón. Un solo lavabo por el espacio.'),
  ref('ref-isla-estructura', 'Isla (estructura)', 'https://pin.it/1w3VfOFCm', 'Isla de obra con apoyos macizos, hueco para taburetes y estantes abiertos laterales; ≈1,60 m de largo y 0,90 m de alto.'),
  ref('ref-isla-acabado', 'Isla (acabado)', 'https://pin.it/1336RMdx5', 'Piezas estrechas verticales de terracota con juntas claras, encimera clara y cantos suavizados.'),
  ref('ref-celosia-a', 'Ducha · celosía A', 'https://pin.it/1gksDy9jg', 'Celosía cerámica terracota de patrón fino y geométrico dentro de un paño claro.'),
  ref('ref-celosia-b', 'Ducha · celosía B', 'https://pin.it/lgNFCU41S', 'Celosía terracota de huecos cuadrados con piezas de más presencia.'),
  ref('ref-lamparas-a', 'Lámparas A', 'https://pin.it/2erJw1OyI', 'Colgantes cerámicos de siluetas variadas en tonos de barro.'),
  ref('ref-lamparas-b', 'Lámparas B', 'https://pin.it/6rVBGp24T', 'Colgantes de terracota clara, formas variadas y composición ligera.'),
  ref('ref-color-techo', 'Color de vigas y volta', 'https://pin.it/2w7oHIAJn', 'Sustituida por la decisión confirmada: vigas vistas color cemento y volta catalana terracota entre vigas.', false),
  ref('ref-comedor-exterior', 'Comedor exterior', 'https://pin.it/6BEmckzBK', 'Mesa circular grande de tablero mineral grueso y pie central, sillas ligeras oscuras con detalles de madera, solera clara.'),
];

const PROJECT: ProjectData = {
  id: 'casa-vinallop',
  name: 'Casa Vinallop',
  isTest: false,
  phase: 'reforma',
  // la solera antigua del frontal B se sustituye por la solera en L del proyecto
  site: { ...PARCELA, pavements: [], trees: PARCELA.trees.map((t) => (t.id === 'algarrobo' ? { ...t, c: ALGARROBO } : t)) },
  version: '1.0 · bocetos, respuestas, fotos de la parcela, informe (16,33 × 5,22 m) y referencias de diseño',
  levels: [
    { id: 'pb', name: 'Planta baja', elevation: 0, wallHeight: H_PB, elevationStatus: 'documentado' },
    { id: 'altell', name: 'Altell', elevation: ALTELL, wallHeight: r2(H_TOTAL - ALTELL), elevationStatus: 'documentado' },
  ],
  walls,
  openings,
  rooms,
  furniture,
  slabs: [
    { id: 'forjado-altell', levelId: 'altell', thickness: SLAB, status: 'documentado', sourceId: S.prop, polygon: rect(x0, y0, ALT_X1, y1), note: 'Canto de 0,30 m y 2,50 m libres en planta baja (propiedad): cara inferior a 2,50 m y suelo del altell a 2,80 m. El presupuesto PAC26-0052 describe el forjado del altell con vigas de madera y tablero atornillado: sistema pendiente de definir con el arquitecto.' },
  ],
  stairs: [
    {
      id: 'escalera', fromLevel: 'pb', toLevel: 'altell', rect: ESC, up: '+y', upStatus: 'documentado', winderEnd: 0.65, risers: 15, status: 'interpretado', sourceId: S.planta,
      note: 'Escalera en L: arranca junto al pasillo (lado del frontal A), sube hacia el frontal B y en el tramo final gira con peldaños compensados para desembarcar en el altell. Sentido indicado por la propiedad; ancho ≈1,20 m y 15 tabicas de ≈0,187 m hasta 2,80 m. Huellas sobre la línea de huella: 10 rectas de 0,25 m en el tramo recto (2,50 m) y 4 compensadas en el giro, de ≈0,25 m a 0,50 m del borde interior; cumple tabica ≤ 0,20 m y huella ≥ 0,22 m sin alargar la escalera. Los peldaños compensados son estrechos junto al eje: lo revisará el arquitecto.',
    },
  ],
  traces,
  outdoor,
  pendants,
  views,
  references,
  checks: [
    { label: 'Dimensiones exteriores', items: [{ source: 'Informe del arquitecto (transmitido por la propiedad)', value: '16,33 × 5,22 m exteriores' }, { source: 'Modelo anterior (cadena del boceto y «5 de ancho»)', value: '15,70 × 5,00 m' }, { source: 'Especificación inicial del estudio', value: '17 × 4,5 × 5 m' }], status: 'documentado', note: 'Se adopta el informe: 16,33 × 5,22 m. La cadena de 15,70 m se interpreta como interior (15,70 + 2 × 0,30 = 16,30 m, a 3 cm del informe; los 3 cm van al estar). El ancho de 5,22 m deja 4,32 m interiores con el muro de 0,60 m del frontal B.' },
    { label: 'Superficie construida', items: [{ source: 'Informe del arquitecto', value: '79,48 m² construidos (estado actual)' }, { source: 'Rectángulo del informe', value: '16,33 × 5,22 = 85,24 m²' }], status: 'pendiente', note: 'No coinciden: la edificación actual no es un rectángulo completo (el anexo es más estrecho en las fotos) o la superficie excluye algún tramo. Pendiente de contrastar con el informe completo.' },
    { label: 'Ventanal del frontal A', items: [{ source: 'Boceto (planta y alzado A)', value: '«OBERTURA 7 M»' }, { source: 'Propiedad / especificación', value: 'Ventanal de 9 m' }, { source: 'Presupuesto PAC26-0052', value: 'Zuncho 40 × 70 cm para el hueco (propuesta del constructor)' }], status: 'pendiente', note: 'Por defecto se dibuja 9 m (6,85–15,85 m, machones de 0,50 y 0,48 m); la variante de 7 m se conserva. Antes de fijarlo: cálculo estructural del arquitecto (dintel, machones, apoyos) y comprobación de que el altell y la escalera no interfieren.' },
    { label: 'Altura del altell (sección)', items: [{ source: 'Propiedad', value: '2,50 m libres por planta + forjado 0,30 m' }, { source: 'Alzados', value: 'Coronación 6,20 m' }], status: 'interpretado', note: 'Suelo del altell a 2,80 m; libre bajo cubierta 6,20 − 2,80 − canto de cubierta (0,25) − flecha de la volta (0,10) ≈ 3,05 m en el centro, ≈2,95 m bajo vigas. Verificable en la vista «Corte longitudinal».' },
    { label: 'Superficie del altell', items: [{ source: 'Calculada sobre el modelo', value: '≈26 m² (6,05 × 4,32 m interior)' }], status: 'interpretado', note: 'Resultado del cálculo, no una medida tomada.' },
  ],
  railings: [
    {
      id: 'barandilla-altell', levelId: 'altell', label: 'Barandilla del altell', points: [[ALT_X1, y0], [ALT_X1, r2(y1 - 0.65)]], height: 1.0, material: 'vidrio', spacing: 0, status: 'documentado', sourceId: S.prop,
      note: 'Barandilla de cristal en el borde del altell hacia la doble altura (propiedad). Deja libre el desembarco de la escalera. Altura de 1,00 m (propiedad).',
    },
    {
      id: 'barandilla-escalera', levelId: 'pb', label: 'Barandilla de la escalera', points: [[ESC[2], ESC[1]], [ESC[2], ESC[3]]], rise: [0.19, ALTELL], height: 1.0, material: 'vidrio', spacing: 0, status: 'documentado', sourceId: S.prop,
      note: 'Barandilla de cristal en el lado abierto de la escalera, hacia la zona de día (propiedad). Sigue la pendiente desde el primer peldaño hasta el altell. Altura de 1,00 m (propiedad).',
    },
  ],
  roofOptions: [
    {
      type: 'plana', label: 'Plana (decisión de la propiedad)', pitchDeg: 0, overhang: 0, thickness: 0.25, parapet: 0, status: 'confirmado',
      note: 'Cubierta plana indicada por la propiedad, coronada a 6,20 m como los alzados. El informe del arquitecto describe una cubierta inclinada y el presupuesto PAC26-0052 una plana de viguetas con revoltón: pendiente de contrastar. No está validada técnicamente (pendientes, impermeabilización, desagües y cálculo).',
      ceiling: { type: 'vuelta-catalana', spacing: 0.55, rise: 0.1, status: 'confirmado', note: 'Techo confirmado por la propiedad: vigas vistas color cemento (gris natural mate) y volta catalana de terracota entre vigas, cada 0,55 m cruzando el ancho; flecha de 0,10 m. Sustituye las indicaciones anteriores de vigas blancas, de madera o del mismo color que la volta.' },
    },
    {
      type: 'plana-peto', label: 'Plana con remate ibicenco (propuesta)', pitchDeg: 0, overhang: 0, thickness: 0.25, parapet: 0.45, status: 'propuesto',
      note: 'Propuesta estética exterior: remate blanco continuo y redondeado con peto de 0,45 m. Eleva la coronación a ≈6,65 m. Debe contrastarse con la cubierta inclinada del informe; no sustituye el cálculo ni el diseño de impermeabilización y desagües. No validada técnicamente.',
      ceiling: { type: 'vuelta-catalana', spacing: 0.55, rise: 0.1, status: 'confirmado', note: 'Igual que la opción base: vigas color cemento y volta de terracota.' },
    },
    {
      type: 'un-agua', label: 'Inclinada a un agua (informe)', pitchDeg: 8, overhang: 0.2, thickness: 0.15, status: 'documentado', sourceId: S.informe,
      note: 'Cubierta inclinada según el informe del arquitecto (panel tipo sándwich). Pendiente de 8° y vuelo de 0,20 m a modo de hipótesis: el informe no se ha adjuntado. Se muestra para comparar volumen y altura con la plana.',
      ceiling: { type: 'vuelta-catalana', spacing: 0.55, rise: 0.1, status: 'confirmado', note: 'Interior igual que la opción base.' },
    },
  ],
  measures: [
    { id: 'largo', label: 'Largo exterior (informe)', value: L, unit: 'm', decimals: 2, sourceId: S.informe, status: 'documentado', note: 'Informe del arquitecto. La cadena del boceto (3,5 + 2,5 + 3,5 + 1,20 + 5 = 15,70 m) se toma como interior.' },
    { id: 'cadena', label: 'Cadena de cotas del boceto (interior)', value: 15.7, unit: 'm', decimals: 2, sourceId: S.planta, status: 'interpretado', note: 'Antes se tomaba como exterior (modelo de 15,70 × 5,00 m).' },
    { id: 'superficie-informe', label: 'Superficie construida actual (informe)', value: 79.48, unit: 'm²', decimals: 2, sourceId: S.informe, status: 'documentado', note: 'No coincide con 16,33 × 5,22 = 85,24 m²: pendiente de contrastar.' },
    { id: 'tramo-1', label: 'Tramo dormitorio', value: 3.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«3\'5 METRES»' },
    { id: 'tramo-2', label: 'Tramo baño', value: 2.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«2\'5 M»' },
    { id: 'tramo-3', label: 'Tramo escalera y cocina', value: 3.5, unit: 'm', decimals: 1, sourceId: S.planta, status: 'documentado', note: '«3\'5 M»' },
    { id: 'tramo-4', label: 'Puerta de entrada', value: 1.2, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '«1\'20 M» y «120 cm» en el frontal B' },
    { id: 'tramo-5', label: 'Tramo final (estar)', value: 5, unit: 'm', decimals: 0, sourceId: S.planta, status: 'documentado', note: '«5 METRES»' },
    { id: 'ancho', label: 'Ancho exterior (informe)', value: W, unit: 'm', decimals: 2, sourceId: S.informe, status: 'documentado', note: 'Informe del arquitecto. La propiedad había indicado «5 de ancho».' },
    { id: 'espesor-b', label: 'Muro del frontal B (puerta de entrada)', value: TB, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado' },
    { id: 'espesor', label: 'Resto de muros exteriores', value: T, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado' },
    { id: 'altura', label: 'Altura total (alzados A y B)', value: H_TOTAL, unit: 'm', decimals: 2, sourceId: S.fa, status: 'documentado', note: '«6\'20 METRES»' },
    { id: 'cota-altell', label: 'Suelo del altell', value: ALTELL, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado', note: 'Primero «a 260 cm»; después «altura interior mínima de 2,50 m por piso» con forjado de 0,30 m → 2,80 m.' },
    { id: 'altura-libre', label: 'Altura libre mínima por planta', value: H_LIBRE, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado', note: '«Mínimo 2,50 m por piso» (propiedad).' },
    { id: 'canto-altell', label: 'Canto del forjado del altell', value: SLAB, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado', note: '«Hazlo de 0,30 m» (propiedad).' },
    { id: 'obertura-7', label: 'Obertura del frontal A (boceto)', value: 7, unit: 'm', decimals: 0, sourceId: S.fa, status: 'documentado', note: '«OBERTURA 7 M» (planta) y «7 metres» (frontal A). Variante.' },
    { id: 'obertura-9', label: 'Ventanal del frontal A (solicitado)', value: 9, unit: 'm', decimals: 0, sourceId: S.prop, status: 'pendiente', note: 'Solicitado por la propiedad; cabe entre 6,85 y 15,85 m. Pendiente de cálculo estructural.' },
    { id: 'obertura-225', label: 'Oberturas de 2,25 m', value: 2.25, unit: 'm', decimals: 2, sourceId: S.planta, status: 'documentado', note: '«OBERTURA: 225 CM»; «2,25 m» dos veces en el frontal A' },
    { id: 'puerta-70', label: 'Puerta del frontal B', value: 0.7, unit: 'm', decimals: 2, sourceId: S.fb, status: 'documentado', note: '«70 cm»; es una puerta (propiedad)' },
    { id: 'altura-7m', label: 'Altura de la obertura de 7 m', value: 3.15, unit: 'm', decimals: 2, sourceId: S.fa, status: 'interpretado', note: 'Medida en el alzado A.' },
    { id: 'altura-225', label: 'Altura de la obertura de 2,25 m (planta baja)', value: 2.4, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado', note: '«Es ok 2,40 m» (propiedad). Queda bajo el forjado del altell (cara inferior a 2,50 m).' },
    { id: 'vigas', label: 'Separación de las vigas de la vuelta catalana', value: 0.55, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado', note: '«Tal como las tienes y cada 55 cm» (propiedad): cruzan el ancho de la casa.' },
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
    FOTOS_PARCELA,
    { id: S.informe, label: 'Informe del arquitecto (cifras transmitidas)', detail: '16,33 × 5,22 m exteriores, 79,48 m² construidos, cubierta inclinada. El documento no se ha adjuntado: solo se usan las cifras citadas.' },
    { id: S.presupuesto, label: 'Presupuesto PAC26-0052 (dos páginas)', detail: 'Partidas de obra: forjado del altell de vigas de madera con tablero, cubierta plana de viguetas con revoltón, zuncho del ventanal y huecos adicionales. No se publica.' },
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
    { sourceId: S.prop, read: '«El espesor de 0,6 sí, el resto no»', interpreted: 'El muro de 0,60 m del frontal B es el existente y se conserva; los demás muros existentes no se conservan con 0,30 m.' },
    { sourceId: S.fb, read: '«FRONTAL B», «70 cm», «120 cm»', interpreted: 'Puerta de entrada de 1,20 m y puerta de 70 cm en el baño.' },
    { sourceId: S.altell, read: '«ALTELL», contorno, hueco superior izquierdo, escalera; marcas solo en la mitad izquierda', interpreted: 'Altell sobre dormitorio y baño; la mitad derecha es doble altura (propiedad).' },
  ],
  discrepancies: [
    'Medidas: el informe da 16,33 × 5,22 m exteriores; el modelo anterior usaba 15,70 × 5,00 m (cadena del boceto como exterior y «5 de ancho»). Se adopta el informe y la cadena pasa a ser interior.',
    'Superficie: 79,48 m² construidos del informe frente a 85,24 m² del rectángulo de 16,33 × 5,22 m. Las fotos de dron sugieren además que el volumen principal actual es más profundo que los anexos: pendiente de contrastar.',
    'Cubierta: plana (propiedad y presupuesto, viguetas con revoltón) frente a inclinada de panel sándwich (informe).',
    'Forjado del altell: el presupuesto lo describe con vigas de madera y tablero atornillado; el techo confirmado de la planta baja es de vigas color cemento con volta: hay que decidir si el altell lleva otro sistema.',
    'Ventanal: «7 m» en los bocetos frente a 9 m solicitados; el presupuesto ya incluye un zuncho 40 × 70.',
    'Posición del hueco de 2,25 m: planta ≈1,25–3,50 m, alzado A ≈1,45–3,85 m y altell ≈1,55–3,95 m. Se usa la media (1,40–3,65 m).',
    'El altell se indicó primero a 2,60 m; con 2,50 m libres y forjado de 0,30 m pasa a 2,80 m.',
    'El alzado B dibuja la puerta de 70 cm de ≈2,9 m de alto, también bajo el altell. Se toma 2,20 m.',
    'Los anchos de los huecos de los alzados no están a escala. Se usan las cotas escritas.',
  ],
  questions: [
    'Puerta de 70 cm del frontal B: con las dos duchas enfrentadas al fondo del baño cae en la zona húmeda. ¿Se mantiene (con celosía/cortina) o se desplaza al vestíbulo seco?',
    'Superficie construida de 79,48 m²: ¿qué parte del rectángulo de 16,33 × 5,22 m excluye el informe?',
    'Ventanal de 9 m: pendiente del cálculo del arquitecto (zuncho, machones de ≈0,50 m).',
    'Logo: el enlace de Canva no es accesible desde aquí; falta el archivo (SVG o PNG) para integrarlo.',
  ],
  northDeg: null,
  facades: { A: 'Frontal A', B: 'Frontal B', izquierdo: 'Lateral izquierdo', derecho: 'Lateral derecho' },
  notices: ['Geometría de los bocetos fotografiados y de las respuestas de la propiedad. Revisa las preguntas en «Medidas y documentación».'],
};

/**
 * Lo indicado por la propiedad pasa de «documentado» a «confirmado» (se distingue de lo que solo
 * está escrito en un boceto). No cambia ningún valor.
 */
function confirmByOwner(p: ProjectData): ProjectData {
  const c = <T extends { status: DataStatus; sourceId?: string }>(x: T): T => (x.sourceId === S.prop && x.status === 'documentado' ? { ...x, status: 'confirmado' } : x);
  return {
    ...p,
    levels: p.levels.map((l) => (l.id === 'altell' ? { ...l, elevationStatus: 'confirmado' } : l)),
    walls: p.walls.map(c),
    openings: p.openings.map((o) => {
      const x = c(o);
      return x.system && x.sourceId === S.prop && x.system.status === 'documentado' ? { ...x, system: { ...x.system, status: 'confirmado' } } : x;
    }),
    rooms: p.rooms.map(c),
    slabs: p.slabs.map(c),
    stairs: p.stairs.map((st) => ({ ...st, upStatus: st.upStatus === 'documentado' ? 'confirmado' : st.upStatus })),
    railings: p.railings?.map(c),
    measures: p.measures.map(c),
    furniture: p.furniture.map((f) => (f.status === 'documentado' && /propiedad/.test(f.note ?? '') ? { ...f, status: 'confirmado' } : f)),
  };
}

export const VINALLOP: ProjectData = confirmByOwner(PROJECT);
