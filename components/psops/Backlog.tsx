'use client';

/**
 * Backlog — as atividades que a triagem gerou, por responsável.
 *
 * Três colunas que andam sozinhas: marcar o primeiro item do DoD move o card
 * para "Em andamento"; concluir exige o DoD completo (com as evidências). O
 * filtro por responsável é o caminho principal: cada um abre e vê o seu.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import { api } from '@/lib/psops/client/api';
import {
  ABAS_MODULO,
  IMPACTOS_ORDEM,
  type TipoAtividade,
  TIPO_ARTEFATO_DO_IMPACTO,
  abaDoProduto,
  textoDoSinal,
  urlDaNota,
  type Artefato,
  type Atividade,
  type AtividadeStatus,
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
import { ModalRegistroEstudo } from './ModalRegistroEstudo';
import type { ResultadoRegistroEstudo, SugestaoRegistroEstudo } from '@/lib/estudos/radar';

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
  const [tipos, setTipos] = useState<TipoAtividade[]>([]);
  /** aba de módulo do Zendesk (as mesmas da Triagem); 'TODOS' = sem filtro */
  const [modulo, setModulo] = useState<string>('TODOS');
  const [abertaId, setAbertaId] = useState<string | null>(null);
  // estudo concluído que não entrou sozinho nos Estudos: abre a janela
  const [registroEstudo, setRegistroEstudo] = useState<SugestaoRegistroEstudo | null>(null);
  const aposConcluirEstudo = useCallback(
    (estudo: ResultadoRegistroEstudo | null | undefined) => {
      if (!estudo) return;
      if (estudo.registrado) avisar(t('psops.estudoRegistro.automatico', { categoria: estudo.categoria }), 'neutro');
      else if ('sugestao' in estudo) setRegistroEstudo(estudo.sugestao);
    },
    [avisar, t],
  );
  const [verArquivadas, setVerArquivadas] = useState(false);
  /** card sendo arrastado e a coluna sob o cursor */
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<AtividadeStatus | null>(null);

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

  // Link do sininho (?atividade=<id>): abre a atividade direto e limpa a URL
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('atividade');
    if (!id) return;
    setAbertaId(id);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // Soltar o card numa coluna muda o status na hora (otimista); se o servidor
  // recusar, a lista recarrega e o card volta.
  const moverCard = useCallback(
    async (id: string, status: AtividadeStatus) => {
      const atual = dados?.itens.find((x) => x.id === id);
      if (!atual || atual.status === status) return;
      setDados((d) => (d ? { ...d, itens: d.itens.map((x) => (x.id === id ? { ...x, status } : x)) } : d));
      try {
        const r = await api.patch<{ estudo?: ResultadoRegistroEstudo | null }>(
          `/api/pre-sales-ops/activities/${id}`,
          { status },
        );
        if (status === 'CANCELADA') avisar(t('psops.backlog.arquivadaOk'));
        if (status === 'DONE') aposConcluirEstudo(r?.estudo);
      } catch (e) {
        avisar((e as Error).message, 'erro');
      } finally {
        await carregar();
      }
    },
    [dados, avisar, carregar, t, aposConcluirEstudo],
  );

  const itens = useMemo(
    () => (dados?.itens ?? []).filter((a) => a.status !== 'CANCELADA'),
    [dados],
  );
  const arquivadas = useMemo(
    () => (dados?.itens ?? []).filter((a) => a.status === 'CANCELADA'),
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

  const filtrar = useCallback(
    (a: Atividade) => {
      if (tipos.length && !tipos.includes(a.tipo)) return false;
      if (modulo !== 'TODOS' && abaDoProduto(a.initiative.signal.produto) !== modulo) return false;
      if (filtroResp === 'todos') return true;
      if (filtroResp === 'sem') return !a.responsavelId;
      if (filtroResp === 'meus') return a.responsavelId === euId;
      return a.responsavelId === filtroResp;
    },
    [tipos, filtroResp, euId, modulo],
  );
  const visiveis = useMemo(() => itens.filter(filtrar), [itens, filtrar]);

  const aberta = (dados?.itens ?? []).find((a) => a.id === abertaId) ?? null;
  // módulos com atividade aberta, para os chips do filtro
  const abertasPorModulo = abertas.reduce<Record<string, number>>((m, a) => {
    const aba = abaDoProduto(a.initiative.signal.produto);
    m[aba] = (m[aba] ?? 0) + 1;
    return m;
  }, {});

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
    `inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-label font-medium transition ${
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
        {[...IMPACTOS_ORDEM, 'SKILL' as const].map((k) => {
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

      {/* ── filtro por módulo (as mesmas abas da Triagem) ── */}
      {Object.keys(abertasPorModulo).length > 1 ? (
        <div
          className="-mt-3 mb-6 flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t('psops.backlog.filtroModulo')}
        >
          <button type="button" className={chip(modulo === 'TODOS')} onClick={() => setModulo('TODOS')}>
            {t('psops.backlog.todosModulos')} {n(abertas.length)}
          </button>
          {ABAS_MODULO.filter((a) => abertasPorModulo[a.id]).map((a) => (
            <button key={a.id} type="button" className={chip(modulo === a.id)} onClick={() => setModulo(a.id)}>
              {a.id === 'OUTROS' ? t('psops.triagem.abaOutros') : t(`psops.produto.${a.id}`)} {n(abertasPorModulo[a.id]!)}
            </button>
          ))}
        </div>
      ) : null}

      {itens.length === 0 && arquivadas.length === 0 ? (
        <CaixaVazia titulo={t('psops.backlog.vazioTitulo')} texto={t('psops.backlog.vazioTexto')} />
      ) : (
        <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-label text-psops-muted">{t('psops.backlog.dicaArrastar')}</p>
          <button
            type="button"
            className={chip(verArquivadas)}
            aria-pressed={verArquivadas}
            onClick={() => setVerArquivadas((v) => !v)}
          >
            <Archive size={13} aria-hidden /> {t('psops.backlog.verArquivadas')} {n(arquivadas.length)}
          </button>
        </div>
        <div className={`grid items-stretch gap-4 ${verArquivadas ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {[...COLUNAS, ...(verArquivadas ? (['CANCELADA'] as AtividadeStatus[]) : [])].map((col) => {
            const daColuna =
              col === 'CANCELADA'
                ? arquivadas.filter(filtrar)
                : visiveis.filter((a) => a.status === col);
            const mostradas = col === 'DONE' ? daColuna.slice(0, MAX_CONCLUIDAS) : daColuna;
            const alvo = colunaAlvo === col && arrastando !== null;
            return (
              <section
                key={col}
                onDragOver={(e) => {
                  if (!arrastando) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (colunaAlvo !== col) setColunaAlvo(col);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setColunaAlvo(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain') || arrastando;
                  setArrastando(null);
                  setColunaAlvo(null);
                  if (id) void moverCard(id, col);
                }}
                className={`min-h-[120px] rounded-3xl border p-3 transition ${
                  alvo ? 'border-psops-acento bg-psops-acento/10' : 'border-psops-linha bg-psops-surf2'
                }`}
              >
                <header className="mb-3 flex items-center justify-between px-2 pt-1">
                  <h3 className="text-psops-texto text-title font-bold">
                    {t(`psops.backlog.coluna.${col}`)}
                  </h3>
                  <span className="text-label font-bold text-psops-muted">{daColuna.length}</span>
                </header>
                {mostradas.length === 0 ? (
                  <p className="px-2 pb-3 text-[12px] text-psops-muted">
                    {col === 'CANCELADA' ? t('psops.backlog.arquivadasVazia') : t('psops.backlog.colunaVazia')}
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {mostradas.map((a) => (
                      <li
                        key={a.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', a.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setArrastando(a.id);
                        }}
                        onDragEnd={() => {
                          setArrastando(null);
                          setColunaAlvo(null);
                        }}
                        className={`cursor-grab active:cursor-grabbing ${arrastando === a.id ? 'opacity-40' : ''}`}
                      >
                        <CardAtividade a={a} onAbrir={() => setAbertaId(a.id)} />
                      </li>
                    ))}
                  </ul>
                )}
                {col === 'DONE' && daColuna.length > MAX_CONCLUIDAS ? (
                  <p className="px-2 pt-2 text-label text-psops-muted">
                    {t('psops.backlog.maisConcluidas', { n: daColuna.length - MAX_CONCLUIDAS })}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
        </>
      )}

      {aberta ? (
        <DetalheAtividade
          a={aberta}
          pessoas={pessoas}
          onFechar={() => setAbertaId(null)}
          onMudou={carregar}
          avisar={avisar}
          onEstudoConcluido={aposConcluirEstudo}
        />
      ) : null}
      {registroEstudo ? (
        <ModalRegistroEstudo
          sugestao={registroEstudo}
          pessoas={pessoas}
          onFechar={() => setRegistroEstudo(null)}
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

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="block w-full rounded-2xl border border-psops-linha bg-psops-surf1 p-3.5 text-left transition hover:border-psops-tinta"
    >
      <div className="mb-2 flex items-start gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <Badge variante="ga">{t(`psops.impacto.${a.tipo}.nome`)}</Badge>
          <Badge variante="produto">{t(`psops.produto.${a.initiative.signal.produto}`)}</Badge>
        </div>
        <Score valor={a.initiative.signal.score} />
      </div>
      <div className="mb-1.5 text-[12.5px] font-bold leading-snug text-psops-texto">
        {texto.titulo}
      </div>
      <div className="mb-3 text-label text-psops-muted">
        {a.tipo === 'ESTUDO'
          ? t('psops.backlog.fichaDaFeature')
          : (a.artifact?.nome ?? t(`psops.backlog.grupoArtefatos.${a.tipo}`))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-label text-psops-muted">
          <Avatar iniciais={a.responsavelIniciais ?? '?'} indefinido={!a.responsavelId} />
          <span className="truncate">{a.responsavelNome ?? t('psops.triagem.semResponsavel')}</span>
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
  onEstudoConcluido,
}: {
  a: Atividade;
  pessoas: Pessoa[];
  onFechar: () => void;
  onMudou: () => Promise<void>;
  avisar: ReturnType<typeof useAvisos>;
  onEstudoConcluido: (estudo: ResultadoRegistroEstudo | null | undefined) => void;
}) {
  const { t } = useTranslation();
  const { language, dateLocale } = useLanguage();
  const texto = textoDoSinal(a.initiative.signal, language);
  const [ocupado, setOcupado] = useState(false);
  const concluida = a.status === 'DONE';
  const arquivada = a.status === 'CANCELADA';

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

  const mover = (status: AtividadeStatus, ok: string) =>
    executar(() => api.patch(`/api/pre-sales-ops/activities/${a.id}`, { status }), ok);

  // Demo, Estimativa e Escopo: opcionalmente, quais artefatos foram
  // atualizados e o que mudou (vira um commit em cada um). O sugerido na
  // triagem já vem marcado.
  const tipoArtefato = a.tipo === 'SKILL' ? null : TIPO_ARTEFATO_DO_IMPACTO[a.tipo];
  const artefatoSugerido = a.artifact?.id ?? null;
  const [opcoesArt, setOpcoesArt] = useState<Artefato[] | null>(null);
  const [marcados, setMarcados] = useState<string[]>(a.artifact ? [a.artifact.id] : []);
  const [descricao, setDescricao] = useState('');
  useEffect(() => {
    if (!tipoArtefato || concluida) return;
    let vivo = true;
    api
      .get<{ itens: Artefato[] }>('/api/pre-sales-ops/artifacts')
      .then((r) => {
        if (!vivo) return;
        const doTipo = r.itens.filter((x) => x.tipo === tipoArtefato);
        setOpcoesArt(doTipo);
        // Demo atualiza os 3 ambientes padrão quase sempre: já vêm marcados
        if (a.tipo === 'DEMO' && !artefatoSugerido) setMarcados(doTipo.map((x) => x.id));
      })
      .catch(() => vivo && setOpcoesArt([]));
    return () => {
      vivo = false;
    };
    // pelo id: recarregar a atividade não desfaz as marcações
  }, [tipoArtefato, concluida, a.tipo, a.id, artefatoSugerido]);
  // o commit é opcional; mas, começado, precisa estar completo
  const comCommit = Boolean(tipoArtefato) && descricao.trim().length > 0;
  const faltaCommit = comCommit && (marcados.length === 0 || descricao.trim().length < 5);

  const podeConcluir = !concluida && !arquivada && !faltaCommit;

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
              <Score valor={a.initiative.signal.score} />
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
            className="mb-2 text-[18px] font-bold leading-tight tracking-tight text-psops-texto"
          >
            {texto.titulo}
          </h2>
          {a.tipo === 'SKILL' && a.initiative.id ? (
            <p className="mb-2 rounded-xl border border-psops-linha bg-psops-surf2 px-3 py-2 text-[12.5px] font-medium text-psops-texto">
              {a.titulo}
            </p>
          ) : null}
          {a.tipo === 'SKILL' ? (
            <p className="mb-2 text-[12px] text-psops-muted">{t('psops.backlog.skillDica')}</p>
          ) : null}
          {texto.trecho ? <p className="mb-2 text-[12.5px] leading-relaxed text-psops-muted">{texto.trecho}</p> : null}
          {a.fonteUrl ? (
            <a
              href={urlDaNota(a.fonteUrl, language)}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-5 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-psops-tinta hover:underline"
            >
              <ExternalLink size={12} aria-hidden />
              {t('psops.triagem.lerNota')}
            </a>
          ) : (
            <div className="mb-5" />
          )}

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <div>
              <div className={`${rotulo} mb-1.5`}>{t('psops.backlog.artefato')}</div>
              <div className="text-[12.5px] font-bold text-psops-texto">
                {a.tipo === 'ESTUDO'
                  ? t('psops.backlog.fichaDaFeature')
                  : (a.artifact?.nome ?? t(`psops.backlog.grupoArtefatos.${a.tipo}`))}
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

          {a.tipo === 'ESTUDO' && a.studyNote ? (
            <FichaEstudoForm fichaId={a.studyNote.id} somenteLeitura={arquivada} avisar={avisar} />
          ) : null}

          {tipoArtefato && !concluida && !arquivada ? (
            <div className="mb-2 rounded-2xl border border-psops-linha bg-psops-surf2 p-4">
              <div className={`${rotulo} mb-2`}>{t('psops.backlog.quaisArtefatos')}</div>
              {!opcoesArt ? (
                <p className="text-[12px] text-psops-muted">{t('psops.carregando')}</p>
              ) : (
                <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
                  {opcoesArt.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-start gap-2 text-[12px] text-psops-texto">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--psops-acento))]"
                        checked={marcados.includes(o.id)}
                        disabled={ocupado}
                        onChange={(e) =>
                          setMarcados((m) => (e.target.checked ? [...m, o.id] : m.filter((x) => x !== o.id)))
                        }
                      />
                      <span>{o.nome}</span>
                    </label>
                  ))}
                </div>
              )}
              <label htmlFor="psops-commit" className={`${rotulo} mb-1.5 block`}>
                {t('psops.backlog.oQueMudou')}
              </label>
              <textarea
                id="psops-commit"
                rows={3}
                value={descricao}
                disabled={ocupado}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={t('psops.backlog.oQueMudouPlaceholder')}
                className="w-full rounded-xl border border-psops-linha bg-psops-surf1 px-3 py-2 text-[12.5px] text-psops-texto outline-none focus:border-psops-tinta"
              />
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-psops-linha pt-5">
            {arquivada ? (
              <>
                <span className="text-[12px] text-psops-muted">{t('psops.backlog.arquivadaAviso')}</span>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void mover('TODO', t('psops.backlog.desarquivada'))}
                  className={btnSecundario}
                >
                  <ArchiveRestore size={14} aria-hidden /> {t('psops.backlog.desarquivar')}
                </button>
              </>
            ) : concluida ? (
              <>
                <span className="text-[12px] text-psops-muted">
                  {t('psops.backlog.concluidaEm', {
                    data: a.concluidoEm
                      ? new Date(a.concluidoEm).toLocaleDateString(dateLocale)
                      : '—',
                  })}
                </span>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void mover('DOING', t('psops.backlog.reaberta'))}
                  className={btnSecundario}
                >
                  {t('psops.backlog.reabrir')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!podeConcluir || ocupado}
                  onClick={() =>
                    void executar(
                      () =>
                        api
                          .post<{ estudo?: ResultadoRegistroEstudo | null }>(
                            `/api/pre-sales-ops/activities/${a.id}/complete`,
                            comCommit ? { artefatoIds: marcados, descricao: descricao.trim() } : undefined,
                          )
                          .then((r) => onEstudoConcluido(r?.estudo)),
                      a.tipo === 'ESTUDO'
                        ? t('psops.backlog.concluidaFicha')
                        : t('psops.backlog.concluida'),
                    )
                  }
                  className={btnPrimario}
                >
                  {t('psops.backlog.concluir')}
                </button>
                {faltaCommit ? (
                  <span className="text-label text-psops-muted">{t('psops.backlog.faltaCommit')}</span>
                ) : null}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void mover('CANCELADA', t('psops.backlog.arquivadaOk')).then(onFechar)}
                  className={btnSecundario}
                  title={t('psops.backlog.arquivarDica')}
                >
                  <Archive size={14} aria-hidden /> {t('psops.backlog.arquivar')}
                </button>
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

/** Score de relevância da novidade (o mesmo da fila de triagem). */
function Score({ valor }: { valor: number }) {
  const { t } = useTranslation();
  return (
    <span
      title={t('psops.backlog.scoreDica')}
      className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-[3px] text-caption font-bold tabular-nums ${
        valor >= 80 ? 'border-psops-tinta text-psops-tinta' : 'border-psops-linha text-psops-muted'
      }`}
    >
      {t('psops.triagem.score')} {valor}
    </span>
  );
}
