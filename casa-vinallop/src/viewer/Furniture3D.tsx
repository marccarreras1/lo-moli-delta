/**
 * Mobiliario a escala real, con el detalle que se ve de cerca: juntas de frentes, cojines con cantos
 * suaves, grifería, tiradores, celosías con huecos reales. Las medidas salen del modelo de datos;
 * los detalles (cajones, cojines, baldas) son propuestas de diseño basadas en las referencias
 * descritas por la propiedad, no en las fotos (no se han podido abrir desde este entorno).
 *
 * Eje local: +x a lo largo del mueble, +z = frente (lado inferior del papel con rot 0), y = altura.
 */
import { leafMaterial } from './Trees';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CubeCamera, RoundedBox } from '@react-three/drei';
import { type ReactNode, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { DesignOptions, Furniture, KitchenModule } from '../data/types';
import type { MaterialSet } from './materials';
import { uvBox } from './textures';

interface Props {
  items: Furniture[];
  mats: MaterialSet;
  elevationOf: (f: Furniture) => number;
  options: DesignOptions;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function Furniture3D({ items, mats, elevationOf, options, selectedId, onSelect }: Props) {
  // muebles con madera propia: copia del material de madera (conserva el corte y la transparencia del modo)
  const colors = [...new Set(items.map((f) => f.color).filter((c): c is string => !!c))].join('|');
  const woods = useMemo(() => new Map(colors ? colors.split('|').map((c) => {
    const m = mats.wood.clone();
    m.color.set(c);
    return [c, m] as const;
  }) : []), [colors, mats.wood]);
  useEffect(() => () => woods.forEach((m) => m.dispose()), [woods]);
  return (
    <group>
      {items.map((f) => (
        <group key={f.id} position={[f.x, elevationOf(f), f.y]} rotation={[0, (-f.rot * Math.PI) / 180, 0]}
          onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(f.id); } : undefined}>
          <Piece f={f} mats={f.color && woods.get(f.color) ? { ...mats, wood: woods.get(f.color)! } : mats} options={options} />
          {selectedId === f.id && (
            <mesh position={[0, Math.max(f.h, 0.05) / 2, 0]} renderOrder={10}>
              <boxGeometry args={[f.w + 0.04, Math.max(f.h, 0.05) + 0.04, f.d + 0.04]} />
              <meshBasicMaterial color="#68765e" wireframe transparent opacity={0.9} depthTest={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** Caja con origen en la base: x, z = centro en planta local; y = cota inferior. UV en metros. */
function B({ x = 0, y = 0, z = 0, w, h, d, m, ry = 0, shadow = true }: { x?: number; y?: number; z?: number; w: number; h: number; d: number; m: THREE.Material; ry?: number; shadow?: boolean }) {
  if (w <= 0 || h <= 0 || d <= 0) return null;
  return <mesh position={[x, y + h / 2, z]} rotation={[0, ry, 0]} material={m} geometry={uvBox(w, h, d)} castShadow={shadow} receiveShadow />;
}

/** Pieza blanda con cantos redondeados (cojines, colchones). */
function Soft({ x = 0, y = 0, z = 0, w, h, d, r = 0.04, m, rx = 0 }: { x?: number; y?: number; z?: number; w: number; h: number; d: number; r?: number; m: THREE.Material; rx?: number }) {
  return (
    <RoundedBox args={[w, h, d]} radius={Math.min(r, h / 2 - 0.001, w / 2 - 0.001, d / 2 - 0.001)} smoothness={3} position={[x, y + h / 2, z]} rotation={[rx, 0, 0]} material={m} castShadow receiveShadow />
  );
}

/** Pieza de revolución a partir de un perfil (radio, altura). */
function Lathe({ profile, m, y = 0, x = 0, z = 0, segments = 32 }: { profile: [number, number][]; m: THREE.Material; y?: number; x?: number; z?: number; segments?: number }) {
  const geo = useMemo(() => new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), segments), [profile, segments]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={m} position={[x, y, z]} castShadow receiveShadow />;
}

/** Losa de planta rectangular con esquinas redondeadas (encimeras, tableros). */
function RoundSlab({ w, d, h, r, y = 0, x = 0, z = 0, m }: { w: number; d: number; h: number; r: number; y?: number; x?: number; z?: number; m: THREE.Material }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const hw = w / 2;
    const hd = d / 2;
    s.moveTo(-hw + r, -hd);
    s.lineTo(hw - r, -hd);
    s.quadraticCurveTo(hw, -hd, hw, -hd + r);
    s.lineTo(hw, hd - r);
    s.quadraticCurveTo(hw, hd, hw - r, hd);
    s.lineTo(-hw + r, hd);
    s.quadraticCurveTo(-hw, hd, -hw, hd - r);
    s.lineTo(-hw, -hd + r);
    s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [w, d, h, r]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={m} position={[x, y, z]} castShadow receiveShadow />;
}

function Piece({ f, mats, options }: { f: Furniture; mats: MaterialSet; options: DesignOptions }): ReactNode {
  const { w, d, h } = f;
  switch (f.type) {
    case 'cama': return <Bed w={w} d={d} mats={mats} />;
    case 'mesita':
      return (
        <>
          <B w={w} h={h - 0.02} d={d} m={mats.wood} />
          <B y={h - 0.02} w={w + 0.01} h={0.02} d={d + 0.01} m={mats.wood} />
          <B y={h - 0.2} z={d / 2 + 0.001} w={w - 0.04} h={0.004} d={0.004} m={mats.poche} shadow={false} />
          <B y={h - 0.12} z={d / 2 + 0.008} w={0.08} h={0.015} d={0.015} m={mats.brass} />
          <Lathe y={h} x={-w / 5} profile={[[0, 0], [0.05, 0], [0.06, 0.08], [0.03, 0.16], [0.02, 0.2], [0, 0.2]]} m={mats.clay} />
        </>
      );
    case 'balda':
      // balda volada de madera fijada al muro (deja libre el suelo)
      return (
        <>
          <B y={h - 0.035} w={w} h={0.035} d={d} m={mats.wood} />
          <B y={h - 0.035} z={-d / 2 + 0.01} w={w * 0.6} h={0.002} d={0.02} m={mats.blackMetal} />
        </>
      );
    case 'armario': return f.open ? <OpenCloset w={w} d={d} h={h} mats={mats} /> : <Wardrobe w={w} d={d} h={h} mats={mats} />;
    case 'sofa':
    case 'sofa-l': return <MasonrySofa w={w} d={d} h={h} mats={mats} cushions={w > 3} />;
    case 'butaca':
      return (
        <>
          <B y={0.12} w={w} h={0.3} d={d} m={mats.textile} />
          <B z={-d / 2 + 0.1} w={w} h={h} d={0.2} m={mats.textile} />
          <B w={w - 0.08} h={0.12} d={d - 0.08} m={mats.wood} />
        </>
      );
    case 'mesa':
    case 'mesa-centro': return <WoodTable w={w} d={d} h={h} mats={mats} />;
    case 'silla':
      return (
        <>
          <B y={0.43} w={w} h={0.04} d={d} m={mats.wood} />
          <B z={-d / 2 + 0.02} y={0.47} w={w} h={0.38} d={0.03} m={mats.wood} />
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => <B key={i} x={sx * (w / 2 - 0.03)} z={sz * (d / 2 - 0.03)} w={0.03} h={0.43} d={0.03} m={mats.wood} />)}
        </>
      );
    case 'alfombra':
      return (
        <>
          <B w={w} h={0.012} d={d} m={mats.rug} />
          <B y={0.0} w={w + 0.03} h={0.008} d={d + 0.03} m={mats.textileLight} />
        </>
      );
    case 'encimera': return <Kitchen w={w} d={d} h={h} modules={f.modules ?? []} mats={mats} underStair={f.underStair} />;
    case 'isla': return <Island w={w} d={d} h={h} mats={mats} />;
    case 'taburete': return <Stool h={h} mats={mats} />;
    case 'banera':
      return (
        <>
          <B w={w} h={h} d={d} m={mats.ceramic} />
          <B y={h - 0.02} w={w - 0.16} h={0.025} d={d - 0.16} m={mats.glass} />
        </>
      );
    case 'banco':
      return (
        <>
          <B w={w} h={0.38} d={d} m={mats.interior} />
          <Soft y={0.38} z={0.05} w={w - 0.04} h={0.08} d={d - 0.14} m={mats.textile} />
          <Soft y={0.46} z={-d / 2 + 0.06} w={w - 0.04} h={0.36} d={0.12} m={mats.textile} />
        </>
      );
    case 'chimenea-obra': return <MasonryFireplace w={w} d={d} h={h} mats={mats} />;
    case 'estufa':
      // estufa de leña redonda con salida de humos hasta la cubierta (salida supuesta)
      return (
        <>
          <mesh position={[0, 0.03, 0]} material={mats.counter} receiveShadow><cylinderGeometry args={[w / 2, w / 2, 0.06, 40]} /></mesh>
          <Lathe y={0.06} profile={[[0, 0], [w * 0.3, 0], [w * 0.34, 0.15], [w * 0.36, h * 0.6], [w * 0.3, h - 0.06], [0.09, h - 0.06], [0, h - 0.06]]} m={mats.blackMetal} segments={40} />
          <mesh position={[0, h + 2.45, 0]} material={mats.blackMetal}><cylinderGeometry args={[0.075, 0.075, 4.9, 20]} /></mesh>
          <B y={0.25} z={w * 0.33} w={0.26} h={0.22} d={0.02} m={mats.lampGlow} shadow={false} />
        </>
      );
    case 'nevera': return <B w={w} h={h} d={d} m={mats.counter} />;
    case 'inodoro': return <Toilet w={w} d={d} mats={mats} />;
    case 'lavabo': return <MasonryVanity w={w} d={d} h={h} mats={mats} />;
    case 'ducha': return <Shower w={w} d={d} mats={mats} lattice={options.celosia} />;
    case 'jarron': return <Lathe profile={[[0, 0], [0.07, 0], [0.11, 0.12], [0.1, 0.28], [0.05, 0.36], [0.055, h], [0, h]]} m={mats.clay} />;
    case 'maceta': return <Planter w={w} h={h} mats={mats} />;
    case 'aplique':
      // aplique de pared: brazo de latón y pantalla de cerámica abierta hacia arriba
      return (
        <group position={[0, h, 0]}>
          <B z={-d / 2} y={-0.06} w={0.08} h={0.12} d={0.01} m={mats.brass} />
          <B z={-d / 2 + 0.05} w={0.015} h={0.015} d={0.1} m={mats.brass} />
          <Lathe z={-d / 2 + 0.11} y={-0.04} profile={[[0.02, 0], [0.06, 0.03], [0.085, 0.11], [0.08, 0.115]]} m={mats.clayLight} />
          <mesh position={[0, 0.03, -d / 2 + 0.11]} material={mats.lampGlow}><sphereGeometry args={[0.03, 12, 8]} /></mesh>
        </group>
      );
    case 'mesa-exterior': return <RoundTable w={w} h={h} mats={mats} />;
    case 'mesa-redonda': return <RoundTable w={w} h={h} mats={mats} wood />;
    case 'silla-exterior': return <OutdoorChair w={w} d={d} mats={mats} />;
    default:
      return <B w={w} h={h} d={d} m={mats.wood} />;
  }
}

// ---------------------------------------------------------------- dormitorio

function Bed({ w, d, mats }: { w: number; d: number; mats: MaterialSet }) {
  const base = 0.24;
  const mat = 0.22;
  return (
    <>
      {/* canapé de madera con zócalo retranqueado */}
      <B y={0.06} w={w} h={base - 0.06} d={d} m={mats.wood} />
      <B w={w - 0.1} h={0.06} d={d - 0.1} m={mats.poche} shadow={false} />
      {/* colchón */}
      <Soft y={base} w={w - 0.04} h={mat} d={d - 0.06} r={0.05} m={mats.textileLight} />
      {/* nórdico con caída lateral y embozo doblado */}
      <Soft y={base + mat - 0.03} z={0.12} w={w + 0.04} h={0.08} d={d - 0.38} r={0.04} m={mats.textileLight} />
      <Soft y={base + mat + 0.03} z={-d / 2 + 0.62} w={w + 0.03} h={0.05} d={0.22} r={0.025} m={mats.textileLight} />
      {/* manta al pie */}
      <Soft y={base + mat + 0.035} z={d / 2 - 0.35} w={w + 0.06} h={0.025} d={0.45} r={0.012} m={mats.textile} />
      {/* almohadas y cojines */}
      {[-1, 1].map((k) => (
        <group key={k}>
          <Soft x={(k * w) / 4} y={base + mat - 0.01} z={-d / 2 + 0.3} w={w / 2 - 0.1} h={0.14} d={0.42} r={0.06} m={mats.textileLight} rx={-0.25} />
        </group>
      ))}
      <Soft y={base + mat + 0.02} z={-d / 2 + 0.52} w={0.45} h={0.12} d={0.3} r={0.05} m={mats.textile} rx={-0.4} />
      {/* cabecero de tablas de madera */}
      {(() => {
        const n = Math.round((w + 0.3) / 0.18);
        const bw = (w + 0.3) / n;
        return Array.from({ length: n }, (_, i) => <B key={i} x={-(w + 0.3) / 2 + bw * (i + 0.5)} z={-d / 2 - 0.03} w={bw - 0.006} h={1.05} d={0.04} m={mats.wood} />);
      })()}
    </>
  );
}

function Wardrobe({ w, d, h, mats }: { w: number; d: number; h: number; mats: MaterialSet }) {
  const n = Math.max(2, Math.round(w / 0.5));
  const dw = w / n;
  return (
    <>
      <B w={w} h={h} d={d - 0.02} m={mats.wood} />
      <B w={w - 0.02} h={0.08} d={d - 0.04} z={0.01} m={mats.poche} shadow={false} />
      {Array.from({ length: n }, (_, i) => (
        <group key={i}>
          <B x={-w / 2 + dw * (i + 0.5)} y={0.08} z={d / 2 - 0.01} w={dw - 0.004} h={h - 0.1} d={0.02} m={mats.wood} />
          {/* tirador de madera vertical, alternando lados */}
          <B x={-w / 2 + dw * (i + (i % 2 ? 0.1 : 0.9))} y={0.95} z={d / 2 + 0.008} w={0.025} h={0.35} d={0.02} m={mats.woodBeam} />
        </group>
      ))}
    </>
  );
}

function OpenCloset({ w, d, h, mats }: { w: number; d: number; h: number; mats: MaterialSet }) {
  // abierto, sin puertas: fondo, costados, techo, suelo, baldas, barra y algo de ropa doblada
  const t = 0.025;
  return (
    <>
      <B z={-d / 2 + t / 2} w={w} h={h} d={t} m={mats.wood} />
      <B x={-w / 2 + t / 2} w={t} h={h} d={d} m={mats.wood} />
      <B x={w / 2 - t / 2} w={t} h={h} d={d} m={mats.wood} />
      <B w={w} h={0.08} d={d} m={mats.wood} />
      <B y={h - t} w={w} h={t} d={d} m={mats.wood} />
      {[0.45, 0.85].map((y) => <B key={y} y={y} w={w - 2 * t} h={t} d={d - t} m={mats.wood} />)}
      <B y={1.75} w={w - 2 * t} h={t} d={d - t} m={mats.wood} />
      <mesh position={[0, 1.66, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.brass}><cylinderGeometry args={[0.012, 0.012, w - 0.06, 10]} /></mesh>
      {[-0.35, 0, 0.35].map((x) => <Soft key={x} x={x * (w / 1.3)} y={0.47} w={0.3} h={0.12} d={0.32} r={0.02} m={x === 0 ? mats.textile : mats.textileLight} />)}
      {[-0.2, 0.15].map((x) => <Soft key={x} x={x * w} y={0.87} w={0.34} h={0.18} d={0.34} r={0.03} m={mats.rug} />)}
    </>
  );
}

// ---------------------------------------------------------------- salón

/**
 * Sofá de obra encalado con colchoneta de asiento por tramos, cojines de respaldo y algún cojín
 * suelto (referencia del salón, descrita). Respaldo contra el muro (lado -z).
 */
function MasonrySofa({ w, d, h, mats, cushions }: { w: number; d: number; h: number; mats: MaterialSet; cushions: boolean }) {
  const baseH = 0.3;
  const seatT = 0.15;
  const backD = 0.2;
  const n = Math.max(1, Math.round(w / 0.75));
  const sw = w / n;
  return (
    <>
      {/* banco de obra con canto redondeado y zócalo retranqueado */}
      <Soft y={0.04} w={w} h={baseH - 0.04} d={d} r={0.03} m={mats.interior} />
      <B w={w - 0.04} h={0.04} d={d - 0.06} z={-0.02} m={mats.poche} shadow={false} />
      {/* colchonetas de asiento */}
      {Array.from({ length: n }, (_, i) => <Soft key={`s${i}`} x={-w / 2 + sw * (i + 0.5)} y={baseH} z={backD / 2 - 0.02} w={sw - 0.012} h={seatT} d={d - backD + 0.02} r={0.05} m={mats.textileLight} />)}
      {/* cojines de respaldo, algo inclinados */}
      {Array.from({ length: n }, (_, i) => <Soft key={`b${i}`} x={-w / 2 + sw * (i + 0.5)} y={baseH + seatT - 0.02} z={-d / 2 + backD / 2 + 0.02} w={sw - 0.02} h={h - baseH - seatT + 0.12} d={backD} r={0.07} m={mats.textileLight} rx={-0.12} />)}
      {/* cojines sueltos */}
      {cushions && [-0.32, -0.18, 0.3].map((k, i) => (
        <Soft key={`c${i}`} x={k * w} y={baseH + seatT - 0.01} z={-d / 2 + backD + 0.1} w={0.42} h={0.4} d={0.13} r={0.06} m={i === 1 ? mats.textile : mats.rug} rx={-0.22} />
      ))}
    </>
  );
}

function WoodTable({ w, d, h, mats }: { w: number; d: number; h: number; mats: MaterialSet }) {
  if (h < 0.5) {
    // mesa baja maciza de la referencia 03: dos tablones gruesos superpuestos sobre patas cortas
    const top = 0.09;
    const mid = 0.07;
    const legH = h - top - mid;
    return (
      <>
        <RoundSlab y={h - top} w={w} d={d} h={top - 0.012} r={0.015} m={mats.wood} />
        <B y={legH} w={w - 0.06} h={mid} d={d - 0.06} m={mats.wood} />
        {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => <B key={i} x={sx * (w / 2 - 0.1)} z={sz * (d / 2 - 0.1)} w={0.05} h={legH} d={0.05} m={mats.woodBeam} />)}
      </>
    );
  }
  const t = 0.05;
  const leg = 0.07;
  return (
    <>
      <RoundSlab y={h - t} w={w} d={d} h={t - 0.012} r={0.03} m={mats.wood} />
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => <B key={i} x={sx * (w / 2 - 0.09)} z={sz * (d / 2 - 0.09)} w={leg} h={h - t} d={leg} m={mats.wood} />)}
      {h < 0.5 && <B y={0.08} w={w - 0.2} h={0.025} d={d - 0.2} m={mats.wood} />}
    </>
  );
}

/** Tinaja de barro con un olivo joven (hojas en tarjetas recortadas, como los olivos del entorno). */
function Planter({ w, h, mats }: { w: number; h: number; mats: MaterialSet }) {
  const r = w / 2;
  const potH = Math.min(0.62, h * 0.4);
  const leaf = useMemo(() => leafMaterial('olivo'), []);
  const crown = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const rr = (i: number) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    for (let i = 0; i < 14; i++) {
      const p = new THREE.PlaneGeometry(0.42, 0.36);
      p.rotateY(rr(i) * Math.PI);
      p.rotateX((rr(i + 7) - 0.5) * 1.1);
      const a = rr(i + 3) * Math.PI * 2;
      const d = rr(i + 5) * 0.22;
      p.translate(Math.cos(a) * d, (h - potH) * (0.55 + rr(i + 9) * 0.4), Math.sin(a) * d);
      parts.push(p);
    }
    return mergeGeometries(parts.map((g) => g.toNonIndexed()), false)!;
  }, [h, potH]);
  useEffect(() => () => { leaf.dispose(); crown.dispose(); }, [leaf, crown]);
  return (
    <>
      {/* tinaja panzuda de barro con labio */}
      <Lathe profile={[[0, 0.01], [r * 0.55, 0], [r * 0.85, potH * 0.25], [r, potH * 0.6], [r * 0.82, potH * 0.92], [r * 0.7, potH], [r * 0.74, potH * 1.02], [r * 0.66, potH * 1.02], [0, potH * 0.95]]} m={mats.clay} segments={40} />
      <mesh position={[0, potH + (h - potH) * 0.3, 0]} material={mats.woodBeam} castShadow><cylinderGeometry args={[0.018, 0.03, (h - potH) * 0.6, 7]} /></mesh>
      <mesh geometry={crown} material={leaf} position={[0, potH, 0]} castShadow />
    </>
  );
}

// ---------------------------------------------------------------- cocina

/**
 * Cocina lineal: frentes lisos de madera clara con juntas de 3 mm, zócalo retranqueado, encimera
 * mineral, salpicadero mineral, balda corrida de madera con tira de luz, fregadero bajo encimera
 * con grifo negro mate, placa de inducción con horno debajo, lavavajillas y frigorífico integrados.
 */
function Kitchen({ w, d, h, modules, mats, underStair }: { w: number; d: number; h: number; modules: KitchenModule[]; mats: MaterialSet; underStair?: boolean }) {
  const plinth = 0.1;
  const top = 0.03;
  const bodyH = h - top;
  const front = d / 2;
  let cursor = -w / 2;
  const mods = modules.length ? modules : [{ kind: 'puertas' as const, w }];
  return (
    <>
      <B y={plinth} z={-0.01} w={w} h={bodyH - plinth} d={d - 0.04} m={mats.wood} />
      <B z={-0.04} w={w - 0.02} h={plinth} d={d - 0.12} m={mats.poche} shadow={false} />
      <B y={bodyH} w={w + 0.01} h={top} d={d + 0.01} m={mats.counter} />
      {/* salpicadero y balda corrida contra el muro (no bajo la escalera: encima vuelan los peldaños) */}
      {!underStair && <>
      <B y={h} z={-d / 2 + 0.01} w={w} h={0.62} d={0.02} m={mats.counter} />
      <B y={h + 0.62} z={-d / 2 + 0.13} w={w} h={0.04} d={0.26} m={mats.wood} />
      <B y={h + 0.6} z={-d / 2 + 0.22} w={w - 0.1} h={0.012} d={0.02} m={mats.lampGlow} shadow={false} />
      {/* piezas de cerámica sobre la balda */}
      <Lathe x={-w / 2 + 0.3} y={h + 0.66} z={-d / 2 + 0.12} profile={[[0, 0], [0.05, 0], [0.08, 0.06], [0.08, 0.09], [0, 0.09]]} m={mats.clayLight} />
      <Lathe x={-w / 2 + 0.55} y={h + 0.66} z={-d / 2 + 0.12} profile={[[0, 0], [0.04, 0], [0.05, 0.18], [0.035, 0.22], [0, 0.22]]} m={mats.clay} />
      <Lathe x={w / 2 - 0.4} y={h + 0.66} z={-d / 2 + 0.12} profile={[[0, 0], [0.09, 0], [0.11, 0.05], [0.12, 0.06], [0, 0.06]]} m={mats.ceramic} />
      </>}
      {mods.map((mod, i) => {
        const x0 = cursor;
        cursor += mod.w;
        const cx = x0 + mod.w / 2;
        const fw = mod.w - 0.003;
        const frontPanels = (rows: number[]) => {
          // filas de frentes de abajo arriba (alturas); juntas de 3 mm
          let y = plinth;
          return rows.map((rh, k) => {
            const el = <B key={k} x={cx} y={y + 0.0015} z={front - 0.009} w={fw} h={rh - 0.003} d={0.018} m={mats.wood} />;
            y += rh;
            return el;
          });
        };
        const avail = bodyH - plinth;
        switch (mod.kind) {
          case 'fregadero':
            return (
              <group key={i}>
                {frontPanels([avail])}
                {/* cubeta bajo encimera y grifo negro mate de caño alto */}
                <B x={cx} y={bodyH - 0.17} z={0.02} w={mod.w - 0.14} h={0.17} d={d - 0.2} m={mats.ceramic} />
                <B x={cx} y={bodyH + top - 0.001} z={0.02} w={mod.w - 0.16} h={0.002} d={d - 0.22} m={mats.poche} shadow={false} />
                <group position={[cx, h, -d / 2 + 0.07]}>
                  <mesh position={[0, 0.16, 0]} material={mats.blackMetal}><cylinderGeometry args={[0.014, 0.018, 0.32, 14]} /></mesh>
                  <mesh position={[0, 0.32, 0.08]} rotation={[Math.PI / 2, 0, 0]} material={mats.blackMetal}><torusGeometry args={[0.08, 0.012, 8, 20, Math.PI]} /></mesh>
                  <mesh position={[0.045, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.blackMetal}><cylinderGeometry args={[0.006, 0.006, 0.07, 8]} /></mesh>
                </group>
              </group>
            );
          case 'lavavajillas':
            return <group key={i}>{frontPanels([avail])}</group>;
          case 'placa-horno':
            return (
              <group key={i}>
                {frontPanels([0.18])}
                {/* horno: puerta de vidrio negro con tirador */}
                <B x={cx} y={plinth + 0.18} z={front - 0.008} w={fw} h={avail - 0.18 - 0.14} d={0.02} m={mats.blackMetal} />
                <B x={cx} y={plinth + avail - 0.2} z={front + 0.012} w={fw - 0.1} h={0.015} d={0.02} m={mats.metal} />
                <B x={cx} y={bodyH - 0.14} z={front - 0.009} w={fw} h={0.135} d={0.018} m={mats.wood} />
                {/* placa de inducción enrasada */}
                <B x={cx} y={h - 0.001} z={0.01} w={mod.w - 0.04} h={0.004} d={d - 0.08} m={mats.blackMetal} shadow={false} />
              </group>
            );
          case 'frigorifico':
            return <group key={i}>{frontPanels([avail * 0.6, avail * 0.4])}</group>;
          case 'cajones':
            return <group key={i}>{frontPanels([avail * 0.4, avail * 0.32, avail * 0.28])}</group>;
          default:
            return <group key={i}>{frontPanels([avail])}</group>;
        }
      })}
    </>
  );
}

/**
 * Isla de obra (estructura de una referencia, acabado de otra): dos apoyos macizos con estantes
 * abiertos hacia los costados, cuerpo central cerrado hacia la cocina (+z) y hueco para taburetes
 * hacia el frontal A (−z). Revestimiento de piezas estrechas verticales de terracota con junta
 * clara; encimera mineral clara con esquinas suavizadas.
 */
/**
 * Isla de obra: estructura de la referencia 05 y acabado de la 06.
 *   Cara de los taburetes (−z): hueco de 1,00 m para las piernas y, al lado, dos baldas abiertas
 *   (hueco inferior de 0,30 m, balda de 0,10 m y hueco superior hasta la encimera).
 *   Revestimiento de piezas verticales de terracota en junta continua con llaga blanca y
 *   encimera clara de cantos redondeados con vuelo.
 */
function Island({ w, d, h, mats }: { w: number; d: number; h: number; mats: MaterialSet }) {
  const top = 0.05;
  const wall = 0.06;
  const recess = Math.min(1.0, w - 3 * wall - 0.3);
  const shelfW = w - 3 * wall - recess;
  const knee = 0.4;
  const bodyH = h - top;
  const x0 = -w / 2;
  const rx0 = x0 + wall;
  const rx1 = rx0 + recess;
  const sx0 = rx1 + wall;
  const sx1 = sx0 + shelfW;
  const zOpen = -d / 2;
  return (
    <>
      {/* testeros y tabique entre el hueco de piernas y las baldas */}
      <B x={x0 + wall / 2} w={wall} h={bodyH} d={d} m={mats.terracottaTile} />
      <B x={w / 2 - wall / 2} w={wall} h={bodyH} d={d} m={mats.terracottaTile} />
      <B x={rx1 + wall / 2} w={wall} h={bodyH} d={d} m={mats.terracottaTile} />
      {/* cuerpo cerrado hacia la cocina (detrás de los huecos) */}
      <B x={(rx0 + sx1) / 2} z={zOpen + knee + (d - knee) / 2} w={sx1 - rx0} h={bodyH} d={d - knee} m={mats.terracottaTile} />
      {/* fondo del hueco de piernas y de las baldas, en blanco de obra */}
      <B x={(rx0 + rx1) / 2} z={zOpen + knee - 0.005} w={recess} h={bodyH} d={0.01} m={mats.interior} />
      <B x={(sx0 + sx1) / 2} z={zOpen + knee - 0.005} w={shelfW} h={bodyH} d={0.01} m={mats.interior} />
      {/* baldas: base, hueco de 0,30 m, balda de 0,10 m */}
      <B x={(sx0 + sx1) / 2} z={zOpen + knee / 2} w={shelfW} h={0.04} d={knee} m={mats.interior} />
      <B x={(sx0 + sx1) / 2} y={0.34} z={zOpen + knee / 2} w={shelfW} h={0.1} d={knee} m={mats.interior} />
      <B x={(rx0 + rx1) / 2} y={bodyH - 0.05} z={zOpen + knee / 2} w={recess} h={0.05} d={knee} m={mats.interior} />
      {/* objetos en las baldas */}
      <Lathe x={(sx0 + sx1) / 2} y={0.44} z={zOpen + 0.2} profile={[[0, 0], [0.07, 0], [0.11, 0.06], [0.1, 0.11], [0.05, 0.13], [0, 0.13]]} m={mats.clay} />
      <Lathe x={(sx0 + sx1) / 2} y={0.04} z={zOpen + 0.2} profile={[[0, 0], [0.08, 0], [0.09, 0.12], [0.06, 0.16], [0, 0.16]]} m={mats.clayLight} />
      {/* encimera clara gruesa de cantos redondeados, con vuelo */}
      <RoundSlab y={bodyH} w={w + 0.06} d={d + 0.06} h={top - 0.012} r={0.08} m={mats.counter} />
    </>
  );
}

function Stool({ h, mats }: { h: number; mats: MaterialSet }) {
  return (
    <>
      <mesh position={[0, h - 0.02, 0]} material={mats.wood} castShadow><cylinderGeometry args={[0.18, 0.17, 0.04, 28]} /></mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.12, (h - 0.04) / 2, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08]} material={mats.wood} castShadow>
            <cylinderGeometry args={[0.014, 0.017, h - 0.04, 8]} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.blackMetal}><torusGeometry args={[0.135, 0.008, 6, 28]} /></mesh>
    </>
  );
}

