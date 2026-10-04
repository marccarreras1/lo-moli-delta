import { Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { DataStatus, Layout } from '../data/types';
import { centroid, fmtM, pointOnWall, polygonArea, wallNormal } from '../model/geometry';
import { STATUS_STYLE } from '../ui/status';

/** Etiqueta dibujada en el propio canvas WebGL (sale en la exportación PNG). */
export function Label3D({ position, text, sub, color = '#2b2a27', size = 0.32, depthTest = true }: {
  position: [number, number, number]; text: string; sub?: string; color?: string; size?: number; depthTest?: boolean;
}) {
  const { tex, aspect } = useMemo(() => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const fs = 44;
    const font = `600 ${fs}px Inter, "Segoe UI", system-ui, sans-serif`;
    const subFont = `400 ${fs * 0.72}px Inter, "Segoe UI", system-ui, sans-serif`;
    ctx.font = font;
    const w1 = ctx.measureText(text).width;
    ctx.font = subFont;
    const w2 = sub ? ctx.measureText(sub).width : 0;
    const pad = 18;
    c.width = Math.ceil(Math.max(w1, w2) + pad * 2);
    c.height = Math.ceil(fs * (sub ? 2.1 : 1.35) + pad);
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(251,250,247,0.88)';
    const r = 14;
    g.beginPath();
    g.roundRect(0, 0, c.width, c.height, r);
    g.fill();
    g.fillStyle = color;
    g.font = font;
    g.textBaseline = 'top';
    g.fillText(text, pad, pad * 0.7);
    if (sub) {
      g.font = subFont;
      g.fillStyle = '#6b665d';
      g.fillText(sub, pad, pad * 0.7 + fs * 1.1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { tex: t, aspect: c.width / c.height };
  }, [text, sub, color]);
  useEffect(() => () => tex.dispose(), [tex]);
  const h = size * (sub ? 1.6 : 1);
  return (
    <sprite position={position} scale={[h * aspect, h, 1]} renderOrder={10}>
      <spriteMaterial map={tex} depthTest={depthTest} depthWrite={false} transparent />
    </sprite>
  );
}

function Dim({ a, b, label, status, offsetLabel, onTop = false }: { a: [number, number, number]; b: [number, number, number]; label: string; status: DataStatus; offsetLabel: [number, number, number]; onTop?: boolean }) {
  const st = STATUS_STYLE[status];
  const mid: [number, number, number] = [(a[0] + b[0]) / 2 + offsetLabel[0], (a[1] + b[1]) / 2 + offsetLabel[1], (a[2] + b[2]) / 2 + offsetLabel[2]];
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  const perp = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(0.15, 0, 0) : new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.15);
  const tick = (p: [number, number, number]): [number, number, number][] => [
    [p[0] - perp.x, p[1], p[2] - perp.z], [p[0] + perp.x, p[1], p[2] + perp.z],
  ];
  return (
    <group>
      <Line points={[a, b]} color={st.color} lineWidth={1.4} dashed={!!st.dash3d} dashSize={st.dash3d?.[0] ?? 1} gapSize={st.dash3d?.[1] ?? 0} />
      <Line points={tick(a)} color={st.color} lineWidth={1.4} />
      <Line points={tick(b)} color={st.color} lineWidth={1.4} />
      <Label3D position={mid} text={label} sub={st.label.toLowerCase()} color={st.color} size={0.26} depthTest={!onTop} />
    </group>
  );
}

export function Annotations({ layout, showLabels, showDims, showAreas, roomLabelsVisible, selectedOpeningId }: {
  layout: Layout; showLabels: boolean; showDims: boolean; showAreas: boolean; roomLabelsVisible: boolean; selectedOpeningId: string | null;
}) {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const H = layout.levels[0]?.wallHeight ?? 2.5;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const measure = (id: string) => layout.measures.find((m) => m.id === id);
  const sel = layout.openings.find((o) => o.id === selectedOpeningId);
  const selWall = sel && layout.walls.find((w) => w.id === sel.wallId);
  return (
    <group>
      {showLabels && (
        <>
          {Object.entries(layout.facades).map(([fid, name]) => {
            const w = layout.walls.find((x) => x.facade === fid);
            if (!w) return null;
            const mid = pointOnWall(w, Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) / 2);
            const n = wallNormal(w);
            const sgn = (cx - mid[0]) * n[0] + (cy - mid[1]) * n[1] > 0 ? -1 : 1;
            return <Label3D key={fid} position={[mid[0] + n[0] * sgn * 2.2, 0.35, mid[1] + n[1] * sgn * 2.2]} text={name} size={0.32} />;
          })}
          {roomLabelsVisible &&
            layout.rooms.map((r) => {
              const [x, y] = centroid(r.polygon);
              return (
                <Label3D key={r.id} position={[x, 1.2, y]} text={r.name}
                  sub={showAreas ? `${fmtM(polygonArea(r.polygon), 1)} m² calculados` : undefined} size={0.3} />
              );
            })}
        </>
      )}
      {showDims && (
        <>
          <Dim a={[minX, 0.02, maxY + 1.0]} b={[maxX, 0.02, maxY + 1.0]} label={`${fmtM(maxX - minX)} m`} status={measure('largo')?.status ?? 'interpretado'} offsetLabel={[0, 0.3, 0.35]} />
          <Dim a={[minX - 1.0, 0.02, minY]} b={[minX - 1.0, 0.02, maxY]} label={`${fmtM(maxY - minY)} m`} status={measure('ancho')?.status ?? 'interpretado'} offsetLabel={[-0.4, 0.3, 0]} />
          <Dim a={[maxX + 0.6, 0, maxY + 0.6]} b={[maxX + 0.6, H, maxY + 0.6]} label={`${fmtM(H)} m`} status={measure('altura')?.status ?? 'pendiente'} offsetLabel={[0.5, 0, 0]} />
        </>
      )}
      {sel && selWall && (() => {
        const out = selWall.thickness / 2 + 0.2;
        const n = wallNormal(selWall);
        const sgn = (cx - pointOnWall(selWall, 0)[0]) * n[0] + (cy - pointOnWall(selWall, 0)[1]) * n[1] > 0 ? -1 : 1;
        const p0 = pointOnWall(selWall, sel.offset, out * sgn);
        const p1 = pointOnWall(selWall, sel.offset + sel.width, out * sgn);
        const z = sel.sill + sel.height + 0.25;
        return <Dim a={[p0[0], z, p0[1]]} b={[p1[0], z, p1[1]]} label={`${sel.label} · ${fmtM(sel.width)} m`} status={sel.status} offsetLabel={[0, 0.25, 0]} onTop />;
      })()}
    </group>
  );
}
