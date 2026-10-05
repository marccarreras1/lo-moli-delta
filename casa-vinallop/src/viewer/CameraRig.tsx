import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CameraPreset, Layout } from '../data/types';
import { defaultPreset } from '../model/cameras';
import { bbox, pointInPolygon } from '../model/geometry';
import type { CameraState, ViewTab } from '../state/store';
import { freeSpotIn, walkObstacles, walkStep } from '../model/walk';
import { walkInput } from './walkInput';

interface Props {
  presets: CameraPreset[];
  request: { id: string; nonce: number; instant?: boolean };
  tab: ViewTab;
  eyeHeight: number;
  interiorFov: number;
  layout: Layout;
  saved: CameraState | undefined;
  insets: { bottom: number; right: number };
  onSave: (tab: ViewTab, c: CameraState) => void;
  onEnterRoom: (roomId: string) => void;
  /** se avisa al aplicar una vista (para activar el corte o quitar la cubierta si la vista lo pide) */
  onPreset?: (p: CameraPreset) => void;
}

const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const toScene = ([x, y, h]: [number, number, number]) => new THREE.Vector3(x, h, y);
const EXT_FOV = 35;

const defaultFor = defaultPreset;

export function CameraRig({ presets, request, tab, eyeHeight, interiorFov, layout, saved, insets, onSave, onEnterRoom, onPreset }: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const anim = useRef<{ fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; fromF: number; toF: number; t: number; dur: number; lookAhead: boolean } | null>(null);
  const roomRef = useRef<string | null>(null);
  const moving = useRef(false);
  const limits = useRef({ min: 3, max: 60 });
  const { minX, minY, maxX, maxY } = layout.bounds;
  const R = Math.max(maxX - minX, maxY - minY, 4);

  // mantener el modelo centrado en la zona visible cuando un panel tapa parte del visor
  useEffect(() => {
    if (insets.bottom > 0 || insets.right > 0) camera.setViewOffset(size.width, size.height, insets.right / 2, insets.bottom / 2, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [insets.bottom, insets.right, size.width, size.height, camera]);

  /** Distancia para que el edificio quepa entero en la zona visible (según el campo visual horizontal y vertical). */
  const framed = (pos: THREE.Vector3, target: THREE.Vector3, fov: number, exact = false) => {
    const H = layout.topHeight;
    const radius = Math.hypot(maxX - minX, maxY - minY, H + 2) / 2;
    const w = Math.max(1, size.width - insets.right);
    const h = Math.max(1, size.height - insets.bottom);
    const v = (fov * Math.PI) / 180;
    const hz = 2 * Math.atan(Math.tan(v / 2) * (w / h));
    const need = (radius * 1.2) / Math.sin(Math.min(v, hz) / 2);
    const dir = pos.clone().sub(target);
    const cur = dir.length();
    return target.clone().add(dir.normalize().multiplyScalar(exact ? need : Math.max(cur * 0.85, need)));
  };

  const go = (pos: THREE.Vector3, target: THREE.Vector3, fov: number, instant: boolean, lookAhead: boolean) => {
    const c = controls.current;
    if (!c) return;
    // en interiores el objetivo es un punto cercano en la dirección de la mirada
    const toT = lookAhead ? pos.clone().add(target.clone().sub(pos).normalize().multiplyScalar(0.6)) : target;
    // sin límites de distancia mientras dura la transición (si no, arrastran la cámara)
    c.minDistance = 0;
    c.maxDistance = Infinity;
    anim.current = { fromP: camera.position.clone(), toP: pos, fromT: c.target.clone(), toT, fromF: camera.fov, toF: fov, t: 0, dur: instant || reduceMotion ? 0 : 0.5, lookAhead };
  };

  // en interiores, la vista cenital 3D usa la órbita de exterior (desplazar y acercar) en lugar de la de a pie
  const [overview, setOverview] = useState(false);
  useEffect(() => { if (tab !== 'interior') setOverview(false); }, [tab]);
  useEffect(() => {
    const c = controls.current;
    if (!c || presets.length === 0) return;
    const id = request.id;
    const instant = !!request.instant;
    if (id === 'memoria' && saved) {
      // una cámara guardada muy por encima del suelo es la vista cenital
      setOverview(tab === 'interior' && saved.position[1] > 4.5);
      go(new THREE.Vector3(...saved.position), new THREE.Vector3(...saved.target), saved.fov, instant, false);
      return;
    }
    if (tab === 'interior' && (id.startsWith('walk:') || id.startsWith('paso:'))) setOverview(false);
    if (id.startsWith('paso:')) {
      // desplazamiento controlado en interiores: solo si se queda dentro de la estancia
      const dir = c.target.clone().sub(camera.position).setY(0).normalize().multiplyScalar(0.5 * Number(id.slice(5)));
      const next = camera.position.clone().add(dir);
      const room = layout.rooms.find((r) => r.id === roomRef.current);
      if (!room) return;
      const b = bbox(room.polygon);
      const inside = pointInPolygon([next.x, next.z], room.polygon) && next.x > b.minX + 0.25 && next.x < b.maxX - 0.25 && next.z > b.minY + 0.25 && next.z < b.maxY - 0.25;
      if (inside) go(next, c.target.clone().add(dir), camera.fov, false, false);
      return;
    }
    if (id.startsWith('walk:')) {
      // atajo de habitación del recorrido: punto libre de la estancia, a la altura de los ojos
      const r = layout.rooms.find((x) => x.id === id.slice(5));
      const spot = r && freeSpotIn(layout, r.id);
      if (!r || !spot) return;
      const el = layout.levels.find((l) => l.id === r.levelId)?.elevation ?? 0;
      const b = bbox(r.polygon);
      const along = b.maxX - b.minX >= b.maxY - b.minY;
      const tgt = along ? new THREE.Vector3(spot[0] < (b.minX + b.maxX) / 2 ? b.maxX : b.minX, el + eyeHeight - 0.15, spot[1]) : new THREE.Vector3(spot[0], el + eyeHeight - 0.15, spot[1] < (b.minY + b.maxY) / 2 ? b.maxY : b.minY);
      go(new THREE.Vector3(spot[0], el + eyeHeight, spot[1]), tgt, interiorFov, instant, true);
      return;
    }
    if (id === 'encajar') {
      const center = new THREE.Vector3((minX + maxX) / 2, tab === 'plantas' ? 0 : 1, (minY + maxY) / 2);
      const dir = camera.position.clone().sub(c.target).normalize();
      if (tab === 'plantas') dir.set(0, 1, 0.0001).normalize();
      go(framed(center.clone().add(dir.multiplyScalar(10)), center, tab === 'interior' ? EXT_FOV : camera.fov, true), center, tab === 'interior' ? EXT_FOV : camera.fov, instant, false);
      return;
    }
    if (id.startsWith('room:')) {
      const r = layout.rooms.find((x) => x.id === id.slice(5));
      if (!r) return;
      const b = bbox(r.polygon);
      const t = new THREE.Vector3((b.minX + b.maxX) / 2, layout.levels.find((l) => l.id === r.levelId)?.elevation ?? 0, (b.minY + b.maxY) / 2);
      if (tab === 'plantas') go(new THREE.Vector3(t.x, t.y + R * 0.9, t.z + 0.001), t, EXT_FOV, instant, false);
      else go(new THREE.Vector3(t.x, t.y + 8, t.z + 7), t, EXT_FOV, instant, false);
      return;
    }
    const p = id === 'inicio' ? defaultFor(tab, presets) : presets.find((x) => x.id === id);
    if (!p) return;
    const pos = toScene(p.position);
    const target = toScene(p.target);
    if (p.eyeLevel) {
      // la altura de ojos se mide desde el suelo del nivel de la estancia
      const base = p.elevation ?? 0;
      const dz = eyeHeight - pos.y;
      pos.y = base + eyeHeight;
      target.y += base + dz * 0.5;
    }
    const fov = p.fov ?? (p.group === 'interior' ? interiorFov : EXT_FOV);
    if ((p.group === 'exterior' || p.group === 'planta') && !p.fixed) pos.copy(framed(pos, target, fov));
    if (p.fixed && p.group === 'exterior') {
      // las vistas fijas se compusieron en apaisado: en pantallas estrechas la cámara se aleja
      const asp = Math.max(1, size.width - insets.right) / Math.max(1, size.height - insets.bottom);
      if (asp < 1.5) pos.copy(target.clone().add(pos.clone().sub(target).multiplyScalar(Math.min(2.4, 1.5 / asp))));
    }
    if (p.roomId) {
      roomRef.current = p.roomId;
      onEnterRoom(p.roomId);
    } else roomRef.current = null;
    if (id !== 'inicio' || p.fixed) onPreset?.(p);
    if (tab === 'interior') setOverview(!!p.topDown);
    go(pos, target, fov, instant, p.group === 'interior' && !p.topDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.nonce, presets.length]);

  // altura de ojos y campo visual editables en interiores
  const lastEye = useRef(eyeHeight);
  useEffect(() => {
    const c = controls.current;
    if (c && tab === 'interior' && !anim.current) {
      const d = eyeHeight - lastEye.current;
      camera.position.y += d;
      c.target.y += d;
      c.update();
    }
    lastEye.current = eyeHeight;
  }, [eyeHeight, camera, tab]);
  useEffect(() => {
    if (tab === 'interior') {
      camera.fov = interiorFov;
      camera.updateProjectionMatrix();
    }
  }, [interiorFov, camera, tab]);

  const save = () => {
    const c = controls.current;
    if (!c) return;
    onSave(tab, { position: camera.position.toArray() as [number, number, number], target: c.target.toArray() as [number, number, number], fov: camera.fov });
  };

  // recorrido a pie: obstáculos del nivel en el que están los ojos
  const levelAt = (y: number) => layout.levels.reduce((best, l) => (Math.abs(y - eyeHeight - l.elevation) < Math.abs(y - eyeHeight - best.elevation) ? l : best), layout.levels[0]);
  const obstacles = useMemo(() => new Map(layout.levels.map((l) => [l.id, walkObstacles(layout, l.id)])), [layout]);
  useEffect(() => {
    if (tab !== 'interior') return;
    const keys: Record<string, [keyof typeof walkInput, number]> = {
      ArrowUp: ['fwd', 1], KeyW: ['fwd', 1], ArrowDown: ['fwd', -1], KeyS: ['fwd', -1],
      KeyA: ['side', -1], KeyD: ['side', 1], ArrowLeft: ['turn', 1], ArrowRight: ['turn', -1], KeyQ: ['turn', 1], KeyE: ['turn', -1],
    };
    const on = (e: KeyboardEvent, down: boolean) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      const k = keys[e.code];
      if (!k) return;
      e.preventDefault();
      walkInput[k[0]] = down ? k[1] : 0;
    };
    const kd = (e: KeyboardEvent) => on(e, true);
    const ku = (e: KeyboardEvent) => on(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); walkInput.fwd = walkInput.side = walkInput.turn = 0; };
  }, [tab]);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a && c && tab === 'interior' && (walkInput.fwd || walkInput.side || walkInput.turn)) {
      const step = Math.min(dt, 0.05);
      const lvl = levelAt(camera.position.y);
      const look = c.target.clone().sub(camera.position);
      if (walkInput.turn) look.applyAxisAngle(new THREE.Vector3(0, 1, 0), walkInput.turn * 1.5 * step);
      const fwd = look.clone().setY(0).normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const mv = fwd.multiplyScalar(walkInput.fwd).add(right.multiplyScalar(walkInput.side)).multiplyScalar(1.3 * step);
      const o = obstacles.get(lvl.id);
      const next = o ? walkStep([camera.position.x, camera.position.z], [mv.x, mv.z], o) : [camera.position.x + mv.x, camera.position.z + mv.z];
      camera.position.set(next[0], lvl.elevation + eyeHeight, next[1]);
      c.target.copy(camera.position).add(look);
      c.update();
      moving.current = true;
      return;
    }
    if (moving.current) { moving.current = false; save(); }
    if (!a || !c) return;
    a.t = a.dur === 0 ? 1 : Math.min(1, a.t + dt / a.dur);
    const e = 1 - (1 - a.t) ** 3;
    camera.position.lerpVectors(a.fromP, a.toP, e);
    c.target.lerpVectors(a.fromT, a.toT, e);
    camera.fov = a.fromF + (a.toF - a.fromF) * e;
    camera.updateProjectionMatrix();
    c.update();
    if (a.t >= 1) {
      anim.current = null;
      c.minDistance = limits.current.min;
      c.maxDistance = limits.current.max;
      save();
    }
  });

  // límites: el centro de giro no se aleja del edificio
  const clampTarget = () => {
    const c = controls.current;
    if (!c || interior) return;
    const m = R * 0.6;
    c.target.x = THREE.MathUtils.clamp(c.target.x, minX - m, maxX + m);
    c.target.z = THREE.MathUtils.clamp(c.target.z, minY - m, maxY + m);
    c.target.y = THREE.MathUtils.clamp(c.target.y, 0, layout.topHeight);
  };

  const interior = tab === 'interior' && !overview;
  const plan = tab === 'plantas';
  limits.current = { min: interior ? 0.3 : 3, max: interior ? 1 : R * 4.5 };
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={!reduceMotion}
      dampingFactor={0.12}
      enableRotate={!plan}
      enablePan={!interior}
      enableZoom={!interior}
      minDistance={anim.current ? 0 : limits.current.min}
      maxDistance={anim.current ? Infinity : limits.current.max}
      minPolarAngle={plan ? 0 : interior ? 0.25 : 0.05}
      maxPolarAngle={plan ? 0.0001 : interior ? Math.PI - 0.35 : Math.PI / 2 - 0.04}
      rotateSpeed={interior ? -0.35 : 0.7}
      screenSpacePanning
      touches={{ ONE: plan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      mouseButtons={{ LEFT: plan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      onStart={() => {
        if (!anim.current) return;
        anim.current = null;
        const c = controls.current;
        if (c) { c.minDistance = limits.current.min; c.maxDistance = limits.current.max; }
      }}
      onChange={clampTarget}
      onEnd={save}
    />
  );
}
