/**
 * Capturas de las vistas preparadas sobre la compilación (vite preview), para revisión visual.
 *   npm run build && node scripts/views.mjs [filtro] [--ambiente=dia|tarde|noche] [--opciones=json]
 * Guarda las imágenes en ./screenshots/vistas/.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4181;
const OUT = new URL('../screenshots/vistas/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('--')) ?? '';
const ambience = (args.find((a) => a.startsWith('--ambiente=')) ?? '--ambiente=dia').split('=')[1];
const options = JSON.parse((args.find((a) => a.startsWith('--opciones=')) ?? '--opciones={}').slice(11));
const suffix = (args.find((a) => a.startsWith('--sufijo=')) ?? '--sufijo=').split('=')[1];
const calidad = (args.find((a) => a.startsWith('--calidad=')) ?? '--calidad=alta').split('=')[1];
const model = (args.find((a) => a.startsWith('--modelo=')) ?? '--modelo=vinallop').split('=')[1];

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stop = () => { try { process.kill(-server.pid); } catch { /* ya detenido */ } };
process.on('exit', stop);
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview no arrancó')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/?diagnostico`);
await page.waitForFunction(() => document.querySelector('canvas') && !document.querySelector('.state-center.loading'), null, { timeout: 60000 });
await page.evaluate((m) => window.__store.getState().setVisual('modelSource', m), model);
await page.waitForTimeout(3000);
await page.evaluate(({ ambience, options, calidad }) => {
  const s = window.__store.getState();
  s.setVisual('helpDismissed', true);
  s.setVisual('quality', calidad);
  s.setVisual('ambience', ambience);
  s.setVisual('showLabels', false);
  s.setVisual('showDims', false);
  for (const [k, v] of Object.entries(options)) k === 'cubierta' ? s.setRoof(v) : s.setOption(k, v);
}, { ambience, options, calidad });
await page.waitForTimeout(1500);
const views = await page.evaluate(() => {
  // las vistas preparadas están en el proyecto activo
  const m = window.__visor;
  return m ? null : null;
});
void views;
const ids = await page.evaluate(() => [...document.querySelectorAll('[data-view]')].map((b) => [b.getAttribute('data-view'), b.getAttribute('data-view-tab')]));
let first = true;
for (const [id, tab] of ids) {
  if (filter && !id.includes(filter)) continue;
  await page.evaluate(({ id, tab }) => window.__store.getState().goView(id, tab), { id, tab });
  // la primera vista (y el cambio de modo) tarda más con el renderizado por software
  await page.waitForTimeout(first ? Number((args.find((a) => a.startsWith('--espera=')) ?? '--espera=9000').split('=')[1]) : 2600);
  first = false;
  if (errors.length) console.log('errores en', id, errors.slice(-3).join(' | ').slice(0, 600));
  // con el renderizado por software el bucle continuo no deja capturar: se congela el último fotograma
  await page.evaluate(() => window.__visor?.setFrameloop?.('never'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}${id}${suffix ? `-${suffix}` : ''}.png` });
  await page.evaluate(() => window.__visor?.setFrameloop?.('always'));
  console.log('✔', id);
}
if (errors.length) console.log('Errores:', errors.slice(0, 5).join('\n'));
await browser.close();
stop();
process.exit(0);
