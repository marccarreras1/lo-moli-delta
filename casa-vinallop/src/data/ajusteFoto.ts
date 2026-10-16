/**
 * Corrección de la foto de dron con el lindero catastral (scripts/ajuste_catastro.py). Generado: no editar a mano.
 * AJUSTE_FOTO lleva el suelo de la foto (olivar.ts) al del modelo; ENTRADA_FINCA es la puerta, en la esquina sureste.
 */
import type { Vec2 } from './types';

export const AJUSTE_FOTO: number[] = [0.9314908, 0.021289, 0.2034021, 0.0029376, 1.0693598, -0.2752928, -0.0019989, -0.0025104, 1.0];

export const ENTRADA_FINCA: Vec2 = [80.37, 88.37];

/** aplica AJUSTE_FOTO a un punto de la foto */
export const ajustarFoto = ([x, y]: Vec2): Vec2 => {
  const [a, b, c, d, e, f, g, h, i] = AJUSTE_FOTO;
  const w = g * x + h * y + i;
  return [Math.round(((a * x + b * y + c) / w) * 10) / 10, Math.round(((d * x + e * y + f) / w) * 10) / 10];
};
