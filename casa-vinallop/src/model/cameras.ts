/**
 * Cámaras guardadas, calculadas desde la geometría (se adaptan si cambian las medidas).
 * Coordenadas: [x, y_planta, altura].
 */
import type { CameraPreset, Layout } from '../data/types';
import { bbox, centroid, doorSwing, furnitureFootprint, pointInPolygon, pointOnWall, wallNormal } from './geometry';

export function cameraPresets(layout: Layout): CameraPreset[] {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const L = maxX - minX;
  const W = maxY - minY;
  if (L <= 0 || W <= 0) return [];
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const R = Math.max(L, W);
  const list: CameraPreset[] = [
    { id: 'general', label: 'Vista general', group: 'exterior', position: [cx + R * 0.8, minY - R * 1.3, R * 0.85], target: [cx, cy, Math.min(2.5, layout.topHeight * 0.3)] },
  ];
  // una vista por cada fachada identificada (sin puntos cardinales)
  for (const [fid, name] of Object.entries(layout.facades)) {
    const w = layout.walls.find((x) => x.facade === fid);
    if (!w) continue;
    const mid = pointOnWall(w, Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) / 2);
    let n = wallNormal(w);
    if ((cx - mid[0]) * n[0] + (cy - mid[1]) * n[1] > 0) n = [-n[0], -n[1]];
    const d = R * 1.6;
    list.push({ id: `fachada-${fid}`, label: name, group: 'exterior', position: [mid[0] + n[0] * d, mid[1] + n[1] * d, 1.7], target: [mid[0], mid[1], 1.4] });
  }
  list.push({ id: 'cenital', label: 'Cenital', group: 'planta', position: [cx, cy + 0.001, R * 1.7], target: [cx, cy, 0] });
  // interiores: desde la esquina más despejada de cada estancia, mirando a la opuesta
  const obstacles = [
    ...layout.furniture.filter((f) => f.type !== 'alfombra').map((f) => furnitureFootprint(f)),
    ...layout.stairs.map((st) => [[st.rect[0], st.rect[1]], [st.rect[2], st.rect[1]], [st.rect[2], st.rect[3]], [st.rect[0], st.rect[3]]] as [number, number][]),
    ...layout.openings.flatMap((o) => {
      const w = layout.walls.find((x) => x.id === o.wallId);
      const sw = w ? doorSwing(o, w) : null;
      return sw ? [sw.zone] : [];
    }),
  ];
  /** distancia al obstáculo más próximo (muestreando sus bordes); -1 si cae dentro */
  const clearance = (p: [number, number]) => {
    let best = Infinity;
    for (const poly of obstacles) {
      if (pointInPolygon(p, poly)) return -1;
      for (let i = 0; i < poly.length; i++) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        for (let t = 0; t <= 1; t += 0.1) best = Math.min(best, Math.hypot(ax + (bx - ax) * t - p[0], ay + (by - ay) * t - p[1]));
      }
    }
    return best;
  };
  // interiores: punto despejado cerca del borde de la estancia, mirando a través de ella
  for (const r of layout.rooms) {
    const b = bbox(r.polygon);
    const c = centroid(r.polygon);
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    if (w < 1 || h < 1) continue;
    const m = Math.min(0.4, w / 4, h / 4);
    let pos: [number, number] = [c[0], c[1]];
    let score = -Infinity;
    for (let x = b.minX + m; x <= b.maxX - m + 1e-6; x += 0.2)
      for (let y = b.minY + m; y <= b.maxY - m + 1e-6; y += 0.2) {
        const p: [number, number] = [x, y];
        if (!pointInPolygon(p, r.polygon)) continue;
        const cl = clearance(p);
        if (cl < Math.min(0.5, Math.min(w, h) / 4)) continue;
        const sc = Math.hypot(x - c[0], y - c[1]) + 0.3 * Math.min(cl, 1.5);
        if (sc > score) {
          score = sc;
          pos = p;
        }
      }
    const tx = c[0] + (c[0] - pos[0]) * 0.6;
    const ty = c[1] + (c[1] - pos[1]) * 0.6;
    const elevation = layout.levels.find((l) => l.id === r.levelId)?.elevation ?? 0;
    list.push({
      id: `int-${r.id}`, label: r.name, group: 'interior', eyeLevel: true, roomId: r.id, elevation,
      position: [pos[0], pos[1], 1.6], target: [tx, ty, 1.2],
    });
  }
  // altell parcial: mirador hacia la zona de doble altura
  for (const r of layout.rooms) {
    const lvl = layout.levels.find((l) => l.id === r.levelId);
    if (!lvl || lvl.elevation <= 0) continue;
    const b = bbox(r.polygon);
    if (maxX - b.maxX < 2) continue;
    const cyr = (b.minY + b.maxY) / 2;
    list.push({
      id: `mirador-${r.id}`, label: `${r.name} → doble altura`, group: 'interior', eyeLevel: true, roomId: r.id, elevation: lvl.elevation,
      position: [Math.max(b.minX + 0.6, b.maxX - 2.2), cyr, 1.6], target: [maxX - 1, cyr, 0.2],
    });
  }
  const glass = layout.openings.find((o) => o.kind === 'cristalera');
  const gw = glass && layout.walls.find((x) => x.id === glass.wallId);
  if (glass && gw) {
    const mid = pointOnWall(gw, glass.offset + glass.width / 2);
    let n = wallNormal(gw);
    if ((cx - mid[0]) * n[0] + (cy - mid[1]) * n[1] > 0) n = [-n[0], -n[1]];
    list.push({ id: 'ext-cristalera', label: `Exterior → ${glass.label.toLowerCase()}`, group: 'interior', eyeLevel: true, position: [mid[0] + n[0] * 5, mid[1] + n[1] * 5, 1.6], target: [mid[0], mid[1], 1.3] });
  }
  return list;
}
