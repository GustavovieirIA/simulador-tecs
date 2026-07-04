// Valida a demonstração do autopilot de ponta a ponta (headless).
// Uso: node tools/validate_demo.js [url]
import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://localhost:5175/';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));

  await page.goto(url, { waitUntil: 'networkidle0' });

  const start = Date.now();
  let last = '';
  let done = false;

  while (Date.now() - start < 180000) {
    const s = await page.evaluate(() => {
      const g = window.game;
      if (!g) return null;
      return {
        st: g.autopilot.state,
        phase: g.state.phase,
        demo: g.state.isDemo,
        load: +g.tractor.trashInBlade.toFixed(1),
        x: Math.round(g.tractor.x),
        y: Math.round(g.tractor.y),
        blade: g.tractor.bladeHeight,
        gear: g.tractor.gear,
        viol: g.tractor.safetyViolations,
        t: Math.round(g.gameTime)
      };
    });
    if (s) {
      const line = `${s.st} phase=${s.phase} load=${s.load} blade=${s.blade} gear=${s.gear} pos=(${s.x},${s.y})`;
      if (line !== last) {
        console.log(`[${Math.round((Date.now() - start) / 1000)}s]`, line);
        last = line;
      }
      if (!s.demo) { done = true; break; }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(done ? '\n=== DEMO CONCLUÍDA ===' : '\n=== TIMEOUT: demo não terminou em 180s ===');

  // Estatísticas do terreno após a demo
  const stats = await page.evaluate(() => {
    const g = window.game;
    const bands = { LOOSE: 0, WORKING: 0, IDEAL: 0, OVER: 0, WASTE: 0 };
    let covered = 0, leftoverBase = 0;
    const terr = g.terrain;
    for (let y = 0; y < terr.height; y++) {
      for (let x = 0; x < terr.width; x++) {
        const c = terr.cells[y][x];
        if (c.height > 0.01) {
          covered++;
          const p = c.passes;
          const band = p < 0.5 ? 'LOOSE' : p < 3 ? 'WORKING' : p <= 6 ? 'IDEAL' : p <= 8 ? 'OVER' : 'WASTE';
          bands[band]++;
          if (y >= terr.height * 0.8) leftoverBase++;
        }
      }
    }
    return {
      bands, covered, leftoverBase,
      bladeLoad: +g.tractor.trashInBlade.toFixed(2),
      radioMsgs: Array.from(document.querySelectorAll('#radio-messages p')).map(p => p.textContent)
    };
  });

  console.log('\nCélulas cobertas:', stats.covered);
  console.log('Bandas:', JSON.stringify(stats.bands));
  console.log('Sobras na base (zona de descarga):', stats.leftoverBase);
  console.log('Carga na lâmina ao entregar:', stats.bladeLoad);
  console.log('\nRádio:');
  stats.radioMsgs.forEach(m => console.log(' -', m));

  await page.screenshot({ path: 'tools/demo_result.png' });
  console.log('\nScreenshot: tools/demo_result.png');

  await browser.close();
})();
