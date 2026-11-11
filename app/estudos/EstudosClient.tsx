'use client';

/**
 * Estudos — a planilha "Acompanhamento de Estudo do Time" dentro do portal,
 * com as mesmas quatro abas: Acompanhamento semanal, Matriz de conhecimento
 * (com as cores 0–4), Resumo e Relatório. Resumo e Relatório são calculados
 * na hora a partir dos registros e da matriz (lib/estudos/calculo.ts).
 */
import { Fragment, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Banner, Button, CARD, Chip, Label, PageHeader, SELECT, Section, TextArea, TextInput } from '@/components/booking/ui';
import {
  COR_NIVEL, COR_PRIORIDADE, NIVEIS, PRIORIDADES, TIPOS_ATIVIDADE,
  calcularRelatorio, calcularResumo, corEscala, segundaDaSemana,
} from '@/lib/estudos/calculo';
import type { DadosEstudos, PessoaEstudo } from '@/lib/estudos/server';
import { apagarRegistroAction, definirMetaAction, definirNivelAction, salvarRegistroAction, type RegistroInput } from './actions';

type Aba = 'semanal' | 'matriz' | 'resumo' | 'relatorio';
const ABAS: Aba[] = ['semanal', 'matriz', 'resumo', 'relatorio'];

const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');
const num = (v: number | null, casas = 2) => (v === null ? '—' : v.toFixed(casas).replace('.', ','));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const TH = 'px-3 py-2.5 text-left text-caption font-semibold uppercase tracking-wide text-white bg-[#1A1A1A] whitespace-nowrap';
const TD = 'px-3 py-2 text-label text-brand-dark border-t border-slate-200 align-top';

