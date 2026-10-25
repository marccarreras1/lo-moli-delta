import { Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Layout, Opening, Railing, RoofSegment, Stair, Trace, Vec2, Wall } from '../data/types';
import { AMBER } from '../ui/status';
import { pointOnWall, wallDir, wallLength, wallNormal, wallPieces, wallSegmentRect } from '../model/geometry';
import type { MaterialSet } from './materials';
import { Opening3D } from './Opening3D';
import { uvBox } from './textures';
import { roofTopAt } from '../model/roof';
import { groundTopAt } from '../model/ground';

/** plano (x, y) → escena (x, altura, y) */
export const P = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, y);

interface HouseProps {
  layout: Layout;
  mats: MaterialSet;
  showRoof: boolean;
  showCeiling: boolean;
  mode: 'solido' | 'atenuado' | 'corte';
  sectionHeight: number;
  selection: { kind: 'room' | 'opening' | 'furniture'; id: string } | null;
  openFractions: Record<string, number>;
  onSelect: (s: { kind: 'room' | 'opening' | 'furniture'; id: string }) => void;
  /** niveles con cota superior a esta se ocultan (plantas y corte) */
  maxElev: number;
  /** nivel de las luces artificiales (LED de las vigas) */
  lampLevel?: number;
}

export function House({ layout, mats, showRoof, showCeiling, mode, sectionHeight, selection, openFractions, onSelect, maxElev, lampLevel = 0 }: HouseProps) {
  const b = layout.bounds;
  const center: Vec2 = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  const elev = (id: string) => layout.levels.find((l) => l.id === id)?.elevation ?? 0;
  const visible = (levelId: string) => elev(levelId) <= maxElev + 1e-6;
  return (
    <group>
      <Slab layout={layout} mats={mats} />
      {layout.slabs.filter((sl) => visible(sl.levelId)).map((sl) => (
        <SlabMesh key={sl.id} poly={sl.polygon} top={elev(sl.levelId)} thickness={sl.thickness} mat={mats.floorSlab} />
      ))}
      {layout.rooms.filter((r) => visible(r.levelId)).map((r) => (
        <RoomFloor key={r.id} poly={r.polygon} y={elev(r.levelId)} mat={selection?.kind === 'room' && r.id === selection.id ? mats.floorSelected : mats.floor}
          onClick={() => onSelect({ kind: 'room', id: r.id })} />
      ))}
      {layout.walls.map((w) => (
        <group key={w.id} position={[0, elev(w.levelId), 0]}>
          <WallMesh wall={w} openings={layout.openings} mats={mats} center={center} />
        </group>
      ))}
      <Plinth layout={layout} mats={mats} center={center} />
      {mode === 'corte' && <SectionCaps layout={layout} mats={mats} h={sectionHeight} />}
      {layout.openings.map((o) => {
        const w = layout.walls.find((x) => x.id === o.wallId);
        if (!w) return null;
        // las puertas interiores se ven abiertas; la de entrada, cerrada (se aprecian la hoja y el hueco)
        const def = o.kind === 'puerta' && o.swing && !o.entrance && w.kind !== 'exterior' ? 0.9 : 0;
        return (
          <group key={o.id} position={[0, elev(w.levelId), 0]}>
            <Opening3D o={o} w={w} mats={mats} center={center} fraction={openFractions[o.id] ?? def} planks={!!o.entrance && layout.options.puertaEntrada === 'tablones'}
              selected={selection?.kind === 'opening' && selection.id === o.id} onSelect={() => onSelect({ kind: 'opening', id: o.id })} />
          </group>
        );
      })}
      {layout.stairs.filter((st) => visible(st.fromLevel)).map((st) => (
        <StairMesh key={st.id} st={st} from={elev(st.fromLevel)} to={elev(st.toLevel)} mats={mats} />
      ))}
      {layout.options.entradaSaliente && layout.openings.filter((o) => o.entrance).map((o) => {
        const w = layout.walls.find((x) => x.id === o.wallId);
        return w ? <EntranceVolume key={`ev-${o.id}`} o={o} w={w} center={center} mats={mats} /> : null;
      })}
      {(layout.railings ?? []).filter((r) => visible(r.levelId)).map((r) => <RailingMesh key={r.id} r={r} y={elev(r.levelId)} mats={mats} />)}
      {layout.traces.filter((t) => visible(t.levelId)).map((t) => <TraceLine key={t.id} t={t} y={elev(t.levelId) + 0.03} />)}
      {layout.roofSegments?.length ? (
        ((showRoof && mode !== 'corte') || (showCeiling && mode === 'solido')) && <RoofSegments segments={layout.roofSegments} mats={mats} />
      ) : null}
      {!layout.roofSegments?.length && showCeiling && mode === 'solido' && (layout.roof?.ceiling ? <Vaults layout={layout} mats={mats} lampLevel={lampLevel} /> : <Ceiling layout={layout} mats={mats} />)}
      {layout.roof?.eaves && <EavesWalls layout={layout} mats={mats} />}
      {showRoof && mode !== 'corte' && <Roof layout={layout} mats={mats} />}
      {showRoof && !showCeiling && mode === 'solido' && layout.roof?.ceiling && <Vaults layout={layout} mats={mats} lampLevel={lampLevel} />}
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

function SlabMesh({ poly, top, thickness, mat }: { poly: Vec2[]; top: number; thickness: number; mat: THREE.Material }) {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shapeFrom(poly), { depth: thickness, bevelEnabled: false }), [poly, thickness]);
  return <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, top - thickness, 0]} castShadow receiveShadow material={mat} />;
}

