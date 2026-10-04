/**
 * Paisaje lejano (fotos de dron): naranjal en hileras por detrás y a la izquierda, campo seco a la
 * derecha y sierra azulada en el horizonte. Solo da contexto: posiciones y tamaños aproximados.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** Naranjal visto desde lejos: hileras de copas redondas verde oscuro sobre tierra. */
function orchardTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(31);
  g.fillStyle = '#9c7a5c';
  g.fillRect(0, 0, S, S);
  const row = 32;
  for (let y = row / 2; y < S; y += row)
    for (let x = 8; x < S; x += 15 + r() * 3) {
      const rad = 9 + r() * 3;
      const grd = g.createRadialGradient(x - 3, y - 3, 1, x, y, rad);
      grd.addColorStop(0, '#5f8f3a');
      grd.addColorStop(0.7, '#3d6a26');
      grd.addColorStop(1, 'rgba(40,70,25,0.9)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y + (r() - 0.5) * 2, rad, 0, Math.PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Campo seco: tierra clara con bandas de labor y hierba agostada. */
function fieldTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(37);
  g.fillStyle = '#c7a98a';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const y = r() * S;
    g.fillStyle = `rgba(${170 + r() * 40},${145 + r() * 30},${110 + r() * 25},0.35)`;
    g.fillRect(0, y, S, 2 + r() * 8);
  }
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${150 + r() * 70},${130 + r() * 60},${95 + r() * 40},0.5)`;
    g.fillRect(r() * S, r() * S, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Sierra en el horizonte: dos planos de montañas con bruma (fondo transparente por encima). */
function mountainTexture() {
  const W = 2048;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const r = rng(43);
  const ridge = (base: number, amp: number, color: string, seed: number) => {
    const rr = rng(seed);
    const ph = [rr() * 6, rr() * 6, rr() * 6];
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      const t = (x / W) * Math.PI * 2;
      // la suma de senos se cierra sobre sí misma (el cilindro no tiene costura)
      const h = Math.sin(t * 3 + ph[0]) * 0.45 + Math.sin(t * 7 + ph[1]) * 0.3 + Math.sin(t * 17 + ph[2]) * 0.15 + (rr() - 0.5) * 0.04;
      g.lineTo(x, base - (h * 0.5 + 0.5) * amp);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  };
  ridge(150, 90, 'rgba(150,163,178,0.85)', 3);
  ridge(185, 60, 'rgba(128,140,150,0.9)', 5);
  // franja de arbolado y pueblo lejano al pie
  const grd = g.createLinearGradient(0, 185, 0, H);
  grd.addColorStop(0, 'rgba(105,120,100,0.95)');
  grd.addColorStop(1, 'rgba(90,105,80,1)');
  g.fillStyle = grd;
  g.fillRect(0, 200, W, H - 200);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${70 + r() * 30},${90 + r() * 30},${60 + r() * 20},0.9)`;
    g.beginPath();
    g.arc(r() * W, 200 + r() * 6, 3 + r() * 6, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function Landscape({ cx, cy, grove }: { cx: number; cy: number; grove: number }) {
  const tex = useMemo(() => {
    const o = orchardTexture();
    const f = fieldTexture();
    const m = mountainTexture();
    o.repeat.set(260 / 70, 220 / 70);
    f.repeat.set(260 / 40, 220 / 40);
    return { o, f, m };
  }, []);
  useEffect(() => () => { tex.o.dispose(); tex.f.dispose(); tex.m.dispose(); }, [tex]);
  const back = cy - grove - 2;
  return (
    <group userData={{ helper: true }}>
      {/* naranjal detrás y a la izquierda (frontal A), campo seco detrás a la derecha */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx - 120, -0.14, back - 110]} receiveShadow>
        <planeGeometry args={[260, 220]} />
        <meshStandardMaterial map={tex.o} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx + 140, -0.15, back - 110]} receiveShadow>
        <planeGeometry args={[260, 220]} />
        <meshStandardMaterial map={tex.f} roughness={1} />
      </mesh>
      {/* sierra en el horizonte */}
      <mesh position={[cx, 26, cy]}>
        <cylinderGeometry args={[520, 520, 70, 96, 1, true]} />
        <meshBasicMaterial map={tex.m} transparent side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
