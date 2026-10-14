/**
 * Fontes oficiais monitoradas.
 *
 * Todas via API pública do Help Center do Zendesk — sem autenticação.
 * Validado em 11/08/2026: os feeds `.atom` do Guide estão desligados nesse
 * Help Center, então a API é o caminho (e devolve o body completo em JSON).
 *
 * A fonte `zendesk-updates` é a categoria raiz e por si só cobre as quatro
 * seções. As seções individuais ficam declaradas para permitir monitorar uma
 * delas em cadência diferente, ou desativar sem perder as outras.
 */

export type SourceKind = 'CATEGORY' | 'SECTION' | 'ARTICLE';

export interface SourceSeed {
  key: string;
  nome: string;
  kind: SourceKind;
  zendeskId: string;
  /** artigo atualizado no lugar — controlado por hash de body, não por created_at */
  isLiveArticle?: boolean;
  ativo?: boolean;
}

export const ZENDESK_HC_BASE = 'https://support.zendesk.com';
export const ZENDESK_HC_LOCALE = 'en-us';

export const SOURCE_SEEDS: SourceSeed[] = [
  {
    key: 'zendesk-updates',
    nome: 'Zendesk updates (categoria raiz)',
    kind: 'CATEGORY',
    zendeskId: '4405298749210',
    ativo: true,
  },
  {
    key: 'announcements',
    nome: 'Announcements',
    kind: 'SECTION',
    zendeskId: '4405298833818',
    // já coberta pela categoria raiz; ativar só se quiser cadência própria
    ativo: false,
  },
  {
    key: 'release-notes',
    nome: 'Release notes',
    kind: 'SECTION',
    zendeskId: '4405298847002',
    ativo: false,
  },
  {
    key: 'whats-new',
    nome: "What's new in Zendesk",
    kind: 'SECTION',
    zendeskId: '4405298877338',
    ativo: false,
  },
  {
    key: 'developer-updates',
    nome: 'Developer updates',
    kind: 'SECTION',
    zendeskId: '4405298889242',
    ativo: false,
  },
  {
    key: 'eaps-betas',
    nome: 'Current and upcoming EAPs and betas',
    kind: 'ARTICLE',
    zendeskId: '4408829663642',
    isLiveArticle: true,
    ativo: true,
  },
];

/** Seções conhecidas, para atribuir a fonte de origem a itens vindos da categoria. */
export const SECTION_NAMES: Record<string, string> = {
  '4405298833818': 'Announcements',
  '4405298847002': 'Release notes',
  '4405298877338': "What's new in Zendesk",
  '4405298889242': 'Developer updates',
};
