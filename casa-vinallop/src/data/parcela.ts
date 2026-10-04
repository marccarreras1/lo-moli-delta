/**
 * Entorno de la parcela de Casa Vinallop, aproximado a partir de las fotografías de
 * la propiedad (dron y suelo, 04/10/2026). No es un levantamiento: posiciones y
 * tamaños con una incertidumbre de varios metros. Las fotos no están en el repositorio.
 *
 * Lectura de las fotos: olivar en marco de plantación regular sobre tierra rojiza con
 * grava; un algarrobo grande junto al extremo derecho de la casa (lado del frontal A);
 * solera de hormigón a lo largo del frontal B (las puertas) donde se aparca.
 */
import type { Site } from './types';

export const FOTOS_PARCELA = {
  id: 'fotos-parcela',
  label: 'Fotos de la parcela y de la casa antes de la reforma (04/10/2026)',
  detail: 'Vistas de dron (cenital y oblicua) y desde el suelo: olivar, algarrobo, solera de hormigón y cubiertas de fibrocemento. Solo se usan como referencia; no se publican.',
};

export const PARCELA: Site = {
  status: 'interpretado',
  sourceId: FOTOS_PARCELA.id,
  note: 'Entorno aproximado a partir de las fotos (no es un levantamiento). Olivos en retícula de ≈7 m con una posición ligeramente irregular; algarrobo y solera situados a ojo sobre la vista cenital.',
  ground: '#b98962',
  olives: { spacing: 7, extent: 46, clear: [-4.5, -4, 21.5, 10.5], seed: 11 },
  trees: [
    { id: 'algarrobo', label: 'Algarrobo', c: [18.4, 0.6], r: 3.8, h: 6.2, note: 'Árbol grande de hoja perenne junto al extremo derecho, hacia el frontal A (vista cenital y oblicua).' },
  ],
  pavements: [
    { id: 'solera', label: 'Solera de hormigón', rect: [-0.3, 5, 16.8, 7.6], note: 'Franja de hormigón de ≈2,5 m a lo largo del frontal B (vista cenital).' },
  ],
};
