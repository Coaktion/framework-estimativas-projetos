/**
 * Cliente HTTP do frontend.
 *
 * Erro da API vem sempre em `{ erro, detalhe }` — este wrapper transforma isso
 * em Error com mensagem legível, para os componentes só precisarem de try/catch.
 */
import type { ErroApi } from './tipos';

export class ErroRequisicao extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly detalhe?: unknown,
  ) {
    super(mensagem);
  }
}

async function requisitar<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });

  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as ErroApi | null;
    throw new ErroRequisicao(
      res.status,
      corpo?.erro ?? `Falha na requisição (HTTP ${res.status}).`,
      corpo?.detalhe,
    );
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(url: string) => requisitar<T>(url),
  post: <T>(url: string, body?: unknown) =>
    requisitar<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body: unknown) =>
    requisitar<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
};
