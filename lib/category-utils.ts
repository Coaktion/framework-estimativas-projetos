import prisma from './prisma';

export interface MinimalCategory extends Record<string, any> {
  id: number;
  name: string;
  displayName: string;
  displayOrder: number;
  parentName: string | null;
  isActive: boolean;
}

const CATEGORY_SCHEMA_FIELDS: Array<{ key: keyof MinimalCategory; fallback?: any }> = [
  { key: 'id' },
  { key: 'name' },
  { key: 'displayName', fallback: '' },
  { key: 'displayOrder', fallback: 0 },
  { key: 'parentName', fallback: null },
  { key: 'isActive', fallback: true },
];

function mapCategoryRow(row: any): MinimalCategory {
  const out: any = {};
  for (let i = 0; i < CATEGORY_SCHEMA_FIELDS.length; i++) {
    const f: any = CATEGORY_SCHEMA_FIELDS[i];
    const val = row?.[f.key];
    out[f.key] = val ?? f.fallback;
  }
  return out;
}

function sortCategoriesFn(a: MinimalCategory, b: MinimalCategory): number {
  const orderA = Number(a.displayOrder ?? 0);
  const orderB = Number(b.displayOrder ?? 0);
  if (!Number.isNaN(orderA) && !Number.isNaN(orderB) && orderA !== orderB) {
    return orderA - orderB;
  }
  return String(a.name ?? '').localeCompare(String(b.name ?? ''));
}

export async function getActiveCategories(): Promise<MinimalCategory[]> {
  let rows: any[] = [];
  const baseWhere = { isActive: true };

  try {
    rows = (await prisma.$queryRawUnsafe(`
      SELECT id, name, "displayName", "displayOrder", "parentName", "isActive"
      FROM "Category"
      WHERE "isActive" = true
    `)) as any[];
  } catch {
    try {
      rows = await (prisma as any).category.findMany({
        where: baseWhere,
      });
    } catch {
      rows = [];
    }
  }

  const mapped = rows.map(mapCategoryRow);
  mapped.sort(sortCategoriesFn);
  return mapped;
}

export function buildCategoryOrderBy(): any[] {
  return [{ displayOrder: 'asc' as const }, { name: 'asc' as const }];
}

export function sortCategories(cats: MinimalCategory[]): MinimalCategory[] {
  return [...cats].sort(sortCategoriesFn);
}
