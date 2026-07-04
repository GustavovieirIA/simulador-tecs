# 2. Arquitetura

## Visão de módulos

```
index.html ─── carrega ──▶ src/main.js
                              │ instancia e conecta
              ┌───────────────┼─────────────────────┐
              ▼               ▼                     ▼
        engine/Game.js   world/TerrainGrid.js   engine/AudioEngine.js
              │
   ┌──────────┼──────────────┬───────────────┬──────────────┐
   ▼          ▼              ▼               ▼              ▼
 Input.js   entities/Tractor   entities/Truck   ui/HUD + ui/QuizModal
        └────── config/params.js (importado por quase todos) ──────┘
```

Não há framework nem sistema de eventos genérico: o `Game` é o orquestrador central e
os objetos se comunicam por referência direta e por **flags/eventos de frame** (ex.:
`tractor.attackEvent`, `tractor.pendulumEvent`) que o `Game` consome a cada update.

`config/params.js` é a **fonte única de parâmetros numéricos** — cores do heatmap,
faixas de compactação, física da lâmina, penalidades, tipos de caminhão, diesel e
metas de turno. Regras novas devem nascer lá, não como literais no código.

---

## Bootstrap (`src/main.js`)

1. Cria `Game('gameCanvas')`, `AudioEngine` (com unlock no primeiro gesto — política de
   autoplay), `TerrainGrid(40, 60, 20)` e `Tractor` na base da praça.
2. Injeta a **classe** `Truck` no jogo (`game.truckClass`) — o spawn é feito pelo `Game`.
3. Inicia o turno do jogador (`game.beginPlayerShift`) e faz o wiring dos botões:
   "Finalizar Turno" (→ `game.finishShift`), mute e colapso do painel de controles.
4. Expõe `window.game` para debug e para os scripts de teste.

## O loop (`engine/Game.js`)

`requestAnimationFrame` com `dt` em segundos, **clampado a 0,1 s** (abas em segundo
plano não geram saltos de física). Ordem por frame:

```
update(dt)            lógica de jogo (abaixo)
audio.frame(game, dt) áudio lê TODO o estado uma vez por frame
render()              mundo no canvas
input.update()        snapshot das teclas p/ isJustPressed do próximo frame
```

Dentro de `update(dt)`:

1. Teclas globais: `Z` (zoom tático ⇄ cabine), `H` (colapsa controles).
2. Se `phase === 'QUIZ'` → **pausa** (retorna; o relógio do turno não corre).
3. Cache do scan de pilhas soltas (varredura das 2.400 células 4×/s, não por frame).
4. Efeitos: decaimento do trauma, poeira das esteiras, fumaça do escapamento
   (cinza normal, **preta** na sobrecarga), integração do pool de partículas.
5. **Spawn de caminhões** enquanto `batch < maxBatch` (5), um a cada 2 s,
   alternando COLETOR/CARRETA. Quando todos terminam → `phase = 'READY'`.
6. Update do trator com o input do jogador.
7. Consumo dos eventos do trator (ataque, pêndulo) → coach/efeitos/avaliação.
8. Câmera (zoom suavizado, look-ahead, lerp, clamp aos limites da praça).
9. Update do terreno (fade das trilhas) e dos caminhões; registro de cada pilha
   descarregada em `pileSlots` (para a TEC 7) com som/partículas de avalanche.
10. Colisão trator×caminhão (empurra para fora + rouba velocidade + "clank").
11. Regras didáticas (coach) e perímetro de segurança dos caminhões.
12. `Enter` (em `READY`/`WAITING_TRUCKS` — as mesmas fases do botão
    "Finalizar Turno") → `finishShift()`; por fim, `hud.update(this)`.

### Estados do jogo (`game.state.phase`)

| Fase | Significado |
|---|---|
| `WAITING_TRUCKS` | Aguardando/spawnando a batelada |
| `DUMPING` | Há caminhão em ciclo de descarga |
| `READY` | Batelada completa e caminhões fora — operação liberada |
| `QUIZ` | Quiz de fechamento aberto (lógica pausada) |
| `DONE` | Relatório final exibido |

### Câmera e "game feel"

- **Zoom**: `tatico` enquadra o módulo inteiro (calculado a partir do tamanho do mundo
  e da janela, piso 0,4); `cabine` é 1:1. Interpolado suavemente.
