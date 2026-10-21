'use client';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/LanguageProvider';
import { canViewExecutiveReport } from '@/lib/segments';
import AEResultTable from '@/components/AEResultTable';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from "next/link";
import {
  Zap, ArrowLeft, ExternalLink, MessageSquare, ShieldCheck, Shield, Settings, Users, Bot, Layout, Activity,
  Clock, BookOpen, Hash, Search, Copy, CheckCircle2, AlertTriangle, Plus, ChevronDown, X, Layers
} from "lucide-react";
import {
  calculateAEEstimate,
  validateAEInputs,
  type AEInputData,
} from '@/lib/ae-engine';
import { buildAEScopePrompt, marketplaceAppsForPrompt } from '@/lib/ae-scope-prompt';
import {
  CHANNEL_LEGACY_TO_KEY,
  MARKETPLACE_APP_LABEL_TO_KEY,
  buildEngineInputs,
  normalizeAESku,
} from '@/lib/ae-inputs';
import { DEFAULT_AE_CONFIG } from '@/lib/ae-config';

// Conversão do JSON salvo → inputs do engine: a MESMA implementação da tela
// de cálculo (lib/ae-inputs.ts). A cópia local lia os canais de
// `selectedChannels`, mas o save grava `channels` — toda estimativa reaberta
// era recalculada só com "Web Form".
const normalizeSku = normalizeAESku;

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
  // Base e percentuais do PRÓPRIO cálculo (configuração usada na estimativa);
  // estimativas antigas caem nos padrões de fábrica.
  const basePct = Number.isFinite(Number(est.percentBase))
    ? Math.max(0, Number(est.percentBase))
    : Math.max(0, lineItemHours - Number(bd.training || 0) - Number(bd.nativeConnections || 0) - Number(bd.thirdPartyApps || 0));
  const PCT = est.percents || { discovery: 0.2, validacao: 0.15, go_live: 0.05, comunicacao_tecnica: 0.1, gerente_projetos: 0.176470588235294, limite_gerente_projetos: 30 };
  const UH = est.unitHours || { artigo: 0.1, knowledge_minimo: 2, integracao_nativa: 2, conversa_paralela: 0.5, action_flow: 4.5 };
  const fmtPct = (fraction: number) => `${Number((Number(fraction || 0) * 100).toFixed(3))}%`;
  const appRate = (key: string, fallback: number) => Number(est.appRates?.[key] ?? fallback);

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
- **${t('report.selectedModules')}:** ${Array.isArray(d.selectedModules) ? d.selectedModules.join(', ') : 'Support'}
- **${t('report.clientObjectives')}:** ${String(d.clientObjectives || t('report.notProvided'))}
- **${t('report.successIndicators')}:** ${String(d.successIndicators || t('report.notProvided'))}

---

## ${t('report.section2')}

| ${t('report.group')} | ${t('report.hours')} |
| :--- | ---: |
${Object.entries<any>(bd).map(([k, v]) => `| ${t(`aeBreakdown.${k}`, { defaultValue: String(k) })} | ${num(v, 2)}h |`).join('\n')}
| **${t('report.subtotalLineItems')}** | **${num(lineItemHours, 2)}h** |

---

## ${t('report.section3')}

### ${t('report.section31')}
- ${t('report.workshopsNote')}
- ${t('report.channelsQty')}
${(engineInputs?.selectedChannels || []).map((c: string) => `  - ${String(c)} × ${chQty(c)} ${t('report.engineRuleApplied')}`).join('\n')}

### ${t('report.section32')}
- ${t('report.knowledgeArticles')} ${Math.max(0, Number(d.knowledgeArticles) || 0)} ${t('report.knowledgeRule', { rate: num(UH.artigo, 2), min: num(UH.knowledge_minimo, 2) })}

### ${t('report.section34')}
- ${t('report.actionFlowsNote', { hours: num(UH.action_flow, 2) })}

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
- ${t('report.nativeFlatRule', { hours: num(UH.integracao_nativa, 2) })}

### ${t('report.section52')}
- Teams: ${d.hasTeamsSideConv ? t('report.yesFlat05', { hours: num(UH.conversa_paralela, 2) }) : t('common.no')}
- Slack: ${d.hasSlackSideConv ? t('report.yesFlat05', { hours: num(UH.conversa_paralela, 2) }) : t('common.no')}

