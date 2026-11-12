'use client';

/**
 * Estudo concluído que não entrou sozinho na área Estudos (sem categoria
 * correspondente na matriz, ou sem pessoa): a janela traz tudo preenchido e a
 * pessoa só completa o que faltou. Mesmos campos do Acompanhamento semanal.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/psops/client/api';
import { TIPOS_ATIVIDADE } from '@/lib/estudos/calculo';
import type { SugestaoRegistroEstudo } from '@/lib/estudos/radar';
import { btnPrimario, btnSecundario, rotulo } from './ui';
import { Portal } from './Portal';

const CAMPO =
  'w-full rounded-xl border border-psops-linha bg-psops-surf2 px-3 py-2 text-[12.5px] text-psops-texto outline-none focus:border-psops-tinta';

export function ModalRegistroEstudo({
  sugestao,
  pessoas,
  onFechar,
  avisar,
}: {
  sugestao: SugestaoRegistroEstudo;
  pessoas: Array<{ id: string; nome: string }>;
  onFechar: () => void;
  avisar: (msg: string, tipo?: 'ok' | 'erro' | 'neutro') => void;
}) {
  const { t } = useTranslation();
  const [userId, setUserId] = useState(sugestao.userId ? String(sugestao.userId) : '');
  const [data, setData] = useState(sugestao.data);
  const [categoria, setCategoria] = useState(sugestao.categoria ?? '');
  const [atividade, setAtividade] = useState(sugestao.atividade);
  const [tipo, setTipo] = useState(sugestao.tipo);
  const [observacoes, setObservacoes] = useState(sugestao.observacoes ?? '');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const valido = Boolean(userId) && Boolean(categoria) && atividade.trim().length >= 2 && Boolean(data);

  const salvar = async () => {
    setOcupado(true);
    try {
      await api.post(`/api/pre-sales-ops/activities/${sugestao.activityId}/estudo`, {
        userId: Number(userId),
        data,
        categoria,
        atividade: atividade.trim(),
        tipo,
        observacoes: observacoes.trim() || null,
      });
      avisar(t('psops.estudoRegistro.ok'));
      onFechar();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="psops-titulo-registro-estudo"
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onFechar();
        }}
      >
        <div className="psops max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-3xl border border-psops-linha bg-psops-surf1 p-7">
          <h2 id="psops-titulo-registro-estudo" className="mb-2 text-title font-bold text-psops-texto">
            {t('psops.estudoRegistro.titulo')}
          </h2>
          <p className="mb-5 text-[12px] text-psops-muted">{t('psops.estudoRegistro.explicacao')}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={`${rotulo} mb-1.5 block`}>{t('psops.estudoRegistro.pessoa')}</span>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className={CAMPO}>
                <option value="">—</option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={`${rotulo} mb-1.5 block`}>{t('psops.estudoRegistro.data')}</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={CAMPO} />
            </label>
            <label className="block sm:col-span-2">
              <span className={`${rotulo} mb-1.5 block`}>{t('psops.estudoRegistro.categoria')}</span>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={CAMPO}>
                <option value="">—</option>
                {sugestao.categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={`${rotulo} mb-1.5 block`}>{t('psops.estudoRegistro.atividade')}</span>
              <input value={atividade} maxLength={500} onChange={(e) => setAtividade(e.target.value)} className={CAMPO} />
            </label>
            <label className="block">
              <span className={`${rotulo} mb-1.5 block`}>{t('psops.estudoRegistro.tipo')}</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO}>
                {TIPOS_ATIVIDADE.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={`${rotulo} mb-1.5 block`}>{t('psops.estudoRegistro.observacoes')}</span>
              <textarea
                rows={3}
                value={observacoes}
                maxLength={2000}
                onChange={(e) => setObservacoes(e.target.value)}
                className={CAMPO}
              />
            </label>
          </div>

          <div className="mt-5 flex gap-2.5">
            <button type="button" disabled={!valido || ocupado} onClick={() => void salvar()} className={btnPrimario}>
              {t('psops.estudoRegistro.salvar')}
            </button>
            <button type="button" onClick={onFechar} className={btnSecundario}>
              {t('psops.estudoRegistro.depois')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
