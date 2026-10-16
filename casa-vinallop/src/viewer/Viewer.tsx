import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { hdriFor, loadHdri, type HdriName } from './hdri';
import { Effects } from './Effects';
import { Sky, SoftShadows } from '@react-three/drei';
import { barkMaterial, blobTexture, buildTree, discAlphaTexture, grassTexture, leafMaterial, litterTexture, rockGeometry, soilTexture } from './Trees';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { modelAzimuth, solarDirection, useSolar } from '../model/solar';
import { Installations3D } from '../instalaciones/Installations3D';
import { useGestion } from '../gestion/store';
import { useInstalaciones, useResolvedPoints, useVisibleLayers } from '../instalaciones/store';
import { useMaterials } from './materials';
import { effectiveQuality } from './qualityInfo';
import { glRef } from './support';
import { TapeMeasure } from './Tape';
import { useTape } from './tapeStore';

/**
 * Escenas de luz ambientales (no son un estudio solar: la orientación y la ubicación no están
 * confirmadas). Día, tarde cálida y noche con las lámparas encendidas.
 */
const AMBIENCE: Record<Ambience, { bg: string; sky: string; ground: string; sun: string; sunK: number; hemiK: number; elev: number; az: number; geoAz: number; env: number; exposure: number; lamps: number }> = {
  // día como en las fotos de dron: sol duro, sombras marcadas y bruma clara en el horizonte
  // (con el norte conocido: sol del sur-suroeste a primera hora de la tarde)
  // luz de sol «normal» (propiedad): sol blanco cálido, relleno de cielo casi neutro y bruma sin tinte azul
  dia: { bg: '#e6e3dc', sky: '#ebe7df', ground: '#c4a386', sun: '#fff3e2', sunK: 3.0, hemiK: 0.34, elev: 52, az: 68, geoAz: 200, env: 0.62, exposure: 1.0, lamps: 0.12 },
  // hora dorada: sol bajo y cálido; `az` es la dirección del sol del HDRI «sunset» sin girar
  // (con el norte conocido: sol de poniente, y el HDRI se gira para que coincida)
  tarde: { bg: '#e4dbd0', sky: '#e8d8c4', ground: '#b49478', sun: '#ffc68f', sunK: 3.1, hemiK: 0.3, elev: 11, az: 54, geoAz: 262, env: 0.42, exposure: 1.05, lamps: 0.6 },
  noche: { bg: '#161b24', sky: '#27324a', ground: '#141110', sun: '#9fb2d6', sunK: 0.18, hemiK: 0.16, elev: 55, az: 140, geoAz: 160, env: 0.05, exposure: 1.15, lamps: 1 },
};

/**
 * Dirección del sol del visor (acimut del modelo y elevación, en grados): el estudio solar si está
 * activo; si no, la del ambiente, orientada con el norte del proyecto cuando se conoce.
 */
