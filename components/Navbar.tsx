'use client';

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Maximize2, Minimize2 } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";
import { canAccessScopes, canAccessAE, canAccessZdAutoConfig, canAccessPreSalesOps, canAccessBooking, canAccessFolders } from "@/lib/segments";

/** Botão de ícone do cabeçalho (densidade, tema). Mesmo visual do LanguageToggle e do FeedbackButton. */
export const HEADER_ICON_BUTTON =
  "inline-flex items-center justify-center h-9 min-w-[36px] px-2 rounded-[10px] border border-slate-200 bg-white text-slate-500 hover:text-brand-dark hover:border-slate-400 transition-colors";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { theme, isCompact, toggleTheme, toggleCompact } = useTheme();
  const { t } = useTranslation();

  if (!session?.user) return null;

  const user = session.user as any;
  const isAdmin = session.user.isAdmin;

  const links = [
    { show: canAccessScopes(user), href: '/sc', match: '/sc', label: t('nav.projects') },
    { show: canAccessAE(user), href: '/ae/history', match: '/ae', label: t('nav.history') },
    { show: canAccessZdAutoConfig(user), href: '/zd-auto-config', match: '/zd-auto-config', label: t('nav.zdAutoConfig'), title: t('nav.zdAutoConfigTitle') },
    { show: canAccessPreSalesOps(user), href: '/pre-sales-ops', match: '/pre-sales-ops', label: t('nav.preSalesOps'), title: t('nav.preSalesOpsTitle') },
    { show: canAccessBooking(user), href: '/booking', match: '/booking', label: t('nav.booking'), title: t('nav.bookingTitle') },
    { show: canAccessFolders(user), href: '/folders', match: '/folders', label: t('nav.folders'), title: t('nav.foldersTitle') },
    { show: isAdmin, href: '/admin', match: '/admin', label: t('nav.admin') },
  ].filter((l) => l.show);

  return (
    <div className="hidden md:flex items-center gap-6 min-w-0 flex-1">
      <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
        {links.map((l) => {
          const active = pathname.startsWith(l.match);
          return (
            <Link
              key={l.href}
              href={l.href}
              title={l.title}
              aria-current={active ? 'page' : undefined}
              className={`px-3 py-2 text-body font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'text-brand-dark rounded-t-lg shadow-[inset_0_-2px_0_var(--primary)]'
                  : 'text-slate-500 rounded-lg hover:text-brand-dark hover:bg-slate-100'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
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
