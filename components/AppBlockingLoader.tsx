'use client';

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

const DEFAULT_MSG = 'Carregando…';

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

  // Wrap the router so that client-side `router.push`/`router.replace` also
  // block interactions. `startTransition` already sets `isPending` (used
  // below as `navigationPending`), but we also add a minimum block of ~120ms
  // to avoid double-clicks on instant navigations that would otherwise
  // "flash" no loader at all.
  const wrappedRouter = useMemo<typeof router>(() => {
    if (!router) return router;
    const push: typeof router.push = (href, opts) => {
      beginNavLock();
      startTransition(() => {
        router.push(href as any, opts);
      });
    };
    const replace: typeof router.replace = (href, opts) => {
      beginNavLock();
      startTransition(() => {
        router.replace(href as any, opts);
      });
    };
    const refresh: typeof router.refresh = () => {
      beginNavLock();
      startTransition(() => {
        router.refresh();
      });
    };
    return { ...router, push, replace, refresh };
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
  // Goal: show a blocking overlay *as soon as the user triggers* any
  // navigation (click on a <Link>, submit, or any programmatic router.push)
  // and keep it until both:
  //  1. React `useTransition` `isPending` settles (covers client-side navs).
  //  2. Suspense / `app/loading.tsx` boundaries settle on the destination.
  // For pure server-side redirects (307/308 from server actions), the
  // browser keeps its native spinner — this overlay is still useful while
  // the current tab stays responsive to other inputs before the redirect
  // response arrives.
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
    // Click-capture at the window level so ANY clickable element that
    // triggers a page load / navigation starts the lock *before* the
    // navigation itself even starts. This prevents double-clicks during
    // the compile+load window of the App Router.
    const capture = (e: MouseEvent | TouchEvent) => {
      let target: EventTarget | null = e.target;
      let el: HTMLElement | null = null;
      if (target instanceof Node) {
        el = (target as HTMLElement).closest?.('a, button, [role="button"], input[type="submit"], summary, label[for]') as HTMLElement | null;
      }
      if (!el) return;
      const tag = (el.tagName || '').toLowerCase();
      // Skip anything with a click handler that's definitely local-only
      const hasPreventDefault = (e as any).defaultPrevented;
      if (hasPreventDefault) return;
      if (tag === 'a') {
        const a = el as HTMLAnchorElement;
        const href = a.getAttribute('href') || '';
        // No-op links / in-page / external / target _blank do not block UI
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || a.target === '_blank') return;
        // Only block navigation *within the app* (relative or same-origin)
        try {
          const url = new URL(href, window.location.origin);
          if (url.origin !== window.location.origin) return;
        } catch {
          return;
        }
        // Ignore clicks with modifier keys (open-in-new-tab users)
        const me = e as MouseEvent;
        if (me && (me.metaKey || me.ctrlKey || me.shiftKey || me.altKey || me.button === 1)) return;
        beginNavLock();
      } else {
        // Buttons / submits — lock the UI for 120ms minimum to avoid
        // double-submits, even for forms that trigger server actions.
        beginNavLock();
        setTimeout(() => endNavLock(), 120);
      }
    };
    window.addEventListener('click', capture, true);
    return () => window.removeEventListener('click', capture, true);
  }, [beginNavLock, endNavLock]);

  // Also submit capture for form / enter key submits.
  useEffect(() => {
    const onSubmit = () => {
      beginNavLock();
      setTimeout(() => endNavLock(), 150);
    };
    const onKeyEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.tagName === 'A' || t.tagName === 'BUTTON') {
        beginNavLock();
        setTimeout(() => endNavLock(), 150);
      }
    };
    window.addEventListener('submit', onSubmit, true);
    window.addEventListener('keydown', onKeyEnter, true);
    return () => {
      window.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('keydown', onKeyEnter, true);
    };
  }, [beginNavLock, endNavLock]);

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
      const t = setTimeout(() => setVisible(false), 120);
      return () => clearTimeout(t);
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
      <div className="absolute inset-0 bg-white/60 dark:bg-[#0A120C]/70 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in" />
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
              text-[10px] font-black uppercase tracking-[0.22em]
              ${isDark ? 'text-[color:var(--text-muted,#8ca092)]' : 'text-slate-400'}
            `}
          >
            PreSales AI
          </span>
          <span
            className={`
              text-sm font-black tracking-tight mt-1
              ${isDark ? 'text-[color:var(--text-main,#E6F0EA)]' : 'text-brand-dark'}
            `}
          >
            {message || DEFAULT_MSG}
          </span>
        </div>
      </div>
    </div>
  );
}