// ---------------------------------------------------------------- baño

function Toilet({ w, d, mats }: { w: number; d: number; mats: MaterialSet }) {
  return (
    <>
      {/* inodoro suspendido con cisterna empotrada: placa de latón */}
      <B z={-d / 2 + 0.04} w={w + 0.1} h={1.1} d={0.08} m={mats.interior} />
      <B z={-d / 2 + 0.085} y={0.95} w={0.18} h={0.12} d={0.01} m={mats.brass} />
      <Soft y={0.2} z={0.05} w={w} h={0.2} d={d - 0.12} r={0.08} m={mats.ceramic} />
      <Soft y={0.4} z={0.05} w={w + 0.01} h={0.025} d={d - 0.11} r={0.012} m={mats.ceramic} />
    </>
  );
}

/**
 * Lavabo de obra (referencia 04): encimera continua clara con seno integrado, dos cajones de madera,
 * hueco inferior libre, balda abierta lateral con toallas, franja de piezas verticales de terracota,
 * grifería mural de latón de tres piezas y espejo grande sin marco.
 */
function MasonryVanity({ w, d, h, mats }: { w: number; d: number; h: number; mats: MaterialSet }) {
  const slab = 0.12;
  const side = 0.08;
  const shelfW = Math.min(0.3, w * 0.28);
  const drawerH = 0.24;
  const wall = -d / 2;
  const dw = w - 2 * side - shelfW - 0.06;
  const dx = -w / 2 + side + dw / 2;
  const basinW = Math.min(0.5, dw - 0.1);
  return (
    <>
      {/* encimera y costados de obra */}
      <Soft y={h - slab} w={w} h={slab} d={d} r={0.025} m={mats.interior} />
      {[-w / 2 + side / 2, w / 2 - side / 2, w / 2 - side - shelfW - 0.03].map((x, i) => <B key={i} x={x} w={i === 2 ? 0.06 : side} h={h - slab} d={d} m={mats.interior} />)}
      {/* bandeja de obra bajo los cajones */}
      <B x={dx} y={h - slab - drawerH - 0.06} w={dw} h={0.06} d={d - 0.02} m={mats.interior} />
      {/* dos cajones de madera enrasados */}
      {[-1, 1].map((k) => (
        <group key={k}>
          <B x={dx + (k * dw) / 4} y={h - slab - drawerH} z={d / 2 - 0.035} w={dw / 2 - 0.008} h={drawerH - 0.008} d={0.025} m={mats.wood} />
          <B x={dx + (k * dw) / 4} y={h - slab - drawerH} z={-0.02} w={dw / 2 - 0.012} h={drawerH - 0.012} d={d - 0.09} m={mats.wood} />
        </group>
      ))}
      {/* balda abierta lateral con toallas */}
      <B x={w / 2 - side - shelfW / 2} y={h - slab - drawerH - 0.06} w={shelfW} h={0.04} d={d - 0.04} m={mats.interior} />
      <Soft x={w / 2 - side - shelfW / 2} y={h - slab - drawerH - 0.02} w={shelfW - 0.06} h={0.1} d={d - 0.18} r={0.03} m={mats.textileLight} />
      <Soft x={w / 2 - side - shelfW / 2} y={h - slab - drawerH + 0.08} w={shelfW - 0.08} h={0.07} d={d - 0.2} r={0.025} m={mats.textileLight} />
      {/* seno integrado en la encimera: hueco rectangular de esquinas suaves */}
      <B x={dx} y={h - 0.06} z={0.03} w={basinW} h={0.002} d={0.32} m={mats.ceramic} shadow={false} />
      <B x={dx} y={h - 0.065} z={0.03} w={basinW - 0.04} h={0.062} d={0.28} m={mats.counter} shadow={false} />
      <mesh position={[dx, h - 0.058, 0.08]} rotation={[-Math.PI / 2, 0, 0]} material={mats.brass}><circleGeometry args={[0.022, 16]} /></mesh>
      {/* franja de piezas verticales de terracota */}
      <B y={h} z={wall + 0.006} w={w} h={0.34} d={0.012} m={mats.terracottaTile} />
      {/* grifería mural de latón de tres piezas sobre la franja */}
      <group position={[dx, h + 0.2, wall + 0.012]}>
        <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[0.011, 0.011, 0.16, 12]} /></mesh>
        {[-0.1, 0, 0.1].map((x) => <mesh key={x} position={[x, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[0.028, 0.028, 0.012, 20]} /></mesh>)}
        {[-0.1, 0.1].map((x) => <mesh key={x} position={[x, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[0.012, 0.012, 0.04, 10]} /></mesh>)}
      </group>
      {/* espejo grande sin marco, de ancho casi completo */}
      <MirrorPane y={h + 0.34 + 0.06 + 0.5} z={wall + 0.016} w={w - 0.08} h={1.0} base={mats.mirror} />
      <B y={h + 0.34 + 0.06} z={wall + 0.004} w={w - 0.08} h={1.0} d={0.008} m={mats.blackMetal} shadow={false} />
    </>
  );
}

/**
 * Zona húmeda con DOS DUCHAS ENFRENTADAS (confirmado): un rociador en cada pared lateral (−x y +x),
 * orientados hacia la zona común, cada uno con su mando independiente. Plato enrasado común con
 * sumidero lineal. Hacia la zona seca (−z) la celosía cerámica (A o B, propuesta) deja un acceso
 * central; por la cara húmeda, vidrio fijo; en el acceso, cortina en carril independiente.
 *
 * Eje local: −x / +x = paredes laterales del baño, −z = zona seca (entrada), +z = muro del frontal B.
 */
function Shower({ w, d, mats, lattice }: { w: number; d: number; mats: MaterialSet; lattice: 'A' | 'B' }) {
  const H = 2.1;
  const access = 0.9;
  const t = 0.1;
  const seg = (w - access) / 2;
  const zl = -d / 2 - t / 2;
  return (
    <>
      {/* plato enrasado de microcemento con ligera pendiente y sumidero lineal junto al muro del fondo */}
      <B w={w} h={0.012} d={d} m={mats.counter} />
      <B y={0.012} z={d / 2 - 0.12} w={w - 0.6} h={0.003} d={0.05} m={mats.brass} shadow={false} />
      {/* celosía hacia la zona seca, a ambos lados del acceso central */}
      {[-1, 1].map((k) => <LatticeWall key={k} x={k * (access / 2 + seg / 2)} z={zl} len={seg} H={H} t={t} ry={0} kind={lattice} mats={mats} />)}
      {/* vidrio fijo por la cara húmeda de la celosía */}
      {[-1, 1].map((k) => <B key={k} x={k * (access / 2 + seg / 2)} y={0.012} z={-d / 2 + 0.015} w={seg - 0.02} h={H - 0.06} d={0.01} m={mats.glass} shadow={false} />)}
      {/* carril independiente con cortina recogida en el acceso */}
      <mesh position={[0, H + 0.02, -d / 2 + 0.06]} rotation={[0, 0, Math.PI / 2]} material={mats.brass}><cylinderGeometry args={[0.01, 0.01, access + 0.1, 10]} /></mesh>
      {[-1, 1].map((k) => <mesh key={k} position={[k * (access / 2 + 0.05), H + 0.02, -d / 2 + 0.03]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[0.008, 0.008, 0.07, 8]} /></mesh>)}
      <Curtain x={-access / 2 + 0.11} z={-d / 2 + 0.06} width={0.22} height={H - 0.12} mats={mats} />
      {/* dos rociadores enfrentados, uno en cada pared lateral, con mandos independientes */}
      {[-1, 1].map((k) => (
        <group key={k} position={[k * (w / 2), 0, 0.05]} rotation={[0, k < 0 ? 0 : Math.PI, 0]}>
          <mesh position={[0.17, 2.08, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.brass}><cylinderGeometry args={[0.012, 0.012, 0.34, 10]} /></mesh>
          <mesh position={[0.02, 2.0, 0]} material={mats.brass}><cylinderGeometry args={[0.012, 0.012, 0.16, 10]} /></mesh>
          <mesh position={[0.34, 2.06, 0]} material={mats.brass}><cylinderGeometry args={[0.1, 0.1, 0.014, 28]} /></mesh>
          {/* mando termostático propio */}
          <mesh position={[0.01, 1.1, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.brass}><cylinderGeometry args={[0.04, 0.04, 0.02, 20]} /></mesh>
          <mesh position={[0.035, 1.1, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.brass}><cylinderGeometry args={[0.012, 0.012, 0.04, 10]} /></mesh>
        </group>
      ))}
      {/* hornacina de obra en el muro del fondo, en la mitad sin puerta (en la otra está la puerta de vidrio al exterior) */}
      {[-1].map((k) => (
        <group key={k} position={[k * (w / 2 - 0.45), 0, d / 2]}>
          <B y={1.05} z={-0.04} w={0.5} h={0.4} d={0.08} m={mats.interior} />
          <B y={1.1} z={-0.03} w={0.42} h={0.3} d={0.07} m={mats.terracottaTile} />
          <Lathe x={-0.08} y={1.1} z={-0.06} profile={[[0, 0], [0.03, 0], [0.035, 0.14], [0.015, 0.18], [0, 0.18]]} m={mats.clayLight} />
        </group>
      ))}
    </>
  );
}

/**
 * Chimenea de obra (variante, imagen de referencia): banco de obra con remate oscuro delante del
 * fuego, volumen encalado hasta la cubierta con hogar acristalado y leñero vertical empotrado.
 * Eje local: −z = muro, +z = estancia.
 */
function MasonryFireplace({ w, d, h, mats }: { w: number; d: number; h: number; mats: MaterialSet }) {
  const m = useMemo(() => ({
    stone: new THREE.MeshStandardMaterial({ color: '#2c2a27', roughness: 0.55 }),
    fire: new THREE.MeshStandardMaterial({ color: '#ff8a3a', emissive: '#ff6a14', emissiveIntensity: 2.4, roughness: 1, transparent: true, opacity: 0.9 }),
    flame: new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb340', emissiveIntensity: 2.6, roughness: 1, transparent: true, opacity: 0.85 }),
    ember: new THREE.MeshStandardMaterial({ color: '#4a1a0a', emissive: '#ff4a10', emissiveIntensity: 1.2, roughness: 1 }),
    end: new THREE.MeshStandardMaterial({ color: '#c79260', roughness: 0.9 }),
    bark: new THREE.MeshStandardMaterial({ color: '#5a4230', roughness: 1 }),
  }), []);
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  const bench = 0.42;
  const top = 0.04;
  const y0 = bench + top;
  const bd = Math.min(0.5, d - 0.1); // fondo del volumen de obra
  const zb = -d / 2;
  const zf = zb + bd;
  const P = (x0: number, x1: number, ya: number, yb: number, depth = bd) => <B x={(x0 + x1) / 2} y={ya} z={zb + depth / 2} w={x1 - x0} h={yb - ya} d={depth} m={mats.interior} />;
  // leñero a la izquierda, hogar en el resto
  const n0 = -w / 2 + 0.12, n1 = n0 + 0.32, nTop = 2.3, nDepth = 0.35;
  const fw = 0.75, fh = 0.65, fDepth = 0.4;
  const fc = (n1 + 0.12 + w / 2) / 2;
  const f0 = fc - fw / 2, f1 = fc + fw / 2, fTop = y0 + fh;
  const logs = useMemo(() => {
    const out: { x: number; y: number; r: number; rot: number }[] = [];
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let y = y0 + 0.06; y < nTop - 0.08; y += 0.1)
      for (let x = n0 + 0.06 + (Math.round((y - y0) / 0.1) % 2) * 0.04; x < n1 - 0.04; x += 0.1) out.push({ x: x + (rnd() - 0.5) * 0.02, y: y + (rnd() - 0.5) * 0.02, r: 0.04 + rnd() * 0.02, rot: rnd() * 6 });
    return out;
  }, [n0, n1, y0]);
  return (
    <>
      {/* banco de obra y remate oscuro delante del fuego */}
      <B y={0} w={w} h={bench} d={d} m={mats.interior} />
      <B y={bench} z={0.01} w={w + 0.02} h={top} d={d + 0.02} m={m.stone} />
      {/* volumen encalado con los dos huecos */}
      {P(-w / 2, n0, y0, h)}
      {P(n0, n1, nTop, h)}
      {P(n0, n1, y0, nTop, bd - nDepth)}
      {P(n1, f0, y0, h)}
      {P(f0, f1, fTop, h)}
      {P(f0, f1, y0, fTop, bd - fDepth)}
      {P(f1, w / 2, y0, h)}
      {/* leños apilados en el leñero, con la testa hacia la estancia */}
      {logs.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, zf - nDepth / 2]} rotation={[Math.PI / 2, l.rot, 0]} material={[m.bark, m.end, m.end]} castShadow>
          <cylinderGeometry args={[l.r, l.r * 1.05, nDepth - 0.02, 7]} />
        </mesh>
      ))}
      {/* hogar: interior oscuro, brasas y llama, marco negro y vidrio */}
      <B x={fc} y={y0} z={zf - fDepth + 0.02} w={fw} h={fh} d={0.02} m={mats.blackMetal} shadow={false} />
      <B x={fc} y={y0} z={zf - fDepth / 2} w={fw} h={0.02} d={fDepth} m={mats.blackMetal} shadow={false} />
      {/* llamas: conos emisivos sobre un lecho de brasas */}
      <mesh position={[fc, y0 + 0.035, zf - fDepth / 2]} material={m.ember}><boxGeometry args={[fw * 0.62, 0.03, 0.16]} /></mesh>
      {[[-0.16, 0.2, 0.05], [-0.05, 0.3, 0.065], [0.06, 0.26, 0.06], [0.17, 0.18, 0.045]].map(([dx, hh, r], i) => (
        <mesh key={i} position={[fc + dx, y0 + 0.06 + hh / 2, zf - fDepth / 2 + (i % 2) * 0.03]} material={i % 2 ? m.flame : m.fire}><coneGeometry args={[r, hh, 10]} /></mesh>
      ))}
      <mesh position={[fc, y0 + 0.08, zf - fDepth / 2 + 0.05]} rotation={[0, 0, Math.PI / 2]} material={m.bark}><cylinderGeometry args={[0.05, 0.05, fw * 0.6, 8]} /></mesh>
      <B x={fc} y={y0 + fh - 0.03} z={zf - 0.02} w={fw} h={0.03} d={0.04} m={mats.blackMetal} />
      <B x={fc} y={y0} z={zf - 0.02} w={fw} h={0.03} d={0.04} m={mats.blackMetal} />
      <B x={fc} y={y0 + 0.02} z={zf - 0.01} w={fw - 0.04} h={fh - 0.04} d={0.008} m={mats.glass} shadow={false} />
      <pointLight position={[fc, y0 + 0.3, zf + 0.25]} color="#ff9a4a" intensity={0.9} distance={4} decay={2} />
    </>
  );
}

