/**
 * Capas de instalaciones (propuestas). Ningún punto es un dispositivo contratado: las
 * posiciones, recorridos, equipos e integraciones son propuestas hasta su validación por
 * el instalador.
 *
 * Coordenadas: las de la planta (metros, X a la derecha del papel e Y hacia abajo).
 * `height` se mide sobre el suelo terminado del nivel `levelId`.
 */

export const LAYERS = ['electricidad', 'knx', 'ajax', 'audio', 'agua', 'bodega'] as const;
export type Layer = (typeof LAYERS)[number];

export const LAYER_LABEL: Record<Layer, string> = {
  electricidad: 'Iluminación, interruptores, enchufes y cuadro',
  knx: 'Domótica KNX',
  ajax: 'Seguridad Ajax',
  audio: 'Audio por zonas',
  agua: 'Agua, saneamiento, ventilación y duchas',
  bodega: 'Sensor T/H de la bodega',
};

/** nombre corto (chips, tabla) */
export const LAYER_SHORT: Record<Layer, string> = {
  electricidad: 'Electricidad',
  knx: 'KNX',
  ajax: 'Ajax',
  audio: 'Audio',
  agua: 'Agua',
  bodega: 'Bodega',
};

export const KINDS_BY_LAYER = {
  electricidad: ['luz', 'interruptor', 'enchufe', 'cuadro'],
  knx: ['knx-actuador', 'knx-pulsador', 'knx-sensor'],
  ajax: ['ajax-hub', 'ajax-movimiento', 'ajax-contacto', 'ajax-sirena'],
  audio: ['altavoz'],
  agua: ['toma-agua', 'desague', 'extraccion', 'rociador', 'mando-ducha'],
  bodega: ['sensor-th'],
} as const satisfies Record<Layer, readonly string[]>;

export type InstallKind = (typeof KINDS_BY_LAYER)[Layer][number];

export const KINDS: InstallKind[] = LAYERS.flatMap((l) => [...KINDS_BY_LAYER[l]]);

export const KIND_LABEL: Record<InstallKind, string> = {
  luz: 'Punto de luz',
  interruptor: 'Interruptor',
  enchufe: 'Enchufe',
  cuadro: 'Cuadro eléctrico',
  'knx-actuador': 'Actuadores KNX',
  'knx-pulsador': 'Pulsador KNX',
  'knx-sensor': 'Sensor KNX de presencia',
  'ajax-hub': 'Central Ajax',
  'ajax-movimiento': 'Detector de movimiento Ajax',
  'ajax-contacto': 'Contacto de apertura Ajax',
  'ajax-sirena': 'Sirena exterior Ajax',
  altavoz: 'Altavoz',
  'toma-agua': 'Toma de agua',
  desague: 'Desagüe',
  extraccion: 'Extracción mecánica',
  rociador: 'Rociador de ducha',
  'mando-ducha': 'Mando de ducha',
  'sensor-th': 'Sensor de temperatura y humedad',
};

export const LAYER_OF_KIND: Record<InstallKind, Layer> = Object.fromEntries(
  LAYERS.flatMap((l) => KINDS_BY_LAYER[l].map((k) => [k, l])),
) as Record<InstallKind, Layer>;

export const kindFitsLayer = (layer: Layer, kind: string): kind is InstallKind => (KINDS_BY_LAYER[layer] as readonly string[]).includes(kind);

/** Nunca se asigna «validado por instalador» por defecto: solo lo marca el usuario. */
export const INSTALL_STATUSES = ['propuesto', 'pendiente', 'validado por instalador'] as const;
export type InstallStatus = (typeof INSTALL_STATUSES)[number];

export const STATUS_LABEL: Record<InstallStatus, string> = {
  propuesto: 'Propuesto',
  pendiente: 'Pendiente',
  'validado por instalador': 'Validado por instalador',
};

export interface InstallPoint {
  /** identificador estable por función (p. ej. `elec-luz-dia-techo`) */
  id: string;
  layer: Layer;
  kind: InstallKind;
  /** función, en lenguaje claro */
  label: string;
  /** estancia del modelo; null = exterior o ubicación pendiente */
  roomId: string | null;
  levelId: string;
  /** posición en planta (m); null = ubicación pendiente */
  x: number | null;
  y: number | null;
  /** altura propuesta sobre el suelo del nivel (m) */
  height: number;
  /** circuito (texto libre; vacío si no hay) */
  circuit: string;
  /** zona (estancia, zona de audio…) */
  zone: string;
  status: InstallStatus;
  note: string;
}

/** Cambios del usuario sobre un punto generado (cualquier campo salvo id y capa). */
export type PointOverride = Partial<Omit<InstallPoint, 'id' | 'layer'>>;

export interface InstallEdits {
  overrides: Record<string, PointOverride>;
  /** puntos añadidos a mano */
  added: InstallPoint[];
  /** ids de puntos generados que el usuario ha quitado */
  removed: string[];
}

export const emptyEdits = (): InstallEdits => ({ overrides: {}, added: [], removed: [] });
