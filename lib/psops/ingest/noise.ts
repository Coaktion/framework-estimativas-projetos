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
