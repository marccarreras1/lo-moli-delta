/**
 * Exterior del proyecto: solera continua en L (confirmada) a lo largo del frontal B y del lateral del
 * algarrobo, con juntas, canto, canaleta de evacuación (propuesta) y alcorque permeable alrededor del
 * tronco; transición de grava; comedor bajo el algarrobo con lámpara de cúpula (referencia 11).
 */
import { Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { DesignOptions, Furniture, Outdoor, OutdoorPavement, Vec2 } from '../data/types';
import { AMBER } from '../ui/status';
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

/** Recorta los tramos de la solera en L para que la esquina común se dibuje una sola vez. */
function renderRects(pavements: OutdoorPavement[]): OutdoorPavement[] {
  const done: OutdoorPavement[] = [];
  return pavements.map((p) => {
    if (p.joints === 0) return p;
    let [x0, y0, x1, y1] = p.rect;
    for (const q of done) {
      const [a0, b0, a1, b1] = q.rect;
      const spansY = b0 <= y0 + 1e-6 && b1 >= y1 - 1e-6;
      const spansX = a0 <= x0 + 1e-6 && a1 >= x1 - 1e-6;
      if (spansY && a0 > x0 && a0 < x1 && a1 >= x1 - 1e-6) x1 = a0;
      else if (spansY && a1 > x0 && a1 < x1 && a0 <= x0 + 1e-6) x0 = a1;
      else if (spansX && b0 > y0 && b0 < y1 && b1 >= y1 - 1e-6) y1 = b0;
      else if (spansX && b1 > y0 && b1 < y1 && b0 <= y0 + 1e-6) y0 = b1;
    }
    const r = { ...p, rect: [x0, y0, x1, y1] as OutdoorPavement['rect'] };
    done.push(p);
    return r;
  });
}

/** Alcorque: zona permeable con grava suelta y pletina de acero en el borde. */
function TreePit({ c, r, mats }: { c: Vec2; r: number; mats: MaterialSet }) {
  return (
    <group position={[c[0], TOP, c[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]} material={mats.gravel} receiveShadow><circleGeometry args={[r, 48]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} material={mats.blackMetal}><ringGeometry args={[r - 0.012, r + 0.004, 64]} /></mesh>
    </group>
  );
}

/** Canaleta lineal con rejilla (propuesta de evacuación). */
function Drain({ a, b, mats }: { a: Vec2; b: Vec2; mats: MaterialSet }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return (
    <group position={[(a[0] + b[0]) / 2, TOP + 0.001, (a[1] + b[1]) / 2]} rotation={[0, -ang, 0]}>
      <mesh material={mats.blackMetal} receiveShadow><boxGeometry args={[len, 0.004, 0.12]} /></mesh>
    </group>
  );
}

/**
 * Lámpara de cúpula de metal oscuro sobre el centro de la mesa (referencia 11). Cuelga de una rama del
 * algarrobo o de un pie independiente; el anclaje sin resolver se marca en ámbar (no sale en las fotos).
 */
function DomeLamp({ lamp, mode, mats, level }: { lamp: NonNullable<Outdoor['domeLamp']>; mode: 'arbol' | 'soporte'; mats: MaterialSet; level: number }) {
  const r = lamp.diameter / 2;
  const hDome = r * 0.55;
  const top = lamp.bottom + hDome;
  const profile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push(new THREE.Vector2(r * Math.sin((t * Math.PI) / 2) * 0.98 + 0.02 * t, hDome * Math.cos((t * Math.PI) / 2)));
    }
    pts.push(new THREE.Vector2(r + 0.01, -0.01));
    return pts;
  }, [r, hDome]);
  const geo = useMemo(() => new THREE.LatheGeometry(profile, 48), [profile]);
  useEffect(() => () => geo.dispose(), [geo]);
  const [cx, cz] = lamp.c;
  const anchor: [number, number, number] = mode === 'arbol' ? [lamp.treeAnchor.c[0], lamp.treeAnchor.h, lamp.treeAnchor.c[1]] : [cx, 2.95, cz];
  const postH = 3.05;
  return (
    <group>
      <group position={[cx, lamp.bottom, cz]}>
        <mesh geometry={geo} material={mats.blackMetal} castShadow />
        <mesh position={[0, hDome + 0.04, 0]} material={mats.blackMetal}><cylinderGeometry args={[0.035, 0.045, 0.08, 16]} /></mesh>
        <mesh position={[0, 0.06, 0]} material={mats.lampGlow}><sphereGeometry args={[0.06, 16, 10]} /></mesh>
        <pointLight position={[0, 0.02, 0]} color={WARM} intensity={level * 6} distance={7} decay={2} castShadow={false} />
      </group>
      {/* cable textil oscuro */}
      <mesh position={[(cx + anchor[0]) / 2, (top + 0.08 + anchor[1]) / 2, (cz + anchor[2]) / 2]} material={mats.blackMetal}
        quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(anchor[0] - cx, anchor[1] - top - 0.08, anchor[2] - cz).normalize())}>
        <cylinderGeometry args={[0.005, 0.005, Math.hypot(anchor[0] - cx, anchor[1] - top - 0.08, anchor[2] - cz), 6]} />
      </mesh>
      {mode === 'soporte' && (
        <group>
          {/* pie independiente de acero oscuro con brazo hasta el centro de la mesa */}
          <mesh position={[lamp.post[0], TOP + 0.02, lamp.post[1]]} material={mats.blackMetal}><cylinderGeometry args={[0.16, 0.18, 0.04, 20]} /></mesh>
          <mesh position={[lamp.post[0], postH / 2, lamp.post[1]]} material={mats.blackMetal} castShadow><cylinderGeometry args={[0.03, 0.035, postH, 12]} /></mesh>
          <ArmBetween a={[lamp.post[0], postH - 0.1, lamp.post[1]]} b={[cx, 2.95, cz]} mats={mats} />
        </group>
      )}
      {/* anclaje sin resolver (ayuda visual; se oculta en el modo fotografía) */}
      <Line points={[[anchor[0] - 0.12, anchor[1], anchor[2]], [anchor[0] + 0.12, anchor[1], anchor[2]]]} color={AMBER} lineWidth={3} />
      <Line points={[[anchor[0], anchor[1] - 0.12, anchor[2]], [anchor[0], anchor[1] + 0.12, anchor[2]]]} color={AMBER} lineWidth={3} />
    </group>
  );
}

