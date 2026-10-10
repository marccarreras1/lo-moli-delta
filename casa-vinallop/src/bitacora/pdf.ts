/**
 * PDF del registro de cambios (A4 vertical): cabecera con proyecto y fecha, y por cada entrada
 * fecha, categoría, título, descripción, notas y fotos (dos por fila, con su pie).
 */
import type { CambioEntrada } from './types';
import { CATEGORIAS } from './types';
import { fotos } from './store';

/** Las fuentes estándar de PDF solo cubren WinAnsi: se sustituyen los signos que no entran. */
export function pdfText(s: string): string {
  return s
    .replace(/≈/g, '~').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/←/g, '<-')
    .replace(/−/g, '-').replace(/[‐‑‒]/g, '-').replace(/[′]/g, "'").replace(/[″]/g, '"').replace(/✔/g, 'OK')
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, '');
}

const fmtFecha = (f: string) => {
  const [y, m, d] = f.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : f;
};

/** foto → JPEG reducido (lado mayor ≤ 1600 px) para que el PDF no pese demasiado */
async function jpeg(blob: Blob): Promise<{ data: string; w: number; h: number } | null> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height };
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

export async function cambiosPdf(entradas: CambioEntrada[], meta: { proyecto: string; filtro: string }): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = 210;
  const H = 297;
  const M = 16;
  const CW = W - 2 * M;
  let y = M;
  const ink = (g: number) => doc.setTextColor(g, g, g);
  const footer = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      ink(120);
      doc.text(pdfText(`${meta.proyecto} · Registro de cambios`), M, H - 8);
      doc.text(`${i} / ${n}`, W - M, H - 8, { align: 'right' });
    }
  };
  const ensure = (h: number) => { if (y + h > H - 16) { doc.addPage(); y = M; } };
  const para = (text: string, size: number, opts: { bold?: boolean; gray?: number; gap?: number } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    ink(opts.gray ?? 30);
    const lines = doc.splitTextToSize(pdfText(text), CW) as string[];
    const lh = size * 0.42;
    for (const l of lines) { ensure(lh); doc.text(l, M, y + lh * 0.8); y += lh; }
    y += opts.gap ?? 1.5;
  };

  // cabecera
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  ink(25);
  doc.text(pdfText(meta.proyecto), M, y + 7);
  y += 11;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('Registro de cambios', M, y + 4);
  y += 8;
  para(`Generado el ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · ${entradas.length} ${entradas.length === 1 ? 'entrada' : 'entradas'}${meta.filtro ? ` · ${meta.filtro}` : ''}`, 9, { gray: 110, gap: 2 });
  para('Cambios del estudio a partir del modelo y entradas de la propiedad. Las medidas son de estudio: no es un proyecto técnico de ejecución.', 8.5, { gray: 110, gap: 4 });
  doc.setDrawColor(40);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 6;

  for (const e of entradas) {
    ensure(24);
    // fecha y categoría
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    ink(110);
    doc.text(pdfText(`${fmtFecha(e.fecha).toUpperCase()}  ·  ${CATEGORIAS[e.categoria].toUpperCase()}${e.origen === 'propiedad' ? '  ·  PROPIEDAD' : ''}`), M, y + 3);
    y += 5.5;
    para(e.titulo, 12.5, { bold: true, gray: 20, gap: 1.2 });
    if (e.descripcion.trim()) para(e.descripcion, 9.5, { gray: 45, gap: 2 });
    if (e.notas.trim()) {
      ensure(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      ink(90);
      doc.text('NOTAS', M, y + 3);
      y += 5;
      para(e.notas, 9.5, { gray: 35, gap: 2 });
    }
    // fotos, dos por fila
    if (e.fotos.length) {
      const colW = (CW - 6) / 2;
      for (let i = 0; i < e.fotos.length; i += 2) {
        const row = e.fotos.slice(i, i + 2);
        const imgs = await Promise.all(row.map(async (f) => { const b = await fotos.get(f.id).catch(() => undefined); return b ? jpeg(b) : null; }));
        const hs = imgs.map((im) => (im ? Math.min(colW * (im.h / im.w), 95) : 0));
        const rowH = Math.max(...hs, 0) + 8;
        ensure(rowH);
        row.forEach((f, k) => {
          const im = imgs[k];
          const x = M + k * (colW + 6);
          if (im) {
            const w = Math.min(colW, hs[k] * (im.w / im.h));
            doc.addImage(im.data, 'JPEG', x, y, w, hs[k]);
          } else {
            doc.setDrawColor(180);
            doc.rect(x, y, colW, 20);
            doc.setFontSize(8);
            ink(130);
            doc.text('Foto no disponible en este dispositivo', x + 3, y + 11);
          }
          if (f.pie.trim()) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            ink(90);
            doc.text(doc.splitTextToSize(pdfText(f.pie), colW).slice(0, 1), x, y + (im ? hs[k] : 20) + 4);
          }
        });
        y += rowH + 2;
      }
    }
    y += 3;
    doc.setDrawColor(215);
    doc.setLineWidth(0.2);
    ensure(4);
    doc.line(M, y, W - M, y);
    y += 6;
  }
  footer();
  return doc.output('blob');
}
