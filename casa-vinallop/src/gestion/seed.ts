/**
 * Datos precargados de gestión: decisiones de la propiedad, fases propuestas y el presupuesto
 * PAC26-0052 tal como figura en el documento (oferta recibida, no aceptada ni pagada).
 *
 * Fechas, responsables, proveedores e importes que no constan quedan vacíos (pendientes).
 * No se incluyen datos de contacto del proveedor ni datos personales del cliente.
 */
import type { Capitulo, Decision, EntregaCuenta, Fase, GestionData, Oferta, Partida, Seguimiento } from './types';

// ---------------------------------------------------------------- decisiones

const dec = (id: string, elemento: string, estancia: string, opcion: string, alternativas: string, estado: Decision['estado'], notas = ''): Decision =>
  ({ id, elemento, estancia, opcion, alternativas, estado, fecha: '', notas });

/** Decisión sobre la fosa existente (también se incorpora a los datos ya guardados). */
export const DECISION_FOSA = (): Decision => dec('d-fosa-pluviales', 'Fosa séptica existente (bajo el baño actual)', 'Cuarto técnico / exterior',
  'Recuperarla como aljibe de agua de lluvia para riego y jardín, con el registro, la bomba y el filtro en el cuarto técnico',
  'Anularla (vaciar, limpiar y rellenar con grava compactada) y recoger la lluvia en un depósito exterior o llevar las bajantes al jardín', 'elegido por propiedad',
  'Propuesta de la propiedad (14/10/2026). Depende de la inspección: posición, medidas, capacidad, estado y estanqueidad, y de poder sacar el registro al cuarto técnico. El suelo de la casa sobre la fosa necesita losa calculada por el técnico. Si ahora recibe las aguas del baño, el baño nuevo necesita otra salida (fosa nueva PAC-09, 3.200 €, no seleccionada). Consultar el trámite para anular o cambiar el uso de la fosa. Agua solo para riego (no potable).');

/** Puerta de la finca (también se incorpora a los datos ya guardados). */
export const DECISION_PUERTA_FINCA = (): Decision => dec('d-puerta-finca', 'Puerta de la entrada de la finca', 'Exterior · entrada de la finca',
  'Barrera tradicional de dos hojas de madera de acebuche con largueros ondulados y tornapunta en diagonal, entre dos pilares de piedra (marès) y con pared seca a los lados',
  '', 'elegido por propiedad',
  'Referencia aportada por la propiedad (16/10/2026). Hueco de 4,70 m: dos hojas de ≈2,35 m. Pendiente: carpintero, madera, herrajes y cerradura, cimentación de los pilares y presupuesto. Dibujada en el modelo en la entrada de la finca.');

/** Comprobaciones previas de la fosa (fase 2). */
export const TAREAS_FOSA: [string, string][] = [
  ['t-fosa-1', 'Localizar la fosa existente bajo el baño actual y medirla (planta, profundidad y capacidad)'],
  ['t-fosa-2', 'Vaciarla con gestor autorizado, limpiarla, desinfectarla y comprobar su estado y estanqueidad'],
  ['t-fosa-3', 'Decidir: aljibe de pluviales con registro en el cuarto técnico, o anularla'],
  ['t-fosa-4', 'Resolver la salida de aguas residuales del baño nuevo (fosa nueva u otra solución autorizada)'],
];

function decisiones(): Decision[] {
  return [
    dec('d-vigas', 'Techo · vigas', 'Interior', 'Vigas vistas color cemento, gris natural mate', '', 'elegido por propiedad'),
    dec('d-volta', 'Techo · volta catalana', 'Interior', 'Volta catalana color terracota entre vigas', '', 'elegido por propiedad'),
    dec('d-cubierta', 'Cubierta exterior', 'Exterior', 'Apariencia de cubierta plana ibicenca con remate blanco', 'Cubierta inclinada del informe (panel sándwich)', 'pendiente de arquitecto',
      'El presupuesto PAC26-0052 propone cubierta plana de hormigón y revoltón; el informe, inclinada: discrepancia a coordinar.'),
    dec('d-ventanal', 'Ventanal fachada A', 'Fachada A', 'Abertura de 9 m (solicitada; presupuestada con zuncho 40×70 cm)', '7 m según bocetos', 'pendiente de arquitecto'),
    dec('d-duchas', 'Baño', 'Baño', 'Dos duchas enfrentadas (rociadores en paredes opuestas, mandos independientes)', '', 'elegido por propiedad'),
    dec('d-separacion', 'Separación de ducha', 'Baño', '', 'Celosía A (patrón fino) / Celosía B (huecos cuadrados) + vidrio fijo y cortina (propuesta)', 'por comparar'),
    dec('d-lamparas', 'Lámparas interiores', 'Interior', '', 'A (barro) / B (terracota clara); ubicación sobre la isla o sobre la mesa', 'por comparar'),
    dec('d-solera', 'Solera exterior', 'Exterior', 'Solera continua de cemento en L: frontal A (cristalera, con porche) de punta a punta y lateral del algarrobo; sin solera en la entrada (frontal B). Fondos propuestos 3,40 m / 4 m', '', 'elegido por propiedad'),
    dec('d-comedor-ext', 'Comedor exterior', 'Exterior', 'Mesa circular de tablero mineral grueso con pie cilíndrico y lámpara metálica oscura de cúpula bajo el algarrobo', '', 'elegido por propiedad'),
    dec('d-puerta', 'Puerta de entrada', 'Entrada', 'Tablones verticales de madera natural en hueco profundo', '', 'por comparar', 'Marcos verde-gris claro confirmados anteriormente por la propiedad.'),
    dec('d-saliente', 'Volumen saliente de entrada', 'Entrada', '', '', 'por comparar'),
    dec('d-planta', 'Planta decorativa del comedor', 'Comedor', 'Eliminada a petición de la propiedad', '', 'elegido por propiedad'),
    dec('d-aberturas', 'Aberturas adicionales (variantes)', 'Varias', '',
      'Acceso acristalado al comedor exterior; ventana de ventilación cruzada; ventana y contraventana en dormitorio; ventana alta en baño + extracción; abertura alta en altillo', 'por comparar'),
    DECISION_FOSA(),
    DECISION_PUERTA_FINCA(),
  ];
}

