import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import { ConfirmButton } from './controls';
import { planSvg, type PlanOverlay } from '../plan/planSvg';
import { bathPlanSvg } from '../plan/bathPlan';
import { elevationSvg, FACADES, type FacadeId } from '../plan/elevationSvg';
import { planSheetSvg } from '../plan/sheets';
import { installationsSvg } from '../instalaciones/planLayer';
import { useInstalaciones, useResolvedPoints, useVisibleLayers } from '../instalaciones/store';
import { metersPerPx, overlayReady, useRefs } from '../refs/db';
import { useModel } from '../state/derived';
import { activeVariant, useStore } from '../state/store';
import { useGestion } from '../gestion/store';
import { pointInPolygon } from '../model/geometry';
import type { Vec2 } from '../data/types';

const COMMENT_COLOR = { pendiente: '#b26a00', resuelto: '#3f7a4a' } as Record<string, string>;
const fmt2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [bath, setBath] = useState(false);
  /** alzado de una fachada en lugar de la planta */
  const [facade, setFacade] = useState<FacadeId | null>(null);
  /** lámina de la planta del nivel activo (con cajetín y cuadro de superficies) */
  const [sheet, setSheet] = useState(false);
  const variant = useStore(activeVariant);
  const instPoints = useResolvedPoints(layout);
  const instLayers = useVisibleLayers();
  const instSel = useInstalaciones((x) => x.selectedId);
  const levelId = s.levelId ?? layout.levels[0]?.id ?? '';
  const hasBath = layout.rooms.some((r) => r.id === 'bano');
  const svg = useMemo(
    () => (sheet && !facade && !bath ? planSheetSvg(layout, levelId, { variantName: variant.name, finishes: variant.finishes }) : null) ?? (facade ? elevationSvg(layout, facade, { showDims: s.showDims, showLabels: s.showLabels, variantName: variant.name, finishes: variant.finishes }) : null) ?? (bath && hasBath ? bathPlanSvg(layout) ?? '' : null) ?? planSvg(layout, { selection, showDims: s.showDims, showAreas: s.showAreas, showFurniture: s.showFurniture, showLabels: s.showLabels, issues, openFractions, overlay, levelId: s.levelId, showPassages: s.showPassages }),
    [sheet, levelId, facade, variant, bath, hasBath, s.levelId, layout, selection, s.showDims, s.showAreas, s.showFurniture, s.showLabels, issues, openFractions, overlay, s.showPassages],
  );
  const comments = useGestion((x) => x.comentarios);
  const [tool, setTool] = useState<'none' | 'comentar' | 'medir'>('none');
  const [measure, setMeasure] = useState<Vec2[]>([]);
  const [draft, setDraft] = useState<{ p: Vec2; room?: string; text: string } | null>(null);
  const [openComment, setOpenComment] = useState<string | null>(null);
  const addComment = useGestion((x) => x.addComment);
  const updateComment = useGestion((x) => x.updateComment);
  const removeComment = useGestion((x) => x.removeComment);
  const svgFull = useMemo(() => {
    if (bath) return svg;
    let extra = instLayers.size && !facade ? installationsSvg(instPoints, instLayers, levelId, instSel ?? undefined, { labels: s.showLabels, walls: layout.walls }) : '';
    // comentarios del nivel (chinchetas numeradas)
    if (!facade) comments.filter((c) => c.nivel === levelId).forEach((c, i) => {
      const col = COMMENT_COLOR[c.estado] ?? '#b26a00';
      extra += `<g data-comment="${c.id}" class="comment-pin"><circle cx="${c.posicion.x}" cy="${c.posicion.y}" r="0.2" fill="${col}" stroke="#fff" stroke-width="0.04"/><text x="${c.posicion.x}" y="${c.posicion.y + 0.07}" font-size="0.2" text-anchor="middle" fill="#fff" font-weight="700">${i + 1}</text></g>`;
    });
    if (draft) extra += `<circle cx="${draft.p[0]}" cy="${draft.p[1]}" r="0.2" fill="none" stroke="#b26a00" stroke-width="0.05" stroke-dasharray="0.06 0.04"/>`;
    // medición: puntos, línea y distancia calculada sobre el modelo
    if (measure.length) {
      const [a, b] = measure;
      extra += `<g class="measure" pointer-events="none"><circle cx="${a[0]}" cy="${a[1]}" r="0.07" fill="#1d5fa8"/>`;
      if (b) {
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        extra += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#1d5fa8" stroke-width="0.035"/><circle cx="${b[0]}" cy="${b[1]}" r="0.07" fill="#1d5fa8"/><text x="${mx}" y="${my - 0.15}" font-size="0.24" text-anchor="middle" fill="#1d5fa8" paint-order="stroke" stroke="#fff" stroke-width="0.06" font-weight="650">${fmt2(d)} m</text>`;
      }
      extra += '</g>';
    }
    return extra ? svg.replace(/<\/svg>$/, `${extra}</svg>`) : svg;
  }, [svg, facade, bath, instPoints, instLayers, levelId, instSel, s.showLabels, layout.walls, comments, measure, draft]);
  /** pantalla → metros de planta; con imán a esquinas de estancias y muros (≤ 0,15 m) y a 5 cm */
  const toPlan = (clientX: number, clientY: number, snap: boolean): Vec2 | null => {
    const el = document.querySelector('.plan-inner svg') as SVGSVGElement | null;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    let p: Vec2 = [pt.x, pt.y];
    if (snap && facade) return [Math.round(p[0] * 20) / 20, Math.round(p[1] * 20) / 20];
    if (snap) {
      let best: Vec2 | null = null;
      let bd = 0.15;
      for (const r of layout.rooms.filter((x) => x.levelId === levelId)) for (const v of r.polygon) {
        const d = Math.hypot(v[0] - p[0], v[1] - p[1]);
        if (d < bd) { bd = d; best = v; }
      }
      p = best ?? [Math.round(p[0] * 20) / 20, Math.round(p[1] * 20) / 20];
    }
    return p;
  };
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
          if (d && !d.moved && tool !== 'none') {
            const p = toPlan(e.clientX, e.clientY, tool === 'medir');
            if (p && tool === 'medir') setMeasure((m) => (m.length >= 2 ? [p] : [...m, p]));
            if (p && tool === 'comentar') setDraft({ p, room: layout.rooms.find((r) => r.levelId === levelId && pointInPolygon(p, r.polygon))?.id, text: '' });
            return;
          }
          if (d && !d.moved) {
            const hit = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
            const op = hit?.closest('[data-opening]');
            const room = hit?.closest('[data-room]');
            const fu = hit?.closest('[data-furniture]');
            const ins = hit?.closest('[data-install]');
            const cm = hit?.closest('[data-comment]');
            if (cm) setOpenComment(cm.getAttribute('data-comment'));
            else if (ins) useInstalaciones.getState().select(ins.getAttribute('data-install'));
            else if (op) select({ kind: 'opening', id: op.getAttribute('data-opening')! });
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
        <div className="plan-inner" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }} dangerouslySetInnerHTML={{ __html: svgFull }} />
      </div>
      <div className="plan-zoom" role="group" aria-label="Zoom de la planta">
        <button type="button" className={`tool tool-text${tool === 'medir' ? ' active' : ''}`} aria-pressed={tool === 'medir'} onClick={() => { setTool((t) => (t === 'medir' ? 'none' : 'medir')); setMeasure([]); }} data-action="plan-medir" title="Medir distancias sobre el modelo">Medir</button>
        {!facade && <button type="button" className={`tool tool-text${tool === 'comentar' ? ' active' : ''}`} aria-pressed={tool === 'comentar'} onClick={() => { setTool((t) => (t === 'comentar' ? 'none' : 'comentar')); setDraft(null); }} data-action="plan-comentar" title="Añadir un comentario en el plano">Nota</button>}
        {!facade && <button type="button" className={`tool tool-text${sheet ? ' active' : ''}`} aria-pressed={sheet} onClick={() => { setSheet((x) => !x); setBath(false); setMeasure([]); setDraft(null); if (tool === 'comentar') setTool('none'); setView({ k: 1, x: 0, y: 0 }); }} data-action="plan-lamina" title="Lámina de la planta con cajetín y superficies">Lámina</button>}
        <button type="button" className={`tool tool-text${facade ? ' active' : ''}`} aria-pressed={!!facade} onClick={() => { setFacade((x) => (x ? null : 'B')); setBath(false); setMeasure([]); setDraft(null); if (tool === 'comentar') setTool('none'); setView({ k: 1, x: 0, y: 0 }); }} data-action="plan-alzados" title="Alzados de las fachadas">Alzados</button>
        {facade && FACADES.map((x) => (
          <button key={x.id} type="button" className={`tool tool-text${facade === x.id ? ' active' : ''}`} aria-pressed={facade === x.id} onClick={() => { setFacade(x.id); setMeasure([]); setView({ k: 1, x: 0, y: 0 }); }} data-facade={x.id} title={`Alzado: ${x.label}`}>{x.short}</button>
        ))}
        {hasBath && !facade && (
          <button type="button" className={`tool tool-text${bath ? ' active' : ''}`} aria-pressed={bath} onClick={() => { setBath((b) => !b); setView({ k: 1, x: 0, y: 0 }); }} data-action="plan-bano" title="Planta acotada del baño">Baño</button>
        )}
        <button type="button" className="tool" onClick={() => zoomAt(1.25)} aria-label="Acercar"><Icon name="plus" /></button>
        <button type="button" className="tool" onClick={() => zoomAt(0.8)} aria-label="Alejar"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden><path d="M4 10h12" /></svg></button>
      </div>
      {tool === 'medir' && (
        <div className="plan-tool-card" role="status" data-testid="measure-card">
          {measure.length < 2 ? <span>{measure.length === 0 ? 'Pulsa el primer punto (imán a esquinas, 5 cm).' : 'Pulsa el segundo punto.'}</span> : (
            <span><strong>{fmt2(Math.hypot(measure[1][0] - measure[0][0], measure[1][1] - measure[0][1]))} m</strong> · calculada sobre el modelo, no verificada en obra. Pulsa otra vez para empezar.</span>
          )}
        </div>
      )}
      {tool === 'comentar' && !draft && <div className="plan-tool-card" role="status">Pulsa en el plano donde quieras dejar la nota.</div>}
      {draft && (
        <div className="plan-tool-card" data-testid="comment-draft">
          <label>Nota{draft.room ? ` · ${layout.rooms.find((r) => r.id === draft.room)?.name}` : ''}
            <textarea rows={3} autoFocus value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          </label>
          <div className="row">
            <button type="button" className="btn primary small" disabled={!draft.text.trim()} onClick={() => { addComment({ texto: draft.text.trim(), estancia: draft.room, nivel: levelId, posicion: { x: draft.p[0], y: draft.p[1] }, vista: 'plano' }); setDraft(null); setTool('none'); }} data-action="comment-save">Guardar</button>
            <button type="button" className="btn small" onClick={() => setDraft(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {openComment && (() => {
        const c = comments.find((x) => x.id === openComment);
        if (!c) return null;
        return (
          <div className="plan-tool-card" data-testid="comment-card">
            <strong>{c.estado === 'resuelto' ? 'Resuelto' : 'Pendiente'}{c.estancia ? ` · ${layout.rooms.find((r) => r.id === c.estancia)?.name ?? c.estancia}` : ''}</strong>
            <p>{c.texto}</p>
            <div className="row">
              <button type="button" className="btn small" onClick={() => updateComment(c.id, { estado: c.estado === 'resuelto' ? 'pendiente' : 'resuelto' })}>{c.estado === 'resuelto' ? 'Reabrir' : 'Marcar resuelto'}</button>
              <ConfirmButton className="btn small" confirmLabel="Pulsa otra vez para borrar" onConfirm={() => { removeComment(c.id); setOpenComment(null); }}>Borrar</ConfirmButton>
              <button type="button" className="btn small" onClick={() => setOpenComment(null)}>Cerrar</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