/**
 * Escalera de obra encalada con huella de terracota y canto (propuesta de acabado). Un bloque por
 * peldaño desde el suelo, de la cota de un nivel a la del otro.
 */
function StairMesh({ st, from, to, mats }: { st: Stair; from: number; to: number; mats: MaterialSet }) {
  const [ax, ay, bx, by] = st.rect;
  const n = Math.max(1, st.risers);
  const rise = (to - from) / n;
  const alongX = st.up === '+x' || st.up === '-x';
  const run = alongX ? bx - ax : by - ay;
  const width = alongX ? by - ay : bx - ax;
  // con desembarco a ras, la última tabica sube directamente al forjado: una huella menos
  const steps = st.topFlush ? n - 1 : n;
  const tread = run / steps;
  const cap = 0.03;
  const nose = 0.02;
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => {
        // i = 0 es el primer peldaño (arranque)
        const k = st.up === '+x' || st.up === '+y' ? i : steps - 1 - i;
        const dirSign = st.up === '+x' || st.up === '+y' ? -1 : 1;
        const sMid = (alongX ? ax : ay) + tread * (k + 0.5);
        const top = rise * (i + 1);
        // bajo el tramo hueco el peldaño cuelga de una losa escalonada de ≈0,18 m
        const sStart = (alongX ? ax : ay) + tread * k;
        const sEnd = sStart + tread;
        const hollow = st.openUnderFrom !== undefined && (dirSign < 0 ? sStart >= st.openUnderFrom - 1e-6 : sEnd <= st.openUnderFrom + 1e-6);
        const body = hollow ? Math.min(top - cap, rise + 0.18) : top - cap;
        const yMid = from + top - cap - body / 2;
        const pos: [number, number, number] = alongX ? [sMid, yMid, (ay + by) / 2] : [(ax + bx) / 2, yMid, sMid];
        const capPos: [number, number, number] = alongX ? [sMid + (dirSign * nose) / 2, from + top - cap / 2, (ay + by) / 2] : [(ax + bx) / 2, from + top - cap / 2, sMid + (dirSign * nose) / 2];
        return (
          <group key={i}>
            <mesh position={pos} castShadow receiveShadow material={mats.stair} geometry={alongX ? uvBox(tread, body, width) : uvBox(width, body, tread)} />
            <mesh position={capPos} castShadow receiveShadow material={mats.terracottaTile} geometry={alongX ? uvBox(tread + nose, cap, width) : uvBox(width, cap, tread + nose)} />
          </group>
        );
      })}
    </group>
  );
}

/**
 * Interior elevado sobre el terreno: zócalo de los muros exteriores desde el terreno hasta el suelo
 * de planta baja y escalones (dos de igual tabica) delante de las puertas y cristaleras a ras de suelo.
 */
