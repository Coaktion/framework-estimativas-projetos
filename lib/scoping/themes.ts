/**
 * Temas da conversa: agrupam as seções do banco do jeito que uma reunião de
 * scoping anda de fato. O Modo reunião navega por tema; o Modo completo usa os
 * temas para agrupar as seções na coluna da esquerda.
 *
 * Seção que não estiver em nenhum tema cai em "outros" (o teste do seed acusa).
 */

import type { Bank, BankQuestion, I18nText } from './types';

export interface Theme {
  key: string;
  title: I18nText;
  sections: string[];
}

const t = (pt: string, en: string, es: string): I18nText => ({ pt, en, es });

export const THEMES: Theme[] = [
  { key: 'context', title: t('Contexto e decisão', 'Context and decision', 'Contexto y decisión'), sections: ['ctx', 'business_goals'] },
  { key: 'operation', title: t('Operação hoje', 'Operation today', 'Operación hoy'), sections: ['current_process', 'ticket_types', 'retail', 'itsm'] },
  { key: 'channels', title: t('Canais e volume', 'Channels and volume', 'Canales y volumen'), sections: ['channels', 'voice'] },
  { key: 'teams', title: t('Times e acessos', 'Teams and access', 'Equipos y accesos'), sections: ['teams', 'users'] },
  { key: 'process', title: t('Processo e regras', 'Process and rules', 'Proceso y reglas'), sections: ['forms', 'fields', 'routing', 'slas', 'escalation', 'automations', 'macros'] },
  { key: 'ai', title: t('IA e autoatendimento', 'AI and self-service', 'IA y autoservicio'), sections: ['knowledge', 'ai_agent', 'copilot'] },
  { key: 'integrations', title: t('Integrações', 'Integrations', 'Integraciones'), sections: ['integrations'] },
  { key: 'reporting', title: t('Indicadores', 'Reporting', 'Indicadores'), sections: ['reporting'] },
  { key: 'migration', title: t('Dados e migração', 'Data and migration', 'Datos y migración'), sections: ['migration'] },
  { key: 'security', title: t('Segurança', 'Security', 'Seguridad'), sections: ['security'] },
  { key: 'project', title: t('Prazo e projeto', 'Timeline and project', 'Plazo y proyecto'), sections: ['launch'] },
  { key: 'power', title: t('Perguntas poderosas', 'Power questions', 'Preguntas poderosas'), sections: ['hidden'] },
];

const OTHER: Theme = { key: 'other', title: t('Outros', 'Other', 'Otros'), sections: [] };

const sectionTheme = new Map<string, string>();
THEMES.forEach((th) => th.sections.forEach((s) => sectionTheme.set(s, th.key)));

export function themeOf(sectionKey: string): string {
  return sectionTheme.get(sectionKey) || OTHER.key;
}

export interface ThemeGroup {
  theme: Theme;
  /** perguntas do tema, na ordem do banco */
  questions: BankQuestion[];
}

/** Agrupa perguntas (já filtradas: visíveis etc.) por tema, na ordem dos temas e do banco. */
export function groupByTheme(bank: Bank, questions: BankQuestion[]): ThemeGroup[] {
  const sectionOrder = new Map(bank.sections.map((s) => [s.key, s.order]));
  const by = new Map<string, BankQuestion[]>();
  questions.forEach((q) => {
    const k = themeOf(q.sectionKey);
    by.set(k, [...(by.get(k) || []), q]);
  });
  return [...THEMES, OTHER]
    .filter((th) => by.has(th.key))
    .map((th) => ({
      theme: th,
      questions: by.get(th.key)!.sort((a, b) => (sectionOrder.get(a.sectionKey) ?? 0) - (sectionOrder.get(b.sectionKey) ?? 0) || a.order - b.order),
    }));
}
