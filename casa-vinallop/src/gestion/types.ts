/**
 * Tipos de los módulos de gestión (decisiones, fases, presupuesto y comentarios).
 *
 * Criterio común: lo desconocido es `null` (importes, cantidades, tasas) o cadena vacía
 * (fechas, responsables, proveedores) y la interfaz lo muestra como «pendiente», nunca como 0.
 */

export const DECISION_ESTADOS = ['por comparar', 'elegido por propiedad', 'pendiente de arquitecto', 'validado técnicamente'] as const;
export type DecisionEstado = (typeof DECISION_ESTADOS)[number];

export interface Decision {
  id: string;
  elemento: string;
  estancia: string;
  opcion: string;
  alternativas: string;
  estado: DecisionEstado;
  /** fecha ISO (AAAA-MM-DD) o vacía */
  fecha: string;
  notas: string;
}

export const FASE_ESTADOS = ['sin empezar', 'en curso', 'bloqueada', 'terminada'] as const;
export type FaseEstado = (typeof FASE_ESTADOS)[number];

export interface Tarea {
  id: string;
  texto: string;
  hecha: boolean;
  /** código de la partida del presupuesto a la que corresponde (opcional) */
  partida: string;
}

export interface Bloqueo {
  id: string;
  texto: string;
  /** fecha ISO o vacía */
  fecha: string;
  resuelto: boolean;
}

export interface Fase {
  id: string;
  nombre: string;
  descripcion: string;
  tareas: Tarea[];
  /** ids de las fases que deben terminar antes */
  dependencias: string[];
  /** requisitos previos que no son fases (permisos, comprobaciones, validaciones) */
  requisitos: string[];
  previstoInicio: string;
  previstoFin: string;
  realInicio: string;
  realFin: string;
  responsable: string;
  estado: FaseEstado;
  /** referencias de documentos (texto o enlace) */
  documentos: string[];
  observaciones: string;
  bloqueos: Bloqueo[];
  /** avisos fijos visibles en la fase */
  avisos: string[];
}

export const UNIDADES = ['m²', 'm', 'ud', 'PA'] as const;
export type Unidad = (typeof UNIDADES)[number];

export const CONDICIONES = ['estimación', 'oferta recibida', 'contratado'] as const;
export type Condicion = (typeof CONDICIONES)[number];

export interface Pago {
  id: string;
  fecha: string;
  importe: number;
  nota: string;
}

export type Vinculo = 'solera-l-area';

export interface Partida {
  id: string;
  codigo: string;
  descripcion: string;
  /** id del capítulo */
  capitulo: string;
  /** id de la fase (vacío = sin fase) */
  fase: string;
  cantidad: number | null;
  unidad: Unidad;
  /** precio unitario previsto, base sin impuestos */
  precio: number | null;
  proveedor: string;
  referencia: string;
  /** importe contratado, base sin impuestos */
  contratado: number | null;
  /** extras aprobados, base sin impuestos */
  extras: number | null;
  /** coste real reconocido, base sin impuestos */
  real: number | null;
  pagos: Pago[];
  notas: string;
  origenPrecio: string;
  fechaPrecio: string;
  condicion: Condicion;
  /** tasa de impuesto en % (null = no se sabe) */
  impuesto: number | null;
  /** importe previsto congelado al fijar el presupuesto base (null = sin fijar) */
  base: number | null;
  /** cantidad tomada de la geometría del modelo */
  vinculo?: Vinculo;
  /** partida ofertada pero no seleccionada: se lista como referencia y no se suma */
  noSeleccionada?: boolean;
  /** avance de ejecución en % indicado por la propiedad (ausente = se toma de las tareas vinculadas) */
  ejecutado?: number;
}

export interface Capitulo {
  id: string;
  nombre: string;
  /** capítulo de reserva para imprevistos (no lleva partidas: se gestiona aparte) */
  reserva?: boolean;
}

export const OFERTA_ESTADOS = ['recibida', 'aceptada', 'rechazada'] as const;
export type OfertaEstado = (typeof OFERTA_ESTADOS)[number];

export interface TotalesImpresos {
  subtotal: number | null;
  descuento: number | null;
  base: number | null;
  impuestos: number | null;
  total: number | null;
  nota: string;
}

export interface Oferta {
  id: string;
  proveedor: string;
  referencia: string;
  fecha: string;
  alcance: string;
  /** códigos de partidas incluidas: si hay, la base de la oferta es la suma de sus importes previstos */
  partidas: string[];
  /** base antes de descuentos cuando la oferta no está vinculada a partidas */
  importeBase: number | null;
  /** descuento comercial en % sobre la base */
  descuentoPct: number | null;
  /** ajuste adicional en € (negativo = rebaja), aplicado después del descuento */
  ajuste: number | null;
  ajusteNota: string;
  /** tasa de impuestos en % */
  impuestoPct: number | null;
  estado: OfertaEstado;
  documentos: string[];
  notas: string;
  /** totales impresos de un documento más amplio (solo informativos, no se suman) */
  totalesImpresos: TotalesImpresos | null;
  /** condiciones o textos del documento para revisión técnica */
  condiciones: string;
  avisos: string[];
}

export interface Documento {
  id: string;
  titulo: string;
  /** referencia de texto o enlace */
  referencia: string;
  fecha: string;
  nota: string;
}

export interface Asignacion {
  id: string;
  /** código de partida a la que se asigna parte de la reserva */
  partida: string;
  importe: number;
  fecha: string;
  nota: string;
}

export interface Reserva {
  /** importe de la reserva, base (null = sin definir) */
  importe: number | null;
  nota: string;
  asignaciones: Asignacion[];
}

export interface Presupuesto {
  capitulos: Capitulo[];
  partidas: Partida[];
  ofertas: Oferta[];
  documentos: Documento[];
  reserva: Reserva;
  avisos: string[];
}

export type ComentarioEstado = 'pendiente' | 'resuelto';
export type ComentarioVista = 'plano' | '3d';

export interface Comentario {
  id: string;
  texto: string;
  /** id de la estancia (opcional) */
  estancia?: string;
  /** id del nivel */
  nivel: string;
  /** posición en metros de planta; z opcional para 3D */
  posicion: { x: number; y: number; z?: number };
  vista: ComentarioVista;
  estado: ComentarioEstado;
  /** fecha y hora ISO de creación */
  creado: string;
}

export interface GestionData {
  decisiones: Decision[];
  fases: Fase[];
  presupuesto: Presupuesto;
  comentarios: Comentario[];
}
