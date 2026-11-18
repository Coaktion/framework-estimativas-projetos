/**
 * Banco de perguntas no banco de dados: carga do seed (RF-01/31) e leitura.
 *
 * `ensureBank()` é idempotente: se a versão do seed ainda não existe nas
 * tabelas scoping_*, grava. Ninguém precisa rodar script contra o banco: a
 * primeira abertura do Scoping depois do deploy cria a versão. Uma versão
 * publicada nunca é alterada (as sessões ficam presas a ela).
 */

import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { loadFrameworkCatalog } from '@/lib/framework-catalog';
import { buildSeedBank, seedHash } from './seed';
import type {
  Bank, BankQuestion, CatalogMapping, CatalogRef, FixedItem, I18nText,
} from './types';

/** Ids dos itens citados num mapeamento (para validar contra o catálogo). */
function refsOf(m: CatalogMapping): CatalogRef[] {
  if (m.rule === 'table_item_qty') return Object.values(m.items);
  if (m.rule === 'ai_usecase_complexity') return Object.values(m.items);
  return [m];
}

/**
 * RF-31: mapeamento com item que não existe no catálogo é descartado e vira
 * aviso. Num mapeamento com vários itens, só a referência inválida sai.
 */
export function validateAgainstCatalog(
  bank: Omit<Bank, 'id'>, catalogIds: Set<number>,
): { bank: Omit<Bank, 'id'>; warnings: string[] } {
  const warnings: string[] = [];
  const okRef = (r: CatalogRef, where: string) => {
    if (catalogIds.has(r.itemId)) return true;
    warnings.push(`${where}: item ${r.itemId} (${r.itemName}) não existe no catálogo; mapeamento ignorado.`);
    return false;
  };
  const questions: BankQuestion[] = bank.questions.map((q) => ({
    ...q,
    catalogMappings: q.catalogMappings.flatMap((m): CatalogMapping[] => {
      if (m.rule === 'table_item_qty') {
        const items = Object.fromEntries(Object.entries(m.items).filter(([, r]) => okRef(r, q.key)));
        return Object.keys(items).length ? [{ ...m, items }] : [];
      }
      if (m.rule === 'ai_usecase_complexity') {
        return refsOf(m).every((r) => okRef(r, q.key)) ? [m] : [];
      }
      return okRef(m, q.key) ? [m] : [];
    }),
  }));
  const tracks = bank.tracks.map((tr) => ({
    ...tr,
    fixedItems: tr.fixedItems.filter((f: FixedItem) => okRef(f, `trilha ${tr.key}`)),
  }));
  return { bank: { ...bank, questions, tracks }, warnings };
}

