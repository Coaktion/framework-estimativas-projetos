'use client';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import { formatHoursMinutes } from '@/lib/format-hours';
import {
  ZENDESK_PLANS, PLAN_LABEL, PLAN_RANK as ZD_PLAN_RANK, DEFAULT_PLAN, DEFAULT_SKU,
  normalizePlanTier, normalizeSkuType, isPackageAvailable, minPlanBadge,
  isCategoryAvailable,
  type ZendeskPlanTier, type ZendeskSku,
} from '@/lib/zendesk-plans';
import {
  packageName, packageTooltip, categoryName as categoryNameOf,
  packageHaystack, categoryHaystack, matchesQuery,
} from '@/lib/localized-names';
import {
  buildScopePrompt, detectSuppressionFlags, fold,
  type ScopeExportItem, type ScopeExportIntegration,
} from '@/lib/scope-export';

import { Fragment, useState, useMemo, useEffect, useTransition, useRef, useCallback } from 'react';
import { 
  Save, Copy, Download, Link as LinkIcon, Box, Check, ChevronDown, Plus, Trash2, Shield, Search, Zap, Layout, Settings, Users, Loader2,
  CheckSquare, MessageSquare, AlertTriangle, ShieldCheck, CheckCircle2, RotateCcw, EyeOff, Eye, X, ChevronRight,
  ArrowUp, ArrowDown
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveProjectVersionAction, cloneProjectVersionAction } from './actions';
import { nextVersionNumber, versionNameFor } from '@/lib/version-utils';
import { updateUserPreferenceAction, savePresetAction, deletePresetAction } from '@/lib/preferences';

type LayoutConfig = {
  categoryOrder: string[];
  subcategoryOrder: Record<string, string[]>;
  itemSubcategories: Record<string, string>;
  itemOrder: Record<string, string[]>;
};

