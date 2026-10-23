'use client';

/**
 * Painel Admin › Calculadora AE.
 *
 * Edita a configuração do engine da Calculadora AE: percentuais, limites de
 * revisão por Sales Engineer, os números (horas unitárias, configurações
 * gerais, treinamentos, workshops, apps, itens fixos, fatores), as fórmulas de
 * quantidade e de base e o VÍNCULO de cada hora com um item da biblioteca — a
 * biblioteca é a fonte da verdade; o "ajuste manual" fixa um valor próprio.
 * Cada "Salvar" cria uma versão nova; estimativas já salvas continuam com a
 * versão (e as horas) com que foram calculadas.
 */

import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import {
  Calculator, Save, RotateCcw, Loader2, AlertTriangle, CheckCircle2, ChevronDown, History, FlaskConical, Percent, Hash, Sigma, Link2,
  Download, Upload,
} from 'lucide-react';
import {
  ALL_FORMULAS, APP_FORMULAS, APP_VARIABLES, BASE_FORMULAS, BASE_VARIABLES, BINDABLE_NUMBERS, DEFAULT_AE_CONFIG, FIXED_QTY_FORMULAS,
  INPUT_VARIABLES, QUANTITY_FORMULAS, diffAEConfigs, isBindablePath, normalizeAEConfig, numberAt, resolveAEConfig, resolveBindings,
  suggestBindings, validateAEConfig, type AEBinding, type AEConfig, type AELibraryItem, type FormulaSpec,
} from '@/lib/ae-config';
import { aeNumberGroupLabel, aeNumberLabel } from '@/lib/ae-number-labels';
import { buildAeConfigExport, parseAeConfigImport } from '@/lib/ae-config-io';
import { calculateAEEstimate, validateAEInputs, type AEInputData } from '@/lib/ae-engine';
import { FORMULA_FUNCTION_NAMES } from '@/lib/formula';
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes';
import { saveAeConfigAction } from '@/app/admin/ae_config_actions';

type Section = 'percents' | 'numbers' | 'formulas' | 'test' | 'history';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function parseLocaleNumber(text: string): number {
  const n = parseFloat(String(text).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function formatLocaleNumber(value: number, language: string): string {
  if (!Number.isFinite(value)) return '';
  const text = String(Number(value.toFixed(10)));
  return language === 'en' ? text : text.replace('.', ',');
}

/** Campo numérico que aceita vírgula ou ponto e não perde o que está sendo digitado. */
function NumberField({
  value, onChange, language, suffix, scale = 1, invalid,
}: {
  value: number; onChange: (n: number) => void; language: string; suffix?: string; scale?: number; invalid?: boolean;
}) {
  const shown = formatLocaleNumber(value * scale, language);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className="relative inline-flex items-center w-full">
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? shown}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseLocaleNumber(e.target.value);
          onChange(Number.isFinite(n) ? n / scale : NaN);
        }}
        onBlur={() => setDraft(null)}
        className={`w-full bg-white dark:bg-[color:var(--bg-input-solid)] border rounded-lg px-3 py-2 text-label font-medium tabular-nums outline-none focus:ring-2 focus:ring-brand-primary ${
          invalid ? 'border-red-400' : 'border-slate-200 dark:border-[color:var(--border-main)]'
        } ${suffix ? 'pr-9' : ''}`}
      />
      {suffix && <span className="absolute right-3 text-caption text-slate-400">{suffix}</span>}
    </span>
  );
}

/** Amostra usada na prévia das fórmulas e na aba de teste. */
const DEFAULT_SAMPLE = {
  agents: 30,
  brands: 2,
  areas: 3,
  zendeskPlan: 'professional',
  skuType: 'CS',
  operationTypes: ['B2C'],
  modules: ['Support', 'Knowledge'],
  email: 2,
  web_widget: 1,
  whatsapp: 1,
  voice: 0,
  knowledgeArticles: 50,
};

function sampleToInputs(sample: typeof DEFAULT_SAMPLE): AEInputData {
  const channels = (['email', 'web_widget', 'whatsapp', 'voice'] as const).filter((c) => Number((sample as any)[c]) > 0);
  const channelQuantities: any = {};
  channels.forEach((c) => { channelQuantities[c] = Number((sample as any)[c]); });
  return {
    agents: Math.max(1, sample.agents),
    brands: Math.max(1, sample.brands),
    areas: Math.max(1, sample.areas),
    skuType: sample.skuType as any,
    zendeskPlan: sample.zendeskPlan as any,
    operationTypes: sample.operationTypes as any,
    selectedModules: (sample.modules.length ? sample.modules : ['Support']) as any,
    selectedChannels: (channels.length ? channels : ['email']) as any,
    channelQuantities: channels.length ? channelQuantities : { email: 1 },
    knowledgeArticles: Math.max(0, sample.knowledgeArticles),
    selectedNativeConnections: [],
    selectedActionFlows: [],
    selectedApps: [],
    appQuantities: {},
    hasAppCondicionais: true,
    hasAppTicketManager: true,
    hasSSO: false,
    hasTeamsSideConv: false,
    hasSlackSideConv: false,
  };
}

/** Grupos de Números com vínculo à biblioteca (os fatores não têm). */
const BINDABLE_GROUPS = ['horas_unitarias', 'configuracoes_gerais', 'treinamentos', 'workshops', 'apps', 'itens_fixos'];

/** Estilo dos botões de alternância da aba Testar (mesmo das seções). */
const toggleClass = (on: boolean) =>
  `px-3 py-1.5 rounded-xl text-caption font-medium border transition-colors ${
    on ? 'brand-bg-primary text-brand-ink border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:text-brand-dark'
  }`;

