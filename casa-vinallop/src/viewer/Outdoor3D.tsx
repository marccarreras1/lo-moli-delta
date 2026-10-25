/**
 * Exterior del proyecto: solera continua en L (confirmada) a lo largo del frontal B y del lateral del
 * algarrobo, con juntas, canto, canaleta de evacuación (propuesta) y alcorque permeable alrededor del
 * tronco; transición de grava; comedor bajo el algarrobo con lámpara de cúpula (referencia 11).
 */
import { Line } from '@react-three/drei';
import { type ReactElement, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { DesignOptions, Furniture, Outdoor, OutdoorPavement, Vec2 } from '../data/types';
import { AMBER } from '../ui/status';
import { Furniture3D } from './Furniture3D';
import { Garden3D } from './Garden3D';
import { WARM } from './Lamps';
import type { MaterialSet } from './materials';
import { groundTopAt } from '../model/ground';
import { inPit } from '../model/pits';

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
  // solera elevada: el canto queda a la vista como un escalón sobre el terreno
  const lift = gravel ? 0 : p.top ?? 0;
  const thick = gravel ? 0.03 : 0.1 + lift;
  const top = gravel ? TOP - 0.02 : TOP + lift;
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
    const inside = (x: number, y: number) => inPit(p, x, y, 0.02);
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
function TreePit({ c, r, mats, lift = 0 }: { c: Vec2; r: number; mats: MaterialSet; lift?: number }) {
  return (
    <group position={[c[0], TOP + lift, c[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]} material={mats.gravel} receiveShadow><circleGeometry args={[r, 48]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} material={mats.blackMetal}><ringGeometry args={[r - 0.012, r + 0.004, 64]} /></mesh>
    </group>
  );
}

/** Canaleta lineal con rejilla (propuesta de evacuación). */
function Drain({ a, b, mats, lift = 0 }: { a: Vec2; b: Vec2; mats: MaterialSet; lift?: number }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return (
    <group position={[(a[0] + b[0]) / 2, TOP + lift + 0.001, (a[1] + b[1]) / 2]} rotation={[0, -ang, 0]}>
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

/** cañizo: cañas finas paralelas con huecos (alphaTest) para que la sombra salga tamizada */
function reedTexture() {
  const W = 512;
  const H = 64;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < W; ) {
    const w = 3 + r() * 3;
    const l = 150 + r() * 50;
    g.fillStyle = `rgb(${l + 20},${l},${l * 0.62})`;
    g.fillRect(x, 0, w, H);
    g.fillStyle = 'rgba(90,70,40,0.35)';
    g.fillRect(x + w - 1, 0, 1, H);
    for (let k = 0; k < 2; k++) {
      g.fillStyle = 'rgba(110,85,50,0.5)';
      g.fillRect(x, r() * H, w, 1.5);
    }
    x += w + (r() < 0.25 ? 1 + r() * 2 : 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * Porche mediterráneo ante la cristalera: pilares de obra encalados, viga de madera al frente,
 * durmiente anclado al muro, viguetas con ligera pendiente hacia fuera y cañizo encima.
 */
function Porch({ p, mats }: { p: NonNullable<Outdoor['porches']>[number]; mats: MaterialSet }) {
  const reed = useMemo(() => {
    const t = reedTexture();
    // los huecos entre cañas quedan sin pintar (alfa 0) y el alphaTest los recorta
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide, alphaTest: 0.5 });
    return { t, m };
  }, []);
  useEffect(() => () => { reed.t.dispose(); reed.m.dispose(); }, [reed]);
  const [x0, , x1] = p.rect;
  const wallY = p.wallSide === 'y1' ? p.rect[3] : p.rect[1];
  const fy = p.posts[0][1];
  const dir = Math.sign(wallY - fy); // de la viga frontal hacia el muro
  const span = Math.abs(wallY - fy);
  const beamH = 0.24;
  const beamW = 0.16;
  const hTopFront = p.hFront + beamH / 2;
  const joistH = 0.14;
  const joists: number[] = [];
  const n = Math.max(2, Math.round((x1 - x0) / 0.6));
  for (let i = 0; i <= n; i++) joists.push(x0 + 0.08 + ((x1 - x0 - 0.16) * i) / n);
  const len = Math.hypot(span + 0.3, p.hWall - hTopFront);
  const slope = Math.atan2(p.hWall - hTopFront, span + 0.3);
  const midY = (fy - dir * 0.3 + wallY) / 2;
  const midH = (hTopFront + p.hWall) / 2 + joistH / 2;
  reed.t.repeat.set((x1 - x0) / 1.2, 1);
  return (
    <group>
      {p.posts.map(([x, y], i) => (
        <group key={i}>
          <mesh position={[x, TOP + p.hFront / 2, y]} material={mats.facade} castShadow receiveShadow>
            <boxGeometry args={[p.postSize, p.hFront, p.postSize]} />
          </mesh>
          {/* zócalo encalado algo más ancho, como en las casas de campo */}
          <mesh position={[x, TOP + 0.15, y]} material={mats.facade} castShadow receiveShadow>
            <boxGeometry args={[p.postSize + 0.06, 0.3, p.postSize + 0.06]} />
          </mesh>
        </group>
      ))}
      {/* viga frontal */}
      <mesh position={[(x0 + x1) / 2, TOP + p.hFront + beamH / 2, fy]} material={mats.woodBeam} castShadow receiveShadow>
        <boxGeometry args={[x1 - x0 + 0.3, beamH, beamW]} />
      </mesh>
      {/* durmiente sobre el dintel de la cristalera */}
      <mesh position={[(x0 + x1) / 2, TOP + p.hWall - 0.08, wallY - dir * 0.07]} material={mats.woodBeam} castShadow>
        <boxGeometry args={[x1 - x0, 0.16, 0.12]} />
      </mesh>
      {/* viguetas: vuelan 0,3 m por delante de la viga */}
      {joists.map((x) => (
        <mesh key={x} position={[x, TOP + midH, midY]} rotation={[dir * -slope, 0, 0]} material={mats.woodBeam} castShadow receiveShadow>
          <boxGeometry args={[0.08, joistH, len]} />
        </mesh>
      ))}
      {/* cañizo */}
      <mesh position={[(x0 + x1) / 2, TOP + midH + joistH / 2 + 0.012, midY]} rotation={[-Math.PI / 2 + dir * -slope, 0, 0]} material={reed.m} castShadow receiveShadow>
        <planeGeometry args={[x1 - x0 + 0.1, len - 0.05]} />
      </mesh>
    </group>
  );
}

/** Depósito enterrado: huella de la excavación rellena, cuello y tapa de la boca de hombre y «T» de venteo. */
function Tank({ t }: { t: NonNullable<Outdoor['tanks']>[number] }) {
  const [w, d] = t.axis === 'y' ? [t.diameter, t.length] : [t.length, t.diameter];
  const fill = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b89a7c', roughness: 1 }), []);
  const collar = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.85 }), []);
  const lid = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3c4a3f', roughness: 0.6, metalness: 0.2 }), []);
  useEffect(() => () => { fill.dispose(); collar.dispose(); lid.dispose(); }, [fill, collar, lid]);
  const r = t.manhole / 2;
  const [cx, cz] = t.c;
  return (
    <group>
      <mesh position={[cx, TOP + 0.012, cz]} rotation={[-Math.PI / 2, 0, 0]} material={fill} receiveShadow>
        <planeGeometry args={[w + 0.6, d + 0.6]} />
      </mesh>
      <mesh position={[cx, TOP + 0.08, cz]} material={collar} castShadow receiveShadow><cylinderGeometry args={[r + 0.1, r + 0.14, 0.16, 32]} /></mesh>
      <mesh position={[cx, TOP + 0.165, cz]} material={lid} castShadow><cylinderGeometry args={[r, r, 0.02, 32]} /></mesh>
      <mesh position={[cx + r + 0.3, TOP + 0.35, cz]} material={collar} castShadow><cylinderGeometry args={[0.04, 0.04, 0.7, 12]} /></mesh>
      <mesh position={[cx + r + 0.3, TOP + 0.7, cz]} rotation={[0, 0, Math.PI / 2]} material={collar} castShadow><cylinderGeometry args={[0.04, 0.04, 0.24, 12]} /></mesh>
    </group>
  );
}

/** Volumen anexo de una planta (cuarto técnico): muros encalados, losa de cubierta y puerta metálica exterior. */
function Annex({ a, mats }: { a: NonNullable<Outdoor['annexes']>[number]; mats: MaterialSet }) {
  const [x0, y0, x1, y1] = a.rect;
  const t = a.wall;
  const wallH = a.height - 0.2;
  const B = (cx: number, cz: number, w: number, d: number, h: number, y = 0, m: THREE.Material = mats.facade) => (
    <mesh position={[cx, y + h / 2, cz]} material={m} castShadow receiveShadow><boxGeometry args={[w, h, d]} /></mesh>
  );
  const d = a.door;
  // muros: el lado pegado a la casa (x1 = 0) es el lateral existente
  const pieces: ReactElement[] = [];
  const along = (side: 'y0' | 'y1' | 'x0', key: string) => {
    const horiz = side !== 'x0';
    const s0 = horiz ? x0 : y0;
    const s1 = horiz ? x1 - 0.001 : y1;
    const fixed = side === 'y0' ? y0 + t / 2 : side === 'y1' ? y1 - t / 2 : x0 + t / 2;
    const seg = (a0: number, a1: number, h: number, yb = 0, k = '') => {
      if (a1 - a0 < 0.01) return;
      const c = (a0 + a1) / 2;
      pieces.push(<group key={`${key}${k}${a0}`}>{horiz ? B(c, fixed, a1 - a0, t, h, yb) : B(fixed, c, t, a1 - a0, h, yb)}</group>);
    };
    if (d.side === side) {
      seg(s0, d.at - d.width / 2, wallH);
      seg(d.at + d.width / 2, s1, wallH);
      seg(d.at - d.width / 2, d.at + d.width / 2, wallH - d.height, d.height, 'dintel');
    } else seg(s0, s1, wallH);
  };
  along('y0', 'a');
  along('y1', 'b');
  along('x0', 'c');
  const doorPos: [number, number, number] = d.side === 'y1' ? [d.at, d.height / 2, y1 - t / 2] : d.side === 'y0' ? [d.at, d.height / 2, y0 + t / 2] : [x0 + t / 2, d.height / 2, d.at];
  const doorRot = d.side === 'x0' || d.side === 'x1' ? Math.PI / 2 : 0;
  return (
    <group>
      {/* solera interior y losa de cubierta con goterón */}
      {B((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0 - 0.02, y1 - y0 - 0.02, 0.02, 0, mats.concrete)}
      {pieces}
      {/* tapas de registro en el suelo (aljibe) */}
      {(a.hatches ?? []).map((h) => (
        <group key={h.id}>
          {B(h.c[0], h.c[1], h.size + 0.08, h.size + 0.08, 0.012, 0.02, mats.metal)}
          {B(h.c[0], h.c[1], h.size, h.size, 0.016, 0.02, mats.blackMetal)}
        </group>
      ))}
      {B((x0 + x1) / 2 - 0.05, (y0 + y1) / 2, x1 - x0 + 0.1, y1 - y0 + 0.16, 0.2, wallH)}
      {a.terrace && (() => {
        // terraza transitable: pavimento de terracota y peto encalado de 0,15 m con albardilla (no contra la casa)
        const pt = 0.15;
        const top = a.height;
        const ph = a.terrace.parapet;
        const gap = a.terrace.gap;
        const ex0 = x0 - 0.1;
        const ey0 = y0 - 0.08;
        const ey1 = y1 + 0.08;
        const parts: ReactElement[] = [];
        const wall = (k: string, cx: number, cz: number, w: number, d: number) => {
          parts.push(<group key={k}>{B(cx, cz, w, d, ph, top)}{B(cx, cz, w + 0.04, d + 0.04, 0.05, top + ph)}</group>);
        };
        wall('py0', (ex0 + x1) / 2, ey0 + pt / 2, x1 - ex0, pt);
        wall('py1', (ex0 + x1) / 2, ey1 - pt / 2, x1 - ex0, pt);
        const xs = ex0 + pt / 2;
        const za = ey0 + pt;
        const zb = ey1 - pt;
        if (gap) {
          wall('px0a', xs, (za + gap[0]) / 2, pt, gap[0] - za);
          wall('px0b', xs, (gap[1] + zb) / 2, pt, zb - gap[1]);
        } else wall('px0', xs, (za + zb) / 2, pt, zb - za);
        return (
          <group>
            {B((ex0 + pt + x1) / 2, (y0 + y1) / 2, x1 - ex0 - pt, ey1 - ey0 - 2 * pt, 0.03, top, mats.terracottaTile)}
            {parts}
          </group>
        );
      })()}
      {/* puerta metálica gris con rejilla de ventilación baja */}
      <group position={doorPos} rotation={[0, doorRot, 0]}>
        <mesh material={mats.metal} castShadow><boxGeometry args={[d.width - 0.04, d.height - 0.02, 0.05]} /></mesh>
        {[-1, 1].map((k) => <mesh key={k} position={[0, -d.height / 2 + 0.25, k * 0.03]} material={mats.blackMetal}><boxGeometry args={[d.width * 0.6, 0.25, 0.01]} /></mesh>)}
        {[-1, 1].map((k) => <mesh key={`m${k}`} position={[d.width / 2 - 0.12, 0, k * 0.04]} material={mats.blackMetal}><boxGeometry args={[0.03, 0.16, 0.02]} /></mesh>)}
      </group>
    </group>
  );
}

/** media caña (teja árabe) a lo largo de x, abierta hacia arriba, algo más estrecha en un extremo */
function tejaGeometry(len: number, r0: number, r1: number) {
  const seg = 12;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= 1; j++) {
    const r = j ? r1 : r0;
    for (let k = 0; k <= seg; k++) {
      const a = Math.PI + (Math.PI * k) / seg;
      pos.push((j - 0.5) * len, r * Math.sin(a) * 0.7, r * Math.cos(a));
    }
  }
  for (let k = 0; k < seg; k++) idx.push(k, k + seg + 1, k + 1, k + 1, k + seg + 1, k + seg + 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Cadena de lluvia: gárgola arriba, tejas en zigzag empotradas en la fachada y arqueta con rejilla al pie. */
function RainChain({ c }: { c: NonNullable<Outdoor['rainChains']>[number] }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b8714c', roughness: 0.85, side: THREE.DoubleSide }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9a5a3c', roughness: 0.9, side: THREE.DoubleSide }), []);
  const grate = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3a38', roughness: 0.6, metalness: 0.5 }), []);
  const geo = useMemo(() => tejaGeometry(c.tile, 0.085, 0.065), [c.tile]);
  useEffect(() => () => { mat.dispose(); dark.dispose(); grate.dispose(); geo.dispose(); }, [mat, dark, grate, geo]);
  // posición en la fachada: (a lo largo, cota, separación de la cara)
  const P = (along: number, z: number, off: number): [number, number, number] =>
    c.face.axis === 'y' ? [along, z, c.face.at + c.face.outward * off] : [c.face.at + c.face.outward * off, z, along];
  const yaw = c.face.axis === 'y' ? 0 : Math.PI / 2;
  const n = Math.max(1, Math.floor((c.top - 0.55) / c.pitch));
  const tiles = Array.from({ length: n }, (_, i) => ({ i, z: c.top - 0.35 - i * c.pitch, s: i % 2 === 0 ? 1 : -1 }));
  return (
    <group>
      {/* gárgola: teja perpendicular a la fachada */}
      <mesh geometry={geo} material={dark} position={P(c.at, c.top - 0.12, 0.2)} rotation={[0, yaw + Math.PI / 2, -0.12]} castShadow />
      {tiles.map(({ i, z, s }) => (
        <mesh key={i} geometry={geo} material={i % 4 === 1 ? dark : mat} position={P(c.at, z, 0.1)} rotation={[0, yaw, -s * c.tilt]} castShadow receiveShadow />
      ))}
      {/* arqueta con rejilla */}
      <mesh position={P(c.at, 0.0, c.basin / 2 + 0.05)} material={grate} receiveShadow>
        <boxGeometry args={c.face.axis === 'y' ? [c.basin, 0.03, c.basin] : [c.basin, 0.03, c.basin]} />
      </mesh>
    </group>
  );
}

