'use client';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/LanguageProvider';
import { canViewExecutiveReport } from '@/lib/segments';
import AEResultTable from '@/components/AEResultTable';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from "next/link";
import {
  Zap, ArrowLeft, ExternalLink, MessageSquare, ShieldCheck, Settings, Users, Bot, Layout, Activity,
  Clock, BookOpen, Hash, Search, Copy, CheckCircle2, AlertTriangle, Plus, ChevronDown, X, Layers
} from "lucide-react";
import {
  calculateAEEstimate,
  validateAEInputs,
  type AEInputData,
} from '@/lib/ae-engine';

const CHANNEL_LEGACY_TO_KEY: Record<string, any> = {
  web_form: 'web_form', email: 'email', web_widget: 'web_widget', whatsapp: 'whatsapp',
  facebook: 'facebook_messenger', facebook_messenger: 'facebook_messenger',
  instagram: 'instagram_dm', instagram_dm: 'instagram_dm', instagram_page: 'instagram_page',
  voice: 'voice', teams: 'microsoft_teams', microsoft_teams: 'microsoft_teams', slack: 'slack',
  x: 'x_dm', x_dm: 'x_dm', x_pages: 'x_pages', sms: 'sms', ios: 'ios', unity: 'unity',
  line: 'line', apple_business: 'apple_messages', apple_messages: 'apple_messages', wechat: 'wechat',
  google_rcs: 'google_rcs', google_business: 'google_business_messages',
  google_business_messages: 'google_business_messages', kakaotalk: 'kakaotalk',
  facebook_pages: 'facebook_pages',
  telegram: 'telegram',
};

const MARKETPLACE_APP_LABEL_TO_KEY: Record<string, any> = {
  'WooCommerce': 'woocommerce', 'Woo Commerce': 'woocommerce',
  'Dialpad': 'dialpad', 'Aircall': 'aircall', 'VTEX': 'vtex',
  'Stripe': 'stripe', 'Pipedrive': 'pipedrive', 'SweetHawk': 'sweethawk',
  // 'App Marketplace' saiu da Calculadora, mas fica no mapa para que estimativas
  // antigas que gravaram esse rótulo continuem contabilizando corretamente.
  'Outros': 'other_marketplace', 'App Marketplace': 'other_marketplace',
  'Outro Marketplace': 'other_marketplace', 'other_marketplace': 'other_marketplace',
};

const PLAN_RANK = { team: 1, growth: 2, professional: 3, enterprise: 4 } as const;

