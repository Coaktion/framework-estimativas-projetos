/**
 * Shape do retorno da API pública do Help Center.
 * Campos confirmados no retorno real em 11/08/2026 — os que não usamos ficam
 * fora do tipo mas seguem preservados em PsOpsRawItem.payload.
 */

export interface HcArticle {
  id: number;
  url: string;
  html_url: string;
  title: string;
  name: string;
  body: string;
  section_id: number | null;
  author_id: number | null;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  draft: boolean;
  promoted: boolean;
  outdated: boolean;
  locale: string;
  source_locale: string;
  label_names: string[];
  content_tag_ids?: string[];
  user_segment_id?: number | null;
  permission_group_id?: number | null;
}

export interface HcArticlesResponse {
  articles: HcArticle[];
  count: number;
  page: number;
  page_count: number;
  per_page: number;
  next_page: string | null;
  previous_page: string | null;
}
