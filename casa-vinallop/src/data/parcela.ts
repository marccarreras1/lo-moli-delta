/**
 * Entorno de la parcela de Casa Vinallop, aproximado a partir de las fotografías de
 * la propiedad (dron y suelo, 04/10/2026). No es un levantamiento: posiciones y
 * tamaños con una incertidumbre de varios metros. Las fotos no están en el repositorio.
 *
 * Lectura de las fotos: olivar en marco de plantación regular sobre tierra rojiza con
 * grava; un algarrobo grande junto al extremo derecho de la casa (lado del frontal A);
 * solera de hormigón a lo largo del frontal B (las puertas) donde se aparca.
 */
import { EDIFICIO_CATASTRO, PARCELA_CATASTRO } from './catastro';
import { CAMINO_EXTERIOR, CAMINO_FINCA, ENTRADA_FINCA, OLIVOS_FINCA } from './olivarFinca';
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
  parcela: { ...PARCELA_CATASTRO, status: 'documentado',
    note: 'Lindero de la parcela según el Catastro (GML aportado por la propiedad), situado respecto a la casa con la huella catastral del edificio: el norte sale del eje del edificio (≈20° desde el frontal A) y el centro del edificio catastral coincide con el de la casa del modelo. Precisión de la cartografía catastral: ≈1 m.' },
  edificioCatastro: { ...EDIFICIO_CATASTRO,
    note: 'Huella del edificio en el Catastro (antes de la reforma): ≈16,7 × 5,6 m, 74 m² construidos, año 1980, uso agrario. Retranqueos en los dos extremos del frontal A.' },
  // árboles de la foto de dron de la finca entera, uno a uno; la «zona de la foto» es toda la parcela (sin retícula)
  olives: { spacing: 7.5, extent: 70, clear: [-1.8, -1.8, 18.1, 7.0], seed: 11, fijos: OLIVOS_FINCA, zonaFoto: PARCELA_CATASTRO.poligono },
  trees: [
    // medido por la propiedad (16/10/2026): el tronco a 2,64 m del lateral derecho (x = 16,33) y a 3,50 m del frontal B
    // (y = 5,22), medidas hasta la cara del tronco; el centro se sitúa sumando su radio (≈0,50 m).
    // Por el lado de la cristalera la copa solo sale 2,00 m de la línea de la fachada A (y = 0).
    { id: 'algarrobo', label: 'Algarrobo', c: [19.47, 1.22], r: 5.4, h: 8.0, medido: true, copa: { yMin: -2.0 }, note: 'Algarrobo grande y viejo (fotos de dron y de suelo): tronco muy grueso (≈1 m en la base) y retorcido, con raíces vistas; se abre en ramas gruesas a 2–2,5 m; copa ancha y baja. Posición medida por la propiedad: tronco a 2,64 m del lateral derecho de la casa y a 3,50 m de la fachada de la entrada (frontal B), medidas hasta el tronco; centro supuesto a 0,50 m más (radio del tronco). Por el lado de la cristalera la copa solo sale 2,00 m de la línea de la fachada A (medida de la propiedad).' },
    // olivos frente a la cristalera (frontal A, y = 0), medidos por la propiedad (16/10/2026) hasta el tronco:
    // el grande a 3,60 m de la fachada y a 2,60 m del extremo de la casa (x = 16,33), medido a lo largo de la fachada;
    // el pequeño a 4,50 m de la fachada y a 4,60 m del grande, hacia el centro.
    // Olivo grande según su foto: tronco viejo y retorcido de ≈0,70 m en el pie (radio 0,35), cruz a ≈1,8 m, copa de ≈7 m
    // de ancho y ≈6,5 m de alto con ramas largas hacia la casa. Olivo pequeño según su foto: tronco fino (radio ≈0,10 m)
    // que se abre en dos a ≈0,5 m, copa de ≈4,5 m de ancho y ≈5 m de alto.
    { id: 'olivo-cristalera', label: 'Olivo grande de la cristalera', kind: 'olivo', medido: true, c: [13.38, -3.95], r: 3.5, h: 6.5, trunk: { r: 0.3, h: 1.8, viejo: true },
      note: 'Olivo viejo frente a la cristalera (frontal A): tronco a 3,60 m de la fachada y a 2,60 m del extremo derecho de la casa, a lo largo de la fachada (medidas de la propiedad hasta el tronco). Según su foto: tronco grueso y retorcido (≈0,70 m en el pie) que se abre a ≈1,8 m, copa de ≈7 m de ancho y ≈6,5 m de alto. Queda a ≈0,55 m del borde de la solera y su copa pasa por encima del porche: hay que podar las ramas que toquen la pérgola y cuidar las raíces al hacer la solera (no excavar ni compactar junto al tronco).' },
    { id: 'olivo-pequeno', label: 'Olivo pequeño', kind: 'olivo', medido: true, c: [8.37, -4.6], r: 2.25, h: 5.0, trunk: { r: 0.09, h: 0.5 },
      note: 'Olivo joven frente a la cristalera: tronco a 4,50 m de la fachada y a 4,60 m del olivo grande, hacia el centro de la casa (medidas de la propiedad hasta el tronco). Según su foto (confirmada por la propiedad): tronco fino que se abre en dos a ≈0,5 m, copa ligera de ≈4,5 m de ancho y ≈5 m de alto.' },
    // foto de la entrada desde fuera (17/10/2026): árbol grande y oscuro dentro de la finca, a la izquierda del hueco
    { id: 'arbol-entrada', label: 'Árbol grande junto a la entrada', kind: 'algarrobo', c: [74.0, 89.7], r: 4.5, h: 9.0, note: 'Árbol grande de copa oscura dentro de la finca, a la izquierda de la entrada vista desde fuera (foto de la propiedad). Posición y tamaño aproximados sobre la foto.' },
  ],
  // entrada de la finca (foto de la propiedad: 4,70 m de ancho) y camino de acceso marcado por la propiedad sobre la foto de
  // dron, pasado a metros con la homografía ajustada a la casa y al olivar (src/data/olivar.ts). Margen ≈±15 %.
  acceso: {
    // puerta en el hueco de la malla del lindero lateral (este), pegada a la esquina sureste (la propiedad confirmó el esquema
    // y pidió dejarla totalmente pegada a la esquina, 17/10/2026); camino entre los olivos (scripts/olivar_finca.py)
    entrada: ENTRADA_FINCA, anchoEntrada: 4.7, anchoCamino: 3.0,
    camino: CAMINO_FINCA,
    exterior: CAMINO_EXTERIOR, vallasMoviles: 5, esquina: PARCELA_CATASTRO.poligono[13],
    status: 'interpretado',
    note: 'Entrada de la finca de 4,70 m de ancho (medida de la propiedad) en el lindero lateral, pegada a la esquina sureste (indicación de la propiedad), donde llega por fuera el camino agrícola de grava; ahí va la puerta menorquina. Dentro, camino de tierra y grava de ≈3 m desde la zona de aparcamiento del frontal B hasta la puerta, trazado por los pasillos libres entre los olivos de la foto de dron de la finca entera (≈126 m). Trazado propuesto.',
  },
  pavements: [
    // donde la propiedad deja el coche (foto cenital, 17/10/2026): pasillo libre entre dos filas de olivos delante del frontal B
    { id: 'aparcamiento', label: 'Zona de aparcamiento (3 coches)', rect: [1.5, 14.6, 15.5, 17.8], firme: 'grava',
      note: 'Donde la propiedad quiere dejar los coches: el claro donde aparca hoy, ≈9 m delante del frontal B, entre dos filas de olivos (foto cenital). 14 × 3,2 m de tierra compactada con grava, para tres coches en fila como el de la foto; las copas de los olivos dan sombra por los dos lados. Medidas propuestas.' },
    { id: 'solera', label: 'Solera de hormigón', rect: [-0.3, 5.22, 17.2, 7.8], note: 'Franja de hormigón de ≈2,5 m a lo largo del frontal B (vista cenital).' },
  ],
};

