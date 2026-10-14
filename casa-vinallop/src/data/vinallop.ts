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
/** Altura total desde el terreno: 6,00 m (propiedad, 10/10/2026; los alzados del boceto marcaban 6,20 m). */
const H_TOTAL = 6.0;
/** El interior se eleva 0,36 m sobre el terreno (propiedad, 10/10/2026): suelo de planta baja a +0,36. */
const PB_EL = 0.36;
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
/** Dormitorio de 3,50 m libres y baño de 2,00 m libres (propiedad, 10/10/2026); antes, ejes de la cadena 3,5 + 2,5. */
const DORM_LIBRE = 3.5;
const BANO_LIBRE = 2.0;
const X_DORM = r2(XI + DORM_LIBRE + TP / 2); // 3,85 tabique dormitorio / baño
const X_ESC = r2(X_DORM + TP + BANO_LIBRE); // 5,95 tabique baño / escalera
const X_PUERTA = cx(CHAIN[0] + CHAIN[1] + CHAIN[2]); // 9,80 puerta de entrada
const Y_PASILLO = 1.2; // línea del pasillo junto al frontal A (≈0,85 m libres, se conserva)
/** Puerta del baño: el arco dibujado en la línea del pasillo, junto a la escalera (propiedad). */
/** puerta exterior de la ducha (0,70 m) en el lado de la escalera de la zona húmeda */
const DUCHA_PUERTA_X0 = r2(X_ESC - TP / 2 - 0.05 - 0.7);
const BANO_PUERTA_X0 = r2(X_ESC - TP / 2 - 0.05 - 0.9); // puerta de 0,90 junto a la escalera
const ALT_X1 = r2(X_ESC + TP / 2); // 6,00 borde del altell
const ESC: [number, number, number, number] = [ALT_X1, r2(Y_PASILLO + TP / 2), r2(ALT_X1 + 1.2), y1];
/** cocina bajo la escalera: desde el 8.º peldaño la cara inferior queda por encima de la encimera (0,90 m) */
const ESC_HUECO = r2(ESC[1] + ((ESC[3] - ESC[1]) * 7) / 15);
/** mesa de comedor entre la isla y el salón */
const MESA_COM: Vec2 = [11.45, 1.7];
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

const ext = { levelId: 'pb', thickness: T, height: r2(H_TOTAL - PB_EL), kind: 'exterior' as const, status: 'documentado' as const, sourceId: S.prop };
const tab = { levelId: 'pb', thickness: TP, height: H_PB, kind: 'tabique' as const, status: 'interpretado' as const, sourceId: S.planta };

const walls: Wall[] = [
  { ...ext, id: 'muro-A', facade: 'A', a: [h, h], b: [L - h, h], ext: [h, h] },
  { ...ext, id: 'muro-derecho', facade: 'derecho', a: [L - h, h], b: [L - h, W - TB / 2], ext: [-h, -TB / 2] },
  { ...ext, id: 'muro-B', facade: 'B', thickness: TB, a: [h, W - TB / 2], b: [L - h, W - TB / 2], ext: [h, h] },
  { ...ext, id: 'muro-izquierdo', facade: 'izquierdo', a: [h, h], b: [h, W - TB / 2], ext: [-h, -TB / 2] },
  // tabique dormitorio / baño (cadena 3,50), desde la línea del pasillo hasta el frontal B
  { ...tab, id: 'tab-dormitorio', a: [X_DORM, Y_PASILLO - TP / 2], b: [X_DORM, y1] },
  // línea del pasillo: separa el pasillo (junto al frontal A) del baño
  { ...tab, id: 'tab-pasillo', a: [X_DORM + TP / 2, Y_PASILLO], b: [ALT_X1, Y_PASILLO] },
  // borde izquierdo de la escalera (cadena 6,00): cierra el baño
  { ...tab, id: 'tab-escalera', a: [X_ESC, Y_PASILLO + TP / 2], b: [X_ESC, y1] },
];