function Plinth({ layout, mats, center }: { layout: Layout; mats: MaterialSet; center: Vec2 }) {
  const elevOf = (id: string) => layout.levels.find((l) => l.id === id)?.elevation ?? 0;
  const ext = layout.walls.filter((w) => w.kind === 'exterior' && elevOf(w.levelId) > 0.02);
  if (!ext.length) return null;
  const items: React.ReactElement[] = [];
  for (const w of ext) {
    const h = elevOf(w.levelId);
    const [e0, e1] = w.ext ?? [0, 0];
    items.push(<SlabMesh key={`z-${w.id}`} poly={wallSegmentRect(w, -e0, wallLength(w) + e1)} top={h} thickness={h} mat={mats.facade} />);
    const [ux, uy] = wallDir(w);
    let [nx, ny] = wallNormal(w);
    const mid = pointOnWall(w, wallLength(w) / 2);
    if ((center[0] - mid[0]) * nx + (center[1] - mid[1]) * ny > 0) { nx = -nx; ny = -ny; }
    const rot = -Math.atan2(uy, ux);
    for (const o of layout.openings.filter((x) => x.wallId === w.id && x.sill < 0.05 && x.kind !== 'ventana' && x.kind !== 'paso')) {
      const c = pointOnWall(w, o.offset + o.width / 2, 0);
      // los escalones arrancan de la superficie exterior delante del hueco (solera elevada o terreno)
      const base = groundTopAt(layout.outdoor, c[0] + nx * (w.thickness / 2 + 0.4), c[1] + ny * (w.thickness / 2 + 0.4));
      if (h - base < 0.05) continue;
      const n = Math.max(1, Math.round((h - base) / 0.19));
      const rise = (h - base) / n;
      const tread = 0.3;
      const width = o.width + 0.2;
      for (let k = 0; k < n; k++) {
        // peldaño k (0 = el más bajo): de la cara del muro hacia fuera
        const depth = tread * (n - k);
        const off = w.thickness / 2 + depth / 2;
        const cx = c[0] + nx * off;
        const cz = c[1] + ny * off;
        const top = base + rise * (k + 1);
        items.push(
          <group key={`s-${o.id}-${k}`} position={[cx, 0, cz]} rotation={[0, rot, 0]}>
            <mesh position={[0, (top - 0.03) / 2, 0]} castShadow receiveShadow material={mats.concrete} geometry={uvBox(width, top - 0.03, depth)} />
            <mesh position={[0, top - 0.015, 0]} castShadow receiveShadow material={mats.terracottaTile} geometry={uvBox(width + 0.02, 0.03, depth + 0.02)} />
          </group>,
        );
      }
    }
  }
  return <group>{items}</group>;
}

/** Trazo del boceto sin interpretar: línea discontinua ámbar sobre el suelo. */
function TraceLine({ t, y }: { t: Trace; y: number }) {
  if (t.cross) {
    const [cx, cz] = t.cross;
    const k = 0.12;
    return (
      <group>
        <Line points={[[cx - k, y, cz - k], [cx + k, y, cz + k]]} color={AMBER} lineWidth={2} />
        <Line points={[[cx - k, y, cz + k], [cx + k, y, cz - k]]} color={AMBER} lineWidth={2} />
      </group>
    );
  }
  const pts: [number, number, number][] = t.circle
    ? Array.from({ length: 41 }, (_, i) => {
        const a = (i / 40) * Math.PI * 2;
        return [t.circle!.c[0] + Math.cos(a) * t.circle!.r, y, t.circle!.c[1] + Math.sin(a) * t.circle!.r];
      })
    : [...(t.points ?? []), ...(t.closed && t.points ? [t.points[0]] : [])].map(([x, z]) => [x, y, z]);
  if (pts.length < 2) return null;
  return <Line points={pts} color={t.kind === 'nota' ? '#9fa39a' : AMBER} lineWidth={2} dashed dashSize={0.15} gapSize={0.1} />;
}

function RoomFloor({ poly, y, mat, onClick }: { poly: Vec2[]; y: number; mat: THREE.Material; onClick: () => void }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(shapeFrom(poly)), [poly]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.005, 0]} receiveShadow
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
          <mesh key={i} position={[c[0], (p.z0 + p.z1) / 2, c[1]]} rotation={[0, rotY, 0]} castShadow receiveShadow material={materials}
            geometry={uvBox(p.s1 - p.s0, p.z1 - p.z0, wall.thickness)} />
        );
      })}
    </group>
  );
}

/** Relleno oscuro del muro seccionado (poché) en el modo de corte. */
function SectionCaps({ layout, mats, h }: { layout: Layout; mats: MaterialSet; h: number }) {
  return (
    <group>
      {layout.walls.flatMap((w) => {
        const base = layout.levels.find((l) => l.id === w.levelId)?.elevation ?? 0;
        return wallPieces(w, layout.openings)
          .filter((p) => base + p.z0 <= h && base + p.z1 >= h)
          .map((p, i) => {
            const c = pointOnWall(w, (p.s0 + p.s1) / 2);
            return (
              <mesh key={`${w.id}-${i}`} position={[c[0], h, c[1]]} rotation={[0, -Math.atan2(wallDir(w)[1], wallDir(w)[0]), 0]} material={mats.poche}>
                <boxGeometry args={[p.s1 - p.s0, 0.004, w.thickness]} />
              </mesh>
            );
          });
      })}
    </group>
  );
}

