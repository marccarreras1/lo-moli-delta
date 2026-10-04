import { useMemo } from 'react';
import { buildTestModel } from '../data/modeloPrueba';
import { VINALLOP } from '../data/vinallop';
import { VINALLOP_ACTUAL } from '../data/vinallopActual';
import { cameraPresets } from '../model/cameras';
import { hasGeometry, resolveLayout } from '../model/resolve';
import { validateLayout } from '../model/validate';
import { activeDesign, BASE_ID, useStore } from './store';

const TEST = buildTestModel();

/** Proyecto resuelto con la variante activa: única fuente para planta, 3D, superficies y selección. */
export function useModel() {
  const source = useStore((s) => s.visual.modelSource);
  const designs = useStore((s) => s.designs);
  const project = source === 'prueba' ? TEST : source === 'actual' ? VINALLOP_ACTUAL : VINALLOP;
  const d = activeDesign({ designs, visual: { modelSource: source } as never });
  const variant = d.activeId === BASE_ID ? d.base : d.variants.find((v) => v.id === d.activeId) ?? d.base;
  const isBase = variant.id === BASE_ID;
  const layout = useMemo(() => resolveLayout(project, variant), [project, variant]);
  const issues = useMemo(() => validateLayout(layout), [layout]);
  const cameras = useMemo(() => cameraPresets(layout), [layout]);
  return { project, layout, issues, variant, isBase, cameras, design: d, empty: !hasGeometry(project) };
}
