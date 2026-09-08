'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  FolderKanban,
  Globe,
  Clock,
  Target,
  Timer,
  Calculator,
  type LucideIcon,
} from 'lucide-react';

type TemplateLinks = {
  pacote_horas: string;
  escopo_fechado: string;
  time_materials: string;
  pacote_horas_ae: string;
};

type DemoLinks = {
  PT: string;
  EN: string;
  ES: string;
};

type HomeClientProps = {
  templateLinks: TemplateLinks;
  demoLinks: DemoLinks;
};

type DropdownOption = {
  key: string;
  label: string;
  url: string;
  icon?: LucideIcon;
  flag?: string;
  badge?: string;
  disabled?: boolean;
};

const TEMPLATE_OPTIONS: Omit<DropdownOption, 'url'>[] = [
  { key: 'pacote_horas',    label: 'Pacote de Horas',      icon: Clock,      badge: 'SC' },
  { key: 'time_materials',  label: 'Time & Materials',     icon: Timer,      badge: 'SC' },
  { key: 'pacote_horas_ae', label: 'Pacote de Horas AE',   icon: Calculator, badge: 'AE' },
  { key: 'escopo_fechado',  label: 'Escopo Fechado',       icon: Target,     badge: 'SC', disabled: true },
];

const DEMO_OPTIONS: Omit<DropdownOption, 'url'>[] = [
  { key: 'PT', label: 'Português', flag: '🇧🇷', badge: 'PT-BR' },
  { key: 'EN', label: 'Inglês',    flag: '🇺🇸', badge: 'EN-US' },
  { key: 'ES', label: 'Espanhol',  flag: '🇪🇸', badge: 'ES-ES', disabled: true },
];

function buildTemplateOptions(links: TemplateLinks): DropdownOption[] {
  return TEMPLATE_OPTIONS.map((opt) => ({
    ...opt,
    url: links[opt.key as keyof TemplateLinks],
  }));
}

function buildDemoOptions(links: DemoLinks): DropdownOption[] {
  return DEMO_OPTIONS.map((opt) => ({
    ...opt,
    url: links[opt.key as keyof DemoLinks],
  }));
}

type DropdownKind = 'templates' | 'demos';

function DropdownCard({
  kind,
  title,
  subtitle,
  CardIcon,
  options,
  open,
  onToggle,
  onClose,
}: {
  kind: DropdownKind;
  title: string;
  subtitle: string;
  CardIcon: LucideIcon;
  options: DropdownOption[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  return (
    <div className="relative flex flex-col w-full" ref={wrapperRef}>
      <button
        type="button"
        onClick={onToggle}
        className={`
          group bg-white p-12 rounded-[3rem] border transition-all duration-500
          shadow-xl hover:shadow-2xl flex flex-col items-center space-y-8 w-full text-left
          ${open ? 'border-brand-primary shadow-2xl' : 'border-slate-300 hover:border-brand-primary'}
        `}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${title} — abrir opções`}
      >
        <div className={`
          w-16 h-16 brand-bg-primary rounded-[2rem] flex items-center justify-center text-white
          shadow-2xl group-hover:scale-110 transition-all relative
        `}>
          <CardIcon className="w-8 h-8 shrink-0" />
        </div>
        <div className="text-center w-full">
          <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight inline-flex items-center gap-2 mx-auto">
            {title}
            <ChevronDown
              className={`w-4 h-4 text-slate-400 group-hover:text-brand-primary shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-brand-primary' : ''}`}
            />
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
            {subtitle}
          </p>
        </div>
      </button>

      {open && (
        <div
          role="menu"
          className="
            absolute left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] top-[calc(100%-0.75rem)] z-20
            bg-white border border-slate-300 rounded-[1.75rem] shadow-2xl
            p-3 space-y-1.5 animate-in fade-in zoom-in-95 duration-200
          "
          aria-label={`Selecionar ${title}`}
        >
          {options.map((opt) => {
            const OptionIcon = opt.icon;
            const baseRowClass = `
              flex items-center justify-between gap-4 px-5 py-4 rounded-[1.25rem]
              text-[11px] font-black uppercase tracking-widest transition-all duration-200
            `;
            const enabledRowClass = opt.disabled
              ? 'text-slate-300 bg-slate-50 opacity-70 cursor-not-allowed select-none'
              : 'text-brand-dark hover:bg-brand-primary hover:text-white cursor-pointer';

            return opt.disabled ? (
              <div
                key={`${kind}-${opt.key}`}
                role="menuitem"
                aria-disabled="true"
                aria-label={`${opt.label} — indisponível`}
                className={`${baseRowClass} ${enabledRowClass}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  {OptionIcon && <OptionIcon className="w-4 h-4 shrink-0 text-slate-300" />}
                  {opt.flag && <span className="text-xl leading-none shrink-0 opacity-60 grayscale" aria-hidden>{opt.flag}</span>}
                  <span className="truncate">{opt.label}</span>
                </span>
                {opt.badge && (
                  <span className="text-[9px] font-bold tracking-[0.2em] text-slate-300 uppercase shrink-0">
                    {opt.badge}
                  </span>
                )}
              </div>
            ) : (
              <a
                key={`${kind}-${opt.key}`}
                href={opt.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                role="menuitem"
                className={`${baseRowClass} ${enabledRowClass}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  {OptionIcon && <OptionIcon className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-white/90" />}
                  {opt.flag && <span className="text-xl leading-none shrink-0" aria-hidden>{opt.flag}</span>}
                  <span className="truncate">{opt.label}</span>
                </span>
                {opt.badge && (
                  <span className="text-[9px] font-bold tracking-[0.2em] text-slate-400 uppercase shrink-0 group-hover:text-white/80">
                    {opt.badge}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HomeClient({ templateLinks, demoLinks }: HomeClientProps) {
  const [openKind, setOpenKind] = useState<DropdownKind | null>(null);

  const templateOptions = buildTemplateOptions(templateLinks);
  const demoOptions = buildDemoOptions(demoLinks);

  useEffect(() => {
    if (openKind === null) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenKind(null);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [openKind]);

  const toggle = (kind: DropdownKind) =>
    setOpenKind((prev) => (prev === kind ? null : kind));

  return (
    <section
      aria-label="Recursos externos"
      className="w-full max-w-4xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <DropdownCard
          kind="templates"
          title="Templates de Escopos"
          subtitle="Selecione o modelo desejado"
          CardIcon={FolderKanban}
          options={templateOptions}
          open={openKind === 'templates'}
          onToggle={() => toggle('templates')}
          onClose={() => setOpenKind(null)}
        />
        <DropdownCard
          kind="demos"
          title="Ambientes de Demo"
          subtitle="Escolha o idioma do ambiente"
          CardIcon={Globe}
          options={demoOptions}
          open={openKind === 'demos'}
          onToggle={() => toggle('demos')}
          onClose={() => setOpenKind(null)}
        />
      </div>
    </section>
  );
}
