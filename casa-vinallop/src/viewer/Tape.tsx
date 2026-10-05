/**
 * Cinta métrica 3D: con la herramienta activa, un clic (sin arrastrar) pica un punto sobre la
 * superficie visible del modelo; dos puntos forman una medida con su distancia, la parte
 * horizontal y la vertical. Mayúsculas al picar el segundo punto lo alinea con el eje dominante.
 */
import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { tapeDistance, useTape, type P3 } from './tapeStore';

const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function visibleHit(h: THREE.Intersection): boolean {
  let o: THREE.Object3D | null = h.object;
  while (o) {
    if (!o.visible || o.userData?.helper || o.userData?.tape) return false;
    o = o.parent;
  }
  const m = (h.object as THREE.Mesh).material as THREE.Material | THREE.Material[];
  const mat = Array.isArray(m) ? m[h.face?.materialIndex ?? 0] : m;
  if (!mat || !mat.visible || (mat.transparent && mat.opacity < 0.3)) return false;
  // lo recortado por el plano de corte no se ve: no se puede picar
  return !(mat.clippingPlanes ?? []).some((pl) => pl.distanceToPoint(h.point) < 0);
}

export function TapeMeasure() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const on = useTape((s) => s.on);
  const pts = useTape((s) => s.pts);
  useEffect(() => {
    if (!on) return;
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    let down: [number, number] | null = null;
    const pd = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
    const pu = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      down = null;
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(scene.children, true).find((h) => ((h.object as THREE.Mesh).isMesh) && visibleHit(h));
      if (!hit) return;
      let p: P3 = [hit.point.x, hit.point.y, hit.point.z];
      const { pts: cur, add } = useTape.getState();
      if (e.shiftKey && cur.length % 2 === 1) {
        // alineada con el eje dominante (X, altura o Y de la planta)
        const a = cur[cur.length - 1];
        const d = [p[0] - a[0], p[1] - a[1], p[2] - a[2]].map(Math.abs);
        const k = d.indexOf(Math.max(...d));
        p = a.map((v, i) => (i === k ? p[i] : v)) as P3;
      }
      add(p);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useTape.getState().clear();
      if ((e.key === 'Backspace' || e.key === 'Delete') && !(e.target as HTMLElement)?.closest?.('input, textarea')) useTape.getState().undo();
    };
    el.addEventListener('pointerdown', pd);
    el.addEventListener('pointerup', pu);
    window.addEventListener('keydown', key);
    el.style.cursor = 'crosshair';
    return () => { el.removeEventListener('pointerdown', pd); el.removeEventListener('pointerup', pu); window.removeEventListener('keydown', key); el.style.cursor = ''; };
  }, [on, gl, camera, scene]);
  if (!on || !pts.length) return null;
  const pairs: [P3, P3 | null][] = [];
  for (let i = 0; i < pts.length; i += 2) pairs.push([pts[i], pts[i + 1] ?? null]);
  return (
    <group userData={{ helper: true, tape: true }} renderOrder={999}>
      {pairs.map(([a, b], i) => {
        const m = b ? tapeDistance(a, b) : null;
        return (
          <group key={i}>
            {[a, b].filter(Boolean).map((p, k) => (
              <mesh key={k} position={p as P3} renderOrder={999}>
                <sphereGeometry args={[0.03, 12, 8]} />
                <meshBasicMaterial color="#1d5fa8" depthTest={false} transparent />
              </mesh>
            ))}
            {b && m && (
              <>
                <Line points={[a, b]} color="#1d5fa8" lineWidth={2.5} depthTest={false} transparent renderOrder={999} />
                <Html position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} center zIndexRange={[20, 10]}>
                  <div className="tape-label" data-testid="tape-label">
                    <strong>{fmt(m.d)} m</strong>
                    {m.v > 0.02 && m.h > 0.02 && <small>↔ {fmt(m.h)} · ↕ {fmt(m.v)}</small>}
                  </div>
                </Html>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}
