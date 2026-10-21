'use client';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import { useSession } from 'next-auth/react';
import {
  packageName, packageTooltip, categoryName as categoryLabelOf, skillName as skillLabelOf,
  variableLabel, packageHaystack, categoryHaystack, skillHaystack, variableHaystack, matchesQuery,
} from '@/lib/localized-names';
import { SEGMENTS, SEGMENT_LABEL_KEYS, DEFAULT_SEGMENT, normalizeSegment, canManageSegments as canManageSegmentsFor } from '@/lib/segments';
import { ZENDESK_PLANS, PLAN_LABEL, minPlanBadge, categoryMinPlanBadge } from '@/lib/zendesk-plans';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { 
  Plus, Download, History, Box, Settings, Users, Trash2, ExternalLink, Shield, 
  Loader2, UserCog, Mail, Calendar, ShieldCheck, ShieldAlert, RefreshCw, 
  ChevronRight, Search, Layout, Activity, Info, Check, X, Edit2, Calculator
} from 'lucide-react';
import { 
  createFrameworkSnapshotAction, 
  restoreFrameworkSnapshotAction, 
  deleteUserAction, 
  updateUserSegmentAction,
  updateSkillAction,
  addPackageAction,
  addCategoryAction,
  addSkillAction,
  deleteSkillAction,
  deleteCategoryAction,
  updateCategoryAction,
  setCategoryOrderAction,
  bulkMovePackagesAction,
  mergeCategoryAction,
  updatePackageAction,
  deletePackageAction,
  updateUserAdminStatusAction,
  createUserAction,
  importSpanishTranslationsAction,
} from './actions';
import { buildTranslationCsv, parseTranslationCsv, type TranslationRow } from '@/lib/translation-csv';
import { addVariableAction, deleteVariableAction, updateVariableAction } from './variable_actions';
import AEConfigAdmin from '@/components/AEConfigAdmin';

