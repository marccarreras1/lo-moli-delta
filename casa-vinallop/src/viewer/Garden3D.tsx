/**
 * Jardín seco en 3D: acolchado de grava, paseos de losas de cemento y matas procedurales de cada
 * especie (planos cruzados con textura pintada y, en lavanda y agapanto, volumen propio).
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GardenSpeciesId, Outdoor } from '../data/types';
import { gardenPlants, pathSlabs } from '../model/garden';
import type { MaterialSet } from './materials';

const TOP = -0.05;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** textura de una mata vista de lado (fondo transparente, base abajo en el centro) */
function plantTexture(kind: GardenSpeciesId): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(kind.length * 977 + kind.charCodeAt(0));
  g.lineCap = 'round';
  const stem = (x0: number, y0: number, x1: number, y1: number, bend: number, col: string, w: number) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1);
    g.stroke();
  };
  const dot = (x: number, y: number, rad: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  };
  const base = S - 2;
  if (kind === 'stipa') {
    // cabellera fina y rubia que se abre y se mece
    for (let i = 0; i < 260; i++) {
      const a = (r() - 0.5) * 1.6;
      const len = S * (0.55 + r() * 0.4);
      const x1 = S / 2 + Math.sin(a) * len * 0.75;
      const y1 = base - Math.cos(a) * len;
      const l = 180 + r() * 50;
      stem(S / 2 + (r() - 0.5) * 20, base, x1, y1, (r() - 0.5) * 60 + a * 30, `rgba(${l + 20},${l},${l * 0.62},0.85)`, 1 + r() * 1.2);
    }
  } else if (kind === 'gaura') {
    // tallos finos rojizos y florecillas blancas y rosadas como mariposas
    for (let i = 0; i < 60; i++) {
      const a = (r() - 0.5) * 1.5;
      const len = S * (0.45 + r() * 0.5);
      const x1 = S / 2 + Math.sin(a) * len * 0.8;
      const y1 = base - Math.cos(a) * len;
      stem(S / 2 + (r() - 0.5) * 16, base, x1, y1, (r() - 0.5) * 30, 'rgba(120,70,60,0.85)', 1.3);
      for (let k = 0; k < 4; k++) {
        const t = 0.55 + k * 0.13;
        dot(S / 2 + (x1 - S / 2) * t + (r() - 0.5) * 8, base + (y1 - base) * t, 3 + r() * 2, r() < 0.75 ? 'rgba(250,246,240,0.95)' : 'rgba(236,190,205,0.95)');
      }
    }
    for (let i = 0; i < 40; i++) stem(S / 2 + (r() - 0.5) * 40, base, S / 2 + (r() - 0.5) * 90, base - S * (0.1 + r() * 0.2), 0, 'rgba(80,110,60,0.9)', 3);
  } else if (kind === 'verbena') {
    // pocos tallos altos y rectos, ramificados arriba, con racimos violeta
    for (let i = 0; i < 9; i++) {
      const x = S / 2 + (r() - 0.5) * 80;
      const top = S * (0.05 + r() * 0.15);
      stem(x, base, x + (r() - 0.5) * 30, top + 30, (r() - 0.5) * 10, 'rgba(85,115,60,0.95)', 2);
      for (let k = 0; k < 3; k++) {
        const cxp = x + (r() - 0.5) * 50;
        const cyp = top + 10 + r() * 30;
        stem(x, top + 40, cxp, cyp, 0, 'rgba(85,115,60,0.95)', 1.5);
        for (let j = 0; j < 7; j++) dot(cxp + (r() - 0.5) * 12, cyp + (r() - 0.5) * 8, 3, `rgba(${125 + r() * 25},${60 + r() * 20},${175 + r() * 30},0.95)`);
      }
    }
  } else if (kind === 'perovskia') {
    // muchos tallos plateados verticales con espigas azul lavanda
    for (let i = 0; i < 70; i++) {
      const x = S / 2 + (r() - 0.5) * 140;
      const top = S * (0.04 + r() * 0.3);
      const bx = S / 2 + (x - S / 2) * 0.4;
      stem(bx, base, x, top, (r() - 0.5) * 12, 'rgba(185,195,192,0.9)', 1.6);
      for (let y = top; y < top + S * 0.3; y += 5) dot(x + ((bx - x) * (y - top)) / (base - top) + (r() - 0.5) * 4, y, 2.2, `rgba(${130 + r() * 25},${135 + r() * 25},${205 + r() * 30},0.95)`);
    }
  } else if (kind === 'lavanda') {
    // espigas cortas sobre la mata
    for (let i = 0; i < 120; i++) {
      const a = (r() - 0.5) * 1.8;
      const len = S * (0.3 + r() * 0.35);
      const x1 = S / 2 + Math.sin(a) * len * 1.1;
      const y1 = base - Math.cos(a) * len;
      stem(S / 2 + (r() - 0.5) * 50, base, x1, y1, (r() - 0.5) * 20, 'rgba(150,165,140,0.9)', 1.3);
      for (let k = 0; k < 6; k++) dot(x1 + Math.sin(a) * k * 2.5, y1 + k * 3, 2.6, `rgba(${110 + r() * 30},${85 + r() * 25},${180 + r() * 30},0.97)`);
    }
  } else {
    // agapanto: hojas en cinta arqueadas
    for (let i = 0; i < 40; i++) {
      const a = (r() - 0.5) * 2.2;
      const len = S * (0.3 + r() * 0.25);
      stem(S / 2 + (r() - 0.5) * 10, base, S / 2 + Math.sin(a) * len * 1.2, base - Math.cos(a) * len * 0.6, a * 40, `rgba(${55 + r() * 20},${100 + r() * 30},${50 + r() * 15},0.95)`, 5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** tres planos cruzados con la base en el suelo */
function crossGeometry(w: number, h: number): THREE.BufferGeometry {
  const planes = [0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0).rotateY(a));
  const g = mergeGeometries(planes)!;
  planes.forEach((p) => p.dispose());
  return g;
}

export function Garden3D({ garden, mats }: { garden: NonNullable<Outdoor['garden']>; mats: MaterialSet }) {
  const plants = useMemo(() => gardenPlants(garden), [garden]);
  const slabs = useMemo(() => garden.paths.flatMap((p) => pathSlabs(p)), [garden]);
  const built = useMemo(() => {
    const o3 = new THREE.Object3D();
    const sets = garden.species.map((sp) => {
      const list = plants.filter((p) => p.s === sp.id);
      const tex = plantTexture(sp.id);
      const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
      const geo = crossGeometry(sp.d * 1.15, sp.h);
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
      list.forEach((p, i) => {
        o3.position.set(p.x, TOP, p.y);
        o3.rotation.set(0, p.rot, 0);
        o3.scale.set(p.k, p.k * (0.9 + (p.rot % 0.3)), p.k);
        o3.updateMatrix();
        m.setMatrixAt(i, o3.matrix);
      });
      m.count = list.length;
      m.receiveShadow = true;
      const extra: THREE.InstancedMesh[] = [];
      if (sp.id === 'lavanda') {
        // mata redondeada gris verdosa bajo las espigas
        const mound = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8e9a80', roughness: 1 }), Math.max(1, list.length));
        list.forEach((p, i) => {
          o3.position.set(p.x, TOP, p.y);
          o3.rotation.set(0, p.rot, 0);
          o3.scale.set(sp.d * 0.95 * p.k, sp.h * 0.6 * p.k, sp.d * 0.95 * p.k);
          o3.updateMatrix();
          mound.setMatrixAt(i, o3.matrix);
        });
        mound.count = list.length;
        mound.castShadow = mound.receiveShadow = true;
        extra.push(mound);
      }
      if (sp.id === 'agapanto') {
        // varas con la umbela azul
        const r = rng(7);
        const balls: THREE.Matrix4[] = [];
        const stalks: THREE.Matrix4[] = [];
        list.forEach((p) => {
          for (let k = 0; k < 3; k++) {
            const a = p.rot + k * 2.1;
            const dx = Math.cos(a) * 0.12;
            const dz = Math.sin(a) * 0.12;
            const hh = (0.6 + r() * 0.3) * p.k;
            o3.position.set(p.x + dx, TOP + hh, p.y + dz);
            o3.rotation.set(0, 0, 0);
            o3.scale.setScalar(0.06 * p.k);
            o3.updateMatrix();
            balls.push(o3.matrix.clone());
            o3.position.set(p.x + dx / 2, TOP + hh / 2, p.y + dz / 2);
            o3.scale.set(1, hh, 1);
            o3.updateMatrix();
            stalks.push(o3.matrix.clone());
          }
        });
        const ball = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#6a86df', roughness: 0.8 }), Math.max(1, balls.length));
        balls.forEach((mm, i) => ball.setMatrixAt(i, mm));
        ball.count = balls.length;
        ball.castShadow = true;
        const stalk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.008, 1, 5), new THREE.MeshStandardMaterial({ color: '#6c8a4c', roughness: 1 }), Math.max(1, stalks.length));
        stalks.forEach((mm, i) => stalk.setMatrixAt(i, mm));
        stalk.count = stalks.length;
        extra.push(ball, stalk);
      }
      return { m, extra, tex };
    });
    // losas de cemento de los paseos
    const slab = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.05, 1), mats.concrete, Math.max(1, slabs.length));
    slabs.forEach((s, i) => {
      o3.position.set(s.x, TOP - 0.015, s.y);
      o3.rotation.set(0, s.rot, 0);
      o3.scale.set(s.w, 1, s.d);
      o3.updateMatrix();
      slab.setMatrixAt(i, o3.matrix);
    });
    slab.count = slabs.length;
    slab.receiveShadow = true;
    slab.castShadow = true;
    return { sets, slab };
  }, [garden, plants, slabs, mats.concrete]);
  useEffect(() => () => {
    for (const s of built.sets) {
      s.tex.dispose();
      for (const m of [s.m, ...s.extra]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    }
    built.slab.geometry.dispose();
  }, [built]);
  const [x0, y0, x1, y1] = garden.rect;
  return (
    <group>
      {/* acolchado de grava sobre tierra drenante */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, TOP - 0.035, (y0 + y1) / 2]} material={mats.gravel} receiveShadow>
        <planeGeometry args={[x1 - x0, y1 - y0]} />
      </mesh>
      <primitive object={built.slab} />
      {built.sets.map((s, i) => (
        <group key={i}>
          <primitive object={s.m} />
          {s.extra.map((e, k) => <primitive key={k} object={e} />)}
        </group>
      ))}
    </group>
  );
}