export default function EstudosClient({ inicial, euId, hoje }: { inicial: DadosEstudos; euId: number; hoje: string }) {
  const { t } = useTranslation();
  const [dados, setDados] = useState(inicial);
  const [aba, setAba] = useState<Aba>('semanal');
  const [erro, setErro] = useState<string | null>(null);

  const categorias = useMemo(() => Array.from(new Set(dados.topicos.map((x) => x.categoria))), [dados.topicos]);
  const falhou = (code: string) => setErro(t(`estudos.erros.${code}`, { defaultValue: t('estudos.erros.server_error') }));

  return (
    <div className="space-y-8">
      <PageHeader title={t('estudos.tituloA')} accent={t('estudos.tituloB')} subtitle={t('estudos.subtitulo')} />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('estudos.abas')}>
        {ABAS.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 rounded-full text-label font-medium border transition-colors ${
              aba === a ? 'brand-bg-primary text-brand-ink border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:text-brand-dark'
            }`}
          >
            {t(`estudos.aba.${a}`)}
          </button>
        ))}
      </div>

      {erro && (
        <div onClick={() => setErro(null)} role="alert">
          <Banner tone="error">{erro}</Banner>
        </div>
      )}

      {aba === 'semanal' && (
        <AbaSemanal dados={dados} setDados={setDados} euId={euId} hoje={hoje} categorias={categorias} falhou={falhou} />
      )}
      {aba === 'matriz' && <AbaMatriz dados={dados} setDados={setDados} categorias={categorias} falhou={falhou} />}
      {aba === 'resumo' && <AbaResumo dados={dados} />}
      {aba === 'relatorio' && <AbaRelatorio dados={dados} categorias={categorias} hoje={hoje} />}
    </div>
  );
}

type SetDados = React.Dispatch<React.SetStateAction<DadosEstudos>>;
const nomeDe = (pessoas: PessoaEstudo[], id: number) => pessoas.find((p) => p.id === id)?.nome ?? `#${id}`;
const primeiroNome = (n: string) => n.split(/\s+/)[0] ?? n;

/**
 * compacta: cabe na largura da página sem barra de rolagem — cabeçalhos
 * quebram linha, células mais estreitas e a primeira coluna leva o resto.
 */
const COMPACTA =
  '[&_th]:whitespace-normal [&_th]:normal-case [&_th]:tracking-normal [&_th]:leading-tight [&_th]:px-2 [&_td]:px-2 [&_th:first-child]:pl-3 [&_td:first-child]:pl-3';

function Tabela({ children, minW = 640, compacta = false }: { children: ReactNode; minW?: number; compacta?: boolean }) {
  return (
    <div className={`${CARD} overflow-x-auto`}>
      <table className={`w-full border-collapse ${compacta ? COMPACTA : ''}`} style={compacta ? undefined : { minWidth: minW }}>
        {children}
      </table>
    </div>
  );
}

// ───────────────────────── Acompanhamento semanal ──────────────────────────

function AbaSemanal({ dados, setDados, euId, hoje, categorias, falhou }: {
  dados: DadosEstudos; setDados: SetDados; euId: number; hoje: string; categorias: string[]; falhou: (c: string) => void;
}) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const vazio = (): RegistroInput => ({
    userId: dados.pessoas.some((p) => p.id === euId) ? euId : (dados.pessoas[0]?.id ?? euId),
    data: segundaDaSemana(hoje),
    categoria: null,
    atividade: '',
    tipo: null,
    observacoes: null,
  });
  const [form, setForm] = useState<RegistroInput>(vazio);
  const [filtro, setFiltro] = useState<number | 'todos'>('todos');
  const editando = Boolean(form.id);

  const salvar = () => {
    startTransition(async () => {
      const res = await salvarRegistroAction(form);
      if (!res.ok) return falhou(res.error ?? 'server_error');
      const salvo = { ...form, id: res.id!, atividade: form.atividade.trim(), observacoes: form.observacoes?.trim() || null };
      setDados((d) => ({
        ...d,
        registros: [salvo as DadosEstudos['registros'][number], ...d.registros.filter((r) => r.id !== res.id)].sort(
          (a, b) => b.data.localeCompare(a.data),
        ),
      }));
      setForm(vazio());
    });
  };

  const apagar = (id: string) => {
    if (!window.confirm(t('estudos.semanal.confirmarApagar'))) return;
    startTransition(async () => {
      const res = await apagarRegistroAction(id);
      if (!res.ok) return falhou(res.error ?? 'server_error');
      setDados((d) => ({ ...d, registros: d.registros.filter((r) => r.id !== id) }));
      if (form.id === id) setForm(vazio());
    });
  };

  const lista = dados.registros.filter((r) => filtro === 'todos' || r.userId === filtro);
  const podeSalvar = form.atividade.trim().length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(form.data) && !pending;

  return (
    <div className="space-y-8">
      <Section
        title={editando ? t('estudos.semanal.editarTitulo') : t('estudos.semanal.novoTitulo')}
        description={t('estudos.semanal.novoDesc')}
      >
        <form
          className="grid gap-4 md:grid-cols-[160px_200px_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            if (podeSalvar) salvar();
          }}
        >
          <div>
            <Label htmlFor="est-data">{t('estudos.semanal.data')}</Label>
            <TextInput id="est-data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="est-pessoa">{t('estudos.semanal.pessoa')}</Label>
            <select id="est-pessoa" className={`${SELECT} w-full`} value={form.userId} onChange={(e) => setForm({ ...form, userId: Number(e.target.value) })}>
              {dados.pessoas.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="est-cat">{t('estudos.semanal.categoria')}</Label>
            <select id="est-cat" className={`${SELECT} w-full`} value={form.categoria ?? ''} onChange={(e) => setForm({ ...form, categoria: e.target.value || null })}>
              <option value="">—</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="est-ativ">{t('estudos.semanal.atividade')}</Label>
            <TextInput id="est-ativ" value={form.atividade} maxLength={500} placeholder={t('estudos.semanal.atividadeDica')} onChange={(e) => setForm({ ...form, atividade: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="est-tipo">{t('estudos.semanal.tipo')}</Label>
            <select id="est-tipo" className={`${SELECT} w-full`} value={form.tipo ?? ''} onChange={(e) => setForm({ ...form, tipo: e.target.value || null })}>
              <option value="">—</option>
              {TIPOS_ATIVIDADE.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="est-obs">{t('estudos.semanal.observacoes')}</Label>
            <TextArea id="est-obs" rows={2} maxLength={2000} value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="md:col-span-3 flex flex-wrap gap-3">
            <Button type="submit" variant="primary" busy={pending} disabled={!podeSalvar}>
              {editando ? t('estudos.semanal.salvar') : (<><Plus className="w-4 h-4" /> {t('estudos.semanal.registrar')}</>)}
            </Button>
            {editando && (
              <Button variant="ghost" onClick={() => setForm(vazio())}>{t('estudos.semanal.cancelar')}</Button>
            )}
          </div>
        </form>
      </Section>

      <Section title={t('estudos.semanal.listaTitulo')} description={t('estudos.semanal.listaDesc', { n: dados.registros.length })}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip on={filtro === 'todos'} onClick={() => setFiltro('todos')}>{t('estudos.todos')}</Chip>
          {dados.pessoas.map((p) => (
            <Chip key={p.id} on={filtro === p.id} onClick={() => setFiltro(p.id)}>
              {primeiroNome(p.nome)} · {dados.registros.filter((r) => r.userId === p.id).length}
            </Chip>
          ))}
        </div>
        {lista.length === 0 ? (
          <p className="text-label text-slate-500">{t('estudos.semanal.vazio')}</p>
        ) : (
          <Tabela minW={820}>
            <thead>
              <tr>
                {['data', 'pessoa', 'categoria', 'atividade', 'tipo', 'observacoes'].map((c) => (
                  <th key={c} className={TH}>{t(`estudos.semanal.${c}`)}</th>
                ))}
                <th className={TH} aria-label={t('estudos.semanal.acoes')} />
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id} className={form.id === r.id ? 'bg-[color:var(--accent-tint)]' : ''}>
                  <td className={`${TD} whitespace-nowrap`}>{dataBr(r.data)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{primeiroNome(nomeDe(dados.pessoas, r.userId))}</td>
                  <td className={`${TD} text-slate-600`}>{r.categoria ?? '—'}</td>
                  <td className={TD}>{r.atividade}</td>
                  <td className={`${TD} whitespace-nowrap`}>{r.tipo ?? '—'}</td>
                  <td className={`${TD} text-slate-600`}>{r.observacoes ?? ''}</td>
                  <td className={`${TD} whitespace-nowrap text-right`}>
                    <button type="button" className="p-1.5 text-slate-400 hover:text-brand-dark" title={t('estudos.semanal.editar')} aria-label={t('estudos.semanal.editar')}
                      onClick={() => { setForm({ ...r }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-1.5 text-slate-400 hover:text-red-600" title={t('estudos.semanal.apagar')} aria-label={t('estudos.semanal.apagar')}
                      onClick={() => apagar(r.id)} disabled={pending}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Section>
    </div>
  );
}

// ────────────────────────── Matriz de conhecimento ──────────────────────────

function Legenda() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      {NIVEIS.map((n) => (
        <span key={n} className="rounded-lg px-2.5 py-1 text-caption font-medium text-[#1A1A1A]" style={{ background: COR_NIVEL[n] }}
          title={t(`estudos.nivelDesc.${n}`)}>
          {n} — {t(`estudos.nivel.${n}`)}
        </span>
      ))}
    </div>
  );
}

function AbaMatriz({ dados, setDados, categorias, falhou }: {
  dados: DadosEstudos; setDados: SetDados; categorias: string[]; falhou: (c: string) => void;
}) {
  const { t } = useTranslation();
  const [cat, setCat] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const nivelDe = useMemo(() => new Map(dados.niveis.map((n) => [`${n.topicoId}:${n.userId}`, n.nivel])), [dados.niveis]);

  const mudarNivel = async (topicoId: string, userId: number, nivel: number | null) => {
    const antes = dados.niveis;
    setDados((d) => ({
      ...d,
      niveis: [
        ...d.niveis.filter((n) => !(n.topicoId === topicoId && n.userId === userId)),
        ...(nivel === null ? [] : [{ topicoId, userId, nivel }]),
      ],
    }));
    const res = await definirNivelAction(topicoId, userId, nivel);
    if (!res.ok) {
      setDados((d) => ({ ...d, niveis: antes }));
      falhou(res.error ?? 'server_error');
    }
  };

  const mudarMeta = async (topicoId: string, meta: { nivelAlvo?: number | null; prioridade?: string | null }) => {
    const antes = dados.topicos;
    setDados((d) => ({ ...d, topicos: d.topicos.map((x) => (x.id === topicoId ? { ...x, ...meta } : x)) }));
    const res = await definirMetaAction(topicoId, meta);
    if (!res.ok) {
      setDados((d) => ({ ...d, topicos: antes }));
      falhou(res.error ?? 'server_error');
    }
  };

  const q = busca.trim().toLowerCase();
  const visiveis = dados.topicos.filter(
    (x) => (cat === 'todas' || x.categoria === cat) && (!q || `${x.topico} ${x.descricao ?? ''}`.toLowerCase().includes(q)),
  );
  const celula = 'h-9 w-full min-w-[56px] rounded-md border-0 text-center text-label font-semibold text-[#1A1A1A] cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary';

  return (
    <div className="space-y-5">
      <Section title={t('estudos.matriz.titulo')} description={t('estudos.matriz.desc')}>
        <div className="space-y-4">
          <Legenda />
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('estudos.matriz.buscar')} className="pl-9" aria-label={t('estudos.matriz.buscar')} />
            </div>
            <select className={SELECT} value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('estudos.semanal.categoria')}>
              <option value="todas">{t('estudos.matriz.todasCategorias')}</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Tabela minW={760 + dados.pessoas.length * 70}>
        <thead className="sticky top-0 z-10">
          <tr>
            <th className={TH}>{t('estudos.matriz.topico')}</th>
            {dados.pessoas.map((p) => (
              <th key={p.id} className={`${TH} text-center !bg-[#7FD171] !text-[#1A1A1A]`}>{primeiroNome(p.nome)}</th>
            ))}
            <th className={`${TH} text-center`}>{t('estudos.matriz.alvo')}</th>
            <th className={`${TH} text-center`}>{t('estudos.matriz.prioridade')}</th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((c) => {
            const doGrupo = visiveis.filter((x) => x.categoria === c);
            if (!doGrupo.length) return null;
            return (
              <Fragment key={c}>
                <tr>
                  <td colSpan={3 + dados.pessoas.length} className="bg-slate-100 px-3 py-2 text-label font-bold text-brand-dark border-t border-slate-200">
                    {c}
                  </td>
                </tr>
                {doGrupo.map((x) => (
                  <tr key={x.id}>
                    <td className={TD}>
                      <div className="font-medium">{x.topico}</div>
                      {x.descricao && <div className="text-caption text-slate-500">{x.descricao}</div>}
                    </td>
                    {dados.pessoas.map((p) => {
                      const v = nivelDe.get(`${x.id}:${p.id}`);
                      return (
                        <td key={p.id} className={`${TD} p-1`}>
                          <select
                            aria-label={`${x.topico} · ${p.nome}`}
                            className={celula}
                            style={{ background: v === undefined ? 'transparent' : COR_NIVEL[v] }}
                            value={v === undefined ? '' : String(v)}
                            onChange={(e) => void mudarNivel(x.id, p.id, e.target.value === '' ? null : Number(e.target.value))}
                          >
                            <option value="">—</option>
                            {NIVEIS.map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                    <td className={`${TD} p-1`}>
                      <select
                        aria-label={`${x.topico} · ${t('estudos.matriz.alvo')}`}
                        className={celula}
                        style={{ background: x.nivelAlvo === null ? 'transparent' : COR_NIVEL[x.nivelAlvo] }}
                        value={x.nivelAlvo === null ? '' : String(x.nivelAlvo)}
                        onChange={(e) => void mudarMeta(x.id, { nivelAlvo: e.target.value === '' ? null : Number(e.target.value) })}
                      >
                        <option value="">—</option>
                        {NIVEIS.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </td>
                    <td className={`${TD} p-1`}>
                      <select
                        aria-label={`${x.topico} · ${t('estudos.matriz.prioridade')}`}
                        className={`${celula} min-w-[84px]`}
                        style={x.prioridade && COR_PRIORIDADE[x.prioridade]
                          ? { background: COR_PRIORIDADE[x.prioridade]!.fundo, color: COR_PRIORIDADE[x.prioridade]!.texto }
                          : { background: 'transparent' }}
                        value={x.prioridade ?? ''}
                        onChange={(e) => void mudarMeta(x.id, { prioridade: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {PRIORIDADES.map((n) => (
                          <option key={n} value={n}>{t(`estudos.prioridade.${n}`)}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </Tabela>
    </div>
  );
}

// ──────────────────────────────── Resumo ────────────────────────────────────

function CelulaEscala({ v, forte = false }: { v: number | null; forte?: boolean }) {
  return (
    <td className={`${TD} text-center tabular-nums ${forte ? 'font-bold' : ''}`} style={v === null ? undefined : { background: corEscala(v), color: '#1A1A1A' }}>
      {num(v)}
    </td>
  );
}

function AbaResumo({ dados }: { dados: DadosEstudos }) {
  const { t } = useTranslation();
  const r = useMemo(() => calcularResumo(dados.topicos, dados.niveis, dados.pessoas.map((p) => p.id)), [dados]);
  const linha = (l: (typeof r)['geral'], geral = false) => (
    <tr key={l.categoria}>
      <td className={`${TD} ${geral ? 'font-bold' : ''}`}>{geral ? t('estudos.resumo.geral') : l.categoria}</td>
      {dados.pessoas.map((p) => <CelulaEscala key={p.id} v={l.porPessoa[p.id] ?? null} forte={geral} />)}
      <CelulaEscala v={l.mediaCategoria} forte />
      <CelulaEscala v={l.alvoMedio} forte={geral} />
      <td className={`${TD} text-center tabular-nums ${l.gap !== null && l.gap > 0 ? 'font-bold text-red-600' : ''}`}>{num(l.gap)}</td>
    </tr>
  );
  return (
    <div className="space-y-5">
      <Section title={t('estudos.resumo.titulo')} description={t('estudos.resumo.desc')}>
        <Legenda />
      </Section>
      <Tabela compacta>
        <thead>
          <tr>
            <th className={TH}>{t('estudos.semanal.categoria')}</th>
            {dados.pessoas.map((p) => <th key={p.id} className={`${TH} text-center`}>{primeiroNome(p.nome)}</th>)}
            <th className={`${TH} text-center`}>{t('estudos.resumo.mediaCategoria')}</th>
            <th className={`${TH} text-center`}>{t('estudos.resumo.alvoMedio')}</th>
            <th className={`${TH} text-center`}>{t('estudos.resumo.gap')}</th>
          </tr>
        </thead>
        <tbody>
          {r.linhas.map((l) => linha(l))}
          {linha(r.geral, true)}
        </tbody>
      </Tabela>
    </div>
  );
}

// ────────────────────────────── Relatório ───────────────────────────────────

function Kpi({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="text-caption text-slate-500">{rotulo}</div>
      <div className="mt-1 text-[22px] font-bold text-brand-dark tabular-nums">{valor}</div>
    </div>
  );
}

const VERDE = { background: '#CDFFB5', color: '#1A1A1A', fontWeight: 700 } as const;
const VERMELHO = { background: '#FCE1E1', color: '#B81C1C' } as const;

function AbaRelatorio({ dados, categorias, hoje }: { dados: DadosEstudos; categorias: string[]; hoje: string }) {
  const { t } = useTranslation();
  const ids = dados.pessoas.map((p) => p.id);
  const rel = useMemo(() => calcularRelatorio(dados.registros, ids, categorias, hoje), [dados.registros, ids.join(','), categorias, hoje]); // eslint-disable-line react-hooks/exhaustive-deps
  const resumo = useMemo(() => calcularResumo(dados.topicos, dados.niveis, ids), [dados.topicos, dados.niveis, ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const dominio = new Map(resumo.linhas.map((l) => [l.categoria, l.mediaCategoria]));
  const nome = (u: number | 'TIME') => (u === 'TIME' ? t('estudos.relatorio.time') : primeiroNome(nomeDe(dados.pessoas, u)));
  const linhaTime = 'bg-[#CDFFB5]/60 font-bold';

  return (
    <div className="space-y-8">
      <p className="text-label text-slate-500 max-w-[80ch]">{t('estudos.relatorio.desc')}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo={t('estudos.relatorio.primeiraSemana')} valor={dataBr(rel.primeiraSemana)} />
        <Kpi rotulo={t('estudos.relatorio.semanaAtual')} valor={dataBr(rel.semanaAtual)} />
        <Kpi rotulo={t('estudos.relatorio.semanas')} valor={rel.semanas} />
        <Kpi rotulo={t('estudos.relatorio.total')} valor={rel.total} />
      </div>

      <Section title={t('estudos.relatorio.porPessoa')}>
        <Tabela compacta>
          <thead>
            <tr>
              {['pessoa', 'treinamentos', 'semanasCom', 'pctSemanas', 'mediaSemana', 'ultimos30', 'ultimo', 'diasSem'].map((c) => (
                <th key={c} className={TH}>{t(`estudos.relatorio.col.${c}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rel.porPessoa.map((l) => (
              <tr key={String(l.userId)} className={l.userId === 'TIME' ? linhaTime : ''}>
                <td className={TD}>{nome(l.userId)}</td>
                <td className={`${TD} tabular-nums`}>{l.treinamentos}</td>
                <td className={`${TD} tabular-nums`}>{l.semanasComRegistro}</td>
                <td className={`${TD} tabular-nums`}>{pct(l.pctSemanas)}</td>
                <td className={`${TD} tabular-nums`}>{num(l.mediaPorSemana)}</td>
                <td className={`${TD} tabular-nums`}>{l.ultimos30}</td>
                <td className={`${TD} tabular-nums`}>{dataBr(l.ultimoRegistro)}</td>
                <td className={`${TD} tabular-nums`} style={l.diasSemRegistrar !== null && l.diasSemRegistrar > 14 ? { ...VERMELHO, fontWeight: 700 } : undefined}>
                  {l.diasSemRegistrar ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
        <p className="mt-2 text-caption text-slate-500">{t('estudos.relatorio.alertaDias')}</p>
      </Section>

      <Section title={t('estudos.relatorio.porTipo')}>
        <Tabela compacta>
          <thead>
            <tr>
              <th className={TH}>{t('estudos.relatorio.col.pessoa')}</th>
              {rel.tipos.map((x) => <th key={x} className={`${TH} text-center`}>{x}</th>)}
            </tr>
          </thead>
          <tbody>
            {rel.porTipo.map((l) => (
              <tr key={String(l.userId)} className={l.userId === 'TIME' ? linhaTime : ''}>
                <td className={TD}>{nome(l.userId)}</td>
                {rel.tipos.map((x) => <td key={x} className={`${TD} text-center tabular-nums`}>{l.contagem[x] ?? 0}</td>)}
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Section>

      <Section title={t('estudos.relatorio.porCategoria')}>
        <Tabela compacta>
          <thead>
            <tr>
              <th className={TH}>{t('estudos.semanal.categoria')}</th>
              {dados.pessoas.map((p) => <th key={p.id} className={`${TH} text-center`}>{primeiroNome(p.nome)}</th>)}
              <th className={`${TH} text-center`}>{t('estudos.relatorio.time')}</th>
              <th className={`${TH} text-center`}>{t('estudos.relatorio.dominio')}</th>
            </tr>
          </thead>
          <tbody>
            {rel.porCategoria.map((l) => (
              <tr key={l.categoria}>
                <td className={TD}>{l.categoria}</td>
                {dados.pessoas.map((p) => {
                  const v = l.porPessoa[p.id] ?? 0;
                  return <td key={p.id} className={`${TD} text-center tabular-nums`} style={v > 0 ? VERDE : undefined}>{v}</td>;
                })}
                <td className={`${TD} text-center tabular-nums font-bold`}>{l.time}</td>
                <CelulaEscala v={dominio.get(l.categoria) ?? null} />
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Section>

      <Section title={t('estudos.relatorio.porSemana')}>
        <Tabela compacta>
          <thead>
            <tr>
              <th className={TH}>{t('estudos.relatorio.semana')}</th>
              {dados.pessoas.map((p) => <th key={p.id} className={`${TH} text-center`}>{primeiroNome(p.nome)}</th>)}
              <th className={`${TH} text-center`}>{t('estudos.relatorio.time')}</th>
            </tr>
          </thead>
          <tbody>
            {rel.porSemana.map((l) => (
              <tr key={l.semana}>
                <td className={`${TD} tabular-nums`}>{dataBr(l.semana)}</td>
                {dados.pessoas.map((p) => {
                  const v = l.porPessoa[p.id] ?? 0;
                  return <td key={p.id} className={`${TD} text-center tabular-nums`} style={v > 0 ? VERDE : VERMELHO}>{v}</td>;
                })}
                <td className={`${TD} text-center tabular-nums font-bold`}>{l.time}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Section>
    </div>
  );
}
