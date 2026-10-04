/**
 * Mobiliario a escala real, con el detalle que se ve de cerca: juntas de frentes, cojines con cantos
 * suaves, grifería, tiradores, celosías con huecos reales. Las medidas salen del modelo de datos;
 * los detalles (cajones, cojines, baldas) son propuestas de diseño basadas en las referencias
 * descritas por la propiedad, no en las fotos (no se han podido abrir desde este entorno).
 *
 * Eje local: +x a lo largo del mueble, +z = frente (lado inferior del papel con rot 0), y = altura.
 */
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
    case 'encimera': return <Kitchen w={w} d={d} h={h} modules={f.modules ?? []} mats={mats} />;
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
  const baseH = 0.32;
  const seatT = 0.12;
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

function Planter({ w, h, mats }: { w: number; h: number; mats: MaterialSet }) {
  const r = w / 2;
  const potH = Math.min(0.55, h * 0.45);
  return (
    <>
      <Lathe profile={[[0, 0.01], [r * 0.7, 0], [r * 0.95, potH * 0.85], [r, potH], [r * 0.9, potH], [r * 0.86, potH * 0.9], [0, potH * 0.9]]} m={mats.clay} />
      {/* olivo / planta mediterránea: tronco fino y copa de hojas en grupos */}
      <mesh position={[0, potH + (h - potH) * 0.3, 0]} material={mats.woodBeam}><cylinderGeometry args={[0.015, 0.025, (h - potH) * 0.6, 6]} /></mesh>
      {[[0, 0.75, 0, 0.22], [0.1, 0.68, 0.06, 0.16], [-0.1, 0.7, -0.05, 0.17], [0.03, 0.88, -0.04, 0.15]].map(([x, fy, z, s], i) => (
        <mesh key={i} position={[x, potH + (h - potH) * fy, z]} scale={[s, s * 0.8, s]} material={mats.plant} castShadow><icosahedronGeometry args={[1, 0]} /></mesh>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- cocina

/**
 * Cocina lineal: frentes lisos de madera clara con juntas de 3 mm, zócalo retranqueado, encimera
 * mineral, salpicadero mineral, balda corrida de madera con tira de luz, fregadero bajo encimera
 * con grifo negro mate, placa de inducción con horno debajo, lavavajillas y frigorífico integrados.
 */
function Kitchen({ w, d, h, modules, mats }: { w: number; d: number; h: number; modules: KitchenModule[]; mats: MaterialSet }) {
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
      {/* salpicadero y balda corrida contra el muro */}
      <B y={h} z={-d / 2 + 0.01} w={w} h={0.62} d={0.02} m={mats.counter} />
      <B y={h + 0.62} z={-d / 2 + 0.13} w={w} h={0.04} d={0.26} m={mats.wood} />
      <B y={h + 0.6} z={-d / 2 + 0.22} w={w - 0.1} h={0.012} d={0.02} m={mats.lampGlow} shadow={false} />
      {/* piezas de cerámica sobre la balda */}
      <Lathe x={-w / 2 + 0.3} y={h + 0.66} z={-d / 2 + 0.12} profile={[[0, 0], [0.05, 0], [0.08, 0.06], [0.08, 0.09], [0, 0.09]]} m={mats.clayLight} />
      <Lathe x={-w / 2 + 0.55} y={h + 0.66} z={-d / 2 + 0.12} profile={[[0, 0], [0.04, 0], [0.05, 0.18], [0.035, 0.22], [0, 0.22]]} m={mats.clay} />
      <Lathe x={w / 2 - 0.4} y={h + 0.66} z={-d / 2 + 0.12} profile={[[0, 0], [0.09, 0], [0.11, 0.05], [0.12, 0.06], [0, 0.06]]} m={mats.ceramic} />
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
function Island({ w, d, h, mats }: { w: number; d: number; h: number; mats: MaterialSet }) {
  const top = 0.04;
  const pier = 0.3;
  const knee = 0.3;
  const bodyH = h - top;
  const coreD = d - knee;
  const inner = w - 2 * pier;
  return (
    <>
      {/* apoyos macizos con estantes abiertos hacia fuera: mejillas, baldas y fondo con huecos reales */}
      {[-1, 1].map((k) => {
        const px = k * (w / 2 - pier / 2);
        const cheek = 0.06;
        const back = 0.08;
        const inD = d - 2 * cheek;
        const inW = pier - back;
        const ox = px + k * (back / 2);
        return (
          <group key={k}>
            {[-1, 1].map((z) => <B key={z} x={px} z={z * (d / 2 - cheek / 2)} w={pier} h={bodyH} d={cheek} m={mats.terracottaTile} />)}
            <B x={px - k * (pier / 2 - back / 2)} w={back} h={bodyH} d={inD} m={mats.interior} />
            <B x={ox} w={inW} h={0.1} d={inD} m={mats.terracottaTile} />
            <B x={ox} y={0.42} w={inW} h={0.04} d={inD} m={mats.interior} />
            <B x={ox} y={bodyH - 0.06} w={inW} h={0.06} d={inD} m={mats.terracottaTile} />
            {/* objetos en los estantes */}
            <Lathe x={ox} y={0.46} z={-0.15} profile={[[0, 0], [0.07, 0], [0.09, 0.05], [0.09, 0.08], [0, 0.08]]} m={mats.clayLight} />
            <B x={ox} y={0.1} z={0.1} w={0.16} h={0.12} d={0.24} m={mats.rug} />
          </group>
        );
      })}
      {/* cuerpo central cerrado hacia la cocina */}
      <B z={d / 2 - coreD / 2} w={inner} h={bodyH} d={coreD} m={mats.terracottaTile} />
      {/* fondo del hueco de rodillas, retranqueado */}
      <B z={-d / 2 + knee - 0.01} w={inner} h={bodyH - 0.02} d={0.02} m={mats.interior} />
      {/* encimera clara con esquinas suavizadas y vuelo hacia los taburetes */}
      <RoundSlab y={bodyH} w={w + 0.04} d={d + 0.03} h={top - 0.012} r={0.06} m={mats.counter} />
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
 * Lavabo de obra claro con cajones de madera y hueco inferior, un seno, espejo grande, franja de
 * piezas verticales de terracota y grifería de latón empotrada (referencia del baño, descrita).
 */
function MasonryVanity({ w, d, h, mats }: { w: number; d: number; h: number; mats: MaterialSet }) {
  const slab = 0.1;
  const side = 0.08;
  const drawerH = 0.22;
  const wall = -d / 2;
  return (
    <>
      {/* encimera y costados de obra encalados */}
      <Soft y={h - slab} w={w} h={slab} d={d} r={0.02} m={mats.interior} />
      {[-1, 1].map((k) => <B key={k} x={k * (w / 2 - side / 2)} w={side} h={h - slab} d={d} m={mats.interior} />)}
      {/* cajones de madera */}
      {[-1, 1].map((k) => (
        <group key={k}>
          <B x={(k * (w - 2 * side)) / 4} y={h - slab - drawerH} z={d / 2 - 0.03} w={(w - 2 * side) / 2 - 0.006} h={drawerH - 0.006} d={0.02} m={mats.wood} />
          <B x={(k * (w - 2 * side)) / 4} y={h - slab - drawerH} z={-0.02} w={(w - 2 * side) / 2 - 0.01} h={drawerH - 0.01} d={d - 0.08} m={mats.wood} />
          <B x={(k * (w - 2 * side)) / 4} y={h - slab - drawerH / 2 - 0.01} z={d / 2 - 0.012} w={0.1} h={0.014} d={0.014} m={mats.brass} />
        </group>
      ))}
      {/* hueco inferior con balda de obra y toallas */}
      <B y={0.14} w={w - 2 * side} h={0.05} d={d - 0.04} m={mats.interior} />
      <Soft x={-w / 5} y={0.19} w={0.34} h={0.12} d={0.3} r={0.03} m={mats.textileLight} />
      <Lathe x={w / 5} y={0.19} profile={[[0, 0], [0.08, 0], [0.1, 0.14], [0.06, 0.2], [0, 0.2]]} m={mats.clay} />
      {/* seno de cerámica semiempotrado */}
      <mesh position={[0, h - 0.035, 0.03]} scale={[1, 0.45, 0.75]} material={mats.ceramic} castShadow>
        <sphereGeometry args={[0.22, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, h + 0.001, 0.03]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.75, 1]} material={mats.ceramic}><ringGeometry args={[0.2, 0.24, 32]} /></mesh>
      {/* grifería de latón empotrada en el muro */}
      <group position={[0, h + 0.3, wall + 0.02]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.09]} material={mats.brass}><cylinderGeometry args={[0.013, 0.013, 0.18, 12]} /></mesh>
        {[-0.12, 0.12].map((x) => <mesh key={x} position={[x, 0.02, 0.025]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[0.025, 0.025, 0.04, 16]} /></mesh>)}
      </group>
      {/* franja de piezas verticales de terracota sobre la encimera */}
      <B y={h} z={wall + 0.006} w={w} h={0.3} d={0.012} m={mats.terracottaTile} />
      {/* espejo grande con marco fino de madera */}
      <B y={h + 0.42} z={wall + 0.012} w={Math.min(1.1, w - 0.2)} h={0.9} d={0.02} m={mats.wood} />
      <MirrorPane y={h + 0.435 + 0.435} z={wall + 0.026} w={Math.min(1.1, w - 0.2) - 0.03} h={0.87} base={mats.mirror} />
      {/* toallero de latón en el frente, bajo la encimera */}
      <group position={[-w / 4, h - slab - 0.04, d / 2 + 0.035]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={mats.brass}><cylinderGeometry args={[0.009, 0.009, 0.55, 10]} /></mesh>
        {[-0.265, 0.265].map((x) => <mesh key={x} position={[x, 0, -0.02]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[0.008, 0.008, 0.04, 8]} /></mesh>)}
        <Soft y={-0.3} z={0.005} w={0.42} h={0.3} d={0.02} r={0.008} m={mats.textileLight} />
      </group>
    </>
  );
}

/**
 * Ducha doble (dos rociadores, uno delante del otro). Separación propuesta en dos alternativas de
 * celosía cerámica con huecos reales:
 *   A · patrón fino geométrico (rombos) dentro de un paño claro;
 *   B · huecos cuadrados con piezas de más presencia.
 * Por la cara de ducha, vidrio transparente para contener salpicaduras; acceso por el lado de la
 * estancia con cortina en carril independiente. Todo ello es propuesta, no decisión.
 *
 * Eje local: −x = extremo hacia el pasillo, +x = frontal B (puerta exterior), +z = cara hacia el
 * baño, −z = muro de la escalera.
 */
function Shower({ w, d, mats, lattice }: { w: number; d: number; mats: MaterialSet; lattice: 'A' | 'B' }) {
  const H = 2.1;
  const access = 0.7;
  const t = 0.1;
  const frontLen = w - access;
  return (
    <>
      {/* plato enrasado de microcemento con sumidero lineal de latón */}
      <B w={w} h={0.012} d={d} m={mats.counter} />
      <B x={0.2} y={0.012} z={-d / 2 + 0.06} w={w - 0.5} h={0.003} d={0.04} m={mats.brass} shadow={false} />
      {/* celosía del extremo del pasillo (−x) */}
      <LatticeWall x={-w / 2 - t / 2} z={0} len={d + t} H={H} t={t} ry={Math.PI / 2} kind={lattice} mats={mats} />
      {/* celosía de la cara del baño (+z), entre el acceso y el frontal B */}
      <LatticeWall x={w / 2 - frontLen / 2} z={d / 2 + t / 2} len={frontLen} H={H} t={t} ry={0} kind={lattice} mats={mats} />
      {/* vidrio por la cara de la ducha */}
      <B x={-w / 2 + 0.012} z={0} w={0.01} h={H - 0.05} d={d - 0.02} m={mats.glass} shadow={false} />
      <B x={w / 2 - frontLen / 2} z={d / 2 - 0.012} w={frontLen - 0.02} h={H - 0.05} d={0.01} m={mats.glass} shadow={false} />
      {/* carril independiente y cortina en el acceso */}
      <mesh position={[-w / 2 + access / 2, H + 0.02, d / 2 + 0.06]} rotation={[0, 0, Math.PI / 2]} material={mats.brass}><cylinderGeometry args={[0.01, 0.01, access + 0.06, 10]} /></mesh>
      <Curtain x={-w / 2 + 0.09} z={d / 2 + 0.06} width={0.18} height={H - 0.12} mats={mats} />
      {/* dos rociadores de latón, uno delante del otro, y sus mezcladores */}
      {[-w / 4, w / 4].map((x) => (
        <group key={x} position={[x, 0, -d / 2]}>
          <mesh position={[0, 2.05, 0.18]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[0.012, 0.012, 0.36, 10]} /></mesh>
          <mesh position={[0, 2.03, 0.34]} material={mats.brass}><cylinderGeometry args={[0.11, 0.11, 0.015, 28]} /></mesh>
          <mesh position={[0, 1.1, 0.02]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[0.035, 0.035, 0.03, 18]} /></mesh>
        </group>
      ))}
      {/* hornacina de obra en el muro de la escalera */}
      <B y={1.05} z={-d / 2 + 0.05} w={0.56} h={0.45} d={0.1} m={mats.interior} />
      <B y={1.1} z={-d / 2 + 0.06} w={0.46} h={0.32} d={0.1} m={mats.terracottaTile} />
      <Lathe x={-0.1} y={1.1} z={-d / 2 + 0.08} profile={[[0, 0], [0.03, 0], [0.035, 0.14], [0.015, 0.18], [0, 0.18]]} m={mats.clayLight} />
    </>
  );
}

/** Paño claro de obra con una celosía cerámica de huecos reales (piezas instanciadas). */
function LatticeWall({ x, z, len, H, t, ry, kind, mats }: { x: number; z: number; len: number; H: number; t: number; ry: number; kind: 'A' | 'B'; mats: MaterialSet }) {
  const frame = 0.12;
  const base = 0.12;
  const top = 0.18;
  const lw = len - 2 * frame;
  const lh = H - base - top;
  const bars = useMemo(() => {
    const list: { x: number; y: number; w: number; h: number; rz: number }[] = [];
    if (lw <= 0.05 || lh <= 0.05) return list;
    if (kind === 'B') {
      // piezas de 15 cm con huecos de 10 cm y almas de 5 cm
      const cell = 0.15;
      const web = 0.05;
      const nx = Math.max(1, Math.round(lw / cell));
      const ny = Math.max(1, Math.round(lh / cell));
      const cx = lw / nx;
      const cy = lh / ny;
      for (let i = 0; i <= nx; i++) list.push({ x: -lw / 2 + i * cx, y: lh / 2, w: web, h: lh, rz: 0 });
      for (let j = 0; j <= ny; j++) list.push({ x: 0, y: j * cy, w: lw, h: web, rz: 0 });
    } else {
      // rejilla fina de rombos: listones a ±45° cada 7 cm, recortados al marco
      const step = 0.07;
      const bw = 0.018;
      const diag = Math.hypot(lw, lh);
      for (const dir of [1, -1]) {
        for (let k = -diag; k <= diag; k += step) {
          // recta x*dir - y = k  dentro del rectángulo [-lw/2, lw/2] × [0, lh]
          const pts: [number, number][] = [];
          const add = (px: number, py: number) => { if (px >= -lw / 2 - 1e-6 && px <= lw / 2 + 1e-6 && py >= -1e-6 && py <= lh + 1e-6) pts.push([px, py]); };
          add(-lw / 2, dir * -lw / 2 - k);
          add(lw / 2, dir * lw / 2 - k);
          add(dir * k, 0);
          add(dir * (k + lh), lh);
          if (pts.length < 2) continue;
          pts.sort((p, q) => p[0] - q[0]);
          const [p0, p1] = [pts[0], pts[pts.length - 1]];
          const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
          if (L < 0.02) continue;
          list.push({ x: (p0[0] + p1[0]) / 2, y: (p0[1] + p1[1]) / 2, w: L, h: bw, rz: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) });
        }
      }
    }
    return list;
  }, [kind, lw, lh]);
  const depth = kind === 'B' ? t : t * 0.6;
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

/** Mesa circular de tablero mineral grueso y pie central (referencia del comedor exterior, descrita). */
function RoundTable({ w, h, mats }: { w: number; h: number; mats: MaterialSet }) {
  const r = w / 2;
  const t = 0.07;
  return (
    <>
      <mesh position={[0, h - t / 2, 0]} material={mats.counter} castShadow receiveShadow><cylinderGeometry args={[r, r - 0.01, t, 64]} /></mesh>
      <Lathe profile={[[0, 0], [0.42, 0], [0.42, 0.04], [0.2, 0.1], [0.14, 0.35], [0.16, h - t - 0.02], [0.3, h - t], [0, h - t]]} m={mats.counter} segments={48} />
    </>
  );
}

/** Silla ligera de exterior: estructura metálica oscura, asiento y respaldo de listones de madera. */
function OutdoorChair({ w, d, mats }: { w: number; d: number; mats: MaterialSet }) {
  const seat = 0.45;
  return (
    <>
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => <B key={i} x={sx * (w / 2 - 0.02)} z={sz * (d / 2 - 0.03)} w={0.02} h={seat} d={0.02} m={mats.blackMetal} />)}
      {[-1, 1].map((sx) => <B key={sx} x={sx * (w / 2 - 0.02)} y={seat} z={-d / 2 + 0.03} w={0.02} h={0.38} d={0.02} m={mats.blackMetal} />)}
      <B y={seat - 0.02} w={w} h={0.02} d={d - 0.02} m={mats.blackMetal} />
      {[-0.15, -0.05, 0.05, 0.15].map((k) => <B key={k} y={seat} z={k * (d / 0.5)} w={w - 0.04} h={0.018} d={0.075} m={mats.wood} />)}
      {[0.12, 0.26].map((y) => <B key={y} y={seat + y} z={-d / 2 + 0.03} w={w - 0.04} h={0.07} d={0.016} m={mats.wood} />)}
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
