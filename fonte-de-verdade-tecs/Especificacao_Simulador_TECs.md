# Especificação Completa do Simulador — Treinamento de TECs
## Técnicas de Espalhamento e Compactação · Método de Gestão de Aterros Sanitários 360º

**Versão:** 1.0 — 03/07/2026
**Fontes primárias:** livro *Colocando Gestão no Lixo* (Newton Pimenta/Cruz, 418 pp., com referências de página), 8 vídeos do Treinamento Operacional "Inteligência em Pesados" (transcrições + análise frame a frame de ~1.255 frames), painéis infográficos originais do livro (TECs_completo.docx) e GDD preliminar (Gemini) — revisado e corrigido nesta especificação (ver Seção 17).

---

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Fundamentos do Domínio](#2-fundamentos-do-domínio)
3. [O Cenário: Módulo Operacional Padrão](#3-o-cenário-módulo-operacional-padrão)
4. [Equipamentos, Veículos e Personagens (Assets)](#4-equipamentos-veículos-e-personagens-assets)
5. [Modelo Físico e Simulação](#5-modelo-físico-e-simulação)
6. [Máquina de Estados do Ciclo Operacional](#6-máquina-de-estados-do-ciclo-operacional)
7. [As 7 TECs — Mecânicas, Regras e Avaliação](#7-as-7-tecs--mecânicas-regras-e-avaliação)
8. [Sistema de Pontuação e KPIs](#8-sistema-de-pontuação-e-kpis)
9. [Modos de Jogo e Progressão](#9-modos-de-jogo-e-progressão)
10. [Cenários de Erro (Biblioteca de Situações)](#10-cenários-de-erro-biblioteca-de-situações)
11. [Interface do Usuário (HUD/UI)](#11-interface-do-usuário-hudui)
12. [Controles (Inputs)](#12-controles-inputs)
13. [Direção de Arte e Ambientação](#13-direção-de-arte-e-ambientação)
14. [Design de Áudio](#14-design-de-áudio)
15. [Analytics, Relatórios e Integração LMS](#15-analytics-relatórios-e-integração-lms)
16. [Tabela Mestra de Parâmetros (com fontes)](#16-tabela-mestra-de-parâmetros-com-fontes)
17. [Correções e Divergências em Relação ao GDD Preliminar](#17-correções-e-divergências-em-relação-ao-gdd-preliminar)
18. [Glossário](#18-glossário)
19. [Recomendação de Escopo (MVP → Completo)](#19-recomendação-de-escopo-mvp--completo)

---

# 1. Visão Geral do Produto

## 1.1 Conceito

Simulador 3D de treinamento e certificação de operadores de trator de esteira em aterros sanitários, baseado nas **TECs (Técnicas de Espalhamento e Compactação)** do **Método de Gestão de Aterros Sanitários 360º**. O jogador opera um trator de esteira em um Módulo Operacional Padrão virtual e é avaliado pela aderência às 7 técnicas — do momento em que o caminhão descarrega até o acabamento da camada compactada.

**Tese pedagógica do material-fonte** (vídeo 00 — Abertura): *"Aplicação de técnicas é o que diferencia um trabalho profissional de um trabalho amador."* O operador de aterro é um profissional como um médico ou eletricista; o aterro é um processo produtivo com setores, funções, atividades e tarefas (analogia do time de futebol usada no vídeo). O simulador deve materializar essa tese: cada atividade tem técnica, cada técnica tem regra mensurável, cada regra gera nota.

## 1.2 Público-alvo

- **Primário:** operadores de trator de esteira (novatos e experientes em reciclagem) — treinamento e certificação corporativa.
- **Secundário:** apontadores/encarregados de frente operacional (modos de coordenação de descarga e avaliação), engenheiros e gestores (visualização do método).

## 1.3 Pilares de design

1. **Fidelidade ao método** — toda regra do jogo vem do livro/vídeos, com parâmetro rastreável (Seção 16).
2. **"Passo de dança", não decoreba** — o livro ensina a contagem de passadas como sequência de movimentos (p. 156). O simulador ensina pelo corpo: repetição guiada, depois avaliação sem guias.
3. **Feedback visível no mundo** — o terreno registra o trabalho (rastros, rebarbas, textura de compactação, cota). O jogador *vê* o erro antes de ler a nota.
4. **Certificação séria** — relatório final auditável, integrado ao RH/LMS (Seção 15).

## 1.4 Plataforma e tecnologia (recomendação)

- Engine: Unity ou Unreal (física de veículos com esteiras + terreno deformável por heightmap/voxels — ver Seção 5).
- PC standalone (salas de treinamento) com suporte a gamepad; versão WebGL simplificada opcional para reciclagem à distância.
- Idioma: pt-BR (toda a nomenclatura do método em português, conforme glossário — Seção 18).

---

# 2. Fundamentos do Domínio

## 2.1 O que são as TECs

> "A aplicação do Método 360º consiste em organizar e padronizar a praça de trabalho em uma estrutura unitizada que chamamos de **Módulo Operacional Padrão**, implantar Técnicas Operacionais, chamadas de **TEC (Técnicas de Espalhamento e Compactação)**, e fazer o controle da evolução dos resultados através de um sistema de **KPIs**." (livro, p. 131)

As TECs integram o bloco de **Preenchimento** (descarga, espalhamento e compactação) e são apresentadas na ordem em que ocorrem na operação.

## 2.2 As 3 atividades do trator (unidades básicas de trabalho)

O mesmo equipamento executa **atividades diferentes, em locais diferentes, com técnicas diferentes** (vídeo 00, slide "ATIVIDADES – Trator de Esteira"):

| Atividade | O que é | Estado da lâmina | Onde ocorre |
|---|---|---|---|
| **Transportar** | Levar o lixo do ponto A ao B sem deixar material no caminho | **Lâmina em zero** (nível do solo) | Área de transporte (praça → pé da rampa) |
| **Espalhar** | Deixar o lixo "vazar" por baixo da lâmina formando camada controlada | **Lâmina elevada 20/30 cm** | Somente na rampa |
| **Compactar** | Passar sobre o resíduo sem lixo na lâmina, batendo/regularizando | **Lâmina elevada ~10 cm** (regularização) | Rampa, na volta |

(4ª função citada de passagem no vídeo 00: **cobrir** — espalhamento/compactação de solo de cobertura; ver Seção 9.6.)

## 2.3 As 4 zonas da frente de operação

O fluxo espacial (quadro-resumo do vídeo 90 e infográfico p. 118/159 do livro):

**Praça de Descarga → Área de Transporte → Preenchimento (= Espalhamento + Compactação, na rampa) → [Área de Compactação de Crista] → Cobertura**

| Zona | Quem comanda | Técnica principal |
|---|---|---|
| Praça de Descarga | **Apontador** | Descarte em linha (TEC 2) + coordenação de batelada (TEC 1) |
| Transporte | Operador | Ataque à pilha (TEC 3), lâmina zero, 1ª marcha ida / 2ª volta |
| Espalhamento | Operador | Lâmina 20/30 cm, chega na crista sem lixo, bate a crista (TECs 4 e 5) |
| Compactação | Operador | Lâmina 10 cm, 2ª marcha ida e volta, linha reta, sentido oposto ao preenchimento (TEC 7) |

## 2.4 Equação-síntese

**Preenchimento = Espalhamento + Compactação** (rótulo literal do quadro-resumo do vídeo 90).
**Compactação eficiente = espessura de camada controlada × número de passadas controlado** — impossível sem **sentido de trabalho** (TEC 7).

---

# 3. O Cenário: Módulo Operacional Padrão

## 3.1 Geometria base (o "level")

A praça de trabalho 3D é estruturada por **4 linhas demarcatórias paralelas e retas** (vídeo TEC 2, infográfico "Linhas de Trabalho – PARALELAS"; livro pp. 108–119):

1. **Linha de Descarte (Frente de Descarga):** onde os caminhões param e basculam, formando a linha de pilhas. Fica o mais próximo possível do pé do talude (sem invadi-lo — o trator precisa enxergar e avançar). No livro, terminologia oficial da placa: "FRENTE DE DESCARGA".
2. **Linha de Pé (Pé de Talude):** limite basal da rampa; onde começa o preenchimento (em Uphill).
3. **Linha de Crista (Crista de Talude):** quina no topo da rampa; fim da subida, início do platô.
4. **Linha de Cobertura:** linha no platô que delimita até onde a cobertura de solo avançou. **O recobrimento nunca deve chegar até a linha da crista** — impediria o trator de subir ao platô e bater a crista (livro, p. 110).

> **Regra de ouro da engine:** as linhas devem permanecer **estritamente paralelas e retas** durante toda a operação. O minimapa marca em vermelho trechos onde o paralelismo se perdeu (operação em curva/diagonal) e o Índice de Qualidade é penalizado. *"Linha curva, desorganizada, não é padrão, não padroniza distâncias, não protege de chuva."* (vídeo TEC 2)

## 3.2 Dimensões paramétricas do módulo

| Elemento | Valor canônico | Fonte |
|---|---|---|
| Inclinação da rampa — **Uphill** | **1:4 (1 V : 4 H)** | livro pp. 94, 109, 116; vídeo 00 (diagrama "INCLINAÇÃO 1 para 4") |
| Inclinação da rampa — **Downhill** | **1:3** | livro pp. 96, 109, 116 |
| Altura da camada de lixo (célula) | **5 m** (parâmetro de projeto; configurável) | livro pp. 94, 96, 164 |
| Comprimento da rampa (camada 5 m) | **~21 m** Uphill · **~16 m** Downhill (vídeo 00 usa 20 m × 5 m) | livro pp. 94, 96; vídeo 00 |
| Área de batimento da crista (abertura no platô) | **5 m** em toda a extensão da frente | livro p. 94 |
| Área de transporte | Mínima possível; em Downhill: **3–5 m** do ponto de descarga; com remoção: faixa de **5 m** (avanço diário 4–5 m) | livro pp. 94, 96 |
| Largura do módulo (exemplo de referência) | **40 m** (exemplo: 10.000 t/mês → avanço 50 m/mês) | livro p. 164 |
| Taxa de avanço da crista | 4–5 m/dia típico; exemplo de 8 m/dia | livro pp. 94, 96, 110 |
| Descarga em módulo novo (sem talude ainda) | a **~10 m** do futuro pé do talude, com **dique de partida** | livro p. 114 |
| Talude lateral provisório | **~1:1**, protegido com manta GeoCover | livro p. 165 |

O editor de cenário deve expor: tonelagem/dia, altura de camada, largura do módulo, nº de vagas, modo Uphill/Downhill — e derivar rampa, vagas e ritmo de avanço a partir deles.

## 3.3 Modos de operação (variantes de nível)

1. **Uphill (padrão do jogo, nível inicial):** descarga na base; espalhamento subindo a rampa. Vantagens: funciona bem na chuva; peso + tração a favor da compactação. Ciclo F&R exemplo: 31 m → 221 t/h (D61).
2. **Downhill (nível avançado):** descarga no platô superior; espalhamento descendo (~20% mais produtivo, ciclo 26 m → 263 t/h). Requer módulos alternados (um em preenchimento, outro em cobertura — "módulo bipartido", p. 97). O simulador inverte o sentido de preenchimento **sem mudar a posição das linhas** (vídeo TEC 2).
3. **Cais e Aterro de Ponta:** aparecem apenas como *cenários de erro/contexto* (Cais = forma de descarte improdutiva com risco de tombamento de compactadores para trás; Aterro de Ponta = prática inadequada, sem energia de compactação). Não são modos jogáveis de preenchimento correto.

## 3.4 Sinalização de campo (assets funcionais)

Conforme livro pp. 117–119 e vídeo 00:

- **3 tipos de placa de módulo** (2 unidades de cada, reposicionáveis mais de uma vez por dia acompanhando o avanço):
  - **FRENTE DE DESCARGA** — símbolo: duas barras horizontais (≡ com 2 traços)
  - **PÉ DE TALUDE** — símbolo: ⊥ ("T" invertido)
  - **CRISTA DE TALUDE** — símbolo: T
  - Especificação física: estrutura em metalon, chapa pintada de branco, painel superior 30×60 cm com logomarca 30×30 cm, texto e símbolo em **fita refletiva laranja** (visível à distância e à noite), base autoportante tipo cavalete.
- **Alternativas/complementos:** piquetes/balizas topográficas (haste preta com base branca — vistas nos infográficos TEC 2/TEC 3), tambores, bandeiras/marcos vermelhos na crista (foto do vídeo TEC 5), **cones laranja com faixa branca** delimitando corredor de tráfego e limite de vagas (foto do vídeo TEC 1).
- **Placas de vagas numeradas** (1–6, verdes — vídeos TEC 1/TEC 2 e foto p. 153).
- No simulador, as placas são **objetos funcionais**: o jogador (ou o apontador NPC) as reposiciona quando a crista avança; placas desatualizadas geram penalidade de organização.

## 3.5 Infraestrutura do entorno

- **Drenos de gás verticais** (tubo preto central + bolsão de pedras/gabião, Ø ~1,5 m) sobre o platô — obstáculos reais que a cobertura deve contornar e proteger (fechamento em solo ao redor).
- Estrada interna de terra com comboio de caminhões; balança/portaria implícita (tempo de ciclo de atendimento — Seção 8).
- Paredões de corte (argila vermelha com tela no topo / jazida "canyon" de areia estratificada — vídeos 91 e TEC 3), células antigas cobertas com vegetação rasteira, torre de iluminação para turno noturno.

---

# 4. Equipamentos, Veículos e Personagens (Assets)

## 4.1 Trator de esteira (equipamento do jogador)

Referências visuais reais dos vídeos: **Komatsu D61EX-23** (protagonista dos vídeos TEC 3 e 91) e **CAT D6N** (vídeo TEC 3). Modelar um trator genérico da classe:

- **Peso operacional 20–24 t; sapatas de 60 mm** (padrão para lixo — livro p. 52).
- **Largura de esteira: 0,6 m** (painel TEC 4 do livro — cotas "0,6 m" no diagrama de rastros).
- **Lâmina PAT/semi-U com grade alta (spill guard / trash rack)** — característica visual marcante nos vídeos.
- Marchas discretas: **1ª (carregado) e 2ª (retorno/compactação)** — a velocidade é definida pelo seletor, não pelo acelerador (livro p. 57). O simulador usa este fato: velocidade constante por marcha simplifica física e avaliação.
- Animações: esteiras independentes (manobra por diferencial de esteiras), pistões hidráulicos da lâmina (elevar/baixar/inclinar), suspensão da cabine balançando com o terreno, fumaça preta do escapamento proporcional à carga, acúmulo de poeira/lama.
- Desgaste cosmético: pintura amarela com arranhões na lâmina, lama nas esteiras.

## 4.2 Caminhões (NPCs de descarga)

| Tipo | Papel no jogo | Observações das fontes |
|---|---|---|
| **Coletor compactador** (branco, caçamba com equipamento azul) | Descarga rápida, pilha pequena | Perímetro de segurança **menor** que o da carreta (vídeo TEC 1). **Nunca descarrega em cais** (tomba para trás — livro p. 99) |
| **Carreta/bitrem basculante** (caçamba longa, ergue a caçamba) | Pilha longa | Perímetro de segurança **maior** (caçamba elevada). Deve bascular **em ângulo/diagonal**, colada à pilha anterior (TEC 2). Roll on/roll off: ciclos de 78 m³ (livro p. 138) |
| **Basculante de solo** (amarelo/prata) | Cobertura e remoção | Descarrega solo **em linha, formando bateladas** também (livro p. 179) |
| Apoio: escavadeira CAT 320, caminhão munck, caminhão-pipa | Ambiência/cenas | Vídeos TEC 3 e 91 |

Animações obrigatórias: abertura de portas/caçamba derramando partículas de lixo, retirada de lona (tempo de preparação — regra "2 descarregando + máx. 3 em preparação", livro p. 62), manobra de ré até a vaga.

## 4.3 Apontador (NPC-chave)

> Terminologia: o livro usa **Apontador** (p. 159); o vídeo 90 cita sinônimos de campo "apontador, bandeirinha, chamador". O jogo usa **Apontador** na UI e aceita "bandeirinha" como apelido informal em diálogos.

- Avatar com EPI completo: capacete, colete refletivo laranja, luvas; uniforme azul (foto TEC 1).
- Funções no jogo: orienta cada caminhão para a vaga correta (gestos + rádio), fiscaliza perímetro de segurança, ajuda com lona/tampa, sinaliza ao jogador quando a **batelada está completa** (gatilho da TEC 1).
- No modo Encarregado (opcional, Seção 9), o jogador assume esse papel.

## 4.4 Demais personagens

- Trabalhadores a pé com colete (DMS — Distância Mínima de Segurança: pedestre sinaliza fora do raio de alcance, aguarda confirmação visual do operador antes de se aproximar — livro p. 345; violar isso no jogo = falha crítica de segurança).
- Urubus/garças (ambiência; levantam voo quando o trator passa).

---

# 5. Modelo Físico e Simulação

## 5.1 Representação do resíduo

Recomendação: **heightmap deformável em grade de células (~0,3 m)** com camadas empilhadas por célula, guardando por célula:

```
celula = {
  altura_lixo_solto,      // m de resíduo não compactado
  altura_lixo_compactado, // m consolidado
  passadas: int,          // nº de passadas de esteira recebidas NA CAMADA ATUAL
  espessura_camada_atual, // m da camada em processamento
  densidade,              // 0,55 t/m³ (solto) → ~1,0 t/m³ (trator, bem executado)
  coberto: bool           // recebeu solo de cobertura
}
```

- **Densidade do lixo solto: 550 kg/m³** (livro p. 57). Compactação bem executada com trator: **~0,9–1,0 t/m³** (pp. 405, 411). Benchmark com compactador dedicado: 1,27–1,3 t/m³ (case BATTRE) — usado só como referência de contexto, o jogador opera trator.
- Visual: mistura caótica de sacolas plásticas coloridas, papelão, madeira, orgânicos. Ao compactar, o mesh "encolhe" e a textura muda para aspecto maciço, escuro, consolidado.

## 5.2 Física da lâmina e do empurre

- A lâmina tem **capacidade volumétrica (ISO 9246)**. Carga além da capacidade → o material transborda pelas bordas (rebarba) e/ou a máquina **sobe no resíduo** e perde tração ("começa a formar camada onde não é para formar ainda" — vídeo TEC 3).
- **Rebarba direcional:** o transbordo ocorre para o lado onde há material adjacente/parede de pilha. Com ataque correto 2/3|1/3 (TEC 3), o material se acomoda para o lado do 1/3 livre em poucos metros e a rebarba excedente cai **somente para o lado de dentro**; o lado externo fica limpo. Ataque pelo centro → rebarba dos **dois** lados.
- **Espalhamento:** com lâmina elevada a H metros, o material vaza por baixo formando camada de espessura ≈ H atrás da lâmina. Elevações de referência: 0 (transporte), 0,20–0,30 m (espalhamento), 0,10 m (regularização na compactação).
- Sobrecarga → queda de RPM audível, velocidade caindo abaixo da nominal de 1ª, fumaça preta.

## 5.3 Modelo de compactação (o coração da avaliação)

Baseado nos gráficos do livro (p. 158, apoiados em Matthews et al., 1997) e no slide "Processo de Compactação" do vídeo TEC 7:

- **Curva densidade × nº de passadas:** crescente com saturação. Ganho por passada decresce; satura em torno de **4 passadas** (livro) / **zona ótima 4–6 passes** (vídeo). Passar além de 6 não compacta mais — só queima diesel.
- **Curva densidade × espessura da camada:** decrescente. **Ideal até 30 cm** (livro); eixo do gráfico do vídeo mostra queda forte de densidade entre 0,5 e 1,5 m.
- **Zonas de pressão:** a energia de compactação atua na camada superficial — **zona de alta pressão: 30 a 60 cm sob as esteiras** (cota do diagrama do vídeo TEC 7; o livro traz o mesmo esquema sem cota, p. 158/46). Abaixo disso, **zona de baixa pressão**: a pressão se dissipa e "não adianta compensar camada grossa com mais passadas por cima" (analogia do vídeo: martelada em pilha de pessoas deitadas — a de baixo não sente).

**Implementação por célula:**

```
se espessura_camada_atual <= 0,30:            zona = "ideal"
senão se espessura_camada_atual <= 0,60:      zona = "aceitável (limite da alta pressão)"
senão:                                        zona = "camada grossa" -> fundo da camada marcado
                                              como BAIXA PRESSÃO / OCO (irrecuperável
                                              por passadas extras)

ao receber passada de esteira:
  passadas += 1
  densidade sobe pela curva saturante (ganho ~0 após a 6ª passada)
  status: 0 passadas = solto | 1-2 = insuficiente | 3-4 = ideal (livro)
          5-6 = ainda válido (vídeo) | >6 = desperdício (penalidade de diesel/tempo)
```

> **Decisão de reconciliação (ver Seção 17):** alvo exibido ao jogador = **3 a 4 passadas** e **camada ≤ 30 cm** (números do texto do livro); faixa verde da engine = 3–6 passadas e 30–60 cm como tolerância (números dos infográficos/vídeo). Acima/abaixo disso, penalidade.

## 5.4 Pêndulo da crista (física especial da TEC 5)

Diagrama do vídeo TEC 5: quando o trator chega à crista **bem acentuada** e avança, **~metade dianteira da esteira fica em balanço sobre o vazio**; o centro de massa passa pelo pivô da quina e a máquina "pendula" para o platô. Nesse instante, o peso total — antes distribuído pela área das esteiras — concentra-se na **linha da quina** (pressão = peso ÷ área; analogia do salto agulha esmagando o celular).

- Engine: detectar o evento "pêndulo" (pitch do chassi cruzando a quina com ≥ ~50% da esteira em balanço) e aplicar compactação máxima nas células da linha de crista.
- Pré-condições: chegar à crista **sem lixo na lâmina** e crista **bem conformada** (reta, aresta viva). Crista "arredondada"/mal conformada não gera o efeito (e o jogo mostra isso: sem o solavanco do pêndulo, sem o carimbo de compactação).
- A crista esmagada progressivamente vira **a parte mais compacta do maciço** — base dos futuros acessos e da cobertura.

## 5.5 Tração, patinação e clima

- Tração função da compactação do solo sob a esteira: rampa de material solto → **patinação** (esteiras giram, avanço menor, sulcos profundos — cenário de erro E3 do vídeo 91).
- **Chuva (níveis avançados):** solo vira lama, tração cai, o "pêndulo" da crista exige mais cuidado; Uphill sofre menos (o resíduo avança consumindo a área de trabalho). Visual: poças, chorume, sulcos.
- **Noite:** operação com faróis do trator + torres de iluminação; placas com fita refletiva laranja brilham; visibilidade de alinhamento reduzida.
- Terreno responde às esteiras: sulcos profundos em solo frouxo, marcas leves em solo compactado (feedback visual direto da TEC 4/7).

---

# 6. Máquina de Estados do Ciclo Operacional

Estados do ciclo do operador (por pilha, dentro de uma batelada), com parâmetros do quadro-resumo (vídeo 90 / livro p. 159):

```
AGUARDANDO_BATELADA
  trator estacionado, motor em marcha lenta (ou desligado)
  gatilho de saída: apontador confirma batelada completa (TEC 1)

ENCAIXE_E_ATAQUE (TECs 6 e 3)
  ré + alinhamento tipo "baliza" na próxima pilha, SEM tomar distância
  posicionar lâmina: 2/3 na pilha, 1/3 livre no lado externo
  lâmina em ZERO

TRANSPORTE (TEC 3)
  1ª marcha, lâmina em zero, linha reta, lado externo limpo
  não deixar lixo pelo caminho (célula de transporte deve ficar limpa)

ESPALHAMENTO (TEC 4)  [somente na rampa: entre linha de Pé e de Crista]
  elevar lâmina para 20/30 cm ao cruzar a linha de pé (Uphill)
  1ª marcha, subir espalhando; camada-alvo ≤ 30 cm
  chegar na CRISTA SEM LIXO na lâmina

BATIMENTO_DA_CRISTA (TEC 5)
  elevar a lâmina, avançar ~1/2 esteira além da quina, pendular para o platô
  (área livre de 5 m no platô garantida — cobertura nunca até a crista)

RETORNO (TEC 4/6)
  2ª marcha em ré, desloca 1/2 esteira para o lado,
  volta compactando a "segunda linha de esteiras"
  → próximo ciclo SEMPRE no mesmo sentido de trabalho

[fim da batelada de espalhamento: todas as pilhas 1→N espalhadas]

COMPACTAÇÃO_DA_BATELADA (TEC 7)
  lâmina a ~10 cm (regularização), 2ª marcha ida e volta, linha reta
  volta batendo o lixo no sentido OPOSTO ao preenchimento (N→1)
  proibido: curvas em carga, giros sobre a massa

BATELADA_CONCLUÍDA → relatório parcial → AGUARDANDO_BATELADA
```

**Padrão de cobertura de passadas (TEC 4, livro p. 156):** um ciclo Frente-e-Ré cobre o equivalente a **4 larguras de esteira**; com o deslocamento lateral de **1/2 esteira**, a viagem seguinte pisa na 3ª e 6ª "linhas", completando **uma passada uniforme em 3,6 m de largura** a cada par de viagens. Repetindo até o fim da batelada e voltando compactando, o número recomendado de passadas é atingido *naturalmente* — é o "passo de dança". A engine deve reproduzir exatamente esse rastro (esteiras de 0,6 m, vão central, offset lateral de 0,3 m por ciclo).

---

# 7. As 7 TECs — Mecânicas, Regras e Avaliação

Formato de cada TEC: **Objetivo · Setup · Procedimento correto · Erros detectáveis (telemetria) · Feedback**.

## TEC 1 — Coordenação da Descarga (operação por bateladas)

**Objetivo:** linearizar a produtividade entre picos e vales, mitigando tempo de setup e tempo ocioso entre ciclos. Analogia canônica: caixas de supermercado — nº de vagas instaladas ≠ nº de posições de descarga ativas.

**Setup do cenário:** linha de descarte com **N vagas** (padrão 5–6, numeradas com placas verdes). Perfil de entrada de resíduos por hora (gráfico real do livro, p. 153–154) alimenta o spawner de caminhões: ex. segunda-feira — operação começa ~11h com 2 bateladas; 1 batelada/h entre 13–18h; turno noturno a partir das 22h com 7 bateladas.

**Procedimento correto:**
1. Caminhões são direcionados pelo apontador às vagas, em **ordem aleatória** — o único critério é o **perímetro de segurança**: enquanto um caminhão bascula, as vagas dentro do seu perímetro ficam bloqueadas. Perímetro da **carreta basculante > coletor compactador** (risco de tombamento com caçamba erguida — arcos desenhados no vídeo TEC 1 e foto p. 111).
2. Regra do fluxo: com 2 posições simultâneas, no máximo **2 descarregando + 3 em deslocamento/preparação** (tirando lona); "saiu um, entra outro" (p. 62). Exemplo de dimensionamento: 6 vagas → 2–3 posições simultâneas (p. 111).
3. O trator **aguarda parado** (idle) até a batelada (nº definido de pilhas) estar completa. Só então inicia o ciclo. Tempo de referência para operar uma batelada: **~12 min** (registro de FDE, p. 121).

**Regra literal (livro p. 153):** *"Atendendo sempre ao critério do perímetro de segurança, preencha a linha de pilhas de forma aleatória até que a batelada esteja completa (número de pilhas definido)."*

**Erros detectáveis:**
- Iniciar o ciclo antes da batelada completa → penalidade "quebra de batelada" (produtividade).
- Entrar no perímetro de segurança de caminhão basculando (trator ou pedestre) → **falha crítica de segurança**.
- (Modo apontador) autorizar 2 caminhões com perímetros sobrepostos; exceder o limite de caminhões na frente.

**Feedback:** contador de pilhas "Batelada 3/5" no HUD; arcos de perímetro visíveis no minimapa (e como projeção no chão em modo tutorial); buzina + tela de alerta na violação.

## TEC 2 — Descarte em Linha

**Objetivo:** formar a linha de ataque perfeita — pilhas lado a lado, **coladas**, em linha reta paralela ao pé — eliminando deslocamentos improdutivos.

**Benefícios literais (vídeo/painel):** *"Diminui deslocamento improdutivo · Melhora eficiência de carga da lâmina · Mantém a Praça mais limpa e organizada."*

**Mecânica:**
- Pilhas dispostas uma ao lado da outra sobre a Linha de Descarte, próximo à rampa. Vãos entre pilhas = deslocamento morto do trator + lâmina subcarregada (o instrutor circula os vãos de vermelho no vídeo — o simulador reproduz esse feedback destacando vãos no minimapa).
- **Nunca** pilhas sobrepostas (uma na frente da outra): o trator "não vence" a massa, sobe no resíduo e começa a espalhar antes da hora. (Caso extremo citado: 12 pilhas sobrepostas na cobertura → pontos com >2 m de solo, p. 174.)
- **Carretas longas:** bascular **em ângulo/diagonal** ("Dica Pé no Barro": *"Sempre que possível posicione as pilhas em ângulo, coladas uma na outra"*), de modo que a mancha fique contígua à pilha anterior, sem buracos, mantendo a linha reta. Diagrama do vídeo: posições 1-2-3-4-5 preenchidas em sequência espacial no "sentido do preenchimento".
- Alternativa para pilha longa já mal descarregada: o trator "quebra" a pilha e a realinha (custo extra de ciclo).

**Erros detectáveis:** pilha fora da linha (offset > tolerância), vão entre pilhas acima do limite, pilha sobreposta, linha de descarte torta/curva (perda de paralelismo).

**Responsabilidade compartilhada:** no modo operador, os NPCs descarregam conforme o nível (níveis avançados incluem descargas erradas que o jogador deve **alertar pelo rádio** — mecânica de "cultura de equipe": *"o operador tem que alertar a equipe"*, vídeo TEC 2). No modo apontador, o jogador posiciona os caminhões.

## TEC 3 — Ataque à Pilha (2/3 | 1/3)

**Objetivo:** eliminar retrabalho (rebarbas) e trabalhar com carga correta na lâmina.

**Procedimento correto (regra literal, painel do livro):** *"Ataque a pilha deixando 1/3 da lâmina livre. Vá carregando a lâmina até o ponto de espalhamento mantendo o lado de fora limpo (sem rebarba). A rebarba formada no lado 'sujo' será processada no próximo ciclo. Na volta, encaixe a máquina como se estivesse fazendo uma baliza."*

- O 1/3 livre fica **no sentido oposto ao sentido de trabalho** (lado externo). Em poucos metros de avanço, o material se acomoda e preenche a lâmina inteira — não é improdutivo.
- Sempre atacar pela **extremidade** da fileira (lado de fora), avançando pilha a pilha no sentido de trabalho; o rastro externo fica 100% limpo e acabado ("vai deixando pronto por onde já passou").

**Física da engine (obrigatória):**
- Alinhamento 2/3|1/3 → rebarba **apenas para o lado interno**; rastro externo limpo.
- Ataque pelo **centro** → rebarba para os **dois** lados → cada rebarba exigirá um ciclo extra (o vídeo quantifica: pilha atacada pelo meio = 3 ciclos; pelo lado = 2 ciclos → **~33% de desperdício** de máquina/combustível). A engine deve contabilizar exatamente esses ciclos extras no Índice de Produtividade.
- Pegar lixo demais → máquina força (RPM cai, velocidade cai) ou sobe no resíduo.

**Erros detectáveis:** fração de lâmina engajada fora da faixa (alvo 2/3 ± tolerância), rebarba deixada no lado externo, rebarba interna não processada até o fim da batelada (praça suja no relatório), ataque pelo centro, subir na pilha.

**Feedback:** guia visual no tutorial (lâmina dividida em 3 segmentos com marcação "2/3 | 1/3" como no infográfico); pós-ação, decal de "rastro limpo" verde vs "rebarba" vermelha no solo.

## TEC 4 — Espalhamento

**Objetivo:** formar camada de espessura controlada, somente na rampa, com cobertura uniforme de passadas.

**Procedimento correto:**
1. Transporte com lâmina em zero até a **linha de pé** (Uphill) ou **crista** (Downhill).
2. Ao entrar na rampa, **elevar a lâmina para 20/30 cm** e conduzir espalhando até o fim da rampa — camada resultante ≤ 30 cm.
3. **Chegar ao fim da rampa sem lixo na lâmina** (tudo espalhado ao longo da subida).
4. Avançar sobre o platô (Uphill) ou base (Downhill), **deslocar 1/2 esteira para o lado** e **voltar compactando a segunda linha de esteiras** (2ª marcha).
5. Padrão de rastro: 1 ciclo F&R = 4 larguras de esteira; passada completa fecha em **3,6 m** a cada par de viagens (ver Seção 6).

**Erros detectáveis:**
- Camada > 30 cm (tolerância até 60; acima → células de fundo marcadas "baixa pressão/oco" — irrecuperável).
- Espalhar fora da rampa (antes do pé ou depois da crista): *"lixo só é preenchido na rampa — antes da rampa não vai lixo, depois da rampa não vai lixo"* (vídeo TEC 2).
- Chegar à crista **com** lixo na lâmina.
- Esquecer o deslocamento lateral de 1/2 esteira (deixa faixas sem passada — o "mapa de calor de passadas" expõe os buracos).
- Passadas < 3 (frouxo) ou > 6 (desperdício de diesel/tempo).

**Feedback:** indicador de altura da lâmina com faixas coloridas (0 / 10 / 20–30 cm); mapa de calor de passadas no minimapa (vermelho 1 → amarelo 3 → verde 4–6); número flutuante discreto sobre o trecho trabalhado.

## TEC 5 — Batimento da Crista (Compactação/Esmagamento da Crista)

> Nomenclatura: o material usa "Batimento", "Esmagamento" e "Compactação" da crista como sinônimos. UI do jogo: **Batimento da Crista**.

**Objetivo:** garantir que a camada superior do platô — base da cobertura e dos acessos — seja a parte **mais compactada** do maciço. *"A superfície é a base para cobertura e acessos. Capricho é fundamental."* (vídeo TEC 5). Toda pista sobre lixo tem o lixo como sub-base: crista mal compactada = acesso ruim para sempre.

**Procedimento correto:**
1. Chegar à crista **sem lixo na lâmina** (pré-condição da TEC 4).
2. **Não** retornar da crista: elevar a lâmina e **subir na crista**, avançando até ~metade da esteira em balanço sobre a quina.
3. O trator **pendula** para o platô: o peso concentra-se na quina → esmagamento (pressão = peso ÷ área; analogia didática do salto agulha, a ser usada no tutorial do jogo).
4. Repetir a cada ciclo, ao longo de toda a frente (o sentido de trabalho da TEC 7 garante que todos os pontos da crista sejam batidos).

**Pré-requisitos geométricos:** crista **bem conformada** (reta, aresta acentuada) e **abertura de 5 m livre no platô** (cobertura nunca até a crista). Se a crista está arredondada/irregular, o pêndulo não acontece — o jogador precisa reconformá-la.

**Erros detectáveis:** voltar da crista sem subir/pendular; chegar com lixo na lâmina; crista com "orelhas"/ondulações no fim da batelada (escaneamento de retilineidade da aresta); cobertura invadindo a faixa de 5 m.

**Feedback:** solavanco físico + som de esforço no pêndulo bem executado; decal de "carimbo" de compactação na quina; réplica visual do estado-alvo: crista retilínea horizontal com marcos/bandeiras (foto do vídeo TEC 5).

## TEC 6 — Encaixe (baliza)

**Objetivo:** economia de movimento entre ciclos — *"o trator não vai bater falta"* (vídeo 91): não se toma distância da pilha.

**Procedimento correto:** ao final do retorno, encaixar a máquina na próxima pilha da linha **como uma baliza de estacionamento**: ré curta, alinhamento do canto da lâmina com a próxima pilha (mantendo o 2/3|1/3 da TEC 3), e ataque imediato — praticamente sem deslocamento morto.

**Erros detectáveis:** distância de "tomada de impulso" acima da tolerância (metros de ré além do necessário), ângulo de aproximação errático (correções múltiplas de direção), parar longe da pilha e avançar torto.

**Feedback:** no tutorial, "fantasma" do trator na posição ideal de encaixe; medidor de "movimento improdutivo" (m percorridos sem carga fora do ciclo ideal) alimentando o Índice de Produtividade. Som de confirmação satisfatório no encaixe perfeito.

## TEC 7 — Sentido de Trabalho

**Objetivo:** tornar controláveis a espessura e o nº de passadas — impossíveis sem sentido definido. Analogia canônica: **cortar grama** (linhas retas, faixa a faixa; ninguém corta grama em círculos).

**Procedimento correto:**
1. Definir o sentido de trabalho da batelada, **preferencialmente de fora para dentro**.
2. **Espalhar** todas as pilhas no sentido definido (pilha 1 → 5), um ciclo F&R por faixa, sempre no mesmo sentido.
3. Só depois, **voltar compactando no sentido oposto** (5 → 1): lâmina a ~10 cm (regularização de rebarbinhas), 2ª marcha ida e volta, **linha reta**, batendo o lixo.
4. Movimentos estritamente longitudinais; curvas em carga são proibidas — ativam várias funções hidráulicas simultâneas e forçam o equipamento.

**Erros detectáveis:** mudar de sentido no meio da batelada (ex.: espalhar 1, pular para 4, voltar à 2); curva com lâmina carregada (ângulo de esterçamento sob carga acima do limiar → punição "Esforço Inadequado do Equipamento"); compactar antes de concluir todo o espalhamento; giros sobre a massa.

**Feedback:** setas de sentido no minimapa (convenção visual dos vídeos: setas amarelas → espalhamento; setas amarelas ← compactação); trilha do trator colorida por conformidade.

---

# 8. Sistema de Pontuação e KPIs

## 8.1 Estrutura da nota

Três índices (0–100) + nota global ponderada, espelhando os KPIs do Método 360º (livro pp. 137–147):

**A. Índice de Produtividade** (referência: produtividade teórica da Árvore de Perdas, pp. 54–60)
- Produtividade efetiva (t/h) ÷ produtividade teórica do cenário. Referências: D61, lixo solto 550 kg/m³, DMT 35 m → **196 t/h** teórica; Uphill ciclo 31 m → 221 t/h; Downhill 26 m → 263 t/h. Gap real típico de mercado: 44% (p. 402) — bom material de balanceamento de dificuldade.
- Penalidades: distância média de ciclo F&R acima do ideal ("a distância está na mão do operador", p. 145), movimentos improdutivos (tomada de distância, giros), ciclos extras por rebarba (TEC 3), > 6 passadas, quebra de batelada, tempo de batelada vs referência de 12 min, consumo virtual de diesel.

**B. Índice de Qualidade**
- Conformidade de camada (% de células ≤ 30 cm; células "ocas" penalizam forte), passadas na faixa ideal (mapa de calor final), rastro externo limpo (TEC 3), crista 100% batida e retilínea (TEC 5), paralelismo das 4 linhas, cota do platô (barrigas/depressões — *"controlar cota e acabamento antes de liberar a cobertura"*, vídeo TEC 5), praça limpa ao fim da batelada (sem rebarbas remanescentes, sem lixo na área de transporte).

**C. Índice de Segurança**
- Violações de perímetro de segurança e DMS, velocidade/marcha errada por atividade, curvas em carga, operação fora das linhas, proximidade de pedestres/drenos.

## 8.2 Telemetria contínua (o "FDE digital")

O livro exige que o operador registre sua produção na **FDE — Ficha Diária do Equipamento** (p. 121–123) — deliberadamente, para ativar mentalidade de controle. O simulador gera a FDE automaticamente ao fim da sessão (tempo por atividade, bateladas, distâncias médias, ocorrências) e a apresenta como **prancheta digital** — mesmo artefato usado no campo, reforçando a transferência de aprendizado.

## 8.3 Densidade como placar de longo prazo

No modo campanha, a **densidade alcançada (t/m³)** do módulo é o placar acumulado (0,55 solto → alvo ~0,9–1,0 com trator). Exibir o equivalente em "meses de vida útil de aterro economizados" (case do livro: 1,27 t/m³ → 3,49 meses/ano) para dar significado gerencial ao capricho do operador.

---

# 9. Modos de Jogo e Progressão

## 9.1 Onboarding / Tutorial ("linhas fantasmas")

- Cada TEC introduzida isoladamente com: vídeo/painel da técnica (os infográficos reais do livro podem ser incorporados como "slides plastificados" — mesmos usados no campo para a LPP), demonstração fantasma (trator translúcido executando o movimento ideal), execução guiada (guias projetadas no chão: divisão 2/3|1/3 na lâmina, trilha de rastro, alvo de encaixe, faixa de altura da lâmina com texto "Abaixe a lâmina para 0 agora").
- Progressão dentro do tutorial: guias completas → só alertas → sem guias (modo avaliação).

## 9.2 Academia TEC (drills por técnica)

Missões curtas e repetíveis, uma por TEC, com nota A–E e ranking. Ex.: "TEC 3 — espalhe esta batelada de 5 pilhas deixando o rastro externo 100% limpo"; "TEC 5 — bata 40 m de crista com 100% de cobertura de pêndulo".

## 9.3 Campanha "Batelada Completa" (modo principal)

Turnos completos no módulo: perfil horário de caminhões, bateladas sucessivas, avanço da frente (linhas e placas se movem), remoção de cobertura entrando no ciclo (Uphill), relatório FDE ao fim de cada turno. Dificuldade crescente:

1. Uphill, dia, seco, 5 vagas, coletores apenas.
2. + Carretas (perímetros maiores, descarga em ângulo).
3. Downhill (+ módulo bipartido: cobertura simultânea na faixa vizinha).
4. Chuva (lama, tração reduzida).
5. Noite (faróis, torres, placas refletivas).
6. Cenários de crise: praça apertada no pico, descarga errada de NPC para corrigir/alertar, pedestre na frente (DMS).

## 9.4 Modo "Papo de Especialista" (avaliação teórica gamificada)

Réplica interativa do vídeo 91 e da dinâmica da p. 160 do livro (*"Forme grupos, observe as técnicas aplicadas e avalie"*): o jogador assiste replays 3D de operações (corretas e erradas — biblioteca da Seção 10) e marca erros na cena, com timer. Pontua identificação correta (pilhas fora de linha, ataque pelo meio, distância tomada, camada grossa, patinação, crista não batida...). Serve como prova teórica do certificado.

## 9.5 Modo Apontador/Encarregado (opcional, multiplayer local ou single)

O jogador coordena a praça: direciona caminhões às vagas respeitando perímetros, controla fila (2+3), sinaliza batelada completa ao trator (IA), reposiciona placas com o avanço. Cobre o papel do Apontador — o material insiste que as TECs são responsabilidade de **toda a equipe**.

## 9.6 Módulo Solo/Cobertura e RCD (expansão)

- **Cobertura:** as mesmas TECs valem para solo (vídeo TEC 2; livro pp. 163–182). Missões de cobertura: 1ª camada ~30 cm, avanço em quadrantes, acabamento em linha reta, barreira de solo na linha final, proteção de drenos, controle de espessura por 3–5 pontos de cavadeira por quadrante (minigame de verificação). Erro clássico a punir: pilhas de solo sobrepostas → > 2 m de solo sobre o lixo.
- **RCD:** necessariamente Downhill, camadas ~60 cm, menos passadas (p. 178).

---

# 10. Cenários de Erro (Biblioteca de Situações)

Extraídos do vídeo 91 (operações reais avaliadas pelo especialista) — usados no Modo Papo de Especialista e como estados de falha detectáveis na campanha:

| ID | Cenário | O que reproduzir | Sinais mensuráveis p/ o motor de avaliação |
|---|---|---|---|
| E1 | **Pilhas fora de linha** | Pilhas desalinhadas e distantes da frente; leira de lixo exposta sem recobrimento; trator "buscando" material | Distância pilha→frente acima do padrão; rastros longos e cruzados; vãos entre pilhas; lixo exposto além da amplitude tolerada |
| E2 | **Ataque pelo meio** | Trincheira aberta no centro da pilha; rebarbas dos dois lados | Rebarba bilateral; ciclos extras (3 em vez de 2); centro de ataque no terço médio da pilha |
| E3 | **Rampa solta / patinação** | Subida em rampa não compactada; giros na crista; superfície com torrões | Slip ratio alto; sulcos profundos; giros com lâmina erguida; rugosidade final da superfície |
| E4 | **Descida no talude de lixo (bico afundando)** | Trator de nariz para baixo na face do talude exposto, sem crista definida, camada espessa, esteiras semi-enterradas | Pitch negativo excessivo em massa solta; espessura >> 60 cm; ausência de linha de crista conformada |
| E5 | **"Lixão" / equipamento sem método** | Compactadores/dozers sobre massa solta sem célula, zero cobertura, taludes irregulares altíssimos | Nenhuma linha demarcada; lixo exposto ilimitado; trabalho sem sentido definido — cenário só de avaliação (não jogável) |
| C1 | **Referência correta** | Encaixe sem tomar distância, pilhas em linha junto à frente, passadas paralelas, praça nivelada, camada fina | Contraexemplo positivo para comparação lado a lado |

---

# 11. Interface do Usuário (HUD/UI)

Estilo: instrumentação técnica limpa (glassmorphism escuro translúcido), com a identidade da marca (Seção 13.1). Sem poluição — o terreno é o principal display.

- **Painel de missão (topo):** TEC/fase atual — ex. *"Missão: TEC 3 — Ataque à Pilha"* — + objetivo em uma linha.
- **Minimapa tático (topo direito):** vista superior do módulo com as 4 linhas (verde = conforme; vermelho = paralelismo perdido), vagas numeradas, arcos de perímetro de segurança ativos, setas de sentido de trabalho, mapa de calor de passadas (toggle).
- **Cluster de instrumentos (base):**
  - Tacômetro/velocímetro + **indicador de marcha (1ª/2ª)** com validação por atividade (ícone pisca se marcha errada para a fase).
  - **Indicador de altura da lâmina** com marcações 0 / 10 / 20–30 cm e faixa-alvo da fase atual.
  - **Indicador de engajamento da lâmina (TEC 3):** barra horizontal representando a largura da lâmina, mostrando a fração engajada na pilha, com marca-alvo em 2/3; excedente pisca (vai gerar rebarba bilateral) — *nota: fração lateral de engajamento, não volume* (correção ao GDD, Seção 17).
  - **Contador de batelada:** "Pilhas 3/5".
- **Contador de passadas in-world:** número discreto flutuando sobre o trecho trabalhado (vermelho 1–2, amarelo 3, verde 4–6, roxo >6).
- **Prancheta digital (fim de batelada/turno):** FDE + três índices + replay de erros com carimbo de tempo.
- **Rádio (canto):** mensagens do apontador/encarregado (texto + voz): "batelada completa", "carreta entrando na vaga 4", alertas.

---

# 12. Controles (Inputs)

- **Modo padrão (teclado/mouse):** W/S esteira esquerda-frente/ré + setas ou equivalente para esteira direita (ou W,A,S,D com A/D girando por diferencial); mouse/scroll para lâmina (subir/descer; Q/E inclinação lateral); Shift alterna 1ª/2ª marcha; espaço = freio; H = buzina; F = farol.
- **Modo realista (gamepad twin-stick):** analógico esquerdo = esteira esquerda, direito = esteira direita (padrão de manche real de D61/CAT); gatilhos = lâmina sobe/desce; bumpers = inclinação; D-pad = marcha. Plug-and-play Xbox/PlayStation.
- **Acessibilidade:** modo simplificado com direção assistida (uma alavanca dirige, jogo gerencia diferencial) para as primeiras horas; remapeamento completo; legendas nas falas do rádio.
- Suporte futuro a cadeira/joysticks industriais (treinamento imersivo) — arquitetura de input abstraída.

---

# 13. Direção de Arte e Ambientação

## 13.1 Identidade visual da marca (obrigatória na UI e cenário)

Consistente em todos os 8 vídeos:
- **Paleta:** amarelo-ouro (~#F0B429 / amarelo CAT), preto, cinza-grafite, branco; acentos laranja (logo TEC'S, fita refletiva, etiquetas de linha) e vermelho (anotações de erro/didáticas).
- **Marcas:** elefante amarelo "Inteligência em Pesados" (vinheta em solo craquelado); pata de elefante laranja "TEC'S — Técnicas de Espalhamento e Compactação"; selo "Método Aterros Sanitários 360º"; selo "Dica Pé no Barro" (para dicas práticas no jogo); referência ao livro *Colocando Gestão no Lixo* (Newton Pimenta).
- **Convenções visuais dos materiais (usar no jogo):** etiquetas laranja para nomes de linhas; setas amarelas = sentido de deslocamento (→ espalhar, ← compactar); setas lilás = pontos de descarga; linha branca = linha de descarga; anotações vermelhas = erro/destaque didático.

## 13.2 Cenário

- **Skybox/fundo:** aterro real — paredões de terra escavada (argila vermelha com tela no topo; jazida "canyon" de areia estratificada), células antigas cobertas com vegetação rasteira, morros com mata (variação regional: cerrado/caatinga e mata atlântica, conforme fotos). Céu dinâmico (cumulus densos), sol a pino com sombras duras; noite com torres de iluminação.
- **Terreno da praça:** solo argiloso batido (variações: terra marrom, argila vermelha-alaranjada, areia bege) com marcas de esteira persistentes; chorume escuro em áreas de lixo antigo.
- **Resíduo:** caótico e colorido (sacolas, papelão, madeira, orgânico); após compactação, maciço escuro consolidado; leiras de solo para cobertura em cordões alinhados.
- **Props:** placas de módulo (spec 3.4), placas de vaga verdes numeradas, cones, piquetes/balizas, tambores, bandeiras/marcos vermelhos na crista, drenos de gás (tubo + gabião), manta GeoCover branca em taludes 1:1, torre de iluminação, contêiner/caçamba estacionária (obstáculo de cenário de erro E4).
- **Fauna:** urubus/garças circulando e pousados (denso perto de lixo exposto — inclusive feedback indireto: muita ave = muita frente exposta).

---

# 14. Design de Áudio

- **Motor diesel:** pitch/volume atrelados à carga; ao atacar pilha grande, RPM cai e o som engrossa (torque); fumaça sincronizada.
- **Hidráulica:** chiado fino a cada movimento de lâmina.
- **Esteiras:** rangido metálico das sapatas sobre entulho/terra; som distinto em lama (chuva).
- **Alarme de ré** ("bip-bip-bip") obrigatório; buzina.
- **Ambiente:** urubus, vento, caminhões basculando ao longe, rádio com chiado.
- **Feedback de sistema:** clique metálico satisfatório em acertos (encaixe perfeito, pêndulo executado); buzina grave/alerta em erro crítico (curva em carga, perímetro violado).
- **Narração:** as instruções do tutorial podem usar o tom do instrutor dos vídeos (voz masculina didática, analogias: supermercado, baliza, cortar grama, salto agulha, passo de dança) — analogias fazem parte do método e devem estar no roteiro de voz.

---

# 15. Analytics, Relatórios e Integração LMS

- **Relatório por sessão (prancheta/FDE digital):** índices A/B/C, nota global, tempo por atividade, distância média de ciclo, camada média, histograma de passadas, mapa final do módulo (heatmap), lista de eventos (erros com timestamp e clipe de replay).
- **Trilha de certificação:** aprovação = nota mínima por TEC (drills) + campanha nível N + prova "Papo de Especialista". Reciclagem periódica (o livro prevê reciclagem na Matriz de Treinamentos, p. 339–340).
- **Exportação:** SCORM/xAPI (LMS corporativo) + JSON via API REST para RH; campos alinhados ao CHA (Conhecimentos-Habilidades-Atitudes, p. 331–335): teoria (quiz), prática (índices), atitude (segurança/organização).
- **Gatilhos de coaching:** resultados fora da meta geram recomendação automática de drill específico (espelha os gatilhos de investigação do livro, p. 341 — ex.: consumo anormal de diesel → revisar TECs 3/6/7).

---

# 16. Tabela Mestra de Parâmetros (com fontes)

| # | Parâmetro | Valor para a engine | Fonte e observações |
|---|---|---|---|
| 1 | Fração da lâmina no ataque | **2/3 engajada, 1/3 livre** (lado externo, oposto ao sentido de trabalho) | Livro p. 155/159; infográfico "2/3 \| 1/3"; vídeo TEC 3 |
| 2 | Espessura da camada de espalhamento | **Alvo ≤ 30 cm** (lâmina elevada 20/30 cm); tolerância até 60 cm; > 60 cm = fundo "oco" | Texto do livro pp. 94/96/159 ("aprox. 30 cm", "Ideal até 30 cm"); painel-resumo "20/30cm"; vídeo TEC 7 "espessura ótima 30–60 cm" — ver Seção 17 |
| 3 | Número de passadas | **Alvo 3–4**; faixa verde 3–6; < 3 frouxo; > 6 desperdício | Livro p. 158–159 ("ideal 3 a 4"; painel p. 156 "2 a 4 por camada", "4 passes por camada"); vídeo TEC 7 "zona ótima 4 a 6 passes" — ver Seção 17 |
| 4 | Zona de alta pressão | **30–60 cm** sob a esteira; abaixo = baixa pressão (irrecuperável) | Vídeo TEC 7 (cota no diagrama). Livro traz o esquema **sem** cota (pp. 46, 158) |
| 5 | Lâmina por atividade | Transporte **0**; espalhamento **20/30 cm**; compactação **10 cm** (regularização) | Quadro-resumo vídeo 90 = painel livro p. 159 |
| 6 | Marchas | **1ª ida (carregado), 2ª volta; compactação: 2ª ida e volta**; velocidade fixa por marcha | Livro pp. 57, 159; vídeo 90 |
| 7 | Rastro/cobertura de passadas | Ciclo F&R = 4 larguras de esteira; offset lateral **1/2 esteira**; passada completa a cada **3,6 m** | Livro p. 156; esteira 0,6 m (painel TEC 4) |
| 8 | Pêndulo da crista | ~**1/2 esteira em balanço** sobre a quina; peso concentra na linha da crista; exige crista acentuada + lâmina vazia | Vídeo TEC 5 (diagrama); livro p. 157 |
| 9 | Rampa | Uphill **1:4** (~21 m p/ 5 m; diagrama 20 m×5 m); Downhill **1:3** (~16 m) | Livro pp. 94/96/116; vídeo 00 |
| 10 | Abertura p/ batimento no platô | **5 m** em toda a frente; cobertura nunca até a crista | Livro pp. 94, 110 |
| 11 | Vagas × posições simultâneas | Ex.: 6 vagas → **2–3 posições**; perímetro carreta > compactador; ordem de preenchimento **aleatória** | Livro pp. 111, 153; vídeo TEC 1 (sem distâncias em metros nas fontes — calibrar por comprimento do caminhão, ex. raio ≈ 1,5× comprimento) |
| 12 | Fluxo na frente | 2 descarregando + máx. 3 em preparação; "saiu 1, entra 1" | Livro p. 62 |
| 13 | Batelada | Nº de pilhas = nº de vagas; trator só liga com batelada completa; ~**12 min**/batelada (referência) | Livro pp. 121, 152–153; vídeo TEC 1 |
| 14 | Densidades | Solto **0,55 t/m³**; trator bem operado ~**0,9–1,0**; compactador 1,27–1,3 (referência) | Livro pp. 57, 405, 411, 13 |
| 15 | Produtividade teórica | D61: **196 t/h** (DMT 35 m); Uphill 31 m → 221; Downhill 26 m → 263 (+~20%) | Livro pp. 57, 95–97 |
| 16 | Perdas de referência | Idle 10–15%; cobertura consome 6–10%; gap real típico 44% | Livro pp. 59–60, 402 |
| 17 | Trator | 20–24 t; sapatas 60 mm; esteira 0,6 m | Livro p. 52; painel TEC 4 |
| 18 | Placas de módulo | 3 tipos (≡, ⊥, T); 30×60 + 30×30 cm; fita laranja refletiva; 2 de cada; reposicionáveis | Livro pp. 118–119 |
| 19 | Módulo novo | Descarga a 10 m do futuro pé; dique de partida; "quebra-molas" inicial | Livro pp. 114–116 |
| 20 | Cobertura | 1ª camada ~30 cm; quadrantes; 3–5 pontos de controle/quadrante; taxa de recobrimento ~10% | Livro pp. 164, 175–177, 181 |
| 21 | RCD | Downhill obrigatório; camada ~60 cm; menos passadas | Livro p. 178 |
| 22 | Avanço | 4–5 m/dia típico (ex. 8 m/dia); exemplo 10.000 t/mês + 40 m largura → 50 m/mês | Livro pp. 94, 110, 164 |
| 23 | Atendimento | Ciclo de descarga completo; meta exemplo **21 min** | Livro pp. 137–141 |
| 24 | Perfil de entrada (spawner) | Gráfico horário real: seg. 11h = 2 bateladas; 13–18h = 1/h; noturno 22h+ = 7 | Livro pp. 153–154 |

---

# 17. Correções e Divergências em Relação ao GDD Preliminar

O GDD do Gemini (`GDD_Simulador_TECs_Final.md`) está estruturalmente bom (4 linhas, 7 TECs, arte/HUD/áudio), mas contém erros de parâmetro e omissões que esta especificação corrige:

1. **"Espessura da camada entre 30 e 60 cm" (GDD §TEC 4) — impreciso.** O texto do livro manda **~30 cm** ("Ideal até 30 cm", gráfico com seta em 30 cm). "30–60 cm" é (a) a cota da **zona de alta pressão** no diagrama do vídeo TEC 7 e (b) a "espessura ótima 30–60 cm" do slide do mesmo vídeo. **Decisão:** alvo pedagógico = 30 cm; faixa tolerada da engine = até 60 cm; acima de 60 cm = camada oca. Documentado na Tabela 16 (#2, #4).
2. **"4 a 6 passadas" (GDD §TEC 4) — divergência real entre fontes.** Livro: "ideal 3 a 4" (texto) / "2 a 4 por camada" (painel). Vídeo TEC 7: "zona ótima 4 a 6 passes". **Decisão:** alvo exibido 3–4; faixa verde 3–6; punição < 3 e > 6. (O GDD punia > 6 — mantido — mas reprovava < 4, o que contradiz o livro.)
3. **"Batelada = deixar vagas vazias entre caminhões até formar o lote" (GDD §TEC 1) — simplificação.** A regra real: preenchimento **aleatório** respeitando o **perímetro de segurança dinâmico** (só bloqueia vagas enquanto o vizinho bascula; perímetro varia por tipo de caminhão). Corrigido na TEC 1.
4. **"Indicador de Carga da Lâmina: passar de 66% pisca vermelho" (GDD §HUD) — conceito trocado.** Os 2/3 da TEC 3 são **fração lateral de engajamento da lâmina na pilha**, não percentual volumétrico de carga. O HUD correto mostra a largura engajada com alvo em 2/3 (Seção 11). Sobrecarga volumétrica é outro fenômeno (máquina força/sobe).
5. **"TEC 7: retorna compactando de ré" — precisão.** A compactação da batelada é feita em **2ª marcha ida e volta**, em linha reta, no sentido oposto ao preenchimento, com lâmina a 10 cm; dentro de cada ciclo F&R, a volta é em ré. O GDD omitia marchas e a lâmina de regularização.
6. **"Bandeirinha (NPC)" — nomenclatura.** O termo do livro é **Apontador** (p. 159); "bandeirinha" é apelido de campo citado no vídeo 90. UI usa Apontador.
7. **Omissões relevantes do GDD, agora cobertas:** geometria paramétrica da rampa (1:4 / 1:3, 20×5 m) e modos Uphill/Downhill; lâmina em zero no transporte; marchas por atividade; abertura de 5 m para batimento; regra "cobertura nunca até a crista"; placas de módulo com spec física; perfil horário de entrada (spawner); fluxo 2+3 na frente; KPIs reais (produtividade teórica, densidade, atendimento, Árvore de Perdas) e FDE; biblioteca de cenários de erro do vídeo 91; modo de avaliação teórica; cobertura/RCD; DMS/segurança de pedestres; identidade visual da marca.
8. **Confirmações (o GDD acertou):** as 4 linhas paralelas com punição por perda de paralelismo; rebarba unilateral e lateral limpa; pêndulo com ~1/2 esteira em balanço; punição de curvas em carga; contador de passadas colorido; clima/noite; twin-stick; exportação SCORM/xAPI.

---

# 18. Glossário

| Termo | Definição |
|---|---|
| **TEC** | Técnica de Espalhamento e Compactação (7 no total) |
| **Método 360º** | Módulo Operacional Padrão + TECs + KPIs |
| **Módulo Operacional Padrão** | Estrutura unitizada da praça de trabalho (nível do jogo) |
| **Batelada** | Lote de pilhas processado de uma vez; nº de pilhas = nº de vagas |
| **Ciclo F&R** | Ciclo Frente-e-Ré do trator; distância média é KPI precedente da produtividade |
| **Lâmina em zero** | Lâmina no nível do solo (transporte) |
| **Rebarba** | Material que transborda lateralmente da lâmina; deve cair só para o lado interno |
| **Uphill / Downhill** | Preenchimento subindo (1:4) / descendo (1:3) a rampa |
| **Pé / Crista de talude** | Base / quina superior da rampa (início/fim do preenchimento) |
| **Linha de Cobertura** | Limite do solo de cobertura no platô (nunca até a crista) |
| **Batimento (esmagamento) da crista** | Pêndulo do trator sobre a quina concentrando o peso |
| **Encaixe** | Reposicionamento tipo baliza na próxima pilha, sem tomar distância |
| **Sentido de trabalho** | Direção única de espalhamento (1→N) e retorno compactando (N→1) |
| **Apontador** | Profissional que coordena a praça de descarga ("bandeirinha") |
| **DMT** | Distância Média de Transporte |
| **DMS** | Distância Mínima de Segurança (pedestre × máquina) |
| **FDE** | Ficha Diária do Equipamento (relatório do operador) |
| **LPP** | Lição Por Ponto (funcionário ensina uma técnica à equipe) |
| **Airspace** | Volume útil do aterro; densidade alta = vida útil maior |

---

# 19. Recomendação de Escopo (MVP → Completo)

**MVP (validação com operadores):**
- Módulo Uphill fixo (5 vagas, dia, seco), trator único, física de camada/passadas/rebarba, TECs 3, 4, 5, 7 jogáveis com telemetria, HUD essencial (lâmina, marcha, passadas, minimapa), tutorial fantasma, relatório de 3 índices.

**v1.0:** TECs 1, 2 e 6 completas (NPCs de caminhão + apontador + bateladas), campanha 6 níveis, Downhill, prancheta FDE, exportação xAPI.

**v1.x:** chuva/noite, Modo Papo de Especialista, modo Apontador, cobertura/RCD, ranking corporativo, suporte a joystick industrial.

---

*Documento gerado a partir da leitura integral do livro (418 pp.), das 8 transcrições e da análise visual de ~1.255 frames dos vídeos de treinamento. Toda regra numérica é rastreável às fontes na Tabela 16; divergências entre fontes estão explicitadas na Seção 17.*
