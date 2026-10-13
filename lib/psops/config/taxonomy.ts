/**
 * Taxonomia do Pre-Sales Ops: enums espelhados do Prisma, matriz de elegibilidade,
 * pesos de score e mapeamentos produto → módulo.
 *
 * Os enums são declarados como const objects (e não importados do
 * @prisma/client) para que parser, classificador e testes rodem sem banco.
 * Os valores são idênticos aos do schema — se mudar um, mude o outro.
 */

export const Produto = {
  SUPPORT: 'SUPPORT',
  MESSAGING: 'MESSAGING',
  CONTACT_CENTER: 'CONTACT_CENTER',
  KNOWLEDGE: 'KNOWLEDGE',
  AI_AGENTS: 'AI_AGENTS',
  COPILOT: 'COPILOT',
  ANALYTICS: 'ANALYTICS',
  WFM: 'WFM',
  QA: 'QA',
  ADMIN_SEGURANCA: 'ADMIN_SEGURANCA',
  DEVELOPER_API: 'DEVELOPER_API',
  MARKETPLACE: 'MARKETPLACE',
  OUTRO: 'OUTRO',
} as const;
export type Produto = (typeof Produto)[keyof typeof Produto];

export const Modulo = {
  SUPPORT: 'SUPPORT',
  VOICE: 'VOICE',
  KNOWLEDGE: 'KNOWLEDGE',
  COPILOT: 'COPILOT',
  AI_AGENTS: 'AI_AGENTS',
  ANALYTICS: 'ANALYTICS',
  WFM: 'WFM',
  QA: 'QA',
  INTEGRACOES: 'INTEGRACOES',
  OUTRO: 'OUTRO',
} as const;
export type Modulo = (typeof Modulo)[keyof typeof Modulo];

export const SignalTipo = {
  GA: 'GA',
  EAP_BETA: 'EAP_BETA',
  DEPRECATION: 'DEPRECATION',
  BREAKING_CHANGE: 'BREAKING_CHANGE',
  PRICING_PACKAGING: 'PRICING_PACKAGING',
  UX_INTERFACE: 'UX_INTERFACE',
  FIX_MINOR: 'FIX_MINOR',
} as const;
export type SignalTipo = (typeof SignalTipo)[keyof typeof SignalTipo];

export const Impacto = {
  ESTUDO: 'ESTUDO',
  DEMO: 'DEMO',
  ESTIM: 'ESTIM',
  ESCOPO: 'ESCOPO',
} as const;
export type Impacto = (typeof Impacto)[keyof typeof Impacto];

export const IMPACTOS_ORDEM: Impacto[] = ['ESTUDO', 'DEMO', 'ESTIM', 'ESCOPO'];

export const IMPACTO_LABEL: Record<Impacto, { curto: string; pergunta: string }> = {
  ESTUDO: {
    curto: 'Ficha da feature',
    pergunta: 'Alguém do time precisa entender isso a fundo?',
  },
  DEMO: {
    curto: 'Template de demonstração',
    pergunta: 'Precisamos conseguir mostrar isso ao vivo?',
  },
  ESTIM: {
    curto: 'Framework de estimativa',
    pergunta: 'Isso muda quanto custa implantar?',
  },
  ESCOPO: {
    curto: 'Bloco de escopo técnico',
    pergunta: 'Isso muda o que prometemos no escopo?',
  },
};

// ───────────────────────── Matriz de elegibilidade ──────────────────────────

/**
 * `SEMPRE` pré-marca a caixa na triagem. `AVALIAR` não pré-marca, mas destaca
 * como candidato. `NAO` não sugere nada.
 *
 * Isto é o default do sistema — a decisão continua sendo humana. O triador
 * confirma ou corrige, e a correção fica registrada em PsOpsTriage.
 */
export const Sugestao = { SEMPRE: 'SEMPRE', AVALIAR: 'AVALIAR', NAO: 'NAO' } as const;
export type Sugestao = (typeof Sugestao)[keyof typeof Sugestao];

type Linha = Record<Impacto, Sugestao>;
const linha = (estudo: Sugestao, demo: Sugestao, estim: Sugestao, escopo: Sugestao): Linha => ({
  ESTUDO: estudo,
  DEMO: demo,
  ESTIM: estim,
  ESCOPO: escopo,
});

const { SEMPRE, AVALIAR, NAO } = Sugestao;

/**
 * Chave da matriz: o tipo do sinal, com duas variações de GA conforme exija
 * ou não configuração no admin. `requerDev` promove ESTIM/ESCOPO.
 */
export const MATRIZ: Record<string, Linha> = {
  // Nova capacidade contratável, com configuração dedicada
  'GA:config':      linha(SEMPRE, SEMPRE,  SEMPRE, SEMPRE),
  // Chega ligada, sem configuração — só muda o que se vê na tela
  'GA:sem-config':  linha(AVALIAR, SEMPRE, NAO,    NAO),
  EAP_BETA:         linha(SEMPRE, AVALIAR, NAO,    AVALIAR),
  DEPRECATION:      linha(SEMPRE, SEMPRE,  SEMPRE, SEMPRE),
  BREAKING_CHANGE:  linha(SEMPRE, SEMPRE,  SEMPRE, SEMPRE),
  PRICING_PACKAGING:linha(AVALIAR, NAO,    SEMPRE, SEMPRE),
  UX_INTERFACE:     linha(NAO,    SEMPRE,  NAO,    NAO),
  FIX_MINOR:        linha(NAO,    NAO,     NAO,    NAO),
};

export function chaveMatriz(tipo: SignalTipo, requerConfiguracao: boolean): string {
  if (tipo === SignalTipo.GA) return requerConfiguracao ? 'GA:config' : 'GA:sem-config';
  return tipo;
}