// ---------------------------------------------------------------- presupuesto

export const CAP = {
  honorarios: 'cap-honorarios',
  amianto: 'cap-amianto',
  demoliciones: 'cap-demoliciones',
  estructura: 'cap-estructura',
  cubierta: 'cap-cubierta',
  fachadas: 'cap-fachadas',
  electricidad: 'cap-electricidad',
  agua: 'cap-agua',
  bano: 'cap-bano',
  cocina: 'cap-cocina',
  pavimentos: 'cap-pavimentos',
  mobiliario: 'cap-mobiliario',
  exterior: 'cap-exterior',
  reserva: 'cap-reserva',
} as const;

function capitulos(): Capitulo[] {
  return [
    { id: CAP.honorarios, nombre: 'Honorarios técnicos y tramitación' },
    { id: CAP.amianto, nombre: 'Comprobaciones y gestión de fibrocemento/amianto' },
    { id: CAP.demoliciones, nombre: 'Demoliciones, protecciones y residuos' },
    { id: CAP.estructura, nombre: 'Consolidación y estructura' },
    { id: CAP.cubierta, nombre: 'Cubierta, aislamiento e impermeabilización' },
    { id: CAP.fachadas, nombre: 'Fachadas y carpinterías' },
    { id: CAP.electricidad, nombre: 'Electricidad, iluminación, domótica, seguridad y audio' },
    { id: CAP.agua, nombre: 'Agua, saneamiento y ventilación' },
    { id: CAP.bano, nombre: 'Baño y dos duchas' },
    { id: CAP.cocina, nombre: 'Cocina e isla' },
    { id: CAP.pavimentos, nombre: 'Pavimentos, revestimientos y pintura' },
    { id: CAP.mobiliario, nombre: 'Mobiliario y equipamiento' },
    { id: CAP.exterior, nombre: 'Solera en L, drenaje y comedor exterior' },
    { id: CAP.reserva, nombre: 'Reserva para imprevistos', reserva: true },
  ];
}

export const PAC_REF = 'PAC26-0052';
export const PAC_PROVEEDOR = 'Aconseguit Angamar S.L.';
export const PAC_FECHA = '2026-05-26';
export const FASE_PAC = 'f-pac26';
export const FASE_PENDIENTE = 'f-pendiente';
export const SOLERA_CODIGO = 'SOL-01';
export const DEP_CODIGO = 'DEP-01';
export const DEP_REF = 'PN20260783';
export const DEP_PROVEEDOR = 'Hidroserver Ingeniería y Tratamientos del Agua S.L.';
export const DEP_FECHA = '2026-10-13';
export const DEP_DOCUMENTO = { id: 'doc-pn20260783', titulo: `Presupuesto ${DEP_REF} · depósito de agua potable`, referencia: `${DEP_PROVEEDOR} · documento PDF de la propiedad`, fecha: DEP_FECHA, nota: 'Oferta recibida, no aceptada ni pagada.' };

const pac = (n: number, descripcion: string, capitulo: string, precio: number, fase: string, notas = ''): Partida => ({
  id: `p-pac-${String(n).padStart(2, '0')}`,
  codigo: `PAC-${String(n).padStart(2, '0')}`,
  descripcion, capitulo, fase,
  cantidad: 1, unidad: 'PA', precio,
  proveedor: PAC_PROVEEDOR, referencia: PAC_REF,
  contratado: null, extras: null, real: null, pagos: [],
  notas,
  origenPrecio: `Presupuesto ${PAC_REF} (importe sin descuento ni IVA)`,
  fechaPrecio: PAC_FECHA,
  condicion: 'oferta recibida',
  impuesto: 21,
  base: null,
  ...(fase === FASE_PENDIENTE ? { noSeleccionada: true } : {}),
});

/** Partidas añadidas por la propiedad después del presupuesto (también se incorporan a los datos ya guardados). */
// ---------------------------------------------------------------- fase 2 (propiedad, 22/10/2026)

