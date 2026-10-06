'use client';

/**
 * Tela 1 — Fila de Triagem.
 *
 * Meta operacional: 30 segundos por sinal, fila da semana em 20 minutos. É por
 * isso que o teclado é caminho de primeira classe (↑↓ 1-4 Enter X) e que a
 * prévia mostra a consequência antes do clique.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import { api, ErroRequisicao } from '@/lib/psops/client/api';
import {
  IMPACTOS_ORDEM,
  type ErroApi,
  type Impacto,
  type RespostaFila,
  type RespostaTriagem,
  type ResultadoColeta,
  type SinalDetalhe,
} from '@/lib/psops/client/tipos';
import { CaixaErro, CaixaVazia, Carregando, Painel, StatTile, btnPrimario } from './ui';
import { ListaSinais } from './ListaSinais';
import { PainelDecisao } from './PainelDecisao';
import { ModalDescarte } from './ModalDescarte';
import { ProvedorDeAvisos, useAvisos } from './Toaster';

/**
 * `admin` vem do servidor (sessão do portal) e só controla se o botão
 * "Coletar agora" aparece; a rota de coleta confere de novo por conta própria.
 */
export function FilaTriagem({ admin }: { admin: boolean }) {
  return (
    <ProvedorDeAvisos>
      <Conteudo admin={admin} />
    </ProvedorDeAvisos>
  );
}

type EstadoCarga = 'carregando' | 'pronto' | 'erro';

