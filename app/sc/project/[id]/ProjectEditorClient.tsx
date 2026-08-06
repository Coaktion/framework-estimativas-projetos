'use client';

import { Fragment, useState, useMemo, useEffect, useTransition, useRef } from 'react';
import { 
  Save, Copy, Download, Link as LinkIcon, Box, Check, ChevronDown, Plus, Trash2, Shield, Search, Zap, Layout, Settings, Users, Loader2,
  CheckSquare, Bot, MessageSquare, AlertTriangle, ShieldCheck, CheckCircle2, RotateCcw, EyeOff, Eye, X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveProjectVersionAction, cloneProjectVersionAction } from './actions';
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

export default function ProjectEditorClient({ project, categories, categoryLabels, packagesByCategory, currentVersion, allVersions, variables, preferences }: any) {
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
    alert('Preset salvo com sucesso! Este preset agora está disponível apenas para você.');
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
    if (confirm(`Deseja realmente excluir o perfil "${name}"?`)) {
      await deletePresetAction(name);
      alert('Perfil excluído com sucesso!');
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

  const [versionName, setVersionName] = useState(currentVersion?.versionName || 'V1');
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

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const results: any[] = [];
    const pushUnique = (key: string, item: any) => {
      if (results.some((r) => r.__key === key)) return;
      results.push({ ...item, __key: key });
    };

    orderedCategories.forEach((cat: string) => {
      const label = String(categoryLabels?.[cat] || cat);
      if (`${cat} ${label}`.toLowerCase().includes(q)) {
        pushUnique(`cat:${cat}`, { type: 'category', cat, label });
      }

      const subcats = layoutConfig.subcategoryOrder?.[cat] || [];
      subcats.forEach((subcategory: string) => {
        if (String(subcategory).toLowerCase().includes(q)) {
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
      const haystack = `${p?.name || ''} ${p?.tooltip || ''}`.toLowerCase();
      if (!haystack.includes(q)) return;

      const itemId = String(p.id);
      const cat = packageRootCategoryById[itemId] || p.categoryName;
      if (!cat) return;

      const catLabel = String(categoryLabels?.[cat] || cat);
      const subcategory = layoutConfig.itemSubcategories?.[itemId] || inferDefaultSubcategory(cat, p);

      pushUnique(`item:${itemId}`, {
        type: 'item',
        cat,
        subcategory,
        itemId,
        label: p.name,
        subtitle: `${catLabel} • ${subcategory}`,
        isHidden: hiddenItems.includes(p.id)
      });
    });

    return results.slice(0, 20);
  }, [
    searchQuery,
    orderedCategories,
    categoryLabels,
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
    // Extract custom packages from formData on initial load
    const extracted: any[] = [];
    Object.keys(formData).forEach(key => {
      if (key.startsWith('custom_pkg_') && key.endsWith('_name')) {
        const parts = key.split('_');
        const index = parts.pop();
        const category = parts.slice(2).join('_');
        
        const prefix = `custom_pkg_${category}_${index}`;
        extracted.push({
          id: `${category}_${index}`,
          category,
          index,
          name: formData[`${prefix}_name`],
          hours: formData[`${prefix}_hours`],
          qty: formData[`${prefix}_qty`],
          skill: formData[`${prefix}_skill`] || 'Implantação',
          scopeIn: formData[`${prefix}_scope_in`],
          scopeOut: formData[`${prefix}_scope_out`],
          overrideCheck: formData[`${prefix}_override_check`] === 'on',
          overrideVal: formData[`${prefix}_override_val`]
        });
      }
    });
    return extracted;
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
  const totals = useMemo(() => {
    let subtotal = 0;
    let flatHoursMarketplace = marketplaceApps.length * 5;
    const itemTotals: Record<number, number> = {};
    const catTotals: Record<string, number> = {};
    const skillTotals: any = {
      'Implantação': 0, 'GP': 0, 'Solution Design': 0, 'Desenvolvimento': 0, 'Design': 0
    };
    let hasSdDiscoveryOnAnyItem = false;
    let routedSdDiscoveryFromLib = 0; // sdDiscovery marcados (exclui os de skill Desenvolvimento) → vão para sd_discovery
    let routedSdDRNFromLib = 0;       // sdDiscovery marcados + skill=Desenvolvimento → vão para sd_desenvolvimento (DRN)
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

    const assignImplantBucket = (category: string, hours: number) => {
      if (!hours) return;
      const normalized = normCat(category);
      if (!normalized) {
        implantationBreakdown['implantacao_setup'] = (implantationBreakdown['implantacao_setup'] || 0) + hours;
        return;
      }
      if (matchCatHas(category, ['workshop'])) {
        implantationBreakdown['implantacao_workshop'] = (implantationBreakdown['implantacao_workshop'] || 0) + hours;
        return;
      }
      if (matchCatHas(category, ['treinamento'])) {
        implantationBreakdown['implantacao_treinamento'] = (implantationBreakdown['implantacao_treinamento'] || 0) + hours;
        return;
      }
      if (matchCatHas(category, ['go-live', 'go live', 'pos go', 'go-live e pos go-live', 'go live e pos go live', 'pos go live', 'pos go'])) {
        implantationBreakdown['implantacao_golive'] = (implantationBreakdown['implantacao_golive'] || 0) + hours;
        return;
      }
      // Tudo que não for mapeado → Setup
      implantationBreakdown['implantacao_setup'] = (implantationBreakdown['implantacao_setup'] || 0) + hours;
    };

    // Standard Packages
    Object.keys(packagesByCategory).forEach(cat => {
      const isChecked = formData[`check_area_${cat}`] === 'on';
      catTotals[cat] = 0;

      packagesByCategory[cat].forEach((pkg: any) => {
        const qty = parseFloat(formData[`item_${pkg.id}_qty`] || 0);
        if (qty > 0 && isChecked) {
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

          if (sdDisc) {
            hasSdDiscoveryOnAnyItem = true;
            // REGRA SD Discovery:
            //  - Se item foi marcado sdDiscovery:
            //    * Se skill === Desenvolvimento → vai para sd_desenvolvimento (DRN)
            //    * Qualquer outra skill (Implantação, SD, Design...) → vai para sd_discovery
            // Remove a contribuição do skill original e creditamos no skill Solution Design abaixo (após buckets).
            if (skillKey === 'Desenvolvimento') {
              routedSdDRNFromLib += rowTotal;
            } else {
              routedSdDiscoveryFromLib += rowTotal;
            }
            // Não aplicamos assignImplantBucket (mesmo que skill seja Implantação)
          } else {
            if (skillTotals[skillKey] !== undefined) skillTotals[skillKey] += rowTotal;
            if (skillKey === 'Implantação') assignImplantBucket(cat, rowTotal);
          }
        }
      });
    });

    // Custom Packages
    customPackages.forEach(pkg => {
      if (formData[`check_area_${pkg.category}`] !== 'on') return;

      const qty = parseFloat(pkg.qty || 0);
      const hours = parseFloat(pkg.hours || 0);
      let total = qty * hours;
      
      if (pkg.overrideCheck) {
        const val = parseFloat(pkg.overrideVal);
        if (!isNaN(val)) total = val;
      }
      
      subtotal += total;
      catTotals[pkg.category] = (catTotals[pkg.category] || 0) + total;
      const skillKey = pkg.skillName || pkg.skill;
      if (skillTotals[skillKey] !== undefined) skillTotals[skillKey] += total;
      if (skillKey === 'Implantação') assignImplantBucket(pkg.category, total);
    });

    // Helper to calculate a variable's contribution
    const calculateVariable = (varKey: string, manualPercent: number, manualOverride: number | null) => {
      if (manualOverride !== null) return parseFloat(manualOverride as any);

      const vDef = variables?.find((v: any) => v.key === varKey);
      if (!vDef) return subtotal * (manualPercent / 100);

      // Determine base for calculation
      const targets = JSON.parse(vDef.targetItems || '[]');
      const targetCats = JSON.parse(vDef.targetCategories || '[]');
      const varExclusions = JSON.parse(vDef.excludedItems || '[]');
      
      let base = 0;
      const allItems: any[] = allPackages; // All library items

      if (targets.length === 0 && targetCats.length === 0) {
        // Global variable: sum everything NOT excluded from this specific variable
        Object.keys(packagesByCategory).forEach(cat => {
          if (formData[`check_area_${cat}`] !== 'on') return;
          
          packagesByCategory[cat].forEach((pkg: any) => {
            const qty = parseFloat(formData[`item_${pkg.id}_qty`] || 0);
            if (qty <= 0) return;

            const itemExclusions = JSON.parse(pkg.excludedFromVariables || '[]');
            // Check if item is excluded either via its own config OR via the variable's config
            const isExcluded = itemExclusions.includes(varKey) || varExclusions.includes(pkg.id.toString());
            
            if (!isExcluded) {
              base += (itemTotals[pkg.id] || 0);
            }
          });
        });
        
        // Also add custom packages if not explicitly excluded (custom pkgs don't have exclusions yet)
        customPackages.forEach(pkg => {
          if (formData[`check_area_${pkg.category}`] === 'on') {
            const qty = parseFloat(pkg.qty || 0);
            const hours = parseFloat(pkg.hours || 0);
            base += (qty * hours);
          }
        });
      } else {
        targets.forEach((id: string) => { 
          const pkg = allItems.find((p: any) => p.id === parseInt(id));
          const itemExclusions = JSON.parse(pkg?.excludedFromVariables || '[]');
          const isExcluded = itemExclusions.includes(varKey) || varExclusions.includes(id);
          
          if (!isExcluded) {
            base += (itemTotals[parseInt(id)] || 0); 
          }
        });
        targetCats.forEach((cat: string) => { 
          packagesByCategory[cat]?.forEach((pkg: any) => {
            const qty = parseFloat(formData[`item_${pkg.id}_qty`] || 0);
            if (qty <= 0) return;

            const itemExclusions = JSON.parse(pkg.excludedFromVariables || '[]');
            const isExcluded = itemExclusions.includes(varKey) || varExclusions.includes(pkg.id.toString());
            
            if (!isExcluded) {
              base += (itemTotals[pkg.id] || 0);
            }
          });
        });
      }

      // Calculate based on type
      let result = 0;
      const pctValue = manualPercent;
      
      if (vDef.type === 'PERCENT') {
        result = base * (pctValue / 100);
      } else if (vDef.type === 'FLAT') {
        result = parseFloat(vDef.flatValue || 0);
      } else if (vDef.type === 'MIXED') {
        result = (base * (pctValue / 100)) + parseFloat(vDef.flatValue || 0);
      }

      return result;
    };

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
    // Remover marketplace e GP que foram acrescentados acima só no skillTotals
    skillLiquido['Implantação'] = Math.max(0, (skillLiquido['Implantação'] || 0) - (flatHoursMarketplace || 0));
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

    // Garantir que a soma de implantação líquida (antes de safety/variaveis/marketplace)
    // é totalmente re-distribuída pelos 6 buckets. Como assignImplantBucket sempre
    // joga em SETUP o que não for Workshop/Treinamento/Go-Live, raramente haverá
    // sobra; mas se houver (arrendondamentos, etc), tudo vai para SETUP.
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
    const setupBaseParaVariaveis = Math.max(0, implantacaoBuckets['implantacao_setup'] || 0);
    // Recalcular discValRaw e validVal (mantendo overrides manuais se existirem)
    let discValRawFinal = 0;
    let validValRawFinal = 0;
    if (overrides.discovery !== null) {
      discValRawFinal = Number(overrides.discovery) || 0;
    } else {
      // Base = apenas setup; percentual = percents.discovery (se houver vDef com tipo, respeitamos flat/mixed? mantendo padrão percentual simples)
      const vDef = variables?.find((v: any) => v.key === 'DISCOVERY_STANDARD');
      if (!vDef) {
        discValRawFinal = setupBaseParaVariaveis * (percents.discovery / 100);
      } else {
        const pctValue = percents.discovery;
        if (vDef.type === 'PERCENT') discValRawFinal = setupBaseParaVariaveis * (pctValue / 100);
        else if (vDef.type === 'FLAT') discValRawFinal = parseFloat(vDef.flatValue || 0);
        else if (vDef.type === 'MIXED') discValRawFinal = (setupBaseParaVariaveis * (pctValue / 100)) + parseFloat(vDef.flatValue || 0);
        else discValRawFinal = setupBaseParaVariaveis * (pctValue / 100);
      }
    }
    if (overrides.validation !== null) {
      validValRawFinal = Number(overrides.validation) || 0;
    } else {
      const vDef = variables?.find((v: any) => v.key === 'VALIDATION_STANDARD');
      if (!vDef) {
        validValRawFinal = setupBaseParaVariaveis * (percents.validation / 100);
      } else {
        const pctValue = percents.validation;
        if (vDef.type === 'PERCENT') validValRawFinal = setupBaseParaVariaveis * (pctValue / 100);
        else if (vDef.type === 'FLAT') validValRawFinal = parseFloat(vDef.flatValue || 0);
        else if (vDef.type === 'MIXED') validValRawFinal = (setupBaseParaVariaveis * (pctValue / 100)) + parseFloat(vDef.flatValue || 0);
        else validValRawFinal = setupBaseParaVariaveis * (pctValue / 100);
      }
    }

    // 2) Discovery e Validação (variáveis %) entram nos buckets específicos
    // REGRA: Se há pelo menos 1 item com sdDiscovery marcado → Discovery variável vai para SD, não para Implantação
    if (hasSdDiscoveryOnAnyItem) {
      // Discovery % → vai para SD > Discovery
      // Validação % permanece em Implantação > Validação (o usuário não falou em mover validação, apenas discovery)
    }
    if (hasSdDiscoveryOnAnyItem) {
      // Discovery variável sai de implantação e vai para Solution Design
    } else {
      implantacaoBuckets['implantacao_discovery'] = roundHalfUp((implantacaoBuckets['implantacao_discovery'] || 0) + discValRawFinal, 1);
    }
    implantacaoBuckets['implantacao_validacao'] = roundHalfUp((implantacaoBuckets['implantacao_validacao'] || 0) + validValRawFinal, 1);

    // 4) Safety de Implantação → Go-Live e Pós Go-live (apoio na estabilização)
    if (safetyImplantacao > 0) {
      implantacaoBuckets['implantacao_golive'] = roundHalfUp((implantacaoBuckets['implantacao_golive'] || 0) + safetyImplantacao, 1);
    }

    // Redefine discVal e validVal para a fórmula final (consolidado total) usar os valores baseados em Setup
    const discValRaw = discValRawFinal;
    const validValRaw = validValRawFinal;

    // Segmentação de SD (Solution Design)
    const sdLiquido = skillLiquido['Solution Design'] || 0;
    const safetySD = Number((safetyHours || {})['Solution Design']) || 0;
    let sd_discovery = 0;
    let sd_desenvolvimento = 0;

    // Primeiro, distribui o SD liquido (itens standard não sdDiscovery) + safety SD em 60/40
    if (sdLiquido > 0 || safetySD > 0) {
      const raw = {
        d: (sdLiquido + safetySD) * 0.6,
        dev: (sdLiquido + safetySD) * 0.4,
      };
      const dR = roundHalfUp(raw.d, 1);
      const totalRoundedTarget = roundHalfUp(sdLiquido + safetySD, 1);
      sd_discovery = dR;
      sd_desenvolvimento = roundHalfUp(totalRoundedTarget - dR, 1);
      if (sd_desenvolvimento < 0) sd_desenvolvimento = 0;
    }

    // Agora adiciona os itens roteados de SD Discovery (via checkbox sdDiscovery)
    sd_discovery = roundHalfUp(sd_discovery + routedSdDiscoveryFromLib, 1);
    sd_desenvolvimento = roundHalfUp(sd_desenvolvimento + routedSdDRNFromLib, 1);

    // E se tem sdDiscovery ligado → o % de Discovery variavel também entra no SD (Discovery)
    if (hasSdDiscoveryOnAnyItem) {
      sd_discovery = roundHalfUp(sd_discovery + discValRawFinal, 1);
    }
    if (sd_discovery < 0) sd_discovery = 0;
    if (sd_desenvolvimento < 0) sd_desenvolvimento = 0;

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

    // O total agregado mostrado no card de Implantação deve bater com a soma dos subitens (inclui Discovery/Validação variáveis + Marketplace + Safety)
    const implantacaoSomaSubitens = Object.values(skillBreakdownBySkill['Implantação']).reduce((a, b) => a + (b || 0), 0);
    skillTotals['Implantação'] = implantacaoSomaSubitens;

    const sdSomaSubitens = Object.values(skillBreakdownBySkill['Solution Design']).reduce((a, b) => a + (b || 0), 0);
    skillTotals['Solution Design'] = sdSomaSubitens;

    // Base do GP: TUDO (Implantação + SD + DEV + DESIGN) já com safety/marketplace/discovery/validação inclusos.
    // Excluímos o próprio GP (skillTotals['GP']) para não haver circularidade
    const totalBaseGP = Math.max(0,
      Number(skillTotals['Implantação'] || 0)
      + Number(skillTotals['Solution Design'] || 0)
      + Number(skillTotals['Desenvolvimento'] || 0)
      + Number(skillTotals['Design'] || 0)
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
    const consolidatedBase = totalBaseGP + gpVal;
    const grandTotal = roundHalfUp(consolidatedBase, 0);

    return {
      subtotal: subtotalRounded,
      skillTotals,
      skillBreakdownBySkill,
      gpVal,
      discVal,
      validVal,
      flatHoursMarketplace,
      totalSafety,
      grandTotal
    };
  }, [formData, customPackages, marketplaceApps, safetyHours, percents, overrides, packagesByCategory, variables, allPackages]);

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

  const handleSave = async () => {
    if (!versionName || !techLink) {
      alert("Nome da versão e Link do Escopo Técnico são obrigatórios.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveProjectVersionAction(project.id, {
          versionName,
          technicalScopeLink: techLink,
          zohoLink,
          gpPercent: percents.gp,
          discoveryPercent: percents.discovery,
          validationPercent: percents.validation,
          gpOverride: overrides.gp,
          discoveryOverride: overrides.discovery,
          validationOverride: overrides.validation,
          safetyHours: JSON.stringify(safetyHours),
          data: {
            ...formData,
            marketplace_apps: JSON.stringify(marketplaceApps)
          }
        });
        
        router.push(`/sc/project/${project.id}?version_id=${result.id}`);
        alert("Versão salva com sucesso!");
      } catch (e) {
        console.error(e);
        alert("Erro ao salvar versão.");
      }
    });
  };

  const handleClone = async () => {
    if (!currentVersion) {
      alert("Selecione uma versão existente para clonar.");
      return;
    }

    const newName = prompt("Nome para a nova versão (Cópia):", "Cópia de " + versionName);
    if (!newName) return;
    
    const newLink = prompt("Insira o Link do Escopo Técnico para a nova versão (Obrigatório):", "");
    if (!newLink) {
      alert("O link do Escopo Técnico é obrigatório. A operação foi cancelada.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await cloneProjectVersionAction(project.id, currentVersion.id, newName, newLink);
        router.push(`/sc/project/${project.id}?version_id=${result.id}`);
        alert("Versão clonada com sucesso!");
      } catch (e) {
        console.error(e);
        alert("Erro ao clonar versão.");
      }
    });
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
    setCustomPackages([...customPackages, newPkg]);
    
    // Also update formData for the new fields
    const prefix = `custom_pkg_${category}_${index}`;
    setFormData((prev: any) => ({
      ...prev,
      [`${prefix}_name`]: '',
      [`${prefix}_hours`]: 0,
      [`${prefix}_qty`]: 1,
      [`${prefix}_skill`]: 'Implantação'
    }));
  };

  const updateCustomPackage = (id: string, field: string, value: any) => {
    setCustomPackages(prev => prev.map(p => {
      if (p.id === id) {
        let finalValue = value;
        // Prevent negative numbers for numeric fields
        if (['hours', 'qty', 'overrideVal'].includes(field)) {
          finalValue = Math.max(0, parseFloat(value) || 0);
        }
        
        const updated = { ...p, [field]: finalValue };
        // Sync with formData
        const prefix = `custom_pkg_${p.category}_${p.index}`;
        const formKey = field === 'overrideCheck' ? `${prefix}_override_check` : `${prefix}_${field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`;
        setFormData((f: any) => ({ ...f, [formKey]: finalValue === true ? 'on' : finalValue === false ? 'off' : finalValue }));
        return updated;
      }
      return p;
    }));
  };

  const toggleSection = (cat: string) => {
    setCollapsedSections(prev => ({ ...prev, [cat]: !prev[cat] }));
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

  if (isAEEstimate) {
    const aeData = formData.formData || {};
    return (
      <div className="space-y-8 pb-12 animate-in fade-in duration-500">
        {/* Header AE */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-300 shadow-sm">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-4">
                <div className="bg-purple-600 p-2 rounded-xl shadow-lg shadow-purple-900/10">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-brand-dark tracking-tighter font-heading uppercase">{project.name}</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pasta de Cliente - Estimativa AE</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 bg-white p-1.5 rounded-xl border border-slate-300 w-fit">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Simulação Selecionada</span>
                <div className="relative">
                  <select 
                    value={currentVersion?.id || ''}
                    onChange={(e) => router.push(`/sc/project/${project.id}?version_id=${e.target.value}`)}
                    className="bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest p-2 pr-8 focus:ring-2 focus:ring-brand-primary outline-none appearance-none cursor-pointer shadow-sm transition-all"
                  >
                    {allVersions.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.versionName}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <Link 
                href={`/ae?client=${encodeURIComponent(project.name)}`}
                className="flex-1 lg:flex-none bg-brand-primary text-white px-8 py-4 rounded-2xl font-black hover:opacity-90 shadow-lg shadow-green-900/10 transition-all flex items-center justify-center space-x-3 text-[11px] uppercase tracking-widest"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Estimativa</span>
              </Link>
            </div>
          </div>
        </div>

        {/* AE Summary Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50 space-y-10">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-slate-100 p-3 rounded-2xl text-slate-400">
                  <Layout className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Resumo da Configuração</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Agentes</span>
                  <div className="text-3xl font-black text-brand-dark tracking-tighter">{aeData.agents || 0}</div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Marcas</span>
                  <div className="text-3xl font-black text-brand-dark tracking-tighter">{aeData.brands || 0}</div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Áreas do Cliente</span>
                  <div className="text-3xl font-black text-brand-dark tracking-tighter">{aeData.areas || 0}</div>
                </div>
              </div>

              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Canais Ativos</span>
                <div className="flex flex-wrap gap-2">
                  {aeData.channels?.length > 0 ? aeData.channels.map((c: string) => (
                    <span key={c} className="bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-brand-primary/20">
                      {c}
                    </span>
                  )) : <span className="text-slate-300 italic text-xs">Nenhum canal selecionado</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Integração', active: aeData.hasIntegration, icon: Settings },
                  { label: 'QA', active: aeData.hasQA, icon: CheckSquare },
                  { label: 'WFM', active: aeData.hasWFM, icon: Users },
                  { label: 'AI Agents', active: aeData.hasAIAgents, icon: Bot }
                ].map((feat) => (
                  <div key={feat.label} className={`p-4 rounded-2xl border flex items-center space-x-3 ${feat.active ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                    <feat.icon className="w-4 h-4" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{feat.label}</span>
                  </div>
                ))}
              </div>

              {aeData.hasCopilot && (
                <div className="bg-purple-50 border border-purple-100 p-6 rounded-[2rem] flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-purple-600 p-2.5 rounded-xl text-white">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block">Zendesk Copilot</span>
                      <span className="text-xs font-black text-purple-700 uppercase tracking-widest">
                        {aeData.copilotType === 'with_api' ? 'Com Conexão Externa' : 'Sem Conexão Externa'}
                      </span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-purple-600" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className={`p-10 rounded-[3rem] shadow-2xl relative overflow-hidden text-center space-y-8 ${
              formData.needsSC ? 'bg-amber-50 border-4 border-amber-200' : 'bg-brand-dark text-white'
            }`}>
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                {formData.needsSC ? <AlertTriangle className="w-32 h-32 text-amber-500" /> : <ShieldCheck className="w-32 h-32 text-white" />}
              </div>

              <div className="relative z-10 space-y-6">
                <div className="flex flex-col items-center space-y-3">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl ${
                    formData.needsSC ? 'bg-amber-200 text-amber-700' : 'brand-bg-primary text-white'
                  }`}>
                    {formData.needsSC ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                  </div>
                  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${formData.needsSC ? 'text-amber-600' : 'text-slate-400'}`}>
                    Esforço Calculado
                  </h3>
                </div>

                <div className="space-y-1">
                  <div className={`text-6xl font-black tracking-tighter ${formData.needsSC ? 'text-amber-700' : 'text-brand-accent'}`}>
                    {formData.needsSC ? 'CONSULTAR SC' : `${(formData.resultHours || 0).toFixed(0)}H`}
                  </div>
                  <p className={`text-xs font-bold uppercase tracking-widest ${formData.needsSC ? 'text-amber-600' : 'text-slate-400'}`}>
                    {formData.needsSC ? 'Necessita de Apoio SC' : 'Total Estimado'}
                  </p>
                </div>

                {!formData.needsSC && (
                  <div className="pt-6 border-t border-white/10 flex items-center justify-center space-x-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
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
    <form className="space-y-8 pb-12" onSubmit={(e) => e.preventDefault()}>
      {/* Header: Project Controls */}
      <div className="bg-white p-8 rounded-[2rem] border border-slate-300 mb-8 shadow-sm">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-50 pb-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-4">
                <div className="brand-bg-primary p-2 rounded-xl shadow-lg shadow-green-900/10">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-black text-brand-dark tracking-tighter font-heading uppercase">{project.name}</h1>
              </div>
              
              <div className="flex items-center space-x-3 bg-white p-1.5 rounded-xl border border-slate-300 w-fit">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Versão Ativa</span>
                <div className="relative">
                  <select 
                    value={currentVersion?.id || ''}
                    onChange={(e) => router.push(`/sc/project/${project.id}?version_id=${e.target.value}`)}
                    className="bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest p-2 pr-8 focus:ring-2 focus:ring-brand-primary outline-none appearance-none cursor-pointer shadow-sm transition-all"
                  >
                    {!currentVersion && !allVersions.length && <option value="">Rascunho Inicial</option>}
                    {allVersions.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.versionName}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <button 
                type="button" 
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 lg:flex-none bg-brand-primary text-white px-6 py-3.5 rounded-xl font-black hover:opacity-90 shadow-lg shadow-green-900/10 transition-all flex items-center justify-center space-x-2 text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Salvar</span>
              </button>
              <button 
                type="button" 
                onClick={handleClone}
                disabled={isPending || !currentVersion}
                className="flex-1 lg:flex-none border-2 border-brand-primary text-brand-primary px-6 py-3.5 rounded-xl font-black hover:bg-brand-primary hover:text-white transition-all flex items-center justify-center space-x-2 text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Clonar</span>
              </button>
              {currentVersion && (
                <Link href={`/sc/project/${project.id}/export?version_id=${currentVersion.id}`} className="flex-1 lg:flex-none bg-brand-dark text-white px-6 py-3.5 rounded-xl font-black hover:bg-slate-800 transition-all flex items-center justify-center space-x-2 text-[10px] uppercase tracking-widest text-center">
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar</span>
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Identificação da Versão</label>
              <input 
                type="text" 
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="Ex: Proposta Final" 
                className="w-full bg-white border border-slate-300 rounded-xl px-5 py-3 text-xs font-bold focus:ring-2 focus:ring-brand-primary outline-none transition-all placeholder:text-slate-300" 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Link do Escopo Técnico (Externo)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-brand-primary transition-colors">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <input 
                  type="url" 
                  value={techLink}
                  onChange={(e) => setTechLink(e.target.value)}
                  placeholder="https://docs.google.com/..." 
                  className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-5 py-3 text-xs font-bold focus:ring-2 focus:ring-brand-primary outline-none transition-all placeholder:text-slate-300" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Link da Solicitação (Zoho)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-brand-primary transition-colors">
                  <Search className="w-4 h-4" />
                </div>
                <input 
                  type="url" 
                  value={zohoLink}
                  onChange={(e) => setZohoLink(e.target.value)}
                  placeholder="https://crm.zoho.com/..." 
                  className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-5 py-3 text-xs font-bold focus:ring-2 focus:ring-brand-primary outline-none transition-all placeholder:text-slate-300" 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Area Selection */}
      <div className="bg-white dark:bg-[color:var(--bg-card)] dark:border dark:border-[color:var(--border-main)] p-10 rounded-[2.5rem] border border-slate-300 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div className="flex items-center space-x-4">
            <div className="brand-bg-primary p-2.5 rounded-2xl shadow-lg shadow-green-900/10 text-white">
              <Layout className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-brand-dark dark:text-[color:var(--text-main)] font-heading tracking-tight uppercase">Módulos do Projeto</h3>
              <p className="text-slate-400 dark:text-[color:var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mt-1">Selecione as áreas que compõem este escopo.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowPresets(!showPresets)}
                className="p-2 rounded-xl bg-slate-50 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] text-slate-400 border border-slate-200 hover:text-brand-primary transition-all"
                title="Presets de Visualização"
              >
                <Settings className="w-4 h-4" />
              </button>
              {showPresets && (
                <div className="absolute right-0 mt-2 w-72 bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border border-slate-200 rounded-2xl shadow-2xl p-6 z-[60] space-y-4 animate-in fade-in slide-in-from-top-2 backdrop-blur-none">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-[color:var(--text-muted)]">Meus Perfis (Presets)</h4>
                    <Users className="w-3 h-3 text-slate-300 dark:text-[color:var(--text-muted)]" />
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {presets.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[9px] font-bold text-slate-300 dark:text-[color:var(--text-muted)] uppercase leading-relaxed">Nenhum perfil salvo para seu usuário</p>
                      </div>
                    ) : (
                      presets.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 group/preset">
                          <button
                            onClick={() => applyPreset(p)}
                            className="flex-1 text-left p-3 rounded-xl hover:bg-[#F0F7F3] dark:hover:bg-[color:var(--bg-input-solid)] border border-transparent hover:border-slate-100 dark:hover:border-[color:var(--border-main)] text-[10px] font-bold text-brand-dark dark:text-[color:var(--text-main)] uppercase transition-all flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span>{p.name}</span>
                              <span className="text-[7px] text-slate-300 dark:text-[color:var(--text-muted)] font-black">{Array.isArray(p.hiddenItems) ? p.hiddenItems.length : 0} itens ocultos</span>
                            </div>
                            <Check className="w-3 h-3 text-emerald-500 opacity-0 group-hover/preset:opacity-100 transition-opacity" />
                          </button>
                          <button 
                            onClick={() => handleDeletePreset(p.name)}
                            className="p-2 text-slate-300 dark:text-[color:var(--text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover/preset:opacity-100"
                            title="Excluir Perfil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-[color:var(--border-main)] space-y-3">
                    <div>
                      <label className="text-[8px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-widest mb-1.5 block ml-1">Salvar configuração atual</label>
                      <input 
                        type="text" 
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="Nome do seu perfil (ex: Padrão Matheus)"
                        className="w-full bg-[#F0F7F3] dark:bg-[color:var(--bg-input-solid)]! dark:text-[color:var(--text-main)] dark:placeholder:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                      />
                    </div>
                    <button 
                      onClick={handleSavePreset}
                      className="w-full bg-brand-primary text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-green-900/10 hover:opacity-90 transition-all flex items-center justify-center space-x-2"
                    >
                      <Save className="w-3 h-3" />
                      <span>Salvar Perfil</span>
                    </button>
                    <p className="text-[7px] text-slate-400 dark:text-[color:var(--text-muted)] text-center font-bold uppercase tracking-widest">Estes perfis são privados e vinculados ao seu usuário.</p>
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
                className="w-full bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] px-5 py-4 rounded-3xl border border-slate-300 hover:border-brand-primary transition-all duration-500 shadow-sm hover:shadow-xl flex items-center justify-between gap-4"
              >
                <div className="flex flex-col items-start">
                  <span className="text-[8px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-[0.3em]">Módulos do Projeto</span>
                  <span className="text-[11px] font-black text-brand-dark dark:text-[color:var(--text-main)] uppercase tracking-tight mt-1">
                    Selecionar módulos
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-[color:var(--text-muted)]">
                    {orderedCategories.filter((cat: string) => formData[`check_area_${cat}`] === 'on').length}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-[color:var(--text-muted)] transition-transform ${isModuleSelectOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isModuleSelectOpen && (
                <div className="absolute z-50 mt-2 w-full bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border border-slate-300 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-none">
                  <div className="max-h-[360px] overflow-auto divide-y divide-slate-50 dark:divide-[color:var(--border-main)]">
                    {orderedCategories.map((cat: string, index: number) => {
                      const isChecked = formData[`check_area_${cat}`] === 'on';
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategoryChecked(cat, !isChecked);
                            setShowHiddenTab(false);
                          }}
                          className="w-full px-4 py-3 hover:bg-[#F0F7F3] dark:hover:bg-[color:var(--bg-input-solid)] transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-2xl border flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'brand-bg-primary border-brand-primary text-white'
                                : 'bg-[#F0F7F3] dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border-slate-200 text-slate-300'
                            }`}>
                              <Check className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="text-[10px] font-black uppercase tracking-widest text-brand-dark dark:text-[color:var(--text-main)]">
                                {categoryLabels?.[cat] || cat}
                              </span>
                              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-300 dark:text-[color:var(--text-muted)] mt-0.5">
                                {isChecked ? 'Selecionado' : 'Não selecionado'}
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
                              className="p-2 rounded-2xl bg-[#F0F7F3] dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                              title="Mover categoria para cima"
                            >
                              <ChevronDown className="w-3 h-3 rotate-180" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void reorderCategory(cat, 'down');
                              }}
                              disabled={index === orderedCategories.length - 1}
                              className="p-2 rounded-2xl bg-[#F0F7F3] dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                              title="Mover categoria para baixo"
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
              className={`w-full sm:w-auto bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] px-5 py-4 rounded-3xl border transition-all duration-500 shadow-sm hover:shadow-xl flex items-center justify-between sm:justify-start gap-4 ${
                showHiddenTab ? 'border-red-500' : 'border-slate-300 hover:border-red-500/60'
              }`}
            >
              <div className={`w-8 h-8 rounded-2xl flex items-center justify-center border transition-colors ${
                showHiddenTab
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'bg-[#F0F7F3] dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border-slate-200 text-slate-400'
              }`}>
                <EyeOff className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-[0.3em]">Visibilidade</span>
                <span className="text-[11px] font-black text-brand-dark dark:text-[color:var(--text-main)] uppercase tracking-tight mt-1">Itens ocultos</span>
              </div>
              <span className={`ml-auto sm:ml-0 text-[9px] font-black uppercase tracking-widest ${
                showHiddenTab ? 'text-red-500' : 'text-slate-400 dark:text-[color:var(--text-muted)]'
              }`}>
                {hiddenItems.length}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {orderedCategories.filter((cat: string) => formData[`check_area_${cat}`] === 'on').length === 0 ? (
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Nenhum módulo selecionado.
              </div>
            ) : (
              orderedCategories
                .filter((cat: string) => formData[`check_area_${cat}`] === 'on')
                .map((cat: string) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryChecked(cat, false)}
                    className="inline-flex items-center gap-2 bg-brand-primary text-white px-3 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm hover:opacity-90 transition-all"
                    title="Remover módulo"
                  >
                    <span>{categoryLabels?.[cat] || cat}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))
            )}
          </div>
        </div>

        <div className="mt-6 relative">
          <div className="flex items-center gap-3 bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <Search className="w-4 h-4 text-slate-300 dark:text-[color:var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 150)}
              placeholder="Buscar categoria, subcategoria ou item..."
              className="w-full bg-transparent outline-none text-[11px] font-bold text-brand-dark dark:text-[color:var(--text-main)] placeholder:text-slate-300 dark:placeholder:text-[color:var(--text-muted)]"
            />
          </div>

          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute z-50 mt-2 w-full bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border border-slate-200 rounded-2xl shadow-xl overflow-hidden backdrop-blur-none">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-300 dark:text-[color:var(--text-muted)]">
                  Nenhum resultado
                </div>
              ) : (
                <div className="max-h-[360px] overflow-auto divide-y divide-slate-50 dark:divide-[color:var(--border-main)]">
                  {searchResults.map((r: any) => (
                    <button
                      key={r.__key}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void goToSearchResult(r)}
                      className="w-full text-left px-4 py-3 hover:bg-[#F0F7F3] dark:hover:bg-[color:var(--bg-input-solid)] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col">
                          <div className="text-[10px] font-black uppercase tracking-widest text-brand-dark dark:text-[color:var(--text-main)]">
                            {r.label}
                          </div>
                          {r.subtitle && (
                            <div className="text-[8px] font-bold uppercase tracking-widest text-slate-300 dark:text-[color:var(--text-muted)] mt-0.5">
                              {r.subtitle}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {r.type === 'category' && (
                            <span className="text-[7px] font-black uppercase tracking-widest text-slate-300 dark:text-[color:var(--text-muted)]">Categoria</span>
                          )}
                          {r.type === 'subcategory' && (
                            <span className="text-[7px] font-black uppercase tracking-widest text-slate-300 dark:text-[color:var(--text-muted)]">Subcategoria</span>
                          )}
                          {r.type === 'item' && (
                            <span className="text-[7px] font-black uppercase tracking-widest text-slate-300 dark:text-[color:var(--text-muted)]">Item</span>
                          )}
                          {r.isHidden && (
                            <span className="text-[7px] font-black uppercase tracking-widest text-red-400">Oculto</span>
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
          <div className="bg-white rounded-[2rem] border-2 border-red-100 shadow-xl shadow-red-900/5 overflow-hidden transition-all duration-300">
            <div className="bg-red-50/50 px-8 py-5 border-b border-red-100 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-sm">
                  <EyeOff className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-red-700 font-heading uppercase tracking-tight">Itens Ocultos</h3>
                  <p className="text-[8px] font-bold text-red-400 uppercase tracking-widest">Estes itens não aparecerão na exportação final.</p>
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
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhum item oculto no momento.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-3 text-left text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Item</th>
                        <th className="pb-3 text-left text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Categoria</th>
                        <th className="pb-3 text-right text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allPackages
                        .filter((p: any) => hiddenItems.includes(p.id))
                        .map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="py-4">
                              <div className="font-black text-brand-dark text-xs tracking-tight uppercase">{p.name}</div>
                              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{p.skillName || p.skill}</div>
                            </td>
                            <td className="py-4">
                    <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-black uppercase tracking-widest">
                      {categoryLabels?.[p.categoryName] || p.categoryName}
                    </span>
                            </td>
                            <td className="py-4 text-right">
                              <button 
                                type="button"
                                onClick={() => toggleHideItem(p.id)}
                                className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Reexibir</span>
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

        {orderedCategories.map((cat: string) => (
          formData[`check_area_${cat}`] === 'on' && (
            <div id={`cat_section_${domSafeId(cat)}`} key={cat} className="bg-white dark:bg-[color:var(--bg-card)] dark:border-[color:var(--border-main)] rounded-[2rem] border border-slate-300 shadow-sm overflow-hidden transition-all duration-300">
              <div 
                className="bg-white dark:bg-[color:var(--bg-card)] dark:border-[color:var(--border-main)] px-8 py-5 border-b border-slate-50 flex justify-between items-center cursor-pointer select-none group"
                onClick={() => toggleSection(cat)}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 brand-bg-primary rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                    <Box className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black text-brand-dark dark:text-[color:var(--text-main)] font-heading uppercase tracking-tight">{categoryLabels?.[cat] || cat}</h3>
                </div>
                <div className="flex items-center space-x-2 text-slate-400 dark:text-[color:var(--text-muted)] group-hover:text-brand-primary transition-colors">
                  <span className="text-[9px] font-black uppercase tracking-[0.15em]">Configurar Itens</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${collapsedSections[cat] ? '' : 'rotate-180'}`} />
                </div>
              </div>
              
              {!collapsedSections[cat] && (
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-slate-300 dark:border-[color:var(--border-main)]">
                          <th className="pb-3 text-left text-[7px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-[0.2em]">Itens</th>
                          <th className="pb-3 text-center text-[7px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-[0.2em]">Hrs Unit.</th>
                          <th className="pb-3 text-center text-[7px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-[0.2em] w-32">Quantidade</th>
                          <th className="pb-3 text-center text-[7px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-[0.2em]">Organização</th>
                          <th className="pb-3 text-right text-[7px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-[0.2em]">Ajuste Manual</th>
                          <th className="pb-3 text-right text-[7px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-[0.2em]">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-[color:var(--border-main)]">
                        {(layoutConfig.subcategoryOrder[cat] || [DEFAULT_SUBCATEGORY]).map((subcategory, subcategoryIndex, allSubcategories) => {
                          const orderedPackages = getOrderedPackagesForSubcategory(cat, subcategory);

                          return (
                            <Fragment key={`${cat}_${subcategory}`}>
                              <tr id={`subcat_${domSafeId(cat)}_${domSafeId(subcategory)}`} key={`${cat}_${subcategory}_header`} className="bg-slate-100/80 dark:bg-[color:color-mix(in_srgb,var(--bg-input)_80%,var(--bg-card)_20%)] border-y border-slate-200 dark:border-[color:var(--border-main)]">
                                <td colSpan={6} className="py-3 px-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="px-3 py-1 rounded-lg bg-white dark:bg-[color:var(--bg-card)] border border-slate-200 dark:border-[color:var(--border-main)] text-[8px] font-black uppercase tracking-widest text-slate-700 dark:text-[color:var(--text-main)]">
                                        {subcategory}
                                      </span>
                                      <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 dark:text-[color:var(--text-muted)]">
                                        {orderedPackages.length} item(ns)
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void reorderSubcategory(cat, subcategory, 'up')}
                                        disabled={subcategoryIndex === 0}
                                        className="p-1.5 rounded-lg bg-white dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-muted)] border border-slate-200 dark:border-[color:var(--border-main)] text-slate-400 hover:text-brand-primary disabled:opacity-30"
                                        title="Mover subcategoria para cima"
                                      >
                                        <ChevronDown className="w-3 h-3 rotate-180" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void reorderSubcategory(cat, subcategory, 'down')}
                                        disabled={subcategoryIndex === allSubcategories.length - 1}
                                        className="p-1.5 rounded-lg bg-white dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-muted)] border border-slate-200 dark:border-[color:var(--border-main)] text-slate-400 hover:text-brand-primary disabled:opacity-30"
                                        title="Mover subcategoria para baixo"
                                      >
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>

                              {orderedPackages.length === 0 ? (
                                <tr key={`${cat}_${subcategory}_empty`} className="bg-white dark:bg-[color:var(--bg-card)]">
                                  <td colSpan={6} className="py-4 px-4 text-[9px] font-bold uppercase tracking-widest text-slate-300 dark:text-[color:var(--text-muted)] text-center">
                                    Nenhum item nesta subcategoria.
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
                                          <div className="font-black text-brand-dark dark:text-[color:var(--text-main)] text-xs mb-0.5 tracking-tight uppercase">{p.name}</div>
                                          <button
                                            type="button"
                                            onClick={() => toggleHideItem(p.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 dark:text-[color:var(--text-muted)] hover:text-red-500 transition-all"
                                            title="Ocultar Item"
                                          >
                                            <EyeOff className="w-3 h-3" />
                                          </button>
                                          {p.tooltip && (
                                            <div className="group/tooltip relative cursor-help">
                                              <div className="w-3 h-3 bg-slate-100 dark:bg-[color:var(--bg-input)] text-slate-400 dark:text-[color:var(--text-muted)] rounded-full flex items-center justify-center text-[8px] font-black group-hover/tooltip:bg-brand-primary group-hover/tooltip:text-white transition-colors">?</div>
                                              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-brand-dark text-white dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)] dark:border dark:border-[color:var(--border-main)] text-[9px] font-bold p-3 rounded-xl w-48 shadow-2xl opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50">
                                                {p.tooltip}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-2 mb-1">
                                          <span className="text-[8px] bg-slate-100 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-muted)] text-slate-500 px-2 py-1 rounded-lg font-black uppercase tracking-widest">{p.skillName || p.skill}</span>
                                          {p.dependsOnItemId && (
                                            <span className="text-[8px] bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 text-amber-600 px-2 py-1 rounded-lg font-black uppercase tracking-widest">Dep: {allPackages.find((ap:any) => ap.id === p.dependsOnItemId)?.name}</span>
                                          )}
                                        </div>
                                        <div className="text-[9px] text-slate-400 dark:text-[color:var(--text-muted)] font-bold max-w-md leading-relaxed line-clamp-1 opacity-60" title={p.scopeIncluded}>
                                          {p.scopeIncluded}
                                        </div>
                                      </td>
                                      <td className="py-4 text-center text-[10px] font-black text-slate-400 dark:text-[color:var(--text-muted)] tracking-tighter">{p.hours}</td>
                                      <td className="py-4 px-4">
                                        <div className="flex justify-center">
                                          <input
                                            type="number"
                                            min="0"
                                            name={`item_${p.id}_qty`}
                                            value={formData[`item_${p.id}_qty`] || ''}
                                            onChange={handleInputChange}
                                            onKeyDown={handleKeyDown}
                                            className="w-16 bg-slate-50 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-black text-center focus:ring-2 focus:ring-brand-primary focus:bg-white dark:focus:bg-[color:var(--bg-card)] outline-none transition-all"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          <select
                                            value={subcategory}
                                            onChange={(e) => void moveItemToSubcategory(cat, itemId, e.target.value)}
                                            className="bg-white dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-2 py-1 text-[8px] font-black uppercase outline-none"
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
                                            title="Mover item para cima"
                                          >
                                            <ChevronDown className="w-3 h-3 rotate-180" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void reorderItemInSubcategory(cat, subcategory, itemId, 'down')}
                                            disabled={itemIndex === -1 || itemIndex >= currentItemOrder.length - 1}
                                            className="p-1 rounded-md bg-slate-50 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                                            title="Mover item para baixo"
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
                                            <span className="ml-1.5 text-[7px] font-black text-slate-400 dark:text-[color:var(--text-muted)] group-hover/toggle:text-brand-secondary dark:group-hover/toggle:text-[color:var(--secondary)] transition-colors uppercase tracking-widest">Manual</span>
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
                                              className="w-16 bg-purple-50/50 dark:bg-purple-900/20 dark:text-[color:var(--text-main)] dark:border-purple-400/40 border border-purple-100 rounded-lg px-2 py-1 text-[10px] font-black text-right focus:ring-2 focus:ring-brand-secondary outline-none"
                                            />
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-4 text-right font-black text-brand-dark dark:text-[color:var(--text-main)] text-xs tracking-tighter">
                                        {rowTotal.toFixed(1)}
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
                              <td className="py-4 text-sm align-top pr-4">
                                <input 
                                  type="text" 
                                  value={pkg.name}
                                  onChange={(e) => updateCustomPackage(pkg.id, 'name', e.target.value)}
                                  placeholder="Nome do Pacote Personalizado" 
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs mb-2 font-black text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                />
                                <div className="flex items-center space-x-2 mb-2">
                                  <select 
                                    value={pkg.skill}
                                    onChange={(e) => updateCustomPackage(pkg.id, 'skill', e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-[9px] font-black uppercase tracking-tight outline-none focus:ring-1 focus:ring-brand-primary"
                                  >
                                    <option value="Implantação">Implantação</option>
                                    <option value="GP">GP</option>
                                    <option value="Solution Design">Solution Design</option>
                                    <option value="Desenvolvimento">Desenvolvimento</option>
                                    <option value="Design">Design</option>
                                  </select>
                                </div>
                                <div className="flex space-x-2">
                                  <textarea 
                                    value={pkg.scopeIn}
                                    onChange={(e) => updateCustomPackage(pkg.id, 'scopeIn', e.target.value)}
                                    placeholder="Incluso" rows={1} 
                                    className="text-[9px] font-bold w-1/2 bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                                  />
                                  <textarea 
                                    value={pkg.scopeOut}
                                    onChange={(e) => updateCustomPackage(pkg.id, 'scopeOut', e.target.value)}
                                    placeholder="Não incluso" rows={1} 
                                    className="text-[9px] font-bold w-1/2 bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                                  />
                                </div>
                              </td>
                              <td className="py-4 text-xs align-top text-center pt-6 font-black text-slate-400">
                                <input 
                                  type="number" 
                                  min="0"
                                  step="0.1"
                                  value={pkg.hours || ''}
                                  onChange={(e) => updateCustomPackage(pkg.id, 'hours', e.target.value)}
                                  placeholder="0.0" 
                                  className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-black text-center focus:ring-2 focus:ring-brand-primary outline-none"
                                />
                              </td>
                              <td className="py-4 text-xs align-top text-center pt-6">
                                <input 
                                  type="number" 
                                  min="0"
                                  value={pkg.qty || ''}
                                  onChange={(e) => updateCustomPackage(pkg.id, 'qty', e.target.value)}
                                  className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-black text-center focus:ring-2 focus:ring-brand-primary outline-none"
                                />
                              </td>
                              <td className="py-4 text-center align-top pt-6">
                                <span className="inline-flex px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[8px] font-black uppercase tracking-widest text-slate-400">
                                  Personalizado
                                </span>
                              </td>
                              <td className="py-4 text-xs align-top text-right pt-6">
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
                                    <span className="ml-2 text-[8px] font-black text-slate-400 group-hover/toggle:text-brand-secondary transition-colors uppercase tracking-widest">Manual</span>
                                  </label>
                                  {pkg.overrideCheck && (
                                    <input 
                                      type="number" 
                                      min="0"
                                      step="0.1"
                                      value={pkg.overrideVal || ''}
                                      onChange={(e) => updateCustomPackage(pkg.id, 'overrideVal', e.target.value)}
                                      placeholder="Total" 
                                      className="w-16 bg-purple-50 border border-purple-100 rounded-lg px-2 py-1.5 text-[10px] font-black text-right focus:ring-2 focus:ring-brand-secondary outline-none"
                                    />
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      if(confirm('Remover?')) {
                                        setCustomPackages(prev => prev.filter(p => p.id !== pkg.id));
                                      }
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-4 text-sm font-black text-brand-dark align-top pt-6 text-right tracking-tighter">
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
                      className="inline-flex items-center px-5 py-2.5 rounded-xl bg-brand-dark dark:bg-[color:var(--primary)] dark:text-white text-white text-[8px] font-black hover:bg-slate-800 dark:hover:opacity-90 transition-all group uppercase tracking-widest shadow-md"
                    >
                      <div className="w-5 h-5 bg-brand-primary/20 dark:bg-white/20 rounded-lg flex items-center justify-center mr-2 group-hover:scale-105 transition-transform">
                        <Plus className="w-3 h-3 text-brand-primary dark:text-white" />
                      </div>
                      Novo item
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
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-dark">Apps do Marketplace</h4>
                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Custo FLAT: 5h por App (Não incide GP/Disco/Validação)</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={addMarketplaceApp}
                          className="bg-brand-primary text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center space-x-2 shadow-lg shadow-green-900/10"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Adicionar Outro App</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {marketplaceApps.map((app) => (
                          <div key={app.id} className="bg-slate-50/50 border border-slate-200 p-4 rounded-2xl flex items-start space-x-4 relative group">
                            <div className="flex-1 space-y-3">
                              <div className="space-y-1">
                                <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do App</label>
                                <input 
                                  type="text"
                                  value={app.name}
                                  onChange={(e) => updateMarketplaceApp(app.id, 'name', e.target.value)}
                                  placeholder="Ex: Zendesk Advanced Search"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-black text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Link do Marketplace</label>
                                <input 
                                  type="url"
                                  value={app.link}
                                  onChange={(e) => updateMarketplaceApp(app.id, 'link', e.target.value)}
                                  placeholder="https://zendesk.com/marketplace/..."
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-black text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all"
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
                            <div className="absolute top-4 right-14 bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded text-[8px] font-black uppercase">
                              5H FLAT
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {marketplaceApps.length > 0 && (
                        <div className="flex justify-end pt-2">
                          <div className="bg-brand-dark text-white px-4 py-2 rounded-xl flex items-center space-x-3">
                            <span className="text-[8px] font-black uppercase tracking-widest">Total FLAT Marketplace:</span>
                            <span className="text-sm font-black text-brand-accent">{marketplaceApps.length * 5}H</span>
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
      <div className="bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] dark:border dark:border-[color:var(--border-main)] border-2 border-brand-primary p-6 md:p-8 rounded-[2rem] shadow-xl mt-12">
        <div className="max-w-7xl mx-auto flex flex-col space-y-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl md:text-3xl font-black text-brand-dark dark:text-[color:var(--text-main)] font-heading uppercase tracking-tighter leading-none">
              Resumo <span className="text-brand-primary dark:text-[color:var(--primary)]">de Horas</span>
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
                rounded-[1.75rem] border-2 border-brand-primary
                px-6 md:px-10 py-5 md:py-7
                bg-[#FFFFFF] dark:bg-[#0a0a0a]
                flex items-center justify-between gap-4
              `}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-primary dark:text-[color:var(--primary)] mb-1">Total Geral</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-6xl font-black text-brand-primary dark:text-[color:var(--primary)] font-heading tracking-tighter leading-none tabular-nums">
                    {Math.round(totals.grandTotal).toFixed(0)}
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-brand-primary dark:text-[color:var(--primary)] mb-1">Horas</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
  const subitems = SKILL_BREAKDOWN_SUBITEMS[skill] || [];
  const breakBy = (totals.skillBreakdownBySkill as any)?.[skill] || {};
  const totalValue = totals.skillTotals[skill] || 0;
  const isGP = skill === 'GP';
  const isImpl = skill === 'Implantação';
  const isSD = skill === 'Solution Design';

  return (
    <div className={`
      flex flex-col
      bg-[#F0F7F3] dark:bg-[#141414]
      rounded-[1.75rem]
      border-2 border-slate-300 dark:border-[#1f1f1f]
      overflow-hidden
      ${compact ? '' : 'h-full'}
    `}>
      {/* Cabeçalho */}
      <div className={`
        flex flex-col gap-2
        px-4 pt-4 pb-3
        border-b border-slate-300/40 dark:border-[#1f1f1f]
        bg-white/60 dark:bg-[#0a0a0a]
      `}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[9px] font-black text-slate-500 dark:text-[#bfbfbf] uppercase tracking-[0.22em]">
            {skill}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl md:text-[1.75rem] font-black text-brand-dark dark:text-[#ffffff] font-heading tracking-tighter leading-none tabular-nums">
              {totalValue.toFixed(1)}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-[#bfbfbf] mb-0.5">h</span>
          </div>
        </div>

        {isImpl && (
          <div className="grid grid-cols-2 gap-1.5 w-full mt-1">
            <InlinePercentCtrl
              label="Discovery"
              value={percents.discovery}
              onChange={(n) => setPercents(p => ({ ...p, discovery: Math.max(0, n) }))}
              onReset={() => setPercents(p => ({ ...p, discovery: getVariableNumber(variables, ['DISCOVERY_STANDARD'], 0) }))}
            />
            <InlinePercentCtrl
              label="Validação"
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
        <div className={`divide-y divide-slate-300/30 dark:divide-[#1f1f1f] ${isGP ? '' : 'flex-1'}`}>
          {subitems.map(sub => {
            const val = Number(breakBy[sub.source] ?? 0) || 0;
            const isDiscovery = sub.source === 'implantacao_discovery' || sub.source === 'sd_discovery';
            const isValidation = sub.source === 'implantacao_validacao';
            const hasOverride = isImpl && isDiscovery;
            return (
              <div
                key={sub.key}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-white/80 dark:hover:bg-[#0a0a0a] transition-colors"
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isDiscovery ? 'bg-cyan-500' :
                      isValidation ? 'bg-indigo-500' :
                        'bg-slate-400 dark:bg-slate-400'
                  }`} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-[#e8e8e8] truncate">
                    {sub.label}
                  </span>
                  {hasOverride && (
                    <span className={`shrink-0 text-[6px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${
                      overrides.discovery !== null
                        ? 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 dark:border-cyan-400/30'
                        : 'bg-white dark:bg-[#0a0a0a] text-slate-500 dark:text-[#bfbfbf] border-slate-200 dark:border-[#1f1f1f]'
                    }`}>
                      {overrides.discovery !== null ? 'M' : 'P'}
                    </span>
                  )}
                  {isImpl && isValidation && (
                    <span className={`shrink-0 text-[6px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${
                      overrides.validation !== null
                        ? 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 dark:border-indigo-400/30'
                        : 'bg-white dark:bg-[#0a0a0a] text-slate-500 dark:text-[#bfbfbf] border-slate-200 dark:border-[#1f1f1f]'
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
                          ? 'bg-cyan-500 border-cyan-500 shadow shadow-cyan-900/20'
                          : 'bg-slate-200 dark:bg-[#1a1a1a] border-slate-300 dark:border-[#262626]'}
                      `}
                      title={overrides.discovery !== null ? 'Voltar para % padrão' : 'Travar valor absoluto'}
                    >
                      <span className={`
                        absolute top-[1px] left-[1px] h-[12px] w-[12px] rounded-full transition-all shadow
                        bg-white dark:bg-[#0a0a0a]
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
                          ? 'bg-indigo-500 border-indigo-500 shadow shadow-indigo-900/20'
                          : 'bg-slate-200 dark:bg-[#1a1a1a] border-slate-300 dark:border-[#262626]'}
                      `}
                      title={overrides.validation !== null ? 'Voltar para % padrão' : 'Travar valor absoluto'}
                    >
                      <span className={`
                        absolute top-[1px] left-[1px] h-[12px] w-[12px] rounded-full transition-all shadow
                        bg-white dark:bg-[#0a0a0a]
                        ${overrides.validation !== null ? 'translate-x-[13px]' : ''}
                      `} />
                    </button>
                  )}
                  {(hasOverride || (isImpl && isValidation)) ? (
                    <div className="w-[48px] shrink-0 text-right">
                      {
                        (hasOverride && overrides.discovery !== null) ? (
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={overrides.discovery}
                            onChange={(e) => setOverrides(o => ({ ...o, discovery: Math.max(0, parseFloat(e.target.value) || 0) }))}
                            className="w-full bg-purple-50 dark:bg-purple-900/30 dark:border-purple-400/40 border border-purple-100 rounded-md px-1.5 py-1 text-[9px] font-black text-right text-brand-secondary dark:text-[color:var(--secondary)] outline-none tabular-nums"
                          />
                        ) : (isImpl && isValidation && overrides.validation !== null) ? (
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={overrides.validation}
                            onChange={(e) => setOverrides(o => ({ ...o, validation: Math.max(0, parseFloat(e.target.value) || 0) }))}
                            className="w-full bg-purple-50 dark:bg-purple-900/30 dark:border-purple-400/40 border border-purple-100 rounded-md px-1.5 py-1 text-[9px] font-black text-right text-brand-secondary dark:text-[color:var(--secondary)] outline-none tabular-nums"
                          />
                        ) : (
                          <div className="flex items-baseline justify-end gap-0.5">
                            <span className="text-[11px] font-black text-brand-dark dark:text-[#ffffff] font-heading tracking-tighter leading-none tabular-nums">
                              {val.toFixed(1)}
                            </span>
                            <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 dark:text-[#bfbfbf]">h</span>
                          </div>
                        )
                      }
                    </div>
                  ) : (
                    <div className="w-[48px] shrink-0 flex items-baseline justify-end gap-0.5">
                      <span className="text-[11px] font-black text-brand-dark dark:text-[#ffffff] font-heading tracking-tighter leading-none tabular-nums">
                        {val.toFixed(1)}
                      </span>
                      <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 dark:text-[#bfbfbf]">h</span>
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
          px-4 py-3 border-t border-slate-300/40 dark:border-[#1f1f1f]
          bg-white/70 dark:bg-[#0a0a0a]
          flex items-center justify-between gap-3
        `}>
          <div className="flex items-center gap-2">
            <span className={`text-[7px] font-black uppercase tracking-widest transition-colors ${overrides.gp !== null ? 'text-brand-primary dark:text-[color:var(--primary)]' : 'text-slate-500 dark:text-[#bfbfbf]'}`}>
              {overrides.gp !== null ? 'Manual' : 'Padrão'}
            </span>
            <button
              type="button"
              onClick={() => setOverrides(o => ({ ...o, gp: o.gp !== null ? null : totals.gpVal }))}
              className={`
                relative shrink-0 w-10 h-5 rounded-full border-2 transition-all
                ${overrides.gp !== null
                  ? 'bg-brand-primary border-brand-primary shadow shadow-green-900/20'
                  : 'bg-slate-200 dark:bg-[#1a1a1a] border-slate-300 dark:border-[#262626]'}
              `}
              title={overrides.gp !== null ? 'Voltar para % padrão' : 'Travar valor absoluto'}
            >
              <span className={`
                absolute top-[1px] left-[1px] h-[14px] w-[14px] rounded-full transition-all shadow
                bg-white dark:bg-[#0a0a0a]
                ${overrides.gp !== null ? 'translate-x-[17px]' : ''}
              `} />
            </button>
          </div>
          <div className="w-[68px] shrink-0 text-right">
            {overrides.gp === null ? (
              <div className="flex items-baseline justify-end gap-0.5">
                <span className="text-[13px] font-black text-brand-dark dark:text-[#ffffff] font-heading tracking-tighter leading-none tabular-nums">
                  {totals.gpVal.toFixed(1)}
                </span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-[#bfbfbf] mb-0.5">h</span>
              </div>
            ) : (
              <input
                type="number"
                min="0"
                step="0.1"
                value={overrides.gp}
                onChange={(e) => setOverrides(o => ({ ...o, gp: Math.max(0, parseFloat(e.target.value) || 0) }))}
                className="w-full bg-purple-50 dark:bg-purple-900/30 dark:border-purple-400/40 border border-purple-100 rounded-md px-2 py-1 text-[10px] font-black text-right text-brand-secondary dark:text-[color:var(--secondary)] outline-none tabular-nums"
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
  return (
    <div className={`flex items-center gap-1.5 rounded-xl border-2 px-2 py-1.5 bg-[#F0F7F3] dark:bg-[#141414] border-slate-300 dark:border-[#1f1f1f] ${full ? 'w-full justify-between' : ''}`}>
      <span className="shrink-0 text-[7px] font-black uppercase tracking-widest text-slate-600 dark:text-[#cfcfcf] whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center justify-end gap-1 ml-auto">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
          className="w-10 md:w-12 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-[#262626] rounded-md px-1.5 py-1 text-[9px] font-black outline-none text-center text-brand-dark dark:text-[#ffffff] tabular-nums"
        />
        <span className="text-brand-secondary dark:text-[color:var(--secondary)] text-[8px] font-black">%</span>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="p-1 rounded-md text-slate-400 dark:text-[#cfcfcf] hover:text-brand-primary dark:hover:text-[color:var(--primary)] hover:bg-slate-100 dark:hover:bg-[#1f1f1f] transition-all shrink-0"
        title={`Resetar ${label}`}
      >
        <RotateCcw className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

