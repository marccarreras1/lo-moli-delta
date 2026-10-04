/**
 * Pruebas de extremo a extremo sobre la aplicación compilada (vite preview).
 * Ejecuta tareas completas y guarda capturas reales en ./screenshots.
 *   npm run build && npm run e2e
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const OUT = new URL('../screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
// se detiene todo el grupo de procesos (npx y vite) al terminar
const stopServer = () => { try { process.kill(-server.pid); } catch { /* ya detenido */ } };
process.on('exit', stopServer);
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview no arrancó')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

async function newPage(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true, hasTouch: !!opts.touch, isMobile: !!opts.touch, ...opts.ctx });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${viewport.width}x${viewport.height}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${viewport.width}x${viewport.height} consola: ${m.text()}`); });
  return { ctx, page };
}

const waitReady = (page) => page.waitForFunction(() => document.querySelector('canvas') && !document.querySelector('.state-center.loading'), null, { timeout: 30000 });
/** Varianza de color del canvas: descarta imágenes vacías */
const canvasVaried = (page) => page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c || c.width < 2) return false;
  const t = document.createElement('canvas');
  t.width = 64; t.height = 64;
  const g = t.getContext('2d');
  g.drawImage(c, 0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64).data;
  const set = new Set();
  for (let i = 0; i < d.length; i += 4) set.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
  return set.size > 20;
});
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1);
const pause = (page, ms) => page.waitForTimeout(ms);

try {
  // ---------- 1. Escritorio: estado vacío ----------
  {
    const { ctx, page } = await newPage({ width: 1440, height: 900 });
    await page.goto(BASE);
    await waitReady(page);
    await pause(page, 1200);
    check('Abre con el modelo de Casa Vinallop', (await page.getByTestId('view-status').innerText()).includes('Casa Vinallop'));
    check('Casa Vinallop: el visor muestra contenido', await canvasVaried(page));
    check('Indicador «Guardado en este dispositivo»', (await page.getByTestId('save-status').innerText()).includes('Guardado en este dispositivo'));
    await page.screenshot({ path: `${OUT}v-01-exterior.png` });
    await page.click('[data-camera="fachada-A"]');
    await pause(page, 900);
    await page.screenshot({ path: `${OUT}v-02-frontal-a.png` });
    await page.click('[data-tab="plantas"]');
    await page.getByTestId('plan-svg').waitFor();
    await pause(page, 400);
    const planTxt = await page.getByTestId('plan-svg').innerText();
    check('Plano de planta baja con dormitorio, baño y zona de día', ['Dormitorio', 'Baño', 'Zona de día'].every((t) => planTxt.includes(t)));
    check('Trazos no interpretados marcados en el plano', planTxt.includes('sin interpretar'));
    await page.screenshot({ path: `${OUT}v-03-plano-planta-baja.png` });
    await page.locator('[data-control="level"] button', { hasText: 'Altell' }).click();
    await pause(page, 300);
    const altTxt = await page.getByTestId('plan-svg').innerText();
    check('Selector de nivel: plano del altell', altTxt.includes('Altell') && altTxt.includes('hueco de escalera') && !altTxt.includes('Dormitorio'));
    await page.screenshot({ path: `${OUT}v-04-plano-altell.png` });
    await page.click('[data-action="export-menu"]');
    const [svgA] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-svg"]')]);
    check('Exportar el plano del altell', svgA.suggestedFilename().includes('altell'), svgA.suggestedFilename());
    await page.locator('[data-control="level"] button', { hasText: 'Planta baja' }).click();
    await page.locator('[data-control="plan-layout"] button', { hasText: 'Cenital' }).click();
    await waitReady(page);
    await pause(page, 1200);
    await page.screenshot({ path: `${OUT}v-05-cenital.png` });
    await page.click('[data-tab="interior"]');
    await pause(page, 900);
    await page.selectOption('[data-control="interior-camera"]', 'int-altell-izq');
    await pause(page, 1000);
    check('Vista interior del altell', (await page.locator('.view-title').innerText()).includes('Altell'));
    await page.screenshot({ path: `${OUT}v-06-interior-altell.png` });
    await page.click('[data-tab="exterior"]');
    await page.click('[data-action="more-menu"]');
    await page.getByRole('menuitem', { name: 'Medidas y documentación' }).click();
    await page.getByTestId('info-dialog').waitFor();
    check('Preguntas abiertas visibles en «Medidas y documentación»', (await page.getByTestId('questions').innerText()).includes('ancho real'));
    await page.keyboard.press('Escape');

    // ---------- 2. Modelo de prueba (tareas de interfaz) ----------
    await page.click('[data-action="more-menu"]');
    await page.click('[data-action="source-prueba"]');
    await waitReady(page);
    await pause(page, 1200);
    check('Modelo de prueba identificado como ficticio', (await page.getByTestId('view-status').innerText()).includes('Modelo de prueba'));
    check('El visor 3D muestra contenido (no en blanco)', await canvasVaried(page));
    await page.screenshot({ path: `${OUT}02-exterior-1440.png` });

    // cubierta
    const roof = page.locator('[data-control="roof"]');
    await roof.uncheck({ force: true });
    await pause(page, 400);
    await page.screenshot({ path: `${OUT}03-sin-cubierta.png` });
    check('Ocultar cubierta', !(await roof.isChecked()));
    await roof.check({ force: true });
    check('Recuperar cubierta', await roof.isChecked());

    // muros atenuados y corte
    await page.locator('[data-control="mode"] button', { hasText: 'Atenuados' }).click();
    await pause(page, 400);
    await page.screenshot({ path: `${OUT}04-muros-atenuados.png` });
    await page.locator('[data-control="mode"] button', { hasText: 'Corte' }).click();
    await pause(page, 400);
    await page.screenshot({ path: `${OUT}05-corte.png` });
    check('Modo corte muestra el control de altura', await page.locator('[data-control="section"]').isVisible());
    await page.locator('[data-control="mode"] button', { hasText: 'Sólidos' }).click();

    // cámaras
    await page.click('[data-camera="fachada-principal"]');
    await pause(page, 900);
    await page.screenshot({ path: `${OUT}06-fachada-principal.png` });
    check('Posición de cámara guardada: fachada principal', (await page.locator('.view-title').innerText()).includes('Fachada principal'));
    await page.click('[data-action="fit"]');
    await pause(page, 800);
    await page.click('[data-action="reset-view"]');
    await pause(page, 800);
    check('Restablecer vista vuelve a la vista general', (await page.locator('.view-title').innerText()).includes('Vista general'));

    // materiales + deshacer
    await page.locator('[data-section="materiales"] > summary').click();
    const sw = page.locator('[data-finish="fachada:cal-arena"]');
    await sw.click();
    await pause(page, 300);
    check('Cambiar material de fachada', (await sw.getAttribute('aria-checked')) === 'true');
    await page.screenshot({ path: `${OUT}07-material-cambiado.png` });
    await page.click('[data-action="undo"]');
    await pause(page, 300);
    check('Deshacer el cambio de material', (await sw.getAttribute('aria-checked')) === 'false' && (await page.locator('[data-finish="fachada:revoco-blanco-roto"]').getAttribute('aria-checked')) === 'true');
    await page.click('[data-action="redo"]');
    check('Rehacer el cambio de material', (await sw.getAttribute('aria-checked')) === 'true');
    await page.click('[data-action="undo"]');

    // aberturas
    await page.locator('[data-section="aberturas"] > summary').click();
    await page.selectOption('[data-control="opening"]', 'cristalera');
    await page.click('[data-action="toggle-open"]');
    await pause(page, 2200);
    const freeTxt = await page.locator('[data-section="aberturas"] .hint.tnum').innerText();
    check('Abrir la cristalera corredera (paso libre > 0 y < luz)', /Paso libre (\d)/.test(freeTxt) && !freeTxt.startsWith('Paso libre 0,00'), freeTxt);
    await page.screenshot({ path: `${OUT}08-cristalera-abierta.png` });
    await page.click('[data-action="toggle-open"]');

    // variante sin tocar la base
    await page.click('[data-action="variant-from-opening"]');
    await pause(page, 300);
    const w = page.locator('[data-control="op-width"]');
    await w.fill('5,6');
    await w.press('Enter');
    await pause(page, 300);
    const facts = await page.getByTestId('selection').innerText();
    check('Editar la anchura en una variante', facts.includes('5,60'), facts.split('\n').slice(0, 4).join(' | '));
    check('La variante queda identificada', (await page.getByTestId('view-status').innerText()).includes('Variante:'));
    await page.selectOption('[data-control="variant"]', 'base');
    await pause(page, 300);
    check('La base conserva la anchura original (5,00 m)', (await page.getByTestId('selection').innerText()).includes('5,00'));
    const variantId = await page.locator('[data-control="variant"] option').nth(1).getAttribute('value');
    await page.selectOption('[data-control="variant"]', variantId);
    await w.fill('9');
    await w.press('Enter');
    await pause(page, 300);
    check('Hueco que sale del muro → conflicto señalado', (await page.getByTestId('view-status').innerText()).includes('conflicto'));
    await page.screenshot({ path: `${OUT}09-conflicto.png` });
    await w.fill('5,6');
    await w.press('Enter');

    // plantas
    await page.click('[data-tab="plantas"]');
    await page.locator('[data-control="plan-layout"] button', { hasText: 'Plano 2D' }).click();
    await page.getByTestId('plan-svg').waitFor();
    await pause(page, 300);
    check('Cambiar de modo conserva la variante', (await page.getByTestId('view-status').innerText()).includes('Variante:'));
    const box = await page.locator('polygon[data-room="sala"]').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.75);
    await pause(page, 300);
    check('Seleccionar estancia en el plano', (await page.getByTestId('selection').innerText()).includes('Sala'));
    await page.screenshot({ path: `${OUT}10-plano-seleccion.png` });
    await page.click('[data-action="locate-3d"]');
    await waitReady(page);
    await pause(page, 1000);
    check('Localizar la estancia en la vista 3D cenital', (await page.locator('canvas').isVisible()) && (await page.getByTestId('selection').innerText()).includes('Sala'));
    await page.screenshot({ path: `${OUT}11-cenital-3d.png` });

    // interior
    await page.click('[data-tab="interior"]');
    await pause(page, 900);
    await page.screenshot({ path: `${OUT}12-interior.png` });
    await page.selectOption('[data-control="interior-camera"]', 'int-sala');
    await pause(page, 900);
    await page.click('[data-action="step-forward"]');
    await pause(page, 700);
    check('Interior: punto de vista de la sala', (await page.locator('.view-title').innerText()).includes('Sala'));
    await page.screenshot({ path: `${OUT}13-interior-sala.png` });
    await page.click('[data-action="back-to-overview"]');
    await pause(page, 700);

    // exportaciones
    await page.click('[data-action="export-menu"]');
    const [png] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-png"]')]);
    const pngPath = `${OUT}export-vista.png`;
    await png.saveAs(pngPath);
    check('Exportar PNG de la vista', readFileSync(pngPath).length > 20000, `${png.suggestedFilename()} · ${readFileSync(pngPath).length} bytes`);
    await page.click('[data-action="export-menu"]');
    const [svg] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-svg"]')]);
    await svg.saveAs(`${OUT}export-planta.svg`);
    const svgTxt = readFileSync(`${OUT}export-planta.svg`, 'utf8');
    check('Exportar plano SVG con escala y versión', svgTxt.includes('<svg') && svgTxt.includes('Escala 1:50') && svgTxt.includes('estudio v'), svg.suggestedFilename());
    await page.click('[data-action="export-menu"]');
    const [json] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-json"]')]);
    await json.saveAs(`${OUT}export-config.json`);
    const cfg = JSON.parse(readFileSync(`${OUT}export-config.json`, 'utf8'));
    check('Exportar configuración JSON', cfg.app === 'casa-vinallop-estudio' && Object.keys(cfg.diseno).length > 0);

    // importación inválida no rompe nada
    writeFileSync(`${OUT}malo.json`, '{"app":"otra"');
    await page.setInputFiles('[data-testid="import-input"]', `${OUT}malo.json`);
    await pause(page, 300);
    check('JSON inválido: aviso y sin cambios', (await page.locator('.toast.error').innerText()).includes('No se ha cambiado nada') && (await page.getByTestId('view-status').innerText()).includes('Variante:'));
    await page.locator('.toast.error .icon-btn').click();
    // importación válida (cambia el material para comprobar que se aplica)
    const base = cfg.diseno['modelo-prueba'];
    base.variants[0].finishes.fachada = 'piedra-clara';
    writeFileSync(`${OUT}bueno.json`, JSON.stringify(cfg));
    await page.setInputFiles('[data-testid="import-input"]', `${OUT}bueno.json`);
    await pause(page, 400);
    check('Importar configuración válida', (await page.locator('.toast').innerText()).includes('importada'));

    // recarga: se recupera el estado
    await pause(page, 800);
    await page.reload();
    await waitReady(page);
    await pause(page, 600);
    check('Recargar recupera proyecto y variante', (await page.getByTestId('view-status').innerText()).includes('Variante:'));
    await page.locator('[data-section="materiales"] > summary').click();
    check('Recargar recupera los materiales importados', (await page.locator('[data-finish="fachada:piedra-clara"]').getAttribute('aria-checked')) === 'true');

    // panel plegable
    await page.click('[aria-label="Plegar panel de controles"]');
    check('Plegar el panel deja un botón para recuperarlo', await page.locator('[data-action="open-panel"]').isVisible());
    await page.screenshot({ path: `${OUT}14-panel-plegado.png` });
    await page.click('[data-action="open-panel"]');

    // teclado: diálogo con foco y Escape
    await page.click('[data-action="more-menu"]');
    await page.getByRole('menuitem', { name: 'Medidas y documentación' }).click();
    await page.getByTestId('info-dialog').waitFor();
    await page.screenshot({ path: `${OUT}15-medidas.png` });
    await page.keyboard.press('Escape');
    check('Escape cierra el diálogo', (await page.getByTestId('info-dialog').count()) === 0);
    await ctx.close();
  }

  // ---------- 3. Referencias (fotografías en IndexedDB) ----------
  {
    const { ctx, page } = await newPage({ width: 1280, height: 800 });
    await page.goto(BASE);
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 800; c.height = 500;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 800, 500);
      g.strokeStyle = '#222'; g.lineWidth = 6; g.strokeRect(50, 50, 700, 400);
      g.font = '28px sans-serif'; g.fillStyle = '#222'; g.fillText('boceto de prueba 7,00', 260, 40);
      return c.toDataURL('image/png').split(',')[1];
    });
    writeFileSync(`${OUT}boceto-prueba.png`, Buffer.from(png, 'base64'));
    await waitReady(page);
    await page.click('[data-action="more-menu"]');
    await page.getByRole('menuitem', { name: /Referencias/ }).click();
    await page.getByTestId('refs-dialog').waitFor();
    await page.setInputFiles('[data-testid="refs-input"]', `${OUT}boceto-prueba.png`);
    await page.locator('.ref-item').first().waitFor();
    check('Añadir fotografía de boceto (guardada en el dispositivo)', (await page.locator('.ref-item').count()) === 1);
    await page.getByRole('button', { name: 'Calibrar con una longitud conocida' }).click();
    const img = page.locator('.ref-image img');
    const b = await img.boundingBox();
    await page.mouse.click(b.x + b.width * (50 / 800), b.y + b.height * (450 / 500));
    await page.mouse.click(b.x + b.width * (750 / 800), b.y + b.height * (450 / 500));
    const len = page.locator('.calib .number-field input');
    await len.fill('7');
    await len.press('Enter');
    await page.locator('.calib input[placeholder^="p. ej."]').fill('cota 7,00 escrita en el boceto');
    await page.getByRole('button', { name: 'Guardar calibración' }).click();
    await pause(page, 300);
    check('Calibrar la escala con una longitud conocida', (await page.locator('.calib').innerText()).includes('Calibrada con 7,00 m'));
    await page.screenshot({ path: `${OUT}16-referencias.png` });
    await page.keyboard.press('Escape');
    await page.reload();
    await waitReady(page);
    await page.click('[data-action="more-menu"]');
    check('Las referencias persisten tras recargar', (await page.getByRole('menuitem', { name: /Referencias/ }).innerText()).includes('(1)'));
    await ctx.close();
  }

  // ---------- 4. Fallo de recurso: el motor 3D no carga ----------
  {
    const { ctx, page } = await newPage({ width: 1280, height: 800 });
    await page.addInitScript(() => localStorage.setItem('casa-vinallop/estudio/v2/visual', JSON.stringify({ modelSource: 'prueba' })));
    await page.route(/motor-3d.*\.js$/, (r) => r.abort());
    await page.goto(BASE);
    await page.getByText('No se ha podido iniciar el visor 3D').waitFor({ timeout: 15000 });
    check('Si falla el motor 3D se explica y se ofrece reintentar', await page.getByRole('button', { name: 'Reintentar' }).isVisible());
    await page.getByRole('button', { name: 'Ver el plano 2D' }).click();
    await page.getByTestId('plan-svg').waitFor();
    check('La aplicación sigue utilizable con el plano 2D', await page.getByTestId('plan-svg').isVisible());
    await page.screenshot({ path: `${OUT}17-fallo-recurso.png` });
    await ctx.close();
  }

  // ---------- 5. Sin WebGL ----------
  {
    const { ctx, page } = await newPage({ width: 1024, height: 768 });
    await page.addInitScript(() => {
      localStorage.setItem('casa-vinallop/estudio/v2/visual', JSON.stringify({ modelSource: 'prueba' }));
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : orig.call(this, t, ...a); };
    });
    await page.goto(BASE);
    await page.getByTestId('plan-svg').waitFor();
    check('Sin WebGL se muestra el plano 2D', (await page.locator('.callout.floating').innerText()).includes('plano 2D'));
    await ctx.close();
  }

  // ---------- 6. Resoluciones ----------
  const sizes = [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844], [360, 800], [844, 390]];
  for (const [wd, ht] of sizes) {
    const touch = wd < 768 || (wd === 844 && ht === 390);
    const { ctx, page } = await newPage({ width: wd, height: ht }, { touch });
    await page.goto(BASE);
    await waitReady(page);
    await pause(page, 1200);
    check(`${wd}×${ht}: sin desplazamiento horizontal`, await noHScroll(page));
    check(`${wd}×${ht}: visor con contenido`, await canvasVaried(page));
    await page.screenshot({ path: `${OUT}res-${wd}x${ht}.png` });
    if (wd < 768 || (wd === 844 && ht === 390)) {
      const sheet = page.getByTestId('bottom-sheet');
      const landscape = wd > ht;
      await page.click('[data-action="sheet-toggle"]');
      await pause(page, 300);
      if (landscape) {
        const sb = await sheet.boundingBox();
        check(`${wd}×${ht}: en horizontal el panel se abre a un lado`, (await sheet.getAttribute('data-state')) !== 'cerrado' && sb.width <= wd * 0.5, `${Math.round(sb.width)} px de ${wd}`);
        check(`${wd}×${ht}: el visor sigue con contenido con el panel abierto`, await canvasVaried(page));
        await page.screenshot({ path: `${OUT}res-${wd}x${ht}-panel.png` });
      } else {
        check(`${wd}×${ht}: panel inferior parcial`, (await sheet.getAttribute('data-state')) === 'parcial');
        const sh = await sheet.boundingBox();
        check(`${wd}×${ht}: el panel parcial deja ver la mayor parte de la casa`, sh.height < ht * 0.6, `${Math.round(sh.height)} px de ${ht}`);
        const handle = await page.locator('.sheet-handle').boundingBox();
        const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [handle.x + 20, handle.y + handle.height / 2]);
        check(`${wd}×${ht}: arrastrar el asa no llega al visor`, under !== 'CANVAS', `elemento bajo el asa: ${under}`);
        // arrastre real del asa: cambia el panel y no mueve la cámara guardada
        const camBefore = await page.evaluate(() => localStorage.getItem('casa-vinallop/estudio/v2/camaras'));
        await page.mouse.move(handle.x + 30, handle.y + 10);
        await page.mouse.down();
        await page.mouse.move(handle.x + 30, handle.y - 200, { steps: 8 });
        await page.mouse.up();
        await pause(page, 900);
        const camAfter = await page.evaluate(() => localStorage.getItem('casa-vinallop/estudio/v2/camaras'));
        check(`${wd}×${ht}: arrastrar el panel no mueve la cámara`, camBefore === camAfter && (await sheet.getAttribute('data-state')) === 'ampliado');
        await page.screenshot({ path: `${OUT}res-${wd}x${ht}-panel.png` });
        await page.click('[data-action="sheet-toggle"]');
        await page.click('[data-action="sheet-toggle"]');
        await pause(page, 300);
        await page.click('[data-action="sheet-toggle"]');
        await pause(page, 300);
        check(`${wd}×${ht}: panel inferior ampliado`, (await sheet.getAttribute('data-state')) === 'ampliado');
        await page.screenshot({ path: `${OUT}res-${wd}x${ht}-ampliado.png` });
      }
      const small = await page.evaluate(() => [...document.querySelectorAll('.sheet button, .sheet [role=switch], .topbar button')].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && (r.height < 36 || r.width < 36);
      }).map((b) => b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 6));
      check(`${wd}×${ht}: objetivos táctiles amplios`, small.length === 0, small.join(', '));
    }
    await ctx.close();
  }
} catch (e) {
  check('Ejecución sin excepciones', false, e.stack || String(e));
} finally {
  await browser.close();
  stopServer();
}

const relevantErrors = errors.filter((e) => !/motor-3d|Failed to fetch dynamically|ERR_FAILED|net::/.test(e) && !/WebGL|webgl/.test(e));
check('Sin errores de JavaScript en la consola', relevantErrors.length === 0, relevantErrors.slice(0, 5).join(' || '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones superadas.`);
writeFileSync(`${OUT}resultados.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
