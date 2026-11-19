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
import { DROPPED_KEYS, OPTIONAL_KEYS, REQUIRED_KEYS, SHOW_IF, TRACK_ANSWER_RULES } from './policy';

/**
 * Versão do banco que o seed gera. Uma versão publicada nunca muda no banco de
 * dados (as sessões ficam presas a ela): QUALQUER mudança no seed exige subir
 * este número, senão a mudança não chega às sessões novas.
 *
 *  - v1: primeira versão (18/11/2026).
 *  - v2: perguntas reescritas sem pressupor que o cliente já escolheu o Zendesk;
 *        Bloco 0 com momento da decisão, plataformas consideradas e critérios.
 *  - v3: poucas obrigatórias, perguntas situacionais e aprofundamento
 *        (seed/policy.ts); duplicadas do template removidas.
 */
export const SEED_BANK_VERSION = 3;

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

/** Prioridade pela política: obrigatórias são só as de REQUIRED_KEYS. */
function priorityOf(q: SeedQuestion): SeedQuestion['priority'] {
  if (REQUIRED_KEYS.has(q.key)) return 'essencial';
  if (OPTIONAL_KEYS.has(q.key) || q.priority === 'opcional') return 'opcional';
  return 'recomendada';
}

/**
 * Ordem das perguntas: dentro da seção, as do template primeiro e depois as da
 * Aktie; a pergunta situacional vem logo depois da que a dispara, quando as
 * duas estão na mesma seção.
 */
function allSeedQuestions(): SeedQuestion[] {
  const list = [...CORE_CONTEXT, ...TEMPLATE_QUESTIONS, ...CORE_QUANTITIES, ...TRACK_QUESTIONS, ...HIDDEN_QUESTIONS]
    .filter((q) => !DROPPED_KEYS.has(q.key))
    .map((q) => ({ ...q, priority: priorityOf(q), showIf: SHOW_IF[q.key] ?? q.showIf }));
  const bySection = new Map<string, SeedQuestion[]>();
  list.forEach((q) => bySection.set(q.section, [...(bySection.get(q.section) || []), q]));
  const out: SeedQuestion[] = [];
  bySection.forEach((qs) => {
    const keys = new Set(qs.map((q) => q.key));
    const children = new Map<string, SeedQuestion[]>();
    const roots: SeedQuestion[] = [];
    qs.forEach((q) => {
      const parent = q.showIf?.questionKey;
      if (parent && keys.has(parent) && parent !== q.key) children.set(parent, [...(children.get(parent) || []), q]);
      else roots.push(q);
    });
    const visit = (q: SeedQuestion, depth = 0) => {
      out.push(q);
      if (depth < 5) (children.get(q.key) || []).forEach((c) => visit(c, depth + 1));
    };
    roots.forEach((q) => visit(q));
  });
  return out;
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
    suggestRules: [...(tr.suggestRules || []), ...(TRACK_ANSWER_RULES[tr.key] || [])], fixedItems: tr.fixedItems || [],
  }));
  return { version: SEED_BANK_VERSION, tracks, sections, questions };
}

export function seedHash(bank: Omit<Bank, 'id'>): string {
  return createHash('sha256').update(JSON.stringify(bank)).digest('hex').slice(0, 16);
}
