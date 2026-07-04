// Playtest do TURNO DO JOGADOR: um "operador perfeito" (o autopilot) joga a
// batelada completa de 5 caminhões com as regras do jogador (quizzes, coach,
// perímetro de segurança, relógio) e mede os KPIs finais.
// Uso: node tools/validate_player.js [url]
import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://localhost:5175/';

// Respostas corretas dos quizzes (trecho do texto)
const CORRECT = ['0cm (Transportar)', '1/3 da lâmina livre', '30cm para soltar', 'marcha à ré'];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));

  await page.goto(url, { waitUntil: 'networkidle0' });

  // Assume o comando imediatamente (pula a demo) e liga o "operador perfeito":
  // o autopilot alimenta o input do jogador, mas SEM o modo demo — quizzes,
  // coach e violações valem como para um jogador real.
  await page.evaluate(() => {
    document.getElementById('btn-take-control').click();
    const g = window.game;
    g.autopilot = new g.autopilot.constructor();

    const origUpdate = g.update.bind(g);
    g.update = (dt) => {
      // Opera apenas quando a batelada está pronta (como o jogador faria)
      if (!g.state.isDemo && g.state.phase === 'READY') {
        // Nova batelada na praça? Volta a trabalhar
        if (g.autopilot.state === 'DONE') {
          const terr = g.terrain;
          let loose = false;
          for (let y = Math.floor(terr.height * 0.8); y < terr.height && !loose; y++) {
            for (let x = 0; x < terr.width; x++) {
              if (terr.cells[y][x].height > 0.1) { loose = true; break; }
            }
          }
          if (loose) g.autopilot.state = 'SCAN';
        }
        g.autopilot.update(dt, g.tractor, g.terrain, null); // null: sem narração
        g.input.keys = { ...g.autopilot.input.keys };
      }
      origUpdate(dt);
    };
    window._patched = true;
  });

  const start = Date.now();
  let last = '';
  let finished = false;
  const events = [];

  while (Date.now() - start < 400000) {
    const s = await page.evaluate(() => {
      const g = window.game;
      const quizVisible = document.getElementById('quiz-modal').style.display === 'flex';
      const quizText = quizVisible ? document.getElementById('quiz-question').textContent : '';
      return {
        st: g.autopilot.state,
        phase: g.state.phase,
        batch: g.state.batch,
        load: +g.tractor.trashInBlade.toFixed(1),
        x: Math.round(g.tractor.x),
        y: Math.round(g.tractor.y),
        viol: g.tractor.safetyViolations,
        t: Math.round(g.gameTime),
        quizVisible, quizText
      };
    });

    // Responde quizzes como um jogador atento
    if (s.quizVisible) {
      events.push(`[${s.t}s] QUIZ: ${s.quizText.slice(0, 50)}...`);
      await page.evaluate((corrects) => {
        const btns = Array.from(document.querySelectorAll('.quiz-option'));
        const btn = btns.find(b => corrects.some(c => b.textContent.includes(c)));
        if (btn) btn.click();
      }, CORRECT);
      await new Promise(r => setTimeout(r, 1800));
      continue;
    }

    const line = `${s.st} phase=${s.phase} batch=${s.batch} load=${s.load} viol=${s.viol} pos=(${s.x},${s.y})`;
    if (line !== last) {
      console.log(`[${s.t}s game / ${Math.round((Date.now() - start) / 1000)}s real]`, line);
      last = line;
    }

    // Turno completo: batelada 5/5 despejada e autopilot terminou
    if (s.batch >= 5 && s.st === 'DONE' && s.phase === 'READY') {
      await page.evaluate(() => window.game.finishShift());
      finished = true;
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(finished ? '\n=== TURNO CONCLUÍDO ===' : '\n=== TIMEOUT ===');
  events.forEach(e => console.log(e));

  const result = await page.evaluate(() => {
    const g = window.game;
    const bands = { LOOSE: 0, WORKING: 0, IDEAL: 0, OVER: 0, WASTE: 0 };
    let covered = 0, leftoverBase = 0, totalMass = 0;
    const terr = g.terrain;
    for (let y = 0; y < terr.height; y++) {
      for (let x = 0; x < terr.width; x++) {
        const c = terr.cells[y][x];
        totalMass += c.height;
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
      totalMass: +totalMass.toFixed(1),
      bladeLoad: +g.tractor.trashInBlade.toFixed(2),
      gameTime: Math.round(g.gameTime),
      violations: g.tractor.safetyViolations,
      kpis: {
        prod: document.getElementById('kpi-prod').textContent,
        qual: document.getElementById('kpi-qual').textContent,
        safe: document.getElementById('kpi-safe').textContent,
        time: document.getElementById('kpi-time').textContent
      },
      reportVisible: document.getElementById('report-modal').style.display
    };
  });

  console.log('\nKPIs:', JSON.stringify(result.kpis));
  console.log('Tempo de jogo:', result.gameTime, 's | Violações:', result.violations);
  console.log('Bandas:', JSON.stringify(result.bands), '| cobertas:', result.covered);
  console.log('Sobras na base:', result.leftoverBase, '| massa total:', result.totalMass, 'm³ (despejado: 22.5)');
  console.log('Carga final na lâmina:', result.bladeLoad);

  await page.screenshot({ path: 'tools/player_result.png' });
  console.log('Screenshot: tools/player_result.png');

  await browser.close();
})();
