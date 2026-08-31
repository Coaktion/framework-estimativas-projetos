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
  ChevronRight, Search, Layout, Activity, Info, Check, X, Edit2
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
  reseedFrameworkAction,
  createUserAction,
} from './actions';
import { addVariableAction, deleteVariableAction, updateVariableAction } from './variable_actions';

export default function AdminClient({ packages, categories, skills, variables, versions, users }: any) {
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
  const [newItemDependsOn, setNewItemDependsOn] = useState('');
  const [newItemSdDiscovery, setNewItemSdDiscovery] = useState(false);

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
      minPlanCS: pkg.minPlanCS || '',
      minPlanES: pkg.minPlanES || '',
      hours: pkg.hours,
      skillName: pkg.skillName,
      categoryName: pkg.categoryName,
      tooltip: pkg.tooltip || '',
      tooltipEn: pkg.tooltipEn || '',
      dependsOnItemId: pkg.dependsOnItemId || '',
      sdDiscovery: Boolean(pkg.sdDiscovery || false),
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
      value: v.value,
      category: v.category,
      type: v.type,
      flatValue: v.flatValue || 0,
      targetItems: JSON.parse(v.targetItems || '[]'),
      targetCategories: JSON.parse(v.targetCategories || '[]'),
      excludedItems: JSON.parse(v.excludedItems || '[]')
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
    formData.append('minPlanCS', newItemMinPlanCS);
    formData.append('minPlanES', newItemMinPlanES);
    formData.append('hours', newItemHours);
    formData.append('skillName', newItemSkill);
    formData.append('categoryName', newItemCategory);
    formData.append('tooltip', newItemTooltip);
    formData.append('tooltipEn', newItemTooltipEn);
    formData.append('dependsOnItemId', newItemDependsOn);
    if (newItemSdDiscovery) formData.append('sdDiscovery', 'on');

    startTransition(async () => {
      await addPackageAction(formData);
      setNewItemName('');
      setNewItemNameEn('');
      setNewItemMinPlanCS('');
      setNewItemMinPlanES('');
      setNewItemHours('');
      setNewItemTooltip('');
      setNewItemTooltipEn('');
      setNewItemDependsOn('');
      setNewItemSdDiscovery(false);
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
      parentName: selectedCategory.parentName || '',
      minPlanCS: selectedCategory.minPlanCS || '',
      minPlanES: selectedCategory.minPlanES || ''
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

  const handleReseed = () => {
    if (confirm(t('admin.confirmFactoryReset'))) {
      startTransition(async () => {
        await reseedFrameworkAction();
      });
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-brand-dark tracking-tighter font-heading uppercase">{t('admin.title')}</h1>
          <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest">{t('admin.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={handleReseed}
            disabled={isPending}
            className="flex-1 md:flex-none bg-amber-50 text-amber-600 border border-amber-200 px-6 py-4 rounded-2xl font-black hover:bg-amber-100 transition-all flex items-center justify-center space-x-3 text-xs uppercase tracking-widest disabled:opacity-50"
            title={t('admin.restoreLibrary')}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{t('admin.resetFactory')}</span>
          </button>
          <button 
            onClick={handleCreateSnapshot}
            disabled={isPending}
            className="flex-1 md:flex-none brand-bg-primary text-white px-8 py-4 rounded-2xl font-black hover:opacity-90 shadow-xl btn-premium transition-all flex items-center justify-center space-x-3 text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{t('admin.newSnapshot')}</span>
          </button>
          <button className="flex-1 md:flex-none bg-brand-dark text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all flex items-center justify-center space-x-3 text-xs uppercase tracking-widest shadow-xl">
            <Download className="w-4 h-4" />
            <span>{t('admin.exportData')}</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-50/50 p-2 rounded-[2rem] border border-slate-300 w-fit mx-auto md:mx-0 shadow-sm">
        <nav className="flex space-x-1">
          {[
            { id: 'versions', label: t('admin.tabVersions'), icon: History },
            { id: 'packages', label: t('admin.tabLibrary'), icon: Box },
            { id: 'variables', label: t('admin.tabVariables'), icon: Settings },
            { id: 'users', label: t('admin.tabUsers'), icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-8 py-3.5 rounded-3xl text-[10px] font-black transition-all duration-500 uppercase tracking-widest flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'brand-bg-primary text-white shadow-xl'
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
        {activeTab === 'versions' && (
          <div className="bg-white rounded-[3rem] border border-slate-50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="px-12 py-8 bg-slate-50/30 border-b border-slate-50 flex items-center space-x-4">
              <div className="w-10 h-10 brand-bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg">
                <History className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-brand-dark font-heading uppercase tracking-tight">{t('admin.snapshotHistory')}</h2>
            </div>
            <ul className="divide-y divide-slate-50">
              {versions.map((version: any) => (
                <li key={version.id} className="px-12 py-8 hover:bg-slate-50/50 transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="text-base font-black text-brand-dark group-hover:text-brand-primary transition-all uppercase tracking-tight">
                        {version.versionName}
                      </div>
                      <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        <span className="bg-brand-dark text-white px-3 py-1 rounded-lg mr-4">{version.type}</span>
                        <span>{new Date(version.createdAt).toLocaleString(dateLocale)}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRestore(version.id, version.versionName)}
                      className="bg-white text-brand-primary px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                    >
                      {t('admin.restore')}
                    </button>
                  </div>
                </li>
              ))}
              {versions.length === 0 && (
                <li className="px-12 py-24 text-center">
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest italic">{t('admin.noRecords')}</p>
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
                  className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${
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
            </div>

            {activeLibraryTab === 'items' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-2xl h-fit sticky top-24">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-8 h-8 brand-bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
                      <Plus className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-black text-brand-dark font-heading uppercase tracking-tight">{t('admin.newItem')}</h3>
                  </div>
                  <form onSubmit={handleAddPackage} className="space-y-4">
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">{t('admin.namePt')}</label>
                      <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder={t('admin.namePtPlaceholder')} className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-brand-primary dark:focus:bg-[#0a0a0a] outline-none transition-all" required />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">{t('admin.nameEn')}</label>
                      <input type="text" value={newItemNameEn} onChange={(e) => setNewItemNameEn(e.target.value)} placeholder={t('admin.nameEnPlaceholder')} className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-brand-primary dark:focus:bg-[#0a0a0a] outline-none transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">{t('common.hours')}</label>
                        <input type="number" step="0.01" min="0" value={newItemHours} onChange={(e) => setNewItemHours(e.target.value)} className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-xl px-4 py-3 text-xs font-black focus:ring-2 focus:ring-brand-primary dark:focus:bg-[#0a0a0a] outline-none transition-all text-center" required />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">{t('admin.skill')}</label>
                        <select value={newItemSkill} onChange={(e) => setNewItemSkill(e.target.value)} className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-xl px-4 py-3 text-[9px] font-black focus:ring-2 focus:ring-brand-primary dark:focus:bg-[#0a0a0a] outline-none transition-all appearance-none cursor-pointer uppercase">
                          {skills.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">{t('common.category')}</label>
                      <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-xl px-4 py-3 text-[9px] font-black focus:ring-2 focus:ring-brand-primary dark:focus:bg-[#0a0a0a] outline-none transition-all appearance-none cursor-pointer uppercase" required>
                        <option value="">{t('common.select')}</option>
                        {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">{t('admin.dependsOn')}</label>
                      <select value={newItemDependsOn} onChange={(e) => setNewItemDependsOn(e.target.value)} className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-xl px-4 py-3 text-[9px] font-black focus:ring-2 focus:ring-brand-primary dark:focus:bg-[#0a0a0a] outline-none transition-all appearance-none cursor-pointer uppercase">
                        <option value="">{t('common.none')}</option>
                        {packages.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-3 rounded-xl bg-slate-50 dark:bg-[#141414] dark:border-[#1f1f1f] border border-slate-200">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-brand-dark dark:text-[#ffffff]">{t('admin.sdDiscovery')}</div>
                        <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-[#8a8a8a]">{t('admin.sdDiscoveryHint')}</div>
                      </div>
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newItemSdDiscovery}
                          onChange={(e) => setNewItemSdDiscovery(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="relative w-11 h-6 bg-slate-200 dark:bg-[#1f1f1f] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white dark:after:bg-[#0a0a0a] after:border-slate-300 dark:after:border-[#1f1f1f] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:brand-bg-primary dark:peer-checked:brand-bg-primary"></div>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">{t('plans.minPlanCS')}</label>
                        <select value={newItemMinPlanCS} onChange={(e) => setNewItemMinPlanCS(e.target.value)} className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-xl px-3 py-3 text-[10px] font-black uppercase tracking-tight outline-none focus:ring-2 focus:ring-brand-primary transition-all">
                          <option value="">{t('plans.noRestriction')}</option>
                          {ZENDESK_PLANS.map((plan) => (
                            <option key={plan} value={plan}>{PLAN_LABEL[plan]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">{t('plans.minPlanES')}</label>
                        <select value={newItemMinPlanES} onChange={(e) => setNewItemMinPlanES(e.target.value)} className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-xl px-3 py-3 text-[10px] font-black uppercase tracking-tight outline-none focus:ring-2 focus:ring-brand-primary transition-all">
                          <option value="">{t('plans.noRestriction')}</option>
                          {ZENDESK_PLANS.map((plan) => (
                            <option key={plan} value={plan}>{PLAN_LABEL[plan]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">{t('admin.tooltipPt')}</label>
                      <textarea value={newItemTooltip} onChange={(e) => setNewItemTooltip(e.target.value)} className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-brand-primary dark:focus:bg-[#0a0a0a] outline-none transition-all h-20 resize-none" />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">{t('admin.tooltipEn')}</label>
                      <textarea value={newItemTooltipEn} onChange={(e) => setNewItemTooltipEn(e.target.value)} className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-brand-primary dark:focus:bg-[#0a0a0a] outline-none transition-all h-20 resize-none" />
                    </div>
                    <button type="submit" disabled={isPending} className="w-full brand-bg-primary text-white py-4 rounded-xl font-black uppercase tracking-widest hover:opacity-90 shadow-xl text-[10px] disabled:opacity-50">
                      {isPending ? t('common.processing') : t('admin.addItem')}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-3 space-y-6">
                  {/* Categorias como Abas Superiores */}
                  <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-1 overflow-x-auto">
                    <button
                      onClick={() => setFilterCategory('')}
                      className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        filterCategory === '' ? 'brand-bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {t('common.all')}
                    </button>
                    {categories.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => setFilterCategory(c.name)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          filterCategory === c.name ? 'brand-bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  {/* Filtros e Busca */}
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('admin.searchAllLanguages')} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                      />
                    </div>
                    <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none">
                      <option value="">{t('admin.allSkills')}</option>
                      {skills.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <button 
                      onClick={() => setShowAllConditional(!showAllConditional)}
                      className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                        showAllConditional ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      Ignorar Condicionais: {showAllConditional ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Tabela com Edição Inline */}
                  <div className="bg-white dark:bg-[#0a0a0a] dark:border-[#1f1f1f] rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                    <table className="min-w-full">
                      <thead className="bg-slate-50/50 dark:bg-[#141414]/70 border-b border-slate-100 dark:border-[#1f1f1f]">
                        <tr>
                          <th className="px-8 py-5 text-left text-[9px] font-black text-slate-400 dark:text-[#8a8a8a] uppercase tracking-widest">{t('common.item')}</th>
                          <th className="px-8 py-5 text-center text-[9px] font-black text-slate-400 dark:text-[#8a8a8a] uppercase tracking-widest w-24">{t('common.hours')}</th>
                          <th className="px-8 py-5 text-left text-[9px] font-black text-slate-400 dark:text-[#8a8a8a] uppercase tracking-widest">{t('common.organization')}</th>
                          <th className="px-8 py-5 text-right text-[9px] font-black text-slate-400 dark:text-[#8a8a8a] uppercase tracking-widest">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-[#141414]">
                        {filteredPackages.map((pkg: any) => (
                          <tr key={pkg.id} className={`hover:bg-slate-50/30 dark:hover:bg-[#141414]/50 transition-all group ${editingId === pkg.id ? 'bg-brand-primary/5 dark:bg-brand-primary/10' : ''}`}>
                            <td className="px-8 py-6">
                              {editingId === pkg.id ? (
                                <div className="space-y-2">
                                  <input 
                                    type="text" 
                                    value={editValues.name} 
                                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                    className="w-full bg-white dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-brand-primary/30 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                                  />
                                  <input 
                                    type="text" 
                                    placeholder={t('admin.nameEnPlaceholder')}
                                    value={editValues.nameEn || ''} 
                                    onChange={(e) => setEditValues({ ...editValues, nameEn: e.target.value })}
                                    className="w-full bg-white dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                                  />
                                  <input 
                                    type="text" 
                                    placeholder={t('admin.tooltipPt')}
                                    value={editValues.tooltip} 
                                    onChange={(e) => setEditValues({ ...editValues, tooltip: e.target.value })}
                                    className="w-full bg-white dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-lg px-3 py-1 text-[10px] outline-none transition-all"
                                  />
                                  <input 
                                    type="text" 
                                    placeholder={t('admin.tooltipEn')}
                                    value={editValues.tooltipEn || ''} 
                                    onChange={(e) => setEditValues({ ...editValues, tooltipEn: e.target.value })}
                                    className="w-full bg-white dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-lg px-3 py-1 text-[10px] outline-none transition-all"
                                  />
                                  <div className="grid grid-cols-2 gap-2 pt-1">
                                    <select
                                      value={editValues.minPlanCS || ''}
                                      onChange={(e) => setEditValues({ ...editValues, minPlanCS: e.target.value })}
                                      title={t('plans.minPlanCS')}
                                      className="w-full bg-white dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-black uppercase outline-none"
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
                                      className="w-full bg-white dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-black uppercase outline-none"
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
                                  <div className="text-sm font-black text-brand-dark dark:text-[#ffffff] uppercase tracking-tight">{packageName(pkg, language)}</div>
                                  {minPlanBadge(pkg, 'CS') && (
                                    <span title={t('plans.minPlanCS')} className="shrink-0 px-2 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100 text-[7px] font-black uppercase tracking-widest">
                                      CS {minPlanBadge(pkg, 'CS')}
                                    </span>
                                  )}
                                  {minPlanBadge(pkg, 'ES') && (
                                    <span title={t('plans.minPlanES')} className="shrink-0 px-2 py-0.5 rounded-md bg-violet-50 text-violet-600 border border-violet-100 text-[7px] font-black uppercase tracking-widest">
                                      ES {minPlanBadge(pkg, 'ES')}
                                    </span>
                                  )}
                                  {!String(pkg.nameEn || '').trim() && (
                                    <span title={t('admin.missingTranslationHint')} className="shrink-0 px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 text-[7px] font-black uppercase tracking-widest">
                                      {t('admin.missingTranslation')}
                                    </span>
                                  )}
                                  {packageTooltip(pkg, language) && (
                                    <div className="group/tooltip relative cursor-help">
                                      <Info className="w-3 h-3 text-slate-300 hover:text-brand-primary transition-colors" />
                                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-brand-dark dark:bg-[#141414] text-white dark:text-[#ffffff] dark:border dark:border-[#1f1f1f] text-[9px] font-bold p-3 rounded-xl w-48 shadow-2xl opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50">
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
                                  className="w-16 bg-white dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-brand-primary/30 rounded-lg px-2 py-1.5 text-xs font-black text-center outline-none transition-all"
                                />
                              ) : (
                                <span className="bg-brand-dark dark:bg-[#141414] dark:border dark:border-[#1f1f1f] text-white dark:text-[#ffffff] px-3 py-1 rounded-lg text-[10px] font-black tracking-tighter">{pkg.hours}H</span>
                              )}
                            </td>
                            <td className="px-8 py-6">
                              {editingId === pkg.id ? (
                                <div className="space-y-2">
                                  <select 
                                    value={editValues.categoryName} 
                                    onChange={(e) => setEditValues({ ...editValues, categoryName: e.target.value })}
                                    className="w-full bg-white dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-brand-primary/30 rounded-lg px-2 py-1 text-[9px] font-black uppercase"
                                  >
                                    {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                                  </select>
                                  <select 
                                    value={editValues.skillName} 
                                    onChange={(e) => setEditValues({ ...editValues, skillName: e.target.value })}
                                    className="w-full bg-white dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-brand-primary/30 rounded-lg px-2 py-1 text-[9px] font-black uppercase"
                                  >
                                    {skills.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                                  </select>
                                  <select 
                                    value={editValues.dependsOnItemId} 
                                    onChange={(e) => setEditValues({ ...editValues, dependsOnItemId: e.target.value })}
                                    className="w-full bg-white dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-brand-primary/30 rounded-lg px-2 py-1 text-[9px] font-black uppercase"
                                  >
                                    <option value="">{t('admin.noDependency')}</option>
                                    {packages.filter((p: any) => p.id !== pkg.id).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                  
                                  <div className="space-y-1.5 pt-1">
                                    <label className="block text-[7px] font-black text-slate-400 dark:text-[#8a8a8a] uppercase tracking-widest ml-1">{t('admin.excludeFromPct')}</label>
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
                                          className={`px-2 py-0.5 rounded text-[7px] font-black uppercase transition-all border ${
                                            (editValues.excludedFromVariables || []).includes(v.key)
                                              ? 'bg-red-50 dark:bg-[#3b1414] text-red-500 dark:text-[#ff7676] border-red-200 dark:border-[#5a1e1e]'
                                              : 'bg-slate-50 dark:bg-[#141414] text-slate-400 dark:text-[#8a8a8a] border-slate-200 dark:border-[#1f1f1f] hover:border-slate-300'
                                          }`}
                                        >
                                          {v.key.replace('_STANDARD', '')}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg bg-slate-50 dark:bg-[#141414] dark:border-[#1f1f1f] border border-slate-200">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-brand-dark dark:text-[#ffffff]">{t('admin.sdDiscovery')}</span>
                                    </div>
                                    <label className="inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(editValues.sdDiscovery || false)}
                                        onChange={(e) => setEditValues({ ...editValues, sdDiscovery: e.target.checked })}
                                        className="sr-only peer"
                                      />
                                      <div className="relative w-9 h-5 bg-slate-200 dark:bg-[#1f1f1f] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white dark:after:bg-[#0a0a0a] after:border-slate-300 dark:after:border-[#1f1f1f] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:brand-bg-primary dark:peer-checked:brand-bg-primary"></div>
                                    </label>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col space-y-1">
                                  <span className="text-[9px] font-black text-slate-400 dark:text-[#8a8a8a] uppercase tracking-widest">{pkg.categoryName}</span>
                                  <span className="text-[8px] bg-slate-100 dark:bg-[#141414] dark:text-[#e8e8e8] text-slate-500 px-2 py-0.5 rounded-md font-black uppercase tracking-tighter w-fit">{pkg.skillName}</span>
                                  {pkg.sdDiscovery && (
                                    <span className="text-[8px] bg-brand-primary/10 dark:bg-brand-primary/15 text-brand-primary border border-brand-primary/30 px-2 py-0.5 rounded-md font-black uppercase tracking-tighter w-fit flex items-center gap-1">
                                      {t('admin.sdDiscovery')}
                                    </span>
                                  )}
                                  {pkg.dependsOnItemId && (
                                    <span className="text-[8px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-black uppercase tracking-tighter w-fit flex items-center gap-1">
                                      <Settings className="w-2 h-2" />
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
              <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-2xl p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">{t('admin.categoryManagement')}</h3>
                  <button onClick={handleAddCategory} className="bg-brand-primary text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center space-x-2 shadow-lg">
                    <Plus className="w-4 h-4" />
                    <span>{t('admin.newCategory')}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-4">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('admin.defaultOrderDrag')}</div>
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
                              <div className="text-xs font-black uppercase tracking-tight truncate">{categoryLabelOf(c, language)}</div>
                              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400 truncate">
                                {c.name}{c.parentName ? ` → ${(categories.find((x: any) => x.name === c.parentName)?.displayName || c.parentName)}` : ''}
                              </div>
                              {(categoryMinPlanBadge(c, 'CS') || categoryMinPlanBadge(c, 'ES')) && (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  {categoryMinPlanBadge(c, 'CS') && (
                                    <span title={t('plans.categoryMinPlanCS')} className="shrink-0 px-2 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100 text-[7px] font-black uppercase tracking-widest">
                                      CS {categoryMinPlanBadge(c, 'CS')}
                                    </span>
                                  )}
                                  {categoryMinPlanBadge(c, 'ES') && (
                                    <span title={t('plans.categoryMinPlanES')} className="shrink-0 px-2 py-0.5 rounded-md bg-violet-50 text-violet-600 border border-violet-100 text-[7px] font-black uppercase tracking-widest">
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
                      <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-10 text-center">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {t('admin.selectCategoryToEdit')}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-xl space-y-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="space-y-1">
                            <div className="text-xs font-black uppercase tracking-widest text-slate-400">{t('common.category')}</div>
                            <div className="text-xl font-black text-brand-dark uppercase tracking-tight">{categoryLabelOf(selectedCategory, language)}</div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-300">{selectedCategory.name}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                startTransition(async () => {
                                  await updateCategoryAction(selectedCategory.id, categoryEditValues);
                                });
                              }}
                              className="bg-brand-primary text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 shadow-lg"
                              disabled={isPending}
                            >
                              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              <span>{t('common.save')}</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(t('admin.confirmDeactivateCategory', { name: selectedCategory.displayName || selectedCategory.name }))) {
                                  startTransition(async () => {
                                    await deleteCategoryAction(selectedCategory.id);
                                  });
                                }
                              }}
                              className="bg-red-50 text-red-600 border border-red-100 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2"
                              disabled={isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>{t('admin.deactivate')}</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('admin.displayNamePt')}</label>
                            <input
                              type="text"
                              value={categoryEditValues.displayName || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, displayName: e.target.value })}
                              placeholder={selectedCategory.name}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('admin.displayNameEn')}</label>
                            <input
                              type="text"
                              value={categoryEditValues.displayNameEn || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, displayNameEn: e.target.value })}
                              placeholder={t('admin.nameEnPlaceholder')}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('admin.parentCategory')}</label>
                            <select
                              value={categoryEditValues.parentName || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, parentName: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none"
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
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('plans.categoryMinPlanCS')}</label>
                            <select
                              value={categoryEditValues.minPlanCS || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, minPlanCS: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none"
                            >
                              <option value="">{t('plans.noRestriction')}</option>
                              {ZENDESK_PLANS.map((plan) => (
                                <option key={plan} value={plan}>{PLAN_LABEL[plan]}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('plans.categoryMinPlanES')}</label>
                            <select
                              value={categoryEditValues.minPlanES || ''}
                              onChange={(e) => setCategoryEditValues({ ...categoryEditValues, minPlanES: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none"
                            >
                              <option value="">{t('plans.noRestriction')}</option>
                              {ZENDESK_PLANS.map((plan) => (
                                <option key={plan} value={plan}>{PLAN_LABEL[plan]}</option>
                              ))}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-[9px] font-bold text-slate-400 leading-relaxed">
                              {t('plans.categoryGateHint')}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="space-y-1">
                              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('admin.bulkManagement')}</div>
                              <div className="text-xs font-black uppercase tracking-tight text-brand-dark">{packagesInSelectedCategory.length} item(ns) nesta categoria</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={selectAllBulkPackages}
                                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-primary transition-all"
                              >
                                {t('admin.selectAll')}
                              </button>
                              <button
                                type="button"
                                onClick={clearBulkPackages}
                                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-primary transition-all"
                              >
                                {t('admin.clear')}
                              </button>
                            </div>
                          </div>

                          <div className="max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-2xl">
                            {packagesInSelectedCategory.length === 0 ? (
                              <div className="p-8 text-center text-[9px] font-black uppercase tracking-widest text-slate-300">
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
                                      <div className="text-[10px] font-black uppercase tracking-tight text-brand-dark truncate">{pkg.name}</div>
                                      <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400 truncate">{pkg.skillName}</div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('admin.moveSelectedTo')}</label>
                              <select
                                value={bulkTargetCategoryName}
                                onChange={(e) => setBulkTargetCategoryName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none"
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
                                className="flex-1 bg-brand-dark text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
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
                                className="px-6 py-4 rounded-2xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-primary transition-all disabled:opacity-50"
                                disabled={isPending || bulkSelectedPackageIds.length === 0}
                              >
                                {t('common.new')}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                            <div className="space-y-2">
                              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('admin.mergeCategoryInto')}</label>
                              <select
                                value={mergeTargetCategoryName}
                                onChange={(e) => setMergeTargetCategoryName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none"
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
                                className="w-full bg-red-50 text-red-600 border border-red-100 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50"
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
              <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-2xl p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">{t('admin.skillManagement')}</h3>
                  <button onClick={handleAddSkill} className="bg-brand-primary text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center space-x-2 shadow-lg">
                    <Plus className="w-4 h-4" />
                    <span>{t('admin.newSkill')}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {skills.map((s: any) => (
                    <div key={s.id} className="group bg-slate-50 p-6 rounded-2xl border border-slate-100 flex justify-between items-center hover:border-brand-primary transition-all">
                      <div className="min-w-0 flex-1 mr-3">
                        <div className="text-sm font-black text-brand-dark uppercase tracking-tight truncate">{skillLabelOf(s, language)}</div>
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
                          className="mt-1 w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
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
            <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] border border-slate-50 shadow-2xl h-fit">
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-10 h-10 brand-bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-brand-dark font-heading uppercase tracking-tight">{t('admin.newVariable')}</h3>
              </div>
              <form action={addVariableAction} className="space-y-6">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">{t('admin.variableKey')}</label>
                  <input type="text" name="key" placeholder={t('admin.variableKeyPlaceholder')} className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all uppercase" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">{t('admin.variableLabelPt')}</label>
                    <input type="text" name="label" placeholder={t('admin.namePtPlaceholder')} className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-xs font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">{t('admin.variableLabelEn')}</label>
                    <input type="text" name="labelEn" placeholder={t('admin.nameEnPlaceholder')} className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-xs font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">{t('admin.valuePercentage')}</label>
                  <input type="text" name="value" placeholder={t('admin.valuePlaceholder')} className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">{t('common.type')}</label>
                    <select name="type" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-widest outline-none">
                      <option value="PERCENT">{t('admin.typePercent')}</option>
                      <option value="FLAT">{t('admin.typeFlat')}</option>
                      <option value="MIXED">{t('admin.typeMixed')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">{t('admin.typeFlat')}</label>
                    <input type="number" step="0.01" name="flatValue" placeholder="0.00" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">{t('common.category')}</label>
                  <input type="text" name="category" list="var-categories" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" required />
                  <datalist id="var-categories">
                    <option value="Preços" />
                    <option value="Configurações" />
                    <option value="Limites" />
                  </datalist>
                </div>
                <button type="submit" className="w-full brand-bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:opacity-90 shadow-xl btn-premium text-xs">
                  {t('admin.saveVariable')}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-50 shadow-2xl overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-slate-50/30 border-b border-slate-50">
                  <tr>
                    <th className="px-10 py-6 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">{t('admin.keyCategory')}</th>
                    <th className="px-10 py-6 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">{t('common.value')}</th>
                    <th className="px-10 py-6 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">{t('common.actions')}</th>
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
                              className="w-full bg-white border border-brand-primary/30 rounded-lg px-3 py-2 text-xs font-black uppercase outline-none"
                            />
                            <input 
                              type="text" 
                              value={editVariableValues.label || ''} 
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, label: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none"
                              placeholder={t('admin.variableLabelPt')}
                            />
                            <input 
                              type="text" 
                              value={editVariableValues.labelEn || ''} 
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, labelEn: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none"
                              placeholder={t('admin.variableLabelEn')}
                            />
                            <input 
                              type="text" 
                              value={editVariableValues.category} 
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, category: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-bold outline-none"
                              placeholder={t('admin.categoryPlaceholder')}
                            />
                            
                            <div className="space-y-2 border-t pt-4">
                              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('admin.incidenceItems')}</label>
                              <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-lg p-2 space-y-1">
                                {packages.map((pkg: any) => (
                                  <label key={pkg.id} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                                    <input 
                                      type="checkbox" 
                                      checked={editVariableValues.targetItems.includes(pkg.id.toString())}
                                      onChange={(e) => {
                                        const newItems = e.target.checked 
                                          ? [...editVariableValues.targetItems, pkg.id.toString()]
                                          : editVariableValues.targetItems.filter((id: string) => id !== pkg.id.toString());
                                        setEditVariableValues({ ...editVariableValues, targetItems: newItems });
                                      }}
                                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                    />
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">{pkg.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('admin.incidenceCategories')}</label>
                              <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-lg p-2 space-y-1">
                                {categories.map((cat: any) => (
                                  <label key={cat.id} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                                    <input 
                                      type="checkbox" 
                                      checked={editVariableValues.targetCategories.includes(cat.name)}
                                      onChange={(e) => {
                                        const newCats = e.target.checked 
                                          ? [...editVariableValues.targetCategories, cat.name]
                                          : editVariableValues.targetCategories.filter((name: string) => name !== cat.name);
                                        setEditVariableValues({ ...editVariableValues, targetCategories: newCats });
                                      }}
                                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                    />
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">{cat.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('admin.excludedItems')}</label>
                              <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-lg p-2 space-y-1">
                                {packages.map((pkg: any) => (
                                  <label key={pkg.id} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                                    <input 
                                      type="checkbox" 
                                      checked={editVariableValues.excludedItems.includes(pkg.id.toString())}
                                      onChange={(e) => {
                                        const newItems = e.target.checked 
                                          ? [...editVariableValues.excludedItems, pkg.id.toString()]
                                          : editVariableValues.excludedItems.filter((id: string) => id !== pkg.id.toString());
                                        setEditVariableValues({ ...editVariableValues, excludedItems: newItems });
                                      }}
                                      className="rounded border-slate-300 text-red-500 focus:ring-red-500"
                                    />
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">{pkg.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-black text-brand-dark group-hover:text-brand-primary transition-all uppercase tracking-tight">{variableLabel(v, language)}</div>
                            <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-0.5">{v.key}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{v.category}</div>
                            <div className="mt-3 flex flex-wrap gap-1">
                              {JSON.parse(v.targetItems || '[]').length > 0 && (
                                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter border border-blue-100">
                                  {JSON.parse(v.targetItems || '[]').length} Itens
                                </span>
                              )}
                              {JSON.parse(v.targetCategories || '[]').length > 0 && (
                                <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter border border-purple-100">
                                  {JSON.parse(v.targetCategories || '[]').length} Cats
                                </span>
                              )}
                              {JSON.parse(v.excludedItems || '[]').length > 0 && (
                                <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter border border-red-100">
                                  {JSON.parse(v.excludedItems || '[]').length} Excluídos
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-10 py-8 text-center">
                        {editingVariableId === v.id ? (
                          <div className="space-y-3">
                            <select 
                              value={editVariableValues.type} 
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, type: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-black uppercase"
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
                                className="w-1/2 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-black text-center"
                                placeholder="%"
                              />
                              <input 
                                type="number" 
                                step="0.01"
                                value={editVariableValues.flatValue} 
                                onChange={(e) => setEditVariableValues({ ...editVariableValues, flatValue: e.target.value })}
                                className="w-1/2 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-black text-center"
                                placeholder="H"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center space-y-1">
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                              v.type === 'PERCENT' ? 'bg-green-50 text-green-600' : 
                              v.type === 'FLAT' ? 'bg-blue-50 text-blue-600' : 
                              'bg-amber-50 text-amber-600'
                            }`}>
                              {v.type}
                            </span>
                            <div className="flex items-center gap-1">
                              {v.type !== 'FLAT' && <span className="bg-slate-100 text-brand-dark px-3 py-1 rounded-xl text-xs font-black tracking-tighter border border-slate-200">{v.value}%</span>}
                              {v.type === 'MIXED' && <span className="text-slate-300 font-black">+</span>}
                              {v.type !== 'PERCENT' && <span className="bg-slate-800 text-white px-3 py-1 rounded-xl text-xs font-black tracking-tighter">{v.flatValue}H</span>}
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
          <div className="bg-white rounded-[3rem] border border-slate-50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="px-12 py-8 bg-slate-50/30 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 brand-bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-brand-dark font-heading uppercase tracking-tight">{t('admin.teamManagement')}</h2>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {users.length} Membros da Equipe
                </div>
                <button
                  onClick={() => { resetNewUserForm(); setShowNewUser(true); }}
                  className="flex items-center space-x-2 px-5 py-2.5 brand-bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
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
                    <div className="text-sm font-black uppercase tracking-tight text-brand-dark">{t('admin.newUser')}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1">{t('admin.newUserSubtitle')}</div>
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
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">{t('admin.emailRequired')}</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder={t('admin.emailPlaceholder')}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">{t('admin.displayNameField')}</label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder={t('admin.fullNamePlaceholder')}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">{t('admin.passwordRequired')}</label>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder={t('admin.passwordPlaceholder')}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">{t('segment.label')}</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-primary transition-all"
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
                      <div className="text-[10px] font-black uppercase tracking-widest text-brand-dark">{t('admin.adminPrivilege')}</div>
                      <div className="text-[9px] font-bold text-slate-400">{t('segment.adminHint')}</div>
                    </div>
                    <ShieldCheck className={`w-4 h-4 ml-2 ${newUserRole === 'ADMIN' ? 'text-brand-primary' : 'text-slate-300'}`} />
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => { setShowNewUser(false); resetNewUserForm(); }}
                      disabled={isPending}
                      className="px-5 py-3 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-60"
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
                      className="px-5 py-3 brand-bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-60 flex items-center space-x-2"
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
                    <th className="px-12 py-6 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">{t('admin.member')}</th>
                    <th className="px-12 py-6 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">{t('segment.label')}</th>
                    <th className="px-12 py-6 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">{t('admin.access')}</th>
                    <th className="px-12 py-6 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((user: any) => (
                    <tr key={user.id} className="hover:bg-slate-50/30 transition-all group">
                      <td className="px-12 py-8">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-2xl brand-bg-primary flex items-center justify-center text-white font-black text-sm shadow-md group-hover:scale-110 transition-transform uppercase">
                            {user.name?.[0] || user.email[0]}
                          </div>
                          <div>
                            <div className="text-sm font-black text-brand-dark uppercase tracking-tight">{user.name || t('admin.noName')}</div>
                            <div className="flex items-center text-[10px] font-bold text-slate-400 mt-1">
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
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-primary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {SEGMENTS.map((seg) => (
                            <option key={seg} value={seg}>{t(SEGMENT_LABEL_KEYS[seg])}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-12 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
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
