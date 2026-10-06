/**
 * Peças visuais compartilhadas do Pre-Sales Ops.
 *
 * Mesmo vocabulário das outras telas do Tool Center (cartões arredondados,
 * rótulos em caixa alta espaçada, botões em pílula), com os tokens psops-*
 * definidos em app/globals.scss — eles acompanham o tema claro/escuro.
 * Magenta só aparece em deprecation, breaking change e prazo: é alarme.
 */
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { SignalTipo } from '@/lib/psops/client/tipos';

/** Classes de botão reaproveitadas pelas telas. */
export const btn =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40';
export const btnPrimario = `${btn} bg-psops-acento text-psops-sobre hover:brightness-105`;
export const btnSecundario = `${btn} border border-psops-forte bg-psops-surf2 text-psops-muted hover:border-psops-tinta hover:text-psops-tinta`;

/** Rótulo pequeno em caixa alta — o "label" do Tool Center. */
export const rotulo = 'text-[9px] font-black uppercase tracking-widest text-psops-muted';

type VarianteBadge = 'neutro' | 'produto' | 'ga' | 'eap' | 'deprecation' | 'alerta' | 'discreto';

const CLASSES_BADGE: Record<VarianteBadge, string> = {
  neutro: 'border-psops-forte text-psops-muted',
  produto: 'border-psops-forte bg-psops-surf3 text-psops-texto',
  ga: 'border-psops-tinta/40 bg-psops-acento/15 text-psops-tinta',
  eap: 'border-dashed border-psops-tinta/50 text-psops-tinta',
  deprecation: 'border-psops-alerta bg-psops-alerta text-white',
  alerta: 'border-psops-alerta/50 bg-psops-alerta/10 text-psops-alertatinta',
  discreto: 'border-psops-forte text-psops-muted',
};

export function Badge({
  children,
  variante = 'neutro',
  titulo,
}: {
  children: ReactNode;
  variante?: VarianteBadge;
  titulo?: string;
}) {
  return (
    <span
      title={titulo}
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-[3px] text-[9px] font-black uppercase tracking-wider ${CLASSES_BADGE[variante]}`}
    >
      {children}
    </span>
  );
}

/** Deprecation e breaking change em magenta; GA em verde; EAP tracejado. */
export function varianteDoTipo(tipo: SignalTipo): VarianteBadge {
  if (tipo === 'DEPRECATION' || tipo === 'BREAKING_CHANGE') return 'deprecation';
  if (tipo === 'GA') return 'ga';
  if (tipo === 'EAP_BETA') return 'eap';
  return 'discreto';
}

export function StatTile({
  rotulo: titulo,
  valor,
  sub,
  destaque = false,
  acao,
}: {
  rotulo: string;
  valor: ReactNode;
  sub?: string;
  destaque?: boolean;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-3xl border border-psops-linha bg-psops-surf1 px-5 py-4">
      <div className="mb-2 flex min-h-[18px] items-center justify-between gap-2">
        <div className={rotulo}>{titulo}</div>
        {acao}
      </div>
      <div
        className={`font-heading text-[32px] font-black leading-none tracking-tight ${
          destaque ? 'text-psops-tinta' : 'text-psops-texto'
        }`}
      >
        {valor}
      </div>
      {sub ? <div className="mt-1.5 text-[11px] text-psops-muted">{sub}</div> : null}
    </div>
  );
}

export function Painel({
  titulo,
  dica,
  children,
  className = '',
}: {
  titulo: string;
  dica?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[2rem] border border-psops-linha bg-psops-surf1 ${className}`}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-psops-linha px-6 py-4">
        <h2 className="font-heading text-sm font-black uppercase tracking-tight text-psops-texto">
          {titulo}
        </h2>
        {dica ? <div className="ml-auto text-[10.5px] text-psops-muted">{dica}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function CaixaVazia({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto: string;
  acao?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mb-1.5 font-heading text-xl font-black uppercase tracking-tight text-psops-tinta">
        {titulo}
      </div>
      <p className="mx-auto max-w-[360px] text-[12.5px] text-psops-muted">{texto}</p>
      {acao ? <div className="mt-5">{acao}</div> : null}
    </div>
  );
}

export function CaixaErro({
  titulo,
  mensagem,
  onTentarNovamente,
  rotuloBotao,
}: {
  titulo: string;
  mensagem: string;
  onTentarNovamente?: () => void;
  rotuloBotao: string;
}) {
  return (
    <div
      role="alert"
      className="mx-auto my-10 max-w-[560px] rounded-3xl border border-psops-alerta/50 bg-psops-alerta/10 p-6"
    >
      <div className="mb-2 flex items-center gap-2.5">
        <AlertTriangle size={17} className="shrink-0 text-psops-alertatinta" aria-hidden />
        <h2 className="font-heading text-base font-black uppercase tracking-tight text-psops-texto">
          {titulo}
        </h2>
      </div>
      <p className="text-[13px] leading-relaxed text-psops-muted">{mensagem}</p>
      {onTentarNovamente ? (
        <button type="button" onClick={onTentarNovamente} className={`${btnSecundario} mt-4`}>
          {rotuloBotao}
        </button>
      ) : null}
    </div>
  );
}

export function Avatar({ iniciais, indefinido = false }: { iniciais: string; indefinido?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-[20px] w-[20px] items-center justify-center rounded-full border bg-psops-surf3 text-[8.5px] font-black ${
        indefinido ? 'border-dashed border-psops-forte text-psops-muted' : 'border-psops-forte text-psops-tinta'
      }`}
    >
      {iniciais}
    </span>
  );
}

export function Carregando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-14 text-[12.5px] text-psops-muted">
      <span
        aria-hidden
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-psops-forte border-t-psops-acento"
      />
      {texto}
    </div>
  );
}
