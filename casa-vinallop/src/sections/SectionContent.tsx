/** Contenido de las secciones del menú distintas del visor (se cargan bajo demanda). */
import { lazy, Suspense } from 'react';
import type { InstallPoint } from '../instalaciones/types';
import { useInstalaciones } from '../instalaciones/store';
import { useModel } from '../state/derived';
import { useStore, type AppSection } from '../state/store';
import { ProjectPage } from './ProjectPage';
import { ReferencesPage } from './ReferencesPage';

const InstallationsPage = lazy(() => import('../instalaciones/InstallationsPage').then((m) => ({ default: m.InstallationsPage })));
const DecisionsPage = lazy(() => import('../gestion/DecisionsPage').then((m) => ({ default: m.DecisionsPage })));
const PhasesPage = lazy(() => import('../gestion/PhasesPage').then((m) => ({ default: m.PhasesPage })));
const BudgetPage = lazy(() => import('../gestion/BudgetPage').then((m) => ({ default: m.BudgetPage })));

export function SectionContent({ section }: { section: Exclude<AppSection, 'visor'> }) {
  const { layout } = useModel();
  const onLocate = (p: InstallPoint) => {
    const inst = useInstalaciones.getState();
    inst.setLayerVisible(p.layer, true);
    inst.select(p.id);
    const s = useStore.getState();
    if (p.levelId) s.setVisual('levelId', p.levelId);
    s.setVisual('section', 'visor');
    s.setTab('plantas');
  };
  return (
    <div className="section-host">
      <Suspense fallback={<p className="state-center">Cargando…</p>}>
        {section === 'proyecto' && <ProjectPage />}
        {section === 'referencias' && <ReferencesPage />}
        {section === 'instalaciones' && <InstallationsPage layout={layout} onLocate={onLocate} />}
        {section === 'decisiones' && <DecisionsPage />}
        {section === 'fases' && <PhasesPage />}
        {section === 'presupuesto' && <BudgetPage layout={layout} />}
      </Suspense>
    </div>
  );
}
