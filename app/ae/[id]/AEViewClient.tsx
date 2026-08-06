'use client';

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
  facebook_pages: 'facebook_pages', telegram: 'telegram',
};

const MARKETPLACE_APP_LABEL_TO_KEY: Record<string, any> = {
  'WooCommerce': 'woocommerce', 'Woo Commerce': 'woocommerce',
  'Dialpad': 'dialpad', 'Aircall': 'aircall', 'VTEX': 'vtex',
  'Stripe': 'stripe', 'Pipedrive': 'pipedrive', 'SweetHawk': 'sweethawk',
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
    if (['Community', 'Copilot', 'QA', 'WFM'].includes(m)) return planRank >= PLAN_RANK.professional;
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

function buildMarkdownReport(est: any, f: any, engineInputs: any): string {
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
# Relatório Executivo — AE Estimate

**Cliente:** ${String(d.clientName || '')}
**Data da Estimativa:** ${new Date(Date.now()).toLocaleDateString('pt-BR')}
**Horas Totais:** **${num(total)}h**
**Sinalização SC:** ${est.needsSC ? '⚠️ Sim — consultar Sales Engineer' : '✅ Não — dentro do limite de AE'}

---

## 1. Escopo e premissas

- **Cliente / Projeto:** ${String(d.clientName || '')}
- **SKU / Tipo de Operação:** ${normalizeSku(d.skuType)} — ${Array.isArray(d.operationTypes) ? d.operationTypes.join(', ') : ''}
- **Ambiente / Deal:** ${d.deploymentType === 'optimization' ? 'Otimização de ambiente existente' : 'Implementação nova'}
- **Plano Zendesk:** ${String(d.zendeskPlan || 'professional').toUpperCase()}
- **Número de agentes:** ${Math.max(1, Number(d.agents) || 1)}
- **Marcas:** ${Math.max(1, Number(d.brands) || 1)}
- **Áreas / Filas:** ${Math.max(1, Number(d.areas) || 1)}
- **Idiomas operação:** ${Math.max(1, Number(d.operationLanguages) || 1)}
- **Módulos selecionados:** ${Array.isArray(d.selectedModules) ? d.selectedModules.join(', ') : 'Support'}
- **Objetivos do cliente:** ${String(d.clientObjectives || 'não informado')}
- **Indicadores de sucesso:** ${String(d.successIndicators || 'não informado')}

---

## 2. Breakdown por grupo de line-items

| Grupo | Horas |
| :--- | ---: |
${Object.entries<any>(bd).map(([k, v]) => `| ${String(k)} | ${num(v, 2)}h |`).join('\n')}
| **Subtotal (line-items = lineItemHours)** | **${num(lineItemHours, 2)}h** |

---

## 3. Quantidades e horas por módulo

### 3.1 Support / Central
- **Workshops** padrão por variáveis (engine) — consultar linha “Workshops” no breakdown.
- **Canais (qtd × H/unidade):**
${(engineInputs?.selectedChannels || []).map((c: string) => `  - ${String(c)} × ${chQty(c)} unid. → regra engine aplicada`).join('\n')}

### 3.2 Knowledge
- **Quantidade de artigos Knowledge:** ${Math.max(0, Number(d.knowledgeArticles) || 0)} (aplicado 0.10h/artigo, mínimo 2h se Guide).

### 3.3 Analytics
- **Tipo de treinamento analytics:** ${d.analyticsTrainingType === 'advanced' ? 'Avançado' : 'Standard'}

### 3.4 AI Agents
- Action Flows selecionados (se houver) × 4.5h cada.

---

## 4. Setup base (agentes / marcas / canais)

| Item | Regra engine | Valor |
| :--- | :--- | ---: |
| Agentes | ${Math.max(1, Number(d.agents) || 1)} × regra engine | — |
| Marcas | ${Math.max(1, Number(d.brands) || 1)} × regra engine | — |
| Canais (por unidade) | Aplicado por canal selecionado | — |

---

## 5. Integrações e apps

### 5.1 Apps Aktie Now / Native Connections
- Apps nativas selecionadas: ${Array.isArray(d.selectedNativeConnections) ? d.selectedNativeConnections.join(', ') || 'nenhum' : 'nenhum'}
- Regra engine flat 2h por conexão (se houver).

### 5.2 Side Conversations
- Teams: ${d.hasTeamsSideConv ? 'Sim (0.5h flat)' : 'Não'}
- Slack: ${d.hasSlackSideConv ? 'Sim (0.5h flat)' : 'Não'}

### 5.3 Marketplace
- Apps selecionados: ${Array.isArray(d.selectedApps) ? d.selectedApps.join(', ') || 'nenhum' : 'nenhum'}
- Regra SweetHawk ×2h / outros ×5h (engine breakdown.thirdPartyApps).

### 5.4 Action Flow
- Action Flows: ${Array.isArray(d.selectedActionFlows) ? d.selectedActionFlows.join(', ') || 'nenhum' : 'nenhum'}
- Flat 4.5h/ação.

### 5.5 SSO / Condicionais / Ticket Manager
- SSO: ${d.hasSSO ? 'Sim (2h)' : 'Não'}
- Condicionais (App): ${d.hasAppCondicionais ? 'Sim' : 'Não'}
- Ticket Manager (App): ${d.hasAppTicketManager ? 'Sim' : 'Não'}

---

## 6. Configs gerais / Treinamentos fixos

| Item | Aplicado |
| :--- | :--- |
| Treinamentos fixos por módulo (Workshops Idiomas Dinâmico SSO Knowledge) | Aplicados via engine |
| Analytics treinamento (standard / advanced) | ${d.analyticsTrainingType === 'advanced' ? 'Avançado' : 'Standard'} |

---

## 7. Variáveis e camadas (base correta)

**Base para %:** line-items − Treinamentos − Nativos − Apps → **${num(basePct, 2)}h**

| Variável | Regra | Horas |
| :--- | :--- | ---: |
| Discovery | 20% sobre a base | ${num(disc, 2)}h |
| Validação | 15% sobre a base | ${num(val, 2)}h |
| Comunicação Técnica | 10% sobre a base | ${num(ct, 2)}h |
| Go-live | 5% sobre a base | ${num(gl, 2)}h |
| Gestão de Projeto (GP) | 17.647% (gatilho > 30h) | ${num(gp, 2)}h |
| **Subtotal variáveis** | | **${num(disc + val + ct + gl + gp, 2)}h** |

---

## 8. Total consolidado

| Item | Horas |
| :--- | ---: |
| Line-items (subtotal acima) | ${num(lineItemHours, 2)}h |
| + Discovery | ${num(disc, 2)}h |
| + Validação | ${num(val, 2)}h |
| + Go-live | ${num(gl, 2)}h |
| + Comunicação Técnica | ${num(ct, 2)}h |
| + Gestão de Projeto (GP) | ${num(gp, 2)}h |
| **Esforço Total Estimado** | **${num(total, 2)}h** |

---

## 9. Sinalização Sales Engineer

${est.needsSC ? [
  '- ⚠️ **Requer envolvimento de Sales Engineer (SC).**',
  est.escalationMessage ? `- ${String(est.escalationMessage)}` : '',
  '- Critérios de trigger (engine): total > 60h OU artigos > 100 OU agentes > 100 OU marcas > 3 OU canais > 10 OU módulo AI Agents selecionado.',
].filter(Boolean).join('\n') : [
  '- ✅ Estimativa dentro dos limites para AE conduzir sem SC obrigatório.',
  '- Ainda assim, recomendamos revisão se houver ADPP, AI Agents ou integrações complexas não capturadas no escopo acima.',
].join('\n')}
`.trim();
}

export default function AEViewClient(props: any) {
  const {
    estimateId, clientName, zohoLink, resultHours, needsSC,
    version, createdAt, parentId, data, variables, packages, categories, allVersions,
  } = props;

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

  const { estimation, engineInputs, report } = useMemo(() => {
    const f = data || {};
    const ei = buildEngineInputs(f);
    const errs = validateAEInputs(ei, variablesMap, packages || []);
    const est = calculateAEEstimate(ei, variablesMap, packages || []);
    const r = buildMarkdownReport(est, { ...f, clientName }, ei);
    return { estimation: est, engineInputs: ei, report: r };
  }, [data, variablesMap, packages, clientName]);

  const total = Math.max(0, Number(estimation?.total ?? resultHours ?? 0));
  const needsSCFinal = Boolean(estimation?.needsSC ?? needsSC);

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <h1 className="text-5xl font-black text-brand-dark tracking-tighter font-heading uppercase leading-none break-words">
            {String(clientName || '')}
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Estimativa AE salva — Visualização.</p>
          {parentId != null && (
            <Link
              href={`/ae/${parentId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-2xl hover:border-brand-primary hover:text-brand-primary transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest">Ver versão anterior</span>
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-start md:justify-end">
          <Link
            href="/ae/history"
            className="bg-white border border-slate-200 text-slate-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 hover:border-brand-primary hover:text-brand-primary transition-all"
          >
            <Clock className="w-4 h-4" />
            <span>Histórico</span>
          </Link>
          <Link
            href="/ae"
            className="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 hover:border-brand-primary hover:text-brand-primary transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Simulação</span>
          </Link>
          <Link
            href={`/ae?cloneFrom=${estimateId}`}
            className="brand-bg-primary text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 shadow-xl shadow-green-900/10 hover:scale-[1.02] transition-transform"
          >
            <Zap className="w-4 h-4" />
            <span>Criar Nova Versão</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2 bg-purple-50 text-purple-600 border border-purple-100 px-4 py-3 rounded-2xl">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[9px] font-black uppercase tracking-widest">
            {new Date(createdAt).toLocaleDateString('pt-BR')}
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
              aria-label="Selecionar versão da estimativa"
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
                    Versões
                  </p>
                  <p className="text-[10px] font-black tracking-wider text-brand-dark dark:text-[color:var(--text-main)]">
                    {String(clientName || 'Cliente')}
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
                                <span className="text-[8px] font-black uppercase tracking-widest">Atual</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-[color:var(--text-muted)]">
                            {new Date(v.createdAt).toLocaleDateString('pt-BR')}
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
                          <span>{v.needsSC ? 'Needs SC' : 'AE Estimate'}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="px-5 py-3 border-t border-slate-100 dark:border-[color:var(--border-main)] bg-slate-50/60 dark:bg-[color:var(--bg-input-solid)]/40 flex items-center justify-between gap-3">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-[color:var(--text-muted)]">
                  Nova versão a partir desta
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
            {needsSCFinal ? 'Needs SC' : 'AE Estimate'}
          </span>
        </div>
        <div className="flex items-center space-x-2 bg-brand-primary/5 text-brand-primary border border-brand-primary/10 px-4 py-3 rounded-2xl">
          <Hash className="w-3.5 h-3.5" />
          <span className="text-[9px] font-black uppercase tracking-widest">
            {needsSCFinal ? 'Consultar SC' : `${total.toFixed(0)}H`}
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
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Deal no Zoho</p>
              <a href={zohoLink} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-dark hover:text-brand-primary break-all">
                {zohoLink}
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-10 pt-8 pb-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">Relatório da Estimativa</h2>
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
            <span className="text-[9px] font-black uppercase tracking-widest">Copiar Markdown</span>
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
    </div>
  );
}
