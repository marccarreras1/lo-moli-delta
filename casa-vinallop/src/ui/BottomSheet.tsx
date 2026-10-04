import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { SheetState } from '../state/store';
import { Icon } from './icons';

/**
 * Panel inferior para móvil con tres posiciones: cerrado, parcial y ampliado.
 * Arrastrar el asa o desplazar su contenido nunca llega al visor 3D.
 */
export function BottomSheet({ children, onHeight, onSide }: { children: ReactNode; onHeight: (px: number) => void; onSide: (px: number) => void }) {
  const [state, setState] = useState<SheetState>('cerrado');
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number } | null>(null);
  const [vh, setVh] = useState(() => window.innerHeight);
  useEffect(() => {
    const f = () => setVh(window.visualViewport?.height ?? window.innerHeight);
    window.addEventListener('resize', f);
    window.visualViewport?.addEventListener('resize', f);
    return () => {
      window.removeEventListener('resize', f);
      window.visualViewport?.removeEventListener('resize', f);
    };
  }, []);
  const [landscape, setLandscape] = useState(() => window.innerWidth > window.innerHeight);
  useEffect(() => {
    const f = () => setLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const heights: Record<SheetState, number> = {
    cerrado: 60,
    parcial: Math.round(Math.min(vh * (landscape ? 0.55 : 0.4), 380)),
    ampliado: Math.round(vh * (landscape ? 0.85 : 0.82)),
  };
  const h = drag ?? heights[state];
  // en horizontal el panel se abre a un lado y no tapa la parte inferior del visor
  useEffect(() => {
    onHeight(landscape ? 0 : drag === null ? heights[state] : heights.cerrado);
    onSide(landscape && state !== 'cerrado' ? Math.min(380, window.innerWidth * 0.48) : 0);
  }, [state, drag === null, vh, landscape]); // eslint-disable-line react-hooks/exhaustive-deps

  const snap = (px: number) => {
    const order: SheetState[] = ['cerrado', 'parcial', 'ampliado'];
    let best: SheetState = 'cerrado';
    for (const k of order) if (Math.abs(heights[k] - px) < Math.abs(heights[best] - px)) best = k;
    setState(best);
  };
  const cycle = () => setState(landscape ? (state === 'cerrado' ? 'ampliado' : 'cerrado') : state === 'cerrado' ? 'parcial' : state === 'parcial' ? 'ampliado' : 'cerrado');

  return (
    <section className={`sheet sheet-${state}${landscape ? ' side' : ''}`} style={landscape ? undefined : { height: h }} aria-label="Controles" data-testid="bottom-sheet" data-state={state}>
      <div
        className="sheet-handle"
        onPointerDown={(e) => { e.stopPropagation(); if ((e.target as HTMLElement).closest('button')) return; e.currentTarget.setPointerCapture(e.pointerId); start.current = { y: e.clientY, h }; }}
        onPointerMove={(e) => {
          if (!start.current) return;
          e.stopPropagation();
          const nh = Math.max(heights.cerrado, Math.min(heights.ampliado, start.current.h + (start.current.y - e.clientY)));
          if (Math.abs(nh - start.current.h) > 4) setDrag(nh);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (!start.current) return;
          const moved = drag !== null;
          if (moved) snap(drag);
          else cycle();
          setDrag(null);
          start.current = null;
        }}
        onPointerCancel={() => { setDrag(null); start.current = null; }}
      >
        <span className="grabber" aria-hidden />
        <button type="button" className="sheet-toggle" aria-expanded={state !== 'cerrado'} onClick={(e) => { e.stopPropagation(); cycle(); }} data-action="sheet-toggle">
          <Icon name="sliders" size={18} /> Controles
          <Icon name={state === 'ampliado' ? 'chevronDown' : 'chevronUp'} size={16} />
        </button>
        {state !== 'cerrado' && (
          <button type="button" className="tool" onClick={(e) => { e.stopPropagation(); setState('cerrado'); }} aria-label="Cerrar controles"><Icon name="close" size={18} /></button>
        )}
      </div>
      <div className="sheet-body" hidden={state === 'cerrado'}>{children}</div>
    </section>
  );
}
