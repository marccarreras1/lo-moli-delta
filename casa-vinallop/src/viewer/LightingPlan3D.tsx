/**
 * Plan de iluminación (propuesta): luminarias del plan (pinchos a los árboles, balizas, apliques, colgantes,
 * tiras y focos rasantes) y, de noche, su luz. Para no cargar el visor solo llevan luz real las más
 * cercanas a la casa; el resto se ve encendido con un halo aditivo (cono hacia la copa o disco en el suelo).
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { LightPoint, LightingPlan, Vec2 } from '../data/types';
import { WARM } from './Lamps';
import type { MaterialSet } from './materials';

const dist = (c: Vec2, b: { minX: number; minY: number; maxX: number; maxY: number }) =>
  Math.hypot(Math.max(b.minX - c[0], 0, c[0] - b.maxX), Math.max(b.minY - c[1], 0, c[1] - b.maxY));

/** textura radial suave para halos */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,190,120,1)');
  r.addColorStop(0.4, 'rgba(255,170,100,0.35)');
  r.addColorStop(1, 'rgba(255,160,90,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function LightingPlan3D({ plan, bounds, mats, level }: { plan: LightingPlan; bounds: { minX: number; minY: number; maxX: number; maxY: number }; mats: MaterialSet; level: number }) {
  const on = level > 0.05;
  const tex = useMemo(() => glowTexture(), []);
  const halo = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, side: THREE.DoubleSide }), [tex]);
  const beam = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffb46b', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.018, side: THREE.FrontSide }), []);
  useEffect(() => () => { tex.dispose(); halo.dispose(); beam.dispose(); }, [tex, halo, beam]);
  // luz real solo en las luminarias de interior y exterior inmediato y en los 10 árboles más cercanos a la casa
  const real = useMemo(() => {
    const trees = plan.points.filter((p) => p.kind === 'pincho-arbol').sort((a, b) => dist(a.c, bounds) - dist(b.c, bounds)).slice(0, 6).map((p) => p.id);
    return new Set([...trees, ...plan.points.filter((p) => p.kind !== 'pincho-arbol' && p.kind !== 'baliza-camino' && p.kind !== 'baliza-escalera').map((p) => p.id)]);
  }, [plan, bounds]);
  return (
    <group>
      {plan.points.map((p) => <Fixture key={p.id} p={p} mats={mats} on={on} level={level} real={real.has(p.id)} halo={halo} beam={beam} />)}
    </group>
  );
}

