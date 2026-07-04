import { BLADE, SHIFT, DIESEL } from '../config/params.js';

const MAX_RADIO_MESSAGES = 8;

export class HUD {
  constructor() {
    this.gearValue = document.getElementById('gear-value');
    this.bladeValue = document.getElementById('blade-value');
    this.bladeBar = document.getElementById('blade-bar');
    this.loadBar = document.getElementById('load-bar');
    this.loadValue = document.getElementById('load-value');
    this.batchValue = document.getElementById('batch-value');
    this.timeValue = document.getElementById('time-value');
    this.dieselValue = document.getElementById('diesel-value');
    this.radioMessages = document.getElementById('radio-messages');
    this.toast = document.getElementById('alert-toast');
    this.toastTimeout = null;

    // Guardas de escrita no DOM: só toca o elemento quando o valor muda
    this.last = { gear: null, blade: null, load: null, batch: null, time: null, diesel: null };

    this.minimapCanvas = document.getElementById('minimapCanvas');
    if (this.minimapCanvas) {
      this.minimapCtx = this.minimapCanvas.getContext('2d');
      this.minimapCtx.imageSmoothingEnabled = false;
      // Cache do minimapa: as 2400 células só são redesenhadas a cada N frames
      this.minimapCache = document.createElement('canvas');
      this.minimapCache.width = this.minimapCanvas.width;
      this.minimapCache.height = this.minimapCanvas.height;
      this.minimapFrame = 0;
    }
  }

  update(game) {
    if (!game.tractor) return;
    const t = game.tractor;

    if (t.gear !== this.last.gear) {
      this.last.gear = t.gear;
      this.gearValue.textContent = t.gear;
    }

    if (t.bladeHeight !== this.last.blade) {
      this.last.blade = t.bladeHeight;
      this.bladeValue.textContent = t.bladeHeight;
      this.bladeBar.style.height = `${(t.bladeHeight / 30) * 100}%`;
    }

    // Carga da lâmina (quantizada em 2% para não escrever todo frame)
    if (this.loadBar) {
      const ratio = Math.min(1, t.trashInBlade / BLADE.CAPACITY);
      const pct = Math.round(ratio * 50) * 2;
      if (pct !== this.last.load) {
        this.last.load = pct;
        this.loadBar.style.height = `${pct}%`;
        this.loadBar.style.backgroundColor = pct >= 100 ? 'var(--accent-red)' : 'var(--accent-orange)';
        this.loadValue.textContent = `${pct}%`;
      }
    }

    const batchTxt = `${game.state.batch}/${game.state.maxBatch}`;
    if (batchTxt !== this.last.batch) {
      this.last.batch = batchTxt;
      this.batchValue.textContent = batchTxt;
    }

    // Tempo do turno vs meta (o jogador gerencia o turno como o operador real)
    if (this.timeValue) {
      const s = Math.floor(game.gameTime);
      if (s !== this.last.time) {
        this.last.time = s;
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        const mM = String(Math.floor(SHIFT.EXPECTED_TIME / 60)).padStart(2, '0');
        this.timeValue.textContent = `${mm}:${ss}`;
        this.timeValue.style.color =
          s > SHIFT.EXPECTED_TIME ? 'var(--accent-red)'
          : s > SHIFT.EXPECTED_TIME * 0.75 ? 'var(--accent-orange)' : '';
        const metaEl = document.getElementById('time-meta');
        if (metaEl && metaEl.textContent !== `meta ${mM}:00`) metaEl.textContent = `meta ${mM}:00`;
      }
    }

    // Diesel ao vivo
    if (this.dieselValue) {
      const d = Math.round(t.dieselUsed * 10) / 10;
      if (d !== this.last.diesel) {
        this.last.diesel = d;
        this.dieselValue.textContent = `${d.toFixed(1)}L`;
        this.dieselValue.style.color = d > DIESEL.REF ? 'var(--accent-red)' : '';
      }
    }

    // Minimap (simplified top-down view)
    if (this.minimapCtx && game.terrain) {
      this.drawMinimap(game.terrain, game.tractor, game);
    }

    // Objetivo da missão acompanha a fase da operação
    this.updateMission(game);
  }

