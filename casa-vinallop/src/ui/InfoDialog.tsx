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
        <li>Casa Vinallop: {empty && !project.isTest ? 'sin geometría. Se construirá a partir de las fotografías de los bocetos.' : project.isTest ? 'sin geometría todavía (se muestra el modelo de prueba).' : 'geometría incorporada.'}</li>
        <li>Referencias guardadas en este dispositivo: {refs.length} ({refs.filter((r) => r.kind === 'boceto').length} de bocetos, {refs.filter((r) => r.calibration).length} calibradas).</li>
        <li>Orientación: {project.northDeg === null ? 'no establecida. No se muestran puntos cardinales ni estudio solar.' : `${project.northDeg}°`}</li>
        <li>Niveles documentados: {project.levels.length ? project.levels.map((l) => l.name).join(', ') : 'ninguno'}.</li>
        <li>La web de referencia (casa.backtesting.ai) no se ha podido abrir desde el entorno de desarrollo; la interfaz sigue las especificaciones escritas.</li>
      </ul>

      {!empty && (
        <>
          <h3>Medidas registradas</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Medida</th><th>Valor</th><th>Fuente</th><th>Dato</th></tr></thead>
              <tbody>
                {project.measures.map((x) => (
                  <tr key={x.id}><td>{x.label}{x.note && <small>{x.note}</small>}</td><td className="num">{x.value === null ? 'pendiente' : `${fmtM(x.value, x.decimals)} ${x.unit}`}</td><td>{src(x.sourceId)}</td><td><StatusTag status={x.status} /></td></tr>
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
