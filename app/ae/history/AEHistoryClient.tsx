'use client';

import { useState, useMemo } from 'react';
import Link from "next/link";
import { Zap, Clock, ArrowLeft, ExternalLink, MessageSquare, ShieldCheck, Settings, Users, Bot, Layout, Activity, Search } from "lucide-react";

export default function AEHistoryClient({ estimates }: { estimates: any[] }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEstimates = useMemo(() => {
    if (!searchQuery) return estimates;
    const query = searchQuery.toLowerCase();
    return estimates.filter((est: any) => 
      est.clientName.toLowerCase().includes(query)
    );
  }, [estimates, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-6xl font-black text-brand-dark tracking-tighter font-heading uppercase leading-none">
            Histórico <span className="text-brand-primary">AE</span>
          </h1>
          <p className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-[0.2em]">Todas as suas estimativas salvas.</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <Search className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-primary transition-colors" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full bg-white border border-slate-500 rounded-[1.5rem] pl-14 pr-6 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all placeholder:text-slate-500"
            />
          </div>
          <Link 
            href="/ae" 
            className="w-full md:w-auto bg-white border border-slate-500 text-slate-500 px-8 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 hover:border-brand-primary hover:text-brand-primary transition-all"
          >
            <span>Nova Estimativa</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredEstimates.length === 0 ? (
          <div className="col-span-full py-24 bg-white rounded-[3rem] border-4 border-dashed border-slate-50 text-center">
            <div className="brand-bg-primary w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              {searchQuery ? <Search className="w-10 h-10 text-white" /> : <Zap className="w-10 h-10 text-white" />}
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest">
              {searchQuery ? 'Nenhum cliente encontrado.' : 'Nenhuma estimativa encontrada.'}
            </p>
          </div>
        ) : (
          filteredEstimates.map((est: any) => {
            const data = JSON.parse(est.data);
            return (
              <div key={est.id} className="group bg-white rounded-[3rem] border border-slate-300 hover:border-brand-primary transition-all duration-500 shadow-xl hover:shadow-2xl overflow-hidden flex flex-col">
                <div className="p-10 space-y-6 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-purple-50 text-purple-600 border-purple-100 flex items-center space-x-2">
                      <Clock className="w-2 h-2" />
                      <span>{new Date(est.createdAt).toLocaleDateString('pt-BR')}</span>
                    </span>
                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                      est.needsSC ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                      {est.needsSC ? 'Needs SC' : 'AE Estimate'}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-black text-brand-dark group-hover:text-brand-primary transition-colors uppercase tracking-tight leading-tight">
                    {est.clientName}
                  </h3>

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100" title="Agentes">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{data.agents} Agentes</span>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100" title="Marcas">
                        <Zap className="w-3 h-3 text-slate-400" />
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{data.brands} Marcas</span>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100" title="Áreas">
                        <Layout className="w-3 h-3 text-slate-400" />
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{data.areas} Áreas</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Canais Selecionados</span>
                      <div className="flex flex-wrap gap-1.5">
                        {data.channels?.length > 0 ? data.channels.map((c: string) => (
                          <span key={c} className="bg-brand-primary/5 text-brand-primary px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border border-brand-primary/10">
                            {c}
                          </span>
                        )) : (
                          <span className="text-[8px] font-bold text-slate-300 italic">Nenhum canal</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                      {data.hasIntegration && (
                        <div className="flex items-center space-x-2 text-emerald-600">
                          <Settings className="w-3 h-3" />
                          <span className="text-[8px] font-black uppercase tracking-widest">Integração</span>
                        </div>
                      )}
                      {data.hasQA && (
                        <div className="flex items-center space-x-2 text-emerald-600">
                          <ShieldCheck className="w-3 h-3" />
                          <span className="text-[8px] font-black uppercase tracking-widest">QA</span>
                        </div>
                      )}
                      {data.hasWFM && (
                        <div className="flex items-center space-x-2 text-emerald-600">
                          <Activity className="w-3 h-3" />
                          <span className="text-[8px] font-black uppercase tracking-widest">WFM</span>
                        </div>
                      )}
                      {data.hasCopilot && (
                        <div className="flex items-center space-x-2 text-purple-600">
                          <Bot className="w-3 h-3" />
                          <span className="text-[8px] font-black uppercase tracking-widest">Copilot {data.copilotType === 'with_api' ? '(API)' : ''}</span>
                        </div>
                      )}
                      {data.hasAIAgents && (
                        <div className="flex items-center space-x-2 text-purple-600">
                          <MessageSquare className="w-3 h-3" />
                          <span className="text-[8px] font-black uppercase tracking-widest">AI Agents</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-50">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Estimado</span>
                        <span className={`text-lg font-black tracking-tighter ${est.needsSC ? 'text-amber-600' : 'text-brand-primary'}`}>
                          {est.needsSC ? 'Consultar SC' : `${est.resultHours.toFixed(0)}H`}
                        </span>
                     </div>
                  </div>
                </div>

                {/* <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center">
                  <Link 
                    href={`/ae?client=${encodeURIComponent(est.clientName)}`} 
                    className="text-[10px] font-black text-brand-dark hover:text-brand-primary uppercase tracking-widest flex items-center space-x-2 transition-all"
                  >
                    <span>Refazer Simulação</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div> */}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
