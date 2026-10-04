/**
 * Iluminación artificial (propuesta): lámparas colgantes cerámicas en dos alternativas, apliques,
 * luz funcional bajo la balda de la cocina y farol exterior. Luz cálida ≈2700 K, regulable.
 * Las piezas son modelos propios hechos por revolución; las referencias se han tomado de la
 * descripción de la propiedad (los enlaces no se pueden abrir desde este entorno).
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Furniture, Layout, PendantGroup, Vec2 } from '../data/types';
import { pointInPolygon } from '../model/geometry';
import type { MaterialSet } from './materials';

/** color de una fuente de ≈2700 K */
export const WARM = '#ffb46b';

/** cota del techo sobre un punto: bajo un forjado intermedio o bajo la volta catalana */
export function ceilingAt(layout: Layout, p: Vec2, fromElev = 0) {
  const elev = (id: string) => layout.levels.find((l) => l.id === id)?.elevation ?? 0;
  let best = layout.topHeight - (layout.roof?.thickness ?? 0.25) - (layout.roof?.ceiling?.rise ?? 0);
  for (const s of layout.slabs) {
    const bottom = elev(s.levelId) - s.thickness;
    if (bottom > fromElev && bottom < best && pointInPolygon(p, s.polygon)) best = bottom;
  }
  return best;
}

type Shape = { profile: [number, number][]; tone: number };

/** perfiles (radio, altura desde la boca) de cada alternativa: piezas distintas entre sí */
const SHAPES: Record<'A' | 'B', Shape[]> = {
  // A · barro (referencia 09): campana baja, calabaza de dos cuerpos y botella de cuello largo
  A: [
    { profile: [[0.13, 0], [0.125, 0.04], [0.1, 0.11], [0.06, 0.17], [0.025, 0.2], [0.015, 0.21]], tone: 0 },
    { profile: [[0.095, 0], [0.11, 0.05], [0.1, 0.11], [0.06, 0.15], [0.07, 0.19], [0.065, 0.24], [0.03, 0.28], [0.015, 0.29]], tone: 1 },
    { profile: [[0.12, 0], [0.13, 0.06], [0.12, 0.17], [0.07, 0.24], [0.04, 0.27], [0.035, 0.36], [0.015, 0.37]], tone: 2 },
  ],
  // B · terracota clara (referencia 10): campanas y embudos con cuello alargado, ligeros
  B: [
    { profile: [[0.13, 0], [0.12, 0.05], [0.08, 0.13], [0.04, 0.18], [0.035, 0.27], [0.015, 0.28]], tone: 0 },
    { profile: [[0.17, 0], [0.155, 0.04], [0.09, 0.1], [0.045, 0.14], [0.04, 0.2], [0.015, 0.21]], tone: 1 },
    { profile: [[0.095, 0], [0.09, 0.12], [0.07, 0.22], [0.04, 0.27], [0.035, 0.36], [0.015, 0.37]], tone: 2 },
  ],
};
/** alturas escalonadas de cada pieza respecto a la cota del grupo (composición variada) */
const DROP: Record<'A' | 'B', number[]> = { A: [0, -0.06, 0.04], B: [0.08, -0.04, 0.14] };
const TONES: Record<'A' | 'B', string[]> = { A: ['#a3603f', '#8a5a44', '#b98466'], B: ['#d6a07f', '#e2b896', '#cf9472'] };

function LampShade({ shape, mat }: { shape: Shape; mat: THREE.Material }) {
  const geo = useMemo(() => new THREE.LatheGeometry(shape.profile.map(([r, h]) => new THREE.Vector2(r, h)), 40), [shape]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mat} castShadow />;
}

export function Pendants({ layout, mats, level, lights }: { layout: Layout; mats: MaterialSet; level: number; lights: boolean }) {
  const kind = layout.options.lamparas;
  const group: PendantGroup | undefined = (layout.pendants ?? []).find((g) => g.location === layout.options.lamparasUbicacion);
  const tones = useMemo(() => TONES[kind].map((c) => {
    const m = (kind === 'A' ? mats.clay : mats.clayLight).clone();
    m.color.set(c);
    return m;
  }), [kind, mats.clay, mats.clayLight]);
  useEffect(() => () => tones.forEach((m) => m.dispose()), [tones]);
  if (!group) return null;
  return (
    <group>
      {group.points.map((p, i) => {
        const shape = SHAPES[kind][i % 3];
        const h = shape.profile[shape.profile.length - 1][1];
        const top = ceilingAt(layout, p);
        const bottom = group.bottom + DROP[kind][i % 3];
        const cable = Math.max(0.05, top - bottom - h);
        return (
          <group key={i} position={[p[0], 0, p[1]]}>
            {/* florón en el techo y cable textil fino */}
            <mesh position={[0, top - 0.015, 0]} material={mats.clayLight}><cylinderGeometry args={[0.05, 0.05, 0.03, 20]} /></mesh>
            <mesh position={[0, bottom + h + cable / 2, 0]} material={kind === 'B' ? mats.textileLight : mats.blackMetal}><cylinderGeometry args={[kind === 'B' ? 0.004 : 0.003, kind === 'B' ? 0.004 : 0.003, cable, 6]} /></mesh>
            <group position={[0, bottom, 0]}>
              <LampShade shape={shape} mat={tones[shape.tone]} />
              <mesh position={[0, 0.05, 0]} material={mats.lampGlow}><sphereGeometry args={[0.04, 14, 10]} /></mesh>
              {lights && <pointLight position={[0, 0.02, 0]} color={WARM} intensity={level * 2.6} distance={6} decay={2} />}
            </group>
          </group>
        );
      })}
    </group>
  );
}

/** Luces de los apliques, de la balda de la cocina y de la estufa (si están en el modelo). */
export function FixtureLights({ furniture, elevationOf, level }: { furniture: Furniture[]; elevationOf: (f: Furniture) => number; level: number }) {
  return (
    <group>
      {furniture.filter((f) => f.type === 'aplique').map((f) => {
        const r = (f.rot * Math.PI) / 180;
        // la pantalla queda 0,11 m por delante del muro
        const off = -f.d / 2 + 0.11;
        return <pointLight key={f.id} position={[f.x - Math.sin(r) * off, elevationOf(f) + f.h + 0.05, f.y + Math.cos(r) * off]} color={WARM} intensity={level * 1.1} distance={4} decay={2} />;
      })}
      {furniture.filter((f) => f.type === 'encimera').map((f) => <KitchenTaskLight key={f.id} f={f} elev={elevationOf(f)} level={level} />)}
    </group>
  );
}

/** luz funcional bajo la balda: alumbra la encimera sin depender de las lámparas decorativas */
function KitchenTaskLight({ f, elev, level }: { f: Furniture; elev: number; level: number }) {
  const r = (f.rot * Math.PI) / 180;
  const at = (off: number): [number, number] => [f.x - Math.sin(r) * off, f.y + Math.cos(r) * off];
  const [tx, tz] = at(-f.d / 2 + 0.25);
  const [lx, lz] = at(-f.d / 2 + 0.22);
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(tx, elev + 0.9, tz);
  return (
    <group>
      <primitive object={target} />
      <spotLight position={[lx, elev + f.h + 0.58, lz]} target={target} color="#ffc78f" intensity={level * 6} angle={1.2} penumbra={0.9} distance={3} decay={2} />
    </group>
  );
}