export const FASE_2 = 'f-fase2';
export const FASE1_FIN = '2026-12-20';
const f2 = (n: number, descripcion: string, capitulo: string, precio: number | null, notas: string): Partida => ({
  id: `p-f2-${String(n).padStart(2, '0')}`, codigo: `F2-${String(n).padStart(2, '0')}`,
  descripcion, capitulo, fase: FASE_2,
  cantidad: 1, unidad: 'PA', precio,
  proveedor: '', referencia: '', contratado: null, extras: null, real: null, pagos: [],
  notas,
  origenPrecio: precio == null ? '' : 'Importe hablado, indicado por la propiedad (22/10/2026)', fechaPrecio: precio == null ? '' : '2026-10-22',
  condicion: 'estimación', impuesto: null, base: null,
});
/** Partidas de la fase 2 indicadas por la propiedad: solo lleva importe la caseta (8.000 €, IVA y proveedor sin indicar). */
export const FASE2_PARTIDAS = (): Partida[] => [
  f2(1, 'Caseta del cuarto técnico (cuarto de máquinas) con terraza del altell encima', CAP.estructura, 8000,
    'Importe hablado: 8.000 €. Sin oferta escrita: falta proveedor, alcance (cimentación, muros, cubierta-terraza, puertas, instalaciones interiores, cajón del generador…) y si el importe lleva IVA.'),
  { ...f2(2, 'Sanear la fosa séptica actual y transformarla en aljibe de pluviales (vaciado por gestor autorizado, limpieza, desinfección, prueba de estanqueidad, anular la entrada de aguas negras, registro, filtro, rebosadero y bomba)', CAP.agua, PEB_F202.precio,
    `${PEB_F202.notas} Antes: localizar y medir la fosa. Recibe la cadena de lluvia de la esquina del cuarto técnico. Agua no potable (riego y jardín).`),
    proveedor: PEB_PROVEEDOR, referencia: PEB_REF, origenPrecio: `Presupuesto ${PEB_REF} (importe sin IVA)`, fechaPrecio: PEB_FECHA, condicion: 'oferta recibida', impuesto: 21 },
  f2(3, 'Mini vinoteca en el hueco que hay en la cocina', CAP.cocina, null,
    'Sin valorar. Falta medir el hueco (planta y profundidad) y definir acabado, puerta y si lleva climatización.'),
];
export const FASE2_TAREAS: [string, string][] = [
  ['F2-01', 'Caseta del cuarto técnico: alcance, oferta escrita y obra'],
  ['F2-02', 'Fosa séptica: vaciar, sanear y convertir en aljibe de pluviales'],
  ['F2-03', 'Mini vinoteca en el hueco de la cocina'],
];
export const FASE2 = (): Fase => ({
  id: FASE_2, nombre: 'Fase 2 · Caseta técnica, aljibe de pluviales y vinoteca',
  descripcion: 'Segunda fase indicada por la propiedad (22/10/2026): caseta del cuarto técnico (8.000 €, importe hablado), sanear la fosa séptica actual y convertirla en aljibe de pluviales, y una mini vinoteca en el hueco de la cocina. Presupuesto PEB26-0001 (Ebrebuilding, 22/10/2026): fosa séptica nueva, recuperación de la fosa actual, escalera de hormigón y cimentación, muros y losa del porche.',
  tareas: [...FASE2_TAREAS, ...PEB_TAREAS].map(([codigo, texto], i) => ({ id: `${FASE_2}-t${i + 1}`, texto, hecha: false, partida: codigo })),
  dependencias: [FASE_PAC], requisitos: ['Fosa localizada, medida e inspeccionada antes de decidir el aljibe', 'Oferta escrita de la caseta con su alcance'],
  previstoInicio: '', previstoFin: '', realInicio: '', realFin: '', responsable: '', estado: 'sin empezar',
  documentos: [], observaciones: 'Empieza cuando termine la fase 1 (previsión de fin: 20/12/2026). Fechas sin fijar.', bloqueos: [], avisos: [], seguimiento: [],
});

// ---------------------------------------------------------------- presupuesto PEB26-0001 (fase 2)

export const PEB_REF = 'PEB26-0001';
export const PEB_PROVEEDOR = 'Ebrebuilding S.C.C.L. (Santa Bàrbara, Tarragona)';
export const PEB_FECHA = '2026-10-22';
const peb = (n: number, descripcion: string, capitulo: string, precio: number, notas = ''): Partida => ({
  id: `p-peb-${String(n).padStart(2, '0')}`, codigo: `PEB-${String(n).padStart(2, '0')}`,
  descripcion, capitulo, fase: FASE_2,
  cantidad: 1, unidad: 'PA', precio,
  proveedor: PEB_PROVEEDOR, referencia: PEB_REF, contratado: null, extras: null, real: null, pagos: [],
  notas: `Presupuesto ${PEB_REF}, línea ${n}.${notas ? ` ${notas}` : ''}`,
  origenPrecio: `Presupuesto ${PEB_REF} (importe sin IVA)`, fechaPrecio: PEB_FECHA,
  condicion: 'oferta recibida', impuesto: 21, base: null,
});
/** Partidas del presupuesto PEB26-0001 (la línea 3, fosa → aljibe, valora la partida F2-02 que ya existía). */
export const PEB_PARTIDAS = (): Partida[] => [
  peb(1, 'Hacer el hoyo y las zanjas para la fosa séptica nueva y los tubos de evacuación de aguas grises y negras', CAP.agua, 1300,
    'Fosa séptica nueva: la actual pasa a ser aljibe de pluviales. Ubicación de la fosa nueva sin definir.'),
  peb(2, 'Poner la fosa séptica nueva y los tubos de evacuación', CAP.agua, 3000,
    'Capacidad y modelo de la fosa no indicados en el presupuesto.'),
  peb(4, 'Escalera de hormigón armado, sin revestir, preparada para revestir de porcelánico, piedra o mármol', CAP.estructura, 3000,
    'Misma partida que PAC-12 del presupuesto PAC26-0052 (no seleccionada, 3.000 €): queda esa como referencia.'),
  peb(5, 'Zanjas y cimentación armada para los muros perimetrales de sobreelevación del porche', CAP.exterior, 1800,
    'Porche y solera elevada: comprobar qué parte de la solera en L (SOL-01, sin valorar) cubre.'),
  peb(6, 'Muros de la solera del porche', CAP.exterior, 1400),
  peb(7, 'Losa del porche', CAP.exterior, 1000),
];
export const PEB_F202 = { precio: 2400, notas: `Presupuesto ${PEB_REF}, línea 3: recuperación de la fosa séptica actual para convertirla en depósito de agua (2.400 € sin IVA). El presupuesto no detalla vaciado por gestor autorizado, desinfección, prueba de estanqueidad, registro, filtro, rebosadero ni bomba: aclarar el alcance.` };
export const PEB_TAREAS: [string, string][] = [
  ['PEB-01', 'Fosa séptica nueva: hoyo y zanjas de evacuación'],
  ['PEB-02', 'Colocar la fosa séptica nueva y los tubos'],
  ['PEB-04', 'Escalera de hormigón armado al altell'],
  ['PEB-05', 'Porche: zanjas y cimentación de los muros perimetrales'],
  ['PEB-06', 'Porche: muros de la solera'],
  ['PEB-07', 'Porche: losa'],
];
export const PEB_DOCUMENTO = { id: 'doc-peb26-0001', titulo: `Presupuesto ${PEB_REF} · fase 2`, referencia: `${PEB_PROVEEDOR} · documento PDF de la propiedad`, fecha: PEB_FECHA, nota: 'Oferta recibida, no aceptada ni pagada.' };
export const OFERTA_PEB = (): Oferta => ({
  id: 'o-peb26-0001', proveedor: PEB_PROVEEDOR, referencia: PEB_REF, fecha: PEB_FECHA,
  alcance: 'Fase 2: fosa séptica nueva con sus zanjas y tubos, recuperación de la fosa actual como depósito de agua, escalera de hormigón y cimentación, muros y losa del porche (7 líneas).',
  partidas: ['PEB-01', 'PEB-02', 'F2-02', 'PEB-04', 'PEB-05', 'PEB-06', 'PEB-07'],
  importeBase: null, descuentoPct: null, ajuste: null, ajusteNota: '', impuestoPct: 21, estado: 'recibida',
  documentos: [`Presupuesto ${PEB_REF} (${PEB_PROVEEDOR}, 22/10/2026)`],
  notas: 'Oferta recibida: no aceptada ni pagada. Base 13.900 €, IVA 21 % 2.919 €, total 16.819 €.',
  totalesImpresos: { subtotal: 13900, descuento: null, base: 13900, impuestos: 2919, total: 16819, nota: 'Totales impresos en el presupuesto.' },
  condiciones: '',
  avisos: [
    'No incluye la caseta del cuarto técnico (F2-01, 8.000 € hablados) ni la mini vinoteca (F2-03).',
    'La recuperación de la fosa actual no detalla vaciado por gestor autorizado, desinfección, prueba de estanqueidad, filtro, rebosadero ni bomba.',
  ],
});

