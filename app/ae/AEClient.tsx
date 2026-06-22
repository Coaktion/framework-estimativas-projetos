'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Search, Zap, Plus, X, ShieldCheck, 
  User, Briefcase, Globe, Layers, 
  Settings, CheckSquare, Save, Loader2,
  AlertTriangle, CheckCircle2, Bot, 
  MessageSquare, Users, Shield, Clock, Box,
  Copy
} from 'lucide-react';
import Link from 'next/link';
import { saveAEEstimateAction } from './actions';
import { calculateAEEstimate } from '@/lib/ae-engine';

export default function AEClient({ packages, variables, initialClientName = '' }: any) {
  const [isPending, setIsPending] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [markdownReport, setMarkdownReport] = useState('');

  // Form States
  const [clientName, setClientName] = useState(initialClientName);
  const [clientObjectives, setClientObjectives] = useState('');
  const [successIndicators, setSuccessIndicators] = useState('');
  
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [analyticsBasicReports, setAnalyticsBasicReports] = useState(0);
  const [analyticsAdvancedReports, setAnalyticsAdvancedReports] = useState(0);
  const [knowledgeArticles, setKnowledgeArticles] = useState(0);
  const [hasCommunity, setHasCommunity] = useState(false);
  const [hasHCCustomization, setHasHCCustomization] = useState(false);
  
  const [operationTypes, setOperationTypes] = useState<string[]>([]);
  const [skuType, setSkuType] = useState('customer_service');
  const [deploymentType, setDeploymentType] = useState('new');
  
  const [hasAppsMarketplace, setHasAppsMarketplace] = useState(false);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [otherApp, setOtherApp] = useState('');
  
  const [zendeskPlan, setZendeskPlan] = useState('professional');
  const [hasNativeConnections, setHasNativeConnections] = useState(false);
  const [selectedNativeConnections, setSelectedNativeConnections] = useState<string[]>([]);

  const [agents, setAgents] = useState(0);
  const [brands, setBrands] = useState(0);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [channelQuantities, setChannelQuantities] = useState<Record<string, number>>({});
  const [areas, setAreas] = useState(0);
  const [hasIntegration, setHasIntegration] = useState(false);
  const [hasQA, setHasQA] = useState(false);
  const [hasWFM, setHasWFM] = useState(false);
  const [hasCopilot, setHasCopilot] = useState(false);
  const [copilotType, setCopilotType] = useState('none'); // 'none', 'with_api', 'without_api'
  const [hasAIAgents, setHasAIAgents] = useState(false);

  const resetForm = () => {
    setClientName('');
    setClientObjectives('');
    setSuccessIndicators('');
    setSelectedModules([]);
    setAnalyticsBasicReports(0);
    setAnalyticsAdvancedReports(0);
    setKnowledgeArticles(0);
    setHasCommunity(false);
    setHasHCCustomization(false);
    setOperationTypes([]);
    setSkuType('customer_service');
    setDeploymentType('new');
    setHasAppsMarketplace(false);
    setSelectedApps([]);
    setOtherApp('');
    setZendeskPlan('professional');
    setHasNativeConnections(false);
    setSelectedNativeConnections([]);
    setAgents(0);
    setBrands(0);
    setSelectedChannels([]);
    setChannelQuantities({});
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
 
  // Channels Checklist
  const channelOptions = [
    { id: 'web_form', label: 'Web Form', package: 'Ticket: Formulários/Catálogos (por form)' },
    { id: 'email', label: 'Email', package: 'Ticket: Email (por endereço)' },
    { id: 'web_widget', label: 'Web Widget', package: 'Messaging: Web Widget (por widget)' },
    { id: 'whatsapp', label: 'WhatsApp', package: 'Messaging: LINE' },
    { id: 'facebook', label: 'Facebook', package: 'Messaging: Facebook Messenger (por página)' },
    { id: 'instagram', label: 'Instagram', package: 'Messaging: Instagram Direct (por página)' },
    { id: 'voice', label: 'Voice (Zendesk)', package: 'Voz: Configurações gerais (Fila, Espera)' },
    { id: 'teams', label: 'MS Teams', package: 'Ticket: Microsoft Teams integration' },
    { id: 'slack', label: 'Slack', package: 'Messaging: Slack' },
    { id: 'x', label: 'X (Twitter)', package: 'Ticket: X (Mensagens Públicas)' },
    { id: 'sms', label: 'SMS/Text', package: 'Messaging: Text/SMS (por número)' }
  ];

  const appOptions = ["Answer Bot", "Time Tracking", "Field Manager", "Conditional Fields", "Sidebar Search", "User Data", "Outros"];
  const connectionOptions = ["Salesforce", "Shopify", "Slack", "Jira", "Microsoft Teams", "HubSpot", "Microsoft Dynamics"];

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        const newChannels = prev.filter(i => i !== id);
        const newQuantities = { ...channelQuantities };
        delete newQuantities[id];
        setChannelQuantities(newQuantities);
        return newChannels;
      } else {
        setChannelQuantities(prev => ({ ...prev, [id]: 1 }));
        return [...prev, id];
      }
    });
  };

  const handleChannelQtyChange = (id: string, qty: number) => {
    setChannelQuantities(prev => ({ ...prev, [id]: Math.max(1, qty) }));
  };

  const toggleModule = (id: string) => {
    setSelectedModules(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleOperationType = (id: string) => {
    setOperationTypes(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleApp = (id: string) => {
    setSelectedApps(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleNativeConnection = (id: string) => {
    setSelectedNativeConnections(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Calculation Logic
  const estimation = useMemo(() => {
    const inputs = {
      agents, brands, areas, selectedChannels, channelQuantities,
      selectedModules, operationTypes, zendeskPlan, knowledgeArticles,
      hasCommunity, hasHCCustomization, hasQA, hasWFM, hasCopilot,
      copilotType, hasAIAgents, hasIntegration, hasAppsMarketplace, deploymentType
    };

    const { techHours, results, escalationRequired, escalationMessage } = calculateAEEstimate(inputs);

    // GP Calculation (Keep GP logic here as it depends on variables from DB)
    const aeGpVar = variables?.find((v: any) => v.key === 'AE_GP_PERCENTAGE' || v.key === 'GP_STANDARD');
    const gpPercent = aeGpVar ? (parseFloat(aeGpVar.value) / (aeGpVar.value.includes('%') ? 100 : (parseFloat(aeGpVar.value) > 1 ? 100 : 1))) : 0.15;
    const gpHours = techHours * gpPercent;
    const total = techHours + gpHours;

    const needsSC = total > 60;

    return {
      techHours,
      gpHours,
      total,
      needsSC,
      gpPercent: (gpPercent * 100).toFixed(0),
      escalationRequired,
      escalationMessage,
      calculatedResults: results
    };
  }, [
    agents, brands, selectedChannels, channelQuantities, areas, 
    selectedModules, analyticsBasicReports, analyticsAdvancedReports, knowledgeArticles, hasCommunity, hasHCCustomization,
    deploymentType, hasAppsMarketplace, selectedApps, hasNativeConnections, selectedNativeConnections,
    hasIntegration, hasQA, hasWFM, hasCopilot, copilotType, hasAIAgents, zendeskPlan, operationTypes,
    packages, variables
  ]);

  const handleCalculate = async () => {
    setIsPending(true);
    
    // Generate Markdown Report
    const res = estimation.calculatedResults;
    const report = `
# Relatório Executivo de Estimativa - ${clientName}

## 📊 Resumo de Volumes Estimados

### Support
| Item | Quantidade |
| :--- | :--- |
| Funções | ${res.support.funcoes} |
| Grupos | ${res.support.grupos} |
| Campos de Ticket | ${res.support.campos_ticket} |
| Condicionais de Campos | ${res.support.condicionais_campos} |
| Campos de Usuário | ${res.support.campos_usuario} |
| Campos de Organização | ${res.support.campos_organizacao} |
| Visualizações | ${res.support.visualizacoes} |
| Macros | ${res.support.macros} |
| Gatilhos (Simples/Complexos) | ${res.support.gatilhos_simples} / ${res.support.gatilhos_complexos} |
| Automações (Simples/Complexas) | ${res.support.automacoes_simples} / ${res.support.automacoes_complexas} |
| Políticas de SLA | ${res.support.politicas_sla} |

### Knowledge & Voice
- **Knowledge:** ${res.knowledge.horas_estimadas}h estimadas (${knowledgeArticles} artigos)
- **Voice (IVR/Saudações):** ${res.voice.ivr} níveis / ${res.voice.saudacoes} saudações

### Inteligência e Operação (WFM/QA/Copilot)
- **Copilot (Intenções/Entidades/Proced.):** ${res.copilot.intencoes_personalizadas} / ${res.copilot.entidades} / ${res.copilot.procedimentos}
- **WFM (Grupos/Equipes/Turnos):** ${res.wfm.grupos_trabalho} / ${res.wfm.equipes} / ${res.wfm.turnos}
- **QA (Filtros/Quizzes/Tabelas):** ${res.qa.filtros} / ${res.qa.quizzes} / ${res.qa.tabelas_desempenho}

### Apps Aktie Now
- **Condicionais Avançadas:** ${res.apps_aktie_now.condicionais_avancadas_horas}h
- **Ticket Manager:** ${res.apps_aktie_now.ticket_manager_horas}h

---
**Esforço Total Estimado:** ${estimation.total.toFixed(1)}h
${estimation.total > 60 ? `\n${estimation.escalationMessage}` : ''}
`;
    
    setMarkdownReport(report.trim());
    setShowResult(true);

    try {
      await saveAEEstimateAction({
        clientName,
        clientObjectives,
        successIndicators,
        selectedModules,
        analyticsBasicReports,
        analyticsAdvancedReports,
        knowledgeArticles,
        hasCommunity,
        hasHCCustomization,
        operationTypes,
        skuType,
        deploymentType,
        hasAppsMarketplace,
        selectedApps,
        otherApp,
        zendeskPlan,
        hasNativeConnections,
        selectedNativeConnections,
        agents,
        brands,
        channels: selectedChannels,
        channelQuantities,
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
          {/* Left Column: Strategic & Operation */}
          <div className="space-y-8">
            <div className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-xl shadow-slate-200/50 space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">Informações Estratégicas</h2>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Cliente</label>
                  <input 
                    type="text" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Aktie Now"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Objetivos e dores do cliente</label>
                  <textarea 
                    value={clientObjectives}
                    onChange={(e) => setClientObjectives(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all h-24 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Indicadores de sucesso</label>
                  <textarea 
                    value={successIndicators}
                    onChange={(e) => setSuccessIndicators(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all h-24 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-xl shadow-slate-200/50 space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary">
                  <Layers className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">Módulos, Operação e Serviços</h2>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Módulos</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {['Support', 'Knowledge', 'Analytics', 'ADPP', 'Callwe', 'Droz'].map(m => (
                      <button
                        key={m}
                        onClick={() => toggleModule(m)}
                        className={`p-3 rounded-xl border text-[9px] font-black uppercase tracking-tight transition-all ${
                          selectedModules.includes(m)
                            ? 'bg-brand-primary border-brand-primary text-white shadow-lg'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-brand-primary/30'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedModules.includes('Analytics') && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Relatórios Básicos</label>
                      <input type="number" value={analyticsBasicReports} onChange={(e) => setAnalyticsBasicReports(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Avançados</label>
                      <input type="number" value={analyticsAdvancedReports} onChange={(e) => setAnalyticsAdvancedReports(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black" />
                    </div>
                  </div>
                )}

                {selectedModules.includes('Knowledge') && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-6 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Quantidade de Artigos</label>
                      <input 
                        type="number" 
                        min="0"
                        value={knowledgeArticles} 
                        onChange={(e) => setKnowledgeArticles(Math.max(0, parseInt(e.target.value) || 0))} 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black" 
                        placeholder="Ex: 10"
                      />
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <div className={`w-10 h-6 rounded-full relative transition-all ${hasCommunity ? 'bg-brand-primary' : 'bg-slate-200'}`}>
                          <input type="checkbox" checked={hasCommunity} onChange={(e) => setHasCommunity(e.target.checked)} className="sr-only" />
                          <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-all ${hasCommunity ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-[9px] font-black text-slate-500 uppercase">Comunidade</span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <div className={`w-10 h-6 rounded-full relative transition-all ${hasHCCustomization ? 'bg-brand-primary' : 'bg-slate-200'}`}>
                          <input type="checkbox" checked={hasHCCustomization} onChange={(e) => setHasHCCustomization(e.target.checked)} className="sr-only" />
                          <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-all ${hasHCCustomization ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-[9px] font-black text-slate-500 uppercase">Personalização HC</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Operação</label>
                    <div className="flex flex-wrap gap-2">
                      {['B2C', 'B2B', 'B2E'].map(t => (
                        <button
                          key={t}
                          onClick={() => toggleOperationType(t)}
                          className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${
                            operationTypes.includes(t)
                              ? 'bg-brand-dark border-brand-dark text-white shadow-lg'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setSkuType('customer_service')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${skuType === 'customer_service' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-400'}`}>Customer</button>
                      <button onClick={() => setSkuType('employee_service')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${skuType === 'employee_service' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-400'}`}>Employee</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Implantação</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setDeploymentType('new')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${deploymentType === 'new' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-400'}`}>Nova</button>
                    <button onClick={() => setDeploymentType('optimization')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${deploymentType === 'optimization' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-400'}`}>Otimização</button>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serviços Adicionais</label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'int', label: 'Integração Personalizada', state: hasIntegration, setter: setHasIntegration, icon: Settings },
                      { id: 'qa', label: 'QA / Qualidade', state: hasQA, setter: setHasQA, icon: CheckSquare },
                      { id: 'wfm', label: 'WFM / Workforce', state: hasWFM, setter: setHasWFM, icon: Users },
                      { id: 'ai', label: 'AI Agents Advanced', state: hasAIAgents, setter: setHasAIAgents, icon: Bot },
                    ].map(item => (
                      <label key={item.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${item.state ? 'bg-brand-primary/5 border-brand-primary' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                        <div className="flex items-center space-x-3">
                          <item.icon className={`w-4 h-4 ${item.state ? 'text-brand-primary' : 'text-slate-400'}`} />
                          <span className={`text-[9px] font-black uppercase tracking-widest ${item.state ? 'text-brand-dark' : 'text-slate-500'}`}>{item.label}</span>
                        </div>
                        <input type="checkbox" checked={item.state} onChange={(e) => item.setter(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                      </label>
                    ))}
                  </div>

                  <div className={`p-5 rounded-2xl border transition-all space-y-4 ${hasCopilot ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <MessageSquare className={`w-4 h-4 ${hasCopilot ? 'text-purple-600' : 'text-slate-400'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${hasCopilot ? 'text-purple-900' : 'text-slate-500'}`}>Zendesk Copilot</span>
                      </div>
                      <input type="checkbox" checked={hasCopilot} onChange={(e) => setHasCopilot(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                    </label>
                    {hasCopilot && (
                      <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95">
                        <button onClick={() => setCopilotType('without_api')} className={`py-2.5 rounded-xl text-[8px] font-black uppercase border transition-all ${copilotType === 'without_api' ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white border-purple-200 text-purple-400 hover:bg-purple-100'}`}>Sem API</button>
                        <button onClick={() => setCopilotType('with_api')} className={`py-2.5 rounded-xl text-[8px] font-black uppercase border transition-all ${copilotType === 'with_api' ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white border-purple-200 text-purple-400 hover:bg-purple-100'}`}>Com API</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Volume, Channels & Zendesk */}
          <div className="space-y-8">
            <div className="bg-slate-50/50 rounded-[3rem] border border-slate-200 p-10 shadow-inner space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-200/50 pb-6">
                <div className="bg-brand-dark p-3 rounded-2xl text-white">
                  <Users className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">Volume e Canais</h2>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Agentes</label>
                  <input type="number" value={agents} onChange={(e) => setAgents(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Marcas</label>
                  <input type="number" value={brands} onChange={(e) => setBrands(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Áreas</label>
                  <input type="number" value={areas} onChange={(e) => setAreas(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Canais Ativos</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {channelOptions.map((opt) => (
                    <div key={opt.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      selectedChannels.includes(opt.id) ? 'bg-white border-brand-primary shadow-sm' : 'bg-transparent border-slate-200 opacity-60'
                    }`}>
                      <button
                        onClick={() => toggleChannel(opt.id)}
                        className={`flex-1 text-left text-[9px] font-black uppercase tracking-tight ${selectedChannels.includes(opt.id) ? 'text-brand-dark' : 'text-slate-400'}`}
                      >
                        {opt.label}
                      </button>
                      {selectedChannels.includes(opt.id) && (
                        <div className="flex items-center space-x-2 animate-in zoom-in-90 duration-300">
                          <span className="text-[8px] font-black text-slate-300 uppercase">Qtd:</span>
                          <input 
                            type="number" 
                            value={channelQuantities[opt.id] || 1} 
                            onChange={(e) => handleChannelQtyChange(opt.id, parseInt(e.target.value) || 1)}
                            className="w-12 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-[10px] font-black text-center"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-xl shadow-slate-200/50 space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-brand-secondary/10 p-3 rounded-2xl text-brand-secondary">
                  <Settings className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">Zendesk & Ecossistema</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plano Zendesk</label>
                  <select value={zendeskPlan} onChange={(e) => setZendeskPlan(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all">
                    <option value="team">Suite Team</option>
                    <option value="growth">Suite Growth</option>
                    <option value="professional">Suite Professional</option>
                    <option value="enterprise">Suite Enterprise</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-200 cursor-pointer hover:border-brand-primary/30 transition-all">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-xl transition-all ${hasAppsMarketplace ? 'bg-brand-primary text-white' : 'bg-white text-slate-400'}`}>
                        <Box className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">Apps & Marketplace</span>
                    </div>
                    <input type="checkbox" checked={hasAppsMarketplace} onChange={(e) => setHasAppsMarketplace(e.target.checked)} className="w-5 h-5 rounded-lg border-slate-300 text-brand-primary" />
                  </label>
                  {hasAppsMarketplace && (
                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-wrap gap-2">
                        {appOptions.map(app => (
                          <button
                            key={app}
                            onClick={() => toggleApp(app)}
                            className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${
                              selectedApps.includes(app) ? 'bg-brand-primary border-brand-primary text-white' : 'bg-white border-slate-200 text-slate-400'
                            }`}
                          >
                            {app}
                          </button>
                        ))}
                      </div>
                      {selectedApps.includes('Outros') && (
                        <input type="text" value={otherApp} onChange={(e) => setOtherApp(e.target.value)} placeholder="Quais outros apps?" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold" />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-200 cursor-pointer hover:border-brand-primary/30 transition-all">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-xl transition-all ${hasNativeConnections ? 'bg-brand-primary text-white' : 'bg-white text-slate-400'}`}>
                        <Globe className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">Conexões Nativas</span>
                    </div>
                    <input type="checkbox" checked={hasNativeConnections} onChange={(e) => setHasNativeConnections(e.target.checked)} className="w-5 h-5 rounded-lg border-slate-300 text-brand-primary" />
                  </label>
                  {hasNativeConnections && (
                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                      {connectionOptions.map(conn => (
                        <button
                          key={conn}
                          onClick={() => toggleNativeConnection(conn)}
                          className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${
                            selectedNativeConnections.includes(conn) ? 'bg-brand-primary border-brand-primary text-white' : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          {conn}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-brand-dark rounded-[3rem] p-10 space-y-8 text-white shadow-2xl">
              <div className="flex items-center space-x-4 border-b border-white/10 pb-6">
                <div className="brand-bg-primary p-3 rounded-2xl text-white">
                  <Zap className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Finalizar Estimativa</h2>
              </div>
              
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Revise os campos acima. A estimativa considera esforço técnico padrão e margem de GP configurada.
              </p>

              <button
                onClick={handleCalculate}
                disabled={!clientName || isPending}
                className="w-full brand-bg-primary text-white p-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center space-x-4 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                <span>Gerar Estimativa</span>
              </button>
            </div>
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

          {/* New Results Section: Markdown & JSON */}
          <div className="mt-12 space-y-12">
            <div className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
                <div className="flex items-center space-x-4">
                  <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">Relatório Executivo</h2>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(markdownReport);
                    alert('Relatório copiado!');
                  }}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Markdown</span>
                </button>
              </div>
              <div className="prose prose-slate max-w-none text-xs font-medium leading-relaxed whitespace-pre-wrap">
                {markdownReport}
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
