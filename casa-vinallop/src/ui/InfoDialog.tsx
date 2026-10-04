import { fmtM, polygonArea } from '../model/geometry';
import { useRefs } from '../refs/db';
import { useModel } from '../state/derived';
import { StatusTag } from './controls';
import { Modal } from './Modal';

/** Panel secundario: qué procede de fuentes, qué se interpreta, qué se propone y qué falta. */
export function InfoDialog({ onClose }: { onClose: () => void }) {
  const { project, layout, issues, empty } = useModel();
  const refs = useRefs((s) => s.list);
  const src = (id: string) => project.sources.find((s) => s.id === id)?.label ?? id;
  return (
    <Modal title="Medidas y documentación" onClose={onClose} wide testId="info-dialog">
      <p className="lead">
        <strong>Documentado</strong> = figura en una fuente (no comprobado en obra). <strong>Interpretado</strong> = deducido de un boceto sin cota.
        <strong> Propuesto</strong> = decisión de diseño a estudiar. <strong>Pendiente</strong> = no se distingue o falta.
      </p>
      {project.isTest && <p className="callout">Estás viendo el <strong>modelo de prueba</strong>: geometría ficticia para probar la interfaz. No es Casa Vinallop.</p>}

      <h3>Estado de esta versión</h3>
      <ul className="plain">
        <li>{project.isTest ? 'Se muestra el modelo de prueba.' : empty ? 'Casa Vinallop: sin geometría.' : `Casa Vinallop: geometría interpretada de los bocetos fotografiados (versión ${project.version}). Orientación de los textos del boceto: el dormitorio queda a la izquierda.`}</li>
        <li>Las fotografías no se guardan en la web. Para superponerlas al plano, añádelas en «Referencias» (se guardan en este dispositivo).</li>
        <li>Referencias guardadas en este dispositivo: {refs.length} ({refs.filter((r) => r.kind === 'boceto').length} de bocetos, {refs.filter((r) => r.calibration).length} calibradas).</li>
        <li>Orientación: {project.northDeg === null ? 'no establecida. No se muestran puntos cardinales ni estudio solar.' : `${project.northDeg}°`}</li>
        <li>Niveles documentados: {project.levels.length ? project.levels.map((l) => l.name).join(', ') : 'ninguno'}.</li>
        <li>La web de referencia (casa.backtesting.ai) no se ha podido abrir desde el entorno de desarrollo; la interfaz sigue las especificaciones escritas.</li>
      </ul>

      {project.questions.length > 0 && (
        <>
          <h3>Preguntas abiertas (pueden cambiar la geometría)</h3>
          <ol className="plain" data-testid="questions">{project.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
        </>
      )}
      {project.readings.length > 0 && (
        <>
          <h3>Lo leído en los bocetos y su interpretación</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Fuente</th><th>Se lee</th><th>Se interpreta</th></tr></thead>
              <tbody>{project.readings.map((r, i) => <tr key={i}><td>{src(r.sourceId)}</td><td>{r.read}</td><td>{r.interpreted}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
      {project.discrepancies.length > 0 && (
        <>
          <h3>Discrepancias entre bocetos</h3>
          <ul className="plain">{project.discrepancies.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </>
      )}
      {project.furniture.some((f) => f.note) && (
        <>
          <h3>Elementos dibujados en el boceto</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Elemento</th><th>Medida</th><th>Lectura</th><th>Dato</th></tr></thead>
              <tbody>{project.furniture.map((f) => (
                <tr key={f.id}><td>{f.label}</td><td className="num">{fmtM(f.w)} × {fmtM(f.d)} m</td><td>{f.note ?? '—'}</td><td>{f.status ? <StatusTag status={f.status} /> : '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
      {project.stairs.length > 0 && (
        <>
          <h3>Escalera</h3>
          <ul className="plain">{project.stairs.map((st) => <li key={st.id}>{st.note}</li>)}</ul>
        </>
      )}
      {(project.railings?.length ?? 0) > 0 && (
        <>
          <h3>Barandillas</h3>
          <ul className="plain">{project.railings!.map((r) => <li key={r.id}><strong>{r.label}</strong> ({r.status}): {r.note}</li>)}</ul>
        </>
      )}
      {project.roofSegments?.length ? (
        <>
          <h3>Cubiertas por volúmenes</h3>
          <ul className="plain">{project.roofSegments.map((s) => <li key={s.id}><strong>{s.label}</strong> ({s.status}): alero {s.hy0.toLocaleString('es-ES')} m en el frontal A y {s.hy1.toLocaleString('es-ES')} m en el frontal B. {s.note}</li>)}</ul>
        </>
      ) : null}
      {project.site && (
        <>
          <h3>Entorno de la parcela</h3>
          <p>{project.site.note}</p>
          <ul className="plain">{[...project.site.trees, ...project.site.pavements].map((x) => <li key={x.id}><strong>{x.label}:</strong> {x.note}</li>)}</ul>
        </>
      )}
      {project.traces.length > 0 && (
        <>
          <h3>Trazos y marcas sin interpretar</h3>
          <ul className="plain">{project.traces.map((t) => <li key={t.id}><strong>{t.label}:</strong> {t.note}</li>)}</ul>
        </>
      )}
      {!empty && (
        <>
          <h3>Medidas registradas</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Medida</th><th>Valor</th><th>Fuente</th><th>Dato</th></tr></thead>
              <tbody>
                {project.measures.map((x) => (
                  <tr key={x.id}><td>{x.label}{x.note && <small>{x.note}</small>}</td><td className="num">{x.value === null ? 'pendiente' : x.unit === 'ud' || x.unit === '°' ? `${x.value} ${x.unit}` : `${fmtM(x.value, x.decimals)} ${x.unit}`}</td><td>{src(x.sourceId)}</td><td><StatusTag status={x.status} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Superficies</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Estancia</th><th>Calculada por la aplicación</th><th>Transcrita de una fuente</th><th>Dato</th></tr></thead>
              <tbody>
                {layout.rooms.map((r) => (
                  <tr key={r.id}><td>{r.name}</td><td className="num">{fmtM(polygonArea(r.polygon), 1)} m²</td><td className="num">{r.documentedArea ? `${fmtM(r.documentedArea.value, r.documentedArea.decimals)} m²` : 'pendiente'}</td><td><StatusTag status={r.status} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Comprobación del modelo</h3>
          {issues.length === 0 ? <p className="hint">Sin incidencias.</p> : (
            <ul className="issues">
              {issues.map((i, k) => <li key={k} className={`issue issue-${i.level}`}><span className="issue-level">{i.level}</span>{i.message}</li>)}
            </ul>
          )}
        </>
      )}

      <h3>Dónde se modifica</h3>
      <ul className="plain">
        <li>Geometría de Casa Vinallop: <code>src/data/vinallop.ts</code> (muros, huecos, estancias, medidas y fuentes).</li>
        <li>Materiales y combinaciones: <code>src/data/acabados.ts</code>.</li>
        <li>Coordenadas en metros: X hacia la derecha del papel, Y hacia abajo. El 3D usa los mismos ejes, sin giros ni reflejos.</li>
      </ul>
      <p className="disclaimer">Modelo de estudio y visualización. No es un proyecto técnico de ejecución ni sustituye comprobaciones estructurales o urbanísticas.</p>
    </Modal>
  );
}
