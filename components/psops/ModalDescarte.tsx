'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { btnPrimario, btnSecundario } from './ui';
import { Portal } from './Portal';

/**
 * Descarte exige motivo. Não é burocracia: o motivo é o que calibra o filtro
 * de ruído depois das primeiras semanas.
 */
export function ModalDescarte({
  tituloSinal,
  onConfirmar,
  onCancelar,
  ocupado,
}: {
  tituloSinal: string;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
  ocupado: boolean;
}) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onCancelar]);

  const valido = motivo.trim().length >= 3;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="psops-titulo-descarte"
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancelar();
        }}
      >
        <div className="psops w-full max-w-[520px] rounded-[2rem] border border-psops-linha bg-psops-surf1 p-7">
          <h2
            id="psops-titulo-descarte"
            className="mb-2 font-heading text-lg font-black uppercase tracking-tight text-psops-texto"
          >
            {t('psops.descarte.titulo')}
          </h2>
          <p className="mb-1 text-[13px] font-bold text-psops-texto">{tituloSinal}</p>
          <p className="mb-4 text-[12px] text-psops-muted">{t('psops.descarte.explicacao')}</p>

          <textarea
            ref={ref}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t('psops.descarte.placeholder')}
            className="w-full resize-none rounded-2xl border border-psops-linha bg-psops-surf2 px-4 py-3 text-[13px] text-psops-texto outline-none placeholder:text-psops-muted/60 focus:border-psops-tinta"
          />

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              disabled={!valido || ocupado}
              onClick={() => onConfirmar(motivo.trim())}
              className={btnPrimario}
            >
              {t('psops.descarte.confirmar')}
            </button>
            <button type="button" onClick={onCancelar} className={btnSecundario}>
              {t('psops.descarte.cancelar')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
