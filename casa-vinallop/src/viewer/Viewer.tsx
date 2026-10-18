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
import { conSituacion, deFechaLocal, modelAzimuth, solarDirection, sunPosition, useAhora, useSolar } from '../model/solar';
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

/** con el sol real activo, el ambiente sigue al sol: noche bajo el horizonte, luz de tarde con el sol bajo, día el resto */
function useAmbiente(base: Ambience): Ambience {
  const { project } = useModel();
  const ahora = useAhora();
  const s = conSituacion(useSolar(), project.situacion, ahora);
  if (!s.active || s.lat === null || s.lon === null || (s.northDeg ?? project.northDeg) === null) return base;
  const { el } = sunPosition(deFechaLocal(s.datetime!), s.lat, s.lon);
  return el <= 0 ? 'noche' : el < 12 ? 'tarde' : 'dia';
}

/**
 * Dirección del sol del visor (acimut del modelo y elevación, en grados): el estudio solar si está
 * activo; si no, la del ambiente, orientada con el norte del proyecto cuando se conoce.
 */
export function useSun(ambience: Ambience): { az: number; el: number; hdriTurn: number } {
  const { project } = useModel();
  const ahora = useAhora();
  const s = conSituacion(useSolar(), project.situacion, ahora);
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

/** punto dentro de un polígono (par-impar) */
function inPoly(poly: [number, number][], x: number, y: number) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** La niebla se aleja con la cámara: vista desde muy arriba o muy lejos, la finca no se pierde en la bruma. */
function FogFollow({ near, far, center }: { near: number; far: number; center: [number, number] }) {
  const scene = useThree((s) => s.scene);
  useFrame(({ camera }) => {
    const f = scene.fog as THREE.Fog | null;
    if (!f) return;
    const d = Math.hypot(camera.position.x - center[0], camera.position.y, camera.position.z - center[1]);
    f.near = Math.max(near, d * 0.9);
    f.far = Math.max(far, d * 2.6);
  });
  return null;
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
  const ambiente = useAmbiente(v.ambience);
  const amb = AMBIENCE[ambiente];
  const sun = useSun(ambiente);
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
  const artificial = lampLevel > 0.05 && (tab === 'interior' || ambiente !== 'dia');
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
      <FogFollow near={layout.site && v.showSite ? 90 : 60} far={layout.site && v.showSite ? 420 : 140} center={[(layout.bounds.minX + layout.bounds.maxX) / 2, (layout.bounds.minY + layout.bounds.maxY) / 2]} />
      {ambiente !== 'noche' && tab !== 'plantas' && <SkyDome ambience={ambiente} />}
      <Environment intensity={amb.env * (tab === 'interior' && quality === 'alta' ? 0.7 : 1)} exposure={amb.exposure} hdri={tab === 'plantas' ? null : hdriFor(ambiente)} turn={sun.hdriTurn} />
      <Lights layout={layout} intensity={v.lightIntensity} ambience={ambiente} shadowSize={quality === 'alta' ? 4096 : 2048} interior={tab === 'interior' && quality === 'alta'} wide={!!layout.site && v.showSite && tab === 'exterior'} />
      {layout.site && v.showSite ? <SiteGround layout={layout} site={layout.site} lite={lite} sunAz={ambiente === 'noche' ? null : sun.az} sunEl={sun.el} /> : <Ground layout={layout} />}
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
      {quality === 'alta' && <Effects interior={tab === 'interior'} night={ambiente !== 'dia'} />}
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
    const zona = site.olives.zonaFoto;
    const inZona = (x: number, y: number) => {
      if (!zona) return false;
      let c = false;
      for (let i = 0, j = zona.length - 1; i < zona.length; j = i++) {
        const [xi, yi] = zona[i];
        const [xj, yj] = zona[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    // olivos reales de la foto de dron (posición y tamaño de copa)
    // con el lindero catastral, el olivar llena la parcela (a ≥2,5 m del lindero); sin él, un círculo alrededor de la casa
    const lindero = site.parcela?.poligono;
    const dentro = (x: number, y: number, m: number) => !lindero || (inPoly(lindero, x, y) && distToPath([...lindero, lindero[0]], x, y) > m);
    const candidates: { x: number; y: number; k: number; rot: number; real?: boolean }[] = (site.olives.fijos ?? [])
      .map(([x, y, d], i) => ({ x, y, k: Math.min(1.35, Math.max(0.55, d / 5.6)), rot: ((i * 2.399) % (Math.PI * 2)), real: true }))
      .filter((o) => dentro(o.x, o.y, 1));
    const bx = lindero ? lindero.reduce((b, [x, y]) => [Math.min(b[0], x - cx), Math.min(b[1], y - cy), Math.max(b[2], x - cx), Math.max(b[3], y - cy)], [0, 0, 0, 0]) : [-extent, -extent, extent, extent];
    for (let gx = Math.floor(bx[0] / s) * s; gx <= bx[2]; gx += s) {
      for (let gy = Math.floor(bx[1] / s) * s; gy <= bx[3]; gy += s) {
        const x = cx + gx + (r() - 0.5) * 1.6;
        const y = cy + gy + (r() - 0.5) * 1.6;
        const k = 0.88 + r() * 0.32;
        const rot = r() * Math.PI * 2;
        if (lindero ? !dentro(x, y, 2.5) : Math.hypot(gx, gy) > extent) continue;
        if (inZona(x, y)) continue;
        candidates.push({ x, y, k, rot });
      }
    }
    for (const { x, y, k, rot, real } of candidates) {
      // los olivos reales (de las fotos) se conservan (indicación de la propiedad): solo se quitan los que caen sobre la casa,
      // el cuarto técnico, el camino, el aparcamiento o una cámara de las vistas; los de la retícula dejan además libre el entorno de la casa
      if (real ? x > minX - 0.3 && x < maxX + 0.3 && y > minY - 0.3 && y < maxY + 0.3 : x > clear[0] && x < clear[2] && y > clear[1] && y < clear[3]) continue;
      if (site.trees.some((t) => Math.hypot(t.c[0] - x, t.c[1] - y) < (real ? Math.max(2.5, t.r * 0.6) : t.r + 1.2))) continue;
      if ((layout.views ?? []).some((v) => v.group === 'exterior' && v.position[2] < 10 && Math.hypot(v.position[0] - x, v.position[1] - y) < (real ? 1.5 : 4.2))) continue;
      // ni sobre la solera actual ni sobre la solera del proyecto
      const inRect = (rc: [number, number, number, number], m: number) => x > rc[0] - m && x < rc[2] + m && y > rc[1] - m && y < rc[3] + m;
      if (site.pavements.some((p) => inRect(p.rect, 0.8))) continue;
      if (!real && (layout.outdoor?.pavements ?? []).some((p) => p.joints > 0 && inRect(p.rect, 1.2))) continue;
      // el olivo que solapa el cuarto técnico se quita (decisión de la propiedad); los demás reales se quedan
      if ((layout.outdoor?.annexes ?? []).some((a) => inRect(a.rect, real ? 0.3 : 1.5))) continue;
      if (!real && (layout.outdoor?.tanks ?? []).some((tk) => Math.hypot(tk.c[0] - x, tk.c[1] - y) < Math.max(tk.length, tk.diameter) / 2 + 2.5)) continue;
      // ni sobre el camino de acceso (es la franja despejada del olivar)
      if (site.acceso && distToPath(site.acceso.camino, x, y) < site.acceso.anchoCamino / 2 + (real ? 0.6 : 2.6)) continue;
      out.push({ x, y, k, rot });
    }
    return out;
  }, [site, cx, cy, layout.outdoor, layout.views, minX, minY, maxX, maxY]);
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
    // zona de comedor bajada: dos volúmenes (la copa del algarrobo puede pasar sobre la cubierta baja)
    if (layout.escalon) return [[minX, minY, layout.escalon.x, maxY, top] as [number, number, number, number, number], [layout.escalon.x, minY, maxX, maxY, layout.escalon.top + 0.6] as [number, number, number, number, number]];
    return [[minX, minY, maxX, maxY, top] as [number, number, number, number, number]];
  }, [layout.roofSegments, layout.walls, layout.levels, layout.escalon, minX, minY, maxX, maxY]);
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
      // la esfera de recorte se calcula con las posiciones reales (si no, se queda en el origen y el olivar
      // desaparece cuando la casa sale del encuadre)
      s.wood.computeBoundingSphere();
      s.leaves.computeBoundingSphere();
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
      {!lite && <Landscape cx={cx} cy={cy} grove={site.parcela ? Math.max(site.olives.extent, cy - Math.min(...site.parcela.poligono.map((q) => q[1])) + 4) : site.olives.extent} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.16, cy]} receiveShadow>
        <circleGeometry args={[700, 48]} />
        <meshStandardMaterial color="#c4a688" roughness={1} />
      </mesh>
      {site.parcela ? <Lindero poligono={site.parcela.poligono} hueco={site.acceso ? huecoPuerta(site.acceso) : undefined} /> : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.121, cy]} receiveShadow>
          <circleGeometry args={[site.olives.extent + 12, 96]} />
          <meshStandardMaterial map={soil} color="#ffffff" roughness={1} />
        </mesh>
      )}
      {site.pavements.map((p) => (
        <group key={p.id}>
          <mesh position={[(p.rect[0] + p.rect[2]) / 2, -0.1, (p.rect[1] + p.rect[3]) / 2]} receiveShadow>
            <boxGeometry args={[p.rect[2] - p.rect[0], 0.04, p.rect[3] - p.rect[1]]} />
            <meshStandardMaterial color={p.firme === 'grava' ? '#ddd3c1' : '#bdb6aa'} roughness={p.firme === 'grava' ? 1 : 0.95} />
          </mesh>
          {/* la grava se contiene con un bordillo bajo de piedra */}
          {p.firme === 'grava' && [[p.rect[0], p.rect[1], p.rect[2], p.rect[1]], [p.rect[0], p.rect[3], p.rect[2], p.rect[3]], [p.rect[0], p.rect[1], p.rect[0], p.rect[3]], [p.rect[2], p.rect[1], p.rect[2], p.rect[3]]].map(([ax, ay, bx, by], i) => (
            <mesh key={i} position={[(ax + bx) / 2, -0.06, (ay + by) / 2]} castShadow receiveShadow>
              <boxGeometry args={[Math.abs(bx - ax) + 0.15, 0.12, Math.abs(by - ay) + 0.15]} />
              <meshStandardMaterial color="#a89c88" roughness={1} />
            </mesh>
          ))}
        </group>
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
/** Hueco de la malla en la puerta: a lo largo de la línea de la puerta, hasta el final de los pilares y la pared seca. */
function huecoPuerta(a: NonNullable<import('../data/types').Site['acceso']>) {
  const last = a.camino[a.camino.length - 1];
  const prev = a.camino[a.camino.length - 2];
  const l = Math.hypot(last[0] - prev[0], last[1] - prev[1]) || 1;
  return { c: last, r: a.anchoEntrada / 2 + 4.1, dir: [-(last[1] - prev[1]) / l, (last[0] - prev[0]) / l] as [number, number] };
}

/** Finca según el lindero catastral: tierra del olivar con la forma de la parcela y el lindero marcado en el suelo. */
function Lindero({ poligono, hueco }: { poligono: [number, number][]; hueco?: { c: [number, number]; r: number; dir: [number, number] } }) {
  const { geo, tex } = useMemo(() => {
    // la forma se dibuja en el plano XY y se tumba (-90° en X): la Y del plano pasa a −Z, por eso se invierte
    const shape = new THREE.Shape(poligono.map(([x, y]) => new THREE.Vector2(x, -y)));
    const g = new THREE.ShapeGeometry(shape);
    const t = soilTexture().clone();
    // las UV de la forma van en metros: una tesela cada 7 m, como en el círculo
    t.repeat.set(1 / 7, 1 / 7);
    t.needsUpdate = true;
    return { geo: g, tex: t };
  }, [poligono]);
  useEffect(() => () => { geo.dispose(); tex.dispose(); }, [geo, tex]);
  // malla de alambre con postes cada ≈3 m por todo el lindero, salvo en el hueco de la puerta
  const malla = useMemo(() => {
    const tramos: { c: [number, number]; len: number; ang: number }[] = [];
    const postes: [number, number][] = [];
    // fuera del hueco: lejos de la puerta a lo largo de su línea, o fuera de esa línea (p. ej. el otro lindero de la esquina)
    const fuera = (x: number, y: number) => {
      if (!hueco) return true;
      const dx = x - hueco.c[0];
      const dy = y - hueco.c[1];
      return Math.abs(dx * hueco.dir[0] + dy * hueco.dir[1]) > hueco.r || Math.abs(-dx * hueco.dir[1] + dy * hueco.dir[0]) > 0.8;
    };
    poligono.forEach((p, i) => {
      const q = poligono[(i + 1) % poligono.length];
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const n = Math.max(1, Math.round(L / 3));
      for (let k = 0; k < n; k++) {
        const a0: [number, number] = [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n];
        const a1: [number, number] = [p[0] + ((q[0] - p[0]) * (k + 1)) / n, p[1] + ((q[1] - p[1]) * (k + 1)) / n];
        if (fuera(...a0)) postes.push(a0);
        if (fuera(...a0) && fuera(...a1)) tramos.push({ c: [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2], len: L / n, ang: Math.atan2(q[1] - p[1], q[0] - p[0]) });
      }
    });
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), new THREE.MeshStandardMaterial({ color: '#6f6a60', roughness: 0.6, metalness: 0.4 }), Math.max(1, postes.length));
    postes.forEach(([x, y], i) => { m.compose(new THREE.Vector3(x, 0.53, y), q.identity(), new THREE.Vector3(1, 1, 1)); post.setMatrixAt(i, m); });
    post.count = postes.length;
    const net = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1.1), new THREE.MeshStandardMaterial({ color: '#8d918c', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, roughness: 0.8 }), Math.max(1, tramos.length));
    tramos.forEach((t, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -t.ang); m.compose(new THREE.Vector3(t.c[0], 0.47, t.c[1]), q, new THREE.Vector3(t.len, 1, 1)); net.setMatrixAt(i, m); });
    net.count = tramos.length;
    return { post, net };
  }, [poligono, hueco]);
  useEffect(() => () => { for (const o of [malla.post, malla.net]) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } }, [malla]);
  const lados = poligono.map((p, i) => {
    const q = poligono[(i + 1) % poligono.length];
    return { c: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as [number, number], len: Math.hypot(q[0] - p[0], q[1] - p[1]), ang: Math.atan2(q[1] - p[1], q[0] - p[0]) };
  });
  return (
    <group>
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.121, 0]} receiveShadow>
        <meshStandardMaterial map={tex} color="#ffffff" roughness={1} />
      </mesh>
      {lados.map((l, i) => (
        <mesh key={i} position={[l.c[0], -0.1, l.c[1]]} rotation={[-Math.PI / 2, 0, -l.ang]}>
          <planeGeometry args={[l.len + 0.4, 0.4]} />
          <meshStandardMaterial color="#e9dfc8" roughness={1} />
        </mesh>
      ))}
      <primitive object={malla.post} />
      <primitive object={malla.net} />
      {poligono.map(([x, y], i) => (
        <mesh key={`v${i}`} position={[x, 0.3, y]} castShadow>
          <boxGeometry args={[0.25, 0.85, 0.25]} />
          <meshStandardMaterial color="#d8cdb4" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Acceso({ a }: { a: NonNullable<import('../data/types').Site['acceso']> }) {
  const segs = a.camino.slice(0, -1).map((p, i) => {
    const q = a.camino[i + 1];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return { c: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as [number, number], len, ang: Math.atan2(q[1] - p[1], q[0] - p[0]) };
  });
  const last = a.camino[a.camino.length - 1];
  const prev = a.camino[a.camino.length - 2];
  // la puerta es perpendicular al último tramo del camino
  const tx = last[0] - prev[0];
  const ty = last[1] - prev[1];
  const tl = Math.hypot(tx, ty) || 1;
  const nx = -ty / tl;
  const ny = tx / tl;
  // camino agrícola por fuera, desde la puerta
  const extPts = a.exterior?.length ? [last, ...a.exterior] : [];
  const ext = extPts.slice(0, -1).map((p, i) => {
    const q = extPts[i + 1];
    return { c: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as [number, number], len: Math.hypot(q[0] - p[0], q[1] - p[1]), ang: Math.atan2(q[1] - p[1], q[0] - p[0]) };
  });
  // vallas móviles por fuera de la malla, a continuación de la pared seca, hacia donde va el camino agrícola
  const sgn = a.exterior && a.exterior.length > 1 ? Math.sign((a.exterior[1][0] - a.exterior[0][0]) * nx + (a.exterior[1][1] - a.exterior[0][1]) * ny) || 1 : 1;
  const d0 = a.anchoEntrada / 2 + 4.3;
  const vallas = Array.from({ length: a.vallasMoviles ?? 0 }, (_, i) => {
    const d = sgn * (d0 + 1.2 + i * 2.4);
    return [last[0] + nx * d + (tx / tl) * 1.0, last[1] + ny * d + (ty / tl) * 1.0] as [number, number];
  });
  const vAng = Math.atan2(-ny, nx);
  // lado (local ±x) en el que la esquina del lindero deja sin sitio para la pared seca
  const sinPared = a.esquina ? (Math.sign((a.esquina[0] - last[0]) * nx + (a.esquina[1] - last[1]) * ny) as -1 | 1) : undefined;
  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.c[0], -0.108, s.c[1]]} rotation={[-Math.PI / 2, 0, -s.ang]} receiveShadow>
          <planeGeometry args={[s.len + a.anchoCamino, a.anchoCamino]} />
          <meshStandardMaterial color="#a8998a" roughness={1} />
        </mesh>
      ))}
      <group position={[last[0], -0.12, last[1]]} rotation={[0, Math.atan2(-ny, nx), 0]}>
        <PuertaFinca ancho={a.anchoEntrada} sinPared={sinPared} />
      </group>
      {ext.map((s, i) => (
        <mesh key={`e${i}`} position={[s.c[0], -0.112, s.c[1]]} rotation={[-Math.PI / 2, 0, -s.ang]} receiveShadow>
          <planeGeometry args={[s.len + 3.5, 3.5]} />
          <meshStandardMaterial color="#b9ab97" roughness={1} />
        </mesh>
      ))}
      {vallas.map((v, i) => (
        <group key={`v${i}`} position={[v[0], -0.12, v[1]]} rotation={[0, vAng, 0]}>
          <VallaMovil />
        </group>
      ))}
    </group>
  );
}

