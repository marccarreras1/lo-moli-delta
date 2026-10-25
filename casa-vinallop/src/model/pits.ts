import type { OutdoorPavement, Vec2 } from '../data/types';

/** zonas sin pavimentar de una solera: el alcorque del borde y los alcorques interiores */
export const pitsOf = (p: Pick<OutdoorPavement, 'permeable' | 'pits'>): { c: Vec2; r: number }[] => [...(p.permeable ? [p.permeable] : []), ...(p.pits ?? [])];
export const inPit = (p: Pick<OutdoorPavement, 'permeable' | 'pits'>, x: number, y: number, extra = 0) => pitsOf(p).some((h) => Math.hypot(x - h.c[0], y - h.c[1]) < h.r + extra);
