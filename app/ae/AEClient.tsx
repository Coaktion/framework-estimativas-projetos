'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Search, Zap, Plus, X, ShieldCheck, 
  User, Briefcase, Globe, Layers, 
  Settings, CheckSquare, Save, Loader2,
  AlertTriangle, CheckCircle2, Bot, 
  MessageSquare, Users, Shield, Clock
} from 'lucide-react';
import Link from 'next/link';
import { saveAEEstimateAction } from './actions';

export default function AEClient({ packages, variables, initialClientName = '' }: any) {
  const [isPending, setIsPending] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Form States
  const [clientName, setClientName] = useState(initialClientName);
  
  const resetForm = () => {
    setClientName('');
    setAgents(0);
    setBrands(0);
    setSelectedChannels([]);
    setAreas(0);
    setHasIntegration(false);
    setHasQA(false);
    setHasWFM(false);
    setHasCopilot(false);
    setCopilotType('none');
    setHasAIAgents(false);
    setShowResult(false);
  };

  // Reset form when client name changes from external source (like refazer simulação)
  useEffect(() => {
    if (initialClientName) {
      setClientName(initialClientName);
    } else {
      resetForm();
    }
  }, [initialClientName]);

  const handleNewSimulation = () => {
    resetForm();
    // Recarrega a URL sem parâmetros
    window.history.pushState({}, '', '/ae');
  };
  const [agents, setAgents] = useState(0);
  const [brands, setBrands] = useState(0);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [areas, setAreas] = useState(0);
  const [hasIntegration, setHasIntegration] = useState(false);
  const [hasQA, setHasQA] = useState(false);
  const [hasWFM, setHasWFM] = useState(false);
  const [hasCopilot, setHasCopilot] = useState(false);
  const [copilotType, setCopilotType] = useState('none'); // 'none', 'with_api', 'without_api'
  const [hasAIAgents, setHasAIAgents] = useState(false);

  // Channels Checklist
  const channelOptions = [
    { id: 'email', label: 'Email', package: 'Ticket: Email (por endereço)' },
    { id: 'web_widget', label: 'Web Widget', package: 'Messaging: Web Widget (por widget)' },
    { id: 'whatsapp', label: 'WhatsApp', package: 'Messaging: LINE' }, // LINE used as proxy for generic messaging hours
    { id: 'facebook', label: 'Facebook', package: 'Messaging: Facebook Messenger (por página)' },
    { id: 'instagram', label: 'Instagram', package: 'Messaging: Instagram Direct (por página)' },
    { id: 'voice', label: 'Voice (Zendesk)', package: 'Voz: Configurações gerais (Fila, Espera)' },
    { id: 'teams', label: 'MS Teams', package: 'Ticket: Microsoft Teams integration' },
    { id: 'slack', label: 'Slack', package: 'Messaging: Slack' }
  ];

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Calculation Logic
  const estimation = useMemo(() => {
    let techHours = 0;

    // 1. Base Config (always included if client name is set)
    const basePkg = packages.find((p: any) => p.name.includes('Configurações gerais (Config Base)'));
    if (basePkg) techHours += basePkg.hours;

    // 2. Agents (0.03h per agent)
    const agentPkg = packages.find((p: any) => p.name.includes('Membros de equipe'));
    if (agentPkg && agents > 0) techHours += (agents * agentPkg.hours);

    // 3. Brands (0.25h per brand)
    const brandPkg = packages.find((p: any) => p.name.includes('Support: Marcas'));
    if (brandPkg && brands > 0) techHours += (brands * brandPkg.hours);

    // 4. Channels
    selectedChannels.forEach(channelId => {
      const opt = channelOptions.find(o => o.id === channelId);
      const pkg = packages.find((p: any) => p.name.includes(opt?.package));
      if (pkg) techHours += pkg.hours;
    });

    // 5. Areas (Custom calculation: 2h per area beyond the first)
    if (areas > 1) techHours += (areas - 1) * 2;

    // 6. Integration (5h per generic integration)
    if (hasIntegration) {
      const intPkg = packages.find((p: any) => p.name.includes('Compartilhamento: Com outros sistemas'));
      if (intPkg) techHours += intPkg.hours;
    }

    // 7. QA (1.12h base)
    if (hasQA) {
      const qaPkg = packages.find((p: any) => p.name.includes('QA: Configurações gerais'));
      if (qaPkg) techHours += qaPkg.hours;
    }

    // 8. WFM (0.35h base)
    if (hasWFM) {
      const wfmPkg = packages.find((p: any) => p.name.includes('WFM: Configurações gerais'));
      if (wfmPkg) techHours += wfmPkg.hours;
    }

    // 9. Copilot (0.37h base + 1h for API if selected)
    if (hasCopilot) {
      const copilotPkg = packages.find((p: any) => p.name.includes('Copilot: Configuração básica'));
      if (copilotPkg) techHours += copilotPkg.hours;
      if (copilotType === 'with_api') techHours += 10; // App Builder with API as proxy
    }

    // 10. AI Agents (1.88h base)
    if (hasAIAgents) {
      const aiPkg = packages.find((p: any) => p.name.includes('AI Advanced: Configurações básicas'));
      if (aiPkg) techHours += aiPkg.hours;
    }

    // GP Calculation
    const aeGpVar = variables?.find((v: any) => v.key === 'AE_GP_PERCENTAGE');
    const gpPercent = aeGpVar ? parseFloat(aeGpVar.value) : 0.15;
    const gpHours = techHours * gpPercent;
    const total = techHours + gpHours;

    const needsSC = total > 60;

    return {
      techHours,
      gpHours,
      total,
      needsSC,
      gpPercent: gpPercent * 100
    };
  }, [agents, brands, selectedChannels, areas, hasIntegration, hasQA, hasWFM, hasCopilot, copilotType, hasAIAgents, packages, variables]);

  const handleCalculate = async () => {
    setIsPending(true);
    setShowResult(true);

    try {
      await saveAEEstimateAction({
        clientName,
        agents,
        brands,
        channels: selectedChannels,
        areas,
        hasIntegration,
        hasQA,
        hasWFM,
        hasCopilot,
        copilotType,
        hasAIAgents,
        resultHours: estimation.total,
        needsSC: estimation.needsSC
      });
    } catch (error) {
      console.error("Error saving estimate:", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-6xl font-black text-brand-dark tracking-tighter font-heading uppercase leading-none">
              Calculadora <span className="text-brand-primary">AE</span>
            </h1>
            <p className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-[0.2em]">Estimativa rápida de esforço técnico para vendas.</p>
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/ae/history"
              className="bg-white border border-slate-200 text-slate-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 hover:border-brand-primary hover:text-brand-primary transition-all"
            >
              <Clock className="w-4 h-4" />
              <span>Meu Histórico</span>
            </Link>
            {showResult && (
              <button 
                onClick={handleNewSimulation}
                className="text-brand-primary font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 hover:opacity-70 transition-all"
              >
                <Plus className="w-4 h-4 rotate-45" />
                <span>Nova Simulação</span>
              </button>
            )}
          </div>
        </div>

      {!showResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Form Column */}
          <div className="space-y-8 bg-white rounded-[3rem] border border-slate-200 p-12 shadow-xl shadow-slate-200/50">
            <div className="space-y-10">
              {/* Client Name */}
              <div className="space-y-3">
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  <User className="w-3 h-3" />
                  <span>Nome do Cliente</span>
                </label>
                <input 
                  type="text" 
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Aktie Now"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all placeholder:text-slate-300"
                />
              </div>

              {/* Numbers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    <Users className="w-3 h-3" />
                    <span>Agentes</span>
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={agents}
                    onChange={(e) => setAgents(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    <Briefcase className="w-3 h-3" />
                    <span>Marcas</span>
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={brands}
                    onChange={(e) => setBrands(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    <Layers className="w-3 h-3" />
                    <span>Áreas</span>
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={areas}
                    onChange={(e) => setAreas(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>

              {/* Channels */}
              <div className="space-y-4">
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  <Globe className="w-3 h-3" />
                  <span>Canais Ativos</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {channelOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => toggleChannel(opt.id)}
                      className={`p-3 rounded-xl border text-[9px] font-black uppercase tracking-tight transition-all ${
                        selectedChannels.includes(opt.id)
                          ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-green-900/10'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-brand-primary/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Features Column */}
          <div className="space-y-8 bg-slate-50/50 rounded-[3rem] border border-slate-200 p-12 shadow-inner">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Integration */}
              <div className="space-y-4">
                <label className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-200 cursor-pointer hover:border-brand-primary/30 transition-all group">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-xl transition-all ${hasIntegration ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Settings className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Integração</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={hasIntegration} 
                    onChange={(e) => setHasIntegration(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-slate-200 text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                </label>
              </div>

              {/* QA */}
              <div className="space-y-4">
                <label className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-200 cursor-pointer hover:border-brand-primary/30 transition-all group">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-xl transition-all ${hasQA ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">QA</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={hasQA} 
                    onChange={(e) => setHasQA(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-slate-200 text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                </label>
              </div>

              {/* WFM */}
              <div className="space-y-4">
                <label className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-200 cursor-pointer hover:border-brand-primary/30 transition-all group">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-xl transition-all ${hasWFM ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">WFM</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={hasWFM} 
                    onChange={(e) => setHasWFM(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-slate-200 text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                </label>
              </div>

              {/* AI Agents */}
              <div className="space-y-4">
                <label className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-200 cursor-pointer hover:border-brand-primary/30 transition-all group">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-xl transition-all ${hasAIAgents ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Bot className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">AI Agents</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={hasAIAgents} 
                    onChange={(e) => setHasAIAgents(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-slate-200 text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Copilot Section */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 space-y-6">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-2xl transition-all ${hasCopilot ? 'bg-brand-primary text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">Copilot</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={hasCopilot} 
                  onChange={(e) => {
                    setHasCopilot(e.target.checked);
                    if (!e.target.checked) setCopilotType('none');
                    else setCopilotType('without_api');
                  }}
                  className="w-6 h-6 rounded-xl border-slate-200 text-brand-primary focus:ring-brand-primary cursor-pointer"
                />
              </label>

              {hasCopilot && (
                <div className="grid grid-cols-2 gap-4 pt-4 animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={() => setCopilotType('without_api')}
                    className={`p-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                      copilotType === 'without_api'
                        ? 'bg-brand-secondary border-brand-secondary text-white shadow-lg'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-brand-secondary/30'
                    }`}
                  >
                    Sem Conexão Externa
                  </button>
                  <button
                    onClick={() => setCopilotType('with_api')}
                    className={`p-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                      copilotType === 'with_api'
                        ? 'bg-brand-secondary border-brand-secondary text-white shadow-lg'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-brand-secondary/30'
                    }`}
                  >
                    Com Conexão Externa
                  </button>
                </div>
              )}
            </div>

            {/* Action Button */}
            <button
              onClick={handleCalculate}
              disabled={!clientName}
              className="w-full bg-brand-dark text-white p-8 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-4 disabled:opacity-50 disabled:scale-100"
            >
              <Zap className="w-5 h-5" />
              <span>Gerar Estimativa</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-in zoom-in-95 fade-in duration-500 max-w-4xl mx-auto">
          <div className={`rounded-[4rem] p-16 shadow-2xl relative overflow-hidden text-center space-y-12 ${
            estimation.needsSC ? 'bg-amber-50 border-4 border-amber-200' : 'bg-brand-dark text-white'
          }`}>
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              {estimation.needsSC ? <AlertTriangle className="w-64 h-64 text-amber-500" /> : <ShieldCheck className="w-64 h-64 text-white" />}
            </div>

            <div className="relative z-10 space-y-8">
              <div className="flex flex-col items-center space-y-4">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl ${
                  estimation.needsSC ? 'bg-amber-200 text-amber-700' : 'brand-bg-primary text-white'
                }`}>
                  {estimation.needsSC ? <AlertTriangle className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-[0.3em] ${estimation.needsSC ? 'text-amber-600' : 'text-slate-400'}`}>
                    Resultado para {clientName}
                  </h3>
                </div>
              </div>

              <div className="space-y-2">
                <div className={`text-8xl font-black tracking-tighter ${estimation.needsSC ? 'text-amber-700' : 'text-brand-accent'}`}>
                  {estimation.needsSC ? 'CONSULTAR SC' : `${estimation.total.toFixed(0)}H`}
                </div>
                <p className={`text-lg font-bold uppercase tracking-widest ${estimation.needsSC ? 'text-amber-600' : 'text-slate-400'}`}>
                  {estimation.needsSC ? 'Esforço Necessita de SC' : 'Esforço Estimado'}
                </p>
              </div>

              {!estimation.needsSC && (
                <div className="grid grid-cols-2 gap-8 max-w-lg mx-auto pt-8 border-t border-white/10">
                  <div className="text-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Técnico</span>
                    <span className="text-2xl font-black tracking-tight">{estimation.techHours.toFixed(1)}H</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">GP ({estimation.gpPercent}%)</span>
                    <span className="text-2xl font-black tracking-tight text-brand-secondary">{estimation.gpHours.toFixed(1)}H</span>
                  </div>
                </div>
              )}
            </div>

            <div className="relative z-10 pt-10">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {isPending ? (
                  <div className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando Registro...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-widest text-brand-primary">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Registro Salvo com Sucesso</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-12 text-center">
          </div>
        </div>
      )}
    </div>
  );
}
