import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Layout, Site } from '../data/types';
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
  const level = layout.levels.find((l) => l.id === v.levelId) ?? layout.levels[0];
  const levelElev = level?.elevation ?? 0;
  // plano de corte relativo al nivel activo; los niveles superiores se ocultan al seccionar
  const cutAbs = levelElev + (tab === 'plantas' ? Math.min(v.sectionHeight, 1.5) : v.sectionHeight);
  const maxElev = mode === 'corte' || tab === 'plantas' ? levelElev : Infinity;
  const mats = useMaterials(variant.finishes, mode, cutAbs);
  const elevOfLevel = (id: string) => layout.levels.find((l) => l.id === id)?.elevation ?? 0;
  const roomLevel = new Map(layout.rooms.map((r) => [r.id, elevOfLevel(r.levelId)]));
  const furniture = layout.furniture.filter((f) => (roomLevel.get(f.roomId) ?? 0) <= maxElev + 1e-6);
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
      {layout.site && v.showSite ? <SiteGround layout={layout} site={layout.site} lite={quality !== 'alta'} /> : <Ground layout={layout} />}
      <House layout={layout} mats={mats} showRoof={showRoof} showCeiling={tab === 'interior'} mode={mode}
        sectionHeight={cutAbs} selection={selection} openFractions={openFractions} onSelect={select} maxElev={maxElev} />
      {v.showFurniture && <Furniture3D items={furniture} mats={mats} elevationOf={(f) => roomLevel.get(f.roomId) ?? 0} />}
      <Annotations layout={layout} showLabels={v.showLabels && tab !== 'interior'} showDims={v.showDims && tab !== 'interior'} showAreas={v.showAreas}
        roomLabelsVisible={roomLabelsVisible} maxElev={maxElev} selectedOpeningId={selection?.kind === 'opening' ? selection.id : null} />
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

/** generador pseudoaleatorio determinista (la parcela se ve igual en cada carga) */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Entorno de la parcela aproximado a partir de las fotos: terreno rojizo, olivar en
 * retícula ligeramente irregular, algarrobo y solera. No es un levantamiento.
 */
