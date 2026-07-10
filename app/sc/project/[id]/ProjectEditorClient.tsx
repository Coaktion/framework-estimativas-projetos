'use client';

import { Fragment, useState, useMemo, useEffect, useTransition } from 'react';
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

function subcategoryKey(category: string, subcategory: string) {
  return `${category}::${subcategory}`;
}

function inferDefaultSubcategory(category: string, pkg: any) {
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

export default function ProjectEditorClient({ project, categories, packagesByCategory, currentVersion, allVersions, variables, preferences }: any) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hiddenItems, setHiddenItems] = useState<number[]>(safeJsonParse(preferences?.hiddenItems, []));
  const [presetName, setPresetName] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [showHiddenTab, setShowHiddenTab] = useState(false);
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
  
  const [percents, setPercents] = useState({
    gp: currentVersion?.gpPercent ?? 25,
    discovery: currentVersion?.discoveryPercent ?? 0,
    validation: currentVersion?.validationPercent ?? 0,
  });

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

  const addSubcategory = async (category: string) => {
    const input = prompt(`Nome da nova subcategoria para ${category}:`, '');
    const name = input?.trim();
    if (!name) return;

    const nextOrder = uniqueStrings([...(layoutConfig.subcategoryOrder[category] || []), name]);
    await persistLayoutConfig({
      ...layoutConfig,
      subcategoryOrder: {
        ...layoutConfig.subcategoryOrder,
        [category]: nextOrder
      }
    });
  };

  const renameSubcategory = async (category: string, currentName: string) => {
    const input = prompt(`Novo nome para a subcategoria "${currentName}":`, currentName);
    const nextName = input?.trim();
    if (!nextName || nextName === currentName) return;

    const nextItemSubcategories = { ...layoutConfig.itemSubcategories };
    Object.entries(nextItemSubcategories).forEach(([itemId, subcategory]) => {
      const pkg: any = allPackages.find((candidate: any) => String(candidate.id) === itemId);
      if (pkg?.categoryName === category && subcategory === currentName) {
        nextItemSubcategories[itemId] = nextName;
      }
    });

    const nextLayout = {
      ...layoutConfig,
      subcategoryOrder: {
        ...layoutConfig.subcategoryOrder,
        [category]: (layoutConfig.subcategoryOrder[category] || []).map((name) => name === currentName ? nextName : name)
      },
      itemSubcategories: nextItemSubcategories,
      itemOrder: { ...layoutConfig.itemOrder }
    };

    const currentKey = subcategoryKey(category, currentName);
    const nextKey = subcategoryKey(category, nextName);
    nextLayout.itemOrder[nextKey] = uniqueStrings([
      ...(nextLayout.itemOrder[nextKey] || []),
      ...(nextLayout.itemOrder[currentKey] || [])
    ]);
    delete nextLayout.itemOrder[currentKey];

    await persistLayoutConfig(nextLayout);
  };

  const removeSubcategory = async (category: string, subcategory: string) => {
    if (subcategory === DEFAULT_SUBCATEGORY) return;
    if (!confirm(`Remover a subcategoria "${subcategory}"? Os itens serão movidos para "${DEFAULT_SUBCATEGORY}".`)) return;

    const nextItemSubcategories = { ...layoutConfig.itemSubcategories };
    Object.entries(nextItemSubcategories).forEach(([itemId, currentSubcategory]) => {
      const pkg: any = allPackages.find((candidate: any) => String(candidate.id) === itemId);
      if (pkg?.categoryName === category && currentSubcategory === subcategory) {
        nextItemSubcategories[itemId] = DEFAULT_SUBCATEGORY;
      }
    });

    const nextLayout = {
      ...layoutConfig,
      subcategoryOrder: {
        ...layoutConfig.subcategoryOrder,
        [category]: uniqueStrings([
          ...(layoutConfig.subcategoryOrder[category] || []).filter((name) => name !== subcategory),
          DEFAULT_SUBCATEGORY
        ])
      },
      itemSubcategories: nextItemSubcategories,
      itemOrder: { ...layoutConfig.itemOrder }
    };

    delete nextLayout.itemOrder[subcategoryKey(category, subcategory)];
    await persistLayoutConfig(nextLayout);
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

    // Standard Packages
    Object.keys(packagesByCategory).forEach(cat => {
      // FIX: Ensure modules appear even if not checked in formData yet
      // If check_area_CAT is undefined, we assume it's visible but not summing until checked
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
          if (skillTotals[skillKey] !== undefined) skillTotals[skillKey] += rowTotal;
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

    const gpVal = calculateVariable('GP_STANDARD', percents.gp, overrides.gp);
    const discVal = calculateVariable('DISCOVERY_STANDARD', percents.discovery, overrides.discovery);
    const validVal = calculateVariable('VALIDATION_STANDARD', percents.validation, overrides.validation);

    // Add safety hours to skill totals
    Object.entries(safetyHours).forEach(([skill, hours]) => {
      if (skillTotals[skill] !== undefined) {
        skillTotals[skill] += (hours || 0);
      }
    });

    const totalSafety = Object.values(safetyHours).reduce((a, b) => a + (b || 0), 0);

    // Add calculated GP to skill totals for UI display
    skillTotals['GP'] = (skillTotals['GP'] || 0) + gpVal;
    
    // Add Marketplace FLAT hours to Implantação for skill breakdown but not to subtotal for GP calc
    skillTotals['Implantação'] = (skillTotals['Implantação'] || 0) + flatHoursMarketplace;

    return {
      subtotal,
      skillTotals,
      gpVal,
      discVal,
      validVal,
      flatHoursMarketplace,
      totalSafety,
      grandTotal: Math.ceil(subtotal + gpVal + discVal + validVal + flatHoursMarketplace + totalSafety)
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
      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-300 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div className="flex items-center space-x-4">
            <div className="brand-bg-primary p-2.5 rounded-2xl shadow-lg shadow-green-900/10 text-white">
              <Layout className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-brand-dark font-heading tracking-tight uppercase">Módulos do Projeto</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Selecione as áreas que compõem este escopo.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowPresets(!showPresets)}
                className="p-2 rounded-xl bg-slate-50 text-slate-400 border border-slate-200 hover:text-brand-primary transition-all"
                title="Presets de Visualização"
              >
                <Settings className="w-4 h-4" />
              </button>
              {showPresets && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 z-[60] space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meus Perfis (Presets)</h4>
                    <Users className="w-3 h-3 text-slate-300" />
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {presets.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[9px] font-bold text-slate-300 uppercase leading-relaxed">Nenhum perfil salvo para seu usuário</p>
                      </div>
                    ) : (
                      presets.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 group/preset">
                          <button
                            onClick={() => applyPreset(p)}
                            className="flex-1 text-left p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 text-[10px] font-bold text-brand-dark uppercase transition-all flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span>{p.name}</span>
                              <span className="text-[7px] text-slate-300 font-black">{Array.isArray(p.hiddenItems) ? p.hiddenItems.length : 0} itens ocultos</span>
                            </div>
                            <Check className="w-3 h-3 text-emerald-500 opacity-0 group-hover/preset:opacity-100 transition-opacity" />
                          </button>
                          <button 
                            onClick={() => handleDeletePreset(p.name)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/preset:opacity-100"
                            title="Excluir Perfil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Salvar configuração atual</label>
                      <input 
                        type="text" 
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="Nome do seu perfil (ex: Padrão Matheus)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                      />
                    </div>
                    <button 
                      onClick={handleSavePreset}
                      className="w-full bg-brand-primary text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-green-900/10 hover:opacity-90 transition-all flex items-center justify-center space-x-2"
                    >
                      <Save className="w-3 h-3" />
                      <span>Salvar Perfil</span>
                    </button>
                    <p className="text-[7px] text-slate-400 text-center font-bold uppercase tracking-widest">Estes perfis são privados e vinculados ao seu usuário.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          {orderedCategories.map((cat: string, index: number) => {
            const isChecked = formData[`check_area_${cat}`] === 'on';
            return (
              <div 
                key={cat} 
                onClick={() => {
                  const newValue = isChecked ? 'off' : 'on';
                  setFormData((prev: any) => ({
                    ...prev,
                    [`check_area_${cat}`]: newValue
                  }));
                  setShowHiddenTab(false);
                }}
                className={`relative group flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all cursor-pointer select-none ${
                  isChecked 
                    ? 'bg-brand-primary border-brand-primary' 
                    : 'border-slate-50 bg-slate-50/30 hover:bg-white hover:border-brand-primary/30 hover:shadow-xl'
                }`}
              >
                <div className="absolute top-3 right-3 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void reorderCategory(cat, 'up');
                    }}
                    disabled={index === 0}
                    className="p-1 rounded-md bg-white/80 text-slate-400 hover:text-brand-primary disabled:opacity-30"
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
                    className="p-1 rounded-md bg-white/80 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                    title="Mover categoria para baixo"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-3 transition-all ${
                  isChecked ? 'border-white/50 bg-white/20' : 'border-slate-200'
                }`}>
                  <Check className={`w-5 h-5 ${isChecked ? 'text-white' : 'text-slate-300'}`} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest text-center transition-colors ${
                  isChecked ? 'text-white' : 'text-slate-500'
                }`}>{cat}</span>
              </div>
            );
          })}

          {/* Aba de Itens Ocultos */}
          <div 
            onClick={() => setShowHiddenTab(!showHiddenTab)}
            className={`group flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all cursor-pointer select-none ${
              showHiddenTab 
                ? 'bg-red-500 border-red-500 shadow-lg shadow-red-900/20' 
                : 'border-slate-50 bg-slate-50/30 hover:bg-white hover:border-red-500/30 hover:shadow-xl'
            }`}
          >
            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-3 transition-all ${
              showHiddenTab ? 'border-white/50 bg-white/20' : 'border-slate-200'
            }`}>
              <EyeOff className={`w-5 h-5 ${showHiddenTab ? 'text-white' : 'text-slate-300'}`} />
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-[10px] font-black uppercase tracking-widest text-center transition-colors ${
                showHiddenTab ? 'text-white' : 'text-slate-500'
              }`}>Itens Ocultos</span>
              <span className={`text-[8px] font-bold uppercase transition-colors ${
                showHiddenTab ? 'text-white/70' : 'text-slate-300'
              }`}>{hiddenItems.length} Itens</span>
            </div>
          </div>
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
                              <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-black uppercase tracking-widest">{p.categoryName}</span>
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
            <div key={cat} className="bg-white rounded-[2rem] border border-slate-300 shadow-sm overflow-hidden transition-all duration-300">
              <div 
                className="bg-white px-8 py-5 border-b border-slate-50 flex justify-between items-center cursor-pointer select-none group"
                onClick={() => toggleSection(cat)}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 brand-bg-primary rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                    <Box className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black text-brand-dark font-heading uppercase tracking-tight">{cat}</h3>
                </div>
                <div className="flex items-center space-x-2 text-slate-400 group-hover:text-brand-primary transition-colors">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void addSubcategory(cat);
                    }}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:text-brand-primary border border-slate-200 text-[8px] font-black uppercase tracking-widest"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Subcategoria</span>
                  </button>
                  <span className="text-[9px] font-black uppercase tracking-[0.15em]">Configurar Itens</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${collapsedSections[cat] ? '' : 'rotate-180'}`} />
                </div>
              </div>
              
              {!collapsedSections[cat] && (
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-slate-300">
                          <th className="pb-3 text-left text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Pacote Sugerido</th>
                          <th className="pb-3 text-center text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Hrs Unit.</th>
                          <th className="pb-3 text-center text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] w-32">Quantidade</th>
                          <th className="pb-3 text-center text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Organização</th>
                          <th className="pb-3 text-right text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Ajuste Manual</th>
                          <th className="pb-3 text-right text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(layoutConfig.subcategoryOrder[cat] || [DEFAULT_SUBCATEGORY]).map((subcategory, subcategoryIndex, allSubcategories) => {
                          const orderedPackages = getOrderedPackagesForSubcategory(cat, subcategory);

                          return (
                            <Fragment key={`${cat}_${subcategory}`}>
                              <tr key={`${cat}_${subcategory}_header`} className="bg-slate-50/70 border-y border-slate-200">
                                <td colSpan={6} className="py-3 px-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-[8px] font-black uppercase tracking-widest text-brand-dark">
                                        {subcategory}
                                      </span>
                                      <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">
                                        {orderedPackages.length} item(ns)
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void reorderSubcategory(cat, subcategory, 'up')}
                                        disabled={subcategoryIndex === 0}
                                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                                        title="Mover subcategoria para cima"
                                      >
                                        <ChevronDown className="w-3 h-3 rotate-180" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void reorderSubcategory(cat, subcategory, 'down')}
                                        disabled={subcategoryIndex === allSubcategories.length - 1}
                                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                                        title="Mover subcategoria para baixo"
                                      >
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void renameSubcategory(cat, subcategory)}
                                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-primary"
                                      >
                                        Renomear
                                      </button>
                                      {subcategory !== DEFAULT_SUBCATEGORY && (
                                        <button
                                          type="button"
                                          onClick={() => void removeSubcategory(cat, subcategory)}
                                          className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-100 text-[8px] font-black uppercase tracking-widest text-red-500 hover:bg-red-100"
                                        >
                                          Remover
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>

                              {orderedPackages.length === 0 ? (
                                <tr key={`${cat}_${subcategory}_empty`} className="bg-white">
                                  <td colSpan={6} className="py-4 px-4 text-[9px] font-bold uppercase tracking-widest text-slate-300 text-center">
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
                                    <tr key={p.id} className="hover:bg-slate-50/20 transition-colors group">
                                      <td className="py-4 pr-4">
                                        <div className="flex items-center space-x-2">
                                          <div className="font-black text-brand-dark text-xs mb-0.5 tracking-tight uppercase">{p.name}</div>
                                          <button
                                            type="button"
                                            onClick={() => toggleHideItem(p.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                                            title="Ocultar Item"
                                          >
                                            <EyeOff className="w-3 h-3" />
                                          </button>
                                          {p.tooltip && (
                                            <div className="group/tooltip relative cursor-help">
                                              <div className="w-3 h-3 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center text-[8px] font-black group-hover/tooltip:bg-brand-primary group-hover/tooltip:text-white transition-colors">?</div>
                                              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-brand-dark text-white text-[9px] font-bold p-3 rounded-xl w-48 shadow-2xl opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50">
                                                {p.tooltip}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-2 mb-1">
                                          <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-black uppercase tracking-widest">{p.skillName || p.skill}</span>
                                          {p.dependsOnItemId && (
                                            <span className="text-[8px] bg-amber-50 text-amber-600 px-2 py-1 rounded-lg font-black uppercase tracking-widest">Dep: {allPackages.find((ap:any) => ap.id === p.dependsOnItemId)?.name}</span>
                                          )}
                                        </div>
                                        <div className="text-[9px] text-slate-400 font-bold max-w-md leading-relaxed line-clamp-1 opacity-60" title={p.scopeIncluded}>
                                          {p.scopeIncluded}
                                        </div>
                                      </td>
                                      <td className="py-4 text-center text-[10px] font-black text-slate-400 tracking-tighter">{p.hours}</td>
                                      <td className="py-4 px-4">
                                        <div className="flex justify-center">
                                          <input
                                            type="number"
                                            min="0"
                                            name={`item_${p.id}_qty`}
                                            value={formData[`item_${p.id}_qty`] || ''}
                                            onChange={handleInputChange}
                                            onKeyDown={handleKeyDown}
                                            className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-black text-center focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          <select
                                            value={subcategory}
                                            onChange={(e) => void moveItemToSubcategory(cat, itemId, e.target.value)}
                                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[8px] font-black uppercase outline-none"
                                          >
                                            {(layoutConfig.subcategoryOrder[cat] || [DEFAULT_SUBCATEGORY]).map((option) => (
                                              <option key={option} value={option}>{option}</option>
                                            ))}
                                          </select>
                                          <button
                                            type="button"
                                            onClick={() => void reorderItemInSubcategory(cat, subcategory, itemId, 'up')}
                                            disabled={itemIndex <= 0}
                                            className="p-1 rounded-md bg-slate-50 border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
                                            title="Mover item para cima"
                                          >
                                            <ChevronDown className="w-3 h-3 rotate-180" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void reorderItemInSubcategory(cat, subcategory, itemId, 'down')}
                                            disabled={itemIndex === -1 || itemIndex >= currentItemOrder.length - 1}
                                            className="p-1 rounded-md bg-slate-50 border border-slate-200 text-slate-400 hover:text-brand-primary disabled:opacity-30"
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
                                              formData[`item_override_check_${p.id}`] === 'on' ? 'bg-brand-secondary' : 'bg-slate-100'
                                            }`}>
                                              <div className={`absolute top-[1px] left-[1px] bg-white rounded-full h-2.5 w-2.5 transition-all ${
                                                formData[`item_override_check_${p.id}`] === 'on' ? 'translate-x-3' : ''
                                              }`} />
                                            </div>
                                            <span className="ml-1.5 text-[7px] font-black text-slate-400 group-hover/toggle:text-brand-secondary transition-colors uppercase tracking-widest">Manual</span>
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
                                              className="w-16 bg-purple-50/50 border border-purple-100 rounded-lg px-2 py-1 text-[10px] font-black text-right focus:ring-2 focus:ring-brand-secondary outline-none"
                                            />
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-4 text-right font-black text-brand-dark text-xs tracking-tighter">
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
                  
                  <div className="mt-6 pt-4 border-t border-slate-50">
                    <button 
                      type="button" 
                      onClick={() => addCustomPackage(cat)}
                      className="inline-flex items-center px-5 py-2.5 rounded-xl bg-brand-dark text-white text-[8px] font-black hover:bg-slate-800 transition-all group uppercase tracking-widest shadow-md"
                    >
                      <div className="w-5 h-5 bg-brand-primary/20 rounded-lg flex items-center justify-center mr-2 group-hover:scale-105 transition-transform">
                        <Plus className="w-3 h-3 text-brand-primary" />
                      </div>
                      Novo Pacote Personalizado
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
      <div className="bg-white border-2 border-brand-primary p-8 rounded-[2rem] shadow-xl mt-12">
        <div className="max-w-7xl mx-auto flex flex-col space-y-8">
          
          {/* Skill Breakdown Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 pb-6 border-b border-slate-50">
            {['Implantação', 'GP', 'Solution Design', 'Desenvolvimento', 'Design'].map(s => (
              <div key={s} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-300">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{s}</span>
                <span className="text-lg font-black text-brand-dark tracking-tighter">
                  {(totals.skillTotals[s] || 0).toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-8 flex-grow">
              {/* Subtotal */}
              <div className="space-y-1">
                <label className="block font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Subtotal Técnico</label>
                <div className="text-4xl font-black text-brand-dark font-heading tracking-tighter">{totals.subtotal.toFixed(1)}</div>
              </div>

              {/* GP */}
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-300 min-w-[140px]">
                <div className="flex justify-between items-center">
                  <label className="block font-black text-slate-500 text-[8px] uppercase tracking-widest">GP (%)</label>
                  <label className="flex items-center cursor-pointer group/toggle">
                    <input 
                      type="checkbox" 
                      checked={overrides.gp !== null}
                      onChange={(e) => setOverrides(o => ({ ...o, gp: e.target.checked ? totals.gpVal : null }))}
                      className="sr-only"
                    />
                    <div className={`w-7 h-3.5 rounded-full relative transition-all ${overrides.gp !== null ? 'bg-brand-secondary' : 'bg-slate-100'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-2.5 w-2.5 transition-all ${overrides.gp !== null ? 'translate-x-3.5' : ''}`} />
                    </div>
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 shadow-sm">
                    <input 
                      type="number" 
                      min="0"
                      value={percents.gp}
                      onChange={(e) => setPercents(p => ({ ...p, gp: Math.max(0, parseFloat(e.target.value) || 0) }))}
                      className="w-8 bg-transparent text-[10px] font-black outline-none text-center text-brand-dark"
                    />
                    <span className="text-brand-secondary text-[9px] font-black">%</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      const def = variables?.find((v:any) => v.key === 'GP_STANDARD' || v.key === 'GP_PERCENTAGE')?.value || 25;
                      setPercents(p => ({ ...p, gp: parseFloat(def) }));
                    }}
                    className="p-1 text-slate-300 hover:text-brand-primary transition-colors"
                    title="Resetar para padrão"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <span className="text-slate-200 font-black text-xs">→</span>
                  {overrides.gp === null ? (
                    <span className="text-sm font-black text-brand-dark tracking-tighter">{totals.gpVal.toFixed(1)}</span>
                  ) : (
                    <input 
                      type="number" 
                      min="0"
                      step="0.1"
                      value={overrides.gp}
                      onChange={(e) => setOverrides(o => ({ ...o, gp: Math.max(0, parseFloat(e.target.value) || 0) }))}
                      placeholder="0.0" 
                      className="w-16 bg-purple-50 border border-purple-100 rounded-lg px-2 py-1 text-[10px] font-black text-right outline-none text-brand-secondary"
                    />
                  )}
                </div>
              </div>

              {/* Discovery */}
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-300 min-w-[140px]">
                <div className="flex justify-between items-center">
                  <label className="block font-black text-slate-500 text-[8px] uppercase tracking-widest">Discovery</label>
                  <label className="flex items-center cursor-pointer group/toggle">
                    <input 
                      type="checkbox" 
                      checked={overrides.discovery !== null}
                      onChange={(e) => setOverrides(o => ({ ...o, discovery: e.target.checked ? totals.discVal : null }))}
                      className="sr-only"
                    />
                    <div className={`w-7 h-3.5 rounded-full relative transition-all ${overrides.discovery !== null ? 'bg-brand-secondary' : 'bg-slate-100'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-2.5 w-2.5 transition-all ${overrides.discovery !== null ? 'translate-x-3.5' : ''}`} />
                    </div>
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 shadow-sm">
                    <input 
                      type="number" 
                      min="0"
                      value={percents.discovery}
                      onChange={(e) => setPercents(p => ({ ...p, discovery: Math.max(0, parseFloat(e.target.value) || 0) }))}
                      className="w-8 bg-transparent text-[10px] font-black outline-none text-center text-brand-dark"
                    />
                    <span className="text-brand-secondary text-[9px] font-black">%</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setPercents(p => ({ ...p, discovery: 0 }))}
                    className="p-1 text-slate-300 hover:text-brand-primary transition-colors"
                    title="Resetar para padrão"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <span className="text-slate-200 font-black text-xs">→</span>
                  {overrides.discovery === null ? (
                    <span className="text-sm font-black text-brand-dark tracking-tighter">{totals.discVal.toFixed(1)}</span>
                  ) : (
                    <input 
                      type="number" 
                      min="0"
                      step="0.1"
                      value={overrides.discovery}
                      onChange={(e) => setOverrides(o => ({ ...o, discovery: Math.max(0, parseFloat(e.target.value) || 0) }))}
                      placeholder="0.0" 
                      className="w-16 bg-purple-50 border border-purple-100 rounded-lg px-2 py-1 text-[10px] font-black text-right outline-none text-brand-secondary"
                    />
                  )}
                </div>
              </div>

              {/* Validation */}
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-300 min-w-[140px]">
                <div className="flex justify-between items-center">
                  <label className="block font-black text-slate-500 text-[8px] uppercase tracking-widest">Validação</label>
                  <label className="flex items-center cursor-pointer group/toggle">
                    <input 
                      type="checkbox" 
                      checked={overrides.validation !== null}
                      onChange={(e) => setOverrides(o => ({ ...o, validation: e.target.checked ? totals.validVal : null }))}
                      className="sr-only"
                    />
                    <div className={`w-7 h-3.5 rounded-full relative transition-all ${overrides.validation !== null ? 'bg-brand-secondary' : 'bg-slate-100'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-2.5 w-2.5 transition-all ${overrides.validation !== null ? 'translate-x-3.5' : ''}`} />
                    </div>
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 shadow-sm">
                    <input 
                      type="number" 
                      min="0"
                      value={percents.validation}
                      onChange={(e) => setPercents(p => ({ ...p, validation: Math.max(0, parseFloat(e.target.value) || 0) }))}
                      className="w-8 bg-transparent text-[10px] font-black outline-none text-center text-brand-dark"
                    />
                    <span className="text-brand-secondary text-[9px] font-black">%</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setPercents(p => ({ ...p, validation: 0 }))}
                    className="p-1 text-slate-300 hover:text-brand-primary transition-colors"
                    title="Resetar para padrão"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <span className="text-slate-200 font-black text-xs">→</span>
                  {overrides.validation === null ? (
                    <span className="text-sm font-black text-brand-dark tracking-tighter">{totals.validVal.toFixed(1)}</span>
                  ) : (
                    <input 
                      type="number" 
                      min="0"
                      step="0.1"
                      value={overrides.validation}
                      onChange={(e) => setOverrides(o => ({ ...o, validation: Math.max(0, parseFloat(e.target.value) || 0) }))}
                      placeholder="0.0" 
                      className="w-16 bg-purple-50 border border-purple-100 rounded-lg px-2 py-1 text-[10px] font-black text-right outline-none text-brand-secondary"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Total Geral */}
            <div className="px-10 py-8 rounded-[2rem] shadow-2xl flex flex-col items-center lg:items-end justify-center min-w-[260px] border-b-8 border-brand-primary transition-transform hover:scale-[1.02] bg-white">
              <label className="block font-black text-brand-primary uppercase tracking-[0.3em] text-[10px] mb-2">Total Consolidado</label>
              <div className="flex items-baseline space-x-2">
                <span className="text-6xl font-black text-brand-primary font-heading tracking-tighter">{totals.grandTotal.toFixed(1)}</span>
                <span className="text-brand-primary text-[12px] font-black uppercase tracking-widest">Horas</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
