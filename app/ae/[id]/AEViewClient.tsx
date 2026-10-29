'use client';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/LanguageProvider';
import { canViewExecutiveReport } from '@/lib/segments';
import AEResultTable from '@/components/AEResultTable';
import AEInputsSummary from '@/components/AEInputsSummary';
import AEConfigVersionNotice, { type AEConfigInfo } from '@/components/AEConfigVersionNotice';
import ExportPreview from '@/components/ExportPreview';
import { buildAEResultTable } from '@/lib/ae-result-table';
import { aeInputDetails } from '@/lib/ae-input-details';
import { packageName } from '@/lib/localized-names';
import { normalizeSegment } from '@/lib/segments';
import {
  exportCsv, exportXlsx, exportPdf, exportPng, safeFileBase,
  type ExportDocument, type ExportFormat,
} from '@/lib/project-export';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from "next/link";
import {
  Zap, ArrowLeft, ExternalLink, MessageSquare, ShieldCheck, Shield, Settings, Users, Bot, Layout, Activity,
  Clock, BookOpen, Hash, Search, CheckCircle2, AlertTriangle, Plus, ChevronDown, X, Layers, Download, Loader2
} from "lucide-react";
import {
  calculateAEEstimate,
  validateAEInputs,
  type AEInputData,
} from '@/lib/ae-engine';
import { buildAEScopePrompt, marketplaceAppsForPrompt, type AEScopePromptInput } from '@/lib/ae-scope-prompt';
import { zohoSectionFor } from '@/lib/zoho-section';
import { buildEngineInputs, normalizeAESku } from '@/lib/ae-inputs';
import { DEFAULT_AE_CONFIG } from '@/lib/ae-config';

// Conversão do JSON salvo → inputs do engine: a MESMA implementação da tela
// de cálculo (lib/ae-inputs.ts). A cópia local lia os canais de
// `selectedChannels`, mas o save grava `channels` — toda estimativa reaberta
// era recalculada só com "Web Form".
const normalizeSku = normalizeAESku;


