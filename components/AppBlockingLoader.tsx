'use client';
import { useTranslation } from 'react-i18next';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export type AppLoadingContextValue = {
  loading: boolean;
  message: string | null;
  startLoading: (msg?: string) => void;
  stopLoading: () => void;
  /** Wrap an async/promise-returning function with a "loading" block that
   *  prevents any user interaction while it runs and shows the spinner. */
  runWithLoading: <T>(fn: () => Promise<T>, msg?: string) => Promise<T>;
  /** True when React useTransition (router.push, etc.) is in-flight. */
  navigationPending: boolean;
};

const DEFAULT_MSG = '__loading__'; // sentinel: traduzido no render via t('common.loading')

/**
 * true quando o href leva a OUTRA página do app (mesma origem, outro caminho).
 * Downloads (blob:/data:), mailto:, âncoras e mudanças só de query/hash não contam.
 */
function isOtherPage(href: string): boolean {
  if (!href || href.startsWith('#')) return false;
  try {
    const url = new URL(href, window.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.origin === window.location.origin && url.pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

const AppLoadingContext = createContext<AppLoadingContextValue | null>(null);

export function useAppLoading(): AppLoadingContextValue {
  const ctx = useContext(AppLoadingContext);
  if (!ctx) {
    // Silent fallback to avoid crashes if someone calls this hook before
    // the provider is mounted (which shouldn't happen in this codebase).
    return {
      loading: false,
      message: null,
      startLoading: () => {},
      stopLoading: () => {},
      runWithLoading: async (fn) => await fn(),
      navigationPending: false,
    };
  }
  return ctx;
}

export function AppLoadingProvider({ children }: { children: React.ReactNode }) {
  const [explicitLoading, setExplicitLoading] = useState(false);
  const [explicitMessage, setExplicitMessage] = useState<string | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const startTsRef = useRef<number>(0);
  const minDurationRef = useRef<number>(0);
  const cancelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef = useRef<number>(0);
  const navCountRef = useRef<number>(0);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Wrap the router so that client-side `router.push`/`router.replace` to
  // ANOTHER page also show the overlay. Navigations that stay on the same
  // page (only the query or hash changes) and `router.refresh()` don't: the
  // overlay is only for real page loads.
  const wrappedRouter = useMemo<typeof router>(() => {
    if (!router) return router;
    const push: typeof router.push = (href, opts) => {
      if (isOtherPage(String(href))) beginNavLock();
      startTransition(() => {
        router.push(href as any, opts);
      });
    };
    const replace: typeof router.replace = (href, opts) => {
      if (isOtherPage(String(href))) beginNavLock();
      startTransition(() => {
        router.replace(href as any, opts);
      });
    };
    return { ...router, push, replace };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const stopLoadingNow = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current === 0) {
      setExplicitLoading(false);
      setExplicitMessage(null);
    }
  }, []);

  const startLoading = useCallback((msg?: string) => {
    countRef.current += 1;
    setExplicitMessage((prev) => prev ?? msg ?? DEFAULT_MSG);
    setExplicitLoading(true);
    // ensure at least 150ms shown so the overlay prevents double-clicks
    // even on extremely fast operations.
    minDurationRef.current = Math.max(minDurationRef.current, 150);
    startTsRef.current = startTsRef.current || Date.now();
  }, []);

  const stopLoading = useCallback(() => {
    const elapsed = startTsRef.current ? Date.now() - startTsRef.current : 0;
    const minDur = minDurationRef.current;
    const remaining = Math.max(0, minDur - elapsed);
    if (remaining > 0) {
      if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current);
      cancelTimeoutRef.current = setTimeout(() => {
        cancelTimeoutRef.current = null;
        startTsRef.current = 0;
        minDurationRef.current = 0;
        stopLoadingNow();
      }, remaining);
    } else {
      if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current);
      cancelTimeoutRef.current = null;
      startTsRef.current = 0;
      minDurationRef.current = 0;
      stopLoadingNow();
    }
  }, [stopLoadingNow]);

  const runWithLoading = useCallback(
    async <T,>(fn: () => Promise<T>, msg?: string): Promise<T> => {
      startLoading(msg);
      try {
        return await fn();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading],
  );

  // --------------
  // Nav lock (Next App Router)
  // Goal: show a blocking overlay while the app loads ANOTHER page (click on
  // an internal link, or useAppRouter().push/replace to another path) and
  // keep it until the destination URL settles and the React transition is
  // done. In-page actions (buttons, forms, exports, filters) never show it.
  // --------------
  const beginNavLock = useCallback(() => {
    navCountRef.current += 1;
    setNavLoading(true);
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    // Safety net: never lock the UI forever. If something goes wrong during
    // navigation, release the overlay after 60s.
    navTimerRef.current = setTimeout(() => {
      navTimerRef.current = null;
      navCountRef.current = 0;
      setNavLoading(false);
    }, 60_000);
  }, []);
  const endNavLock = useCallback(() => {
    navCountRef.current = Math.max(0, navCountRef.current - 1);
    if (navCountRef.current === 0) {
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current);
        navTimerRef.current = null;
      }
      setNavLoading(false);
    }
  }, []);

  useEffect(() => {
    // Só links internos que levam a OUTRA página mostram o overlay. Botões,
    // formulários, downloads (exportar), âncoras e trocas de filtro na mesma
    // página não mostram nada: são ações dentro da página.
    // A decisão espera o clique terminar (setTimeout 0) para respeitar quem
    // cancelou a navegação no meio do caminho — ex.: o aviso de alterações
    // não salvas, quando o usuário escolhe ficar.
    const capture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      if (a.hasAttribute('download') || (a.target && a.target !== '_self')) return;
      if (!isOtherPage(a.getAttribute('href') || '')) return;
      const fromPath = window.location.pathname;
      setTimeout(() => {
        if ((e as any).__navigationCancelled) return;
        // Página já em cache pode trocar antes deste timeout: aí não há o que esperar.
        if (window.location.pathname !== fromPath) return;
        beginNavLock();
      }, 0);
    };
    window.addEventListener('click', capture, true);
    return () => window.removeEventListener('click', capture, true);
  }, [beginNavLock]);

  // End the nav lock when the URL *settles* (pathname/searchParams stop
  // changing) AND the React transition is done.
  useEffect(() => {
    if (!isPending) {
      // give a brief moment for React Suspense boundaries (app/loading.tsx
      // fallback etc.) to flush before we release the overlay
      const t = setTimeout(() => endNavLock(), 150);
      return () => clearTimeout(t);
    }
  }, [pathname, searchParams, isPending, endNavLock]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current);
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, []);

  const loading = explicitLoading || navLoading || isPending;
  const message = explicitMessage || DEFAULT_MSG;
  const navigationPending = navLoading || isPending;

  const ctxValue = useMemo<AppLoadingContextValue>(
    () => ({
      loading,
      message,
      startLoading,
      stopLoading,
      runWithLoading,
      navigationPending,
    }),
    [loading, message, startLoading, stopLoading, runWithLoading, navigationPending],
  );

  return (
    <AppLoadingContext.Provider value={ctxValue}>
      <RouterOverrideContext.Provider value={wrappedRouter}>
        {children}
        <AppBlockingOverlay loading={loading} message={message} />
      </RouterOverrideContext.Provider>
    </AppLoadingContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/*       Router override — make `useRouter()` return the wrapped version      */
/* -------------------------------------------------------------------------- */
const RouterOverrideContext = createContext<ReturnType<typeof useRouter> | null>(null);
export function useAppRouter() {
  const override = useContext(RouterOverrideContext);
  const base = useRouter();
  return override || base;
}

/* -------------------------------------------------------------------------- */
/*                         Blocking overlay + spinner                         */
/* -------------------------------------------------------------------------- */
function AppBlockingOverlay({ loading, message }: { loading: boolean; message: string | null }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (loading) {
      setVisible(true);
      // Prevent scroll / any interaction on the page
      try {
        document.body.style.pointerEvents = 'none';
      } catch (_) {}
    } else {
      try {
        document.body.style.pointerEvents = '';
      } catch (_) {}
      const hideTimer = setTimeout(() => setVisible(false), 120);
      return () => clearTimeout(hideTimer);
    }
  }, [loading]);

  useEffect(() => {
    const update = () => {
      try {
        setIsDark(document.documentElement.classList.contains('dark'));
      } catch (_) {
        setIsDark(false);
      }
    };
    update();
    const obs = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(update)
      : null;
    if (obs) obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs?.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      role="status"
      aria-live="polite"
      style={{ pointerEvents: 'auto' }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
    >
      {/* Scrim (blocks clicks / interactions for the whole page) */}
      <div className="absolute inset-0 bg-white/60 dark:bg-[rgb(3_14_1/0.7)] backdrop-blur-sm transition-opacity duration-200 animate-in fade-in" />
      {/* Spinner card */}
      <div
        className={`
          relative z-10
          flex items-center gap-5
          px-8 py-5
          rounded-3xl
          shadow-2xl
          border
          transition-all
          duration-200
          animate-in fade-in zoom-in-95
          ${isDark
            ? 'bg-[color:var(--bg-card-solid,#0A120C)] border-[color:var(--border-main,#1f3425)]'
            : 'bg-white border-slate-200'
          }
        `}
      >
        <Loader2
          className={`
            w-8 h-8 animate-spin shrink-0
            ${isDark ? 'text-[color:var(--primary)]' : 'text-brand-primary'}
          `}
        />
        <div className="flex flex-col items-start leading-tight">
          <span
            className={`
              text-label font-medium  
              ${isDark ? 'text-[color:var(--text-muted,#8ca092)]' : 'text-slate-400'}
            `}
          >
            {t('loader.brand')}
          </span>
          <span
            className={`
              text-body font-bold tracking-tight mt-1
              ${isDark ? 'text-[color:var(--text-main,#E6F0EA)]' : 'text-brand-dark'}
            `}
          >
            {!message || message === DEFAULT_MSG ? t('common.loading') : message}
          </span>
        </div>
      </div>
    </div>
  );
}
