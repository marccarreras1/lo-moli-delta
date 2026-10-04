import { useMemo } from 'react';
import * as THREE from 'three';
import type { Layout, Vec2, Opening, Wall } from '../data/types';
import { pointOnWall, wallDir, wallNormal, wallPieces } from '../model/geometry';
import type { MaterialSet } from './materials';
import { Opening3D } from './Opening3D';

/** plano (x, y) → escena (x, altura, y) */
export const P = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, y);

interface HouseProps {
  layout: Layout;
  mats: MaterialSet;
  showRoof: boolean;
  showCeiling: boolean;
  mode: 'solido' | 'atenuado' | 'corte';
  sectionHeight: number;
  selection: { kind: 'room' | 'opening'; id: string } | null;
  openFractions: Record<string, number>;
  onSelect: (s: { kind: 'room' | 'opening'; id: string }) => void;
}

export function House({ layout, mats, showRoof, showCeiling, mode, sectionHeight, selection, openFractions, onSelect }: HouseProps) {
  const b = layout.bounds;
  const center: Vec2 = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  return (
    <group>
      <Slab layout={layout} mats={mats} />
      {layout.rooms.map((r) => (
        <RoomFloor key={r.id} poly={r.polygon} mat={selection?.kind === 'room' && r.id === selection.id ? mats.floorSelected : mats.floor}
          onClick={() => onSelect({ kind: 'room', id: r.id })} />
      ))}
      {layout.walls.map((w) => (
        <WallMesh key={w.id} wall={w} openings={layout.openings} mats={mats} center={center} />
      ))}
      {mode === 'corte' && <SectionCaps layout={layout} mats={mats} h={sectionHeight} />}
      {layout.openings.map((o) => {
        const w = layout.walls.find((x) => x.id === o.wallId);
        if (!w) return null;
        const def = o.kind === 'puerta' ? 0.9 : 0;
        return (
          <Opening3D key={o.id} o={o} w={w} mats={mats} center={center} fraction={openFractions[o.id] ?? def}
            selected={selection?.kind === 'opening' && selection.id === o.id} onSelect={() => onSelect({ kind: 'opening', id: o.id })} />
        );
      })}
      {showCeiling && mode === 'solido' && <Ceiling layout={layout} mats={mats} />}
      {showRoof && mode !== 'corte' && <Roof layout={layout} mats={mats} />}
    </group>
  );
}

function Slab({ layout, mats }: { layout: Layout; mats: MaterialSet }) {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const L = maxX - minX;
  const W = maxY - minY;
  return (
    <mesh position={[minX + L / 2, -0.06, minY + W / 2]} receiveShadow>
      <boxGeometry args={[L + 0.1, 0.12, W + 0.1]} />
      <primitive object={mats.slab} attach="material" />
    </mesh>
  );
}

function shapeFrom(poly: Vec2[]) {
  // ShapeGeometry vive en XY; giramos -90° en X para tumbarla: (x, y) → (x, 0, -y).
  // Por eso se construye con -y para que el resultado sea (x, 0, y).
  const s = new THREE.Shape();
  poly.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, -y) : s.lineTo(x, -y)));
  s.closePath();
  return s;
}

