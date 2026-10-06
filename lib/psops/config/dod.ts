/**
 * Templates de Definition of Done por tipo de atividade.
 *
 * O DoD é o que transforma sinal em ativo. Card sem DoD vira lista de desejos.
 * Cada item pode exigir evidência (`evidencia: true`) — nesse caso o card só
 * fecha com um link ou arquivo anexado, não só com o check.
 */

import { Impacto, Modulo, MODULO_LABEL, type SignalTipo } from './taxonomy';

export interface DodItem {
  /** texto do item */
  t: string;
  /** marcado? */
  d: boolean;
  /** exige evidência anexada para poder fechar o card */
  exigeEvidencia?: boolean;
  /** link/arquivo anexado pelo responsável */
  evidencia?: string | null;
}

const item = (t: string, exigeEvidencia = false): DodItem => ({
  t,
  d: false,
  ...(exigeEvidencia ? { exigeEvidencia: true, evidencia: null } : {}),
});

export const DOD_TEMPLATES: Record<Impacto, () => DodItem[]> = {
  ESTUDO: () => [
    item('Documentação oficial lida e os links registrados na ficha', true),
    item('"O que é" escrito em duas linhas, em linguagem de negócio'),
    item('Como funciona, no nível necessário para explicar a um cliente'),
    item('Pré-requisitos e plano Zendesk mínimo identificados'),
    item('Limitações conhecidas registradas (o que a feature NÃO faz)'),
    item('Testado no tenant de sandbox — ou justificado por que não foi'),
    item('Ficha publicada e visível no Pre-Sales Ops'),
  ],
  DEMO: () => [
    item('Feature configurada e funcional no tenant de demo'),
    item('Dados fictícios coerentes criados (tickets, contatos, conteúdo)'),
    item('Roteiro de demonstração de 3 a 5 passos escrito no script'),
    item('Print ou GIF de 15s anexado ao card', true),
    item('Validado por outro pre-sales (peer review)'),
    item('Template zd_auto_template atualizado, se exigir objeto novo'),
    item('Registrado no Mapa de Artefatos'),
  ],
  ESTIM: () => [
    item('Item no catálogo com faixa de horas mínimo / provável / máximo'),
    item('Classificado na frente correta (SD · Dev · Implantação · Treino)'),
    item('Pré-requisitos e exclusões escritos'),
    item('Plano Zendesk mínimo e add-ons registrados'),
    item('Item antigo marcado deprecated, se houver substituição'),
    item('Changelog do framework e versão incrementados', true),
  ],
  ESCOPO: () => [
    item('Bloco redigido: entra · não entra · pré-requisitos · plano exigido'),
    item('Refletido no template de proposta de pacote de horas'),
    item('Redação revisada por uma pessoa de delivery'),
    item('Versão anterior arquivada com data', true),
  ],
};

/** Um DoD está cumprido quando todo item está marcado e as evidências existem. */
export function dodCompleto(dod: DodItem[]): boolean {
  return dod.every((i) => i.d && (!i.exigeEvidencia || Boolean(i.evidencia)));
}

export function dodPendencias(dod: DodItem[]): { faltamCheck: number; faltamEvidencia: number } {
  return {
    faltamCheck: dod.filter((i) => !i.d).length,
    faltamEvidencia: dod.filter((i) => i.d && i.exigeEvidencia && !i.evidencia).length,
  };
}

// ───────────────────────── Título da atividade ──────────────────────────────

/**
 * O título carrega O QUE mudou (o sinal). A tag do card carrega o destino e o
 * rodapé o artefato — assim dois cards do mesmo artefato não ficam idênticos.
 */
export function tituloAtividade(impacto: Impacto, tituloSinal: string): string {
  const prefixo: Record<Impacto, string> = {
    ESTUDO: 'Estudar',
    DEMO: 'Demonstrar',
    ESTIM: 'Estimar',
    ESCOPO: 'Escopo de',
  };
  return `${prefixo[impacto]}: ${tituloSinal}`;
}

// ─────────────────── Critério verificável (camada 5) ────────────────────────

/**
 * Como provar que a atividade foi feita, sem confiar no clique.
 * Preenchido na criação com o melhor palpite; o responsável pode refinar.
 *
 * Ver README, seção "Verificação e reconciliação" — enquanto
 * `PsOpsArtifact.fonteVerificacao` for NENHUMA, o critério fica registrado
 * mas não é executado.
 */
export type CriterioVerificavel =
  | {
      fonte: 'ZENDESK_ADMIN';
      /** endpoint da Admin API do tenant de demo */
      endpoint: string;
      /** caminho JSON onde procurar */
      caminho: string;
      /** termo que precisa aparecer */
      contem: string;
    }
  | {
      fonte: 'GDRIVE';
      /** fileId do arquivo que precisa ter mudado */
      fileId: string;
      /** exige que modifiedTime seja posterior à criação da atividade */
      exigeModificacaoApos: true;
    }
  | {
      fonte: 'PORTAL';
      /** tabela do portal cuja escrita já é a prova */
      tabela: string;
      chave: string;
    }
  | { fonte: 'NENHUMA'; motivo: string };

export function criterioSugerido(
  impacto: Impacto,
  modulo: Modulo,
  tipo: SignalTipo,
  tituloSinal: string,
): CriterioVerificavel {
  switch (impacto) {
    case Impacto.DEMO:
      // O nível que realmente prova: ler o tenant de demo e conferir que o
      // objeto existe. Usar OAuth — API tokens estão sendo removidos.
      return {
        fonte: 'ZENDESK_ADMIN',
        endpoint: palpiteEndpoint(tipo, tituloSinal),
        caminho: '$[*].title',
        contem: termoChave(tituloSinal),
      };
    case Impacto.ESTIM:
      return { fonte: 'PORTAL', tabela: 'psops_artifacts', chave: `FRAMEWORK:${modulo}` };
    case Impacto.ESCOPO:
      return { fonte: 'PORTAL', tabela: 'psops_artifacts', chave: `ESCOPO:${modulo}` };
    case Impacto.ESTUDO:
      return { fonte: 'PORTAL', tabela: 'psops_study_notes', chave: 'publicadoEm' };
  }
}

function palpiteEndpoint(tipo: SignalTipo, titulo: string): string {
  const t = titulo.toLowerCase();
  if (/\btrigger|gatilho\b/.test(t)) return '/api/v2/triggers';
  if (/\bmacro\b/.test(t)) return '/api/v2/macros';
  if (/\bview|visão\b/.test(t)) return '/api/v2/views';
  if (/\bfield|campo\b/.test(t)) return '/api/v2/ticket_fields';
  if (/\bsla\b/.test(t)) return '/api/v2/slas/policies';
  if (/\bbrand|marca\b/.test(t)) return '/api/v2/brands';
  if (/\bcustom object|objeto customizado\b/.test(t)) return '/api/v2/custom_objects';
  if (/\bvoice|talk|ivr|call\b/.test(t)) return '/api/v2/channels/voice/greetings';
  return '/api/v2/ticket_fields';
}

/** Heurística simples para o termo que a verificação vai procurar. */
function termoChave(titulo: string): string {
  const limpo = titulo
    .replace(/^announcing (the )?/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();
  return limpo.split(/\s+/).slice(0, 3).join(' ');
}

export const MODULO_NOME = MODULO_LABEL;
