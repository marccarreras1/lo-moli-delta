/** Economía de la obra: pagos y cuenta con el constructor, presupuesto y situación, en una sola sección con pestañas. */
import { lazy, Suspense } from 'react';
import type { Layout } from '../data/types';
import { useStore, type EconomiaTab } from '../state/store';

const PagosPage = lazy(() => import('./PagosPage').then((m) => ({ default: m.PagosPage })));
const BudgetPage = lazy(() => import('./BudgetPage').then((m) => ({ default: m.BudgetPage })));
const SituacionPage = lazy(() => import('./SituacionPage').then((m) => ({ default: m.SituacionPage })));

const TABS: { id: EconomiaTab; label: string; hint: string }[] = [
  { id: 'cuenta', label: 'Pagos y cuenta', hint: 'debe y haber, pagos, facturas y Excel' },
  { id: 'presupuesto', label: 'Presupuesto', hint: 'partidas, ofertas y documentos' },
  { id: 'situacion', label: 'Situación de obra', hint: 'comprometido, desviación y avance' },
];

export function EconomiaPage({ layout }: { layout: Layout }) {
  const tab = useStore((s) => s.visual.economiaTab);
  const setVisual = useStore((s) => s.setVisual);
  return (
    <div className="eco" data-testid="economia">
      <nav className="eco-tabs" role="tablist" aria-label="Economía de la obra">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setVisual('economiaTab', t.id)} data-eco-tab={t.id} title={t.hint}>
            {t.label}<small>{t.hint}</small>
          </button>
        ))}
      </nav>
      <Suspense fallback={<p className="state-center">Cargando…</p>}>
        {tab === 'cuenta' && <PagosPage />}
        {tab === 'presupuesto' && <BudgetPage layout={layout} />}
        {tab === 'situacion' && <SituacionPage />}
      </Suspense>
    </div>
  );
}
