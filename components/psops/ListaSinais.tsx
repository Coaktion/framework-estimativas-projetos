'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import { Badge, varianteDoTipo } from './ui';
import { textoDoSinal, type Impacto, type Sinal } from '@/lib/psops/client/tipos';

/**
 * A fila. Densa de propósito: o triador precisa varrer 40 itens sem rolar mais
 * do que o necessário, e a decisão acontece no painel ao lado.
 */
export function ListaSinais({
  sinais,
  selecionadoId,
  impactosPorSinal,
  onSelecionar,
}: {
  sinais: Sinal[];
  selecionadoId: string | null;
  impactosPorSinal: Record<string, Impacto[]>;
  onSelecionar: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const refLista = useRef<HTMLUListElement>(null);
  const refSelecionado = useRef<HTMLLIElement>(null);

  // Navegação por teclado precisa manter o item escolhido visível — rolando
  // só a lista. scrollIntoView rolaria a página inteira junto.
  useEffect(() => {
    const lista = refLista.current;
    const item = refSelecionado.current;
    if (!lista || !item) return;
    const topo = item.offsetTop;
    const base = topo + item.offsetHeight;
    if (topo < lista.scrollTop) lista.scrollTop = topo;
    else if (base > lista.scrollTop + lista.clientHeight) lista.scrollTop = base - lista.clientHeight;
  }, [selecionadoId]);

  return (
    <ul
      ref={refLista}
      role="listbox"
      aria-label={t('psops.triagem.sinaisNovos')}
      className="relative max-h-[680px] overflow-y-auto"
    >
      {sinais.map((s) => {
        const selecionado = s.id === selecionadoId;
        const impactos = impactosPorSinal[s.id] ?? s.impactosSugeridos;
        const texto = textoDoSinal(s, language);
        return (
          <li
            key={s.id}
            ref={selecionado ? refSelecionado : undefined}
            role="option"
            aria-selected={selecionado}
          >
            <button
              type="button"
              onClick={() => onSelecionar(s.id)}
              className={`relative flex w-full gap-3 border-b border-psops-linha px-5 py-3.5 text-left transition-colors ${
                selecionado ? 'bg-psops-surf2' : 'hover:bg-psops-surf2'
              }`}
            >
              {selecionado ? (
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-psops-acento" />
              ) : null}

              <span className="w-10 shrink-0 pt-0.5 text-center">
                <span
                  className={`block font-heading text-[20px] font-black leading-none ${
                    s.score >= 80 ? 'text-psops-tinta' : 'text-psops-muted'
                  }`}
                >
                  {s.score}
                </span>
                <span className="mt-1 block text-[8px] font-black uppercase tracking-widest text-psops-muted opacity-70">
                  {t('psops.triagem.score')}
                </span>
              </span>

              <span className="min-w-0 flex-1">
                <span className="mb-1.5 block text-[13px] font-bold leading-snug text-psops-texto">
                  {texto.titulo}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge variante="produto">{t(`psops.produto.${s.produto}`)}</Badge>
                  <Badge variante={varianteDoTipo(s.tipo)}>{t(`psops.tipo.${s.tipo}`)}</Badge>
                  {impactos.length ? <Badge variante="discreto">{impactos.join(' · ')}</Badge> : null}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
