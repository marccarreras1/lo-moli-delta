/**
 * Tipos del modelo de datos único.
 *
 * Sistema de coordenadas (planta): metros. Origen en la esquina superior
 * izquierda del boceto; X crece hacia la derecha del papel e Y hacia abajo.
 * El modelo 3D usa (x, altura, y): vista desde arriba se lee igual que el
 * papel, sin giros ni reflejos.
 */

export type Vec2 = [number, number];

/**
 * confirmado = decisión o medida indicada por la propiedad · documentado = figura escrita en una
 * fuente (boceto) · interpretado = medido o deducido de un dibujo o foto · propuesto = decisión de
 * diseño pendiente de validar · pendiente = falta o no se distingue. Nada está comprobado en obra.
 */
export type DataStatus = 'confirmado' | 'documentado' | 'interpretado' | 'propuesto' | 'pendiente';

export interface Source {
  id: string;
  label: string;
  /** referencia de trabajo (fotografía) asociada, si existe */
  referenceId?: string;
  detail?: string;
}

export interface Measure {
  id: string;
  label: string;
  value: number | null;
  unit: 'm' | 'm²' | '°' | 'ud';
  /** decimales con los que se transcribió (no mostrar más precisión) */
  decimals: number;
  sourceId: string;
  status: DataStatus;
  note?: string;
}

export type FacadeId = string;

export interface Level {
  id: string;
  name: string;
  /** cota del suelo terminado del nivel (m) */
  elevation: number;
  wallHeight: number;
  elevationStatus?: DataStatus;
}

/** Forjado que sostiene un nivel (se dibuja bajo su cota). */
export interface Slab {
  id: string;
  levelId: string;
  polygon: Vec2[];
  thickness: number;
  status: DataStatus;
  sourceId: string;
  note?: string;
}

/** Escalera recta entre dos niveles. `up` = sentido de subida en planta. */
export interface Stair {
  id: string;
  fromLevel: string;
  toLevel: string;
  rect: [number, number, number, number];
  up: '+x' | '-x' | '+y' | '-y';
  /** estado del sentido de subida */
  upStatus?: DataStatus;
  /** tramo final con peldaños compensados (triángulo del boceto), en metros */
  winderEnd?: number;
  risers: number;
  status: DataStatus;
  sourceId: string;
  note?: string;
}

/** Trazo del boceto que todavía no se interpreta: se dibuja tal cual, marcado como pendiente. */
export interface Trace {
  id: string;
  levelId: string;
  label: string;
  /** pendiente = trazo sin interpretar (por defecto) · nota = anotación ya resuelta */
  kind?: 'pendiente' | 'nota';
  points?: Vec2[];
  closed?: boolean;
  circle?: { c: Vec2; r: number };
  /** marca «×» puntual */
  cross?: Vec2;
  sourceId: string;
  note: string;
}

/** Barandilla sobre el suelo de un nivel (p. ej. el borde del altell hacia la doble altura). */
export interface Railing {
  id: string;
  levelId: string;
  label: string;
  points: Vec2[];
  height: number;
  /** vidrio = paño de cristal continuo · barrotes = barrotes verticales cada `spacing` */
  material: 'vidrio' | 'barrotes';
  /** separación entre barrotes */
  spacing: number;
  /** cota de la base sobre el nivel en el primer y el último punto (barandillas inclinadas de escalera) */
  rise?: [number, number];
  status: DataStatus;
  sourceId: string;
  note?: string;
}

/** Lo que se lee literalmente en una fuente y cómo se interpreta. */
export interface Reading {
  sourceId: string;
  read: string;
  interpreted: string;
}

export interface Wall {
  id: string;
  levelId: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
  height: number;
  kind: 'exterior' | 'tabique';
  /** prolongación del eje en cada extremo (resolución de esquinas) */
  ext?: [number, number];
  facade?: FacadeId;
  status: DataStatus;
  sourceId: string;
}

/** paso = hueco de paso sin puerta ni carpintería */
export type OpeningKind = 'puerta' | 'ventana' | 'cristalera' | 'paso';
export type OpeningSystem = 'abatible' | 'corredera' | 'plegable' | 'fijo';

