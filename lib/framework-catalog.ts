/**
 * Catálogo do Framework (biblioteca de itens do editor de projetos /sc).
 *
 * Lê categorias, itens e variáveis ativos e monta a árvore exatamente como o
 * editor a recebe. Fica aqui (e não dentro da página) porque a API do Tool
 * Center precisa da MESMA árvore para calcular uma estimativa no servidor —
 * se cada um montasse a sua, um item poderia contar num lugar e não no outro.
 */

import prisma from '@/lib/prisma';
import { buildCategoryOrderBy, sortCategories } from '@/lib/category-utils';

export interface CategoryRecord {
  name: string;
  displayName: string;
  displayNameEn: string;
  displayNameEs: string;
  parentName: string | null;
  displayOrder: number;
  minPlanCS: string;
  minPlanES: string;
  implementationPhase: string;
}

export interface OrphanPackage {
  id: number;
  name: string;
  nameEn?: string;
  nameEs?: string;
  categoryName: string | null;
}

export interface FrameworkCatalog {
  /** Categorias raiz, na ordem do Admin. */
  categories: string[];
  categoryLabels: Record<string, string>;
  /** Todas as categorias ativas (raiz e subcategorias). */
  categoryRecords: Record<string, CategoryRecord>;
  subcategoriesByCategory: Record<string, string[]>;
  /** Itens ativos agrupados pela categoria raiz; `__subcategory` = filha direta da raiz ('' = a própria raiz). */
  packagesByCategory: Record<string, any[]>;
  /** Itens ativos sem categoria ativa no Admin (não aparecem no editor). */
  orphanPackages: OrphanPackage[];
  variables: any[];
}

export async function loadFrameworkCatalog(): Promise<FrameworkCatalog> {
  let categoriesData: any[];
  try {
    categoriesData = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: buildCategoryOrderBy() as any,
    });
  } catch {
    const rows = await prisma.category.findMany({ where: { isActive: true } });
    categoriesData = sortCategories(rows as any);
  }

  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const variables = await prisma.variable.findMany({
    where: { isActive: true },
  });

  // Rótulos PT (compatibilidade) e o registro completo por categoria, para que
  // o cliente possa exibir no idioma ativo e buscar em todos os idiomas.
  const categoryLabels = categoriesData.reduce((acc: Record<string, string>, c) => {
    acc[c.name] = c.displayName || c.name;
    return acc;
  }, {});

  const categoryRecords = categoriesData.reduce((acc: Record<string, CategoryRecord>, c: any) => {
    acc[c.name] = {
      name: c.name,
      displayName: c.displayName || '',
      displayNameEn: c.displayNameEn || '',
      displayNameEs: c.displayNameEs || '',
      parentName: c.parentName || null,
      displayOrder: c.displayOrder ?? 0,
      // Porteira de plano da categoria — o cliente usa para esconder a
      // categoria inteira abaixo do tier mínimo.
      minPlanCS: c.minPlanCS || '',
      minPlanES: c.minPlanES || '',
      // Linha do card de Implantação (Workshop/Setup/Treinamento/Go-Live).
      implementationPhase: c.implementationPhase || 'SETUP',
    };
    return acc;
  }, {});

  // Árvore de categorias, SÓ a partir do painel Admin. Cada categoria ativa
  // pertence a uma raiz: sobe pelos pais ativos até o topo. Pai inativo,
  // inexistente ou ciclo → a própria categoria vira raiz, para que nenhum item
  // desapareça do editor por causa da hierarquia.
  const activeByName = new Map<string, any>(categoriesData.map((c: any) => [c.name, c]));
  const chainCache = new Map<string, string[]>();
  const chainOf = (name: string): string[] => {
    const cached = chainCache.get(name);
    if (cached) return cached;
    const chain: string[] = [name];
    const seen = new Set<string>([name]);
    let current = activeByName.get(name);
    while (current?.parentName && activeByName.has(current.parentName) && !seen.has(current.parentName)) {
      chain.unshift(current.parentName);
      seen.add(current.parentName);
      current = activeByName.get(current.parentName);
    }
    // Ciclo: a cadeia não chegou a uma raiz de verdade — quebra aqui.
    if (current?.parentName && seen.has(current.parentName)) chain.splice(0, chain.length - 1);
    chainCache.set(name, chain);
    return chain;
  };

  const categories = categoriesData
    .filter((c: any) => chainOf(c.name)[0] === c.name)
    .map((c: any) => c.name);

  // Subcategorias exibidas = filhas diretas da raiz (netas entram na filha).
  const subcategoriesByCategory: Record<string, string[]> = {};
  categories.forEach((root: string) => { subcategoriesByCategory[root] = []; });
  categoriesData.forEach((c: any) => {
    const chain = chainOf(c.name);
    if (chain.length === 2 && subcategoriesByCategory[chain[0]]) {
      subcategoriesByCategory[chain[0]].push(c.name);
    }
  });

  const packagesByCategory: Record<string, any[]> = {};
  categories.forEach((root: string) => { packagesByCategory[root] = []; });
  const orphanPackages: OrphanPackage[] = [];
  packages.forEach((p: any) => {
    const sourceCat = p.categoryName;
    if (!sourceCat || !activeByName.has(sourceCat)) {
      orphanPackages.push({ id: p.id, name: p.name, nameEn: p.nameEn, nameEs: p.nameEs, categoryName: sourceCat || null });
      return;
    }
    const chain = chainOf(sourceCat);
    packagesByCategory[chain[0]].push({ ...p, __subcategory: chain[1] || '' });
  });

  return { categories, categoryLabels, categoryRecords, subcategoriesByCategory, packagesByCategory, orphanPackages, variables };
}
