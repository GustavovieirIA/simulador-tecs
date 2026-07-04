# 1. Visão Geral

## O que é o jogo

**Simulador de TECs** é um jogo/simulador web 2D (vista de cima) de treinamento de
operadores de trator de esteira em aterros sanitários. Ele implementa, em forma de MVP
jogável, as **7 TECs (Técnicas de Espalhamento e Compactação)** do Método de Gestão de
Aterros Sanitários 360º, conforme a especificação em
[`fonte-de-verdade-tecs/Especificacao_Simulador_TECs.md`](../fonte-de-verdade-tecs/Especificacao_Simulador_TECs.md).

O jogador opera o trator num **Módulo Operacional Padrão** (modo Uphill): caminhões
descarregam pilhas de lixo na praça, e o ciclo correto é atacar a pilha (TEC 3),
transportar com a lâmina no chão, espalhar em camada fina na rampa (TEC 4), bater a
crista com o pêndulo (TEC 5), voltar de ré com ½ esteira de deslocamento ("passo de
dança") e compactar até a faixa verde de 3–6 passadas (TEC 7). Ao final, um quiz de
fechamento e a **FDE (Ficha Diária do Equipamento)** com KPIs de Produtividade,
Qualidade e Segurança e conceito A–E.

## Stack técnica

| Item | Escolha |
|---|---|
| Build/dev server | Vite 8 (`npm run dev` / `build` / `preview`) |
| Linguagem | JavaScript puro (ES modules), sem framework |
| Render | Canvas 2D (mundo) + DOM/CSS (HUD e modais) |
| Áudio | WebAudio 100% sintetizado (zero assets de som) |
| Testes | Scripts Puppeteer em `tools/scripts/` (playtests automatizados) |
| Dependências de runtime | **Nenhuma** — `puppeteer` e `jsdom` são só de teste |

## Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento (Vite)
npm run build    # build de produção em dist/
npm run preview  # pré-visualiza o build
```

Para depuração no console do navegador, a instância do jogo fica exposta em
`window.game` (definido em [main.js](../src/main.js)).

## Fluxo de jogo (alto nível)

1. **Turno do jogador** — o jogo abre direto no comando do jogador. Chega uma
   batelada de **5 caminhões** (coletores e carretas alternados) que descarregam nas
   vagas 1–5. O jogador executa o ciclo TEC pilha a pilha. Um "coach" (mensagens de
   rádio + alertas) corrige erros didáticos em tempo real.
2. **Fechamento** — `Enter` (ou o botão "Finalizar Turno") encerra: primeiro um **quiz
   de 4 perguntas** (uma por TEC-chave do ciclo), depois a **FDE** com KPIs, conceito
   A–E, dica acionável e o snapshot do heatmap final. "Novo Turno" recarrega a página.

## Estrutura do repositório

```
index.html                  Entrada da aplicação (canvas + HUD + modais)
style.css                   Estilos globais (glassmorphism, painéis, modais)
src/
  main.js                   Bootstrap: monta Game, terreno, trator, áudio e botões
  config/params.js          FONTE ÚNICA de parâmetros numéricos do jogo
  engine/
    Game.js                 Loop, estado, câmera, partículas, coach, KPIs, quiz
    Input.js                Teclado (isDown / isJustPressed)
    AudioEngine.js          Motor de áudio sintetizado (WebAudio)
  entities/
    Tractor.js              Física do trator, lâmina, compactação, render vetorial
    Truck.js                NPCs de descarga (coletor/carreta), perímetro de segurança
  world/
    TerrainGrid.js          Grade 40×60 de células, heatmap, caches de render
  ui/
    HUD.js                  Instrumentos, minimapa, rádio, toast, relatório FDE
    QuizModal.js            Modal de quiz (embaralha opções, encadeia perguntas)
public/                     Estáticos servidos como estão (favicon.svg)
fonte-de-verdade-tecs/      Material-fonte: especificação, transcrições, vídeos, frames
tools/
  scripts/                  Playtests/diagnóstico com Puppeteer
  artifacts/                Screenshots/saídas geradas (ignorado no git)
docs/                       Esta documentação
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [02-arquitetura.md](02-arquitetura.md) | Módulos, loop, câmera, render, áudio — como o código funciona |
| [03-mecanicas-e-tecs.md](03-mecanicas-e-tecs.md) | Regras de jogo, física da lâmina, compactação, as 7 TECs no código, coach e KPIs |
| [04-parametros.md](04-parametros.md) | Tabela comentada de todos os parâmetros de `params.js` |
| [05-revisao-de-codigo.md](05-revisao-de-codigo.md) | Achados da revisão de código (bugs, pendências e pontos fortes) |
