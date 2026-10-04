/**
 * Cinemática de carpinterías. Cada sistema se mueve como el real:
 * - abatible: cada hoja gira sobre su bisagra;
 * - corredera: las hojas se deslizan y se apilan en su carril;
 * - plegable: las hojas se pliegan en zigzag hacia los extremos;
 * - fijo: no se mueve.
 * Un 100 % de apertura nunca hace desaparecer hojas.
 */
import type { OpeningSystem } from '../data/types';

export const FRAME = 0.06;
export const OVERLAP = 0.05;
export const LEAF_T = 0.05;

export interface LeafPose {
  /** borde de arranque de la hoja, medido desde la cara interior del marco izquierdo */
  s: number;
  width: number;
  /** desplazamiento perpendicular al muro (+ hacia la normal del muro) */
  depth: number;
  /** giro en grados: 0 = en el plano del muro, sentido hacia +s; 90 = hacia la normal */
  angle: number;
}

export interface Pose {
  clear: number;
  leaves: LeafPose[];
  free: number;
  maxFree: number;
}

export const SYSTEM_LABEL: Record<OpeningSystem, string> = {
  abatible: 'Abatible',
  corredera: 'Corredera',
  plegable: 'Plegable',
  fijo: 'Fijo',
};

export const LEAF_OPTIONS: Record<OpeningSystem, number[]> = {
  abatible: [1, 2],
  corredera: [2, 4, 6],
  plegable: [4, 6, 8],
  fijo: [1, 2, 3, 4],
};

export function normalizeLeaves(system: OpeningSystem, leaves: number) {
  const opts = LEAF_OPTIONS[system];
  return opts.includes(leaves) ? leaves : opts.reduce((a, b) => (Math.abs(b - leaves) < Math.abs(a - leaves) ? b : a));
}

/**
 * @param inward sentido de apertura de las abatibles (+1 hacia la normal del muro, -1 al contrario)
 */
export function leafPose(system: OpeningSystem, leavesIn: number, width: number, fraction: number, inward: 1 | -1 = 1): Pose {
  const clear = Math.max(0, width - 2 * FRAME);
  const N = normalizeLeaves(system, leavesIn);
  const f = Math.max(0, Math.min(1, fraction));
  if (system === 'fijo') {
    const lw = clear / N;
    return { clear, free: 0, maxFree: 0, leaves: Array.from({ length: N }, (_, i) => ({ s: i * lw, width: lw, depth: 0, angle: 0 })) };
  }
  if (system === 'abatible') {
    const lw = clear / N;
    const a = f * 90 * inward;
    const leaves: LeafPose[] = [{ s: 0, width: lw, depth: 0, angle: a }];
    if (N === 2) leaves.push({ s: clear, width: lw, depth: 0, angle: 180 - a });
    const proj = (t: number) => lw * Math.cos((t * 90 * Math.PI) / 180);
    const free = clear - N * proj(f) - (f > 0 ? N * LEAF_T : 0);
    return { clear, leaves, free: f === 0 ? 0 : Math.max(0, free), maxFree: Math.max(0, clear - N * LEAF_T) };
  }
  const k = N / 2;
  if (system === 'corredera') {
    // apertura central telescópica: k hojas por lado, cada una en su carril
    const lw = (clear + (N - 1) * OVERLAP) / N;
    const step = lw - OVERLAP;
    const leaves: LeafPose[] = [];
    for (let i = 0; i < k; i++) {
      const s = i * step - i * step * f;
      const depth = (i - (k - 1) / 2) * (LEAF_T + 0.01);
      leaves.push({ s, width: lw, depth, angle: 0 });
      leaves.push({ s: clear - s - lw, width: lw, depth, angle: 0 });
    }
    const pack = (t: number) => lw + (k - 1) * step * (1 - t);
    const free = (t: number) => Math.max(0, clear - 2 * pack(t));
    return { clear, leaves, free: free(f), maxFree: free(1) };
  }
  // plegable hacia el exterior (normal del muro), k hojas por lado
  const lw = clear / N;
  const theta = f * 88;
  const rad = (theta * Math.PI) / 180;
  const leaves: LeafPose[] = [];
  for (let j = 0; j < k; j++) {
    const s = j * lw * Math.cos(rad);
    const depth = j % 2 === 0 ? 0 : lw * Math.sin(rad);
    const angle = j % 2 === 0 ? theta : -theta;
    leaves.push({ s, width: lw, depth, angle });
    leaves.push({ s: clear - s, width: lw, depth, angle: 180 - angle });
  }
  const stack = (t: number) => Math.max(k * lw * Math.cos((t * 88 * Math.PI) / 180), k * (LEAF_T + 0.015));
  return { clear, leaves, free: f === 0 ? 0 : Math.max(0, clear - 2 * stack(f)), maxFree: Math.max(0, clear - 2 * stack(1)) };
}