export const ADDED_PARTIDAS = (): Partida[] => [
  {
    id: 'p-pac-04-1', codigo: 'PAC-04.1',
    descripcion: 'Ampliación de la partida de alzado de muros: recrecido de muros hasta 6,00 m',
    capitulo: CAP.estructura, fase: FASE_PAC,
    cantidad: 1, unidad: 'PA', precio: 2000,
    proveedor: PAC_PROVEEDOR, referencia: '', contratado: null, extras: null, real: null, pagos: [],
    notas: 'Se suma a PAC-04 (recrecido de muros, 4.500 €): +2.000 € para llegar a los 6,00 m de altura (indicación de la propiedad). El alzado de la casa de 36 cm va aparte, en PAC-11 (2.500 €). Importe sin IVA como el resto del presupuesto; pendiente de confirmación escrita del constructor.',
    origenPrecio: 'Indicación de la propiedad (10/10/2026)', fechaPrecio: '2026-10-10',
    condicion: 'estimación', impuesto: 21, base: null,
  },
  {
    id: 'p-zanja-pozo', codigo: 'ZAN-01',
    descripcion: 'Zanja y tubo para agua y electricidad desde el pozo y la caja eléctrica',
    capitulo: CAP.agua, fase: FASE_PAC,
    cantidad: 1, unidad: 'PA', precio: 3500,
    proveedor: '', referencia: '', contratado: null, extras: null, real: null, pagos: [],
    notas: 'Presupuesto pasado a la propiedad: 3.500 €. Incluye agua y electricidad (se anota en el capítulo de agua). Proveedor y si el importe lleva IVA, sin indicar: a completar.',
    origenPrecio: 'Presupuesto recibido por la propiedad (10/10/2026)', fechaPrecio: '2026-10-10',
    condicion: 'oferta recibida', impuesto: 21, base: null,
  },
  {
    id: 'p-deposito-agua', codigo: DEP_CODIGO,
    descripcion: 'Depósito horizontal para enterrar DE12000 para agua potable: 12.000 l, Ø 2,45 × 2,94 m, poliéster con fibra de vidrio y resina alimentaria, boca de hombre de 600 mm con «T» de venteo; portes a Tarragona incluidos',
    capitulo: CAP.agua, fase: FASE_PAC,
    cantidad: 1, unidad: 'ud', precio: 2282,
    proveedor: DEP_PROVEEDOR, referencia: DEP_REF, contratado: null, extras: null, real: null, pagos: [],
    notas: 'Solo suministro (depósito y portes). No incluye: descarga (es a pie de transporte: grúa o medios de descarga a cargo de la obra), excavación, cama o losa de apoyo, relleno, colocación, conexiones, bomba ni tratamiento del agua: costes pendientes de valorar. Pago: 50 % al confirmar el pedido y 50 % a la entrega. Garantía de 2 años por defectos de fabricación (no cubre una colocación incorrecta). Distinto de PAC-10 (cisterna de obra de 15 m³ para pluviales, no seleccionada).',
    origenPrecio: `Presupuesto ${DEP_REF} (importe sin IVA)`, fechaPrecio: DEP_FECHA,
    condicion: 'oferta recibida', impuesto: 21, base: null,
  },
];

