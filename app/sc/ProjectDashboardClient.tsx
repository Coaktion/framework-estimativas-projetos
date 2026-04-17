'use client';

import { useState, useTransition, useMemo } from 'react';
import { Plus, Trash2, ExternalLink, Lock, Globe, X, Loader2, Zap, Search } from 'lucide-react';
import Link from 'next/link';
import { createProjectAction, deleteProjectAction } from './actions';

export default function ProjectDashboardClient({ projects }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter((p: any) => 
      p.name.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Deseja realmente excluir o projeto "${name}"?`)) {
      startTransition(async () => {
        await deleteProjectAction(id);
      });
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h1 className="text-5xl font-black text-brand-dark tracking-tighter font-heading uppercase leading-none">Meus Projetos</h1>
          <p className="text-slate-400 text-xs mt-3 font-bold uppercase tracking-[0.2em]">Gestão de escopos e estimativas técnicas.</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <Search className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-primary transition-colors" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar projeto..."
              className="w-full bg-white border border-slate-500 rounded-[1.5rem] pl-14 pr-6 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all placeholder:text-slate-500"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto brand-bg-primary text-white px-10 py-5 rounded-[2rem] font-black hover:opacity-90 shadow-2xl btn-premium transition-all flex items-center justify-center space-x-4 text-xs uppercase tracking-[0.2em]"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Projeto</span>
          </button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="py-24 bg-white rounded-[3rem] border-4 border-dashed border-slate-50 text-center">
          <div className="brand-bg-primary w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Search className="w-10 h-10 text-white" />
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-widest">Nenhum projeto encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project: any) => (
            <div key={project.id} className="group bg-white rounded-[3rem] border border-slate-300 hover:border-brand-primary transition-all duration-500 shadow-xl hover:shadow-2xl overflow-hidden flex flex-col">
              <div className="p-10 space-y-6 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border flex items-center space-x-2 ${
                      project.isPrivate ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                      {project.isPrivate ? <Lock className="w-2 h-2" /> : <Globe className="w-2 h-2" />}
                      <span>{project.isPrivate ? 'Privado' : 'Público'}</span>
                    </span>
                    {project.status === 'AE_ESTIMATE' && (
                      <span className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-purple-50 text-purple-600 border-purple-100 flex items-center space-x-2">
                        <Zap className="w-2 h-2" />
                        <span>Legacy AE</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{new Date(project.updatedAt).toLocaleDateString('pt-BR')}</span>
                </div>
                
                <h3 className="text-2xl font-black text-brand-dark group-hover:text-brand-primary transition-colors uppercase tracking-tight leading-tight">
                  {project.name}
                </h3>
              </div>

              <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <Link href={`/sc/project/${project.id}`} className="text-[10px] font-black text-brand-dark hover:text-brand-primary uppercase tracking-widest flex items-center space-x-2 transition-all">
                    <span>Editar Escopo</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                <button 
                  onClick={() => handleDelete(project.id, project.name)}
                  disabled={isPending}
                  className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Novo Projeto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden border border-white/20">
            <div className="brand-bg-primary p-10 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-white font-heading uppercase tracking-tight">Novo Projeto</h3>
                <p className="text-white/60 text-xs mt-2 font-bold uppercase tracking-widest">Inicie um novo escopo técnico.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form action={createProjectAction} className="p-10 space-y-8">
              <div className="space-y-4">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Projeto</label>
                <input 
                  type="text" 
                  name="name" 
                  placeholder="Ex: Implantação Zendesk - Cliente X" 
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all placeholder:text-slate-300" 
                  required 
                />
              </div>

              <div className="flex items-center space-x-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="flex-1">
                  <label htmlFor="isPrivate" className="block text-sm font-black text-brand-dark tracking-tight">Privacidade</label>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Apenas você terá acesso</p>
                </div>
                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full bg-slate-200">
                  <input type="checkbox" name="isPrivate" id="isPrivate" className="absolute w-6 h-6 transition duration-200 ease-in-out transform bg-white border-4 border-slate-200 rounded-full appearance-none cursor-pointer checked:translate-x-6 checked:border-brand-primary outline-none" />
                </div>
              </div>

              <div className="flex flex-col space-y-4 pt-4">
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full brand-bg-primary text-white py-5 rounded-2xl text-xs font-black hover:opacity-90 shadow-xl btn-premium transition-all uppercase tracking-[0.2em] disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Criar Projeto</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="w-full py-4 text-[10px] font-black text-slate-400 hover:text-brand-dark transition-colors uppercase tracking-[0.2em] disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
