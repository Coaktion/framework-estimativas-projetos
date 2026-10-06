'use client';

/**
 * Mapa de Artefatos — os ativos que o time mantém (template de demo, framework
 * de estimativa por frente, blocos de escopo por frente) e quem responde por
 * cada um. O dono daqui é de onde toda atividade gerada herda o responsável.
 *
 * O semáforo usa a data VERIFICADA (a fonte confirmou), nunca o clique.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/psops/client/api';
import {
  ARTEFATO_TIPOS_ORDEM,
  type Artefato,
  type EstadoSaude,
  type Pessoa,
  type RespostaPessoas,
} from '@/lib/psops/client/tipos';
import { Avatar, Badge, CaixaErro, CaixaVazia, Carregando, Painel, StatTile, rotulo } from './ui';
import { ProvedorDeAvisos, useAvisos } from './Toaster';

export function MapaArtefatos({ admin }: { admin: boolean }) {
  return (
    <ProvedorDeAvisos>
      <Conteudo admin={admin} />
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

function Conteudo({ admin }: { admin: boolean }) {
  const { t } = useTranslation();
  const avisar = useAvisos();
  const [itens, setItens] = useState<Artefato[] | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

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
      semDono: l.filter((a) => !a.donoId).length,
      comAbertas: l.filter((a) => a.pendentes > 0).length,
      atencao: l.filter((a) => ['ATENCAO', 'CRITICO', 'DIVERGENTE'].includes(a.saude.estado)).length,
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

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile rotulo={t('psops.mapa.statTotal')} valor={resumo.total} sub={t('psops.mapa.statTotalSub')} />
        <StatTile
          rotulo={t('psops.mapa.statSemDono')}
          valor={resumo.semDono}
          sub={t('psops.mapa.statSemDonoSub')}
        />
        <StatTile rotulo={t('psops.mapa.statAbertas')} valor={resumo.comAbertas} sub={t('psops.mapa.statAbertasSub')} />
        <StatTile rotulo={t('psops.mapa.statAtencao')} valor={resumo.atencao} sub={t('psops.mapa.statAtencaoSub')} />
      </div>

      {!admin && resumo.semDono > 0 ? (
        <p className="mb-4 text-[12px] text-psops-muted">{t('psops.mapa.soAdmin')}</p>
      ) : null}

      <div className="space-y-5">
        {ARTEFATO_TIPOS_ORDEM.map((tipo) => {
          const doTipo = itens.filter((a) => a.tipo === tipo);
          if (doTipo.length === 0) return null;
          return (
            <Painel key={tipo} titulo={t(`psops.mapa.grupo.${tipo}`)} dica={t(`psops.mapa.grupoDica.${tipo}`)}>
              <div className="hidden grid-cols-[1.7fr_1fr_.5fr_.6fr_1.5fr] gap-4 border-b border-psops-linha px-6 py-2.5 md:grid">
                {['colNome', 'colSaude', 'colVersao', 'colAbertas', 'colDono'].map((c) => (
                  <span key={c} className={rotulo}>
                    {t(`psops.mapa.${c}`)}
                  </span>
                ))}
              </div>
              <ul>
                {doTipo.map((a) => (
                  <li
                    key={a.id}
                    className="grid grid-cols-2 items-center gap-x-4 gap-y-2 border-b border-psops-linha px-6 py-3.5 last:border-b-0 md:grid-cols-[1.7fr_1fr_.5fr_.6fr_1.5fr]"
                  >
                    <div className="col-span-2 md:col-span-1">
                      <div className="text-[13px] font-bold text-psops-texto">{a.nome}</div>
                      <div className="text-[10.5px] text-psops-muted">
                        {t(`psops.mapa.fonte.${a.fonteVerificacao}`)}
                      </div>
                    </div>
                    <div title={a.saude.detalhe}>
                      <Badge variante={VARIANTE_SAUDE[a.saude.estado]}>{t(`psops.saude.${a.saude.estado}`)}</Badge>
                    </div>
                    <div className="text-[12px] text-psops-texto">
                      <span className="md:hidden">{t('psops.mapa.colVersao')}: </span>v{a.versao}
                    </div>
                    <div className={`text-[12px] ${a.pendentes > 0 ? 'font-bold text-psops-tinta' : 'text-psops-muted'}`}>
                      <span className="md:hidden">{t('psops.mapa.colAbertas')}: </span>
                      {a.pendentes}
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      {admin ? (
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
                  </li>
                ))}
              </ul>
            </Painel>
          );
        })}
      </div>
    </>
  );
}
