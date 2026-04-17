'use client';

import { useState, useTransition } from 'react';
import { Plus, Download, History, Box, Settings, Users, Trash2, ExternalLink, Shield, Loader2, UserCog, Mail, Calendar, ShieldCheck, ShieldAlert } from 'lucide-react';
import { 
  createFrameworkSnapshotAction, 
  restoreFrameworkSnapshotAction, 
  deleteUserAction, 
  updateUserRoleAction,
  addPackageAction,
  deletePackageAction,
  updateUserAdminStatusAction
} from './actions';
import { addVariableAction, deleteVariableAction } from './variable_actions';

export default function AdminClient({ packages, variables, versions, users }: any) {
  const [activeTab, setActiveTab] = useState('versions');
  const [isPending, startTransition] = useTransition();

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

  const handleRestore = async (id: number, name: string) => {
    if (confirm(`AVISO: Restaurar o snapshot "${name}" substituirá a biblioteca atual. Deseja continuar?`)) {
      startTransition(async () => {
        try {
          await restoreFrameworkSnapshotAction(id);
          alert("Biblioteca restaurada!");
        } catch (e) {
          alert("Erro ao restaurar.");
        }
      });
    }
  };

  const handleDeleteUser = async (id: number, email: string) => {
    if (confirm(`Remover usuário ${email}?`)) {
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

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-brand-dark tracking-tighter font-heading uppercase">Central de Comando</h1>
          <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest">Gestão de pacotes, variáveis globais e controle de versões.</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] border border-slate-50 shadow-2xl h-fit">
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-10 h-10 brand-bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-brand-dark font-heading uppercase tracking-tight">Novo Pacote</h3>
              </div>
              <form action={addPackageAction} className="space-y-6">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Nome do Item</label>
                  <input type="text" name="name" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" required />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Horas</label>
                    <input type="number" step="0.5" name="hours" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all text-center" required />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Skill</label>
                    <select name="skill" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-[10px] font-black focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all appearance-none cursor-pointer uppercase tracking-tighter">
                      <option value="Implantação">Implantação</option>
                      <option value="GP">GP</option>
                      <option value="Solution Design">Solution Design</option>
                      <option value="Desenvolvimento">Desenvolvimento</option>
                      <option value="Design">Design</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Categoria</label>
                  <input type="text" name="category" list="categories" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" required />
                  <datalist id="categories">
                    <option value="Zendesk Support" />
                    <option value="Canais - Ticket" />
                    <option value="Canais - Messaging" />
                    <option value="Canais - Voz" />
                    <option value="Automação" />
                    <option value="IA & Advanced" />
                  </datalist>
                </div>
                <button type="submit" className="w-full brand-bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:opacity-90 shadow-xl btn-premium text-xs">
                  Adicionar / Atualizar
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-50 shadow-2xl overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-slate-50/30 border-b border-slate-50">
                  <tr>
                    <th className="px-10 py-6 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Item / Categoria</th>
                    <th className="px-10 py-6 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] w-32">Horas</th>
                    <th className="px-10 py-6 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {packages.map((pkg: any) => (
                    <tr key={pkg.id} className="hover:bg-slate-50/30 transition-all group">
                      <td className="px-10 py-8">
                        <div className="text-sm font-black text-brand-dark group-hover:text-brand-primary transition-all uppercase tracking-tight">{pkg.name}</div>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{pkg.category}</span>
                          <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-black uppercase tracking-tighter">{pkg.skill}</span>
                          {pkg.link && (
                            <a href={pkg.link} target="_blank" className="text-[8px] brand-bg-primary text-white px-2 py-0.5 rounded font-black uppercase tracking-tighter hover:opacity-80">
                              <ExternalLink className="w-2 h-2" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className="bg-brand-dark text-white px-4 py-1.5 rounded-xl text-xs font-black tracking-tighter shadow-sm">{pkg.hours}H</span>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <button 
                          onClick={() => deletePackageAction(pkg.id)}
                          className="inline-flex items-center text-[9px] font-black text-slate-300 hover:text-red-500 uppercase tracking-[0.2em] transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Valor</label>
                  <input type="text" name="value" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all" required />
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
                    <tr key={v.id} className="hover:bg-slate-50/30 transition-all group">
                      <td className="px-10 py-8">
                        <div className="text-sm font-black text-brand-dark group-hover:text-brand-primary transition-all uppercase tracking-tight">{v.key}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{v.category}</div>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className="bg-slate-100 text-brand-dark px-4 py-1.5 rounded-xl text-xs font-black tracking-tighter border border-slate-200">{v.value}</span>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <button 
                          onClick={() => deleteVariableAction(v.id)}
                          className="inline-flex items-center text-[9px] font-black text-slate-300 hover:text-red-500 uppercase tracking-[0.2em] transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remover
                        </button>
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