/** Valla metálica móvil (tipo control de público) de 2,4 m: marco de tubo, barrotes y pies. Local: x a lo largo. */
function VallaMovil() {
  const bars = useMemo(() => Array.from({ length: 13 }, (_, i) => -1.08 + i * 0.18), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8cbcc', metalness: 0.6, roughness: 0.35 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group>
      {[-1.15, 1.15].map((x) => <mesh key={x} position={[x, 0.6, 0]} material={mat}><boxGeometry args={[0.04, 1.1, 0.04]} /></mesh>)}
      {[0.15, 1.12].map((y) => <mesh key={y} position={[0, y, 0]} material={mat}><boxGeometry args={[2.3, 0.04, 0.04]} /></mesh>)}
      {bars.map((x) => <mesh key={x} position={[x, 0.63, 0]} material={mat}><boxGeometry args={[0.018, 0.95, 0.018]} /></mesh>)}
      {[-1.0, 1.0].map((x) => <mesh key={`p${x}`} position={[x, 0.03, 0]} material={mat}><boxGeometry args={[0.05, 0.04, 0.7]} /></mesh>)}
    </group>
  );
}

/**
 * Puerta de la finca (referencia de la propiedad): barrera tradicional de dos hojas de madera de acebuche con largueros
 * ondulados y tornapunta en diagonal, entre dos pilares de piedra (marès) y con pared seca a los lados.
 * Coordenadas locales: x a lo largo de la entrada, z hacia el camino.
 */
