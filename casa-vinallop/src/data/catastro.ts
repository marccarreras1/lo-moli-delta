/**
 * Geometría catastral (GML de la Sede Electrónica del Catastro aportados por la propiedad), pasada a
 * coordenadas del modelo con scripts/catastro.py. Generado: no editar a mano.
 */
import type { Vec2 } from './types';

/** norte, en grados en sentido horario desde el frontal A, según el eje del edificio catastral */
export const NORTE_CATASTRO = 19.9;

/** lindero de la parcela (superficie catastral 23162 m²) */
export const PARCELA_CATASTRO: { poligono: Vec2[]; area: number } = { area: 23162, poligono: [[-30.39, 108.39], [-27.72, -82.33], [26.23, -86.29], [32.13, -85.15], [72.21, -76.6], [76.58, -77.67], [90.23, -86.01], [97.93, -93.5], [118.46, -107.97], [117.24, -102.04], [113.73, -96.02], [111.76, -88.77], [99.24, -17.5], [82.92, 90.77], [44.11, 99.09]] };

/** huella del edificio en el Catastro, antes de la reforma (superficie construida 74 m²) */
export const EDIFICIO_CATASTRO: { poligono: Vec2[]; area: number } = { area: 74, poligono: [[13.46, 1.63], [14.53, 1.59], [14.62, 3.43], [16.51, 3.46], [16.46, 5.4], [13.51, 5.3], [-0.18, 5.13], [-0.13, 3.12], [1.99, 3.09], [1.94, -0.01], [13.43, -0.18]] };
