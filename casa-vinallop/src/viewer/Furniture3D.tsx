import type { ReactNode } from 'react';
import type * as THREE from 'three';
import type { Furniture } from '../data/types';
import type { MaterialSet } from './materials';

/** Mobiliario a escala real (dimensiones del modelo de datos, sin deformar). */
export function Furniture3D({ items, mats, elevationOf }: { items: Furniture[]; mats: MaterialSet; elevationOf: (f: Furniture) => number }) {
  return (
    <group>
      {items.map((f) => (
        <group key={f.id} position={[f.x, elevationOf(f), f.y]} rotation={[0, (-f.rot * Math.PI) / 180, 0]}>
          <Piece f={f} mats={mats} />
        </group>
      ))}
    </group>
  );
}

/** Caja con origen en la base: x, z = centro en planta local; y = cota inferior. */
function B({ x = 0, y = 0, z = 0, w, h, d, m }: { x?: number; y?: number; z?: number; w: number; h: number; d: number; m: THREE.Material }) {
  return (
    <mesh position={[x, y + h / 2, z]} material={m} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
}

function Piece({ f, mats }: { f: Furniture; mats: MaterialSet }): ReactNode {
  const { w, d, h } = f;
  // eje local: +z = frente del mueble (lado inferior del papel con rot 0)
  switch (f.type) {
    case 'cama':
      return (
        <>
          <B w={w} h={0.3} d={d} m={mats.wood} />
          <B y={0.3} w={w - 0.04} h={0.22} d={d - 0.04} m={mats.textileLight} />
          <B y={0.45} z={-d / 2 + 0.6 + 0.1} w={w - 0.02} h={0.08} d={1.2} m={mats.textile} />
          <B y={0.52} x={-w / 4} z={-d / 2 + 0.28} w={w / 2 - 0.12} h={0.12} d={0.4} m={mats.textileLight} />
          <B y={0.52} x={w / 4} z={-d / 2 + 0.28} w={w / 2 - 0.12} h={0.12} d={0.4} m={mats.textileLight} />
          <B z={-d / 2 - 0.03} w={w + 0.04} h={1.0} d={0.06} m={mats.wood} />
        </>
      );
    case 'mesita':
      return <B w={w} h={h} d={d} m={mats.wood} />;
    case 'armario':
      return (
        <>
          <B w={w} h={h} d={d} m={mats.wood} />
          <B y={0.05} z={d / 2 + 0.005} w={0.01} h={h - 0.1} d={0.01} m={mats.metal} />
        </>
      );
    case 'sofa':
      return (
        <>
          <B y={0.1} w={w} h={0.32} d={d} m={mats.textile} />
          <B z={-d / 2 + 0.12} w={w} h={h} d={0.24} m={mats.textile} />
          <B x={-w / 2 + 0.1} w={0.2} h={0.62} d={d} m={mats.textile} />
          <B x={w / 2 - 0.1} w={0.2} h={0.62} d={d} m={mats.textile} />
          <B w={w - 0.1} h={0.1} d={d - 0.1} m={mats.wood} />
        </>
      );
    case 'butaca':
      return (
        <>
          <B y={0.12} w={w} h={0.3} d={d} m={mats.textile} />
          <B z={-d / 2 + 0.1} w={w} h={h} d={0.2} m={mats.textile} />
          <B w={w - 0.08} h={0.12} d={d - 0.08} m={mats.wood} />
        </>
      );
    case 'mesa':
    case 'mesa-centro': {
      const t = 0.04;
      const leg = 0.05;
      return (
        <>
          <B y={h - t} w={w} h={t} d={d} m={mats.wood} />
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
            <B key={i} x={sx * (w / 2 - 0.08)} z={sz * (d / 2 - 0.08)} w={leg} h={h - t} d={leg} m={mats.wood} />
          ))}
        </>
      );
    }
    case 'silla':
      return (
        <>
          <B y={0.43} w={w} h={0.04} d={d} m={mats.wood} />
          <B z={-d / 2 + 0.02} y={0.47} w={w} h={0.38} d={0.03} m={mats.wood} />
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
            <B key={i} x={sx * (w / 2 - 0.03)} z={sz * (d / 2 - 0.03)} w={0.03} h={0.43} d={0.03} m={mats.wood} />
          ))}
        </>
      );
    case 'alfombra':
      return <B w={w} h={0.012} d={d} m={mats.textile} />;
    case 'encimera':
      return (
        <>
          <B w={w} h={0.86} d={d - 0.02} m={mats.wood} />
          <B y={0.86} w={w} h={0.04} d={d} m={mats.counter} />
          <B y={0.9} x={w / 4} w={0.6} h={0.005} d={0.5} m={mats.poche} />
          <B y={0.9} x={-w / 4} w={0.5} h={0.02} d={0.4} m={mats.metal} />
        </>
      );
    case 'nevera':
      return <B w={w} h={h} d={d} m={mats.counter} />;
    case 'inodoro':
      return (
        <>
          <B z={-d / 2 + 0.09} w={w} h={0.8} d={0.18} m={mats.ceramic} />
          <B z={0.06} w={w * 0.9} h={h} d={d - 0.2} m={mats.ceramic} />
        </>
      );
    case 'lavabo':
      return (
        <>
          <B y={0.45} w={w} h={0.4} d={d} m={mats.wood} />
          <B y={0.85} w={w} h={0.05} d={d} m={mats.ceramic} />
        </>
      );
    case 'ducha':
      return (
        <>
          <B w={w} h={0.04} d={d} m={mats.ceramic} />
          <B z={d / 2 - 0.01} x={w / 4} y={0.04} w={w / 2} h={1.95} d={0.01} m={mats.glass} />
        </>
      );
    default:
      return <B w={w} h={h} d={d} m={mats.wood} />;
  }
}
