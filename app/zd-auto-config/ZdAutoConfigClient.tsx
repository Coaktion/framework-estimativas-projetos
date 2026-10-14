'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileSpreadsheet, Server, Activity, ListChecks, Bot, Sparkles, Loader2, Plus, Pencil,
  Trash2, Copy, Check, Play, Square, Undo2, ExternalLink, AlertTriangle, Users, Lock, ChevronDown,
} from 'lucide-react';
import { lerXlsx } from '@/lib/zdcfg/xlsx';
import { planilhaParaBlueprint } from '@/lib/zdcfg/planilha';
import { aplicarSelecao, secoesStatus, type Secao } from '@/lib/zdcfg/selecao';
import { TEMA_POR_IDIOMA, baseDe } from '@/lib/zdcfg/plano';
import { executar, rollback } from '@/lib/zdcfg/executor';
import type { Blueprint } from '@/lib/zdcfg/blueprint';
import type { Criado } from '@/lib/zdcfg/passos';

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                     */
/* -------------------------------------------------------------------------- */

type Env = {
  id: string;
  nome: string;
  subdomain: string;
  auth: 'token' | 'oauth';
  email?: string | null;
  client_id?: string | null;
  dono?: string | null;
  compartilhado: boolean;
  pode_editar: boolean;
};

type Resumo = {
  cliente: string;
  identificador: string;
  idioma: string;
  grupos: number; campos: number; condicionais: number; views: number;
  gatilhos: number; macros: number; secoes: number; artigos: number;
  marca?: string | null;
  lembretes: { titulo: string; detalhe: string }[];
  copilots: { titulo: string; quando_utilizar?: string; corpo: string }[];
  ai_agents: { nome: string; descricao?: string; prompt: string }[];
  secoes_disp: Secao[];
};

type EnvForm = {
  id?: string;
  nome: string;
  subdomain: string;
  auth: 'token' | 'oauth';
  email: string;
  token: string;
  client_id: string;
  client_secret: string;
  compartilhado: boolean;
};

const EMPTY_FORM: EnvForm = {
  nome: '', subdomain: '', auth: 'oauth', email: '', token: '',
  client_id: '', client_secret: '', compartilhado: false,
};

/* -------------------------------------------------------------------------- */
/*  Estilos (mesmo vocabulário visual das demais telas do Tool Center)        */
/* -------------------------------------------------------------------------- */

const card =
  'bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] rounded-[2rem] border border-slate-300 dark:border-[color:var(--border-main)] shadow-xl';
const cardHead =
  'px-8 py-5 border-b border-slate-100 dark:border-[color:var(--border-main)] flex items-center gap-4';
const iconBox = 'w-10 h-10 rounded-2xl brand-bg-primary flex items-center justify-center text-white shadow-lg shrink-0';
const h2 = 'text-lg font-black text-brand-dark dark:text-[color:var(--text-main)] font-heading uppercase tracking-tight';
const sub = 'text-[10px] font-bold text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-widest mt-0.5';
const label = 'block text-[9px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-widest ml-1 mb-2';
const input =
  'w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] border border-slate-200 dark:border-[color:var(--border-main)] text-brand-dark dark:text-[color:var(--text-main)] rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all placeholder:text-slate-300 dark:placeholder:text-[color:var(--text-muted)] disabled:opacity-50 dark:[color-scheme:dark] [&_option]:bg-white [&_option]:text-slate-800 dark:[&_option]:bg-[color:var(--bg-input-solid)] dark:[&_option]:text-[color:var(--text-main)] [&_optgroup]:bg-white dark:[&_optgroup]:bg-[color:var(--bg-card-solid)] [&_optgroup]:text-slate-500 dark:[&_optgroup]:text-[color:var(--text-muted)]';
