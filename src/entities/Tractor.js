import { BLADE, SAFETY, COMPACTION, LAYER, TEC6, DIESEL } from '../config/params.js';

export class Tractor {
  constructor(x, y) {
    this.x = x;
    this.y = y;

    // Proporções de um trator de esteiras classe D61/D6 (célula = 1 m):
    // corpo ~4,5 m × 2 m, lâmina cobrindo 3 células (~3,3 m)
    this.width = 40; // px (2 m)
    this.length = 76; // px (3,8 m + lâmina)
    this.angle = -Math.PI / 2; // Facing up (towards crest)

    // Physics
    this.speed = 0;
    this.maxSpeed1st = 60; // px/s (approx 1st gear)
    this.maxSpeed2nd = 120; // px/s (2nd gear)
    this.gear = 1; // 1 or 2

    // Blade
    this.bladeHeight = 0; // cm (0, 10, 20, 30)
    this.trashInBlade = 0; // m³ (máx. BLADE.CAPACITY)

    // Status
    this.direction = 1; // 1 = forward, -1 = reverse
    this.isLocked = true; // Locked until batch is ready

    // Telemetry (KPIs)
    this.safetyViolations = 0;
    this.qualityViolations = 0;
    this.improductiveMoves = 0;   // tomadas de distância (TEC 6)
    this.distanceTraveled = 0;
    this.dieselUsed = 0;          // L — consumo virtual do turno
    this.violationCooldowns = { turn: 0, truck: 0 };
    this.turnLoadedTime = 0; // esterço contínuo em carga (microcorreções têm carência)

    // Rastro de esteira (carimbado no canvas de trilhas do terreno)
    this.trackAccum = 0;
    this.treadPhase = 0;          // animação das sapatas (avança com a distância)

    // Acumuladores por frame para o áudio (raspagem/farfalhar)
    this.collectedThisFrame = 0;
    this.spreadThisFrame = 0;
    this.turningNow = false;

    // Eventos consumidos pelo Game (coach/quiz/efeitos)
    this.attackEvent = null;      // disparado quando a lâmina engaja uma pilha
    this.pendulumEvent = false;   // carimbo novo na crista (TEC 5)
    this.hitCompactedFlag = false;// tentou raspar material já compactado
    this.spreadOutsideFlag = false; // espalhou fora da rampa (TEC 2/4)
    this.overloaded = false;      // lâmina cheia empurrando excesso (rebarba)
    this.reverseRun = 0;          // ré contínua vazia na praça (TEC 6)
    this.tookDistanceFlag = false;
  }

  update(dt, input, terrain, game) {
    // Cooldowns de violação correm mesmo parado
    for (const key in this.violationCooldowns) {
      if (this.violationCooldowns[key] > 0) this.violationCooldowns[key] -= dt;
    }


    if (this.isLocked) return; // Cannot move while locked

    // Diesel: técnica errada = combustível queimado (transbordo custa caro)
    this.dieselUsed += dt * (
      DIESEL.IDLE +
      DIESEL.SPEED * Math.abs(this.speed) / this.maxSpeed2nd +
      (this.trashInBlade > 0.1 ? DIESEL.LOADED : 0) +
      (this.overloaded ? DIESEL.OVERLOAD : 0)
    );

    // 1. Handle Gears
    if (input.isJustPressed('ShiftLeft') || input.isJustPressed('ShiftRight')) {
      this.gear = this.gear === 1 ? 2 : 1;
      if (game && game.audio) game.audio.gearClunk(this.gear);
    }

    // 2. Handle Blade Height
    if (input.isJustPressed('KeyQ') && this.bladeHeight > 0) {
      this.bladeHeight = Math.max(0, this.bladeHeight - 10);
      if (game && game.audio) game.audio.bladeWhine(false);
    }
    if (input.isJustPressed('KeyE') && this.bladeHeight < 30) {
      this.bladeHeight = Math.min(30, this.bladeHeight + 10);
      if (game && game.audio) game.audio.bladeWhine(true);
    }

    // 3. Movement input
    const isMovingForward = input.isDown('KeyW') || input.isDown('ArrowUp');
    const isMovingBackward = input.isDown('KeyS') || input.isDown('ArrowDown');

    let targetSpeed = 0;
    if (isMovingForward) {
      targetSpeed = this.gear === 1 ? this.maxSpeed1st : this.maxSpeed2nd;
      this.direction = 1;
    } else if (isMovingBackward) {
      targetSpeed = -(this.gear === 1 ? this.maxSpeed1st : this.maxSpeed2nd);
      this.direction = -1;
    }

    // Lâmina transbordando (pegou mais do que a capacidade): a máquina "afoga"
    if (this.overloaded && targetSpeed > 0) targetSpeed *= 0.55;

    // Smooth acceleration
    const accel = 200;
    if (this.speed < targetSpeed) {
      this.speed = Math.min(this.speed + accel * dt, targetSpeed);
    } else if (this.speed > targetSpeed) {
      this.speed = Math.max(this.speed - accel * dt, targetSpeed);
    }

    // Braking
    if (input.isDown('Space')) {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - accel * 2 * dt);
      if (this.speed < 0) this.speed = Math.min(0, this.speed + accel * 2 * dt);
    }

