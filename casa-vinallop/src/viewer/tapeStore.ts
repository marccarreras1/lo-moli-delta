/**
 * Cinta métrica del visor 3D: puntos picados sobre el modelo (coordenadas de la escena, en metros).
 * Cada par de puntos es una medida. Es solo de visualización: no se guarda en el proyecto.
 */
import { create } from 'zustand';

export type P3 = [number, number, number];

export const useTape = create<{ on: boolean; pts: P3[]; toggle: () => void; clear: () => void; add: (p: P3) => void; undo: () => void }>((set) => ({
  on: false,
  pts: [],
  toggle: () => set((s) => ({ on: !s.on, pts: s.on ? [] : s.pts })),
  clear: () => set({ pts: [] }),
  add: (p) => set((s) => ({ pts: [...s.pts, p].slice(-40) })),
  undo: () => set((s) => ({ pts: s.pts.slice(0, -1) })),
}));

/** distancia total y componentes horizontal y vertical */
export function tapeDistance(a: P3, b: P3) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return { d: Math.hypot(dx, dy, dz), h: Math.hypot(dx, dz), v: Math.abs(dy) };
}
