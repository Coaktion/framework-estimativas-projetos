'use client';

/**
 * Observações do estudo da feature: um campo livre só, compartilhado pelos
 * SEs que estudam a mesma feature. Guardado em `comoFunciona` da ficha (os
 * outros campos da ficha antiga não são mais usados).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/psops/client/api';
import type { FichaEstudo } from '@/lib/psops/client/tipos';
import { Carregando, btnSecundario, rotulo } from './ui';
import type { useAvisos } from './Toaster';

export function FichaEstudoForm({
  fichaId,
  somenteLeitura,
  avisar,
}: {
  fichaId: string;
  somenteLeitura: boolean;
  avisar: ReturnType<typeof useAvisos>;
}) {
  const { t } = useTranslation();
  const [texto, setTexto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .get<FichaEstudo>(`/api/pre-sales-ops/study-notes/${fichaId}`)
      .then((f) => {
        if (vivo) setTexto(f.comoFunciona ?? '');
      })
      .catch((e) => avisar((e as Error).message, 'erro'));
    return () => {
      vivo = false;
    };
  }, [fichaId, avisar]);

  if (texto === null) return <Carregando texto={t('psops.carregando')} />;

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.patch(`/api/pre-sales-ops/study-notes/${fichaId}`, { comoFunciona: texto.trim() || null });
      setAlterado(false);
      avisar(t('psops.ficha.salva'));
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="mb-2">
      <label htmlFor="psops-observacoes" className={`${rotulo} mb-1.5 block`}>
        {t('psops.ficha.observacoes')}
      </label>
      <textarea
        id="psops-observacoes"
        rows={4}
        maxLength={4000}
        value={texto}
        disabled={somenteLeitura}
        placeholder={t('psops.ficha.observacoesDica')}
        onChange={(e) => {
          setTexto(e.target.value);
          setAlterado(true);
        }}
        className="w-full resize-y rounded-xl border border-psops-linha bg-psops-surf2 px-3 py-2 text-[12.5px] text-psops-texto outline-none placeholder:text-psops-muted/60 focus:border-psops-tinta disabled:opacity-70"
      />
      {!somenteLeitura ? (
        <button type="button" onClick={() => void salvar()} disabled={salvando || !alterado} className={`${btnSecundario} mt-2`}>
          {salvando ? t('psops.ficha.salvando') : t('psops.ficha.salvar')}
        </button>
      ) : null}
    </section>
  );
}