export interface Opening {
  id: string;
  label: string;
  wallId: string;
  kind: OpeningKind;
  /** distancia desde el extremo `a` del eje del muro hasta el inicio del hueco */
  offset: number;
  width: number;
  sill: number;
  height: number;
  /** carpintería: null = sistema no definido (no se anima) */
  system: { type: OpeningSystem; leaves: number; status: DataStatus } | null;
  /** abatibles: bisagra en el inicio/fin del hueco y sentido (+1 hacia la normal (-dy, dx) del muro) */
  swing?: { hinge: 'inicio' | 'fin'; dir: 1 | -1 };
  /** puerta de entrada principal (admite la variante de hoja de tablones y el volumen saliente) */
  entrance?: boolean;
  /**
   * abertura alternativa: solo aparece si la variante la activa («ventanal-7» / «ventanal-9» según
   * la opción de ventanal; el resto, si su clave está en las aberturas activas)
   */
  variantKey?: string;
  /** color propio de la carpintería (p. ej. puertas de madera o metálicas del estado actual) */
  finishColor?: string;
  /** contraventanas de madera por la cara exterior (abiertas contra la fachada) */
  shutters?: boolean;
  status: DataStatus;
  sourceId: string;
  note?: string;
}

export interface Room {
  id: string;
  levelId: string;
  name: string;
  /** polígono por la cara interior de los muros */
  polygon: Vec2[];
  openTo?: string[];
  status: DataStatus;
  sourceId: string;
  /** superficie transcrita de una fuente (se muestra junto a la calculada) */
  documentedArea?: { value: number; decimals: number; sourceId: string };
  note?: string;
}

export type FurnitureType =
  | 'cama' | 'mesita' | 'armario' | 'sofa' | 'mesa' | 'silla' | 'mesa-centro'
  | 'butaca' | 'alfombra' | 'encimera' | 'nevera' | 'inodoro' | 'lavabo' | 'ducha' | 'banera' | 'banco'
  | 'sofa-l' | 'isla' | 'estufa'
  | 'taburete' | 'mesa-exterior' | 'silla-exterior' | 'maceta' | 'farola' | 'aplique' | 'jarron' | 'balda';

/** Módulo de una cocina lineal (de izquierda a derecha según el eje del mueble). */
export interface KitchenModule {
  kind: 'fregadero' | 'lavavajillas' | 'placa-horno' | 'frigorifico' | 'cajones' | 'puertas';
  w: number;
}

export interface Furniture {
  id: string;
  type: FurnitureType;
  label: string;
  roomId: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  /** grados; 0 = frente hacia +Y (abajo del papel) */
  rot: number;
  status?: DataStatus;
  note?: string;
  /** color propio (p. ej. un mueble de otra madera); si no, el acabado «madera» activo */
  color?: string;
  /** armario abierto, sin puertas (se ven las baldas) */
  open?: boolean;
  /** cocina lineal: módulos bajo encimera */
  modules?: KitchenModule[];
}

export type RoofType = 'dos-aguas' | 'un-agua' | 'plana' | 'plana-peto';

export interface RoofOption {
  type: RoofType;
  label: string;
  pitchDeg: number;
  overhang: number;
  thickness: number;
  status: DataStatus;
  note: string;
  sourceId?: string;
  /** altura del peto perimetral (0 = sin peto) */
  parapet?: number;
  /** acabado interior bajo la cubierta */
  ceiling?: { type: 'vuelta-catalana'; spacing: number; rise: number; status: DataStatus; note: string };
}

/**
 * Faldón de cubierta inclinada sobre un volumen (estado actual: cubiertas a un agua
 * escalonadas). Alto en y0 y bajo en y1; sobre los muros laterales se cierran hastiales.
 */
export interface RoofSegment {
  id: string;
  label: string;
  /** [x0, y0, x1, y1] en planta, por la cara exterior de los muros */
  rect: [number, number, number, number];
  /** altura del alero en y0 y en y1 */
  hy0: number;
  hy1: number;
  overhang: number;
  /** espesor de los muros que reciben los hastiales (0,30 m si no se indica) */
  gableThickness?: number;
  material: 'fibrocemento' | 'losa';
  status: DataStatus;
  sourceId: string;
  note?: string;
}