const btn =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btn} brand-bg-primary text-white btn-premium`;
const btnGhost = `${btn} bg-slate-50 dark:bg-[color:var(--bg-input-solid)] text-slate-500 dark:text-[color:var(--text-muted)] border border-slate-200 dark:border-[color:var(--border-main)] hover:text-brand-primary`;
const btnDanger = `${btn} bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-500/30 hover:bg-red-100`;
const pill =
  'inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 dark:bg-[color:var(--bg-input-solid)] border border-slate-200 dark:border-[color:var(--border-main)] text-slate-500 dark:text-[color:var(--text-muted)]';
const muted = 'text-xs text-slate-500 dark:text-[color:var(--text-muted)]';
const detail = 'text-sm leading-relaxed text-slate-600 dark:text-[color:var(--text-muted)]';

/* -------------------------------------------------------------------------- */

export default function ZdAutoConfigClient({ email }: { email?: string | null }) {
  const { t } = useTranslation();
  const [fatal, setFatal] = useState<string | null>(null);

  const jsonOuErro = async (r: Response) => {
    const j = await r.json().catch(() => null);
    if (!r.ok || (j && j.ok === false)) throw new Error((j && (j.erro || j.detail)) || `HTTP ${r.status}`);
    return j;
  };

  // ---------------------------------------------------------------- ambientes
  const [envs, setEnvs] = useState<Env[]>([]);
  const [envId, setEnvId] = useState('');
  const [form, setForm] = useState<EnvForm | null>(null);
  const [envMsg, setEnvMsg] = useState<string | null>(null);
  const [savingEnv, setSavingEnv] = useState(false);

  const loadEnvs = useCallback(async () => {
    try {
      const j = await jsonOuErro(await fetch('/api/zd-auto-config/envs', { cache: 'no-store' }));
      if (!j.configurado) {
        setFatal(t('zdcfg.notConfigured', 'O ZD Auto Config não está configurado neste ambiente (falta a ZDCFG_FERNET_KEY no servidor).'));
        return;
      }
      setEnvs(j.envs || []);
    } catch (e: any) {
      setFatal(`${t('zdcfg.serviceDown', 'Não foi possível carregar os ambientes.')} (${e?.message || e})`);
    }
  }, [t]);

  useEffect(() => { loadEnvs(); }, [loadEnvs]);

  const envSel = envs.find((e) => e.id === envId) || null;
  const meus = envs.filter((e) => e.dono && e.dono.toLowerCase() === (email || '').toLowerCase());
  const compart = envs.filter((e) => e.compartilhado && !meus.includes(e));
  const semDono = envs.filter((e) => !meus.includes(e) && !compart.includes(e));

  const openNew = () => { setForm({ ...EMPTY_FORM }); setEnvMsg(null); };
  const openEdit = () => {
    if (!envSel) return;
    setForm({
      id: envSel.id, nome: envSel.nome, subdomain: envSel.subdomain, auth: envSel.auth,
      email: envSel.email || '', token: '', client_id: envSel.client_id || '', client_secret: '',
      compartilhado: envSel.compartilhado,
    });
    setEnvMsg(null);
  };

  const saveEnv = async () => {
    if (!form) return;
    setSavingEnv(true); setEnvMsg(null);
    try {
      const j = await jsonOuErro(await fetch(form.id ? `/api/zd-auto-config/envs/${form.id}` : '/api/zd-auto-config/envs', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }));
      setForm(null);
      await loadEnvs();
      setEnvId(j.id);
    } catch (e: any) {
      setEnvMsg(String(e?.message || e));
    } finally {
      setSavingEnv(false);
    }
  };

  const deleteEnv = async () => {
    if (!envSel) return;
    if (!confirm(t('zdcfg.confirmDeleteEnv', 'Excluir o ambiente "{{nome}}"?', { nome: envSel.nome }))) return;
    try {
      await jsonOuErro(await fetch(`/api/zd-auto-config/envs/${envSel.id}`, { method: 'DELETE' }));
    } catch (e: any) { alert(e?.message || e); return; }
    setEnvId('');
    loadEnvs();
  };

  // ---------------------------------------------------------------- planilha (lida no navegador)
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [bp, setBp] = useState<Blueprint | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [secoes, setSecoes] = useState<Record<string, boolean>>({});
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true); setAnalyzeErr(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('planilha maior que 20 MB');
      const b = planilhaParaBlueprint(lerXlsx(new Uint8Array(await file.arrayBuffer())));
      const disp = secoesStatus(b).filter((s) => s.presente);
      setBp(b);
      setResumo({
        cliente: b.cliente, identificador: b.identificador, idioma: b.idioma,
        grupos: b.grupos.length, campos: b.campos_ticket.length, condicionais: b.condicionais.length,
        views: b.views.length, gatilhos: b.gatilhos_padrao.length, macros: b.macros.length,
        secoes: b.guide_secoes.length, artigos: b.guide_artigos.length, marca: b.marca?.nome ?? null,
        lembretes: b.lembretes, copilots: b.copilots, ai_agents: b.ai_agents, secoes_disp: disp,
      });
      setSecoes(Object.fromEntries(disp.map((s) => [s.key, s.default])));
    } catch (e: any) {
      setBp(null); setResumo(null);
      setAnalyzeErr(`${t('zdcfg.invalidSheet', 'Planilha inválida')}: ${e?.message || e}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // ---------------------------------------------------------------- execução (a tela conduz, passo a passo)
  const [apply, setApply] = useState(false);
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState('');
  const [hcUrl, setHcUrl] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const cancelRef = useRef(false);
  const hcContinuar = useRef<(() => void) | null>(null);
  const criadosRef = useRef<Criado[]>([]);
  const envDaExecucao = useRef('');

  const addLog = (s: string) => setLog((l) => l + s + '\n');
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [log]);

  // Fechar a aba no meio interrompe a execução: avisa antes.
  useEffect(() => {
    if (!running) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [running]);

  const chamarRollback = (alvo: string) => async (itens: Criado[]) => jsonOuErro(await fetch('/api/zd-auto-config/rollback', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ envId: alvo, itens }),
  }));

  const run = async () => {
    if (!bp || !envSel) return;
    if (apply && !confirm(t('zdcfg.confirmApply', 'Executar DE VERDADE em {{sub}}.zendesk.com?', { sub: envSel.subdomain }))) return;
    const sel = aplicarSelecao(bp, secoes as any);
    const base = baseDe(sel);
    const alvo = envSel.id;
    const aplicar = apply;
    envDaExecucao.current = alvo;
    cancelRef.current = false;
    criadosRef.current = [];
    setRunning(true); setCanUndo(false); setLog(''); setHcUrl(null);
    try {
      const r = await executar({
        bp: sel,
        aplicar,
        forcar: force,
        temaArquivo: TEMA_POR_IDIOMA[sel.idioma] ?? 'tema_hc_br.zip',
        log: addLog,
        cancelado: () => cancelRef.current,
        aoCriar: (todos) => { criadosRef.current = todos; },
        aguardarHelpCenter: (url) => new Promise<void>((resolve) => {
          setHcUrl(url);
          hcContinuar.current = () => { hcContinuar.current = null; setHcUrl(null); resolve(); };
          addLog(t('zdcfg.waitingHc', '[aguardando ativação do Help Center] abra a página de ativação, ative e clique em Continuar.'));
          try { window.open(url, '_blank', 'noopener'); } catch { /* bloqueado pelo navegador: há o botão */ }
        }),
        chamar: async (passo, ctx) => {
          const resp = await fetch('/api/zd-auto-config/passo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ envId: alvo, aplicar, base, passo, ctx }),
          });
          const j = await resp.json().catch(() => null);
          if (!j) throw new Error(`HTTP ${resp.status}`);
          return j;
        },
        chamarRollback: chamarRollback(alvo),
      });
      addLog(`== ${r.status.toUpperCase()} ==`);
      setCanUndo(aplicar && r.status === 'ok' && r.criados.length > 0);
    } catch (e: any) {
      addLog(`FALHA: ${e?.message || e}`);
      setCanUndo(aplicar && criadosRef.current.length > 0);
    } finally {
      setRunning(false);
      setHcUrl(null);
      hcContinuar.current = null;
    }
  };

  const resume = () => hcContinuar.current?.();

  const stop = () => {
    if (!confirm(t('zdcfg.confirmStop', 'Interromper a configuração e desfazer o que já foi criado?'))) return;
    addLog(t('zdcfg.stopping', 'Interrompendo... aguardando o rollback do que já foi criado.'));
    cancelRef.current = true;
    hcContinuar.current?.();   // libera a pausa do Help Center, se estiver aguardando
  };

  const undo = async () => {
    if (!confirm(t('zdcfg.confirmUndo', 'Desfazer tudo que foi criado nesta execução?'))) return;
    setCanUndo(false);
    setRunning(true);
    try {
      await rollback(criadosRef.current, chamarRollback(envDaExecucao.current), addLog);
      addLog('== ROLLBACK ==');
      criadosRef.current = [];
    } finally {
      setRunning(false);
    }
  };

  // ---------------------------------------------------------------- copiar
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1200);
    });
  };

  // ================================================================ render
  if (fatal) {
    return (
      <div className="max-w-3xl mx-auto py-16">
        <div className={`${card} p-10 flex items-start gap-4`}>
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          <div>
            <h2 className={h2}>ZD Auto Config</h2>
            <p className={`${muted} mt-2`}>{fatal}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative left-1/2 -translate-x-1/2 w-[min(1600px,calc(100vw-3rem))] space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Título */}
      <div className="space-y-2">
        <h1 className="text-5xl font-black text-brand-dark dark:text-[color:var(--text-main)] tracking-tighter font-heading uppercase leading-none">
          ZD <span className="text-brand-primary dark:text-[color:var(--primary)]">Auto Config</span>
        </h1>
        <p className="text-slate-500 dark:text-[color:var(--text-muted)] text-xs font-bold uppercase tracking-[0.2em]">
          {t('zdcfg.subtitle', 'Provisionador de ambientes de demonstração Zendesk')}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 items-start">
        <div className="xl:col-span-3 space-y-8">
          {/* 1. Planilha */}
          <section className={card}>
            <div className={cardHead}>
              <div className={iconBox}><FileSpreadsheet className="w-5 h-5" /></div>
              <div>
                <h2 className={h2}>1 · {t('zdcfg.sheet', 'Planilha da demo')}</h2>
                <p className={sub}>{t('zdcfg.sheetHint', 'Modelo zd_auto_template (.xlsx)')}</p>
              </div>
            </div>
            <div className="p-8 space-y-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => { setFile(e.target.files?.[0] || null); setResumo(null); setBp(null); }}
                />
                <button type="button" className={`${btnGhost} shrink-0`} onClick={() => fileRef.current?.click()}>
                  <FileSpreadsheet className="w-4 h-4" />
                  {t('zdcfg.chooseFile', 'Escolher arquivo')}
                </button>
                <div className={`${input} flex items-center truncate ${file ? '' : '!text-slate-400 dark:!text-[color:var(--text-muted)] !font-normal'}`}>
                  {file ? file.name : t('zdcfg.noFile', 'Nenhuma planilha selecionada')}
                </div>
                <button className={btnGhost} onClick={analyze} disabled={!file || analyzing}>
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t('zdcfg.analyze', 'Analisar')}
                </button>
              </div>
              {analyzeErr && <p className="text-xs font-bold text-red-500">{analyzeErr}</p>}

              {resumo && (
                <>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-black text-brand-dark dark:text-[color:var(--text-main)] mr-2">{resumo.cliente}</span>
                    {[
                      `id ${resumo.identificador}`, resumo.idioma,
                      `${resumo.grupos} ${t('zdcfg.groups', 'grupos')}`,
                      `${resumo.campos} ${t('zdcfg.fields', 'campos')}`,
                      `${resumo.condicionais} ${t('zdcfg.conditionals', 'condicionais')}`,
                      `${resumo.views} views`,
                      `${resumo.gatilhos} ${t('zdcfg.triggers', 'gatilhos')}`,
                      `${resumo.macros} macros`,
                      `${resumo.secoes} ${t('zdcfg.sections', 'seções')}`,
                      `${resumo.artigos} ${t('zdcfg.articles', 'artigos')}`,
                    ].map((x) => <span key={x} className={pill}>{x}</span>)}
                  </div>
                  {resumo.secoes_disp.length > 0 && (
                    <div>
                      <span className={label}>{t('zdcfg.whatToProvision', 'O que provisionar')}</span>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {resumo.secoes_disp.map((s) => (
                          <label key={s.key} className="flex items-center gap-3 text-sm text-brand-dark dark:text-[color:var(--text-main)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(secoes[s.key])}
                              onChange={(e) => setSecoes((p) => ({ ...p, [s.key]: e.target.checked }))}
                              className="w-4 h-4 accent-[color:var(--primary)]"
                            />
                            {s.label} <span className={muted}>({s.qtd})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* 2. Ambiente */}
          <section className={card}>
            <div className={cardHead}>
              <div className={iconBox}><Server className="w-5 h-5" /></div>
              <div>
                <h2 className={h2}>2 · {t('zdcfg.environment', 'Ambiente Zendesk')}</h2>
                <p className={sub}>{t('zdcfg.environmentHint', 'Seus ambientes e os compartilhados com o time')}</p>
              </div>
            </div>
            <div className="p-8 space-y-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <EnvPicker
                  value={envId}
                  onChange={(id) => { setEnvId(id); setForm(null); }}
                  placeholder={t('zdcfg.chooseEnv', '— escolha um ambiente —')}
                  groups={[
                    { label: t('zdcfg.mine', 'Meus'), envs: meus },
                    { label: t('zdcfg.shared', 'Compartilhados'), envs: compart },
                    { label: t('zdcfg.noOwner', 'Sem dono (legado)'), envs: semDono },
                  ]}
                  showOwner={(e) => Boolean(e.dono) && !meus.includes(e)}
                />
                <div className="flex gap-2 shrink-0">
                  <button className={btnGhost} onClick={openNew} title={t('zdcfg.newEnv', 'Novo ambiente')}><Plus className="w-4 h-4" /></button>
                  <button className={btnGhost} onClick={openEdit} disabled={!envSel?.pode_editar} title={t('zdcfg.editEnv', 'Editar')}><Pencil className="w-4 h-4" /></button>
                  <button className={btnGhost} onClick={deleteEnv} disabled={!envSel?.pode_editar} title={t('zdcfg.deleteEnv', 'Excluir')}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {envSel && !form && (
                <p className={`${muted} flex items-center gap-2`}>
                  {envSel.compartilhado ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {envSel.subdomain}.zendesk.com · {envSel.auth === 'oauth' ? 'OAuth' : 'API token'}
                  {envSel.dono ? ` · ${t('zdcfg.owner', 'dono')}: ${envSel.dono}` : ''}
                </p>
              )}

              {form && (
                <div className="rounded-3xl border border-slate-200 dark:border-[color:var(--border-main)] p-6 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <span className={label}>{t('zdcfg.envName', 'Nome')}</span>
                      <input className={input} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Prod BR" />
                    </div>
                    <div>
                      <span className={label}>{t('zdcfg.subdomain', 'Subdomínio')}</span>
                      <input className={input} value={form.subdomain} onChange={(e) => setForm({ ...form, subdomain: e.target.value })} placeholder="minhaconta" />
                    </div>
                  </div>
                  <div>
                    <span className={label}>{t('zdcfg.authMode', 'Autenticação')}</span>
                    <select className={input} value={form.auth} onChange={(e) => setForm({ ...form, auth: e.target.value as EnvForm['auth'] })}>
                      <option value="oauth">{t('zdcfg.oauth', 'OAuth — Client Credentials (recomendado)')}</option>
                      <option value="token">{t('zdcfg.apiToken', 'Token de API (legado, até 2027)')}</option>
                    </select>
                  </div>
                  {form.auth === 'oauth' ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <span className={label}>Client ID</span>
                        <input className={input} value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} />
                      </div>
                      <div>
                        <span className={label}>Client Secret</span>
                        <input className={input} type="password" value={form.client_secret} onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                          placeholder={form.id ? t('zdcfg.keepSecret', 'em branco = manter o atual') : ''} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <span className={label}>{t('zdcfg.adminEmail', 'E-mail do admin')}</span>
                        <input className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@empresa.com" />
                      </div>
                      <div>
                        <span className={label}>{t('zdcfg.token', 'Token de API')}</span>
                        <input className={input} type="password" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })}
                          placeholder={form.id ? t('zdcfg.keepSecret', 'em branco = manter o atual') : ''} />
                      </div>
                    </div>
                  )}
                  <label className="flex items-center gap-3 text-sm text-brand-dark dark:text-[color:var(--text-main)] cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-[color:var(--primary)]" checked={form.compartilhado}
                      onChange={(e) => setForm({ ...form, compartilhado: e.target.checked })} />
                    {t('zdcfg.shareWithTeam', 'Compartilhar com o time (todos os ADMIN e SC poderão usar)')}
                  </label>
                  {envMsg && <p className="text-xs font-bold text-red-500">{envMsg}</p>}
                  <div className="flex gap-2">
                    <button className={btnPrimary} onClick={saveEnv} disabled={savingEnv}>
                      {savingEnv && <Loader2 className="w-4 h-4 animate-spin" />}
                      {t('zdcfg.save', 'Salvar')}
                    </button>
                    <button className={btnGhost} onClick={() => setForm(null)}>{t('zdcfg.cancel', 'Cancelar')}</button>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-3 text-sm text-brand-dark dark:text-[color:var(--text-main)] cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-[color:var(--primary)]" checked={apply} onChange={(e) => setApply(e.target.checked)} />
                  {t('zdcfg.applyForReal', 'Executar de verdade (desmarcado = simulação)')}
                </label>
                <label className="flex items-center gap-3 text-sm text-brand-dark dark:text-[color:var(--text-main)] cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-[color:var(--primary)]" checked={force} onChange={(e) => setForce(e.target.checked)} />
                  {t('zdcfg.force', 'Prosseguir mesmo com colisões')}
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button className={btnPrimary} onClick={run} disabled={!bp || !envSel || running}>
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {apply ? t('zdcfg.provision', 'Provisionar') : t('zdcfg.simulate', 'Simular')}
                </button>
                {hcUrl && (
                  <>
                    <a className={btnGhost} href={hcUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" /> {t('zdcfg.openHc', 'Abrir ativação do Help Center')}
                    </a>
                    <button className={btnPrimary} onClick={resume}>{t('zdcfg.hcDone', 'Ativei — continuar')}</button>
                  </>
                )}
              </div>
              {!bp && <p className={muted}>{t('zdcfg.needSheet', 'Analise uma planilha para liberar a execução.')}</p>}
            </div>
          </section>

          {/* 3. Progresso */}
          <section className={card}>
            <div className={cardHead}>
              <div className={iconBox}><Activity className="w-5 h-5" /></div>
              <div>
                <h2 className={h2}>3 · {t('zdcfg.progress', 'Progresso')}</h2>
                <p className={sub}>{running ? t('zdcfg.running', 'em execução') : t('zdcfg.idle', 'aguardando')}</p>
              </div>
            </div>
            <div className="p-8 space-y-4">
              <pre ref={logRef}
                className="h-80 overflow-auto rounded-2xl bg-slate-950 text-emerald-100/90 border border-slate-800 p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                {log || t('zdcfg.noLog', 'Nada executado ainda.')}
              </pre>
              <div className="flex flex-wrap gap-3">
                {running && apply && (
                  <button className={btnDanger} onClick={stop}><Square className="w-4 h-4" /> {t('zdcfg.stop', 'Interromper e desfazer')}</button>
                )}
                {canUndo && !running && (
                  <button className={btnDanger} onClick={undo}><Undo2 className="w-4 h-4" /> {t('zdcfg.undo', 'Desfazer tudo (rollback)')}</button>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Lateral */}
        <aside className="xl:col-span-2 space-y-8">
          <SideCard icon={<ListChecks className="w-5 h-5" />} title={t('zdcfg.manualSteps', 'Passos manuais')}
            empty={!resumo?.lembretes?.length} emptyText={t('zdcfg.runAnalysis', 'Rode a análise para ver.')}>
            {resumo?.lembretes?.map((l, i) => (
              <Details key={i} title={l.titulo}>
                <div className={`${detail} whitespace-pre-wrap`}>{l.detalhe}</div>
              </Details>
            ))}
          </SideCard>

          <SideCard icon={<Sparkles className="w-5 h-5" />} title="Copilot"
            empty={!resumo?.copilots?.length} emptyText={t('zdcfg.runAnalysis', 'Rode a análise para ver.')}>
            {resumo?.copilots?.map((c, i) => {
              const txt = `${c.titulo}\n\n${c.quando_utilizar ? `Quando utilizar\n${c.quando_utilizar}\n\n` : ''}${c.corpo}`;
              return (
                <Details key={i} title={c.titulo}>
                  {c.quando_utilizar && <div className={`${detail} whitespace-pre-wrap mb-2`}><b>{t('zdcfg.whenToUse', 'Quando utilizar')}</b>{'\n'}{c.quando_utilizar}</div>}
                  <div className={`${detail} whitespace-pre-wrap`}>{c.corpo}</div>
                  <CopyBtn active={copied === `cp${i}`} onClick={() => copy(`cp${i}`, txt)} label={t('zdcfg.copyProcedure', 'Copiar procedure')} />
                </Details>
              );
            })}
          </SideCard>

          <SideCard icon={<Bot className="w-5 h-5" />} title="AI Agents"
            empty={!resumo?.ai_agents?.length} emptyText={t('zdcfg.runAnalysis', 'Rode a análise para ver.')}>
            {resumo?.ai_agents?.map((a, i) => {
              const txt = `Nome do caso de uso: ${a.nome}\nDescrição do caso de uso: ${a.descricao || ''}\n\nPrompt:\n${a.prompt}`;
              return (
                <Details key={i} title={a.nome}>
                  {a.descricao && <div className={`${detail} whitespace-pre-wrap mb-2`}>{a.descricao}</div>}
                  <div className={`${detail} whitespace-pre-wrap`}>{a.prompt}</div>
                  <CopyBtn active={copied === `ai${i}`} onClick={() => copy(`ai${i}`, txt)} label={t('zdcfg.copyPrompt', 'Copiar prompt')} />
                </Details>
              );
            })}
          </SideCard>
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SideCard({ icon, title, empty, emptyText, children }: {
  icon: React.ReactNode; title: string; empty: boolean; emptyText: string; children?: React.ReactNode;
}) {
  return (
    <section className={card}>
      <div className={cardHead}>
        <div className={iconBox}>{icon}</div>
        <h2 className={h2}>{title}</h2>
      </div>
      <div className="p-6 space-y-2">
        {empty ? <p className={muted}>{emptyText}</p> : children}
      </div>
    </section>
  );
}

function Details({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-slate-200 dark:border-[color:var(--border-main)] bg-slate-50 dark:bg-[color:var(--bg-input-solid)]">
      <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-black text-brand-dark dark:text-[color:var(--text-main)] flex items-center gap-2">
        <span className="text-brand-primary transition-transform group-open:rotate-90">▸</span>
        {title}
      </summary>
      <div className="px-5 pb-5 text-sm leading-relaxed">{children}</div>
    </details>
  );
}

function CopyBtn({ active, onClick, label: text }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`${btnGhost} mt-3 !px-3 !py-2`}>
      {active ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {text}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Seletor de ambiente (lista própria: o <select> nativo não segue o tema)    */
/* -------------------------------------------------------------------------- */

function EnvPicker({ value, onChange, placeholder, groups, showOwner }: {
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  groups: { label: string; envs: Env[] }[];
  showOwner: (e: Env) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const all = groups.flatMap((g) => g.envs);
  const sel = all.find((e) => e.id === value) || null;

  useEffect(() => {
    if (!open) return;
    const fora = (ev: MouseEvent) => { if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false); };
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pick = (id: string) => { onChange(id); setOpen(false); };

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${input} flex items-center justify-between gap-3 text-left`}
      >
        <span className={`truncate ${sel ? '' : 'text-slate-400 dark:text-[color:var(--text-muted)] font-normal'}`}>
          {sel ? (
            <>
              {sel.nome} <span className="font-normal text-slate-400 dark:text-[color:var(--text-muted)]">({sel.subdomain})</span>
            </>
          ) : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{ backgroundColor: 'var(--bg-card-solid)' }}
          className="absolute z-50 mt-2 w-full max-h-80 overflow-auto rounded-2xl border border-slate-200 dark:border-[color:var(--border-main)] shadow-2xl p-2"
        >
          {all.length === 0 && <p className={`${muted} px-3 py-2`}>—</p>}
          {groups.filter((g) => g.envs.length > 0).map((g) => (
            <div key={g.label} className="py-1">
              <p className="px-3 pt-1 pb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-[color:var(--text-muted)]">
                {g.label}
              </p>
              {g.envs.map((e) => {
                const ativo = e.id === value;
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    onClick={() => pick(e.id)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                      ativo
                        ? 'bg-[rgba(43,221,102,0.14)] text-brand-dark dark:text-[color:var(--text-main)]'
                        : 'text-brand-dark dark:text-[color:var(--text-main)] hover:bg-slate-50 dark:hover:bg-[color:var(--bg-input-solid)]'
                    }`}
                  >
                    {e.compartilhado
                      ? <Users className="w-3.5 h-3.5 shrink-0 text-brand-primary" />
                      : <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                    <span className="font-bold truncate">{e.nome}</span>
                    <span className="text-xs text-slate-400 dark:text-[color:var(--text-muted)] truncate">
                      {e.subdomain}{showOwner(e) ? ` · ${e.dono}` : ''}
                    </span>
                    {ativo && <Check className="w-4 h-4 ml-auto shrink-0 text-brand-primary" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
