import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Opening, Vec2, Wall } from '../data/types';
import { pointOnWall, wallDir, wallNormal } from '../model/geometry';
import { FRAME, LEAF_T, leafPose, type LeafPose } from '../model/openings';
import type { MaterialSet } from './materials';

const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Carpintería en su hueco real: marco + hojas animadas según su sistema. */
export function Opening3D({ o, w, mats, center, fraction, selected, onSelect }: {
  o: Opening; w: Wall; mats: MaterialSet; center: Vec2; fraction: number; selected: boolean; onSelect: () => void;
}) {
  const [f, setF] = useState(fraction);
  const cur = useRef(fraction);
  useFrame((_, dt) => {
    const d = fraction - cur.current;
    if (d === 0) return;
    cur.current = reduceMotion || Math.abs(d) < 1e-3 ? fraction : cur.current + Math.sign(d) * Math.min(Math.abs(d), dt * 0.9);
    setF(cur.current);
  });

  const d = wallDir(w);
  const n = wallNormal(w);
  const mid = pointOnWall(w, o.offset + o.width / 2);
  const inward: 1 | -1 = (center[0] - mid[0]) * n[0] + (center[1] - mid[1]) * n[1] > 0 ? 1 : -1;
  const rotWall = -Math.atan2(d[1], d[0]);
  const isDoor = o.kind === 'puerta';
  const H = o.height - FRAME;
  const zMid = o.sill + (isDoor ? 0 : FRAME) + (isDoor ? H : o.height - 2 * FRAME) / 2;
  const leafH = isDoor ? H : o.height - 2 * FRAME;
  const sys = o.system;

  let leaves: LeafPose[] = [];
  if (sys) {
    const dir = sys.type === 'abatible' ? (o.swing?.dir ?? inward) : 1;
    const pose = leafPose(sys.type, sys.leaves, o.width, sys.type === 'fijo' ? 0 : f, dir);
    leaves = pose.leaves;
    if (sys.type === 'abatible' && sys.leaves === 1 && o.swing?.hinge === 'fin')
      leaves = leaves.map((l) => ({ ...l, s: pose.clear - l.s, angle: 180 - l.angle }));
    if (sys.type === 'plegable' && inward === 1) leaves = leaves.map((l) => ({ ...l, depth: -l.depth, angle: -l.angle }));
  }

  // hueco de paso: sin marco ni hojas, solo una zona invisible para poder seleccionarlo
  if (o.kind === 'paso') {
    return (
      <mesh position={[mid[0], o.sill + o.height / 2, mid[1]]} rotation={[0, rotWall, 0]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[o.width, o.height, w.thickness]} />
        <meshBasicMaterial transparent opacity={selected ? 0.18 : 0} color="#68765e" depthWrite={false} />
      </mesh>
    );
  }

  const click = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect();
  };
  const frameMat = selected ? mats.selection : mats.carpentry;
  const depth = w.thickness * 0.6;
  return (
    <group onClick={click}>
      <group position={[mid[0], o.sill + o.height / 2, mid[1]]} rotation={[0, rotWall, 0]}>
        <mesh position={[0, o.height / 2 - FRAME / 2, 0]} material={frameMat}><boxGeometry args={[o.width, FRAME, depth]} /></mesh>
        {!isDoor && <mesh position={[0, -o.height / 2 + FRAME / 2, 0]} material={frameMat}><boxGeometry args={[o.width, FRAME, depth]} /></mesh>}
        <mesh position={[-o.width / 2 + FRAME / 2, 0, 0]} material={frameMat}><boxGeometry args={[FRAME, o.height, depth]} /></mesh>
        <mesh position={[o.width / 2 - FRAME / 2, 0, 0]} material={frameMat}><boxGeometry args={[FRAME, o.height, depth]} /></mesh>
        {!sys && !isDoor && (
          // sistema no definido: solo vidrio, sin hojas ni apertura
          <mesh material={mats.glass}><boxGeometry args={[o.width - 2 * FRAME, o.height - 2 * FRAME, 0.01]} /></mesh>
        )}
      </group>
      {leaves.map((leaf, i) => {
        const a = (leaf.angle * Math.PI) / 180;
        const u: Vec2 = [d[0] * Math.cos(a) + n[0] * Math.sin(a), d[1] * Math.cos(a) + n[1] * Math.sin(a)];
        const start = pointOnWall(w, o.offset + FRAME + leaf.s, leaf.depth);
        const c: Vec2 = [start[0] + (u[0] * leaf.width) / 2, start[1] + (u[1] * leaf.width) / 2];
        const rot = -Math.atan2(u[1], u[0]);
        if (isDoor)
          return (
            <mesh key={i} position={[c[0], zMid, c[1]]} rotation={[0, rot, 0]} material={mats.wood} castShadow>
              <boxGeometry args={[leaf.width - 0.01, leafH, 0.04]} />
            </mesh>
          );
        const p = 0.035;
        return (
          <group key={i} position={[c[0], zMid, c[1]]} rotation={[0, rot, 0]}>
            <mesh position={[0, leafH / 2 - p / 2, 0]} material={frameMat}><boxGeometry args={[leaf.width, p, LEAF_T]} /></mesh>
            <mesh position={[0, -leafH / 2 + p / 2, 0]} material={frameMat}><boxGeometry args={[leaf.width, p, LEAF_T]} /></mesh>
            <mesh position={[-leaf.width / 2 + p / 2, 0, 0]} material={frameMat} castShadow><boxGeometry args={[p, leafH, LEAF_T]} /></mesh>
            <mesh position={[leaf.width / 2 - p / 2, 0, 0]} material={frameMat} castShadow><boxGeometry args={[p, leafH, LEAF_T]} /></mesh>
            <mesh material={mats.glass}><boxGeometry args={[leaf.width - 2 * p, leafH - 2 * p, 0.01]} /></mesh>
          </group>
        );
      })}
    </group>
  );
}
