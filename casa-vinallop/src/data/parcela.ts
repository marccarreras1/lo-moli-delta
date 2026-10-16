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
    // medido por la propiedad (16/10/2026): el tronco a 2,64 m del lateral derecho (x = 16,33) y a 3,50 m del frontal B
    // (y = 5,22), medidas hasta la cara del tronco; el centro se sitúa sumando su radio (≈0,50 m)
    { id: 'algarrobo', label: 'Algarrobo', c: [19.47, 1.22], r: 5.4, h: 8.0, medido: true, note: 'Algarrobo grande y viejo (fotos de dron y de suelo): tronco muy grueso (≈1 m en la base) y retorcido, con raíces vistas; se abre en ramas gruesas a 2–2,5 m; copa ancha y baja. Posición medida por la propiedad: tronco a 2,64 m del lateral derecho de la casa y a 3,50 m de la fachada de la entrada (frontal B), medidas hasta el tronco; centro supuesto a 0,50 m más (radio del tronco).' },
    // olivos frente a la cristalera (frontal A, y = 0), medidos por la propiedad (16/10/2026) hasta el tronco:
    // el grande a 3,60 m de la fachada y a 2,60 m del extremo de la casa (x = 16,33), medido a lo largo de la fachada;
    // el pequeño a 4,50 m de la fachada y a 4,60 m del grande, hacia el centro.
    // Olivo grande según su foto: tronco viejo y retorcido de ≈0,70 m en el pie (radio 0,35), cruz a ≈1,8 m, copa de ≈7 m
    // de ancho y ≈6,5 m de alto con ramas largas hacia la casa. Olivo pequeño según su foto: tronco fino (radio ≈0,10 m)
    // que se abre en dos a ≈0,7 m, copa de ≈4 m de ancho y ≈4,5 m de alto.
    { id: 'olivo-cristalera', label: 'Olivo grande de la cristalera', kind: 'olivo', medido: true, c: [13.38, -3.95], r: 3.5, h: 6.5, trunk: { r: 0.3, h: 1.8, viejo: true },
      note: 'Olivo viejo frente a la cristalera (frontal A): tronco a 3,60 m de la fachada y a 2,60 m del extremo derecho de la casa, a lo largo de la fachada (medidas de la propiedad hasta el tronco). Según su foto: tronco grueso y retorcido (≈0,70 m en el pie) que se abre a ≈1,8 m, copa de ≈7 m de ancho y ≈6,5 m de alto. Queda a ≈0,55 m del borde de la solera y su copa pasa por encima del porche: hay que podar las ramas que toquen la pérgola y cuidar las raíces al hacer la solera (no excavar ni compactar junto al tronco).' },
    { id: 'olivo-pequeno', label: 'Olivo pequeño', kind: 'olivo', medido: true, c: [8.37, -4.6], r: 2.0, h: 4.5, trunk: { r: 0.08, h: 0.7 },
      note: 'Olivo joven frente a la cristalera: tronco a 4,50 m de la fachada y a 4,60 m del olivo grande, hacia el centro de la casa (medidas de la propiedad hasta el tronco). Según su foto: tronco fino que se abre en dos a ≈0,7 m, copa ligera de ≈4 m de ancho y ≈4,5 m de alto.' },
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
