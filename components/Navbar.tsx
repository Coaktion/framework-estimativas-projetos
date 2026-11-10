'use client';

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Moon, Sun, Maximize2, Minimize2, ChevronDown } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";
import { canAccessScopes, canAccessAE, canAccessZdAutoConfig, canAccessPreSalesOps, canAccessBooking, canAccessFolders, canAccessEstudos } from "@/lib/segments";

/** Botão de ícone do cabeçalho (densidade, tema). Mesmo visual do LanguageToggle e do FeedbackButton. */
export const HEADER_ICON_BUTTON =
  "inline-flex items-center justify-center h-9 min-w-[36px] px-2 rounded-[10px] border border-slate-200 bg-white text-slate-500 hover:text-brand-dark hover:border-slate-400 transition-colors";

/**
 * Menor escala da fonte dos links (≈ 85% do tamanho normal: 12,75px). Abaixo
 * disso o texto fica pequeno demais; o que não couber vai para o menu "Mais".
 */
const MIN_SCALE = 0.85;

/**
 * Faz os links caberem na largura disponível, sem barra de rolagem:
 *  1. diminui fonte, padding e espaçamento juntos (tudo em `em`) até MIN_SCALE;
 *  2. se nem assim couber, os últimos links vão para o menu "Mais".
 * As larguras naturais (escala 1) vêm de uma linha invisível de medição com
 * todos os links + o botão "Mais". Recalcula quando a largura muda
 * (ResizeObserver) e quando os links mudam (idioma, permissões).
 */
function useFitLinks(count: number, deps: unknown[]) {
  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, visible: count });

  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;
    const calc = () => {
      const available = box.clientWidth;
      const items = Array.from(measure.children) as HTMLElement[];
      if (!available || items.length !== count + 1) return;
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0;
      const widths = items.slice(0, count).map((i) => i.offsetWidth);
      const moreWidth = items[count].offsetWidth;
      const total = widths.reduce((a, w) => a + w, 0) + gap * Math.max(0, count - 1);

      let next: { scale: number; visible: number };
      if (total * MIN_SCALE <= available) {
        next = { scale: Math.min(1, Math.floor((available / total) * 100) / 100), visible: count };
      } else {
        // Na escala mínima: quantos links cabem junto com o botão "Mais"?
        let used = moreWidth;
        let visible = 0;
        for (const w of widths) {
          if ((used + gap + w) * MIN_SCALE > available) break;
          used += gap + w;
          visible++;
        }
        next = { scale: MIN_SCALE, visible };
      }
      setFit((prev) => (prev.scale === next.scale && prev.visible === next.visible ? prev : next));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(box);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, ...deps]);

  return { boxRef, measureRef, ...fit };
}

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { theme, isCompact, toggleTheme, toggleCompact } = useTheme();
  const { t, i18n } = useTranslation();
  const user = session?.user as any;
  const isAdmin = Boolean(user?.isAdmin);

  const links = user ? [
    { show: canAccessScopes(user), href: '/sc', match: '/sc', label: t('nav.projects') },
    { show: canAccessAE(user), href: '/ae/history', match: '/ae', label: t('nav.history') },
    { show: canAccessZdAutoConfig(user), href: '/zd-auto-config', match: '/zd-auto-config', label: t('nav.zdAutoConfig'), title: t('nav.zdAutoConfigTitle') },
    { show: canAccessPreSalesOps(user), href: '/pre-sales-ops', match: '/pre-sales-ops', label: t('nav.preSalesOps'), title: t('nav.preSalesOpsTitle') },
    { show: canAccessBooking(user), href: '/booking', match: '/booking', label: t('nav.booking'), title: t('nav.bookingTitle') },
    { show: canAccessFolders(user), href: '/folders', match: '/folders', label: t('nav.folders'), title: t('nav.foldersTitle') },
    { show: canAccessEstudos(user), href: '/estudos', match: '/estudos', label: t('nav.estudos'), title: t('nav.estudosTitle') },
    { show: isAdmin, href: '/admin', match: '/admin', label: t('nav.admin') },
  ].filter((l) => l.show) : [];

  const { boxRef, measureRef, scale, visible } = useFitLinks(links.length, [i18n.language, user?.role, isAdmin]);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Fecha o menu "Mais" ao clicar fora ou trocar de página.
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [moreOpen]);
  useEffect(() => setMoreOpen(false), [pathname]);

  if (!session?.user) return null;

  const shown = links.slice(0, visible);
  const overflow = links.slice(visible);
  const overflowActive = overflow.some((l) => pathname.startsWith(l.match));
  const linkClass = (active: boolean) =>
    `px-[0.8em] py-[0.53em] leading-[1.55] font-medium whitespace-nowrap transition-colors ${
      active
        ? 'text-brand-dark rounded-t-lg shadow-[inset_0_-2px_0_var(--primary)]'
        : 'text-slate-500 rounded-lg hover:text-brand-dark hover:bg-slate-100'
    }`;

  return (
    <div className="hidden md:flex items-center gap-6 min-w-0 flex-1">
      <div ref={boxRef} className="relative flex-1 min-w-0">
        {/* Linha invisível só para medir a largura natural (escala 1) de cada link. */}
        <div
          ref={measureRef}
          aria-hidden="true"
          className="absolute left-0 top-0 w-0 h-0 overflow-hidden invisible pointer-events-none flex items-center gap-[0.27em] [&>*]:shrink-0"
          style={{ fontSize: 'var(--fs-body)' }}
        >
          {links.map((l) => (
            <span key={l.href} className={linkClass(false)}>{l.label}</span>
          ))}
          <span className={`${linkClass(false)} inline-flex items-center gap-[0.3em]`}>
            {t('nav.more')}
            <ChevronDown className="w-[1em] h-[1em]" />
          </span>
        </div>

        <div className="flex items-center gap-[0.27em]" style={{ fontSize: `calc(var(--fs-body) * ${scale})` }}>
          {shown.map((l) => {
            const active = pathname.startsWith(l.match);
            return (
              <Link
                key={l.href}
                href={l.href}
                title={l.title}
                aria-current={active ? 'page' : undefined}
                className={linkClass(active)}
              >
                {l.label}
              </Link>
            );
          })}

          {overflow.length > 0 && (
            <div ref={moreRef} className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={`${linkClass(overflowActive)} inline-flex items-center gap-[0.3em]`}
              >
                {t('nav.more')}
                <ChevronDown className={`w-[1em] h-[1em] transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-2 min-w-[200px] bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-[60] text-body"
                >
                  {overflow.map((l) => {
                    const active = pathname.startsWith(l.match);
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        title={l.title}
                        role="menuitem"
                        aria-current={active ? 'page' : undefined}
                        className={`block px-3 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
                          active ? 'text-brand-dark bg-slate-100' : 'text-slate-500 hover:text-brand-dark hover:bg-slate-100'
                        }`}
                      >
                        {l.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <LanguageToggle />
        <button
          type="button"
          onClick={toggleCompact}
          className={HEADER_ICON_BUTTON}
          title={isCompact ? t('nav.normalMode') : t('nav.compactMode')}
          aria-label={isCompact ? t('nav.normalMode') : t('nav.compactMode')}
        >
          {isCompact ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className={HEADER_ICON_BUTTON}
          title={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
          aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