/** Escalones volados en zigzag: piezas de madera empotradas que salen de la fachada, alternas a cada lado. */
function WallSteps({ s }: { s: NonNullable<Outdoor['wallSteps']>[number] }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8f8064', roughness: 0.95 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6d6048', roughness: 1 }), []);
  useEffect(() => () => { mat.dispose(); dark.dispose(); }, [mat, dark]);
  const rise = s.top / s.steps;
  const items = Array.from({ length: s.steps }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1; // pie izquierdo / derecho
    const along = s.start + s.dir * (i * s.run + side * 0.13);
    const y = rise * (i + 1) - s.thickness;
    const out = s.face.at + s.face.outward * (s.projection / 2 - 0.02);
    const pos: [number, number, number] = s.face.axis === 'x' ? [out, y, along] : [along, y, out];
    // cada pieza va algo girada en el plano de la fachada, alternando, como en la referencia
    const tilt = side * 0.32;
    const rot: [number, number, number] = s.face.axis === 'x' ? [tilt, 0, 0] : [0, 0, tilt];
    const size: [number, number, number] = s.face.axis === 'x' ? [s.projection, s.thickness, s.width] : [s.width, s.thickness, s.projection];
    return { pos, rot, size, i };
  });
  return (
    <group>
      {items.map((it) => (
        <mesh key={it.i} position={it.pos} rotation={it.rot} material={it.i % 3 === 1 ? dark : mat} castShadow receiveShadow>
          <boxGeometry args={it.size} />
        </mesh>
      ))}
    </group>
  );
}