/** Oferta del depósito de agua potable (también se incorpora a los datos ya guardados). */
export const OFERTA_DEPOSITO = (): Oferta => ({
  id: 'o-pn20260783',
  proveedor: DEP_PROVEEDOR,
  referencia: DEP_REF,
  fecha: DEP_FECHA,
  alcance: 'Suministro de un depósito horizontal para enterrar DE12000 (12.000 l) para agua potable, con portes a Tarragona incluidos.',
  partidas: [DEP_CODIGO],
  importeBase: null,
  descuentoPct: null,
  ajuste: null,
  ajusteNota: '',
  impuestoPct: 21,
  estado: 'recibida',
  documentos: [`Presupuesto ${DEP_REF} (${DEP_PROVEEDOR}, 13/10/2026) con hoja técnica del DE12000`],
  notas: 'Oferta recibida: no aceptada ni pagada. Plazo de suministro a convenir.',
  totalesImpresos: null,
  condiciones: 'Forma de pago: transferencia del 50 % a la confirmación del pedido y el 50 % restante a la entrega del equipo. Plazo de suministro: a convenir. Descarga de la mercancía: a pie de transporte. Garantía de dos años por defectos de fabricación, que no cubre una colocación incorrecta del depósito. Documentación: declaración de conformidad CE, ficha técnica, certificado de responsabilidad civil y registro sanitario.',
  avisos: [
    'Solo suministro: excavación, descarga con grúa, colocación, relleno, conexiones y bomba no están incluidos.',
    'La garantía no cubre una colocación incorrecta: enterrar siguiendo las instrucciones del fabricante.',
  ],
});

/** Tareas de la fase 1 para las partidas añadidas. */
export const ADDED_TAREAS: [string, string][] = [
  ['PAC-11', 'Alzado de la casa 36 cm (partida de 2.500 €: relleno interior y elevación)'],
  ['PAC-04.1', 'Recrecido de muros hasta 6,00 m (ampliación del alzado de muros, +2.000 €)'],
  ['ZAN-01', 'Zanja y tubo de agua y electricidad desde el pozo y la caja eléctrica'],
  [DEP_CODIGO, 'Depósito enterrado de agua potable de 12.000 l: pedido, excavación, descarga, colocación y conexión'],
];

function partidas(): Partida[] {
  return [
    pac(1, 'Demolición del techo actual y preparación para el nuevo', CAP.demoliciones, 1500, FASE_PAC,
      'Alcance de retirada de fibrocemento/amianto no especificado; requiere aclaración.'),
    pac(2, 'Demolición de muros para la abertura de 9 m y comunicación interior entrando por la puerta actual hacia la derecha', CAP.demoliciones, 1000, FASE_PAC),
    pac(3, 'Zuncho de 9 m, sección 40 × 70 cm con triple armado, conectado al cinturón de la casa (cinturón incluido)', CAP.estructura, 5000, FASE_PAC,
      'Característica estructural propuesta por el constructor, no cálculo validado.'),
    pac(4, 'Recrecido de muros con bloque de 20 cm hasta las alturas previstas, dejando huecos para ventanas y remate con cinturón de hormigón', CAP.estructura, 4500, FASE_PAC),
    // añadidos de la propiedad (10/10/2026) a la fase 1
    ...ADDED_PARTIDAS(),
    pac(5, 'Aberturas: además de la de 9 m, una ventana más en el comedor, una pequeña en el baño, dos en la habitación de abajo y dos en la de arriba', CAP.fachadas, 3700, FASE_PAC),
    pac(6, 'Cubierta plana con vigas de hormigón y revoltón cerámico terracota visto entre vigas (volta hacia arriba), relleno superior; obra básica, material y mano de obra', CAP.cubierta, 12000, FASE_PAC,
      'Difiere del informe de cubierta inclinada con panel sándwich; coordinar documentos antes de obras.'),
    pac(7, 'Perímetro de cubierta para recogida de aguas, impermeabilización y capa de mortero con pendientes; impermeabilización del mortero', CAP.cubierta, 7000, FASE_PAC),
    pac(8, 'Forjado (planxer) con vigas de madera y tablero de madera atornillado, sobre el baño, el futuro baño, la futura habitación y el pasillo', CAP.estructura, 3200, FASE_PAC),
    pac(9, 'Excavación y colocación de fosa séptica con desagüe y conexión de aguas grises (tubo de 110 preparado)', CAP.agua, 3200, FASE_PENDIENTE,
      'No seleccionada en el presupuesto: fase pendiente de asignar hasta confirmar.'),
    pac(10, 'Cisterna enterrada de 10 m² × 1,50 m (15 m³) con tapa a nivel, conexión de pluviales y cubos de polipropileno; montaje de bomba excluido', CAP.agua, 7000, FASE_PENDIENTE,
      'No seleccionada en el presupuesto: fase pendiente de asignar hasta confirmar. Montaje de bomba excluido.'),
    pac(11, 'Relleno interior con la tierra y piedra de la casa para elevar 15 cm y capa de hormigón de 6 cm', CAP.pavimentos, 2500, FASE_PAC,
      'No estaba seleccionada en el presupuesto. Según la propiedad (10/10/2026), esta partida de 2.500 € incluye el alzado de la casa de 36 cm y pasa a la fase 1. El documento habla de elevar 15 cm: aclarar con el constructor.'),
    pac(12, 'Escalera de hormigón sin revestir para conectar el altillo', CAP.estructura, 3000, FASE_PENDIENTE,
      'No seleccionada en el presupuesto: fase pendiente de asignar hasta confirmar.'),
    ...FASE2_PARTIDAS(),
    ...PEB_PARTIDAS(),
    {
      id: 'p-solera-l', codigo: SOLERA_CODIGO,
      descripcion: 'Solera continua de cemento en L (frontal A de punta a punta y lateral del algarrobo)',
      capitulo: CAP.exterior, fase: 'f08',
      cantidad: null, unidad: 'm²', precio: null,
      proveedor: '', referencia: '', contratado: null, extras: null, real: null, pagos: [],
      notas: 'Superficie calculada sobre el modelo: unión de tramos sin duplicar la esquina, alcorque descontado; medidas propuestas.',
      origenPrecio: '', fechaPrecio: '', condicion: 'estimación', impuesto: null, base: null,
      vinculo: 'solera-l-area',
    },
  ];
}

