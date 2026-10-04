import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CameraPreset, Layout, Site } from '../data/types';
import { resolveLayout, type Variant } from '../model/resolve';
import { useModel } from '../state/derived';
import { type Ambience, useStore } from '../state/store';
import { Annotations } from './Annotations';
import { CameraRig } from './CameraRig';
import { Furniture3D } from './Furniture3D';
import { House } from './House';
import { FixtureLights, Pendants } from './Lamps';
import { Outdoor3D } from './Outdoor3D';
import { Landscape } from './Landscape';
import { Effects } from './Effects';
import { Sky, SoftShadows } from '@react-three/drei';
import { barkMaterial, blobTexture, buildTree, leafMaterial, soilTexture } from './Trees';
import { solarDirection, useSolar } from '../model/solar';
import { Installations3D } from '../instalaciones/Installations3D';
import { useGestion } from '../gestion/store';
import { useInstalaciones, useResolvedPoints, useVisibleLayers } from '../instalaciones/store';
import { useMaterials } from './materials';
import { effectiveQuality } from './qualityInfo';
import { glRef } from './support';

/**
 * Escenas de luz ambientales (no son un estudio solar: la orientación y la ubicación no están
 * confirmadas). Día, tarde cálida y noche con las lámparas encendidas.
 */
const AMBIENCE: Record<Ambience, { bg: string; sky: string; ground: string; sun: string; sunK: number; hemiK: number; elev: number; az: number; env: number; exposure: number; lamps: number }> = {
  // día como en las fotos de dron: sol duro, sombras marcadas y bruma clara en el horizonte
  dia: { bg: '#dde3e8', sky: '#dbe4ec', ground: '#b89a80', sun: '#fff1de', sunK: 2.7, hemiK: 0.36, elev: 50, az: 68, env: 0.48, exposure: 1.0, lamps: 0.12 },
  tarde: { bg: '#f1e1cc', sky: '#f4dcc0', ground: '#c09474', sun: '#ffbe85', sunK: 2.3, hemiK: 0.55, elev: 15, az: 295, env: 0.5, exposure: 1.05, lamps: 0.6 },
  noche: { bg: '#161b24', sky: '#27324a', ground: '#141110', sun: '#9fb2d6', sunK: 0.18, hemiK: 0.16, elev: 55, az: 140, env: 0.05, exposure: 1.15, lamps: 1 },
};