export function sugestoesPara(
  tipo: SignalTipo,
  opts: { requerConfiguracao: boolean; requerDev: boolean },
): { sugeridos: Impacto[]; avaliar: Impacto[] } {
  const base = MATRIZ[chaveMatriz(tipo, opts.requerConfiguracao)] ?? MATRIZ.FIX_MINOR!;
  const linhaFinal: Linha = { ...base };

  // Nova API / webhook / objeto de dados sobe estimativa e escopo para SEMPRE:
  // muda o que é implementável e o que prometemos, mesmo sem tela nova.
  if (opts.requerDev && tipo !== SignalTipo.FIX_MINOR) {
    linhaFinal.ESTIM = SEMPRE;
    linhaFinal.ESCOPO = SEMPRE;
    if (linhaFinal.ESTUDO === NAO) linhaFinal.ESTUDO = AVALIAR;
  }

  const sugeridos = IMPACTOS_ORDEM.filter((i) => linhaFinal[i] === SEMPRE);
  const avaliar = IMPACTOS_ORDEM.filter((i) => linhaFinal[i] === AVALIAR);
  return { sugeridos, avaliar };
}

// ───────────────────────────── Score de leitura ─────────────────────────────

const PESO_TIPO: Record<SignalTipo, number> = {
  DEPRECATION: 52,
  BREAKING_CHANGE: 52,
  PRICING_PACKAGING: 46,
  GA: 42,
  EAP_BETA: 34,
  UX_INTERFACE: 16,
  FIX_MINOR: 4,
};

/** Produtos centrais do portfólio pesam mais na ordenação da fila. */
const PESO_PRODUTO: Partial<Record<Produto, number>> = {
  CONTACT_CENTER: 16,
  AI_AGENTS: 16,
  COPILOT: 14,
  SUPPORT: 12,
  KNOWLEDGE: 12,
  DEVELOPER_API: 12,
  MESSAGING: 10,
  ANALYTICS: 8,
  ADMIN_SEGURANCA: 6,
  WFM: 6,
  QA: 6,
  MARKETPLACE: 2,
  OUTRO: 0,
};

export interface ScoreInput {
  tipo: SignalTipo;
  produto: Produto;
  requerConfiguracao: boolean;
  requerDev: boolean;
  afetaPreco: boolean;
  temDataLimite: boolean;
}

/**
 * 0–100. Serve só para ordenar a fila de leitura — nunca para decidir.
 * Determinístico de propósito: o mesmo sinal recebe sempre o mesmo score,
 * o que torna a fila estável entre execuções e o resultado testável.
 */
export function calcularScore(i: ScoreInput): number {
  let s = PESO_TIPO[i.tipo] + (PESO_PRODUTO[i.produto] ?? 0);
  if (i.requerConfiguracao) s += 10;
  if (i.requerDev) s += 8;
  if (i.afetaPreco) s += 10;
  if (i.temDataLimite) s += 12;
  return Math.max(0, Math.min(100, s));
}

// ─────────────────── Mapeamentos produto ↔ módulo ───────────────────────────

/**
 * Cada produto Zendesk cai numa frente do nosso catálogo. É esse mapeamento
 * que decide qual artefato a atividade vai tocar.
 */
export const PRODUTO_PARA_MODULO: Record<Produto, Modulo> = {
  SUPPORT: Modulo.SUPPORT,
  MESSAGING: Modulo.SUPPORT,
  CONTACT_CENTER: Modulo.VOICE,
  KNOWLEDGE: Modulo.KNOWLEDGE,
  AI_AGENTS: Modulo.AI_AGENTS,
  COPILOT: Modulo.COPILOT,
  ANALYTICS: Modulo.ANALYTICS,
  WFM: Modulo.WFM,
  QA: Modulo.QA,
  ADMIN_SEGURANCA: Modulo.SUPPORT,
  DEVELOPER_API: Modulo.INTEGRACOES,
  MARKETPLACE: Modulo.INTEGRACOES,
  OUTRO: Modulo.OUTRO,
};

export const MODULO_LABEL: Record<Modulo, string> = {
  SUPPORT: 'Support',
  VOICE: 'Voice',
  KNOWLEDGE: 'Knowledge',
  COPILOT: 'Copilot',
  AI_AGENTS: 'AI Agents',
  ANALYTICS: 'Analytics',
  WFM: 'WFM',
  QA: 'QA',
  INTEGRACOES: 'Integrações',
  OUTRO: 'Outro',
};

export const PRODUTO_LABEL: Record<Produto, string> = {
  SUPPORT: 'Support',
  MESSAGING: 'Messaging',
  CONTACT_CENTER: 'Contact Center',
  KNOWLEDGE: 'Knowledge',
  AI_AGENTS: 'AI Agents',
  COPILOT: 'Copilot',
  ANALYTICS: 'Explore / Analytics',
  WFM: 'WFM',
  QA: 'QA',
  ADMIN_SEGURANCA: 'Admin e Segurança',
  DEVELOPER_API: 'Developer / API',
  MARKETPLACE: 'Marketplace',
  OUTRO: 'Outro',
};

/** Chave estável do artefato tocado por cada impacto. */
export function chaveArtefato(impacto: Impacto, modulo: Modulo): string | null {
  switch (impacto) {
    case Impacto.DEMO:
      return 'DEMO_TEMPLATE'; // template único versionado (zd_auto_template)
    case Impacto.ESTIM:
      return `FRAMEWORK:${modulo}`;
    case Impacto.ESCOPO:
      return `ESCOPO:${modulo}`;
    case Impacto.ESTUDO:
      return null; // produz ficha, não atualiza artefato
  }
}