async function catalogIds(): Promise<Set<number>> {
  const catalog = await loadFrameworkCatalog();
  const ids = new Set<number>();
  Object.values(catalog.packagesByCategory || {}).forEach((list) => (list || []).forEach((p: any) => ids.add(Number(p.id))));
  return ids;
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** Garante a versão do seed no banco e devolve o id dela. */
export async function ensureBank(userId?: number): Promise<number> {
  const seed = buildSeedBank();
  const existing = await prisma.scopingBankVersion.findUnique({ where: { version: seed.version }, select: { id: true } });
  if (existing) return existing.id;

  const { bank, warnings } = validateAgainstCatalog(seed, await catalogIds());
  try {
    return await prisma.$transaction(async (tx) => {
      const version = await tx.scopingBankVersion.create({
        data: {
          version: bank.version,
          status: 'published',
          notes: warnings.join('\n'),
          seedHash: seedHash(seed),
          publishedAt: new Date(),
          publishedBy: userId ?? null,
        },
      });
      await tx.scopingTrack.createMany({
        data: bank.tracks.map((tr) => ({
          bankVersionId: version.id, key: tr.key, type: tr.type, order: tr.order,
          name: json(tr.name), description: json(tr.description),
          suggestRules: json(tr.suggestRules), fixedItems: json(tr.fixedItems),
        })),
      });
      await tx.scopingSection.createMany({
        data: bank.sections.map((s) => ({
          bankVersionId: version.id, key: s.key, order: s.order, title: json(s.title), deliverable: json(s.deliverable),
        })),
      });
      const sections = await tx.scopingSection.findMany({ where: { bankVersionId: version.id }, select: { id: true, key: true } });
      const sectionId = new Map(sections.map((s) => [s.key, s.id]));
      await tx.scopingQuestion.createMany({
        data: bank.questions.map((q) => ({
          bankVersionId: version.id,
          sectionId: sectionId.get(q.sectionKey)!,
          key: q.key, order: q.order, trackKeys: q.trackKeys, type: q.type,
          options: json(q.options), unit: q.unit ? json(q.unit) : undefined,
          min: q.min, max: q.max, tableColumns: json(q.tableColumns),
          text: json(q.text), help: json(q.help), configImpact: json(q.configImpact),
          translationStatus: json(q.translationStatus), priority: q.priority,
          defaultComplexity: q.defaultComplexity, showIf: q.showIf ? json(q.showIf) : undefined,
          followUps: json(q.followUps), catalogMappings: json(q.catalogMappings),
          noCatalogItem: q.noCatalogItem, dataKey: q.dataKey,
        })),
      });
      if (warnings.length) console.warn(`[scoping] banco v${bank.version}: ${warnings.length} aviso(s) na carga do seed.`);
      return version.id;
    }, { timeout: 30_000 });
  } catch (e) {
    // Duas cargas ao mesmo tempo: a outra venceu (versão é única). Usa a dela.
    const again = await prisma.scopingBankVersion.findUnique({ where: { version: seed.version }, select: { id: true } });
    if (again) return again.id;
    throw e;
  }
}

/** Versão publicada mais recente (a que sessões novas usam). */
export async function latestBankVersionId(userId?: number): Promise<number> {
  await ensureBank(userId);
  const latest = await prisma.scopingBankVersion.findFirst({
    where: { status: 'published' }, orderBy: { version: 'desc' }, select: { id: true },
  });
  return latest!.id;
}

// Versões publicadas não mudam: dá para guardar em memória por instância.
const cache = new Map<number, Bank>();

export async function loadBank(bankVersionId: number): Promise<Bank> {
  const hit = cache.get(bankVersionId);
  if (hit) return hit;
  const version = await prisma.scopingBankVersion.findUnique({
    where: { id: bankVersionId },
    include: {
      tracks: { orderBy: { order: 'asc' } },
      sections: { orderBy: { order: 'asc' } },
      questions: { where: { active: true }, include: { section: { select: { key: true, order: true } } } },
    },
  });
  if (!version) throw new Error(`Banco de perguntas ${bankVersionId} não encontrado.`);
  const asText = (v: unknown) => (v || {}) as I18nText;
  const bank: Bank = {
    id: version.id,
    version: version.version,
    tracks: version.tracks.filter((t) => t.active).map((t) => ({
      key: t.key, type: t.type as any, order: t.order, name: asText(t.name), description: asText(t.description),
      suggestRules: (t.suggestRules as any) || [], fixedItems: (t.fixedItems as any) || [],
    })),
    sections: version.sections.map((s) => ({ key: s.key, order: s.order, title: asText(s.title), deliverable: asText(s.deliverable) })),
    questions: version.questions
      .sort((a, b) => a.section.order - b.section.order || a.order - b.order)
      .map((q) => ({
        key: q.key, sectionKey: q.section.key, order: q.order, trackKeys: q.trackKeys, type: q.type as any,
        options: (q.options as any) || [], unit: (q.unit as any) || null, min: q.min, max: q.max,
        tableColumns: (q.tableColumns as any) || [], text: asText(q.text), help: asText(q.help),
        configImpact: asText(q.configImpact), translationStatus: (q.translationStatus as any) || {},
        priority: q.priority as any, defaultComplexity: (q.defaultComplexity as any) || null,
        showIf: (q.showIf as any) || null, followUps: (q.followUps as any) || [],
        catalogMappings: (q.catalogMappings as any) || [], noCatalogItem: q.noCatalogItem, dataKey: q.dataKey,
      })),
  };
  cache.set(bankVersionId, bank);
  return bank;
}
