import { BLADE, COMPACTION } from '../config/params.js';

// Demonstração-modelo: executa o ciclo TEC completo em faixas retas.
// Regras de ouro que o piloto segue (e que o jogador deve copiar):
//  - Só manobra/vira com a lâmina VAZIA, por baixo do material (na base).
//  - TEC 3: ataca a pilha com 1/3 da lâmina livre (pilhas largas), lâmina 0cm,
//    Marcha 1, empurra em linha reta até o pé do talude.
//  - TEC 4: lâmina 30cm na subida, soltando camada fina por baixo.
//  - TEC 5: pendulação na crista (o peso da máquina adensa a borda).
//  - TEC 4/6: ré com ½ esteira de deslocamento lateral — o "passo de dança"
//    cobre o vão central das esteiras.
//  - TEC 7: ciclos frente-e-ré em linha reta até TODA a faixa ficar na banda
//    verde (3–6 passadas), medindo o terreno de verdade.
export class Autopilot {
  constructor() {
    this.input = {
      keys: {},
      isJustPressed: function(k) { return !!this.keys[k]; },
      isDown: function(k) { return !!this.keys[k]; }
    };
    this.state = 'SCAN';
    this.target = null;       // ponto de staging {x, y}
    this.laneX = null;        // faixa de trabalho atual (px)
    this.returnX = null;      // faixa da ré (alterna a ½ esteira por viagem)
    this.returnToggle = false;
    this.returnPicked = false;
    this.lanes = [];          // faixas usadas, para a compactação final
    this.compactCycles = 0;   // ciclos de acabamento na faixa atual
    this.compactPlans = 0;    // rodadas de planejamento do acabamento
    this.lastCompactX = null; // última faixa compactada (para ladrilhar sem sobrepor)
    this.pendulated = new Set(); // faixas já penduladas
    this.announced = new Set();  // narração didática: cada mensagem uma vez
    this.waitTimer = 0;
    this.stateTime = 0;       // watchdog contra estados travados
    this.watchdogTrips = 0;
  }

  announce(game, msg) {
    if (!game || this.announced.has(msg)) return;
    this.announced.add(msg);
    game.hud.addMessage(msg, 'apontador');
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
    this.returnPicked = false;
  }

  stagingPoint(terrain, laneX) {
    // Bem abaixo da borda da praça: manobra fora do material e
    // sobra espaço de aproximação para entrar na pilha já alinhado
    return { x: laneX, y: terrain.height * terrain.cellSize + 80 };
  }

  // Ângulo para subir/descer reto mantendo a faixa (corrige deriva lateral).
  // Em ré o efeito do esterço inverte, então a correção troca de sinal.
  laneAngle(t, forward, targetX) {
    const err = t.x - targetX;
    const corr = Math.max(-0.35, Math.min(0.35, err * 0.02));
    return -Math.PI / 2 + (forward ? -corr : corr);
  }

  // Ladrilha as colunas SUB-COMPACTADAS da rampa em telhas de 4 colunas.
  // Cada telha vira um ciclo de acabamento (ida em t, volta em t+1).
  // Replaneja em rodadas: a deriva do esterço deixa retardatárias, e a
  // rodada seguinte mira só nelas.
  planCompactTiles(terrain) {
    const cs = terrain.cellSize;
    const tiles = [];
    let coveredUpTo = -1;
    for (let x = 0; x < terrain.width; x++) {
      if (x <= coveredUpTo) continue;
      let pending = false;
      for (let y = terrain.crestRow; y <= terrain.peRow; y++) {
        const cell = terrain.cells[y][x];
        if (cell.height > 0.01 && cell.passes < COMPACTION.IDEAL_MIN) { pending = true; break; }
      }
      if (!pending) continue;
      const t = Math.min(x + 1, terrain.width - 3); // footprint t-1..t+2 cobre x..x+3
      tiles.push(t * cs + cs / 2);
      coveredUpTo = t + 2;
    }
    return tiles;
  }

  // Passadas nas células com material da faixa (rampa + crista).
  // A faixa cobre 4 colunas: laneX-1..laneX+2 (ida em laneX, volta em laneX+1).
  lanePasses(terrain, laneX) {
    const cs = terrain.cellSize;
    const c = Math.floor(laneX / cs);
    let min = Infinity;
    let max = 0;
    for (let y = terrain.crestRow; y <= terrain.peRow; y++) {
      for (let x = Math.max(0, c - 1); x <= Math.min(terrain.width - 1, c + 2); x++) {
        const cell = terrain.cells[y][x];
        if (cell.height > 0.01) {
          min = Math.min(min, cell.passes);
          max = Math.max(max, cell.passes);
        }
      }
    }
    return { min, max };
  }

