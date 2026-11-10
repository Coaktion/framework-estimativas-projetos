'use client';

/**
 * Mapa de Artefatos — o que o time mantém, com dono, data da última
 * atualização e o histórico de atualizações ("commits") de cada um:
 *
 *   Demo       → os 3 ambientes de demo padrão (Brasil, EUA, SSAC)
 *   Estimativa → um por módulo de estimativa do Tool Center
 *   Escopo     → os documentos de escopo, cada um em PT, EN e ES
 *
 * Clicar no artefato abre a linha do tempo e, para o dono (ou o gestor), o
 * campo de registrar atualização.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/psops/client/api';
import {
  ARTEFATO_TIPOS_ORDEM,
  urlDaNota,
  type Artefato,
  type EstadoSaude,
  type HistoricoArtefato,
  type Pessoa,
  type RespostaPessoas,
} from '@/lib/psops/client/tipos';
import { Avatar, Badge, CaixaErro, CaixaVazia, Carregando, StatTile, btnPrimario, rotulo } from './ui';
import { ProvedorDeAvisos, useAvisos } from './Toaster';

export function MapaArtefatos({ gestor, usuarioId }: { gestor: boolean; usuarioId: string | null }) {
  return (
    <ProvedorDeAvisos>
      <Conteudo gestor={gestor} usuarioId={usuarioId} />
    </ProvedorDeAvisos>
  );
}

const VARIANTE_SAUDE: Record<EstadoSaude, 'ga' | 'alerta' | 'deprecation' | 'discreto'> = {
  SAUDAVEL: 'ga',
  ATENCAO: 'alerta',
  CRITICO: 'deprecation',
  DIVERGENTE: 'deprecation',
  NAO_VERIFICADO: 'discreto',
};

/** "Custom SE Pacote de Horas · PT" → documento "Custom SE Pacote de Horas", idioma "PT". */
function partesEscopo(nome: string): { doc: string; idioma: string } {
  const i = nome.lastIndexOf(' · ');
  return i < 0 ? { doc: nome, idioma: '' } : { doc: nome.slice(0, i), idioma: nome.slice(i + 3) };
}

