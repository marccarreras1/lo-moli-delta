/**
 * Archivo de proyecto completo: diseño y vistas, gestión (decisiones, fases, presupuesto,
 * comentarios) e instalaciones, con versión de formato. La importación valida las tres partes
 * antes de aplicar nada: si una falla, no cambia ninguna.
 */
import { exportGestion, importGestion } from '../gestion';
import { exportInstalaciones, importInstalaciones, parseInstalaciones } from '../instalaciones/store';
import { parseConfig, serializeConfig, useStore } from './store';

export const PROJECT_FILE_APP = 'casa-vinallop-proyecto';
export const PROJECT_FILE_FORMAT = 1;

export function exportProjectFile() {
  return {
    app: PROJECT_FILE_APP,
    formato: PROJECT_FILE_FORMAT,
    exportado: new Date().toISOString(),
    aviso: 'Modelo de estudio y visualización. No es un proyecto técnico de ejecución. Datos guardados solo en el navegador de origen.',
    configuracion: serializeConfig(useStore.getState()),
    gestion: exportGestion(),
    instalaciones: exportInstalaciones(),
  };
}

export function importProjectFile(data: unknown): { ok: true } | { ok: false; error: string } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'El archivo no contiene un proyecto.' };
  const o = data as Record<string, unknown>;
  if (o.app !== PROJECT_FILE_APP) return { ok: false, error: 'No es un archivo de proyecto de Casa Vinallop.' };
  if (typeof o.formato !== 'number' || o.formato > PROJECT_FILE_FORMAT) return { ok: false, error: 'La versión del archivo no es compatible con esta aplicación.' };
  try {
    parseConfig(o.configuracion);
  } catch (e) {
    return { ok: false, error: `Configuración: ${(e as Error).message}` };
  }
  const inst = parseInstalaciones(o.instalaciones);
  if (!inst.ok) return { ok: false, error: `Instalaciones: ${inst.error}` };
  // la gestión valida y aplica de forma atómica; las otras dos partes ya están validadas
  const g = importGestion(o.gestion);
  if (!g.ok) return { ok: false, error: `Gestión: ${g.error}` };
  const c = useStore.getState().importConfig(o.configuracion);
  if (!c.ok) return { ok: false, error: c.error };
  const i = importInstalaciones(o.instalaciones);
  if (!i.ok) return { ok: false, error: i.error };
  return { ok: true };
}
