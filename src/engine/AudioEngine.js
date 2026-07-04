// Áudio 100% sintetizado (WebAudio, zero assets).
// Arquitetura: fontes → bus (engine/sfx/ui) → master → compressor → saída.
// Política de autoplay: o AudioContext só é criado/resumido no primeiro
// gesto do usuário (keydown/pointerdown) — o mundo "liga" com o primeiro toque.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = typeof localStorage !== 'undefined' && localStorage.getItem('tec_muted') === '1';
    this.nextTractorBeep = 0;
    this.nextTruckBeep = 0;
    this.misfireT = 0;
    this.duckUntil = 0;
  }

  attachUnlock() {
    const unlock = () => this.init();
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12;
    comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.15;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.buses = {};
    for (const b of ['engine', 'sfx', 'ui']) {
      const g = ctx.createGain();
      g.connect(this.master);
      this.buses[b] = g;
    }

    // Buffers de ruído pré-alocados (reutilizados por todos os efeitos)
    this.white = this.makeNoise(false);
    this.brown = this.makeNoise(true);

    this.buildEngine();
    this.buildWorkLoops();
    ctx.resume();
  }

  makeNoise(brown) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return buf;
  }

  loopSource(buffer) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer; s.loop = true; s.start();
    return s;
  }

  // Motor diesel: sawtooth fundamental + sub square + ruído de combustão,
  // com AM de "cilindros" (LFO) e lowpass que abre com o RPM
  buildEngine() {
    const ctx = this.ctx;
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 52;
    this.engSub = ctx.createOscillator();
    this.engSub.type = 'square'; this.engSub.frequency.value = 26;
    const subGain = ctx.createGain(); subGain.gain.value = 0.35;
    this.engSub.connect(subGain);

    const combNoise = this.loopSource(this.brown);
    const combBP = ctx.createBiquadFilter();
    combBP.type = 'bandpass'; combBP.frequency.value = 350; combBP.Q.value = 0.8;
    const combGain = ctx.createGain(); combGain.gain.value = 0.5;
    combNoise.connect(combBP); combBP.connect(combGain);

    this.chug = ctx.createGain(); this.chug.gain.value = 0.7;
    this.chugLFO = ctx.createOscillator();
    this.chugLFO.type = 'sine'; this.chugLFO.frequency.value = 18;
    const chugDepth = ctx.createGain(); chugDepth.gain.value = 0.3;
    this.chugLFO.connect(chugDepth); chugDepth.connect(this.chug.gain);

    this.engLP = ctx.createBiquadFilter();
    this.engLP.type = 'lowpass'; this.engLP.frequency.value = 550;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;

    this.engOsc.connect(this.chug); subGain.connect(this.chug); combGain.connect(this.chug);
    this.chug.connect(this.engLP); this.engLP.connect(this.engGain);
    this.engGain.connect(this.buses.engine);
    this.engOsc.start(); this.engSub.start(); this.chugLFO.start();
  }

  // Loops contínuos de trabalho: raspagem (coleta), farfalhar (espalhamento),
  // ranger de esteira (giro)
  buildWorkLoops() {
    const ctx = this.ctx;

    const scrapeSrc = this.loopSource(this.white);
    this.scrapeBP = ctx.createBiquadFilter();
    this.scrapeBP.type = 'bandpass'; this.scrapeBP.frequency.value = 900; this.scrapeBP.Q.value = 1.2;
    this.scrapeGain = ctx.createGain(); this.scrapeGain.gain.value = 0;
    scrapeSrc.connect(this.scrapeBP); this.scrapeBP.connect(this.scrapeGain);
    this.scrapeGain.connect(this.buses.sfx);

    const spreadSrc = this.loopSource(this.brown);
    const spreadLP = ctx.createBiquadFilter();
    spreadLP.type = 'lowpass'; spreadLP.frequency.value = 480;
    this.spreadGain = ctx.createGain(); this.spreadGain.gain.value = 0;
    const spreadLFO = ctx.createOscillator(); spreadLFO.frequency.value = 7;
    const spreadDepth = ctx.createGain(); spreadDepth.gain.value = 0.35;
    spreadLFO.connect(spreadDepth); spreadDepth.connect(this.spreadGain.gain); spreadLFO.start();
    spreadSrc.connect(spreadLP); spreadLP.connect(this.spreadGain);
    this.spreadGain.connect(this.buses.sfx);

    const squeakSrc = this.loopSource(this.white);
    this.squeakBP = ctx.createBiquadFilter();
    this.squeakBP.type = 'bandpass'; this.squeakBP.frequency.value = 2200; this.squeakBP.Q.value = 14;
    const sqLFO = ctx.createOscillator(); sqLFO.frequency.value = 3;
    const sqDepth = ctx.createGain(); sqDepth.gain.value = 280;
    sqLFO.connect(sqDepth); sqDepth.connect(this.squeakBP.frequency); sqLFO.start();
    this.squeakGain = ctx.createGain(); this.squeakGain.gain.value = 0;
    squeakSrc.connect(this.squeakBP); this.squeakBP.connect(this.squeakGain);
    this.squeakGain.connect(this.buses.sfx);
  }

  st(param, v, tau = 0.08) {
    param.setTargetAtTime(v, this.ctx.currentTime, tau);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.st(this.master.gain, this.muted ? 0 : 1, 0.02);
    try { localStorage.setItem('tec_muted', this.muted ? '1' : '0'); } catch (e) { /* privado */ }
    return this.muted;
  }

  // Chamado 1x por frame pelo Game.loop — lê TODO o estado de uma vez
  frame(game, dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = game.tractor;
    const phase = game.state.phase;
    const quiet = phase === 'QUIZ' || phase === 'DONE';
    const now = this.ctx.currentTime;

    // ---- Motor ----
    const running = t && !t.isLocked && !quiet;
    let rpm = 0.15, vol = 0;
    if (running) {
      rpm = 0.25 + 0.55 * Math.abs(t.speed) / t.maxSpeed2nd + 0.2 * Math.min(1, t.trashInBlade / 5);
      vol = 0.15 + rpm * 0.13;
    }
    const gearMul = t && t.gear === 1 ? 0.85 : 1;
    let f = (48 + rpm * 34) * gearMul;
    let chugHz = 15 + rpm * 28;
    if (t && t.overloaded) { f *= 0.84; chugHz = 13; }
    this.st(this.engOsc.frequency, f);
    this.st(this.engSub.frequency, f / 2);
    this.st(this.chugLFO.frequency, chugHz);
    this.st(this.engLP.frequency, 500 + rpm * 950);
    const ducked = now < this.duckUntil;
    this.st(this.engGain.gain, ducked ? vol * 0.35 : vol, 0.1);

    // Misfire do motor afogado (sobrecarga)
    if (t && t.overloaded && running) {
      this.misfireT -= dt;
      if (this.misfireT <= 0) {
        this.misfireT = 0.3 + Math.random() * 0.35;
        const g = this.engGain.gain;
        g.setTargetAtTime(vol * 0.5, now, 0.015);
        g.setTargetAtTime(ducked ? vol * 0.35 : vol, now + 0.08, 0.03);
      }
    }

    // ---- Loops de trabalho ----
    const scrape = running ? Math.min(1, (t.collectedThisFrame || 0) * 25) : 0;
    this.st(this.scrapeGain.gain, scrape * 0.13, 0.06);
    if (running) this.st(this.scrapeBP.frequency, 600 + 700 * Math.abs(t.speed) / t.maxSpeed2nd, 0.1);
    const spread = running ? Math.min(1, (t.spreadThisFrame || 0) * 25) : 0;
    this.st(this.spreadGain.gain, spread * 0.15, 0.08);
    const squeal = running && t.turningNow && Math.abs(t.speed) > 5;
    this.st(this.squeakGain.gain, squeal ? 0.045 : 0, 0.05);

    // ---- Bip de ré (o trator; e os caminhões manobrando, atenuados) ----
    if (running && t.speed < -5 && now > this.nextTractorBeep) {
      this.beep(1150, 0.15, 0.16);
      this.nextTractorBeep = now + 0.55;
    }
    if (!quiet && game.trucks) {
      let best = Infinity;
      for (const tr of game.trucks) {
        if (tr.state !== 'MANEUVERING') continue;
        const d = Math.hypot(tr.x - game.camera.x, tr.y - game.camera.y);
        if (d < best) best = d;
      }
      if (best < 900 && now > this.nextTruckBeep) {
        this.beep(900, 0.13, 0.11 / (1 + best / 350));
        this.nextTruckBeep = now + 0.7;
      }
    }
  }

  beep(freq, dur, amp) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square'; osc.frequency.value = freq;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.setValueAtTime(amp, t + dur - 0.02);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(bp); bp.connect(g); g.connect(this.buses.ui);
    osc.start(t); osc.stop(t + dur + 0.02);
    osc.onended = () => { osc.disconnect(); bp.disconnect(); g.disconnect(); };
  }

  // Burst de ruído com filtro — bloco de construção dos one-shots
  noiseBurst(buffer, type, freq, Q, amp, dur, bus = 'sfx') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = buffer;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.buses[bus]);
    s.start(t); s.stop(t + dur + 0.02);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
  }

  tone(type, f0, f1, amp, dur, bus = 'sfx', delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur * 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.buses[bus]);
    o.start(t); o.stop(t + dur + 0.02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  // ---- One-shots do jogo ----
  gearClunk(gear) {
    if (!this.ctx) return;
    this.noiseBurst(this.white, 'bandpass', 2600, 2, 0.12, 0.05);
    this.tone('sine', gear === 2 ? 185 : 170, 120, 0.2, 0.09);
  }

  bladeWhine(up) {
    if (!this.ctx) return;
    this.tone('sawtooth', up ? 320 : 540, up ? 540 : 320, 0.05, 0.26);
    this.noiseBurst(this.white, 'bandpass', 950, 1.5, 0.06, 0.26);
  }

  thump(strong) {
    if (!this.ctx) return;
    const k = strong ? 1 : 0.4;
    this.tone('sine', 110, 42, 0.5 * k, 0.35);
    this.noiseBurst(this.brown, 'lowpass', 220, 1, 0.35 * k, 0.25);
    this.tone('triangle', 65, 60, 0.1 * k, 0.5);
  }

  skreek() {
    if (!this.ctx) return;
    this.tone('sawtooth', 1800, 2400, 0.05, 0.12);
  }

  clank() {
    if (!this.ctx) return;
    this.noiseBurst(this.white, 'bandpass', 320, 9, 0.3, 0.2);
  }

  klaxon() {
    if (!this.ctx) return;
    this.tone('square', 660, 660, 0.1, 0.16, 'ui');
    this.tone('square', 495, 495, 0.1, 0.16, 'ui', 0.18);
    this.tone('square', 660, 660, 0.1, 0.16, 'ui', 0.36);
    this.tone('square', 495, 495, 0.1, 0.16, 'ui', 0.54);
    this.duckUntil = this.ctx.currentTime + 1.2;
  }

  chime() {
    if (!this.ctx) return;
    this.tone('sine', 659, 659, 0.15, 0.45, 'ui');
    this.tone('sine', 880, 880, 0.15, 0.45, 'ui', 0.12);
    this.tone('sine', 1760, 1760, 0.05, 0.4, 'ui', 0.12);
  }

  buzz() {
    if (!this.ctx) return;
    this.tone('sawtooth', 110, 100, 0.12, 0.22, 'ui');
  }

  pop() {
    if (!this.ctx) return;
    this.tone('sine', 520, 520, 0.09, 0.09, 'ui');
  }

  avalanche() {
    if (!this.ctx) return;
    this.noiseBurst(this.brown, 'lowpass', 400, 1, 0.35, 1.2);
    for (let i = 0; i < 6; i++) {
      this.tone('sine', 55 + Math.random() * 45, 45, 0.12, 0.12, 'sfx', Math.random() * 0.9);
    }
  }
}
