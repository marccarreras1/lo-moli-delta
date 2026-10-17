/**
 * Corrección de la foto de dron con el lindero catastral (scripts/ajuste_catastro.py). Generado: no editar a mano.
 * AJUSTE_FOTO lleva el suelo de la foto (olivar.ts) al del modelo; ENTRADA_FINCA es la puerta, junto a la esquina sureste.
 */
import type { Vec2 } from './types';

export const AJUSTE_FOTO: number[] = [0.9331075, 0.0233329, 0.1880591, 0.0020013, 1.0595169, -0.241531, -0.0019802, -0.0024605, 1.0];

/** puerta de la finca, sobre el lindero este junto a la esquina sureste */
export const ENTRADA_FINCA: Vec2 = [83.52, 86.81];

/** punto del camino, por dentro, desde el que se llega perpendicular a la puerta */
export const APROX_ENTRADA: Vec2 = [77.58, 85.92];

/** camino agrícola por fuera del lindero este, de la puerta hacia el norte */
export const CAMINO_EXTERIOR: Vec2[] = [[86.98, 87.34], [93.68, 42.84], [101.14, -6.6]];

/** aplica AJUSTE_FOTO a un punto de la foto */
export const ajustarFoto = ([x, y]: Vec2): Vec2 => {
  const [a, b, c, d, e, f, g, h, i] = AJUSTE_FOTO;
  const w = g * x + h * y + i;
  return [Math.round(((a * x + b * y + c) / w) * 10) / 10, Math.round(((d * x + e * y + f) / w) * 10) / 10];
};
