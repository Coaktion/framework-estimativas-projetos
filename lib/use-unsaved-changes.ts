'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Bloqueia a saída da página enquanto houver alterações não salvas.
 *
 * Cobre as quatro saídas possíveis:
 *  - fechar a aba, recarregar ou digitar outra URL → aviso nativo do navegador
 *    (`beforeunload`; o texto é do próprio navegador, não dá para trocar);
 *  - clicar em qualquer link interno (menu, logo, breadcrumbs) → confirmação;
 *  - voltar/avançar do navegador → confirmação;
 *  - navegação feita pelo próprio código (trocar de versão, clonar) → quem
 *    navega chama `confirmLeave()` antes.
 */
export function useUnsavedChangesGuard(isDirty: boolean, message: string) {
  const dirtyRef = useRef(isDirty);
  const messageRef = useRef(message);
  dirtyRef.current = isDirty;
  messageRef.current = message;

  // Fechar / recarregar / sair do site.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Cliques em links: interceptados na fase de captura, antes do <Link> do
  // Next fazer a navegação client-side.
  useEffect(() => {
    if (!isDirty) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      // Âncora na mesma página (#resumo-horas etc.) não sai da página.
      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash
      ) return;
      if (!window.confirm(messageRef.current)) {
        event.preventDefault();
        event.stopPropagation();
        // Avisa o overlay de carregamento (AppBlockingLoader) que a navegação
        // não vai acontecer — ele decide depois do clique terminar.
        (event as any).__navigationCancelled = true;
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isDirty]);

  // Voltar / avançar: uma entrada-guarda com a MESMA URL e o mesmo estado do
  // Next fica no topo da pilha; sair dela para trás pede confirmação.
  useEffect(() => {
    if (!isDirty) return;
    const guardedPath = window.location.pathname + window.location.search;
    // Reaproveita a entrada-guarda se ela já existe (a guarda desarmou e armou
    // de novo, ex.: durante o salvar) — senão cada ciclo empilharia uma
    // entrada repetida e o Voltar pareceria não funcionar.
    if (!window.history.state?.__unsavedGuard) {
      const guardState = { ...(window.history.state || {}), __unsavedGuard: true };
      window.history.pushState(guardState, '', window.location.href);
    }
    let leaving = false;
    const onPopState = (event: PopStateEvent) => {
      if (leaving) return;
      // Voltou para a própria entrada-guarda (ex.: depois de uma âncora): fica.
      if (event.state?.__unsavedGuard) return;
      // Âncora na mesma página (#resumo-horas): o navegador cria uma entrada
      // sem estado e dispara popstate — não é sair da página.
      if (event.state == null && window.location.pathname + window.location.search === guardedPath) return;
      if (window.confirm(messageRef.current)) {
        leaving = true;
        window.removeEventListener('popstate', onPopState);
        window.history.back();
      } else {
        const guardState = { ...(window.history.state || {}), __unsavedGuard: true };
        window.history.pushState(guardState, '', window.location.href);
      }
    };
    window.addEventListener('popstate', onPopState);
    // Ao desarmar (salvou), a entrada-guarda fica onde está: sem o listener ela
    // é uma entrada comum, e é reaproveitada se a guarda armar de novo. Não
    // usamos history.back() aqui porque o salvar costuma navegar logo em
    // seguida e o back() assíncrono desfaria essa navegação.
    return () => window.removeEventListener('popstate', onPopState);
  }, [isDirty]);

  /** Para navegações feitas pelo código: true = pode seguir. */
  const confirmLeave = useCallback(() => {
    if (!dirtyRef.current) return true;
    return window.confirm(messageRef.current);
  }, []);

  return { confirmLeave };
}