  update(dt, tractor, terrain, game) {
    this.input.keys = {};

    if (!tractor || !terrain) return;

    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      return;
    }

    // Watchdog: nenhum estado pode durar mais de 25s; se travar, recomeça a busca
    this.stateTime += dt;
    if (this.state !== 'DONE' && this.stateTime > 25) {
      this.watchdogTrips++;
      this.setState(this.watchdogTrips > 3 ? 'DONE' : 'SCAN');
    }

    const t = tractor;
    const cs = terrain.cellSize;
    const tcY = t.y / cs;

    switch (this.state) {

      case 'SCAN': {
        t.bladeHeight = 30; // lâmina erguida: deslocamento sem tocar o terreno
        t.gear = 2;

        // TEC 7 (sentido de trabalho): procura a pilha mais à ESQUERDA na
        // zona de descarga — trabalha sempre num sentido só, como cortar grama
        let minCol = null;
        let maxCol = null;
        for (let x = 0; x < terrain.width; x++) {
          let colHasTrash = false;
          for (let y = terrain.peRow; y < terrain.height; y++) {
            if (terrain.cells[y][x].height > 0.1) { colHasTrash = true; break; }
          }
          if (colHasTrash) {
            if (minCol === null) minCol = x;
            // extensão contígua da primeira pilha (tolerância de 1 coluna vazia)
            if (maxCol === null || x <= maxCol + 2) maxCol = x;
          } else if (minCol !== null && x > maxCol + 2) {
            break;
          }
        }

        if (minCol !== null) {
          const pileWidth = maxCol - minCol + 1;
          if (pileWidth > 3) {
            // Pilha mais larga que a lâmina: TEC 3 — ataca pela borda,
            // deixando o terço EXTERNO (esquerdo) livre; a rebarba cai só
            // para dentro e é processada no próximo ciclo
            this.laneX = minCol * cs + cs / 2;
            this.announce(game, '🤖 TEC 3: pilha mais larga que a lâmina — ataque com 1/3 da lâmina LIVRE no lado de fora. A rebarba cai só para dentro.');
          } else {
            // Pilha estreita: centro de massa para a lâmina pegar tudo
            let sumXH = 0, sumH = 0;
            for (let y = terrain.peRow; y < terrain.height; y++) {
              for (let x = minCol; x <= maxCol; x++) {
                const cell = terrain.cells[y][x];
                if (cell.height > 0.1) {
                  sumXH += (x * cs + cs / 2) * cell.height;
                  sumH += cell.height;
                }
              }
            }
            this.laneX = sumH > 0 ? sumXH / sumH : (minCol * cs + cs / 2);
          }

          // Reaproveita faixa existente próxima (evita faixas sobrepostas)
          const existing = this.lanes.find(l => Math.abs(l - this.laneX) < cs * 1.5);
          if (existing !== undefined) this.laneX = existing;

          this.target = this.stagingPoint(terrain, this.laneX);
          this.setState('REPOSITION');
          this.announce(game, '🤖 Piloto: deslocando com a lâmina ERGUIDA, vazio e por baixo do material — nunca vire com a lâmina carregada.');
        } else {
          // Sem lixo solto: planeja o acabamento ladrilhando a região
          // TRABALHADA da rampa em telhas de 4 colunas (o footprint exato de
          // um ciclo frente-e-ré com ½ esteira) — independe do histórico de
          // ataques, que fica irregular com as rebarbas
          this.lanes = this.compactPlans < 3 ? this.planCompactTiles(terrain) : [];
          if (this.lanes.length > 0) {
            this.compactPlans++;
            this.setState('COMPACT_NEXT');
          } else {
            this.setState('DONE');
          }
        }
        break;
      }

      case 'REPOSITION': {
        t.bladeHeight = 30; // viaja com a lâmina erguida (não esfrega as pilhas)
        const dist = Math.hypot(t.x - this.target.x, t.y - this.target.y);
        t.gear = dist > 150 ? 2 : 1; // devagar perto do alvo = raio de giro menor
        this.driveTo(t, this.target.x, this.target.y);
        // Precisa chegar CENTRADO na faixa, senão a lâmina perde uma coluna da pilha
        if (Math.abs(t.x - this.target.x) < 10 && Math.abs(t.y - this.target.y) < 50) {
          this.setState('ALIGN');
        }
        break;
      }

      case 'ALIGN': {
        t.bladeHeight = 30; // alinha com a lâmina erguida (vazia: nada acontece)
        t.gear = 1;

        let diff = -Math.PI / 2 - t.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        // Tolerância > giro por frame (0,05 rad) — senão oscila para sempre
        if (Math.abs(diff) < 0.06) {
          if (!this.lanes.includes(this.laneX)) this.lanes.push(this.laneX);
          this.setState('PUSH');
        } else {
          if (Math.abs(t.speed) < 15) this.input.keys['KeyW'] = true; // direção previsível
          if (diff > 0) this.input.keys['KeyD'] = true;
          else this.input.keys['KeyA'] = true;
        }
        break;
      }

      case 'PUSH': {
        t.bladeHeight = BLADE.TRANSPORT; // lâmina no chão
        t.gear = 1;                      // torque para empurrar
        this.steer(t, this.laneAngle(t, true, this.laneX), true);
        this.announce(game, '🤖 Transporte (TEC 3): lâmina a 0cm e Marcha 1 — empurrando em LINHA RETA até o pé, sem deixar lixo no caminho.');

        if (tcY < terrain.height * 0.78) {
          this.setState('SPREAD');
        }
        break;
      }

      case 'SPREAD': {
        t.bladeHeight = 30; // solta camada de 30cm por baixo (TEC 4)
        t.gear = 1;
        this.steer(t, this.laneAngle(t, true, this.laneX), true);
        this.announce(game, '🤖 TEC 4: subindo a rampa com a lâmina a 20–30cm — o material sai por baixo em camada fina (≤30cm).');

        const atCrest = tcY <= terrain.height * 0.42;
        const empty = t.trashInBlade <= 0.05;
        if (atCrest && !empty) {
          // Chegou na crista COM lixo (camada da faixa encheu): não pendula
          // carregado — "chegar na crista sem lixo" é pré-condição da TEC 5.
          // Desce de ré e leva o excedente na próxima viagem.
          this.setState('RETURN');
          this.waitTimer = 0.3;
        } else if (atCrest || empty) {
          if (!this.pendulated.has(this.laneX)) {
            // Segue até a crista para demonstrar a TEC 5 (mesmo se esvaziou antes)
            this.pendulated.add(this.laneX);
            this.setState(atCrest ? 'PENDULUM' : 'CLIMB');
            this.waitTimer = 0.4;
          } else {
            this.setState('RETURN');
            this.waitTimer = 0.4;
          }
        }
        break;
      }

      case 'CLIMB': {
        // Sobe vazio até a crista, regularizando a camada recém-espalhada
        t.bladeHeight = BLADE.REGULARIZE;
        t.gear = 2;
        this.steer(t, this.laneAngle(t, true, this.laneX), true);

        if (tcY <= terrain.height * 0.42) {
          this.setState('PENDULUM');
        }
        break;
      }

      case 'PENDULUM': {
        t.bladeHeight = 30;
        t.gear = 1;
        this.steer(t, this.laneAngle(t, true, this.laneX), true);
        this.announce(game, '🤖 TEC 5: pendulação na crista — o peso da máquina concentrado na quina adensa a borda do talude.');

        if (tcY <= terrain.height * 0.36) {
          this.setState('RETURN');
          this.waitTimer = 0.4;
        }
        break;
      }

      case 'RETURN': {
        // TEC 4/6 + 7: ré com ½ ESTEIRA de deslocamento lateral — as esteiras
        // da volta pisam no vão que a ida deixou (o "passo de dança").
        // O lado ALTERNA a cada viagem: é isso que distribui as passadas
        // uniformemente pelas 4 colunas da faixa ao longo das viagens.
        if (!this.returnPicked) {
          this.returnPicked = true;
          this.returnToggle = !this.returnToggle;
          this.returnX = this.returnToggle
            ? Math.min(this.laneX + cs, (terrain.width - 2) * cs)
            : this.laneX;
        }
        // Alisa a 10cm SÓ na rampa; na praça a lâmina viaja erguida —
        // senão a ré esparrama as pilhas que ainda esperam transporte
        t.bladeHeight = tcY > terrain.height * 0.8 ? 30 : BLADE.REGULARIZE;
        t.gear = 2;
        this.steer(t, this.laneAngle(t, false, this.returnX), false);
        this.announce(game, '🤖 Passo de dança (TEC 4/6): descendo de RÉ deslocado ½ esteira — a volta compacta o vão que a ida deixou. Lâmina a 10cm alisando.');

        if (tcY > terrain.height * 0.9) {
          this.setState('SCAN');
        }
        break;
      }

      case 'COMPACT_NEXT': {
        if (this.lanes.length === 0) {
          // Rodada concluída: volta ao SCAN, que replaneja sobre o que restou
          this.setState('SCAN');
          break;
        }
        this.laneX = this.lanes.shift();
        // Ladrilha o acabamento: cada ciclo cobre 4 colunas (ida laneX±1,
        // volta laneX+1 → laneX, laneX+2). Faixas vizinhas de uma pilha larga
        // se sobrepõem — desloca para a próxima "telha" de 4 colunas
        if (this.lastCompactX !== null && Math.abs(this.laneX - this.lastCompactX) < 4 * cs) {
          this.laneX = this.lastCompactX + 4 * cs;
        }
        this.lastCompactX = this.laneX;
        this.compactCycles = 0;
        this.target = this.stagingPoint(terrain, this.laneX);
        this.setState('COMPACT_GOTO');
        this.announce(game, '🤖 Acabamento (TEC 7): ciclos frente-e-ré em linha reta até TODA a faixa ficar na banda VERDE (3–6 passadas). Mais que isso desperdiça diesel.');
        break;
      }

      case 'COMPACT_GOTO': {
        t.bladeHeight = 30; // deslocamento com lâmina erguida
        t.gear = 2;
        this.driveTo(t, this.target.x, this.target.y);
        if (Math.hypot(t.x - this.target.x, t.y - this.target.y) < 30) {
          this.setState('COMPACT_ALIGN');
        }
        break;
      }

      case 'COMPACT_ALIGN': {
        t.bladeHeight = 30; // alinha com a lâmina erguida
        t.gear = 1;

        let diff = -Math.PI / 2 - t.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) < 0.06) {
          this.setState('COMPACT_UP');
        } else {
          if (Math.abs(t.speed) < 15) this.input.keys['KeyW'] = true;
          if (diff > 0) this.input.keys['KeyD'] = true;
          else this.input.keys['KeyA'] = true;
        }
        break;
      }

      case 'COMPACT_UP': {
        t.bladeHeight = tcY > terrain.height * 0.8 ? 30 : BLADE.REGULARIZE;
        t.gear = 2;
        this.steer(t, this.laneAngle(t, true, this.laneX), true);
        // Sobe até a beira da crista (sem cruzá-la: ela já foi adensada na
        // pendulação) — as fileiras logo abaixo também precisam de passadas
        if (tcY <= terrain.height * 0.42) {
          this.setState('COMPACT_DOWN');
        }
        break;
      }

      case 'COMPACT_DOWN': {
        // Volta deslocado ½ esteira (passo de dança) — cada ciclo completo
        // adiciona 1 passada uniforme nas 4 colunas da faixa
        t.bladeHeight = tcY > terrain.height * 0.8 ? 30 : BLADE.REGULARIZE;
        t.gear = 2;
        this.returnX = Math.min(this.laneX + cs, (terrain.width - 2) * cs);
        this.steer(t, this.laneAngle(t, false, this.returnX), false);
        if (tcY > terrain.height * 0.9) {
          this.compactCycles++;
          // Mede o terreno: repete o ciclo até a pior célula da faixa entrar
          // na banda verde (teto de ciclos protege contra super compactação)
          const { min } = this.lanePasses(terrain, this.laneX);
          if (min < COMPACTION.IDEAL_MIN && this.compactCycles < 4) {
            this.setState('COMPACT_UP');
          } else {
            this.setState('COMPACT_NEXT');
          }
        }
        break;
      }

      case 'DONE': {
        // Posição de entrega: lâmina baixa, Marcha 1, parado
        t.bladeHeight = BLADE.TRANSPORT;
        t.gear = 1;
        this.announce(game, '🤖 Operação concluída: rampa na banda verde, crista batida, lâmina vazia, sem sobras na praça.');
        break;
      }
    }
  }

  driveTo(t, tx, ty) {
    const targetAngle = Math.atan2(ty - t.y, tx - t.x);
    this.steer(t, targetAngle, true);
  }

  steer(t, targetAngle, forward) {
    let diff = targetAngle - t.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    this.input.keys[forward ? 'KeyW' : 'KeyS'] = true;

    // Com a lâmina carregada, esterça em PULSOS curtos (regra da curva em
    // carga: microcorreções sim, curva contínua não)
    const pulse = t.trashInBlade > 0.1 ? (this.stateTime % 0.5) < 0.3 : true;

    if (Math.abs(diff) > 0.02 && pulse) {
      // Em ré o esterço tem sinal oposto (angle += turnSpeed * direction)
      const key = (diff > 0) === forward ? 'KeyD' : 'KeyA';
      this.input.keys[key] = true;
    }
  }
}
