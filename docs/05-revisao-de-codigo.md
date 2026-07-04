# 5. Revisão de Código — Achados

Revisão completa de `src/`, `index.html`, `style.css`, `package.json` e
`tools/scripts/` em 04/07/2026. Veredito geral: **código sólido para um MVP** —
parâmetros centralizados, caches de render bem pensados, conservação de massa na
física da lâmina e guardas de escrita no DOM.

**Status:** os achados P1–P7 foram corrigidos em 04/07/2026 (mesma sessão da
revisão). P8 e P9 permanecem como melhorias sugeridas.

## Achados e resoluções

### P1 — `validate_player.js` desatualizado em relação ao quiz (médio) — ✅ resolvido

O array `CORRECT` tinha 3 respostas, mas o jogo faz **4 perguntas** de fechamento
(`Game.getEndQuizQuestions`). A pergunta 2 (“Ataque à pilha… 1/3 da lâmina livre”)
não casava com nenhuma entrada, e o script ficava preso no quiz até o timeout de
400 s. **Fix:** `'1/3 da lâmina livre'` adicionado ao `CORRECT`
([validate_player.js:10](../tools/scripts/validate_player.js)).

### P2 — Favicon inexistente (baixo) — ✅ resolvido

`index.html` referenciava `/vite.svg`, que não existia → 404 a cada carga.
**Fix:** criado `public/favicon.svg` (trator estilizado nas cores do jogo) e
atualizado o `<link rel="icon">`.

### P3 — Assets órfãos em `public/assets/` (baixo) — ✅ resolvido

`tractor.jpg` e `truck.jpg` não eram referenciados em lugar nenhum (o render é 100%
vetorial); eram placeholders gerados por IA com o xadrez de “transparência” chapado
no JPG (inutilizáveis como sprite). **Fix:** removidos junto com a pasta `assets/`.

### P4 — Comentário desatualizado em `Truck.dumpTrash` (baixo) — ✅ resolvido

O comentário descrevia volumes de pilha antigos (“Coletor 3×3 de 0,4 m”, “Carreta 5
células”) divergentes de `params.js` (4×3×0,85 e 6×3×1,1). **Fix:** comentário agora
remete a `TRUCKS` em `params.js` em vez de duplicar números.

### P5 — `package.json` com metadados de rascunho (baixo) — ✅ resolvido

`name: "teste-jogo-gemini"`, descrição vazia, `main` apontando para arquivo
inexistente e `jsdom` em `dependencies` (só é usado por script de teste).
**Fix:** renomeado para `simulador-tecs`, descrição preenchida, `main` removido e
`jsdom` movido para `devDependencies`.

### P6 — Botões mantinham foco e eram reativados por Espaço/Enter (baixo, UX) — ✅ resolvido

Depois de clicar no mute, **Espaço (freio)** alternava o som a cada frenagem; com
foco em outro botão, **Enter** o disparava. **Fix:** listener delegado em `main.js`
faz `blur()` em qualquer botão após o clique (cobre também os botões do quiz e os
que vierem a existir).

### P7 — Enter × botão “Finalizar Turno” inconsistentes (informativo) — ✅ resolvido

`Enter` só finalizava em `READY`; o botão também aceitava `WAITING_TRUCKS`.
**Fix:** `Enter` agora usa as mesmas fases do botão —
[Game.js](../src/engine/Game.js), busca por “Finish condition”. (O bloqueio na
demo deixou de existir junto com o modo demo, removido do jogo.)

### P8 — Números mágicos fora de `params.js` (melhoria futura)

A regra do projeto é “toda regra numérica sai de `params.js`”, mas ainda há
constantes de gameplay espalhadas: raio de 130 px do julgamento de ataque
(`Game.evaluateAttack`), spawn de 2 s, cooldowns do coach (8–25 s), física do trator
(60/120 px/s, 1,5 rad/s), ciclo do caminhão (300 px/s, 1 s). Não é bug — mas a migração gradual para `params.js`
manteria a promessa da fonte única (a tabela em
[04-parametros.md](04-parametros.md#constantes-relevantes-fora-de-paramsjs) lista todas).

### P9 — Quiz não pontua e não pode ser “reprovado” (decisão de design)

O quiz de fechamento exige acertar para avançar e não entra nos KPIs. Para o uso
como treinamento/certificação (Espec. §15), considerar registrar erros por pergunta
na FDE em versões futuras.

## Pontos fortes (para preservar)

- **`params.js` como fonte única** com `classifyPasses()` compartilhada — heatmap,
  coach e nota nunca divergem.
- **Performance consciente**: pool de partículas sem GC, ground/overlay caches,
  minimapa em cache de 12 frames, hash determinístico para textura (sem
  `Math.random` por frame), scan de pilhas 4×/s, guardas de escrita no DOM,
  `devicePixelRatio` limitado a 2, `dt` clampado.
- **Física didática correta**: rebarba direcional com conservação de massa, camada
  atual vs. base enterrada, vão central das esteiras (passo de dança emergente),
  passada dobrada + carimbo na crista.
- **Acessibilidade de feedback**: alerta crítico chega por 4 canais (rádio, flash,
  toast, klaxon) e o rádio guarda o histórico.
- **Testabilidade**: `window.game` exposto para depuração e scripts Puppeteer
  de diagnóstico em `tools/scripts/`.

## Verificações feitas sem achado

- Loop e `dt`: clamp correto; pausa no quiz não corrompe timers.
- `finishShift`/`runEndQuizzes`/`computeAndShowReport`: reentrância protegida
  (guard de fase), encadeamento de quiz correto.
- TEC 6 (`reverseRun = -Infinity` após a ocorrência): garante 1 ocorrência por ré
  contínua; reset correto ao avançar.
- `addMaterial`: diluição de passadas e enterro de camada conservam massa.
- Colisão trator×caminhão, clamp de câmera com zoom, poda do rádio (8 mensagens),
  limpeza de nós de áudio (`onended` → `disconnect`) — todos corretos.
- `beginPlayerShift` zera toda a telemetria do jogador (ficha limpa) e o relógio.
