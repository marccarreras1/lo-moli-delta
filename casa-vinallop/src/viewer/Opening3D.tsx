import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Opening, Vec2, Wall } from '../data/types';
import { pointOnWall, wallDir, wallNormal } from '../model/geometry';
import { FRAME, LEAF_T, leafPose, type LeafPose } from '../model/openings';
import type { MaterialSet } from './materials';
import { uvBox } from './textures';

const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Carpintería en su hueco real: marco + hojas animadas según su sistema. */
export function Opening3D({ o, w, mats, center, fraction, selected, onSelect, planks = false }: {
  o: Opening; w: Wall; mats: MaterialSet; center: Vec2; fraction: number; selected: boolean; onSelect: () => void;
  /** hoja de tablones verticales de madera natural (variante de la puerta de entrada) */
  planks?: boolean;
}) {
  const [f, setF] = useState(fraction);
  const cur = useRef(fraction);
  useFrame((_, dt) => {
    const d = fraction - cur.current;
    if (d === 0) return;
    cur.current = reduceMotion || Math.abs(d) < 1e-3 ? fraction : cur.current + Math.sign(d) * Math.min(Math.abs(d), dt * 0.9);
    setF(cur.current);
  });

  const own = useMemo(() => {
    if (!o.finishColor) return null;
    const m = mats.carpentry.clone();
    m.color.set(o.finishColor);
    return m;
  }, [o.finishColor, mats.carpentry]);
  useEffect(() => () => own?.dispose(), [own]);
  // vidrio mate (translúcido) para la puerta del baño
  const frosted = useMemo(() => (o.glazed === 'mate' ? new THREE.MeshPhysicalMaterial({ color: '#eef2f1', roughness: 0.55, metalness: 0, transmission: 0.5, transparent: true, opacity: 0.72, thickness: 0.01 }) : null), [o.glazed]);
  useEffect(() => () => frosted?.dispose(), [frosted]);
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
  const frameMat = selected ? mats.selection : own ?? mats.carpentry;
  // la puerta de entrada se coloca junto a la cara interior: el hueco exterior queda profundo y en sombra
  const inset = o.entrance ? inward * (w.thickness / 2 - 0.07) : 0;
  const depth = o.entrance ? 0.12 : w.thickness * 0.6;
  return (
    <group onClick={click}>
      <group position={[mid[0] + n[0] * inset, o.sill + o.height / 2, mid[1] + n[1] * inset]} rotation={[0, rotWall, 0]}>
        <mesh position={[0, o.height / 2 - FRAME / 2, 0]} material={frameMat}><boxGeometry args={[o.width, FRAME, depth]} /></mesh>
        {!isDoor && <mesh position={[0, -o.height / 2 + FRAME / 2, 0]} material={frameMat}><boxGeometry args={[o.width, FRAME, depth]} /></mesh>}
        <mesh position={[-o.width / 2 + FRAME / 2, 0, 0]} material={frameMat}><boxGeometry args={[FRAME, o.height, depth]} /></mesh>
        <mesh position={[o.width / 2 - FRAME / 2, 0, 0]} material={frameMat}><boxGeometry args={[FRAME, o.height, depth]} /></mesh>
        {!sys && !isDoor && (
          // sistema no definido: solo vidrio, sin hojas ni apertura
          <mesh material={mats.glass}><boxGeometry args={[o.width - 2 * FRAME, o.height - 2 * FRAME, 0.01]} /></mesh>
        )}
      </group>
      {o.shutters && !isDoor && [-1, 1].map((k) => {
        // contraventanas de lamas de madera, abiertas contra la fachada exterior
        const out = -inward * (w.thickness / 2 + 0.025);
        const p = pointOnWall(w, o.offset + o.width / 2 + k * (o.width * 0.75 + 0.02), out);
        const lh = o.height - 0.04;
        return (
          <group key={`sh${k}`} position={[p[0], o.sill + o.height / 2, p[1]]} rotation={[0, rotWall, 0]}>
            <mesh material={mats.carpentryWood} castShadow><boxGeometry args={[o.width / 2, lh, 0.03]} /></mesh>
            {Array.from({ length: Math.floor(lh / 0.07) }, (_, i) => (
              <mesh key={i} position={[0, -lh / 2 + 0.06 + i * 0.07, -inward * 0.02]} rotation={[-0.5 * inward, 0, 0]} material={mats.carpentryWood}><boxGeometry args={[o.width / 2 - 0.06, 0.05, 0.008]} /></mesh>
            ))}
          </group>
        );
      })}
      {leaves.map((leaf, i) => {
        const a = (leaf.angle * Math.PI) / 180;
        const u: Vec2 = [d[0] * Math.cos(a) + n[0] * Math.sin(a), d[1] * Math.cos(a) + n[1] * Math.sin(a)];
        const start = pointOnWall(w, o.offset + FRAME + leaf.s, leaf.depth + inset);
        const c: Vec2 = [start[0] + (u[0] * leaf.width) / 2, start[1] + (u[1] * leaf.width) / 2];
        const rot = -Math.atan2(u[1], u[0]);
        if (isDoor && !o.glazed) return <DoorLeaf key={i} c={c} y={zMid} rot={rot} width={leaf.width - 0.01} height={leafH} planks={planks} mats={own ? { ...mats, carpentry: own } : mats} handleLeft={leaf.angle > 90} />;
        const p = 0.035;
        return (
          <group key={i} position={[c[0], zMid, c[1]]} rotation={[0, rot, 0]}>
            <mesh position={[0, leafH / 2 - p / 2, 0]} material={frameMat}><boxGeometry args={[leaf.width, p, LEAF_T]} /></mesh>
            <mesh position={[0, -leafH / 2 + p / 2, 0]} material={frameMat}><boxGeometry args={[leaf.width, p, LEAF_T]} /></mesh>
            <mesh position={[-leaf.width / 2 + p / 2, 0, 0]} material={frameMat} castShadow><boxGeometry args={[p, leafH, LEAF_T]} /></mesh>
            <mesh position={[leaf.width / 2 - p / 2, 0, 0]} material={frameMat} castShadow><boxGeometry args={[p, leafH, LEAF_T]} /></mesh>
            <mesh material={frosted ?? mats.glass}><boxGeometry args={[leaf.width - 2 * p, leafH - 2 * p, 0.01]} /></mesh>
            {/* puerta de vidrio: tirador a ambos lados */}
            {isDoor && [-1, 1].map((k) => <mesh key={k} position={[(leaf.angle > 90 ? -1 : 1) * (leaf.width / 2 - 0.08), -leafH / 2 + 1.0, k * (LEAF_T / 2 + 0.02)]} material={mats.blackMetal}><boxGeometry args={[0.02, 0.3, 0.02]} /></mesh>)}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Hoja de puerta. Tablones: tablas verticales de ≈15 cm con junta en V, travesaños por la cara
 * interior y tirador de forja. Pintada: hoja lisa en el color de la carpintería con tirador.
 */
function DoorLeaf({ c, y, rot, width, height, planks, mats, handleLeft }: {
  c: Vec2; y: number; rot: number; width: number; height: number; planks: boolean; mats: MaterialSet; handleLeft: boolean;
}) {
  const t = 0.045;
  const hx = (handleLeft ? -1 : 1) * (width / 2 - 0.09);
  if (!planks)
    return (
      <group position={[c[0], y, c[1]]} rotation={[0, rot, 0]}>
        <mesh material={mats.carpentry} castShadow receiveShadow geometry={uvBox(width, height, t)} />
        {[-1, 1].map((k) => <mesh key={k} position={[hx, -height / 2 + 1.0, k * (t / 2 + 0.025)]} material={mats.brass} geometry={uvBox(0.02, 0.14, 0.02)} />)}
      </group>
    );
  const n = Math.max(3, Math.round(width / 0.15));
  const bw = width / n;
  return (
    <group position={[c[0], y, c[1]]} rotation={[0, rot, 0]}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[-width / 2 + bw * (i + 0.5), 0, 0]} material={mats.carpentryWood} castShadow receiveShadow geometry={uvBox(bw - 0.006, height, t)} />
      ))}
      {/* fondo de las juntas */}
      <mesh material={mats.woodBeam} geometry={uvBox(width - 0.01, height - 0.01, t * 0.5)} />
      {/* travesaños interiores */}
      {[0.25, 0.75].map((f) => <mesh key={f} position={[0, -height / 2 + height * f, -t / 2 - 0.012]} material={mats.carpentryWood} geometry={uvBox(width - 0.04, 0.12, 0.024)} />)}
      {/* tirador y bocallave de forja */}
      {[-1, 1].map((k) => (
        <group key={k} position={[hx, -height / 2 + 1.05, k * (t / 2 + 0.03)]}>
          <mesh material={mats.blackMetal} geometry={uvBox(0.018, 0.22, 0.018)} />
          <mesh position={[0, 0, -k * 0.015]} material={mats.blackMetal} geometry={uvBox(0.05, 0.3, 0.006)} />
        </group>
      ))}
    </group>
  );
}