function ArmBetween({ a, b, mats }: { a: [number, number, number]; b: [number, number, number]; mats: MaterialSet }) {
  const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
  return (
    <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={q} material={mats.blackMetal} castShadow>
      <cylinderGeometry args={[0.022, 0.022, v.length(), 10]} />
    </mesh>
  );
}

export function Outdoor3D({ outdoor, mats, options, level, selectedId, onSelect }: {
  outdoor: Outdoor; mats: MaterialSet; options: DesignOptions; level: number; selectedId?: string | null; onSelect?: (id: string) => void;
}) {
  const elevationOf = (_f: Furniture) => TOP;
  return (
    <group>
      {renderRects(outdoor.pavements).map((p) => <Pavement key={p.id} p={p} mats={mats} />)}
      {outdoor.pavements.filter((p) => p.permeable).map((p) => <TreePit key={`al-${p.id}`} c={p.permeable!.c} r={p.permeable!.r} mats={mats} />)}
      {(outdoor.drains ?? []).map((d) => <Drain key={d.id} a={d.a} b={d.b} mats={mats} />)}
      {outdoor.domeLamp && <DomeLamp lamp={outdoor.domeLamp} mode={options.lamparaExterior} mats={mats} level={level} />}
      <Furniture3D items={outdoor.furniture} mats={mats} elevationOf={elevationOf} options={options} selectedId={selectedId} onSelect={onSelect} />
      {level > 0.05 && outdoor.furniture.filter((f) => f.type === 'aplique').map((f) => (
        <pointLight key={`l-${f.id}`} position={[f.x, TOP + f.h + 0.05, f.y + 0.12]} color={WARM} intensity={level * 1.6} distance={6} decay={2} />
      ))}
    </group>
  );
}
