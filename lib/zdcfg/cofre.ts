/**
 * Cofre de ambientes Zendesk (tabela zdcfg_environments, model ZdEnvironment).
 * SÓ SERVIDOR. O segredo (token de API ou client secret) é cifrado com Fernet
 * e a chave fica só no servidor (ZDCFG_FERNET_KEY). O navegador recebe apenas
 * nome, subdomínio e tipo.
 *
 * Regras (as mesmas do serviço Python):
 *   privado        -> só o dono vê, usa, edita e exclui
 *   compartilhado  -> todos os ADMIN/SC veem e usam; só o dono edita e exclui
 */
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { fernetDecrypt, fernetEncrypt } from './fernet';
import type { Credenciais } from './zendesk';
import type { Quem } from './acesso';

export class ErroCofre extends Error {
  constructor(msg: string, public status = 400) { super(msg); }
}

export function chaveCofre(): string {
  const k = (process.env.ZDCFG_FERNET_KEY || '').trim();
  if (!k) throw new ErroCofre('ZDCFG_FERNET_KEY não configurada no servidor', 503);
  return k;
}
export const cofreConfigurado = () => Boolean((process.env.ZDCFG_FERNET_KEY || '').trim());

export type EnvMeta = {
  id: string; nome: string; subdomain: string; auth: 'token' | 'oauth';
  email: string | null; client_id: string | null; dono: string; compartilhado: boolean; pode_editar: boolean;
};

export type EnvDados = {
  nome: string; subdomain: string; auth: 'token' | 'oauth';
  email?: string; token?: string; client_id?: string; client_secret?: string; compartilhado?: boolean;
};

const db = () => (prisma as any).zdEnvironment;

function meta(r: any, quem: Quem): EnvMeta {
  return {
    id: r.id, nome: r.name, subdomain: r.subdomain, auth: r.authType === 'oauth' ? 'oauth' : 'token',
    email: r.adminEmail ?? null, client_id: r.clientId ?? null,
    dono: String(r.owner?.email || '').toLowerCase(), compartilhado: Boolean(r.shared),
    pode_editar: r.ownerId === quem.id,
  };
}

export async function listar(quem: Quem): Promise<EnvMeta[]> {
  const rows = await db().findMany({
    where: { OR: [{ ownerId: quem.id }, { shared: true }] },
    include: { owner: { select: { email: true } } },
    orderBy: { name: 'asc' },
  });
  return rows.map((r: any) => meta(r, quem));
}

async function buscarVisivel(id: string, quem: Quem) {
  const r = await db().findUnique({ where: { id }, include: { owner: { select: { email: true } } } });
  if (!r || (r.ownerId !== quem.id && !r.shared)) throw new ErroCofre('ambiente não encontrado', 404);
  return r;
}

function limpar(d: EnvDados) {
  const auth = d.auth === 'oauth' ? 'oauth' : d.auth === 'token' ? 'token' : null;
  if (!auth) throw new ErroCofre('auth inválido');
  const nome = String(d.nome || '').trim();
  const subdomain = String(d.subdomain || '').trim();
  if (!nome || !subdomain) throw new ErroCofre('nome e subdomínio são obrigatórios');
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(subdomain)) throw new ErroCofre('subdomínio inválido (use só o nome, sem https e sem .zendesk.com)');
  const segredo = String((auth === 'oauth' ? d.client_secret : d.token) || '').trim();
  return {
    nome, subdomain, auth, segredo,
    email: String(d.email || '').trim() || null,
    clientId: String(d.client_id || '').trim() || null,
    compartilhado: Boolean(d.compartilhado),
  };
}

function duplicado(e: any, nome: string): never {
  if (e?.code === 'P2002') throw new ErroCofre(`você já tem um ambiente chamado '${nome}'`);
  throw e;
}

export async function criar(quem: Quem, d: EnvDados): Promise<string> {
  const x = limpar(d);
  if (!x.segredo) throw new ErroCofre('informe o segredo do ambiente');
  const id = randomBytes(12).toString('hex');
  try {
    await db().create({
      data: {
        id, name: x.nome, subdomain: x.subdomain, authType: x.auth,
        adminEmail: x.auth === 'token' ? x.email : null, clientId: x.auth === 'oauth' ? x.clientId : null,
        secretEnc: fernetEncrypt(x.segredo, chaveCofre()), shared: x.compartilhado, ownerId: quem.id,
      },
    });
  } catch (e) { duplicado(e, x.nome); }
  return id;
}

export async function editar(quem: Quem, id: string, d: EnvDados): Promise<void> {
  const atual = await buscarVisivel(id, quem);
  if (atual.ownerId !== quem.id) throw new ErroCofre('ambiente de outro usuário', 403);
  const x = limpar(d);
  try {
    await db().update({
      where: { id },
      data: {
        name: x.nome, subdomain: x.subdomain, authType: x.auth,
        adminEmail: x.auth === 'token' ? x.email : null, clientId: x.auth === 'oauth' ? x.clientId : null,
        // segredo em branco = manter o atual
        ...(x.segredo ? { secretEnc: fernetEncrypt(x.segredo, chaveCofre()) } : {}),
        shared: x.compartilhado, updatedAt: new Date(),
      },
    });
  } catch (e) { duplicado(e, x.nome); }
}

export async function excluir(quem: Quem, id: string): Promise<void> {
  const atual = await buscarVisivel(id, quem);
  if (atual.ownerId !== quem.id) throw new ErroCofre('ambiente de outro usuário', 403);
  await db().delete({ where: { id } });
}

/** Credenciais abertas, só para o servidor falar com o Zendesk. */
export async function credenciais(quem: Quem, id: string): Promise<Credenciais> {
  const r = await buscarVisivel(id, quem);
  const segredo = fernetDecrypt(r.secretEnc, chaveCofre());
  return r.authType === 'oauth'
    ? { auth: 'oauth', subdomain: r.subdomain, clientId: r.clientId || '', clientSecret: segredo }
    : { auth: 'token', subdomain: r.subdomain, email: r.adminEmail || '', token: segredo };
}
