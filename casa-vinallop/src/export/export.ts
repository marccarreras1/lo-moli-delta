/** Exportaciones: PNG de la vista, planta SVG y configuración JSON. */
import type { Layout } from '../data/types';
import { planSvg, type PlanOptions } from '../plan/planSvg';
import { bathPlanSvg } from '../plan/bathPlan';
import { glRef } from '../viewer/support';

export const AVISO = 'Modelo de estudio y visualización. No es un proyecto técnico de ejecución.';
export const APP_VERSION = '0.3.0';

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function exportName(kind: string, projectName: string, variantName: string, ext: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `${slug(projectName)}_v${slug(APP_VERSION)}_${slug(variantName)}_${slug(kind)}_${date}.${ext}`;
}

/**
 * Cómo se entregan los archivos:
 *  - «claude»: dentro de claude.ai, con la capacidad «downloads» (el visitante confirma la descarga);
 *  - «enlace»: fuera de claude.ai (desarrollo local o servidor propio), con un enlace de descarga;
 *  - «no»: la vista no permite descargar: se ocultan los botones.
 */
export type ExportMode = 'claude' | 'enlace' | 'no';
interface DownloadsApi { save: (r: { filename: string; data: Blob | string | ArrayBuffer }) => Promise<{ status: string }> }
let downloadsApi: DownloadsApi | null = null;

export async function detectExport(): Promise<ExportMode> {
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) return 'enlace';
  try {
    downloadsApi = (await claude.use('downloads')) as DownloadsApi | null;
  } catch {
    downloadsApi = null;
  }
  return downloadsApi ? 'claude' : 'no';
}

export async function download(name: string, data: Blob | string, type = 'application/octet-stream') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  if (downloadsApi) {
    try {
      await downloadsApi.save({ filename: name, data: blob });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'declined') throw new Error('Descarga cancelada.');
      throw new Error(code === 'rejected_extension' ? 'Este formato no se puede descargar desde esta vista.' : 'No se pudo descargar el archivo en esta vista.');
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * PNG de la vista actual con un pie que identifica proyecto, vista, variante y versión.
 * `scale` > 1 genera una captura de alta resolución (se vuelve a dibujar a más píxeles y se
 * restaura el visor), distinta del modo interactivo.
 */
export async function exportPng(projectName: string, variantName: string, viewLabel: string, scale = 1) {
  const gl = glRef.current;
  if (!gl || !glRef.scene || !glRef.camera) throw new Error('El visor 3D no está disponible.');
  const prevRatio = gl.getPixelRatio();
  // sin importar three aquí (se carga solo con el visor)
  const size = { x: Math.round(gl.domElement.width / prevRatio), y: Math.round(gl.domElement.height / prevRatio) };
  const target = Math.min(scale, 4096 / Math.max(size.x, size.y));
  if (scale > 1 && target > prevRatio) {
    gl.setPixelRatio(target);
    gl.setSize(size.x, size.y, false);
  }
  gl.render(glRef.scene, glRef.camera);
  const src = document.createElement('canvas');
  src.width = gl.domElement.width;
  src.height = gl.domElement.height;
  src.getContext('2d')!.drawImage(gl.domElement, 0, 0);
  if (gl.getPixelRatio() !== prevRatio) {
    gl.setPixelRatio(prevRatio);
    gl.setSize(size.x, size.y, false);
    gl.render(glRef.scene, glRef.camera);
  }
  await savePngWithFooter(src, projectName, variantName, viewLabel, scale > 1 ? '-alta' : '');
}

/** Añade el pie (proyecto, vista, variante, aviso) a una imagen del visor y la descarga en PNG. */
export async function savePngWithFooter(src: HTMLCanvasElement, projectName: string, variantName: string, viewLabel: string, suffix = '', extra = '') {
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
  ctx.fillText(`${extra ? `${extra} · ` : ''}Estudio v${APP_VERSION} · ${new Date().toLocaleString('es-ES')} · ${AVISO}`, fs, src.height + fs * 2.5);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo generar el PNG.'))), 'image/png'));
  await download(exportName(`${slug(viewLabel)}${suffix}`, projectName, variantName, 'png'), blob);
}

/**
 * Modelo 3D en GLB con materiales y texturas, dentro de un ZIP (el formato GLB no se puede
 * descargar directamente desde claude.ai). Se exporta la escena tal como se ve.
 */
export async function exportGlb(projectName: string, variantName: string) {
  const scene = glRef.scene;
  if (!scene) throw new Error('El visor 3D no está disponible.');
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();
  const glb = (await exporter.parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 1024 })) as ArrayBuffer;
  const name = exportName('modelo', projectName, variantName, 'glb');
  const readme = `${projectName} · ${variantName}\nModelo 3D exportado desde el estudio v${APP_VERSION} el ${new Date().toLocaleString('es-ES')}.\nUnidades: metros. Eje Y hacia arriba.\n${AVISO}\n`;
  const zip = makeZip([{ name, data: new Uint8Array(glb) }, { name: 'LEEME.txt', data: new TextEncoder().encode(readme) }]);
  await download(name.replace(/\.glb$/, '.zip'), new Blob([zip], { type: 'application/zip' }));
}

