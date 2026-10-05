import { describe, expect, it } from 'vitest';
import { PARCELA } from '../data/parcela';
import { VINALLOP } from '../data/vinallop';
import { resolveLayout } from '../model/resolve';
import { baseVariant } from '../state/store';
import { buildTree } from '../viewer/Trees';

describe('algarrobo', () => {
  it('ni ramas ni hojas entran en la casa (se podan)', () => {
    const l = resolveLayout(VINALLOP, baseVariant());
    const t = PARCELA.trees[0];
    const { minX, minY, maxX, maxY } = l.bounds;
    const top = Math.max(...l.walls.map((w) => w.height));
    const box: [number, number, number, number, number] = [minX - t.c[0], minY - t.c[1], maxX - t.c[0], maxY - t.c[1], top + 0.72];
    const g = buildTree('algarrobo', 7, t.r * 2, t.h, [box]);
    for (const geo of [g.wood, g.leaves]) {
      const p = geo.getAttribute('position');
      let n = 0;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (x > box[0] && x < box[2] && z > box[1] && z < box[3] && y > 0.1 && y < box[4] - 0.1) n++;
      }
      expect(n).toBe(0);
    }
  });
});
