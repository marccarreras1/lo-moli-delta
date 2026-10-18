/**
 * Sección «Proyecto»: resumen de lo documentado, lo decidido por la propiedad, las propuestas y lo
 * pendiente; contrastes de medidas; planta acotada del baño; solera en L; logo; estudio solar;
 * exportación e importación del proyecto completo.
 */
import { useMemo, useRef, useState } from 'react';
import type { DataStatus } from '../data/types';
import { download, exportName } from '../export/export';
import { conSituacion, solarReady, sunPosition, useSolar } from '../model/solar';
import { soleraQuantities } from '../model/solera';
import { bathPlanSvg, bathPlanData } from '../plan/bathPlan';
import { useModel } from '../state/derived';
import { exportProjectFile, importProjectFile } from '../state/projectFile';
import { useStore } from '../state/store';
import { useLogo } from '../ui/logo';
import { STATUS_STYLE } from '../ui/status';

const GROUPS: { id: string; label: string; statuses: DataStatus[]; hint: string }[] = [
  { id: 'doc', label: 'Documentado', statuses: ['documentado'], hint: 'Cotas escritas en los bocetos, informe del arquitecto (cifras citadas).' },
  { id: 'prop', label: 'Decisiones de la propiedad', statuses: ['confirmado'], hint: 'Indicado o confirmado por la propiedad. No implica validación técnica.' },
  { id: 'propuesta', label: 'Propuestas', statuses: ['propuesto', 'interpretado'], hint: 'Diseño del estudio o lectura de los bocetos: se puede cambiar.' },
  { id: 'pend', label: 'Pendiente', statuses: ['pendiente'], hint: 'Falta un dato o una validación.' },
];

const fmt = (n: number, d = 2) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

