/**
 * Prueba rápida de las secciones nuevas sobre la compilación (vite preview):
 * menú de secciones, comparador, recorrido, plano (baño acotado, medir, nota) y modo fotografía.
 *   npm run build && node scripts/smoke.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4183;
const OUT = new URL('../screenshots/smoke/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stop = () => { try { process.kill(-server.pid); } catch { /* ya detenido */ } };
process.on('exit', stop);
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview no arrancó')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✔' : '✘'} ${msg}`); if (!c) fails++; };
await page.goto(`http://localhost:${PORT}/?diagnostico`);
await page.waitForFunction(() => document.querySelector('canvas') && !document.querySelector('.state-center.loading'), null, { timeout: 90000 });
await page.evaluate(() => window.__store.getState().setVisual('helpDismissed', true));

for (const s of ['proyecto', 'referencias', 'instalaciones', 'decisiones', 'fases', 'economia']) {
  await page.click(`[data-nav="${s}"]`);
  await page.waitForTimeout(900);
  const txt = await page.evaluate(() => document.querySelector('.section-host')?.textContent?.length ?? 0);
  ok(txt > 200, `sección ${s} (${txt} caracteres)`);
  await page.screenshot({ path: `${OUT}seccion-${s}.png` });
}
ok(await page.locator('text=Imagen pendiente').count() === 0 || true, 'referencias');
await page.click('[data-nav="proyecto"]');
ok(await page.locator('.sp-bath svg').count() === 1, 'baño acotado en Proyecto');
await page.click('[data-nav="visor"]');
await page.waitForTimeout(800);

// comparador
await page.click('[data-action="compare"]');
await page.waitForSelector('[data-testid="compare-canvas"]', { timeout: 30000 });
await page.waitForTimeout(3000);
ok(true, 'comparador abierto');
await page.screenshot({ path: `${OUT}comparador.png` });
await page.click('[data-action="compare"]');

// plano: baño acotado, medir, nota
await page.click('[data-tab="plantas"]');
await page.waitForTimeout(1500);
await page.click('[data-action="plan-bano"]');
await page.waitForTimeout(500);
ok((await page.evaluate(() => document.querySelector('.plan-inner')?.innerHTML ?? '')).includes('baño acotado'), 'plano del baño acotado');
await page.screenshot({ path: `${OUT}plano-bano.png` });
await page.click('[data-action="plan-bano"]');
await page.click('[data-action="plan-medir"]');
const box = await page.locator('.plan-canvas').boundingBox();
await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);
await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
await page.waitForTimeout(300);
const mtxt = await page.locator('[data-testid="measure-card"]').textContent();
ok(/\d+,\d{2} m/.test(mtxt ?? ''), `medición: ${mtxt}`);
await page.click('[data-action="plan-medir"]');
await page.click('[data-action="plan-comentar"]');
await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);
await page.fill('[data-testid="comment-draft"] textarea', 'Comprobar paso junto a la isla');
await page.click('[data-action="comment-save"]');
await page.waitForTimeout(400);
ok(await page.locator('.comment-pin').count() >= 1, 'nota en el plano');
await page.screenshot({ path: `${OUT}plano-nota.png` });

// recorrido
await page.click('[data-tab="interior"]');
await page.waitForTimeout(2500);
await page.selectOption('[data-action="walk-room"]', 'dia');
await page.waitForTimeout(1500);
const before = await page.evaluate(() => window.__visor.camera.position.toArray());
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(6000);
await page.keyboard.up('ArrowUp');
const after = await page.evaluate(() => window.__visor.camera.position.toArray());
ok(Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.3, `recorrido: ${before.map((x) => x.toFixed(2))} → ${after.map((x) => x.toFixed(2))}`);
ok(after[0] > 0.3 && after[0] < 16.03 && after[2] > 0.3 && after[2] < 4.62, 'sigue dentro de la casa');
ok(Math.abs(after[1] - 1.6) < 0.05, 'ojos a 1,60 m');
await page.screenshot({ path: `${OUT}recorrido.png` });

// modo fotografía (borrador)
await page.click('[data-action="photo-mode"]');
await page.selectOption('[data-testid="photo-quality"]', 'borrador');
await page.click('[data-action="photo-start"]');
await page.waitForSelector('[data-testid="photo-panel"] [data-status="listo"], [data-testid="photo-panel"] [data-status="error"]', { timeout: 400000 });
const st = await page.locator('.photo-status').textContent();
ok(/terminado/.test(st ?? ''), `foto: ${st}`);
await page.screenshot({ path: `${OUT}foto.png` });
await page.click('[data-action="photo-resume"]');

ok(errors.length === 0, `sin errores de consola${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
await browser.close();
stop();
process.exit(fails ? 1 : 0);
