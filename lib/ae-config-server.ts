import prisma from './prisma';
import { DEFAULT_AE_CONFIG, normalizeAEConfig, type AEConfig, type AELibraryItem } from './ae-config';

export interface StoredAEConfig {
  /** null = padrão de fábrica (nenhuma configuração salva, ou estimativa antiga). */
  id: number | null;
  config: AEConfig;
  createdAt: string | null;
  note: string | null;
}

const FACTORY: StoredAEConfig = { id: null, config: DEFAULT_AE_CONFIG, createdAt: null, note: null };

function toStored(row: any): StoredAEConfig {
  return {
    id: row.id,
    config: normalizeAEConfig(row.data),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    note: row.note ?? null,
  };
}

/** Configuração ativa (a mais recente). Sem nenhuma salva, o padrão de fábrica. */
export async function getActiveAeConfig(): Promise<StoredAEConfig> {
  try {
    const row = await prisma.aeConfig.findFirst({ orderBy: { id: 'desc' } });
    return row ? toStored(row) : FACTORY;
  } catch (error) {
    // Tabela ainda não migrada: o cálculo segue com o padrão de fábrica.
    console.error('[ae-config] usando o padrão de fábrica:', error);
    return FACTORY;
  }
}

/**
 * Configuração com que uma estimativa foi calculada. Estimativas salvas antes
 * da configuração editável (sem id) foram calculadas com o padrão de fábrica.
 */
export async function getAeConfigById(id: unknown): Promise<StoredAEConfig> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return FACTORY;
  try {
    const row = await prisma.aeConfig.findUnique({ where: { id: numericId } });
    return row ? toStored(row) : FACTORY;
  } catch (error) {
    console.error('[ae-config] configuração não encontrada, usando o padrão de fábrica:', error);
    return FACTORY;
  }
}

/** Histórico para o painel Admin (mais recentes primeiro). */
export async function listAeConfigs(limit = 60): Promise<Array<StoredAEConfig & { createdByName: string | null }>> {
  try {
    const rows = await prisma.aeConfig.findMany({ orderBy: { id: 'desc' }, take: limit });
    const userIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((v): v is number => typeof v === 'number')));
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const nameOf = new Map(users.map((u) => [u.id, u.name || u.email]));
    return rows.map((row) => ({ ...toStored(row), createdByName: row.createdBy ? nameOf.get(row.createdBy) ?? null : null }));
  } catch (error) {
    console.error('[ae-config] histórico indisponível:', error);
    return [];
  }
}

/* ------------------------------------------------- VÍNCULOS COM A BIBLIOTECA -- */

/** Itens ativos da biblioteca, no formato que os vínculos da Calculadora usam. */
export async function getAeLibrary(): Promise<AELibraryItem[]> {
  try {
    const rows = await prisma.package.findMany({
      where: { isActive: true },
      select: { id: true, name: true, hours: true, categoryName: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, hours: Number(r.hours) || 0, categoryName: r.categoryName }));
  } catch (error) {
    console.error('[ae-config] biblioteca indisponível:', error);
    return [];
  }
}