export const PAC_SELECCION = ['PAC-01', 'PAC-02', 'PAC-03', 'PAC-04', 'PAC-05', 'PAC-06', 'PAC-07', 'PAC-08'];
export const PAC_NO_SELECCION = ['PAC-09', 'PAC-10', 'PAC-12'];

function ofertas(): Oferta[] {
  return [{
    id: 'o-pac26-0052',
    proveedor: PAC_PROVEEDOR,
    referencia: PAC_REF,
    fecha: PAC_FECHA,
    alcance: 'Selección rodeada en el documento (8 partidas): demolición de techo y muros, zuncho de 9 m, recrecido de muros, aberturas, cubierta plana con revoltón, perímetro e impermeabilización de cubierta y forjado de madera.',
    partidas: [...PAC_SELECCION],
    importeBase: null,
    descuentoPct: 10,
    ajuste: -1110,
    ajusteNota: 'Ajuste anotado a mano (33.000 € + IVA) pendiente de confirmación escrita.',
    impuestoPct: 21,
    estado: 'recibida',
    documentos: [`Presupuesto ${PAC_REF} (${PAC_PROVEEDOR}, 26/05/2026), con nota manuscrita`],
    notas: 'Oferta recibida: no aceptada ni pagada. El descuento comercial del 10 % se aplica una sola vez sobre la selección; el ajuste a 33.000 € no lleva un segundo descuento.',
    totalesImpresos: {
      subtotal: 53600, descuento: 5360, base: 48240, impuestos: 10130.4, total: 58370.4,
      nota: 'Totales impresos del presupuesto completo (12 partidas, incluidas las 4 no seleccionadas por 15.700 €). Solo informativos: no se suman a la selección.',
    },
    condiciones: 'Gestión de residuos según el documento (texto para revisión técnica, no instrucciones de ejecución): «La piedra y la tierra de los muros se quedarán en el terreno; la tierra sobrante de la excavación para la fosa séptica y la cisterna también; solo se llevarán a vertedero controlado los elementos no naturales que no se puedan dejar en el terreno.»',
    avisos: [
      'La demolición del techo no incluye de forma especificada la retirada de amianto/fibrocemento: requiere aclaración.',
      'La cubierta plana propuesta difiere del informe (cubierta inclinada con panel sándwich): coordinar documentos antes de obras.',
      'El zuncho de 40 × 70 cm es una característica propuesta por el constructor, no un cálculo estructural validado.',
    ],
  }, OFERTA_DEPOSITO(), OFERTA_PEB()];
}

// ---------------------------------------------------------------- seguimiento de obra

export const SEGUIMIENTO_FECHA = '2026-10-21';
const seg = (n: number, partida: string, estado: Seguimiento['estado'], texto: string, motivo: string, fotos: string[]): Seguimiento => ({
  id: `seg-${SEGUIMIENTO_FECHA}-${String(n).padStart(2, '0')}`, fecha: SEGUIMIENTO_FECHA, texto, partida, motivo, estado, fotos: fotos.map((f) => `obra-${f}`),
});

/**
 * Fotos de la propiedad del 21/10/2026 (Referencias → «Situación de la obra»): qué se ve y a qué partida va.
 * Lo que no se puede confirmar con fotos queda «a comprobar»; no se anotan avances en % ni fechas de inicio.
 * Lo que no tenía partida (alicatados y chimenea antigua, placa ondulada del anexo, trozos grises del escombro) lo descartó la propiedad (21/10/2026).
 */
export const SEGUIMIENTO_DESCARTADO = ['06', '08', '09'].map((n) => `seg-${SEGUIMIENTO_FECHA}-${n}`);