/** ZIP sin compresión (método «store»): suficiente para empaquetar el GLB. */
function makeZip(files: { name: string; data: Uint8Array }[]) {
  const crcTable = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (d: Uint8Array) => {
    let c = 0xffffffff;
    for (let i = 0; i < d.length; i++) c = crcTable[(c ^ d[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((a, p) => a + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

export async function exportSvg(layout: Layout, opts: Omit<PlanOptions, 'forExport' | 'overlay' | 'selection'>, variantName: string) {
  const svg = planSvg(layout, {
    ...opts, selection: null, overlay: null,
    forExport: { title: `${layout.name} · ${(layout.levels.find((l) => l.id === opts.levelId) ?? layout.levels[0])?.name ?? 'Planta'}`, subtitle: `${variantName} · estudio v${APP_VERSION} · ${new Date().toLocaleDateString('es-ES')}` },
  });
  await download(exportName(`planta-${(layout.levels.find((l) => l.id === opts.levelId) ?? layout.levels[0])?.name ?? ''}`, layout.name, variantName, 'svg'), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`, 'image/svg+xml');
}

export async function exportElevationsSvg(layout: Layout, variantName: string, finishes?: Record<string, string>) {
  const { elevationSvg, FACADES } = await import('../plan/elevationSvg');
  for (const f of FACADES) {
    const svg = elevationSvg(layout, f.id, { forExport: true, variantName, finishes });
    // pausa corta entre descargas: algunos navegadores bloquean varias seguidas
    if (f !== FACADES[0]) await new Promise((r) => setTimeout(r, 400));
    await download(exportName(`alzado-${f.id === 'A' || f.id === 'B' ? `frontal-${f.id}` : `lateral-${f.id}`}`, layout.name, variantName, 'svg'), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`, 'image/svg+xml');
  }
}

export async function exportSheetSet(layout: Layout, variantName: string, finishes?: Record<string, string>) {
  const { sheetSet } = await import('../plan/sheets');
  const sheets = sheetSet(layout, { forExport: true, variantName, finishes });
  for (const [i, s] of sheets.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 400));
    await download(exportName(`${s.id}-${s.name}`, layout.name, variantName, 'svg'), `<?xml version="1.0" encoding="UTF-8"?>\n${s.svg}`, 'image/svg+xml');
  }
}

export async function exportBathSvg(layout: Layout, variantName: string) {
  const svg = bathPlanSvg(layout, { forExport: true });
  if (!svg) throw new Error('El proyecto no tiene baño.');
  await download(exportName('bano-acotado', layout.name, variantName, 'svg'), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`, 'image/svg+xml');
}

export async function exportJson(config: unknown, projectName: string, variantName: string) {
  await download(exportName('configuracion', projectName, variantName, 'json'), JSON.stringify(config, null, 2), 'application/json');
}
