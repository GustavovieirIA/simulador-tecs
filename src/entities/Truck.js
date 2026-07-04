import { TRUCKS, SHIFT } from '../config/params.js';

export class Truck {
  constructor(targetPileIndex, terrainWidthPixels, terrainHeightPixels, type = 'COLETOR') {
    this.type = type;
    const spec = TRUCKS[type] || TRUCKS.COLETOR;
    this.width = spec.width;   // px
    this.length = spec.length; // px
    this.dangerRadius = spec.dangerRadius; // TEC 1: carreta > coletor
    this.pileSpec = spec.pile;

    // Start off-screen (bottom right)
    this.x = terrainWidthPixels + 100;
    this.y = terrainHeightPixels;
    this.angle = Math.PI; // Facing left

    // Vagas de descarga distribuídas ao longo de toda a praça
    const margin = 80; // px
    const usable = terrainWidthPixels - margin * 2;
    const slots = Math.max(1, SHIFT.MAX_BATCH - 1);
    this.targetX = margin + (targetPileIndex % SHIFT.MAX_BATCH) * (usable / slots);
    this.targetY = terrainHeightPixels - 80; // Dump area line

    this.speed = 300; // Fast delivery!
    this.state = 'ARRIVING'; // ARRIVING, MANEUVERING, DUMPING, LEAVING, DONE
    this.dumpTimer = 0;
    this.registered = false; // Game registra a pilha para TEC 7 (sentido de trabalho)

    this.pileIndex = targetPileIndex;
  }

  // Trator dentro do perímetro enquanto o caminhão manobra/descarrega?
  isInDangerZone(px, py) {
    if (this.state !== 'DUMPING' && this.state !== 'MANEUVERING') return false;
    return Math.hypot(px - this.x, py - this.y) < this.dangerRadius;
  }

  update(dt, terrain) {
    switch (this.state) {
      case 'ARRIVING':
        // Move left towards X alignment
        if (this.x > this.targetX) {
          this.x -= this.speed * dt;
        } else {
          this.x = this.targetX;
          this.angle = -Math.PI / 2; // Face UP (ready to reverse or maneuver)
          this.state = 'MANEUVERING';
        }
        break;

      case 'MANEUVERING':
        // Drive up slightly past the target, then back in (simple approximation)
        if (this.y > this.targetY - 20) {
          this.y -= this.speed * dt;
        } else {
          this.y = this.targetY - 20;
          this.state = 'DUMPING';
          this.dumpTimer = 1.0; // 1 second to dump (FASTER)
        }
        break;

      case 'DUMPING':
        this.dumpTimer -= dt;
        if (this.dumpTimer <= 0) {
          this.dumpTrash(terrain);
          this.state = 'LEAVING';
          this.angle = Math.PI / 2; // Face DOWN to leave
        }
        break;

      case 'LEAVING':
        this.y += this.speed * dt;
        if (this.y > terrain.height * terrain.cellSize + 100) {
          this.state = 'DONE';
        }
        break;
    }
  }

  dumpTrash(terrain) {
    // Convert targetX, targetY to grid coordinates
    const gridX = Math.floor(this.targetX / terrain.cellSize);
    const gridY = Math.floor((this.targetY + 40) / terrain.cellSize); // dump behind the truck

    // Formato da pilha por tipo de caminhão (dimensões em TRUCKS de params.js):
    // a pilha da carreta é mais LARGA que a lâmina — exige o ataque 2/3|1/3
    // da TEC 3 para não formar rebarba dos dois lados
    const { w, d, h } = this.pileSpec;
    const halfW = Math.floor(w / 2);
    const halfD = Math.floor(d / 2);
    for (let dy = -halfD; dy < d - halfD; dy++) {
      for (let dx = -halfW; dx < w - halfW; dx++) {
        const cy = gridY + dy;
        const cx = gridX + dx;
        if (cx >= 0 && cx < terrain.width && cy >= 0 && cy < terrain.height) {
          terrain.addMaterial(terrain.cells[cy][cx], h);
        }
      }
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const hw = this.width / 2;
    const hl = this.length / 2;
    const isCarreta = this.type === 'CARRETA';

    // Vector Truck Drawing (Facing Right/0 angle)

    // 1. Cabine (Front)
    ctx.fillStyle = isCarreta ? '#7d3c98' : '#005f73'; // roxo carreta / azul coletor
    ctx.beginPath();
    ctx.roundRect(hl - 20, -hw, 20, this.width, 4);
    ctx.fill();

    // Vidro da cabine
    ctx.fillStyle = 'rgba(28, 28, 30, 0.8)';
    ctx.fillRect(hl - 15, -hw + 2, 10, this.width - 4);

    // 2. Chassi
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(-hl + 5, -hw + 4, this.length - 25, this.width - 8);

    // 3. Caçamba (Basculante)
    // Se estiver descarregando (DUMPING), caçamba levanta e desliza pra trás visualmente
    let dumpOffset = 0;
    if (this.state === 'DUMPING') {
      dumpOffset = -5; // Slides back a bit to dump
      ctx.fillStyle = '#b71c1c'; // Red inside bed
      ctx.fillRect(-hl - 5, -hw + 2, this.length - 25, this.width - 4);
    }

    ctx.fillStyle = isCarreta ? '#c0c6cc' : '#e9ecef'; // White/Grey bed
    ctx.beginPath();
    ctx.roundRect(-hl + dumpOffset, -hw + 2, this.length - 25, this.width - 4, 2);
    ctx.fill();

    // Borda da caçamba
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Divisórias da caçamba longa (carreta)
    if (isCarreta) {
      ctx.strokeStyle = '#8e959c';
      ctx.lineWidth = 1;
      for (let i = -hl + 15; i < hl - 30; i += 15) {
        ctx.beginPath();
        ctx.moveTo(i + dumpOffset, -hw + 2);
        ctx.lineTo(i + dumpOffset, hw - 2);
        ctx.stroke();
      }
    }

    // Reset shadow for UI
    ctx.shadowColor = 'transparent';

    // Draw animated safety perimeter (raio por tipo — TEC 1)
    if (this.state === 'DUMPING' || this.state === 'MANEUVERING') {
      const pulse = Math.abs(Math.sin(Date.now() / 300)) * 5;

      ctx.strokeStyle = 'rgba(255, 59, 48, 0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, this.dangerRadius + pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 59, 48, 0.1)';
      ctx.fill();

      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}
