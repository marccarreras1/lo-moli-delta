/**
 * Corrección de la foto de dron con el lindero catastral (scripts/ajuste_catastro.py). Generado: no editar a mano.
 * AJUSTE_FOTO lleva el suelo de la foto (olivar.ts) al del modelo; ENTRADA_FINCA es la puerta, junto a la esquina sureste.
 */
import type { Vec2 } from './types';

export const AJUSTE_FOTO: number[] = [0.9427791, 0.0403878, 0.0811239, -0.002729, 1.0080349, -0.0682387, -0.0018806, -0.0023412, 1.0];

/** puerta de la finca, sobre el lindero este junto a la esquina sureste */
export const ENTRADA_FINCA: Vec2 = [85.01, 76.93];

/** punto del camino, por dentro, desde el que se llega perpendicular a la puerta */
export const APROX_ENTRADA: Vec2 = [79.07, 76.03];

/** camino agrícola por fuera del lindero este, de la puerta hacia el norte */
export const CAMINO_EXTERIOR: Vec2[] = [[88.47, 77.45], [95.17, 32.95], [102.63, -16.49]];

/** aplica AJUSTE_FOTO a un punto de la foto */
export const ajustarFoto = ([x, y]: Vec2): Vec2 => {
  const [a, b, c, d, e, f, g, h, i] = AJUSTE_FOTO;
  const w = g * x + h * y + i;
  return [Math.round(((a * x + b * y + c) / w) * 10) / 10, Math.round(((d * x + e * y + f) / w) * 10) / 10];
};