- **Look-ahead**: a câmera adianta até 90 px na direção do movimento (com suavização
  própria, para não "chicotear" nos ciclos frente-e-ré).
- **Trauma** (0–1): impactos somam trauma; a amplitude do shake é `9·trauma²` com senos
  dessincronizados + micro-rotação (tremor orgânico, não jitter). A sobrecarga da
  lâmina mantém um tremor mínimo constante.
- **Partículas**: pool pré-alocado de 240 (poeira, fumaça, detritos de rebarba),
  ponteiro circular, zero alocação por frame.

### Render

Canvas com `devicePixelRatio` (limitado a 2). Pipeline por frame:
fundo → transform da câmera (centro, rotação de trauma, zoom, translação com shake) →
`terrain.render` → caminhões → trator → partículas.

## Terreno (`world/TerrainGrid.js`)

Grade **40×60 células**, `cellSize = 20 px = 1 m`. Cada célula:

```js
{
  height,     // m — espessura da CAMADA ATUAL (lixo em processamento)
  base,       // m — camadas anteriores compactadas e enterradas
  passes,     // passadas de esteira na camada atual (fracionário)
  isRamp,     // entre pé e crista
  isCrest,    // linha da crista
  crestStamp, // já recebeu o "carimbo" do pêndulo (TEC 5)
}
```

Linhas do módulo (em linhas da grade): `coverRow = 6` (linha de cobertura),
`crestRow = 24` (crista, 40%), `peRow = 48` (pé de talude, 80%),
`dischargeRow = 56,5` (linha de descarte). Acima da crista = platô; abaixo do pé = praça.

**`addMaterial(cell, amount)`** implementa o conceito de camada atual:
- material sobre camada **já na faixa verde** → a antiga vira `base` (enterrada) e
  `passes` zera (a camada nova precisa ser compactada de novo);
- sobre camada em andamento → as passadas **se diluem** na proporção do material novo.

**Render em três camadas com cache:**
1. `groundCache` (offscreen, 1×): terra com variação de tom e pedriscos por hash
   determinístico (`cellHash` — textura estável sem `Math.random` por frame), zona
   coberta esverdeada, grade de 1 m com reforço a cada 5 m.
2. Por frame: **somente células com material/base/carimbo** — cor do heatmap
   (`getCellColor`), sombreamento por altura (tabela `depthRGBA` pré-computada),
   textura de resíduo (mais lisa quando compactado), bordas de relevo e o carimbo
   da crista. Depois, o canvas de **trilhas** e as setas de fluxo animadas.
3. `overlayCache` (offscreen, 1×): as 4 linhas demarcatórias com rótulos e as
   placas de vaga 1–5.

**Trilhas de esteira**: canvas próprio onde o trator carimba as duas esteiras a cada
~6 px percorridos (com o vão central visível — o retrato do "passo de dança");
`update(dt)` desvanece as trilhas antigas (~2 min) via `destination-out`.

## Trator (`entities/Tractor.js`)

Corpo 40×76 px (~2×3,8 m + lâmina). Física e controles:

- **Marchas** 1/2 → velocidade-alvo 60/120 px/s, aceleração 200 px/s², freio = 2×.
- **Esterço diferencial** (`A`/`D`, 1,5 rad/s) — em ré o sinal inverte (como esteira real).
- **Lâmina** `Q`/`E` em degraus de 10: 0 (transporta/coleta), 10 (regulariza),
  20–30 (espalha).
- **Sobrecarga** (`overloaded`): lâmina além da capacidade → velocidade ×0,55, diesel
  extra, fumaça preta, misfire no áudio.
- Diesel virtual acumulado por frame (parado/velocidade/carregado/transbordando).
- Telemetria de KPIs: violações de segurança/qualidade, movimentos improdutivos,
  diesel, distância.

A interação com o terreno (coleta, rebarba direcional, espalhamento, regularização,
compactação, pêndulo, TEC 6) está detalhada em
[03-mecanicas-e-tecs.md](03-mecanicas-e-tecs.md).

O render é 100% vetorial (esteiras com sapatas animadas pela distância percorrida,
chassi amarelo CAT, cabine, lâmina com altura visível + divisões didáticas em terços,
monte de carga proporcional, sombra projetada com luz fixa do mundo).

## Caminhões (`entities/Truck.js`)