/**
 * Volta catalana en terracota (confirmado): bovedillas cerámicas rebajadas entre vigas que cruzan
 * el ancho de la casa cada `spacing`. Ladrillo de rasilla a matajunta con juntas claras (textura a
 * escala real) y canto visible de 4 cm. Las vigas llevan el mismo color que la volta (propiedad); el
 * tono exacto sale de una referencia que no se ha podido abrir desde este entorno.
 * La clave queda bajo el forjado de cubierta, dentro de la altura de 6,20 m.
 */
function Vaults({ layout, mats, lampLevel = 0 }: { layout: Layout; mats: MaterialSet; lampLevel?: number }) {
  const c = layout.roof!.ceiling!;
  const ext = layout.walls.filter((w) => w.kind === 'exterior');
  // interior libre entre muros exteriores
  const xs = ext.filter((w) => Math.abs(w.a[0] - w.b[0]) < 1e-6).map((w) => [w.a[0] - w.thickness / 2, w.a[0] + w.thickness / 2]);
  const ys = ext.filter((w) => Math.abs(w.a[1] - w.b[1]) < 1e-6).map((w) => [w.a[1] - w.thickness / 2, w.a[1] + w.thickness / 2]);
  const ix0 = Math.min(...xs.map((p) => p[1]));
  const ix1 = Math.max(...xs.map((p) => p[0]));
  const iy0 = Math.min(...ys.map((p) => p[1]));
  const iy1 = Math.max(...ys.map((p) => p[0]));
  // con cubierta inclinada (aleros a distinta altura) la volta sigue la pendiente: se gira alrededor
  // del eje del centro de la casa
  const yMid = (iy0 + iy1) / 2;
  const tilt = layout.roof?.eaves ? Math.atan2(roofTopAt(layout, iy0) - roofTopAt(layout, iy1), iy1 - iy0) : 0;
  const span = (iy1 - iy0) / Math.cos(tilt);
  // tramos de bóvedas: uno, o dos si la zona de comedor está bajada (cada uno entre sus muros: el escalón es un apoyo)
  const esc = layout.escalon;
  const escT = layout.walls.find((w) => w.id === 'muro-escalon')?.thickness ?? 0.3;
  const tramos: [number, number][] = esc && esc.x > ix0 && esc.x < ix1 ? [[ix0, esc.x - escT], [esc.x, ix1]] : [[ix0, ix1]];
  const bays = tramos.flatMap(([a, b]) => {
    const k = Math.max(1, Math.round((b - a) / c.spacing));
    return Array.from({ length: k }, (_, i) => ({ x0: a + ((b - a) * i) / k, x1: a + ((b - a) * (i + 1)) / k }));
  });
  const n = Math.max(1, Math.round((ix1 - ix0) / c.spacing));
  const s = (ix1 - ix0) / n;
  const crown = roofTopAt(layout, yMid) - (layout.roof?.thickness ?? 0.25) / Math.cos(tilt) - 0.01;
  // con la zona de comedor bajada, las bóvedas de esa zona bajan con la cubierta
  const bajada = (x: number) => roofTopAt(layout, yMid, x) - roofTopAt(layout, yMid);
  const spring = crown - c.rise;
  const R = (s * s / 4 + c.rise * c.rise) / (2 * c.rise);
  const theta = 2 * Math.asin(Math.min(1, s / 2 / R));
  const beamH = 0.12;
  const geo = useMemo(() => {
    // cáscara cilíndrica abierta con UV en metros (u: a lo largo del arco · v: a lo ancho de la casa)
    const g = new THREE.CylinderGeometry(R, R, span, 14, 1, true, Math.PI - theta / 2, theta);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * R * theta, uv.getY(i) * span);
    uv.needsUpdate = true;
    return g;
  }, [R, span, theta]);
  const outer = useMemo(() => new THREE.CylinderGeometry(R + 0.04, R + 0.04, span, 14, 1, true, Math.PI - theta / 2, theta), [R, span, theta]);
  useEffect(() => () => { geo.dispose(); outer.dispose(); }, [geo, outer]);
  // LED en la cara lateral alta de cada viga (plan de iluminación): tira en perfil y luz hacia la bóveda
  const led = layout.lighting?.beamLeds;
  const beamXs = [...bays.map((b) => b.x0), ...tramos.map(([, b]) => b)];
  const ledXs = led && !tilt ? beamXs.flatMap((x) => (led.sides === 2 ? [x - 0.045, x + 0.045] : [x + (x + 0.05 < ix1 ? 0.045 : -0.045)])) : [];
  const yOf = (x: number) => spring + 0.0 + bajada(x + 0.01);
  return (
    <group position={[0, crown, yMid]} rotation={[tilt, 0, 0]}>
    <group position={[0, -crown, -yMid]}>
      {ledXs.map((x, i) => <mesh key={`led${i}`} position={[x, yOf(x), (iy0 + iy1) / 2]} material={mats.lampGlow}><boxGeometry args={[0.012, 0.016, span - 0.1]} /></mesh>)}
      {lampLevel > 0.05 && bays.filter((_, i) => i % 4 === 1).map((b, i) => {
        const x = (b.x0 + b.x1) / 2;
        return <pointLight key={`ledl${i}`} position={[x, yOf(x) + c.rise * 0.4, (iy0 + iy1) / 2]} color="#ffb46b" intensity={lampLevel * 2.2} distance={5} decay={2} />;
      })}
      {bays.map((b, i) => (
        <group key={`v${i}`} position={[(b.x0 + b.x1) / 2, crown - R + bajada((b.x0 + b.x1) / 2), (iy0 + iy1) / 2]} rotation={[Math.PI / 2, 0, 0]} scale={[(b.x1 - b.x0) / s, 1, 1]}>
          <mesh geometry={geo} material={mats.vault} receiveShadow />
          <mesh geometry={outer} material={mats.cut} />
        </group>
      ))}
      {[...bays.map((b) => b.x0), ...tramos.map(([, b]) => b)].map((x, i) => (
        <mesh key={`b${i}`} position={[x, spring - beamH / 2 + 0.02 + bajada(x + (tramos.some(([, b]) => Math.abs(b - x) < 1e-6) ? -0.01 : 0.01)), (iy0 + iy1) / 2]} material={mats.beam} castShadow geometry={uvBox(0.08, beamH, span)} />
      ))}
    </group>
    </group>
  );
}