const onAB = (x: number) => r2(x - h); // offset sobre el eje de los muros A y B (empieza en x = 0,15)
const openings: Opening[] = [
  {
    id: 'obertura-7m', label: 'Ventanal de 7 m', wallId: 'muro-A', kind: 'cristalera', offset: onAB(cx(7.4)), width: 7, sill: 0, height: 3.15,
    system: null, status: 'confirmado', sourceId: S.prop, variantKey: 'ventanal-7',
    note: 'La propiedad vuelve a los 7 m de los bocetos («OBERTURA 7 M»): menos pérdidas por el lado norte, menos coste y menos estructura que el de 9 m. En planta empieza junto a la escalera y en el alzado A termina a ≈1,4 m del extremo. Altura medida en el alzado A (≈3,15 m). Carpintería no definida.',
  },
  {
    id: 'obertura-9m', label: 'Ventanal de 9 m (solicitado)', wallId: 'muro-A', kind: 'cristalera', offset: onAB(r2(ALT_X1 + 0.5)), width: 9, sill: 0, height: 3.15,
    system: null, status: 'propuesto', sourceId: S.prop, variantKey: 'ventanal-9',
    note: 'Solicitado por la propiedad y presupuestado (PAC26-0052: demolición para abertura de 9 m y zuncho de 9 m de 40 × 70 cm con triple armado, propuesta del constructor). Encaje en el modelo: de 6,85 a 15,85 m; deja un machón de 0,50 m junto al borde del altell y 0,48 m en la esquina (0,18 m de jamba interior más el lateral de 0,30 m). Apoyos, machones y zuncho pendientes de cálculo del arquitecto. La estufa queda delante del vidrio.',
  },
  {
    id: 'obertura-225-pb', label: 'Puerta exterior del dormitorio (1,50 m)', wallId: 'muro-A', kind: 'puerta', offset: onAB(r2(cx(1.4) + 2.25 / 2 - 0.75)), width: 1.5, sill: 0, height: 2.5, glazed: 'transparente',
    system: { type: 'abatible', leaves: 2, status: 'propuesto' }, status: 'confirmado', sourceId: S.prop,
    note: 'Puerta exterior del dormitorio de 1,50 m (propiedad, 10/10/2026), en el sitio de la obertura de 2,25 m del boceto y centrada en ella. Dos hojas de vidrio abatibles (propuesta). 1,50 × 2,50 m (propiedad, 10/10/2026): llega a la cara inferior del forjado del altell (2,50 m), así que no queda dintel de muro: el canto del forjado o un zuncho hace de dintel. A comprobar con el arquitecto.',
  },
  {
    id: 'obertura-225-altell', label: 'Obertura de 2,25 m (altell)', wallId: 'muro-A', kind: 'cristalera', offset: onAB(cx(1.4)), width: 2.25, sill: r2(ALTELL + 1.1), height: 1.3,
    system: null, status: 'interpretado', sourceId: S.fa,
    note: 'Anchura documentada (2,25 m), alineada con la de planta baja. Antepecho a 1,10 m sobre el suelo del altell. Con la casa a 6,00 m y el interior elevado 0,36 m solo quedan ≈2,49 m libres en el altell: el hueco baja a 1,30 m de alto (dintel 0,10 m bajo el forjado de cubierta). El alzado A lo dibujaba más alto. Los bordes en zigzag se ignoran (propiedad).',
  },
  {
    id: 'puerta-120', label: 'Puerta de entrada (1,20 × 2,10 m)', wallId: 'muro-B', kind: 'puerta', offset: onAB(X_PUERTA), width: 1.2, sill: 0, height: 2.1,
    system: { type: 'abatible', leaves: 1, status: 'interpretado' }, swing: { hinge: 'inicio', dir: -1 }, entrance: true, status: 'documentado', sourceId: S.planta,
    note: 'Anchura y posición documentadas (cadena de cotas y «120 cm» del frontal B). En el muro de 0,60 m. Una hoja con bisagra en el lado del 9,50, abre hacia dentro. 1,20 × 2,10 m (propiedad, 10/10/2026; antes 2,60 m de alto y el alzado B dibujaba ≈3,0 m).',
  },
  {
    id: 'puerta-terraza', label: 'Puerta del altell a la terraza (lateral izquierdo)', wallId: 'muro-izquierdo', kind: 'puerta', offset: 0.6, width: 0.9, sill: ALTELL, height: 2.1, glazed: 'transparente',
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, swing: { hinge: 'inicio', dir: -1 }, status: 'propuesto', sourceId: S.prop,
    note: 'Propuesta de la propiedad: terraza para el altell encima del cuarto técnico, con acceso desde el lateral. Puerta de vidrio de 0,90 m en el lateral izquierdo, en la parte del altell junto al frontal A (lejos de la cama). Abre hacia dentro. Con el cuarto técnico bajado a 2,75 m (propiedad), la terraza queda a +2,78, enrasada con el altell (+2,80) salvo el umbral: sin escalón interior. Pendiente: impermeabilización de la cubierta del cuarto, desagüe, carga de uso y cálculo del arquitecto.',
  },
  {
    id: 'puerta-70', label: 'Puerta de vidrio del baño (0,70 × 2,10 m, desde la ducha)', wallId: 'muro-B', kind: 'puerta', offset: onAB(DUCHA_PUERTA_X0), width: 0.7, sill: 0, height: 2.1, glazed: 'mate',
    system: { type: 'abatible', leaves: 1, status: 'documentado' }, swing: { hinge: 'fin', dir: 1 }, status: 'documentado', sourceId: S.prop,
    note: 'Puerta (propiedad) de 70 cm del frontal B, en la zona húmeda de las duchas. Indicación de la propiedad: «la puerta que hay debería ser de cristal y poder acceder desde la ducha». Hoja de vidrio en marco fino; vidrio mate propuesto por intimidad. Abre hacia fuera, con la bisagra en la jamba derecha en el plano. Se accede directamente desde la zona de duchas, sin celosía delante. 0,70 × 2,10 m (propiedad, 10/10/2026), en la zona húmeda del baño de 2,00 m, del lado de la escalera. Bajo el altell: altura 2,20 m (hipótesis). Umbral sin escalón, con un pequeño rebaje, y el sumidero lineal del plato justo delante de la puerta para que el agua no salga: solución aceptada por la propiedad; el detalle constructivo (rebaje, pendientes, impermeabilización) lo define el arquitecto.',
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
    system: { type: 'abatible', leaves: 2, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventilacion-cruzada', shutters: true,
    note: 'Ventana practicable en el frontal B, opuesta al ventanal, sobre el respaldo del sofá (antepecho 1,10 m). El presupuesto PAC26-0052 incluye «una ventana más en el comedor». Posición propuesta.',
  },
  {
    id: 'var-ventana-dormitorio', label: 'Ventana con contraventana en el dormitorio (variante)', wallId: 'muro-B', kind: 'ventana', offset: onAB(cx(2.75)), width: 0.6, sill: 0.9, height: 1.3,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventana-dormitorio', shutters: true,
    note: 'Ventana practicable con contraventana de madera junto a la cama, sobre la mesita. El presupuesto habla de dos ventanas en la habitación de abajo; la segunda no tiene sitio claro (armario empotrado en el lateral, cabecero en el frontal B): pendiente.',
  },
  {
    id: 'var-ventana-bano', label: 'Ventana alta del baño (variante)', wallId: 'muro-B', kind: 'ventana', offset: onAB(r2(X_DORM + 0.2)), width: 0.7, sill: 1.85, height: 0.5,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventana-bano',
    note: 'Ventana alta sobre la zona húmeda (presupuesto: «una ventana pequeña en el baño»), con extracción mecánica compatible con dos duchas (≈15 l/s, propuesta pendiente de proyecto de instalaciones).',
  },
  {
    id: 'var-ventana-altell-1', label: 'Ventana del altell 1 (variante)', wallId: 'muro-B', kind: 'ventana', offset: onAB(cx(0.6)), width: 0.6, sill: r2(ALTELL + 0.9), height: 1.2,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventanas-altell',
    note: 'El presupuesto incluye dos ventanas en la habitación de arriba. Propuesta: a ambos lados del cabecero, en el frontal B.',
  },
  {
    id: 'var-ventana-altell-2', label: 'Ventana del altell 2 (variante)', wallId: 'muro-B', kind: 'ventana', offset: onAB(r2(X_DORM + 0.1)), width: 0.6, sill: r2(ALTELL + 0.9), height: 1.2,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventanas-altell',
    note: 'Segunda ventana del altell (presupuesto). Posición propuesta.',
  },
  // ---- propuesta de ventanas al sur-suroeste (frontal B) y al algarrobo: la fachada soleada casi no tenía huecos ----
  {
    id: 'var-ventana-cocina', label: 'Ventana alta sobre la cocina (propuesta)', wallId: 'muro-B', kind: 'ventana', offset: onAB(8.1), width: 1.2, sill: 1.6, height: 0.9,
    system: { type: 'abatible', leaves: 2, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventana-cocina',
    note: 'Propuesta: ventana apaisada justo encima de la balda de la cocina (antepecho 1,60 m), al sur-suroeste. Luz sobre la encimera y salida del aire caliente de la cocina. El muro de 0,60 m hace de parasol: en verano (sol a ≈75° al mediodía) el hueco queda a la sombra y en invierno (≈28°) entra el sol.',
  },
  {
    id: 'var-ventana-alta-1', label: 'Ventana alta en la doble altura 1 (propuesta)', wallId: 'muro-B', kind: 'ventana', offset: onAB(8.1), width: 1.2, sill: 4.2, height: 1.2,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventanas-altas',
    note: 'Propuesta: ventana alta en la doble altura (antepecho 4,20 m), alineada con la de la cocina. En invierno el sol bajo entra hasta el fondo del estar; con la cristalera del frontal A forma ventilación cruzada y por efecto chimenea saca el aire caliente en verano. Apertura motorizada o con varilla.',
  },
  {
    id: 'var-ventana-alta-2', label: 'Ventana alta en la doble altura 2 (propuesta)', wallId: 'muro-B', kind: 'ventana', offset: onAB(rx(12.4)), width: 1.2, sill: 4.2, height: 1.2,
    system: { type: 'abatible', leaves: 1, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventanas-altas',
    note: 'Segunda ventana alta, sobre el sofá y alineada con la del comedor. Mismo criterio que la primera.',
  },
  {
    id: 'var-ventana-algarrobo', label: 'Ventana al algarrobo en el lateral derecho (propuesta)', wallId: 'muro-derecho', kind: 'ventana', offset: 2.35, width: 1.4, sill: 1.0, height: 1.2,
    system: { type: 'abatible', leaves: 2, status: 'propuesto' }, status: 'propuesto', sourceId: S.prop, variantKey: 'ventana-algarrobo', shutters: true,
    note: 'Propuesta: ventana sobre el respaldo del sofá lateral, mirando al tronco del algarrobo y al comedor exterior (este-sureste: sol de la mañana). Con contraventanas de madera. Lateral portante: hueco pendiente de cálculo.',
  },
];

const room = (id: string, levelId: string, name: string, poly: Vec2[], status: Room['status'], sourceId: string, note: string, extra: Partial<Room> = {}): Room => ({
  id, levelId, name, polygon: poly, status, sourceId, note, ...extra,
});
const rooms: Room[] = [
  room('dormitorio', 'pb', 'Dormitorio', rect(x0, y0, X_DORM - TP / 2, y1), 'interpretado', S.planta, 'Cama en el extremo izquierdo, cabecero contra el frontal B, y armario empotrado en el lateral.', { openTo: ['pasillo'] }),
  room('pasillo', 'pb', 'Pasillo', rect(X_DORM - TP / 2, y0, ALT_X1, Y_PASILLO - TP / 2), 'interpretado', S.planta, 'Franja de ≈0,85 m libres junto al frontal A: une la zona de día y el arranque de la escalera con el dormitorio.', { openTo: ['dormitorio', 'dia'] }),
  room('bano', 'pb', 'Baño', rect(X_DORM + TP / 2, Y_PASILLO + TP / 2, X_ESC - TP / 2, y1), 'documentado', S.prop, 'Entrada desde el pasillo, junto a la escalera (propiedad). Sin el armario del pasillo (eliminado por la propiedad), el baño ocupa todo el ancho entre el dormitorio y la escalera. Baño de 2,00 m libres (propiedad, 10/10/2026). Al fondo, zona húmeda común de 2,00 × 1,20 m con dos duchas enfrentadas (confirmado); lavabo a la izquierda e inodoro a la derecha según se entra (propuesta). Puerta exterior de vidrio de 0,70 × 2,10 m en la zona húmeda.'),
  room('dia', 'pb', 'Cocina y estar', rect(ALT_X1, y0, x1, y1), 'documentado', S.prop, 'Doble altura (propiedad). Entrada al baño por el pasillo. Escalera en L, cocina junto a la escalera con isla central, sofá en L y estufa.', { openTo: ['pasillo'] }),
  room('altell', 'altell', 'Altell', rect(x0, y0, ALT_X1, y1), 'documentado', S.prop, 'Zona diáfana a 2,80 m con cama de matrimonio (propiedad), sobre el dormitorio, el pasillo y el baño. La zona de día es de doble altura. Borde hacia la doble altura a 5,70 m del lateral izquierdo, con barandilla.'),
];

const f = (x: Furniture) => x;
/** cara interior del frontal B y del frontal A */
const YB = y1;
const furniture: Furniture[] = [
  // dormitorio (posición de los bocetos, sin cambios respecto a la cadena de cotas)
  // armario empotrado (propiedad: «mueve el armario y pon un pequeño armario en el lado del cristal»): se acorta y se lleva
  // hacia el frontal A, lejos de la cama, y se añade uno pequeño junto a la cristalera del dormitorio
  f({ id: 'armario', type: 'armario', label: 'Armario empotrado', roomId: 'dormitorio', x: r2(x0 + 0.25), y: r2(y0 + 1.1), w: 2.2, d: 0.5, h: 2.4, rot: 270, status: 'propuesto', note: 'Armario de 2,20 m en el lateral izquierdo, desplazado hacia el frontal A (indicación de la propiedad): ya no queda al lado de la cama y el paso junto a ella pasa de 0,68 m a ≈1,2 m.' }),
  f({ id: 'armario-cristal', type: 'armario', label: 'Armario pequeño (lado de la cristalera)', roomId: 'dormitorio', x: r2(x0 + 0.5 + 0.06 + 0.4), y: r2(y0 + 0.25), w: 0.8, d: 0.5, h: 2.1, rot: 0, status: 'propuesto', note: 'Armario pequeño de 0,80 m en el frontal A, entre el armario empotrado y la cristalera del dormitorio (indicación de la propiedad).' }),
  f({ id: 'cama', type: 'cama', label: 'Cama 160 × 200', roomId: 'dormitorio', x: cx(1.98), y: r2(YB - 1.0), w: 1.6, d: 2.0, h: 0.55, rot: 180, status: 'interpretado', note: 'Dibujada de ≈1,65 × 2,05 m con dos almohadas y el embozo; cabecero contra el frontal B.' }),
  f({ id: 'mesita-dorm', type: 'mesita', label: 'Mesita', roomId: 'dormitorio', x: cx(3.05), y: r2(YB - 0.22), w: 0.4, d: 0.36, h: 0.5, rot: 180, status: 'propuesto', note: 'Al lado libre de la cama (el otro lado queda junto al armario empotrado).' }),
  f({ id: 'balda-dorm', type: 'balda', label: 'Balda de apoyo', roomId: 'dormitorio', x: cx(1.0), y: r2(YB - 0.15), w: 0.3, d: 0.25, h: 0.55, rot: 180, status: 'propuesto', note: 'Balda volada de madera entre el armario y la cama: deja libre el suelo y el paso al armario.' }),
  f({ id: 'aplique-dorm-1', type: 'aplique', label: 'Aplique de pared', roomId: 'dormitorio', x: cx(0.98), y: r2(YB - 0.04), w: 0.16, d: 0.08, h: 1.3, rot: 180, status: 'propuesto' }),
  f({ id: 'aplique-dorm-2', type: 'aplique', label: 'Aplique de pared', roomId: 'dormitorio', x: cx(2.98), y: r2(YB - 0.04), w: 0.16, d: 0.08, h: 1.3, rot: 180, status: 'propuesto' }),
  // altell (zona diáfana)
  f({ id: 'cama-altell', type: 'cama', label: 'Cama de matrimonio 160 × 200', roomId: 'altell', x: cx(2.5), y: r2(YB - 1.0), w: 1.6, d: 2.0, h: 0.55, rot: 180, status: 'propuesto', note: 'Cama de matrimonio en el altell (propiedad). Posición propuesta: cabecero contra el frontal B, mirando a la obertura de 2,25 m.' }),
  f({ id: 'mesita-altell-1', type: 'mesita', label: 'Mesita', roomId: 'altell', x: cx(1.45), y: r2(YB - 0.23), w: 0.45, d: 0.45, h: 0.5, rot: 180, status: 'propuesto' }),
  f({ id: 'mesita-altell-2', type: 'mesita', label: 'Mesita', roomId: 'altell', x: cx(3.55), y: r2(YB - 0.23), w: 0.45, d: 0.45, h: 0.5, rot: 180, status: 'propuesto' }),
  // baño: dos duchas enfrentadas al fondo (propiedad), lavabo de obra a la izquierda y inodoro a la derecha
  // (izquierda y derecha según se entra desde el pasillo, mirando hacia el frontal B)
  f({ id: 'ducha', type: 'ducha', label: 'Zona húmeda · dos duchas enfrentadas', roomId: 'bano', x: r2((B_X0 + B_X1) / 2), y: r2((B_WET + YB) / 2), w: r2(B_X1 - B_X0), d: r2(YB - B_WET), h: 2.0, rot: 0, status: 'confirmado',
    note: 'Dos duchas una frente a la otra (propiedad): rociadores en los tabiques opuestos (dormitorio y escalera), orientados hacia la zona húmeda común de 2,00 × 1,20 m (baño de 2,00 m), con mandos independientes. Separación con celosía cerámica (A o B), vidrio fijo por la cara húmeda y cortina en el acceso con carril propio (propuesta). Desde la zona húmeda se sale al exterior por la puerta de vidrio de 70 cm del frontal B (propiedad).' }),
  f({ id: 'lavabo', type: 'lavabo', label: 'Lavabo de obra', roomId: 'bano', x: r2(B_X1 - 0.28), y: 2.68, w: 1.05, d: 0.55, h: 0.85, rot: 90, status: 'propuesto', note: 'Lavabo de obra con un seno, dos cajones de madera, hueco inferior y espejo grande (referencia del baño). En el lateral izquierdo según se entra, contra el tabique de la escalera.' }),
  f({ id: 'inodoro', type: 'inodoro', label: 'Inodoro', roomId: 'bano', x: r2(B_X0 + 0.33), y: 2.42, w: 0.38, d: 0.65, h: 0.42, rot: 270, status: 'propuesto', note: 'En el lateral derecho según se entra, fuera del eje de la puerta para dar privacidad. Saneamiento a comprobar (el boceto marcaba «×» de agua en este tabique).' }),
  // cocina lineal contra el frontal B (propiedad), entre la escalera y la puerta de entrada.
  // Con rot 180 el eje local va de la puerta hacia la escalera: frigorífico, placa y horno, lavavajillas, fregadero.
  f({ id: 'encimera', type: 'encimera', label: 'Cocina', roomId: 'dia', x: r2((ESC[2] + 9.75) / 2), y: r2(YB - 0.3), w: r2(9.75 - ESC[2]), d: 0.6, h: 0.9, rot: 180, status: 'confirmado',
    modules: [{ kind: 'frigorifico', w: 0.55 }, { kind: 'placa-horno', w: 0.6 }, { kind: 'lavavajillas', w: 0.45 }, { kind: 'fregadero', w: 0.6 }, { kind: 'cajones', w: r2(9.75 - ESC[2] - 2.2) }],
    note: 'Cocina junto a la escalera (propiedad), contra el frontal B. Módulos propuestos sobre los dos puntos de agua del boceto: fregadero y lavavajillas; placa con horno debajo y frigorífico integrado bajo encimera (no cabe una columna: al lado está la puerta de entrada). Frentes de roble con nudos dentro de una envolvente mineral clara, encimera y salpicadero coordinados, balda corrida gruesa y grifo extraíble negro mate (referencia 01).' }),
  // isla de obra: estructura de la referencia 05 y acabado de la 06; deja 1,00 m de paso hasta la cocina
  f({ id: 'isla', type: 'isla', label: 'Isla de obra', roomId: 'dia', x: cx(9.05), y: r2(YB - 0.6 - 1.0 - 0.475), w: 1.6, d: 0.95, h: 0.9, rot: 0, status: 'propuesto',
    note: 'Isla central (propiedad). Estructura de la referencia 05: hueco de 1,00 m para tres taburetes y dos estantes abiertos de 0,30 m en el mismo frente (hacia el frontal A), apoyos macizos. Acabado de la referencia 06: piezas verticales de terracota a junta corrida con juntas claras y encimera clara de esquinas suavizadas. 1,60 × 0,95 m, altura 0,90 m: deja 1,00 m de paso hasta la cocina (también hasta el tramo bajo la escalera) y ≈1,3 m detrás de los taburetes. El boceto dibuja ≈1,55 × 1,65 m (se conserva como trazo).' }),
  ...[8.4, 8.8, 9.2].map((x, i) => f({ id: `taburete-${i + 1}`, type: 'taburete', label: 'Taburete', roomId: 'dia', x: cx(x), y: r2(YB - 0.6 - 1.0 - 0.95 - 0.2), w: 0.38, d: 0.38, h: 0.65, rot: 0, status: 'propuesto' })),
  // cocina también bajo la escalera (propiedad): tramo de encimera en el lado abierto de la escalera, donde los peldaños
  // ya vuelan por encima de la encimera; forma una L con la cocina del frontal B
  f({ id: 'encimera-escalera', type: 'encimera', label: 'Cocina bajo la escalera', roomId: 'dia', x: r2(ESC[2] - 0.3), y: r2((ESC_HUECO + y1) / 2), w: r2(y1 - ESC_HUECO), d: 0.6, h: 0.9, rot: 270, underStair: true, status: 'propuesto',
    modules: [{ kind: 'cajones', w: 0.6 }, { kind: 'puertas', w: r2(y1 - ESC_HUECO - 1.2) }, { kind: 'cajones', w: 0.6 }],
    note: 'Indicación de la propiedad: «debajo la escalera pon cocina también». Encimera de 0,60 m en el lado abierto de la escalera, desde donde los peldaños quedan por encima de 0,90 m hasta el frontal B, unida en L con la cocina existente. Bajo la escalera, la escalera pasa a ser una losa escalonada. Cajones y puertas propuestos (mismos frentes de roble y encimera); detrás queda un hueco de ≈0,60 m bajo los peldaños para almacenaje. Sin salpicadero ni baldas altas: encima vuelan los peldaños. La altura libre sobre la encimera va de ≈0,20 m en el arranque a más de 1 m junto al frontal B.' }),
  // mesa de comedor para 4 (propiedad) entre la isla y el salón, junto al ventanal
  f({ id: 'mesa-comedor', type: 'mesa', onlyIf: { salon: 'sofa-l', mesaComedor: 'rectangular' }, label: 'Mesa de comedor (4 plazas)', roomId: 'dia', x: MESA_COM[0], y: MESA_COM[1], w: 1.2, d: 0.8, h: 0.75, rot: 0, status: 'propuesto', color: '#8d5c3c',
    note: 'Mesa de comedor para cuatro (indicación de la propiedad): madera maciza de 120 × 80 cm, como la mesa del salón, con dos sillas a cada lado. Entre la isla y el sofá, cerca del ventanal; medidas y modelo propuestos.' }),
  ...[[-0.3, -1], [0.3, -1], [-0.3, 1], [0.3, 1]].map(([dx, side], i) => f({ id: `silla-comedor-${i + 1}`, type: 'silla', label: 'Silla de comedor', roomId: 'dia', x: r2(MESA_COM[0] + dx), y: r2(MESA_COM[1] + side * 0.6), w: 0.44, d: 0.44, h: 0.82, rot: side < 0 ? 0 : 180, status: 'propuesto', onlyIf: { salon: 'sofa-l', mesaComedor: 'rectangular' } })),
  // variante: mesa redonda de Ø 0,90 con cuatro sillas en diagonal (gana paso hacia el ventanal)
  f({ id: 'mesa-comedor-redonda', type: 'mesa-redonda', label: 'Mesa de comedor redonda Ø 0,90 (4 plazas)', roomId: 'dia', x: MESA_COM[0], y: r2(MESA_COM[1] + 0.1), w: 0.9, d: 0.9, h: 0.75, rot: 0, status: 'propuesto', color: '#8d5c3c', onlyIf: { salon: 'sofa-l', mesaComedor: 'redonda' },
    note: 'Variante de la mesa de comedor: redonda de madera maciza, Ø 0,90 m, pie central, para cuatro. Con las sillas en diagonal deja ≈0,70 m hasta el ventanal (la rectangular deja ≈0,58 m) y la circulación alrededor es más fluida. Medidas y modelo propuestos.' }),
  ...[0, 1, 2, 3].map((k) => {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    return f({ id: `silla-redonda-${k + 1}`, type: 'silla', label: 'Silla de comedor', roomId: 'dia', x: r2(MESA_COM[0] + Math.cos(a) * 0.7), y: r2(MESA_COM[1] + 0.1 + Math.sin(a) * 0.7), w: 0.44, d: 0.44, h: 0.82, rot: r2((Math.atan2(Math.cos(a), Math.sin(a)) * 180) / Math.PI + 180), status: 'propuesto', onlyIf: { salon: 'sofa-l', mesaComedor: 'redonda' } });
  }),
  f({ id: 'sofa-b', onlyIf: { salon: 'sofa-l' }, type: 'sofa-l', label: 'Sofá en L (frontal B)', roomId: 'dia', x: r2(rx(12.75) + 0.25), y: r2(YB - 0.43), w: 3.5, d: 0.85, h: 0.8, rot: 180, status: 'documentado', note: 'Sofá (propiedad): tramo desde la jamba de la puerta, fondo ≈0,85 m. Colchonetas gruesas y cojines blancos y crudos (referencia 03).' }),
  // recibidor (propiedad): el sofá empieza 50 cm más lejos de la puerta y, junto a la jamba, banco de obra con colgadores
  f({ id: 'banco-recibidor', type: 'banco', label: 'Banco de obra del recibidor', roomId: 'dia', x: r2(X_PUERTA + 1.2 + 0.29), y: r2(YB - 0.2), w: 0.5, d: 0.4, h: 0.8, rot: 180, status: 'propuesto', note: 'Banco de obra de 0,50 m junto a la puerta de entrada para sentarse y dejar cosas, con colgadores encima (indicación de la propiedad).' }),
  f({ id: 'colgadores-recibidor', type: 'balda', label: 'Colgadores', roomId: 'dia', x: r2(X_PUERTA + 1.2 + 0.29), y: r2(YB - 0.1), w: 0.5, d: 0.2, h: 1.75, rot: 180, status: 'propuesto' }),
  f({ id: 'sofa-lateral', onlyIf: { salon: 'sofa-l' }, type: 'sofa-l', label: 'Sofá en L (lateral derecho)', roomId: 'dia', x: r2(x1 - 0.33), y: r2(YB - 1.4), w: 2.8, d: 0.65, h: 0.8, rot: 90, status: 'documentado', note: 'Segundo tramo del sofá contra el lateral derecho; fondo dibujado ≈0,65 m.' }),
  f({ id: 'estufa', type: 'estufa', label: 'Estufa', roomId: 'dia', x: rx(14.43), y: 0.9, w: 0.8, d: 0.8, h: 1.0, rot: 0, onlyIf: { salon: 'sofa-l', chimenea: 'estufa' }, status: 'documentado', note: 'El círculo del boceto (propiedad), junto al frontal A al final de la obertura. Dibujado de ≈1 m de diámetro; salida de humos supuesta. Con el ventanal de 9 m queda delante del vidrio.' }),
  // variante: chimenea de obra contra el lateral derecho, a continuación del sofá de obra (referencia de la propiedad)
  f({ id: 'chimenea-obra', type: 'chimenea-obra', label: 'Chimenea de obra (variante)', roomId: 'dia', x: r2(x1 - 0.33), y: r2(y0 + 0.75), w: 1.5, d: 0.65, h: r2(H_TOTAL - PB_EL), rot: 90, status: 'propuesto', onlyIf: { salon: 'sofa-l', chimenea: 'obra' },
    note: 'Variante (imagen de referencia de la propiedad): volumen de obra encalado de 1,50 m pegado al lateral derecho y hasta la cubierta, con hogar cerrado acristalado de ≈75 × 65 cm, leñero vertical empotrado y banco de obra de 0,42 m con remate oscuro delante del fuego, que continúa en el sofá de obra del lateral. Sustituye a la estufa redonda. Salida de humos por dentro del volumen hasta la cubierta. Pendiente: modelo de hogar, salida de humos, distancias a materiales combustibles y aire de combustión. Incompatible con la variante de puerta al comedor exterior en este mismo lateral.' }),
  // variante de salón (propiedad): dos sofás enfrentados en el centro, perpendiculares a los frontales A y B, y la mesa
  // de comedor rectangular en el rincón de la cristalera (donde va la variante de chimenea), con banco de obra
  f({ id: 'sofa-enfrentado-1', type: 'sofa', label: 'Sofá enfrentado 1 (variante)', roomId: 'dia', x: 11.5, y: 2.9, w: 2.0, d: 0.9, h: 0.8, rot: 270, status: 'propuesto', onlyIf: { salon: 'enfrentados' },
    note: 'Variante: dos sofás de 2,00 × 0,90 m en el centro del estar, perpendiculares a los frontales A y B y mirándose, con la mesa baja entre ellos. Deja ≈0,90 m hasta la isla, ≈0,70 m hasta el frontal B, libre el barrido de la puerta de entrada y ≈1,4 m de paso junto al ventanal.' }),
  f({ id: 'sofa-enfrentado-2', type: 'sofa', label: 'Sofá enfrentado 2 (variante)', roomId: 'dia', x: 14.0, y: 2.9, w: 2.0, d: 0.9, h: 0.8, rot: 90, status: 'propuesto', onlyIf: { salon: 'enfrentados' } }),
  f({ id: 'alfombra-enfrentados', type: 'alfombra', label: 'Alfombra de yute', roomId: 'dia', x: 12.75, y: 2.9, w: 2.4, d: 1.7, h: 0.012, rot: 90, status: 'propuesto', onlyIf: { salon: 'enfrentados' } }),
  f({ id: 'mesa-baja-enfrentados', type: 'mesa-centro', label: 'Mesa baja de madera 110 × 80', roomId: 'dia', x: 12.75, y: 2.9, w: 1.1, d: 0.6, h: 0.42, rot: 90, status: 'propuesto', color: '#8d5c3c', onlyIf: { salon: 'enfrentados' } }),
  f({ id: 'mesa-comedor-rincon', type: 'mesa', label: 'Mesa de comedor rectangular (rincón de la cristalera)', roomId: 'dia', x: 15.15, y: 1.2, w: 1.2, d: 0.8, h: 0.75, rot: 90, status: 'propuesto', color: '#8d5c3c', onlyIf: { salon: 'enfrentados' },
    note: 'Variante: mesa de comedor de 120 × 80 cm en el rincón del lateral derecho junto a la cristalera (sitio de la variante de chimenea), con banco de obra contra el lateral y dos sillas. En esta variante no hay estufa: el fuego tendría que ir a otro sitio (p. ej. al fondo, contra el frontal B entre los sofás).' }),
  f({ id: 'banco-comedor-rincon', type: 'banco', label: 'Banco de obra del comedor', roomId: 'dia', x: r2(x1 - 0.23), y: 1.2, w: 1.5, d: 0.45, h: 0.8, rot: 90, status: 'propuesto', onlyIf: { salon: 'enfrentados' } }),
  ...[0.9, 1.5].map((y, i) => f({ id: `silla-rincon-${i + 1}`, type: 'silla', label: 'Silla de comedor', roomId: 'dia', x: 14.5, y, w: 0.44, d: 0.44, h: 0.82, rot: 270, status: 'propuesto', onlyIf: { salon: 'enfrentados' } })),
  f({ id: 'alfombra-salon', onlyIf: { salon: 'sofa-l' }, type: 'alfombra', label: 'Alfombra de yute', roomId: 'dia', x: rx(12.85), y: r2(YB - 0.85 - 0.8), w: 2.4, d: 1.7, h: 0.012, rot: 0, status: 'propuesto', note: 'Alfombra de fibra natural con dibujo (referencia 03).' }),
  f({ id: 'mesa-salon', onlyIf: { salon: 'sofa-l' }, type: 'mesa-centro', label: 'Mesa de madera 110 × 80', roomId: 'dia', x: rx(12.85), y: r2(YB - 0.85 - 0.8), w: 1.1, d: 0.8, h: 0.42, rot: 0, status: 'propuesto', color: '#8d5c3c', note: 'Mesa de madera maciza de ≈110 × 80 cm (indicación de la propiedad), baja como en la referencia 03, a 0,40 m del sofá.' }),
  f({ id: 'jarron-salon', onlyIf: { salon: 'sofa-l' }, type: 'jarron', label: 'Cuenco de barro', roomId: 'dia', x: rx(13.15), y: r2(YB - 0.85 - 0.85), w: 0.22, d: 0.22, h: 0.42, rot: 0, status: 'propuesto' }),
];

const water = (id: string, levelId: string, p: Vec2, note: string, sourceId = S.planta): Trace => ({ id, levelId, label: 'Punto de agua (×)', cross: p, sourceId, note });
const traces: Trace[] = [
  water('x-ducha', 'pb', [cx(3.72), 2.3], 'Marca «×» del boceto junto al tabique del dormitorio, en el baño. Con la nueva distribución queda junto al inodoro.'),
  { id: 'isla-boceto', levelId: 'pb', kind: 'nota', label: 'Isla del boceto', sourceId: S.planta, points: [[cx(8.05), 1.55], [cx(9.55), 1.55], [cx(9.55), 3.2], [cx(8.05), 3.2]], closed: true, note: 'Rectángulo de ≈1,55 × 1,65 m dibujado como isla. Con ese fondo quedaría poco paso hasta la cocina; la propuesta lo reduce a 0,95 m.' },
  water('x-frontal-a', 'pb', [cx(4.65), y0], 'Sobre la línea del frontal A en el tramo del baño.'),
  water('x-cocina-1', 'pb', [cx(7.57), r2(YB - 0.6)], 'En el borde de la encimera.'),
  water('x-cocina-2', 'pb', [cx(8.35), r2(YB - 0.6)], 'En el borde de la encimera.'),
  water('x-altell', 'altell', [cx(0.6), 0.6], 'Junto a la esquina del lateral izquierdo y el frontal A.', S.altell),
  { id: 'doble-altura', levelId: 'altell', kind: 'nota', label: 'Doble altura (cocina y estar)', sourceId: S.prop, points: [[rx(10.7), 2.46]], note: 'Zona de día de doble altura (propiedad).' },
];

// ---------- exterior: solera en L y comedor bajo el algarrobo (decisiones confirmadas; medidas propuestas) ----------
/** algarrobo: posición aproximada sobre la vista cenital (src/data/parcela.ts) */
const ALGARROBO: Vec2 = [17.7, 2.3];
/**
 * solera en L (propiedad): tramo a lo largo de todo el frontal A, el de la cristalera, de punta a punta,
 * y tramo de 4 m en el lateral del algarrobo; sin solera en el frontal B (puerta de entrada).
 */
const SOL_LATERAL = 4;
/** fondo del tramo del frontal A, bajo el porche (medida propuesta) */
const SOL_TRASERA = 3.4;
/** el porche cubre toda la solera del frontal A, hasta el dormitorio (propiedad, 10/10/2026) */
const PORCHE_X0 = 0;
/** solera de sol de invierno a la derecha de la puerta de entrada, con banco de obra contra la fachada (propiedad) */
const SOL_INV: [number, number, number, number] = [r2(X_PUERTA - 0.2), W, r2(L + SOL_LATERAL), r2(W + 2.4)];
/** Soleras elevadas 0,18 m sobre el terreno (escalón en el borde) y otro escalón de 0,18 m hasta el suelo interior (+0,36). */
const SOL_TOP = 0.18;
/** la mesa va justo bajo el algarrobo (propiedad), entre el tronco y el tramo del frontal A: el alcorque y las sillas no se tocan */
const MESA_EXT: Vec2 = [r2(L + 2.0), r2(ALGARROBO[1] - 3.6)];
const outdoor: Outdoor = {
  pavements: [
    { id: 'grava-comedor', label: 'Transición de grava', rect: [-3.0, r2(-SOL_TRASERA - 0.5), r2(L + SOL_LATERAL + 0.5), r2(W + 0.5)], joints: 0, status: 'propuesto', note: 'Borde de grava de 0,50 m entre la solera y la tierra; también a lo largo del frontal B y la entrada, que quedan sin solera.' },
    {
      id: 'solera-l-lateral', label: 'Solera en L · tramo lateral', rect: [L, r2(-SOL_TRASERA), r2(L + SOL_LATERAL), W], joints: 2, top: SOL_TOP, permeable: { c: ALGARROBO, r: 1.5 }, status: 'confirmado',
      note: 'Tramo de 4 m junto al lateral derecho, bajo el algarrobo, continuo con el del frontal A y al mismo nivel; termina al ras del frontal B (la propiedad pidió quitar el trozo que sobresalía). La mesa va bajo la copa, entre el tronco y el tramo del frontal A. Se recorta alrededor del tronco para dejar zona permeable sobre las raíces; la posición del árbol es aproximada.',
    },
    {
      id: 'solera-sol-invierno', label: 'Solera del sol de invierno (entrada)', rect: SOL_INV, joints: 2.2, top: SOL_TOP, status: 'propuesto',
      note: 'Indicación de la propiedad: a la derecha de la puerta de entrada, mirando la fachada, una pequeña zona de solera con un banco de obra pegado a la pared para tomar el sol en la época de frío. El frontal B mira al sur-suroeste: en invierno recibe sol casi todo el día y el muro de 0,60 m guarda calor. De cemento claro, como la solera en L, delante de la puerta de entrada (un solo escalón de 0,18 m hasta el interior), unida al paseo y continua con el tramo del algarrobo (propiedad: «la solera delantera la juntaría con la del algarrobo»), 2,40 m de fondo. Medidas propuestas.',
    },
    {
      id: 'solera-l-frontal-a', label: 'Solera en L · tramo del frontal A (cristalera)', rect: [0, r2(-SOL_TRASERA), L, 0], joints: 3.3, top: SOL_TOP, status: 'confirmado',
      note: 'Solera a lo largo de todo el frontal A, de punta a punta de la casa, con el porche delante de la cristalera (indicaciones de la propiedad: «en la parte de la cristalera pon la solera y un porche» y «la solera de punta a punta de la casa y elimina la solera de la parte de la puerta de entrada»). Cemento claro mate, mismo nivel que el tramo lateral, con el que se une en la esquina del algarrobo. Fondo de 3,40 m propuesto; juntas cada ≈3,3 m; pendiente del 1,5–2 % hacia fuera y canaleta en el borde (propuesta de evacuación, pendiente de desarrollo técnico).',
    },
  ],
  // cuarto técnico previsto por la propiedad: 2,50 m × el ancho de la casa × 3,00 m de alto, con acceso solo por el exterior
  annexes: [
    {
      id: 'cuarto-tecnico', label: 'Cuarto técnico y lavadero', rect: [-2.5, 0, 0, W], height: r2(PB_EL + ALTELL - 0.05), wall: 0.3,
      door: { side: 'y1', at: -1.3, width: 0.9, height: 2.1 }, status: 'confirmado',
      terrace: { parapet: 1.0, label: 'Terraza del altell', status: 'propuesto' },
      hatches: [{
        id: 'registro-fosa-pluviales', label: 'Registro del aljibe de pluviales (fosa recuperada)', c: [-0.55, 0.85], size: 0.6, status: 'propuesto',
        note: 'Propuesta (propiedad, 14/10/2026): recuperar la fosa séptica que hay bajo el baño actual como aljibe de agua de lluvia para riego y jardín, con el acceso fuera de la vivienda, en el cuarto técnico: tapa de registro estanca de ≈60 × 60 cm junto al lateral de la casa, con la bomba sumergible, el filtro y la salida al riego por goteo en el propio cuarto. Posición, medidas, capacidad y estado de la fosa SIN COMPROBAR: hay que localizarla, vaciarla con gestor autorizado, limpiarla, desinfectarla y probar la estanqueidad; anular la entrada de aguas negras; prever filtro en la bajante, rebosadero al terreno y rejilla antimosquitos. El suelo de la casa sobre la fosa necesita losa calculada por el técnico. Agua no potable.',
      }],
      note: 'Previsto por la propiedad: 2,50 m de fondo por el ancho total de la casa (5,22 m); con la cubierta 5 cm por debajo del suelo del altell para que la terraza quede enrasada con él (con el interior elevado 0,36 m, ≈3,11 m de alto), con acceso por el exterior. Colocado en el lateral izquierdo (el derecho lo ocupan el algarrobo y el comedor): posición a confirmar. Interior ≈2,20 × 4,62 m para lavadora, termo o aerotermia, cuadro eléctrico y almacén. Puerta exterior de 0,90 m hacia el lado de la entrada (posición propuesta).',
    },
  ],
  // jardín seco delante de la fachada de la entrada, hasta los primeros olivos (propiedad; referencia «11 plantes qui
  // prospèrent en sol sec sans arrosage»), con paseos de losas de cemento hasta las dos puertas del frontal B
  garden: {
    id: 'jardin-seco', label: 'Jardín seco de la entrada', rect: [-0.5, r2(W + 0.5), 16.8, 11.5], status: 'propuesto',
    clearings: [SOL_INV],
    paths: [
      { id: 'paseo-entrada', label: 'Paseo de losas a la puerta de entrada', x: r2(X_PUERTA + 0.6), width: 1.1, y0: r2(SOL_INV[3] + 0.05), y1: 11.5, slab: 0.45, gap: 0.12 },
      { id: 'paseo-bano', label: 'Paseo de losas a la puerta del baño', x: r2(DUCHA_PUERTA_X0 + 0.35), width: 0.7, y0: r2(W + 0.08), y1: 11.5, slab: 0.4, gap: 0.14 },
    ],
    species: [
      { id: 'lavanda', label: 'Lavanda', h: 0.55, d: 0.75, band: 0.1, color: '#8a74c4' },
      { id: 'stipa', label: 'Stipa tenuissima', h: 0.55, d: 0.55, band: 0.35, color: '#d9c58f' },
      { id: 'agapanto', label: 'Agapanto', h: 0.8, d: 0.6, band: 0.5, color: '#5f7fd8' },
      { id: 'gaura', label: 'Gaura lindheimeri', h: 0.9, d: 0.7, band: 0.65, color: '#f1ece6' },
      { id: 'perovskia', label: 'Perovskia', h: 1.0, d: 0.8, band: 0.8, color: '#9aa6d6' },
      { id: 'verbena', label: 'Verbena de Buenos Aires', h: 1.3, d: 0.5, band: 0.95, color: '#8b4fb8' },
    ],
    note: 'Jardín seco mediterráneo (xerojardinería) que no necesita riego una vez arraigado: lavanda y Stipa tenuissima junto a la fachada y los caminos, agapanto y gaura en medio y perovskia y verbena de Buenos Aires al fondo, hacia los olivos, en grupos que se repiten. Acolchado de grava sobre tierra drenante. Dos paseos de losas de cemento con juntas de grava: uno a la puerta de entrada (losas de 1,10 × 0,45 m) y otro a la puerta de vidrio del baño (0,70 × 0,40 m), para salir de la ducha al jardín. Distribución orientativa: la plantación concreta la decide quien la ejecute.',
  },
  porches: [
    {
      id: 'porche-cristalera', label: 'Porche de la cristalera', rect: [PORCHE_X0, r2(-SOL_TRASERA + 0.2), L, 0], wallSide: 'y1', hWall: r2(PB_EL + 3.15 + 0.3), hFront: r2(PB_EL + 3.15 + 0.05),
      posts: [0.4, 3.5, 6.6, 9.85, 13.1, 16.1].map((x) => [x, r2(-SOL_TRASERA + 0.4)] as Vec2), postSize: 0.4, status: 'confirmado',
      note: 'Porche mediterráneo a lo largo de toda la solera del frontal A, desde el ventanal hasta el dormitorio (indicaciones de la propiedad: porche en la cristalera y «el porche lo haremos de toda la solera, hasta la habitación»): pilares de obra encalados de 40 × 40 cm, viga de madera en el frente y durmiente en la fachada por encima del dintel del ventanal (3,15 m sobre el suelo interior, 3,51 m sobre el terreno), viguetas cada ≈0,6 m y cubierta de cañizo. Medidas, sección de las vigas y anclaje a la fachada propuestos: pendientes de cálculo. Con el norte de la captura de Mapas de Apple (≈22° desde el frontal A), la cristalera mira al nor-noreste: le da el sol de primera hora en verano y casi nada el resto del día, así que el porche sirve sobre todo de estancia exterior a la sombra en las tardes; la entrada (frontal B) mira al sur-suroeste.',
    },
  ],
  furniture: [
    // decoración de la entrada (propuesta, como en la referencia de calidad): no es una decisión del proyecto
    ...[r2(X_PUERTA - 0.5), r2(X_PUERTA + 1.2 + 0.5)].map((x, i) => f({ id: `maceta-entrada-${i + 1}`, type: 'maceta', label: 'Tinaja de barro con olivo (decoración propuesta)', roomId: 'exterior', x, y: r2(W + 0.45), w: 0.62, d: 0.62, h: 1.55, rot: 0, status: 'propuesto', note: 'Decoración propuesta junto a la puerta de entrada; se puede quitar.' })),
    ...[r2(X_PUERTA - 0.3), r2(X_PUERTA + 1.2 + 0.3)].map((x, i) => f({ id: `aplique-entrada-${i + 1}`, type: 'aplique', label: 'Aplique exterior (propuesta)', roomId: 'exterior', x, y: r2(W + 0.07), w: 0.14, d: 0.14, h: 2.25, rot: 0, status: 'propuesto', note: 'Luz cálida a ambos lados de la entrada (propuesta; ubicación y modelo por decidir).' })),
    // banco de obra contra el frontal B en la solera del sol de invierno (propiedad)
    f({ id: 'banco-sol', type: 'banco', label: 'Banco de obra al sol (frontal B)', roomId: 'exterior', x: r2((X_PUERTA + 2.0 + 15.6) / 2), y: r2(W + 0.23), w: r2(15.6 - X_PUERTA - 2.0), d: 0.46, h: 0.45, rot: 0, status: 'propuesto',
      note: 'Banco corrido de obra encalado, pegado a la fachada de la entrada, con asiento de 0,45 m de fondo y alto y remate de piedra o terracota; para tomar el sol de invierno (indicación de la propiedad). Deja libre la tinaja junto a la puerta.' }),
    f({ id: 'mesa-exterior', type: 'mesa-exterior', label: 'Mesa redonda Ø 1,80', roomId: 'exterior', x: MESA_EXT[0], y: MESA_EXT[1], w: 1.8, d: 1.8, h: 0.75, rot: 0, status: 'propuesto', note: 'Mesa circular de tablero mineral claro grueso (≈10 cm) sobre pie central cilíndrico (referencia 11). Ocho plazas; diámetro orientativo.' }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return f({ id: `silla-exterior-${i + 1}`, type: 'silla-exterior', label: 'Silla plegable de bistró', roomId: 'exterior', x: r2(MESA_EXT[0] + Math.cos(a) * 1.18), y: r2(MESA_EXT[1] + Math.sin(a) * 1.18), w: 0.44, d: 0.48, h: 0.82, rot: r2((Math.atan2(Math.cos(a), Math.sin(a)) * 180) / Math.PI + 180), status: 'propuesto' });
    }),
  ],
  lights: [],
  domeLamp: {
    c: MESA_EXT, bottom: 1.95, diameter: 0.6, treeAnchor: { c: [r2(MESA_EXT[0] - 0.2), r2(MESA_EXT[1] + 1.0)], h: 3.4 },
    post: [r2(MESA_EXT[0] + 1.75), r2(MESA_EXT[1] - 0.35)], status: 'propuesto',
    note: 'Cúpula grande de metal oscuro centrada sobre la mesa, luz cálida regulable (referencia 11). Suspensión desde una rama del algarrobo o desde un pie independiente: el anclaje está SIN RESOLVER (resistencia de la rama, crecimiento, viento y alimentación eléctrica exterior por comprobar).',
  },
  // depósito de agua potable (presupuesto Hidroserver PN20260783, 13/10/2026): ubicación propuesta, a confirmar
  tanks: [
    {
      id: 'deposito-agua-potable', label: 'Depósito enterrado de agua potable', c: [-6.0, r2(W / 2)], axis: 'y',
      diameter: 2.45, length: 2.94, capacity: 12000, manhole: 0.6, cover: 0.5, status: 'propuesto',
      note: 'Depósito horizontal para enterrar DE12000 de Hidroserver (presupuesto PN20260783): 12.000 l, Ø 2,45 m × 2,94 m, poliéster reforzado con fibra de vidrio y resina alimentaria, boca de hombre superior de 600 mm con «T» de venteo. Ubicación propuesta junto al cuarto técnico (lado izquierdo), a ≈2,3 m de su cimentación (fuera de las cotas y con sitio para la excavación), para llevar la tubería a la bomba y al termo; a confirmar sobre el terreno según el pozo, el acceso del camión y la grúa (la descarga es a pie de transporte) y las instrucciones de enterrado del fabricante. Tierra encima ≈0,50 m propuesta.',
    },
  ],
  drains: [
    { id: 'rigola-frontal-a', a: [0.3, r2(-SOL_TRASERA + 0.15)], b: [r2(L + SOL_LATERAL - 0.15), r2(-SOL_TRASERA + 0.15)], status: 'propuesto', note: 'Canaleta lineal en el borde exterior del tramo del frontal A; pendiente del 1,5–2 % desde la fachada.' },
    { id: 'rigola-lateral', a: [r2(L + SOL_LATERAL - 0.15), r2(-SOL_TRASERA + 0.3)], b: [r2(L + SOL_LATERAL - 0.15), r2(W - 0.15)], status: 'propuesto', note: 'Canaleta en el borde exterior del tramo lateral, hacia el terreno (lejos del alcorque).' },
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
  view({ id: 'v04-solera', label: '4 · Solera completa en L', group: 'exterior', position: [-3.8, -10.5, 4.4], target: [11, -0.8, 0], fov: 46 }),
  view({ id: 'v05-algarrobo', label: '5 · Mesa y lámpara bajo el algarrobo', group: 'exterior', position: [14.6, -8.2, 1.6], target: [MESA_EXT[0] + 0.3, MESA_EXT[1] + 1.0, 1.5], fov: 56 }),
  view({ id: 'v06-desde-comedor', label: '6 · La casa desde el comedor exterior', group: 'exterior', position: [21.4, -5.4, 1.6], target: [10, -0.6, 2.2], fov: 56 }),
  view({ id: 'v06b-deposito', label: '6b · Cuarto técnico y depósito de agua', group: 'exterior', position: [-15.8, 9.4, 4.6], target: [-4.4, 2.0, 0.6], fov: 50 }),
  view({ id: 'v00-interior-cenital', label: 'Interior · vista cenital 3D', group: 'interior', topDown: true, position: [8.2, 5.6, 19.5], target: [8.2, 2.5, 0], fov: 44 }),
  view({ id: 'v07-salon-ventanal', label: '7 · Salón: sofá de obra y ventanal', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: PB_EL, position: [12.3, 1.2, 1.6], target: [15.4, 3.9, 0.7], fov: 66 }),
  view({ id: 'v07b-fuego', label: '7b · Rincón de la cristalera (estufa, chimenea o comedor)', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: PB_EL, position: [12.7, 2.15, 1.6], target: [16.0, 1.15, 1.25], fov: 62 }),
  view({ id: 'v08-ventanal-cocina', label: '8 · Del ventanal hacia cocina e isla', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: PB_EL, position: [12.4, 0.8, 1.6], target: [9.2, 3.6, 1.0], fov: 60 }),
  view({ id: 'v09-cocina-taburetes', label: '9 · Cocina desde el lado de los taburetes', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: PB_EL, position: [10.3, 0.7, 1.6], target: [8.9, 3.2, 0.75], fov: 56 }),
  view({ id: 'v10-cocina-encimera', label: '10 · Isla desde la cocina', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: PB_EL, position: [10.35, 3.75, 1.6], target: [8.7, 1.4, 0.7], fov: 58 }),
  view({ id: 'v10b-cocina-escalera', label: '10b · Cocina bajo la escalera', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: PB_EL, position: [10.2, 3.5, 1.6], target: [7.2, 3.6, 0.8], fov: 64 }),
  view({ id: 'v10c-comedor', label: '10c · Mesa de comedor para 4', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: PB_EL, position: [13.9, 1.0, 1.6], target: [11.1, 1.9, 0.75], fov: 60 }),
  view({ id: 'v11-dormitorio', label: '11 · Dormitorio', group: 'interior', eyeLevel: true, roomId: 'dormitorio', elevation: PB_EL, position: [3.45, 0.7, 1.6], target: [1.8, 3.9, 0.9], fov: 60 }),
  view({ id: 'v12-bano-entrada', label: '12 · Baño desde la entrada', group: 'interior', eyeLevel: true, roomId: 'bano', elevation: PB_EL, position: [5.5, 2.05, 1.6], target: [4.7, 4.6, 1.05], fov: 72 }),
  view({ id: 'v12b-bano-ducha', label: '12b · Baño desde la ducha (duchas enfrentadas)', group: 'interior', eyeLevel: true, roomId: 'bano', elevation: PB_EL, position: [5.05, 4.25, 1.6], target: [5.05, 1.6, 1.2], fov: 66 }),
  view({ id: 'v12d-puerta-ducha', label: '12d · Puerta de vidrio desde la ducha', group: 'interior', eyeLevel: true, roomId: 'bano', elevation: PB_EL, position: [5.2, 3.55, 1.6], target: [5.75, 5.0, 1.05], fov: 78 }),
  view({ id: 'v12c-celosia', label: '12c · Detalle de la celosía', group: 'interior', eyeLevel: true, roomId: 'bano', elevation: PB_EL, position: [4.75, 2.3, 1.6], target: [4.25, 3.6, 1.15], fov: 52 }),
  view({ id: 'v13-altell', label: '13 · Altell, vigas cemento y volta terracota', group: 'interior', eyeLevel: true, roomId: 'altell', elevation: r2(PB_EL + ALTELL), position: [4.9, 2.46, 1.6], target: [12, 2.46, 1.6], fov: 64 }),
  view({ id: 'v13b-volta', label: '13b · Vigas y volta desde la zona de día', group: 'interior', eyeLevel: true, roomId: 'dia', elevation: PB_EL, position: [12.2, 2.7, 1.6], target: [10.2, 2.46, 5.6], fov: 60 }),
  view({ id: 'v14-sin-cubierta', label: '14 · Vista sin cubierta', group: 'exterior', hideRoof: true, position: [9.2, 12, 25], target: [9.2, 3.2, 0], fov: 40 }),
  view({ id: 'v18-terraza-altell', label: '18 · Terraza del altell sobre el cuarto técnico', group: 'exterior', position: [-5.6, -2.6, 8.2], target: [-0.6, 2.6, 3.2], fov: 52 }),
  view({ id: 'v17-cuarto-tecnico', label: '17 · Cuarto técnico y terraza del altell', group: 'exterior', position: [-8.2, 8.6, 1.7], target: [-2.4, 3.0, 1.7], fov: 50 }),
  view({ id: 'v16-porche', label: '16 · Porche y solera de la cristalera', group: 'exterior', position: [4.4, -7.2, 1.6], target: [12.5, -1.0, 2.0], fov: 58 }),
  view({ id: 'v15-corte', label: '15 · Corte longitudinal', group: 'exterior', position: [8.9, -22, 3.4], target: [8.9, 2.46, 3.1], fov: 34, section: true }),
  ...VISTAS_DRON.map(view),
];

// ---------- referencias de diseño (fotos adjuntadas por la propiedad; los enlaces solo indican la procedencia) ----------
const REF_META: Record<string, [string | undefined, string[]]> = {
  'ref-cocina': ['01', ['v09-cocina-taburetes', 'v10-cocina-encimera', 'v10b-cocina-escalera']], 'ref-puerta': ['02', ['v03-entrada', 'v02-fachada-delantera']], 'ref-salon': ['03', ['v07-salon-ventanal']],
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
  // la solera antigua del frontal B se elimina: la solera en L del proyecto va por el frontal A y el lateral
  site: { ...PARCELA, pavements: [], trees: PARCELA.trees.map((t) => (t.id === 'algarrobo' ? { ...t, c: ALGARROBO } : t)) },
  version: '1.0 · bocetos, respuestas, fotos de la parcela, informe (16,33 × 5,22 m) y referencias de diseño',
  levels: [
    { id: 'pb', name: 'Planta baja', elevation: PB_EL, wallHeight: H_PB, elevationStatus: 'documentado' },
    { id: 'altell', name: 'Altell', elevation: r2(PB_EL + ALTELL), wallHeight: r2(H_TOTAL - PB_EL - ALTELL), elevationStatus: 'documentado' },
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
      id: 'escalera', fromLevel: 'pb', toLevel: 'altell', rect: ESC, up: '+y', upStatus: 'documentado', winderEnd: 0.65, openUnderFrom: ESC_HUECO, risers: 15, status: 'interpretado', sourceId: S.planta,
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
    { label: 'Altura del altell (sección)', items: [{ source: 'Propiedad', value: '2,50 m libres por planta + forjado 0,30 m' }, { source: 'Propiedad', value: 'Coronación 6,00 m sobre el terreno; interior elevado 0,36 m' }], status: 'interpretado', note: 'Suelo de planta baja a +0,36 (interior elevado) y suelo del altell a +3,16 sobre el terreno (2,80 m sobre el suelo interior). Libre bajo cubierta: 6,00 − 3,16 − canto de cubierta (0,25) − flecha de la volta (0,10) ≈ 2,49 m en el centro y ≈2,39 m bajo las vigas: justo. Verificable en la vista «Corte longitudinal».' },
    { label: 'Superficie del altell', items: [{ source: 'Calculada sobre el modelo', value: '≈24,6 m² (5,70 × 4,32 m interior)' }], status: 'interpretado', note: 'Resultado del cálculo, no una medida tomada.' },
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
      note: 'Cubierta plana indicada por la propiedad, coronada a 6,00 m sobre el terreno (propiedad, 10/10/2026; los alzados del boceto marcaban 6,20 m), con el interior elevado 0,36 m. El informe del arquitecto describe una cubierta inclinada y el presupuesto PAC26-0052 una plana de viguetas con revoltón: pendiente de contrastar. No está validada técnicamente (pendientes, impermeabilización, desagües y cálculo).',
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
    {
      type: 'un-agua-teja', label: 'Teja a un agua: 6 m en el frontal A, 5 m en el de las puertas (variante)', pitchDeg: r2((Math.atan(1 / W) * 180) / Math.PI), overhang: 0.3, thickness: 0.25, eaves: { y0: 6.0, y1: 5.0 }, tiles: true, status: 'propuesto', sourceId: S.prop,
      note: 'Variante pedida por la propiedad: cubierta inclinada a un agua acabada en teja, con la parte alta (6,00 m) en el frontal A, el del ventanal, y la baja (5,00 m) en el frontal B, el de las dos puertas. Pendiente ≈19 % (≈11°) y vuelo de 0,30 m con canalón en el alero bajo. Los muros bajan a 4,75 m (alero bajo menos el canto de 0,25 m); el frontal A se recrece hasta el faldón y los laterales se cierran con hastiales. El techo interior de volta catalana sigue la pendiente. Consecuencias (con el interior elevado 0,36 m): en el altell la altura libre bajo las vigas iría de ≈2,30 m junto al frontal A a ≈1,40 m junto al frontal B, no cabe la puerta de la terraza ni las ventanas altas del frontal B. Variante descartada por la propiedad (techo horizontal). Pendiente: la teja árabe suele pedir más pendiente (≈30 %): con ≈19 % hace falta una lámina impermeable continua bajo la teja (o teja mixta/plana apta para baja pendiente) según el fabricante y el arquitecto; estructura del faldón sin calcular.',
      ceiling: { type: 'vuelta-catalana', spacing: 0.55, rise: 0.1, status: 'confirmado', note: 'Vigas color cemento y volta de terracota, siguiendo la pendiente de la cubierta.' },
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
    { id: 'altura', label: 'Altura total sobre el terreno', value: H_TOTAL, unit: 'm', decimals: 2, sourceId: S.prop, status: 'confirmado', note: '6,00 m sobre el terreno (propiedad, 10/10/2026). Los alzados del boceto marcaban «6\'20 METRES».' },
    { id: 'interior-elevado', label: 'Elevación del suelo interior', value: PB_EL, unit: 'm', decimals: 2, sourceId: S.prop, status: 'confirmado', note: 'El interior se eleva 0,36 m sobre el terreno (propiedad, 10/10/2026): escalones en las puertas exteriores.' },
    { id: 'cota-altell', label: 'Suelo del altell', value: ALTELL, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado', note: 'Primero «a 260 cm»; después «altura interior mínima de 2,50 m por piso» con forjado de 0,30 m → 2,80 m.' },
    { id: 'altura-libre', label: 'Altura libre mínima por planta', value: H_LIBRE, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado', note: '«Mínimo 2,50 m por piso» (propiedad).' },
    { id: 'canto-altell', label: 'Canto del forjado del altell', value: SLAB, unit: 'm', decimals: 2, sourceId: S.prop, status: 'documentado', note: '«Hazlo de 0,30 m» (propiedad).' },
    { id: 'obertura-7', label: 'Obertura del frontal A', value: 7, unit: 'm', decimals: 0, sourceId: S.fa, status: 'confirmado', note: '«OBERTURA 7 M» (planta) y «7 metres» (frontal A). Variante.' },
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
    { id: S.prop, label: 'Indicaciones de la propiedad (04/10/2026)', detail: 'Escalera al revés; entrada al baño desde el pasillo y armario al lado (después eliminado); 5 m de ancho; muros de 0,60 m (frontal B) y 0,30 m; armario empotrado; sofá y estufa; cocina con isla; dos duchas, inodoro y lavabo; doble altura y altell a 2,60 m; puerta de 70 cm; cubierta plana con vuelta catalana.' },
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
    { sourceId: S.planta, read: 'Rectángulo junto a la línea del pasillo (≈1,40 × 0,65)', interpreted: 'Armario que se abre desde el pasillo (propiedad); eliminado después por la propiedad.' },
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
    'Superficie construida de 79,48 m²: ¿qué parte del rectángulo de 16,33 × 5,22 m excluye el informe?',
  ],
  // norte a ≈22° en sentido horario desde el frontal A: brújula de la captura de Mapas de Apple de la propiedad
  northDeg: 22,
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
