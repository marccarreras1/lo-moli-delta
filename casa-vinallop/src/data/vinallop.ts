/**
 * CASA VINALLOP — definición del proyecto.
 *
 * Aquí se incorporará la geometría leída de las fotografías de los bocetos.
 * Mientras esté vacía, la aplicación muestra el estado inicial
 * «Añade los bocetos para construir el modelo de Casa Vinallop».
 *
 * Cada muro, hueco y estancia debe llevar `sourceId` (fuente) y `status`:
 *   documentado  → figura legible en una fuente (no comprobado en obra)
 *   interpretado → deducido de un boceto sin cota explícita
 *   propuesto    → decisión de diseño a estudiar
 *   pendiente    → no se distingue / falta el dato
 *
 * Coordenadas en metros, X → derecha del papel, Y → abajo del papel.
 */
import type { ProjectData } from './types';

export const VINALLOP: ProjectData = {
  id: 'casa-vinallop',
  name: 'Casa Vinallop',
  isTest: false,
  version: '0.2 · sin geometría',
  levels: [],
  walls: [],
  openings: [],
  rooms: [],
  furniture: [],
  roofOptions: [],
  measures: [],
  sources: [],
  northDeg: null,
  facades: {},
  notices: ['Geometría pendiente de las fotografías de los bocetos.'],
};
