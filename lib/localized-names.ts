import type { Language } from '@/app/i18n/settings';

/**
 * Nomes bilíngues dos itens configuráveis (pacotes, categorias, skills, variáveis).
 *
 * REGRA CENTRAL: o campo em português continua sendo a CHAVE canônica gravada no
 * banco e usada em buscas de pacote, relações do Prisma e no layoutConfig.
 * O campo `...En` é APENAS exibição. Nunca grave o nome em inglês como valor.
 *
 * Se o campo em inglês estiver vazio, a exibição cai no português — assim nada
 * some da tela enquanto as traduções ainda não foram preenchidas.
 */

/** Remove acentos e caixa, para que "Configuração" case com "configuracao". */
export function foldText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function pick(primary: unknown, fallback: unknown): string {
  const value = String(primary ?? '').trim();
  return value || String(fallback ?? '').trim();
}

/** Nome de exibição de um pacote/item. */
export function packageName(pkg: any, language: Language): string {
  if (!pkg) return '';
  return language === 'en' ? pick(pkg.nameEn, pkg.name) : String(pkg.name ?? '');
}

/** Tooltip de exibição de um pacote/item. */
export function packageTooltip(pkg: any, language: Language): string {
  if (!pkg) return '';
  return language === 'en' ? pick(pkg.tooltipEn, pkg.tooltip) : String(pkg.tooltip ?? '');
}

/** Nome de exibição de uma categoria. */
export function categoryName(category: any, language: Language): string {
  if (!category) return '';
  const pt = pick(category.displayName, category.name);
  return language === 'en' ? pick(category.displayNameEn, pt) : pt;
}

/** Nome de exibição de uma skill. */
export function skillName(skill: any, language: Language): string {
  if (!skill) return '';
  return language === 'en' ? pick(skill.nameEn, skill.name) : String(skill.name ?? '');
}

/** Rótulo de exibição de uma variável (cai na key técnica se não houver rótulo). */
export function variableLabel(variable: any, language: Language): string {
  if (!variable) return '';
  const pt = pick(variable.label, variable.key);
  return language === 'en' ? pick(variable.labelEn, pt) : pt;
}

/* -------------------------------------------------------------------------- */
/*                          Busca em todos os idiomas                          */
/* -------------------------------------------------------------------------- */

/**
 * Junta TODOS os textos pesquisáveis de um registro, nos dois idiomas.
 *
 * É isto que faz um usuário em português encontrar "Campo de Usuário" digitando
 * "user field", e vice-versa: a busca sempre varre os dois idiomas,
 * independentemente do idioma que está sendo exibido.
 */
export function searchHaystack(...values: unknown[]): string {
  return values
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(foldText)
    .join(' \u0001 ');
}

/** Haystack bilíngue de um pacote/item. */
export function packageHaystack(pkg: any): string {
  return searchHaystack(pkg?.name, pkg?.nameEn, pkg?.tooltip, pkg?.tooltipEn);
}

/** Haystack bilíngue de uma categoria. */
export function categoryHaystack(category: any): string {
  return searchHaystack(category?.name, category?.displayName, category?.displayNameEn);
}

/** Haystack bilíngue de uma skill. */
export function skillHaystack(skill: any): string {
  return searchHaystack(skill?.name, skill?.nameEn);
}

/** Haystack bilíngue de uma variável. */
export function variableHaystack(variable: any): string {
  return searchHaystack(variable?.key, variable?.label, variable?.labelEn, variable?.category);
}

/**
 * Casa uma consulta contra um haystack já normalizado.
 * Consultas com várias palavras casam quando TODAS aparecem (em qualquer ordem),
 * então "user field" encontra "Campo de Usuário / User Field".
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  return terms.every((term) => haystack.includes(term));
}