export function Outdoor3D({ outdoor, mats, options, level, selectedId, onSelect }: {
  outdoor: Outdoor; mats: MaterialSet; options: DesignOptions; level: number; selectedId?: string | null; onSelect?: (id: string) => void;
}) {
  const elevationOf = (f: Furniture) => TOP + groundTopAt(outdoor, f.x, f.y);
  return (
    <group>
      {renderRects(outdoor.pavements).map((p) => <Pavement key={p.id} p={p} mats={mats} />)}
      {outdoor.garden && <Garden3D garden={outdoor.garden} mats={mats} />}
      {(outdoor.annexes ?? []).map((a) => <Annex key={a.id} a={a} mats={mats} />)}
      {(outdoor.wallSteps ?? []).map((w) => <WallSteps key={w.id} s={w} />)}
      {(outdoor.rainChains ?? []).map((c) => <RainChain key={c.id} c={c} />)}
      {(outdoor.tanks ?? []).map((t) => <Tank key={t.id} t={t} />)}
      {outdoor.pavements.filter((p) => p.permeable).map((p) => <TreePit key={`al-${p.id}`} c={p.permeable!.c} r={p.permeable!.r} mats={mats} />)}
      {/* alcorques interiores: disco de grava sobre la losa (recortar la losa con agujeros rompe el sombreado) */}
      {outdoor.pavements.filter((p) => p.joints > 0).flatMap((p) => (p.pits ?? []).map((h, i) => <TreePit key={`ai-${p.id}-${i}`} c={h.c} r={h.r} mats={mats} lift={(p.top ?? 0) + 0.04} />))}
      {(outdoor.drains ?? []).map((d) => <Drain key={d.id} a={d.a} b={d.b} mats={mats} lift={groundTopAt(outdoor, (d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2)} />)}
      {(outdoor.porches ?? []).map((p) => <Porch key={p.id} p={p} mats={mats} />)}
      {outdoor.domeLamp && <DomeLamp lamp={outdoor.domeLamp} mode={options.lamparaExterior} mats={mats} level={level} />}
      <Furniture3D items={outdoor.furniture} mats={mats} elevationOf={elevationOf} options={options} selectedId={selectedId} onSelect={onSelect} />
      {level > 0.05 && outdoor.furniture.filter((f) => f.type === 'aplique').map((f) => (
        <pointLight key={`l-${f.id}`} position={[f.x, TOP + f.h + 0.05, f.y + 0.12]} color={WARM} intensity={level * 1.6} distance={6} decay={2} />
      ))}
    </group>
  );
}
