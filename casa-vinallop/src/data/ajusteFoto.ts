/**
 * Corrección de la foto de dron con el lindero catastral (scripts/ajuste_catastro.py). Generado: no editar a mano.
 * AJUSTE_FOTO lleva el suelo de la foto (olivar.ts) al del modelo; ENTRADA_FINCA es la puerta, junto a la esquina sureste.
 */
import type { Vec2 } from './types';

export const AJUSTE_FOTO: number[] = [0.9371123, 0.0303455, 0.1438997, 0.0001366, 1.0391288, -0.1728532, -0.0019389, -0.0024104, 1.0];

/** puerta de la finca, sobre el lindero este junto a la esquina sureste */
export const ENTRADA_FINCA: Vec2 = [84.11, 82.86];

/** punto del camino, por dentro, desde el que se llega perpendicular a la puerta */
export const APROX_ENTRADA: Vec2 = [78.18, 81.97];

/** camino agrícola por fuera del lindero este, de la puerta hacia el norte */
export const CAMINO_EXTERIOR: Vec2[] = [[87.57, 83.38], [94.28, 38.88], [101.73, -10.56]];

/** aplica AJUSTE_FOTO a un punto de la foto */
export const ajustarFoto = ([x, y]: Vec2): Vec2 => {
  const [a, b, c, d, e, f, g, h, i] = AJUSTE_FOTO;
  const w = g * x + h * y + i;
  return [Math.round(((a * x + b * y + c) / w) * 10) / 10, Math.round(((d * x + e * y + f) / w) * 10) / 10];
};