function Ceiling({ layout, mats }: { layout: Layout; mats: MaterialSet }) {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const L = maxX - minX;
  const W = maxY - minY;
  return (
    <mesh position={[minX + L / 2, layout.topHeight - 0.001, minY + W / 2]} rotation={[Math.PI / 2, 0, 0]} material={mats.ceiling}>
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
  const H = layout.topHeight;
  const r = layout.roof!;
  const o = r.overhang;
  if (r.type === 'plana' || r.type === 'plana-peto') {
    // el forjado de cubierta queda dentro de la altura de los alzados (6,20 m)
    const t = r.thickness;
    const p = r.parapet ?? 0;
    const pt = 0.3;
    // volúmenes de cubierta: uno, o dos si la zona de comedor está bajada (x local desde el borde de la casa)
    const xe = layout.escalon ? layout.escalon.x - layout.bounds.minX : null;
    const vols: { x0: number; x1: number; h: number }[] = xe !== null && xe > 0 && xe < L
      ? [{ x0: 0, x1: xe, h: H }, { x0: xe, x1: L, h: layout.escalon!.top }]
      : [{ x0: 0, x1: L, h: H }];
    return (
      <group>
        {vols.map((v, k) => {
          const lv = v.x1 - v.x0;
          const cxv = (v.x0 + v.x1) / 2;
          const edges: [number, number, number, number][] = [[cxv, pt / 2, lv, pt], [cxv, W - pt / 2, lv, pt], [v.x0 + pt / 2, W / 2, pt, W - 2 * pt], [v.x1 - pt / 2, W / 2, pt, W - 2 * pt]];
          return (
            <group key={k}>
              <mesh position={[cxv, v.h - t / 2, W / 2]} castShadow receiveShadow material={mats.roof} geometry={uvBox(lv - 0.02, t, W - 0.02)} />
              {p > 0 && edges.map(([x, y, lx, ly], i) => (
                <group key={i}>
                  {/* peto encalado con remate redondeado continuo (propuesta) */}
                  <mesh position={[x, v.h + (p - pt / 2) / 2, y]} material={mats.facade} castShadow receiveShadow geometry={uvBox(lx, p - pt / 2, ly)} />
                  <mesh position={[x, v.h + p - pt / 2, y]} rotation={lx > ly ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]} material={mats.facade} castShadow>
                    <cylinderGeometry args={[pt / 2, pt / 2, Math.max(lx, ly), 16, 1, false]} />
                  </mesh>
                </group>
              ))}
            </group>
          );
        })}
      </group>
    );
  }
  if (r.eaves) return <EavesRoof L={L} W={W} r={r} mats={mats} />;
  const pitch = (r.pitchDeg * Math.PI) / 180;
  if (r.type === 'un-agua') {
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

/**
 * Teja árabe en planta: canales de 0,20 m a lo largo de la pendiente y solapes cada 0,36 m
 * (textura en metros, gris para modular el color del acabado y como relieve).
 */
function tileTexture() {
  const w = 64;
  const h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    const v = j / h;
    // borde inferior de cada hilada más oscuro (sombra del solape)
    const lap = v < 0.12 ? 0.55 + 0.45 * (v / 0.12) : 1;
    for (let i = 0; i < w; i++) {
      const u = i / w;
      // pieza curva: lomo claro y canal oscuro alternos
      const curve = 0.62 + 0.38 * Math.sin(u * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.19;
      const n = 0.94 + 0.06 * Math.sin(i * 12.9898 + j * 78.233) ** 2;
      const g = Math.round(255 * Math.min(1, curve * lap * n));
      data.set([g, g, g, 255], (j * w + i) * 4);
    }
  }
  const t = new THREE.DataTexture(data, w, h);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Cubierta a un agua con aleros a distinta altura (variante de teja): faldón apoyado en los muros
 * (que llegan al alero bajo) y canalón en el alero bajo; el recrecido y los hastiales van con los
 * muros (EavesWalls). La cara superior pasa por las cotas `eaves` en los bordes exteriores.
 */
function EavesRoof({ L, W, r, mats }: { L: number; W: number; r: NonNullable<Layout['roof']>; mats: MaterialSet }) {
  const e = r.eaves!;
  const o = r.overhang;
  const t = r.thickness;
  const rise = e.y0 - e.y1;
  const tilt = Math.atan2(rise, W);
  const slopeLen = (W + 2 * o) / Math.cos(tilt);
  const tex = useMemo(() => tileTexture(), []);
  const tileMat = useMemo(() => {
    const base = mats.roof.color.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    // con el acabado blanco de cubierta plana se toma la teja árabe envejecida
    const color = hsl.l > 0.75 ? new THREE.Color('#b07a5a') : base;
    const map = tex.clone();
    map.repeat.set(1 / 0.2, 1 / 0.36);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color, map, bumpMap: map, bumpScale: 1.5, roughness: 0.88 });
  }, [mats.roof, tex]);
  useEffect(() => () => { tileMat.map?.dispose(); tileMat.dispose(); tex.dispose(); }, [tileMat, tex]);
  const geo = useMemo(() => uvBox(L + 2 * o, t, slopeLen), [L, o, t, slopeLen]);
  const midTop = (e.y0 + e.y1) / 2;
  return (
    <group>
      {/* faldón de teja (la cara superior lleva la teja; el resto, el mismo material) */}
      <mesh position={[L / 2, midTop - t / 2 / Math.cos(tilt), W / 2]} rotation={[tilt, 0, 0]} castShadow receiveShadow material={r.tiles ? tileMat : mats.roof} geometry={geo} />
      {/* canalón en el alero bajo */}
      <mesh position={[L / 2, e.y1 - Math.tan(tilt) * o - t - 0.04, W + o - 0.02]} rotation={[0, 0, Math.PI / 2]} material={mats.metal} castShadow>
        <cylinderGeometry args={[0.06, 0.06, L + 2 * o, 12, 1, true, 0, Math.PI]} />
      </mesh>
    </group>
  );
}

/**
 * Cierre de fachada por encima del alero bajo con la cubierta de aleros a distinta altura: recrecido
 * del frontal alto y hastiales laterales. Es muro, no cubierta: se ve también desde dentro.
 */
function EavesWalls({ layout, mats }: { layout: Layout; mats: MaterialSet }) {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const L = maxX - minX;
  const W = maxY - minY;
  const H = layout.topHeight;
  const t = layout.roof!.thickness;
  // altura que cierra el muro bajo el faldón en el borde alto (y0) y bajo (y1)
  const r0 = roofTopAt(layout, minY) - t - H;
  const r1 = Math.max(0, roofTopAt(layout, maxY) - t - H);
  return (
    <group position={[minX, 0, minY]}>
      {r0 > 0.01 && <mesh position={[L / 2, H + r0 / 2, 0.15]} material={mats.facade} castShadow receiveShadow geometry={uvBox(L, r0, 0.3)} />}
      <Gable L={L} W={W} H={H} mats={mats} profile={[[0, 0], [W, 0], [W, r1], [0, r0], [0, 0]]} />
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

/** Textura de chapa ondulada (franjas claras y oscuras a lo largo de la pendiente). */
function corrugatedTexture() {
  const n = 16;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const v = Math.round(150 + 34 * Math.cos((i / n) * Math.PI * 2));
    data.set([v, v, v - 6, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, n, 1);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Cubiertas a un agua por volúmenes (estado actual): faldón alto en y0 y bajo en y1,
 * con hastiales triangulares sobre los muros transversales.
 */
function RoofSegments({ segments, mats }: { segments: RoofSegment[]; mats: MaterialSet }) {
  const base = useMemo(() => corrugatedTexture(), []);
  const trim = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b46a4a', roughness: 0.9 }), []);
  useEffect(() => () => trim.dispose(), [trim]);
  const fibro = useMemo(() => segments.map((sg) => {
    const t = base.clone();
    t.repeat.set((sg.rect[2] - sg.rect[0]) / 0.18, 1);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: '#b4b2a8', map: t, roughness: 0.95, side: THREE.DoubleSide });
  }), [segments, base]);
  return (
    <group>
      {segments.map((sg, i) => {
        const [x0, y0, x1, y1] = sg.rect;
        const t = sg.material === 'fibrocemento' ? 0.05 : 0.2;
        const run = y1 - y0;
        const p = Math.atan2(sg.hy0 - sg.hy1, run);
        const len = (run + 2 * sg.overhang) / Math.cos(p);
        const mat = sg.material === 'fibrocemento' ? fibro[i] : mats.roof;
        // los hastiales se apoyan en los muros de los extremos del faldón (eje a 0,15 m del borde exterior si es fachada)
        const isEnd = (x: number) => !segments.some((o) => o !== sg && (Math.abs(o.rect[0] - x) < 1e-6 || Math.abs(o.rect[2] - x) < 1e-6));
        const gt = sg.gableThickness ?? 0.3;
        const gx = [isEnd(x0) ? x0 + gt / 2 : x0, isEnd(x1) ? x1 - gt / 2 : x1];
        return (
          <group key={sg.id}>
            <mesh position={[(x0 + x1) / 2, (sg.hy0 + sg.hy1) / 2 + t / 2, (y0 + y1) / 2]} rotation={[p, 0, 0]} castShadow receiveShadow material={mat}>
              <boxGeometry args={[x1 - x0 + 0.1, t, len]} />
            </mesh>
            {gx.map((x) => <SegmentGable key={x} x={x} t={gt} y0={y0} y1={y1} hy0={sg.hy0} hy1={sg.hy1} mat={mats.facade} />)}
            {sg.material === 'fibrocemento' && (
              <group>
                {/* remate de piezas de terracota en los bordes laterales y en el borde alto (fotos de dron) */}
                {[x0 + 0.06, x1 - 0.06].map((x) => (
                  <mesh key={x} position={[x, (sg.hy0 + sg.hy1) / 2 + t + 0.03, (y0 + y1) / 2]} rotation={[p, 0, 0]} material={trim} castShadow>
                    <boxGeometry args={[0.16, 0.06, len]} />
                  </mesh>
                ))}
                <mesh position={[(x0 + x1) / 2, sg.hy0 + t + 0.03, y0 - sg.overhang + 0.06]} material={trim} castShadow>
                  <boxGeometry args={[x1 - x0 + 0.1, 0.06, 0.16]} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

function SegmentGable({ x, t, y0, y1, hy0, hy1, mat }: { x: number; t: number; y0: number; y1: number; hy0: number; hy1: number; mat: THREE.Material }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(y0, hy1);
    s.lineTo(y1, hy1);
    s.lineTo(y0, hy0);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  }, [t, y0, y1, hy0, hy1]);
  // la forma vive en (y_planta, altura); girada -90° en Y su eje X pasa a ser el eje Y de planta y se extruye hacia -x
  return <mesh geometry={geo} position={[x + t / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]} material={mat} castShadow receiveShadow />;
}

/** Banda vertical a lo largo de un tramo (de a a b), con base inclinada si cambia de cota. */
function bandGeometry(len: number, b0: number, b1: number, z0: number, z1: number, depth: number) {
  const s = new THREE.Shape();
  s.moveTo(0, b0 + z0);
  s.lineTo(len, b1 + z0);
  s.lineTo(len, b1 + z1);
  s.lineTo(0, b0 + z1);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

/**
 * Barandilla por tramos. Vidrio: paño continuo con perfil superior fino. Barrotes:
 * pasamanos, zócalo y barrotes verticales. Si tiene `rise`, la base sigue la pendiente.
 */
function RailingMesh({ r, y, mats }: { r: Railing; y: number; mats: MaterialSet }) {
  const segs = useMemo(() => {
    const total = r.points.slice(1).reduce((acc, p, i) => acc + Math.hypot(p[0] - r.points[i][0], p[1] - r.points[i][1]), 0) || 1;
    const [r0, r1] = r.rise ?? [0, 0];
    let run = 0;
    return r.points.slice(0, -1).map(([ax, ay], i) => {
      const [bx, by] = r.points[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const b0 = r0 + (r1 - r0) * (run / total);
      run += len;
      const b1 = r0 + (r1 - r0) * (run / total);
      const rotY = -Math.atan2(by - ay, bx - ax);
      const parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
      if (r.material === 'vidrio') {
        // vidrio laminado sobre perfil en U anclado al forjado, con canto superior protegido
        parts.push({ geo: bandGeometry(len, b0, b1, 0.08, r.height - 0.015, 0.02), mat: mats.glass });
        parts.push({ geo: bandGeometry(len, b0, b1, r.height - 0.015, r.height, 0.028), mat: mats.metal });
        parts.push({ geo: bandGeometry(len, b0, b1, 0, 0.1, 0.07), mat: mats.metal });
        // anclajes del perfil cada ≈0,6 m
        const na = Math.max(2, Math.round(len / 0.6));
        for (let k = 0; k <= na; k++) {
          const sk = (len * k) / na;
          const g = new THREE.BoxGeometry(0.05, 0.04, 0.1);
          g.translate(sk, b0 + (b1 - b0) * (k / na) + 0.02, 0);
          parts.push({ geo: g, mat: mats.blackMetal });
        }
      } else {
        parts.push({ geo: bandGeometry(len, b0, b1, r.height - 0.04, r.height, 0.05), mat: mats.metal });
        parts.push({ geo: bandGeometry(len, b0, b1, 0.04, 0.07, 0.03), mat: mats.metal });
        const n = Math.max(1, Math.round(len / Math.max(0.05, r.spacing)));
        for (let k = 0; k <= n; k++) {
          const s = (len * k) / n;
          const g = new THREE.BoxGeometry(0.02, r.height, 0.02);
          g.translate(s, b0 + (b1 - b0) * (k / n) + r.height / 2, 0);
          parts.push({ geo: g, mat: mats.metal });
        }
      }
      return { ax, ay, rotY, parts };
    });
  }, [r, mats]);
  useEffect(() => () => segs.forEach((sg) => sg.parts.forEach((p) => p.geo.dispose())), [segs]);
  return (
    <group position={[0, y, 0]}>
      {segs.map((sg, i) => (
        <group key={i} position={[sg.ax, 0, sg.ay]} rotation={[0, sg.rotY, 0]}>
          {sg.parts.map((p, k) => <mesh key={k} geometry={p.geo} material={p.mat} castShadow={p.mat !== mats.glass} />)}
        </group>
      ))}
    </group>
  );
}

/**
 * Variante: pequeño volumen saliente encalado alrededor de la puerta de entrada, con un hueco
 * profundo que prolonga la jamba. No cambia la distribución interior.
 */
function EntranceVolume({ o, w, center, mats }: { o: Opening; w: Wall; center: Vec2; mats: MaterialSet }) {
  const n = wallNormal(w);
  const mid = pointOnWall(w, o.offset + o.width / 2);
  const out = (center[0] - mid[0]) * n[0] + (center[1] - mid[1]) * n[1] > 0 ? -1 : 1;
  const depth = 0.7;
  const side = 0.45;
  const height = o.height + 0.55;
  const face = pointOnWall(w, o.offset + o.width / 2, out * (w.thickness / 2 + depth / 2));
  const rot = -Math.atan2(wallDir(w)[1], wallDir(w)[0]);
  const totalW = o.width + 2 * side;
  return (
    <group position={[face[0], 0, face[1]]} rotation={[0, rot, 0]}>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * (o.width / 2 + side / 2), height / 2, 0]} material={mats.facade} castShadow receiveShadow geometry={uvBox(side, height, depth)} />
      ))}
      <mesh position={[0, o.height + (height - o.height) / 2, 0]} material={mats.facade} castShadow receiveShadow geometry={uvBox(o.width, height - o.height, depth)} />
      {/* remate redondeado continuo */}
      <mesh position={[0, height, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.facade} castShadow>
        <cylinderGeometry args={[depth / 2, depth / 2, totalW, 16, 1, false, 0, Math.PI]} />
      </mesh>
    </group>
  );
}
