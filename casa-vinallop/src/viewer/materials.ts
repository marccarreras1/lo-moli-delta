import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { finish } from '../data/acabados';
import type { FinishSelection } from '../data/types';
import type { DisplayMode } from '../state/store';

let noiseTex: THREE.CanvasTexture | null = null;
/** Textura de grano procedural (revoco / pavimento), generada localmente. */
function noise(): THREE.Texture | null {
  if (noiseTex) return noiseTex;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 236 + Math.floor(rnd() * 20);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTex = new THREE.CanvasTexture(c);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.repeat.set(2, 2);
  noiseTex.colorSpace = THREE.SRGBColorSpace;
  return noiseTex;
}

export interface MaterialSet {
  facade: THREE.MeshStandardMaterial;
  interior: THREE.MeshStandardMaterial;
  cut: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  floorSelected: THREE.MeshStandardMaterial;
  selection: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  carpentry: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  textile: THREE.MeshStandardMaterial;
  textileLight: THREE.MeshStandardMaterial;
  ceramic: THREE.MeshStandardMaterial;
  counter: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  slab: THREE.MeshStandardMaterial;
  floorSlab: THREE.MeshStandardMaterial;
  stair: THREE.MeshStandardMaterial;
  poche: THREE.MeshBasicMaterial;
}

export function useMaterials(sel: FinishSelection, mode: DisplayMode, sectionHeight: number): MaterialSet {
  const clip = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, -1, 0), sectionHeight)], [sectionHeight]);
  const set = useMemo(() => {
    const tex = noise();
    const ghost = mode === 'atenuado';
    const clipping = mode === 'corte' ? clip : [];
    const std = (color: string, roughness: number, opts: THREE.MeshStandardMaterialParameters = {}, building = false) =>
      new THREE.MeshStandardMaterial({
        color, roughness, metalness: 0,
        ...(building && ghost ? { transparent: true, opacity: 0.16, depthWrite: false } : {}),
        ...(building ? { clippingPlanes: clipping, clipShadows: true, side: mode === 'corte' ? THREE.DoubleSide : THREE.FrontSide } : {}),
        ...opts,
      });
    const f = (slot: keyof FinishSelection) => finish(slot, sel[slot]);
    return {
      facade: std(f('fachada').color, f('fachada').roughness, { map: tex }, true),
      interior: std(f('paredes').color, 0.95, {}, true),
      cut: std('#d9d3c7', 0.95, {}, true),
      floor: std(f('suelo').color, f('suelo').roughness, { map: tex }),
      floorSelected: std('#cfdcc4', 0.8, { emissive: new THREE.Color('#68765e'), emissiveIntensity: 0.18 }),
      selection: std('#68765e', 0.5, { emissive: new THREE.Color('#68765e'), emissiveIntensity: 0.35 }, true),
      roof: std(f('cubierta').color, f('cubierta').roughness, {}, true),
      ceiling: std(f('paredes').color, 0.95, { side: THREE.DoubleSide }, true),
      carpentry: std(f('carpinteria').color, f('carpinteria').roughness, {}, true),
      glass: new THREE.MeshStandardMaterial({
        color: '#cfdde0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: ghost ? 0.08 : 0.28, depthWrite: false,
        side: THREE.DoubleSide, clippingPlanes: clipping,
      }),
      wood: std(f('madera').color, f('madera').roughness),
      textile: std(f('textiles').color, 1),
      textileLight: std('#f2eee6', 1),
      ceramic: std('#f7f7f4', 0.25),
      counter: std('#e8e2d6', 0.5),
      metal: std('#bdbab3', 0.35, { metalness: 0.6 }),
      slab: std('#cfc8bb', 1),
      floorSlab: std('#e2ddd2', 0.95, {}, true),
      stair: std(f('madera').color, 0.7, {}, true),
      poche: new THREE.MeshBasicMaterial({ color: '#3a3833' }),
    };
  }, [sel, mode, clip]);
  // libera los materiales sustituidos para no acumular recursos gráficos
  useEffect(() => () => Object.values(set).forEach((m) => m.dispose()), [set]);
  return set;
}
