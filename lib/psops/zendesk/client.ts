/**
 * Cliente da API pública do Help Center do Zendesk.
 *
 * Não precisa de autenticação: os artigos do Help Center público respondem
 * JSON com o body completo. Validado em 11/08/2026.
 *
 * ATENÇÃO — não confundir com a Admin API do tenant de demo, usada pela camada
 * de verificação. Essa exige credencial, e deve usar OAuth, não API token:
 * a remoção dos API tokens como método de autenticação já foi anunciada.
 */

import { env } from '../lib/env';
import type { HcArticle, HcArticlesResponse } from './types';

export class ZendeskHttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    body?: string,
  ) {
    super(`Zendesk HC ${status} em ${url}${body ? ` — ${body.slice(0, 200)}` : ''}`);
  }
}

interface FetchOpts {
  timeoutMs: number;
  retries: number;
}

async function pegarJson<T>(url: string, opts: FetchOpts): Promise<T> {
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa <= opts.retries; tentativa++) {
    if (tentativa > 0) {
      // backoff exponencial com teto: 400ms, 800ms, 1600ms…
      await new Promise((r) => setTimeout(r, Math.min(400 * 2 ** (tentativa - 1), 5_000)));
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AktieNow-PreSalesOps/1.0 (+pre-sales internal tooling)',
        },
        // o conteúdo muda no máximo algumas vezes por dia
        cache: 'no-store',
      });
      if (res.status === 429 || res.status >= 500) {
        // vale nova tentativa
        ultimoErro = new ZendeskHttpError(res.status, url, await res.text().catch(() => ''));
        continue;
      }
      if (!res.ok) {
        // 4xx que não é 429: não insiste
        throw new ZendeskHttpError(res.status, url, await res.text().catch(() => ''));
      }
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof ZendeskHttpError && e.status < 500 && e.status !== 429) throw e;
      ultimoErro = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error(`Falha ao buscar ${url}: ${String(ultimoErro)}`);
}

export interface ClienteHc {
  listarArtigos(params: {
    kind: 'CATEGORY' | 'SECTION';
    zendeskId: string;
    locale?: string;
    /** para de paginar quando encontrar item com created_at <= este valor */
    pararEm?: Date | null;
  }): Promise<HcArticle[]>;
  pegarArtigo(params: { zendeskId: string; locale?: string }): Promise<HcArticle>;
}

export function criarClienteHc(overrides?: Partial<FetchOpts> & { base?: string }): ClienteHc {
  const e = env();
  const base = overrides?.base ?? e.PSOPS_ZENDESK_HC_BASE;
  const opts: FetchOpts = {
    timeoutMs: overrides?.timeoutMs ?? e.PSOPS_HTTP_TIMEOUT_MS,
    retries: overrides?.retries ?? e.PSOPS_HTTP_RETRIES,
  };

  return {
    async listarArtigos({ kind, zendeskId, locale = 'en-us', pararEm = null }) {
      const raiz = kind === 'CATEGORY' ? 'categories' : 'sections';
      const artigos: HcArticle[] = [];

      for (let pagina = 1; pagina <= e.PSOPS_MAX_PAGES; pagina++) {
        const url =
          `${base}/api/v2/help_center/${locale}/${raiz}/${zendeskId}/articles.json` +
          `?sort_by=created_at&sort_order=desc&per_page=${e.PSOPS_PAGE_SIZE}&page=${pagina}`;

        const dados = await pegarJson<HcArticlesResponse>(url, opts);
        const lote = dados.articles ?? [];
        if (lote.length === 0) break;

        artigos.push(...lote);

        // A ordenação é created_at desc: se o último item da página já é mais
        // antigo que a marca d'água, não existe nada novo nas próximas.
        if (pararEm) {
          const ultimo = lote[lote.length - 1];
          if (ultimo && new Date(ultimo.created_at) <= pararEm) break;
        }
        if (!dados.next_page) break;
      }

      return artigos;
    },

    async pegarArtigo({ zendeskId, locale = 'en-us' }) {
      const url = `${base}/api/v2/help_center/${locale}/articles/${zendeskId}.json`;
      const dados = await pegarJson<{ article: HcArticle }>(url, opts);
      return dados.article;
    },
  };
}