### ${t('report.section53')}
- ${t('report.selectedApps')} ${Array.isArray(d.selectedApps) ? d.selectedApps.join(', ') || t('common.none').toLowerCase() : t('common.none').toLowerCase()}
- ${t('report.marketplaceRule', { sweethawk: num(appRate('sweethawk', 2), 2), other: num(appRate('other_marketplace', 5), 2) })}

### ${t('report.section54')}
- ${t('report.actionFlows')} ${Array.isArray(d.selectedActionFlows) ? d.selectedActionFlows.join(', ') || t('common.none').toLowerCase() : t('common.none').toLowerCase()}
- ${t('report.flatPerAction', { hours: num(UH.action_flow, 2) })}

### ${t('report.section55')}
- SSO: ${d.hasSSO ? t('report.yes2h') : t('common.no')}
- ${t('report.conditionalsApp')}: ${d.hasAppCondicionais ? t('common.yes') : t('common.no')}
- ${t('report.ticketManagerApp')}: ${d.hasAppTicketManager ? t('common.yes') : t('common.no')}

---

## ${t('report.section6')}

| ${t('common.item')} | ${t('report.applied')} |
| :--- | :--- |
| ${t('report.fixedTrainingRow')} | ${t('report.appliedViaEngine')} |

---

## ${t('report.section7')}

${t('report.basePct')} **${num(basePct, 2)}h**

