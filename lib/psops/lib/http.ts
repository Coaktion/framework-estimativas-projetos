/**
 * Helpers de resposta e tratamento de erro para os route handlers.
 * Centraliza o formato de erro para o frontend nunca precisar adivinhar.
 */
import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { NaoAutenticado, SemPermissao } from './erros';

export interface ErroPayload {
  erro: string;
  detalhe?: unknown;
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function criado<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function erro(status: number, mensagem: string, detalhe?: unknown) {
  const body: ErroPayload = { erro: mensagem, ...(detalhe !== undefined ? { detalhe } : {}) };
  return NextResponse.json(body, { status });
}

export class NaoEncontrado extends Error {
  readonly status = 404;
  constructor(o: string) {
    super(`${o} não encontrado.`);
  }
}

export class RegraDeNegocio extends Error {
  readonly status = 409;
  constructor(m: string) {
    super(m);
  }
}

/**
 * Envolve o handler e traduz exceções conhecidas em respostas.
 * Erro inesperado vira 500 sem vazar stack para o cliente — o stack vai
 * para o log do servidor.
 */
export async function handler<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ZodError) {
      return erro(422, 'Payload inválido.', e.issues);
    }
    if (e instanceof NaoAutenticado) return erro(401, e.message);
    if (e instanceof SemPermissao) return erro(403, e.message);
    if (e instanceof NaoEncontrado) return erro(404, e.message);
    if (e instanceof RegraDeNegocio) return erro(409, e.message);
    console.error('[psops] erro não tratado:', e);
    return erro(500, 'Erro interno.');
  }
}

/** Valida o body JSON de um Request contra um schema zod. */
export async function lerBody<S extends ZodSchema>(req: Request, schema: S) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ZodError([
      { code: 'custom', path: [], message: 'Body não é JSON válido.' },
    ]);
  }
  return schema.parse(json) as ReturnType<S['parse']>;
}

/** Valida a query string contra um schema zod. */
export function lerQuery<S extends ZodSchema>(req: Request, schema: S) {
  const url = new URL(req.url);
  const obj: Record<string, string | string[]> = {};
  // forEach em vez de for…of: o tsconfig do portal não tem target ES2015+
  url.searchParams.forEach((v, k) => {
    const atual = obj[k];
    if (atual === undefined) obj[k] = v;
    else if (Array.isArray(atual)) atual.push(v);
    else obj[k] = [atual, v];
  });
  return schema.parse(obj) as ReturnType<S['parse']>;
}
