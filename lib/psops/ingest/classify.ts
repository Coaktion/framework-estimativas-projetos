/**
 * Camada 2 — classificação.
 *
 * A implementação padrão é determinística, por regras: roda offline, é
 * testável, e o mesmo sinal recebe sempre o mesmo resultado. Não é a
 * classificação final desejada — é o piso que permite o mecanismo funcionar
 * antes de existir chamada de LLM.
 *
 * O contrato `Classificador` é o ponto de troca. Quando a camada de LLM
 * entrar (resumo em PT-BR + refinamento de produto/tipo), ela implementa a
 * mesma interface e o coletor não muda. A regra de ouro fica valendo: a saída
 * é SUGESTÃO. Falha de validação não bloqueia a ingestão — o sinal entra na
 * fila como NAO_CLASSIFICADO.
 */

import {
  Produto,
  Modulo,
  SignalTipo,
  PRODUTO_PARA_MODULO,
  calcularScore,
  sugestoesPara,
  type Impacto,
} from '../config/taxonomy';
import { titulo, type SinalBruto } from './parser';

export interface Classificacao {
  titulo: string;
  resumoPtBr: string | null;
  produto: Produto;
  modulo: Modulo;
  tipo: SignalTipo;
  planoMinimo: string | null;
  requerConfiguracao: boolean;
  requerDev: boolean;
  afetaPreco: boolean;
  dataLimite: Date | null;
  score: number;
  impactosSugeridos: Impacto[];
  impactosAvaliar: Impacto[];
  classificadoPor: string;
}

export interface ContextoClassificacao {
  /** nome da seção de origem: "Release notes", "Announcements"… */
  fonte: string;
  /** título do artigo pai */
  tituloArtigo: string;
  labels: string[];
}

export interface Classificador {
  readonly nome: string;
  classificar(sinal: SinalBruto, ctx: ContextoClassificacao): Promise<Classificacao>;
}

// ───────────────────────────── Mapa de produto ──────────────────────────────

/** Cabeçalhos H2 das release notes → nosso enum de produto. */
const H2_PARA_PRODUTO: Array<[RegExp, Produto]> = [
  [/contact center|voice|talk/i, Produto.CONTACT_CENTER],
  [/knowledge.*ai agent|ai agent/i, Produto.AI_AGENTS],
  [/knowledge|guide|help center/i, Produto.KNOWLEDGE],
  [/copilot|auto assist/i, Produto.COPILOT],
  [/explore|analytic|report|dashboard/i, Produto.ANALYTICS],
  [/workforce|wfm|forecast|schedul/i, Produto.WFM],
  [/quality assurance|\bqa\b/i, Produto.QA],
  [/messaging|chat|whatsapp|social/i, Produto.MESSAGING],
  [/apps and integrations|marketplace|app/i, Produto.MARKETPLACE],
  [/developer|\bapis?\b|sdk|webhook|ios|android|mobile/i, Produto.DEVELOPER_API],
  [/admin|security|account|authentication|sso/i, Produto.ADMIN_SEGURANCA],
  [/support|ticket|agent workspace/i, Produto.SUPPORT],
];

/** Palavras no corpo do sinal, usadas quando não há H2 (announcements). */
const TEXTO_PARA_PRODUTO: Array<[RegExp, Produto]> = [
  [/\bvoice ai|ivr|phone call|talk\b/i, Produto.CONTACT_CENTER],
  [/\bai agent|agentic\b/i, Produto.AI_AGENTS],
  [/\bcopilot|auto assist\b/i, Produto.COPILOT],
  [/\bhelp center|knowledge base|article|web crawler\b/i, Produto.KNOWLEDGE],
  [/\bexplore|dataset|metric|dashboard\b/i, Produto.ANALYTICS],
  [/\bwhatsapp|messaging|sunshine conversations\b/i, Produto.MESSAGING],
  [/\bapi token|oauth|endpoint|webhook|mcp|sdk|ios version|android version|rest api|graphql\b/i, Produto.DEVELOPER_API],
  [/\bworkforce|shift|forecast\b/i, Produto.WFM],
  [/\bquality assurance|spotlight\b/i, Produto.QA],
  [/\bmarketplace|integration\b/i, Produto.MARKETPLACE],
  [/\bpermission|role|team member|sso|authentication|department space\b/i, Produto.ADMIN_SEGURANCA],
  [/\bticket|macro|trigger|view|sla|agent\b/i, Produto.SUPPORT],
];

