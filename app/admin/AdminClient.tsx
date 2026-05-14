'use client';

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
  updateUserRoleAction,
  addPackageAction,
  deletePackageAction,
  updateUserAdminStatusAction,
  reseedFrameworkAction
} from './actions';
import { addVariableAction, deleteVariableAction, updateVariableAction } from './variable_actions';

export default function AdminClient({ packages, categories, skills, variables, versions, users }: any) {
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

  // Form States for new items
  const [newItemName, setNewItemName] = useState('');
  const [newItemHours, setNewItemHours] = useState('');
  const [newItemSkill, setNewItemSkill] = useState('Implantação');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemTooltip, setNewItemTooltip] = useState('');
  const [newItemDependsOn, setNewItemDependsOn] = useState('');

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg: any) => {
      const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSkill = !filterSkill || pkg.skillName === filterSkill;
      const matchesCategory = !filterCategory || pkg.categoryName === filterCategory;
      return matchesSearch && matchesSkill && matchesCategory;
    });
  }, [packages, searchQuery, filterSkill, filterCategory]);

  const handleStartEdit = (pkg: any) => {
    setEditingId(pkg.id);
    setEditValues({
      name: pkg.name,
      hours: pkg.hours,
      skillName: pkg.skillName,
      categoryName: pkg.categoryName,
      tooltip: pkg.tooltip || '',
      dependsOnItemId: pkg.dependsOnItemId || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    startTransition(async () => {
      await updatePackageAction(editingId, editValues);
      setEditingId(null);
    });
  };

  const handleStartEditVariable = (v: any) => {
    setEditingVariableId(v.id);
    setEditVariableValues({
      key: v.key,
      value: v.value,
      category: v.category,
      type: v.type,
      flatValue: v.flatValue || 0,
      targetItems: JSON.parse(v.targetItems || '[]'),
      targetCategories: JSON.parse(v.targetCategories || '[]')
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
    formData.append('hours', newItemHours);
    formData.append('skillName', newItemSkill);
    formData.append('categoryName', newItemCategory);
    formData.append('tooltip', newItemTooltip);
    formData.append('dependsOnItemId', newItemDependsOn);

    startTransition(async () => {
      await addPackageAction(formData);
      setNewItemName('');
      setNewItemHours('');
      setNewItemTooltip('');
      setNewItemDependsOn('');
    });
  };

  const handleAddCategory = () => {
    const name = prompt("Nome da nova categoria:");
    if (name) startTransition(() => addCategoryAction(name));
  };

  const handleAddSkill = () => {
    const name = prompt("Nome da nova skill:");
    if (name) startTransition(() => addSkillAction(name));
  };

  const handleCreateSnapshot = async () => {
    const name = prompt("Nome para este snapshot (ex: Framework v2.0):", "Snapshot " + new Date().toLocaleDateString());
    if (!name) return;

    startTransition(async () => {
      try {
        await createFrameworkSnapshotAction(name);
        alert("Snapshot criado com sucesso!");
      } catch (e) {
        alert("Erro ao criar snapshot.");
      }
    });
  };

  const handleRestore = (id: number, name: string) => {
    if (confirm(`Deseja restaurar o snapshot "${name}"? Isso substituirá as configurações atuais.`)) {
      startTransition(async () => {
        await restoreFrameworkSnapshotAction(id);
      });
    }
  };

  const handleDeletePackage = (id: number, name: string) => {
    if (confirm(`Deseja remover o pacote "${name}"?`)) {
      startTransition(async () => {
        await deletePackageAction(id);
      });
    }
  };

  const handleDeleteVariable = (id: number, key: string) => {
    if (confirm(`Deseja remover a variável "${key}"?`)) {
      startTransition(async () => {
        await deleteVariableAction(id);
      });
    }
  };

  const handleDeleteUser = (id: number, email: string) => {
    if (confirm(`Tem certeza que deseja excluir o usuário ${email}?`)) {
      startTransition(async () => {
        await deleteUserAction(id);
      });
    }
  };

  const handleUpdateRole = async (id: number, role: string) => {
    startTransition(async () => {
      await updateUserRoleAction(id, role);
    });
  };

  const handleReseed = () => {
    if (confirm("Deseja restaurar a biblioteca para o padrão de fábrica? Isso recuperará todos os pacotes excluídos e não afetará os snapshots salvos.")) {
      startTransition(async () => {
        await reseedFrameworkAction();
      });
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-brand-dark tracking-tighter font-heading uppercase">Central de Comando</h1>
          <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest">Gestão de pacotes, variáveis globais e controle de versões.</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={handleReseed}
            disabled={isPending}
            className="flex-1 md:flex-none bg-amber-50 text-amber-600 border border-amber-200 px-6 py-4 rounded-2xl font-black hover:bg-amber-100 transition-all flex items-center justify-center space-x-3 text-xs uppercase tracking-widest disabled:opacity-50"
            title="Restaurar Biblioteca Padrão"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>Reset Factory</span>
          </button>
          <button 
            onClick={handleCreateSnapshot}
            disabled={isPending}
            className="flex-1 md:flex-none brand-bg-primary text-white px-8 py-4 rounded-2xl font-black hover:opacity-90 shadow-xl btn-premium transition-all flex items-center justify-center space-x-3 text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Novo Snapshot</span>
          </button>
          <button className="flex-1 md:flex-none bg-brand-dark text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all flex items-center justify-center space-x-3 text-xs uppercase tracking-widest shadow-xl">
            <Download className="w-4 h-4" />
            <span>Exportar Dados</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-50/50 p-2 rounded-[2rem] border border-slate-300 w-fit mx-auto md:mx-0 shadow-sm">
        <nav className="flex space-x-1">
          {[
            { id: 'versions', label: 'Versões & Rollback', icon: History },
            { id: 'packages', label: 'Biblioteca', icon: Box },
            { id: 'variables', label: 'Variáveis', icon: Settings },
            { id: 'users', label: 'Usuários', icon: Users },
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
              <h2 className="text-xl font-black text-brand-dark font-heading uppercase tracking-tight">Histórico de Snapshots</h2>
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
                        <span>{new Date(version.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRestore(version.id, version.versionName)}
                      className="bg-white text-brand-primary px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                    >
                      Restaurar
                    </button>
                  </div>
                </li>
              ))}
              {versions.length === 0 && (
                <li className="px-12 py-24 text-center">
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest italic">Nenhum registro encontrado</p>
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
                { id: 'items', label: 'Itens', icon: Box },
                { id: 'categories', label: 'Categorias', icon: Layout },
                { id: 'skills', label: 'Skills', icon: Activity },
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
                    <h3 className="text-lg font-black text-brand-dark font-heading uppercase tracking-tight">Novo Item</h3>
                  </div>
                  <form onSubmit={handleAddPackage} className="space-y-4">
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Nome</label>
                      <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-brand-primary outline-none" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Horas</label>
                        <input type="number" step="0.01" min="0" value={newItemHours} onChange={(e) => setNewItemHours(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black focus:ring-2 focus:ring-brand-primary outline-none text-center" required />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Skill</label>
                        <select value={newItemSkill} onChange={(e) => setNewItemSkill(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[9px] font-black focus:ring-2 focus:ring-brand-primary outline-none appearance-none cursor-pointer uppercase">
                          {skills.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Categoria</label>
                      <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[9px] font-black focus:ring-2 focus:ring-brand-primary outline-none appearance-none cursor-pointer uppercase" required>
                        <option value="">Selecionar...</option>
                        {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Depende de (Opcional)</label>
                      <select value={newItemDependsOn} onChange={(e) => setNewItemDependsOn(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[9px] font-black focus:ring-2 focus:ring-brand-primary outline-none appearance-none cursor-pointer uppercase">
                        <option value="">Nenhum</option>
                        {packages.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Tooltip (Opcional)</label>
                      <textarea value={newItemTooltip} onChange={(e) => setNewItemTooltip(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-brand-primary outline-none h-20 resize-none" />
                    </div>
                    <button type="submit" disabled={isPending} className="w-full brand-bg-primary text-white py-4 rounded-xl font-black uppercase tracking-widest hover:opacity-90 shadow-xl text-[10px] disabled:opacity-50">
                      {isPending ? 'Processando...' : 'Adicionar Item'}
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
                      Todos
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
                        placeholder="Buscar por nome..." 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                      />
                    </div>
                    <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none">
                      <option value="">Todas as Skills</option>
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
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                    <table className="min-w-full">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-8 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                          <th className="px-8 py-5 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest w-24">Horas</th>
                          <th className="px-8 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Organização</th>
                          <th className="px-8 py-5 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredPackages.map((pkg: any) => (
                          <tr key={pkg.id} className={`hover:bg-slate-50/30 transition-all group ${editingId === pkg.id ? 'bg-brand-primary/5' : ''}`}>
                            <td className="px-8 py-6">
                              {editingId === pkg.id ? (
                                <div className="space-y-2">
                                  <input 
                                    type="text" 
                                    value={editValues.name} 
                                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                    className="w-full bg-white border border-brand-primary/30 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                                  />
                                  <input 
                                    type="text" 
                                    placeholder="Tooltip..."
                                    value={editValues.tooltip} 
                                    onChange={(e) => setEditValues({ ...editValues, tooltip: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-[10px] outline-none"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <div className="text-sm font-black text-brand-dark uppercase tracking-tight">{pkg.name}</div>
                                  {pkg.tooltip && (
                                    <div className="group/tooltip relative cursor-help">
                                      <Info className="w-3 h-3 text-slate-300 hover:text-brand-primary transition-colors" />
                                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-brand-dark text-white text-[9px] font-bold p-3 rounded-xl w-48 shadow-2xl opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50">
                                        {pkg.tooltip}
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
                                  className="w-16 bg-white border border-brand-primary/30 rounded-lg px-2 py-1.5 text-xs font-black text-center outline-none"
                                />
                              ) : (
                                <span className="bg-brand-dark text-white px-3 py-1 rounded-lg text-[10px] font-black tracking-tighter">{pkg.hours}H</span>
                              )}
                            </td>
                            <td className="px-8 py-6">
                              {editingId === pkg.id ? (
                                <div className="space-y-2">
                                  <select 
                                    value={editValues.categoryName} 
                                    onChange={(e) => setEditValues({ ...editValues, categoryName: e.target.value })}
                                    className="w-full bg-white border border-brand-primary/30 rounded-lg px-2 py-1 text-[9px] font-black uppercase"
                                  >
                                    {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                                  </select>
                                  <select 
                                    value={editValues.skillName} 
                                    onChange={(e) => setEditValues({ ...editValues, skillName: e.target.value })}
                                    className="w-full bg-white border border-brand-primary/30 rounded-lg px-2 py-1 text-[9px] font-black uppercase"
                                  >
                                    {skills.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                                  </select>
                                  <select 
                                    value={editValues.dependsOnItemId} 
                                    onChange={(e) => setEditValues({ ...editValues, dependsOnItemId: e.target.value })}
                                    className="w-full bg-white border border-brand-primary/30 rounded-lg px-2 py-1 text-[9px] font-black uppercase"
                                  >
                                    <option value="">Sem Dependência</option>
                                    {packages.filter((p: any) => p.id !== pkg.id).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                </div>
                              ) : (
                                <div className="flex flex-col space-y-1">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{pkg.categoryName}</span>
                                  <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-black uppercase tracking-tighter w-fit">{pkg.skillName}</span>
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
                  <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Gestão de Categorias</h3>
                  <button onClick={handleAddCategory} className="bg-brand-primary text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center space-x-2 shadow-lg">
                    <Plus className="w-4 h-4" />
                    <span>Nova Categoria</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categories.map((c: any) => (
                    <div key={c.id} className="group bg-slate-50 p-6 rounded-2xl border border-slate-100 flex justify-between items-center hover:border-brand-primary transition-all">
                      <span className="text-sm font-black text-brand-dark uppercase tracking-tight">{c.name}</span>
                      <button onClick={() => startTransition(() => deleteCategoryAction(c.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeLibraryTab === 'skills' && (
              <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-2xl p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Gestão de Skills</h3>
                  <button onClick={handleAddSkill} className="bg-brand-primary text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center space-x-2 shadow-lg">
                    <Plus className="w-4 h-4" />
                    <span>Nova Skill</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {skills.map((s: any) => (
                    <div key={s.id} className="group bg-slate-50 p-6 rounded-2xl border border-slate-100 flex justify-between items-center hover:border-brand-primary transition-all">
                      <span className="text-sm font-black text-brand-dark uppercase tracking-tight">{s.name}</span>
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
                <h3 className="text-xl font-black text-brand-dark font-heading uppercase tracking-tight">Nova Variável</h3>
              </div>
              <form action={addVariableAction} className="space-y-6">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Chave (Key)</label>
                  <input type="text" name="key" placeholder="Ex: VALOR_HORA_GP" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all uppercase" required />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Valor / Porcentagem</label>
                  <input type="text" name="value" placeholder="Ex: 25 ou 0.5" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Tipo</label>
                    <select name="type" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-widest outline-none">
                      <option value="PERCENT">% Porcentagem</option>
                      <option value="FLAT">Valor Fixo (H)</option>
                      <option value="MIXED">Misto (% + H)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Valor Fixo (H)</label>
                    <input type="number" step="0.01" name="flatValue" placeholder="0.00" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Categoria</label>
                  <input type="text" name="category" list="var-categories" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" required />
                  <datalist id="var-categories">
                    <option value="Preços" />
                    <option value="Configurações" />
                    <option value="Limites" />
                  </datalist>
                </div>
                <button type="submit" className="w-full brand-bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:opacity-90 shadow-xl btn-premium text-xs">
                  Salvar Variável
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-50 shadow-2xl overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-slate-50/30 border-b border-slate-50">
                  <tr>
                    <th className="px-10 py-6 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Chave / Categoria</th>
                    <th className="px-10 py-6 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Valor</th>
                    <th className="px-10 py-6 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Ações</th>
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
                              value={editVariableValues.category} 
                              onChange={(e) => setEditVariableValues({ ...editVariableValues, category: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-bold outline-none"
                              placeholder="Categoria..."
                            />
                            
                            <div className="space-y-2 border-t pt-4">
                              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Incidência (Itens)</label>
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
                              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Incidência (Categorias)</label>
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
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-black text-brand-dark group-hover:text-brand-primary transition-all uppercase tracking-tight">{v.key}</div>
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
                <h2 className="text-xl font-black text-brand-dark font-heading uppercase tracking-tight">Gestão de Equipe</h2>
              </div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {users.length} Membros da Equipe
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50/10 border-b border-slate-50">
                  <tr>
                    <th className="px-12 py-6 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Membro</th>
                    <th className="px-12 py-6 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Cargo / Role</th>
                    <th className="px-12 py-6 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Acesso</th>
                    <th className="px-12 py-6 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Ações</th>
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
                            <div className="text-sm font-black text-brand-dark uppercase tracking-tight">{user.name || 'Sem Nome'}</div>
                            <div className="flex items-center text-[10px] font-bold text-slate-400 mt-1">
                              <Mail className="w-3 h-3 mr-1.5" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-12 py-8">
                        <select 
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-primary transition-all cursor-pointer"
                        >
                          <option value="USER">User</option>
                          <option value="SC">SC (Admin)</option>
                          <option value="AE">AE (Consulting)</option>
                          <option value="DEV">Desenvolvimento</option>
                        </select>
                      </td>
                      <td className="px-12 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                            <Calendar className="w-3 h-3 mr-1.5" />
                            Desde {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </td>
                      <td className="px-12 py-8 text-right">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => {
                              startTransition(async () => {
                                await updateUserAdminStatusAction(user.id, !user.isAdmin);
                              });
                            }}
                            disabled={isPending}
                            className={`p-2 rounded-xl border transition-all ${
                              user.isAdmin 
                                ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' 
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-brand-primary/30'
                            }`}
                            title={user.isAdmin ? 'Remover privilégio Admin' : 'Tornar Admin'}
                          >
                            {user.isAdmin ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                          </button>
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
