# 4. Parâmetros do Simulador

Fonte única: [`src/config/params.js`](../src/config/params.js). Toda regra numérica
(cores, notas, física, segurança) sai de lá — heatmap, coach e nota usam **as mesmas
faixas** via `classifyPasses()`. Alterações de balanceamento devem ser feitas ali.

Escala do mundo: **1 célula = 1 m = 20 px**. Grade 40×60 m (definida em `main.js`).

## COMPACTION — faixas de passadas (Espec. §5.3)

| Parâmetro | Valor | Significado |
|---|---|---|
| `LOOSE_MAX` | 0,5 | Abaixo disso = lixo solto (vermelho) |
| `IDEAL_MIN` | 3 | Início da faixa verde |
| `IDEAL_MAX` | 6 | Fim da faixa verde |
| `OVER_MAX` | 8 | Até aqui = lilás (passou do ponto); além = preto (desperdício) |

Alinhado à reconciliação da Especificação (§17): alvo exibido 3–4 passadas, faixa
verde da engine 3–6.

## LAYER — espessura da camada atual (Espec. §5.3)

| Parâmetro | Valor | Significado |
|---|---|---|
| `MAX_OK` | 0,35 m | Camada conforme (30 cm + tolerância de leitura) |
| `OCA_MIN` | 0,6 m | Acima disso, espalhada na rampa/platô = célula **oca** (baixa pressão, irrecuperável) |

## HEATMAP_COLORS

| Chave | Cor | Uso |
|---|---|---|
| `BASE` | `#3d2e1f` | Solo sem lixo |
| `LOOSE` | `#ff3b30` | Lixo solto |
| `WORKING` | `#ff9500` | Ganhando densidade |
| `IDEAL` | `#34c759` | Faixa ideal (3–6 passadas) |
| `OVER` | `#af52de` | Passando do ponto |
| `WASTE` | `#111111` | Super compactado |
| `FINISHED` | `#1d6f42` | Camada finalizada (enterrada sob camada nova) |
| `OCA` | `#7a1f1f` | Camada > 60 cm (oca) |

## BLADE — física da lâmina

| Parâmetro | Valor | Significado |
|---|---|---|
| `CAPACITY` | 5 m³ | Máximo acumulado na lâmina |
| `PICKUP_RATE` | 6 m³/s | Coleta com lâmina a 0 cm |
| `SPILL_RATE` | 1,5 m³/s | Rebarba que vaza pelos lados com a lâmina cheia |
| `SPREAD_RATE` | 6 m³/s | Máximo solto ao espalhar |
| `SMOOTH_RATE` | 2 /s | Fator de alisamento na regularização (10 cm) |
| `TRANSPORT` | 0 cm | Altura para transportar/coletar |
| `REGULARIZE` | 10 cm | Altura para regularizar |
| `SPREAD_MIN` | 20 cm | A partir daqui espalha; camada deixada = altura/100 (m) |

## SAFETY — segurança

| Parâmetro | Valor | Significado |
|---|---|---|
| `VIOLATION_COOLDOWN` | 5 s | Intervalo mínimo entre registros da mesma violação |
| `PENALTY_PER_VIOLATION` | 20% | Desconto na nota de segurança por violação |
| `TURN_GRACE` | 1 s | Esterço contínuo em carga tolerado (microcorreções são normais) |

## TRUCKS — tipos de caminhão (TEC 1/3)

| Tipo | Corpo (px) | Perímetro | Pilha (w×d×h, células×m) | Volume ≈ |
|---|---|---|---|---|
| `COLETOR` | 60×28 | 70 px | 4×3×0,85 | ~10 m³ (≈ 2 viagens de lâmina) |
| `CARRETA` | 95×32 | 120 px | 6×3×1,1 | ~20 m³ — **mais larga que a lâmina**: exige ataque 2/3\|1/3 |

## DIESEL — consumo virtual

| Parâmetro | Valor | Significado |
|---|---|---|
| `IDLE` | 0,002 L/s | Parado com motor ligado |
| `SPEED` | 0,004 L/s | Adicional a velocidade máxima (proporcional) |
| `LOADED` | 0,003 L/s | Adicional com a lâmina carregada |
| `OVERLOAD` | 0,008 L/s | Adicional transbordando (sobrecarga) |
| `REF` | 8 L | Referência de turno bem operado (HUD/FDE ficam vermelhos acima) |

## SHIFT — turno

| Parâmetro | Valor | Significado |
|---|---|---|
| `EXPECTED_TIME` | 960 s | Meta de tempo (produtividade = 100·meta/tempo, cap 100). Calibrada por simulação: operação-modelo ≈ 980 s, na linha da referência de ~12 min/batelada da Especificação |
| `MAX_BATCH` | 5 | Caminhões por batelada completa |

## TEC6 — tomada de distância

| Parâmetro | Valor | Significado |
|---|---|---|
| `REVERSE_RUN_MAX` | 180 px (~9 m) | Ré comandada contínua e vazia na praça que caracteriza “tomada de distância” |
| `PENALTY_PER_MOVE` | 5% | Desconto de produtividade por ocorrência |

## QUALITY — pesos da nota de qualidade

| Parâmetro | Valor | Significado |
|---|---|---|
| `OVER_WEIGHT` | 2 | Peso de cada célula super compactada |
| `OCA_WEIGHT` | 4 | Peso de cada célula oca (camada > 60 cm) |
| `VIOLATION_WEIGHT` | 5 | Desconto por violação didática (TEC 3/4/7) |
| `CREST_SHARE` | 0,2 | Fatia da nota vinda da crista 100% batida (TEC 5) |

## Constantes relevantes fora de `params.js`

Valores definidos localmente (candidatos a migrar para `params.js` — ver revisão):

| Onde | Valor | Papel |
|---|---|---|
| `main.js` | grade 40×60, célula 20 px | Dimensões do módulo |
| `Tractor.js` | 60/120 px/s, accel 200, giro 1,5 rad/s | Física de movimento |
| `TerrainGrid.js` | `coverRow=6`, `crestRow=40%`, `peRow=80%`, `dischargeRow=56,5` | Linhas do módulo |
| `Game.js` | spawn a cada 2 s; raio 130 px do julgamento de ataque; cooldowns do coach (8–25 s) | Ritmo e didática |
| `Truck.js` | velocidade 300 px/s, descarga em 1 s, vagas com margem de 80 px | Ciclo dos NPCs |