Máquina de estados simples: `ARRIVING → MANEUVERING → DUMPING → LEAVING → DONE`.
Entram pela direita, alinham na vaga (`targetX` distribuído nas 5 vagas), "basculam"
em 1 s (`dumpTrash` escreve a pilha na grade conforme `pile` do tipo) e saem por baixo.

Tipos (em `params.js`): **COLETOR** (pilha ~10 m³ ≈ 2 viagens de lâmina) e
**CARRETA** (maior, pilha ~20 m³ **mais larga que a lâmina** — força o ataque
2/3|1/3). Enquanto manobra ou
descarrega, o caminhão projeta o **perímetro de segurança** (raio por tipo — TEC 1),
desenhado pulsando no mundo e no minimapa; `isInDangerZone(x, y)` é consultado pelo
`Game` para a violação de segurança.

## Input (`engine/Input.js`)

Mapa de `e.code` → bool com snapshot do frame anterior: `isDown` e `isJustPressed`.
`Game.loop` chama `input.update()` no fim do frame.

## HUD (`ui/HUD.js`)

Toda a UI é DOM/CSS por cima do canvas, com **guardas de escrita** (`this.last`): cada
elemento só é tocado quando o valor muda (evita reflow por frame).

- **Instrumentos**: marcha, altura da lâmina (barra), carga da lâmina (quantizada em
  2%), batelada, relógio do turno vs meta (muda de cor a 75% e ao estourar), diesel.
- **Minimapa** (200×200): camada pesada (2.400 células + linhas) redesenhada em cache
  a cada 12 frames; por frame só caminhões (com perímetro), alvos de pilhas não
  atacadas, retângulo do viewport e o ponto do trator.
- **Rádio**: histórico de mensagens (`system` / `apontador` / `alert`), podado em 8.
- **Toast + flash**: alertas críticos ganham um toast central de 5 s e um flash de tela.
- **Missão**: o objetivo do painel superior acompanha a fase da operação.
- **`showReport(kpis, terrain)`**: preenche a FDE — conceito A–E, dica, os 3 KPIs,
  detalhamento por TEC (crista batida, camada ≤ 30 cm, praça limpa, movimentos
  improdutivos, violações, diesel) e um snapshot do heatmap final.

## Quiz (`ui/QuizModal.js` + `Game.runEndQuizzes`)

O quiz roda **ao final do turno** (não interrompe a operação): `finishShift()` trava o
trator, põe `phase = 'QUIZ'` e encadeia as 4 perguntas de `getEndQuizQuestions()`
("Pergunta X de N"); só depois chama `computeAndShowReport()`. O modal embaralha as
opções, dá feedback sonoro (chime/buzz), explica o erro e **exige a resposta correta**
para avançar (retry até acertar).

## Áudio (`engine/AudioEngine.js`)

100% sintetizado (WebAudio, zero assets). Arquitetura: fontes → buses
(`engine`/`sfx`/`ui`) → master → compressor → saída. O `AudioContext` só nasce no
primeiro gesto do usuário (`attachUnlock`). Mute persiste em `localStorage`.

- **Motor diesel** contínuo: sawtooth + sub square + ruído de combustão, AM de
  "cilindros" (LFO) e lowpass que abre com o RPM; RPM segue velocidade + carga;
  sobrecarga abaixa a frequência e dispara *misfires*.
- **Loops de trabalho**: raspagem (coleta), farfalhar (espalhamento) e ranger de
  esteira (giro) — ganhos modulados por `collectedThisFrame`/`spreadThisFrame`/
  `turningNow` lidos 1×/frame em `frame(game, dt)`.
- **Bips de ré** do trator e dos caminhões manobrando (atenuados pela distância).
- **One-shots**: `gearClunk`, `bladeWhine`, `thump` (pêndulo), `skreek` (raspar piso
  duro), `clank` (colisão), `klaxon` (alerta, com *ducking* do motor), `chime`/`buzz`
  (quiz), `pop` (elogio), `avalanche` (basculamento).

## Scripts de teste (`tools/scripts/`)

Playtests headless com Puppeteer que dirigem o jogo real via `window.game`:

| Script | Papel |
|---|---|
| `diagnose_freeze.js`, `test*.js` | Diagnóstico/experimentos |

Saídas (screenshots etc.) vão para `tools/artifacts/` (fora do git).
