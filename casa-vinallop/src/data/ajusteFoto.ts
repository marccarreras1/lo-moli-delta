/**
 * Corrección de la foto de dron con el lindero catastral (scripts/ajuste_catastro.py). Generado: no editar a mano.
 * AJUSTE_FOTO lleva el suelo de la foto (olivar.ts) al del modelo; ENTRADA_FINCA es la puerta, junto a la esquina sureste.
 */
import type { Vec2 } from './types';

export const AJUSTE_FOTO: number[] = [0.9321813, 0.0217201, 0.1982508, 0.0024157, 1.0640657, -0.2568635, -0.0019898, -0.0024722, 1.0];

/** puerta de la finca, sobre el lindero este junto a la esquina sureste */
export const ENTRADA_FINCA: Vec2 = [83.38, 87.70];

/** punto del camino, por dentro, desde el que se llega perpendicular a la puerta */
export const APROX_ENTRADA: Vec2 = [77.45, 86.81];

/** camino agrícola por fuera del lindero este, de la puerta hacia el norte */
export const CAMINO_EXTERIOR: Vec2[] = [[86.84, 88.23], [93.55, 43.73], [101.0, -5.71]];

/** aplica AJUSTE_FOTO a un punto de la foto */
export const ajustarFoto = ([x, y]: Vec2): Vec2 => {
  const [a, b, c, d, e, f, g, h, i] = AJUSTE_FOTO;
  const w = g * x + h * y + i;
  return [Math.round(((a * x + b * y + c) / w) * 10) / 10, Math.round(((d * x + e * y + f) / w) * 10) / 10];
};
