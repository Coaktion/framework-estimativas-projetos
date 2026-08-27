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
