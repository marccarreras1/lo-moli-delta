import type { Outdoor } from '../data/types';
import { inPit } from './pits';

/** cota de la superficie exterior en un punto: la de la solera elevada que lo cubre (fuera del alcorque) o el terreno */
export function groundTopAt(outdoor: Outdoor | undefined, x: number, y: number): number {
  let best = 0;
  for (const p of outdoor?.pavements ?? []) {
    if (p.joints === 0 || !p.top) continue;
    const [x0, y0, x1, y1] = p.rect;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    if (inPit(p, x, y)) continue;
    best = Math.max(best, p.top);
  }
  return best;
}