const DEFAULT_SUBCATEGORY = 'Geral';

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function moveItem<T>(list: T[], fromIndex: number, toIndex: number) {
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function roundHalfUp(value: number, decimals: number) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function getVariableNumber(variables: any[] | null | undefined, keys: string[], fallback: number) {
  const hit = variables?.find((v: any) => keys.includes(v.key));
  const parsed = parseFloat(hit?.value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

const SKILL_BREAKDOWN_SUBITEMS: Record<string, { key: string; label: string; source: string }[]> = {
  'Implantação': [
    { key: 'implantacao.workshop', label: 'Workshop', source: 'implantacao_workshop' },
    { key: 'implantacao.discovery', label: 'Discovery', source: 'implantacao_discovery' },
    { key: 'implantacao.setup', label: 'Setup', source: 'implantacao_setup' },
    { key: 'implantacao.validacao', label: 'Validação', source: 'implantacao_validacao' },
    { key: 'implantacao.treinamento', label: 'Treinamento', source: 'implantacao_treinamento' },
    { key: 'implantacao.golive', label: 'Go-Live e Pós Go-live', source: 'implantacao_golive' },
  ],
  'GP': [],
  'Solution Design': [
    { key: 'sd.discovery', label: 'Discovery', source: 'sd_discovery' },
    { key: 'sd.desenvolvimento', label: 'DRN - Desenvolvimento', source: 'sd_desenvolvimento' },
  ],
  'Desenvolvimento': [],
  'Design': [],
};


type TFunc = (key: string, params?: Record<string, any>) => string;

/**
 * Colunas das variáveis proporcionais no Detalhamento por Categoria.
 *
 * Existe como tabela porque a cor sozinha não identificava nada: as três
 * parcelas apareciam como números coloridos empilhados à direita e o leitor
 * tinha de subir até a legenda do toggle para descobrir qual era qual. Agora
 * cada uma tem um cabeçalho de coluna, um rótulo curto repetido no mobile e a
 * mesma cor — a cor virou reforço, não a única pista.
 */
const BREAKDOWN_VARIABLE_COLUMNS = [
  {
    key: 'discovery' as const,
    labelKey: 'ae.discovery',
    shortKey: 'ae.discovery',
    textClass: 'text-brand-dark',
    dotClass: 'bg-[#a9e29a]',
    chipClass:
      'border-slate-200 dark:border-[color:var(--border-main)] bg-slate-100 dark:bg-[color:var(--bg-input-solid)] text-brand-dark dark:text-[color:var(--text-main)]',
  },
  {
    key: 'validation' as const,
    labelKey: 'ae.validation',
    shortKey: 'ae.validation',
    textClass: 'text-brand-dark',
    dotClass: 'bg-[#2f7a2a]',
    chipClass:
      'border-slate-200 dark:border-[color:var(--border-main)] bg-slate-100 dark:bg-[color:var(--bg-input-solid)] text-brand-dark dark:text-[color:var(--text-main)]',
  },
  {
    key: 'gp' as const,
    labelKey: 'editor.skillGP',
    shortKey: 'editor.skillGP',
    textClass: 'text-brand-secondary dark:text-[color:var(--secondary)]',
    dotClass: 'bg-brand-secondary',
    chipClass:
      'border-slate-200 dark:border-[color:var(--border-main)] bg-slate-50 dark:bg-[color:var(--bg-input-solid)] text-brand-secondary dark:text-[color:var(--secondary)]',
  },
  {
    // DRN (SD > Desenvolvimento): % sobre as horas de Dev, repartido entre os itens de Dev.
    key: 'drn' as const,
    labelKey: 'editor.breakdownColDrn',
    shortKey: 'editor.breakdownColDrn',
    textClass: 'text-brand-dark',
    dotClass: 'bg-cyan-500',
    chipClass:
      'border-slate-200 dark:border-[color:var(--border-main)] bg-slate-100 dark:bg-[color:var(--bg-input-solid)] text-brand-dark dark:text-[color:var(--text-main)]',
  },
];

/**
 * Uma célula numérica do detalhamento.
 *
 * No desktop entra numa coluna que já tem cabeçalho; no mobile, onde o grid
 * colapsa, ela imprime o próprio rótulo — do contrário o número voltaria a ser
 * um valor solto sem identificação, que era exatamente o problema.
 */
function BreakdownCell({
  value,
  labelKey,
  prefix = '',
  className = '',
  muted = false,
  small = false,
}: {
  value: number;
  labelKey: string;
  prefix?: string;
  className?: string;
  muted?: boolean;
  small?: boolean;
}) {
  const { t } = useTranslation();
  const tone = muted ? 'text-slate-400 dark:text-[color:var(--text-muted)]' : className;
  return (
    <span className="flex items-baseline justify-end gap-1 shrink-0">
      <span className="md:hidden text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)]">
        {t(labelKey)}
      </span>
      <span className={`${small ? 'text-caption' : 'text-label'} font-medium tabular-nums ${tone}`}>
        {prefix}{Number(value || 0).toFixed(1)}
      </span>
    </span>
  );
}

/**
 * Os nomes de subcategoria e de subitem ficam GRAVADOS no banco (layoutConfig),
 * portanto o valor armazenado continua sempre em português — só a exibição muda.
 * Subcategorias criadas pelo usuário caem no fallback e aparecem como foram digitadas.
 */
const SUBCATEGORY_LABEL_KEYS: Record<string, string> = {
  'Geral': 'editor.subcatGeneral',
  'Canais': 'editor.subcatChannels',
  'Integrações': 'editor.subcatIntegrations',
  'Campos e Formulários': 'editor.subcatFields',
  'Automações e Regras': 'editor.subcatAutomations',
  'Conteúdo e Help Center': 'editor.subcatContent',
  'Relatórios': 'editor.subcatReports',
};

function subcategoryLabel(t: TFunc, name: string): string {
  const key = SUBCATEGORY_LABEL_KEYS[name];
  return key ? t(key) : name;
}

const SUBITEM_LABEL_KEYS: Record<string, string> = {
  'implantacao.workshop': 'editor.subitemWorkshop',
  'implantacao.discovery': 'editor.subitemDiscovery',
  'implantacao.setup': 'editor.subitemSetup',
  'implantacao.validacao': 'editor.subitemValidation',
  'implantacao.treinamento': 'editor.subitemTraining',
  'implantacao.golive': 'editor.subitemGoLive',
  'sd.discovery': 'editor.subitemDiscovery',
  'sd.desenvolvimento': 'editor.subitemDev',
};

function subitemLabel(t: TFunc, subitemKey: string, fallback: string): string {
  const key = SUBITEM_LABEL_KEYS[subitemKey];
  return key ? t(key) : fallback;
}

/** Nomes de skill vêm do banco; traduzimos apenas os cinco padrão. */
const SKILL_LABEL_KEYS: Record<string, string> = {
  'Implantação': 'editor.skillImplementation',
  'GP': 'editor.skillGP',
  'Solution Design': 'editor.skillSolutionDesign',
  'Desenvolvimento': 'editor.skillDevelopment',
  'Design': 'editor.skillDesign',
};

/** Ordem das skills no resumo lateral. */
const LIVE_SUMMARY_SKILLS = ['Implantação', 'Solution Design', 'Desenvolvimento', 'Design', 'GP'];

/** Horas com uma casa no resumo lateral: 47,5h. */
function fmtLiveHours(value: unknown): string {
  const n = Number(value) || 0;
  return `${(Math.round(n * 10) / 10).toFixed(1).replace('.', ',')}h`;
}

/** Horas inteiras no cabeçalho das categorias: 18h. */
function fmtWholeHours(value: unknown): string {
  return `${Math.round(Number(value) || 0)}h`;
}

function skillLabel(t: TFunc, name: string): string {
  const key = SKILL_LABEL_KEYS[name];
  return key ? t(key) : name;
}

function domSafeId(value: string) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function subcategoryKey(category: string, subcategory: string) {
  return `${category}::${subcategory}`;
}

function inferDefaultSubcategory(category: string, pkg: any) {
  if (pkg?.__defaultSubcategory) return pkg.__defaultSubcategory;

  const haystack = `${category} ${pkg?.name || ''} ${pkg?.tooltip || ''}`.toLowerCase();

  if (/(email|whatsapp|voice|sms|facebook|instagram|teams|slack|web widget|web form|canal|channel|messaging)/.test(haystack)) {
    return 'Canais';
  }

  if (/(integra|integration|api|webhook|marketplace|app|oauth|sso)/.test(haystack)) {
    return 'Integrações';
  }

  if (/(campo|field|formul|form|catálogo|catalog|ticket|usuário|user|organiza)/.test(haystack)) {
    return 'Campos e Formulários';
  }

  if (/(gatilho|trigger|automa|macro|view|visualiza|sla|regra|condicion)/.test(haystack)) {
    return 'Automações e Regras';
  }

  if (/(article|artigo|help center|knowledge|community|guide|conteúdo)/.test(haystack)) {
    return 'Conteúdo e Help Center';
  }

  if (/(dashboard|analytics|report|relatório|insight)/.test(haystack)) {
    return 'Relatórios';
  }

  return DEFAULT_SUBCATEGORY;
}

function normalizeLayoutConfig(
  rawLayout: Partial<LayoutConfig> | null | undefined,
  categories: string[],
  packagesByCategory: Record<string, any[]>
): LayoutConfig {
  const itemSubcategories = { ...(rawLayout?.itemSubcategories || {}) };
  const subcategoryOrder: Record<string, string[]> = { ...(rawLayout?.subcategoryOrder || {}) };
  const itemOrder: Record<string, string[]> = { ...(rawLayout?.itemOrder || {}) };
  const categoryOrder = uniqueStrings([...(rawLayout?.categoryOrder || []), ...categories]);

  categories.forEach((category) => {
    const categoryPackages = packagesByCategory[category] || [];
    const defaultAssignments = categoryPackages.map((pkg: any) => {
      const itemId = String(pkg.id);
      const subcategory = itemSubcategories[itemId] || inferDefaultSubcategory(category, pkg);
      itemSubcategories[itemId] = subcategory;
      return subcategory;
    });

    const orderedSubcategories = uniqueStrings([
      ...(subcategoryOrder[category] || []),
      ...defaultAssignments,
      DEFAULT_SUBCATEGORY
    ]);
    subcategoryOrder[category] = orderedSubcategories;

    orderedSubcategories.forEach((subcategory) => {
      const key = subcategoryKey(category, subcategory);
      const assignedItemIds = categoryPackages
        .filter((pkg: any) => itemSubcategories[String(pkg.id)] === subcategory)
        .map((pkg: any) => String(pkg.id));

      itemOrder[key] = uniqueStrings([
        ...(itemOrder[key] || []).filter((itemId) => assignedItemIds.includes(itemId)),
        ...assignedItemIds
      ]);
    });
  });

  return {
    categoryOrder,
    subcategoryOrder,
    itemSubcategories,
    itemOrder
  };
}

export default function ProjectEditorClient({ project, categories, categoryLabels, categoryRecords, packagesByCategory, currentVersion, allVersions, variables, preferences }: any) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  // Rótulo de categoria no idioma ativo, caindo no rótulo PT se não houver tradução.
  const catLabelOf = useCallback(
    (cat: string) => {
      const record = categoryRecords?.[cat];
      return record ? categoryNameOf(record, language) : String(categoryLabels?.[cat] || cat);
    },
    [categoryRecords, categoryLabels, language],
  );
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hiddenItems, setHiddenItems] = useState<number[]>(safeJsonParse(preferences?.hiddenItems, []));
  const [presetName, setPresetName] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [showHiddenTab, setShowHiddenTab] = useState(false);
  const [isModuleSelectOpen, setIsModuleSelectOpen] = useState(false);
  const moduleSelectRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(() =>
    normalizeLayoutConfig(safeJsonParse(preferences?.layoutConfig, {}), categories, packagesByCategory)
  );

  const presets = safeJsonParse(preferences?.presets, []);

  const orderedCategories = useMemo(() => {
    return uniqueStrings([...(layoutConfig.categoryOrder || []), ...categories]);
  }, [layoutConfig.categoryOrder, categories]);
  const handleSavePreset = async () => {
    if (!presetName) return;
    await savePresetAction(presetName, hiddenItems.map(String), layoutConfig);
    setPresetName('');
    alert(t('editor.presetSaved'));
  };

  const applyPreset = async (preset: any) => {
    const presetHiddenItems = Array.isArray(preset?.hiddenItems) ? preset.hiddenItems : [];
    setHiddenItems(presetHiddenItems.map(Number));
    const nextLayout = normalizeLayoutConfig(preset.layoutConfig || layoutConfig, categories, packagesByCategory);
    setLayoutConfig(nextLayout);
    await updateUserPreferenceAction({
      hiddenItems: JSON.stringify(presetHiddenItems),
      layoutConfig: JSON.stringify(nextLayout)
    });
  };

  const handleDeletePreset = async (name: string) => {
    if (confirm(t('editor.confirmDeletePreset', { name }))) {
      await deletePresetAction(name);
      alert(t('editor.presetDeleted'));
    }
  };

  const toggleHideItem = async (id: number) => {
    const newHidden = hiddenItems.includes(id) 
      ? hiddenItems.filter(i => i !== id) 
      : [...hiddenItems, id];
    setHiddenItems(newHidden);
    await updateUserPreferenceAction({ hiddenItems: JSON.stringify(newHidden) });
  };

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!isModuleSelectOpen) return;
      if (moduleSelectRef.current && !moduleSelectRef.current.contains(event.target as Node)) {
        setIsModuleSelectOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isModuleSelectOpen]);

  // Initial state from currentVersion.data
  const [formData, setFormData] = useState<any>(() => {
    try {
      return currentVersion?.data ? JSON.parse(currentVersion.data) : {};
    } catch (e) {
      return {};
    }
  });

  // Numeração automática: o nome da versão é sempre definido pelo servidor
  // (V1, V2...). Aqui só calculamos o próximo número para exibir na janela de salvar.
  const versionName: string = currentVersion?.versionName || '';
  const nextVersionLabel = versionNameFor(
    nextVersionNumber((allVersions || []).map((v: any) => v.versionName)),
  );
  const versionOptionLabel = (v: any) =>
    v.description ? `${v.versionName} — ${v.description}` : v.versionName;
  // Janela de salvar: atualizar a versão atual ou criar uma nova (com descrição).
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<'update' | 'new'>(currentVersion ? 'update' : 'new');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [techLink, setTechLink] = useState(currentVersion?.technicalScopeLink || '');
  const [zohoLink, setZohoLink] = useState(currentVersion?.zohoLink || '');
  
  const [percents, setPercents] = useState(() => ({
    gp: currentVersion?.gpPercent ?? getVariableNumber(variables, ['GP_STANDARD', 'GP_PERCENTAGE'], 25),
    discovery: currentVersion?.discoveryPercent ?? getVariableNumber(variables, ['DISCOVERY_STANDARD'], 0),
    validation: currentVersion?.validationPercent ?? getVariableNumber(variables, ['VALIDATION_STANDARD'], 0),
  }));

  const [overrides, setOverrides] = useState({
    gp: currentVersion?.gpOverride ?? null,
    discovery: currentVersion?.discoveryOverride ?? null,
    validation: currentVersion?.validationOverride ?? null,
  });

  // UI States
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  // Subcategorias recolhidas, por chave categoria + subcategoria.
  const [collapsedSubcats, setCollapsedSubcats] = useState<Record<string, boolean>>({});
  // Detalhamento por categoria: começa recolhido para não empurrar o resumo para baixo.
  const [categoryBreakdownOpen, setCategoryBreakdownOpen] = useState(false);
  /**
   * Somar Discovery, Validação, GP e DRN proporcionais aos totais do detalhamento.
   * Ligado por padrão: é a visão que fecha com o total geral do projeto.
   * Desligado = só horas de itens.
   */
  const [breakdownWithVariables, setBreakdownWithVariables] = useState(true);
  // SKU e tier do Zendesk: definem quais itens da biblioteca estão disponíveis.
  // Persistidos dentro do JSON `data` da versão, então não exigem coluna nova.
  const [skuType, setSkuType] = useState<ZendeskSku>(() => {
    try {
      const saved = currentVersion?.data ? JSON.parse(currentVersion.data) : {};
      return normalizeSkuType(saved.__skuType ?? DEFAULT_SKU);
    } catch {
      return DEFAULT_SKU;
    }
  });
  const [planTier, setPlanTier] = useState<ZendeskPlanTier>(() => {
    try {
      const saved = currentVersion?.data ? JSON.parse(currentVersion.data) : {};
      return normalizePlanTier(saved.__planTier ?? DEFAULT_PLAN);
    } catch {
      return DEFAULT_PLAN;
    }
  });
  /**
   * Nova implantação × Otimização de instância existente.
   *
   * Mesmo controle que já existe na Calculadora AE. Hoje é informativo: não
   * altera cálculo nenhum, apenas viaja no prompt do Escopo Técnico para que a
   * skill saiba se o documento fala de uma implantação do zero ou de um ajuste
   * sobre um Zendesk já em produção. Fica no JSON `data`, como SKU e plano, e
   * portanto não exige coluna nova.
   */
  const [deploymentType, setDeploymentType] = useState<'new' | 'optimization'>(() => {
    try {
      const saved = currentVersion?.data ? JSON.parse(currentVersion.data) : {};
      return saved.__deploymentType === 'optimization' ? 'optimization' : 'new';
    } catch {
      return 'new';
    }
  });
  const [openBreakdownCats, setOpenBreakdownCats] = useState<Record<string, boolean>>({});

  // Flatten packages for easy lookup
  const allPackages = useMemo<any[]>(() => {
    return Object.values(packagesByCategory).flat() as any[];
  }, [packagesByCategory]);

  const packageRootCategoryById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    Object.entries(packagesByCategory || {}).forEach(([rootCat, pkgs]) => {
      (pkgs || []).forEach((p: any) => {
        map[String(p.id)] = rootCat;
      });
    });
    return map;
  }, [packagesByCategory]);

  /**
   * A categoria passou na porteira de plano dela?
   *
   * Vale para categorias raiz E subcategorias, porque `categoryRecords` traz
   * todas. É uma porteira INDEPENDENTE da restrição do item: a categoria pode
   * cair inteira mesmo que nenhum item dentro dela tenha restrição própria —
   * é assim que "ADPP" desaparece fora do Suite Enterprise em vez de aparecer
   * como uma seção vazia.
   */
  const isCategoryOnPlan = useCallback(
    (catName: string) => {
      const record = categoryRecords?.[catName];
      // Categoria sem registro (não deveria acontecer) não é escondida — o
      // default do sistema todo é inclusivo.
      if (!record) return true;
      return isCategoryAvailable(record, skuType, planTier);
    },
    [categoryRecords, skuType, planTier],
  );

  /**
   * Um item está no escopo quando as DUAS porteiras passam: a do próprio item e
   * a da categoria de origem dele (que pode ser uma subcategoria mesclada na
   * raiz durante o carregamento da página).
   */
  const isAvailable = useCallback(
    (pkg: any) => {
      if (!isPackageAvailable(pkg, skuType, planTier)) return false;
      const sourceCat = pkg?.categoryName;
      if (sourceCat && !isCategoryOnPlan(sourceCat)) return false;
      return true;
    },
    [skuType, planTier, isCategoryOnPlan],
  );

  /** Quantos itens da biblioteca o filtro de plano está excluindo agora. */
  const planExcludedCount = useMemo(() => {
    return (allPackages || []).filter((pkg: any) => !isAvailable(pkg)).length;
  }, [allPackages, isAvailable]);

  /** Categorias raiz escondidas pela porteira de plano — mostradas como aviso. */
  const planExcludedCategories = useMemo(() => {
    return (categories || []).filter((cat: string) => !isCategoryOnPlan(cat));
  }, [categories, isCategoryOnPlan]);

  /**
   * Ordem de exibição já filtrada pelo plano.
   *
   * `orderedCategories` continua completo de propósito: é ele que a reordenação
   * usa, para que uma categoria escondida pelo plano não perca a posição dela
   * quando o usuário trocar o tier de volta.
   */
  const visibleCategories = useMemo(() => {
    return orderedCategories.filter((cat: string) => isCategoryOnPlan(cat));
  }, [orderedCategories, isCategoryOnPlan]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const results: any[] = [];
    const pushUnique = (key: string, item: any) => {
      if (results.some((r) => r.__key === key)) return;
      results.push({ ...item, __key: key });
    };

    visibleCategories.forEach((cat: string) => {
      const label = catLabelOf(cat);
      // Busca nos dois idiomas: um usuário em PT encontra digitando em EN e vice-versa.
      const catHay = categoryHaystack(categoryRecords?.[cat] || { name: cat, displayName: categoryLabels?.[cat] });
      if (matchesQuery(catHay, q)) {
        pushUnique(`cat:${cat}`, { type: 'category', cat, label });
      }

      const subcats = layoutConfig.subcategoryOrder?.[cat] || [];
      subcats.forEach((subcategory: string) => {
        const subHay = `${String(subcategory).toLowerCase()} ${subcategoryLabel(t, subcategory).toLowerCase()}`;
        if (matchesQuery(subHay, q)) {
          pushUnique(`subcat:${cat}:${subcategory}`, {
            type: 'subcategory',
            cat,
            subcategory,
            label: subcategory,
            subtitle: label
          });
        }
      });
    });

    allPackages.forEach((p: any) => {
      // Itens fora do plano não devem aparecer na busca — clicar num resultado
      // levaria a uma seção que não existe na tela.
      if (!isAvailable(p)) return;
      // packageHaystack cobre name + nameEn + tooltip + tooltipEn.
      if (!matchesQuery(packageHaystack(p), q)) return;

      const itemId = String(p.id);
      const cat = packageRootCategoryById[itemId] || p.categoryName;
      if (!cat) return;

      const catLabel = catLabelOf(cat);
      const subcategory = layoutConfig.itemSubcategories?.[itemId] || inferDefaultSubcategory(cat, p);

      pushUnique(`item:${itemId}`, {
        type: 'item',
        cat,
        subcategory,
        itemId,
        label: packageName(p, language),
        subtitle: `${catLabel} • ${subcategoryLabel(t, subcategory)}`,
        isHidden: hiddenItems.includes(p.id)
      });
    });

    return results.slice(0, 20);
  }, [
    searchQuery,
    visibleCategories,
    isAvailable,
    categoryLabels,
    categoryRecords,
    catLabelOf,
    language,
    t,
    layoutConfig.subcategoryOrder,
    layoutConfig.itemSubcategories,
    allPackages,
    packageRootCategoryById,
    hiddenItems
  ]);




  const goToSearchResult = async (result: any) => {
    const cat = result?.cat;
    if (!cat) return;

    setShowHiddenTab(false);
    setFormData((prev: any) => ({
      ...prev,
      [`check_area_${cat}`]: 'on'
    }));
    setCollapsedSections((prev) => ({
      ...prev,
      [cat]: false
    }));

    if (result?.type === 'item' && result?.isHidden) {
      await toggleHideItem(parseInt(result.itemId));
    }

    const targetId =
      result?.type === 'subcategory'
        ? `subcat_${domSafeId(cat)}_${domSafeId(result.subcategory)}`
        : `cat_section_${domSafeId(cat)}`;

    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (result?.type === 'item' && result?.itemId) {
        const qtyKey = `item_${result.itemId}_qty`;
        setFormData((prev: any) => {
          const currentQty = parseFloat(prev?.[qtyKey] || 0);
          if (currentQty > 0) return prev;
          return { ...prev, [qtyKey]: 1 };
        });

        requestAnimationFrame(() => {
          const input = document.querySelector(`input[name="item_${result.itemId}_qty"]`) as HTMLInputElement | null;
          if (input) {
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            input.focus();
            input.select();
          }
        });
      }
    });

    setSearchQuery('');
    setIsSearchOpen(false);
  };

  useEffect(() => {
    setLayoutConfig((current) => normalizeLayoutConfig(current, categories, packagesByCategory));
  }, [categories, packagesByCategory]);

  const persistLayoutConfig = async (nextLayout: LayoutConfig) => {
    const normalized = normalizeLayoutConfig(nextLayout, categories, packagesByCategory);
    setLayoutConfig(normalized);
    await updateUserPreferenceAction({ layoutConfig: JSON.stringify(normalized) });
  };

  const reorderCategory = async (category: string, direction: 'up' | 'down') => {
    const currentIndex = orderedCategories.indexOf(category);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= orderedCategories.length) return;

    await persistLayoutConfig({
      ...layoutConfig,
      categoryOrder: moveItem(orderedCategories, currentIndex, nextIndex)
    });
  };

  const setCategoryChecked = (category: string, checked: boolean) => {
    setFormData((prev: any) => ({
      ...prev,
      [`check_area_${category}`]: checked ? 'on' : 'off'
    }));
  };

  const reorderSubcategory = async (category: string, subcategory: string, direction: 'up' | 'down') => {
    const currentOrder = layoutConfig.subcategoryOrder[category] || [DEFAULT_SUBCATEGORY];
    const currentIndex = currentOrder.indexOf(subcategory);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= currentOrder.length) return;

    await persistLayoutConfig({
      ...layoutConfig,
      subcategoryOrder: {
        ...layoutConfig.subcategoryOrder,
        [category]: moveItem(currentOrder, currentIndex, nextIndex)
      }
    });
  };

  const moveItemToSubcategory = async (category: string, itemId: string, nextSubcategory: string) => {
    const currentSubcategory = layoutConfig.itemSubcategories[itemId] || DEFAULT_SUBCATEGORY;
    if (currentSubcategory === nextSubcategory) return;

    const currentKey = subcategoryKey(category, currentSubcategory);
    const nextKey = subcategoryKey(category, nextSubcategory);

    await persistLayoutConfig({
      ...layoutConfig,
      subcategoryOrder: {
        ...layoutConfig.subcategoryOrder,
        [category]: uniqueStrings([...(layoutConfig.subcategoryOrder[category] || []), nextSubcategory])
      },
      itemSubcategories: {
        ...layoutConfig.itemSubcategories,
        [itemId]: nextSubcategory
      },
      itemOrder: {
        ...layoutConfig.itemOrder,
        [currentKey]: (layoutConfig.itemOrder[currentKey] || []).filter((currentItemId) => currentItemId !== itemId),
        [nextKey]: uniqueStrings([...(layoutConfig.itemOrder[nextKey] || []), itemId])
      }
    });
  };

  const reorderItemInSubcategory = async (category: string, subcategory: string, itemId: string, direction: 'up' | 'down') => {
    const key = subcategoryKey(category, subcategory);
    const currentOrder = layoutConfig.itemOrder[key] || [];
    const currentIndex = currentOrder.indexOf(itemId);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= currentOrder.length) return;

    await persistLayoutConfig({
      ...layoutConfig,
      itemOrder: {
        ...layoutConfig.itemOrder,
        [key]: moveItem(currentOrder, currentIndex, nextIndex)
      }
    });
  };

  const [customPackages, setCustomPackages] = useState<any[]>(() => {
    try {
      // ✅ Parser via REGEX: extrai corretamente categoria / index / field,
      // mesmo com categorias que contenham underscore, acentos ou espaços.
      //   custom_pkg_{CATEGORY}_{INDEX}_{FIELD}
      const PKG_NAME_RE = /^custom_pkg_(.+)_(\d+)_name$/;
      const snake: Record<string, string> = {
        overrideCheck: 'override_check',
        overrideVal:  'override_val',
        scopeIn:      'scope_in',
        scopeOut:     'scope_out'
      };
      const buildKey = (category: string, index: string | number, field: string) =>
        `custom_pkg_${category}_${index}_${snake[field] ?? field}`;

      const safeFormData = formData && typeof formData === 'object' ? formData : {};
      const extracted: any[] = [];
      Object.keys(safeFormData).forEach(key => {
        const m = typeof key === 'string' ? key.match(PKG_NAME_RE) : null;
        if (!m) return;
        const [, category, index] = m;
        try {
          extracted.push({
            id: `${category}_${index}`,
            category,
            index: Number(index),
            name: safeFormData[buildKey(category, index, 'name')],
            hours: safeFormData[buildKey(category, index, 'hours')],
            qty: safeFormData[buildKey(category, index, 'qty')],
            skill: safeFormData[buildKey(category, index, 'skill')] || 'Implantação',
            scopeIn: safeFormData[buildKey(category, index, 'scopeIn')],
            scopeOut: safeFormData[buildKey(category, index, 'scopeOut')],
            overrideCheck: safeFormData[buildKey(category, index, 'overrideCheck')] === 'on',
            overrideVal: safeFormData[buildKey(category, index, 'overrideVal')]
          });
        } catch {
          /* ignora pacote com campos quebrados */
        }
      });

      return extracted;
    } catch (e) {
      console.error('[DEBUG:LOADER] Erro no initializer de customPackages (fallback []):', e);
      return [];
    }
  });

  const [marketplaceApps, setMarketplaceApps] = useState<any[]>(() => {
    try {
      return formData.marketplace_apps ? JSON.parse(formData.marketplace_apps) : [];
    } catch (e) {
      return [];
    }
  });

  const [safetyHours, setSafetyHours] = useState<Record<string, number>>(() => {
    try {
      return currentVersion?.safetyHours ? JSON.parse(currentVersion.safetyHours) : {};
    } catch (e) {
      return {};
    }
  });

  // Calculation Engine
  /**
   * Elegibilidade de cada item às três variáveis percentuais.
   *
   * Lê a configuração de incidência granular do painel Admin:
   *   - `Package.excludedFromVariables` — o item se declara fora da variável;
   *   - `Variable.excludedItems`        — a variável exclui o item;
   *   - `Variable.targetItems` / `targetCategories` — quando preenchidos, a
   *     variável só incide sobre esses alvos.
   *
   * Usado em DOIS lugares, e é bom que seja o mesmo critério nos dois:
   *   1. no cálculo dos totais, para descontar da base de cada percentual as
   *      horas que não incidem (ver `trackExclusions`);
   *   2. no detalhamento por categoria, para repartir o valor já calculado.
   *
   * Como a base já vem descontada, uma categoria inteiramente não incidente
   * recebe 0 na repartição e a soma continua fechando com o resumo.
   */
  const variableEligibility = useMemo(() => {
    const asList = (raw: any): string[] => {
      const parsed = safeJsonParse<any>(typeof raw === 'string' ? raw : JSON.stringify(raw ?? []), []);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    };

    const buildFor = (varKey: string) => {
      const vDef = (variables || []).find((v: any) => v.key === varKey);
      const targets = asList(vDef?.targetItems);
      const targetCats = asList(vDef?.targetCategories);
      const varExcluded = asList(vDef?.excludedItems);

      return (pkg: any, rootCat: string): boolean => {
        if (!pkg) return true;
        const itemId = String(pkg.id ?? '');
        if (asList(pkg.excludedFromVariables).includes(varKey)) return false;
        if (itemId && varExcluded.includes(itemId)) return false;
        // Só filtra por alvo quando a variável declara algum.
        if (targets.length || targetCats.length) {
          const inItems = itemId ? targets.includes(itemId) : false;
          const inCats =
            targetCats.includes(rootCat) ||
            (pkg.categoryName ? targetCats.includes(String(pkg.categoryName)) : false);
          if (!inItems && !inCats) return false;
        }
        return true;
      };
    };

    return {
      discovery: buildFor('DISCOVERY_STANDARD'),
      validation: buildFor('VALIDATION_STANDARD'),
      gp: buildFor('GP_STANDARD'),
    };
  }, [variables]);

  const totals = useMemo(() => {
    // =========================================================================
    // 🎛️  CONFIGURAÇÃO DE REGRAS SD / DRN (via painel Admin, fallback seguro)
    //     Cadastre as keys abaixo no Admin (tipo PERCENT) para ajustar sem deploy.
    // =========================================================================
    // NOTA: SD_DISCOVERY_DEVOPS_PERCENT não é mais lida — o Discovery sobre Dev
    // é todo feito pelo DRN (SD > Desenvolvimento), sem somar nada em SD > Discovery.
    const pctDRNDevops         = getVariableNumber(variables, ['SD_DRN_DEVOPS_PERCENT'],        15);
    const pctSdLiquidoParaSd   = getVariableNumber(variables, ['SD_LIQUID_TO_DISCOVERY_PCT'], 100);

    let subtotal = 0;
    let flatHoursMarketplace = marketplaceApps.length * 5;
    const itemTotals: Record<number, number> = {};
    const catTotals: Record<string, number> = {};
    const skillTotals: any = {
      'Implantação': 0, 'GP': 0, 'Solution Design': 0, 'Desenvolvimento': 0, 'Design': 0
    };
    let hasSdDiscoveryOnAnyItem = false;
    let hasAnyDesenvolvimento = false;
    // Horas de itens DEV: não aparecem no card de Implantação, só compõem a
    // base de cálculo da Validação (setupBaseParaVariaveis).
    let devHorasSetupContribuicao = 0;
    // Horas efetivamente contadas de cada pacote personalizado (mesmo índice de
    // `customPackages`), para o detalhamento por categoria usar o mesmo valor.
    const customTotals: number[] = [];
    const implantationBreakdown: Record<string, number> = {
      implantacao_workshop: 0,
      implantacao_discovery: 0,
      implantacao_setup: 0,
      implantacao_validacao: 0,
      implantacao_treinamento: 0,
      implantacao_golive: 0,
    };
    // Regra:
    //  - Workshop: APENAS itens da categoria Workshop
    //  - Treinamento: APENAS itens da categoria Treinamento
    //  - Go-Live / Pós Go-Live: APENAS itens dessas categorias
    //  - TODO O RESTO (Setup, Discovery, Validação, "Implantação", categorias não mapeadas etc) → SETUP
    const normCat = (s: string) => {
      try {
        return String(s || '')
          .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      } catch { return String(s || '').toLowerCase().trim(); }
    };
    const matchCatHas = (cat: string, needles: string[]) => {
      const n = normCat(cat);
      if (!n) return false;
      return needles.some(x => n.includes(normCat(x)));
    };

    /**
     * Bucket de Implantação de uma categoria. Extraído como função PURA porque a
     * base de Discovery e Validação precisa saber quais horas caíram em Setup —
     * é só sobre elas que os percentuais incidem, e portanto só elas podem ser
     * descontadas quando um item se declara fora da variável.
     */
    const bucketFor = (category: string): string => {
      if (!normCat(category)) return 'implantacao_setup';
      if (matchCatHas(category, ['workshop'])) return 'implantacao_workshop';
      if (matchCatHas(category, ['treinamento'])) return 'implantacao_treinamento';
      if (matchCatHas(category, ['go-live', 'go live', 'pos go', 'go-live e pos go-live', 'go live e pos go live', 'pos go live', 'pos go'])) {
        return 'implantacao_golive';
      }
      // Tudo que não for mapeado → Setup
      return 'implantacao_setup';
    };

    const assignImplantBucket = (category: string, hours: number) => {
      if (!hours) return;
      const bucket = bucketFor(category);
      implantationBreakdown[bucket] = (implantationBreakdown[bucket] || 0) + hours;
    };

    /**
     * Horas que precisam SAIR da base de cada percentual por conta das tags de
     * não incidência configuradas no Admin.
     *
     * `setupExcluded` só acumula o que caiu no bucket de Setup, que é a base de
     * Discovery e Validação. `gpExcluded` acumula sobre qualquer item, porque a
     * base do GP é o consolidado dos quatro containers.
     */
    const setupExcluded = { discovery: 0, validation: 0 };
    let gpExcluded = 0;
    // Parte de `setupExcluded.discovery` que veio de itens de Dev. Dev não compõe
    // a base de Discovery (é coberto pelo DRN), então essa parte não pode ser
    // descontada de novo da base.
    let devSetupExcludedDiscovery = 0;

    const trackExclusions = (pkg: any, rootCat: string, hours: number, isDev = false) => {
      if (!hours) return;
      const inSetup = bucketFor(rootCat) === 'implantacao_setup';
      if (inSetup && !variableEligibility.discovery(pkg, rootCat)) {
        setupExcluded.discovery += hours;
        if (isDev) devSetupExcludedDiscovery += hours;
      }
      if (inSetup && !variableEligibility.validation(pkg, rootCat)) setupExcluded.validation += hours;
      if (!variableEligibility.gp(pkg, rootCat)) gpExcluded += hours;
    };

    // Standard Packages
    Object.keys(packagesByCategory).forEach(cat => {
      // Categoria fora do plano sai inteira do cálculo — a porteira dela é
      // independente da dos itens.
      const catOnPlan = isCategoryOnPlan(cat);
      const isChecked = catOnPlan && formData[`check_area_${cat}`] === 'on';
      catTotals[cat] = 0;

      packagesByCategory[cat].forEach((pkg: any) => {
        const qty = parseFloat(formData[`item_${pkg.id}_qty`] || 0);
        // Itens acima do plano selecionado não entram no total, mesmo que a
        // quantidade tenha sido digitada antes de trocar o plano. `itemOnPlan`
        // cobre as duas porteiras (item e categoria de origem).
        const itemOnPlan = isPackageAvailable(pkg, skuType, planTier)
          && (!pkg?.categoryName || isCategoryOnPlan(pkg.categoryName));
        if (qty > 0 && isChecked && itemOnPlan) {
          let rowTotal = qty * pkg.hours;
          const isOverride = formData[`item_override_check_${pkg.id}`] === 'on';
          if (isOverride) {
            const overrideVal = parseFloat(formData[`item_override_val_${pkg.id}`]);
            if (!isNaN(overrideVal)) rowTotal = overrideVal;
          }
          itemTotals[pkg.id] = rowTotal;
          catTotals[cat] += rowTotal;
          subtotal += rowTotal;
          const skillKey = pkg.skillName || pkg.skill;
          const sdDisc = Boolean(pkg.sdDiscovery || false);

          // Tags de não incidência: registradas aqui, onde ainda se sabe o item
          // e a categoria de origem dele.
          trackExclusions(pkg, cat, rowTotal, skillKey === 'Desenvolvimento');

          if (sdDisc) hasSdDiscoveryOnAnyItem = true;
          if (skillKey === 'Desenvolvimento') hasAnyDesenvolvimento = true;

          // REGRA 1: item skill Desenvolvimento (COM ou SEM SD marcado)
          //  - Horas cheias do item CREDITADAS no skill Desenvolvimento (container próprio, card DEV normal)
          //  - Horas cheias do item TAMBÉM entram em Setup (implantação) PARA BASE DE CÁLCULO de % Validação
          //    (não aparecem como linha no card de Implantação visual — só compõem setupBaseParaVariaveis)
          //  - O discovery sobre Dev é o DRN (% sobre totalDevFull), calculado mais abaixo
          if (skillKey === 'Desenvolvimento') {
            // Horas cheias seguem seu fluxo padrão de DEV:
            skillTotals['Desenvolvimento'] += rowTotal;
            // Contabilizamos também na base de cálculo de validação% sobre DEV
            devHorasSetupContribuicao += rowTotal;
            return;
          }

          // REGRA 2: item sdDiscovery marcado + skill != Desenvolvimento (ex: Implantação)
          //  - Horas da linha CONTAM em Setup (Implantação) → assignImplantBucket normal (base de cálculo geral)
          //  - A marcação faz o projeto "ter SD": o Discovery de Implantação (que já incide
          //    sobre estas horas) é transferido inteiro para SD > Discovery

          if (skillTotals[skillKey] !== undefined) skillTotals[skillKey] += rowTotal;
          if (skillKey === 'Implantação') assignImplantBucket(cat, rowTotal);
        }
      });
    });

    // Custom Packages
    customPackages.forEach((pkg, idx) => {
      customTotals[idx] = 0;
      if (formData[`check_area_${pkg.category}`] !== 'on') return;

      const qty = parseFloat(pkg.qty || 0);
      const hours = parseFloat(pkg.hours || 0);
      let total = qty * hours;
      
      if (pkg.overrideCheck) {
        const val = parseFloat(pkg.overrideVal);
        if (!isNaN(val)) total = val;
      }
      
      customTotals[idx] = total;
      subtotal += total;
      catTotals[pkg.category] = (catTotals[pkg.category] || 0) + total;
      const skillKey = pkg.skillName || pkg.skill;
      const sdDisc = Boolean((pkg as any).sdDiscovery || false);
      // Pacotes personalizados não têm configuração de incidência, então
      // permanecem elegíveis às três variáveis — mesmo tratamento que recebem
      // no detalhamento por categoria.

      if (sdDisc) hasSdDiscoveryOnAnyItem = true;
      if (skillKey === 'Desenvolvimento') hasAnyDesenvolvimento = true;

      if (skillKey === 'Desenvolvimento') {
        skillTotals['Desenvolvimento'] += total;
        devHorasSetupContribuicao += total;
        return;
      }
      if (skillTotals[skillKey] !== undefined) skillTotals[skillKey] += total;
      if (skillKey === 'Implantação') assignImplantBucket(pkg.category, total);
    });

    // Helper to calculate a variable's contribution
    /*
     * NOTA (rodada 6): a antiga `calculateVariable` foi REMOVIDA daqui.
     *
     * Ela montava a base de cada percentual respeitando as tags de
     * incidência, mas nunca era chamada — Discovery e Validação incidiam
     * sobre todo o Setup e o GP sobre todo o consolidado, então a
     * configuração do painel Admin não surtia efeito nenhum.
     *
     * A regra agora vive no fluxo real de cálculo: `trackExclusions` acumula
     * as horas não incidentes durante a varredura dos itens, e elas são
     * descontadas em `baseDiscovery`, `baseValidation` e `totalBaseGP`.
     * Manter a função aqui, morta, foi justamente o que fez parecer que as
     * tags funcionavam.
     */

    // NOTA: GP será calculado ABAIXO, sobre o total consolidado (impl + SD + DEV + DESIGN), incluindo discovery/validação e marketplace/safety.
    // GP inicial é 0 para não duplicar.
    let gpValRawInitial = 0;
    if (overrides.gp !== null) {
      // Se o usuário travou o override manual, respeitamos logo após fechar os totais (abaixo).
      gpValRawInitial = 0;
    }

    // Contribuição de horas por skill LÍQUIDA (antes de %/segregar subitens)
    const skillLiquido: Record<string, number> = {
      'Implantação': 0, 'GP': 0, 'Solution Design': 0, 'Desenvolvimento': 0, 'Design': 0
    };
    Object.keys(skillTotals).forEach(k => {
      if (skillLiquido[k] !== undefined) skillLiquido[k] = Number(skillTotals[k]) || 0;
    });
    // NOTA: o marketplace só é somado ao skillTotals mais abaixo, então não há o
    // que descontar aqui (descontar fazia as horas de marketplace sumirem do Setup).
    skillLiquido['GP'] = 0; // GP é variável, não item catalogado

    // Nova lógica de buckets de Implantação:
    // Cada bucket é a soma EXATA das categorias daquele tipo (Workshop → Workshop, Treinamento → Treinamento, etc)
    // Discovery e Validação (variáveis %) são calculadas SOBRE APENAS O SETUP
    // Safety Implantação → Go-Live
    // Marketplace → Setup
    // NÃO HÁ MAIS linha genérica "Implantação" → tudo é distribuído nos 6 buckets
    const safetyImplantacao = Number((safetyHours || {})['Implantação']) || 0;

    const implantacaoBuckets: Record<string, number> = {
      implantacao_workshop: implantationBreakdown.implantacao_workshop || 0,
      implantacao_discovery: implantationBreakdown.implantacao_discovery || 0,
      implantacao_setup: implantationBreakdown.implantacao_setup || 0,
      implantacao_validacao: implantationBreakdown.implantacao_validacao || 0,
      implantacao_treinamento: implantationBreakdown.implantacao_treinamento || 0,
      implantacao_golive: implantationBreakdown.implantacao_golive || 0,
    };

    // Fechamento normal (buckets só contêm Implantação; as horas de DEV ficam em
    // devHorasSetupContribuicao, acumuladas na varredura dos itens)
    const valorJaAplicado = Object.values(implantacaoBuckets).reduce((a, b) => a + (b || 0), 0);
    const implantacaoTotalLiquido = Math.max(0, skillLiquido['Implantação'] || 0);
    if (valorJaAplicado < implantacaoTotalLiquido - 0.0001) {
      const sobra = roundHalfUp(Math.max(0, implantacaoTotalLiquido - valorJaAplicado), 1);
      implantacaoBuckets['implantacao_setup'] = roundHalfUp((implantacaoBuckets['implantacao_setup'] || 0) + sobra, 1);
    }

    // 3) Marketplace FLAT → entra em “Setup” (itens acessórios de implantação)
    // Primeiro adicionamos o marketplace no SETUP para formar a BASE DE CÁLCULO de Discovery e Validação
    implantacaoBuckets['implantacao_setup'] = roundHalfUp((implantacaoBuckets['implantacao_setup'] || 0) + (flatHoursMarketplace || 0), 1);

    // Discovery e Validação variáveis incidem APENAS sobre o valor de SETUP
    // + horas de DEV que também entram na base de cálculo de Validação/Discovery (mas não no display)
    const setupBaseParaVariaveis = Math.max(0,
      (implantacaoBuckets['implantacao_setup'] || 0) + (devHorasSetupContribuicao || 0)
    );
    /**
     * Base efetiva de cada percentual, já sem as horas que os itens declararam
     * como não incidentes.
     *
     * Até a rodada 5 essas tags eram inertes: a função que as lia
     * (`calculateVariable`) nunca era chamada, e Discovery/Validação incidiam
     * sobre TODO o Setup. Agora a configuração do painel Admin passa a valer.
     */
    // Discovery NÃO incide sobre Dev: o discovery de Dev é todo feito pelo DRN
    // (SD > Desenvolvimento). Incluir Dev aqui contaria essas horas duas vezes.
    const baseDiscovery = Math.max(0,
      (implantacaoBuckets['implantacao_setup'] || 0)
      - (setupExcluded.discovery - devSetupExcludedDiscovery)
    );
    const baseValidation = Math.max(0, setupBaseParaVariaveis - setupExcluded.validation);
    // Recalcular discValRaw e validVal (mantendo overrides manuais se existirem)
    let discValRawFinal = 0;
    let validValRawFinal = 0;
    if (overrides.discovery !== null) {
      discValRawFinal = Number(overrides.discovery) || 0;
    } else {
      // Base = apenas setup; percentual = percents.discovery (se houver vDef com tipo, respeitamos flat/mixed? mantendo padrão percentual simples)
      const vDef = variables?.find((v: any) => v.key === 'DISCOVERY_STANDARD');
      if (!vDef) {
        discValRawFinal = baseDiscovery * (percents.discovery / 100);
      } else {
        const pctValue = percents.discovery;
        if (vDef.type === 'PERCENT') discValRawFinal = baseDiscovery * (pctValue / 100);
        else if (vDef.type === 'FLAT') discValRawFinal = parseFloat(vDef.flatValue || 0);
        else if (vDef.type === 'MIXED') discValRawFinal = (baseDiscovery * (pctValue / 100)) + parseFloat(vDef.flatValue || 0);
        else discValRawFinal = baseDiscovery * (pctValue / 100);
      }
    }
    if (overrides.validation !== null) {
      validValRawFinal = Number(overrides.validation) || 0;
    } else {
      const vDef = variables?.find((v: any) => v.key === 'VALIDATION_STANDARD');
      if (!vDef) {
        validValRawFinal = baseValidation * (percents.validation / 100);
      } else {
        const pctValue = percents.validation;
        if (vDef.type === 'PERCENT') validValRawFinal = baseValidation * (pctValue / 100);
        else if (vDef.type === 'FLAT') validValRawFinal = parseFloat(vDef.flatValue || 0);
        else if (vDef.type === 'MIXED') validValRawFinal = (baseValidation * (pctValue / 100)) + parseFloat(vDef.flatValue || 0);
        else validValRawFinal = baseValidation * (pctValue / 100);
      }
    }

    // =========================================================================
    // REGRAS SD / DRN — REGRAS NOVAS (removida distribuição fixa 60/40)
    // =========================================================================
    const totalDevFull = Math.max(0,
      Number(skillLiquido['Desenvolvimento'] || 0) +
      (Number((safetyHours || {})['Desenvolvimento']) || 0)
    );
    const sdLiquido = skillLiquido['Solution Design'] || 0;
    const safetySD = Number((safetyHours || {})['Solution Design']) || 0;
    const totalSdBruto = sdLiquido + safetySD;

    const hasSD   = totalSdBruto > 0.0001 || hasSdDiscoveryOnAnyItem;
    const hasDEV  = totalDevFull  > 0.0001 || hasAnyDesenvolvimento;

    // --- Discovery de Implantação ---
    // Havendo QUALQUER hora de SD ou de Dev, o discovery deixa de ser de Implantação:
    //  • com SD (com ou sem Dev) → transferido para SD > Discovery
    //  • só com Dev             → transferido para SD > Desenvolvimento (DRN)
    // Sem SD e sem Dev, permanece em Implantação.
    const transferImplantDiscovery = hasSD || hasDEV;

    if (transferImplantDiscovery) {
      implantacaoBuckets['implantacao_discovery'] = 0;
    } else {
      implantacaoBuckets['implantacao_discovery'] = roundHalfUp(
        (implantacaoBuckets['implantacao_discovery'] || 0) + discValRawFinal, 1
      );
    }
    implantacaoBuckets['implantacao_validacao'] = roundHalfUp(
      (implantacaoBuckets['implantacao_validacao'] || 0) + validValRawFinal, 1
    );

    // 4) Safety de Implantação → Go-Live e Pós Go-live (apoio na estabilização)
    if (safetyImplantacao > 0) {
      implantacaoBuckets['implantacao_golive'] = roundHalfUp(
        (implantacaoBuckets['implantacao_golive'] || 0) + safetyImplantacao, 1
      );
    }

    // Redefine discVal e validVal para a fórmula final (consolidado total) usar os valores baseados em Setup
    const discValRaw = discValRawFinal;
    const validValRaw = validValRawFinal;

    // --- Segmentação de SD (Solution Design) ---
    let sd_discovery = 0;
    let sd_desenvolvimento = 0;

    // SD > Discovery: SD bruto (líquido + safety), 100% configurável
    sd_discovery += totalSdBruto * (pctSdLiquidoParaSd / 100);

    // SD > Desenvolvimento (DRN): pctDRNDevops % sobre TUDO que for Desenvolvimento (SEMPRE)
    const drnValRaw = totalDevFull * (pctDRNDevops / 100);
    sd_desenvolvimento += drnValRaw;

    // Discovery de Implantação transferido (ver acima): SD tem prioridade sobre Dev
    if (hasSD) sd_discovery += discValRawFinal;
    else if (hasDEV) sd_desenvolvimento += discValRawFinal;

    // Arredonda e evita negativo
    sd_discovery       = Math.max(0, roundHalfUp(sd_discovery,       1));
    sd_desenvolvimento = Math.max(0, roundHalfUp(sd_desenvolvimento, 1));

    // Distribuição por SKILL para o engine da UI (retorna exibido + por subitem)
    const skillBreakdownBySkill: Record<string, Record<string, number>> = {
      'Implantação': {
        implantacao_workshop: implantacaoBuckets.implantacao_workshop,
        implantacao_discovery: implantacaoBuckets.implantacao_discovery,
        implantacao_setup: implantacaoBuckets.implantacao_setup,
        implantacao_validacao: implantacaoBuckets.implantacao_validacao,
        implantacao_treinamento: implantacaoBuckets.implantacao_treinamento,
        implantacao_golive: implantacaoBuckets.implantacao_golive,
      },
      'GP': {},
      'Solution Design': {
        sd_discovery,
        sd_desenvolvimento,
      },
      'Desenvolvimento': {},
      'Design': {},
    };

    // Add safety hours to skill totals
    Object.entries(safetyHours).forEach(([skill, hours]) => {
      if (skillTotals[skill] !== undefined) {
        skillTotals[skill] += (hours || 0);
      }
    });

    const totalSafetyRaw = Object.values(safetyHours).reduce((a, b) => a + (b || 0), 0);

    // Add Marketplace FLAT hours to Implantação for skill breakdown but not to subtotal for GP calc
    skillTotals['Implantação'] = (skillTotals['Implantação'] || 0) + flatHoursMarketplace;

    // O total agregado mostrado no card deve bater com a soma dos subitens (inclui variáveis, marketplace, safety).
    const implantacaoSomaSubitens = Object.values(skillBreakdownBySkill['Implantação']).reduce((a, b) => a + (b || 0), 0);
    skillTotals['Implantação'] = implantacaoSomaSubitens;

    const sdSomaSubitens = Object.values(skillBreakdownBySkill['Solution Design']).reduce((a, b) => a + (b || 0), 0);
    skillTotals['Solution Design'] = sdSomaSubitens;

    // Cards DEV e DESIGN não têm subitens (breakdown vazio), então o total mostrado é apenas skillTotals[skill]
    // (já composto por horas cheias dos itens + safety adicionado acima). Mantemos.

    // GP = x% sobre TODO o projeto (TOTAIS consolidados de cada um dos 4 containers):
    //  - Implantação (soma subitens: Setup + Workshop/Treinamento/GoLive + Discovery + Validação + Marketplace + Safety)
    //  - Solution Design (soma subitens: Discovery SD + DRN Desenvolvimento, já com routed + liquido 60/40)
    //  - Desenvolvimento (horas cheias itens dev + safety)
    //  - Design (horas cheias itens design + safety)
    // Excluímos o próprio GP (skillTotals['GP']) para não haver circularidade.
    // Base do GP: consolidado dos quatro containers, menos as horas de itens
    // que se declararam fora do GP.
    const totalBaseGP = Math.max(0,
      Number(skillTotals['Implantação'] || 0)
      + Number(skillTotals['Solution Design'] || 0)
      + Number(skillTotals['Desenvolvimento'] || 0)
      + Number(skillTotals['Design'] || 0)
      - gpExcluded
    );

    // Cálculo do GP sobre a base consolidada
    let gpValRawFinal = 0;
    if (overrides.gp !== null) {
      gpValRawFinal = Number(overrides.gp) || 0;
    } else {
      const vDef = variables?.find((v: any) => v.key === 'GP_STANDARD');
      if (!vDef) {
        gpValRawFinal = totalBaseGP * (percents.gp / 100);
      } else {
        const pctValue = percents.gp;
        if (vDef.type === 'PERCENT') gpValRawFinal = totalBaseGP * (pctValue / 100);
        else if (vDef.type === 'FLAT') gpValRawFinal = parseFloat(vDef.flatValue || 0);
        else if (vDef.type === 'MIXED') gpValRawFinal = (totalBaseGP * (pctValue / 100)) + parseFloat(vDef.flatValue || 0);
        else gpValRawFinal = totalBaseGP * (pctValue / 100);
      }
    }
    const gpValRaw = gpValRawFinal;
    skillTotals['GP'] = gpValRaw;

    const subtotalRounded = roundHalfUp(subtotal, 1);
    const gpVal = roundHalfUp(gpValRaw, 1);
    const discVal = roundHalfUp(discValRaw, 1);
    const validVal = roundHalfUp(validValRaw, 1);
    const totalSafety = roundHalfUp(totalSafetyRaw, 1);
    // Total geral: TODOS os containers + GP. Não parte de `totalBaseGP`, porque
    // ela desconta os itens fora do GP — que não recebem GP, mas continuam
    // sendo horas do projeto.
    const consolidatedBase =
      Number(skillTotals['Implantação'] || 0)
      + Number(skillTotals['Solution Design'] || 0)
      + Number(skillTotals['Desenvolvimento'] || 0)
      + Number(skillTotals['Design'] || 0)
      + gpVal;
    const grandTotal = roundHalfUp(consolidatedBase, 0);

    return {
      subtotal: subtotalRounded,
      skillTotals,
      skillBreakdownBySkill,
      // Expostos para o detalhamento por categoria/subcategoria.
      itemTotals,
      catTotals,
      customTotals,
      gpVal,
      discVal,
      // DRN (% sobre Dev) — exposto para o detalhamento por categoria.
      drnVal: roundHalfUp(drnValRaw, 1),
      drnPct: pctDRNDevops,
      safetyHours,
      // Bases efetivas e horas descontadas pelas tags de não incidência —
      // expostas para que a UI possa explicar de onde veio o número.
      baseDiscovery,
      baseValidation,
      totalBaseGP,
      excludedFromVariables: {
        discovery: roundHalfUp(setupExcluded.discovery, 1),
        validation: roundHalfUp(setupExcluded.validation, 1),
        gp: roundHalfUp(gpExcluded, 1),
      },
      validVal,
      flatHoursMarketplace,
      totalSafety,
      grandTotal
    };
  }, [formData, customPackages, marketplaceApps, safetyHours, percents, overrides, packagesByCategory, variables, allPackages, skuType, planTier, isCategoryOnPlan, variableEligibility]);


  /**
   * Detalhamento por categoria e, dentro dela, por subcategoria.
   * Reaproveita `totals.itemTotals`, então reflete exatamente o que está sendo
   * contado (quantidade > 0, módulo marcado, overrides manuais aplicados).
   */
  const categoryBreakdown = useMemo(() => {
    type VarKey = 'discovery' | 'validation' | 'gp' | 'drn';
    type Elig = Record<VarKey, number>;
    type Bucket = {
      total: number;
      /** Base elegível a cada variável, para repartir proporcionalmente. */
      elig: Elig;
      subs: Map<string, { hours: number; elig: Elig }>;
    };
    const VAR_KEYS: VarKey[] = ['discovery', 'validation', 'gp', 'drn'];

    const byCategory = new Map<string, Bucket>();
    const zero = (): Elig => ({ discovery: 0, validation: 0, gp: 0, drn: 0 });

    const bump = (
      cat: string,
      sub: string,
      hours: number,
      elig: Record<VarKey, boolean>,
    ) => {
      if (!hours) return;
      if (!byCategory.has(cat)) {
        byCategory.set(cat, { total: 0, elig: zero(), subs: new Map() });
      }
      const entry = byCategory.get(cat)!;
      entry.total += hours;
      if (!entry.subs.has(sub)) entry.subs.set(sub, { hours: 0, elig: zero() });
      const subEntry = entry.subs.get(sub)!;
      subEntry.hours += hours;

      VAR_KEYS.forEach((key) => {
        if (!elig[key]) return;
        entry.elig[key] += hours;
        subEntry.elig[key] += hours;
      });
    };

    // Itens da biblioteca
    Object.entries(packagesByCategory || {}).forEach(([cat, pkgs]) => {
      (pkgs as any[]).forEach((pkg: any) => {
        const hours = totals.itemTotals?.[pkg.id];
        if (!hours) return;
        const itemId = String(pkg.id);
        const sub =
          layoutConfig.itemSubcategories?.[itemId] || inferDefaultSubcategory(cat, pkg);
        const isDev = (pkg.skillName || pkg.skill) === 'Desenvolvimento';
        bump(cat, sub, hours, {
          // Discovery não incide sobre Dev (o discovery de Dev é o DRN).
          discovery: !isDev && variableEligibility.discovery(pkg, cat),
          validation: variableEligibility.validation(pkg, cat),
          gp: variableEligibility.gp(pkg, cat),
          drn: isDev,
        });
      });
    });

    // Pacotes personalizados: agrupados pela categoria digitada pelo usuário.
    // Usa as horas que o resumo de fato contou (override e módulo marcado
    // incluídos). Não têm configuração de incidência, então entram elegíveis
    // às variáveis — mesmo tratamento da base de cálculo do resumo.
    customPackages.forEach((pkg: any, idx: number) => {
      const hours = Number(totals.customTotals?.[idx]) || 0;
      if (!hours) return;
      const isDev = (pkg.skillName || pkg.skill) === 'Desenvolvimento';
      bump(pkg.category || t('common.custom'), t('common.manual'), hours, {
        discovery: !isDev, validation: true, gp: true, drn: isDev,
      });
    });

    // Apps de marketplace entram como bloco FLAT próprio. São somados ao Setup
    // antes do cálculo de Discovery/Validação, logo incidem normalmente.
    if (totals.flatHoursMarketplace) {
      bump(t('editor.marketplaceApps'), t('editor.flat5h'), totals.flatHoursMarketplace, {
        discovery: true, validation: true, gp: true, drn: false,
      });
    }

    // Horas de Safety por skill: entram no total geral, então precisam de uma
    // linha própria. Recebem GP; o Safety de Dev também compõe a base do DRN.
    Object.entries(totals.safetyHours || {}).forEach(([skill, raw]) => {
      const hours = Number(raw) || 0;
      if (!hours) return;
      bump(t('editor.breakdownSafety'), skillLabel(t, skill), hours, {
        discovery: false, validation: false, gp: true, drn: skill === 'Desenvolvimento',
      });
    });

    // ---- Repartição proporcional das variáveis --------------------------------
    // Os valores repartidos são os JÁ CALCULADOS no resumo (respeitando
    // overrides manuais e as tags de não incidência), então a soma das
    // contribuições fecha exatamente com o que o bloco "Resumo de horas" exibe.
    const varTotals: Record<VarKey, number> = {
      discovery: Number(totals.discVal) || 0,
      validation: Number(totals.validVal) || 0,
      gp: Number(totals.gpVal) || 0,
      drn: Number(totals.drnVal) || 0,
    };

    const eligibleGrand = zero();
    byCategory.forEach((entry) => {
      VAR_KEYS.forEach((key) => { eligibleGrand[key] += entry.elig[key]; });
    });

    const share = (eligible: number, key: VarKey) => {
      const denominator = eligibleGrand[key];
      if (!denominator) return 0;
      return varTotals[key] * (eligible / denominator);
    };
    const contribOf = (elig: Elig): Record<VarKey, number> => ({
      discovery: share(elig.discovery, 'discovery'),
      validation: share(elig.validation, 'validation'),
      gp: share(elig.gp, 'gp'),
      drn: share(elig.drn, 'drn'),
    });
    const sumOf = (c: Record<VarKey, number>) => VAR_KEYS.reduce((acc, key) => acc + c[key], 0);

    const rows = Array.from(byCategory.entries())
      .map(([cat, entry]) => {
        const contrib = contribOf(entry.elig);
        const contribSum = sumOf(contrib);

        return {
          cat,
          total: entry.total,
          contrib,
          totalWithVariables: entry.total + contribSum,
          subs: Array.from(entry.subs.entries())
            .map(([sub, subEntry]) => {
              const subContrib = contribOf(subEntry.elig);
              return {
                sub,
                hours: subEntry.hours,
                contrib: subContrib,
                hoursWithVariables: subEntry.hours + sumOf(subContrib),
              };
            })
            .sort((a, b) => b.hours - a.hours),
        };
      })
      .sort((a, b) => b.total - a.total);

    const grand = rows.reduce((acc, r) => acc + r.total, 0);
    const grandWithVariables = rows.reduce((acc, r) => acc + r.totalWithVariables, 0);

    return { rows, grand, grandWithVariables, varTotals };
  }, [
    totals.itemTotals,
    totals.customTotals,
    totals.safetyHours,
    totals.flatHoursMarketplace,
    totals.discVal,
    totals.validVal,
    totals.gpVal,
    totals.drnVal,
    packagesByCategory,
    layoutConfig.itemSubcategories,
    customPackages,
    variableEligibility,
    t,
  ]);

  /** Total do detalhamento conforme o toggle das horas proporcionais. */
  const breakdownGrand = breakdownWithVariables
    ? categoryBreakdown.grandWithVariables
    : categoryBreakdown.grand;

  /**
   * Grade de colunas do detalhamento, compartilhada por cabeçalho, linhas de
   * categoria, linhas de subcategoria e rodapé — é isso que faz os números
   * ficarem ALINHADOS em coluna em vez de amontoados à direita.
   *
   * A coluna 2 (participação) é elástica e absorve a sobra de largura, que
   * antes ficava simplesmente vazia. Com o toggle ligado entram três colunas
   * de largura fixa para as parcelas; desligado, a linha respira.
   *
   * Classes ESCRITAS POR EXTENSO de propósito: o Tailwind varre o código-fonte
   * em busca de nomes de classe literais, então uma string montada por
   * concatenação não geraria CSS nenhum.
   */
  const breakdownGridClass = breakdownWithVariables
    ? 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_4.5rem_4.5rem_6rem]'
    : 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_6rem]';

  /* ------------------------------------------------------------------------ */
  /*        EXPORTAÇÃO DO ESCOPO COMO PROMPT PARA A SKILL scope-creator        */
  /* ------------------------------------------------------------------------ */

  /**
   * Itens que efetivamente entraram no escopo, com categoria e subcategoria.
   * Sai de `totals.itemTotals`, então reflete quantidade, override manual e os
   * dois filtros de plano — exatamente o que a tela está somando.
   */
  const scopeItems = useMemo(() => {
    const out: ScopeExportItem[] = [];

    Object.entries(packagesByCategory || {}).forEach(([cat, pkgs]) => {
      (pkgs as any[]).forEach((pkg: any) => {
        const hours = totals.itemTotals?.[pkg.id];
        if (!hours) return;
        const itemId = String(pkg.id);
        const sub = layoutConfig.itemSubcategories?.[itemId] || inferDefaultSubcategory(cat, pkg);
        out.push({
          // Nome canônico em português: é ele que a skill casa contra o
          // template, que hoje só existe em pt-BR.
          category: catLabelOf(cat),
          subcategory: subcategoryLabel(t, sub),
          label: String(pkg.name || ''),
          quantity: parseFloat(formData[`item_${pkg.id}_qty`] || 0) || 0,
          hours,
        });
      });
    });

    customPackages.forEach((pkg: any) => {
      const hours = Number(pkg.hours) * Number(pkg.qty || 1);
      if (!hours) return;
      out.push({
        category: pkg.category || t('common.custom'),
        subcategory: t('common.manual'),
        label: String(pkg.name || t('common.custom')),
        quantity: Number(pkg.qty || 1),
        hours,
      });
    });

    marketplaceApps.forEach((app: any) => {
      out.push({
        category: t('editor.marketplaceApps'),
        subcategory: t('editor.flat5h'),
        label: String(app?.name || app || 'App Marketplace'),
        quantity: 1,
        hours: 5,
      });
    });

    return out.sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        a.subcategory.localeCompare(b.subcategory) ||
        a.label.localeCompare(b.label),
    );
  }, [
    packagesByCategory, totals.itemTotals, layoutConfig.itemSubcategories,
    customPackages, marketplaceApps, formData, catLabelOf, t,
  ]);

  const scopePrompt = useMemo(() => {
    // Módulos: derivados das CATEGORIAS que têm hora lançada. Um mapa fixo de
    // módulos daria errado assim que a biblioteca mudasse.
    const modules = Array.from(new Set(scopeItems.map((i) => i.category))).sort();

    // Canais: itens das categorias de canal, com a quantidade lançada.
    const channels = scopeItems
      .filter((i) => fold(i.category).includes('canais') || fold(i.category).includes('channel'))
      .map((i) => ({ label: i.label, quantity: i.quantity }));

    // Integrações e apps, por tipo de origem.
    const integrations: ScopeExportIntegration[] = scopeItems
      .filter((i) => {
        const cat = fold(i.category);
        return cat.includes('integracoes nativas') || cat.includes('native integration')
          || cat.includes('marketplace') || cat.includes('aplicativos aktienow')
          || cat.includes('aktienow apps');
      })
      .map((i) => ({ kind: i.category, label: i.label, quantity: i.quantity }));

    const devHours = Number(totals.skillTotals?.['Desenvolvimento'] || 0);
    const designHours = Number(totals.skillTotals?.['Design'] || 0);

    const flags = detectSuppressionFlags(scopeItems, {
      // Estas duas não vêm de palavra-chave: vêm das horas por skill, que é o
      // sinal correto para decidir se a seção 5.3 (Premissas de
      // Desenvolvimento) permanece no documento.
      desenvolvimento: devHours > 0,
      design: designHours > 0,
    });

    return buildScopePrompt({
      origin: 'framework',
      template: 'pacote-de-horas',
      clientName: project?.name || '',
      projectName: project?.name || '',
      versionName: versionName || 'V1',
      generatedAt: new Date(),
      technicalScopeLink: techLink,
      zohoLink,
      preSalesName: project?.owner?.name || null,
      totalHours: totals.grandTotal,
      skillHours: totals.skillTotals,
      percents: percents,
      planTierLabel: PLAN_LABEL[planTier],
      skuLabel: skuType === 'ES' ? t('plans.employeeService') : t('plans.customerService'),
      deploymentType,
      // O prompt sai no idioma da interface — ver lib/scope-export.ts.
      locale: language,
      modules,
      channels,
      integrations,
      flags,
      categories: categoryBreakdown.rows.map((row) => ({
        label: catLabelOf(row.cat),
        hours: row.total,
        subcategories: row.subs.map((s) => ({
          label: subcategoryLabel(t, s.sub),
          hours: s.hours,
        })),
      })),
      items: scopeItems,
      // Fase 2: preencher a partir do Zoho CRM.
      crm: null,
    });
  }, [
    scopeItems, project, versionName, currentVersion, techLink, zohoLink,
    totals.grandTotal, totals.skillTotals, percents, planTier, skuType,
    deploymentType, language,
    categoryBreakdown.rows, catLabelOf, t,
  ]);

  const [scopePromptCopied, setScopePromptCopied] = useState(false);

  const handleCopyScopePrompt = async () => {
    // O escopo exportado descreve a versão SALVA; avisar é mais honesto do que
    // exportar silenciosamente um rascunho.
    if (!currentVersion) {
      alert(t('editor.scopePromptNeedsSave'));
      return;
    }
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

  const handleInputChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? (checked ? 'on' : 'off') : value;

    // Prevent negative numbers for numeric inputs
    if (type === 'number') {
      finalValue = Math.max(0, parseFloat(value) || 0).toString();
    }

    setFormData((prev: any) => {
      const newData = {
        ...prev,
        [name]: finalValue
      };
      return newData;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (!form) return;

      // Get all quantity inputs in the form
      const qtyInputs = Array.from(form.querySelectorAll('input[name^="item_"][name$="_qty"]')) as HTMLInputElement[];
      const currentIndex = qtyInputs.indexOf(e.currentTarget);
      
      if (currentIndex !== -1 && currentIndex < qtyInputs.length - 1) {
        // Focus and select the next quantity input
        const nextInput = qtyInputs[currentIndex + 1];
        nextInput.focus();
        nextInput.select();
      } else {
        // If it's the last one, just blur
        e.currentTarget.blur();
      }
    }
  };

  /** Botão Salvar: valida e abre a janela de escolha (atualizar x nova versão). */
  const handleSave = () => {
    if (!techLink) {
      alert(t('editor.versionFieldsRequired'));
      return;
    }
    setSaveMode(currentVersion ? 'update' : 'new');
    setNewVersionDescription('');
    setIsSaveDialogOpen(true);
  };

  const handleConfirmSave = () => {
    const description = newVersionDescription.trim();
    if (saveMode === 'new' && !description) {
      alert(t('editor.versionDescriptionRequired'));
      return;
    }
    if (saveMode === 'update' && !currentVersion) return;
    setIsSaveDialogOpen(false);

    startTransition(async () => {
      try {
        // ✅ Sempre reconstruímos as flat keys de customPackages a partir do array
        // que o usuário VÊ NA TELA (fonte da verdade). Isso elimina qualquer risco
        // de os campos terem ficado para trás no formData devido a batching.
        const mergedFormData: any = { ...formData };

        // 1. Remove TODAS as flat keys antigas de custom_pkg_* previamente salvas
        //    (evita restos de pacotes deletados voltarem na próxima carga)
        Object.keys(mergedFormData).forEach(k => {
          if (k.startsWith('custom_pkg_')) delete mergedFormData[k];
        });

        // 2. Escreve as flat keys a partir do estado atual customPackages
        customPackages.forEach(pkg => {
          const fields = [
            'name', 'hours', 'qty', 'skill', 'scopeIn', 'scopeOut',
            'overrideCheck', 'overrideVal'
          ] as const;
          fields.forEach(field => {
            const key = formKeyForField(pkg.category, pkg.index, field);
            const rawVal = pkg[field];
            mergedFormData[key] =
              rawVal === true ? 'on' :
              rawVal === false ? 'off' :
              rawVal ?? '';
          });
        });

        // 🔍 DEBUG: mostra exatamente o que será enviado para a Server Action
        const debugCustomKeysFinal = Object.keys(mergedFormData).filter(k => k.startsWith('custom_pkg_'));
        console.log('[DEBUG:SAVE] customPackages no momento do clique em Salvar:', customPackages.length, customPackages.map(p => `${p.id}:${p.name}`).join(', '));
        console.log('[DEBUG:SAVE] flat keys custom_pkg_* que serão gravadas em data:', debugCustomKeysFinal.length, debugCustomKeysFinal.join(', '));
        debugCustomKeysFinal.forEach(k => console.log(`[DEBUG:SAVE]   ${k} =`, (mergedFormData as any)[k]));

        const payload = {
          saveMode,
          versionId: saveMode === 'update' ? currentVersion?.id : null,
          description: saveMode === 'new' ? description : null,
          technicalScopeLink: techLink,
          zohoLink,
          gpPercent: percents.gp,
          discoveryPercent: percents.discovery,
          validationPercent: percents.validation,
          gpOverride: overrides.gp,
          discoveryOverride: overrides.discovery,
          validationOverride: overrides.validation,
          safetyHours: JSON.stringify(safetyHours),
          totalHours: Number(totals.grandTotal) || 0,
          data: {
            ...mergedFormData,
            marketplace_apps: JSON.stringify(marketplaceApps),
            __skuType: skuType,
            __planTier: planTier,
            __deploymentType: deploymentType
          }
        };
        console.log('[DEBUG:SAVE] Tamanho do JSON.stringify(payload.data) antes da requisição:',
          typeof payload.data === 'string'
            ? payload.data.length
            : JSON.stringify(payload.data).length);

        const result = await saveProjectVersionAction(project.id, payload);
        console.log('[DEBUG:SAVE] Versão criada. ID:', result.id, 'ProjectVersion.data (raw):',
          typeof (result as any).data === 'string'
            ? (result as any).data.slice(0, 300)
            : JSON.stringify((result as any).data ?? null).slice(0, 300));

        router.push(`/sc/project/${project.id}?version_id=${result.id}`);
        // Ao atualizar, a URL não muda: força a releitura da versão salva.
        router.refresh();
        alert(saveMode === 'update'
          ? t('editor.versionUpdated', { name: result.versionName })
          : t('editor.versionCreated', { name: result.versionName }));
      } catch (e) {
        console.error('[DEBUG:SAVE] saveProjectVersionAction ERROR:', e);
        alert(t('editor.versionSaveError'));
      }
    });
  };

  const handleClone = async () => {
    if (!currentVersion) {
      alert(t('editor.selectVersionToClone'));
      return;
    }

    // A cópia vira uma NOVA versão com número automático; só a descrição é pedida.
    const description = (prompt(
      t('editor.promptCloneDescription', { name: nextVersionLabel }),
      t('editor.copyOf', { name: versionName }),
    ) || '').trim();
    if (!description) return;

    const newLink = prompt(t('editor.promptCloneLink'), "");
    if (!newLink) {
      alert(t('editor.cloneLinkRequired'));
      return;
    }

    startTransition(async () => {
      try {
        const result = await cloneProjectVersionAction(project.id, currentVersion.id, description, newLink);
        router.push(`/sc/project/${project.id}?version_id=${result.id}`);
        alert(t('editor.versionCloned'));
      } catch (e) {
        console.error(e);
        alert(t('editor.versionCloneError'));
      }
    });
  };

  const formKeyForField = (category: string, index: number | string, field: string): string => {
    // Mapeia nomes dos campos do objeto (camelCase / Pascal) para o flat key usado
    // no JSON de `data`. IMPORTANTE: precisa ser o inverso EXATO do parser do
    // `useState customPackages`, senão categoria com espaço/underscore quebra.
    const snake: Record<string, string> = {
      overrideCheck: 'override_check',
      overrideVal:  'override_val',
      scopeIn:      'scope_in',
      scopeOut:     'scope_out'
    };
    return `custom_pkg_${category}_${index}_${snake[field] ?? field}`;
  };

  const addCustomPackage = (category: string) => {
    const index = Date.now();
    const newPkg = {
      id: `${category}_${index}`,
      category,
      index,
      name: '',
      hours: 0,
      qty: 1,
      skill: 'Implantação',
      scopeIn: '',
      scopeOut: '',
      overrideCheck: false,
      overrideVal: ''
    };
    setCustomPackages(prev => [...prev, newPkg]);

    // Also update formData for the new fields (TODOS os campos, não só 4)
    setFormData((prev: any) => ({
      ...prev,
      [formKeyForField(category, index, 'name')]: '',
      [formKeyForField(category, index, 'hours')]: 0,
      [formKeyForField(category, index, 'qty')]: 1,
      [formKeyForField(category, index, 'skill')]: 'Implantação',
      [formKeyForField(category, index, 'scopeIn')]: '',
      [formKeyForField(category, index, 'scopeOut')]: '',
      [formKeyForField(category, index, 'overrideCheck')]: 'off',
      [formKeyForField(category, index, 'overrideVal')]: ''
    }));
  };

  const updateCustomPackage = (id: string, field: string, value: any) => {
    // ✅ SetState FORA do functional updater do outro hook (evita stale batching do React 18)
    const pkg = customPackages.find(p => p.id === id);
    if (!pkg) return;

    let finalValue = value;
    if (['hours', 'qty', 'overrideVal'].includes(field)) {
      finalValue = Math.max(0, parseFloat(value) || 0);
    }

    setCustomPackages(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: finalValue } : p))
    );

    const formKey = formKeyForField(pkg.category, pkg.index, field);
    setFormData((f: any) => ({
      ...f,
      [formKey]: finalValue === true ? 'on' : finalValue === false ? 'off' : finalValue
    }));
  };

  const removeCustomPackage = (id: string) => {
    const pkg = customPackages.find(p => p.id === id);
    setCustomPackages(prev => prev.filter(p => p.id !== id));
    if (pkg) {
      // Limpa também as flat keys do formData para não "ressuscitar" o pacote no próximo load
      setFormData((prev: any) => {
        const next = { ...prev };
        [
          'name', 'hours', 'qty', 'skill', 'scopeIn', 'scopeOut',
          'overrideCheck', 'overrideVal'
        ].forEach(f => delete next[formKeyForField(pkg.category, pkg.index, f)]);
        return next;
      });
    }
  };

  const toggleSection = (cat: string) => {
    setCollapsedSections(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleSubcategory = (cat: string, subcategory: string) => {
    const key = subcategoryKey(cat, subcategory);
    setCollapsedSubcats(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addMarketplaceApp = () => {
    setMarketplaceApps([...marketplaceApps, { id: Date.now(), name: '', link: '' }]);
  };

  const updateMarketplaceApp = (id: number, field: string, value: string) => {
    setMarketplaceApps(prev => prev.map(app => app.id === id ? { ...app, [field]: value } : app));
  };

  const removeMarketplaceApp = (id: number) => {
    setMarketplaceApps(prev => prev.filter(app => app.id !== id));
  };

  const getOrderedPackagesForSubcategory = (category: string, subcategory: string) => {
    const key = subcategoryKey(category, subcategory);
    const orderedIds = layoutConfig.itemOrder[key] || [];
    const visiblePackages = (packagesByCategory[category] || [])
      .filter((pkg: any) => !hiddenItems.includes(pkg.id))
      .filter((pkg: any) => (layoutConfig.itemSubcategories[String(pkg.id)] || DEFAULT_SUBCATEGORY) === subcategory);

    return [...visiblePackages].sort((a: any, b: any) => {
      const indexA = orderedIds.indexOf(String(a.id));
      const indexB = orderedIds.indexOf(String(b.id));

      if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  const isAEEstimate = formData?.type === 'AE_ESTIMATE';

  // A barra fixa do rodapé só existe no editor de escopo (não na visão AE):
  // reserva espaço no fim da página para ela não cobrir conteúdo.
  useEffect(() => {
    if (isAEEstimate) return;
    document.body.classList.add('has-editor-bar');
    return () => document.body.classList.remove('has-editor-bar');
  }, [isAEEstimate]);

  // Navegação rápida (barra do rodapé): sabe se a página está no topo ou no
  // fim para desabilitar o botão que não teria efeito.
  const [scrollEdges, setScrollEdges] = useState({ atTop: true, atBottom: false });
  useEffect(() => {
    if (isAEEstimate) return;
    const EDGE = 120;
    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const next = {
        atTop: window.scrollY <= EDGE,
        atBottom: window.scrollY + window.innerHeight >= doc.scrollHeight - EDGE,
      };
      setScrollEdges((prev) =>
        prev.atTop === next.atTop && prev.atBottom === next.atBottom ? prev : next,
      );
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    // A altura muda quando seções abrem/fecham, não só no scroll.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [isAEEstimate]);

  const scrollPageTo = (where: 'top' | 'bottom') => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: where === 'top' ? 0 : document.documentElement.scrollHeight,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  if (isAEEstimate) {
    const aeData = formData.formData || {};
    return (
      <div className="space-y-8 pb-12 animate-in fade-in duration-500">
        {/* Header AE */}
        <div className="bg-white p-8 rounded-3xl border border-slate-300 shadow-sm">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-4">
                <div className="bg-brand-soft text-brand-soft-fg p-2 rounded-xl">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-brand-dark font-heading text-section ">{project.name}</h1>
                  <p className="text-label font-medium text-slate-400 ">{t('editor.clientFolder')}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 bg-white p-1.5 rounded-xl border border-slate-300 w-fit">
                <span className="text-caption font-medium text-slate-400 pl-2">{t('editor.selectedSimulation')}</span>
                <div className="relative">
                  <select 
                    value={currentVersion?.id || ''}
                    onChange={(e) => router.push(`/sc/project/${project.id}?version_id=${e.target.value}`)}
                    className="bg-white border border-slate-200 rounded-lg text-caption font-medium p-2 pr-8 focus:ring-2 focus:ring-brand-primary outline-none appearance-none cursor-pointer shadow-sm transition-all"
                  >
                    {allVersions.map((v: any) => (
                      <option key={v.id} value={v.id}>{versionOptionLabel(v)}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <Link 
                href={`/ae?client=${encodeURIComponent(project.name)}`}
                className="flex-1 lg:flex-none bg-brand-primary text-brand-ink px-8 py-4 rounded-2xl font-medium hover:opacity-90 shadow-lg shadow-green-900/10 transition-all flex items-center justify-center space-x-3 text-label "
              >
                <Plus className="w-4 h-4" />
                <span>{t('editor.newEstimate')}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* AE Summary Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-10">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-slate-100 p-3 rounded-2xl text-slate-400">
                  <Layout className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-brand-dark tracking-tight">{t('editor.configSummary')}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-2">
                  <span className="text-label font-medium text-slate-400 block">{t('editor.agents')}</span>
                  <div className="text-3xl font-bold text-brand-dark ">{aeData.agents || 0}</div>
                </div>
                <div className="space-y-2">
                  <span className="text-label font-medium text-slate-400 block">{t('editor.brands')}</span>
                  <div className="text-3xl font-bold text-brand-dark ">{aeData.brands || 0}</div>
                </div>
                <div className="space-y-2">
                  <span className="text-label font-medium text-slate-400 block">{t('editor.clientAreas')}</span>
                  <div className="text-3xl font-bold text-brand-dark ">{aeData.areas || 0}</div>
                </div>
              </div>

              <div className="space-y-4">
                <span className="text-label font-medium text-slate-400 block">{t('editor.activeChannels')}</span>
                <div className="flex flex-wrap gap-2">
                  {aeData.channels?.length > 0 ? aeData.channels.map((c: string) => (
                    <span key={c} className="bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl text-label font-medium border border-brand-primary/20">
                      {c}
                    </span>
                  )) : <span className="text-slate-300 italic text-label">{t('editor.noChannelSelected')}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Integração', active: aeData.hasIntegration, icon: Settings },
                  { label: 'QA', active: aeData.hasQA, icon: CheckSquare },
                  { label: 'WFM', active: aeData.hasWFM, icon: Users }
                  // O chip de AI Agents saiu: este painel resume uma estimativa
                  // da Calculadora AE, que não dimensiona mais esse módulo — a
                  // etiqueta seria sempre falsa.
                ].map((feat) => (
                  <div key={feat.label} className={`p-4 rounded-2xl border flex items-center space-x-3 ${feat.active ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                    <feat.icon className="w-4 h-4" />
                    <span className="text-caption font-medium ">{feat.label}</span>
                  </div>
                ))}
              </div>

              {aeData.hasCopilot && (
                <div className="bg-slate-100 border border-slate-200 p-6 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-brand-soft text-brand-soft-fg p-2.5 rounded-xl">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-label font-medium text-brand-dark block">{t('editor.zendeskCopilot')}</span>
                      <span className="text-label font-medium text-brand-dark ">
                        {aeData.copilotType === 'with_api' ? t('editor.withExternalConnection') : t('editor.withoutExternalConnection')}
                      </span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-brand-dark" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className={`p-10 rounded-3xl shadow-2xl relative overflow-hidden text-center space-y-8 ${
              formData.needsSC ? 'bg-amber-50 border-4 border-amber-200' : 'bg-brand-dark text-[color:var(--bg-main)]'
            }`}>
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                {formData.needsSC ? <AlertTriangle className="w-32 h-32 text-amber-500" /> : <ShieldCheck className="w-32 h-32 text-white" />}
              </div>

              <div className="relative z-10 space-y-6">
                <div className="flex flex-col items-center space-y-3">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl ${
                    formData.needsSC ? 'bg-amber-200 text-amber-700' : 'brand-bg-primary text-brand-ink'
                  }`}>
                    {formData.needsSC ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                  </div>
                  <h3 className={`text-label font-medium ${formData.needsSC ? 'text-amber-600' : 'text-slate-400'}`}>
                    {t('editor.calculatedEffort')}
                  </h3>
                </div>

                <div className="space-y-1">
                  <div className={`text-6xl font-bold ${formData.needsSC ? 'text-amber-700' : 'text-brand-accent'}`}>
                    {formData.needsSC ? t('editor.consultSC') : `${(formData.resultHours || 0).toFixed(0)}H`}
                  </div>
                  <p className={`text-label font-medium ${formData.needsSC ? 'text-amber-600' : 'text-slate-400'}`}>
                    {formData.needsSC ? t('editor.needsSCSupport') : t('editor.totalEstimated')}
                  </p>
                </div>

                {!formData.needsSC && (
                  <div className="pt-6 border-t border-white/10 flex items-center justify-center space-x-3 text-label font-medium text-slate-400">
                    <span>Inclui GP ({((variables?.find((v:any)=>v.key==='AE_GP_PERCENTAGE')?.value || 0.15)*100).toFixed(0)}%)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-8 pb-12 xl:mx-[calc((100%_-_min(100vw_-_80px,1680px))/2)]" onSubmit={(e) => e.preventDefault()}>
      {/* Header: Project Controls */}
      <div className="bg-white p-8 rounded-3xl border border-slate-300 mb-8 shadow-sm">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-50 pb-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-4">
                <div className="brand-bg-primary p-2 rounded-xl shadow-lg shadow-green-900/10">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-brand-dark font-heading text-section ">{project.name}</h1>
              </div>
              
              <div className="flex items-center space-x-3 bg-white p-1.5 rounded-xl border border-slate-300 w-fit">
                <span className="text-caption font-medium text-slate-400 pl-2">{t('editor.activeVersion')}</span>
                <div className="relative">
                  <select 
                    value={currentVersion?.id || ''}
                    onChange={(e) => router.push(`/sc/project/${project.id}?version_id=${e.target.value}`)}
                    className="bg-white border border-slate-200 rounded-lg text-caption font-medium p-2 pr-8 focus:ring-2 focus:ring-brand-primary outline-none appearance-none cursor-pointer shadow-sm transition-all"
                  >
                    {!currentVersion && !allVersions.length && <option value="">{t('editor.initialDraft')}</option>}
                    {allVersions.map((v: any) => (
                      <option key={v.id} value={v.id}>{versionOptionLabel(v)}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full lg:w-auto min-w-0">
              <button 
                type="button" 
                onClick={handleClone}
                disabled={isPending || !currentVersion}
                className="shrink-1 min-w-0 lg:flex-none lg:shrink-0 border-2 border-brand-primary text-brand-primary px-4 lg:px-6 py-3.5 rounded-xl font-medium hover:bg-brand-primary hover:text-brand-ink transition-all flex items-center justify-center gap-2 text-label disabled:opacity-50 overflow-hidden"
              >
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t('editor.clone')}</span>
              </button>
              {/* Copia o escopo como prompt pronto para a skill scope-creator.
                  A geração do documento é manual e proposital: nada aqui chama
                  a API da Claude. */}
              <button
                type="button"
                onClick={handleCopyScopePrompt}
                disabled={isPending || !currentVersion}
                title={currentVersion ? t('editor.copyScopePromptHint') : t('editor.scopePromptNeedsSave')}
                className={`shrink-1 min-w-0 lg:flex-none lg:shrink-0 px-4 lg:px-6 py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-label disabled:opacity-50 overflow-hidden ${
                  scopePromptCopied
                    ? 'bg-brand-primary text-brand-ink'
                    : 'border-2 border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-[color:var(--bg-main)]'
                }`}
              >
                {scopePromptCopied ? <Check className="w-3.5 h-3.5 shrink-0" /> : <MessageSquare className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{scopePromptCopied ? t('editor.scopePromptCopied') : t('editor.copyScopePrompt')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 pt-8 border-t border-slate-200 dark:border-[color:var(--border-main)]">
            <div className="space-y-2">
              <label className="block text-caption font-medium text-slate-400 ml-1">{t('plans.sku')}</label>
              <select
                value={skuType}
                onChange={(e) => setSkuType(normalizeSkuType(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-5 py-3 text-label font-medium tracking-tight focus:ring-2 focus:ring-brand-primary outline-none transition-all"
              >
                <option value="CS">{t('plans.customerService')}</option>
                <option value="ES">{t('plans.employeeService')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-caption font-medium text-slate-400 ml-1">{t('plans.tier')}</label>
              <select
                value={planTier}
                onChange={(e) => setPlanTier(normalizePlanTier(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-5 py-3 text-label font-medium tracking-tight focus:ring-2 focus:ring-brand-primary outline-none transition-all"
              >
                {ZENDESK_PLANS.map((plan) => (
                  <option key={plan} value={plan}>{PLAN_LABEL[plan]}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-caption font-medium text-slate-400 ml-1">{t('editor.deploymentType')}</label>
              <div className="flex bg-slate-100 dark:bg-[color:var(--bg-input)] p-1 rounded-xl max-w-md">
                <button
                  type="button"
                  onClick={() => setDeploymentType('new')}
                  className={`flex-1 py-2.5 rounded-lg text-caption font-medium transition-all ${
                    deploymentType === 'new'
                      ? 'bg-brand-primary text-brand-ink shadow-sm'
                      : 'text-slate-400 dark:text-[color:var(--text-muted)] hover:text-slate-600'
                  }`}
                >
                  {t('editor.deploymentNew')}
                </button>
                <button
                  type="button"
                  onClick={() => setDeploymentType('optimization')}
                  className={`flex-1 py-2.5 rounded-lg text-caption font-medium transition-all ${
                    deploymentType === 'optimization'
                      ? 'bg-brand-primary text-brand-ink shadow-sm'
                      : 'text-slate-400 dark:text-[color:var(--text-muted)] hover:text-slate-600'
                  }`}
                >
                  {t('editor.deploymentOptimization')}
                </button>
              </div>
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <p className="text-caption font-bold text-slate-400 dark:text-[color:var(--text-muted)]">
                {t('plans.filterHint')}
              </p>
              {planExcludedCount > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 text-caption font-medium ">
                  {t('plans.excludedCount', { count: planExcludedCount })}
                </span>
              )}
              {planExcludedCategories.length > 0 && (
                <span
                  title={planExcludedCategories.map((cat: string) => catLabelOf(cat)).join(' · ')}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 text-caption font-medium "
                >
                  {t('plans.excludedCategories', {
                    count: planExcludedCategories.length,
                    list: planExcludedCategories.map((cat: string) => catLabelOf(cat)).join(', '),
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Os links do escopo e do Zoho ficam na barra fixa do rodapé, junto do Salvar. */}
          <div className="max-w-md space-y-2">
            <label className="block text-caption font-medium text-slate-400 ml-1">{t('editor.versionIdentification')}</label>
            {/* Somente leitura: a numeração das versões é automática. */}
            <div className="w-full bg-slate-50 dark:bg-[color:var(--bg-input)] border border-slate-300 dark:border-[color:var(--border-main)] rounded-xl px-5 py-3 text-label">
              <span className="font-bold text-brand-dark dark:text-[color:var(--text-main)]">
                {versionName || t('editor.versionNotSaved', { name: nextVersionLabel })}
              </span>
              {currentVersion?.description && (
                <span className="block text-caption text-slate-500 dark:text-[color:var(--text-muted)] mt-0.5">
                  {currentVersion.description}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grade do editor: conteúdo à esquerda e, a partir de xl, o resumo de horas
          fixo à direita, atualizado a cada alteração da estimativa. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-8">
      <div className="min-w-0 space-y-8">
      {/* Area Selection */}
      <div className="bg-white dark:bg-[color:var(--bg-card)] dark:border dark:border-[color:var(--border-main)] p-10 rounded-3xl border border-slate-300 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div className="flex items-center space-x-4">
            <div className="brand-bg-primary p-2.5 rounded-2xl shadow-lg shadow-green-900/10 text-brand-ink">
              <Layout className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-brand-dark dark:text-[color:var(--text-main)] font-heading text-section ">{t('editor.projectModules')}</h3>
              <p className="text-slate-400 dark:text-[color:var(--text-muted)] text-label font-medium mt-1">{t('editor.projectModulesHint')}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowPresets(!showPresets)}
                className="p-2 rounded-xl bg-slate-50 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] text-slate-400 border border-slate-200 hover:text-brand-primary transition-all"
                title={t('editor.viewPresets')}
              >
                <Settings className="w-4 h-4" />
              </button>
              {showPresets && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border border-slate-200 rounded-2xl shadow-2xl p-6 z-[60] space-y-4 animate-in fade-in slide-in-from-top-2 backdrop-blur-none">
                  <div className="flex items-center justify-between">
                    <h4 className="text-label font-medium text-slate-400 dark:text-[color:var(--text-muted)]">{t('editor.myPresets')}</h4>
                    <Users className="w-3 h-3 text-slate-300 dark:text-[color:var(--text-muted)]" />
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {presets.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-caption font-medium text-slate-300 dark:text-[color:var(--text-muted)] leading-relaxed">{t('editor.noPresets')}</p>
                      </div>
                    ) : (
                      presets.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 group/preset">
                          <button
                            onClick={() => applyPreset(p)}
                            className="flex-1 text-left p-3 rounded-xl hover:bg-[color:var(--bg-input)] dark:hover:bg-[color:var(--bg-input-solid)] border border-transparent hover:border-slate-100 dark:hover:border-[color:var(--border-main)] text-label font-medium text-brand-dark dark:text-[color:var(--text-main)] transition-all flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span>{packageName(p, language)}</span>
                              <span className="text-caption text-slate-300 dark:text-[color:var(--text-muted)] font-medium">{Array.isArray(p.hiddenItems) ? p.hiddenItems.length : 0} itens ocultos</span>
                            </div>
                            <Check className="w-3 h-3 text-emerald-500 opacity-0 group-hover/preset:opacity-100 transition-opacity" />
                          </button>
                          <button 
                            onClick={() => handleDeletePreset(p.name)}
                            className="p-2 text-slate-300 dark:text-[color:var(--text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover/preset:opacity-100"
                            title={t('editor.deletePreset')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-[color:var(--border-main)] space-y-3">
                    <div>
                      <label className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] mb-1.5 block ml-1">{t('editor.saveCurrentConfig')}</label>
                      <input 
                        type="text" 
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder={t('editor.presetNamePlaceholder')}
                        className="w-full bg-[color:var(--bg-input)] dark:bg-[color:var(--bg-input-solid)]! dark:text-[color:var(--text-main)] dark:placeholder:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-2.5 text-label font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                      />
                    </div>
                    <button 
                      onClick={handleSavePreset}
                      className="w-full bg-brand-primary text-brand-ink py-3 rounded-xl text-caption font-medium shadow-lg shadow-green-900/10 hover:opacity-90 transition-all flex items-center justify-center space-x-2"
                    >
                      <Save className="w-3 h-3" />
                      <span>{t('editor.savePreset')}</span>
                    </button>
                    <p className="text-caption text-slate-400 dark:text-[color:var(--text-muted)] text-center font-medium ">{t('editor.presetsPrivateNote')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="relative w-full sm:max-w-xl" ref={moduleSelectRef}>
              <button
                type="button"
                onClick={() => setIsModuleSelectOpen((v) => !v)}
                className="w-full bg-white dark:bg-[color:var(--bg-card-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] px-5 py-4 rounded-3xl border border-slate-300 hover:border-brand-primary transition-all duration-500 shadow-sm hover:shadow-xl flex items-center justify-between gap-4"
              >
                <div className="flex flex-col items-start">
                  <span className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{t('editor.projectModules')}</span>
                  <span className="text-label font-medium text-brand-dark dark:text-[color:var(--text-main)] tracking-tight mt-1">
                    {t('editor.selectModules')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)]">
                    {visibleCategories.filter((cat: string) => formData[`check_area_${cat}`] === 'on').length}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-[color:var(--text-muted)] transition-transform ${isModuleSelectOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isModuleSelectOpen && (
                <div className="absolute z-50 mt-2 w-full bg-white dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border border-slate-300 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-none">
                  <div className="max-h-[360px] overflow-auto divide-y divide-slate-50 dark:divide-[color:var(--border-main)]">
                    {visibleCategories.map((cat: string, index: number) => {
                      const isChecked = formData[`check_area_${cat}`] === 'on';
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategoryChecked(cat, !isChecked);
                            setShowHiddenTab(false);
                          }}
                          className="w-full px-4 py-3 hover:bg-[color:var(--bg-input)] dark:hover:bg-[color:var(--bg-input-solid)] transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-2xl border flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'brand-bg-primary border-brand-primary text-brand-ink'
                                : 'bg-[color:var(--bg-input)] dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border-slate-200 text-slate-300'
                            }`}>
                              <Check className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="text-label font-medium text-brand-dark dark:text-[color:var(--text-main)]">
                                {catLabelOf(cat)}
                              </span>
                              <span className="text-caption font-medium text-slate-300 dark:text-[color:var(--text-muted)] mt-0.5">
                                {isChecked ? t('common.selected') : t('common.notSelected')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void reorderCategory(cat, 'up');
                              }}
                              disabled={index === 0}
                              className="p-2 rounded-2xl bg-[color:var(--bg-input)] dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                              title={t('editor.moveCategoryUp')}
                            >
                              <ChevronDown className="w-3 h-3 rotate-180" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void reorderCategory(cat, 'down');
                              }}
                              disabled={index === visibleCategories.length - 1}
                              className="p-2 rounded-2xl bg-[color:var(--bg-input)] dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                              title={t('editor.moveCategoryDown')}
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowHiddenTab(!showHiddenTab)}
              className={`w-full sm:w-auto bg-white dark:bg-[color:var(--bg-card-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] px-5 py-4 rounded-3xl border transition-all duration-500 shadow-sm hover:shadow-xl flex items-center justify-between sm:justify-start gap-4 ${
                showHiddenTab ? 'border-red-500' : 'border-slate-300 hover:border-red-500/60'
              }`}
            >
              <div className={`w-8 h-8 rounded-2xl flex items-center justify-center border transition-colors ${
                showHiddenTab
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'bg-[color:var(--bg-input)] dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border-slate-200 text-slate-400'
              }`}>
                <EyeOff className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{t('editor.visibility')}</span>
                <span className="text-label font-medium text-brand-dark dark:text-[color:var(--text-main)] tracking-tight mt-1">{t('editor.hiddenItemsShort')}</span>
              </div>
              <span className={`ml-auto sm:ml-0 text-caption font-medium ${
                showHiddenTab ? 'text-red-500' : 'text-slate-400 dark:text-[color:var(--text-muted)]'
              }`}>
                {hiddenItems.length}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleCategories.filter((cat: string) => formData[`check_area_${cat}`] === 'on').length === 0 ? (
              <div className="text-caption font-medium text-slate-400">
                {t('editor.noModuleSelected')}
              </div>
            ) : (
              visibleCategories
                .filter((cat: string) => formData[`check_area_${cat}`] === 'on')
                .map((cat: string) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryChecked(cat, false)}
                    className="inline-flex items-center gap-2 bg-brand-primary text-brand-ink px-3 py-1.5 rounded-2xl text-caption font-medium shadow-sm hover:opacity-90 transition-all"
                    title={t('editor.removeModule')}
                  >
                    <span>{catLabelOf(cat)}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))
            )}
          </div>
        </div>

        <div className="mt-6 relative">
          <div className="flex items-center gap-3 bg-white dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <Search className="w-4 h-4 text-slate-300 dark:text-[color:var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 150)}
              placeholder={t('editor.searchPlaceholder')}
              className="w-full bg-transparent outline-none text-label font-bold text-brand-dark dark:text-[color:var(--text-main)] placeholder:text-slate-300 dark:placeholder:text-[color:var(--text-muted)]"
            />
          </div>

          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute z-50 mt-2 w-full bg-white dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border border-slate-200 rounded-2xl shadow-xl overflow-hidden backdrop-blur-none">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-label font-medium text-slate-300 dark:text-[color:var(--text-muted)]">
                  {t('editor.noResults')}
                </div>
              ) : (
                <div className="max-h-[360px] overflow-auto divide-y divide-slate-50 dark:divide-[color:var(--border-main)]">
                  {searchResults.map((r: any) => (
                    <button
                      key={r.__key}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void goToSearchResult(r)}
                      className="w-full text-left px-4 py-3 hover:bg-[color:var(--bg-input)] dark:hover:bg-[color:var(--bg-input-solid)] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col">
                          <div className="text-label font-medium text-brand-dark dark:text-[color:var(--text-main)]">
                            {r.label}
                          </div>
                          {r.subtitle && (
                            <div className="text-caption font-medium text-slate-300 dark:text-[color:var(--text-muted)] mt-0.5">
                              {r.subtitle}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {r.type === 'category' && (
                            <span className="text-caption font-medium text-slate-300 dark:text-[color:var(--text-muted)]">{t('common.category')}</span>
                          )}
                          {r.type === 'subcategory' && (
                            <span className="text-caption font-medium text-slate-300 dark:text-[color:var(--text-muted)]">{t('editor.subcategory')}</span>
                          )}
                          {r.type === 'item' && (
                            <span className="text-caption font-medium text-slate-300 dark:text-[color:var(--text-muted)]">{t('common.item')}</span>
                          )}
                          {r.isHidden && (
                            <span className="text-caption font-medium text-red-400">{t('common.hidden')}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Package Sections */}
      <div className="space-y-6">
        {/* Renderização da aba de itens ocultos */}
        {showHiddenTab && (
          <div className="bg-white rounded-3xl border-2 border-red-100 shadow-xl shadow-red-900/5 overflow-hidden transition-all duration-300">
            <div className="bg-red-50/50 px-8 py-5 border-b border-red-100 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-sm">
                  <EyeOff className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-red-700 text-title font-bold">{t('editor.hiddenItems')}</h3>
                  <p className="text-caption font-medium text-red-400 ">{t('editor.hiddenItemsHint')}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowHiddenTab(false)}
                className="text-red-300 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {hiddenItems.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-200">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-label font-medium text-slate-300 ">{t('editor.noHiddenItems')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-3 text-left text-caption font-medium text-slate-400 ">{t('common.item')}</th>
                        <th className="pb-3 text-left text-caption font-medium text-slate-400 ">{t('common.category')}</th>
                        <th className="pb-3 text-right text-caption font-medium text-slate-400 ">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allPackages
                        .filter((p: any) => hiddenItems.includes(p.id))
                        .map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="py-4">
                              <div className="font-medium text-brand-dark text-label tracking-tight ">{packageName(p, language)}</div>
                              <div className="text-caption text-slate-400 font-medium ">{p.skillName || p.skill}</div>
                            </td>
                            <td className="py-4">
                    <span className="text-caption bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-medium ">
                      {catLabelOf(p.categoryName)}
                    </span>
                            </td>
                            <td className="py-4 text-right">
                              <button 
                                type="button"
                                onClick={() => toggleHideItem(p.id)}
                                className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-caption font-medium hover:bg-emerald-600 hover:text-white transition-all"
                              >
                                <Eye className="w-3 h-3" />
                                <span>{t('editor.unhide')}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {visibleCategories.map((cat: string) => (
          formData[`check_area_${cat}`] === 'on' && (
            <div id={`cat_section_${domSafeId(cat)}`} key={cat} className="scroll-mt-24 bg-white dark:bg-[color:var(--bg-card)] dark:border-[color:var(--border-main)] rounded-3xl border border-slate-300 shadow-sm transition-all duration-300">
              {/* Cabeçalho da CATEGORIA (ex.: Zendesk Support): faixa verde-clara,
                  título em Bebas e total da categoria. Fica preso no topo enquanto
                  a lista da categoria rola, para saber sempre em que seção se está. */}
              <div
                className={`sticky top-[68px] z-20 bg-brand-soft text-brand-soft-fg px-6 md:px-8 py-4 flex justify-between items-center gap-4 cursor-pointer select-none group ${collapsedSections[cat] ? 'rounded-3xl' : 'rounded-t-3xl border-b border-slate-300'}`}
                onClick={() => toggleSection(cat)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-dark shrink-0">
                    <Box className="w-5 h-5" />
                  </div>
                  <h3 className="font-heading text-section leading-none text-brand-dark truncate">{catLabelOf(cat)}</h3>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-heading text-[26px] leading-none text-brand-dark tabular-nums">{fmtWholeHours(totals.catTotals?.[cat])}</span>
                  <span className="hidden md:inline text-label font-medium text-brand-dark">{t('editor.configureItems')}</span>
                  <ChevronDown className={`w-5 h-5 text-brand-dark transition-transform ${collapsedSections[cat] ? '' : 'rotate-180'}`} />
                </div>
              </div>
              
              {!collapsedSections[cat] && (
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-slate-300 dark:border-[color:var(--border-main)]">
                          <th className="pb-3 text-left text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{t('common.items')}</th>
                          <th className="pb-3 text-center text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{t('editor.unitHours')}</th>
                          <th className="pb-3 text-center text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] w-32">{t('common.quantity')}</th>
                          <th className="pb-3 text-center text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{t('common.organization')}</th>
                          <th className="pb-3 text-right text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{t('editor.manualAdjustment')}</th>
                          <th className="pb-3 text-right text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{t('common.subtotal')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-[color:var(--border-main)]">
                        {(layoutConfig.subcategoryOrder[cat] || [DEFAULT_SUBCATEGORY]).map((subcategory, subcategoryIndex, allSubcategories) => {
                          const orderedPackages = getOrderedPackagesForSubcategory(cat, subcategory).filter(isAvailable);
                          const subcategoryCollapsed = Boolean(collapsedSubcats[subcategoryKey(cat, subcategory)]);
                          const subcategoryHours = orderedPackages.reduce((acc: number, pkg: any) => acc + (Number(totals.itemTotals?.[pkg.id]) || 0), 0);

                          return (
                            <Fragment key={`${cat}_${subcategory}`}>
                              <tr id={`subcat_${domSafeId(cat)}_${domSafeId(subcategory)}`} key={`${cat}_${subcategory}_header`} className="bg-slate-100 dark:bg-[color:var(--bg-input-solid)] border-t-2 border-slate-300">
                                <td colSpan={6} className="py-3.5 px-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    {/* Cabeçalho da SUBCATEGORIA (ex.: Campos e Formulários) */}
                                    {/* Clicar no nome também recolhe/expande a subcategoria */}
                                    <button
                                      type="button"
                                      onClick={() => toggleSubcategory(cat, subcategory)}
                                      aria-expanded={!subcategoryCollapsed}
                                      className="flex items-center gap-3 min-w-0 text-left"
                                    >
                                      <span aria-hidden className={`w-0 h-0 shrink-0 border-l-[9px] border-l-[color:var(--primary)] border-y-[6px] border-y-transparent transition-transform duration-200 ${subcategoryCollapsed ? '' : 'rotate-90'}`} />
                                      <span className="text-title font-bold text-brand-dark truncate">
                                        {subcategoryLabel(t, subcategory)}
                                      </span>
                                      <span className="text-label text-slate-500 whitespace-nowrap">
                                        {orderedPackages.length} item(ns)
                                      </span>
                                    </button>
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span className="text-body font-bold text-brand-dark tabular-nums mr-1">{fmtLiveHours(subcategoryHours)}</span>
                                      <button
                                        type="button"
                                        onClick={() => void reorderSubcategory(cat, subcategory, 'up')}
                                        disabled={subcategoryIndex === 0}
                                        className="p-1.5 rounded-lg bg-white dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-muted)] border border-slate-200 dark:border-[color:var(--border-main)] text-slate-400 hover:text-brand-primary disabled:opacity-30"
                                        title={t('editor.moveSubcategoryUp')}
                                      >
                                        <ChevronDown className="w-3 h-3 rotate-180" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void reorderSubcategory(cat, subcategory, 'down')}
                                        disabled={subcategoryIndex === allSubcategories.length - 1}
                                        className="p-1.5 rounded-lg bg-white dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-muted)] border border-slate-200 dark:border-[color:var(--border-main)] text-slate-400 hover:text-brand-primary disabled:opacity-30"
                                        title={t('editor.moveSubcategoryDown')}
                                      >
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleSubcategory(cat, subcategory)}
                                        aria-expanded={!subcategoryCollapsed}
                                        className="inline-flex items-center gap-1.5 h-8 pl-3 pr-2.5 rounded-full border border-slate-300 bg-white text-label font-medium text-brand-dark hover:border-slate-500 transition-colors"
                                      >
                                        {subcategoryCollapsed ? t('editor.expandSubcategory', 'Expandir') : t('editor.collapseSubcategory', 'Recolher')}
                                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${subcategoryCollapsed ? '' : 'rotate-180'}`} />
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>

                              {subcategoryCollapsed ? null : orderedPackages.length === 0 ? (
                                <tr key={`${cat}_${subcategory}_empty`} className="bg-white dark:bg-[color:var(--bg-card)]">
                                  <td colSpan={6} className="py-4 px-4 text-caption font-medium text-slate-300 dark:text-[color:var(--text-muted)] text-center">
                                    {t('editor.noItemsInSubcategory')}
                                  </td>
                                </tr>
                              ) : (
                                orderedPackages.map((p: any) => {
                                  const isDependencyMet = !p.dependsOnItemId ||
                                    (formData[`item_${p.dependsOnItemId}_qty`] > 0);

                                  if (!isDependencyMet) return null;

                                  const qty = parseFloat(formData[`item_${p.id}_qty`] || 0);
                                  const isOverride = formData[`item_override_check_${p.id}`] === 'on';
                                  const overrideVal = parseFloat(formData[`item_override_val_${p.id}`] || 0);
                                  const rowTotal = isOverride ? overrideVal : qty * p.hours;
                                  const itemId = String(p.id);
                                  const currentItemOrder = layoutConfig.itemOrder[subcategoryKey(cat, subcategory)] || [];
                                  const itemIndex = currentItemOrder.indexOf(itemId);

                                  return (
                                    <tr key={p.id} className="hover:bg-slate-50/20 dark:hover:bg-[color:var(--bg-input)] transition-colors group">
                                      <td className="py-4 pr-4">
                                        <div className="flex items-center space-x-2">
                                          <div className="font-medium text-brand-dark dark:text-[color:var(--text-main)] text-label mb-0.5 tracking-tight ">{packageName(p, language)}</div>
                                          <button
                                            type="button"
                                            onClick={() => toggleHideItem(p.id)}
                                            className="p-1 text-slate-300 dark:text-[color:var(--text-muted)] hover:text-red-500 transition-all"
                                            title={t('editor.hideItem')}
                                          >
                                            <EyeOff className="w-3 h-3" />
                                          </button>
                                          {packageTooltip(p, language) && (
                                            <div className="group/tooltip relative cursor-help">
                                              <div className="w-3 h-3 bg-slate-100 dark:bg-[color:var(--bg-input)] text-slate-400 dark:text-[color:var(--text-muted)] rounded-full flex items-center justify-center text-caption font-medium group-hover/tooltip:bg-brand-primary group-hover/tooltip:text-brand-ink transition-colors">?</div>
                                              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-brand-dark text-[color:var(--bg-main)] dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)] dark:border dark:border-[color:var(--border-main)] text-caption font-bold p-3 rounded-xl w-48 shadow-2xl opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50">
                                                {packageTooltip(p, language)}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-2 mb-1">
                                          <span className="text-caption bg-slate-100 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-muted)] text-slate-500 px-2 py-1 rounded-lg font-medium ">{p.skillName || p.skill}</span>
                                          {p.dependsOnItemId && (
                                            <span className="text-caption bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 text-amber-600 px-2 py-1 rounded-lg font-medium ">Dep: {allPackages.find((ap:any) => ap.id === p.dependsOnItemId)?.name}</span>
                                          )}
                                        </div>
                                        <div className="text-caption text-slate-400 dark:text-[color:var(--text-muted)] font-bold max-w-md leading-relaxed line-clamp-1 opacity-60" title={p.scopeIncluded}>
                                          {p.scopeIncluded}
                                        </div>
                                      </td>
                                      <td className="py-4 text-center text-label font-medium text-slate-400 dark:text-[color:var(--text-main)] ">
                                        <div>{p.hours}</div>
                                        <div className="text-caption font-bold text-slate-300 dark:text-[color:var(--text-muted)] tracking-normal normal-case mt-0.5">
                                          {formatHoursMinutes(p.hours)}
                                        </div>
                                      </td>
                                      <td className="py-4 px-4">
                                        <div className="flex justify-center">
                                          <input
                                            type="number"
                                            min="0"
                                            name={`item_${p.id}_qty`}
                                            value={formData[`item_${p.id}_qty`] || ''}
                                            onChange={handleInputChange}
                                            onKeyDown={handleKeyDown}
                                            className="w-16 bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-300 rounded-lg px-2 py-1.5 text-label font-medium text-center focus:ring-2 focus:ring-brand-primary focus:bg-white dark:focus:bg-[color:var(--bg-card)] outline-none transition-all"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          <select
                                            value={subcategory}
                                            onChange={(e) => void moveItemToSubcategory(cat, itemId, e.target.value)}
                                            className="bg-white dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-2 py-1 text-caption font-medium outline-none"
                                          >
                                            {(layoutConfig.subcategoryOrder[cat] || [DEFAULT_SUBCATEGORY]).map((option) => (
                                              <option key={option} value={option}>{option}</option>
                                            ))}
                                          </select>
                                          <button
                                            type="button"
                                            onClick={() => void reorderItemInSubcategory(cat, subcategory, itemId, 'up')}
                                            disabled={itemIndex <= 0}
                                            className="p-1 rounded-md bg-slate-50 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                                            title={t('editor.moveItemUp')}
                                          >
                                            <ChevronDown className="w-3 h-3 rotate-180" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void reorderItemInSubcategory(cat, subcategory, itemId, 'down')}
                                            disabled={itemIndex === -1 || itemIndex >= currentItemOrder.length - 1}
                                            className="p-1 rounded-md bg-slate-50 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                                            title={t('editor.moveItemDown')}
                                          >
                                            <ChevronDown className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </td>
                                      <td className="py-4 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                          <label className="flex items-center cursor-pointer group/toggle">
                                            <input
                                              type="checkbox"
                                              name={`item_override_check_${p.id}`}
                                              checked={formData[`item_override_check_${p.id}`] === 'on'}
                                              onChange={handleInputChange}
                                              className="sr-only"
                                            />
                                            <div className={`w-6 h-3 rounded-full relative shadow-inner transition-all ${
                                              formData[`item_override_check_${p.id}`] === 'on' ? 'bg-brand-secondary dark:bg-[color:var(--secondary)]' : 'bg-slate-100 dark:bg-[color:var(--bg-input)] dark:border dark:border-[color:var(--border-main)]'
                                            }`}>
                                              <div className={`absolute top-[1px] left-[1px] bg-white dark:bg-[color:var(--bg-card)] rounded-full h-2.5 w-2.5 transition-all ${
                                                formData[`item_override_check_${p.id}`] === 'on' ? 'translate-x-3' : ''
                                              }`} />
                                            </div>
                                            <span className="ml-1.5 text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] group-hover/toggle:text-brand-secondary dark:group-hover/toggle:text-[color:var(--secondary)] transition-colors ">{t('common.manual')}</span>
                                          </label>
                                          {formData[`item_override_check_${p.id}`] === 'on' && (
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.1"
                                              name={`item_override_val_${p.id}`}
                                              value={formData[`item_override_val_${p.id}`] || ''}
                                              onChange={handleInputChange}
                                              placeholder="0.0"
                                              className="w-16 bg-slate-100 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-2 py-1 text-label font-medium text-right focus:ring-2 focus:ring-brand-secondary outline-none"
                                            />
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-4 text-right font-medium text-brand-dark dark:text-[color:var(--text-main)] text-label ">
                                        <div>{rowTotal.toFixed(1)}</div>
                                        <div className="text-caption font-bold text-slate-400 dark:text-[color:var(--text-muted)] tracking-normal normal-case mt-0.5">
                                          {formatHoursMinutes(rowTotal)}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </Fragment>
                          );
                        })}
                        
                        {/* Custom Packages Rows */}
                        {customPackages.filter(cp => cp.category === cat).map(pkg => {
                          const qty = parseFloat(pkg.qty || 0);
                          const hours = parseFloat(pkg.hours || 0);
                          const total = pkg.overrideCheck ? parseFloat(pkg.overrideVal || 0) : qty * hours;

                          return (
                            <tr key={pkg.id} className="bg-white hover:bg-slate-50/20 transition-colors">
                              <td className="py-4 text-body align-top pr-4">
                                <input 
                                  type="text" 
                                  value={pkg.name}
                                  onChange={(e) => updateCustomPackage(pkg.id, 'name', e.target.value)}
                                  placeholder={t('editor.customPackageName')} 
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-label mb-2 font-medium text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                />
                                <div className="flex items-center space-x-2 mb-2">
                                  <select 
                                    value={pkg.skill}
                                    onChange={(e) => updateCustomPackage(pkg.id, 'skill', e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-caption font-medium tracking-tight outline-none focus:ring-1 focus:ring-brand-primary"
                                  >
                                    <option value="Implantação">{t('editor.skillImplementation')}</option>
                                    <option value="GP">{t('editor.skillGP')}</option>
                                    <option value="Solution Design">{t('editor.skillSolutionDesign')}</option>
                                    <option value="Desenvolvimento">{t('editor.skillDevelopment')}</option>
                                    <option value="Design">{t('editor.skillDesign')}</option>
                                  </select>
                                </div>
                                <div className="flex space-x-2">
                                  <textarea 
                                    value={pkg.scopeIn}
                                    onChange={(e) => updateCustomPackage(pkg.id, 'scopeIn', e.target.value)}
                                    placeholder={t('editor.included')} rows={1} 
                                    className="text-caption font-bold w-1/2 bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                                  />
                                  <textarea 
                                    value={pkg.scopeOut}
                                    onChange={(e) => updateCustomPackage(pkg.id, 'scopeOut', e.target.value)}
                                    placeholder={t('editor.notIncluded')} rows={1} 
                                    className="text-caption font-bold w-1/2 bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                                  />
                                </div>
                              </td>
                              <td className="py-4 text-label align-top text-center pt-6 font-medium text-slate-400 dark:text-[color:var(--text-main)]">
                                <input 
                                  type="number" 
                                  min="0"
                                  step="0.1"
                                  value={pkg.hours || ''}
                                  onChange={(e) => updateCustomPackage(pkg.id, 'hours', e.target.value)}
                                  placeholder="0.0" 
                                  className="w-16 bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-2 py-1.5 text-label font-medium text-center focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none"
                                />
                              </td>
                              <td className="py-4 text-label align-top text-center pt-6">
                                <input 
                                  type="number" 
                                  min="0"
                                  value={pkg.qty || ''}
                                  onChange={(e) => updateCustomPackage(pkg.id, 'qty', e.target.value)}
                                  className="w-16 bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-2 py-1.5 text-label font-medium text-center focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none"
                                />
                              </td>
                              <td className="py-4 text-center align-top pt-6">
                                <span className="inline-flex px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-caption font-medium text-slate-400">
                                  {t('common.custom')}
                                </span>
                              </td>
                              <td className="py-4 text-label align-top text-right pt-6">
                                <div className="flex items-center justify-end space-x-2">
                                  <label className="flex items-center cursor-pointer group/toggle">
                                    <input 
                                      type="checkbox" 
                                      checked={pkg.overrideCheck}
                                      onChange={(e) => updateCustomPackage(pkg.id, 'overrideCheck', e.target.checked)}
                                      className="sr-only"
                                    />
                                    <div className={`w-7 h-3.5 rounded-full relative transition-all ${
                                      pkg.overrideCheck ? 'bg-brand-secondary' : 'bg-slate-200'
                                    }`}>
                                      <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-2.5 w-2.5 transition-all ${
                                        pkg.overrideCheck ? 'translate-x-3.5' : ''
                                      }`} />
                                    </div>
                                    <span className="ml-2 text-caption font-medium text-slate-400 group-hover/toggle:text-brand-secondary transition-colors ">{t('common.manual')}</span>
                                  </label>
                                  {pkg.overrideCheck && (
                                    <input 
                                      type="number" 
                                      min="0"
                                      step="0.1"
                                      value={pkg.overrideVal || ''}
                                      onChange={(e) => updateCustomPackage(pkg.id, 'overrideVal', e.target.value)}
                                      placeholder={t('common.total')} 
                                      className="w-16 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-label font-medium text-right focus:ring-2 focus:ring-brand-secondary outline-none"
                                    />
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      if(confirm(t('editor.confirmRemove'))) {
                                        removeCustomPackage(pkg.id);
                                      }
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-4 text-body font-bold text-brand-dark align-top pt-6 text-right ">
                                {total.toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-slate-50 dark:border-[color:var(--border-main)]">
                    <button 
                      type="button" 
                      onClick={() => addCustomPackage(cat)}
                      className="inline-flex items-center px-5 py-2.5 rounded-xl bg-brand-dark dark:bg-[color:var(--primary)] dark:text-brand-ink text-[color:var(--bg-main)] text-caption font-medium hover:opacity-90 dark:hover:opacity-90 transition-all group shadow-md"
                    >
                      <div className="w-5 h-5 bg-brand-primary/20 dark:bg-white/20 rounded-lg flex items-center justify-center mr-2 group-hover:scale-105 transition-transform">
                        <Plus className="w-3 h-3 text-brand-primary dark:text-white" />
                      </div>
                      {t('editor.newItem')}
                    </button>
                  </div>

                  {cat === 'Marketplace' && (
                    <div className="mt-8 space-y-6 pt-6 border-t-2 border-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="bg-brand-primary/10 p-2 rounded-xl text-brand-primary">
                            <Plus className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-label font-medium text-brand-dark">{t('editor.marketplaceApps')}</h4>
                            <p className="text-caption font-medium text-slate-400 ">{t('editor.marketplaceFlatNote')}</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={addMarketplaceApp}
                          className="bg-brand-primary text-brand-ink px-4 py-2 rounded-xl text-caption font-medium hover:opacity-90 transition-all flex items-center space-x-2 shadow-lg shadow-green-900/10"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{t('editor.addAnotherApp')}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {marketplaceApps.map((app) => (
                          <div key={app.id} className="bg-slate-50/50 border border-slate-200 p-4 rounded-2xl flex items-start space-x-4 relative group">
                            <div className="flex-1 space-y-3">
                              <div className="space-y-1">
                                <label className="text-caption font-medium text-slate-400 ml-1">{t('editor.appName')}</label>
                                <input 
                                  type="text"
                                  value={app.name}
                                  onChange={(e) => updateMarketplaceApp(app.id, 'name', e.target.value)}
                                  placeholder={t('editor.appNamePlaceholder')}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-label font-medium text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-caption font-medium text-slate-400 ml-1">{t('editor.marketplaceLink')}</label>
                                <input 
                                  type="url"
                                  value={app.link}
                                  onChange={(e) => updateMarketplaceApp(app.id, 'link', e.target.value)}
                                  placeholder="https://zendesk.com/marketplace/..."
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-label font-medium text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                />
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={() => removeMarketplaceApp(app.id)}
                              className="mt-6 p-2 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-lg border border-slate-200 shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute top-4 right-14 bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded text-caption font-medium ">
                              {t('editor.flat5h')}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {marketplaceApps.length > 0 && (
                        <div className="flex justify-end pt-2">
                          <div className="bg-brand-dark text-[color:var(--bg-main)] px-4 py-2 rounded-xl flex items-center space-x-3">
                            <span className="text-caption font-medium ">{t('editor.marketplaceFlatTotal')}</span>
                            <span className="text-body font-bold text-brand-accent">{marketplaceApps.length * 5}H</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ))}
      </div>

      {/* Totals & Calculations Summary */}
      <div id="resumo-horas" className="scroll-mt-24 bg-white dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border-2 border-brand-primary p-6 md:p-8 rounded-3xl shadow-xl mt-12">
        <div className="max-w-7xl mx-auto flex flex-col space-y-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-brand-dark dark:text-[color:var(--text-main)] font-heading text-section leading-none">
              {t('editor.summaryOf')} <span className="text-brand-primary dark:text-[color:var(--primary)]">{t('editor.summaryOfHours')}</span>
            </h2>
          </div>

          {/* Skill Breakdown · 3 colunas: Implantação | SD | GP/DEV/DESIGN */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pb-4 border-b border-slate-100 dark:border-[color:var(--border-main)]">
            {/* Coluna 1: Implantação (altura total) */}
            <SkillCard skill="Implantação" totals={totals} percents={percents} overrides={overrides} variables={variables} setPercents={setPercents} setOverrides={setOverrides} />

            {/* Coluna 2: Solution Design (altura total) */}
            <SkillCard skill="Solution Design" totals={totals} percents={percents} overrides={overrides} variables={variables} setPercents={setPercents} setOverrides={setOverrides} />

            {/* Coluna 3: GP + Desenvolvimento + Design (stack vertical */}
            <div className="flex flex-col gap-5">
              <SkillCard skill="GP" totals={totals} percents={percents} overrides={overrides} variables={variables} setPercents={setPercents} setOverrides={setOverrides} compact />
              <SkillCard skill="Desenvolvimento" totals={totals} percents={percents} overrides={overrides} variables={variables} setPercents={setPercents} setOverrides={setOverrides} compact />
              <SkillCard skill="Design" totals={totals} percents={percents} overrides={overrides} variables={variables} setPercents={setPercents} setOverrides={setOverrides} compact />
            </div>
          </div>

          {/* Total Geral · alinhado conforme wireframe */}
          <div className="flex items-end justify-end gap-4 flex-wrap">
            <div className="w-full md:w-auto md:min-w-[340px]">
              <div className={`
                rounded-2xl border-2 border-brand-primary
                px-6 md:px-10 py-5 md:py-7
                bg-white dark:bg-[color:var(--bg-card)]
                flex items-center justify-between gap-4
              `}>
                <div>
                  <p className="text-label font-medium text-brand-primary dark:text-[color:var(--primary)] mb-1">{t('editor.grandTotal')}</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-brand-primary dark:text-[color:var(--primary)] font-heading text-kpi leading-none tabular-nums">
                    {Math.round(totals.grandTotal).toFixed(0)}
                  </span>
                  <span className="text-label font-medium text-brand-primary dark:text-[color:var(--primary)] mb-1">{t('common.hours')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Detalhamento por Categoria / Subcategoria ----------------
          Fica DEPOIS do Resumo de Horas: o número que fecha a conversa é o total
          geral, e o detalhamento existe para explicá-lo — não para antecedê-lo.
          Continua recolhido por padrão. */}
      <div className="bg-white dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border border-slate-200 rounded-3xl shadow-lg mt-12 overflow-hidden">
        <button
          type="button"
          onClick={() => setCategoryBreakdownOpen((v) => !v)}
          aria-expanded={categoryBreakdownOpen}
          className="w-full flex items-center justify-between gap-4 px-6 md:px-8 py-6 text-left hover:bg-slate-50/60 dark:hover:bg-[color:var(--bg-input)] transition-colors"
        >
          <div className="min-w-0">
            <h2 className="text-brand-dark dark:text-[color:var(--text-main)] leading-none text-title font-bold">
              {t('editor.categoryBreakdown')}
            </h2>
            <p className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] mt-1.5">
              {t('editor.categoryBreakdownHint')}
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-brand-primary dark:text-[color:var(--primary)] font-heading text-[22px] tabular-nums leading-none">
                {breakdownGrand.toFixed(1)}<span className="text-label ml-0.5">h</span>
              </div>
              <div className="text-caption font-bold text-slate-400 dark:text-[color:var(--text-muted)] mt-0.5">
                {formatHoursMinutes(breakdownGrand)}
              </div>
            </div>
            <ChevronRight
              className={`w-5 h-5 text-slate-400 transition-transform ${categoryBreakdownOpen ? 'rotate-90' : ''}`}
            />
          </div>
        </button>

        {categoryBreakdownOpen && (
          <div className="px-6 md:px-8 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Toggle: somar as horas proporcionais de Discovery, GP e Validação */}
            <div className="mb-5 rounded-2xl border border-slate-200 dark:border-[color:var(--border-main)] bg-slate-50/60 dark:bg-[color:var(--bg-card)] px-4 py-3.5">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <span className="min-w-0">
                  <span className="block text-label font-medium text-brand-dark dark:text-[color:var(--text-main)]">
                    {t('editor.includeProportionalVariables')}
                  </span>
                  <span className="block text-caption font-bold text-slate-400 dark:text-[color:var(--text-muted)] mt-1 leading-relaxed">
                    {t('editor.includeProportionalVariablesHint')}
                  </span>
                </span>
                <span className="shrink-0 inline-flex items-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={breakdownWithVariables}
                    onChange={(e) => setBreakdownWithVariables(e.target.checked)}
                    className="sr-only peer"
                  />
                  <span className="relative w-11 h-6 bg-slate-200 dark:bg-[color:var(--bg-input-solid)] rounded-full peer peer-focus:ring-2 peer-focus:ring-brand-primary peer-checked:brand-bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
                </span>
              </label>

              {breakdownWithVariables && (
                <div className="mt-3.5 pt-3.5 border-t border-slate-200 dark:border-[color:var(--border-main)] grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {BREAKDOWN_VARIABLE_COLUMNS.map((col) => (
                    <div
                      key={col.key}
                      className={`rounded-xl border px-3 py-2.5 ${col.chipClass}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${col.dotClass}`} />
                        <span className="text-caption font-medium opacity-80">
                          {t(col.labelKey)} · {col.key === 'drn' ? totals.drnPct : percents[col.key]}%
                        </span>
                      </div>
                      <div className="text-body font-bold tabular-nums mt-1">
                        {categoryBreakdown.varTotals[col.key].toFixed(1)}h
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {categoryBreakdown.rows.length === 0 ? (
              <div className="py-8 text-center text-label font-medium text-slate-400 dark:text-[color:var(--text-muted)]">
                {t('editor.categoryBreakdownEmpty')}
              </div>
            ) : (
              <>
                <div className="flex justify-end gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setOpenBreakdownCats(Object.fromEntries(categoryBreakdown.rows.map((r) => [r.cat, true])))}
                    className="text-caption font-medium text-slate-400 hover:text-brand-primary transition-colors"
                  >
                    {t('editor.expandAll')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenBreakdownCats({})}
                    className="text-caption font-medium text-slate-400 hover:text-brand-primary transition-colors"
                  >
                    {t('editor.collapseAll')}
                  </button>
                </div>

                {/* Cabeçalho de colunas: os números passam a ter NOME. Antes as
                    parcelas de Discovery/Validação/GP eram só três valores
                    coloridos empilhados à direita, legíveis apenas contra a
                    legenda do toggle. */}
                <div className={`hidden md:grid ${breakdownGridClass} gap-x-4 px-4 pb-2 mb-1 border-b border-slate-200 dark:border-[color:var(--border-main)]`}>
                  <span className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)]">
                    {t('editor.breakdownColCategory')}
                  </span>
                  <span className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)]">
                    {t('editor.breakdownColShare')}
                  </span>
                  {breakdownWithVariables && (
                    <>
                      <span className="text-right text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)]">
                        {t('editor.breakdownColBase')}
                      </span>
                      {BREAKDOWN_VARIABLE_COLUMNS.map((col) => (
                        <span key={col.key} className={`text-right text-caption font-medium ${col.textClass}`}>
                          {t(col.shortKey)}
                        </span>
                      ))}
                    </>
                  )}
                  <span className="text-right text-caption font-medium text-brand-dark dark:text-[color:var(--text-main)]">
                    {t('editor.breakdownColTotal')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {categoryBreakdown.rows.map((row) => {
                    const isOpen = Boolean(openBreakdownCats[row.cat]);
                    const rowValue = breakdownWithVariables ? row.totalWithVariables : row.total;
                    const share = breakdownGrand > 0 ? (rowValue / breakdownGrand) * 100 : 0;
                    return (
                      <div key={row.cat} className="rounded-2xl border border-slate-200 dark:border-[color:var(--border-main)] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setOpenBreakdownCats((prev) => ({ ...prev, [row.cat]: !prev[row.cat] }))}
                          aria-expanded={isOpen}
                          className={`w-full md:grid ${breakdownGridClass} gap-x-4 items-center flex flex-wrap justify-between px-4 py-3 bg-slate-50/70 dark:bg-[color:var(--bg-card)] hover:bg-slate-100/70 dark:hover:bg-[color:var(--bg-input-solid)] transition-colors text-left`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                            <span className="text-label font-medium tracking-tight text-brand-dark dark:text-[color:var(--text-main)] truncate">
                              {catLabelOf(row.cat)}
                            </span>
                            <span className="shrink-0 text-caption font-bold text-slate-400 dark:text-[color:var(--text-muted)]">
                              {t('editor.breakdownSubcategories', { count: row.subs.length })}
                            </span>
                          </div>

                          {/* Barra de participação: ocupa o espaço vazio do meio e
                              torna a proporção legível sem ler número nenhum. */}
                          <div className="hidden md:flex items-center gap-2 min-w-0">
                            <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-[color:var(--bg-input-solid)] overflow-hidden">
                              <div
                                className="h-full rounded-full brand-bg-primary"
                                style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
                              />
                            </div>
                            <span className="shrink-0 w-9 text-right text-caption font-medium tabular-nums text-slate-400 dark:text-[color:var(--text-muted)]">
                              {share.toFixed(0)}%
                            </span>
                          </div>

                          {breakdownWithVariables && (
                            <>
                              <BreakdownCell value={row.total} labelKey="editor.breakdownColBase" muted />
                              {BREAKDOWN_VARIABLE_COLUMNS.map((col) => (
                                <BreakdownCell
                                  key={col.key}
                                  value={row.contrib[col.key]}
                                  labelKey={col.shortKey}
                                  prefix="+"
                                  className={col.textClass}
                                />
                              ))}
                            </>
                          )}

                          <div className="text-right shrink-0">
                            <div className="text-body font-bold text-brand-dark dark:text-[color:var(--text-main)] tabular-nums leading-none">
                              {rowValue.toFixed(1)}<span className="text-caption ml-0.5">h</span>
                            </div>
                            <div className="text-caption font-bold text-slate-400 dark:text-[color:var(--text-muted)] mt-0.5">
                              {formatHoursMinutes(rowValue)}
                            </div>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="divide-y divide-slate-100 dark:divide-[color:var(--border-main)]">
                            {row.subs.map(({ sub, hours, contrib, hoursWithVariables }) => {
                              const subValue = breakdownWithVariables ? hoursWithVariables : hours;
                              const subShare = row.total > 0 ? (hours / row.total) * 100 : 0;
                              return (
                                <div
                                  key={sub}
                                  className={`md:grid ${breakdownGridClass} gap-x-4 items-center flex flex-wrap justify-between px-4 py-2.5 md:pl-10`}
                                >
                                  <span className="text-label font-bold text-slate-500 dark:text-[color:var(--text-muted)] truncate">
                                    {subcategoryLabel(t, sub)}
                                  </span>

                                  <div className="hidden md:flex items-center gap-2 min-w-0">
                                    <div className="h-1 flex-1 rounded-full bg-slate-100 dark:bg-[color:var(--bg-input-solid)] overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-slate-300 dark:bg-[color:var(--bg-input-solid)]"
                                        style={{ width: `${Math.min(100, Math.max(0, subShare))}%` }}
                                      />
                                    </div>
                                    <span className="shrink-0 w-9 text-right text-caption font-bold tabular-nums text-slate-300 dark:text-[color:var(--text-muted)]">
                                      {subShare.toFixed(0)}%
                                    </span>
                                  </div>

                                  {breakdownWithVariables && (
                                    <>
                                      <BreakdownCell value={hours} labelKey="editor.breakdownColBase" muted small />
                                      {BREAKDOWN_VARIABLE_COLUMNS.map((col) => (
                                        <BreakdownCell
                                          key={col.key}
                                          value={contrib[col.key]}
                                          labelKey={col.shortKey}
                                          prefix="+"
                                          className={col.textClass}
                                          small
                                        />
                                      ))}
                                    </>
                                  )}

                                  <div className="text-right shrink-0">
                                    <div className="text-label font-medium text-brand-dark dark:text-[color:var(--text-main)] tabular-nums leading-none">
                                      {subValue.toFixed(1)}<span className="text-caption ml-0.5">h</span>
                                    </div>
                                    <div className="text-caption font-bold text-slate-400 dark:text-[color:var(--text-muted)] mt-0.5">
                                      {formatHoursMinutes(subValue)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Rodapé de fechamento: o detalhamento tem de bater com o resumo,
                    e agora o leitor consegue conferir isso sem somar linha a linha. */}
                <div className={`hidden md:grid ${breakdownGridClass} gap-x-4 items-center px-4 pt-3 mt-2 border-t-2 border-brand-primary/30`}>
                  <span className="text-caption font-medium text-brand-dark dark:text-[color:var(--text-main)]">
                    {t('editor.breakdownTotalLabel')}
                  </span>
                  <span />
                  {breakdownWithVariables && (
                    <>
                      <BreakdownCell value={categoryBreakdown.grand} labelKey="editor.breakdownColBase" muted />
                      {BREAKDOWN_VARIABLE_COLUMNS.map((col) => (
                        <BreakdownCell
                          key={col.key}
                          value={categoryBreakdown.varTotals[col.key]}
                          labelKey={col.shortKey}
                          prefix="+"
                          className={col.textClass}
                        />
                      ))}
                    </>
                  )}
                  <span className="text-right text-body font-bold text-brand-primary dark:text-[color:var(--primary)] tabular-nums ">
                    {breakdownGrand.toFixed(1)}h
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Resumo de horas lateral (só leitura): acompanha a rolagem enquanto a
          estimativa é montada. Os controles (percentuais, travas) continuam no
          Resumo de Horas completo, mais abaixo. */}
      <aside className="hidden xl:block" aria-label={`${t('editor.summaryOf')} ${t('editor.summaryOfHours')}`}>
        <div className="sticky top-[88px] max-h-[calc(100vh-88px-112px)] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
          <div>
            <h2 className="font-heading text-[26px] leading-none text-brand-dark">
              {t('editor.summaryOf')} <span className="text-brand-primary">{t('editor.summaryOfHours')}</span>
            </h2>
            <p className="text-caption text-slate-500 mt-1.5">{t('editor.liveSummaryHint', 'Atualiza enquanto você edita a estimativa.')}</p>
          </div>
          <div>
            <div className="font-heading text-kpi leading-none text-brand-dark tabular-nums">
              {Math.round(totals.grandTotal || 0)}<span className="text-[0.5em]">H</span>
            </div>
            <p className="text-label text-slate-500 mt-1">{t('editor.grandTotal')}</p>
          </div>
          <ul className="tabular-nums">
            {LIVE_SUMMARY_SKILLS.map((skill) => (
              <li key={skill} className="flex items-baseline justify-between gap-3 py-2 border-b border-slate-200 last:border-b-0">
                <span className="text-body text-brand-dark">
                  {skillLabel(t, skill)}
                  {skill === 'GP' && <span className="text-label text-slate-500 ml-1.5">{percents.gp}%</span>}
                </span>
                <span className="text-body font-medium text-brand-dark">{fmtLiveHours(totals.skillTotals?.[skill])}</span>
              </li>
            ))}
          </ul>
          {categoryBreakdown.rows.length > 0 && breakdownGrand > 0 && (
            <div>
              <p className="text-label font-medium text-brand-dark mb-3">{t('editor.byCategory', 'Por categoria')}</p>
              <div className="space-y-3">
                {categoryBreakdown.rows.slice(0, 6).map((row) => {
                  const value = breakdownWithVariables ? row.totalWithVariables : row.total;
                  const pct = Math.max(0, Math.min(100, (value / breakdownGrand) * 100));
                  return (
                    <div key={row.cat}>
                      <div className="flex justify-between gap-2 text-label tabular-nums mb-1">
                        <span className="truncate text-brand-dark">{catLabelOf(row.cat)}</span>
                        <span className="shrink-0 text-slate-500">{fmtLiveHours(value)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <a href="#resumo-horas" className="inline-flex items-center gap-1 text-label font-medium text-brand-dark hover:underline decoration-[color:var(--primary)] decoration-2 underline-offset-[3px]">
            {t('editor.viewFullSummary', 'Ver resumo completo')}
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </aside>
      </div>

      {/* Barra fixa no rodapé: links da versão + Salvar, alcançáveis em qualquer
          ponto da página. O body ganha padding (classe has-editor-bar) para que
          nada fique escondido atrás dela. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-[color:var(--bg-navbar)] backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex flex-col md:flex-row md:items-end gap-3">
          <label className="flex-1 min-w-0">
            <span className="block text-caption font-medium text-slate-500 mb-1">{t('editor.techScopeLink')}</span>
            <span className="relative block">
              <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="url"
                value={techLink}
                onChange={(e) => setTechLink(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="w-full h-10 bg-white border border-slate-300 rounded-[10px] pl-9 pr-3 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] placeholder:text-slate-500"
              />
            </span>
          </label>
          <label className="flex-1 min-w-0">
            <span className="block text-caption font-medium text-slate-500 mb-1">{t('editor.requestLink')}</span>
            <span className="relative block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="url"
                value={zohoLink}
                onChange={(e) => setZohoLink(e.target.value)}
                placeholder="https://crm.zoho.com/..."
                className="w-full h-10 bg-white border border-slate-300 rounded-[10px] pl-9 pr-3 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] placeholder:text-slate-500"
              />
            </span>
          </label>
          <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
            {/* Navegação rápida: ir ao topo / ao fim da página sem rolar tudo. */}
            <div className="inline-flex items-center rounded-full border border-slate-300 bg-white overflow-hidden shrink-0" role="group" aria-label={t('editor.pageNavigation')}>
              <button
                type="button"
                onClick={() => scrollPageTo('top')}
                disabled={scrollEdges.atTop}
                title={t('editor.scrollToTop')}
                aria-label={t('editor.scrollToTop')}
                className="h-10 w-10 inline-flex items-center justify-center text-brand-dark hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-default"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <span className="w-px h-5 bg-slate-300" aria-hidden="true" />
              <button
                type="button"
                onClick={() => scrollPageTo('bottom')}
                disabled={scrollEdges.atBottom}
                title={t('editor.scrollToBottom')}
                aria-label={t('editor.scrollToBottom')}
                className="h-10 w-10 inline-flex items-center justify-center text-brand-dark hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-default"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
            {/* Sem a coluna lateral (telas menores), o total aparece aqui */}
            <div className="xl:hidden leading-tight">
              <span className="block text-caption text-slate-500">{t('editor.grandTotal')}</span>
              <span className="font-heading text-[26px] leading-none text-brand-dark tabular-nums">{Math.round(totals.grandTotal || 0)}H</span>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="h-10 px-6 rounded-full brand-bg-primary text-body font-medium btn-premium inline-flex items-center gap-2 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>

      {/* Janela de salvar: atualizar a versão aberta ou criar uma nova (numeração
          automática, descrição obrigatória). Botões type="button" porque o
          editor inteiro está dentro de um <form>. */}
      {isSaveDialogOpen && (
        <div
          className="fixed inset-0 bg-[rgb(3_14_1/0.8)] backdrop-blur-md flex items-center justify-center z-[60] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsSaveDialogOpen(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-version-title"
        >
          <div className="bg-white dark:bg-[color:var(--bg-card)] dark:border dark:border-[color:var(--border-main)] rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-white/20">
            <div className="px-8 pt-8 flex justify-between items-start gap-4">
              <div>
                <h3 id="save-version-title" className="text-brand-dark dark:text-[color:var(--text-main)] font-heading text-section">{t('editor.saveDialogTitle')}</h3>
                <p className="text-slate-500 dark:text-[color:var(--text-muted)] text-body mt-1">{t('editor.saveDialogSubtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveDialogOpen(false)}
                className="text-slate-500 hover:text-brand-dark transition-colors p-1"
                aria-label={t('common.close')}
              >
                <X className="w-6 h-6 shrink-0" />
              </button>
            </div>

            <div className="p-8 space-y-3">
              {currentVersion && (
                <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${saveMode === 'update' ? 'border-brand-primary bg-slate-50 dark:bg-[color:var(--bg-input)]' : 'border-slate-200 dark:border-[color:var(--border-main)]'}`}>
                  <input
                    type="radio"
                    name="__saveMode"
                    checked={saveMode === 'update'}
                    onChange={() => setSaveMode('update')}
                    className="mt-1 accent-[color:var(--primary)]"
                  />
                  <span>
                    <span className="block text-body font-bold text-brand-dark dark:text-[color:var(--text-main)]">
                      {t('editor.saveUpdateCurrent', { name: versionName })}
                    </span>
                    <span className="block text-caption text-slate-500 dark:text-[color:var(--text-muted)] mt-0.5">
                      {t('editor.saveUpdateCurrentHint', { name: versionName })}
                    </span>
                  </span>
                </label>
              )}

              <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${saveMode === 'new' ? 'border-brand-primary bg-slate-50 dark:bg-[color:var(--bg-input)]' : 'border-slate-200 dark:border-[color:var(--border-main)]'}`}>
                <input
                  type="radio"
                  name="__saveMode"
                  checked={saveMode === 'new'}
                  onChange={() => setSaveMode('new')}
                  className="mt-1 accent-[color:var(--primary)]"
                />
                <span>
                  <span className="block text-body font-bold text-brand-dark dark:text-[color:var(--text-main)]">
                    {t('editor.saveAsNew', { name: nextVersionLabel })}
                  </span>
                  <span className="block text-caption text-slate-500 dark:text-[color:var(--text-muted)] mt-0.5">
                    {t('editor.saveAsNewHint')}
                  </span>
                </span>
              </label>

              {saveMode === 'new' && (
                <div className="space-y-2 pt-2">
                  <label htmlFor="new-version-description" className="block text-label font-medium text-brand-dark dark:text-[color:var(--text-main)]">
                    {t('editor.versionDescription')} <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="new-version-description"
                    value={newVersionDescription}
                    onChange={(e) => setNewVersionDescription(e.target.value)}
                    placeholder={t('editor.versionDescriptionPlaceholder')}
                    rows={3}
                    maxLength={300}
                    autoFocus
                    className="w-full bg-slate-50 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-300 rounded-[10px] px-4 py-3 text-body focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all placeholder:text-slate-300 resize-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsSaveDialogOpen(false)}
                  className="h-10 px-5 rounded-full border border-slate-300 dark:border-[color:var(--border-main)] text-body font-medium text-brand-dark dark:text-[color:var(--text-main)] hover:bg-slate-50 dark:hover:bg-[color:var(--bg-input)] transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={isPending || (saveMode === 'new' && !newVersionDescription.trim())}
                  className="h-10 px-6 rounded-full brand-bg-primary text-body font-medium btn-premium inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saveMode === 'update' ? t('editor.saveConfirmUpdate') : t('editor.saveConfirmNew')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function SkillCard({
  skill,
  totals,
  percents,
  overrides,
  variables,
  setPercents,
  setOverrides,
  compact = false,
}: {
  skill: string;
  totals: any;
  percents: { gp: number; discovery: number; validation: number };
  overrides: { gp: number | null; discovery: number | null; validation: number | null };
  variables: Variable[];
  setPercents: React.Dispatch<React.SetStateAction<{ gp: number; discovery: number; validation: number }>>;
  setOverrides: React.Dispatch<React.SetStateAction<{ gp: number | null; discovery: number | null; validation: number | null }>>;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const subitems = SKILL_BREAKDOWN_SUBITEMS[skill] || [];
  const breakBy = (totals.skillBreakdownBySkill as any)?.[skill] || {};
  const totalValue = totals.skillTotals[skill] || 0;
  const isGP = skill === 'GP';
  const isImpl = skill === 'Implantação';
  const isSD = skill === 'Solution Design';

  return (
    <div className={`
      flex flex-col
      bg-[color:var(--bg-input)] dark:bg-[color:var(--bg-input-solid)]
      rounded-2xl
      border-2 border-slate-300 dark:border-[color:var(--border-main)]
      overflow-hidden
      ${compact ? '' : 'h-full'}
    `}>
      {/* Cabeçalho */}
      <div className={`
        flex flex-col gap-2
        px-4 pt-4 pb-3
        border-b border-slate-300/40 dark:border-[color:var(--border-main)]
        bg-white/60 dark:bg-[color:var(--bg-card)]
      `}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)] ">
            {skillLabel(t, skill)}
          </span>
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-brand-dark dark:text-[color:var(--text-main)] font-heading text-section leading-none tabular-nums">
                {totalValue.toFixed(1)}
              </span>
              <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)] mb-0.5">h</span>
            </div>
            <span className="text-caption font-bold text-slate-400 dark:text-[color:var(--text-muted)] tracking-normal mt-0.5">
              {formatHoursMinutes(totalValue)}
            </span>
          </div>
        </div>

        {isImpl && (
          <div className="grid grid-cols-1 gap-1.5 w-full mt-1">
            <InlinePercentCtrl
              label={t('ae.discovery')}
              value={percents.discovery}
              onChange={(n) => setPercents(p => ({ ...p, discovery: Math.max(0, n) }))}
              onReset={() => setPercents(p => ({ ...p, discovery: getVariableNumber(variables, ['DISCOVERY_STANDARD'], 0) }))}
            />
            <InlinePercentCtrl
              label={t('ae.validation')}
              value={percents.validation}
              onChange={(n) => setPercents(p => ({ ...p, validation: Math.max(0, n) }))}
              onReset={() => setPercents(p => ({ ...p, validation: getVariableNumber(variables, ['VALIDATION_STANDARD'], 0) }))}
            />
          </div>
        )}
        {isGP && (
          <div className="w-full mt-1">
            <InlinePercentCtrl
              label="GP"
              value={percents.gp}
              onChange={(n) => setPercents(p => ({ ...p, gp: Math.max(0, n) }))}
              onReset={() => setPercents(p => ({ ...p, gp: getVariableNumber(variables, ['GP_STANDARD', 'GP_PERCENTAGE'], 25) }))}
              full
            />
          </div>
        )}
      </div>

      {/* Subitens */}
      {subitems.length > 0 ? (
        <div className={`divide-y divide-slate-300/30 dark:divide-[color:var(--border-main)] ${isGP ? '' : 'flex-1'}`}>
          {subitems.map(sub => {
            const val = Number(breakBy[sub.source] ?? 0) || 0;
            const isDiscovery = sub.source === 'implantacao_discovery' || sub.source === 'sd_discovery';
            const isValidation = sub.source === 'implantacao_validacao';
            const hasOverride = isImpl && isDiscovery;
            return (
              <div
                key={sub.key}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-white/80 dark:hover:bg-[color:var(--bg-card)] transition-colors"
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isDiscovery ? 'bg-[#a9e29a]' :
                      isValidation ? 'bg-[#2f7a2a]' :
                        'bg-slate-400 dark:bg-slate-400'
                  }`} />
                  <span className="text-caption font-medium text-slate-600 dark:text-[color:var(--text-main)] truncate">
                    {subitemLabel(t, sub.key, sub.label)}
                  </span>
                  {hasOverride && (
                    <span className={`shrink-0 text-caption font-medium px-1.5 py-0.5 rounded-md border ${
                      overrides.discovery !== null
                        ? 'bg-slate-100 dark:bg-[color:var(--bg-input-solid)] text-brand-dark dark:text-[color:var(--text-main)] border-[#a9e29a] dark:border-[color:var(--border-main)]'
                        : 'bg-white dark:bg-[color:var(--bg-card)] text-slate-500 dark:text-[color:var(--text-muted)] border-slate-200 dark:border-[color:var(--border-main)]'
                    }`}>
                      {overrides.discovery !== null ? 'M' : 'P'}
                    </span>
                  )}
                  {isImpl && isValidation && (
                    <span className={`shrink-0 text-caption font-medium px-1.5 py-0.5 rounded-md border ${
                      overrides.validation !== null
                        ? 'bg-slate-100 dark:bg-[color:var(--bg-input-solid)] text-brand-dark dark:text-[color:var(--text-main)] border-[#2f7a2a] dark:border-[color:var(--border-main)]'
                        : 'bg-white dark:bg-[color:var(--bg-card)] text-slate-500 dark:text-[color:var(--text-muted)] border-slate-200 dark:border-[color:var(--border-main)]'
                    }`}>
                      {overrides.validation !== null ? 'M' : 'P'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasOverride && (
                    <button
                      type="button"
                      onClick={() => setOverrides(o => ({ ...o, discovery: o.discovery !== null ? null : totals.discVal }))}
                      className={`
                        relative shrink-0 w-8 h-[18px] rounded-full border-2 transition-all
                        ${overrides.discovery !== null
                          ? 'bg-[#a9e29a] border-[#a9e29a] shadow '
                          : 'bg-slate-200 dark:bg-[color:var(--bg-input-solid)] border-slate-300 dark:border-[color:var(--border-main)]'}
                      `}
                      title={overrides.discovery !== null ? t('editor.backToDefaultPct') : t('editor.lockAbsoluteValue')}
                    >
                      <span className={`
                        absolute top-[1px] left-[1px] h-[12px] w-[12px] rounded-full transition-all shadow
                        bg-white dark:bg-[color:var(--bg-card)]
                        ${overrides.discovery !== null ? 'translate-x-[13px]' : ''}
                      `} />
                    </button>
                  )}
                  {isImpl && isValidation && (
                    <button
                      type="button"
                      onClick={() => setOverrides(o => ({ ...o, validation: o.validation !== null ? null : totals.validVal }))}
                      className={`
                        relative shrink-0 w-8 h-[18px] rounded-full border-2 transition-all
                        ${overrides.validation !== null
                          ? 'bg-[#2f7a2a] border-[#2f7a2a] shadow '
                          : 'bg-slate-200 dark:bg-[color:var(--bg-input-solid)] border-slate-300 dark:border-[color:var(--border-main)]'}
                      `}
                      title={overrides.validation !== null ? t('editor.backToDefaultPct') : t('editor.lockAbsoluteValue')}
                    >
                      <span className={`
                        absolute top-[1px] left-[1px] h-[12px] w-[12px] rounded-full transition-all shadow
                        bg-white dark:bg-[color:var(--bg-card)]
                        ${overrides.validation !== null ? 'translate-x-[13px]' : ''}
                      `} />
                    </button>
                  )}
                  {(hasOverride || (isImpl && isValidation)) ? (
                    <div className="w-[72px] shrink-0 text-right">
                      {
                        (hasOverride && overrides.discovery !== null) ? (
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={overrides.discovery}
                            onChange={(e) => setOverrides(o => ({ ...o, discovery: Math.max(0, parseFloat(e.target.value) || 0) }))}
                            className="w-full bg-slate-100 dark:bg-[color:var(--bg-input-solid)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-md px-1.5 py-1 text-caption font-medium text-right text-brand-secondary dark:text-[color:var(--secondary)] outline-none tabular-nums"
                          />
                        ) : (isImpl && isValidation && overrides.validation !== null) ? (
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={overrides.validation}
                            onChange={(e) => setOverrides(o => ({ ...o, validation: Math.max(0, parseFloat(e.target.value) || 0) }))}
                            className="w-full bg-slate-100 dark:bg-[color:var(--bg-input-solid)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-md px-1.5 py-1 text-caption font-medium text-right text-brand-secondary dark:text-[color:var(--secondary)] outline-none tabular-nums"
                          />
                        ) : (
                          <div className="flex items-baseline justify-end gap-0.5">
                            <span className="text-brand-dark dark:text-[color:var(--text-main)] leading-none tabular-nums text-body font-bold">
                              {val.toFixed(1)}
                            </span>
                            <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)]">h</span>
                          </div>
                        )
                      }
                    </div>
                  ) : (
                    <div className="w-[48px] shrink-0 flex items-baseline justify-end gap-0.5">
                      <span className="text-brand-dark dark:text-[color:var(--text-main)] leading-none tabular-nums text-body font-bold">
                        {val.toFixed(1)}
                      </span>
                      <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)]">h</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Roda pé GP */}
      {isGP && (
        <div className={`
          px-4 py-3 border-t border-slate-300/40 dark:border-[color:var(--border-main)]
          bg-white/70 dark:bg-[color:var(--bg-card)]
          flex items-center justify-between gap-3
        `}>
          <div className="flex items-center gap-2">
            <span className={`text-caption font-medium transition-colors ${overrides.gp !== null ? 'text-brand-primary dark:text-[color:var(--primary)]' : 'text-slate-500 dark:text-[color:var(--text-muted)]'}`}>
              {overrides.gp !== null ? t('common.manual') : t('common.default')}
            </span>
            <button
              type="button"
              onClick={() => setOverrides(o => ({ ...o, gp: o.gp !== null ? null : totals.gpVal }))}
              className={`
                relative shrink-0 w-10 h-5 rounded-full border-2 transition-all
                ${overrides.gp !== null
                  ? 'bg-brand-primary border-brand-primary shadow shadow-green-900/20'
                  : 'bg-slate-200 dark:bg-[color:var(--bg-input-solid)] border-slate-300 dark:border-[color:var(--border-main)]'}
              `}
              title={overrides.gp !== null ? t('editor.backToDefaultPct') : t('editor.lockAbsoluteValue')}
            >
              <span className={`
                absolute top-[1px] left-[1px] h-[14px] w-[14px] rounded-full transition-all shadow
                bg-white dark:bg-[color:var(--bg-card)]
                ${overrides.gp !== null ? 'translate-x-[17px]' : ''}
              `} />
            </button>
          </div>
          <div className="w-[68px] shrink-0 text-right">
            {overrides.gp === null ? (
              <div className="flex items-baseline justify-end gap-0.5">
                <span className="text-brand-dark dark:text-[color:var(--text-main)] leading-none tabular-nums text-body font-bold">
                  {totals.gpVal.toFixed(1)}
                </span>
                <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)] mb-0.5">h</span>
              </div>
            ) : (
              <input
                type="number"
                min="0"
                step="0.1"
                value={overrides.gp}
                onChange={(e) => setOverrides(o => ({ ...o, gp: Math.max(0, parseFloat(e.target.value) || 0) }))}
                className="w-full bg-slate-100 dark:bg-[color:var(--bg-input-solid)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-md px-2 py-1 text-label font-medium text-right text-brand-secondary dark:text-[color:var(--secondary)] outline-none tabular-nums"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InlinePercentCtrl({
  label,
  value,
  onChange,
  onReset,
  full = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  onReset: () => void;
  full?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-1.5 rounded-xl border-2 px-2 py-1.5 bg-[color:var(--bg-input)] dark:bg-[color:var(--bg-input-solid)] border-slate-300 dark:border-[color:var(--border-main)] ${full ? 'w-full justify-between' : ''}`}>
      <span className="shrink-0 text-caption font-medium text-slate-600 dark:text-[color:var(--text-main)] whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center justify-end gap-1 ml-auto">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
          className="w-10 md:w-12 bg-white dark:bg-[color:var(--bg-card)] border border-slate-300 dark:border-[color:var(--border-main)] rounded-md px-1.5 py-1 text-caption font-medium outline-none text-center text-brand-dark dark:text-[color:var(--text-main)] tabular-nums"
        />
        <span className="text-brand-secondary dark:text-[color:var(--secondary)] text-caption font-medium">%</span>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="p-1 rounded-md text-slate-400 dark:text-[color:var(--text-main)] hover:text-brand-primary dark:hover:text-[color:var(--primary)] hover:bg-slate-100 dark:hover:bg-[color:var(--bg-input-solid)] transition-all shrink-0"
        title={t('editor.resetLabel', { label })}
      >
        <RotateCcw className="w-3.5 h-3.5.5" />
      </button>
    </div>
  );
}

