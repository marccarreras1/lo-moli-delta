/**
 * Marcadores 3D de instalaciones: piezas pequeñas (≈6 cm) del color de su capa y con forma
 * distinta por capa, a su altura propuesta. No proyectan sombra. Un InstancedMesh por capa.
 * Plano (x, y) → escena (x, altura, y).
 */
import { Billboard } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LAYER_STYLE } from './symbols';
import { LAYERS, type InstallPoint, type Layer } from './types';

const R = 0.03;

function makeGeometry(layer: Layer): THREE.BufferGeometry {
  switch (LAYER_STYLE[layer].shape) {
    case 'circulo': return new THREE.SphereGeometry(R, 14, 10);
    case 'cuadrado': return new THREE.BoxGeometry(R * 1.6, R * 1.6, R * 1.6);
    case 'rombo': return new THREE.OctahedronGeometry(R * 1.2);
    case 'triangulo': return new THREE.ConeGeometry(R * 1.1, R * 2, 3);
    case 'gota': return new THREE.ConeGeometry(R, R * 2.2, 12).rotateX(Math.PI);
    case 'hexagono': return new THREE.CylinderGeometry(R * 1.1, R * 1.1, R * 1.2, 6);
  }
}

export interface Installations3DProps {
  points: InstallPoint[];
  visibleLayers: Set<Layer>;
  /** cota (m) del suelo de un nivel */
  elevationOf: (levelId: string) => number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const placed = (p: InstallPoint) => p.x !== null && p.y !== null;

function LayerMarkers({ layer, points, elevationOf, onSelect }: { layer: Layer; points: InstallPoint[]; elevationOf: (id: string) => number; onSelect?: (id: string) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => makeGeometry(layer), [layer]);
  const mat = useMemo(() => {
    const c = new THREE.Color(LAYER_STYLE[layer].color);
    return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.5 });
  }, [layer]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    points.forEach((p, i) => {
      o.position.set(p.x as number, elevationOf(p.levelId) + p.height, p.y as number);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [points, elevationOf]);
  return (
    <instancedMesh key={points.length} ref={ref} args={[geo, mat, points.length]} castShadow={false} receiveShadow={false} frustumCulled={false}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const p = e.instanceId !== undefined ? points[e.instanceId] : undefined;
        if (p) onSelect?.(p.id);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
      userData={{ installations: layer }} />
  );
}

export function Installations3D({ points, visibleLayers, elevationOf, selectedId, onSelect }: Installations3DProps) {
  const byLayer = useMemo(() => {
    const m = new Map<Layer, InstallPoint[]>();
    for (const l of LAYERS) if (visibleLayers.has(l)) m.set(l, points.filter((p) => p.layer === l && placed(p)));
    return m;
  }, [points, visibleLayers]);
  const sel = selectedId ? points.find((p) => p.id === selectedId && placed(p) && visibleLayers.has(p.layer)) : undefined;
  return (
    <group name="instalaciones">
      {[...byLayer.entries()].filter(([, pts]) => pts.length > 0).map(([layer, pts]) => (
        <LayerMarkers key={layer} layer={layer} points={pts} elevationOf={elevationOf} onSelect={onSelect} />
      ))}
      {sel && (
        <Billboard position={[sel.x as number, elevationOf(sel.levelId) + sel.height, sel.y as number]}>
          <mesh renderOrder={10} raycast={() => null}>
            <ringGeometry args={[R * 1.9, R * 2.6, 32]} />
            <meshBasicMaterial color="#68765e" transparent opacity={0.9} depthTest={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </Billboard>
      )}
    </group>
  );
}

export default Installations3D;
