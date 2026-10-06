'use client';

import { Check, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import { Avatar, Badge, Carregando, btnPrimario, btnSecundario, rotulo, varianteDoTipo } from './ui';
import {
  ATALHO_IMPACTO,
  IMPACTOS_ORDEM,
  type Impacto,
  type Sinal,
  type SinalDetalhe,
} from '@/lib/psops/client/tipos';

/**
 * O painel de decisão.
 *
 * A ideia central: o triador não escreve tarefa, ele responde quatro perguntas.
 * E antes de clicar em gerar, vê a consequência — quais artefatos serão tocados
 * e quem responde por cada um.
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
  onDescartar: () => void;
  ocupado: boolean;
}) {
  const { t } = useTranslation();
  const { dateLocale } = useLanguage();
  const alvos = (detalhe?.previa ?? []).filter((p) => impactos.includes(p.impacto));
  const data = (iso: string) => new Date(iso).toLocaleDateString(dateLocale);

  return (
    <div className="px-6 py-5">
      <h3 className="mb-3 text-[19px] font-black leading-tight tracking-tight text-psops-texto">
        {sinal.titulo}
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
        {sinal.classificadoPor === 'regras' ? (
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
          {t('psops.triagem.trechoOriginal')} · {data(sinal.publicadoEm)} · {sinal.fonteNome}
        </cite>
        {sinal.trechoOriginal}
      </blockquote>

      <a
        href={sinal.fonteUrl}
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
            const marcado = impactos.includes(k);
            const sugerido = sinal.impactosSugeridos.includes(k);
            return (
              <button
                key={k}
                type="button"
                role="checkbox"
                aria-checked={marcado}
                onClick={() => onAlternarImpacto(k)}
                className={`relative flex flex-col gap-1.5 rounded-2xl border px-3 pb-6 pt-3 text-left transition ${
                  marcado
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
                  <span className="text-[11px] font-black uppercase tracking-wider text-psops-texto">
                    {t(`psops.impacto.${k}.nome`)}
                  </span>
                </span>
                <span className="text-[11px] leading-snug text-psops-muted">
                  {t(`psops.impacto.${k}.pergunta`)}
                </span>
                <kbd className="absolute right-2.5 top-2.5">{ATALHO_IMPACTO[k]}</kbd>
                {sugerido ? (
                  <span className="absolute bottom-2 right-2.5 text-[8.5px] font-black uppercase tracking-wider text-psops-tinta">
                    {t('psops.triagem.sugerido')}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ── A prévia: a consequência antes do clique ── */}
      <div className="mb-1">
        <span className={`${rotulo} mb-2 block`}>{t('psops.triagem.oQueSeraGerado')}</span>
        <div className="rounded-2xl border border-dashed border-psops-forte bg-psops-surf2 px-4 py-3">
          {impactos.length === 0 ? (
            <p className="text-[12px] text-psops-muted">{t('psops.triagem.semImpacto')}</p>
          ) : carregandoDetalhe && alvos.length === 0 ? (
            <Carregando texto={t('psops.triagem.calculando')} />
          ) : (
            <>
              <p className="mb-2.5 text-[9px] font-black uppercase tracking-widest text-psops-tinta">
                {t('psops.triagem.atividades', { count: impactos.length })} ·{' '}
                {t('psops.triagem.responsavelHerdado')}
              </p>
              <ul className="flex flex-col gap-2">
                {alvos.map((p) => (
                  <li key={p.impacto} className="flex items-baseline gap-2.5 text-[12px] text-psops-texto">
                    <span className="w-[74px] shrink-0 text-[10px] font-black uppercase tracking-wider text-psops-tinta">
                      {t(`psops.impacto.${p.impacto}.nome`)}
                    </span>
                    <span className="flex-1">
                      {p.artefatoNome}
                      {!p.artefatoExiste && p.artefatoChave ? (
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-psops-muted">
                          ({t('psops.triagem.artefatoNovo')})
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-psops-muted">
                      {p.artefatoChave ? (
                        <>
                          <Avatar
                            iniciais={p.responsavelIniciais ?? '?'}
                            indefinido={!p.responsavelNome}
                          />
                          {p.responsavelNome ?? t('psops.triagem.semResponsavel')}
                        </>
                      ) : (
                        <span className="opacity-70">{t('psops.triagem.fichaNova')}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5 border-t border-psops-linha pt-5">
        <button
          type="button"
          onClick={onGerar}
          disabled={impactos.length === 0 || ocupado}
          className={btnPrimario}
        >
          {t('psops.triagem.gerar', { count: impactos.length })}
          <kbd>↵</kbd>
        </button>
        <button type="button" onClick={onDescartar} disabled={ocupado} className={btnSecundario}>
          {t('psops.triagem.descartar')}
          <kbd>X</kbd>
        </button>
      </div>
    </div>
  );
}