export default function AdminClient({ packages, categories, skills, variables, versions, users, activeAeConfig, aeConfigHistory }: any) {
  const { t } = useTranslation();
  const { language, dateLocale } = useLanguage();
  const { data: session } = useSession();
  // Somente administradores podem alterar segmentos (a verificação real é no servidor).
  const canManageSegments = canManageSegmentsFor(session?.user as any);
  const currentUserEmail = session?.user?.email || '';
  const [activeTab, setActiveTab] = useState('packages');
  const [activeLibraryTab, setActiveLibraryTab] = useState('items');
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingVariableId, setEditingVariableId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [editVariableValues, setEditVariableValues] = useState<any>({});
  const [filterSkill, setFilterSkill] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showAllConditional, setShowAllConditional] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryOrderIds, setCategoryOrderIds] = useState<number[]>(() => (categories || []).map((c: any) => c.id));
  const [dragCategoryId, setDragCategoryId] = useState<number | null>(null);
  const [categoryEditValues, setCategoryEditValues] = useState<any>({});
  const [bulkSelectedPackageIds, setBulkSelectedPackageIds] = useState<number[]>([]);
  const [bulkTargetCategoryName, setBulkTargetCategoryName] = useState('');
  const [mergeTargetCategoryName, setMergeTargetCategoryName] = useState('');

  // Form States for new items
  const [newItemName, setNewItemName] = useState('');
  const [newItemHours, setNewItemHours] = useState('');
  const [newItemSkill, setNewItemSkill] = useState('Implantação');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemNameEn, setNewItemNameEn] = useState('');
  const [newItemMinPlanCS, setNewItemMinPlanCS] = useState('');
  const [newItemMinPlanES, setNewItemMinPlanES] = useState('');
  const [newItemTooltip, setNewItemTooltip] = useState('');
  const [newItemTooltipEn, setNewItemTooltipEn] = useState('');
  const [newItemNameEs, setNewItemNameEs] = useState('');
  const [newItemTooltipEs, setNewItemTooltipEs] = useState('');
  const [newItemDependsOn, setNewItemDependsOn] = useState('');

  // Forms for new user creation
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>(DEFAULT_SEGMENT);

  const resetNewUserForm = () => {
    setNewUserEmail('');
    setNewUserName('');
    setNewUserPassword('');
    setNewUserRole(DEFAULT_SEGMENT);
  };

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg: any) => {
      // Busca sempre nos dois idiomas, independente do idioma exibido.
      const matchesSearch = matchesQuery(packageHaystack(pkg), searchQuery);
      const matchesSkill = !filterSkill || pkg.skillName === filterSkill;
      const matchesCategory = !filterCategory || pkg.categoryName === filterCategory;
      return matchesSearch && matchesSkill && matchesCategory;
    });
  }, [packages, searchQuery, filterSkill, filterCategory]);

  const handleStartEdit = (pkg: any) => {
    setEditingId(pkg.id);
    setEditValues({
      name: pkg.name,
      nameEn: pkg.nameEn || '',
      nameEs: pkg.nameEs || '',
      tooltipEs: pkg.tooltipEs || '',
      moduleLink: pkg.moduleLink || '',
      goLiveShortcutQty: Number(pkg.goLiveShortcutQty) || 0,
      minPlanCS: pkg.minPlanCS || '',
      minPlanES: pkg.minPlanES || '',
      hours: pkg.hours,
      skillName: pkg.skillName,
      categoryName: pkg.categoryName,
      tooltip: pkg.tooltip || '',
      tooltipEn: pkg.tooltipEn || '',
      dependsOnItemId: pkg.dependsOnItemId || '',
      excludedFromVariables: JSON.parse(pkg.excludedFromVariables || '[]')
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    startTransition(async () => {
      const result = await updatePackageAction(editingId, editValues);
      if (result?.success) {
        setEditingId(null);
      } else if (result?.error) {
        alert(result.error);
      }
    });
  };

  const handleStartEditVariable = (v: any) => {
    setEditingVariableId(v.id);
    setEditVariableValues({
      key: v.key,
      label: v.label || '',
      labelEn: v.labelEn || '',
      labelEs: v.labelEs || '',
      value: v.value,
      category: v.category,
      type: v.type,
      flatValue: v.flatValue || 0,
    });
  };

  const handleSaveEditVariable = async () => {
    if (!editingVariableId) return;
    startTransition(async () => {
      await updateVariableAction(editingVariableId, editVariableValues);
      setEditingVariableId(null);
    });
  };

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', newItemName);
    formData.append('nameEn', newItemNameEn);
    formData.append('nameEs', newItemNameEs);
    formData.append('minPlanCS', newItemMinPlanCS);
    formData.append('minPlanES', newItemMinPlanES);
    formData.append('hours', newItemHours);
    formData.append('skillName', newItemSkill);
    formData.append('categoryName', newItemCategory);
    formData.append('tooltip', newItemTooltip);
    formData.append('tooltipEn', newItemTooltipEn);
    formData.append('tooltipEs', newItemTooltipEs);
    formData.append('dependsOnItemId', newItemDependsOn);

    startTransition(async () => {
      await addPackageAction(formData);
      setNewItemName('');
      setNewItemNameEn('');
      setNewItemMinPlanCS('');
      setNewItemMinPlanES('');
      setNewItemHours('');
      setNewItemTooltip('');
      setNewItemTooltipEn('');
      setNewItemNameEs('');
      setNewItemTooltipEs('');
      setNewItemDependsOn('');
    });
  };

  const handleAddCategory = () => {
    const name = prompt(t('admin.promptNewCategory'));
    if (!name) return;
    const nameEn = prompt(t('admin.promptNewCategoryEn')) || '';
    // A porteira de plano nasce vazia (= sem restrição) e é ajustada no editor
    // ao lado — evita empilhar mais um prompt() na criação.
    startTransition(() => addCategoryAction(name, nameEn, '', ''));
  };

  const handleAddSkill = () => {
    const name = prompt(t('admin.promptNewSkill'));
    if (!name) return;
    const nameEn = prompt(t('admin.promptNewSkillEn')) || '';
    startTransition(() => addSkillAction(name, nameEn));
  };

  useEffect(() => {
    const next = (categories || []).map((c: any) => c.id);
    setCategoryOrderIds(next);
  }, [categories]);

  const orderedCategories = useMemo(() => {
    const byId = new Map((categories || []).map((c: any) => [c.id, c]));
    const ordered = categoryOrderIds.map((id) => byId.get(id)).filter(Boolean);
    const missing = (categories || []).filter((c: any) => !categoryOrderIds.includes(c.id));
    return [...ordered, ...missing];
  }, [categories, categoryOrderIds]);

  /**
   * A categoria editada herda a fase de Implantação da raiz só quando o pai
   * dela está ATIVO. Com pai inativo (ou inexistente) o framework a trata como
   * raiz e usa a fase dela mesma — então o campo precisa ficar editável.
   */
  const hasActiveParent = Boolean(categoryEditValues.parentName)
    && (categories || []).some((c: any) => c.name === categoryEditValues.parentName);

  /** Baixa a planilha com os nomes da biblioteca (PT / EN / ES) para tradução. */
  const handleExportTranslations = () => {
    const rows: TranslationRow[] = [
      ...(packages || []).map((p: any) => ({
        type: 'item' as const, id: p.id, category: p.categoryName || '',
        namePt: p.name || '', nameEn: p.nameEn || '', nameEs: p.nameEs || '',
        tooltipPt: p.tooltip || '', tooltipEn: p.tooltipEn || '', tooltipEs: p.tooltipEs || '',
      })),
      ...(categories || []).map((c: any) => ({
        type: 'categoria' as const, id: c.id, category: c.parentName || '',
        namePt: c.displayName || c.name || '', nameEn: c.displayNameEn || '', nameEs: c.displayNameEs || '',
        tooltipPt: '', tooltipEn: '', tooltipEs: '',
      })),
      ...(skills || []).map((s: any) => ({
        type: 'skill' as const, id: s.id, category: '',
        namePt: s.name || '', nameEn: s.nameEn || '', nameEs: s.nameEs || '',
        tooltipPt: '', tooltipEn: '', tooltipEs: '',
      })),
    ];
    const blob = new Blob([buildTranslationCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `traducoes-biblioteca-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /** Lê a planilha traduzida e grava os nomes/tooltips em espanhol (não apaga nada). */
  const handleImportTranslations = async (file: File) => {
    const { rows, error } = parseTranslationCsv(await file.text());
    if (error || !rows.length) {
      alert(t('admin.importTranslationsInvalid'));
      return;
    }
    const withSpanish = rows.filter((r) => r.nameEs || r.tooltipEs);
    if (!confirm(t('admin.importTranslationsConfirm', { count: withSpanish.length }))) return;
    startTransition(async () => {
      try {
        const result = await importSpanishTranslationsAction(
          withSpanish.map((r) => ({ type: r.type, id: r.id, nameEs: r.nameEs, tooltipEs: r.tooltipEs })),
        );
        alert(t('admin.importTranslationsDone', { updated: result.updated, missing: result.notFound.length }));
      } catch (e: any) {
        alert(`${t('admin.importTranslationsFailed')}\n\n${e?.message || String(e)}`);
      }
    });
  };

  /** Fase de Implantação da categoria raiz de uma categoria (subcategorias herdam). */
  const rootPhaseOf = (categoryName: string): string => {
    let cat = (categories || []).find((c: any) => c.name === categoryName);
    const seen = new Set<string>();
    while (cat?.parentName && !seen.has(cat.name)) {
      seen.add(cat.name);
      const parent = (categories || []).find((c: any) => c.name === cat.parentName);
      if (!parent) break;
      cat = parent;
    }
    return String(cat?.implementationPhase || 'SETUP');
  };

  /** Módulos que um item de Workshop/Treinamento pode servir: categorias raiz de fase Setup. */
  const shortcutModuleOptions = (categories || []).filter(
    (c: any) => !c.parentName && String(c.implementationPhase || 'SETUP') === 'SETUP',
  );

  const selectedCategory = useMemo(() => {
    return (categories || []).find((c: any) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  const packagesInSelectedCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return (packages || []).filter((p: any) => p.categoryName === selectedCategory.name);
  }, [packages, selectedCategory]);

  useEffect(() => {
    if (!selectedCategory) return;
    setCategoryEditValues({
      displayName: selectedCategory.displayName || '',
      displayNameEn: selectedCategory.displayNameEn || '',
      displayNameEs: selectedCategory.displayNameEs || '',
      parentName: selectedCategory.parentName || '',
      minPlanCS: selectedCategory.minPlanCS || '',
      minPlanES: selectedCategory.minPlanES || '',
      implementationPhase: selectedCategory.implementationPhase || 'SETUP'
    });
    setBulkSelectedPackageIds([]);
    setBulkTargetCategoryName('');
    setMergeTargetCategoryName('');
  }, [selectedCategoryId]);

  const handleDropCategory = (targetId: number) => {
    if (!dragCategoryId || dragCategoryId === targetId) return;

    const fromIndex = categoryOrderIds.indexOf(dragCategoryId);
    const toIndex = categoryOrderIds.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...categoryOrderIds];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, dragCategoryId);
    setCategoryOrderIds(next);
    setDragCategoryId(null);

    startTransition(async () => {
      await setCategoryOrderAction(next);
    });
  };

  const toggleBulkPackage = (id: number) => {
    setBulkSelectedPackageIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAllBulkPackages = () => {
    setBulkSelectedPackageIds(packagesInSelectedCategory.map((p: any) => p.id));
  };

  const clearBulkPackages = () => {
    setBulkSelectedPackageIds([]);
  };

  const handleCreateSnapshot = async () => {
    const name = prompt(t('admin.promptSnapshotName'), t('admin.snapshotDefaultName') + ' ' + new Date().toLocaleDateString(dateLocale));
    if (!name) return;

    startTransition(async () => {
      try {
        await createFrameworkSnapshotAction(name);
        alert(t('admin.snapshotCreated'));
      } catch (e) {
        alert(t('admin.snapshotError'));
      }
    });
  };

  const handleRestore = (id: number, name: string) => {
    if (confirm(t('admin.confirmRestoreSnapshot', { name }))) {
      startTransition(async () => {
        await restoreFrameworkSnapshotAction(id);
      });
    }
  };

  const handleDeletePackage = (id: number, name: string) => {
    if (confirm(t('admin.confirmRemovePackage', { name }))) {
      startTransition(async () => {
        await deletePackageAction(id);
      });
    }
  };

  const handleDeleteVariable = (id: number, key: string) => {
    if (confirm(t('admin.confirmRemoveVariable', { key }))) {
      startTransition(async () => {
        await deleteVariableAction(id);
      });
    }
  };

  const handleDeleteUser = (id: number, email: string) => {
    if (confirm(t('admin.confirmDeleteUser', { email }))) {
      startTransition(async () => {
        await deleteUserAction(id);
      });
    }
  };

  const handleUpdateSegment = async (user: any, segment: string) => {
    const current = normalizeSegment(user.role);
    if (current === segment) return;

    // Aviso extra ao sair do segmento ADMIN sendo o próprio usuário logado.
    if (current === 'ADMIN' && segment !== 'ADMIN' && user.email === currentUserEmail) {
      if (!confirm(t('segment.selfDemotionWarning'))) return;
    }

    startTransition(async () => {
      const result = await updateUserSegmentAction(user.id, segment);
      if (result && result.success === false && result.error) alert(result.error);
    });
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-brand-dark font-heading text-page ">{t('admin.title')}</h1>
          <p className="text-slate-400 text-label mt-2 font-medium ">{t('admin.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={handleCreateSnapshot}
            disabled={isPending}
            className="flex-1 md:flex-none brand-bg-primary text-brand-ink px-8 py-4 rounded-2xl font-medium hover:opacity-90 shadow-xl btn-premium transition-all flex items-center justify-center space-x-3 text-label disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{t('admin.newSnapshot')}</span>
          </button>
          <button className="flex-1 md:flex-none bg-brand-dark text-[color:var(--bg-main)] px-8 py-4 rounded-2xl font-medium hover:opacity-90 transition-all flex items-center justify-center space-x-3 text-label shadow-xl">
            <Download className="w-4 h-4" />
            <span>{t('admin.exportData')}</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-50/50 p-2 rounded-3xl border border-slate-300 w-fit mx-auto md:mx-0 shadow-sm">
        <nav className="flex space-x-1">
          {[
            { id: 'versions', label: t('admin.tabVersions'), icon: History },
            { id: 'packages', label: t('admin.tabLibrary'), icon: Box },
            { id: 'variables', label: t('admin.tabVariables'), icon: Settings },
            { id: 'users', label: t('admin.tabUsers'), icon: Users },
            { id: 'aeCalculator', label: t('admin.tabAeCalculator'), icon: Calculator },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-8 py-3.5 rounded-3xl text-label font-medium transition-all duration-500 flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'brand-bg-primary text-brand-ink shadow-xl'
                  : 'text-slate-400 hover:bg-white hover:text-brand-dark'
              }`}
            >
              <tab.icon className="w-3 h-3" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="tab-content">
        {/* Sempre montado (só escondido): trocar de aba não descarta o rascunho
            da configuração que ainda não foi salvo. */}
        <div className={activeTab === 'aeCalculator' ? '' : 'hidden'}>
          <AEConfigAdmin activeAeConfig={activeAeConfig} aeConfigHistory={aeConfigHistory} />
        </div>

        {activeTab === 'versions' && (
          <div className="bg-white rounded-3xl border border-slate-50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="px-12 py-8 bg-slate-50/30 border-b border-slate-50 flex items-center space-x-4">
              <div className="w-10 h-10 brand-bg-primary rounded-2xl flex items-center justify-center text-brand-ink shadow-lg">
                <History className="w-5 h-5" />
              </div>
              <h2 className="text-brand-dark text-title font-bold">{t('admin.snapshotHistory')}</h2>
            </div>
            <ul className="divide-y divide-slate-50">
              {versions.map((version: any) => (
                <li key={version.id} className="px-12 py-8 hover:bg-slate-50/50 transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="text-base font-bold text-brand-dark group-hover:text-brand-primary transition-all tracking-tight">
                        {version.versionName}
                      </div>
                      <div className="flex items-center text-label font-medium text-slate-400 ">
                        <span className="bg-brand-dark text-[color:var(--bg-main)] px-3 py-1 rounded-lg mr-4">{version.type}</span>
                        <span>{new Date(version.createdAt).toLocaleString(dateLocale)}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRestore(version.id, version.versionName)}
                      className="bg-white text-brand-primary px-6 py-2.5 rounded-2xl text-label font-medium border border-slate-100 hover:bg-brand-primary hover:text-brand-ink transition-all shadow-sm"
                    >
                      {t('admin.restore')}
                    </button>
                  </div>
                </li>
              ))}
              {versions.length === 0 && (
                <li className="px-12 py-24 text-center">
                  <p className="text-slate-400 text-label font-medium italic">{t('admin.noRecords')}</p>
                </li>
              )}
            </ul>
          </div>
        )}

        {activeTab === 'packages' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Sub-abas da Biblioteca */}
            <div className="flex items-center space-x-4 border-b border-slate-200">
              {[
                { id: 'items', label: t('admin.subTabItems'), icon: Box },
                { id: 'categories', label: t('admin.subTabCategories'), icon: Layout },
                { id: 'skills', label: t('admin.subTabSkills'), icon: Activity },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveLibraryTab(sub.id)}
                  className={`px-6 py-4 text-label font-medium transition-all relative ${
                    activeLibraryTab === sub.id ? 'text-brand-primary' : 'text-slate-400 hover:text-brand-dark'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <sub.icon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </div>
                  {activeLibraryTab === sub.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 brand-bg-primary rounded-t-full" />
                  )}
                </button>
              ))}
              {/* Planilha de traduções: exporta os nomes da biblioteca e importa
                  de volta os nomes/tooltips em espanhol. */}
              <div className="ml-auto flex items-center gap-2 pb-2">
                <button
                  type="button"
                  onClick={handleExportTranslations}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-caption font-medium text-slate-500 hover:border-brand-primary hover:text-brand-primary transition-all flex items-center gap-2"
                  title={t('admin.exportTranslationsHint')}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t('admin.exportTranslations')}
                </button>
                <label
                  className="px-4 py-2 rounded-xl border border-slate-200 text-caption font-medium text-slate-500 hover:border-brand-primary hover:text-brand-primary transition-all flex items-center gap-2 cursor-pointer"
                  title={t('admin.importTranslationsHint')}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t('admin.importTranslations')}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void handleImportTranslations(file);
                    }}
                  />
                </label>
              </div>
            </div>

            {activeLibraryTab === 'items' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-slate-50 shadow-2xl h-fit sticky top-24">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-8 h-8 brand-bg-primary rounded-xl flex items-center justify-center text-brand-ink shadow-lg">
                      <Plus className="w-4 h-4" />
                    </div>
                    <h3 className="text-brand-dark text-title font-bold">{t('admin.newItem')}</h3>
                  </div>
                  <form onSubmit={handleAddPackage} className="space-y-4">
                    <div>
                      <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('admin.namePt')}</label>
                      <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder={t('admin.namePtPlaceholder')} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-3 text-label font-bold focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none transition-all" required />
                    </div>
                    <div>
                      <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('admin.nameEn')}</label>
                      <input type="text" value={newItemNameEn} onChange={(e) => setNewItemNameEn(e.target.value)} placeholder={t('admin.nameEnPlaceholder')} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-3 text-label font-bold focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('admin.nameEs')}</label>
                      <input type="text" value={newItemNameEs} onChange={(e) => setNewItemNameEs(e.target.value)} placeholder={t('admin.nameEsPlaceholder')} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-3 text-label font-bold focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('common.hours')}</label>
                        <input type="number" step="0.01" min="0" value={newItemHours} onChange={(e) => setNewItemHours(e.target.value)} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-3 text-label font-medium focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none transition-all text-center" required />
                      </div>
                      <div>
                        <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('admin.skill')}</label>
                        <select value={newItemSkill} onChange={(e) => setNewItemSkill(e.target.value)} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-3 text-caption font-medium focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none transition-all appearance-none cursor-pointer ">
                          {skills.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('common.category')}</label>
                      <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-3 text-caption font-medium focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none transition-all appearance-none cursor-pointer " required>
                        <option value="">{t('common.select')}</option>
                        {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('admin.dependsOn')}</label>
                      <select value={newItemDependsOn} onChange={(e) => setNewItemDependsOn(e.target.value)} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-3 text-caption font-medium focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none transition-all appearance-none cursor-pointer ">
                        <option value="">{t('common.none')}</option>
                        {packages.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('plans.minPlanCS')}</label>
                        <select value={newItemMinPlanCS} onChange={(e) => setNewItemMinPlanCS(e.target.value)} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-3 py-3 text-label font-medium tracking-tight outline-none focus:ring-2 focus:ring-brand-primary transition-all">
                          <option value="">{t('plans.noRestriction')}</option>
                          {ZENDESK_PLANS.map((plan) => (
                            <option key={plan} value={plan}>{PLAN_LABEL[plan]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('plans.minPlanES')}</label>
                        <select value={newItemMinPlanES} onChange={(e) => setNewItemMinPlanES(e.target.value)} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-3 py-3 text-label font-medium tracking-tight outline-none focus:ring-2 focus:ring-brand-primary transition-all">
                          <option value="">{t('plans.noRestriction')}</option>
                          {ZENDESK_PLANS.map((plan) => (
                            <option key={plan} value={plan}>{PLAN_LABEL[plan]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('admin.tooltipPt')}</label>
                      <textarea value={newItemTooltip} onChange={(e) => setNewItemTooltip(e.target.value)} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-3 text-label font-medium focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none transition-all h-20 resize-none" />
                    </div>
                    <div>
                      <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('admin.tooltipEn')}</label>
                      <textarea value={newItemTooltipEn} onChange={(e) => setNewItemTooltipEn(e.target.value)} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-3 text-label font-medium focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none transition-all h-20 resize-none" />
                    </div>
                    <div>
                      <label className="block text-caption font-medium text-slate-400 ml-1 mb-2">{t('admin.tooltipEs')}</label>
                      <textarea value={newItemTooltipEs} onChange={(e) => setNewItemTooltipEs(e.target.value)} className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-xl px-4 py-3 text-label font-medium focus:ring-2 focus:ring-brand-primary dark:focus:bg-[color:var(--bg-card)] outline-none transition-all h-20 resize-none" />
                    </div>
                    <button type="submit" disabled={isPending} className="w-full brand-bg-primary text-brand-ink py-4 rounded-xl font-medium hover:opacity-90 shadow-xl text-label disabled:opacity-50">
                      {isPending ? t('common.processing') : t('admin.addItem')}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-3 space-y-6">
                  {/* Categorias como Abas Superiores */}
                  <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-1 overflow-x-auto">
                    <button
                      onClick={() => setFilterCategory('')}
                      className={`px-6 py-2.5 rounded-xl text-label font-medium transition-all ${
                        filterCategory === '' ? 'brand-bg-primary text-brand-ink shadow-md' : 'text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {t('common.all')}
                    </button>
                    {categories.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => setFilterCategory(c.name)}
                        className={`px-6 py-2.5 rounded-xl text-label font-medium transition-all ${
                          filterCategory === c.name ? 'brand-bg-primary text-brand-ink shadow-md' : 'text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  {/* Filtros e Busca */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('admin.searchAllLanguages')} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-label font-bold outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                      />
                    </div>
                    <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-label font-medium outline-none">
                      <option value="">{t('admin.allSkills')}</option>
                      {skills.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <button 
                      onClick={() => setShowAllConditional(!showAllConditional)}
                      className={`px-4 py-3 rounded-xl text-label font-medium transition-all border ${
                        showAllConditional ? 'bg-brand-primary text-brand-ink border-brand-primary' : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      Ignorar Condicionais: {showAllConditional ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Tabela com Edição Inline */}
                  <div className="bg-white dark:bg-[color:var(--bg-card)] dark:border-[color:var(--border-main)] rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
                    <table className="min-w-full">
                      <thead className="bg-slate-50/50 dark:bg-[color:var(--bg-input-solid)] border-b border-slate-100 dark:border-[color:var(--border-main)]">
                        <tr>
                          <th className="px-8 py-5 text-left text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{t('common.item')}</th>
                          <th className="px-8 py-5 text-center text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] w-24">{t('common.hours')}</th>
                          <th className="px-8 py-5 text-left text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{t('common.organization')}</th>
                          <th className="px-8 py-5 text-right text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-[color:var(--border-main)]">
                        {filteredPackages.map((pkg: any) => (
                          <tr key={pkg.id} className={`hover:bg-slate-50/30 dark:hover:bg-[color:var(--bg-input-solid)] transition-all group ${editingId === pkg.id ? 'bg-brand-primary/5 dark:bg-brand-primary/10' : ''}`}>
                            <td className="px-8 py-6">
                              {editingId === pkg.id ? (
                                <div className="space-y-2">
                                  <input 
                                    type="text" 
                                    value={editValues.name} 
                                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                    className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-brand-primary/30 rounded-lg px-3 py-1.5 text-label font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                                  />
                                  <input 
                                    type="text" 
                                    placeholder={t('admin.nameEnPlaceholder')}
                                    value={editValues.nameEn || ''} 
                                    onChange={(e) => setEditValues({ ...editValues, nameEn: e.target.value })}
                                    className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-3 py-1.5 text-label font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                                  />
                                  <input
                                    type="text"
                                    placeholder={t('admin.nameEsPlaceholder')}
                                    value={editValues.nameEs || ''}
                                    onChange={(e) => setEditValues({ ...editValues, nameEs: e.target.value })}
                                    className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-3 py-1.5 text-label font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                                  />
                                  <input
                                    type="text"
                                    placeholder={t('admin.tooltipPt')}
                                    value={editValues.tooltip}
                                    onChange={(e) => setEditValues({ ...editValues, tooltip: e.target.value })}
                                    className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-3 py-1 text-label outline-none transition-all"
                                  />
                                  <input 
                                    type="text" 
                                    placeholder={t('admin.tooltipEn')}
                                    value={editValues.tooltipEn || ''}
                                    onChange={(e) => setEditValues({ ...editValues, tooltipEn: e.target.value })}
                                    className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-3 py-1 text-label outline-none transition-all"
                                  />
                                  <input
                                    type="text"
                                    placeholder={t('admin.tooltipEs')}
                                    value={editValues.tooltipEs || ''}
                                    onChange={(e) => setEditValues({ ...editValues, tooltipEs: e.target.value })}
                                    className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-3 py-1 text-label outline-none transition-all"
                                  />
                                  <div className="grid grid-cols-2 gap-2 pt-1">
                                    <select
                                      value={editValues.minPlanCS || ''}
                                      onChange={(e) => setEditValues({ ...editValues, minPlanCS: e.target.value })}
                                      title={t('plans.minPlanCS')}
                                      className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-2 py-1 text-caption font-medium outline-none"
                                    >
                                      <option value="">CS · {t('plans.noRestriction')}</option>
                                      {ZENDESK_PLANS.map((plan) => (
                                        <option key={plan} value={plan}>CS · {PLAN_LABEL[plan]}</option>
                                      ))}
                                    </select>
                                    <select
                                      value={editValues.minPlanES || ''}
                                      onChange={(e) => setEditValues({ ...editValues, minPlanES: e.target.value })}
                                      title={t('plans.minPlanES')}
                                      className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-slate-200 rounded-lg px-2 py-1 text-caption font-medium outline-none"
                                    >
                                      <option value="">ES · {t('plans.noRestriction')}</option>
                                      {ZENDESK_PLANS.map((plan) => (
                                        <option key={plan} value={plan}>ES · {PLAN_LABEL[plan]}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <div className="text-body font-bold text-brand-dark dark:text-[color:var(--text-main)] tracking-tight">{packageName(pkg, language)}</div>
                                  {minPlanBadge(pkg, 'CS') && (
                                    <span title={t('plans.minPlanCS')} className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-brand-dark border border-slate-200 text-caption font-medium ">
                                      CS {minPlanBadge(pkg, 'CS')}
                                    </span>
                                  )}
                                  {minPlanBadge(pkg, 'ES') && (
                                    <span title={t('plans.minPlanES')} className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-brand-dark border border-slate-200 text-caption font-medium ">
                                      ES {minPlanBadge(pkg, 'ES')}
                                    </span>
                                  )}
                                  {(!String(pkg.nameEn || '').trim() || !String(pkg.nameEs || '').trim()) && (
                                    <span title={t('admin.missingTranslationHint')} className="shrink-0 px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 text-caption font-medium ">
                                      {t('admin.missingTranslationLangs', {
                                        langs: [!String(pkg.nameEn || '').trim() && 'EN', !String(pkg.nameEs || '').trim() && 'ES'].filter(Boolean).join(', '),
                                      })}
                                    </span>
                                  )}
                                  {packageTooltip(pkg, language) && (
                                    <div className="group/tooltip relative cursor-help">
                                      <Info className="w-3 h-3 text-slate-300 hover:text-brand-primary transition-colors" />
                                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-brand-dark dark:bg-[color:var(--bg-input-solid)] text-[color:var(--bg-main)] dark:text-[color:var(--text-main)] dark:border dark:border-[color:var(--border-main)] text-caption font-bold p-3 rounded-xl w-48 shadow-2xl opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50">
                                        {packageTooltip(pkg, language)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-8 py-6 text-center">
                              {editingId === pkg.id ? (
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={editValues.hours} 
                                  onChange={(e) => setEditValues({ ...editValues, hours: e.target.value })}
                                  className="w-16 bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-brand-primary/30 rounded-lg px-2 py-1.5 text-label font-medium text-center outline-none transition-all"
                                />
                              ) : (
                                <span className="bg-brand-dark dark:bg-[color:var(--bg-input-solid)] dark:border dark:border-[color:var(--border-main)] text-[color:var(--bg-main)] dark:text-[color:var(--text-main)] px-3 py-1 rounded-lg text-label font-medium ">{pkg.hours}H</span>
                              )}
                            </td>
                            <td className="px-8 py-6">
                              {editingId === pkg.id ? (
                                <div className="space-y-2">
                                  <select 
                                    value={editValues.categoryName} 
                                    onChange={(e) => setEditValues({ ...editValues, categoryName: e.target.value })}
                                    className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-brand-primary/30 rounded-lg px-2 py-1 text-caption font-medium "
                                  >
                                    {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                                  </select>
                                  <select 
                                    value={editValues.skillName} 
                                    onChange={(e) => setEditValues({ ...editValues, skillName: e.target.value })}
                                    className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-brand-primary/30 rounded-lg px-2 py-1 text-caption font-medium "
                                  >
                                    {skills.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                                  </select>
                                  <select 
                                    value={editValues.dependsOnItemId} 
                                    onChange={(e) => setEditValues({ ...editValues, dependsOnItemId: e.target.value })}
                                    className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-brand-primary/30 rounded-lg px-2 py-1 text-caption font-medium "
                                  >
                                    <option value="">{t('admin.noDependency')}</option>
                                    {packages.filter((p: any) => p.id !== pkg.id).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                  
                                  <div className="space-y-1.5 pt-1">
                                    <label className="block text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ml-1">{t('admin.excludeFromPct')}</label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {variables.filter((v: any) => v.type === 'PERCENT' || v.type === 'MIXED').map((v: any) => (
                                        <button
                                          key={v.key}
                                          type="button"
                                          onClick={() => {
                                            const current = editValues.excludedFromVariables || [];
                                            const next = current.includes(v.key) 
                                              ? current.filter((k: string) => k !== v.key)
                                              : [...current, v.key];
                                            setEditValues({ ...editValues, excludedFromVariables: next });
                                          }}
                                          className={`px-2 py-0.5 rounded text-caption font-medium transition-all border ${
                                            (editValues.excludedFromVariables || []).includes(v.key)
                                              ? 'bg-red-50 dark:bg-[#3b1414] text-red-500 dark:text-[#ff7676] border-red-200 dark:border-[#5a1e1e]'
                                              : 'bg-slate-50 dark:bg-[color:var(--bg-input-solid)] text-slate-400 dark:text-[color:var(--text-muted)] border-slate-200 dark:border-[color:var(--border-main)] hover:border-slate-300'
                                          }`}
                                        >
                                          {v.key.replace('_STANDARD', '')}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Atalhos do framework: o campo depende da fase da categoria do item. */}
                                  {(() => {
                                    const phase = rootPhaseOf(editValues.categoryName);
                                    if (phase === 'WORKSHOP' || phase === 'TRAINING') {
                                      return (
                                        <div className="space-y-1 pt-1">
                                          <label className="block text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ml-1">{t('admin.shortcutModule')}</label>
                                          <select
                                            value={editValues.moduleLink || ''}
                                            onChange={(e) => setEditValues({ ...editValues, moduleLink: e.target.value })}
                                            className="w-full bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-brand-primary/30 rounded-lg px-2 py-1 text-caption font-medium "
                                          >
                                            <option value="">{t('admin.shortcutModuleNone')}</option>
                                            {shortcutModuleOptions.map((c: any) => (
                                              <option key={c.id} value={c.name}>{categoryLabelOf(c, language)}</option>
                                            ))}
                                          </select>
                                        </div>
                                      );
                                    }
                                    if (phase === 'GOLIVE') {
                                      return (
                                        <div className="space-y-1 pt-1">
                                          <label className="block text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ml-1">{t('admin.shortcutGoLiveQty')}</label>
                                          <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={editValues.goLiveShortcutQty ?? 0}
                                            onChange={(e) => setEditValues({ ...editValues, goLiveShortcutQty: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                                            className="w-24 bg-white dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] dark:border-[color:var(--border-main)] border border-brand-primary/30 rounded-lg px-2 py-1 text-caption font-medium text-center"
                                          />
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}

                                </div>
                              ) : (
                                <div className="flex flex-col space-y-1">
                                  <span className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] ">{pkg.categoryName}</span>
                                  <span className="text-caption bg-slate-100 dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] text-slate-500 px-2 py-0.5 rounded-md font-medium w-fit">{pkg.skillName}</span>
                                  {pkg.moduleLink && ['WORKSHOP', 'TRAINING'].includes(rootPhaseOf(pkg.categoryName)) && (
                                    <span className="text-caption bg-brand-primary/10 text-brand-dark dark:text-[color:var(--text-main)] px-2 py-0.5 rounded-md font-medium w-fit">
                                      {t('admin.shortcutModuleBadge', { module: categoryLabelOf(categories.find((c: any) => c.name === pkg.moduleLink) || { name: pkg.moduleLink }, language) })}
                                    </span>
                                  )}
                                  {Number(pkg.goLiveShortcutQty) > 0 && rootPhaseOf(pkg.categoryName) === 'GOLIVE' && (
                                    <span className="text-caption bg-brand-primary/10 text-brand-dark dark:text-[color:var(--text-main)] px-2 py-0.5 rounded-md font-medium w-fit">
                                      {t('admin.shortcutGoLiveBadge', { qty: pkg.goLiveShortcutQty })}
                                    </span>
                                  )}
                                  {pkg.dependsOnItemId && (
                                    <span className="text-caption bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-medium w-fit flex items-center gap-1">
                                      <Settings className="w-3.5 h-3.5" />
                                      DEP: {packages.find((p: any) => p.id === pkg.dependsOnItemId)?.name}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-8 py-6 text-right">
                              {editingId === pkg.id ? (
                                <div className="flex items-center justify-end space-x-2">
                                  <button onClick={handleSaveEdit} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"><Check className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => setEditingId(null)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                                  <button onClick={() => handleStartEdit(pkg)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-brand-primary transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleDeletePackage(pkg.id, pkg.name)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeLibraryTab === 'categories' && (
              <div className="bg-white rounded-3xl border border-slate-50 shadow-2xl p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold text-brand-dark tracking-tight">{t('admin.categoryManagement')}</h3>
                  <button onClick={handleAddCategory} className="bg-brand-primary text-brand-ink px-6 py-3 rounded-xl text-label font-medium hover:opacity-90 transition-all flex items-center space-x-2 shadow-lg">
                    <Plus className="w-4 h-4" />
                    <span>{t('admin.newCategory')}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-4">
                    <div className="text-caption font-medium text-slate-400 ">{t('admin.defaultOrderDrag')}</div>
                    <div className="space-y-2">
                      {orderedCategories.map((c: any) => (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={() => setDragCategoryId(c.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropCategory(c.id)}
                          onClick={() => setSelectedCategoryId(c.id)}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            selectedCategoryId === c.id
                              ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                              : 'bg-slate-50 border-slate-100 hover:border-brand-primary'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="text-label font-medium tracking-tight truncate">{categoryLabelOf(c, language)}</div>
                              <div className="text-caption font-medium text-slate-400 truncate">
                                {c.name}{c.parentName ? ` → ${(categories.find((x: any) => x.name === c.parentName)?.displayName || c.parentName)}` : ''}
                              </div>
                              {(categoryMinPlanBadge(c, 'CS') || categoryMinPlanBadge(c, 'ES')) && (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  {categoryMinPlanBadge(c, 'CS') && (
                                    <span title={t('plans.categoryMinPlanCS')} className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-brand-dark border border-slate-200 text-caption font-medium ">
                                      CS {categoryMinPlanBadge(c, 'CS')}
                                    </span>
                                  )}
                                  {categoryMinPlanBadge(c, 'ES') && (
                                    <span title={t('plans.categoryMinPlanES')} className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-brand-dark border border-slate-200 text-caption font-medium ">
                                      ES {categoryMinPlanBadge(c, 'ES')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    {!selectedCategory ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-3xl p-10 text-center">
                        <div className="text-label font-medium text-slate-400">
                          {t('admin.selectCategoryToEdit')}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-xl space-y-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="space-y-1">
                            <div className="text-label font-medium text-slate-400">{t('common.category')}</div>
                            <div className="text-xl font-bold text-brand-dark tracking-tight">{categoryLabelOf(selectedCategory, language)}</div>
                            <div className="text-caption font-medium text-slate-300">{selectedCategory.name}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                startTransition(async () => {
                                  await updateCategoryAction(selectedCategory.id, categoryEditValues);
                                });
                              }}
                              className="bg-brand-primary text-brand-ink px-6 py-3 rounded-xl text-label font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-lg"
                              disabled={isPending}
                            >
                              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              <span>{t('common.save')}</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(t('admin.confirmDeactivateCategory', { name: selectedCategory.displayName || selectedCategory.name }))) {
                                  startTransition(async () => {
                                    const result = await deleteCategoryAction(selectedCategory.id);
                                    if (result && result.success === false && result.error) alert(result.error);
                                  });
                                }
                              }}
                              className="bg-red-50 text-red-600 border border-red-100 px-6 py-3 rounded-xl text-label font-medium hover:bg-red-100 transition-all flex items-center gap-2"
                              disabled={isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>{t('admin.deactivate')}</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="block text-caption font-medium text-slate-400 ml-1">{t('admin.displayNamePt')}</label>
                            <input
                              type="text"
                              value={categoryEditValues.displayName || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, displayName: e.target.value })}
                              placeholder={selectedCategory.name}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-caption font-medium text-slate-400 ml-1">{t('admin.displayNameEn')}</label>
                            <input
                              type="text"
                              value={categoryEditValues.displayNameEn || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, displayNameEn: e.target.value })}
                              placeholder={t('admin.nameEnPlaceholder')}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-caption font-medium text-slate-400 ml-1">{t('admin.displayNameEs')}</label>
                            <input
                              type="text"
                              value={categoryEditValues.displayNameEs || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, displayNameEs: e.target.value })}
                              placeholder={t('admin.nameEsPlaceholder')}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-caption font-medium text-slate-400 ml-1">{t('admin.parentCategory')}</label>
                            <select
                              value={categoryEditValues.parentName || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, parentName: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-label font-medium outline-none"
                            >
                              <option value="">{t('admin.noneRootCategory')}</option>
                              {categories
                                .filter((c: any) => c.id !== selectedCategory.id)
                                .map((c: any) => (
                                  <option key={c.id} value={c.name}>
                                    {c.displayName || c.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-caption font-medium text-slate-400 ml-1">{t('plans.categoryMinPlanCS')}</label>
                            <select
                              value={categoryEditValues.minPlanCS || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, minPlanCS: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-label font-medium outline-none"
                            >
                              <option value="">{t('plans.noRestriction')}</option>
                              {ZENDESK_PLANS.map((plan) => (
                                <option key={plan} value={plan}>{PLAN_LABEL[plan]}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-caption font-medium text-slate-400 ml-1">{t('plans.categoryMinPlanES')}</label>
                            <select
                              value={categoryEditValues.minPlanES || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, minPlanES: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-label font-medium outline-none"
                            >
                              <option value="">{t('plans.noRestriction')}</option>
                              {ZENDESK_PLANS.map((plan) => (
                                <option key={plan} value={plan}>{PLAN_LABEL[plan]}</option>
                              ))}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-caption font-bold text-slate-400 leading-relaxed">
                              {t('plans.categoryGateHint')}
                            </p>
                          </div>
                          {/* Linha do card de Implantação onde as horas desta categoria entram.
                              Só vale para categorias raiz; subcategorias usam a da raiz. */}
                          <div className="space-y-2">
                            <label className="block text-caption font-medium text-slate-400 ml-1">{t('admin.implementationPhase')}</label>
                            <select
                              value={categoryEditValues.implementationPhase || 'SETUP'}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, implementationPhase: e.target.value })}
                              disabled={hasActiveParent}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-label font-medium outline-none disabled:opacity-50"
                            >
                              <option value="WORKSHOP">{t('editor.subitemWorkshop')}</option>
                              <option value="SETUP">{t('editor.subitemSetup')}</option>
                              <option value="TRAINING">{t('editor.subitemTraining')}</option>
                              <option value="GOLIVE">{t('editor.subitemGoLive')}</option>
                            </select>
                          </div>
                          <div className="flex items-end">
                            <p className="text-caption font-bold text-slate-400 leading-relaxed">
                              {hasActiveParent ? t('admin.implementationPhaseInherited') : t('admin.implementationPhaseHint')}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="space-y-1">
                              <div className="text-caption font-medium text-slate-400">{t('admin.bulkManagement')}</div>
                              <div className="text-label font-medium tracking-tight text-brand-dark">{packagesInSelectedCategory.length} item(ns) nesta categoria</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={selectAllBulkPackages}
                                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-caption font-medium text-slate-500 hover:text-brand-primary transition-all"
                              >
                                {t('admin.selectAll')}
                              </button>
                              <button
                                type="button"
                                onClick={clearBulkPackages}
                                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-caption font-medium text-slate-500 hover:text-brand-primary transition-all"
                              >
                                {t('admin.clear')}
                              </button>
                            </div>
                          </div>

                          <div className="max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-2xl">
                            {packagesInSelectedCategory.length === 0 ? (
                              <div className="p-8 text-center text-caption font-medium text-slate-300">
                                {t('admin.noItemsInCategory')}
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-100">
                                {packagesInSelectedCategory.map((pkg: any) => (
                                  <label key={pkg.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={bulkSelectedPackageIds.includes(pkg.id)}
                                      onChange={() => toggleBulkPackage(pkg.id)}
                                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                    />
                                    <div className="min-w-0">
                                      <div className="text-label font-medium tracking-tight text-brand-dark truncate">{pkg.name}</div>
                                      <div className="text-caption font-medium text-slate-400 truncate">{pkg.skillName}</div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="block text-caption font-medium text-slate-400 ml-1">{t('admin.moveSelectedTo')}</label>
                              <select
                                value={bulkTargetCategoryName}
                                onChange={(e) => setBulkTargetCategoryName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-label font-medium outline-none"
                              >
                                <option value="">{t('common.select')}</option>
                                {categories
                                  .filter((c: any) => c.name !== selectedCategory.name)
                                  .map((c: any) => (
                                    <option key={c.id} value={c.name}>
                                      {c.displayName || c.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="flex items-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!bulkTargetCategoryName) return;
                                  if (bulkSelectedPackageIds.length === 0) return;
                                  startTransition(async () => {
                                    await bulkMovePackagesAction(bulkSelectedPackageIds, bulkTargetCategoryName);
                                  });
                                }}
                                className="flex-1 bg-brand-dark text-[color:var(--bg-main)] px-6 py-4 rounded-2xl text-label font-medium hover:opacity-90 transition-all disabled:opacity-50"
                                disabled={isPending || !bulkTargetCategoryName || bulkSelectedPackageIds.length === 0}
                              >
                                {t('admin.move')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (bulkSelectedPackageIds.length === 0) return;
                                  const name = prompt(t('admin.promptMoveCategory'));
                                  if (!name) return;
                                  startTransition(async () => {
                                    await addCategoryAction(name);
                                    await bulkMovePackagesAction(bulkSelectedPackageIds, name);
                                  });
                                }}
                                className="px-6 py-4 rounded-2xl bg-white border border-slate-200 text-label font-medium text-slate-500 hover:text-brand-primary transition-all disabled:opacity-50"
                                disabled={isPending || bulkSelectedPackageIds.length === 0}
                              >
                                {t('common.new')}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                            <div className="space-y-2">
                              <label className="block text-caption font-medium text-slate-400 ml-1">{t('admin.mergeCategoryInto')}</label>
                              <select
                                value={mergeTargetCategoryName}
                                onChange={(e) => setMergeTargetCategoryName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-label font-medium outline-none"
                              >
                                <option value="">{t('common.select')}</option>
                                {categories
                                  .filter((c: any) => c.name !== selectedCategory.name)
                                  .map((c: any) => (
                                    <option key={c.id} value={c.name}>
                                      {c.displayName || c.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!mergeTargetCategoryName) return;
                                  if (confirm(t('admin.confirmMergeCategory', { source: selectedCategory.displayName || selectedCategory.name, target: categories.find((c: any) => c.name === mergeTargetCategoryName)?.displayName || mergeTargetCategoryName }))) {
                                    startTransition(async () => {
                                      await mergeCategoryAction(selectedCategory.id, mergeTargetCategoryName);
                                    });
                                  }
                                }}
                                className="w-full bg-red-50 text-red-600 border border-red-100 px-6 py-4 rounded-2xl text-label font-medium hover:bg-red-100 transition-all disabled:opacity-50"
                                disabled={isPending || !mergeTargetCategoryName}
                              >
                                {t('admin.mergeAndDeactivate')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeLibraryTab === 'skills' && (
              <div className="bg-white rounded-3xl border border-slate-50 shadow-2xl p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold text-brand-dark tracking-tight">{t('admin.skillManagement')}</h3>
                  <button onClick={handleAddSkill} className="bg-brand-primary text-brand-ink px-6 py-3 rounded-xl text-label font-medium hover:opacity-90 transition-all flex items-center space-x-2 shadow-lg">
                    <Plus className="w-4 h-4" />
                    <span>{t('admin.newSkill')}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {skills.map((s: any) => (
                    <div key={s.id} className="group bg-slate-50 p-6 rounded-2xl border border-slate-100 flex justify-between items-center hover:border-brand-primary transition-all">
                      <div className="min-w-0 flex-1 mr-3">
                        <div className="text-body font-bold text-brand-dark tracking-tight truncate">{skillLabelOf(s, language)}</div>
                        <input
                          type="text"
                          defaultValue={s.nameEn || ''}
                          placeholder={t('admin.skillNameEn')}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next !== String(s.nameEn || '')) {
                              startTransition(() => updateSkillAction(s.id, next));
                            }
                          }}
                          className="mt-1 w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-label font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                        />
                        <input
                          type="text"
                          defaultValue={s.nameEs || ''}
                          placeholder={t('admin.skillNameEs')}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next !== String(s.nameEs || '')) {
                              startTransition(() => updateSkillAction(s.id, undefined, next));
                            }
                          }}
                          className="mt-1 w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-label font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                        />
                      </div>
                      <button onClick={() => startTransition(() => deleteSkillAction(s.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'variables' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="lg:col-span-1 bg-white p-10 rounded-3xl border border-slate-50 shadow-2xl h-fit">
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-10 h-10 brand-bg-primary rounded-2xl flex items-center justify-center text-brand-ink shadow-lg">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-brand-dark text-title font-bold">{t('admin.newVariable')}</h3>
              </div>
              <form action={addVariableAction} className="space-y-6">
                <div>
                  <label className="block text-caption font-medium text-slate-400 ml-1 mb-3">{t('admin.variableKey')}</label>
                  <input type="text" name="key" placeholder={t('admin.variableKeyPlaceholder')} className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all " required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-caption font-medium text-slate-400 ml-1 mb-3">{t('admin.variableLabelPt')}</label>
                    <input type="text" name="label" placeholder={t('admin.namePtPlaceholder')} className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-label font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-caption font-medium text-slate-400 ml-1 mb-3">{t('admin.variableLabelEn')}</label>
                    <input type="text" name="labelEn" placeholder={t('admin.nameEnPlaceholder')} className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-label font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-caption font-medium text-slate-400 ml-1 mb-3">{t('admin.variableLabelEs')}</label>
                  <input type="text" name="labelEs" placeholder={t('admin.nameEsPlaceholder')} className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-label font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-caption font-medium text-slate-400 ml-1 mb-3">{t('admin.valuePercentage')}</label>
                  <input type="text" name="value" placeholder={t('admin.valuePlaceholder')} className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-caption font-medium text-slate-400 ml-1 mb-3">{t('common.type')}</label>
                    <select name="type" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-label font-medium outline-none">
                      <option value="PERCENT">{t('admin.typePercent')}</option>
                      <option value="FLAT">{t('admin.typeFlat')}</option>
                      <option value="MIXED">{t('admin.typeMixed')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-caption font-medium text-slate-400 ml-1 mb-3">{t('admin.typeFlat')}</label>
                    <input type="number" step="0.01" name="flatValue" placeholder="0.00" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-caption font-medium text-slate-400 ml-1 mb-3">{t('common.category')}</label>
                  <input type="text" name="category" list="var-categories" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" required />
                  <datalist id="var-categories">
                    <option value="Preços" />
                    <option value="Configurações" />
                    <option value="Limites" />
                  </datalist>
                </div>
                <button type="submit" className="w-full brand-bg-primary text-brand-ink py-5 rounded-2xl font-medium hover:opacity-90 shadow-xl btn-premium text-label">
                  {t('admin.saveVariable')}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-50 shadow-2xl overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-slate-50/30 border-b border-slate-50">
                  <tr>
                    <th className="px-10 py-6 text-left text-caption font-medium text-slate-400 ">{t('admin.keyCategory')}</th>
                    <th className="px-10 py-6 text-center text-caption font-medium text-slate-400 ">{t('common.value')}</th>
                    <th className="px-10 py-6 text-right text-caption font-medium text-slate-400 ">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {variables.map((v: any) => (
                    <tr key={v.id} className={`hover:bg-slate-50/30 transition-all group ${editingVariableId === v.id ? 'bg-brand-primary/5' : ''}`}>
                      <td className="px-10 py-8">
                        {editingVariableId === v.id ? (
                          <div className="space-y-4">
                            <input 
                              type="text" 
                              value={editVariableValues.key} 
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, key: e.target.value.toUpperCase() })}
                              className="w-full bg-white border border-brand-primary/30 rounded-lg px-3 py-2 text-label font-medium outline-none"
                            />
                            <input 
                              type="text" 
                              value={editVariableValues.label || ''} 
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, label: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-label font-bold outline-none"
                              placeholder={t('admin.variableLabelPt')}
                            />
                            <input 
                              type="text" 
                              value={editVariableValues.labelEn || ''} 
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, labelEn: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-label font-bold outline-none"
                              placeholder={t('admin.variableLabelEn')}
                            />
                            <input
                              type="text"
                              value={editVariableValues.labelEs || ''}
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, labelEs: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-label font-bold outline-none"
                              placeholder={t('admin.variableLabelEs')}
                            />
                            <input 
                              type="text" 
                              value={editVariableValues.category} 
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, category: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-label font-bold outline-none"
                              placeholder={t('admin.categoryPlaceholder')}
                            />
                          </div>
                        ) : (
                          <>
                            <div className="text-body font-bold text-brand-dark group-hover:text-brand-primary transition-all tracking-tight">{variableLabel(v, language)}</div>
                            <div className="text-caption font-medium text-slate-300 mt-0.5">{v.key}</div>
                            <div className="text-caption font-medium text-slate-400 mt-1">{v.category}</div>
                          </>
                        )}
                      </td>
                      <td className="px-10 py-8 text-center">
                        {editingVariableId === v.id ? (
                          <div className="space-y-3">
                            <select 
                              value={editVariableValues.type} 
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, type: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-caption font-medium "
                            >
                              <option value="PERCENT">PERCENT</option>
                              <option value="FLAT">FLAT</option>
                              <option value="MIXED">MIXED</option>
                            </select>
                            <div className="flex items-center space-x-2">
                              <input 
                                type="text" 
                                value={editVariableValues.value} 
                                onChange={(e) => setEditVariableValues({ ...editVariableValues, value: e.target.value })}
                                className="w-1/2 bg-white border border-slate-200 rounded-lg px-2 py-1 text-label font-medium text-center"
                                placeholder="%"
                              />
                              <input 
                                type="number" 
                                step="0.01"
                                value={editVariableValues.flatValue} 
                                onChange={(e) => setEditVariableValues({ ...editVariableValues, flatValue: e.target.value })}
                                className="w-1/2 bg-white border border-slate-200 rounded-lg px-2 py-1 text-label font-medium text-center"
                                placeholder="H"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center space-y-1">
                            <span className={`text-caption font-medium px-2 py-0.5 rounded ${
                              v.type === 'PERCENT' ? 'bg-green-50 text-green-600' : 
                              v.type === 'FLAT' ? 'bg-slate-100 text-brand-dark' : 
                              'bg-amber-50 text-amber-600'
                            }`}>
                              {v.type}
                            </span>
                            <div className="flex items-center gap-1">
                              {v.type !== 'FLAT' && <span className="bg-slate-100 text-brand-dark px-3 py-1 rounded-xl text-label font-medium border border-slate-200">{v.value}%</span>}
                              {v.type === 'MIXED' && <span className="text-slate-300 font-bold">+</span>}
                              {v.type !== 'PERCENT' && <span className="bg-slate-800 text-white px-3 py-1 rounded-xl text-label font-medium ">{v.flatValue}H</span>}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-10 py-8 text-right">
                        {editingVariableId === v.id ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={handleSaveEditVariable} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingVariableId(null)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-3">
                            <button 
                              onClick={() => handleStartEditVariable(v)}
                              className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-brand-primary transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteVariable(v.id, v.key)}
                              disabled={isPending}
                              className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-slate-50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="px-12 py-8 bg-slate-50/30 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 brand-bg-primary rounded-2xl flex items-center justify-center text-brand-ink shadow-lg">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-brand-dark text-title font-bold">{t('admin.teamManagement')}</h2>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-caption font-medium text-slate-400 ">
                  {users.length} Membros da Equipe
                </div>
                <button
                  onClick={() => { resetNewUserForm(); setShowNewUser(true); }}
                  className="flex items-center space-x-2 px-5 py-2.5 brand-bg-primary text-brand-ink rounded-2xl font-medium text-label shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('admin.createUser')}</span>
                </button>
              </div>
            </div>

            {showNewUser && (
              <div className="px-12 py-8 border-b border-slate-50 bg-brand-primary/[0.02]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-body font-bold tracking-tight text-brand-dark">{t('admin.newUser')}</div>
                    <div className="text-label font-bold text-slate-400 mt-1">{t('admin.newUserSubtitle')}</div>
                  </div>
                  <button
                    onClick={() => { setShowNewUser(false); resetNewUserForm(); }}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-caption font-medium text-slate-400 mb-2 block">{t('admin.emailRequired')}</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder={t('admin.emailPlaceholder')}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-body outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-caption font-medium text-slate-400 mb-2 block">{t('admin.displayNameField')}</label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder={t('admin.fullNamePlaceholder')}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-body outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-caption font-medium text-slate-400 mb-2 block">{t('admin.passwordRequired')}</label>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder={t('admin.passwordPlaceholder')}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-body outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-caption font-medium text-slate-400 mb-2 block">{t('segment.label')}</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-body outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                    >
                      {SEGMENTS.map((seg) => (
                        <option key={seg} value={seg}>{t(SEGMENT_LABEL_KEYS[seg])}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {/* Privilégio de admin não é mais um campo: ele decorre do segmento ADMIN. */}
                  <div className={`inline-flex items-center space-x-3 px-4 py-2.5 rounded-xl border bg-white transition-all ${
                    newUserRole === 'ADMIN' ? 'border-brand-primary' : 'border-slate-200'
                  }`}>
                    <div>
                      <div className="text-label font-medium text-brand-dark">{t('admin.adminPrivilege')}</div>
                      <div className="text-caption font-bold text-slate-400">{t('segment.adminHint')}</div>
                    </div>
                    <ShieldCheck className={`w-4 h-4 ml-2 ${newUserRole === 'ADMIN' ? 'text-brand-primary' : 'text-slate-300'}`} />
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => { setShowNewUser(false); resetNewUserForm(); }}
                      disabled={isPending}
                      className="px-5 py-3 border border-slate-200 text-slate-500 rounded-xl text-label font-medium hover:bg-slate-50 transition-all disabled:opacity-60"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={() => {
                        if (!newUserEmail || !newUserPassword) {
                          alert(t('admin.emailPasswordRequired'));
                          return;
                        }
                        startTransition(async () => {
                          const result = await createUserAction({
                            email: newUserEmail,
                            name: newUserName || undefined,
                            password: newUserPassword,
                            role: newUserRole,
                          });
                          if (result?.success) {
                            setShowNewUser(false);
                            resetNewUserForm();
                          } else if (result?.error) {
                            alert(result.error);
                          }
                        });
                      }}
                      disabled={isPending}
                      className="px-5 py-3 brand-bg-primary text-brand-ink rounded-xl text-label font-medium shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-60 flex items-center space-x-2"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
                      <span>{t('admin.createUser')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50/10 border-b border-slate-50">
                  <tr>
                    <th className="px-12 py-6 text-left text-caption font-medium text-slate-400 ">{t('admin.member')}</th>
                    <th className="px-12 py-6 text-left text-caption font-medium text-slate-400 ">{t('segment.label')}</th>
                    <th className="px-12 py-6 text-center text-caption font-medium text-slate-400 ">{t('admin.access')}</th>
                    <th className="px-12 py-6 text-right text-caption font-medium text-slate-400 ">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((user: any) => (
                    <tr key={user.id} className="hover:bg-slate-50/30 transition-all group">
                      <td className="px-12 py-8">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-2xl brand-bg-primary flex items-center justify-center text-brand-ink font-bold text-body shadow-md group-hover:scale-110 transition-transform ">
                            {user.name?.[0] || user.email[0]}
                          </div>
                          <div>
                            <div className="text-body font-bold text-brand-dark tracking-tight">{user.name || t('admin.noName')}</div>
                            <div className="flex items-center text-label font-bold text-slate-400 mt-1">
                              <Mail className="w-3 h-3 mr-1.5" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-12 py-8">
                        <select 
                          value={normalizeSegment(user.role)}
                          onChange={(e) => handleUpdateSegment(user, e.target.value)}
                          disabled={!canManageSegments || isPending}
                          title={canManageSegments ? undefined : t('segment.onlyAdminsCanChange')}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-label font-medium outline-none focus:ring-2 focus:ring-brand-primary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {SEGMENTS.map((seg) => (
                            <option key={seg} value={seg}>{t(SEGMENT_LABEL_KEYS[seg])}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-12 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center text-caption font-medium text-slate-400 ">
                            <Calendar className="w-3 h-3 mr-1.5" />
                            {t('admin.memberSince', { date: new Date(user.createdAt).toLocaleDateString(dateLocale) })}
                          </div>
                        </div>
                      </td>
                      <td className="px-12 py-8 text-right">
                        <div className="flex items-center justify-end space-x-3">
                          {/* O privilégio de admin decorre do segmento ADMIN — por isso este
                              indicador é apenas informativo, não um botão. */}
                          <span
                            title={t('segment.adminHint')}
                            className={`p-2 rounded-xl border transition-all inline-flex ${
                              user.isAdmin 
                                ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' 
                                : 'bg-slate-50 border-slate-200 text-slate-300'
                            }`}
                          >
                            {user.isAdmin ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                          </span>
                          <button 
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            disabled={isPending}
                            className="p-2 rounded-xl bg-red-50 text-red-400 border border-red-100 hover:bg-red-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
