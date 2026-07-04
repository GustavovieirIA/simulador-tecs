import { Input } from './Input.js';
import { HUD } from '../ui/HUD.js';
import { QuizModal } from '../ui/QuizModal.js';
import { COMPACTION, LAYER, SAFETY, SHIFT, QUALITY, TEC6, classifyPasses } from '../config/params.js';

export class Game {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Resolução física com devicePixelRatio (nitidez em telas retina),
    // limitado a 2 para não pagar fill-rate de telas 3x
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.applyCanvasSize();

    this.input = new Input();
    this.hud = new HUD();
    this.audio = null; // injetado pelo main.js (AudioEngine)
    this.lastTime = 0;
    this.isRunning = false;
    this._loop = this.loop.bind(this);

    // Zoom: 'tatico' enquadra praça+rampa; 'cabine' acompanha de perto (Z)
    this.zoomMode = 'tatico';
    this.zoom = 1;

    // Câmera com look-ahead na direção do movimento (suavizado à parte)
    this.lookAhead = 0;

    // Trauma (0–1): shakes somam aqui e decaem — amplitude = 9·trauma²
    this.trauma = 0;
    this.collisionCooldown = 0;

    // Pool de partículas pré-alocado (poeira, fumaça, detritos) — sem GC
    this.particles = [];
    for (let i = 0; i < 240; i++) {
      this.particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, grow: 0, r: 0, g: 0, b: 0, a: 0.3 });
    }
    this.pIdx = 0;
    this.dustAcc = 0;
    this.smokeAcc = 0;

    // Cache do scan de pilhas soltas (era 2 varreduras de grid por frame)
    this.loosePileDist = Infinity;
    this.looseScanTimer = 0;

    // Game state
    this.state = {
      batch: 0,
      maxBatch: SHIFT.MAX_BATCH,
      phase: 'WAITING_TRUCKS' // WAITING_TRUCKS, DUMPING, READY, DONE, QUIZ
    };

    // Entities
    this.tractor = null;
    this.terrain = null;
    this.trucks = [];

    // TEC 7 — sentido de trabalho: registro das pilhas descarregadas e da
    // ordem em que o jogador as ataca
    this.pileSlots = [];
    this.attackSeq = [];
    this.workDir = 0;

    // Timers & Camera
    this.gameTime = 0; // zera quando o jogador assume o comando (mede só o turno dele)
    this.spawnTimer = 2.0;

    // Coach/Didactic Timers
    this.coachTimers = {
      overcompact: 0,
      gear: 0,
      blade: 0,
      compacted: 0,
      spreadOutside: 0,
      attack: 0,
      order: 0,
      dance: 12.0
    };
    this.praised = new Set(); // mensagens positivas: uma vez cada

    // Quiz de fechamento: as perguntas rodam em sequência ao final do turno
    // (o encadeamento é feito por runEndQuizzes; sem callback padrão aqui)
    this.quizModal = new QuizModal(null, () => this.audio);

    this.camera = { x: 0, y: 0 };

    window.addEventListener('resize', () => this.resize());
  }

  applyCanvasSize() {
    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
    this.canvas.style.width = this.viewW + 'px';
    this.canvas.style.height = this.viewH + 'px';
  }

  resize() {
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.applyCanvasSize();
  }

  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  // Partícula do pool (ponteiro circular, zero alocação)
  emitParticle(x, y, vx, vy, life, size, grow, r, g, b, a) {
    const p = this.particles[this.pIdx];
    this.pIdx = (this.pIdx + 1) % this.particles.length;
    p.active = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life; p.size = size; p.grow = grow;
    p.r = r; p.g = g; p.b = b; p.a = a;
  }

  // Detritos de rebarba (chamado pela física da lâmina)
  emitSpill(x, y, dx, dy) {
    if (Math.random() > 0.25) return; // amostrado: a rebarba flui vários frames
    this.emitParticle(x, y,
      dx * (30 + Math.random() * 40) + (Math.random() - 0.5) * 20,
      dy * (30 + Math.random() * 40) + (Math.random() - 0.5) * 20,
      0.5 + Math.random() * 0.3, 2 + Math.random() * 2, 0, 60, 48, 34, 0.7);
  }

  triggerAlert(message) {
    this.hud.addMessage(message, 'alert');
    this.hud.flashScreen();
    this.hud.showToast(message);
    if (this.audio) this.audio.klaxon();
  }

  // Início do turno do jogador (chamado na abertura da sessão)
  beginPlayerShift(message) {
    this.state.phase = 'WAITING_TRUCKS';
    this.state.batch = 0; // batelada COMPLETA para o jogador (TEC 1: 5 pilhas)
    this.gameTime = 0; // o relógio do turno começa agora
    this.tractor.speed = 0;
    this.tractor.isLocked = false;
    // a ficha do jogador começa limpa
    this.tractor.safetyViolations = 0;
    this.tractor.qualityViolations = 0;
    this.tractor.improductiveMoves = 0;
    this.tractor.dieselUsed = 0;
    this.tractor.reverseRun = 0;
    this.tractor.attackEvent = null;
    this.tractor.pendulumEvent = false;
    this.tractor.hitCompactedFlag = false;
    this.tractor.spreadOutsideFlag = false;
    this.tractor.tookDistanceFlag = false;
    this.pileSlots = [];
    this.attackSeq = [];
    this.workDir = 0;
    this.input.keys = {};

    const controlsPanel = document.getElementById('controls-panel');
    if (controlsPanel) controlsPanel.style.display = 'block';

    const finishBtn = document.getElementById('btn-finish-shift');
    if (finishBtn) finishBtn.style.display = 'block';

    this.hud.addMessage(message, 'system');
  }

  // O operador terminou: primeiro o quiz de fechamento (todas as perguntas
  // em sequência), depois o relatório (FDE)
  finishShift() {
    if (this.state.phase === 'QUIZ' || this.state.phase === 'DONE') return;
    this.tractor.isLocked = true;
    this.tractor.speed = 0;
    this.input.keys = {};
    this.runEndQuizzes(() => this.computeAndShowReport());
  }

  computeAndShowReport() {
    this.state.phase = 'DONE';
    this.tractor.isLocked = true;

    const T = this.terrain;
    let covered = 0;
    let ideal = 0;
    let over = 0;
    let oca = 0;
    let layerOk = 0;

    for (let y = 0; y < T.height; y++) {
      for (let x = 0; x < T.width; x++) {
        const cell = T.cells[y][x];
        const isCovered = cell.height > 0.01 || cell.base > 0.01;
        if (!isCovered) continue;
        covered++;

        // Sobra na praça: nunca é "ideal" (a meta é praça limpa), mesmo que
        // o tráfego tenha acumulado passadas nela
        if (y > T.peRow && cell.height > 0.05) continue;

        // Camada > 60 cm ESPALHADA (rampa/platô): célula "oca" — a zona de
        // baixa pressão nunca compacta
        if (cell.height > LAYER.OCA_MIN && y <= T.peRow) { oca++; continue; }
        layerOk++;

        if (cell.height <= 0.01) { ideal++; continue; } // base finalizada
        const band = classifyPasses(cell.passes);
        if (band === 'IDEAL' && cell.height <= LAYER.MAX_OK) ideal++;
        else if (band === 'OVER' || band === 'WASTE') over++;
      }
    }

    // Crista 100% batida (TEC 5): toda coluna trabalhada precisa do carimbo
    // do pêndulo — passar na crista com a lâmina VAZIA (pré-condição da TEC 5)
    let workedCols = 0;
    let crestOk = 0;
    for (let x = 0; x < T.width; x++) {
      let worked = false;
      for (let y = T.crestRow; y <= T.peRow; y++) {
        const cell = T.cells[y][x];
        if (cell.height > 0.01 || cell.base > 0.01) { worked = true; break; }
      }
      if (!worked) continue;
      workedCols++;
      if (T.cells[T.crestRow][x].crestStamp) crestOk++;
    }
    const crestPct = workedCols === 0 ? 100 : Math.round(100 * crestOk / workedCols);

    // Praça limpa: lixo solto esquecido abaixo do pé do talude
    let pracaLeft = 0;
    for (let y = T.peRow + 1; y < T.height; y++) {
      for (let x = 0; x < T.width; x++) {
        if (T.cells[y][x].height > 0.05) pracaLeft++;
      }
    }

    // Penalidades PROPORCIONAIS à área coberta (pontos por % de células
    // super compactadas/ocas) — independem do tamanho do terreno
    const cellQuality = covered === 0
      ? 100
      : Math.max(0, (100 * ideal
          - QUALITY.OVER_WEIGHT * 100 * over
          - QUALITY.OCA_WEIGHT * 100 * oca) / covered);

    const quality = Math.max(0, Math.min(100, Math.round(
      (1 - QUALITY.CREST_SHARE) * (cellQuality - QUALITY.VIOLATION_WEIGHT * this.tractor.qualityViolations)
      + QUALITY.CREST_SHARE * crestPct
    )));

    const safety = Math.max(0, 100 - this.tractor.safetyViolations * SAFETY.PENALTY_PER_VIOLATION);

    // Produtividade: razão meta/tempo (100% se dentro da meta; degrada suave),
    // menos os movimentos improdutivos (TEC 6)
    const productivity = Math.max(0, Math.min(100,
      Math.round(100 * SHIFT.EXPECTED_TIME / Math.max(this.gameTime, 1))
      - TEC6.PENALTY_PER_MOVE * this.tractor.improductiveMoves));

    // Conceito agregado (A–E) + recomendação acionável derivada do pior KPI
    const overall = Math.round(0.4 * quality + 0.35 * productivity + 0.25 * safety);
    const grade = overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 40 ? 'D' : 'E';
    let tip;
    if (safety <= quality && safety <= productivity) {
      tip = 'Prioridade: SEGURANÇA — respeite o perímetro dos caminhões e nunca faça curva com a lâmina carregada.';
    } else if (quality <= productivity) {
      tip = over > 0
        ? `Você super compactou ${over} células: conte as passadas (3–6) e mude de faixa em vez de insistir.`
        : crestPct < 90
          ? 'Suba na crista com a lâmina VAZIA em toda faixa trabalhada — o pêndulo é o que adensa a borda.'
          : 'Feche as faixas na banda VERDE antes de encerrar: 3–6 passadas com camada ≤ 30cm.';
    } else {
      tip = this.tractor.improductiveMoves > 0
        ? 'Corte os movimentos improdutivos: encaixe a máquina na pilha como uma baliza, sem tomar distância.'
        : 'Ganhe ritmo: ataque as pilhas em sequência (vaga 1 → 5) e mantenha a 2ª marcha nas voltas vazias.';
    }

    this.hud.showReport({
      quality, safety, productivity,
      grade, overall, tip,
      time: this.gameTime,
      expectedTime: SHIFT.EXPECTED_TIME,
      crestPct,
      layerPct: covered === 0 ? 100 : Math.round(100 * layerOk / covered),
      pracaLeft,
      improductive: this.tractor.improductiveMoves,
      violations: this.tractor.qualityViolations,
      diesel: this.tractor.dieselUsed
    }, this.terrain);
  }

  start() {
    this.isRunning = true;
    // init camera to tractor
    if (this.tractor) {
        this.camera.x = this.tractor.x;
        this.camera.y = this.tractor.y;
    }
    requestAnimationFrame((t) => {
      this.lastTime = t;
      this.loop(t);
    });
  }

  // Poeira das esteiras + fumaça do escapamento (proporcional ao esforço)
  updateEffects(dt) {
    const t = this.tractor;
    if (!t) return;

    // Trauma decai; sobrecarga mantém um tremor mínimo constante
    const floor = (t.overloaded && !t.isLocked) ? 0.08 : 0;
    this.trauma = Math.max(floor, this.trauma - 1.4 * dt);
    if (this.collisionCooldown > 0) this.collisionCooldown -= dt;

    // Poeira atrás das esteiras
    if (Math.abs(t.speed) > 30) {
      this.dustAcc += dt * Math.abs(t.speed) / 60;
      if (this.dustAcc > 0.12) {
        this.dustAcc = 0;
        const px = Math.cos(t.angle + Math.PI / 2);
        const py = Math.sin(t.angle + Math.PI / 2);
        const side = (this.pIdx % 2 === 0 ? 1 : -1) * (t.width / 2 - 4);
        const back = -Math.sign(t.speed) * t.length / 2;
        this.emitParticle(
          t.x + Math.cos(t.angle) * back + px * side,
          t.y + Math.sin(t.angle) * back + py * side,
          -Math.cos(t.angle) * Math.sign(t.speed) * 12 + (Math.random() - 0.5) * 10,
          -Math.sin(t.angle) * Math.sign(t.speed) * 12 + (Math.random() - 0.5) * 10,
          0.8, 3, 6, 180, 150, 110, 0.3);
      }
    }

    // Fumaça do escapamento: cinza no trabalho normal, PRETA na sobrecarga
    // ("fumaça preta = técnica errada = diesel queimado")
    const running = !t.isLocked && this.state.phase !== 'DONE';
    if (running) {
      this.smokeAcc += dt * (t.overloaded ? 9 : (Math.abs(t.speed) > 5 ? 2.2 : 1));
      if (this.smokeAcc > 1) {
        this.smokeAcc = 0;
        const hl = t.length / 2, hw = t.width / 2;
        const ex = t.x + Math.cos(t.angle) * (hl - 10) - Math.sin(t.angle) * (-hw + 10);
        const ey = t.y + Math.sin(t.angle) * (hl - 10) + Math.cos(t.angle) * (-hw + 10);
        const dark = t.overloaded;
        this.emitParticle(ex, ey,
          (Math.random() - 0.5) * 8, -14 - Math.random() * 8,
          1.1, 3, dark ? 8 : 5,
          dark ? 35 : 150, dark ? 32 : 150, dark ? 30 : 150, dark ? 0.5 : 0.22);
      }
    }

    // Integração das partículas
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
    }
  }

  loop(timestamp) {
    if (!this.isRunning) return;

    if (this.lastTime === 0) this.lastTime = timestamp;
    const deltaTime = Math.min(0.1, (timestamp - this.lastTime) / 1000); // clamp p/ abas em fundo
    this.lastTime = timestamp;

    this.update(deltaTime);
    if (this.audio) this.audio.frame(this, deltaTime);
    this.render();

    this.input.update(); // Update inputs at the end of the frame

    requestAnimationFrame(this._loop);
  }

  update(dt) {
    // Alternância de zoom (Z) e colapso dos controles (H) valem sempre
    if (this.input.isJustPressed('KeyZ')) {
      this.zoomMode = this.zoomMode === 'tatico' ? 'cabine' : 'tatico';
    }
    if (this.input.isJustPressed('KeyH')) {
      this.hud.toggleControls();
    }

    if (this.state.phase === 'QUIZ') return; // Pause logic

    this.gameTime += dt;

    // Scan de pilhas soltas em cache (4x/s em vez de 2x/frame)
    this.looseScanTimer -= dt;
    if (this.looseScanTimer <= 0) {
      this.looseScanTimer = 0.25;
      this.loosePileDist = this.scanNearestLoosePile();
    }

    // Efeitos: trauma, poeira, fumaça, partículas
    this.updateEffects(dt);

    // Truck Spawning Logic
    if (this.state.phase === 'WAITING_TRUCKS' || this.state.phase === 'DUMPING') {
      if (this.state.batch < this.state.maxBatch) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          if (this.truckClass) {
            // TEC 1: tipos alternados — o perímetro de segurança da carreta
            // é maior que o do coletor; a pilha da carreta é mais larga (TEC 3).
            const type = this.state.batch % 2 === 1 ? 'CARRETA' : 'COLETOR';
            this.trucks.push(new this.truckClass(
              this.state.batch,
              this.terrain.width * this.terrain.cellSize,
              this.terrain.height * this.terrain.cellSize,
              type
            ));
            this.state.batch++;
            this.state.phase = 'DUMPING';
            this.spawnTimer = 2.0; // 2 seconds between trucks (FASTER)
          }
        }
      } else {
        // If batch reached max and all trucks left, allow manual completion
        const allDone = this.trucks.every(t => t.state === 'DONE');
        if (allDone && this.state.phase !== 'READY') {
          this.state.phase = 'READY';
          this.tractor.isLocked = false;
        }
      }
    }

    if (this.tractor) {
        this.tractor.update(dt, this.input, this.terrain, this);

        // Eventos do trator (ataque, pêndulo) consumidos pelo coach
        this.consumeTractorEvents();

        // Zoom suavizado: 'tatico' enquadra o módulo inteiro; 'cabine' = 1:1
        const worldW = this.terrain ? this.terrain.width * this.terrain.cellSize : this.viewW;
        const worldH = this.terrain ? this.terrain.height * this.terrain.cellSize : this.viewH;
        const zTarget = this.zoomMode === 'cabine'
          ? 1
          : Math.max(0.4, Math.min(1, Math.min(this.viewH / (worldH + 140), this.viewW / (worldW + 80))));
        this.zoom += (zTarget - this.zoom) * Math.min(1, 3 * dt);

        // Look-ahead: a câmera olha para ONDE a máquina vai (de ré, para trás),
        // com suavização própria para não chicotear nos ciclos frente-e-ré
        const laTarget = 90 * (this.tractor.speed / this.tractor.maxSpeed2nd);
        this.lookAhead += (laTarget - this.lookAhead) * Math.min(1, 2.5 * dt);
        const camTX = this.tractor.x + Math.cos(this.tractor.angle) * this.lookAhead;
        const camTY = this.tractor.y + Math.sin(this.tractor.angle) * this.lookAhead;

        // Camera Lerp (capped to 1.0 to prevent ping-pong overshoot on lag spikes)
        const lerpFactor = Math.min(1.0, 5.0 * dt);
        this.camera.x += (camTX - this.camera.x) * lerpFactor;
        this.camera.y += (camTY - this.camera.y) * lerpFactor;

        // Câmera presa aos limites da praça (não mostra o vazio)
        if (this.terrain) {
          this.camera.x = this.clampCamera(this.camera.x, this.viewW / this.zoom, worldW);
          this.camera.y = this.clampCamera(this.camera.y, this.viewH / this.zoom, worldH);
        }
    }

    if (this.terrain) this.terrain.update(dt);

    this.trucks.forEach(t => {
      t.update(dt, this.terrain);
      // Registra a pilha descarregada (TEC 7 — sentido de trabalho)
      if (!t.registered && (t.state === 'LEAVING' || t.state === 'DONE')) {
        t.registered = true;
        this.pileSlots.push({
          x: t.targetX,
          y: t.targetY + 40,
          width: t.pileSpec.w,
          attacked: false
        });
        // A avalanche do basculamento: som + detritos saltando
        if (this.audio) this.audio.avalanche();
        for (let i = 0; i < 10; i++) {
          this.emitParticle(
            t.targetX + (Math.random() - 0.5) * t.pileSpec.w * 18,
            t.targetY + 40 + (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 40,
            0.4 + Math.random() * 0.4, 2 + Math.random() * 2, 0, 90, 70, 50, 0.7);
        }
      }
    });

    // O trator não atravessa caminhões
    this.resolveTruckCollisions();

    // Check for didactic mistakes
    this.checkDidacticRules(dt);

    // Perímetro de segurança dos caminhões (só vale para o jogador)
    this.checkTruckSafety();

    // Finish condition — o quiz de fechamento roda dentro de finishShift.
    // Mesmas fases do botão "Finalizar Turno"
    if (this.input.isJustPressed('Enter') &&
        (this.state.phase === 'READY' || this.state.phase === 'WAITING_TRUCKS')) {
      this.finishShift();
    }

    this.hud.update(this);
  }

  // Centraliza a vista se o terreno couber na tela; senão trava nas bordas
  clampCamera(v, viewSize, worldSize, margin = 120) {
    const half = viewSize / 2;
    const lo = -margin + half;
    const hi = worldSize + margin - half;
    if (lo >= hi) return worldSize / 2;
    return Math.min(hi, Math.max(lo, v));
  }

  resolveTruckCollisions() {
    if (!this.tractor) return;
    const t = this.tractor;
    for (const truck of this.trucks) {
      if (truck.state === 'DONE') continue;
      const dx = t.x - truck.x;
      const dy = t.y - truck.y;
      const dist = Math.hypot(dx, dy);
      const minDist = 30 + truck.length / 2; // raios aproximados trator + caminhão
      if (dist > 0.001 && dist < minDist) {
        const push = (minDist - dist);
        t.x += (dx / dist) * push;
        t.y += (dy / dist) * push;
        // Impacto sentido: rouba velocidade + tranco + "clank" do chassi
        if (Math.abs(t.speed) > 20 && this.collisionCooldown <= 0) {
          this.collisionCooldown = 0.6;
          this.addTrauma(0.35);
          if (this.audio) this.audio.clank();
        }
        t.speed *= 0.5; // o impacto rouba velocidade
      }
    }
  }

  checkTruckSafety() {
    if (!this.tractor || this.tractor.isLocked) return;

    const t = this.tractor;
    // Só conta se o trator estiver dirigindo para dentro do perímetro;
    // parado, quem mantém distância é o caminhão
    if (Math.abs(t.speed) <= 10) return;
    const inDanger = this.trucks.some(truck => truck.isInDangerZone(t.x, t.y));
    if (inDanger && t.violationCooldowns.truck <= 0) {
      this.triggerAlert('SEGURANÇA: Você invadiu o perímetro do caminhão em manobra! Mantenha distância.');
      t.safetyViolations++;
      t.violationCooldowns.truck = SAFETY.VIOLATION_COOLDOWN;
    }
  }

  // Eventos gerados pela física do trator neste frame
  consumeTractorEvents() {
    const t = this.tractor;

    // Solavanco do pêndulo (TEC 5) — o "carimbo" na crista
    if (t.pendulumEvent) {
      t.pendulumEvent = false;
      this.addTrauma(0.55);
      if (this.audio) this.audio.thump(true);
      // Nuvem de poeira radial no ponto do impacto
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 20 + Math.random() * 40;
        this.emitParticle(t.x, t.y, Math.cos(a) * v, Math.sin(a) * v,
          0.6 + Math.random() * 0.4, 3, 8, 180, 150, 110, 0.35);
      }
      if (!this.praised.has('pendulo')) {
        this.praised.add('pendulo');
        this.hud.addMessage('💥 TEC 5: Pêndulo na crista! O peso da máquina concentrado na quina — carimbo de compactação registrado.', 'system');
        if (this.audio) this.audio.pop();
      }
    }

    // Ataque à pilha (TEC 3 + TEC 7)
    if (t.attackEvent) {
      const ev = t.attackEvent;
      t.attackEvent = null;
      this.addTrauma(0.12); // a lâmina morde a pilha
      this.evaluateAttack(ev);
    }
  }

  evaluateAttack(ev) {
    // O julgamento vale para o PRIMEIRO ataque de cada pilha (como na
    // avaliação do vídeo 91) — reprocessar rebarba depois é operação normal
    const slot = this.pileSlots.find(s =>
      !s.attacked && Math.hypot(s.x - ev.x, s.y - ev.y) < 130);
    if (!slot) return;

    // TEC 3: ataque pelo centro de uma pilha mais larga que a lâmina
    // (material engajado E sobrando dos DOIS lados = rebarba dupla)
    if (ev.leftEngaged && ev.rightEngaged && ev.beyondLeft && ev.beyondRight && this.coachTimers.attack <= 0) {
      this.triggerAlert('TEC 3: Ataque pelo CENTRO! A lâmina vai transbordar para os dois lados — ataque pela borda deixando 1/3 da lâmina livre.');
      this.tractor.qualityViolations++;
      this.coachTimers.attack = 8.0;
    } else if (((ev.beyondLeft && !ev.rightEngaged) || (ev.beyondRight && !ev.leftEngaged)) && !this.praised.has('ataque')) {
      this.praised.add('ataque');
      this.hud.addMessage('✅ TEC 3: bom ataque — 1/3 da lâmina livre, o lado de fora fica limpo e a rebarba cai só para dentro.', 'system');
      if (this.audio) this.audio.pop();
    }

    // TEC 7: sentido de trabalho — as pilhas devem ser atacadas em sequência,
    // num sentido só ("como cortar grama"), sem pular nem voltar

    const prev = this.attackSeq[this.attackSeq.length - 1];
    if (prev) {
      const dir = Math.sign(slot.x - prev.x);
      const skipped = this.pileSlots.some(s =>
        !s.attacked && s !== slot &&
        ((s.x > Math.min(prev.x, slot.x) + 60) && (s.x < Math.max(prev.x, slot.x) - 60)));
      const reversed = this.workDir !== 0 && dir !== 0 && dir !== this.workDir;

      if ((skipped || reversed) && this.coachTimers.order <= 0) {
        this.triggerAlert('TEC 7: Sentido de trabalho! Trabalhe as pilhas em sequência, num sentido só — pular ou voltar bagunça a contagem de passadas.');
        this.tractor.qualityViolations++;
        this.coachTimers.order = 8.0;
      }
      if (this.workDir === 0 && dir !== 0) this.workDir = dir;
    }

    slot.attacked = true;
    this.attackSeq.push(slot);
  }

  checkDidacticRules(dt) {
    if (!this.tractor || !this.terrain || this.tractor.isLocked) return;

    // Update timers
    for (let key in this.coachTimers) {
      if (this.coachTimers[key] > 0) this.coachTimers[key] -= dt;
    }

    const t = this.tractor;
    const cs = this.terrain.cellSize;

    // Célula mais "trabalhada" sob a máquina (esteiras têm vão central,
    // então olhamos as três colunas sob o trator)
    const px = Math.cos(t.angle + Math.PI / 2);
    const py = Math.sin(t.angle + Math.PI / 2);
    let cell = null;
    for (const o of [-1, 0, 1]) {
      const c = this.terrain.getCellAt(t.x + px * o * cs, t.y + py * o * cs);
      if (c && (!cell || c.passes > cell.passes)) cell = c;
    }

    if (cell && t.speed !== 0) {
      // Rule 1: Overcompacting — mesmo limite da faixa lilás/preta do heatmap
      // (só sobre material; passar muitas vezes no chão limpo não é o erro didático)
      if (cell.height > 0.01 && cell.passes > COMPACTION.IDEAL_MAX && this.coachTimers.overcompact <= 0) {
        this.hud.addMessage('⚠️ Alerta: Você está compactando demais a mesma área! Isso gasta diesel e danifica o piso.', 'alert');
        this.coachTimers.overcompact = 10.0; // Wait 10s before warning again
      }

      // Rule 2: Spreading with Gear 2 (Bad torque)
      if (t.bladeHeight >= 20 && t.gear === 2 && this.coachTimers.gear <= 0) {
        this.hud.addMessage('💡 Dica: Use a Marcha 1 (mais torque) ao invés da 2 quando for empurrar muito peso para espalhar na rampa.', 'apontador');
        this.coachTimers.gear = 15.0;
      }

      // Rule 3: Spreading over an already-compacted surface
      if (t.bladeHeight >= 20 && cell.height > 0.01 && cell.passes >= COMPACTION.IDEAL_MIN && this.coachTimers.blade <= 0) {
        this.hud.addMessage('⚠️ Atenção: Se quiser regularizar essa superfície, baixe a lâmina para 10cm. A 30cm você apenas joga material por cima.', 'alert');
        this.coachTimers.blade = 12.0;
      }
    }

    // Rule 4: tentou raspar material já compactado com a lâmina a 0
    if (t.hitCompactedFlag) {
      t.hitCompactedFlag = false;
      if (this.coachTimers.compacted <= 0) {
        this.hud.addMessage('💡 Material já compactado (verde) não volta para a lâmina. Suba a lâmina para 30cm para se deslocar por cima.', 'apontador');
        this.coachTimers.compacted = 10.0;
        if (this.audio) this.audio.skreek(); // aço resvalando em piso duro
      }
    }

    // Rule 5: espalhou fora da rampa — "lixo só é preenchido na rampa" (TEC 2/4)
    if (t.spreadOutsideFlag) {
      t.spreadOutsideFlag = false;
      if (this.coachTimers.spreadOutside <= 0) {
        this.triggerAlert('TEC 4: Lixo só é preenchido NA RAMPA (entre o pé e a crista)! Antes da rampa não vai lixo, depois da rampa não vai lixo.');
        t.qualityViolations++;
        this.coachTimers.spreadOutside = 8.0;
      }
    }

    // Rule 6 (TEC 6): tomada de distância — ré longa e vazia na praça
    if (t.tookDistanceFlag) {
      t.tookDistanceFlag = false;
      t.improductiveMoves++;
      this.triggerAlert('TEC 6: Tomada de distância! Encaixe a máquina na pilha como uma BALIZA — ré curta. O trator não vai "bater falta".');
    }

    // Rule 7: passo de dança — detecta faixas listradas (colunas compactadas
    // ao lado de colunas com material sem nenhuma passada)
    if (this.coachTimers.dance <= 0) {
      this.coachTimers.dance = 12.0;
      const T = this.terrain;
      outer:
      for (let y = T.crestRow + 1; y < T.peRow; y++) {
        for (let x = 1; x < T.width - 1; x++) {
          const c = T.cells[y][x];
          if (c.height > 0.01 && c.passes >= 1.5) {
            const left = T.cells[y][x - 1];
            const right = T.cells[y][x + 1];
            if ((left.height > 0.01 && left.passes < 0.4) || (right.height > 0.01 && right.passes < 0.4)) {
              this.hud.addMessage('💡 Passo de dança: as esteiras têm um VÃO no meio — desloque ½ esteira (1 célula) para o lado na volta para cobrir as listras sem passada.', 'apontador');
              this.coachTimers.dance = 25.0;
              break outer;
            }
          }
        }
      }
    }
  }

  // Perguntas de fechamento (todas ao final do turno, não durante a operação).
  // Uma por TEC-chave do ciclo, na ordem em que a operação acontece.
  getEndQuizQuestions() {
    return [
      {
        question: 'Coleta na praça (TEC 3): o caminhão descarregou o material solto. Qual é a configuração correta para buscar o material?',
        options: [
          { text: 'Abaixar a lâmina para 0cm (Transportar) e engatar Marcha 1.', isCorrect: true },
          { text: 'Subir a lâmina para 30cm e engatar Marcha 2.', isCorrect: false, feedback: 'A 30cm você passa por cima do lixo, e a Marcha 2 não tem torque para empurrar a carga inicial.' }
        ]
      },
      {
        question: 'Ataque à pilha (TEC 3): a carreta descarregou uma pilha mais LARGA que a lâmina. Como atacá-la?',
        options: [
          { text: 'Atacar pela borda, deixando 1/3 da lâmina livre no lado de fora — a rebarba cai só para o lado de dentro.', isCorrect: true },
          { text: 'Atacar pelo centro da pilha para levar o máximo de material de uma vez.', isCorrect: false, feedback: 'Pelo centro a lâmina transborda para os DOIS lados, formando rebarbas que exigem viagens extras (+30% de ciclos, diesel e desgaste).' }
        ]
      },
      {
        question: 'Espalhamento na rampa (TEC 4): você chegou no Pé de Talude e vai subir a rampa. Como espalhar o material?',
        options: [
          { text: 'Manter a lâmina no chão (0cm) para levar tudo até o topo.', isCorrect: false, feedback: 'Isso criaria uma parede de lixo no topo. O material deve descer em camadas finas (≤30cm).' },
          { text: 'Subir a lâmina para 20–30cm para soltar o lixo por baixo da esteira em camadas finas, chegando na crista SEM lixo.', isCorrect: true }
        ]
      },
      {
        question: 'Retorno e compactação (TEC 5/7): você chegou na Crista do Talude. Como retornar à base compactando a rampa?',
        options: [
          { text: 'Virar o trator de frente, manter a lâmina alta e descer rápido.', isCorrect: false, feedback: 'Virar o trator em cima da rampa é perigoso, e a lâmina alta não regulariza o chão.' },
          { text: 'Engatar marcha à ré, baixar a lâmina para 10cm, Marcha 2, deslocar ½ esteira para o lado e descer alisando de costas.', isCorrect: true }
        ]
      }
    ];
  }

  // Mostra todas as perguntas em sequência; quando acabam, chama onDone
  runEndQuizzes(onDone) {
    const questions = this.getEndQuizQuestions();
    const total = questions.length;
    this.state.phase = 'QUIZ';

    const next = (i) => {
      if (i >= total) {
        this.quizModal.modal.style.display = 'none';
        onDone();
        return;
      }
      const q = questions[i];
      q.counter = `Pergunta ${i + 1} de ${total}`;
      this.quizModal.show(q, () => next(i + 1));
    };
    next(0);
  }

  // Distância (px) do trator até a pilha solta mais próxima — valor em cache
  // (o scan de 2400 células roda 4x/s, não 2x/frame)
  distanceToNearestLoosePile() {
    return this.loosePileDist;
  }

  scanNearestLoosePile() {
    const t = this.tractor;
    let best = Infinity;
    for (let y = 0; y < this.terrain.height; y++) {
      for (let x = 0; x < this.terrain.width; x++) {
        const cell = this.terrain.cells[y][x];
        if (cell.height > 0.1 && cell.passes < COMPACTION.LOOSE_MAX) {
          const d = Math.hypot(
            x * this.terrain.cellSize - t.x,
            y * this.terrain.cellSize - t.y
          );
          if (d < best) best = d;
        }
      }
    }
    return best;
  }

  render() {
    const ctx = this.ctx;

    // Base: espaço CSS × devicePixelRatio (nitidez em retina)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0f0f13';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();

    // Trauma → tremor orgânico (senos dessincronizados + micro-rotação),
    // não jitter branco
    let shakeX = 0, shakeY = 0, shakeR = 0;
    if (this.trauma > 0.01) {
      const amp = 9 * this.trauma * this.trauma;
      const t = this.gameTime;
      shakeX = amp * (Math.sin(t * 47.3) + Math.sin(t * 89.7) * 0.5);
      shakeY = amp * (Math.sin(t * 53.1 + 2) + Math.sin(t * 97.3) * 0.5);
      shakeR = 0.004 * this.trauma * Math.sin(t * 61.1);
    }

    // Câmera: centro da tela → rotação de trauma → zoom → mundo
    ctx.translate(this.viewW / 2, this.viewH / 2);
    if (shakeR) ctx.rotate(shakeR);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

    if (this.terrain) this.terrain.render(ctx);

    // Render trucks
    for (const t of this.trucks) t.render(ctx);

    if (this.tractor) this.tractor.render(ctx);

    // Partículas (poeira, fumaça, detritos) por cima dos veículos
    this.renderParticles(ctx);

    ctx.restore();
  }

  renderParticles(ctx) {
    for (const p of this.particles) {
      if (!p.active) continue;
      const a = (p.a * p.life / p.maxLife).toFixed(2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
