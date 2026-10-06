'use client';

/**
 * Backlog — as atividades que a triagem gerou, por responsável.
 *
 * Três colunas que andam sozinhas: marcar o primeiro item do DoD move o card
 * para "Em andamento"; concluir exige o DoD completo (com as evidências). O
 * filtro por responsável é o caminho principal: cada um abre e vê o seu.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import { api } from '@/lib/psops/client/api';
import {
  IMPACTOS_ORDEM,
  textoDoSinal,
  type Atividade,
  type AtividadeStatus,
  type Impacto,
  type Pessoa,
  type RespostaBacklog,
  type RespostaPessoas,
} from '@/lib/psops/client/tipos';
import {
  Avatar,
  Badge,
  CaixaErro,
  CaixaVazia,
  Carregando,
  btnPrimario,
  btnSecundario,
  rotulo,
} from './ui';
import { ProvedorDeAvisos, useAvisos } from './Toaster';
import { FichaEstudoForm } from './FichaEstudoForm';
import { Portal } from './Portal';

export function Backlog() {
  return (
    <ProvedorDeAvisos>
      <Conteudo />
    </ProvedorDeAvisos>
  );
}

type FiltroResp = 'todos' | 'meus' | 'sem' | string;

const COLUNAS: AtividadeStatus[] = ['TODO', 'DOING', 'DONE'];
const MAX_CONCLUIDAS = 12;

function Conteudo() {
  const { t } = useTranslation();
  const avisar = useAvisos();
  const [dados, setDados] = useState<RespostaBacklog | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [euId, setEuId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroResp, setFiltroResp] = useState<FiltroResp>('todos');
  const [tipos, setTipos] = useState<Impacto[]>([]);
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [b, p] = await Promise.all([
        api.get<RespostaBacklog>('/api/pre-sales-ops/activities'),
        api.get<RespostaPessoas>('/api/pre-sales-ops/pessoas'),
      ]);
      setDados(b);
      setPessoas(p.itens);
      setEuId(p.euId);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const itens = useMemo(
    () => (dados?.itens ?? []).filter((a) => a.status !== 'CANCELADA'),
    [dados],
  );
  const abertas = useMemo(() => itens.filter((a) => a.status !== 'DONE'), [itens]);

  // contagens do filtro: só o que está aberto (é o que alguém precisa fazer)
  const contagem = useMemo(() => {
    const porPessoa = new Map<string, number>();
    let sem = 0;
    for (const a of abertas) {
      if (!a.responsavelId) sem += 1;
      else porPessoa.set(a.responsavelId, (porPessoa.get(a.responsavelId) ?? 0) + 1);
    }
    return { porPessoa, sem, total: abertas.length };
  }, [abertas]);

  const visiveis = useMemo(
    () =>
      itens.filter((a) => {
        if (tipos.length && !tipos.includes(a.tipo)) return false;
        if (filtroResp === 'todos') return true;
        if (filtroResp === 'sem') return !a.responsavelId;
        if (filtroResp === 'meus') return a.responsavelId === euId;
        return a.responsavelId === filtroResp;
      }),
    [itens, tipos, filtroResp, euId],
  );

  const aberta = itens.find((a) => a.id === abertaId) ?? null;

  if (erro) {
    return (
      <CaixaErro
        titulo={t('psops.erro.titulo')}
        mensagem={erro}
        onTentarNovamente={() => void carregar()}
        rotuloBotao={t('psops.erro.tentarNovamente')}
      />
    );
  }
  if (!dados) return <Carregando texto={t('psops.carregando')} />;

  const chip = (ativo: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
      ativo
        ? 'border-psops-acento bg-psops-acento/10 text-psops-tinta'
        : 'border-psops-linha bg-psops-surf1 text-psops-muted hover:text-psops-texto'
    }`;
  const n = (v: number) => <span className="opacity-70">{v}</span>;
  const pessoasComAbertas = pessoas.filter(
    (p) => (contagem.porPessoa.get(p.id) ?? 0) > 0 && p.id !== euId,
  );

  return (
    <>
      {/* ── filtro por responsável ── */}
      <div
        className="mb-3 flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t('psops.backlog.filtroResp')}
      >
        <button
          type="button"
          className={chip(filtroResp === 'todos')}
          onClick={() => setFiltroResp('todos')}
        >
          {t('psops.backlog.todos')} {n(contagem.total)}
        </button>
        <button
          type="button"
          className={chip(filtroResp === 'meus')}
          onClick={() => setFiltroResp('meus')}
        >
          {t('psops.backlog.minhas')} {n(euId ? (contagem.porPessoa.get(euId) ?? 0) : 0)}
        </button>
        <button
          type="button"
          className={chip(filtroResp === 'sem')}
          onClick={() => setFiltroResp('sem')}
        >
          {t('psops.backlog.semResponsavel')} {n(contagem.sem)}
        </button>
        {pessoasComAbertas.map((p) => (
          <button
            key={p.id}
            type="button"
            className={chip(filtroResp === p.id)}
            onClick={() => setFiltroResp(p.id)}
          >
            {p.nome} {n(contagem.porPessoa.get(p.id) ?? 0)}
          </button>
        ))}
      </div>

      {/* ── filtro por destino ── */}
      <div
        className="mb-6 flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t('psops.backlog.filtroTipo')}
      >
        {IMPACTOS_ORDEM.map((k) => {
          const ativo = tipos.includes(k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={ativo}
              className={chip(ativo)}
              onClick={() => setTipos((l) => (ativo ? l.filter((x) => x !== k) : [...l, k]))}
            >
              {t(`psops.impacto.${k}.nome`)}
            </button>
          );
        })}
      </div>

      {itens.length === 0 ? (
        <CaixaVazia titulo={t('psops.backlog.vazioTitulo')} texto={t('psops.backlog.vazioTexto')} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {COLUNAS.map((col) => {
            const daColuna = visiveis.filter((a) => a.status === col);
            const mostradas = col === 'DONE' ? daColuna.slice(0, MAX_CONCLUIDAS) : daColuna;
            return (
              <section
                key={col}
                className="rounded-[2rem] border border-psops-linha bg-psops-surf2 p-3"
              >
                <header className="mb-3 flex items-center justify-between px-2 pt-1">
                  <h3 className="font-heading text-sm font-black uppercase tracking-tight text-psops-texto">
                    {t(`psops.backlog.coluna.${col}`)}
                  </h3>
                  <span className="text-[11px] font-bold text-psops-muted">{daColuna.length}</span>
                </header>
                {mostradas.length === 0 ? (
                  <p className="px-2 pb-3 text-[12px] text-psops-muted">
                    {t('psops.backlog.colunaVazia')}
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {mostradas.map((a) => (
                      <li key={a.id}>
                        <CardAtividade a={a} onAbrir={() => setAbertaId(a.id)} />
                      </li>
                    ))}
                  </ul>
                )}
                {col === 'DONE' && daColuna.length > MAX_CONCLUIDAS ? (
                  <p className="px-2 pt-2 text-[11px] text-psops-muted">
                    {t('psops.backlog.maisConcluidas', { n: daColuna.length - MAX_CONCLUIDAS })}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {aberta ? (
        <DetalheAtividade
          a={aberta}
          pessoas={pessoas}
          onFechar={() => setAbertaId(null)}
          onMudou={carregar}
          avisar={avisar}
        />
      ) : null}
    </>
  );
}

function CardAtividade({ a, onAbrir }: { a: Atividade; onAbrir: () => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const texto = textoDoSinal(a.initiative.signal, language);
  const pct = a.progresso.total ? Math.round((a.progresso.feitos / a.progresso.total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="block w-full rounded-2xl border border-psops-linha bg-psops-surf1 p-3.5 text-left transition hover:border-psops-tinta"
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Badge variante="ga">{t(`psops.impacto.${a.tipo}.nome`)}</Badge>
        <Badge variante="produto">{t(`psops.produto.${a.initiative.signal.produto}`)}</Badge>
      </div>
      <div className="mb-1.5 text-[12.5px] font-bold leading-snug text-psops-texto">
        {texto.titulo}
      </div>
      <div className="mb-3 text-[11px] text-psops-muted">
        {a.artifact?.nome ?? t('psops.backlog.fichaDaFeature')}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-psops-muted">
          <Avatar iniciais={a.responsavelIniciais ?? '?'} indefinido={!a.responsavelId} />
          <span className="truncate">{a.responsavelNome ?? t('psops.triagem.semResponsavel')}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[10px] font-bold text-psops-muted">
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-psops-surf3" aria-hidden>
            <span className="block h-full bg-psops-acento" style={{ width: `${pct}%` }} />
          </span>
          {a.progresso.feitos}/{a.progresso.total}
        </span>
      </div>
    </button>
  );
}

function DetalheAtividade({
  a,
  pessoas,
  onFechar,
  onMudou,
  avisar,
}: {
  a: Atividade;
  pessoas: Pessoa[];
  onFechar: () => void;
  onMudou: () => Promise<void>;
  avisar: ReturnType<typeof useAvisos>;
}) {
  const { t } = useTranslation();
  const { language, dateLocale } = useLanguage();
  const texto = textoDoSinal(a.initiative.signal, language);
  const [ocupado, setOcupado] = useState(false);
  const [evidencias, setEvidencias] = useState<Record<number, string>>({});
  // marcação otimista: o checkbox responde na hora; se o servidor recusar, volta
  const [otimista, setOtimista] = useState<Record<number, boolean>>({});
  const concluida = a.status === 'DONE';

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const executar = async (fn: () => Promise<unknown>, ok?: string) => {
    setOcupado(true);
    try {
      await fn();
      if (ok) avisar(ok);
      await onMudou();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setOcupado(false);
    }
  };

  const marcar = (indice: number, feito: boolean) => {
    const item = a.dod[indice]!;
    const evidencia = (evidencias[indice] ?? item.evidencia ?? '').trim();
    if (feito && item.exigeEvidencia && !evidencia) {
      avisar(t('psops.backlog.evidenciaObrigatoria'), 'erro');
      return;
    }
    setOtimista((m) => ({ ...m, [indice]: feito }));
    void executar(() =>
      api.patch(`/api/pre-sales-ops/activities/${a.id}`, {
        dod: {
          indice,
          feito,
          ...(item.exigeEvidencia ? { evidencia: feito ? evidencia : null } : {}),
        },
      }),
    ).finally(() =>
      setOtimista((m) => {
        const { [indice]: _, ...resto } = m;
        return resto;
      }),
    );
  };

  const podeConcluir =
    !concluida &&
    a.progresso.total > 0 &&
    a.pendencias.faltamCheck === 0 &&
    a.pendencias.faltamEvidencia === 0;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="psops-titulo-atividade"
        className="fixed inset-0 z-[80] flex justify-end bg-black/50 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onFechar();
        }}
      >
        <div className="psops h-full w-full max-w-[640px] overflow-y-auto border-l border-psops-linha bg-psops-surf1 p-6 sm:p-8">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge variante="ga">{t(`psops.impacto.${a.tipo}.nome`)}</Badge>
              <Badge variante="produto">{t(`psops.produto.${a.initiative.signal.produto}`)}</Badge>
              <Badge>{t(`psops.backlog.coluna.${a.status}`)}</Badge>
            </div>
            <button
              type="button"
              onClick={onFechar}
              aria-label={t('psops.backlog.fechar')}
              className="text-psops-muted hover:text-psops-texto"
            >
              <X size={18} />
            </button>
          </div>

          <h2
            id="psops-titulo-atividade"
            className="mb-2 text-[18px] font-black leading-tight tracking-tight text-psops-texto"
          >
            {texto.titulo}
          </h2>
          <p className="mb-2 text-[12.5px] leading-relaxed text-psops-muted">{texto.trecho}</p>
          <a
            href={a.fonteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-5 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-psops-tinta hover:underline"
          >
            <ExternalLink size={12} aria-hidden />
            {t('psops.triagem.lerNota')}
          </a>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <div>
              <div className={`${rotulo} mb-1.5`}>{t('psops.backlog.artefato')}</div>
              <div className="text-[12.5px] font-bold text-psops-texto">
                {a.artifact?.nome ?? t('psops.backlog.fichaDaFeature')}
              </div>
            </div>
            <div>
              <label htmlFor="psops-resp" className={`${rotulo} mb-1.5 block`}>
                {t('psops.backlog.responsavel')}
              </label>
              <select
                id="psops-resp"
                value={a.responsavelId ?? ''}
                disabled={ocupado || concluida}
                onChange={(e) =>
                  void executar(() =>
                    api.patch(`/api/pre-sales-ops/activities/${a.id}`, {
                      responsavelId: e.target.value || null,
                    }),
                  )
                }
                className="w-full rounded-xl border border-psops-linha bg-psops-surf2 px-3 py-2 text-[12px] font-bold text-psops-texto outline-none focus:border-psops-tinta disabled:opacity-50"
              >
                <option value="">{t('psops.triagem.semResponsavel')}</option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Definition of Done ── */}
          <div className={`${rotulo} mb-2`}>
            {t('psops.backlog.dod')} · {a.progresso.feitos}/{a.progresso.total}
          </div>
          <ul className="mb-6 space-y-2">
            {a.dod.map((item, i) => (
              <li
                key={i}
                className="rounded-2xl border border-psops-linha bg-psops-surf2 px-3.5 py-2.5"
              >
                <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] text-psops-texto">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--psops-acento))]"
                    checked={otimista[i] ?? item.d}
                    disabled={ocupado || concluida}
                    onChange={(e) => marcar(i, e.target.checked)}
                  />
                  <span
                    className={
                      item.d ? 'text-psops-muted line-through decoration-psops-muted/50' : ''
                    }
                  >
                    {item.t}
                  </span>
                </label>
                {item.exigeEvidencia ? (
                  <div className="mt-2 pl-6">
                    {item.d && item.evidencia ? (
                      <span className="break-all text-[11px] text-psops-tinta">
                        {t('psops.backlog.evidencia')}: {item.evidencia}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={evidencias[i] ?? ''}
                        disabled={ocupado || concluida}
                        onChange={(e) => setEvidencias((m) => ({ ...m, [i]: e.target.value }))}
                        placeholder={t('psops.backlog.evidenciaPlaceholder')}
                        className="w-full rounded-xl border border-dashed border-psops-forte bg-psops-surf1 px-3 py-1.5 text-[11.5px] text-psops-texto outline-none placeholder:text-psops-muted/60 focus:border-psops-tinta"
                      />
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {a.tipo === 'ESTUDO' && a.studyNote ? (
            <FichaEstudoForm fichaId={a.studyNote.id} somenteLeitura={concluida} avisar={avisar} />
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-psops-linha pt-5">
            {concluida ? (
              <span className="text-[12px] text-psops-muted">
                {t('psops.backlog.concluidaEm', {
                  data: a.concluidoEm
                    ? new Date(a.concluidoEm).toLocaleDateString(dateLocale)
                    : '—',
                })}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!podeConcluir || ocupado}
                  onClick={() =>
                    void executar(
                      () => api.post(`/api/pre-sales-ops/activities/${a.id}/complete`),
                      a.tipo === 'ESTUDO'
                        ? t('psops.backlog.concluidaFicha')
                        : t('psops.backlog.concluida'),
                    )
                  }
                  className={btnPrimario}
                >
                  {t('psops.backlog.concluir')}
                </button>
                {!podeConcluir ? (
                  <span className="text-[11px] text-psops-muted">
                    {t('psops.backlog.faltam', {
                      itens: a.pendencias.faltamCheck,
                      evidencias: a.pendencias.faltamEvidencia,
                    })}
                  </span>
                ) : null}
              </>
            )}
            <button type="button" onClick={onFechar} className={`${btnSecundario} ml-auto`}>
              {t('psops.backlog.fechar')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
