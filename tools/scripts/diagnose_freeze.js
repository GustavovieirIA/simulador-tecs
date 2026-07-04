// Diagnóstico do congelamento: instrumenta as funções por frame e detecta
// onde o thread principal trava. Uso: node tools/diagnose_freeze.js
import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://localhost:5175/';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 30000, args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));
  page.on('console', msg => {
    const t = msg.text();
    if (t.startsWith('[DIAG]')) console.log(t);
  });

  await page.goto(url, { waitUntil: 'networkidle0' });

  await page.evaluate(() => {
    const g = window.game;
    window._frames = 0;
    window._checkpoint = 'none';

    // Marca checkpoints dentro do update para saber onde trava
    const wrap = (obj, name, label) => {
      const orig = obj[name].bind(obj);
      obj[name] = (...args) => {
        window._checkpoint = label + ':in';
        const r = orig(...args);
        window._checkpoint = label + ':out';
        return r;
      };
    };

    wrap(g.tractor, 'update', 'tractor');
    wrap(g.tractor, 'interactWithTerrain', 'terrain-interact');
    wrap(g.autopilot, 'update', 'autopilot');
    wrap(g.hud, 'update', 'hud');
    wrap(g, 'resolveTruckCollisions', 'collisions');
    wrap(g, 'checkDidacticRules', 'coach');
    wrap(g, 'checkTruckSafety', 'trucksafety');
    wrap(g, 'checkQuizTriggers', 'quiz');
    wrap(g, 'render', 'render');

    const origLoop = g.update.bind(g);
    g.update = (dt) => {
      window._frames++;
      window._checkpoint = 'update:in';
      origLoop(dt);
      window._checkpoint = 'update:out';
    };

    // Observa long tasks
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.duration > 500) {
            console.log(`[DIAG] LONGTASK ${Math.round(e.duration)}ms depois de ${window._checkpoint}`);
          }
        }
      }).observe({ entryTypes: ['longtask'] });
    } catch (e) {}
  });

  let lastFrames = 0;
  const start = Date.now();

  while (Date.now() - start < 120000) {
    await new Promise(r => setTimeout(r, 2000));
    let s;
    try {
      s = await Promise.race([
        page.evaluate(() => ({
          frames: window._frames,
          cp: window._checkpoint,
          st: window.game.autopilot.state,
          phase: window.game.state.phase,
          pos: `${Math.round(window.game.tractor.x)},${Math.round(window.game.tractor.y)}`,
          trucks: window.game.trucks.map(t => `${t.state}@${Math.round(t.x)},${Math.round(t.y)}`).join(' ')
        })),
        new Promise((_, rej) => setTimeout(() => rej(new Error('EVAL_STUCK')), 5000))
      ]);
    } catch (e) {
      console.log(`[${Math.round((Date.now() - start) / 1000)}s] *** PÁGINA TRAVADA (evaluate não responde) ***`);
      continue;
    }
    const fps = (s.frames - lastFrames) / 2;
    console.log(`[${Math.round((Date.now() - start) / 1000)}s] fps=${fps.toFixed(0)} cp=${s.cp} st=${s.st} phase=${s.phase} pos=(${s.pos}) trucks=[${s.trucks}]`);
    lastFrames = s.frames;

    if (s.st === 'DONE' && s.phase === 'WAITING_TRUCKS') {
      console.log('Demo terminou sem travar.');
      break;
    }
  }

  await browser.close();
})();