export const SEGUIMIENTO_2026_10_21 = (): Record<string, Seguimiento[]> => ({
  [FASE_PAC]: [
    seg(1, 'PAC-01', 'en curso', 'Cubierta de la casa retirada en buena parte: tejas, tablero cerámico y aislamiento abajo; los muros quedan al aire.',
      'Demolición del techo actual (PAC-01).', ['01-cubierta-retirada', '12-ventana-escombro', '08-lateral', '15-retirada-escombro']),
    seg(2, 'PAC-01', 'en curso', 'Viguetas pretensadas: unas retiradas y acopiadas junto al frontal B; otras todavía apoyadas sobre los muros de mampostería.',
      'Son parte del techo actual que se demuele (PAC-01); la cubierta nueva lleva sus propias vigas (PAC-06).', ['01-cubierta-retirada', '04-acopio', '05-frontal-b-alto', '14-apoyo-viguetas']),
    seg(3, 'PAC-01', 'en curso', 'Escombro de la cubierta dentro de la casa y capazos llenos acopiados fuera.',
      'Residuos de la demolición del techo (PAC-01). Según el presupuesto, la piedra y la tierra se quedan en la finca y solo va a vertedero controlado lo que no es natural (tejas, ladrillo, aislamiento…).', ['15-retirada-escombro', '04-acopio', '12-ventana-escombro']),
    seg(4, 'PAC-01', 'a comprobar', 'Andamio montado en el frontal B.',
      'El presupuesto no tiene partida de medios auxiliares: se entiende incluido en los trabajos (demolición y después recrecido, PAC-04). A confirmar con el constructor.', ['05-frontal-b-alto', '06-frontal-b']),
    seg(5, 'PAC-01', 'a comprobar', 'Coronación del muro de la casa junto al anexo de los depósitos rota al desmontar la cubierta (mampostería al descubierto).',
      'Consecuencia de la demolición del techo (PAC-01); se rehace con el recrecido de muros y el cinturón de hormigón (PAC-04). Comprobar que no afecta al muro del anexo.', ['03-anexo-muro-roto', '10-anexo-desde-dentro']),
    seg(7, 'PAC-04', 'pendiente', 'Coronación de los muros a la vista, a la espera del recrecido con bloque y el cinturón de hormigón.',
      'Recrecido de muros (PAC-04 y su ampliación PAC-04.1, hasta 6,00 m). Con la zona de comedor más baja, desde el escalón los muros coronan a ≈4,61 m: revisar el alcance de PAC-04.1.', ['13-coronacion', '05-frontal-b-alto']),
    seg(10, 'PAC-11', 'en curso', 'Incremento de 36 cm del suelo interior (relleno con la tierra y la piedra de la casa y capa de hormigón).',
      'Indicado por la propiedad (21/10/2026), sin fotos. PAC-11 incluye el alzado de la casa de 36 cm (propiedad, 10/10/2026); el documento del presupuesto habla de elevar 15 cm: aclarar con el constructor.', []),
    seg(11, 'PAC-01', 'en curso', 'Vista de dron: retirada la cubierta de la parte central de la casa (muros al aire y escombro dentro); los dos extremos todavía conservan la cubierta de placa ondulada.',
      'Demolición del techo actual (PAC-01): falta retirar lo que queda en los extremos.', ['16-dron-cenital', '17-dron-cenital-2', '18-dron-alto', '19-dron-finca']),
  ],
});

/** Observación añadida después de la primera carga del seguimiento: alzado de 36 cm en curso. */
export const SEGUIMIENTO_ALZADO_ID = `seg-${SEGUIMIENTO_FECHA}-10`;
export const SEGUIMIENTO_DRON_ID = `seg-${SEGUIMIENTO_FECHA}-11`;

// ---------------------------------------------------------------- fases

const t = (faseId: string, i: number, texto: string, partida = '') => ({ id: `${faseId}-t${i}`, texto, hecha: false, partida });

const fase = (id: string, nombre: string, descripcion: string, tareas: string[], extra: Partial<Fase> = {}): Fase => ({
  id, nombre, descripcion,
  tareas: tareas.map((x, i) => t(id, i + 1, x)),
  dependencias: [], requisitos: [],
  previstoInicio: '', previstoFin: '', realInicio: '', realFin: '',
  responsable: '', estado: 'sin empezar', documentos: [], observaciones: '', bloqueos: [], avisos: [], seguimiento: [],
  ...extra,
});

const PAC_TAREAS: [string, string][] = [
  ['PAC-01', 'Demolición del techo actual y preparación para el nuevo'],
  ['PAC-02', 'Demolición de muros para la abertura de 9 m y comunicación interior'],
  ['PAC-03', 'Zuncho de 9 m (40 × 70 cm, triple armado) conectado al cinturón'],
  ['PAC-04', 'Recrecido de muros con bloque de 20 cm y cinturón de hormigón'],
  ['PAC-05', 'Aberturas adicionales (comedor, baño, habitaciones)'],
  ['PAC-06', 'Cubierta plana con vigas de hormigón y revoltón cerámico'],
  ['PAC-07', 'Perímetro de cubierta, impermeabilización y mortero con pendientes'],
  ['PAC-08', 'Forjado (planxer) de madera sobre baño, futuro baño, habitación y pasillo'],
];

