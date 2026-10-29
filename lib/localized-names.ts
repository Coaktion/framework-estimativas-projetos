import type { Language } from '@/app/i18n/settings';

/**
 * Nomes multilíngues dos itens configuráveis (pacotes, categorias, skills, variáveis).
 *
 * REGRA CENTRAL: o campo em português continua sendo a CHAVE canônica gravada no
 * banco e usada em buscas de pacote, relações do Prisma e no layoutConfig.
 * Os campos `...En` e `...Es` são APENAS exibição. Nunca grave um nome traduzido
 * como valor.
 *
 * Se o campo do idioma estiver vazio, a exibição cai no português — assim nada
 * some da tela enquanto as traduções ainda não foram preenchidas.
 */

/** Remove acentos e caixa, para que "Configuração" case com "configuracao". */
export function foldText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function pick(primary: unknown, fallback: unknown): string {
  const value = String(primary ?? '').trim();
  return value || String(fallback ?? '').trim();
}

/** Escolhe o texto do idioma (en/es), caindo no português. */
function localized(language: Language, pt: unknown, en: unknown, es: unknown): string {
  if (language === 'en') return pick(en, pt);
  if (language === 'es') return pick(es, pt);
  return String(pt ?? '');
}

/** Nome de exibição de um pacote/item. */
export function packageName(pkg: any, language: Language): string {
  if (!pkg) return '';
  return localized(language, pkg.name, pkg.nameEn, pkg.nameEs);
}

/** Tooltip de exibição de um pacote/item. */
export function packageTooltip(pkg: any, language: Language): string {
  if (!pkg) return '';
  return localized(language, pkg.tooltip, pkg.tooltipEn, pkg.tooltipEs);
}

/** Nome de exibição de uma categoria. */
export function categoryName(category: any, language: Language): string {
  if (!category) return '';
  const pt = pick(category.displayName, category.name);
  return localized(language, pt, category.displayNameEn, category.displayNameEs);
}

/** Nome de exibição de uma skill. */
export function skillName(skill: any, language: Language): string {
  if (!skill) return '';
  return localized(language, skill.name, skill.nameEn, skill.nameEs);
}

/** Rótulo de exibição de uma variável (cai na key técnica se não houver rótulo). */
export function variableLabel(variable: any, language: Language): string {
  if (!variable) return '';
  const pt = pick(variable.label, variable.key);
  return localized(language, pt, variable.labelEn, variable.labelEs);
}

/* -------------------------------------------------------------------------- */
/*                          Busca em todos os idiomas                          */
/* -------------------------------------------------------------------------- */

/**
 * Junta TODOS os textos pesquisáveis de um registro, em todos os idiomas.
 *
 * É isto que faz um usuário em português encontrar "Campo de Usuário" digitando
 * "user field" (ou "campo de usuario" em espanhol), e vice-versa: a busca sempre
 * varre todos os idiomas, independentemente do idioma que está sendo exibido.
 */
export function searchHaystack(...values: unknown[]): string {
  return values
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(foldText)
    .join(' \u0001 ');
}

/** Haystack multilíngue de um pacote/item. */
export function packageHaystack(pkg: any): string {
  return searchHaystack(pkg?.name, pkg?.nameEn, pkg?.nameEs, pkg?.tooltip, pkg?.tooltipEn, pkg?.tooltipEs);
}

/** Haystack multilíngue de uma categoria. */
export function categoryHaystack(category: any): string {
  return searchHaystack(category?.name, category?.displayName, category?.displayNameEn, category?.displayNameEs);
}

/** Haystack multilíngue de uma skill. */
export function skillHaystack(skill: any): string {
  return searchHaystack(skill?.name, skill?.nameEn, skill?.nameEs);
}

/** Haystack multilíngue de uma variável. */
export function variableHaystack(variable: any): string {
  return searchHaystack(variable?.key, variable?.label, variable?.labelEn, variable?.labelEs, variable?.category);
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
