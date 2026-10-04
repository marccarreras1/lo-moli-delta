/**
 * Renders fotográficos (trazado de rayos) de las vistas preparadas, sobre la compilación.
 * Son renders del MISMO modelo del estudio: misma geometría y materiales procedurales.
 *   npm run build && node scripts/renders.mjs [muestras=64] [filtro]
 * Guarda PNG en ./screenshots/renders/.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4184;
const OUT = new URL('../screenshots/renders/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const samples = Number(process.argv[2] ?? 64);
const filter = process.argv[3] ?? '';
const JOBS = [
  ['v12-bano-entrada', 'dia'], ['v12c-celosia', 'dia'], ['v04-solera', 'dia'], ['v05-algarrobo', 'dia'],
  ['v09-cocina-taburetes', 'dia'], ['v07-salon-ventanal', 'dia'], ['v13b-volta', 'dia'],
].filter(([v]) => v.includes(filter));

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stop = () => { try { process.kill(-server.pid); } catch { /* ya detenido */ } };
process.on('exit', stop);
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview no arrancó')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: Number(process.env.W ?? 1100), height: Number(process.env.H ?? 760) } })).newPage();
page.on('pageerror', (e) => console.log('error:', e.message));
page.on('console', (m) => { if (m.text().startsWith('[render]')) console.log(m.text()); });
await page.goto(`http://localhost:${PORT}/?diagnostico`);
await page.waitForFunction(() => document.querySelector('canvas') && !document.querySelector('.state-center.loading'), null, { timeout: 90000 });
await page.evaluate(() => {
  const s = window.__store.getState();
  s.setVisual('helpDismissed', true);
  s.setVisual('quality', 'ligera');
  s.setVisual('showLabels', false);
  s.setVisual('showDims', false);
  s.setVisual('showAreas', false);
});
const T = Date.now();
const log = (m) => console.log(`[${Math.round((Date.now() - T) / 1000)} s] ${m}`);
log('aplicación cargada');
for (const [view, amb] of JOBS) {
  const t0 = Date.now();
  await page.evaluate((a) => window.__store.getState().setVisual('ambience', a), amb);
  await page.evaluate((id) => {
    const v = window.__layout.views.find((x) => x.id === id);
    window.__store.getState().goView(id, v.group === 'interior' ? 'interior' : 'exterior');
  }, view);
  log(`vista ${view}`);
  // espera a que la cámara llegue a la posición de la vista y se detenga
  await page.waitForFunction((id) => {
    const v = window.__layout.views.find((x) => x.id === id);
    const c = window.__visor.camera.position;
    const [x, y, h] = v.position;
    const d = Math.hypot(c.x - x, c.z - y);
    const k = c.toArray().map((n) => n.toFixed(3)).join();
    const same = window.__lastCam === k;
    window.__lastCam = k;
    return same && (v.group === 'interior' ? d < 0.3 : true);
  }, view, { polling: 500, timeout: 60000 });
  log('cámara quieta');
  await page.waitForTimeout(1500);
  const interior = await page.evaluate(() => window.__store.getState().tab === 'interior');
  const data = await page.evaluate(async ([n, exposure]) => {
    const v = window.__visor;
    const mod = await window.__photoModule();
    v.setFrameloop('never');
    try {
      const amb = window.__store.getState().visual.ambience;
      const t0 = performance.now();
      const canvas = await mod.renderPhoto(v.gl, v.scene, v.camera, { samples: n, sky: amb, exposure, denoise: true, studioLights: exposure > 1 ? mod.studioLights(window.__layout) : undefined, onProgress: (d, t) => { if (d % 4 === 0 || d === 1 || d === t) console.log(`[render] ${d}/${t} · ${Math.round((performance.now() - t0) / 1000)} s`); } });
      return canvas.toDataURL('image/png');
    } finally {
      v.setFrameloop('always');
    }
  }, [samples, interior ? Number(process.env.EXP ?? 2.4) : 1]);
  const name = `${view}${amb === 'dia' ? '' : `-${amb}`}.png`;
  writeFileSync(OUT + name, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`✔ ${name} · ${samples} muestras · ${Math.round((Date.now() - t0) / 1000)} s`);
}
await browser.close();
stop();
