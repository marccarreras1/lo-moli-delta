import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import { planSvg, type PlanOverlay } from '../plan/planSvg';
import { metersPerPx, overlayReady, useRefs } from '../refs/db';
import { useModel } from '../state/derived';
import { useStore } from '../state/store';

/** Plano 2D interactivo: selección de estancias y aberturas, zoom y desplazamiento. */
export function PlanView({ fitNonce }: { fitNonce: number }) {
  const { layout, issues } = useModel();
  const s = useStore((x) => x.visual);
  const selection = useStore((x) => x.selection);
  const select = useStore((x) => x.select);
  const openFractions = useStore((x) => x.openFractions);
  const refs = useRefs((x) => x.list);
  const urls = useRefs((x) => x.urls);
  const overlay = useMemo<PlanOverlay | null>(() => {
    const r = refs.find((x) => x.id === s.overlayRefId);
    if (!r || !overlayReady(r) || !urls[r.id]) return null;
    const k = metersPerPx(r.calibration!);
    return { href: urls[r.id], x: r.alignment!.x, y: r.alignment!.y, rotation: r.alignment!.rotation, widthM: r.width * k, heightM: r.height * k, opacity: s.overlayOpacity };
  }, [refs, urls, s.overlayRefId, s.overlayOpacity]);
  const svg = useMemo(
    () => planSvg(layout, { selection, showDims: s.showDims, showAreas: s.showAreas, showFurniture: s.showFurniture, showLabels: s.showLabels, issues, openFractions, overlay, levelId: s.levelId, showPassages: s.showPassages }),
    [s.levelId, layout, selection, s.showDims, s.showAreas, s.showFurniture, s.showLabels, issues, openFractions, overlay, s.showPassages],
  );
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [fitNonce]);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const pinch = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ d: number; k: number } | null>(null);

  const zoomAt = (factor: number, cx = 0, cy = 0) =>
    setView((v) => {
      const k = Math.min(8, Math.max(0.6, v.k * factor));
      const f = k / v.k;
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
    });

  return (
    <div className="plan-view">
      <div
        className="plan-canvas"
        data-testid="plan-svg"
        onWheel={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
        }}
        onPointerDown={(e) => {
          pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinch.current.size === 2) {
            const [a, b] = [...pinch.current.values()];
            pinchStart.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
            drag.current = null;
          } else {
            drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
          }
        }}
        onPointerMove={(e) => {
          if (pinch.current.has(e.pointerId)) pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinch.current.size === 2 && pinchStart.current) {
            const [a, b] = [...pinch.current.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const k = Math.min(8, Math.max(0.6, (pinchStart.current.k * d) / pinchStart.current.d));
            setView((v) => ({ ...v, k }));
            return;
          }
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) {
            if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
            d.moved = true;
          }
          if (d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
        }}
        onPointerUp={(e) => {
          pinch.current.delete(e.pointerId);
          if (pinch.current.size < 2) pinchStart.current = null;
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const hit = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
            const op = hit?.closest('[data-opening]');
            const room = hit?.closest('[data-room]');
            const fu = hit?.closest('[data-furniture]');
            if (op) select({ kind: 'opening', id: op.getAttribute('data-opening')! });
            else if (fu) select({ kind: 'furniture', id: fu.getAttribute('data-furniture')! });
            else if (room) select({ kind: 'room', id: room.getAttribute('data-room')! });
            else select(null);
          }
        }}
        onPointerCancel={(e) => {
          pinch.current.delete(e.pointerId);
          drag.current = null;
        }}
      >
        <div className="plan-inner" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <div className="plan-zoom" role="group" aria-label="Zoom de la planta">
        <button type="button" className="tool" onClick={() => zoomAt(1.25)} aria-label="Acercar"><Icon name="plus" /></button>
        <button type="button" className="tool" onClick={() => zoomAt(0.8)} aria-label="Alejar"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden><path d="M4 10h12" /></svg></button>
      </div>
    </div>
  );
}
