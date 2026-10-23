import { aeChannelLabel } from './ae-channel-options';
import { normalizeAESku } from './ae-inputs';

/**
 * O que foi preenchido na Calculadora AE para gerar uma estimativa, como pares
 * rótulo/valor já traduzidos. Usado pela página da estimativa (visível para
 * todos que têm acesso) e pela exportação.
 */

type TFunc = (key: string, params?: Record<string, any>) => string;

export interface AEInputDetail {
  key: string;
  label: string;
  value: string;
  /** Texto livre longo: ocupa a linha inteira e preserva as quebras. */
  long?: boolean;
}

const PLAN_KEY: Record<string, string> = {
  team: 'ae.planTeam',
  growth: 'ae.planGrowth',
  professional: 'ae.planProfessional',
  enterprise: 'ae.planEnterprise',
};

const list = (values: unknown): string[] =>
  (Array.isArray(values) ? values : []).map((v) => String(v ?? '').trim()).filter(Boolean);

export function aeInputDetails(
  data: any,
  t: TFunc,
  options: { clientName?: string; packageLabel?: (name: string) => string } = {},
): AEInputDetail[] {
  const d = data || {};
  const none = t('common.none');
  const join = (values: string[]) => (values.length ? values.join(', ') : none);
  const modules = list(d.selectedModules);
  const channelQty = (d.channelQuantities || {}) as Record<string, number>;
  const appQty = (d.appQuantities || {}) as Record<string, number>;
  const plan = String(d.zendeskPlan || '').toLowerCase();
  const packageLabel = options.packageLabel || ((name: string) => name);

  const services = [
    d.hasSSO && t('ae.singleSignOn'),
    d.hasTeamsSideConv && t('ae.sideConvTeams'),
    d.hasSlackSideConv && t('ae.sideConvSlack'),
  ].filter(Boolean) as string[];
  const aktieApps = [
    d.hasAppCondicionais && t('ae.advancedConditionals'),
    d.hasAppTicketManager && t('ae.ticketManager'),
  ].filter(Boolean) as string[];
  const marketplace = list(d.selectedApps).map((app) => {
    const label = app === 'Outros' ? t('ae.otherMarketplace') : app;
    const qty = appQty[app];
    return (app === 'SweetHawk' || app === 'Outros') && Number(qty) > 0 ? `${label} × ${qty}` : label;
  });
  if (list(d.selectedApps).includes('Outros') && String(d.otherApp || '').trim()) {
    marketplace.push(`${t('ae.otherAppsPlaceholder')} ${String(d.otherApp).trim()}`);
  }

  const details: AEInputDetail[] = [
    { key: 'clientName', label: t('ae.clientName'), value: String(options.clientName || d.clientName || '').trim() || none },
    { key: 'dealLink', label: t('ae.dealLink'), value: String(d.zohoLink || '').trim() || none },
    { key: 'zendeskPlan', label: t('ae.zendeskPlan'), value: PLAN_KEY[plan] ? t(PLAN_KEY[plan]) : (d.zendeskPlan ? String(d.zendeskPlan) : none) },
    { key: 'sku', label: t('ae.sku'), value: normalizeAESku(d.skuType) === 'ES' ? t('plans.employeeService') : t('plans.customerService') },
    { key: 'operationType', label: t('ae.operationType'), value: join(list(d.operationTypes)) },
    { key: 'deployment', label: t('ae.deployment'), value: d.deploymentType === 'optimization' ? t('ae.deploymentOptimization') : t('ae.deploymentNew') },
    { key: 'modules', label: t('ae.modules'), value: join(modules) },
    { key: 'agents', label: t('ae.agents'), value: String(Math.max(1, Number(d.agents) || 1)) },
    { key: 'brands', label: t('ae.brands'), value: String(Math.max(1, Number(d.brands) || 1)) },
    { key: 'areas', label: t('ae.areas'), value: String(Math.max(1, Number(d.areas) || 1)) },
  ];
  if (modules.includes('Knowledge')) {
    details.push({ key: 'articles', label: t('ae.articleCount'), value: String(Math.max(0, Number(d.knowledgeArticles) || 0)) });
  }
  details.push(
    {
      key: 'channels',
      label: t('ae.activeChannels'),
      value: join(list(d.channels ?? d.selectedChannels).map((id) => `${aeChannelLabel(id, t)} × ${Number(channelQty[id] ?? 1)}`)),
    },
    { key: 'services', label: t('ae.additionalServices'), value: join(services) },
    { key: 'aktieApps', label: t('ae.aktieApps'), value: join(aktieApps) },
    { key: 'marketplace', label: t('ae.marketplaceApps'), value: join(marketplace) },
    { key: 'native', label: t('ae.nativeConnections'), value: join(list(d.selectedNativeConnections).map(packageLabel)) },
    { key: 'actionFlows', label: t('ae.actionFlow'), value: join(list(d.selectedActionFlows)) },
    { key: 'objectives', label: t('ae.clientObjectives'), value: String(d.clientObjectives || '').trim() || none, long: true },
    { key: 'successIndicators', label: t('ae.successIndicators'), value: String(d.successIndicators || '').trim() || none, long: true },
  );
  return details;
}