function Fixture({ p, mats, on, level, real, halo, beam }: { p: LightPoint; mats: MaterialSet; on: boolean; level: number; real: boolean; halo: THREE.Material; beam: THREE.Material }) {
  const [x, y] = p.c;
  switch (p.kind) {
    case 'pincho-arbol':
    case 'rasante': {
      const h = Math.max(1, (p.aim ?? 3) - p.z);
      return (
        <group position={[x, p.z, y]}>
          <mesh material={mats.blackMetal} position={[0, 0.09, 0]} rotation={[-0.25, 0, 0]} castShadow><cylinderGeometry args={[0.025, 0.021, 0.09, 12]} /></mesh>
          <mesh material={mats.lampGlow} position={[0, 0.137, -0.011]} rotation={[-0.25, 0, 0]}><circleGeometry args={[0.018, 12]} /></mesh>
          {on && (
            <>
              <mesh material={beam} position={[0, 0.15 + h / 2, 0]}><coneGeometry args={[p.kind === 'rasante' ? 0.3 : 0.8, h, 20, 1, true]} /></mesh>
              <mesh material={halo} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.0, 1.0]} /></mesh>
              {real && <SpotUp at={[x, p.z + 0.15, y]} to={[x, p.z + h, y]} intensity={level * (p.kind === 'rasante' ? 3 : 6)} angle={p.kind === 'rasante' ? 0.25 : 0.6} />}
            </>
          )}
        </group>
      );
    }
    case 'baliza-camino':
      return (
        <group position={[x, p.z, y]}>
          <mesh material={mats.blackMetal} position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.04, 0.045, 0.5, 12]} /></mesh>
          <mesh material={mats.lampGlow} position={[0, 0.44, 0]}><cylinderGeometry args={[0.041, 0.041, 0.05, 12]} /></mesh>
          {on && <mesh material={halo} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.8, 1.8]} /></mesh>}
        </group>
      );
    case 'baliza-escalera':
      return (
        <group position={[x, p.z, y]}>
          <mesh material={mats.lampGlow}><boxGeometry args={[0.02, 0.05, 0.1]} /></mesh>
          {on && <mesh material={halo} position={[0.02, -0.2, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.6, 0.5]} /></mesh>}
        </group>
      );
    case 'aplique':
      return (
        <group position={[x, p.z, y]}>
          <mesh material={mats.clayLight} castShadow><cylinderGeometry args={[0.09, 0.06, 0.16, 20, 1, true]} /></mesh>
          <mesh material={mats.lampGlow} position={[0, 0.05, 0]}><sphereGeometry args={[0.035, 12, 8]} /></mesh>
          {on && real && <pointLight position={[0, 0.2, 0]} color={WARM} intensity={level * 1.6} distance={4} decay={2} />}
        </group>
      );
    case 'colgante':
      return (
        <group position={[x, p.z, y]}>
          <mesh material={mats.blackMetal} position={[0, 0.6, 0]}><cylinderGeometry args={[0.003, 0.003, 1.0, 6]} /></mesh>
          <mesh material={mats.clay} castShadow><sphereGeometry args={[0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} /></mesh>
          <mesh material={mats.lampGlow} position={[0, 0.02, 0]}><sphereGeometry args={[0.05, 12, 8]} /></mesh>
          {on && real && <pointLight position={[0, -0.05, 0]} color={WARM} intensity={level * 2.2} distance={5} decay={2} />}
        </group>
      );
    case 'tira': {
      const b = p.b ?? p.c;
      const len = Math.hypot(b[0] - x, b[1] - y);
      const ang = Math.atan2(b[1] - y, b[0] - x);
      const mid: [number, number, number] = [(x + b[0]) / 2, p.z, (y + b[1]) / 2];
      const n = Math.max(1, Math.round(len / 8));
      return (
        <group>
          <mesh material={mats.lampGlow} position={mid} rotation={[0, -ang, 0]}><boxGeometry args={[len, 0.015, 0.03]} /></mesh>
          {on && real && Array.from({ length: n }, (_, i) => {
            const t = (i + 0.5) / n;
            return <pointLight key={i} position={[x + (b[0] - x) * t, p.z + (p.aim ? 0.15 : -0.1), y + (b[1] - y) * t]} color={WARM} intensity={level * (p.aim ? 1.4 : 1.2)} distance={p.aim ? 4 : 2.5} decay={2} />;
          })}
        </group>
      );
    }
    case 'estanca':
      return (
        <group position={[x, p.z, y]}>
          <mesh material={mats.blackMetal}><boxGeometry args={[0.08, 0.12, 0.2]} /></mesh>
          <mesh material={mats.lampGlow} position={[-0.045, 0, 0]}><boxGeometry args={[0.01, 0.08, 0.16]} /></mesh>
          {on && <pointLight position={[-0.3, -0.1, 0]} color={WARM} intensity={level * 1.2} distance={4} decay={2} />}
        </group>
      );
  }
}

function SpotUp({ at, to, intensity, angle }: { at: [number, number, number]; to: [number, number, number]; intensity: number; angle: number }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(...to);
  return (
    <group>
      <primitive object={target} />
      <spotLight position={at} target={target} color={WARM} intensity={intensity} angle={angle} penumbra={0.8} distance={9} decay={2} />
    </group>
  );
}
