/**
 * Tiers do Zendesk Suite, em ordem crescente.
 *
 * Os planos são INCLUSIVOS: tudo que existe no Team também existe no Growth,
 * Professional e Enterprise. Por isso a comparação é sempre por posição
 * (`rank`), nunca por igualdade.
 */

export const ZENDESK_PLANS = ['team', 'growth', 'professional', 'enterprise'] as const;

export type ZendeskPlanTier = (typeof ZENDESK_PLANS)[number];

export const PLAN_RANK: Record<ZendeskPlanTier, number> = {
  team: 1,
  growth: 2,
  professional: 3,
  enterprise: 4,
};

/** Nome comercial exibido (igual nos dois idiomas). */
export const PLAN_LABEL: Record<ZendeskPlanTier, string> = {
  team: 'Suite Team',
  growth: 'Suite Growth',
  professional: 'Suite Professional',
  enterprise: 'Suite Enterprise',
};

export type ZendeskSku = 'CS' | 'ES';

export const SKU_LABEL_KEYS: Record<ZendeskSku, string> = {
  CS: 'plans.customerService',
  ES: 'plans.employeeService',
};

export const DEFAULT_PLAN: ZendeskPlanTier = 'professional';
export const DEFAULT_SKU: ZendeskSku = 'CS';

/** Aceita 'Suite Professional', 'professional', 'PROFESSIONAL'... */
export function normalizePlanTier(value?: string | null): ZendeskPlanTier {
  const key = String(value ?? '')
    .toLowerCase()
    .replace(/^suite\s+/, '')
    .trim();
  return (ZENDESK_PLANS as readonly string[]).includes(key)
    ? (key as ZendeskPlanTier)
    : DEFAULT_PLAN;
}

export function normalizeSkuType(value?: string | null): ZendeskSku {
  const key = String(value ?? '').toUpperCase();
  if (key.includes('ES') || key.includes('EMPLOYEE')) return 'ES';
  return 'CS';
}

/**
 * Converte o valor gravado no item num tier, ou `null` quando o campo está
 * vazio. `null` significa SEM RESTRIÇÃO — o item vale para qualquer plano.
 * Esse é o default para que nada desapareça da tela antes de alguém preencher.
 */
export function parseMinPlan(value?: string | null): ZendeskPlanTier | null {
  const key = String(value ?? '')
    .toLowerCase()
    .replace(/^suite\s+/, '')
    .trim();
  if (!key) return null;
  return (ZENDESK_PLANS as readonly string[]).includes(key)
    ? (key as ZendeskPlanTier)
    : null;
}

/** Plano mínimo exigido por um item, para o SKU escolhido. */
export function minPlanFor(pkg: any, sku: ZendeskSku): ZendeskPlanTier | null {
  if (!pkg) return null;
  return parseMinPlan(sku === 'ES' ? pkg.minPlanES : pkg.minPlanCS);
}

/**
 * O item está disponível no plano selecionado?
 * Sem plano mínimo definido → disponível (inclusivo por padrão).
 */
export function isPackageAvailable(
  pkg: any,
  sku: ZendeskSku,
  plan: ZendeskPlanTier,
): boolean {
  const min = minPlanFor(pkg, sku);
  if (!min) return true;
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

/** Rótulo curto do requisito, ex.: "Growth+". Vazio quando não há restrição. */
export function minPlanBadge(pkg: any, sku: ZendeskSku): string {
  const min = minPlanFor(pkg, sku);
  if (!min) return '';
  return `${PLAN_LABEL[min].replace(/^Suite\s+/, '')}+`;
}

/* -------------------------------------------------------------------------- */
/*                      RESTRIÇÃO DE PLANO POR CATEGORIA                       */
/*                                                                            */
/* A categoria tem a sua própria porteira, INDEPENDENTE da dos itens: abaixo   */
/* do mínimo dela a categoria não aparece no framework, mesmo que algum item   */
/* dentro dela não tenha restrição. É o que faz "ADPP" desaparecer por         */
/* completo fora do Suite Enterprise, em vez de aparecer vazia.                */
/*                                                                            */
/* As duas regras se somam: um item também precisa passar no próprio mínimo    */
/* para entrar no escopo. Nenhuma delas afrouxa a outra.                       */
/* -------------------------------------------------------------------------- */

/** Plano mínimo exigido por uma categoria, para o SKU escolhido. */
export function categoryMinPlanFor(category: any, sku: ZendeskSku): ZendeskPlanTier | null {
  if (!category) return null;
  return parseMinPlan(sku === 'ES' ? category.minPlanES : category.minPlanCS);
}

/**
 * A categoria está disponível no plano selecionado?
 * Sem mínimo definido → disponível (inclusivo por padrão, para que nada
 * desapareça da tela antes de alguém preencher).
 */
export function isCategoryAvailable(
  category: any,
  sku: ZendeskSku,
  plan: ZendeskPlanTier,
): boolean {
  const min = categoryMinPlanFor(category, sku);
  if (!min) return true;
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

/** Rótulo curto do requisito da categoria, ex.: "Enterprise+". */
export function categoryMinPlanBadge(category: any, sku: ZendeskSku): string {
  const min = categoryMinPlanFor(category, sku);
  if (!min) return '';
  return `${PLAN_LABEL[min].replace(/^Suite\s+/, '')}+`;
}