function PuertaFinca({ ancho, sinPared }: { ancho: number; sinPared?: -1 | 1 }) {
  const parts = useMemo(() => {
    const wood: { p: [number, number, number]; s: [number, number, number]; r: [number, number, number] }[] = [];
    const half = ancho / 2;
    const H = 1.35;
    for (const side of [-1, 1]) {
      const x0 = side * 0.04; // centro (las dos hojas se tocan)
      const x1 = side * (half - 0.04); // bisagra junto al pilar
      // montantes de la hoja
      wood.push({ p: [x0, H / 2 + 0.05, 0], s: [0.08, H + 0.1, 0.08], r: [0, 0, side * 0.02] });
      wood.push({ p: [x1, H / 2 + 0.08, 0], s: [0.09, H + 0.16, 0.09], r: [0, 0, -side * 0.015] });
      // largueros ondulados: tramos cortos con pequeñas ondulaciones, como la madera de acebuche sin escuadrar
      const rails = 8;
      for (let k = 0; k < rails; k++) {
        const y = 0.16 + (k * (H - 0.24)) / (rails - 1);
        const nSeg = 4;
        for (let j = 0; j < nSeg; j++) {
          const u0 = j / nSeg;
          const u1 = (j + 1) / nSeg;
          const wave = (u: number) => Math.sin(u * Math.PI * 2 + k * 1.7) * 0.035 + (k === rails - 1 ? Math.sin(u * Math.PI) * 0.08 : 0);
          const xa = x0 + (x1 - x0) * u0;
          const xb = x0 + (x1 - x0) * u1;
          const ya = y + wave(u0);
          const yb = y + wave(u1);
          const len = Math.hypot(xb - xa, yb - ya);
          wood.push({ p: [(xa + xb) / 2, (ya + yb) / 2, 0.06], s: [len + 0.02, 0.06, 0.035], r: [0, 0, Math.atan2(yb - ya, xb - xa)] });
        }
      }
      // tornapunta en diagonal: del pie junto al centro a lo alto junto a la bisagra
      const bx0 = x0 + side * 0.15;
      const by0 = 0.2;
      const bx1 = x1 - side * 0.15;
      const by1 = H - 0.15;
      wood.push({ p: [(bx0 + bx1) / 2, (by0 + by1) / 2, -0.04], s: [Math.hypot(bx1 - bx0, by1 - by0), 0.07, 0.04], r: [0, 0, Math.atan2(by1 - by0, bx1 - bx0)] });
    }
    return wood;
  }, [ancho]);
  const half = ancho / 2;
  return (
    <group>
      {parts.map((w, i) => (
        <mesh key={i} position={w.p} rotation={w.r} castShadow>
          <boxGeometry args={w.s} />
          <meshStandardMaterial color="#9a8662" roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* pilar de piedra (marès) */}
          <mesh position={[side * (half + 0.35), 0.85, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 1.7, 0.6]} />
            <meshStandardMaterial color="#cbbd9b" roughness={0.95} />
          </mesh>
          {/* pared seca a los lados (no del lado de la esquina del lindero) */}
          {side !== sinPared && (
            <mesh position={[side * (half + 0.7 + 1.6), 0.55, 0]} castShadow receiveShadow>
              <boxGeometry args={[3.2, 1.1, 0.6]} />
              <meshStandardMaterial color="#a39883" roughness={1} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
