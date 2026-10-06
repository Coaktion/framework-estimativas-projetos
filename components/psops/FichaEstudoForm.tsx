'use client';

/**
 * A ficha da feature — o que a atividade de ESTUDO produz. Vira a base de
 * conhecimento de produto do time. Salva quantas vezes quiser; é publicada
 * quando a atividade é concluída.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/psops/client/api';
import type { FichaEstudo } from '@/lib/psops/client/tipos';
import { Carregando, btnSecundario, rotulo } from './ui';
import type { useAvisos } from './Toaster';

type Campos = {
  oQueE: string;
  comoFunciona: string;
  preRequisitos: string;
  limitacoes: string;
  planoNecessario: string;
  links: string;
  testadoEmSandbox: boolean;
  motivoNaoTestado: string;
};

const vazio = (v: string) => (v.trim() ? v.trim() : null);

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
  const [c, setC] = useState<Campos | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .get<FichaEstudo>(`/api/pre-sales-ops/study-notes/${fichaId}`)
      .then((f) => {
        if (!vivo) return;
        setC({
          oQueE: f.oQueE ?? '',
          comoFunciona: f.comoFunciona ?? '',
          preRequisitos: f.preRequisitos ?? '',
          limitacoes: f.limitacoes ?? '',
          planoNecessario: f.planoNecessario ?? '',
          links: (f.linksConsultados ?? []).join('\n'),
          testadoEmSandbox: f.testadoEmSandbox,
          motivoNaoTestado: f.motivoNaoTestado ?? '',
        });
      })
      .catch((e) => avisar((e as Error).message, 'erro'));
    return () => {
      vivo = false;
    };
  }, [fichaId, avisar]);

  if (!c) return <Carregando texto={t('psops.carregando')} />;

  const mudar = <K extends keyof Campos>(k: K, v: Campos[K]) => {
    setC({ ...c, [k]: v });
    setAlterado(true);
  };

  const salvar = async () => {
    const links = c.links
      .split(/\s+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const invalido = links.find((l) => !/^https?:\/\//i.test(l));
    if (invalido) {
      avisar(t('psops.ficha.linkInvalido', { link: invalido }), 'erro');
      return;
    }
    setSalvando(true);
    try {
      await api.patch(`/api/pre-sales-ops/study-notes/${fichaId}`, {
        oQueE: vazio(c.oQueE),
        comoFunciona: vazio(c.comoFunciona),
        preRequisitos: vazio(c.preRequisitos),
        limitacoes: vazio(c.limitacoes),
        planoNecessario: vazio(c.planoNecessario),
        linksConsultados: links,
        testadoEmSandbox: c.testadoEmSandbox,
        motivoNaoTestado: c.testadoEmSandbox ? null : vazio(c.motivoNaoTestado),
      });
      setAlterado(false);
      avisar(t('psops.ficha.salva'));
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const campo =
    'w-full rounded-xl border border-psops-linha bg-psops-surf2 px-3 py-2 text-[12.5px] text-psops-texto outline-none placeholder:text-psops-muted/60 focus:border-psops-tinta disabled:opacity-70';

  const texto = (k: keyof Campos, linhas: number, max: number) => (
    <div>
      <label htmlFor={`psops-ficha-${k}`} className={`${rotulo} mb-1.5 block`}>
        {t(`psops.ficha.${k}`)}
      </label>
      <textarea
        id={`psops-ficha-${k}`}
        rows={linhas}
        maxLength={max}
        value={c[k] as string}
        disabled={somenteLeitura}
        placeholder={t(`psops.ficha.${k}Dica`)}
        onChange={(e) => mudar(k, e.target.value as never)}
        className={`${campo} resize-y`}
      />
    </div>
  );

  return (
    <section className="rounded-[1.5rem] border border-psops-linha p-5">
      <h3 className="mb-1 font-heading text-sm font-black uppercase tracking-tight text-psops-texto">
        {t('psops.ficha.titulo')}
      </h3>
      <p className="mb-4 text-[11.5px] text-psops-muted">{t('psops.ficha.explicacao')}</p>
      <div className="space-y-3.5">
        {texto('oQueE', 2, 600)}
        {texto('comoFunciona', 4, 4000)}
        {texto('preRequisitos', 2, 2000)}
        {texto('limitacoes', 2, 2000)}
        <div>
          <label htmlFor="psops-ficha-plano" className={`${rotulo} mb-1.5 block`}>
            {t('psops.ficha.planoNecessario')}
          </label>
          <input
            id="psops-ficha-plano"
            type="text"
            maxLength={200}
            value={c.planoNecessario}
            disabled={somenteLeitura}
            placeholder={t('psops.ficha.planoNecessarioDica')}
            onChange={(e) => mudar('planoNecessario', e.target.value)}
            className={campo}
          />
        </div>
        {texto('links', 3, 6000)}
        <label className="flex items-center gap-2.5 text-[12.5px] text-psops-texto">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[rgb(var(--psops-acento))]"
            checked={c.testadoEmSandbox}
            disabled={somenteLeitura}
            onChange={(e) => mudar('testadoEmSandbox', e.target.checked)}
          />
          {t('psops.ficha.testadoEmSandbox')}
        </label>
        {!c.testadoEmSandbox ? texto('motivoNaoTestado', 2, 500) : null}
      </div>
      {!somenteLeitura ? (
        <button type="button" onClick={() => void salvar()} disabled={salvando || !alterado} className={`${btnSecundario} mt-4`}>
          {salvando ? t('psops.ficha.salvando') : t('psops.ficha.salvar')}
        </button>
      ) : null}
    </section>
  );
}
