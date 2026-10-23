'use client';

/**
 * Peças de interface do Agendamento, no visual do Tool Center (cards brancos
 * com borda, botões em pílula, campos de 44 px, chips como na biblioteca).
 */
import { HelpCircle, Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { humanMinutes } from '@/lib/booking/time';

export const INPUT =
  'w-full h-11 bg-white dark:bg-[color:var(--bg-input-solid)] border border-slate-300 rounded-[10px] px-3 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] transition-colors placeholder:text-slate-400 disabled:opacity-50';

/** Select do tamanho do conteúdo (o INPUT ocupa a largura toda). */
export const SELECT = `${INPUT.replace('w-full ', '')} w-auto max-w-full pr-8`;

export const CARD = 'bg-white border border-slate-200 rounded-2xl shadow-sm';

export function Tip({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span className="inline-flex align-middle ml-1 text-slate-400 hover:text-brand-dark cursor-help" title={text} aria-label={text} role="note" tabIndex={0}>
      <HelpCircle className="w-3.5 h-3.5" />
    </span>
  );
}

export function Label({ children, tip, htmlFor }: { children: ReactNode; tip?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-label font-medium text-brand-dark mb-1.5">
      {children}
      <Tip text={tip} />
    </label>
  );
}

export function Hint({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-caption text-slate-500 mt-1 ${className}`}>{children}</p>;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT} ${props.className || ''}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full bg-white dark:bg-[color:var(--bg-input-solid)] border border-slate-300 rounded-[10px] px-3 py-2.5 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] transition-colors placeholder:text-slate-400 ${props.className || ''}`}
    />
  );
}

/** Campo numérico inteiro; em minutos mostra a conversão (= 1h 15m). */
export function NumberField({ label, tip, hint, value, onChange, min = 0, max, minutes = true, disabled }: {
  label: string; tip?: string; hint?: string; value: number; onChange: (n: number) => void;
  min?: number; max?: number; minutes?: boolean; disabled?: boolean;
}) {
  const human = minutes ? humanMinutes(value) : '';
  return (
    <div>
      <Label tip={tip}>{label}</Label>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          disabled={disabled}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          className={`${INPUT} tabular-nums ${human ? 'pr-24' : ''}`}
        />
        {human && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-caption text-slate-400 pointer-events-none">= {human}</span>}
      </div>
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

export function Switch({ checked, onChange, label, tip, hint, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: ReactNode; tip?: string; hint?: ReactNode; disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${checked ? 'brand-bg-primary border-transparent' : 'bg-slate-200 border-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
      <span className="min-w-0">
        <span className="block text-body font-medium text-brand-dark">
          {label}
          <Tip text={tip} />
        </span>
        {hint && <span className="block text-caption text-slate-500 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
      <span className="min-w-0">
        <span className="block text-body text-brand-dark">{label}</span>
        {hint && <span className="block text-caption text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export const chipClass = (on: boolean) =>
  `px-3 py-1.5 rounded-xl text-caption font-medium border transition-colors ${
    on ? 'brand-bg-primary text-brand-ink border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:text-brand-dark'
  }`;

export function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={chipClass(on)} title={title}>
      {children}
    </button>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'brand-bg-primary text-brand-ink btn-premium border border-transparent',
  secondary: 'bg-white text-brand-dark border border-slate-300 hover:border-slate-400',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300',
  ghost: 'bg-transparent text-slate-500 border border-transparent hover:text-brand-dark hover:bg-slate-100',
};

export function Button({ variant = 'secondary', size = 'md', busy, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: 'sm' | 'md'; busy?: boolean;
}) {
  const sizing = size === 'sm' ? 'h-9 px-3.5 text-label' : 'h-11 px-5 text-body';
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      className={`${sizing} rounded-full font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  const tones = {
    info: 'bg-slate-50 border-slate-200 text-slate-600',
    warn: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-700',
    ok: 'bg-[color:var(--accent-tint)] border-[color:var(--primary)]/40 text-brand-dark',
  };
  return <div className={`rounded-xl border px-4 py-3 text-label ${tones[tone]}`}>{children}</div>;
}

export function Section({ title, tip, description, children, actions }: { title: string; tip?: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`${CARD} p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-title font-bold text-brand-dark">
            {title}
            <Tip text={tip} />
          </h2>
          {description && <p className="text-label text-slate-500 mt-1 max-w-[80ch]">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ title, accent, subtitle, actions, back }: { title: string; accent?: string; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
      <div className="min-w-0">
        {back}
        <h1 className="text-brand-dark font-heading text-page">
          {title} {accent && <span className="text-brand-primary">{accent}</span>}
        </h1>
        {subtitle && <p className="text-slate-500 text-[18px] font-light mt-2 max-w-[70ch]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/** Mensagem de erro de uma action do Agendamento ({ ok: false, error, detail }), traduzida. */
export function errorText(t: (k: string, o?: any) => string, res: object) {
  const { error, detail } = res as { error?: string; detail?: string };
  const code = error || 'server_error';
  const base = t(`booking.errors.${code}`, { defaultValue: '' }) || t('booking.errors.server_error');
  return code === 'blocks_dont_fit' && detail ? `${base} (${t(`booking.roles.${detail}`, { defaultValue: detail })})` : base;
}
