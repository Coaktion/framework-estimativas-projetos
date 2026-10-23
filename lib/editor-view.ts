/**
 * Modo de exibição do editor de estimativas (/sc/project/[id]).
 *
 * Fica num cookie (e não no banco) para valer em todas as estimativas sem
 * mudar o schema compartilhado entre os branches, e para o servidor já
 * renderizar a página no modo certo, sem "piscar" ao carregar.
 *  - ultra: linhas mais baixas e menos detalhes por item;
 *  - twoColumns: módulos lado a lado (só vale com o ultra ligado);
 *  - moduleChips: seleção de módulos com todos visíveis (em vez da lista suspensa).
 */
export const EDITOR_VIEW_COOKIE = 'tc_editor_view';

export type EditorView = { ultra: boolean; twoColumns: boolean; moduleChips: boolean };

export function parseEditorView(value?: string | null): EditorView {
  const tokens = String(value || '').split(',');
  return { ultra: tokens.includes('ultra'), twoColumns: tokens.includes('2col'), moduleChips: tokens.includes('chips') };
}

export function serializeEditorView(view: EditorView): string {
  return [view.ultra && 'ultra', view.twoColumns && '2col', view.moduleChips && 'chips'].filter(Boolean).join(',') || 'normal';
}

/**
 * Visão compacta da Calculadora AE (/ae), lembrada no mesmo esquema de cookie:
 * 'compact' ou 'normal'.
 */
export const AE_VIEW_COOKIE = 'tc_ae_view';
