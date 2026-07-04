# Simulador de TECs

Jogo/simulador web (Vite + JavaScript puro) das **TECs — Técnicas de Espalhamento e
Compactação** do Método de Gestão de Aterros Sanitários 360º: o jogador opera um
trator de esteira num Módulo Operacional Padrão e é avaliado pela aderência às 7
técnicas (KPIs de Produtividade, Qualidade e Segurança na FDE ao fim do turno).

## Documentação

A documentação completa está em [`docs/`](docs/01-visao-geral.md):

1. [Visão geral](docs/01-visao-geral.md) — o que é, como rodar, fluxo de jogo
2. [Arquitetura](docs/02-arquitetura.md) — módulos, loop, terreno, autopilot, áudio
3. [Mecânicas e TECs](docs/03-mecanicas-e-tecs.md) — regras, física, coach, KPIs
4. [Parâmetros](docs/04-parametros.md) — tabela comentada de `src/config/params.js`
5. [Revisão de código](docs/05-revisao-de-codigo.md) — achados, pendências e pontos fortes

## Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção (dist/)
npm run preview  # pré-visualiza o build
```

## Estrutura

```
index.html                  Entrada da aplicação (carrega src/main.js)
style.css                   Estilos globais
src/
  main.js                   Bootstrap do jogo
  engine/                   Loop, input, áudio, autopilot
  entities/                 Trator, caminhão
  world/                    Grade de terreno
  ui/                       HUD, modal de quiz
  config/                   Parâmetros do simulador
public/                     Estáticos (favicon)
fonte-de-verdade-tecs/      Material-fonte (spec, transcrições, vídeos e frames)
tools/
  scripts/                  Scripts de teste/validação (Puppeteer)
  artifacts/                Screenshots/outputs gerados (ignorado no git)
```

A especificação completa está em
[`fonte-de-verdade-tecs/Especificacao_Simulador_TECs.md`](fonte-de-verdade-tecs/Especificacao_Simulador_TECs.md).
