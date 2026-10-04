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
        <strong>Confirmado</strong> = indicado por la propiedad. <strong>Documentado</strong> = escrito en un boceto. <strong>Interpretado</strong> = deducido de un dibujo o una foto sin cota.
        <strong> Propuesto</strong> = decisión de diseño a estudiar. <strong>Pendiente</strong> = no se distingue o falta. Nada está comprobado en obra.
      </p>
      {project.isTest && <p className="callout">Estás viendo el <strong>modelo de prueba</strong>: geometría ficticia para probar la interfaz. No es Casa Vinallop.</p>}

      <h3>Estado de esta versión</h3>
      <ul className="plain">
        <li>{project.isTest ? 'Se muestra el modelo de prueba.' : empty ? 'Casa Vinallop: sin geometría.' : `Casa Vinallop: geometría interpretada de los bocetos fotografiados (versión ${project.version}). Orientación de los textos del boceto: el dormitorio queda a la izquierda.`}</li>
        <li>Las fotografías no se guardan en la web. Para superponerlas al plano, añádelas en «Referencias» (se guardan en este dispositivo).</li>
        <li>Referencias guardadas en este dispositivo: {refs.length} ({refs.filter((r) => r.kind === 'boceto').length} de bocetos, {refs.filter((r) => r.calibration).length} calibradas).</li>
        <li>Orientación: {project.northDeg === null ? 'no establecida. No se muestran puntos cardinales ni estudio solar.' : `${project.northDeg}°`}</li>
        <li>Niveles documentados: {project.levels.length ? project.levels.map((l) => l.name).join(', ') : 'ninguno'}.</li>
        <li>La web de referencia (casa.backtesting.ai) y los enlaces de Pinterest no se han podido abrir desde el entorno de desarrollo (red bloqueada). La interfaz y los espacios siguen las descripciones escritas de la propiedad; no se ha copiado ni descargado ninguna imagen.</li>
        <li>Texturas y modelos: generados en el propio código (texturas procedurales y piezas hechas por revolución o extrusión), sin imágenes ni modelos de terceros.</li>
      </ul>

      {(project.checks ?? []).length > 0 && (
        <>
          <h3>Contraste de dimensiones entre fuentes</h3>
          <div className="tbl-wrap">
            <table className="tbl" data-testid="checks">
              <thead><tr><th>Dimensión</th><th>Fuentes</th><th>Situación</th></tr></thead>
              <tbody>{project.checks!.map((c) => (
                <tr key={c.label}><td>{c.label}</td><td>{c.items.map((x) => <div key={x.source}><strong>{x.value}</strong> · {x.source}</div>)}</td><td><StatusTag status={c.status} /> {c.note}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
      {(project.references ?? []).length > 0 && (
        <>
          <h3>Referencias visuales de diseño</h3>
          <p className="hint">Sirven para el aspecto, no como geometría ni como texturas. {project.references!.every((r) => !r.consulted) ? 'Ninguna se ha podido abrir desde este entorno: se han modelado a partir de su descripción escrita. Conviene revisarlas contra las vistas preparadas.' : ''}</p>
          <div className="tbl-wrap">
            <table className="tbl" data-testid="references">
              <thead><tr><th>Espacio</th><th>Qué se toma</th><th>Enlace</th></tr></thead>
              <tbody>{project.references!.map((r) => (
                <tr key={r.id}><td>{r.space}</td><td>{r.use}</td><td><a href={r.url} target="_blank" rel="noreferrer noopener">{r.url.replace('https://', '')}</a>{r.consulted ? '' : ' · no consultada'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}

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
          <h3>Mobiliario y elementos</h3>
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
      {project.outdoor && (
        <>
          <h3>Comedor exterior bajo el algarrobo</h3>
          <ul className="plain">
            {project.outdoor.pavements.map((p) => <li key={p.id}><strong>{p.label}</strong> ({p.status}): {p.note}</li>)}
            {project.outdoor.furniture.filter((f) => f.note).map((f) => <li key={f.id}><strong>{f.label}</strong> ({f.status}): {f.note}</li>)}
            {project.outdoor.lights.map((l) => <li key={l.id}><strong>Luz exterior</strong> ({l.status}): {l.note}</li>)}
          </ul>
        </>
      )}
      {(project.pendants ?? []).length > 0 && (
        <>
          <h3>Lámparas colgantes (alternativas A y B, ubicación sin elegir)</h3>
          <ul className="plain">{project.pendants!.map((g) => <li key={g.id}><strong>{g.label}</strong> ({g.status}): {g.note}</li>)}</ul>
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