/** Entorno de la parcela, aproximado a partir de fotografías (no es un levantamiento). */
export interface Site {
  status: DataStatus;
  sourceId: string;
  note: string;
  /** color del terreno */
  ground: string;
  /** olivar en retícula aproximada; se deja libre la zona `clear` alrededor de la casa */
  olives: { spacing: number; extent: number; clear: [number, number, number, number]; seed: number };
  trees: { id: string; label: string; c: Vec2; r: number; h: number; note: string }[];
  pavements: { id: string; label: string; rect: [number, number, number, number]; note: string }[];
}

/** Pavimento exterior (solera) con juntas y, si hace falta, una zona permeable alrededor de un árbol. */
export interface OutdoorPavement {
  id: string;
  label: string;
  rect: [number, number, number, number];
  /** separación de juntas (m) */
  joints: number;
  /** zona sin pavimentar (alcorque) */
  permeable?: { c: Vec2; r: number };
  status: DataStatus;
  note: string;
}

/** Elementos exteriores del proyecto (comedor bajo el algarrobo). */
export interface Outdoor {
  pavements: OutdoorPavement[];
  furniture: Furniture[];
  /** puntos de luz exterior (farolas con soporte propio) */
  lights: { id: string; c: Vec2; h: number; status: DataStatus; note: string }[];
  /** lámpara de cúpula metálica oscura sobre la mesa (referencia 11) */
  domeLamp?: {
    c: Vec2;
    /** cota del borde inferior de la cúpula */
    bottom: number;
    diameter: number;
    /** anclaje en una rama del algarrobo (posición y cota aproximadas, sin resolver) */
    treeAnchor: { c: Vec2; h: number };
    /** pie independiente: posición del poste */
    post: Vec2;
    status: DataStatus;
    note: string;
  };
  /** porches (pérgola de vigas de madera sobre pilares de obra, cubierta de cañizo) */
  porches?: {
    id: string;
    label: string;
    /** [x0, y0, x1, y1] en planta; el lado `wallSide` apoya en la fachada */
    rect: [number, number, number, number];
    wallSide: 'y0' | 'y1';
    /** cota inferior de las vigas junto a la fachada y en el frente */
    hWall: number;
    hFront: number;
    posts: Vec2[];
    postSize: number;
    status: DataStatus;
    note: string;
  }[];
  /** propuesta de evacuación: canaleta lineal (tramos) */
  drains?: { id: string; a: Vec2; b: Vec2; status: DataStatus; note: string }[];
}

/** Grupo de lámparas colgantes en una ubicación candidata. */
export interface PendantGroup {
  id: string;
  location: 'isla' | 'salon';
  label: string;
  points: Vec2[];
  /** cota de la parte baja de las lámparas sobre el suelo */
  bottom: number;
  status: DataStatus;
  note: string;
}

/** Contraste de una dimensión entre fuentes (no se elige ninguna sin validación). */
export interface DimensionCheck {
  label: string;
  items: { source: string; value: string }[];
  status: DataStatus;
  note: string;
}

/** Referencia visual de diseño (no es geometría ni textura). */
export interface DesignReference {
  id: string;
  space: string;
  url: string;
  /** qué se ha tomado de ella y cómo */
  use: string;
  /** si se ha podido abrir desde este entorno */
  consulted: boolean;
  /** número de la imagen aportada por la propiedad (no se publica) */
  refNo?: string;
  /** vistas preparadas donde se aplica */
  views?: string[];
}