  updateMission(game) {
    const el = document.getElementById('mission-objective');
    if (!el) return;
    let txt;
    if (game.state.phase !== 'READY' && game.state.phase !== 'DONE') {
      txt = `Objetivo: batelada chegando (${game.state.batch}/${game.state.maxBatch} caminhões). Aguarde fora do perímetro de segurança.`;
    } else if (game.terrain && game.distanceToNearestLoosePile() !== Infinity) {
      txt = 'Objetivo: batelada completa! Ciclo TEC pilha a pilha, vaga 1 → 5, sempre no mesmo sentido.';
    } else {
      txt = 'Objetivo: praça limpa! Acabamento: leve as faixas à banda VERDE (3–6 passadas) e finalize o turno (Enter).';
    }
    if (el.textContent !== txt) el.textContent = txt;
  }

  // Painel de controles vira pílula e volta (tecla H ou clique)
  toggleControls() {
    const panel = document.getElementById('controls-panel');
    if (panel) panel.classList.toggle('collapsed');
  }

  drawMinimap(terrain, tractor, game) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const scaleX = w / terrain.width;
    const scaleY = h / terrain.height;
    const cs = terrain.cellSize;

    // Camada pesada (células) só a cada 12 frames
    if (this.minimapFrame % 12 === 0) {
      const mc = this.minimapCache.getContext('2d');
      mc.clearRect(0, 0, w, h);
      for (let y = 0; y < terrain.height; y++) {
        for (let x = 0; x < terrain.width; x++) {
          const cell = terrain.cells[y][x];
          mc.fillStyle = terrain.getCellColor(cell, y);
          mc.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
        }
      }
      // As 4 linhas demarcatórias, nas cores do mundo
      mc.lineWidth = 1;
      mc.setLineDash([3, 3]);
      const lines = [
        [terrain.dischargeRow, 'rgba(255,149,0,0.9)'],
        [terrain.peRow, 'rgba(255,204,0,0.9)'],
        [terrain.crestRow, 'rgba(255,204,0,0.9)'],
        [terrain.coverRow, 'rgba(52,199,89,0.9)'],
      ];
      for (const [row, color] of lines) {
        mc.strokeStyle = color;
        mc.beginPath();
        mc.moveTo(0, row * scaleY);
        mc.lineTo(w, row * scaleY);
        mc.stroke();
      }
      mc.setLineDash([]);
    }
    this.minimapFrame++;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.minimapCache, 0, 0);

    // Caminhões (com o perímetro de segurança quando manobram/descarregam)
    if (game) {
      for (const tr of game.trucks) {
        if (tr.state === 'DONE') continue;
        const tx = tr.x / cs * scaleX;
        const ty = tr.y / cs * scaleY;
        if (tr.state === 'MANEUVERING' || tr.state === 'DUMPING') {
          ctx.fillStyle = 'rgba(255, 59, 48, 0.25)';
          ctx.beginPath();
          ctx.arc(tx, ty, tr.dangerRadius / cs * scaleX, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#e9ecef';
        ctx.fillRect(tx - 3, ty - 2, 6, 4);
      }
      // Pilhas ainda não atacadas (alvos)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      for (const s of game.pileSlots) {
        if (s.attacked) continue;
        const sx = s.x / cs * scaleX;
        const sy = s.y / cs * scaleY;
        ctx.strokeRect(sx - 4, sy - 3, 8, 6);
      }
    }

    // Retângulo do viewport (o que a câmera está mostrando)
    if (game && game.viewW) {
      const vw = (game.viewW / game.zoom / cs) * scaleX;
      const vh = (game.viewH / game.zoom / cs) * scaleY;
      const vx = (game.camera.x / cs) * scaleX - vw / 2;
      const vy = (game.camera.y / cs) * scaleY - vh / 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(vx, vy, vw, vh);
    }

    // Draw tractor dot
    ctx.fillStyle = '#F0B429';
    ctx.beginPath();
    ctx.arc(tractor.x / cs * scaleX, tractor.y / cs * scaleY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  addMessage(text, type = 'system') {
    const p = document.createElement('p');
    p.className = `msg ${type}`;
    p.textContent = text;
    this.radioMessages.appendChild(p);

    // Poda as mensagens antigas para o DOM não crescer sem limite
    while (this.radioMessages.children.length > MAX_RADIO_MESSAGES) {
      this.radioMessages.removeChild(this.radioMessages.firstChild);
    }

    this.radioMessages.scrollTop = this.radioMessages.scrollHeight;
  }

  // Alerta crítico como toast central — o flash chama a atenção,
  // o toast diz O QUE aconteceu (o rádio guarda o histórico)
  showToast(message) {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.classList.add('show');
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toast.classList.remove('show'), 5000);
  }

  flashScreen() {
    const flash = document.createElement('div');
    flash.className = 'flash-screen';
    document.getElementById('app').appendChild(flash);
    setTimeout(() => {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
    }, 500);
  }

  showReport(kpis, terrain) {
    const modal = document.getElementById('report-modal');
    modal.style.display = 'flex';

    // Conceito agregado A–E — o veredito comparável entre turnos
    const gradeEl = document.getElementById('kpi-grade');
    if (gradeEl && kpis.grade) {
      gradeEl.textContent = kpis.grade;
      gradeEl.className = 'report-grade ' +
        (kpis.overall >= 75 ? 'good' : kpis.overall >= 50 ? 'warn' : 'bad');
    }
    const tipEl = document.getElementById('kpi-tip');
    if (tipEl && kpis.tip) tipEl.textContent = `💡 ${kpis.tip}`;

    document.getElementById('kpi-prod').textContent = `${Math.floor(kpis.productivity)}%`;
    document.getElementById('kpi-qual').textContent = `${Math.floor(kpis.quality)}%`;
    document.getElementById('kpi-safe').textContent = `${Math.floor(kpis.safety)}%`;

    document.getElementById('kpi-time').textContent =
      `Tempo Total: ${Math.floor(kpis.time)}s (Meta: ${kpis.expectedTime}s)`;

    // Snapshot do heatmap final: o aluno VÊ onde ficou lilás/oca/sobra
    const mapCanvas = document.getElementById('report-map');
    if (mapCanvas && terrain) {
      const mctx = mapCanvas.getContext('2d');
      const sx = mapCanvas.width / terrain.width;
      const sy = mapCanvas.height / terrain.height;
      for (let y = 0; y < terrain.height; y++) {
        for (let x = 0; x < terrain.width; x++) {
          mctx.fillStyle = terrain.getCellColor(terrain.cells[y][x], y);
          mctx.fillRect(x * sx, y * sy, sx, sy);
        }
      }
      mctx.strokeStyle = 'rgba(255,204,0,0.9)';
      mctx.lineWidth = 1;
      for (const row of [terrain.peRow, terrain.crestRow]) {
        mctx.beginPath();
        mctx.moveTo(0, row * sy);
        mctx.lineTo(mapCanvas.width, row * sy);
        mctx.stroke();
      }
    }

    // Detalhamento (Espec. §7: crista batida, camada, praça limpa, TEC 6)
    const details = document.getElementById('kpi-details');
    if (details) {
      const row = (label, value, ok) =>
        `<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
           <span>${label}</span>
           <strong style="color:${ok ? '#34c759' : '#ff9500'};">${value}</strong>
         </div>`;
      details.innerHTML =
        row('Crista batida (TEC 5)', `${kpis.crestPct}%`, kpis.crestPct >= 90) +
        row('Camada ≤ 30cm (TEC 4)', `${kpis.layerPct}%`, kpis.layerPct >= 90) +
        row('Praça limpa (TEC 3)', kpis.pracaLeft === 0 ? 'Sim ✓' : `${kpis.pracaLeft} células com sobra`, kpis.pracaLeft === 0) +
        row('Movimentos improdutivos (TEC 6)', `${kpis.improductive}`, kpis.improductive === 0) +
        row('Violações de técnica (TEC 3/4/7)', `${kpis.violations}`, kpis.violations === 0) +
        row('Diesel consumido', `${kpis.diesel.toFixed(1)} L (ref ≤ ${DIESEL.REF} L)`, kpis.diesel <= DIESEL.REF);
    }

    // Add color classes
    ['prod', 'qual', 'safe'].forEach(key => {
      const el = document.getElementById(`kpi-${key}`);
      const val = kpis[key === 'prod' ? 'productivity' : key === 'qual' ? 'quality' : 'safety'];
      el.className = 'kpi-value'; // reset
      if (val >= 80) el.classList.add('good');
      else if (val >= 50) el.classList.add('warn');
      else el.classList.add('bad');
    });
  }
}