function Conteudo({ admin }: { admin: boolean }) {
  const avisar = useAvisos();
  const { t } = useTranslation();
  const { dateLocale } = useLanguage();
  const [coletando, setColetando] = useState(false);

  const [estado, setEstado] = useState<EstadoCarga>('carregando');
  const [erro, setErro] = useState<string | null>(null);
  const [fila, setFila] = useState<RespostaFila | null>(null);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [impactosPorSinal, setImpactosPorSinal] = useState<Record<string, Impacto[]>>({});
  const [detalhes, setDetalhes] = useState<Record<string, SinalDetalhe>>({});
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mostrarDescarte, setMostrarDescarte] = useState(false);

  const sinais = fila?.itens ?? [];
  const selecionado = useMemo(
    () => sinais.find((s) => s.id === selecionadoId) ?? null,
    [sinais, selecionadoId],
  );

  // ── carga da fila ─────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setEstado('carregando');
    setErro(null);
    try {
      const dados = await api.get<RespostaFila>('/api/pre-sales-ops/signals?status=NOVO&limite=100');
      setFila(dados);
      setImpactosPorSinal((atual) => {
        const novo = { ...atual };
        for (const s of dados.itens) if (!novo[s.id]) novo[s.id] = [...s.impactosSugeridos];
        return novo;
      });
      setSelecionadoId((atual) =>
        atual && dados.itens.some((s) => s.id === atual) ? atual : (dados.itens[0]?.id ?? null),
      );
      setEstado('pronto');
    } catch (e) {
      const req = e instanceof ErroRequisicao;
      // 500 aqui quase sempre é banco fora do ar ou migração não rodada —
      // vale dizer isso em vez de "erro interno".
      setErro(
        req && e.status === 403
          ? t('psops.erro.semAcesso')
          : req && e.status >= 500
            ? t('psops.erro.semBanco')
            : (e as Error).message,
      );
      setEstado('erro');
    }
  }, [t]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // ── detalhe do sinal selecionado (traz a prévia dos artefatos) ────────────
  const buscandoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selecionadoId || detalhes[selecionadoId] || buscandoRef.current === selecionadoId) return;
    buscandoRef.current = selecionadoId;
    setCarregandoDetalhe(true);
    api
      .get<SinalDetalhe>(`/api/pre-sales-ops/signals/${selecionadoId}`)
      .then((d) => setDetalhes((atual) => ({ ...atual, [d.id]: d })))
      .catch(() => {
        /* a prévia é enriquecimento: falhar aqui não bloqueia a triagem */
      })
      .finally(() => {
        setCarregandoDetalhe(false);
        buscandoRef.current = null;
      });
  }, [selecionadoId, detalhes]);

  // ── ações ─────────────────────────────────────────────────────────────────
  const alternarImpacto = useCallback(
    (i: Impacto) => {
      if (!selecionadoId) return;
      setImpactosPorSinal((atual) => {
        const lista = atual[selecionadoId] ?? [];
        const proximo = lista.includes(i) ? lista.filter((x) => x !== i) : [...lista, i];
        // mantém a ordem canônica: ESTUDO, DEMO, ESTIM, ESCOPO
        return { ...atual, [selecionadoId]: IMPACTOS_ORDEM.filter((k) => proximo.includes(k)) };
      });
    },
    [selecionadoId],
  );

  const removerDaFila = useCallback((id: string) => {
    setFila((atual) => {
      if (!atual) return atual;
      const itens = atual.itens.filter((s) => s.id !== id);
      const indiceAntigo = atual.itens.findIndex((s) => s.id === id);
      // seleciona o vizinho, para o fluxo por teclado não perder o lugar
      setSelecionadoId(itens[Math.min(indiceAntigo, itens.length - 1)]?.id ?? null);
      return {
        ...atual,
        itens,
        resumo: {
          ...atual.resumo,
          naFila: Math.max(0, atual.resumo.naFila - 1),
          triadosSemana: atual.resumo.triadosSemana + 1,
        },
      };
    });
  }, []);

  const gerar = useCallback(async () => {
    if (!selecionado || ocupado) return;
    const impactos = impactosPorSinal[selecionado.id] ?? [];
    if (impactos.length === 0) return;

    setOcupado(true);
    try {
      const r = await api.post<RespostaTriagem>(`/api/pre-sales-ops/signals/${selecionado.id}/triage`, {
        impactos,
      });
      removerDaFila(selecionado.id);

      avisar(t('psops.avisos.geradas', { count: r.atividades.length }));
      for (const nome of r.artefatosCriados) {
        avisar(t('psops.avisos.artefatoNovo', { nome }), 'neutro');
      }
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setOcupado(false);
    }
  }, [selecionado, impactosPorSinal, ocupado, avisar, removerDaFila, t]);

  const descartar = useCallback(
    async (motivo: string) => {
      if (!selecionado) return;
      setOcupado(true);
      try {
        await api.post(`/api/pre-sales-ops/signals/${selecionado.id}/discard`, { motivo });
        removerDaFila(selecionado.id);
        setMostrarDescarte(false);
        avisar(t('psops.avisos.descartado'), 'neutro');
      } catch (e) {
        avisar((e as Error).message, 'erro');
      } finally {
        setOcupado(false);
      }
    },
    [selecionado, avisar, removerDaFila, t],
  );

  // ── coleta manual (admin) ─────────────────────────────────────────────────
  // Em branch deploy o Netlify não dispara a função agendada: este botão é o
  // jeito de coletar na homologação. Em produção serve para não esperar as 07:00.
  const coletarAgora = useCallback(async () => {
    if (coletando) return;
    setColetando(true);
    try {
      // 200 → resultado; 207 (parcial) → { erro, detalhe: resultado }
      const r = await api.post<ResultadoColeta | (ErroApi & { detalhe: ResultadoColeta })>(
        '/api/pre-sales-ops/ingest/run',
      );
      const res = 'erro' in r ? r.detalhe : r;
      const falhas = res.porFonte.filter((f) => !f.ok).length;
      if (falhas > 0) {
        avisar(t('psops.coleta.parcial', { falhas, total: res.porFonte.length }), 'erro');
      } else {
        avisar(
          t('psops.coleta.ok', {
            novos: res.totalSinaisCriados,
            arquivados: res.totalSinaisArquivados,
          }),
        );
      }
      await carregar();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setColetando(false);
    }
  }, [coletando, avisar, carregar, t]);

  // ── atalhos de teclado ────────────────────────────────────────────────────
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (mostrarDescarte || ocupado) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (sinais.length === 0) return;

      const i = sinais.findIndex((s) => s.id === selecionadoId);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelecionadoId(sinais[Math.min(i + 1, sinais.length - 1)]?.id ?? null);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelecionadoId(sinais[Math.max(i - 1, 0)]?.id ?? null);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const impacto = IMPACTOS_ORDEM[Number(e.key) - 1];
        if (impacto) alternarImpacto(impacto);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void gerar();
      } else if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        setMostrarDescarte(true);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [sinais, selecionadoId, alternarImpacto, gerar, mostrarDescarte, ocupado]);

  // ── render ────────────────────────────────────────────────────────────────
  if (estado === 'erro') {
    return (
      <CaixaErro
        titulo={t('psops.erro.titulo')}
        mensagem={erro ?? ''}
        onTentarNovamente={() => void carregar()}
        rotuloBotao={t('psops.erro.tentarNovamente')}
      />
    );
  }

  const resumo = fila?.resumo;
  const ultimo = resumo?.ultimoRun;
  const nuncaColetou = estado === 'pronto' && !ultimo;

  const botaoColetar = admin ? (
    <button
      type="button"
      onClick={() => void coletarAgora()}
      disabled={coletando}
      title={t('psops.coleta.dica')}
      className={
        nuncaColetou
          ? btnPrimario
          : 'inline-flex items-center gap-1.5 rounded-xl border border-psops-forte px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-psops-tinta transition hover:border-psops-tinta disabled:opacity-50'
      }
    >
      <RefreshCw size={11} className={coletando ? 'animate-spin' : ''} aria-hidden />
      {coletando ? t('psops.coleta.coletando') : t('psops.coleta.botao')}
    </button>
  ) : null;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <StatTile
          rotulo={t('psops.stats.naFila')}
          valor={resumo?.naFila ?? '—'}
          sub={t('psops.stats.naFilaSub')}
          destaque
        />
        <StatTile
          rotulo={t('psops.stats.scoreAlto')}
          valor={resumo?.alto ?? '—'}
          sub={t('psops.stats.scoreAltoSub')}
        />
        <StatTile
          rotulo={t('psops.stats.arquivados')}
          valor={resumo?.arquivados ?? '—'}
          sub={t('psops.stats.arquivadosSub')}
        />
        <StatTile
          rotulo={t('psops.stats.triados')}
          valor={resumo?.triadosSemana ?? '—'}
          sub={t('psops.stats.triadosSub')}
        />
        <StatTile
          rotulo={t('psops.stats.ultimaColeta')}
          valor={
            <span className="text-[24px]">
              {ultimo
                ? new Date(ultimo.iniciadoEm).toLocaleTimeString(dateLocale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : t('psops.stats.nunca')}
            </span>
          }
          sub={
            ultimo
              ? `${new Date(ultimo.iniciadoEm).toLocaleDateString(dateLocale)} · ${t('psops.stats.sinaisNaColeta', { n: ultimo.sinaisCriados })}`
              : undefined
          }
          acao={nuncaColetou ? undefined : botaoColetar}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,1fr)_minmax(460px,1.15fr)]">
        <Painel
          titulo={t('psops.triagem.sinaisNovos')}
          dica={
            <>
              <kbd>↑</kbd>
              <kbd>↓</kbd> {t('psops.triagem.navegar')}
            </>
          }
        >
          {estado === 'carregando' ? (
            <Carregando texto={t('psops.carregando')} />
          ) : sinais.length === 0 && nuncaColetou ? (
            <CaixaVazia
              titulo={t('psops.coleta.nenhuma')}
              texto={admin ? t('psops.coleta.nenhumaAdmin') : t('psops.coleta.nenhumaUsuario')}
              acao={botaoColetar}
            />
          ) : sinais.length === 0 ? (
            <CaixaVazia titulo={t('psops.triagem.filaZerada')} texto={t('psops.triagem.filaZeradaTexto')} />
          ) : (
            <ListaSinais
              sinais={sinais}
              selecionadoId={selecionadoId}
              impactosPorSinal={impactosPorSinal}
              onSelecionar={setSelecionadoId}
            />
          )}
        </Painel>

        <Painel
          titulo={t('psops.triagem.decisao')}
          dica={
            <>
              <kbd>1</kbd>
              <kbd>2</kbd>
              <kbd>3</kbd>
              <kbd>4</kbd> {t('psops.triagem.impacto')} · <kbd>Enter</kbd> {t('psops.triagem.atalhoGerar')} ·{' '}
              <kbd>X</kbd> {t('psops.triagem.atalhoDescartar')}
            </>
          }
        >
          {estado === 'carregando' ? (
            <Carregando texto={t('psops.carregando')} />
          ) : selecionado ? (
            <PainelDecisao
              sinal={selecionado}
              detalhe={detalhes[selecionado.id] ?? null}
              carregandoDetalhe={carregandoDetalhe}
              impactos={impactosPorSinal[selecionado.id] ?? []}
              onAlternarImpacto={alternarImpacto}
              onGerar={() => void gerar()}
              onDescartar={() => setMostrarDescarte(true)}
              ocupado={ocupado}
            />
          ) : (
            <CaixaVazia titulo="—" texto={t('psops.triagem.selecione')} />
          )}
        </Painel>
      </div>

      {mostrarDescarte && selecionado ? (
        <ModalDescarte
          tituloSinal={selecionado.titulo}
          onConfirmar={(m) => void descartar(m)}
          onCancelar={() => setMostrarDescarte(false)}
          ocupado={ocupado}
        />
      ) : null}
    </>
  );
}