export default function AEViewClient(props: any) {
  const {
    estimateId, clientName, zohoLink, resultHours, needsSC,
    version, createdAt, parentId, data, variables, packages, categories, allVersions,
    owner, aeConfig = DEFAULT_AE_CONFIG, aeConfigInfo,
  } = props as typeof props & { aeConfigInfo?: AEConfigInfo };

  const { t } = useTranslation();
  const { language, dateLocale } = useLanguage();
  const { data: session } = useSession();
  // Dono da estimativa: visível só para administradores.
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

  const { estimation, engineResult, engineInputs } = useMemo(() => {
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

    return { estimation: est, engineResult: raw, engineInputs: ei };
  }, [data, resultHours, needsSC, aeConfig]);

  const total = Math.max(0, Number(estimation?.total ?? resultHours ?? 0));
  const needsSCFinal = Boolean(estimation?.needsSC ?? needsSC);

  // O que foi preenchido na Calculadora: visível para todos com acesso.
  const inputDetails = useMemo(() => {
    const byName = new Map((packages || []).map((p: any) => [p.name, p]));
    return aeInputDetails(data, t, {
      clientName: String(clientName || ''),
      packageLabel: (name) => (byName.has(name) ? packageName(byName.get(name), language) : name),
    });
  }, [data, t, clientName, packages, language]);

  /* ------------------------------------------------------------------------ */
  /*      EXPORTAÇÃO (CSV, XLSX, PDF, PNG) — mesma tabela que o leitor vê      */
  /* ------------------------------------------------------------------------ */
  // Account Executive vê só a lista de itens; os demais, quantidades e horas.
  const itemsOnly = normalizeSegment((session?.user as any)?.role) === 'AE';
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const exportPreviewRef = useRef<HTMLDivElement>(null);

  const exportDocument = useMemo<ExportDocument>(() => {
    const table = buildAEResultTable(engineResult, engineInputs, t);
    const rows = table.sections.flatMap((section) => section.rows.map((row) => ({
      section: section.title,
      item: row.label,
      quantity: row.qty,
      unitHours: row.unitHours,
      total: row.hours,
    })));
    const columns: ExportDocument['columns'] = itemsOnly
      ? [{ key: 'section', label: t('aeReport.block'), width: 36 }, { key: 'item', label: t('aeTable.item'), width: 60 }]
      : [
          { key: 'section', label: t('aeReport.block'), width: 36 },
          { key: 'item', label: t('aeTable.item'), width: 52 },
          { key: 'quantity', label: t('aeTable.qty'), numeric: true, width: 10 },
          { key: 'unitHours', label: t('aeTable.unit'), numeric: true, width: 10 },
          { key: 'total', label: t('aeTable.hours'), numeric: true, width: 12 },
        ];
    const r: any = engineResult || {};
    const summary: ExportDocument['summary'] = itemsOnly || !engineResult ? [] : [
      { label: t('aeTable.lineItems'), hours: Number(r.lineItemHours) || 0, level: 0 },
      { label: t('ae.discovery'), hours: Number(r.discoveryHours) || 0, level: 1 },
      { label: t('ae.validation'), hours: Number(r.validationHours) || 0, level: 1 },
      { label: t('ae.goLive'), hours: Number(r.goLiveHours) || 0, level: 1 },
      { label: t('ae.techComm'), hours: Number(r.commTechHours) || 0, level: 1 },
      { label: t('ae.gp'), hours: Number(r.gpHours) || 0, level: 1 },
    ];
    return {
      locale: language,
      fileBase: safeFileBase(`${clientName || 'estimativa'}-v${version ?? 1}`),
      title: String(clientName || ''),
      meta: [
        { label: t('export.version'), value: `V${version ?? 1}` },
        { label: t('aeHistory.colStatus'), value: needsSCFinal ? t('aeHistory.needsSC') : t('aeHistory.aeEstimate') },
        { label: t('export.generatedAt'), value: new Date().toLocaleString(dateLocale) },
      ],
      columns,
      rows,
      details: { title: t('aeView.inputsTitle'), items: inputDetails.map((d) => ({ label: d.label, value: d.value })) },
      summaryTitle: t('aeTable.title'),
      summary,
      grandTotalLabel: t('aeTable.grandTotal'),
      grandTotal: needsSCFinal && itemsOnly ? null : total,
      grandTotalNote: t('aeView.consultSC'),
      hoursUnit: t('common.hours'),
    };
  }, [engineResult, engineInputs, t, itemsOnly, language, clientName, version, needsSCFinal, dateLocale, inputDetails, total]);

  const handleExport = async (format: ExportFormat) => {
    setIsExportMenuOpen(false);
    setExportingFormat(format);
    try {
      if (format === 'csv') exportCsv(exportDocument);
      else if (format === 'xlsx') await exportXlsx(exportDocument);
      else if (format === 'pdf') await exportPdf(exportDocument);
      else {
        // O PNG fotografa uma prévia montada fora da tela (ver render).
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (exportPreviewRef.current) await exportPng(exportPreviewRef.current, exportDocument.fileBase);
      }
    } catch (e: any) {
      console.error('[export]', e);
      alert(`${t('export.failed')}\n\n${e?.message || String(e)}`);
    } finally {
      setExportingFormat(null);
    }
  };

  /* ------------------------------------------------------------------------ */
  /*        EXPORTAÇÃO DO ESCOPO COMO PROMPT PARA A SKILL scope-creator        */
  /* ------------------------------------------------------------------------ */

  /**
   * Mesmo prompt da tela de cálculo, montado a partir do RECÁLCULO desta
   * estimativa salva. Antes o botão só existia logo depois de calcular, então
   * reabrir a estimativa pelo histórico deixava o usuário sem saída a não ser
   * refazer a simulação inteira.
   */
  const scopePromptInput = useMemo<AEScopePromptInput>(() => {
    const d = data || {};
    const appQuantities = (d.appQuantities || {}) as Record<string, number>;
    return {
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
      otherApp: Array.isArray(d.selectedApps) && d.selectedApps.includes('Outros') ? d.otherApp || '' : '',
      hasAppCondicionais: Boolean(d.hasAppCondicionais),
      hasAppTicketManager: Boolean(d.hasAppTicketManager),
      locale: language,
      skuLabel:
        normalizeSku(d.skuType) === 'ES'
          ? t('plans.employeeService')
          : t('plans.customerService'),
      generatedAt: new Date(),
    };
  }, [engineResult, engineInputs, data, clientName, version, zohoLink, session, language, t]);

  const scopePrompt = useMemo(() => buildAEScopePrompt(scopePromptInput), [scopePromptInput]);

  const [scopePromptCopied, setScopePromptCopied] = useState(false);
  const [scopePromptLoading, setScopePromptLoading] = useState(false);

  const handleCopyScopePrompt = async () => {
    if (!scopePrompt) return;
    setScopePromptLoading(true);
    const zohoSection = await zohoSectionFor(scopePromptInput.zohoLink);
    setScopePromptLoading(false);
    const text = buildAEScopePrompt({ ...scopePromptInput, zohoSection });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
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
            <span>{t('ae.myHistory')}</span>
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
            disabled={!scopePrompt || scopePromptLoading}
            title={t('aeView.copyScopePromptHint')}
            className={`px-6 py-3 rounded-2xl text-label font-medium flex items-center space-x-2 transition-all disabled:opacity-50 ${
              scopePromptCopied
                ? 'brand-bg-primary text-brand-ink border-2 border-transparent'
                : 'border-2 border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-[color:var(--bg-main)]'
            }`}
          >
            {scopePromptLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : scopePromptCopied ? <CheckCircle2 className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            <span>{scopePromptLoading ? t('editor.scopePromptLoadingZoho') : scopePromptCopied ? t('aeView.scopePromptCopied') : t('aeView.copyScopePrompt')}</span>
          </button>
          {/* Exportação: mesma tabela que o leitor vê + os dados informados. */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((v) => !v)}
              disabled={exportingFormat !== null}
              aria-haspopup="menu"
              aria-expanded={isExportMenuOpen}
              className="px-6 py-3 rounded-2xl text-label font-medium flex items-center gap-2 transition-all disabled:opacity-50 border-2 border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-[color:var(--bg-main)]"
            >
              {exportingFormat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{t('export.button')}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {isExportMenuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-56 z-[60] bg-white dark:bg-[color:var(--bg-card-solid)] border border-slate-200 dark:border-[color:var(--border-main)] rounded-2xl shadow-2xl overflow-hidden">
                {([
                  ['csv', t('export.formatCsv')],
                  ['xlsx', t('export.formatXlsx')],
                  ['pdf', t('export.formatPdf')],
                  ['png', t('export.formatPng')],
                ] as Array<[ExportFormat, string]>).map(([format, label]) => (
                  <button
                    key={format}
                    type="button"
                    role="menuitem"
                    onClick={() => void handleExport(format)}
                    className="w-full text-left px-4 py-3 text-label font-medium text-brand-dark dark:text-[color:var(--text-main)] hover:bg-slate-50 dark:hover:bg-[color:var(--bg-input)] transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
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

      <AEInputsSummary details={inputDetails} />

      {sessionIsAdmin && aeConfigInfo && <AEConfigVersionNotice info={aeConfigInfo} dateLocale={dateLocale} />}

      {exportingFormat === 'png' && <ExportPreview ref={exportPreviewRef} doc={exportDocument} />}
    </div>
  );
}
