/**
 * Changelog do Tool Center (/changelog).
 *
 * Uma publicação tem título, resumo e itens (novidade, melhoria ou correção),
 * cada item marcado com a ferramenta a que se refere (lib/tool-features.ts).
 * Os textos têm pt, en e es; a tela mostra o idioma de quem lê e cai no
 * português quando falta tradução. Serve tanto para uma correção pequena
 * quanto para um lançamento grande: o tamanho é só a quantidade de itens.
 */
export type LocalizedText = { pt: string; en: string; es: string };
export type ChangelogKind = 'new' | 'improved' | 'fixed';
export const CHANGELOG_KINDS: ChangelogKind[] = ['new', 'improved', 'fixed'];

export interface ChangelogItem {
  kind: ChangelogKind;
  feature: string;
  text: LocalizedText;
}

export interface ChangelogEntryData {
  release: string;
  title: LocalizedText;
  summary: LocalizedText;
  items: ChangelogItem[];
}

/** Rascunho que vem do código (lib/changelog-drafts.ts). */
export interface CodeChangelogDraft extends ChangelogEntryData {
  /** Identificador estável: o rascunho é importado uma vez só. */
  key: string;
}

const text = (raw: any): LocalizedText => ({
  pt: String(raw?.pt ?? '').slice(0, 5000),
  en: String(raw?.en ?? '').slice(0, 5000),
  es: String(raw?.es ?? '').slice(0, 5000),
});

export function normalizeEntryData(raw: any): ChangelogEntryData {
  return {
    release: String(raw?.release ?? '').trim().slice(0, 80),
    title: text(raw?.title),
    summary: text(raw?.summary),
    items: (Array.isArray(raw?.items) ? raw.items : [])
      .map((i: any): ChangelogItem => ({
        kind: (CHANGELOG_KINDS as string[]).includes(i?.kind) ? i.kind : 'improved',
        feature: String(i?.feature || 'website'),
        text: text(i?.text),
      }))
      .filter((i: ChangelogItem) => i.text.pt.trim() || i.text.en.trim() || i.text.es.trim())
      .slice(0, 200),
  };
}

/** Texto no idioma de quem lê, caindo no português (e depois em qualquer um). */
export function pickText(value: Partial<LocalizedText> | null | undefined, language: string): string {
  const v = value || {};
  const lang = (language === 'en' || language === 'es' ? language : 'pt') as keyof LocalizedText;
  return String(v[lang] || v.pt || v.en || v.es || '');
}