| ${t('report.variable')} | ${t('report.rule')} | ${t('report.hours')} |
| :--- | :--- | ---: |
| ${t('ae.discovery')} | ${fmtPct(PCT.discovery)} ${t('report.pctOverBase')} | ${num(disc, 2)}h |
| ${t('ae.validation')} | ${fmtPct(PCT.validacao)} ${t('report.pctOverBase')} | ${num(val, 2)}h |
| ${t('report.techComm')} | ${fmtPct(PCT.comunicacao_tecnica)} ${t('report.pctOverBase')} | ${num(ct, 2)}h |
| ${t('ae.goLive')} | ${fmtPct(PCT.go_live)} ${t('report.pctOverBase')} | ${num(gl, 2)}h |
| ${t('report.projectMgmt')} | ${fmtPct(PCT.gerente_projetos)} ${t('report.gpTrigger', { threshold: num(PCT.limite_gerente_projetos, 0) })} | ${num(gp, 2)}h |
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
    owner, aeConfig = DEFAULT_AE_CONFIG,
  } = props;

  const { t } = useTranslation();
  const { language, dateLocale } = useLanguage();
  const { data: session } = useSession();
  // Relatório Executivo: só administradores. Os demais ficam com a tabela.
  const showExecutiveReport = canViewExecutiveReport(session?.user as any);
  const sessionIsAdmin = Boolean((session?.user as any)?.isAdmin) || (String((session?.user as any)?.role || '').toUpperCase() === 'ADMIN');
  const ownerChip = showExecutiveReport && owner
    ? {
        id: Number(owner.id),
        name: String(owner.name || owner.email || ''),
        email: String(owner.email || ''),
        role: String(owner.role || ''),
      }
    : null;
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
        raw = calculateAEEstimate(ei, aeConfig);
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
  }, [data, variablesMap, packages, clientName, resultHours, needsSC, showExecutiveReport, t, dateLocale, aeConfig]);

  const total = Math.max(0, Number(estimation?.total ?? resultHours ?? 0));
  const needsSCFinal = Boolean(estimation?.needsSC ?? needsSC);

  /* ------------------------------------------------------------------------ */
  /*        EXPORTAÇÃO DO ESCOPO COMO PROMPT PARA A SKILL scope-creator        */
  /* ------------------------------------------------------------------------ */

  /**
   * Mesmo prompt da tela de cálculo, montado a partir do RECÁLCULO desta
   * estimativa salva. Antes o botão só existia logo depois de calcular, então
   * reabrir a estimativa pelo histórico deixava o usuário sem saída a não ser
   * refazer a simulação inteira.
   */
  const scopePrompt = useMemo(() => {
    const d = data || {};
    const appQuantities = (d.appQuantities || {}) as Record<string, number>;
    return buildAEScopePrompt({
      estimate: engineResult,
      inputs: engineInputs,
      clientName: String(clientName || ''),
      versionLabel: version != null ? `v${version}` : 'v1',
      zohoLink: zohoLink || null,
      preSalesName: (session?.user as any)?.name || null,
      clientObjectives: d.clientObjectives || null,
      successIndicators: d.successIndicators || null,
      deploymentType: d.deploymentType === 'optimization' ? 'optimization' : 'new',
      // Mesma lista da tela de cálculo (ver marketplaceAppsForPrompt).
      marketplaceApps: marketplaceAppsForPrompt(d.selectedApps, appQuantities),
      hasAppCondicionais: Boolean(d.hasAppCondicionais),
      hasAppTicketManager: Boolean(d.hasAppTicketManager),
      locale: language,
      skuLabel:
        normalizeSku(d.skuType) === 'ES'
          ? t('plans.employeeService')
          : t('plans.customerService'),
      generatedAt: new Date(),
    });
  }, [engineResult, engineInputs, data, clientName, version, zohoLink, session, language, t]);

  const [scopePromptCopied, setScopePromptCopied] = useState(false);

  const handleCopyScopePrompt = async () => {
    if (!scopePrompt) return;
    try {
      await navigator.clipboard.writeText(scopePrompt);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = scopePrompt;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
    }
    setScopePromptCopied(true);
    setTimeout(() => setScopePromptCopied(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <h1 className="text-brand-dark font-heading text-page leading-none break-words">
            {String(clientName || '')}
          </h1>
          <p className="text-slate-400 text-label font-medium ">{t('aeView.savedBanner')}</p>
          {ownerChip && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 text-brand-dark dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] border border-slate-200 dark:border-[color:var(--border-main)]">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span className="text-caption font-medium ">
                {t('common.owner')} · {ownerChip.name || ownerChip.email || t('common.unknown')}
                {ownerChip.role ? ` (${ownerChip.role})` : ''}
              </span>
            </div>
          )}
          {parentId != null && (
            <Link
              href={`/ae/${parentId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-2xl hover:border-brand-primary hover:text-brand-primary transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="text-caption font-medium ">{t('aeView.previousVersion')}</span>
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-start md:justify-end">
          <Link
            href="/ae/history"
            className="bg-white border border-slate-200 text-slate-400 px-6 py-3 rounded-2xl text-label font-medium flex items-center space-x-2 hover:border-brand-primary hover:text-brand-primary transition-all"
          >
            <Clock className="w-4 h-4" />
            <span>{t('nav.history')}</span>
          </Link>
          <Link
            href="/ae"
            className="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-2xl text-label font-medium flex items-center space-x-2 hover:border-brand-primary hover:text-brand-primary transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('ae.newSimulation')}</span>
          </Link>
          {/* Copia o escopo como prompt pronto para a skill scope-creator.
              A geração do documento é manual e proposital: nada aqui chama a
              API da Claude. */}
          <button
            type="button"
            onClick={handleCopyScopePrompt}
            disabled={!scopePrompt}
            title={t('aeView.copyScopePromptHint')}
            className={`px-6 py-3 rounded-2xl text-label font-medium flex items-center space-x-2 transition-all disabled:opacity-50 ${
              scopePromptCopied
                ? 'brand-bg-primary text-brand-ink border-2 border-transparent'
                : 'border-2 border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-[color:var(--bg-main)]'
            }`}
          >
            {scopePromptCopied ? <CheckCircle2 className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            <span>{scopePromptCopied ? t('aeView.scopePromptCopied') : t('aeView.copyScopePrompt')}</span>
          </button>
          <Link
            href={`/ae?cloneFrom=${estimateId}`}
            className="brand-bg-primary text-brand-ink px-8 py-3 rounded-2xl text-label font-medium flex items-center space-x-2 shadow-xl shadow-green-900/10 hover:scale-[1.02] transition-transform"
          >
            <Zap className="w-4 h-4" />
            <span>{t('aeView.createNewVersion')}</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2 bg-slate-100 text-brand-dark border border-slate-200 px-4 py-3 rounded-2xl">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-caption font-medium ">
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
              <span className="text-caption font-medium whitespace-nowrap">
                {t('aeView.versionOf', { version: version ?? 1, total: versions.length })}
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
                bg-white dark:bg-[color:var(--bg-card-solid)]
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
                  <p className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)]">
                    {t('common.versions')}
                  </p>
                  <p className="text-label font-medium text-brand-dark dark:text-[color:var(--text-main)]">
                    {String(clientName || t('common.client'))}
                  </p>
                </div>
              </div>
                <span className="text-caption font-medium text-brand-primary dark:text-[color:var(--primary)]">
                  {t('aeHistory.versionCount', { count: versions.length })}
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
                              inline-flex items-center px-2.5 py-1 rounded-lg text-caption font-medium  
                              ${active
                                ? 'brand-bg-primary text-brand-ink'
                                : 'bg-slate-100 dark:bg-[color:var(--bg-input-solid)] text-slate-600 dark:text-[color:var(--text-main)] border border-slate-200 dark:border-[color:var(--border-main)]'
                              }
                            `}>
                              V{v.version}
                            </span>
                            {active && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-primary/10 dark:bg-[color:var(--primary)]/10 text-brand-primary dark:text-[color:var(--primary)] border border-brand-primary/20 dark:border-[color:var(--primary)]/30">
                                <CheckCircle2 className="w-3.5 h-3.5.5" />
                                <span className="text-caption font-medium ">{t('aeView.current')}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)]">
                            {new Date(v.createdAt).toLocaleDateString(dateLocale)}
                          </p>
                        </div>

                        <div className={`
                          inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-caption font-medium   border
                          ${v.needsSC
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 border-amber-100 dark:border-amber-500/30'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/30'
                          }
                        `}>
                          {v.needsSC ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>{v.needsSC ? t('aeHistory.needsSC') : t('aeHistory.aeEstimate')}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="px-5 py-3 border-t border-slate-100 dark:border-[color:var(--border-main)] bg-slate-50/60 dark:bg-[color:var(--bg-input-solid)]/40 flex items-center justify-between gap-3">
                <span className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)]">
                  {t('aeView.newVersionFromThis')}
                </span>
                <Link
                  href={`/ae?cloneFrom=${estimateId}`}
                  onClick={() => setVersionPickerOpen(false)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl brand-bg-primary text-brand-ink text-caption font-medium shadow-lg hover:scale-[1.02] transition-transform"
                >
                  <Plus className="w-3.5 h-3.5.5" />
                  <span>{t('aeView.createVersion', { name: `V${versions.length + 1}` })}</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className={`flex items-center space-x-2 border px-4 py-3 rounded-2xl ${needsSCFinal ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
          {needsSCFinal ? (<AlertTriangle className="w-3.5 h-3.5" />) : (<CheckCircle2 className="w-3.5 h-3.5" />)}
          <span className="text-caption font-medium ">
            {needsSCFinal ? t('aeHistory.needsSC') : t('aeHistory.aeEstimate')}
          </span>
        </div>
        <div className="flex items-center space-x-2 bg-brand-primary/5 text-brand-primary border border-brand-primary/10 px-4 py-3 rounded-2xl">
          <Hash className="w-3.5 h-3.5" />
          <span className="text-caption font-medium ">
            {needsSCFinal ? t('aeView.consultSC') : `${total.toFixed(0)}H`}
          </span>
        </div>
      </div>

      {zohoLink ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand-primary/10 p-2.5 rounded-2xl text-brand-primary">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div>
              <p className="text-caption font-medium text-slate-400">{t('aeView.zohoDeal')}</p>
              <a href={zohoLink} target="_blank" rel="noreferrer" className="text-label font-bold text-brand-dark hover:text-brand-primary break-all">
                {zohoLink}
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 md:p-10 mb-8">
        <AEResultTable estimation={engineResult} inputs={engineInputs} />
      </div>

      {showExecutiveReport && (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-10 pt-8 pb-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-xl font-bold text-brand-dark tracking-tight">{t('aeView.reportTitle')}</h2>
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
            <span className="text-caption font-medium ">{t('ae.copyMarkdown')}</span>
          </button>
        </div>
        <div className="px-8 md:px-10 py-10">
          <div className="prose prose-slate max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap break-words bg-transparent border border-slate-100 p-6 rounded-3xl text-label leading-6 text-slate-700 font-medium tracking-tight">
{report}
            </pre>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
