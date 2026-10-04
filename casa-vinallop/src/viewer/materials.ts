/**
 * Materiales del visor (PBR de Three.js: MeshStandard/MeshPhysical). Las texturas son
 * procedurales (src/viewer/textures.ts) y se tiñen con el acabado elegido.
 *
 * Modos: «atenuado» vuelve translúcida la arquitectura; «corte» la secciona en horizontal;
 * `section` aplica el corte longitudinal (plano vertical a lo largo de la casa) a todo.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { finish } from '../data/acabados';
import type { FinishSelection } from '../data/types';
import type { DisplayMode } from '../state/store';
import { fabricTex, gravelTex, mineralTex, plasterTex, rugTex, type TexturePair, vertTileTex, voltaTex, woodTex } from './textures';

export interface MaterialSet {
  facade: THREE.MeshStandardMaterial;
  interior: THREE.MeshStandardMaterial;
  cut: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  floorSelected: THREE.MeshStandardMaterial;
  selection: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  /** bovedilla cerámica de la volta catalana */
  vault: THREE.MeshStandardMaterial;
  carpentry: THREE.MeshStandardMaterial;
  /** hoja de madera natural (puerta de tablones) */
  carpentryWood: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  wood: THREE.MeshStandardMaterial;
  /** madera de estructura (fondos de juntas, travesaños) */
  woodBeam: THREE.MeshStandardMaterial;
  /** vigas vistas de la volta catalana: color cemento gris natural mate (confirmado por la propiedad) */
  beam: THREE.MeshStandardMaterial;
  textile: THREE.MeshStandardMaterial;
  textileLight: THREE.MeshStandardMaterial;
  rug: THREE.MeshStandardMaterial;
  ceramic: THREE.MeshStandardMaterial;
  counter: THREE.MeshStandardMaterial;
  /** piezas estrechas de terracota (isla, franja del baño) */
  terracottaTile: THREE.MeshStandardMaterial;
  /** celosía cerámica */
  lattice: THREE.MeshStandardMaterial;
  /** barro de lámparas y macetas (alternativa A, tonos de barro) */
  clay: THREE.MeshStandardMaterial;
  /** terracota clara (alternativa B) */
  clayLight: THREE.MeshStandardMaterial;
  /** interior iluminado de las pantallas */
  lampGlow: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  blackMetal: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  mirror: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  gravel: THREE.MeshStandardMaterial;
  plant: THREE.MeshStandardMaterial;
  slab: THREE.MeshStandardMaterial;
  floorSlab: THREE.MeshStandardMaterial;
  stair: THREE.MeshStandardMaterial;
  poche: THREE.MeshBasicMaterial;
}

/** posición del plano del corte longitudinal (eje de la casa) */
export const SECTION_Y = 2.35;

