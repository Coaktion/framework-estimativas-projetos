'use client';

/**
 * Linha do tempo — tudo o que o Zendesk publicou, semana a semana, com o que
 * aconteceu com cada sinal (na fila, triado, descartado, arquivado) e o link
 * para a nota original. É onde se procura "aquilo que saiu mês passado".
 */
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import { api } from '@/lib/psops/client/api';
import { textoDoSinal, type Produto, type RespostaTimeline, type SignalStatus } from '@/lib/psops/client/tipos';
import { Badge, CaixaErro, CaixaVazia, Carregando, varianteDoTipo } from './ui';

const OPCOES_SEMANAS = [4, 8, 12];

const VARIANTE_STATUS: Record<SignalStatus, 'ga' | 'neutro' | 'discreto' | 'produto'> = {
  NOVO: 'ga',
  TRIADO: 'produto',
  DESCARTADO: 'neutro',
  AUTO_ARQUIVADO: 'discreto',
  NAO_CLASSIFICADO: 'neutro',
};

export function LinhaDoTempo() {
  const { t } = useTranslation();
  const { language, dateLocale } = useLanguage();
  const [semanas, setSemanas] = useState(4);
  const [arquivados, setArquivados] = useState(false);
  const [produto, setProduto] = useState<Produto | null>(null);
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [dados, setDados] = useState<RespostaTimeline | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  // contagem por produto SEM o filtro de produto: senão, ao escolher um
  // produto, os chips dos outros sumiriam
  const [base, setBase] = useState<{ porProduto: RespostaTimeline['porProduto']; total: number } | null>(null);

  // busca com atraso: não dispara a cada tecla
  useEffect(() => {
    const id = setTimeout(() => setQ(busca.trim().length >= 2 ? busca.trim() : ''), 350);
    return () => clearTimeout(id);
  }, [busca]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const p = new URLSearchParams({ semanas: String(semanas), arquivados: String(arquivados) });
      if (produto) p.set('produto', produto);
      if (q) p.set('q', q);
      const r = await api.get<RespostaTimeline>(`/api/pre-sales-ops/timeline?${p}`);
      setDados(r);
      if (!produto) setBase({ porProduto: r.porProduto, total: r.total });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [semanas, arquivados, produto, q]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const chip = (ativo: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
      ativo
        ? 'border-psops-acento bg-psops-acento/10 text-psops-tinta'
        : 'border-psops-linha bg-psops-surf1 text-psops-muted hover:text-psops-texto'
    }`;
  const data = (iso: string, opts?: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString(dateLocale, opts);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">{t('psops.linha.buscar')}</span>
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-psops-muted" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t('psops.linha.buscar')}
            className="w-64 rounded-xl border border-psops-linha bg-psops-surf1 py-2 pl-8 pr-3 text-[12px] text-psops-texto outline-none placeholder:text-psops-muted/70 focus:border-psops-tinta"
          />
        </label>
        <div className="flex gap-1" role="group" aria-label={t('psops.linha.periodo')}>
          {OPCOES_SEMANAS.map((n) => (
            <button key={n} type="button" aria-pressed={semanas === n} className={chip(semanas === n)} onClick={() => setSemanas(n)}>
              {t('psops.linha.semanas', { n })}
            </button>
          ))}
        </div>
        <button type="button" aria-pressed={arquivados} className={chip(arquivados)} onClick={() => setArquivados((v) => !v)}>
          {t('psops.linha.mostrarArquivados')}
        </button>
      </div>

      {base && base.porProduto.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('psops.linha.porProduto')}>
          <button type="button" aria-pressed={produto === null} className={chip(produto === null)} onClick={() => setProduto(null)}>
            {t('psops.linha.todosProdutos')} <span className="opacity-70">{base.total}</span>
          </button>
          {base.porProduto.map((p) => (
            <button
              key={p.produto}
              type="button"
              aria-pressed={produto === p.produto}
              className={chip(produto === p.produto)}
              onClick={() => setProduto(produto === p.produto ? null : p.produto)}
            >
              {t(`psops.produto.${p.produto}`)} <span className="opacity-70">{p.total}</span>
            </button>
          ))}
        </div>
      ) : null}

      {erro ? (
        <CaixaErro
          titulo={t('psops.erro.titulo')}
          mensagem={erro}
          onTentarNovamente={() => void carregar()}
          rotuloBotao={t('psops.erro.tentarNovamente')}
        />
      ) : carregando && !dados ? (
        <Carregando texto={t('psops.carregando')} />
      ) : !dados || dados.total === 0 ? (
        <CaixaVazia titulo={t('psops.linha.vazioTitulo')} texto={t('psops.linha.vazioTexto')} />
      ) : (
        <div className={`space-y-6 ${carregando ? 'opacity-60' : ''}`}>
          {dados.semanas.map((s) => (
            <section key={s.semana}>
              <h3 className="mb-2.5 flex items-baseline gap-3 px-1">
                <span className="font-heading text-sm font-black uppercase tracking-tight text-psops-texto">
                  {t('psops.linha.semanaDe', { data: data(s.inicio, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) })}
                </span>
                <span className="text-[11px] font-bold text-psops-muted">{t('psops.linha.nSinais', { count: s.itens.length })}</span>
              </h3>
              <ul className="overflow-hidden rounded-[1.5rem] border border-psops-linha bg-psops-surf1">
                {s.itens.map((sinal) => {
                  const texto = textoDoSinal(sinal, language);
                  return (
                    <li key={sinal.id} className="flex flex-col gap-2 border-b border-psops-linha px-5 py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:gap-4">
                      <span className="w-[52px] shrink-0 pt-0.5 text-[11px] font-bold text-psops-muted">
                        {data(sinal.publicadoEm, { day: '2-digit', month: '2-digit' })}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-1.5 block text-[13px] font-bold leading-snug text-psops-texto">{texto.titulo}</span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge variante={VARIANTE_STATUS[sinal.status]} titulo={sinal.motivoRuido ?? undefined}>
                            {t(`psops.status.${sinal.status}`)}
                          </Badge>
                          <Badge variante="produto">{t(`psops.produto.${sinal.produto}`)}</Badge>
                          <Badge variante={varianteDoTipo(sinal.tipo)}>{t(`psops.tipo.${sinal.tipo}`)}</Badge>
                          {sinal.status === 'AUTO_ARQUIVADO' && sinal.motivoRuido ? (
                            <span className="text-[10.5px] text-psops-muted">{sinal.motivoRuido}</span>
                          ) : null}
                        </span>
                      </span>
                      <a
                        href={sinal.fonteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 self-start text-[11px] font-bold text-psops-tinta hover:underline"
                      >
                        <ExternalLink size={12} aria-hidden />
                        {t('psops.linha.abrirNota')}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
