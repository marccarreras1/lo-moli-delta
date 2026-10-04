import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Layout } from '../data/types';
import { useModel } from '../state/derived';
import { type Ambience, useStore } from '../state/store';
import { Annotations } from './Annotations';
import { CameraRig } from './CameraRig';
import { Furniture3D } from './Furniture3D';
import { House } from './House';
import { useMaterials } from './materials';
import { effectiveQuality } from './qualityInfo';
import { glRef } from './support';

const AMBIENCE: Record<Ambience, { sky: string; ground: string; sun: string; sunK: number; hemiK: number; elev: number; az: number }> = {
  neutra: { sky: '#ffffff', ground: '#dcd8cf', sun: '#ffffff', sunK: 2.0, hemiK: 0.8, elev: 42, az: 35 },
  calida: { sky: '#fff6ea', ground: '#dccdb6', sun: '#ffe2bd', sunK: 2.0, hemiK: 0.7, elev: 24, az: 300 },
  nublada: { sky: '#f2f4f5', ground: '#d6d6d2', sun: '#f4f6f8', sunK: 0.9, hemiK: 1.25, elev: 60, az: 20 },
};

export function Viewer({ onReady, insets, onEnterRoom }: { onReady?: () => void; insets: { bottom: number; right: number }; onEnterRoom: (id: string) => void }) {
  const { layout, cameras, variant } = useModel();
  const tab = useStore((s) => s.tab);
  const v = useStore((s) => s.visual);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const openFractions = useStore((s) => s.openFractions);
  const cameraRequest = useStore((s) => s.cameraRequest);
  const saved = useStore((s) => s.cameras[s.tab]);
  const saveCamera = useStore((s) => s.saveCamera);
  const quality = effectiveQuality(v.quality);
  // en Plantas la vista cenital se secciona como ajuste contextual, sin cambiar las preferencias
  const mode = tab === 'plantas' ? (v.mode === 'atenuado' ? 'atenuado' : 'corte') : v.mode;
  const mats = useMaterials(variant.finishes, mode, tab === 'plantas' ? Math.min(v.sectionHeight, 1.5) : v.sectionHeight);
  const showRoof = v.showRoof && tab === 'exterior';
  const roomLabelsVisible = tab === 'plantas' || (tab === 'exterior' && (!showRoof || mode !== 'solido'));

  return (
    <Canvas
      shadows={quality === 'alta' ? 'soft' : true}
      dpr={quality === 'alta' ? [1, 2] : [1, 1.25]}
      camera={{ fov: 35, near: 0.05, far: 500, position: [0, 12, 28] }}
      gl={{ preserveDrawingBuffer: true, antialias: quality === 'alta' }}
      onCreated={({ gl, scene, camera }) => {
        gl.localClippingEnabled = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        glRef.current = gl;
        glRef.scene = scene;
        glRef.camera = camera;
        // diagnóstico opcional: ?diagnostico expone el visor en la consola
        if (location.search.includes('diagnostico')) (window as unknown as Record<string, unknown>).__visor = { gl, scene, camera };
        onReady?.();
      }}
      onPointerMissed={(e) => { if (e.type === 'click') select(null); }}
      data-testid="viewer-canvas"
    >
      <color attach="background" args={['#f5f3ee']} />
      <fog attach="fog" args={['#f5f3ee', 60, 140]} />
      <Lights layout={layout} intensity={v.lightIntensity} ambience={v.ambience} shadowSize={quality === 'alta' ? 2048 : 1024} />
      <Ground layout={layout} />
      <House layout={layout} mats={mats} showRoof={showRoof} showCeiling={tab === 'interior'} mode={mode}
        sectionHeight={tab === 'plantas' ? Math.min(v.sectionHeight, 1.5) : v.sectionHeight} selection={selection} openFractions={openFractions} onSelect={select} />
      {v.showFurniture && <Furniture3D items={layout.furniture} mats={mats} />}
      <Annotations layout={layout} showLabels={v.showLabels && tab !== 'interior'} showDims={v.showDims && tab !== 'interior'} showAreas={v.showAreas}
        roomLabelsVisible={roomLabelsVisible} selectedOpeningId={selection?.kind === 'opening' ? selection.id : null} />
      <CameraRig presets={cameras} request={cameraRequest} tab={tab} eyeHeight={v.eyeHeight} interiorFov={v.interiorFov}
        layout={layout} saved={saved} insets={insets} onSave={saveCamera} onEnterRoom={onEnterRoom} />
      <Disposer />
    </Canvas>
  );
}

function Lights({ layout, intensity, ambience, shadowSize }: { layout: Layout; intensity: number; ambience: Ambience; shadowSize: number }) {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const R = Math.max(maxX - minX, maxY - minY, 6);
  const a = AMBIENCE[ambience];
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(cx, 0, cy);
    return o;
  }, [cx, cy]);
  const az = (a.az * Math.PI) / 180;
  const el = (a.elev * Math.PI) / 180;
  const r = 30;
  // luz de visualización: dirección fija por ambiente, no representa el sol real
  const pos: [number, number, number] = [cx + r * Math.cos(el) * Math.sin(az), r * Math.sin(el), cy + r * Math.cos(el) * Math.cos(az)];
  const k = Math.max(0.35, intensity);
  return (
    <>
      <hemisphereLight args={[a.sky, a.ground, a.hemiK * k]} />
      <ambientLight intensity={0.25} />
      <primitive object={target} />
      <directionalLight position={pos} target={target} color={a.sun} intensity={a.sunK * k} castShadow
        shadow-mapSize={[shadowSize, shadowSize]} shadow-camera-left={-R} shadow-camera-right={R} shadow-camera-top={R} shadow-camera-bottom={-R}
        shadow-camera-near={1} shadow-camera-far={90} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={4} />
      <directionalLight position={[cx - 20, 12, cy - 25]} intensity={0.3 * k} />
    </>
  );
}

/** Entorno neutro: plano y retícula de 1 m. No representa ninguna parcela. */
function Ground({ layout }: { layout: Layout }) {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const R = Math.max(maxX - minX, maxY - minY, 6);
  const grid = Math.ceil(R * 3);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.121, cy]} receiveShadow>
        <circleGeometry args={[R * 6, 64]} />
        <meshStandardMaterial color="#ecebe5" roughness={1} />
      </mesh>
      <gridHelper args={[grid, grid, '#dcdcd3', '#e4e3dc']} position={[cx, -0.115, cy]} />
    </group>
  );
}

function Disposer() {
  useEffect(() => () => {
    glRef.current = null;
    glRef.scene = null;
    glRef.camera = null;
  }, []);
  return null;
}
