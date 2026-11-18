/**
 * Ferramentas do Tool Center, para escolher "sobre o quê" num relato de bug
 * ou sugestão e para marcar a área de cada item do changelog. A chave é o que
 * fica gravado; o rótulo vem das traduções (`labelKey`).
 */
export const TOOL_FEATURES = [
  { key: 'estimates', labelKey: 'nav.projects' },
  { key: 'aeCalculator', labelKey: 'nav.history' },
  { key: 'booking', labelKey: 'nav.booking' },
  { key: 'folders', labelKey: 'nav.folders' },
  { key: 'radar', labelKey: 'nav.preSalesOps' },
  { key: 'estudos', labelKey: 'nav.estudos' },
  { key: 'zdAutoConfig', labelKey: 'nav.zdAutoConfig' },
  { key: 'admin', labelKey: 'nav.admin' },
  { key: 'changelog', labelKey: 'nav.changelog' },
  { key: 'website', labelKey: 'feedback.featureWebsite' },
  { key: 'demos', labelKey: 'feedback.featureDemos' },
] as const;

export type ToolFeature = (typeof TOOL_FEATURES)[number]['key'];

export const FEATURE_KEYS = TOOL_FEATURES.map((f) => f.key) as readonly string[];

export function featureLabelKey(key: string): string {
  return TOOL_FEATURES.find((f) => f.key === key)?.labelKey || 'feedback.featureWebsite';
}

export const FEEDBACK_KINDS = ['bug', 'suggestion'] as const;
export const FEEDBACK_STATUSES = ['new', 'ongoing', 'pending', 'rejected', 'solved'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Anexos: imagens e arquivos de texto, até 4 MB cada (o limite do Netlify é ~6 MB por requisição). */
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const ATTACHMENT_MAX_COUNT = 5;
export function isAllowedAttachment(mime: string): boolean {
  const m = String(mime || '').toLowerCase();
  return m.startsWith('image/') || m.startsWith('text/') || m === 'application/json' || m === 'application/pdf';
}
