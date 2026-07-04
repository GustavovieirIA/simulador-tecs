import { HEATMAP_COLORS, COMPACTION, LAYER, SHIFT, classifyPasses } from '../config/params.js';

export class TerrainGrid {
  constructor(width, height, cellSize = 20) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize; // pixels por metro

    this.crestRow = Math.floor(height * 0.4);
    this.peRow = Math.floor(height * 0.8);
    this.coverRow = 6;          // linha de cobertura: acima dela o platô já está coberto
    this.dischargeRow = 56.5;   // linha de descarte: onde as pilhas são depositadas

    // 2D Array of cells
    this.cells = [];
    for (let y = 0; y < height; y++) {
      let row = [];
      for (let x = 0; x < width; x++) {
        row.push({
          height: 0, // espessura da CAMADA ATUAL (m)
          base: 0,   // material de camadas anteriores, já compactado e enterrado (m)
          passes: 0, // passadas de esteira NA CAMADA ATUAL (Espec. §5.1)
          isRamp: y > height * 0.4 && y < height * 0.8,
          isCrest: y === Math.floor(height * 0.4),
          crestStamp: false, // carimbo do pêndulo (TEC 5)
        });
      }
      this.cells.push(row);
    }

    // Canvas de trilhas das esteiras: as passadas escurecem por acúmulo e o
    // vão central do trator fica visível (retrato do "passo de dança")
    this.trail = document.createElement('canvas');
    this.trail.width = width * cellSize;
    this.trail.height = height * cellSize;
    this.trailCtx = this.trail.getContext('2d');
    this.trailFade = 0;