/** Vistas de dron como las fotos de la propiedad (mismas en el estado actual y en la reforma). */
export const VISTAS_DRON: CameraPreset[] = [
  { id: 'd01-dron-frontal', label: 'Dron · frontal B desde lo alto', group: 'exterior', fixed: true, position: [3.5, 25, 21], target: [9.6, 3.2, 0], fov: 46 },
  { id: 'd02-dron-cenital', label: 'Dron · vista cenital', group: 'exterior', fixed: true, position: [9.4, 8.5, 40], target: [9.4, 2.6, 0], fov: 42 },
  { id: 'd04-algarrobo', label: 'Algarrobo desde el olivar (a pie)', group: 'exterior', fixed: true, position: [23.2, 7.6, 1.6], target: [16.6, 2.2, 2.5], fov: 62 },
  // mismo punto de vista que la foto de dron con la que se situaron el olivar y el camino (cámara calculada con la homografía)
  { id: 'd05-dron-foto-olivar', label: 'Dron · como la foto del olivar', group: 'exterior', fixed: true, position: [-22, -18.5, 42], target: [22.4, 20.4, 0], fov: 42 },
  { id: 'd06-puerta-finca', label: 'Entrada de la finca desde el camino (como la foto)', group: 'exterior', fixed: true, position: [91.2, 82.7, 1.6], target: [80.4, 87.2, 1.2], fov: 62 },
  // la finca entera según el lindero catastral (centro de la parcela ≈ [33,5, 4,5]); la cenital, con el frontal A arriba como los planos
  { id: 'd07-finca-completa', label: 'Finca completa', group: 'exterior', fixed: true, position: [-85, 165, 150], target: [33.5, 4.5, 0], fov: 45 },
  { id: 'd08-finca-cenital', label: 'Finca · vista cenital', group: 'exterior', fixed: true, position: [33.5, 4.52, 290], target: [33.5, 4.5, 0], fov: 45 },
  // como la foto cenital de la propiedad (17/10/2026): en vertical sobre el claro del aparcamiento, frontal A arriba
  { id: 'd09-dron-aparcamiento', label: 'Dron cenital · casa y aparcamiento', group: 'exterior', fixed: true, position: [12.0, 16.52, 62], target: [12.0, 16.5, 0], fov: 50 },
  { id: 'd03-dron-lejana', label: 'Dron · olivar y entorno', group: 'exterior', fixed: true, position: [-6, 78, 46], target: [10, -6, 0], fov: 52 },
];