export function useSun(ambience: Ambience): { az: number; el: number; hdriTurn: number } {
  const { project } = useModel();
  const s = useSolar();
  const a = AMBIENCE[ambience];
  const d = solarDirection(s, project.northDeg);
  const north = s.northDeg ?? project.northDeg;
  let az = north === null ? a.az : modelAzimuth(a.geoAz, north);
  let el = a.elev;
  if (d && d.el > 0) {
    az = ((Math.atan2(d.x, d.z) * 180) / Math.PI + 360) % 360;
    el = d.el;
  }
  // giro del HDRI para que su sol caiga en la dirección del sol del visor
  return { az, el, hdriTurn: az - a.az };
}

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
  const sun = useSun(v.ambience);
  const lampLevel = amb.lamps * v.lampDimmer;
  const mats = useMaterials(variant.finishes, mode, cutAbs, section, lampLevel);
  const elevOfLevel = (id: string) => layout.levels.find((l) => l.id === id)?.elevation ?? 0;
  const roomLevel = new Map(layout.rooms.map((r) => [r.id, elevOfLevel(r.levelId)]));
  const furniture = layout.furniture.filter((f) => (roomLevel.get(f.roomId) ?? 0) <= maxElev + 1e-6);
  const elevationOf = (f: { roomId: string }) => roomLevel.get(f.roomId) ?? 0;
  const showRoof = v.showRoof && tab === 'exterior';
  const roomLabelsVisible = tab === 'plantas' || (tab === 'exterior' && (!showRoof || mode !== 'solido'));
  const selFurniture = selection?.kind === 'furniture' ? selection.id : null;
  // con la cinta métrica activa, los clics miden y no seleccionan
  const onSelectFurniture = (id: string) => { if (!useTape.getState().on) select({ kind: 'furniture', id }); };
  // las luces artificiales solo se calculan cuando aportan (tarde, noche o interior)
  const artificial = lampLevel > 0.05 && (tab === 'interior' || v.ambience !== 'dia');
  const lite = quality !== 'alta';
  const setVisual = useStore((s) => s.setVisual);
  // las vistas preparadas fijan lo que necesitan ver (corte longitudinal, sin cubierta)
  const applyPreset = (p: CameraPreset) => {
    const st = useStore.getState().visual;
    if (p.group === 'interior') {
      // vista cenital 3D: planta cortada por encima de los muebles, sin techos; a pie, de nuevo maciza
      if (p.topDown) {
        if (st.mode !== 'corte') setVisual('mode', 'corte');
        if (st.sectionHeight !== 2.2) setVisual('sectionHeight', 2.2);
      } else if (st.mode === 'corte') setVisual('mode', 'solido');
      return;
    }
    if (p.group !== 'exterior') return;
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
          (window as unknown as Record<string, unknown>).__hdriModule = () => import('./hdri');
        }
        onReady?.();
      }}
      onPointerMissed={(e) => { if (e.type === 'click' && !useTape.getState().on) select(null); }}
      data-testid="viewer-canvas"
    >
      <color attach="background" args={[amb.bg]} />
      <fog attach="fog" args={[amb.bg, layout.site && v.showSite ? 90 : 60, layout.site && v.showSite ? 420 : 140]} />
      {v.ambience !== 'noche' && tab !== 'plantas' && <SkyDome ambience={v.ambience} />}
      <Environment intensity={amb.env * (tab === 'interior' && quality === 'alta' ? 0.7 : 1)} exposure={amb.exposure} hdri={tab === 'plantas' ? null : hdriFor(v.ambience)} turn={sun.hdriTurn} />
      <Lights layout={layout} intensity={v.lightIntensity} ambience={v.ambience} shadowSize={quality === 'alta' ? 4096 : 2048} interior={tab === 'interior' && quality === 'alta'} wide={!!layout.site && v.showSite && tab === 'exterior'} />
      {layout.site && v.showSite ? <SiteGround layout={layout} site={layout.site} lite={lite} sunAz={v.ambience === 'noche' ? null : sun.az} sunEl={sun.el} /> : <Ground layout={layout} />}
      <House layout={layout} mats={mats} showRoof={showRoof} showCeiling={(tab === 'interior' && mode !== 'corte') || section} mode={mode}
        sectionHeight={cutAbs} selection={selection} openFractions={openFractions} onSelect={(x) => { if (!useTape.getState().on) select(x); }} maxElev={maxElev} />
      {v.showFurniture && <Furniture3D items={furniture} mats={mats} elevationOf={elevationOf} options={layout.options} selectedId={selFurniture} onSelect={onSelectFurniture} />}
      {v.showFurniture && layout.outdoor && tab !== 'plantas' && (
        <Outdoor3D outdoor={layout.outdoor} mats={mats} options={layout.options} level={artificial ? lampLevel : 0} selectedId={selFurniture} onSelect={onSelectFurniture} />
      )}
      {v.showFurniture && maxElev === Infinity && <Pendants layout={layout} mats={mats} level={lampLevel} lights={artificial} />}
      {v.showFurniture && artificial && <FixtureLights furniture={furniture} elevationOf={elevationOf} level={lampLevel} />}
      <CommentPins levels={layout.levels} />
      <TapeMeasure />
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
function Environment({ intensity, exposure, hdri = null, turn = 0 }: { intensity: number; exposure: number; hdri?: HdriName | null; turn?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const room = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const r = new RoomEnvironment();
    const t = pm.fromScene(r, 0.04).texture;
    r.dispose();
    pm.dispose();
    return t;
  }, [gl]);
  // cielo real (HDRI) para la luz de entorno y los reflejos; mientras carga, el entorno neutro
  const [sky, setSky] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!hdri) { setSky(null); return; }
    let alive = true;
    let made: THREE.Texture | null = null;
    loadHdri(hdri).then((eq) => {
      if (!alive) return;
      const pm = new THREE.PMREMGenerator(gl);
      made = pm.fromEquirectangular(eq).texture;
      pm.dispose();
      setSky(made);
    }).catch(() => setSky(null));
    return () => { alive = false; made?.dispose(); };
  }, [gl, hdri]);
  const env = sky ?? room;
  useEffect(() => {
    scene.environment = env;
    return () => { scene.environment = null; };
  }, [scene, env]);
  useEffect(() => {
    scene.environmentRotation.set(0, (turn * Math.PI) / 180, 0);
  }, [scene, turn]);
  useEffect(() => () => room.dispose(), [room]);
  useEffect(() => {
    // el HDRI es más oscuro de media que el entorno neutro: se compensa
    scene.environmentIntensity = intensity * (sky ? 1.7 : 1);
    gl.toneMappingExposure = exposure;
  }, [scene, gl, intensity, exposure, sky]);
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
  const sun = useSun(ambience);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(cx, 0, cy);
    return o;
  }, [cx, cy]);
  const az = (sun.az * Math.PI) / 180;
  const el = (sun.el * Math.PI) / 180;
  const r = wide ? 70 : 30;
  // luz de visualización por ambiente, orientada con el norte si se conoce; el estudio solar activo
  // (norte, situación y fecha) pone el sol real
  const pos: [number, number, number] = [cx + r * Math.cos(el) * Math.sin(az), r * Math.sin(el), cy + r * Math.cos(el) * Math.cos(az)];
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
        const k = 0.88 + r() * 0.32;
        const rot = r() * Math.PI * 2;
        if (Math.hypot(gx, gy) > extent) continue;
        if (x > clear[0] && x < clear[2] && y > clear[1] && y < clear[3]) continue;
        if (site.trees.some((t) => Math.hypot(t.c[0] - x, t.c[1] - y) < t.r + 1.2)) continue;
        // ni encima de las cámaras de las vistas preparadas a pie
        if ((layout.views ?? []).some((v) => v.group === 'exterior' && v.position[2] < 10 && Math.hypot(v.position[0] - x, v.position[1] - y) < 4.2)) continue;
        // ni sobre la solera actual ni sobre la solera del proyecto
        const inRect = (rc: [number, number, number, number], m: number) => x > rc[0] - m && x < rc[2] + m && y > rc[1] - m && y < rc[3] + m;
        if (site.pavements.some((p) => inRect(p.rect, 0.8))) continue;
        if ((layout.outdoor?.pavements ?? []).some((p) => p.joints > 0 && inRect(p.rect, 1.2))) continue;
        if ((layout.outdoor?.annexes ?? []).some((a) => inRect(a.rect, 1.5))) continue;
        if ((layout.outdoor?.tanks ?? []).some((tk) => Math.hypot(tk.c[0] - x, tk.c[1] - y) < Math.max(tk.length, tk.diameter) / 2 + 2.5)) continue;
        // ni sobre el camino de acceso (es la franja despejada del olivar)
        if (site.acceso && distToPath(site.acceso.camino, x, y) < site.acceso.anchoCamino / 2 + 2.6) continue;
        out.push({ x, y, k, rot });
      }
    }
    return out;
  }, [site, cx, cy, layout.outdoor]);
  // olivos procedurales: tres variantes, cada una con su malla instanciada de madera y de hojas
  const VARIANTS = lite ? 2 : 3;
  const oliveSets = useMemo(() => Array.from({ length: VARIANTS }, (_, v) => {
    const t = buildTree('olivo', 101 + v * 37, 5.6, 4.8);
    const count = olives.filter((_, i) => i % VARIANTS === v).length;
    const wood = new THREE.InstancedMesh(t.wood, barkMaterial('olivo'), Math.max(1, count));
    const leaves = new THREE.InstancedMesh(t.leaves, leafMaterial('olivo'), Math.max(1, count));
    wood.castShadow = leaves.castShadow = true;
    wood.receiveShadow = leaves.receiveShadow = true;
    return { wood, leaves };
  }), [olives, VARIANTS]);
  // volúmenes de la casa (cubiertas por tramos o caja completa hasta el peto) que la copa no debe atravesar
  const houseBoxes = useMemo(() => {
    const segs = layout.roofSegments ?? [];
    if (segs.length) return segs.map((g) => [g.rect[0] - g.overhang, g.rect[1] - g.overhang, g.rect[2] + g.overhang, g.rect[3] + g.overhang, Math.max(g.hy0, g.hy1) + 0.2] as [number, number, number, number, number]);
    const top = Math.max(...layout.walls.filter((w) => w.kind === 'exterior').map((w) => (layout.levels.find((l) => l.id === w.levelId)?.elevation ?? 0) + w.height)) + 0.6;
    return [[minX, minY, maxX, maxY, top] as [number, number, number, number, number]];
  }, [layout.roofSegments, layout.walls, layout.levels, minX, minY, maxX, maxY]);
  const carobs = useMemo(() => site.trees.map((t, i) => {
    // el grupo del árbol está en (c.x, -0.12, c.y)
    // la casa y los porches: lo que entraría en ellos se poda (las ramas pueden pasar por encima de la pérgola)
    const porchBoxes = (layout.outdoor?.porches ?? []).map((pc) => [pc.rect[0], pc.rect[1], pc.rect[2], pc.rect[3], Math.max(pc.hWall, pc.hFront) + 0.3] as [number, number, number, number, number]);
    // límites medidos de la copa: todo lo que pasaría de esas líneas se trata como podado
    const B = 1e3;
    const k = t.copa ?? {};
    const copaBoxes = [
      ...(k.yMin != null ? [[-B, -B, B, k.yMin, B]] : []), ...(k.yMax != null ? [[-B, k.yMax, B, B, B]] : []),
      ...(k.xMin != null ? [[-B, -B, k.xMin, B, B]] : []), ...(k.xMax != null ? [[k.xMax, -B, B, B, B]] : []),
    ] as [number, number, number, number, number][];
    const obstacles = [...houseBoxes, ...porchBoxes, ...copaBoxes].map(([x0, y0, x1, y1, top]) => [x0 - t.c[0], y0 - t.c[1], x1 - t.c[0], y1 - t.c[1], top + 0.12] as [number, number, number, number, number]);
    const kind = t.kind ?? 'algarrobo';
    const g = buildTree(kind, 7 + i * 13, t.r * 2, t.h, obstacles, t.trunk);
    return { ...g, kind, leafMat: Object.assign(leafMaterial(kind), { userData: { fade: true } }), barkMat: barkMaterial(kind) };
  }), [site.trees, houseBoxes, layout.outdoor?.porches]);
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
  const litter = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a3b2e', map: litterTexture(), alphaMap: discAlphaTexture(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }), []);
  useEffect(() => () => litter.dispose(), [litter]);
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
      // solo se aclara desde vistas altas que buscan la casa; a la altura de los ojos el árbol se ve como es
      const fade = !inside && cam.y > 6 && occludes(t.c[0], t.c[1], t.h * 0.6, t.r);
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
      {site.acceso && <Acceso a={site.acceso} />}
      {oliveSets.map((s, i) => <group key={i}><primitive object={s.wood} /><primitive object={s.leaves} /></group>)}
      {blobs && <group userData={{ helper: true }}><primitive object={blobs} /></group>}
      {!lite && <GroundDetail layout={layout} site={site} cx={cx} cy={cy} />}
      {site.trees.map((t, i) => (
        <group key={t.id} position={[t.c[0], -0.12, t.c[1]]}>
          <mesh geometry={carobs[i].wood} material={carobs[i].barkMat} castShadow receiveShadow />
          <mesh geometry={carobs[i].leaves} material={carobs[i].leafMat} castShadow receiveShadow />
          {/* alfombra de hojas y vainas caídas bajo la copa (fotos) */}
          {carobs[i].kind === 'algarrobo' && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={litter} receiveShadow>
            <circleGeometry args={[t.r * 0.8, 40]} />
          </mesh>}
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
      <House layout={layout} mats={mats} showRoof={v.showRoof && tab === 'exterior'} showCeiling={(tab === 'interior' && mode !== 'corte') || section} mode={mode}
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
  const s = useSun(ambience);
  const az = (s.az * Math.PI) / 180;
  const el = (s.el * Math.PI) / 180;
  const sun: [number, number, number] = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  return <group userData={{ helper: true }}><Sky distance={1100} sunPosition={sun} turbidity={ambience === 'tarde' ? 7 : 4} rayleigh={ambience === 'tarde' ? 2.2 : 0.9} mieCoefficient={0.004} mieDirectionalG={0.85} /></group>;
}

/**
 * Detalle del suelo cerca de la casa: piedras calizas y matas de hierba seca (como en las fotos y
 * en el primer plano de los renders de referencia). Evita la casa, las soleras y los troncos.
 */
function GroundDetail({ layout, site, cx, cy }: { layout: Layout; site: Site; cx: number; cy: number }) {
  const { rocks, tufts } = useMemo(() => {
    const r = rng(77);
    const { minX, minY, maxX, maxY } = layout.bounds;
    const rects: [number, number, number, number][] = [
      [minX - 0.4, minY - 0.4, maxX + 0.4, maxY + 0.4],
      ...site.pavements.map((p) => p.rect),
      ...(layout.outdoor?.pavements ?? []).filter((p) => p.joints > 0).map((p) => p.rect),
      ...(layout.outdoor?.garden ? [layout.outdoor.garden.rect] : []),
      ...(layout.outdoor?.annexes ?? []).map((a) => a.rect),
      ...(layout.outdoor?.tanks ?? []).map((tk) => {
        const [w, d] = tk.axis === 'y' ? [tk.diameter, tk.length] : [tk.length, tk.diameter];
        return [tk.c[0] - w / 2 - 0.3, tk.c[1] - d / 2 - 0.3, tk.c[0] + w / 2 + 0.3, tk.c[1] + d / 2 + 0.3] as [number, number, number, number];
      }),
    ];
    const free = (x: number, y: number, m: number) => !rects.some((rc) => x > rc[0] - m && x < rc[2] + m && y > rc[1] - m && y < rc[3] + m)
      && !site.trees.some((t) => Math.hypot(t.c[0] - x, t.c[1] - y) < 1.2)
      && !(site.acceso && distToPath(site.acceso.camino, x, y) < site.acceso.anchoCamino / 2 + m);
    const pick = (n: number, R: number, m: number) => {
      const out: { x: number; y: number; s: number; rot: number }[] = [];
      for (let i = 0; i < n * 3 && out.length < n; i++) {
        const a = r() * Math.PI * 2;
        const d = 2 + Math.sqrt(r()) * R;
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d * 0.8;
        if (free(x, y, m)) out.push({ x, y, s: r(), rot: r() * Math.PI * 2 });
      }
      return out;
    };
    // piedras: muchas pequeñas y alguna mayor
    const rockGeo = rockGeometry(5);
    const rocksPts = pick(520, 30, 0.2);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: '#d6cbbb', roughness: 0.95, flatShading: true }), rocksPts.length);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    rocksPts.forEach((p, i) => {
      const sz = p.s < 0.9 ? 0.04 + p.s * 0.1 : 0.18 + (p.s - 0.9) * 2.5;
      o.position.set(p.x, -0.12 + sz * 0.15, p.y);
      o.rotation.set(0, p.rot, 0);
      o.scale.set(sz, sz, sz * (0.7 + p.s * 0.6));
      o.updateMatrix();
      rocks.setMatrixAt(i, o.matrix);
      rocks.setColorAt(i, col.set('#d8cdbd').multiplyScalar(0.8 + p.s * 0.3));
    });
    rocks.castShadow = rocks.receiveShadow = true;
    // matas de hierba seca: tres tarjetas cruzadas
    const blade = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const cross = mergeGeometries([0, 1, 2].map((k) => blade.clone().rotateY((k * Math.PI) / 3)))!;
    const tuftPts = pick(260, 32, 0.35);
    const tufts = new THREE.InstancedMesh(cross, new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: '#d9d2c2' }), tuftPts.length);
    tuftPts.forEach((p, i) => {
      const h = 0.14 + p.s * 0.26;
      o.position.set(p.x, -0.13, p.y);
      o.rotation.set(0, p.rot, 0);
      o.scale.set(h * 1.4, h, h * 1.4);
      o.updateMatrix();
      tufts.setMatrixAt(i, o.matrix);
    });
    tufts.castShadow = true;
    rocks.frustumCulled = tufts.frustumCulled = false;
    return { rocks, tufts };
  }, [layout, site, cx, cy]);
  useEffect(() => () => { for (const m of [rocks, tufts]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }, [rocks, tufts]);
  return (
    <group>
      <primitive object={rocks} />
      <primitive object={tufts} />
    </group>
  );
}

