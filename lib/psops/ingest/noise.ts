/**
 * Filtro de ruído.
 *
 * Uma release note tem 30 a 60 bullets. Sem corte, a fila afoga a triagem e o
 * ritual de 20 minutos deixa de caber. O corte é obrigatório, não otimização.
 *
 * Regra: bullet sob cabeçalho "Fixed" (ou equivalente) que não menciona
 * configuração, API, plano, permissão ou comportamento visível ao usuário
 * entra como AUTO_ARQUIVADO. Continua pesquisável no Pre-Sales Ops, fora da fila.
 *
 * Toda decisão de arquivamento grava o motivo — é o que permite auditar e
 * calibrar o filtro depois das primeiras semanas.
 */

import type { SinalBruto } from './parser';
import type { Produto, SignalTipo } from '../config/taxonomy';

const CABECALHO_FIX = /^(fixed|fixes|bug fixes|corre(ç|c)(õ|o)es)\b/i;

/**
 * Termos que indicam impacto real mesmo dentro de "Fixed": se a correção mexe
 * em configuração, contrato de API, plano ou permissão, ela importa.
 */
const TERMOS_RELEVANTES = [
  'admin center', 'admin', 'setting', 'settings', 'configur',
  'api', 'endpoint', 'webhook', 'payload', 'schema', 'oauth', 'token',
  'permission', 'role', 'scope', 'plan', 'add-on', 'addon', 'billing', 'price', 'pricing',
  'trigger', 'automation', 'macro', 'view', 'sla', 'custom object', 'custom field',
  'brand', 'help center', 'sunshine', 'deprecat', 'remov', 'breaking',
  'migrat', 'limit', 'quota', 'throttl', 'rate limit',
];

const TERMOS_IRRELEVANTES = [
  'typo', 'tooltip wording', 'spelling', 'label wording',
  'no longer displays an error', 'visual glitch', 'alignment',
];

export interface ResultadoRuido {
  arquivar: boolean;
  motivo: string | null;
}

export function avaliarRuido(sinal: SinalBruto): ResultadoRuido {
  const texto = sinal.texto.toLowerCase();
  const cabecalho = (sinal.grupoComponente ?? '').toLowerCase();

  if (TERMOS_IRRELEVANTES.some((t) => texto.includes(t))) {
    return { arquivar: true, motivo: 'ajuste cosmético sem impacto em ativo' };
  }

  if (CABECALHO_FIX.test(cabecalho)) {
    const relevante = TERMOS_RELEVANTES.some((t) => texto.includes(t));
    if (!relevante) {
      return {
        arquivar: true,
        motivo: 'correção sob "Fixed" sem menção a configuração, API, plano ou permissão',
      };
    }
    return { arquivar: false, motivo: null };
  }

  // Bullet curtíssimo raramente descreve mudança acionável
  if (sinal.texto.length < 40 && !TERMOS_RELEVANTES.some((t) => texto.includes(t))) {
    return { arquivar: true, motivo: 'texto curto demais para ser acionável' };
  }

  return { arquivar: false, motivo: null };
}

// ─────────────────────────── Filtro de escopo ───────────────────────────────

/**
 * O que o time decidiu NÃO tratar, independente de quão relevante a mudança
 * seja para outros públicos. Diferente do ruído (que é "não muda nada"), aqui
 * é "muda, mas não é com a gente". Vai para AUTO_ARQUIVADO com o motivo:
 * continua pesquisável na Linha do tempo, só sai da fila.
 *
 * Decisão do time (out/2026):
 *   · Developer / API, incluindo SDKs mobile
 *   · incidentes e manutenção do serviço
 *   · toda correção ("Fixed…"), mencione o que mencionar
 */
const RX_DEV = /\b(developers?|apis?|sdks?|rest api|graphql|webhooks?|endpoints?|oauth|zendesk apps framework|zaf|ios version|android version|mobile sdk|unity|react native)\b/i;
const RX_INCIDENTE = /\b(experienced (an|a) (issue|problem|outage)|service incident|incident report|post-?mortem|root cause|outage|degraded performance|service disruption|(scheduled|planned) maintenance|maintenance window|on (multiple|several) pods|pods? \d+)\b|\bfrom \d{1,2}:\d{2} utc to \d{1,2}:\d{2} utc\b/i;

export interface ContextoEscopo {
  texto: string;
  /** seção de origem ("Developer updates", "Release notes"…) */
  fonte?: string;
  tituloArtigo: string;
  grupoProduto: string | null;
  grupoComponente: string | null;
  produto: Produto;
  tipo: SignalTipo;
}

export const MOTIVO_ESCOPO = {
  dev: 'fora do escopo: Developer / API',
  incidente: 'fora do escopo: incidente ou manutenção do serviço',
  correcao: 'fora do escopo: correção (Fixed)',
} as const;

export function avaliarEscopo(c: ContextoEscopo): ResultadoRuido {
  const cabecalhos = `${c.fonte ?? ''} ${c.tituloArtigo} ${c.grupoProduto ?? ''} ${c.grupoComponente ?? ''}`;
  if (c.produto === 'DEVELOPER_API' || RX_DEV.test(cabecalhos) || RX_DEV.test(c.texto)) {
    return { arquivar: true, motivo: MOTIVO_ESCOPO.dev };
  }
  if (RX_INCIDENTE.test(c.texto) || RX_INCIDENTE.test(c.tituloArtigo)) {
    return { arquivar: true, motivo: MOTIVO_ESCOPO.incidente };
  }
  if (c.tipo === 'FIX_MINOR') {
    return { arquivar: true, motivo: MOTIVO_ESCOPO.correcao };
  }
  return { arquivar: false, motivo: null };
}

/** Escopo primeiro (motivo mais útil para auditar), ruído depois. */
export function decidirArquivamento(escopo: ResultadoRuido, ruido: ResultadoRuido): ResultadoRuido {
  if (escopo.arquivar) return escopo;
  if (ruido.arquivar) return ruido;
  return { arquivar: false, motivo: null };
}
