/**
 * Banco de perguntas v1, montado a partir dos arquivos do seed.
 *
 * `buildSeedBank()` é puro (testes e carga usam a mesma montagem). A carga no
 * banco de dados fica em lib/scoping/bank.ts.
 */

import { createHash } from 'crypto';
import type { Bank, BankQuestion, BankSection, BankTrack, ScopingLang } from '../types';
import { CORE_CONTEXT, CORE_QUANTITIES } from './core-aktie';
import { HIDDEN_QUESTIONS, HIDDEN_SECTION } from './hidden';
import { TEMPLATE_QUESTIONS, TEMPLATE_SECTIONS } from './template';
import { TRACK_QUESTIONS } from './track-questions';
import { AKTIE_SECTIONS, SECTION_ORDER, TRACKS } from './tracks';
import type { SeedQuestion, SeedSection } from './types';

export const SEED_BANK_VERSION = 1;

const TEMPLATE_KEYS = new Set(TEMPLATE_QUESTIONS.map((q) => q.key).concat(HIDDEN_QUESTIONS.map((q) => q.key)));

function sectionsInOrder(): SeedSection[] {
  const all = new Map<string, SeedSection>();
  TEMPLATE_SECTIONS.forEach((s) => all.set(s.key, s));
  all.set(HIDDEN_SECTION.key, HIDDEN_SECTION);
  Object.values(AKTIE_SECTIONS).forEach((s) => all.set(s.key, s));
  const ordered = SECTION_ORDER.filter((k) => all.has(k)).map((k) => all.get(k)!);
  // Seção que exista mas tenha ficado fora da ordem vai para o fim (o teste do seed acusa).
  all.forEach((s, k) => { if (!SECTION_ORDER.includes(k)) ordered.push(s); });
  return ordered;
}

/** Ordem das perguntas: dentro da seção, as do template primeiro e depois as da Aktie. */
function allSeedQuestions(): SeedQuestion[] {
  return [...CORE_CONTEXT, ...TEMPLATE_QUESTIONS, ...CORE_QUANTITIES, ...TRACK_QUESTIONS, ...HIDDEN_QUESTIONS];
}

function defaultTranslation(q: SeedQuestion): Partial<Record<ScopingLang, 'machine' | 'reviewed'>> {
  if (q.translation) return q.translation;
  return TEMPLATE_KEYS.has(q.key)
    ? { en: 'reviewed', pt: 'machine', es: 'machine' }
    : { pt: 'reviewed', en: 'machine', es: 'machine' };
}

export function buildSeedBank(): Omit<Bank, 'id'> {
  const sections: BankSection[] = sectionsInOrder().map((s, i) => ({
    key: s.key, order: i, title: s.title, deliverable: s.deliverable || {},
  }));
  const counters = new Map<string, number>();
  const questions: BankQuestion[] = allSeedQuestions().map((q) => {
    const order = counters.get(q.section) ?? 0;
    counters.set(q.section, order + 1);
    return {
      key: q.key,
      sectionKey: q.section,
      order,
      trackKeys: q.tracks?.length ? q.tracks : ['core'],
      type: q.type,
      options: q.options || [],
      unit: q.unit || null,
      min: q.min ?? null,
      max: q.max ?? null,
      tableColumns: q.tableColumns || [],
      text: q.text,
      help: q.help || {},
      configImpact: q.configImpact || {},
      translationStatus: defaultTranslation(q),
      priority: q.priority,
      defaultComplexity: q.complexity || null,
      showIf: q.showIf || null,
      followUps: q.followUps || [],
      catalogMappings: q.mappings || [],
      noCatalogItem: !!q.noCatalogItem,
      dataKey: q.dataKey || null,
    };
  });
  const sectionOrder = new Map(sections.map((s) => [s.key, s.order]));
  questions.sort((a, b) => (sectionOrder.get(a.sectionKey) ?? 999) - (sectionOrder.get(b.sectionKey) ?? 999) || a.order - b.order);
  const tracks: BankTrack[] = TRACKS.map((tr, i) => ({
    key: tr.key, type: tr.type, order: i, name: tr.name, description: tr.description,
    suggestRules: tr.suggestRules || [], fixedItems: tr.fixedItems || [],
  }));
  return { version: SEED_BANK_VERSION, tracks, sections, questions };
}

export function seedHash(bank: Omit<Bank, 'id'>): string {
  return createHash('sha256').update(JSON.stringify(bank)).digest('hex').slice(0, 16);
}
