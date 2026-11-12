'use client';

import { Check, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import { Avatar, Badge, Carregando, btnPrimario, btnSecundario, rotulo, varianteDoTipo } from './ui';
import {
  ATALHO_IMPACTO,
  IMPACTOS_ORDEM,
  textoDoSinal,
  urlDaNota,
  dataDaNota,
  type FrenteDecisao,
  type Impacto,
  type Sinal,
  type SinalDetalhe,
} from '@/lib/psops/client/tipos';

/**
 * O painel de decisão.
 *
 * Cada frente tem dono (Demo, Estimativa, Escopo; Estudo é de cada SE). Nas
 * SUAS frentes, marcar efetiva (vira atividade no seu Backlog) e desmarcar é
 * "não vou fazer". Nas frentes dos OUTROS, marcar deixa uma sugestão, que o
 * dono vê aqui mesmo, já marcada, e decide. Antes de confirmar, a prévia
 * mostra o que vai para o seu Backlog e o que vira sugestão para quem.
 */
export function PainelDecisao({
  sinal,
  detalhe,
  carregandoDetalhe,
  impactos,
  onAlternarImpacto,
  onGerar,
  onDescartar,
  ocupado,
}: {
  sinal: Sinal;
  detalhe: SinalDetalhe | null;
  carregandoDetalhe: boolean;
  impactos: Impacto[];
  onAlternarImpacto: (i: Impacto) => void;
  onGerar: () => void;
  /** null: só gestor descarta para todos */
  onDescartar: (() => void) | null;
  ocupado: boolean;
}) {
  const { t } = useTranslation();
  const { dateLocale, language } = useLanguage();
  const texto = textoDoSinal(sinal, language);
  const alvos = (detalhe?.previa ?? []).filter((p) => impactos.includes(p.impacto));
  const data = (iso: string) => new Date(iso).toLocaleDateString(dateLocale);
  const frentes = detalhe?.frentes ?? null;
  const frente = (k: Impacto): FrenteDecisao | null => frentes?.find((f) => f.impacto === k) ?? null;
  const pendentes = sinal.minhasPendentes ?? [];
  const sugeridoParaMim = (k: Impacto) => (sinal.sugestoesParaMim ?? []).find((s) => s.impacto === k) ?? null;
  // donos que ainda não decidiram (recebem a sugestão)
  const pendentesDaFrente = (f: FrenteDecisao | null) => (f?.donos ?? []).filter((d) => !d.decisao);
  const minhaDecidida = (k: Impacto) => Boolean(frente(k)?.minha) && !pendentes.includes(k);
  const travada = (k: Impacto) => {
    const f = frente(k);
    if (!f) return false;
    if (f.minha) return !pendentes.includes(k);
    return f.donos.length > 0 && pendentesDaFrente(f).length === 0;
  };
  const marcadosAtivos = impactos.filter((k) => !travada(k));
  const paraMim = marcadosAtivos.filter((k) => frente(k)?.minha || (frente(k)?.donos.length ?? 1) === 0);
  const sugestoes = marcadosAtivos.filter((k) => frente(k) && !frente(k)!.minha && frente(k)!.donos.length > 0);
  const naoFarei = pendentes.filter((k) => !impactos.includes(k));
  const podeConfirmar = pendentes.length > 0 || marcadosAtivos.length > 0;
  const nomes = (lista: Array<{ nome: string }>) => lista.map((d) => d.nome.split(' ')[0]).join(', ');
  const statusDonos = (f: FrenteDecisao) => {
    if (f.donos.length > 1) {
      const decidiram = f.donos.filter((d) => d.decisao);
      const fazem = decidiram.filter((d) => d.decisao === 'FAZER');
      return t('psops.triagem.donosDecidiram', { n: decidiram.length, total: f.donos.length, fazem: fazem.length });
    }
    const d = f.donos[0];
    if (!d) return null;
    return d.decisao
      ? t(d.decisao === 'FAZER' ? 'psops.triagem.donoVaiFazer' : 'psops.triagem.donoNaoVaiFazer', { nome: d.nome.split(' ')[0] })
      : t('psops.triagem.donoPendente', { nome: d.nome.split(' ')[0] });
  };

  return (
    <div className="px-6 py-5">
      <h3 className="mb-3 text-[19px] font-bold leading-tight tracking-tight text-psops-texto">
        {texto.titulo}
      </h3>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Badge variante="produto">{t(`psops.produto.${sinal.produto}`)}</Badge>
        <Badge variante={varianteDoTipo(sinal.tipo)}>{t(`psops.tipo.${sinal.tipo}`)}</Badge>
        <Badge>{t('psops.triagem.modulo', { nome: t(`psops.modulo.${sinal.modulo}`) })}</Badge>
        {sinal.planoMinimo ? (
          <Badge>{t('psops.triagem.planoMinimo', { plano: sinal.planoMinimo })}</Badge>
        ) : null}
        {sinal.dataLimite ? (
          <Badge variante="alerta">{t('psops.triagem.dataLimite', { data: data(sinal.dataLimite) })}</Badge>
        ) : null}
        {texto.pendente ? (
          <Badge variante="discreto" titulo={t('psops.triagem.traducaoPendenteDica')}>
            {t('psops.triagem.traducaoPendente')}
          </Badge>
        ) : null}
        {sinal.classificadoPor.startsWith('regras') ? (
          <Badge variante="discreto" titulo={t('psops.triagem.porRegrasDica')}>
            {t('psops.triagem.porRegras')}
          </Badge>
        ) : null}
      </div>

      {sinal.resumoPtBr ? (
        <p className="mb-3.5 text-[13.5px] leading-relaxed text-psops-texto">{sinal.resumoPtBr}</p>
      ) : null}

      <blockquote className="mb-2 rounded-r-2xl border-l-[3px] border-psops-acento bg-psops-surf2 px-4 py-3 text-[12.5px] leading-relaxed text-psops-muted">
        <cite className={`${rotulo} mb-1.5 block not-italic text-psops-tinta`}>
          {t(texto.traduzido ? 'psops.triagem.trechoTraduzido' : 'psops.triagem.trechoOriginal')} ·{' '}
          {dataDaNota(sinal.fonteTitulo)
            ? t('psops.triagem.notaDeVersao', { data: dataDaNota(sinal.fonteTitulo) })
            : `${data(sinal.publicadoEm)} · ${sinal.fonteNome}`}
        </cite>
        {texto.trecho}
        {texto.traduzido ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-[10.5px] font-bold text-psops-tinta">
              {t('psops.triagem.verOriginal')}
            </summary>
            <p className="mt-1.5 text-[12px] italic">{sinal.trechoOriginal}</p>
          </details>
        ) : null}
      </blockquote>

      <a
        href={urlDaNota(sinal.fonteUrl, language)}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-4 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-psops-tinta hover:underline"
      >
        <ExternalLink size={12} aria-hidden />
        {t('psops.triagem.lerNota')}
      </a>

      {/* ── Os quatro destinos ── */}
      <fieldset className="mb-4 mt-4">
        <legend className={`${rotulo} mb-2 block`}>{t('psops.triagem.ondeImpacta')}</legend>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {IMPACTOS_ORDEM.map((k) => {
            const f = frente(k);
            const bloqueada = travada(k);
            const marcado = impactos.includes(k) && !bloqueada;
            const sugerido = sinal.impactosSugeridos.includes(k);
            const deAlguem = sugeridoParaMim(k);
            return (
              <button
                key={k}
                type="button"
                role="checkbox"
                aria-checked={marcado}
                aria-disabled={bloqueada}
                onClick={() => !bloqueada && onAlternarImpacto(k)}
                className={`relative flex flex-col gap-1.5 rounded-2xl border px-3 pb-6 pt-3 text-left transition ${
                  bloqueada
                    ? 'cursor-default border-psops-linha bg-psops-surf2 opacity-60'
                    : marcado
                      ? 'border-psops-acento bg-psops-acento/10'
                      : 'border-psops-linha bg-psops-surf2 hover:border-psops-forte'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] ${
                      marcado ? 'border-psops-acento bg-psops-acento text-psops-sobre' : 'border-psops-forte'
                    }`}
                  >
                    {marcado ? <Check size={11} strokeWidth={3} /> : null}
                  </span>
                  <span className="text-label font-medium text-psops-texto">
                    {t(`psops.impacto.${k}.nome`)}
                  </span>
                </span>
                <span className="text-label leading-snug text-psops-muted">
                  {t(`psops.impacto.${k}.pergunta`)}
                </span>
                {f ? (
                  <span className="text-caption font-medium leading-snug text-psops-tinta">
                    {f.minha
                      ? minhaDecidida(k)
                        ? t('psops.triagem.voceJaDecidiu')
                        : t('psops.triagem.suaDecisao')
                      : f.donos.length
                        ? bloqueada
                          ? statusDonos(f)
                          : t('psops.triagem.sugerirPara', { nomes: nomes(pendentesDaFrente(f)) })
                        : t('psops.triagem.semDono')}
                  </span>
                ) : null}
                {f && !f.minha && !bloqueada && f.donos.some((d) => d.decisao) ? (
                  <span className="text-caption leading-snug text-psops-muted">{statusDonos(f)}</span>
                ) : null}
                {deAlguem && !bloqueada ? (
                  <span className="w-fit rounded-full bg-psops-acento/15 px-2 py-0.5 text-caption font-bold text-psops-tinta">
                    {t('psops.triagem.sugeridoPor', { nome: (deAlguem.sugeridoPorNome ?? '').split(' ')[0] || '?' })}
                  </span>
                ) : null}
                <kbd className="absolute right-2.5 top-2.5">{ATALHO_IMPACTO[k]}</kbd>
                {sugerido ? (
                  <span className="absolute bottom-2 right-2.5 text-[8.5px] font-bold text-psops-tinta">
                    {t('psops.triagem.sugerido')}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ── A consequência da decisão, antes do clique ── */}
      {frentes ? (
        <div className="mb-1">
          <span className={`${rotulo} mb-2 block`}>{t('psops.triagem.oQueSeraGerado')}</span>
          <div className="rounded-2xl border border-dashed border-psops-forte bg-psops-surf2 px-4 py-3 text-[12px] text-psops-texto">
            {!podeConfirmar ? (
              <p className="text-psops-muted">{t('psops.triagem.nadaPendente')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {paraMim.map((k) => {
                  const p = (detalhe?.previa ?? []).find((x) => x.impacto === k);
                  return (
                    <li key={`m-${k}`}>
                      <span className="font-bold text-psops-tinta">{t(`psops.impacto.${k}.nome`)}</span> ·{' '}
                      {t('psops.triagem.vaiParaSeuBacklog')}
                      {p?.artefatoNome ? <span className="text-psops-muted"> ({p.artefatoNome})</span> : null}
                    </li>
                  );
                })}
                {sugestoes.map((k) => (
                  <li key={`s-${k}`}>
                    <span className="font-bold text-psops-tinta">{t(`psops.impacto.${k}.nome`)}</span> ·{' '}
                    {t('psops.triagem.viraSugestao', { nomes: nomes(pendentesDaFrente(frente(k))) })}
                  </li>
                ))}
                {naoFarei.map((k) => (
                  <li key={`n-${k}`} className="text-psops-muted">
                    <span className="font-bold">{t(`psops.impacto.${k}.nome`)}</span> · {t('psops.triagem.voceNaoVaiFazer')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
      <div className="mb-1">
        <span className={`${rotulo} mb-2 block`}>{t('psops.triagem.oQueSeraGerado')}</span>
        <div className="rounded-2xl border border-dashed border-psops-forte bg-psops-surf2 px-4 py-3">
          {impactos.length === 0 ? (
            <p className="text-[12px] text-psops-muted">{t('psops.triagem.semImpacto')}</p>
          ) : carregandoDetalhe && alvos.length === 0 ? (
            <Carregando texto={t('psops.triagem.calculando')} />
          ) : (
            <>
              <p className="mb-2.5 text-caption font-medium text-psops-tinta">
                {t('psops.triagem.atividades', {
                  // Estudo gera uma atividade por SE: conta quem vai receber
                  count: alvos.reduce((s, p) => s + Math.max(1, (p.responsaveis ?? []).length), 0) || impactos.length,
                })}{' '}
                ·{' '}
                {t('psops.triagem.responsavelHerdado')}
              </p>
              <ul className="flex flex-col gap-2">
                {alvos.map((p) => (
                  <li key={p.impacto} className="flex items-baseline gap-2.5 text-[12px] text-psops-texto">
                    <span className="w-[74px] shrink-0 text-label font-medium text-psops-tinta">
                      {t(`psops.impacto.${p.impacto}.nome`)}
                    </span>
                    <span className="flex-1">
                      {p.artefatoNome}
                      {!p.artefatoExiste && p.artefatoChave ? (
                        <span className="ml-1.5 text-label font-medium text-psops-muted">
                          ({t('psops.triagem.artefatoNovo')})
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-label text-psops-muted"
                      title={(p.responsaveis ?? []).map((r) => r.nome).join(', ') || undefined}
                    >
                      {(p.responsaveis ?? []).length > 1 ? (
                        <>
                          <span className="flex -space-x-1.5">
                            {(p.responsaveis ?? []).map((r) => (
                              <Avatar key={r.id} iniciais={r.iniciais} />
                            ))}
                          </span>
                          {t('psops.triagem.pessoas', { count: (p.responsaveis ?? []).length })}
                        </>
                      ) : (
                        <>
                          <Avatar
                            iniciais={p.responsavelIniciais ?? '?'}
                            indefinido={!p.responsavelNome}
                          />
                          {p.responsavelNome ?? t('psops.triagem.semResponsavel')}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2.5 border-t border-psops-linha pt-5">
        <button
          type="button"
          onClick={onGerar}
          disabled={!podeConfirmar || ocupado || (!frentes && impactos.length === 0)}
          className={btnPrimario}
        >
          {pendentes.length > 0 && marcadosAtivos.length === 0
            ? t('psops.triagem.nadaParaMim')
            : t('psops.triagem.confirmarDecisao')}
          <kbd>↵</kbd>
        </button>
        {onDescartar ? (
          <button type="button" onClick={onDescartar} disabled={ocupado} className={btnSecundario}>
            {t('psops.triagem.descartarTodos')}
            <kbd>X</kbd>
          </button>
        ) : null}
      </div>
    </div>
  );
}