/** Piezas de la celosía: lista de barras en el plano local (x, y) del paño. */
type Bar = { x: number; y: number; w: number; h: number; rz: number };

/**
 * Celosía cerámica con huecos reales (piezas instanciadas) dentro de un paño claro de obra.
 *   A · bloques de 20 × 10 cm con marco propio y almas en zigzag que dejan triángulos (referencia 07);
 *   B · bloques de 20 × 20 cm con un hueco cuadrado de ≈14 cm y canto completo (referencia 08).
 */
function LatticeWall({ x, z, len, H, t, ry, kind, mats }: { x: number; z: number; len: number; H: number; t: number; ry: number; kind: 'A' | 'B'; mats: MaterialSet }) {
  const frame = 0.08;
  const base = 0.12;
  const top = 0.14;
  const lw = len - 2 * frame;
  const lh = H - base - top;
  const bars = useMemo(() => {
    const list: Bar[] = [];
    if (lw <= 0.05 || lh <= 0.05) return list;
    const bw = 0.2;
    const bh = kind === 'A' ? 0.1 : 0.2;
    const nx = Math.max(1, Math.round(lw / bw));
    const ny = Math.max(1, Math.round(lh / bh));
    const cw = lw / nx;
    const ch = lh / ny;
    const e = kind === 'A' ? 0.009 : 0.028; // espesor de las paredes del bloque
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const cx = -lw / 2 + (i + 0.5) * cw;
        const cy = (j + 0.5) * ch;
        const iw = cw - 0.008; // junta de 8 mm
        const ih = ch - 0.008;
        list.push({ x: cx, y: cy - ih / 2 + e / 2, w: iw, h: e, rz: 0 });
        list.push({ x: cx, y: cy + ih / 2 - e / 2, w: iw, h: e, rz: 0 });
        list.push({ x: cx - iw / 2 + e / 2, y: cy, w: e, h: ih, rz: 0 });
        list.push({ x: cx + iw / 2 - e / 2, y: cy, w: e, h: ih, rz: 0 });
        if (kind === 'A') {
          // zigzag interior: tres «V» por bloque, triángulos alternos como en la referencia
          const n = 6;
          const sx = (iw - 2 * e) / n;
          const hh = ih - 2 * e;
          for (let s = 0; s < n; s++) {
            const x0 = cx - iw / 2 + e + s * sx;
            const up = s % 2 === 0;
            const L = Math.hypot(sx, hh);
            list.push({ x: x0 + sx / 2, y: cy, w: L, h: 0.007, rz: (up ? 1 : -1) * Math.atan2(hh, sx) });
          }
        }
      }
    return list;
  }, [kind, lw, lh]);
  const depth = kind === 'B' ? t : t * 0.7;
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, depth), mats.lattice, Math.max(1, bars.length));
    const o = new THREE.Object3D();
    bars.forEach((b, i) => {
      o.position.set(b.x, b.y, 0);
      o.rotation.set(0, 0, b.rz);
      o.scale.set(b.w, b.h, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = bars.length;
    m.castShadow = true;
    m.receiveShadow = true;
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, [bars, depth, mats.lattice]);
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {/* paño claro: zócalo, montantes y dintel */}
      <B w={len} h={base} d={t} m={mats.interior} />
      <B y={H - top} w={len} h={top} d={t} m={mats.interior} />
      {[-1, 1].map((k) => <B key={k} x={k * (len / 2 - frame / 2)} y={base} w={frame} h={lh} d={t} m={mats.interior} />)}
      <primitive object={mesh} position={[0, base, 0]} />
    </group>
  );
}

