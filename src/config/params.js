// FONTE ÚNICA DE PARÂMETROS DO JOGO
// Toda regra numérica (cores do heatmap, notas, física, segurança) sai daqui.
// Faixas de compactação alinhadas à Especificação: alvo 3–4 passadas, faixa verde 3–6.

export const COMPACTION = {
  LOOSE_MAX: 0.5,   // abaixo disso = lixo solto (vermelho)
  IDEAL_MIN: 3,     // início da faixa verde
  IDEAL_MAX: 6,     // fim da faixa verde
  OVER_MAX: 8,      // acima de IDEAL_MAX até aqui = lilás; além = preto
};

// Espessura da camada ATUAL (Espec. §5.3: ideal ≤ 30 cm, tolerância até 60;
// acima disso a zona de baixa pressão nunca compacta — célula "oca")
export const LAYER = {
  MAX_OK: 0.35,     // m — camada conforme (30 cm + tolerância de leitura)
  OCA_MIN: 0.6,     // m — acima disso = oca/baixa pressão (irrecuperável)
};

export const HEATMAP_COLORS = {
  BASE: '#3d2e1f',      // solo sem lixo
  LOOSE: '#ff3b30',     // vermelho — lixo solto
  WORKING: '#ff9500',   // laranja — ganhando densidade
  IDEAL: '#34c759',     // verde — faixa ideal (3–6 passadas)
  OVER: '#af52de',      // lilás — passando do ponto
  WASTE: '#111111',     // preto — super compactado
  FINISHED: '#1d6f42',  // verde escuro — camada finalizada (enterrada sob nova camada)
  OCA: '#7a1f1f',       // vinho — camada > 60 cm (oca, baixa pressão)
};

export const BLADE = {
  CAPACITY: 5,          // m³ máximos acumulados na lâmina
  PICKUP_RATE: 6.0,     // m³/s coletados com lâmina a 0 cm
  SPILL_RATE: 1.5,      // m³/s que vazam pelos lados com a lâmina cheia;
                        // o resto fica para trás como cordão na própria faixa
  SPREAD_RATE: 6.0,     // m³/s máximos soltos ao espalhar
  SMOOTH_RATE: 2.0,     // fator/s de alisamento com lâmina a 10 cm
  TRANSPORT: 0,         // cm — transportar/coletar
  REGULARIZE: 10,       // cm — regularizar
  SPREAD_MIN: 20,       // cm — a partir daqui espalha; camada deixada = altura/100 (m)
};

export const SAFETY = {
  VIOLATION_COOLDOWN: 5.0,    // s entre registros da mesma violação
  PENALTY_PER_VIOLATION: 20,  // % descontados da nota de segurança
  TURN_GRACE: 1.0,            // s de esterço contínuo em carga antes de violar
                              // (microcorreções de rumo são operação normal)
};

// Tipos de caminhão (TEC 1): o perímetro da carreta basculante é MAIOR que o
// do coletor compactador (risco de tombamento com caçamba erguida).
// Volumes em escala real: uma pilha exige VÁRIAS viagens da lâmina (5 m³) —
// é isso que dá sentido ao ataque 2/3|1/3, à rebarba e ao encaixe (baliza).
export const TRUCKS = {
  COLETOR: {
    length: 60, width: 28,
    dangerRadius: 70,
    pile: { w: 4, d: 3, h: 0.85 },  // ~10 m³ (carga real de um coletor) ≈ 2 viagens
  },
  CARRETA: {
    length: 95, width: 32,
    dangerRadius: 120,
    pile: { w: 6, d: 3, h: 1.1 },   // ~20 m³, pilha LONGA e LARGA ≈ 4 viagens,
                                    // 3 ataques de borda (2/3|1/3) por pilha
  },
};

// Consumo virtual de diesel (a fonte insiste: técnica errada = diesel queimado)
export const DIESEL = {
  IDLE: 0.002,      // L/s parado com motor ligado
  SPEED: 0.004,     // L/s adicionais a velocidade máxima
  LOADED: 0.003,    // L/s adicionais com a lâmina carregada
  OVERLOAD: 0.008,  // L/s adicionais transbordando (pegou mais do que pode)
  REF: 8,           // L — referência de um turno bem operado
};

export const SHIFT = {
  // Meta calibrada por simulação com os volumes reais: operação-modelo ≈ 980 s
  // (na linha da referência de ~12 min de batelada da Especificação).
  // Produtividade = 100 × meta/tempo (cap 100) — degrada suave, não punitiva.
  EXPECTED_TIME: 960,   // s — meta de tempo do turno do jogador
  MAX_BATCH: 5,         // caminhões por batelada completa
};

// TEC 6 (Encaixe/baliza): tomada de distância = ré longa com lâmina vazia na
// praça antes de atacar a pilha — movimento improdutivo (vídeo 91)
export const TEC6 = {
  REVERSE_RUN_MAX: 180,       // px (~9 m) de ré comandada contínua vazia na praça
  PENALTY_PER_MOVE: 5,        // % descontados da produtividade por ocorrência
};

// Pesos da nota de qualidade
export const QUALITY = {
  OVER_WEIGHT: 2,             // desconto por célula super compactada
  OCA_WEIGHT: 4,              // desconto por célula oca (camada > 60 cm)
  VIOLATION_WEIGHT: 5,        // desconto por violação didática (TEC 3/4/7)
  CREST_SHARE: 0.2,           // fatia da nota que vem da crista 100% batida (TEC 5)
};

// Classifica passadas na faixa didática (usada por cor, coach e nota — sempre juntas)
export function classifyPasses(p) {
  if (p < COMPACTION.LOOSE_MAX) return 'LOOSE';
  if (p < COMPACTION.IDEAL_MIN) return 'WORKING';
  if (p <= COMPACTION.IDEAL_MAX) return 'IDEAL';
  if (p <= COMPACTION.OVER_MAX) return 'OVER';
  return 'WASTE';
}