function SiteGround({ layout, site, lite }: { layout: Layout; site: Site; lite: boolean }) {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const olives = useMemo(() => {
    const r = rng(site.olives.seed);
    const { spacing: s, extent, clear } = site.olives;
    const out: { x: number; y: number; k: number; rot: number }[] = [];
    for (let gx = -extent; gx <= extent; gx += s) {
      for (let gy = -extent; gy <= extent; gy += s) {
        const x = cx + gx + (r() - 0.5) * 1.6;
        const y = cy + gy + (r() - 0.5) * 1.6;
        const k = 0.8 + r() * 0.45;
        const rot = r() * Math.PI * 2;
        if (Math.hypot(gx, gy) > extent) continue;
        if (x > clear[0] && x < clear[2] && y > clear[1] && y < clear[3]) continue;
        if (site.trees.some((t) => Math.hypot(t.c[0] - x, t.c[1] - y) < t.r + 1.5)) continue;
        out.push({ x, y, k, rot });
      }
    }
    return out;
  }, [site, cx, cy]);
  const trunks = useMemo(() => new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.26, 1.2, 7), new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 1 }), olives.length), [olives.length]);
  const crowns = useMemo(() => new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, lite ? 0 : 1), new THREE.MeshStandardMaterial({ color: '#8c9670', roughness: 1, flatShading: true }), olives.length), [olives.length, lite]);
  // los árboles que tapan la casa desde la cámara se ocultan (olivos) o se aclaran (algarrobo)
  const hidden = useRef<boolean[]>([]);
  const lastCam = useRef(new THREE.Vector3(Infinity, 0, 0));
  const treeMats = useMemo(() => site.trees.map(() => new THREE.MeshStandardMaterial({ color: '#4f6a35', roughness: 1, flatShading: true, transparent: true })), [site.trees]);
  const writeMatrices = (hide: boolean[]) => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const zero = new THREE.Vector3(0, 0, 0);
    olives.forEach((o, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rot);
      const s = hide[i] ? 0 : 1;
      m.compose(new THREE.Vector3(o.x, 0.6 * o.k - 0.12, o.y), q, s ? new THREE.Vector3(o.k, o.k, o.k) : zero);
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(o.x, 2.0 * o.k, o.y), q, s ? new THREE.Vector3(1.9 * o.k, 1.25 * o.k, 1.7 * o.k) : zero);
      crowns.setMatrixAt(i, m);
    });
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
  };
  useEffect(() => {
    hidden.current = olives.map(() => false);
    lastCam.current.set(Infinity, 0, 0);
    writeMatrices(hidden.current);
    trunks.castShadow = crowns.castShadow = true;
  }, [olives, trunks, crowns]);
  useFrame(({ camera }) => {
    if (camera.position.distanceToSquared(lastCam.current) < 0.01) return;
    lastCam.current.copy(camera.position);
    const cam = camera.position;
    const centre = new THREE.Vector3(cx, 1.5, cy);
    const toHouse = centre.clone().sub(cam);
    const dHouse = toHouse.length();
    toHouse.normalize();
    const halfDiag = Math.hypot(maxX - minX, maxY - minY) / 2;
    const houseAng = Math.atan(halfDiag / Math.max(dHouse, 0.1));
    const occludes = (x: number, y: number, h: number, r: number) => {
      const v = new THREE.Vector3(x, h, y).sub(cam);
      const d = v.length();
      if (d > dHouse - 1 || d < 0.1) return false;
      return v.normalize().angleTo(toHouse) < houseAng + Math.atan(r / d) * 0.9;
    };
    // en interiores (cámara dentro de la casa) no se oculta nada
    const inside = cam.x > minX && cam.x < maxX && cam.z > minY && cam.z < maxY;
    const next = olives.map((o) => !inside && occludes(o.x, o.y, 2 * o.k, 2 * o.k));
    if (next.some((h, i) => h !== hidden.current[i])) {
      hidden.current = next;
      writeMatrices(next);
    }
    site.trees.forEach((t, i) => {
      treeMats[i].opacity = !inside && occludes(t.c[0], t.c[1], t.h * 0.6, t.r) ? 0.25 : 1;
      treeMats[i].depthWrite = treeMats[i].opacity === 1;
    });
  });
  useEffect(() => () => {
    for (const im of [trunks, crowns]) {
      im.geometry.dispose();
      (im.material as THREE.Material).dispose();
    }
  }, [trunks, crowns]);
  useEffect(() => () => treeMats.forEach((m) => m.dispose()), [treeMats]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.121, cy]} receiveShadow>
        <circleGeometry args={[site.olives.extent + 30, 64]} />
        <meshStandardMaterial color={site.ground} roughness={1} />
      </mesh>
      {site.pavements.map((p) => (
        <mesh key={p.id} position={[(p.rect[0] + p.rect[2]) / 2, -0.1, (p.rect[1] + p.rect[3]) / 2]} receiveShadow>
          <boxGeometry args={[p.rect[2] - p.rect[0], 0.04, p.rect[3] - p.rect[1]]} />
          <meshStandardMaterial color="#d3cdbf" roughness={0.95} />
        </mesh>
      ))}
      <primitive object={trunks} />
      <primitive object={crowns} />
      {site.trees.map((t, i) => (
        <group key={t.id} position={[t.c[0], -0.12, t.c[1]]}>
          <mesh position={[0, t.h * 0.2, 0]} castShadow><cylinderGeometry args={[0.25, 0.4, t.h * 0.4, 8]} /><meshStandardMaterial color="#5e5043" roughness={1} /></mesh>
          <mesh position={[0, t.h * 0.62, 0]} scale={[t.r, t.h * 0.36, t.r]} castShadow material={treeMats[i]}><icosahedronGeometry args={[1, lite ? 1 : 2]} /></mesh>
        </group>
      ))}
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
