# 3. Mecânicas de Jogo e as 7 TECs

Este documento descreve as regras da simulação e onde cada TEC da especificação está
implementada no código. Todos os números citados vêm de
[`src/config/params.js`](../src/config/params.js) (ver [04-parametros.md](04-parametros.md)).

## Controles

| Tecla | Ação |
|---|---|
| `W`/`S` (ou setas) | Frente / ré |
| `A`/`D` | Girar (diferencial de esteiras; em ré o efeito inverte) |
| `Q`/`E` | Lâmina −10 / +10 cm (0 · 10 · 20 · 30) |
| `Shift` | Alterna marcha 1 ⇄ 2 |
| `Espaço` | Freio |
| `Z` | Zoom tático ⇄ cabine |
| `H` | Colapsa/expande o painel de controles |
| `Enter` | Finalizar turno (com a batelada pronta) |

## O modelo de material

O terreno é uma grade de células de 1 m². Cada célula tem `height` (espessura da
**camada atual**, em m), `base` (camadas anteriores finalizadas) e `passes`
(passadas de esteira na camada atual, valor fracionário).

### As três atividades da lâmina (Espec. §2.2)

| Altura da lâmina | Atividade | Implementação (`Tractor.interactWithTerrain`) |
|---|---|---|
| **0 cm** | Transportar/coletar | `collectAndSpill`: pega lixo solto até a capacidade (5 m³) a 6 m³/s; material já compactado **não volta** para a lâmina |
| **10 cm** | Regularizar | Nivela as células sob a lâmina para a média delas (transfere dos altos para os baixos, conservando massa; funciona também de ré; não dilui passadas) |
| **20–30 cm** | Espalhar | Solta camada com espessura = altura da lâmina (20 cm → 0,20 m); só deposita onde a célula ainda está abaixo da camada-alvo |

### Rebarba direcional (Espec. §5.2)

Com a lâmina **cheia**, o excesso transborda a 1,5 m³/s para o(s) lado(s) **onde há
material engajado**:

- ataque 2/3|1/3 (um lado livre) → rebarba cai **só para dentro**; o lado externo fica limpo;
- ataque pelo centro (engajado dos dois lados) → **rebarba dupla**, que exigirá viagens extras.

A massa é conservada (só sai da célula o que caiu em algum destino) e a sobrecarga
tem custo real: velocidade ×0,55, diesel extra, fumaça preta e tremor constante.

### Compactação (Espec. §5.3)

Passada **só conta com a lâmina vazia** (“compactar é passar sobre o resíduo SEM lixo
na lâmina”) e a mais de 10 px/s. As esteiras são duas (offsets ±1 célula) com **vão
central** — a coluna do meio só é coberta deslocando ½ esteira na volta (o “passo de
dança”). Incremento por frame: `|speed|·dt / cellSize` em cada esteira.

- Camada **> 60 cm não compacta** (zona de baixa pressão — célula “oca”, irrecuperável).
- Na **crista**, a passada vale **×2** (pêndulo) e a primeira passagem carimba
  `crestStamp` + solavanco/poeira/som.

Faixas de passadas (`classifyPasses`): `< 0,5` solto (vermelho) · `< 3` trabalhando
(laranja) · `3–6` **ideal** (verde) · `6–8` passou do ponto (lilás) · `> 8`
desperdício (preto). O heatmap, o coach e a nota usam **as mesmas faixas**.

### Camada atual vs. base (`TerrainGrid.addMaterial`)

Depositar material sobre uma célula **já na faixa verde** enterra a camada antiga
(vira `base`, cor verde-escura “finalizada”) e zera as passadas — a camada nova
precisa ser compactada de novo. Sobre camada em andamento, as passadas se diluem na
proporção do material novo.

### Heatmap (leitura do jogador)

| Cor | Significado |
|---|---|
| Terra | Solo sem lixo |
| Vermelho | Lixo solto (na praça, qualquer material relevante é “solto”) |
| Laranja | Ganhando densidade (1–3 passadas) |
| Verde | Faixa ideal (3–6 passadas, camada ≤ 30 cm) |
| Lilás / Preto | Passou do ponto / super compactado |
| Verde-escuro | Base finalizada (camada enterrada) |
| Vinho | Célula **oca** — camada > 60 cm espalhada na rampa/platô |

---

## As 7 TECs no código

### TEC 1 — Coordenação da Descarga (bateladas)

- Batelada de **5 caminhões**, tipos alternados COLETOR/CARRETA
  (`Game.update`, spawn). A carreta tem **perímetro de segurança maior** (120 px vs 70)
  e pilha mais larga.
- Enquanto manobra/descarrega, o caminhão projeta o perímetro (círculo vermelho
  pulsante no mundo e no minimapa). Invadir o perímetro **em movimento** (> 10 px/s)
  = violação de segurança (`Game.checkTruckSafety`, cooldown de 5 s).
- HUD mostra “Batelada N/5”; a missão instrui a aguardar fora do perímetro.

### TEC 2 — Descarte em Linha

- Os caminhões NPC descarregam **corretamente** nas vagas 1–5 sobre a linha de
  descarte (placas numeradas no overlay do terreno) — o jogador não controla a
  descarga neste MVP.
- O lado didático da TEC 2 aparece via regra “lixo só é preenchido na rampa”
  (compartilhada com a TEC 4, abaixo).

### TEC 3 — Ataque à Pilha (2/3 | 1/3)

- A transição **lâmina vazia → carregada** gera um `attackEvent` com o engajamento
  lateral (`leftEngaged/rightEngaged` e `beyondLeft/beyondRight`).
- `Game.evaluateAttack` julga o **primeiro ataque de cada pilha** (raio de 130 px do
  registro em `pileSlots`): engajado e transbordando dos dois lados = **ataque pelo
  centro** → alerta + violação de qualidade; um lado livre = elogio (uma vez).
