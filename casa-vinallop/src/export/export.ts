/** Exportaciones: PNG de la vista, planta SVG y configuración JSON. */
import type { Layout } from '../data/types';
import { planSvg, type PlanOptions } from '../plan/planSvg';
import { glRef } from '../viewer/support';

export const AVISO = 'Modelo de estudio y visualización. No es un proyecto técnico de ejecución.';
export const APP_VERSION = '0.2.0';

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function exportName(kind: string, projectName: string, variantName: string, ext: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `${slug(projectName)}_v${slug(APP_VERSION)}_${slug(variantName)}_${kind}_${date}.${ext}`;
}

export function download(name: string, data: Blob | string, type = 'application/octet-stream') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** PNG de la vista actual con un pie que identifica proyecto, vista, variante y versión. */
export async function exportPng(projectName: string, variantName: string, viewLabel: string) {
  const gl = glRef.current;
  if (!gl || !glRef.scene || !glRef.camera) throw new Error('El visor 3D no está disponible.');
  gl.render(glRef.scene, glRef.camera);
  const src = gl.domElement;
  if (src.width < 2 || src.height < 2) throw new Error('El visor no tiene tamaño visible: no se ha exportado nada.');
  const foot = Math.round(Math.max(48, src.height * 0.06));
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height + foot;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fefdfb';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0);
  // comprobación: la imagen no puede estar vacía (un único color)
  const sample = ctx.getImageData(0, 0, src.width, src.height).data;
  let varied = false;
  for (let i = 4; i < sample.length; i += 4 * 97) if (Math.abs(sample[i] - sample[0]) > 6 || Math.abs(sample[i + 1] - sample[1]) > 6) { varied = true; break; }
  if (!varied) throw new Error('La vista está vacía: no se ha exportado la imagen.');
  const fs = Math.round(foot * 0.32);
  ctx.fillStyle = '#252923';
  ctx.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText(`${projectName} · ${viewLabel} · ${variantName}`, fs, src.height + fs * 1.3);
  ctx.fillStyle = '#687066';
  ctx.font = `400 ${Math.round(fs * 0.8)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText(`Estudio v${APP_VERSION} · ${new Date().toLocaleString('es-ES')} · ${AVISO}`, fs, src.height + fs * 2.5);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo generar el PNG.'))), 'image/png'));
  download(exportName(slug(viewLabel), projectName, variantName, 'png'), blob);
}

export function exportSvg(layout: Layout, opts: Omit<PlanOptions, 'forExport' | 'overlay' | 'selection'>, variantName: string) {
  const svg = planSvg(layout, {
    ...opts, selection: null, overlay: null,
    forExport: { title: `${layout.name} · Planta`, subtitle: `${variantName} · estudio v${APP_VERSION} · ${new Date().toLocaleDateString('es-ES')}` },
  });
  download(exportName('planta', layout.name, variantName, 'svg'), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`, 'image/svg+xml');
}

export function exportJson(config: unknown, projectName: string, variantName: string) {
  download(exportName('configuracion', projectName, variantName, 'json'), JSON.stringify(config, null, 2), 'application/json');
}