function Conteudo({ gestor, usuarioId }: { gestor: boolean; usuarioId: string | null }) {
  const { t } = useTranslation();
  const avisar = useAvisos();
  const [itens, setItens] = useState<Artefato[] | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  /** os 3 grupos começam fechados: clica e abre */
  const [gruposAbertos, setGruposAbertos] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [a, p] = await Promise.all([
        api.get<{ itens: Artefato[] }>('/api/pre-sales-ops/artifacts'),
        api.get<RespostaPessoas>('/api/pre-sales-ops/pessoas'),
      ]);
      setItens(a.itens);
      setPessoas(p.itens);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const definirDono = useCallback(
    async (art: Artefato, donoId: string | null) => {
      setSalvando(art.id);
      try {
        const r = await api.patch<{ atividadesAtribuidas: number }>(
          `/api/pre-sales-ops/artifacts/${art.id}`,
          { donoId },
        );
        const nome = pessoas.find((p) => p.id === donoId)?.nome;
        avisar(
          donoId
            ? r.atividadesAtribuidas > 0
              ? t('psops.mapa.donoComHeranca', { nome, n: r.atividadesAtribuidas })
              : t('psops.mapa.donoDefinido', { nome })
            : t('psops.mapa.donoRemovido'),
        );
        await carregar();
      } catch (e) {
        avisar((e as Error).message, 'erro');
      } finally {
        setSalvando(null);
      }
    },
    [pessoas, avisar, carregar, t],
  );

  const resumo = useMemo(() => {
    const l = itens ?? [];
    return {
      total: l.length,
      nunca: l.filter((a) => !a.ultimaAtualizacao).length,
      atencao: l.filter((a) => ['ATENCAO', 'CRITICO'].includes(a.saude.estado)).length,
    };
  }, [itens]);

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
  if (!itens) return <Carregando texto={t('psops.carregando')} />;
  if (itens.length === 0) {
    return <CaixaVazia titulo={t('psops.mapa.vazioTitulo')} texto={t('psops.mapa.vazioTexto')} />;
  }

  const colunas = 'md:grid-cols-[1.8fr_1.2fr_1.4fr]';

  return (
    <>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatTile rotulo={t('psops.mapa.statTotal')} valor={resumo.total} sub={t('psops.mapa.statTotalSub')} />
        <StatTile rotulo={t('psops.mapa.statNunca')} valor={resumo.nunca} sub={t('psops.mapa.statNuncaSub')} />
        <StatTile rotulo={t('psops.mapa.statAtencao')} valor={resumo.atencao} sub={t('psops.mapa.statAtencaoSub')} />
      </div>

      <div className="space-y-5">
        {ARTEFATO_TIPOS_ORDEM.map((tipo) => {
          const doTipo = itens.filter((a) => a.tipo === tipo);
          if (doTipo.length === 0) return null;
          return (
            <section key={tipo} className="overflow-hidden rounded-3xl border border-psops-linha bg-psops-surf1">
              <button
                type="button"
                aria-expanded={gruposAbertos.includes(tipo)}
                onClick={() =>
                  setGruposAbertos((g) => (g.includes(tipo) ? g.filter((x) => x !== tipo) : [...g, tipo]))
                }
                className="flex w-full flex-wrap items-center gap-3 px-6 py-4 text-left hover:bg-psops-surf2"
              >
                <span className="w-3 text-psops-muted">{gruposAbertos.includes(tipo) ? '▾' : '▸'}</span>
                <span className="text-title font-bold text-psops-texto">{t(`psops.mapa.grupo.${tipo}`)}</span>
                <span className="text-label font-bold text-psops-muted">{doTipo.length}</span>
                <UltimaDaSecao itens={doTipo} />
              </button>
              {gruposAbertos.includes(tipo) ? (
              <div className="border-t border-psops-linha">
              <div className={`hidden gap-4 border-b border-psops-linha px-6 py-2.5 md:grid ${colunas}`}>
                {['colNome', 'colUltima', 'colDono'].map((c) => (
                  <span key={c} className={rotulo}>
                    {t(`psops.mapa.${c}`)}
                  </span>
                ))}
              </div>
              <ul>
                {doTipo.map((a, i) => {
                  const doc = tipo === 'ESCOPO' ? partesEscopo(a.nome).doc : null;
                  const docAnterior = tipo === 'ESCOPO' && i > 0 ? partesEscopo(doTipo[i - 1]!.nome).doc : null;
                  const podeRegistrar = !a.donoId || a.donoId === usuarioId || gestor;
                  return (
                    <Fragment key={a.id}>
                      {doc && doc !== docAnterior ? (
                        <li className="border-b border-psops-linha bg-psops-surf2 px-6 py-2 text-[11px] font-bold uppercase tracking-wide text-psops-muted">
                          {doc}
                        </li>
                      ) : null}
                      <li className="border-b border-psops-linha last:border-b-0">
                        <div className={`grid grid-cols-2 items-center gap-x-4 gap-y-2 px-6 py-3.5 ${colunas}`}>
                          <button
                            type="button"
                            onClick={() => setAberto(aberto === a.id ? null : a.id)}
                            aria-expanded={aberto === a.id}
                            className="col-span-2 text-left md:col-span-1"
                          >
                            <div className="text-[13px] font-bold text-psops-texto hover:text-psops-tinta">
                              <span className="mr-1.5 inline-block w-3 text-psops-muted">{aberto === a.id ? '▾' : '▸'}</span>
                              {doc ? partesEscopo(a.nome).idioma : a.nome}
                            </div>
                            <div className="pl-[18px] text-[10.5px] text-psops-muted">
                              {t('psops.mapa.commits', { count: a.atualizacoesTotal })} · v{a.versao}
                            </div>
                          </button>
                          <div title={a.saude.detalhe}>
                            {a.ultimaAtualizacao ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[12px] text-psops-texto">
                                  {new Date(a.ultimaAtualizacao).toLocaleDateString()}
                                </span>
                                <Badge variante={VARIANTE_SAUDE[a.saude.estado]}>
                                  {t('psops.mapa.haDias', { count: a.saude.idadeDias ?? 0 })}
                                </Badge>
                              </div>
                            ) : (
                              <Badge variante="discreto">{t('psops.mapa.nuncaAtualizado')}</Badge>
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            {gestor ? (
                              <select
                                aria-label={t('psops.mapa.colDono')}
                                value={a.donoId ?? ''}
                                disabled={salvando === a.id}
                                onChange={(e) => void definirDono(a, e.target.value || null)}
                                className={`w-full rounded-xl border bg-psops-surf2 px-3 py-2 text-[12px] font-bold outline-none focus:border-psops-tinta disabled:opacity-50 ${
                                  a.donoId ? 'border-psops-linha text-psops-texto' : 'border-dashed border-psops-forte text-psops-muted'
                                }`}
                              >
                                <option value="">{t('psops.mapa.semDono')}</option>
                                {pessoas.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nome}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="flex items-center gap-2 text-[12px] text-psops-texto">
                                <Avatar iniciais={a.donoIniciais ?? '?'} indefinido={!a.donoId} />
                                {a.donoNome ?? <span className="text-psops-muted">{t('psops.mapa.semDono')}</span>}
                              </span>
                            )}
                          </div>
                        </div>
                        {aberto === a.id ? (
                          <LinhaDoTempoArtefato
                            artefato={a}
                            podeRegistrar={podeRegistrar}
                            onRegistrado={() => void carregar()}
                          />
                        ) : null}
                      </li>
                    </Fragment>
                  );
                })}
              </ul>
              </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Cabeçalho da seção: a atualização mais recente entre os artefatos dela. */
function UltimaDaSecao({ itens }: { itens: Artefato[] }) {
  const { t } = useTranslation();
  const ultimo = itens
    .filter((a) => a.ultimaAtualizacao)
    .sort((x, y) => +new Date(y.ultimaAtualizacao!) - +new Date(x.ultimaAtualizacao!))[0];
  if (!ultimo) {
    return <span className="ml-auto text-[11px] text-psops-muted">{t('psops.mapa.secaoSemAtualizacao')}</span>;
  }
  return (
    <span
      className="ml-auto min-w-0 max-w-full truncate text-[11px] text-psops-muted"
      title={ultimo.ultimoCommit?.descricao ?? ''}
    >
      {t('psops.mapa.secaoUltima', {
        quando: new Date(ultimo.ultimaAtualizacao!).toLocaleDateString(),
        nome: ultimo.nome,
        autor: ultimo.ultimoCommit?.autorNome ?? '—',
      })}
      {ultimo.ultimoCommit ? <span className="text-psops-texto"> · {ultimo.ultimoCommit.descricao}</span> : null}
    </span>
  );
}

function LinhaDoTempoArtefato({
  artefato,
  podeRegistrar,
  onRegistrado,
}: {
  artefato: Artefato;
  podeRegistrar: boolean;
  onRegistrado: () => void;
}) {
  const { t } = useTranslation();
  const avisar = useAvisos();
  const [hist, setHist] = useState<HistoricoArtefato | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setHist(await api.get<HistoricoArtefato>(`/api/pre-sales-ops/artifacts/${artefato.id}`));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [artefato.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const registrar = async () => {
    setEnviando(true);
    try {
      await api.post(`/api/pre-sales-ops/artifacts/${artefato.id}/updates`, { descricao: descricao.trim() });
      setDescricao('');
      avisar(t('psops.mapa.registrado', { nome: artefato.nome }));
      await carregar();
      onRegistrado();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="border-t border-psops-linha bg-psops-surf2 px-6 py-4">
      {podeRegistrar ? (
        <div className="mb-4">
          <label className={`${rotulo} mb-1.5 block`} htmlFor={`desc-${artefato.id}`}>
            {t('psops.mapa.registrarTitulo')}
          </label>
          <textarea
            id={`desc-${artefato.id}`}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            placeholder={t('psops.mapa.registrarPlaceholder')}
            className="w-full rounded-xl border border-psops-linha bg-psops-surf1 px-3 py-2 text-[12.5px] text-psops-texto outline-none focus:border-psops-tinta"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className={btnPrimario}
              disabled={enviando || descricao.trim().length < 5}
              onClick={() => void registrar()}
            >
              {enviando ? t('psops.mapa.registrando') : t('psops.mapa.registrar')}
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[11.5px] text-psops-muted">{t('psops.mapa.soDono')}</p>
      )}

      <div className={`${rotulo} mb-2`}>{t('psops.mapa.historico')}</div>
      {erro ? (
        <p className="text-[12px] text-psops-muted">{erro}</p>
      ) : !hist ? (
        <p className="text-[12px] text-psops-muted">{t('psops.carregando')}</p>
      ) : hist.atualizacoes.length === 0 ? (
        <p className="text-[12px] text-psops-muted">{t('psops.mapa.historicoVazio')}</p>
      ) : (
        <ol className="relative ml-2 border-l border-psops-linha">
          {hist.atualizacoes.map((u) => (
            <li key={u.id} className="mb-3 ml-4 last:mb-0">
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-psops-tinta" />
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-psops-muted">
                <Avatar iniciais={u.autorIniciais} />
                <span className="font-bold text-psops-texto">{u.autorNome ?? '—'}</span>
                <span>{new Date(u.criadoEm).toLocaleString()}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-psops-texto">{u.descricao}</p>
              {u.sinal ? (
                <a
                  href={urlDaNota(u.sinal.fonteUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[11px] text-psops-tinta hover:underline"
                >
                  {t('psops.mapa.origem', { titulo: u.sinal.titulo })}
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