export function useMaterials(sel: FinishSelection, mode: DisplayMode, sectionHeight: number, section = false, lampLevel = 0): MaterialSet {
  const clipH = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), sectionHeight), [sectionHeight]);
  const clipV = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), -SECTION_Y), []);
  const set = useMemo(() => {
    const ghost = mode === 'atenuado';
    const building: THREE.Plane[] = [...(mode === 'corte' ? [clipH] : []), ...(section ? [clipV] : [])];
    const all: THREE.Plane[] = section ? [clipV] : [];
    const cutting = mode === 'corte' || section;
    const tex = (t: TexturePair | null, bumpScale: number) => (t ? { map: t.map, bumpMap: t.bump, bumpScale } : {});
    const std = (color: string, roughness: number, opts: THREE.MeshStandardMaterialParameters = {}, isBuilding = false) =>
      new THREE.MeshStandardMaterial({
        color, roughness, metalness: 0,
        ...(isBuilding && ghost ? { transparent: true, opacity: 0.16, depthWrite: false } : {}),
        clippingPlanes: isBuilding ? building : all,
        clipShadows: true,
        ...(isBuilding && cutting ? { side: THREE.DoubleSide } : {}),
        ...opts,
      });
    const f = (slot: keyof FinishSelection) => finish(slot, sel[slot]);
    const plaster = plasterTex();
    const wood = woodTex();
    const floorTex = mineralTex('suelo', 0.6, 3);
    const counterTex = mineralTex('encimera', 1, 7);
    const concreteTex = mineralTex('solera', 1.4, 13);
    return {
      facade: std(f('fachada').color, f('fachada').roughness, tex(plaster, 0.004), true),
      interior: std(f('paredes').color, 0.95, tex(plaster, 0.003), true),
      cut: std('#d9d3c7', 0.95, {}, true),
      floor: std(f('suelo').color, f('suelo').roughness, tex(floorTex, 0.002)),
      floorSelected: std('#cfdcc4', 0.8, { emissive: new THREE.Color('#68765e'), emissiveIntensity: 0.18 }),
      selection: std('#68765e', 0.5, { emissive: new THREE.Color('#68765e'), emissiveIntensity: 0.35 }, true),
      roof: std(f('cubierta').color, f('cubierta').roughness, tex(plaster, 0.004), true),
      ceiling: std(f('paredes').color, 0.95, { side: THREE.DoubleSide, ...tex(plaster, 0.003) }, true),
      vault: std(f('boveda').color, f('boveda').roughness, { side: THREE.DoubleSide, ...tex(voltaTex(), 0.012) }, true),
      carpentry: std(f('carpinteria').color, f('carpinteria').roughness, {}, true),
      carpentryWood: std('#b48a5e', 0.62, tex(wood, 0.006), true),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#e8f0f0', roughness: 0.04, metalness: 0, transparent: true, opacity: ghost ? 0.08 : 0.16, depthWrite: false,
        side: THREE.DoubleSide, clippingPlanes: building, envMapIntensity: 1.4, reflectivity: 0.6,
      }),
      wood: std(f('madera').color, f('madera').roughness, tex(wood, 0.004)),
      woodBeam: std('#b08a62', 0.7, tex(wood, 0.006), true),
      beam: std(f('vigas').color, f('vigas').roughness, tex(concreteTex, 0.004), true),
      textile: std(f('textiles').color, 1, tex(fabricTex(), 0.002)),
      textileLight: std('#f3efe6', 1, tex(fabricTex(), 0.002)),
      rug: std('#d8c39f', 1, tex(rugTex(), 0.006)),
      ceramic: std('#f7f6f2', 0.22, { envMapIntensity: 0.9 }),
      counter: std(f('encimera').color, f('encimera').roughness, tex(counterTex, 0.0015)),
      terracottaTile: std('#c07a55', 0.82, tex(vertTileTex(), 0.004)),
      lattice: std('#bb7552', 0.88, {}),
      clay: std('#a8674a', 0.86, { side: THREE.DoubleSide }),
      clayLight: std('#d39a77', 0.84, { side: THREE.DoubleSide }),
      lampGlow: std('#fff1dc', 0.7, { emissive: new THREE.Color('#ffb46b'), emissiveIntensity: 0.2, side: THREE.DoubleSide }),
      metal: std('#bdbab3', 0.35, { metalness: 0.6 }),
      blackMetal: std('#232220', 0.48, { metalness: 0.55 }),
      brass: std('#b98d4c', 0.32, { metalness: 1 }),
      mirror: std('#f2f5f6', 0.03, { metalness: 1, envMapIntensity: 2.6 }),
      concrete: std('#ddd7cb', 0.92, tex(concreteTex, 0.003)),
      gravel: std('#d7ccbb', 1, tex(gravelTex(), 0.01)),
      plant: std('#6f7f52', 0.9, { flatShading: true }),
      slab: std('#cfc8bb', 1),
      floorSlab: std('#e2ddd2', 0.95, tex(plaster, 0.002), true),
      stair: std(new THREE.Color(f('paredes').color).multiplyScalar(0.9).getStyle(), 0.93, tex(plaster, 0.003), true),
      poche: new THREE.MeshBasicMaterial({ color: '#3a3833' }),
    };
  }, [sel, mode, clipH, clipV, section]);
  // las lámparas se regulan sin recrear materiales
  useEffect(() => {
    set.lampGlow.emissiveIntensity = 0.15 + Math.max(0, Math.min(1, lampLevel)) * 2.4;
  }, [set, lampLevel]);
  // libera los materiales sustituidos (las texturas se comparten y se conservan)
  useEffect(() => () => Object.values(set).forEach((m) => m.dispose()), [set]);
  return set;
}