export default function AEConfigAdmin({ activeAeConfig, aeConfigHistory, library, focusVersion }: {
  activeAeConfig: any;
  aeConfigHistory: any[];
  library?: AELibraryItem[];
  /** Versão a abrir no histórico (link da página da estimativa); 'factory' = padrão de fábrica. */
  focusVersion?: string | null;
}) {
  const { t } = useTranslation();
  const { language, dateLocale } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const libraryItems = useMemo(() => library || [], [library]);
  const libraryById = useMemo(() => new Map(libraryItems.map((i) => [i.id, i])), [libraryItems]);
  const libraryGroups = useMemo(() => {
    const groups = new Map<string, AELibraryItem[]>();
    libraryItems.forEach((item) => {
      const key = item.categoryName || '—';
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [libraryItems]);

  const savedConfig: AEConfig = useMemo(() => normalizeAEConfig(activeAeConfig?.config || DEFAULT_AE_CONFIG), [activeAeConfig]);
  // Versão ainda sem vínculos: o rascunho já vem com as sugestões por nome, que
  // só passam a valer quando o admin salvar uma versão nova.
  const pendingActivation = !savedConfig.bindings;
  const initialDraft: AEConfig = useMemo(() => {
    const base = clone(savedConfig);
    if (!base.bindings) base.bindings = suggestBindings(libraryItems);
    return base;
  }, [savedConfig, libraryItems]);
  const [draft, setDraft] = useState<AEConfig>(() => clone(initialDraft));
  const [section, setSection] = useState<Section>(focusVersion ? 'history' : 'percents');
  const [expandedVersion, setExpandedVersion] = useState<string | null>(focusVersion || null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  const [showVariables, setShowVariables] = useState(false);
  const lang = language;
  const label = (path: string) => aeNumberLabel(path, t, lang);

  useEffect(() => {
    if (!focusVersion) return;
    const timer = setTimeout(() => {
      document.getElementById(`ae-version-${focusVersion}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => clearTimeout(timer);
  }, [focusVersion]);

  const issues = useMemo(() => validateAEConfig(draft), [draft]);
  const issuesByField = useMemo(() => {
    const map: Record<string, string[]> = {};
    issues.forEach((i) => { (map[i.field] = map[i.field] || []).push(i.message); });
    return map;
  }, [issues]);

  // Compara já normalizado (ex.: espaços nas pontas do nome da categoria, que o
  // servidor remove ao salvar) — senão o rascunho nunca voltaria a "salvo".
  const isDirty = JSON.stringify(normalizeAEConfig(draft)) !== JSON.stringify(normalizeAEConfig(initialDraft))
    || issues.length > 0;
  useUnsavedChangesGuard(isDirty && !isPending, t('common.unsavedChangesConfirm'));
  const canSave = (isDirty || pendingActivation) && !isPending;

  const setNumber = (path: string[], value: number) => {
    setDraft((prev) => {
      const next = clone(prev) as any;
      let node = next.numbers;
      path.slice(0, -1).forEach((k) => { node = node[k]; });
      node[path[path.length - 1]] = value;
      return next;
    });
  };
  const getNumber = (path: string[]): number => numberAt(draft.numbers, path.join('.'));
  const setFormula = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, formulas: { ...prev.formulas, [key]: value } }));
  };

  // ------------------------------------------------------------- vínculos
  const resolved = useMemo(() => resolveBindings(draft, libraryItems), [draft, libraryItems]);
  const bindingOf = (path: string): AEBinding => draft.bindings?.[path] || { packageId: null, override: false };
  const setBinding = (path: string, patch: Partial<AEBinding>) => {
    setDraft((prev) => {
      const next = clone(prev) as AEConfig;
      const current = next.bindings?.[path] || { packageId: null, override: false };
      const updated: AEBinding = { ...current, ...patch };
      if (updated.packageId == null) updated.override = false;
      // Ligar o ajuste manual começa do valor atual da biblioteca.
      if (patch.override === true && !current.override && updated.packageId != null) {
        const item = libraryById.get(updated.packageId);
        if (item) {
          const keys = path.split('.');
          let node: any = next.numbers;
          keys.slice(0, -1).forEach((k) => { node = node[k]; });
          node[keys[keys.length - 1]] = Number(item.hours) || 0;
        }
      }
      next.bindings = { ...(next.bindings || {}), [path]: updated };
      return next;
    });
  };
  const overridePaths = BINDABLE_NUMBERS.map((b) => b.path).filter((path) => bindingOf(path).override);
  const matchedCount = BINDABLE_NUMBERS.filter((b) => resolved[b.path]?.item).length;

  // ---------------------------------------------------------------- prévia
  const sampleInputs = useMemo(() => sampleToInputs(sample), [sample]);
  const sampleValid = useMemo(() => validateAEInputs(sampleInputs).valid, [sampleInputs]);
  const preview = useMemo(() => {
    if (!sampleValid) return null;
    const run = (cfg: AEConfig) => {
      try { return calculateAEEstimate(sampleInputs, resolveAEConfig(cfg, libraryItems)); } catch { return null; }
    };
    return { saved: run(savedConfig), draft: issues.length ? null : run(draft) };
  }, [sampleInputs, sampleValid, savedConfig, draft, issues.length, libraryItems]);

  const handleSave = (resetToFactory = false) => {
    if (!resetToFactory && issues.length) {
      setStatus({ kind: 'error', message: t('aeConfig.fixErrorsFirst', { count: issues.length }) });
      return;
    }
    if (resetToFactory && !confirm(t('aeConfig.confirmFactoryReset'))) return;
    setStatus(null);
    startTransition(async () => {
      try {
        const result: any = await saveAeConfigAction(resetToFactory ? null : draft, resetToFactory ? t('aeConfig.factoryResetNote') : note, resetToFactory);
        if (result.success) {
          setNote('');
          if (resetToFactory) setDraft({ ...clone(DEFAULT_AE_CONFIG), bindings: suggestBindings(libraryItems) });
          setStatus({ kind: 'ok', message: t('aeConfig.saved', { id: result.id }) });
        } else {
          const details = (result.issues || []).map((i: any) => `• ${i.field}: ${i.message}`).join('\n');
          setStatus({ kind: 'error', message: details ? `${result.error}\n${details}` : result.error });
        }
      } catch (e: any) {
        setStatus({ kind: 'error', message: `${t('aeConfig.saveFailed')}: ${e?.message || String(e)}` });
      }
    });
  };

  // ------------------------------------------------- exportar / importar
  // Arquivo JSON pensado para revisar a configuração com a Claude (traz
  // instruções e referência junto); a importação carrega no rascunho, para
  // revisar e salvar como versão nova.
  const handleExportConfig = () => {
    const file = buildAeConfigExport({
      config: normalizeAEConfig(draft),
      library: libraryItems,
      basedOnVersion: activeAeConfig?.id ?? null,
      includesUnsavedChanges: isDirty || pendingActivation,
      numberLabel: label,
      lang,
    });
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `calculadora-ae-config-${activeAeConfig?.id ? `v${activeAeConfig.id}` : 'fabrica'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const handleImportConfig = async (file: File) => {
    if (isDirty && !confirm(t('aeConfig.importConfirmReplace'))) return;
    const result = parseAeConfigImport(await file.text(), libraryItems, draft);
    if (!result.ok) {
      setStatus({ kind: 'error', message: t('aeConfig.importInvalid') });
      return;
    }
    setDraft(result.config);
    const changes = diffAEConfigs(normalizeAEConfig(initialDraft), result.config).length;
    const problems = validateAEConfig(result.config).length;
    const lines = [t('aeConfig.imported', { count: changes })];
    if (result.unknownItems.length) lines.push(t('aeConfig.importUnknownItems', { items: result.unknownItems.join(', ') }));
    if (problems) lines.push(t('aeConfig.importedWithIssues', { count: problems }));
    setStatus({ kind: problems || result.unknownItems.length ? 'error' : 'ok', message: lines.join('\n') });
  };

  const NUMBER_GROUPS: Array<{ key: string; title: string }> = [
    { key: 'horas_unitarias', title: t('aeConfig.groupUnitHours') },
    { key: 'configuracoes_gerais', title: t('aeConfig.groupGeneralConfig') },
    { key: 'treinamentos', title: t('aeConfig.groupTraining') },
    { key: 'workshops', title: t('aeConfig.groupWorkshops') },
    { key: 'apps', title: t('aeConfig.groupApps') },
    { key: 'itens_fixos', title: t('aeConfig.groupFixedItems') },
    { key: 'fatores_plano', title: t('aeConfig.groupPlanFactors') },
    { key: 'fatores_operacao', title: t('aeConfig.groupOperationFactors') },
  ];

  const fmtNum = (v: number) => formatLocaleNumber(Math.round((Number(v) || 0) * 100) / 100, language);
  const fmtH = (v: number | undefined) => `${fmtNum(Number(v) || 0)}h`;

  /** Linha de uma hora vinculável: item da biblioteca, horas e ajuste manual. */
  const renderBindingRow = (path: string) => {
    const binding = bindingOf(path);
    const r = resolved[path];
    const item = r?.item || null;
    return (
      <tr key={path} className="border-b border-slate-100 dark:border-[color:var(--border-main)] align-top">
        <td className="py-2 pr-3 text-label font-medium text-brand-dark dark:text-[color:var(--text-main)]">{label(path)}</td>
        <td className="py-2 pr-3">
          <select
            value={binding.packageId ?? ''}
            onChange={(e) => setBinding(path, { packageId: e.target.value ? Number(e.target.value) : null })}
            className={`w-full bg-white dark:bg-[color:var(--bg-input-solid)] border rounded-lg px-2 py-2 text-label outline-none focus:ring-2 focus:ring-brand-primary ${
              r?.missing ? 'border-red-400' : 'border-slate-200 dark:border-[color:var(--border-main)]'
            }`}
          >
            <option value="">{t('aeConfig.unbound')}</option>
            {libraryGroups.map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({fmtH(i.hours)})</option>)}
              </optgroup>
            ))}
          </select>
          {r?.missing && <p className="text-caption text-red-600 mt-1">{t('aeConfig.bindingMissing')}</p>}
          {binding.packageId == null && <p className="text-caption text-slate-400 mt-1">{t('aeConfig.unboundHint')}</p>}
        </td>
        <td className="py-2 pr-3 w-32">
          {item && !binding.override ? (
            <span className="block text-right text-label font-medium tabular-nums py-2">{fmtH(item.hours)}</span>
          ) : (
            <NumberField value={getNumber(path.split('.'))} onChange={(n) => setNumber(path.split('.'), n)} language={language} suffix="h" invalid={Boolean(issuesByField[path])} />
          )}
        </td>
        <td className="py-2 w-28 text-center">
          <label className={`inline-flex items-center gap-2 py-2 ${item ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`} title={t('aeConfig.overrideHint')}>
            <input type="checkbox" disabled={!item} checked={binding.override} onChange={(e) => setBinding(path, { override: e.target.checked })} className="accent-amber-500 w-4 h-4" />
            <span className="text-caption font-medium text-slate-500">{t('aeConfig.manual')}</span>
          </label>
        </td>
      </tr>
    );
  };

  /** Linha de um número que não é hora de item (mínimos, padrões): só a Calculadora. */
  const renderPlainRow = (path: string) => (
    <tr key={path} className="border-b border-slate-100 dark:border-[color:var(--border-main)] align-top">
      <td className="py-2 pr-3 text-label font-medium text-brand-dark dark:text-[color:var(--text-main)]">{label(path)}</td>
      <td className="py-2 pr-3 text-caption text-slate-400 pt-3">{t('aeConfig.onlyCalculator')}</td>
      <td className="py-2 pr-3 w-32">
        <NumberField value={getNumber(path.split('.'))} onChange={(n) => setNumber(path.split('.'), n)} language={language} suffix="h" invalid={Boolean(issuesByField[path])} />
      </td>
      <td className="py-2 w-28 text-center text-caption text-slate-300 pt-3">—</td>
    </tr>
  );

  const bindingTableHead = (
    <thead>
      <tr className="border-b border-slate-200 dark:border-[color:var(--border-main)] text-caption text-slate-400">
        <th className="text-left py-2 pr-3 font-medium">{t('aeConfig.colAeItem')}</th>
        <th className="text-left py-2 pr-3 font-medium">{t('aeConfig.colLibraryItem')}</th>
        <th className="text-right py-2 pr-3 font-medium">{t('aeConfig.colHours')}</th>
        <th className="text-center py-2 font-medium">{t('aeConfig.colOverride')}</th>
      </tr>
    </thead>
  );

  /** Grupo com vínculos: tabela (itens fixos com um subtítulo por bloco). */
  const renderBindableGroup = (group: string) => {
    const node = (draft.numbers as any)[group];
    if (group === 'itens_fixos') {
      return (
        <div className="space-y-2">
          <p className="text-caption text-slate-500">{t('aeConfig.fixedQtyNote')}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              {bindingTableHead}
              <tbody>
                {Object.keys(node).map((sub) => (
                  <Fragment key={sub}>
                    <tr><td colSpan={4} className="pt-4 pb-1 text-caption font-bold text-slate-400">{aeNumberGroupLabel(group, sub, t)}</td></tr>
                    {Object.keys(node[sub]).map((key) => renderBindingRow(`${group}.${sub}.${key}`))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    const paths = Object.keys(node).map((key) => `${group}.${key}`);
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          {bindingTableHead}
          <tbody>
            {paths.filter(isBindablePath).map(renderBindingRow)}
            {paths.filter((p) => !isBindablePath(p)).map(renderPlainRow)}
          </tbody>
        </table>
      </div>
    );
  };

  /** Fatores de plano / operação: grade simples, só da Calculadora. */
  const renderFactorGroup = (group: string) => {
    const node = (draft.numbers as any)[group];
    return (
      <div className="space-y-4">
        {Object.keys(node).map((sub) => (
          <div key={sub} className="space-y-2">
            <div className="text-caption font-bold text-slate-400">{aeNumberGroupLabel(group, sub, t)}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.keys(node[sub]).map((key) => {
                const path = [group, sub, key];
                const field = path.join('.');
                return (
                  <label key={field} className="space-y-1">
                    <span className="block text-caption font-medium text-slate-500 truncate" title={field}>{label(field).split(' · ').pop()}</span>
                    <NumberField value={getNumber(path)} onChange={(n) => setNumber(path, n)} language={language} invalid={Boolean(issuesByField[field])} />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const formulaPreviewValue = (spec: FormulaSpec): string => {
    const run = preview?.draft;
    if (!run) return '—';
    if (QUANTITY_FORMULAS.some((f) => f.key === spec.key)) {
      return formatLocaleNumber(Number((run.quantities as any)[spec.key] || 0), language);
    }
    if (spec.key.startsWith('qtd_')) {
      const line = run.details.fixedItems.find((l) => l.key === spec.key.slice(4));
      return line ? formatLocaleNumber(line.qty, language) : '—';
    }
    if (spec.key === 'horas_app_condicionais') return formatLocaleNumber(Number(run.breakdown.appCondicionais || 0), language);
    if (spec.key === 'horas_app_ticket_manager') return formatLocaleNumber(Number(run.breakdown.appTicketManager || 0), language);
    return '—';
  };

  const renderFormula = (spec: FormulaSpec) => {
    const value = draft.formulas[spec.key] ?? spec.default;
    const fieldIssues = issuesByField[spec.key] || [];
    const changed = value !== spec.default;
    return (
      <div key={spec.key} className={`rounded-2xl border p-4 space-y-2 ${fieldIssues.length ? 'border-red-300 bg-red-50/40' : 'border-slate-200 dark:border-[color:var(--border-main)]'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{spec.label[lang]}</span>
            <code className="ml-2 text-caption text-slate-400">{spec.key}</code>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-caption text-slate-500">{t('aeConfig.sampleValue')}: <b className="tabular-nums">{formulaPreviewValue(spec)}</b></span>
            {changed && (
              <button type="button" onClick={() => setFormula(spec.key, spec.default)} className="text-caption font-medium text-slate-400 hover:text-brand-primary inline-flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> {t('aeConfig.restoreDefault')}
              </button>
            )}
          </div>
        </div>
        <textarea
          value={value}
          onChange={(e) => setFormula(spec.key, e.target.value)}
          rows={Math.min(4, Math.max(1, Math.ceil(value.length / 90)))}
          spellCheck={false}
          className="w-full font-mono text-label bg-white dark:bg-[color:var(--bg-input-solid)] border border-slate-200 dark:border-[color:var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary"
        />
        {changed && (
          <div className="text-caption text-slate-400 font-mono break-all">{t('aeConfig.defaultFormula')}: {spec.default}</div>
        )}
        {fieldIssues.map((msg, i) => (
          <div key={i} className="text-caption font-medium text-red-600 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{msg}</div>
        ))}
      </div>
    );
  };

  const PERCENT_FIELDS: Array<{ path: string[]; label: string; percent: boolean }> = [
    { path: ['percentuais', 'discovery'], label: t('ae.discovery'), percent: true },
    { path: ['percentuais', 'validacao'], label: t('ae.validation'), percent: true },
    { path: ['percentuais', 'go_live'], label: t('ae.goLive'), percent: true },
    { path: ['percentuais', 'comunicacao_tecnica'], label: t('ae.techComm'), percent: true },
    { path: ['percentuais', 'gerente_projetos'], label: t('ae.gp'), percent: true },
    { path: ['percentuais', 'limite_gerente_projetos'], label: t('aeConfig.gpThreshold'), percent: false },
  ];
  const SE_FIELDS: Array<{ key: string; label: string }> = [
    { key: 'total_horas', label: t('aeConfig.seTotalHours') },
    { key: 'artigos_knowledge', label: t('aeConfig.seArticles') },
    { key: 'agentes', label: t('aeConfig.seAgents') },
    { key: 'marcas', label: t('aeConfig.seBrands') },
    { key: 'quantidade_canais', label: t('aeConfig.seChannels') },
  ];

  const sectionButton = (id: Section, text: string, Icon: any) => (
    <button
      key={id}
      type="button"
      onClick={() => setSection(id)}
      className={`px-5 py-2.5 rounded-2xl text-label font-medium transition-all flex items-center gap-2 ${
        section === id ? 'brand-bg-primary text-brand-ink shadow' : 'text-slate-500 hover:bg-white hover:text-brand-dark'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {text}
    </button>
  );

  // ---------------------------------------------------------------- histórico
  const formulaLabel = (key: string) => ALL_FORMULAS.find((f) => f.key === key)?.label[lang] || key;
  const diffFieldLabel = (field: string) => {
    if (field.startsWith('numbers.')) return label(field.slice(8));
    if (field.startsWith('formulas.')) return `${t('aeConfig.sectionFormulas')}: ${formulaLabel(field.slice(9))}`;
    if (field.startsWith('bindings.')) return `${t('aeConfig.bindingLabel')}: ${label(field.slice(9))}`;
    if (field === 'settings.nativeIntegrationsCategory') return t('aeConfig.nativeCategoryTitle');
    return field;
  };
  const diffValue = (field: string, value: string) => {
    if (field.startsWith('bindings.')) {
      const match = value.match(/^#(\d+)(.*)$/);
      if (match) {
        const item = libraryById.get(Number(match[1]));
        return `${item ? item.name : `#${match[1]}`}${match[2] ? ` · ${t('aeConfig.manual')}` : ''}`;
      }
      return t('aeConfig.unbound');
    }
    const n = Number(value);
    return field.startsWith('numbers.') && value !== '—' && Number.isFinite(n) ? fmtNum(n) : value;
  };

  const renderVersionDetails = (config: AEConfig, isActive: boolean) => {
    const base = isActive ? normalizeAEConfig(DEFAULT_AE_CONFIG) : savedConfig;
    const diffs = diffAEConfigs(base, config);
    return (
      <div className="mt-4 rounded-2xl border border-slate-200 dark:border-[color:var(--border-main)] overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-[color:var(--bg-input-solid)] text-caption font-medium text-slate-500">
          {isActive ? t('aeConfig.diffVsFactory') : t('aeConfig.diffVsActive')}
        </div>
        {diffs.length === 0 ? (
          <p className="px-4 py-4 text-label text-slate-500">{t('aeConfig.noDiff')}</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-label">
              <thead>
                <tr className="text-caption text-slate-400 border-b border-slate-100">
                  <th className="text-left px-4 py-2 font-medium">{t('aeConfig.diffField')}</th>
                  <th className="text-left px-4 py-2 font-medium">{isActive ? t('aeConfig.factoryEntry') : t('aeConfig.diffActive')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('aeConfig.diffThis')}</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <tr key={d.field} className="border-b border-slate-50 align-top">
                    <td className="px-4 py-2 text-brand-dark dark:text-[color:var(--text-main)]">{diffFieldLabel(d.field)}</td>
                    <td className="px-4 py-2 text-slate-500 font-mono text-caption break-all">{diffValue(d.field, d.from)}</td>
                    <td className="px-4 py-2 text-brand-dark dark:text-[color:var(--text-main)] font-mono text-caption break-all">{diffValue(d.field, d.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const historyEntries: any[] = aeConfigHistory || [];
  const focusMissing = focusVersion && focusVersion !== 'factory' && !historyEntries.some((e) => String(e.id) === focusVersion);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Cabeçalho: versão ativa + salvar */}
      <div className="bg-white dark:bg-[color:var(--bg-card)] rounded-3xl border border-slate-200 dark:border-[color:var(--border-main)] shadow-xl p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 brand-bg-primary rounded-2xl flex items-center justify-center text-brand-ink shadow-lg shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-brand-dark dark:text-[color:var(--text-main)] text-title font-bold">{t('aeConfig.title')}</h2>
              <p className="text-label text-slate-500 mt-1 max-w-2xl">{t('aeConfig.subtitle')}</p>
              <p className="text-caption text-slate-400 mt-2">
                {activeAeConfig?.id
                  ? t('aeConfig.activeVersion', {
                      id: activeAeConfig.id,
                      date: activeAeConfig.createdAt ? new Date(activeAeConfig.createdAt).toLocaleString(dateLocale) : '',
                    })
                  : t('aeConfig.activeFactory')}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:min-w-[420px]">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder={t('aeConfig.notePlaceholder')}
              className="flex-1 bg-slate-50 dark:bg-[color:var(--bg-input-solid)] border border-slate-200 dark:border-[color:var(--border-main)] rounded-xl px-4 py-3 text-label outline-none focus:ring-2 focus:ring-brand-primary"
            />
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={!canSave}
              className="brand-bg-primary text-brand-ink px-6 py-3 rounded-xl text-label font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('aeConfig.saveNewVersion')}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isDirty && <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-caption font-medium">{t('aeConfig.unsaved')}</span>}
          {issues.length > 0 && <span className="px-3 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 text-caption font-medium">{t('aeConfig.errorCount', { count: issues.length })}</span>}
          {isDirty && (
            <button type="button" onClick={() => setDraft(clone(initialDraft))} className="text-caption font-medium text-slate-400 hover:text-brand-dark inline-flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> {t('aeConfig.discardChanges')}
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-4">
            <button type="button" onClick={handleExportConfig} title={t('aeConfig.exportConfigHint')} className="text-caption font-medium text-slate-500 hover:text-brand-dark inline-flex items-center gap-1">
              <Download className="w-3 h-3" /> {t('aeConfig.exportConfig')}
            </button>
            <label title={t('aeConfig.importConfigHint')} className={`text-caption font-medium text-slate-500 hover:text-brand-dark inline-flex items-center gap-1 ${isPending ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
              <Upload className="w-3 h-3" /> {t('aeConfig.importConfig')}
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  e.target.value = '';
                  if (picked) void handleImportConfig(picked);
                }}
              />
            </label>
            <button type="button" onClick={() => handleSave(true)} disabled={isPending} className="text-caption font-medium text-slate-400 hover:text-red-600 inline-flex items-center gap-1 disabled:opacity-50">
              <RotateCcw className="w-3 h-3" /> {t('aeConfig.factoryReset')}
            </button>
          </div>
        </div>
        {pendingActivation && (
          <div className="rounded-2xl px-4 py-3 text-label flex items-start gap-2 bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
            <Link2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <b>{t('aeConfig.bindingsPendingTitle')}</b>{' '}
              {t('aeConfig.bindingsPendingText', { matched: matchedCount, total: BINDABLE_NUMBERS.length })}
            </span>
          </div>
        )}
        {status && (
          <div className={`rounded-2xl px-4 py-3 text-label whitespace-pre-wrap flex items-start gap-2 ${status.kind === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {status.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{status.message}</span>
          </div>
        )}
      </div>

      <div className="bg-slate-50/50 p-2 rounded-3xl border border-slate-300 w-fit flex flex-wrap gap-1">
        {sectionButton('percents', t('aeConfig.sectionPercents'), Percent)}
        {sectionButton('numbers', t('aeConfig.sectionNumbers'), Hash)}
        {sectionButton('formulas', t('aeConfig.sectionFormulas'), Sigma)}
        {sectionButton('test', t('aeConfig.sectionTest'), FlaskConical)}
        {sectionButton('history', t('aeConfig.sectionHistory'), History)}
      </div>

      {section === 'percents' && (
        <div className="bg-white dark:bg-[color:var(--bg-card)] rounded-3xl border border-slate-200 dark:border-[color:var(--border-main)] shadow-xl p-8 space-y-8">
          <div className="space-y-3">
            <h3 className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{t('aeConfig.percentsTitle')}</h3>
            <p className="text-caption text-slate-500">{t('aeConfig.percentsHint')}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {PERCENT_FIELDS.map((f) => (
                <label key={f.path.join('.')} className="space-y-1">
                  <span className="block text-caption font-medium text-slate-500">{f.label}</span>
                  <NumberField
                    value={getNumber(f.path)}
                    onChange={(n) => setNumber(f.path, n)}
                    language={language}
                    scale={f.percent ? 100 : 1}
                    suffix={f.percent ? '%' : 'h'}
                    invalid={Boolean(issuesByField[f.path.join('.')])}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{t('aeConfig.seTitle')}</h3>
            <p className="text-caption text-slate-500">{t('aeConfig.seHint')}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {SE_FIELDS.map((f) => (
                <label key={f.key} className="space-y-1">
                  <span className="block text-caption font-medium text-slate-500">{f.label}</span>
                  <NumberField value={getNumber(['sales_engineer', f.key])} onChange={(n) => setNumber(['sales_engineer', f.key], n)} language={language} invalid={Boolean(issuesByField[`sales_engineer.${f.key}`])} />
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{t('aeConfig.nativeCategoryTitle')}</h3>
            <p className="text-caption text-slate-500">{t('aeConfig.nativeCategoryHint')}</p>
            <input
              type="text"
              value={draft.settings.nativeIntegrationsCategory}
              onChange={(e) => setDraft((prev) => ({ ...prev, settings: { ...prev.settings, nativeIntegrationsCategory: e.target.value } }))}
              className="w-full max-w-md bg-white dark:bg-[color:var(--bg-input-solid)] border border-slate-200 dark:border-[color:var(--border-main)] rounded-lg px-3 py-2 text-label outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
        </div>
      )}

      {section === 'numbers' && (
        <div className="space-y-6">
          <p className="text-caption text-slate-500 max-w-3xl">{t('aeConfig.bindingsIntro')}</p>
          {/* Valores com ajuste manual: em destaque, para nunca passarem despercebidos. */}
          {overridePaths.length > 0 && (
            <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/40 p-6 space-y-3">
              <h3 className="text-label font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {t('aeConfig.overridesTitle', { count: overridePaths.length })}
              </h3>
              <p className="text-caption text-amber-800 dark:text-amber-300">{t('aeConfig.overridesHint')}</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-caption text-amber-800/70 dark:text-amber-300/70 border-b border-amber-200">
                      <th className="text-left py-2 pr-3 font-medium">{t('aeConfig.colAeItem')}</th>
                      <th className="text-left py-2 pr-3 font-medium">{t('aeConfig.colLibraryItem')}</th>
                      <th className="text-right py-2 pr-3 font-medium">{t('aeConfig.colManualValue')}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {overridePaths.map((path) => {
                      const item = resolved[path]?.item;
                      return (
                        <tr key={path} className="border-b border-amber-100 align-middle">
                          <td className="py-2 pr-3 text-label font-medium text-amber-950 dark:text-amber-100">{label(path)}</td>
                          <td className="py-2 pr-3 text-label text-amber-900 dark:text-amber-200">
                            {item ? `${item.name} · ${t('aeConfig.libraryHours', { hours: fmtH(item.hours) })}` : t('aeConfig.bindingMissing')}
                          </td>
                          <td className="py-2 pr-3 w-32">
                            <NumberField value={getNumber(path.split('.'))} onChange={(n) => setNumber(path.split('.'), n)} language={language} suffix="h" invalid={Boolean(issuesByField[path])} />
                          </td>
                          <td className="py-2 text-right">
                            <button type="button" onClick={() => setBinding(path, { override: false })} className="text-caption font-medium text-amber-800 hover:text-amber-950 underline underline-offset-2">
                              {t('aeConfig.turnOffOverride')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {NUMBER_GROUPS.map((group) => (
            <details key={group.key} open={group.key === 'horas_unitarias'} className="bg-white dark:bg-[color:var(--bg-card)] rounded-3xl border border-slate-200 dark:border-[color:var(--border-main)] shadow p-6 group">
              <summary className="cursor-pointer list-none flex items-center justify-between">
                <span className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{group.title}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-5">
                {BINDABLE_GROUPS.includes(group.key) ? renderBindableGroup(group.key) : renderFactorGroup(group.key)}
              </div>
            </details>
          ))}
        </div>
      )}

      {section === 'formulas' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[color:var(--bg-card)] rounded-3xl border border-slate-200 dark:border-[color:var(--border-main)] shadow p-6 space-y-3">
            <h3 className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{t('aeConfig.syntaxTitle')}</h3>
            <p className="text-caption text-slate-500 whitespace-pre-line">{t('aeConfig.syntaxHelp', { functions: FORMULA_FUNCTION_NAMES.join(', ') })}</p>
            <button type="button" onClick={() => setShowVariables((v) => !v)} className="text-caption font-medium text-brand-primary inline-flex items-center gap-1">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showVariables ? 'rotate-180' : ''}`} />
              {showVariables ? t('aeConfig.hideVariables') : t('aeConfig.showVariables')}
            </button>
            {showVariables && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 max-h-[420px] overflow-auto border-t border-slate-100 pt-3">
                {[...INPUT_VARIABLES, ...QUANTITY_FORMULAS.map((f) => ({ name: f.key, description: { pt: `Quantidade: ${f.label.pt}`, en: `Quantity: ${f.label.en}`, es: `Cantidad: ${f.label.es}` } })), ...APP_VARIABLES, ...BASE_VARIABLES].map((v) => (
                  <div key={v.name} className="text-caption flex gap-2">
                    <code className="text-brand-dark dark:text-[color:var(--text-main)] font-bold shrink-0">{v.name}</code>
                    <span className="text-slate-500">{v.description[lang]}</span>
                  </div>
                ))}
              </div>
            )}
            {!sampleValid && <p className="text-caption text-amber-600">{t('aeConfig.sampleInvalid')}</p>}
          </div>
          <div className="space-y-3">
            <h3 className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{t('aeConfig.quantityFormulas')}</h3>
            {QUANTITY_FORMULAS.map(renderFormula)}
          </div>
          <div className="space-y-3">
            <h3 className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{t('aeConfig.fixedQtyFormulas')}</h3>
            <p className="text-caption text-slate-500">{t('aeConfig.fixedQtyFormulasHint')}</p>
            {FIXED_QTY_FORMULAS.map(renderFormula)}
          </div>
          <div className="space-y-3">
            <h3 className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{t('aeConfig.appFormulas')}</h3>
            {APP_FORMULAS.map(renderFormula)}
          </div>
          <div className="space-y-3">
            <h3 className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{t('aeConfig.baseFormulas')}</h3>
            {BASE_FORMULAS.map(renderFormula)}
          </div>
        </div>
      )}

      {section === 'test' && (
        <div className="bg-white dark:bg-[color:var(--bg-card)] rounded-3xl border border-slate-200 dark:border-[color:var(--border-main)] shadow-xl p-8 space-y-6">
          <p className="text-caption text-slate-500">{t('aeConfig.testHint')}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['agents', 'brands', 'areas', 'knowledgeArticles', 'email', 'web_widget', 'whatsapp', 'voice'] as const).map((key) => (
              <label key={key} className="space-y-1">
                <span className="block text-caption font-medium text-slate-500">{t(`aeConfig.sample_${key}`)}</span>
                <NumberField value={Number((sample as any)[key])} onChange={(n) => setSample((s) => ({ ...s, [key]: Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0 }))} language={language} />
              </label>
            ))}
            <label className="space-y-1">
              <span className="block text-caption font-medium text-slate-500">{t('plans.tier')}</span>
              <select value={sample.zendeskPlan} onChange={(e) => setSample((s) => ({ ...s, zendeskPlan: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-label">
                {['team', 'growth', 'professional', 'enterprise'].map((p) => <option key={p} value={p}>{t(`ae.plan${p.charAt(0).toUpperCase()}${p.slice(1)}`)}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-caption font-medium text-slate-500">{t('ae.sku')}</span>
              <select value={sample.skuType} onChange={(e) => setSample((s) => ({ ...s, skuType: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-label">
                <option value="CS">{t('plans.customerService')}</option>
                <option value="ES">{t('plans.employeeService')}</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Support', 'Knowledge', 'Community', 'Analytics', 'Voice', 'Copilot', 'QA', 'WFM', 'ADPP'].map((m) => {
              const on = sample.modules.includes(m);
              return (
                <button key={m} type="button" aria-pressed={on} onClick={() => setSample((s) => ({ ...s, modules: on ? s.modules.filter((x) => x !== m) : [...s.modules, m] }))} className={toggleClass(on)}>
                  {m}
                </button>
              );
            })}
            <span className="w-px self-stretch bg-slate-200 mx-1" aria-hidden />
            {['B2C', 'B2B', 'B2E'].map((op) => {
              const on = sample.operationTypes.includes(op);
              return (
                <button key={op} type="button" aria-pressed={on} onClick={() => setSample((s) => ({ ...s, operationTypes: on ? s.operationTypes.filter((x) => x !== op) : [...s.operationTypes, op] }))} className={toggleClass(on)}>
                  {op}
                </button>
              );
            })}
          </div>
          {!sampleValid ? (
            <p className="text-label text-amber-600">{t('aeConfig.sampleInvalid')}</p>
          ) : (
            <table className="w-full text-label">
              <thead>
                <tr className="border-b border-slate-200 text-caption text-slate-400">
                  <th className="text-left py-2">{t('aeConfig.testLine')}</th>
                  <th className="text-right py-2">{t('aeConfig.testSaved')}</th>
                  <th className="text-right py-2">{t('aeConfig.testDraft')}</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['lineItemHours', t('aeConfig.testLineItems')],
                  ['discoveryHours', t('ae.discovery')],
                  ['validationHours', t('ae.validation')],
                  ['goLiveHours', t('ae.goLive')],
                  ['commTechHours', t('ae.techComm')],
                  ['gpHours', t('ae.gp')],
                  ['totalHours', t('aeConfig.testTotal')],
                ] as Array<[string, string]>).map(([key, text]) => {
                  const a = (preview?.saved as any)?.[key];
                  const b = (preview?.draft as any)?.[key];
                  const differs = preview?.draft && Math.abs((Number(a) || 0) - (Number(b) || 0)) > 0.005;
                  return (
                    <tr key={key} className={`border-b border-slate-50 ${key === 'totalHours' ? 'font-bold' : ''}`}>
                      <td className="py-2">{text}</td>
                      <td className="py-2 text-right tabular-nums">{fmtH(a)}</td>
                      <td className={`py-2 text-right tabular-nums ${differs ? 'text-amber-600 font-bold' : ''}`}>{preview?.draft ? fmtH(b) : '—'}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="py-2">{t('aeConfig.testNeedsSE')}</td>
                  <td className="py-2 text-right">{preview?.saved?.requiresSalesEngineer ? t('common.yes') : t('common.no')}</td>
                  <td className="py-2 text-right">{preview?.draft ? (preview.draft.requiresSalesEngineer ? t('common.yes') : t('common.no')) : '—'}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {section === 'history' && (
        <div className="bg-white dark:bg-[color:var(--bg-card)] rounded-3xl border border-slate-200 dark:border-[color:var(--border-main)] shadow-xl overflow-hidden">
          {focusMissing && (
            <p className="px-8 py-4 text-label text-amber-800 bg-amber-50 border-b border-amber-200">{t('aeConfig.focusMissing', { id: focusVersion })}</p>
          )}
          <ul className="divide-y divide-slate-100">
            {historyEntries.length === 0 && (
              <li className="px-8 py-12 text-center text-label text-slate-400">{t('aeConfig.noHistory')}</li>
            )}
            {historyEntries.map((entry: any) => {
              const id = String(entry.id);
              const open = expandedVersion === id;
              const isActive = entry.id === activeAeConfig?.id;
              return (
                <li key={entry.id} id={`ae-version-${id}`} className={`px-8 py-5 ${focusVersion === id ? 'bg-brand-primary/5' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">
                        #{entry.id}{isActive ? ` · ${t('aeConfig.active')}` : ''}
                      </div>
                      <div className="text-caption text-slate-500">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString(dateLocale) : ''}
                        {entry.createdByName ? ` · ${entry.createdByName}` : ''}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedVersion(open ? null : id)}
                        aria-expanded={open}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-caption font-medium text-slate-500 hover:border-brand-primary hover:text-brand-primary inline-flex items-center gap-1"
                      >
                        {open ? t('aeConfig.hideDetails') : t('aeConfig.versionDetails')}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDraft(normalizeAEConfig(entry.config)); setSection('percents'); setStatus({ kind: 'ok', message: t('aeConfig.loadedIntoEditor', { id: entry.id }) }); }}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-caption font-medium text-slate-500 hover:border-brand-primary hover:text-brand-primary"
                      >
                        {t('aeConfig.loadIntoEditor')}
                      </button>
                    </div>
                  </div>
                  {open && renderVersionDetails(normalizeAEConfig(entry.config), isActive)}
                </li>
              );
            })}
            {/* Padrão de fábrica: usado por estimativas anteriores a qualquer versão salva. */}
            <li id="ae-version-factory" className={`px-8 py-5 ${focusVersion === 'factory' ? 'bg-brand-primary/5' : ''}`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-label font-bold text-brand-dark dark:text-[color:var(--text-main)]">{t('aeConfig.factoryEntry')}</div>
                  <div className="text-caption text-slate-500">{t('aeConfig.factoryEntryHint')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedVersion(expandedVersion === 'factory' ? null : 'factory')}
                  aria-expanded={expandedVersion === 'factory'}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-caption font-medium text-slate-500 hover:border-brand-primary hover:text-brand-primary inline-flex items-center gap-1 self-start"
                >
                  {expandedVersion === 'factory' ? t('aeConfig.hideDetails') : t('aeConfig.versionDetails')}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedVersion === 'factory' ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {expandedVersion === 'factory' && renderVersionDetails(normalizeAEConfig(DEFAULT_AE_CONFIG), false)}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
