/**
 * Tipos del modelo de datos único.
 *
 * Sistema de coordenadas (planta): metros. Origen en la esquina superior
 * izquierda del boceto; X crece hacia la derecha del papel e Y hacia abajo.
 * El modelo 3D usa (x, altura, y): vista desde arriba se lee igual que el
 * papel, sin giros ni reflejos.
 */

export type Vec2 = [number, number];

/** documentado = figura en una fuente (no comprobado en obra). */
export type DataStatus = 'documentado' | 'interpretado' | 'propuesto' | 'pendiente';

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
  elevation: number;
  wallHeight: number;
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

export type OpeningKind = 'puerta' | 'ventana' | 'cristalera';
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
  | 'butaca' | 'alfombra' | 'encimera' | 'nevera' | 'inodoro' | 'lavabo' | 'ducha';

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
}

export type RoofType = 'dos-aguas' | 'un-agua' | 'plana';

export interface RoofOption {
  type: RoofType;
  label: string;
  pitchDeg: number;
  overhang: number;
  thickness: number;
  status: DataStatus;
  note: string;
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
  /** alternativas de cubierta permitidas (la primera es la base) */
  roofOptions: RoofOption[];
  measures: Measure[];
  sources: Source[];
  /** null = orientación no establecida */
  northDeg: number | null;
  /** fachadas identificadas: id → nombre visible */
  facades: Record<string, string>;
  notices: string[];
}

/** Proyecto resuelto con una variante aplicada. */
export interface Layout extends ProjectData {
  roof: RoofOption | null;
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
}

export interface Finish {
  id: string;
  label: string;
  color: string;
  roughness: number;
}

export type FinishSlot = 'fachada' | 'paredes' | 'suelo' | 'carpinteria' | 'madera' | 'cubierta' | 'textiles';
export type FinishSelection = Record<FinishSlot, string>;

export interface FinishPreset {
  id: string;
  label: string;
  selection: FinishSelection;
}