export function Viewer({ onReady, insets, onEnterRoom }: { onReady?: () => void; insets: { bottom: number; right: number }; onEnterRoom: (id: string) => void }) {
  const { layout, cameras, variant } = useModel();
  const tab = useStore((s) => s.tab);
  const v = useStore((s) => s.visual);
  const instPoints = useResolvedPoints(layout);
  if (typeof location !== 'undefined' && location.search.includes('diagnostico')) (window as unknown as Record<string, unknown>).__layout = layout;
  const instLayers = useVisibleLayers();
  const instSel = useInstalaciones((s) => s.selectedId);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const openFractions = useStore((s) => s.openFractions);
  const cameraRequest = useStore((s) => s.cameraRequest);
  const saved = useStore((s) => s.cameras[s.tab]);
  const saveCamera = useStore((s) => s.saveCamera);
  const quality = effectiveQuality(v.quality);
  // en Plantas la vista cenital se secciona como ajuste contextual, sin cambiar las preferencias
  const mode = tab === 'plantas' ? (v.mode === 'atenuado' ? 'atenuado' : 'corte') : v.mode;
  const section = v.longSection && tab === 'exterior';
  const level = layout.levels.find((l) => l.id === v.levelId) ?? layout.levels[0];
  const levelElev = level?.elevation ?? 0;
  // plano de corte relativo al nivel activo; los niveles superiores se ocultan al seccionar
  const cutAbs = levelElev + (tab === 'plantas' ? Math.min(v.sectionHeight, 1.5) : v.sectionHeight);
  const maxElev = mode === 'corte' || tab === 'plantas' ? levelElev : Infinity;
  const amb = AMBIENCE[v.ambience];
  const lampLevel = amb.lamps * v.lampDimmer;
  const mats = useMaterials(variant.finishes, mode, cutAbs, section, lampLevel);
  const elevOfLevel = (id: string) => layout.levels.find((l) => l.id === id)?.elevation ?? 0;
  const roomLevel = new Map(layout.rooms.map((r) => [r.id, elevOfLevel(r.levelId)]));
  const furniture = layout.furniture.filter((f) => (roomLevel.get(f.roomId) ?? 0) <= maxElev + 1e-6);
  const elevationOf = (f: { roomId: string }) => roomLevel.get(f.roomId) ?? 0;
  const showRoof = v.showRoof && tab === 'exterior';
  const roomLabelsVisible = tab === 'plantas' || (tab === 'exterior' && (!showRoof || mode !== 'solido'));
  const selFurniture = selection?.kind === 'furniture' ? selection.id : null;
  const onSelectFurniture = (id: string) => select({ kind: 'furniture', id });
  // las luces artificiales solo se calculan cuando aportan (tarde, noche o interior)
  const artificial = lampLevel > 0.05 && (tab === 'interior' || v.ambience !== 'dia');
  const lite = quality !== 'alta';
  const setVisual = useStore((s) => s.setVisual);
  // las vistas preparadas fijan lo que necesitan ver (corte longitudinal, sin cubierta)
  const applyPreset = (p: CameraPreset) => {
    if (p.group !== 'exterior') return;
    const st = useStore.getState().visual;
    if (st.longSection !== !!p.section) setVisual('longSection', !!p.section);
    if (p.fixed && st.showRoof === !!p.hideRoof) setVisual('showRoof', !p.hideRoof);
  };

  return (
    <Canvas
      shadows={quality === 'alta' ? 'soft' : true}
      dpr={quality === 'alta' ? [1, 2] : [1, 1.25]}
      camera={{ fov: 35, near: 0.05, far: 1400, position: [0, 12, 28] }}
      gl={{ preserveDrawingBuffer: true, antialias: quality === 'alta' }}
      onCreated={({ gl, scene, camera, setFrameloop }) => {
        glRef.setFrameloop = setFrameloop;
        gl.localClippingEnabled = true;
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.0;
        glRef.current = gl;
        glRef.scene = scene;
        glRef.camera = camera;
        // diagnóstico opcional: ?diagnostico expone el visor en la consola
        if (location.search.includes('diagnostico')) {
          (window as unknown as Record<string, unknown>).__visor = { gl, scene, camera, setFrameloop };
          (window as unknown as Record<string, unknown>).__photoModule = () => import('./photo');
        }
        onReady?.();
      }}
      onPointerMissed={(e) => { if (e.type === 'click') select(null); }}
      data-testid="viewer-canvas"
    >
      <color attach="background" args={[amb.bg]} />
      <fog attach="fog" args={[amb.bg, layout.site && v.showSite ? 90 : 60, layout.site && v.showSite ? 420 : 140]} />
      {v.ambience !== 'noche' && tab !== 'plantas' && <SkyDome ambience={v.ambience} />}
      <Environment intensity={amb.env * (tab === 'interior' && quality === 'alta' ? 0.7 : 1)} exposure={amb.exposure} />
      <Lights layout={layout} intensity={v.lightIntensity} ambience={v.ambience} shadowSize={quality === 'alta' ? 4096 : 2048} interior={tab === 'interior' && quality === 'alta'} wide={!!layout.site && v.showSite && tab === 'exterior'} />
      {layout.site && v.showSite ? <SiteGround layout={layout} site={layout.site} lite={lite} sunAz={v.ambience === 'noche' ? null : AMBIENCE[v.ambience].az} sunEl={AMBIENCE[v.ambience].elev} /> : <Ground layout={layout} />}
      <House layout={layout} mats={mats} showRoof={showRoof} showCeiling={tab === 'interior' || section} mode={mode}
        sectionHeight={cutAbs} selection={selection} openFractions={openFractions} onSelect={select} maxElev={maxElev} />
      {v.showFurniture && <Furniture3D items={furniture} mats={mats} elevationOf={elevationOf} options={layout.options} selectedId={selFurniture} onSelect={onSelectFurniture} />}
      {v.showFurniture && layout.outdoor && tab !== 'plantas' && (
        <Outdoor3D outdoor={layout.outdoor} mats={mats} options={layout.options} level={artificial ? lampLevel : 0} selectedId={selFurniture} onSelect={onSelectFurniture} />
      )}
      {v.showFurniture && maxElev === Infinity && <Pendants layout={layout} mats={mats} level={lampLevel} lights={artificial} />}
      {v.showFurniture && artificial && <FixtureLights furniture={furniture} elevationOf={elevationOf} level={lampLevel} />}
      <CommentPins levels={layout.levels} />
      {instLayers.size > 0 && <group userData={{ helper: true }}><Installations3D points={instPoints} visibleLayers={instLayers} elevationOf={(id) => layout.levels.find((l) => l.id === id)?.elevation ?? 0} selectedId={instSel} onSelect={(id) => useInstalaciones.getState().select(id)} /></group>}
      <Annotations layout={layout} showLabels={v.showLabels && tab !== 'interior'} showDims={v.showDims && tab !== 'interior'} showAreas={v.showAreas}
        roomLabelsVisible={roomLabelsVisible} maxElev={maxElev} selectedOpeningId={selection?.kind === 'opening' ? selection.id : null} />
      {quality === 'alta' && <Effects interior={tab === 'interior'} night={v.ambience !== 'dia'} />}
      {quality === 'alta' && <SoftShadows size={18} samples={10} focus={0.5} />}
      <CameraRig presets={cameras} request={cameraRequest} tab={tab} eyeHeight={v.eyeHeight} interiorFov={v.interiorFov}
        layout={layout} saved={saved} insets={insets} onSave={saveCamera} onEnterRoom={onEnterRoom} onPreset={applyPreset} />
      <Disposer />
    </Canvas>
  );
}