// ───────────────────────────── Detecção de tipo ─────────────────────────────

const RX = {
  deprecation: /\b(removal of|removing|deprecat\w*|end of life|end-of-life|sunset\w*|will no longer be supported|discontinu\w*)\b/i,
  breaking: /\bbreaking change|required migration|must migrate|mandatory (upgrade|migration)\b/i,
  eap: /\b(eap|early access program|beta|preview program|limited availability)\b/i,
  ga: /\b(general availability|generally available|now available|is available to all|announcing the general)\b/i,
  preco: /\b(pricing|price|prices|billing|invoice|cost per|packaging|entitlement|new add-on|subscription change)\b/i,
  ux: /\b(new look|refreshed|redesign|unified navigation|updated interface|visual refresh|now displays|reorganiz\w*)\b/i,
  fix: /^(fixed|fixes|fix:|resolved|we fixed|we've fixed|bug fix)\b|\bfixed an issue\b|\bfixed a bug\b|\bfixed crashes?\b/i,
  novidade: /^(added|adds|new|introduc\w*|launch\w*)\b|\b(you can now|can now|now (supports?|available|includes?|lets?|allows?)|is now available|new (feature|capability|option|setting))\b/i,
  config: /\b(admin center|admins? can (now )?(configure|create|set|define|enable|turn on|add)|configur(e|es|able|ation)|custom (field|object|role|status)s?|triggers?|automations?|macros?|sla polic(y|ies)|permissions?|routing|business rules?)\b/i,
  dev: /\b(api|endpoint|webhook|payload|sdk|oauth|scope|graphql|rate limit|schema|mcp|integration)\b/i,
};

const PLANOS: Array<[RegExp, string]> = [
  [/\bsuite enterprise plus\b/i, 'Suite Enterprise Plus'],
  [/\bsuite enterprise\b/i, 'Suite Enterprise'],
  [/\bsuite professional\b/i, 'Suite Professional'],
  [/\bsuite growth\b/i, 'Suite Growth'],
  [/\bsuite team\b/i, 'Suite Team'],
  [/\badvanced ai\b/i, 'Advanced AI add-on'],
  [/\badvanced data privacy\b/i, 'Advanced Data Privacy add-on'],
  [/\bworkforce management\b/i, 'WFM add-on'],
  [/\bquality assurance\b/i, 'QA add-on'],
  [/\bdepartment spaces?\b/i, 'Department Spaces'],
  [/\ball plans|any plan\b/i, 'Todos os planos'],
];

/** Datas em inglês ("September 30, 2026" / "2026-09-30") citadas no texto. */
function extrairDataLimite(texto: string): Date | null {
  if (!/\b(by|on|after|starting|effective|deadline|until|no later than)\b/i.test(texto)) return null;

  const iso = texto.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const MESES: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const m = texto.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(20\d{2})\b/i,
  );
  if (m?.[1] && m[2] && m[3]) {
    const mes = MESES[m[1].toLowerCase()];
    if (mes !== undefined) return new Date(Date.UTC(Number(m[3]), mes, Number(m[2])));
  }
  return null;
}

function primeiroMatch(mapa: Array<[RegExp, Produto]>, alvo: string): Produto | null {
  if (!alvo) return null;
  for (const [rx, p] of mapa) if (rx.test(alvo)) return p;
  return null;
}

/**
 * "Apps and integrations" e "Marketplace" são CONTAINERS na release note, não
 * produtos: guardam de app de terceiro a mudança de contrato de API. Quando o
 * H2 cai num container, o componente (H4) e o texto decidem melhor.
 *
 * Sem essa regra, a remoção dos API tokens — que vive sob "Apps and
 * integrations" com H4 "Developer" — era classificada como Marketplace e
 * afundava na fila com score de app de nicho.
 */
const CONTAINERS: ReadonlySet<Produto> = new Set([Produto.MARKETPLACE, Produto.OUTRO]);

function detectarProduto(sinal: SinalBruto, ctx: ContextoClassificacao): Produto {
  const porH2 = primeiroMatch(H2_PARA_PRODUTO, sinal.grupoProduto ?? '');
  if (porH2 && !CONTAINERS.has(porH2)) return porH2;

  const porH4 = primeiroMatch(H2_PARA_PRODUTO, sinal.grupoComponente ?? '');
  if (porH4 && !CONTAINERS.has(porH4)) return porH4;

  const alvo = `${sinal.texto} ${ctx.tituloArtigo} ${sinal.grupoComponente ?? ''}`;
  const porTexto = primeiroMatch(TEXTO_PARA_PRODUTO, alvo);
  if (porTexto && !CONTAINERS.has(porTexto)) return porTexto;

  if (/developer/i.test(ctx.fonte)) return Produto.DEVELOPER_API;
  return porH2 ?? porTexto ?? Produto.OUTRO;
}