function RoomFloor({ poly, mat, onClick }: { poly: Vec2[]; mat: THREE.Material; onClick: () => void }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(shapeFrom(poly)), [poly]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow
      onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

function WallMesh({ wall, openings, mats, center }: { wall: Wall; openings: Opening[]; mats: MaterialSet; center: Vec2 }) {
  const pieces = useMemo(() => wallPieces(wall, openings), [wall, openings]);
  const [dx, dy] = wallDir(wall);
  const n = wallNormal(wall);
  const mid = pointOnWall(wall, 0);
  const inward = (center[0] - mid[0]) * n[0] + (center[1] - mid[1]) * n[1] > 0;
  const ext = wall.kind === 'exterior';
  // orden de caras de BoxGeometry: +x, -x, +y, -y, +z (normal n), -z
  const faceN = ext ? (inward ? mats.interior : mats.facade) : mats.interior;
  const faceNeg = ext ? (inward ? mats.facade : mats.interior) : mats.interior;
  const materials = [mats.cut, mats.cut, ext ? mats.facade : mats.cut, mats.cut, faceN, faceNeg];
  const rotY = -Math.atan2(dy, dx);
  return (
    <group>
      {pieces.map((p, i) => {
        const c = pointOnWall(wall, (p.s0 + p.s1) / 2);
        return (
          <mesh key={i} position={[c[0], (p.z0 + p.z1) / 2, c[1]]} rotation={[0, rotY, 0]} castShadow receiveShadow material={materials}>
            <boxGeometry args={[p.s1 - p.s0, p.z1 - p.z0, wall.thickness]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Relleno oscuro del muro seccionado (poché) en el modo de corte. */
function SectionCaps({ layout, mats, h }: { layout: Layout; mats: MaterialSet; h: number }) {
  return (
    <group>
      {layout.walls.flatMap((w) =>
        wallPieces(w, layout.openings)
          .filter((p) => p.z0 <= h && p.z1 >= h)
          .map((p, i) => {
            const c = pointOnWall(w, (p.s0 + p.s1) / 2);
            return (
              <mesh key={`${w.id}-${i}`} position={[c[0], h, c[1]]} rotation={[0, -Math.atan2(wallDir(w)[1], wallDir(w)[0]), 0]} material={mats.poche}>
                <boxGeometry args={[p.s1 - p.s0, 0.004, w.thickness]} />
              </mesh>
            );
          }),
      )}
    </group>
  );
}

function Ceiling({ layout, mats }: { layout: Layout; mats: MaterialSet }) {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const L = maxX - minX;
  const W = maxY - minY;
  return (
    <mesh position={[minX + L / 2, (layout.levels[0]?.wallHeight ?? 2.5) - 0.001, minY + W / 2]} rotation={[Math.PI / 2, 0, 0]} material={mats.ceiling}>
      <planeGeometry args={[L, W]} />
    </mesh>
  );
}

function Roof({ layout, mats }: { layout: Layout; mats: MaterialSet }) {
  if (!layout.roof) return null;
  return (
    <group position={[layout.bounds.minX, 0, layout.bounds.minY]}>
      <RoofShape layout={layout} mats={mats} />
    </group>
  );
}

function RoofShape({ layout, mats }: { layout: Layout; mats: MaterialSet }) {
  const L = layout.bounds.maxX - layout.bounds.minX;
  const W = layout.bounds.maxY - layout.bounds.minY;
  const H = layout.levels[0]?.wallHeight ?? 2.5;
  const r = layout.roof!;
  const o = r.overhang;
  if (r.type === 'plana') {
    const t = r.thickness;
    return (
      <group>
        <mesh position={[L / 2, H + t / 2, W / 2]} castShadow receiveShadow material={mats.roof}><boxGeometry args={[L, t, W]} /></mesh>
        {/* peto perimetral */}
        {[
          [L / 2, 0.1, L, 0.2], [L / 2, W - 0.1, L, 0.2],
        ].map(([x, y, lx, ly], i) => (
          <mesh key={i} position={[x, H + t + 0.2, y]} material={mats.facade}><boxGeometry args={[lx, 0.4, ly]} /></mesh>
        ))}
        {[0.1, L - 0.1].map((x, i) => (
          <mesh key={`s${i}`} position={[x, H + t + 0.2, W / 2]} material={mats.facade}><boxGeometry args={[0.2, 0.4, W]} /></mesh>
        ))}
      </group>
    );
  }
  const pitch = (r.pitchDeg * Math.PI) / 180;
  if (r.type === 'un-agua') {
    // cae hacia la fachada C (y = 0): alto en la fachada A
    const run = W + 2 * o;
    const rise = Math.tan(pitch) * W;
    const slopeLen = run / Math.cos(pitch);
    return (
      <group>
        <mesh position={[L / 2, H + rise / 2 + r.thickness / 2, W / 2]} rotation={[-pitch, 0, 0]} castShadow receiveShadow material={mats.roof}>
          <boxGeometry args={[L + 2 * o, r.thickness, slopeLen]} />
        </mesh>
        <mesh position={[L / 2, H + rise / 2, W - 0.15]} material={mats.facade} castShadow>
          <boxGeometry args={[L, rise, 0.3]} />
        </mesh>
        <Gable L={L} W={W} H={H} mats={mats} profile={[[0, 0], [W, 0], [W, rise], [0, 0]]} />
      </group>
    );
  }
  // dos aguas, cumbrera paralela al lado largo
  const half = W / 2 + o;
  const rise = Math.tan(pitch) * (W / 2);
  const slopeLen = half / Math.cos(pitch);
  const ridgeH = H + rise;
  const yMidFront = W / 2 + (half / 2);
  const yMidBack = W / 2 - (half / 2);
  const hMid = ridgeH - Math.tan(pitch) * (half / 2);
  return (
    <group>
      <mesh position={[L / 2, hMid + r.thickness / 2, yMidFront]} rotation={[pitch, 0, 0]} castShadow receiveShadow material={mats.roof}>
        <boxGeometry args={[L + 2 * o, r.thickness, slopeLen]} />
      </mesh>
      <mesh position={[L / 2, hMid + r.thickness / 2, yMidBack]} rotation={[-pitch, 0, 0]} castShadow receiveShadow material={mats.roof}>
        <boxGeometry args={[L + 2 * o, r.thickness, slopeLen]} />
      </mesh>
      <Gable L={L} W={W} H={H} mats={mats} profile={[[0, 0], [W, 0], [W / 2, rise], [0, 0]]} />
    </group>
  );
}

/** Hastiales (triángulos de fachada en los extremos B y D) bajo la cubierta inclinada. */
function Gable({ L, H, mats, profile }: { L: number; W: number; H: number; mats: MaterialSet; profile: Vec2[] }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    profile.forEach(([y, h], i) => (i === 0 ? s.moveTo(y, h) : s.lineTo(y, h)));
    return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
  }, [profile]);
  // la forma está en el plano (y_planta, altura); la giramos para que el eje local X sea el eje Y de planta
  return (
    <group>
      {[0.3, L].map((x) => (
        <mesh key={x} geometry={geo} position={[x, H, 0]} rotation={[0, -Math.PI / 2, 0]} material={mats.facade} castShadow>
        </mesh>
      ))}
    </group>
  );
}