/** Definición completa de un proyecto (Casa Vinallop o modelo de prueba). */
export interface ProjectData {
  id: string;
  name: string;
  /** true = geometría ficticia para probar la interfaz */
  isTest: boolean;
  version: string;
  levels: Level[];
  walls: Wall[];
  openings: Opening[];
  rooms: Room[];
  furniture: Furniture[];
  slabs: Slab[];
  stairs: Stair[];
  traces: Trace[];
  readings: Reading[];
  /** discrepancias detectadas entre fuentes */
  discrepancies: string[];
  /** preguntas abiertas que pueden cambiar la geometría */
  questions: string[];
  /** alternativas de cubierta permitidas (la primera es la base) */
  roofOptions: RoofOption[];
  measures: Measure[];
  sources: Source[];
  /** null = orientación no establecida */
  northDeg: number | null;
  /** fachadas identificadas: id → nombre visible */
  facades: Record<string, string>;
  notices: string[];
  /** cubiertas inclinadas por volúmenes; si existen, sustituyen a `roofOptions` */
  roofSegments?: RoofSegment[];
  railings?: Railing[];
  site?: Site;
  outdoor?: Outdoor;
  pendants?: PendantGroup[];
  /** vistas preparadas (posiciones fijas) */
  views?: CameraPreset[];
  checks?: DimensionCheck[];
  references?: DesignReference[];
  /** fase de la casa que representa (solo Casa Vinallop) */
  phase?: 'actual' | 'reforma';
}

/** Proyecto resuelto con una variante aplicada. */
/** Alternativas de diseño que se comparan desde la misma cámara (no borran lo confirmado). */
export interface DesignOptions {
  /** separación de ducha: A = celosía fina geométrica · B = celosía de huecos cuadrados */
  celosia: 'A' | 'B';
  /** lámparas colgantes cerámicas: A = siluetas variadas en tonos de barro · B = terracota clara, más ligeras */
  lamparas: 'A' | 'B';
  lamparasUbicacion: 'isla' | 'salon';
  /** hoja de la puerta de entrada */
  puertaEntrada: 'verde-gris' | 'tablones';
  /** pequeño volumen saliente en la entrada (variante) */
  entradaSaliente: boolean;
  /** ventanal del frontal A: 7 m (bocetos) o 9 m (solicitado y presupuestado, pendiente de cálculo) */
  ventanal: '7' | '9';
  /** aberturas adicionales activas (claves de variante) */
  aberturas: string[];
  /** suspensión de la lámpara del comedor exterior: colgada del algarrobo o con soporte propio */
  lamparaExterior: 'arbol' | 'soporte';
}

export const EXTRA_OPENINGS: { key: string; label: string }[] = [
  { key: 'acceso-comedor', label: 'Puerta acristalada al comedor exterior' },
  { key: 'ventilacion-cruzada', label: 'Ventana del comedor (ventilación cruzada)' },
  { key: 'ventana-dormitorio', label: 'Ventana y contraventana en el dormitorio' },
  { key: 'ventana-bano', label: 'Ventana alta del baño y extracción' },
  { key: 'ventanas-altell', label: 'Dos ventanas en el altell' },
];

export const DEFAULT_OPTIONS: DesignOptions = { celosia: 'A', lamparas: 'A', lamparasUbicacion: 'isla', puertaEntrada: 'tablones', entradaSaliente: false, ventanal: '9', aberturas: [], lamparaExterior: 'arbol' };

export interface Layout extends ProjectData {
  options: DesignOptions;
  roof: RoofOption | null;
  /** coronación de los muros exteriores (m) */
  topHeight: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface CameraPreset {
  id: string;
  label: string;
  group: 'exterior' | 'interior' | 'planta';
  /** [x, y_planta, altura] */
  position: [number, number, number];
  target: [number, number, number];
  eyeLevel?: boolean;
  roomId?: string;
  /** cota del nivel de la estancia: la altura de ojos se suma a ella */
  elevation?: number;
  /** posición fija (no se aleja para encuadrar toda la casa) */
  fixed?: boolean;
  /** campo visual propio */
  fov?: number;
  /** vista de sección: activa el corte longitudinal */
  section?: boolean;
  /** vista sin cubierta */
  hideRoof?: boolean;
}

export interface Finish {
  id: string;
  label: string;
  color: string;
  roughness: number;
}

export type FinishSlot = 'fachada' | 'paredes' | 'suelo' | 'carpinteria' | 'madera' | 'cubierta' | 'textiles' | 'boveda' | 'vigas' | 'encimera';
export type FinishSelection = Record<FinishSlot, string>;

export interface FinishPreset {
  id: string;
  label: string;
  selection: FinishSelection;
}