- Coleta: material compactado (≥ 3 passadas) não é raspado **na rampa/platô** — na
  praça tudo é coletável (o tráfego cruza as pilhas). Tentar raspar piso duro dispara
  o coach + som de aço resvalando.
- “Praça limpa” entra na FDE: células com sobra abaixo do pé do talude.

### TEC 4 — Espalhamento

- Espalhar = lâmina 20–30 cm em movimento para frente; a camada deixada tem a
  espessura da lâmina.
- **Espalhar fora da rampa** (célula que não é rampa nem crista) → alerta “lixo só é
  preenchido NA RAMPA” + violação de qualidade (`spreadOutsideFlag`, Rule 5).
- Camada espalhada **> 60 cm** na rampa/platô → célula **oca** (vinho), pesa 4× na nota.
- FDE reporta “Camada ≤ 30 cm” (% de células conformes).

### TEC 5 — Batimento da Crista (pêndulo)

- Passar na linha da crista **com a lâmina vazia** conta passada dobrada e, na
  primeira vez por célula, carimba `crestStamp` (X branco), com solavanco (trauma
  0,55), poeira radial e `thump` — o “carimbo” do pêndulo.
- A nota de qualidade reserva **20%** para a “crista batida”: toda coluna trabalhada
  precisa do carimbo na crista (`crestPct` na FDE).

### TEC 6 — Encaixe (baliza)

- “Tomada de distância” = **ré comandada, contínua e vazia na praça** por mais de
  180 px (~9 m) → alerta “o trator não vai bater falta” + 1 movimento improdutivo
  (−5% de produtividade cada) (`Tractor.update` → `tookDistanceFlag`).
- A inércia da frenagem não conta (só ré comandada), e cada ré contínua gera no
  máximo uma ocorrência.

### TEC 7 — Sentido de Trabalho

- Cada pilha descarregada vira um slot em `game.pileSlots`; o primeiro ataque a cada
  pilha entra em `attackSeq`. Pular uma pilha no meio ou **inverter o sentido**
  estabelecido → alerta + violação de qualidade (`Game.evaluateAttack`).
- **Curva em carga**: esterço contínuo por > 1 s com carga e velocidade → violação de
  **segurança** (microcorreções têm carência — `SAFETY.TURN_GRACE`).
- **Passo de dança** (Rule 7): o coach detecta faixas “listradas” (coluna compactada
  ao lado de coluna com material sem passada) e ensina o deslocamento de ½ esteira.

---

## O coach (mensagens didáticas em tempo real)

Só atua no turno do jogador (`Game.checkDidacticRules` + `consumeTractorEvents`),
com cooldowns próprios por regra e elogios que aparecem **uma vez cada** (`praised`):

| # | Gatilho | Mensagem |
|---|---|---|
| 1 | > 6 passadas sobre material | “Compactando demais — gasta diesel e danifica o piso” |
| 2 | Espalhando em 2ª marcha | “Use a Marcha 1 (torque) para empurrar peso” |
| 3 | Lâmina ≥ 20 sobre superfície já compactada | “Para regularizar, baixe a 10 cm” |
| 4 | Raspou material compactado com lâmina a 0 | “Compactado não volta à lâmina; suba a 30 cm para se deslocar” |
| 5 | Espalhou fora da rampa | Alerta TEC 4 + violação |
| 6 | Tomada de distância | Alerta TEC 6 + movimento improdutivo |
| 7 | Faixas listradas | Dica do passo de dança (½ esteira) |
| + | Pêndulo na crista / bom ataque 2/3\|1/3 | Elogios (com `pop`) |

Alertas críticos (segurança e TECs 3/4/6/7) usam `triggerAlert`: rádio + flash de
tela + toast central + klaxon.

## Quiz de fechamento

4 perguntas (uma por TEC-chave, na ordem da operação): coleta na praça (TEC 3),
ataque à pilha larga (TEC 3), espalhamento na rampa (TEC 4) e retorno/compactação
(TEC 5/7). Errar mostra o porquê e exige nova tentativa; o quiz não pontua nos KPIs
(é reforço didático antes da FDE).

## KPIs e nota final (`Game.computeAndShowReport`)

Varredura final do terreno classifica cada célula coberta: ideal (verde conformando
camada, ou base finalizada), super compactada, **oca** (> 60 cm na rampa/platô) ou
sobra na praça (nunca conta como ideal).

```
cellQuality   = (100·ideal − 2·100·over − 4·100·oca) / cobertas      (piso 0)
quality       = 0,8 · (cellQuality − 5·violaçõesDeQualidade) + 0,2 · cristaBatida%
safety        = 100 − 20 · violaçõesDeSegurança
productivity  = 100 · (960 s / tempoDoTurno)  (cap 100)  − 5 · movimentosImprodutivos
overall       = 0,4·quality + 0,35·productivity + 0,25·safety
conceito      = A ≥ 90 · B ≥ 75 · C ≥ 60 · D ≥ 40 · E < 40
```

A FDE mostra ainda uma **dica acionável derivada do pior KPI**, o detalhamento por
TEC (crista batida, camada ≤ 30 cm, praça limpa, movimentos improdutivos, violações,
diesel vs. referência de 8 L) e o snapshot do heatmap final.

## Diesel virtual

Acumulado por segundo: 0,002 parado + 0,004·(velocidade/máx) + 0,003 carregado +
0,008 transbordando. Referência de turno bem operado: **8 L** (fica vermelho no HUD
e na FDE acima disso). É o tradutor da tese do material-fonte: *técnica errada =
diesel queimado* — a sobrecarga sozinha triplica o consumo do trecho.
