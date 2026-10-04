/**
 * Cámaras guardadas, calculadas desde la geometría (se adaptan si cambian las medidas).
 * Coordenadas: [x, y_planta, altura].
 */
import type { CameraPreset, Layout } from '../data/types';
import { bbox, centroid, pointOnWall, wallNormal } from './geometry';

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
  // interiores: desde una esquina de cada estancia mirando a la opuesta
  for (const r of layout.rooms) {
    const b = bbox(r.polygon);
    const c = centroid(r.polygon);
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    if (w < 1 || h < 1) continue;
    const m = Math.min(0.45, w / 4, h / 4);
    const elevation = layout.levels.find((l) => l.id === r.levelId)?.elevation ?? 0;
    list.push({
      id: `int-${r.id}`, label: r.name, group: 'interior', eyeLevel: true, roomId: r.id, elevation,
      position: [b.maxX - m, b.minY + m, 1.6], target: [c[0] - w * 0.3, c[1] + h * 0.3, 1.2],
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