function Curtain({ x, z, width, height, mats }: { x: number; z: number; width: number; height: number; mats: MaterialSet }) {
  // cortina recogida junto a la celosía: pliegues como ondas
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, height, 24, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / width) * Math.PI * 7) * 0.025);
    g.computeVertexNormals();
    return g;
  }, [width, height]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} position={[x, 0.1 + height / 2, z]} material={mats.textileLight} castShadow />;
}

// ---------------------------------------------------------------- exterior

/** Mesa circular de tablero mineral claro y grueso (≈10 cm, canto redondeado) sobre pie central cilíndrico (referencia 11). */
function RoundTable({ w, h, mats, wood = false }: { w: number; h: number; mats: MaterialSet; wood?: boolean }) {
  const r = w / 2;
  if (wood)
    // mesa de comedor de madera maciza: tablero de 4 cm, pie torneado y base en cruz
    return (
      <>
        <mesh position={[0, h - 0.02, 0]} material={mats.wood} castShadow receiveShadow><cylinderGeometry args={[r, r - 0.01, 0.04, 64]} /></mesh>
        <mesh position={[0, (h - 0.04) / 2 + 0.03, 0]} material={mats.wood} castShadow><cylinderGeometry args={[0.07, 0.09, h - 0.07, 24]} /></mesh>
        {[0, Math.PI / 2].map((ry) => <B key={ry} y={0} ry={ry} w={r * 1.3} h={0.06} d={0.08} m={mats.wood} />)}
      </>
    );
  const t = 0.1;
  const legR = 0.24;
  return (
    <>
      <mesh position={[0, h - t / 2, 0]} material={mats.counter} castShadow receiveShadow><cylinderGeometry args={[r, r, t - 0.03, 72]} /></mesh>
      <mesh position={[0, h - 0.015, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.counter} castShadow><torusGeometry args={[r - 0.015, 0.015, 8, 72]} /></mesh>
      <mesh position={[0, h - t + 0.015, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.counter} castShadow><torusGeometry args={[r - 0.015, 0.015, 8, 72]} /></mesh>
      <mesh position={[0, (h - t) / 2, 0]} material={mats.counter} castShadow receiveShadow><cylinderGeometry args={[legR, legR + 0.01, h - t, 40]} /></mesh>
    </>
  );
}

/**
 * Silla plegable de bistró (referencia 11): bastidor ligero de metal oscuro con patas en tijera,
 * asiento de listones de madera y dos listones de respaldo.
 */
function OutdoorChair({ w, d, mats }: { w: number; d: number; mats: MaterialSet }) {
  const seat = 0.45;
  const tube = 0.014;
  const Rod = ({ a, b }: { a: [number, number, number]; b: [number, number, number] }) => {
    const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
    return <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={q} material={mats.blackMetal} castShadow><cylinderGeometry args={[tube / 2, tube / 2, v.length(), 6]} /></mesh>;
  };
  const hw = w / 2 - 0.02;
  return (
    <>
      {[-1, 1].map((k) => (
        <group key={k}>
          {/* pata trasera continua hasta el respaldo */}
          <Rod a={[k * hw, 0, -d / 2 + 0.02]} b={[k * hw, 0.82, -d / 2 + 0.06]} />
          {/* pata delantera en tijera, cruzando bajo el asiento */}
          <Rod a={[k * hw, 0, d / 2 - 0.02]} b={[k * hw, seat, -d / 2 + 0.06]} />
          <Rod a={[k * hw, seat, -d / 2 + 0.08]} b={[k * hw, seat, d / 2 - 0.04]} />
        </group>
      ))}
      <Rod a={[-hw, 0.12, d / 2 - 0.09]} b={[hw, 0.12, d / 2 - 0.09]} />
      <Rod a={[-hw, seat - 0.01, d / 2 - 0.04]} b={[hw, seat - 0.01, d / 2 - 0.04]} />
      {/* asiento de listones de madera */}
      {[-0.15, -0.075, 0, 0.075, 0.15].map((k) => <B key={k} y={seat} z={k * (d / 0.48)} w={w - 0.03} h={0.016} d={0.06} m={mats.wood} />)}
      {/* listones de respaldo */}
      {[0.22, 0.32].map((y) => <B key={y} y={seat + y} z={-d / 2 + 0.065} w={w - 0.02} h={0.065} d={0.014} m={mats.wood} />)}
    </>
  );
}

/**
 * Espejo con reflejo plausible de la propia estancia: una captura de entorno (cubemap) tomada
 * desde delante del espejo unas pocas veces al cargar, no en cada fotograma.
 */
function MirrorPane({ y, z, w, h, base }: { y: number; z: number; w: number; h: number; base: THREE.MeshStandardMaterial }) {
  return (
    <CubeCamera position={[0, y, z + 0.6]} resolution={256} frames={6} near={0.05} far={20}>
      {(texture) => (
        <mesh position={[0, 0, -0.6]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#f4f6f6" metalness={1} roughness={0.03} envMap={texture} envMapIntensity={1.1} clippingPlanes={base.clippingPlanes} />
        </mesh>
      )}
    </CubeCamera>
  );
}