    // 4. Turning (Differential Steering)
    const isTurningLeft = input.isDown('KeyA') || input.isDown('ArrowLeft');
    const isTurningRight = input.isDown('KeyD') || input.isDown('ArrowRight');

    const turnSpeed = 1.5; // rad/s
    if (isTurningLeft) {
      this.angle -= turnSpeed * dt * this.direction;
    }
    if (isTurningRight) {
      this.angle += turnSpeed * dt * this.direction;
    }
    this.turningNow = isTurningLeft || isTurningRight;

    // Safety check: curva em carga (TEC 7). Só vira violação depois de
    // TURN_GRACE segundos de esterço contínuo — microcorreções de rumo
    // são operação normal.
    if ((isTurningLeft || isTurningRight) && Math.abs(this.speed) > 10 && this.trashInBlade > 0.1) {
      this.turnLoadedTime += dt;
      if (game && this.turnLoadedTime > SAFETY.TURN_GRACE && this.violationCooldowns.turn <= 0) {
        game.triggerAlert('SEGURANÇA: Curva em carga! Risco ao equipamento.');
        this.safetyViolations++;
        this.violationCooldowns.turn = SAFETY.VIOLATION_COOLDOWN;
      }
    } else {
      this.turnLoadedTime = 0;
    }

    // 5. Apply Position
    const dist = this.speed * dt;
    this.x += Math.cos(this.angle) * dist;
    this.y += Math.sin(this.angle) * dist;
    this.distanceTraveled += Math.abs(dist);

    // Rastro persistente: carimba as duas esteiras no canvas de trilhas —
    // as passadas escurecem por acúmulo e o VÃO central fica visível
    // (é o retrato do "passo de dança")
    this.treadPhase = (this.treadPhase + dist) % 6;
    this.trackAccum += Math.abs(dist);
    if (this.trackAccum > 6 && Math.abs(this.speed) > 5 && terrain && terrain.stampTrack) {
      this.trackAccum = 0;
      terrain.stampTrack(this.x, this.y, this.angle, this.width);
    }

    // Limites da praça: margem estreita nas laterais/topo, folga embaixo
    // para a manobra de staging fora do material
    if (terrain) {
      const maxX = terrain.width * terrain.cellSize;
      const maxY = terrain.height * terrain.cellSize;
      this.x = Math.max(-20, Math.min(maxX + 20, this.x));
      this.y = Math.max(-20, Math.min(maxY + 120, this.y));
    }

    // TEC 6 (Encaixe): "tomada de distância" = ré longa e vazia na praça.
    // O encaixe correto é uma baliza curta; ré comprida é movimento improdutivo.
    // Só conta ré COMANDADA (a inércia da frenagem não é tomada de distância).
    if (terrain) {
      const inPraca = this.y > terrain.peRow * terrain.cellSize;
      if (isMovingBackward && this.speed < -10 && this.trashInBlade <= 0.05 && inPraca) {
        this.reverseRun += Math.abs(dist);
        if (this.reverseRun > TEC6.REVERSE_RUN_MAX) {
          this.reverseRun = -Infinity; // uma ocorrência por ré contínua
          this.tookDistanceFlag = true;
        }
      } else if (this.speed > 10) {
        this.reverseRun = 0;
      }
    }