function detectarTipo(texto: string, componente: string | null): SignalTipo {
  // Deprecation tem precedência: um anúncio de remoção que obriga migração é
  // uma deprecation, e a migração é a consequência. BREAKING_CHANGE fica para
  // mudança que quebra sem ser remoção (contrato de API alterado, por exemplo).
  if (RX.deprecation.test(texto)) return SignalTipo.DEPRECATION;
  if (RX.breaking.test(texto)) return SignalTipo.BREAKING_CHANGE;
  if (RX.preco.test(texto)) return SignalTipo.PRICING_PACKAGING;
  if (RX.eap.test(texto)) return SignalTipo.EAP_BETA;
  if (RX.ga.test(texto)) return SignalTipo.GA;
  // Correção pelo cabeçalho ("Fixed") OU pelo próprio texto ("Fixed an issue…")
  if (/^(fixed|fixes|bug fixes)/i.test(componente ?? '') || RX.fix.test(texto)) {
    return SignalTipo.FIX_MINOR;
  }
  if (RX.ux.test(texto)) return SignalTipo.UX_INTERFACE;
  // Capacidade nova: sob "New", ou o texto anuncia algo que passa a existir
  if (/^new\b/i.test(componente ?? '') || RX.novidade.test(texto)) return SignalTipo.GA;
  // Sem pista nenhuma: tratar como ajuste de interface (sugere só Demo). Antes
  // o padrão era GA, e por isso toda a primeira coleta saiu como GA.
  return SignalTipo.UX_INTERFACE;
}

// ─────────────────────── Classificador por regras ───────────────────────────

/**
 * Versão das regras. Ao mudar qualquer regra deste arquivo ou do filtro de
 * escopo, suba o número: na coleta seguinte, os sinais ainda na fila (NOVO)
 * com versão antiga são reclassificados a partir da camada crua.
 */
export const VERSAO_REGRAS = 'regras@2';

export class ClassificadorPorRegras implements Classificador {
  readonly nome = VERSAO_REGRAS;

  async classificar(sinal: SinalBruto, ctx: ContextoClassificacao): Promise<Classificacao> {
    const texto = sinal.texto;
    const produto = detectarProduto(sinal, ctx);
    const tipo = detectarTipo(texto, sinal.grupoComponente);

    const requerConfiguracao = RX.config.test(texto);
    const requerDev = RX.dev.test(texto) || /developer/i.test(ctx.fonte);
    const afetaPreco = RX.preco.test(texto);
    const dataLimite = extrairDataLimite(texto);

    const plano = PLANOS.find(([rx]) => rx.test(texto))?.[1] ?? null;

    const score = calcularScore({
      tipo,
      produto,
      requerConfiguracao,
      requerDev,
      afetaPreco,
      temDataLimite: dataLimite !== null,
    });

    const { sugeridos, avaliar } = sugestoesPara(tipo, { requerConfiguracao, requerDev });

    return {
      titulo: titulo(sinal.grupoComponente ? `${sinal.grupoComponente}: ${texto}` : texto),
      // O resumo em PT-BR é trabalho da camada de LLM. Por regras, fica nulo —
      // melhor um campo vazio e honesto do que uma tradução mecânica ruim.
      resumoPtBr: null,
      produto,
      modulo: PRODUTO_PARA_MODULO[produto],
      tipo,
      planoMinimo: plano,
      requerConfiguracao,
      requerDev,
      afetaPreco,
      dataLimite,
      score,
      impactosSugeridos: sugeridos,
      impactosAvaliar: avaliar,
      classificadoPor: this.nome,
    };
  }
}

/**
 * Slot para a camada de LLM.
 *
 * Implementar assim quando entrar: montar o prompt com sinal + contexto, pedir
 * saída JSON, validar com zod. Se a validação falhar depois de uma tentativa,
 * cair no ClassificadorPorRegras e marcar `classificadoPor: 'regras:fallback'`
 * — nunca deixar o sinal fora da fila por causa da classificação.
 *
 * export class ClassificadorLlm implements Classificador { … }
 */
export const classificadorPadrao: Classificador = new ClassificadorPorRegras();
