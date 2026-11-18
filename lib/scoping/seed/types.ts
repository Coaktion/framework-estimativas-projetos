/**
 * Formato do seed do banco de perguntas (código → tabelas scoping_* na carga).
 *
 * As keys são estáveis entre versões do banco: nunca renomear uma key publicada.
 */

import type {
  CatalogMapping, ChoiceOption, Complexity, FixedItem, I18nText, Priority, QuestionType,
  ScopingLang, ShowIf, SuggestRule, TableColumn, TrackType,
} from '../types';

export interface SeedTrack {
  key: string;
  type: TrackType;
  name: I18nText;
  description: I18nText;
  suggestRules?: SuggestRule[];
  fixedItems?: FixedItem[];
}

export interface SeedSection {
  key: string;
  title: I18nText;
  deliverable?: I18nText;
}

export interface SeedQuestion {
  key: string;
  /** key da seção (SeedSection.key) */
  section: string;
  /** trilhas a que pertence; vazia = ['core'] */
  tracks?: string[];
  type: QuestionType;
  text: I18nText;
  /** "Por que perguntar" */
  help?: I18nText;
  /** Impacto na configuração Zendesk */
  configImpact?: I18nText;
  priority: Priority;
  complexity?: Complexity;
  options?: ChoiceOption[];
  unit?: I18nText;
  min?: number;
  max?: number;
  tableColumns?: TableColumn[];
  showIf?: ShowIf;
  followUps?: I18nText[];
  mappings?: CatalogMapping[];
  noCatalogItem?: boolean;
  dataKey?: string;
  /** Padrão: pt reviewed (Aktie) ou en reviewed (template), demais machine. */
  translation?: Partial<Record<ScopingLang, 'machine' | 'reviewed'>>;
}