export function ProjectPage() {
  const { layout, project } = useModel();
  const goView = useStore((s) => s.goView);
  const setVisual = useStore((s) => s.setVisual);
  const logo = useLogo();
  const solar = useSolar();
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const list: { label: string; status: DataStatus; kind: string }[] = [];
    for (const m of layout.measures) list.push({ label: `${m.label}: ${m.value === null ? "—" : fmt(m.value, m.decimals)} ${m.unit}`, status: m.status, kind: 'Medida' });
    for (const o of layout.openings) list.push({ label: o.label, status: o.status, kind: 'Hueco' });
    for (const f of layout.furniture) if (f.status) list.push({ label: f.label, status: f.status, kind: 'Mobiliario' });
    for (const p of layout.outdoor?.pavements ?? []) list.push({ label: p.label, status: p.status, kind: 'Exterior' });
    for (const r of layout.roofOptions) list.push({ label: `Cubierta: ${r.label}`, status: r.status, kind: 'Cubierta' });
    if (layout.roof?.ceiling) list.push({ label: 'Techo: vigas vistas color cemento y volta catalana terracota', status: layout.roof.ceiling.status, kind: 'Techo' });
    for (const c of project.checks ?? []) list.push({ label: c.label, status: c.status, kind: 'Contraste' });
    return list;
  }, [layout, project]);

  const sol = soleraQuantities(layout);
  const bath = bathPlanData(layout);
  const bathSvg = useMemo(() => bathPlanSvg(layout, { showLabels: true }), [layout]);
  const builtModel = (layout.bounds.maxX - layout.bounds.minX) * (layout.bounds.maxY - layout.bounds.minY);
  const north = solar.northDeg ?? project.northDeg;
  const solarEf = conSituacion(solar, project.situacion);
  const ready = solarReady(solarEf, project.northDeg);
  const solarPos = ready ? sunPosition(new Date(solarEf.datetime!), solarEf.lat!, solarEf.lon!) : null;

  const exportAll = async () => {
    try {
      await download(exportName('proyecto-completo', project.name, 'todas', 'json'), JSON.stringify(exportProjectFile(), null, 2), 'application/json');
      setMsg({ text: 'Proyecto exportado (diseño, vistas, gestión e instalaciones).' });
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    }
  };

  return (
    <div className="section-page" data-testid="page-proyecto">
      <header className="sp-head">
        <div className="sp-logo">
          {logo.src ? <img src={logo.src} alt="Logo de Casa Vinallop" /> : <span className="sp-logo-text">Casa Vinallop</span>}
        </div>
        <div>
          <h1>{project.name} · proyecto</h1>
          <p className="hint">Versión de datos: {project.version}. Modelo de estudio y visualización; no es un proyecto técnico de ejecución.</p>
        </div>
      </header>

      <section className="sp-card">
        <h2>Cifras principales</h2>
        <dl className="sp-figures">
          <div><dt>Envolvente exterior (informe)</dt><dd>{fmt(layout.bounds.maxX - layout.bounds.minX)} × {fmt(layout.bounds.maxY - layout.bounds.minY)} m</dd></div>
          <div><dt>Rectángulo del modelo</dt><dd>{fmt(builtModel)} m² <small>frente a 79,48 m² construidos del informe (pendiente)</small></dd></div>
          <div><dt>Modelo anterior</dt><dd>15,70 × 5,00 m <small>(cadena del boceto como exterior; sustituido)</small></dd></div>
          {sol && <div><dt>Solera en L</dt><dd>{fmt(sol.area)} m² <small>unión de tramos ({sol.tramos.map((t) => `${fmt(t.area)}`).join(' + ')} − esquina {fmt(sol.overlap)} − alcorque {fmt(sol.excluded)})</small></dd></div>}
          <div><dt>Altell</dt><dd>suelo a 2,80 m · 2,50 m libres en planta baja</dd></div>
        </dl>
        <div className="sp-actions">
          <button type="button" className="btn" onClick={() => { setVisual('section', 'visor'); goView('v15-corte', 'exterior'); }}>Ver el corte longitudinal</button>
          <button type="button" className="btn" onClick={() => { setVisual('section', 'visor'); goView('v04-solera', 'exterior'); }}>Ver la solera en L</button>
        </div>
      </section>

      <section className="sp-card">
        <h2>Contrastes de medidas</h2>
        {(project.checks ?? []).map((c) => (
          <div key={c.label} className="sp-check">
            <div className="sp-check-head"><strong>{c.label}</strong><Badge status={c.status} /></div>
            <ul>{c.items.map((i) => <li key={i.source}><span className="hint">{i.source}:</span> {i.value}</li>)}</ul>
            <p className="hint">{c.note}</p>
          </div>
        ))}
      </section>

      <section className="sp-card">
        <h2>Estado de cada elemento</h2>
        <div className="sp-groups">
          {GROUPS.map((g) => {
            const list = items.filter((i) => g.statuses.includes(i.status));
            return (
              <div key={g.id} className="sp-group" data-group={g.id}>
                <h3>{g.label} <span className="count">{list.length}</span></h3>
                <p className="hint">{g.hint}</p>
                <ul>{list.slice(0, 60).map((i, k) => <li key={k}><span className="kind">{i.kind}</span> {i.label}</li>)}</ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sp-card">
        <h2>Baño acotado</h2>
        <div className="sp-bath" dangerouslySetInnerHTML={{ __html: bathSvg ?? '' }} />
        <ul>{bath?.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        <div className="sp-actions">
          <button type="button" className="btn" onClick={() => { setVisual('section', 'visor'); goView('v12-bano-entrada', 'interior'); }}>Vista desde la entrada</button>
          <button type="button" className="btn" onClick={() => { setVisual('section', 'visor'); goView('v12b-bano-ducha', 'interior'); }}>Desde la ducha</button>
          <button type="button" className="btn" onClick={() => { setVisual('section', 'visor'); goView('v12c-celosia', 'interior'); }}>Detalle de la celosía</button>
        </div>
      </section>

      <section className="sp-card">
        <h2>Discrepancias y preguntas abiertas</h2>
        <ul>{project.discrepancies.map((d) => <li key={d}>{d}</li>)}</ul>
        <h3>Preguntas</h3>
        <ul>{project.questions.map((q) => <li key={q}>{q}</li>)}</ul>
      </section>

      <section className="sp-card">
        <h2>Logo</h2>
        <p className="hint">El logo de Lo Molí · Delta (archivo de la propiedad) va incluido en la aplicación. Si quieres probar otra versión, cárgala aquí: se guarda solo en este navegador y sustituye al incluido en la cabecera.</p>
        <div className="sp-actions">
          <button type="button" className="btn" onClick={() => logoRef.current?.click()} data-action="logo-load">{logo.src ? 'Cambiar el archivo del logo' : 'Cargar el archivo del logo'}</button>
          {logo.src && <button type="button" className="btn" onClick={logo.clear}>Quitar</button>}
        </div>
        {logo.error && <p className="error-text">{logo.error}</p>}
        <input ref={logoRef} type="file" hidden accept="image/svg+xml,image/png,image/webp,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void logo.load(f); }} />
      </section>

      <section className="sp-card" data-testid="solar">
        <h2>Estudio solar <span className={`flag${solar.active && ready ? '' : ' flag-phase'}`}>{solar.active && ready ? 'activo' : 'preparado · inactivo'}</span></h2>
        <p className="hint">Norte: {project.northDeg !== null ? `${project.northDeg}° en sentido horario desde el frontal A, según el eje del edificio en el Catastro (GML aportado por la propiedad; la brújula de Mapas de Apple daba ≈22°). Con él, las luces de día y tarde del visor salen de la orientación real (sol del sur-suroeste a primera hora de la tarde y de poniente al atardecer), aunque sin fecha no reproducen un día concreto.` : 'sin establecer.'} {project.situacion ? `Situación: ${project.situacion.nota} Para el sol exacto solo falta elegir día y hora.` : 'Para el sol exacto de un día y una hora faltan la situación y la fecha: no se han inventado.'}</p>
        <div className="sp-form">
          <label>Norte (° en sentido horario desde el frontal A)<input type="number" min={0} max={360} step={1} value={north ?? ''} onChange={(e) => solar.set({ northDeg: e.target.value === '' ? null : Math.max(0, Math.min(360, Number(e.target.value))) })} /></label>
          <label>Latitud<input type="number" min={-90} max={90} step={0.0001} value={solarEf.lat ?? ''} onChange={(e) => solar.set({ lat: e.target.value === '' ? null : Math.max(-90, Math.min(90, Number(e.target.value))) })} /></label>
          <label>Longitud<input type="number" min={-180} max={180} step={0.0001} value={solarEf.lon ?? ''} onChange={(e) => solar.set({ lon: e.target.value === '' ? null : Math.max(-180, Math.min(180, Number(e.target.value))) })} /></label>
          <label>Fecha y hora<input type="datetime-local" value={solar.datetime ?? ''} onChange={(e) => solar.set({ datetime: e.target.value || null })} /></label>
        </div>
        {solarPos && <p>Sol: acimut {fmt(solarPos.az, 0)}°, elevación {fmt(solarPos.el, 0)}°{solarPos.el <= 0 ? ' (bajo el horizonte)' : ''}.</p>}
        <label className="toggle-line"><input type="checkbox" disabled={!ready} checked={solar.active && ready} onChange={(e) => solar.set({ active: e.target.checked })} /> Usar el sol real en el visor</label>
      </section>

      <section className="sp-card">
        <h2>Guardar y compartir</h2>
        <p className="hint">Todo se guarda solo en este navegador; no hay servidor ni colaboración multiusuario. Para moverlo a otro equipo, exporta el proyecto completo (formato versionado) e impórtalo allí: se valida entero y, si algo falla, no cambia nada.</p>
        <div className="sp-actions">
          <button type="button" className="btn primary" onClick={exportAll} data-action="project-export">Exportar proyecto completo (JSON)</button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()} data-action="project-import">Importar proyecto…</button>
        </div>
        {msg && <p className={msg.error ? 'error-text' : 'hint'} role="status">{msg.text}</p>}
        <input ref={fileRef} type="file" hidden accept="application/json,.json" data-testid="project-import-input" onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          let data: unknown;
          try { data = JSON.parse(await f.text()); } catch { setMsg({ text: 'El archivo no es JSON válido. No se ha cambiado nada.', error: true }); return; }
          const r = importProjectFile(data);
          setMsg(r.ok ? { text: 'Proyecto importado.' } : { text: `No se ha importado: ${r.error}. No se ha cambiado nada.`, error: true });
        }} />
      </section>
    </div>
  );
}

function Badge({ status }: { status: DataStatus }) {
  const st = STATUS_STYLE[status];
  return <span className="status-badge" style={{ color: st.color, borderColor: st.color }}>{st.label}</span>;
}