/** Luz de entorno sin descargas: «RoomEnvironment» de Three.js filtrado con PMREM. */
function Environment({ intensity, exposure }: { intensity: number; exposure: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const t = pm.fromScene(room, 0.04).texture;
    room.dispose();
    pm.dispose();
    return t;
  }, [gl]);
  useEffect(() => {
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [scene, env]);
  useEffect(() => {
    scene.environmentIntensity = intensity;
    gl.toneMappingExposure = exposure;
  }, [scene, gl, intensity, exposure]);
  return null;
}

function Lights({ layout, intensity, ambience, shadowSize, interior = false, wide = false }: { layout: Layout; intensity: number; ambience: Ambience; shadowSize: number; interior?: boolean; wide?: boolean }) {
  // la sombra cubre la casa y el comedor exterior si lo hay
  const { minX, minY, maxX, maxY } = layout.bounds;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // con el olivar a la vista, la sombra cubre también los árboles cercanos (como en las fotos de dron)
  const R = Math.max(Math.max(maxX - minX, maxY - minY, 6) * (layout.outdoor ? 0.75 : 0.6), wide ? 30 : 0);
  const a = AMBIENCE[ambience];
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(cx, 0, cy);
    return o;
  }, [cx, cy]);
  const az = (a.az * Math.PI) / 180;
  const el = (a.elev * Math.PI) / 180;
  const r = wide ? 70 : 30;
  // luz de visualización: dirección fija por ambiente, no representa el sol real…
  // …salvo con el estudio solar activo (norte, situación y fecha indicados)
  const solar = solarDirection(useSolar());
  const pos: [number, number, number] = solar && solar.el > 0
    ? [cx + r * solar.x, r * solar.y, cy + r * solar.z]
    : [cx + r * Math.cos(el) * Math.sin(az), r * Math.sin(el), cy + r * Math.cos(el) * Math.cos(az)];
  const k = Math.max(0.35, intensity);
  return (
    <>
      {/* en interiores (calidad alta) menos luz de relleno: más contraste y profundidad; la oclusión ambiental hace el resto */}
      <hemisphereLight args={[a.sky, a.ground, a.hemiK * k * (interior ? 0.6 : 1)]} />
      <ambientLight intensity={(ambience === 'noche' ? 0.04 : 0.12) * (interior ? 0.4 : 1)} />
      <primitive object={target} />
      <directionalLight position={pos} target={target} color={a.sun} intensity={a.sunK * k} castShadow
        shadow-mapSize={[shadowSize, shadowSize]} shadow-camera-left={-R} shadow-camera-right={R} shadow-camera-top={R} shadow-camera-bottom={-R}
        shadow-camera-near={1} shadow-camera-far={140} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={4} />
      <directionalLight position={[cx - 20, 12, cy - 25]} intensity={(ambience === 'noche' ? 0.04 : 0.25) * k} />
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
function SiteGround({ layout, site, lite, sunAz = null, sunEl = 45 }: { layout: Layout; site: Site; lite: boolean; sunAz?: number | null; sunEl?: number }) {
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
        const k = 0.95 + r() * 0.4;
        const rot = r() * Math.PI * 2;
        if (Math.hypot(gx, gy) > extent) continue;
        if (x > clear[0] && x < clear[2] && y > clear[1] && y < clear[3]) continue;
        if (site.trees.some((t) => Math.hypot(t.c[0] - x, t.c[1] - y) < t.r + 1.2)) continue;
        // ni sobre la solera actual ni sobre la solera del proyecto
        const inRect = (rc: [number, number, number, number], m: number) => x > rc[0] - m && x < rc[2] + m && y > rc[1] - m && y < rc[3] + m;
        if (site.pavements.some((p) => inRect(p.rect, 0.8))) continue;
        if ((layout.outdoor?.pavements ?? []).some((p) => p.joints > 0 && inRect(p.rect, 1.2))) continue;
        out.push({ x, y, k, rot });
      }
    }
    return out;
  }, [site, cx, cy, layout.outdoor]);
  // olivos procedurales: tres variantes, cada una con su malla instanciada de madera y de hojas
  const VARIANTS = lite ? 2 : 3;
  const oliveSets = useMemo(() => Array.from({ length: VARIANTS }, (_, v) => {
    const t = buildTree('olivo', 101 + v * 37, 6.2, 4.8);
    const count = olives.filter((_, i) => i % VARIANTS === v).length;
    const wood = new THREE.InstancedMesh(t.wood, barkMaterial('olivo'), Math.max(1, count));
    const leaves = new THREE.InstancedMesh(t.leaves, leafMaterial('olivo'), Math.max(1, count));
    wood.castShadow = leaves.castShadow = true;
    wood.receiveShadow = leaves.receiveShadow = true;
    return { wood, leaves };
  }), [olives, VARIANTS]);
  const carobs = useMemo(() => site.trees.map((t, i) => {
    const g = buildTree('algarrobo', 7 + i * 13, t.r * 2, t.h);
    return { ...g, leafMat: Object.assign(leafMaterial('algarrobo'), { userData: { fade: true } }), barkMat: barkMaterial('algarrobo') };
  }), [site.trees]);
  // sombras lejanas: manchas suaves bajo los olivos que quedan fuera del mapa de sombras
  const blobs = useMemo(() => {
    if (sunAz === null) return null;
    const far = olives.filter((o) => Math.hypot(o.x - cx, o.y - cy) > 24);
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTexture(), color: '#2e2117', transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), Math.max(1, far.length));
    const az = (sunAz * Math.PI) / 180;
    const off = 3.2 / Math.tan((Math.max(15, Math.min(sunEl, 40)) * Math.PI) / 180);
    const o3 = new THREE.Object3D();
    far.forEach((o, i) => {
      o3.position.set(o.x - Math.sin(az) * off * o.k, -0.1, o.y - Math.cos(az) * off * o.k);
      o3.rotation.set(0, o.rot, 0);
      o3.scale.set(7.6 * o.k, 1, 6.4 * o.k);
      o3.updateMatrix();
      m.setMatrixAt(i, o3.matrix);
    });
    m.count = far.length;
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    return m;
  }, [olives, sunAz, sunEl, cx, cy]);
  useEffect(() => () => { if (blobs) { blobs.geometry.dispose(); (blobs.material as THREE.Material).dispose(); } }, [blobs]);
  const soil = useMemo(() => {
    const t = soilTexture().clone();
    const R = site.olives.extent + 12;
    t.repeat.set((R * 2) / 7, (R * 2) / 7);
    t.needsUpdate = true;
    return t;
  }, [site.olives.extent]);
  // los árboles que tapan la casa desde la cámara se ocultan (olivos) o se aclaran (algarrobo)
  const hidden = useRef<boolean[]>([]);
  const lastCam = useRef(new THREE.Vector3(Infinity, 0, 0));
  const treeMats = useMemo(() => carobs.map((c) => c.leafMat), [carobs]);
  const writeMatrices = (hide: boolean[]) => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const zero = new THREE.Vector3(0, 0, 0);
    const idx = new Array(VARIANTS).fill(0);
    olives.forEach((o, i) => {
      const v = i % VARIANTS;
      const j = idx[v]++;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rot);
      m.compose(new THREE.Vector3(o.x, -0.12, o.y), q, hide[i] ? zero : new THREE.Vector3(o.k, o.k * (0.9 + (o.rot % 0.2)), o.k));
      oliveSets[v].wood.setMatrixAt(j, m);
      oliveSets[v].leaves.setMatrixAt(j, m);
    });
    oliveSets.forEach((s) => {
      s.wood.instanceMatrix.needsUpdate = true;
      s.leaves.instanceMatrix.needsUpdate = true;
    });
  };
  useEffect(() => {
    hidden.current = olives.map(() => false);
    lastCam.current.set(Infinity, 0, 0);
    writeMatrices(hidden.current);
  }, [olives, oliveSets]);
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
      const fade = !inside && occludes(t.c[0], t.c[1], t.h * 0.6, t.r);
      treeMats[i].opacity = fade ? 0.45 : 1;
      treeMats[i].transparent = fade;
      // con transparencia, el recorte de las hojas debe bajar o desaparecerían
      treeMats[i].alphaTest = fade ? 0.12 : 0.45;
      treeMats[i].depthWrite = !fade;
    });
  });
  useEffect(() => () => oliveSets.forEach((s) => {
    for (const im of [s.wood, s.leaves]) {
      im.geometry.dispose();
      (im.material as THREE.Material).dispose();
    }
  }), [oliveSets]);
  useEffect(() => () => carobs.forEach((c) => { c.wood.dispose(); c.leaves.dispose(); c.leafMat.dispose(); c.barkMat.dispose(); }), [carobs]);
  return (
    <group>
      {!lite && <Landscape cx={cx} cy={cy} grove={site.olives.extent} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.16, cy]} receiveShadow>
        <circleGeometry args={[700, 48]} />
        <meshStandardMaterial color="#c4a688" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.121, cy]} receiveShadow>
        <circleGeometry args={[site.olives.extent + 12, 96]} />
        <meshStandardMaterial map={soil} color="#ffffff" roughness={1} />
      </mesh>
      {site.pavements.map((p) => (
        <mesh key={p.id} position={[(p.rect[0] + p.rect[2]) / 2, -0.1, (p.rect[1] + p.rect[3]) / 2]} receiveShadow>
          <boxGeometry args={[p.rect[2] - p.rect[0], 0.04, p.rect[3] - p.rect[1]]} />
          <meshStandardMaterial color="#bdb6aa" roughness={0.95} />
        </mesh>
      ))}
      {oliveSets.map((s, i) => <group key={i}><primitive object={s.wood} /><primitive object={s.leaves} /></group>)}
      {blobs && <group userData={{ helper: true }}><primitive object={blobs} /></group>}
      {site.trees.map((t, i) => (
        <group key={t.id} position={[t.c[0], -0.12, t.c[1]]}>
          <mesh geometry={carobs[i].wood} material={carobs[i].barkMat} castShadow receiveShadow />
          <mesh geometry={carobs[i].leaves} material={carobs[i].leafMat} castShadow receiveShadow />
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

/** Chinchetas de los comentarios (persistidos en la gestión del proyecto). */
function CommentPins({ levels }: { levels: Layout['levels'] }) {
  const comments = useGestion((s) => s.comentarios);
  return (
    <group userData={{ helper: true }}>
      {comments.map((c) => {
        const el = levels.find((l) => l.id === c.nivel)?.elevation ?? 0;
        const h = c.posicion.z ?? 1.9;
        const col = c.estado === 'resuelto' ? '#3f7a4a' : '#b26a00';
        return (
          <group key={c.id} position={[c.posicion.x, el, c.posicion.y]}>
            <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.008, 0.008, h, 6]} /><meshBasicMaterial color={col} /></mesh>
            <mesh position={[0, h, 0]}><sphereGeometry args={[0.05, 14, 10]} /><meshBasicMaterial color={col} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Sigue la cámara del visor principal en cada fotograma (vistas sincronizadas). */
function FollowCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const src = glRef.camera as THREE.PerspectiveCamera | null;
    if (!src) return;
    camera.position.copy(src.position);
    camera.quaternion.copy(src.quaternion);
    if (camera.fov !== src.fov) { camera.fov = src.fov; camera.updateProjectionMatrix(); }
  });
  return null;
}

/**
 * Segundo visor del comparador: muestra otra variante (o la activa con un cambio) desde la misma
 * cámara que el visor principal. Solo se mira: la navegación se hace en el visor de la izquierda.
 */
export function CompareViewer({ variant }: { variant: Variant }) {
  const { project } = useModel();
  const layout = useMemo(() => resolveLayout(project, variant), [project, variant]);
  const tab = useStore((s) => s.tab);
  const v = useStore((s) => s.visual);
  const mode = tab === 'plantas' ? (v.mode === 'atenuado' ? 'atenuado' : 'corte') : v.mode;
  const section = v.longSection && tab === 'exterior';
  const level = layout.levels.find((l) => l.id === v.levelId) ?? layout.levels[0];
  const levelElev = level?.elevation ?? 0;
  const cutAbs = levelElev + (tab === 'plantas' ? Math.min(v.sectionHeight, 1.5) : v.sectionHeight);
  const maxElev = mode === 'corte' || tab === 'plantas' ? levelElev : Infinity;
  const amb = AMBIENCE[v.ambience];
  const lampLevel = amb.lamps * v.lampDimmer;
  const mats = useMaterials(variant.finishes, mode, cutAbs, section, lampLevel);
  const elevOfLevel = (id: string) => layout.levels.find((l) => l.id === id)?.elevation ?? 0;
  const roomLevel = new Map(layout.rooms.map((r) => [r.id, elevOfLevel(r.levelId)]));
  const furniture = layout.furniture.filter((f) => (roomLevel.get(f.roomId) ?? 0) <= maxElev + 1e-6);
  const elevationOf = (f: { roomId: string }) => roomLevel.get(f.roomId) ?? 0;
  const artificial = lampLevel > 0.05 && (tab === 'interior' || v.ambience !== 'dia');
  return (
    <Canvas shadows dpr={[1, 1.25]} camera={{ fov: 35, near: 0.05, far: 500, position: [0, 12, 28] }} gl={{ preserveDrawingBuffer: true }}
      onCreated={({ gl }) => { gl.localClippingEnabled = true; gl.toneMapping = THREE.NeutralToneMapping; }} data-testid="compare-canvas">
      <color attach="background" args={[amb.bg]} />
      <fog attach="fog" args={[amb.bg, 60, 140]} />
      <Environment intensity={amb.env} exposure={amb.exposure} />
      <Lights layout={layout} intensity={v.lightIntensity} ambience={v.ambience} shadowSize={1024} />
      {layout.site && v.showSite ? <SiteGround layout={layout} site={layout.site} lite /> : <Ground layout={layout} />}
      <House layout={layout} mats={mats} showRoof={v.showRoof && tab === 'exterior'} showCeiling={tab === 'interior' || section} mode={mode}
        sectionHeight={cutAbs} selection={null} openFractions={{}} onSelect={() => undefined} maxElev={maxElev} />
      {v.showFurniture && <Furniture3D items={furniture} mats={mats} elevationOf={elevationOf} options={layout.options} />}
      {v.showFurniture && layout.outdoor && tab !== 'plantas' && <Outdoor3D outdoor={layout.outdoor} mats={mats} options={layout.options} level={artificial ? lampLevel : 0} />}
      {v.showFurniture && maxElev === Infinity && <Pendants layout={layout} mats={mats} level={lampLevel} lights={artificial} />}
      <FollowCamera />
    </Canvas>
  );
}

/** Cielo de dispersión atmosférica (día y tarde), coherente con la dirección de la luz. */
function SkyDome({ ambience }: { ambience: Ambience }) {
  const a = AMBIENCE[ambience];
  const az = (a.az * Math.PI) / 180;
  const el = (a.elev * Math.PI) / 180;
  const sun: [number, number, number] = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  return <group userData={{ helper: true }}><Sky distance={1100} sunPosition={sun} turbidity={ambience === 'tarde' ? 7 : 4} rayleigh={ambience === 'tarde' ? 2.2 : 0.9} mieCoefficient={0.004} mieDirectionalG={0.85} /></group>;
}