    // 6. Terrain Interaction (TECs 3, 4, 5 e 7)
    this.interactWithTerrain(terrain, dt, game);
  }

  // Células sob a largura da lâmina (centro ± 1 célula na perpendicular),
  // com a posição da frente da lâmina e o vetor perpendicular para os vizinhos
  getBladeContext(terrain) {
    const bladeDist = this.length / 2;
    const bx = this.x + Math.cos(this.angle) * bladeDist;
    const by = this.y + Math.sin(this.angle) * bladeDist;
    const px = Math.cos(this.angle + Math.PI / 2);
    const py = Math.sin(this.angle + Math.PI / 2);

    const slots = [];
    const seen = [];
    for (let o = -1; o <= 1; o++) {
      const cell = terrain.getCellAt(bx + px * o * terrain.cellSize, by + py * o * terrain.cellSize);
      if (cell && !seen.includes(cell)) {
        seen.push(cell);
        slots.push({ cell, o });
      }
    }
    return { slots, bx, by, px, py };
  }

  interactWithTerrain(terrain, dt, game) {
    if (!terrain) return;

    const ctx = this.getBladeContext(terrain);
    const cs = terrain.cellSize;
    this.overloaded = false;
    this.collectedThisFrame = 0;
    this.spreadThisFrame = 0;

    if (ctx.slots.length > 0 && Math.abs(this.speed) > 1) {
      if (this.bladeHeight === BLADE.REGULARIZE) {
        // Regularização: nivela as células sob a lâmina para a média DELAS —
        // transfere material dos altos para os baixos, conservando a massa
        // total (funciona também de ré). Não dilui passadas: é a mesma camada.
        const heights = ctx.slots.map(({ cell }) => cell.height);
        const mean = heights.reduce((a, b) => a + b, 0) / ctx.slots.length;
        if (mean > 0.003) {
          const factor = Math.min(1, BLADE.SMOOTH_RATE * dt);
          for (const { cell } of ctx.slots) {
            cell.height += (mean - cell.height) * factor;
          }
        }
      } else if (this.bladeHeight === BLADE.TRANSPORT && this.speed > 0) {
        this.collectAndSpill(terrain, ctx, dt, game);
      } else if (this.bladeHeight >= BLADE.SPREAD_MIN && this.speed > 0) {
        // Espalhamento (TEC 4): solta camada com espessura igual à altura da lâmina
        const targetLayer = this.bladeHeight / 100; // 20cm → 0.20m, 30cm → 0.30m
        for (const { cell } of ctx.slots) {
          // > 0.05: pó residual na lâmina não "espalha" (evita sujar o platô)
          if (this.trashInBlade > 0.05 && cell.height < targetLayer) {
            const drop = Math.min(
              BLADE.SPREAD_RATE * dt,
              this.trashInBlade,
              targetLayer - cell.height
            );
            terrain.addMaterial(cell, drop);
            this.trashInBlade -= drop;
            this.spreadThisFrame += drop;
            // "Lixo só é preenchido na rampa" (TEC 2/4): espalhar na praça
            // ou no platô é erro didático
            if (drop > 0 && !cell.isRamp && !cell.isCrest) {
              this.spreadOutsideFlag = true;
            }
          }
        }
      }
    }

    // Compactação (TEC 7): SÓ com a lâmina vazia — "compactar é passar sobre o
    // resíduo SEM lixo na lâmina". As esteiras são duas (o = ±1) com VÃO no
    // centro: a coluna do meio só é coberta deslocando ½ esteira ao voltar —
    // é o "passo de dança" da Espec. §6.
    if (Math.abs(this.speed) > 10 && this.trashInBlade <= 0.05) {
      const basePass = Math.abs(this.speed) * dt / cs;
      const done = [];
      for (const o of [-1, 1]) {
        const cell = terrain.getCellAt(this.x + ctx.px * o * cs, this.y + ctx.py * o * cs);
        if (!cell || done.includes(cell)) continue;
        done.push(cell);

        // Monte solto alto não compacta por cima (a máquina só revolve);
        // passada só conta em camada compactável (≤ 60 cm)
        if (cell.height > LAYER.OCA_MIN) continue;

        let passRate = basePass;
        // Pendulação na crista (TEC 5): peso concentrado na quina = dobro
        if (cell.isCrest) {
          passRate *= 2;
          if (!cell.crestStamp) {
            cell.crestStamp = true;
            this.pendulumEvent = true;
          }
        }
        cell.passes += passRate;
      }
    }
  }

  // Coleta com lâmina a 0 (TEC 3): pega lixo SOLTO até a capacidade; material
  // já compactado não volta para a lâmina. Com a lâmina cheia, o excesso
  // transborda para o lado engajado — a REBARBA DIRECIONAL da Espec. §5.2:
  // ataque 2/3|1/3 deixa o lado de fora limpo; ataque pelo centro suja os dois.
  collectAndSpill(terrain, ctx, dt, game) {
    const cs = terrain.cellSize;
    const wasEmpty = this.trashInBlade < 0.1;
    // Na PRAÇA (zona de transporte) tudo é coletável — o tráfego de ida e
    // volta cruza as pilhas e acumularia "passadas" que travariam o material.
    // A proteção contra raspagem só vale na rampa/platô (trabalho acabado).
    const inPraca = ctx.by > terrain.peRow * cs;

    const engagedAt = (o) => {
      const cell = terrain.getCellAt(ctx.bx + ctx.px * o * cs, ctx.by + ctx.py * o * cs);
      return !!(cell && cell.height > 0.05);
    };
    const leftEngaged = engagedAt(-1);
    const rightEngaged = engagedAt(1);

    for (const { cell, o } of ctx.slots) {
      if (cell.height <= 0) continue;

      // Material compactado (faixa verde ou além) não é raspado — na rampa
      if (!inPraca && cell.passes >= COMPACTION.IDEAL_MIN) {
        this.hitCompactedFlag = true;
        continue;
      }

      const freeCapacity = BLADE.CAPACITY - this.trashInBlade;
      if (freeCapacity > 0.001) {
        const amount = Math.min(BLADE.PICKUP_RATE * dt, cell.height, freeCapacity);
        this.trashInBlade += amount;
        this.collectedThisFrame += amount;
        cell.height = Math.max(0, cell.height - amount);
      } else {
        // Lâmina cheia: um pouco vaza pelos lados (rebarba) e o RESTO fica
        // para trás como cordão na própria faixa — a máquina passa por cima
        // ("sobe no resíduo") e o material é recolhido na próxima viagem
        this.overloaded = true;
        const flow = Math.min(cell.height, BLADE.SPILL_RATE * dt);
        if (flow <= 0) continue;

        let sides;
        if (o < 0) sides = [-2];
        else if (o > 0) sides = [2];
        else if (leftEngaged && !rightEngaged) sides = [-2];
        else if (rightEngaged && !leftEngaged) sides = [2];
        else sides = [-2, 2]; // engajado dos dois lados: rebarba dupla

        // Conserva a massa: só sai da célula o que de fato caiu em algum lugar
        const portion = flow / sides.length;
        let spilled = 0;
        for (const side of sides) {
          const dest = terrain.getCellAt(ctx.bx + ctx.px * side * cs, ctx.by + ctx.py * side * cs);
          if (dest) {
            terrain.addMaterial(dest, portion);
            spilled += portion;
            // Detritos visíveis arremessados para o lado da rebarba
            if (game && game.emitSpill) {
              game.emitSpill(ctx.bx + ctx.px * side * cs * 0.6, ctx.by + ctx.py * side * cs * 0.6,
                ctx.px * side, ctx.py * side);
            }
          }
        }
        cell.height = Math.max(0, cell.height - spilled);
      }
    }

    // Ataque à pilha detectado (transição vazio → carregado): o Game avalia
    // se foi 2/3|1/3 (um lado livre) ou pelo centro (TEC 3) e o sentido de
    // trabalho (TEC 7)
    if (wasEmpty && this.trashInBlade >= 0.1) {
      this.attackEvent = {
        x: ctx.bx, y: ctx.by,
        leftEngaged, rightEngaged,
        beyondLeft: engagedAt(-2),
        beyondRight: engagedAt(2),
      };
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const hw = this.width / 2;
    const hl = this.length / 2;

    // 0. Sombra projetada (luz fixa vinda do topo-esquerda do MUNDO):
    // o offset é girado de volta para ficar estável independente do heading
    const sc = Math.cos(-this.angle), ss = Math.sin(-this.angle);
    const sx = sc * 4 - ss * 6, sy = ss * 4 + sc * 6;
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.roundRect(-hl + sx * 1.6, -hw + sy * 1.6, this.length + 8, this.width, 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.roundRect(-hl + sx, -hw + sy, this.length + 8, this.width, 6); ctx.fill();

    // 1. Tracks (Esteiras) - Escuras e Metálicas
    ctx.fillStyle = '#2c2c2e';
    ctx.fillRect(-hl, -hw, this.length, 8); // Left track
    ctx.fillRect(-hl, hw - 8, this.length, 8); // Right track

    // Sapatas ANIMADAS: deslocam com a distância percorrida (param no freio,
    // invertem na ré) — a máquina deixa de "deslizar"
    ctx.save();
    ctx.beginPath();
    ctx.rect(-hl, -hw, this.length, 8);
    ctx.rect(-hl, hw - 8, this.length, 8);
    ctx.clip();
    ctx.fillStyle = '#1c1c1e';
    for (let i = -hl - 6 + this.treadPhase; i < hl + 6; i += 6) {
      ctx.fillRect(i, -hw, 2, 8);
      ctx.fillRect(i, hw - 8, 2, 8);
    }
    ctx.restore();

    // 2. Chassi Principal
    ctx.fillStyle = '#F0B429'; // CAT Yellow
    ctx.fillRect(-hl + 5, -hw + 8, this.length - 20, this.width - 16);

    // 3. Motor (Frente do trator, virado para a direita no ângulo 0)
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(hl - 25, -hw + 12, 20, this.width - 24);

    // Grelha do motor
    ctx.fillStyle = '#3a3a3c';
    for(let i = -hw + 14; i < hw - 14; i += 4) {
        ctx.fillRect(hl - 22, i, 14, 2);
    }

    // 4. Cabine (Vidro)
    ctx.fillStyle = 'rgba(28, 28, 30, 0.9)';
    ctx.fillRect(-hl + 10, -hw + 12, 18, this.width - 24);

    // Teto da cabine
    ctx.fillStyle = '#F0B429';
    ctx.fillRect(-hl + 12, -hw + 14, 14, this.width - 28);

    // Escapamento
    ctx.fillStyle = '#8e8e93';
    ctx.beginPath();
    ctx.arc(hl - 10, -hw + 10, 2, 0, Math.PI * 2);
    ctx.fill();

    // 5. Lâmina (Blade) — a ALTURA é visível: erguida recua para o corpo
    // e ganha sombra de vão embaixo; a 0 cm encosta no chão
    const lift = this.bladeHeight * 0.14;      // 30cm → recua ~4px
    const bladeX = hl + 2 - lift;

    // Braços articulados (a ponta sobe com a lâmina)
    ctx.strokeStyle = '#3a3a3c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-hl + 15, -hw); ctx.lineTo(bladeX + 2, -hw - 2 - lift * 0.3);
    ctx.moveTo(-hl + 15, hw); ctx.lineTo(bladeX + 2, hw + 2 + lift * 0.3);
    ctx.stroke();

    if (this.bladeHeight > 0) {
      // Sombra de vão: a lâmina "flutua" sobre o chão
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(bladeX + 5, 2, 4 + lift, hw + 5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Linha de contato: aço rente ao piso
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bladeX + 7, -hw - 5, 1.5, this.width + 10);
    }

    // A Lâmina em si (face côncava com gradiente)
    const grad = ctx.createLinearGradient(bladeX, 0, bladeX + 8, 0);
    grad.addColorStop(0, '#4a4a4e');
    grad.addColorStop(1, '#1c1c1e');
    ctx.fillStyle = grad;
    ctx.fillRect(bladeX, -hw - 5, 7, this.width + 10);

    // Detalhe brilhante na lâmina
    ctx.fillStyle = '#7a7a80';
    ctx.fillRect(bladeX + 1.5, -hw - 3, 1.5, this.width + 6);

    // Divisões didáticas da lâmina em 3 terços (guia do ataque 2/3|1/3)
    ctx.fillStyle = '#F0B429';
    const third = (this.width + 10) / 3;
    ctx.fillRect(bladeX, -hw - 5 + third, 7, 1.5);
    ctx.fillRect(bladeX, -hw - 5 + third * 2, 7, 1.5);

    // 6. Monte de lixo na frente da lâmina, proporcional à carga
    if (this.trashInBlade > 0.05) {
      const loadRatio = Math.min(1, this.trashInBlade / BLADE.CAPACITY);
      const pileLen = 6 + 18 * loadRatio;

      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.ellipse(hl + 8 + pileLen / 2, 0, pileLen / 2 + 4, hw + 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(212, 163, 115, 0.9)';
      ctx.beginPath();
      ctx.ellipse(hl + 8 + pileLen / 2, 0, pileLen / 2, hw - 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
