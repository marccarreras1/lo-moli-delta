/**
 * Entorno de la parcela de Casa Vinallop, aproximado a partir de las fotografías de
 * la propiedad (dron y suelo, 04/10/2026). No es un levantamiento: posiciones y
 * tamaños con una incertidumbre de varios metros. Las fotos no están en el repositorio.
 *
 * Lectura de las fotos: olivar en marco de plantación regular sobre tierra rojiza con
 * grava; un algarrobo grande junto al extremo derecho de la casa (lado del frontal A);
 * solera de hormigón a lo largo del frontal B (las puertas) donde se aparca.
 */
import type { CameraPreset, Site } from './types';

export const FOTOS_PARCELA = {
  id: 'fotos-parcela',
  label: 'Fotos de la parcela y de la casa antes de la reforma (04/10/2026)',
  detail: 'Vistas de dron (cenital y oblicua) y desde el suelo: olivar, algarrobo, solera de hormigón y cubiertas de fibrocemento. Solo se usan como referencia; no se publican.',
};

export const PARCELA: Site = {
  status: 'interpretado',
  sourceId: FOTOS_PARCELA.id,
  note: 'Entorno aproximado a partir de las fotos de dron (no es un levantamiento). Olivos grandes (copas de 6–7 m) en retícula de ≈9 m que llega a 2–3 m de la casa; algarrobo grande junto a la habitación pequeña, cubriendo en parte su cubierta; solera de hormigón a lo largo del frontal B.',
  ground: '#c49c80',
  olives: { spacing: 9, extent: 70, clear: [-1.8, -1.8, 18.1, 7.0], seed: 11 },
  trees: [
    { id: 'algarrobo', label: 'Algarrobo', c: [17.7, 2.3], r: 5.4, h: 8.0, note: 'Algarrobo grande y viejo (fotos de dron y de suelo): tronco muy grueso (≈1 m en la base) y retorcido, con raíces vistas; se abre en ramas gruesas a 2–2,5 m; copa ancha y baja que cubre la habitación pequeña. Tronco a ≈1,4 m del lateral derecho, hacia la mitad (a ojo).' },
  ],
  pavements: [
    { id: 'solera', label: 'Solera de hormigón', rect: [-0.3, 5.22, 17.2, 7.8], note: 'Franja de hormigón de ≈2,5 m a lo largo del frontal B (vista cenital).' },
  ],
};

/** Vistas de dron como las fotos de la propiedad (mismas en el estado actual y en la reforma). */
export const VISTAS_DRON: CameraPreset[] = [
  { id: 'd01-dron-frontal', label: 'Dron · frontal B desde lo alto', group: 'exterior', fixed: true, position: [3.5, 25, 21], target: [9.6, 3.2, 0], fov: 46 },
  { id: 'd02-dron-cenital', label: 'Dron · vista cenital', group: 'exterior', fixed: true, position: [9.4, 8.5, 40], target: [9.4, 2.6, 0], fov: 42 },
  { id: 'd04-algarrobo', label: 'Algarrobo desde el olivar (a pie)', group: 'exterior', fixed: true, position: [23.2, 7.6, 1.6], target: [16.6, 2.2, 2.5], fov: 62 },
  { id: 'd03-dron-lejana', label: 'Dron · olivar y entorno', group: 'exterior', fixed: true, position: [-6, 78, 46], target: [10, -6, 0], fov: 52 },
];