    // Tabela de sombreamento por altura (evita criar strings rgba por célula)
    this.depthRGBA = [];
    for (let i = 0; i <= 9; i++) this.depthRGBA.push(`rgba(0,0,0,${(i * 0.05).toFixed(2)})`);
  }

  // Carimbo das duas esteiras (chamado pelo trator a cada ~6px percorridos)
  stampTrack(x, y, angle, width) {
    const g = this.trailCtx;
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = 'rgba(28, 20, 12, 0.16)';
    const hw = width / 2;
    g.fillRect(-4, -hw, 8, 7);       // esteira esquerda
    g.fillRect(-4, hw - 7, 8, 7);    // esteira direita
    // sapatas transversais
    g.fillStyle = 'rgba(0, 0, 0, 0.10)';
    g.fillRect(-3, -hw + 1, 1.5, 5);
    g.fillRect(1, -hw + 1, 1.5, 5);
    g.fillRect(-3, hw - 6, 1.5, 5);
    g.fillRect(1, hw - 6, 1.5, 5);
    g.restore();
  }

  update(dt) {
    // Trilhas antigas somem lentamente (~2 min)
    this.trailFade += dt;
    if (this.trailFade > 3) {
      this.trailFade = 0;
      const g = this.trailCtx;
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = 'rgba(0, 0, 0, 0.06)';
      g.fillRect(0, 0, this.trail.width, this.trail.height);
      g.globalCompositeOperation = 'source-over';
    }
  }

  // Deposita material numa célula respeitando o conceito de CAMADA ATUAL:
  // - sobre camada já na faixa verde: a camada antiga é enterrada (vira base)
  //   e as passadas zeram — a camada nova precisa ser compactada de novo;
  // - sobre camada em andamento: as passadas se diluem na proporção do material novo.
  addMaterial(cell, amount) {
    if (!cell || amount <= 0) return;
    if (cell.passes >= COMPACTION.IDEAL_MIN && cell.height > 0.001) {
      cell.base += cell.height;
      cell.height = 0;
      cell.passes = 0;
    } else if (cell.height > 0.001) {
      cell.passes *= cell.height / (cell.height + amount);
    }
    cell.height += amount;
  }

  // Heatmap didático — faixas contínuas (passes é fracionário).
  // "Oca" (camada > 60 cm) só vale para material ESPALHADO (rampa/platô);
  // pilha alta na praça de descarga é a condição normal de trabalho.
  getCellColor(cell, y) {
    const inPraca = y !== undefined && y > this.peRow;
    if (!inPraca && cell.height > LAYER.OCA_MIN) return HEATMAP_COLORS.OCA;
    // Na praça, material relevante é sempre "solto/para transportar" —
    // as passadas de tráfego ali não significam compactação de verdade
    if (inPraca && cell.height > 0.15) return HEATMAP_COLORS.LOOSE;
    if (cell.height > 0.01) return HEATMAP_COLORS[classifyPasses(cell.passes)];
    if (cell.base > 0.01) return HEATMAP_COLORS.FINISHED;
    return HEATMAP_COLORS.BASE;
  }

  // Hash determinístico por célula (textura estável, sem Math.random por frame)
  cellHash(x, y, salt = 0) {
    let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }

  // Chão estático (terra + textura + grade + zona coberta) desenhado UMA vez
  // num canvas offscreen — o render por frame só cuida do material dinâmico
  buildGroundCache() {
    const w = this.width * this.cellSize;
    const h = this.height * this.cellSize;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');

    g.fillStyle = HEATMAP_COLORS.BASE;
    g.fillRect(0, 0, w, h);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cx = x * this.cellSize;
        const cy = y * this.cellSize;

        // Variação de tom por célula (terra viva, não xadrez artificial)
        const v = this.cellHash(x, y);
        g.fillStyle = v > 0.5
          ? `rgba(255, 235, 205, ${0.02 + v * 0.05})`
          : `rgba(0, 0, 0, ${0.04 + (0.5 - v) * 0.18})`;
        g.fillRect(cx, cy, this.cellSize, this.cellSize);

        // Pedriscos/torrões (2-3 pontos determinísticos por célula)
        for (let i = 0; i < 3; i++) {
          const px = cx + this.cellHash(x, y, i * 3 + 1) * (this.cellSize - 4) + 1;
          const py = cy + this.cellHash(x, y, i * 3 + 2) * (this.cellSize - 4) + 1;
          const s = 1 + this.cellHash(x, y, i * 3 + 3) * 2.2;
          g.fillStyle = this.cellHash(x, y, i + 7) > 0.5
            ? 'rgba(0,0,0,0.22)' : 'rgba(255,240,220,0.10)';
          g.fillRect(px, py, s, s);
        }

        // Área já coberta (acima da linha de cobertura): tom esverdeado
        if (y < this.coverRow) {
          g.fillStyle = 'rgba(74, 103, 65, 0.45)';
          g.fillRect(cx, cy, this.cellSize, this.cellSize);
          // "grama" rala
          if (this.cellHash(x, y, 42) > 0.55) {
            g.fillStyle = 'rgba(110, 160, 90, 0.35)';
            g.fillRect(cx + this.cellSize * 0.3, cy + this.cellSize * 0.4, 3, 3);
          }
        }
      }
    }

    // Grade sutil (mais forte a cada 5 m — leitura de distância)
    g.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    g.lineWidth = 1;
    for (let x = 0; x <= this.width; x++) {
      g.beginPath(); g.moveTo(x * this.cellSize + 0.5, 0); g.lineTo(x * this.cellSize + 0.5, h); g.stroke();
    }
    for (let y = 0; y <= this.height; y++) {
      g.beginPath(); g.moveTo(0, y * this.cellSize + 0.5); g.lineTo(w, y * this.cellSize + 0.5); g.stroke();
    }
    g.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    for (let x = 0; x <= this.width; x += 5) {
      g.beginPath(); g.moveTo(x * this.cellSize + 0.5, 0); g.lineTo(x * this.cellSize + 0.5, h); g.stroke();
    }
    for (let y = 0; y <= this.height; y += 5) {
      g.beginPath(); g.moveTo(0, y * this.cellSize + 0.5); g.lineTo(w, y * this.cellSize + 0.5); g.stroke();
    }

    this.groundCache = c;
  }

  // Overlay estático: as 4 linhas demarcatórias com "glow" barato (2 traços
  // concêntricos, sem shadowBlur por frame) + rótulos + placas de vaga.
  // Desenhado UMA vez — por frame vira um único drawImage.
  buildOverlayCache() {
    const w = this.width * this.cellSize;
    const h = this.height * this.cellSize;
    const c = document.createElement('canvas');
    c.width = w; c.height = h + 40;
    const g = c.getContext('2d');

    const line = (row, color, label) => {
      const pxY = row * this.cellSize;
      g.setLineDash([10, 10]);
      g.strokeStyle = color;
      g.globalAlpha = 0.35; g.lineWidth = 7;
      g.beginPath(); g.moveTo(0, pxY); g.lineTo(w, pxY); g.stroke();
      g.globalAlpha = 1; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, pxY); g.lineTo(w, pxY); g.stroke();
      g.setLineDash([]);
      g.font = 'bold 15px Inter';
      const tw = g.measureText(label).width;
      g.fillStyle = '#1c1c1e';
      g.fillRect(20, pxY - 14, tw + 20, 28);
      g.fillStyle = color;
      g.fillText(label, 30, pxY + 5);
    };

    line(this.dischargeRow, '#ff9500', 'LINHA DE DESCARTE');
    line(Math.floor(this.height * 0.8), '#FFCC00', 'PÉ DE TALUDE (INÍCIO DA RAMPA)');
    line(Math.floor(this.height * 0.4), '#FFCC00', 'CRISTA DO TALUDE (FIM DA RAMPA)');
    line(this.coverRow, '#34c759', 'LINHA DE COBERTURA (ÁREA COBERTA)');

    // Placas de vagas numeradas (1–5): leitura visual do sentido de trabalho
    const margin = 80;
    const usable = w - margin * 2;
    const slots = Math.max(1, SHIFT.MAX_BATCH - 1);
    const vy = 55 * this.cellSize;
    for (let i = 0; i < SHIFT.MAX_BATCH; i++) {
      const x = margin + i * (usable / slots);
      g.fillStyle = '#1d6f42';
      g.beginPath(); g.roundRect(x - 12, vy - 26, 24, 22, 4); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#fff';
      g.font = 'bold 13px Inter';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i + 1), x, vy - 15);
    }

    this.overlayCache = c;
  }

  render(ctx) {
    if (!this.groundCache) this.buildGroundCache();
    ctx.drawImage(this.groundCache, 0, 0);

    // Só as células com material/base são desenhadas por frame
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        const hasMaterial = cell.height > 0.01;
        if (!hasMaterial && cell.base <= 0.01 && !cell.crestStamp) continue;

        const cx = x * this.cellSize;
        const cy = y * this.cellSize;

        if (hasMaterial || cell.base > 0.01) {
          ctx.fillStyle = this.getCellColor(cell, y);
          ctx.fillRect(cx, cy, this.cellSize, this.cellSize);
        }

        if (hasMaterial) {
          // Sombreamento proporcional à ALTURA (tabela pré-computada):
          // pilhas altas ficam mais escuras — o jogador lê o volume no mapa
          const di = Math.min(9, Math.round(cell.height * 4));
          if (di > 0) {
            ctx.fillStyle = this.depthRGBA[di];
            ctx.fillRect(cx, cy, this.cellSize, this.cellSize);
          }

          // Textura de resíduo: detritos determinísticos. Material compactado
          // fica visivelmente mais LISO (flecos menores e mais fracos)
          const smooth = cell.passes >= COMPACTION.IDEAL_MIN ? 0.45 : 1;
          for (let i = 0; i < 4; i++) {
            const px = cx + this.cellHash(x, y, i * 5 + 11) * (this.cellSize - 5) + 1;
            const py = cy + this.cellHash(x, y, i * 5 + 12) * (this.cellSize - 5) + 1;
            const s = (2 + this.cellHash(x, y, i * 5 + 13) * 3) * smooth;
            ctx.fillStyle = this.cellHash(x, y, i * 5 + 14) > 0.5
              ? (smooth < 1 ? 'rgba(0,0,0,0.13)' : 'rgba(0,0,0,0.28)')
              : (smooth < 1 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.14)');
            ctx.fillRect(px, py, s, s * 0.7);
          }

          ctx.fillStyle = 'rgba(255,255,255,0.1)'; // Highlight top-left
          ctx.fillRect(cx, cy, this.cellSize, 2);
          ctx.fillRect(cx, cy, 2, this.cellSize);

          ctx.fillStyle = 'rgba(0,0,0,0.3)'; // Shadow bottom-right
          ctx.fillRect(cx, cy + this.cellSize - 2, this.cellSize, 2);
          ctx.fillRect(cx + this.cellSize - 2, cy, 2, this.cellSize);
        }

        // Carimbo do pêndulo na crista (TEC 5)
        if (cell.crestStamp) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx + 4, cy + this.cellSize / 2);
          ctx.lineTo(cx + this.cellSize / 2, cy + this.cellSize - 4);
          ctx.lineTo(cx + this.cellSize - 4, cy + 4);
          ctx.stroke();
        }
      }
    }
    // Trilhas das esteiras por cima do material (a história das passadas)
    ctx.drawImage(this.trail, 0, 0);

    // Draw flow arrows (didactic visual cue)
    this.drawFlowArrows(ctx);

    // Linhas demarcatórias + rótulos + vagas: overlay estático (1 drawImage)
    if (!this.overlayCache) this.buildOverlayCache();
    ctx.drawImage(this.overlayCache, 0, 0);
  }

  drawFlowArrows(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 10]); // Dashed arrows

    // Draw 3 arrows pointing up (from y = 0.9 to y = 0.45)
    const arrowStartX = [this.width * 0.25, this.width * 0.5, this.width * 0.75];
    const startY = this.height * 0.9 * this.cellSize;
    const endY = this.height * 0.45 * this.cellSize;

    // Animate arrow moving up by shifting the line dash offset
    ctx.lineDashOffset = -(Date.now() / 50) % 50;

    for (let x of arrowStartX) {
      const pxX = x * this.cellSize;

      ctx.beginPath();
      ctx.moveTo(pxX, startY);
      ctx.lineTo(pxX, endY);
      ctx.stroke();

      // Arrow head
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(pxX, endY - 10);
      ctx.lineTo(pxX - 10, endY + 10);
      ctx.lineTo(pxX + 10, endY + 10);
      ctx.closePath();
      ctx.fill();
      ctx.setLineDash([15, 10]);
    }

    ctx.restore();
  }

  // Get cell at pixel coordinates
  getCellAt(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) {
      return this.cells[cy][cx];
    }
    return null;
  }
}
