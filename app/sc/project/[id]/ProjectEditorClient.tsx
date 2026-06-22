'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { 
  Save, Copy, Download, Link as LinkIcon, Box, Check, ChevronDown, Plus, Trash2, Shield, Search, Zap, Layout, Settings, Users, Loader2,
  CheckSquare, Bot, MessageSquare, AlertTriangle, ShieldCheck, CheckCircle2, RotateCcw, EyeOff, Eye, X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveProjectVersionAction, cloneProjectVersionAction } from './actions';
import { updateUserPreferenceAction, savePresetAction, deletePresetAction } from '@/lib/preferences';

export default function ProjectEditorClient({ project, categories, packagesByCategory, currentVersion, allVersions, variables, preferences }: any) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hiddenItems, setHiddenItems] = useState<number[]>(preferences?.hiddenItems ? JSON.parse(preferences.hiddenItems) : []);
  const [presetName, setPresetName] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [showHiddenTab, setShowHiddenTab] = useState(false);
  
  const presets = preferences?.presets ? JSON.parse(preferences.presets) : [];

  const handleSavePreset = async () => {
    if (!presetName) return;
    await savePresetAction(presetName, hiddenItems.map(String));
    setPresetName('');
    alert('Preset salvo com sucesso! Este preset agora está disponível apenas para você.');
  };

  const applyPreset = (preset: any) => {
    setHiddenItems(preset.hiddenItems.map(Number));
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
  const [techLink, setTechLink] = useState(currentVersion?.technical_scope_link || '');
  
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
  const allPackages = useMemo(() => {
    return Object.values(packagesByCategory).flat();
  }, [packagesByCategory]);

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

  // Calculation Engine
  const totals = useMemo(() => {
    let subtotal = 0;
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
      
      let base = 0;
      if (targets.length === 0 && targetCats.length === 0) {
        base = subtotal;
      } else {
        targets.forEach((id: string) => { base += (itemTotals[parseInt(id)] || 0); });
        targetCats.forEach((cat: string) => { base += (catTotals[cat] || 0); });
      }

      // Calculate based on type
      let result = 0;
      const pctValue = manualPercent; // Use manual percent from UI if available
      
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

    // Add calculated GP to skill totals for UI display
    skillTotals['GP'] = (skillTotals['GP'] || 0) + gpVal;

    return {
      subtotal,
      skillTotals,
      gpVal,
      discVal,
      validVal,
      grandTotal: Math.ceil(subtotal + gpVal + discVal + validVal)
    };
  }, [formData, customPackages, percents, overrides, packagesByCategory, variables]);

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
      console.log('Update FormData:', name, finalValue, newData);
      return newData;
    });
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
          gpPercent: percents.gp,
          discoveryPercent: percents.discovery,
          validationPercent: percents.validation,
          gpOverride: overrides.gp,
          discoveryOverride: overrides.discovery,
          validationOverride: overrides.validation,
          data: formData
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                              <span className="text-[7px] text-slate-300 font-black">{p.hiddenItems.length} itens ocultos</span>
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
          {categories.map((cat: string) => {
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
                className={`group flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all cursor-pointer select-none ${
                  isChecked 
                    ? 'bg-brand-primary border-brand-primary' 
                    : 'border-slate-50 bg-slate-50/30 hover:bg-white hover:border-brand-primary/30 hover:shadow-xl'
                }`}
              >
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

        {categories.map((cat: string) => (
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
                          <th className="pb-3 text-right text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Ajuste Manual</th>
                          <th className="pb-3 text-right text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {packagesByCategory[cat]
                          .filter((p: any) => !hiddenItems.includes(p.id))
                          .map((p: any) => {
                          // Conditional Logic: Show Item X only if Item Y has a value
                          const isDependencyMet = !p.dependsOnItemId || 
                                                 (formData[`item_${p.dependsOnItemId}_qty`] > 0);
                          
                          if (!isDependencyMet) return null;

                          const qty = parseFloat(formData[`item_${p.id}_qty`] || 0);
                          const isOverride = formData[`item_override_check_${p.id}`] === 'on';
                          const overrideVal = parseFloat(formData[`item_override_val_${p.id}`] || 0);
                          const rowTotal = isOverride ? overrideVal : qty * p.hours;

                          return (
                            <tr key={p.id} className={`hover:bg-slate-50/20 transition-colors group ${hiddenItems.includes(p.id) ? 'opacity-40' : ''}`}>
                              <td className="py-4 pr-4">
                                <div className="flex items-center space-x-2">
                                  <div className="font-black text-brand-dark text-xs mb-0.5 tracking-tight uppercase">{p.name}</div>
                                  <button 
                                    type="button"
                                    onClick={() => toggleHideItem(p.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                                    title={hiddenItems.includes(p.id) ? "Mostrar Item" : "Ocultar Item"}
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
                                    className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-black text-center focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all"
                                  />
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
