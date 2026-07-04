import { Game } from './engine/Game.js';
import { TerrainGrid } from './world/TerrainGrid.js';
import { Tractor } from './entities/Tractor.js';
import { Truck } from './entities/Truck.js';
import { AudioEngine } from './engine/AudioEngine.js';

window.addEventListener('DOMContentLoaded', () => {
  // Botões não guardam foco após o clique — senão Espaço (freio) e Enter
  // (finalizar turno) reativam o último botão clicado durante a operação
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) btn.blur();
  });

  const game = new Game('gameCanvas');

  // Áudio sintetizado: desbloqueia no primeiro gesto (política de autoplay)
  const audio = new AudioEngine();
  audio.attachUnlock();
  game.audio = audio;

  const muteBtn = document.getElementById('btn-mute');
  if (muteBtn) {
    const sync = () => {
      muteBtn.textContent = audio.muted ? '🔇' : '🔊';
      muteBtn.classList.toggle('muted', audio.muted);
    };
    sync();
    muteBtn.addEventListener('click', () => { audio.toggleMute(); sync(); });
  }

  // Initialize Terrain (40 x 60 células, 20px por metro)
  game.terrain = new TerrainGrid(40, 60, 20);

  // Initialize Tractor at the bottom center (discharge area)
  game.tractor = new Tractor(40 * 20 / 2, 55 * 20);

  // Inject Truck class into game for spawning
  game.truckClass = Truck;

  window.game = game; // acesso no console para debug

  // Auto-start in DEMO mode
  game.state.isDemo = true;
  game.state.phase = 'WAITING_TRUCKS';
  document.getElementById('demo-banner').style.display = 'flex';
  game.start();
  game.tractor.isLocked = false; // Unlock for AI

  // Wire up the 'Take Control' button
  document.getElementById('btn-take-control').addEventListener('click', () => {
    game.beginPlayerShift('Você assumiu o comando. Aguarde a batelada ou organize a praça.');
    // Os controles colapsam sozinhos depois do aprendizado (H reabre)
    setTimeout(() => {
      const panel = document.getElementById('controls-panel');
      if (panel && !panel.classList.contains('collapsed')) panel.classList.add('collapsed');
    }, 60000);
  });

  // Clique no cabeçalho dos controles também alterna a pílula
  const controlsHeader = document.getElementById('controls-header');
  if (controlsHeader) {
    controlsHeader.style.cursor = 'pointer';
    controlsHeader.addEventListener('click', () => game.hud.toggleControls());
  }

  // Wire up Finish Shift button
  document.getElementById('btn-finish-shift').addEventListener('click', () => {
    if (game.state.phase === 'READY' || game.state.phase === 'WAITING_TRUCKS') {
      game.finishShift();
    }
  });
});