/** distancia de un punto al eje del camino (polilínea) */
function distToPath(path: [number, number][], x: number, y: number) {
  let d = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2));
    d = Math.min(d, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return d;
}

/** camino de tierra y grava hasta la entrada de la finca, con los postes de la entrada */
function Acceso({ a }: { a: NonNullable<import('../data/types').Site['acceso']> }) {
  const segs = a.camino.slice(0, -1).map((p, i) => {
    const q = a.camino[i + 1];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return { c: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as [number, number], len, ang: Math.atan2(q[1] - p[1], q[0] - p[0]) };
  });
  const last = a.camino[a.camino.length - 1];
  const prev = a.camino[a.camino.length - 2];
  const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  return (
    <group>
      {segs.map((s, i) => (
        <group key={i}>
          <mesh position={[s.c[0], -0.108, s.c[1]]} rotation={[-Math.PI / 2, 0, -s.ang]} receiveShadow>
            <planeGeometry args={[s.len + a.anchoCamino, a.anchoCamino]} />
            <meshStandardMaterial color="#a8998a" roughness={1} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((k) => (
        <mesh key={k} position={[last[0] + nx * k * a.anchoEntrada / 2, 0.6, last[1] + ny * k * a.anchoEntrada / 2]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 1.5, 8]} />
          <meshStandardMaterial color="#5b5a55" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
