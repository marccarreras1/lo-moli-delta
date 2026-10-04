/**
 * Exterior del proyecto: comedor bajo el algarrobo (decisión confirmada; medidas orientativas).
 * Solera clara con juntas y canto, recortada alrededor del tronco para dejar zona permeable;
 * transición de grava; farol cálido con soporte propio; muebles a escala.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { DesignOptions, Furniture, Outdoor, OutdoorPavement, Vec2 } from '../data/types';
import { Furniture3D } from './Furniture3D';
import { WARM } from './Lamps';
import type { MaterialSet } from './materials';

/** cota de la cara superior de la solera exterior */
const TOP = -0.05;

/** contorno de la solera: rectángulo con el alcorque recortado (los puntos dentro del círculo se llevan a su borde) */
function outline(p: OutdoorPavement): Vec2[] {
  const [x0, y0, x1, y1] = p.rect;
  const pts: Vec2[] = [];
  const step = 0.05;
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  };
  edge(x0, y0, x1, y0);
  edge(x1, y0, x1, y1);
  edge(x1, y1, x0, y1);
  edge(x0, y1, x0, y0);
  if (!p.permeable) return pts;
  const { c, r } = p.permeable;
  return pts.map(([x, y]) => {
    const d = Math.hypot(x - c[0], y - c[1]);
    if (d >= r) return [x, y] as Vec2;
    // los puntos interiores del rectángulo dentro del círculo se proyectan al círculo
    const k = r / Math.max(d, 1e-6);
    return [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k] as Vec2;
  });
}

function Pavement({ p, mats }: { p: OutdoorPavement; mats: MaterialSet }) {
  const gravel = p.joints === 0;
  const thick = gravel ? 0.03 : 0.1;
  const top = gravel ? TOP - 0.02 : TOP;
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const pts = gravel ? (() => { const [x0, y0, x1, y1] = p.rect; return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Vec2[]; })() : outline(p);
    pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, -y) : s.lineTo(x, -y)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: !gravel, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [p, gravel, thick]);
  // juntas de dilatación: tramos cortos que se omiten dentro del alcorque
  const joints = useMemo(() => {
    if (gravel || p.joints <= 0) return null;
    const [x0, y0, x1, y1] = p.rect;
    const segs: { x: number; y: number; w: number; d: number }[] = [];
    const inside = (x: number, y: number) => !!p.permeable && Math.hypot(x - p.permeable.c[0], y - p.permeable.c[1]) < p.permeable.r + 0.02;
    const piece = 0.1;
    for (let x = x0 + p.joints; x < x1 - 1e-6; x += p.joints)
      for (let y = y0; y < y1 - 1e-6; y += piece) if (!inside(x, y + piece / 2)) segs.push({ x, y: y + piece / 2, w: 0.008, d: piece });
    for (let y = y0 + p.joints; y < y1 - 1e-6; y += p.joints)
      for (let x = x0; x < x1 - 1e-6; x += piece) if (!inside(x + piece / 2, y)) segs.push({ x: x + piece / 2, y, w: piece, d: 0.008 });
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.004, 1), mats.poche, Math.max(1, segs.length));
    const o = new THREE.Object3D();
    segs.forEach((sg, i) => {
      o.position.set(sg.x, top + 0.002, sg.y);
      o.scale.set(sg.w, 1, sg.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = segs.length;
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, [p, gravel, top, mats.poche]);
  useEffect(() => () => { geo.dispose(); joints?.geometry.dispose(); }, [geo, joints]);
  return (
    <group>
      <mesh geometry={geo} position={[0, top - thick, 0]} material={gravel ? mats.gravel : mats.concrete} receiveShadow castShadow={!gravel} />
      {joints && <primitive object={joints} />}
    </group>
  );
}

function Lantern({ c, h, mats, level }: { c: Vec2; h: number; mats: MaterialSet; level: number }) {
  return (
    <group position={[c[0], TOP, c[1]]}>
      <mesh position={[0, 0.03, 0]} material={mats.blackMetal}><cylinderGeometry args={[0.12, 0.14, 0.06, 16]} /></mesh>
      <mesh position={[0, h / 2, 0]} material={mats.blackMetal} castShadow><cylinderGeometry args={[0.025, 0.03, h, 10]} /></mesh>
      <group position={[0, h, 0]}>
        <mesh material={mats.glass}><boxGeometry args={[0.2, 0.3, 0.2]} /></mesh>
        <mesh position={[0, 0.17, 0]} material={mats.blackMetal}><coneGeometry args={[0.17, 0.12, 4]} /></mesh>
        <mesh material={mats.lampGlow}><sphereGeometry args={[0.05, 12, 8]} /></mesh>
        <pointLight color={WARM} intensity={level * 4} distance={9} decay={2} castShadow={false} />
      </group>
    </group>
  );
}

export function Outdoor3D({ outdoor, mats, options, level, selectedId, onSelect }: {
  outdoor: Outdoor; mats: MaterialSet; options: DesignOptions; level: number; selectedId?: string | null; onSelect?: (id: string) => void;
}) {
  const elevationOf = (_f: Furniture) => TOP;
  return (
    <group>
      {outdoor.pavements.map((p) => <Pavement key={p.id} p={p} mats={mats} />)}
      <Furniture3D items={outdoor.furniture} mats={mats} elevationOf={elevationOf} options={options} selectedId={selectedId} onSelect={onSelect} />
      {outdoor.lights.map((l) => <Lantern key={l.id} c={l.c} h={l.h} mats={mats} level={level} />)}
    </group>
  );
}