function fases(): Fase[] {
  const obs = SEGUIMIENTO_2026_10_21();
  return [
    fase('f01', '1 · Levantamiento, definición de uso y proyecto', 'Contrastar medidas, distribución, estructura, cubierta, altillo y aberturas.',
      ['Contrastar medidas', 'Contrastar distribución', 'Contrastar estructura', 'Contrastar cubierta', 'Contrastar altillo', 'Contrastar aberturas']),
    fase('f02', '2 · Tramitación y trabajos previos', 'Permisos aplicables, comprobación del fibrocemento y gestión especializada si corresponde.',
      ['Identificar y solicitar los permisos aplicables', 'Comprobar el fibrocemento', 'Gestión especializada del fibrocemento si corresponde'],
      { dependencias: ['f01'], tareas: [...['Identificar y solicitar los permisos aplicables', 'Comprobar el fibrocemento', 'Gestión especializada del fibrocemento si corresponde'].map((x, i) => t('f02', i + 1, x)), ...TAREAS_FOSA.map(([id, texto]) => ({ id: `f02-${id}`, texto, hecha: false, partida: '' }))] }),
    fase(FASE_PAC, 'Fase 1 · Estructura, aberturas, cubierta y forjado (presupuesto PAC26-0052)',
      'Partidas seleccionadas del presupuesto PAC26-0052 (oferta recibida, no aceptada) y añadidos de la propiedad: alzado de la casa 36 cm (PAC-11), recrecido de muros hasta 6,00 m, zanja de agua y electricidad desde el pozo y depósito enterrado de agua potable. Cada tarea corresponde a una partida.',
      [],
      {
        tareas: [...PAC_TAREAS, ...ADDED_TAREAS].map(([codigo, texto], i) => t(FASE_PAC, i + 1, texto, codigo)),
        dependencias: ['f01', 'f02'],
        requisitos: ['Permisos aplicables obtenidos', 'Comprobación del fibrocemento/amianto y gestión especializada si corresponde', 'Proyecto validado por el técnico (estructura, cubierta y aberturas)'],
        documentos: [`Presupuesto ${PAC_REF}`],
        avisos: ['La demolición del techo no incluye de forma especificada la retirada de amianto/fibrocemento: requiere aclaración.'],
        // fotos de la propiedad del 21/10/2026: la retirada de la cubierta ha empezado
        estado: 'en curso',
        // previsión de fin indicada por la propiedad (22/10/2026)
        previstoFin: FASE1_FIN,
        seguimiento: obs[FASE_PAC],
      }),
    FASE2(),
    fase('f03', '3 · Preparación, protección y desmontajes', 'Retirada de cubiertas y demoliciones conforme al proyecto y secuencia técnica.',
      ['Protecciones', 'Retirada de cubiertas conforme al proyecto', 'Demoliciones según secuencia técnica'], { dependencias: ['f02'] }),
    fase('f04', '4 · Estructura', 'Consolidación de muros, apoyos, huecos y solución de cubierta/volta validada.',
      ['Consolidación de muros', 'Apoyos', 'Huecos', 'Solución de cubierta/volta validada'], { dependencias: ['f03'] }),
    fase('f05', '5 · Envolvente', 'Aislamiento, impermeabilización, cubierta, fachadas y carpinterías exteriores.',
      ['Aislamiento', 'Impermeabilización', 'Cubierta', 'Fachadas', 'Carpinterías exteriores'], { dependencias: ['f04'] }),
    fase('f06', '6 · Instalaciones previas a acabados', 'Electricidad, KNX, Ajax, audio, agua, saneamiento y ventilación; prever conducciones exteriores antes de la solera.',
      ['Electricidad', 'KNX', 'Ajax', 'Audio', 'Agua', 'Saneamiento', 'Ventilación', 'Conducciones exteriores previstas antes de la solera'], { dependencias: ['f05'] }),
    fase('f07', '7 · Distribución y acabados interiores', 'Pavimentos, paredes, baño con dos duchas, celosía, cocina, isla y mobiliario de obra.',
      ['Pavimentos', 'Paredes', 'Baño con dos duchas', 'Celosía', 'Cocina', 'Isla', 'Mobiliario de obra'], { dependencias: ['f06'] }),
    fase('f08', '8 · Exterior', 'Solera en L (frontal A y lateral), porche, drenaje, conservación del algarrobo, mesa y lámpara según referencia.',
      ['Solera en L (frontal A y lateral)', 'Porche de la cristalera', 'Drenaje', 'Conservación del algarrobo', 'Mesa y lámpara según referencia'], { dependencias: ['f06'] }),
    fase('f09', '9 · Equipamiento y puesta en marcha', 'Luminarias, aparatos, sistemas y comprobaciones.',
      ['Luminarias', 'Aparatos', 'Sistemas', 'Comprobaciones'], { dependencias: ['f07', 'f08'] }),
    fase('f10', '10 · Revisión final', 'Incidencias, repasos, documentación y cierre económico.',
      ['Incidencias', 'Repasos', 'Documentación', 'Cierre económico'], { dependencias: ['f09'] }),
    fase(FASE_PENDIENTE, 'Pendiente de asignar', 'Partidas no seleccionadas del presupuesto PAC26-0052 (fosa séptica, cisterna y escalera): fase por asignar hasta confirmar.', [],
      { observaciones: 'Total no seleccionadas: 13.200 € antes de descuentos e IVA (el relleno interior con el alzado de 36 cm pasa a la fase 1).' }),
  ];
}

/** Entregas a cuenta de la obra indicadas por la propiedad (21/10/2026): no van a ninguna partida. */
export const ENTREGAS_CUENTA = (): EntregaCuenta[] => [
  {
    id: 'ac-2026-08', fecha: '', importe: 6000, emisor: '', documento: '', pagado: true,
    nota: 'Primera entrega a cuenta de la obra, pagada en agosto de 2026 (día, emisor y justificante sin indicar).',
  },
  {
    id: 'ac-fem26-0031', fecha: '2026-10-19', importe: 3500, emisor: 'Euromed Bat (Narbonne, Francia)', documento: 'Factura FEM26-0031', pagado: false,
    nota: 'A cuenta de la obra, sin partida. Sin IVA (autoliquidación por inversión del sujeto pasivo). El concepto de la factura no corresponde a la obra y va a nombre de una empresa: revisar con el gestor. Pago sin confirmar.',
  },
];

export const AVISO_FASES = 'Secuencia propuesta de planificación, no un calendario de obra aprobado; la secuencia y las fechas las fija el técnico. La sustitución de muros portantes o la retirada de cubierta no son trabajos simples sin secuencia técnica.';

export function seedGestion(): GestionData {
  return {
    decisiones: decisiones(),
    fases: fases(),
    presupuesto: {
      capitulos: capitulos(),
      partidas: partidas(),
      ofertas: ofertas(),
      documentos: [{ id: 'doc-pac26-0052', titulo: `Presupuesto ${PAC_REF}`, referencia: `${PAC_PROVEEDOR} · documento en papel con nota manuscrita`, fecha: PAC_FECHA, nota: 'Oferta recibida, no aceptada ni pagada.' }, { ...DEP_DOCUMENTO }, { ...PEB_DOCUMENTO }],
      reserva: { importe: null, nota: '', asignaciones: [] },
      aCuenta: ENTREGAS_CUENTA(),
      avisos: [
        'La solera exterior en L no figura valorada en este presupuesto.',
        'Cocina, baño acabado con dos duchas, carpinterías instaladas, equipamiento, domótica, audio y decoración no quedan acreditados como incluidos: costes pendientes.',
      ],
    },
    comentarios: [],
  };
}