function normalizeSku(raw: string): any {
  const key = String(raw || '').toUpperCase();
  if (key.includes('ES') || key.includes('EMPLOYEE')) return 'ES';
  return 'CS';
}
function normalizeAnalyticsTraining(raw: string): 'basic' | 'advanced' {
  return String(raw || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
}

function buildEngineInputs(formState: any): AEInputData {
  const selectedChannels: any[] = (formState.selectedChannels || [])
    .map((c: string) => CHANNEL_LEGACY_TO_KEY[c])
    .filter(Boolean);

  const channelQuantities: any = {};
  for (const [k, v] of Object.entries<number>(formState.channelQuantities || {})) {
    const key = CHANNEL_LEGACY_TO_KEY[k];
    if (!key) continue;
    channelQuantities[key] = Math.max(0, Number(v) || 0);
  }

  const selectedApps: any[] = [];
  const appQuantities: any = {};
  for (const appLabel of formState.selectedApps || []) {
    const key = MARKETPLACE_APP_LABEL_TO_KEY[String(appLabel)];
    if (!key) continue;
    if (!selectedApps.includes(key)) selectedApps.push(key);
    const qtyRaw = formState.appQuantities?.[appLabel];
    if (qtyRaw != null) appQuantities[key] = Math.max(0, Number(qtyRaw) || 0);
  }

  const sku = normalizeSku(formState.skuType);
  const zendeskPlan = (String(formState.zendeskPlan || 'professional').toLowerCase().replace(/^suite\s+/, '').trim() as any) || 'professional';
  const planRank = (PLAN_RANK as any)[zendeskPlan] ?? 1;

  const selectedModules = (formState.selectedModules || ['Support']).filter((m: string) => {
    if (['Analytics', 'Community', 'Copilot', 'QA', 'WFM'].includes(m)) return planRank >= PLAN_RANK.professional;
    if (m === 'ADPP') return planRank >= PLAN_RANK.enterprise;
    return true;
  });

  return {
    agents: Math.max(1, Number(formState.agents) || 1),
    brands: Math.max(1, Number(formState.brands) || 1),
    areas: Math.max(1, Number(formState.areas) || 1),
    skuType: sku,
    zendeskPlan,
    operationTypes: ((formState.operationTypes || []) as any[]).filter(Boolean),
    selectedModules: selectedModules.length ? selectedModules : ['Support'],
    selectedChannels: selectedChannels.length ? selectedChannels : ['web_form'],
    channelQuantities,
    knowledgeArticles: Math.max(0, Number(formState.knowledgeArticles) || 0),
    operationLanguages: Math.max(1, Number(formState.operationLanguages) || 1),
    analyticsTrainingType: normalizeAnalyticsTraining(formState.analyticsTrainingType),
    selectedNativeConnections: formState.selectedNativeConnections || [],
    selectedActionFlows: formState.selectedActionFlows || [],
    selectedApps,
    appQuantities,
    hasAppCondicionais: Boolean(formState.hasAppCondicionais),
    hasAppTicketManager: Boolean(formState.hasAppTicketManager),
    hasSSO: Boolean(formState.hasSSO),
    hasTeamsSideConv: Boolean(formState.hasTeamsSideConv),
    hasSlackSideConv: Boolean(formState.hasSlackSideConv),
  };
}

function num(v: any, d = 1) {
  return Number(v || 0).toFixed(d);
}

type TFunc = (key: string, params?: Record<string, any>) => string;

function buildMarkdownReport(est: any, f: any, engineInputs: any, t: TFunc, dateLocale: string): string {
  const d = f || {};
  const bd = est.breakdown || {};
  const qt = est.quantities || {};
  const vars = est.variables || {};

  const chQty = (legacyKey: string) => {
    const k = CHANNEL_LEGACY_TO_KEY[legacyKey] ?? legacyKey;
    return Math.max(1, Number(((engineInputs && engineInputs.channelQuantities) || {})[k] || qt[k] || 1));
  };

  const total = Math.max(0, Number(est.total || 0));
  const lineItemHours = Math.max(0, Number(est.lineItemHours || 0));
  const disc = Math.max(0, Number(est.discoveryHours || 0));
  const val = Math.max(0, Number(est.validationHours || 0));
  const ct = Math.max(0, Number(est.commTechHours || 0));
  const gl = Math.max(0, Number(est.goLiveHours || 0));
  const gp = Math.max(0, Number(est.gpHours || 0));
  const basePct = Math.max(0, lineItemHours - Number(bd.training || 0) - Number(bd.nativeConnections || 0) - Number(bd.thirdPartyApps || 0));

  return `
# ${t('report.executiveTitle')}

**${t('report.client')}:** ${String(d.clientName || '')}
**${t('report.estimateDate')}:** ${new Date(Date.now()).toLocaleDateString(dateLocale)}
**${t('report.totalHours')}:** **${num(total)}h**
**${t('report.scFlag')}:** ${est.needsSC ? t('report.scFlagYes') : t('report.scFlagNo')}

---

## ${t('report.section1')}

- **${t('report.clientProject')}:** ${String(d.clientName || '')}
- **${t('report.skuOperation')}:** ${normalizeSku(d.skuType)} — ${Array.isArray(d.operationTypes) ? d.operationTypes.join(', ') : ''}
- **${t('report.environmentDeal')}:** ${d.deploymentType === 'optimization' ? t('report.optimizationExisting') : t('report.newImplementation')}
- **${t('report.zendeskPlan')}:** ${String(d.zendeskPlan || 'professional').toUpperCase()}
- **${t('report.agentCount')}:** ${Math.max(1, Number(d.agents) || 1)}
- **${t('report.brands')}:** ${Math.max(1, Number(d.brands) || 1)}
- **${t('report.areasQueues')}:** ${Math.max(1, Number(d.areas) || 1)}
- **${t('report.operationLanguages')}:** ${Math.max(1, Number(d.operationLanguages) || 1)}
- **${t('report.selectedModules')}:** ${Array.isArray(d.selectedModules) ? d.selectedModules.join(', ') : 'Support'}
- **${t('report.clientObjectives')}:** ${String(d.clientObjectives || t('report.notProvided'))}
- **${t('report.successIndicators')}:** ${String(d.successIndicators || t('report.notProvided'))}

---

## ${t('report.section2')}

| ${t('report.group')} | ${t('report.hours')} |
| :--- | ---: |
${Object.entries<any>(bd).map(([k, v]) => `| ${String(k)} | ${num(v, 2)}h |`).join('\n')}
| **${t('report.subtotalLineItems')}** | **${num(lineItemHours, 2)}h** |

---

## ${t('report.section3')}

### ${t('report.section31')}
- ${t('report.workshopsNote')}
- ${t('report.channelsQty')}
${(engineInputs?.selectedChannels || []).map((c: string) => `  - ${String(c)} × ${chQty(c)} ${t('report.engineRuleApplied')}`).join('\n')}

### ${t('report.section32')}
- ${t('report.knowledgeArticles')} ${Math.max(0, Number(d.knowledgeArticles) || 0)} ${t('report.knowledgeRule')}

### ${t('report.section33')}
- ${t('report.analyticsTrainingType')} ${d.analyticsTrainingType === 'advanced' ? t('report.advanced') : t('report.standard')}

### ${t('report.section34')}
- ${t('report.actionFlowsNote')}

---

## ${t('report.section4')}

| ${t('common.item')} | ${t('report.engineRule')} | ${t('common.value')} |
| :--- | :--- | ---: |
| ${t('report.agents')} | ${Math.max(1, Number(d.agents) || 1)} × ${t('report.engineRule')} | — |
| ${t('report.brands')} | ${Math.max(1, Number(d.brands) || 1)} × ${t('report.engineRule')} | — |
| ${t('report.channelsPerUnit')} | ${t('report.appliedPerChannel')} | — |

---

## ${t('report.section5')}

### ${t('report.section51')}
- ${t('report.nativeAppsSelected')} ${Array.isArray(d.selectedNativeConnections) ? d.selectedNativeConnections.join(', ') || t('common.none').toLowerCase() : t('common.none').toLowerCase()}
- ${t('report.nativeFlatRule')}

### ${t('report.section52')}
- Teams: ${d.hasTeamsSideConv ? t('report.yesFlat05') : t('common.no')}
- Slack: ${d.hasSlackSideConv ? t('report.yesFlat05') : t('common.no')}

### ${t('report.section53')}
- ${t('report.selectedApps')} ${Array.isArray(d.selectedApps) ? d.selectedApps.join(', ') || t('common.none').toLowerCase() : t('common.none').toLowerCase()}
- ${t('report.marketplaceRule')}

### ${t('report.section54')}
- ${t('report.actionFlows')} ${Array.isArray(d.selectedActionFlows) ? d.selectedActionFlows.join(', ') || t('common.none').toLowerCase() : t('common.none').toLowerCase()}
- ${t('report.flatPerAction')}

### ${t('report.section55')}
- SSO: ${d.hasSSO ? t('report.yes2h') : t('common.no')}
- ${t('report.conditionalsApp')}: ${d.hasAppCondicionais ? t('common.yes') : t('common.no')}
- ${t('report.ticketManagerApp')}: ${d.hasAppTicketManager ? t('common.yes') : t('common.no')}

---

## ${t('report.section6')}

| ${t('common.item')} | ${t('report.applied')} |
| :--- | :--- |
| ${t('report.fixedTrainingRow')} | ${t('report.appliedViaEngine')} |
| ${t('report.analyticsTrainingRow')} | ${d.analyticsTrainingType === 'advanced' ? t('report.advanced') : t('report.standard')} |

---

## ${t('report.section7')}

${t('report.basePct')} **${num(basePct, 2)}h**

| ${t('report.variable')} | ${t('report.rule')} | ${t('report.hours')} |
| :--- | :--- | ---: |
| ${t('ae.discovery')} | 20% ${t('report.pctOverBase')} | ${num(disc, 2)}h |
| ${t('ae.validation')} | 15% ${t('report.pctOverBase')} | ${num(val, 2)}h |
| ${t('report.techComm')} | 10% ${t('report.pctOverBase')} | ${num(ct, 2)}h |
| ${t('ae.goLive')} | 5% ${t('report.pctOverBase')} | ${num(gl, 2)}h |
| ${t('report.projectMgmt')} | 17.647% ${t('report.gpTrigger')} | ${num(gp, 2)}h |
| **${t('report.variablesSubtotal')}** | | **${num(disc + val + ct + gl + gp, 2)}h** |

---

## ${t('report.section8')}

| ${t('common.item')} | ${t('report.hours')} |
| :--- | ---: |
| ${t('report.lineItemsSubtotal')} | ${num(lineItemHours, 2)}h |
| + ${t('ae.discovery')} | ${num(disc, 2)}h |
| + ${t('ae.validation')} | ${num(val, 2)}h |
| + ${t('ae.goLive')} | ${num(gl, 2)}h |
| + ${t('report.techComm')} | ${num(ct, 2)}h |
| + ${t('report.projectMgmt')} | ${num(gp, 2)}h |
| **${t('report.totalEstimatedEffort')}** | **${num(total, 2)}h** |

---

## ${t('report.section9')}

${est.needsSC ? [
  t('report.requiresSC'),
  est.escalationMessage ? `- ${String(est.escalationMessage)}` : '',
  t('report.triggerCriteria'),
].filter(Boolean).join('\n') : [
  t('report.withinLimits'),
  t('report.reviewAnyway'),
].join('\n')}
`.trim();
}

export default function AEViewClient(props: any) {
  const {
    estimateId, clientName, zohoLink, resultHours, needsSC,
    version, createdAt, parentId, data, variables, packages, categories, allVersions,
  } = props;

  const { t } = useTranslation();
  const { dateLocale } = useLanguage();
  const { data: session } = useSession();
  // Relatório Executivo: só administradores. Os demais ficam com a tabela.
  const showExecutiveReport = canViewExecutiveReport(session?.user as any);
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!versionPickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!pickerRef.current) return;
      if (!(e.target instanceof Node) || !pickerRef.current.contains(e.target as Node)) {
        setVersionPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVersionPickerOpen(false); };
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [versionPickerOpen]);

  const versions = useMemo(() => {
    const arr: { id: number; version: number; createdAt: Date; needsSC: boolean }[] = Array.isArray(allVersions) ? allVersions : [];
    if (!arr.length) {
      return [{
        id: Number(estimateId),
        version: typeof version === 'number' ? Math.max(1, version) : 1,
        createdAt: createdAt instanceof Date ? createdAt : new Date(createdAt),
        needsSC: Boolean(needsSC),
      }];
    }
    return arr;
  }, [allVersions, estimateId, version, createdAt, needsSC]);

  const variablesMap = useMemo(() => {
    const map: any = {};
    for (const v of (variables || [])) map[v.key] = v;
    return map;
  }, [variables]);

  const { estimation, engineResult, engineInputs, report } = useMemo(() => {
    const f = data || {};
    const ei = buildEngineInputs(f);

    // `calculateAEEstimate` LANÇA quando os inputs são inválidos, então a
    // validação tem de ser respeitada antes da chamada — sem isso, uma
    // estimativa antiga com dados incompletos derrubava a página inteira.
    const validation = validateAEInputs(ei);
    let raw: any = null;
    if (validation.valid) {
      try {
        raw = calculateAEEstimate(ei);
      } catch (err) {
        console.error('AE engine failed while reopening estimate:', err);
        raw = null;
      }
    }

    /**
     * Ponte entre o engine e o relatório.
     *
     * O engine devolve `totalHours` e `requiresSalesEngineer`; o relatório lê
     * `total`, `needsSC` e `variables`. Antes essa tradução não existia: os três
     * campos vinham `undefined`, o total caía no valor gravado por sorte e a
     * seção 9 sempre imprimia "dentro dos limites", mesmo em estimativas que
     * exigiam Sales Engineer.
     */
    const est: any = raw
      ? {
          ...raw,
          total: raw.totalHours,
          needsSC: raw.requiresSalesEngineer,
          variables: {
            discovery: raw.discoveryHours,
            validation: raw.validationHours,
            comunicacao_tecnica: raw.commTechHours,
            go_live: raw.goLiveHours,
            gp: raw.gpHours,
          },
        }
      : {
          lineItemHours: 0, discoveryHours: 0, validationHours: 0,
          goLiveHours: 0, commTechHours: 0, gpHours: 0, totalHours: 0,
          breakdown: {}, quantities: {},
          total: Number(resultHours) || 0,
          needsSC: Boolean(needsSC),
          variables: {},
        };

    // Só monta o relatório para quem pode vê-lo.
    const r = showExecutiveReport
      ? buildMarkdownReport(est, { ...f, clientName }, ei, t, dateLocale)
      : '';
    return { estimation: est, engineResult: raw, engineInputs: ei, report: r };
  }, [data, variablesMap, packages, clientName, resultHours, needsSC, showExecutiveReport, t, dateLocale]);

  const total = Math.max(0, Number(estimation?.total ?? resultHours ?? 0));
  const needsSCFinal = Boolean(estimation?.needsSC ?? needsSC);

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <h1 className="text-5xl font-black text-brand-dark tracking-tighter font-heading uppercase leading-none break-words">
            {String(clientName || '')}
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">{t('aeView.savedBanner')}</p>
          {parentId != null && (
            <Link
              href={`/ae/${parentId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-2xl hover:border-brand-primary hover:text-brand-primary transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest">{t('aeView.previousVersion')}</span>
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-start md:justify-end">
          <Link
            href="/ae/history"
            className="bg-white border border-slate-200 text-slate-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 hover:border-brand-primary hover:text-brand-primary transition-all"
          >
            <Clock className="w-4 h-4" />
            <span>{t('nav.history')}</span>
          </Link>
          <Link
            href="/ae"
            className="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 hover:border-brand-primary hover:text-brand-primary transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('ae.newSimulation')}</span>
          </Link>
          <Link
            href={`/ae?cloneFrom=${estimateId}`}
            className="brand-bg-primary text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 shadow-xl shadow-green-900/10 hover:scale-[1.02] transition-transform"
          >
            <Zap className="w-4 h-4" />
            <span>{t('aeView.createNewVersion')}</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2 bg-purple-50 text-purple-600 border border-purple-100 px-4 py-3 rounded-2xl">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[9px] font-black uppercase tracking-widest">
            {new Date(createdAt).toLocaleDateString(dateLocale)}
          </span>
        </div>

        {/* TAG DE VERSÃO CLICÁVEL — abre um container dropdown com TODAS as versões */}
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setVersionPickerOpen(o => !o)}
            aria-haspopup="dialog"
            aria-expanded={versionPickerOpen}
            className="w-full group flex items-center justify-between space-x-3 bg-slate-50 dark:bg-[color:var(--bg-card-solid)] text-slate-600 dark:text-[color:var(--text-main)] border border-slate-200 dark:border-[color:var(--border-main)] hover:border-brand-primary dark:hover:border-[color:var(--primary)] hover:text-brand-primary dark:hover:text-[color:var(--primary)] px-4 py-3 rounded-2xl transition-all duration-200"
          >
            <span className="flex items-center space-x-2">
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                Versão {version ?? 1} de {versions.length}
              </span>
            </span>
            <span className={`w-4 h-4 shrink-0 flex items-center justify-center`}>
              {versionPickerOpen
                ? <X className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
              }
            </span>
          </button>

          {versionPickerOpen && (
            <div
              role="dialog"
              aria-label={t('aeView.selectVersion')}
              className="
                absolute z-50 mt-3 w-full min-w-[280px]
                bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)]
                border border-slate-200 dark:border-[color:var(--border-main)]
                rounded-3xl shadow-2xl
                overflow-hidden
                animate-in fade-in slide-in-from-top-2
                duration-200
              "
            >
              <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-[color:var(--border-main)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                <div className="bg-brand-primary/10 p-2 rounded-xl text-brand-primary dark:text-[color:var(--primary)]">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-[color:var(--text-muted)]">
                    {t('common.versions')}
                  </p>
                  <p className="text-[10px] font-black tracking-wider text-brand-dark dark:text-[color:var(--text-main)]">
                    {String(clientName || t('common.client'))}
                  </p>
                </div>
              </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary dark:text-[color:var(--primary)]">
                  {versions.length} {versions.length === 1 ? 'versão' : 'versões'}
                </span>
              </div>

              <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                {versions.map((v) => {
                  const active = Number(v.id) === Number(estimateId);
                  return (
                    <Link
                      key={String(v.id)}
                      href={`/ae/${v.id}`}
                      onClick={() => setVersionPickerOpen(false)}
                      className={`
                        block w-full
                        p-4 rounded-2xl
                        border
                        transition-all duration-200
                        ${active
                          ? 'border-brand-primary dark:border-[color:var(--primary)] bg-brand-primary/5 dark:bg-[color:var(--primary)]/10'
                          : 'border-transparent hover:border-slate-200 dark:hover:border-[color:var(--border-main)] hover:bg-slate-50 dark:hover:bg-[color:var(--bg-input-solid)]'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col items-start leading-tight">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`
                              inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest
                              ${active
                                ? 'brand-bg-primary text-white'
                                : 'bg-slate-100 dark:bg-[color:var(--bg-input-solid)] text-slate-600 dark:text-[color:var(--text-main)] border border-slate-200 dark:border-[color:var(--border-main)]'
                              }
                            `}>
                              V{v.version}
                            </span>
                            {active && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-primary/10 dark:bg-[color:var(--primary)]/10 text-brand-primary dark:text-[color:var(--primary)] border border-brand-primary/20 dark:border-[color:var(--primary)]/30">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span className="text-[8px] font-black uppercase tracking-widest">{t('aeView.current')}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-[color:var(--text-muted)]">
                            {new Date(v.createdAt).toLocaleDateString(dateLocale)}
                          </p>
                        </div>

                        <div className={`
                          inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border
                          ${v.needsSC
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 border-amber-100 dark:border-amber-500/30'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/30'
                          }
                        `}>
                          {v.needsSC ? <AlertTriangle className="w-2 h-2" /> : <CheckCircle2 className="w-2 h-2" />}
                          <span>{v.needsSC ? t('aeHistory.needsSC') : t('aeHistory.aeEstimate')}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="px-5 py-3 border-t border-slate-100 dark:border-[color:var(--border-main)] bg-slate-50/60 dark:bg-[color:var(--bg-input-solid)]/40 flex items-center justify-between gap-3">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-[color:var(--text-muted)]">
                  {t('aeView.newVersionFromThis')}
                </span>
                <Link
                  href={`/ae?cloneFrom=${estimateId}`}
                  onClick={() => setVersionPickerOpen(false)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl brand-bg-primary text-white text-[9px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-transform"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Criar V{versions.length + 1}</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className={`flex items-center space-x-2 border px-4 py-3 rounded-2xl ${needsSCFinal ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
          {needsSCFinal ? (<AlertTriangle className="w-3.5 h-3.5" />) : (<CheckCircle2 className="w-3.5 h-3.5" />)}
          <span className="text-[9px] font-black uppercase tracking-widest">
            {needsSCFinal ? t('aeHistory.needsSC') : t('aeHistory.aeEstimate')}
          </span>
        </div>
        <div className="flex items-center space-x-2 bg-brand-primary/5 text-brand-primary border border-brand-primary/10 px-4 py-3 rounded-2xl">
          <Hash className="w-3.5 h-3.5" />
          <span className="text-[9px] font-black uppercase tracking-widest">
            {needsSCFinal ? t('aeView.consultSC') : `${total.toFixed(0)}H`}
          </span>
        </div>
      </div>

      {zohoLink ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand-primary/10 p-2.5 rounded-2xl text-brand-primary">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('aeView.zohoDeal')}</p>
              <a href={zohoLink} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-dark hover:text-brand-primary break-all">
                {zohoLink}
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-8 md:p-10 mb-8">
        <AEResultTable estimation={engineResult} inputs={engineInputs} />
      </div>

      {showExecutiveReport && (
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-10 pt-8 pb-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">{t('aeView.reportTitle')}</h2>
          <button
            onClick={() => {
              if (!report) return;
              try {
                navigator.clipboard.writeText(report);
              } catch (_) {
                const ta = document.createElement('textarea');
                ta.value = report;
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (e) {}
                document.body.removeChild(ta);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-500 rounded-2xl hover:border-brand-primary hover:text-brand-primary transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">{t('ae.copyMarkdown')}</span>
          </button>
        </div>
        <div className="px-8 md:px-10 py-10">
          <div className="prose prose-slate max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap break-words bg-transparent border border-slate-100 p-6 rounded-3xl text-[11px] leading-6 text-slate-700 font-medium tracking-tight">
{report}
            </pre>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
