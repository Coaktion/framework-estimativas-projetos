/**
 * MCP do Tool Center — https://<tool-center>/api/mcp
 *
 * Servidor MCP (Model Context Protocol) no transporte "Streamable HTTP", em
 * modo SEM ESTADO: cada POST traz uma mensagem JSON-RPC e recebe a resposta em
 * JSON, sem sessão nem SSE. É o modo que cabe numa função do Netlify.
 *
 * Autenticação: chave de API do Perfil no header `Authorization: Bearer tc_...`.
 * A rota fica fora do middleware de login (ver middleware.ts) e se protege
 * sozinha: sem chave válida, 401 antes de qualquer coisa.
 *
 * As ferramentas só leem, criam projeto e criam versão nova (lib/toolcenter.ts).
 */

import { NextResponse } from 'next/server';
import type { ZodTypeAny } from 'zod';
import { authenticateApiKey } from '@/lib/api-keys';
import {
  ToolCenterError, type ToolCenterContext,
  catalogInput, getCatalog,
  searchProjectsInput, searchProjects,
  getProjectInput, getProject,
  createProjectInput, createProject,
  estimateInput, createEstimateVersion,
  getVersionInput, getVersion,
} from '@/lib/toolcenter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SERVER_INFO = { name: 'aktienow-toolcenter', title: 'Aktie Now Tool Center', version: '1.0.0' };
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = [
  'Tool Center da Aktie Now: catálogo de itens do Framework de estimativas e projetos de escopo.',
  'Fluxo para estimar um escopo novo: (1) search_projects para não duplicar o cliente;',
  '(2) get_catalog para escolher itens e quantidades SÓ entre os itens existentes (use os ids);',
  '(3) create_project se o cliente ainda não tiver projeto; (4) create_estimate_version com dryRun=true',
  'para conferir totais e avisos; (5) create_estimate_version sem dryRun para salvar a versão nova.',
  'Nenhuma ferramenta altera ou apaga versões existentes. Responda ao usuário com o link da versão.',
].join(' ');

type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, boolean>;
  input: ZodTypeAny;
  run: (ctx: ToolCenterContext, args: any) => Promise<unknown>;
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const CREATES = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

const TOOLS: Tool[] = [
  {
    name: 'get_catalog',
    title: 'Catálogo do Framework',
    description: 'Módulos (categorias raiz) e itens ativos do Framework de estimativas, com id, horas unitárias, skill, plano mínimo e dependências. Use os ids em create_estimate_version.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Filtra itens por nome/descrição (sem acento, sem caixa).' },
        module: { type: 'string', description: 'Só itens deste módulo (campo `module` da lista de módulos).' },
        includeScope: { type: 'boolean', description: 'Inclui o texto de escopo incluído/excluído de cada item.' },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    input: catalogInput,
    run: getCatalog,
  },
  {
    name: 'search_projects',
    title: 'Buscar projetos',
    description: 'Projetos de escopo visíveis para você (seus ou não privados), com a versão mais recente. Use antes de criar um projeto, para não duplicar o cliente.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Parte do nome do projeto/cliente.' },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    input: searchProjectsInput,
    run: searchProjects,
  },
  {
    name: 'get_project',
    title: 'Ver projeto',
    description: 'Um projeto e todas as versões dele (id, nome, descrição, total de horas, links).',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'integer' } },
      required: ['projectId'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    input: getProjectInput,
    run: getProject,
  },
  {
    name: 'get_estimate_version',
    title: 'Ver versão de estimativa',
    description: 'Uma versão salva: plano, itens que contam, horas por linha, por módulo e por skill, Discovery/Validação/GP/DRN e o total.',
    inputSchema: {
      type: 'object',
      properties: { versionId: { type: 'integer' } },
      required: ['versionId'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    input: getVersionInput,
    run: getVersion,
  },
  {
    name: 'create_project',
    title: 'Criar projeto',
    description: 'Cria um projeto de escopo (vazio, sem versões) em seu nome. Nome no padrão "Cliente - Projeto".',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Ex.: "Olist - Implantação Zendesk".' },
        isPrivate: { type: 'boolean', description: 'Privado = só você vê. Padrão: false.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    annotations: CREATES,
    input: createProjectInput,
    run: createProject,
  },
  {
    name: 'create_estimate_version',
    title: 'Criar versão de estimativa',
    description: 'Calcula e salva uma NOVA versão (V1, V2...) da estimativa de um projeto, com o mesmo cálculo do editor. Marca sozinho os módulos dos itens enviados. Devolve totais, avisos (itens que não contam) e o link. Use dryRun=true para só calcular.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'integer' },
        description: { type: 'string', description: 'Do que trata a versão, ex.: "Sugestão inicial a partir da discovery de 28/10".' },
        plan: { type: 'string', enum: ['team', 'growth', 'professional', 'enterprise'], description: 'Plano Zendesk Suite do cliente. Padrão: professional.' },
        sku: { type: 'string', enum: ['CS', 'ES'], description: 'CS = Customer Service, ES = Employee Service. Padrão: CS.' },
        deploymentType: { type: 'string', enum: ['new', 'optimization'], description: 'Implantação nova ou otimização de instância existente. Padrão: new.' },
        items: {
          type: 'array',
          description: 'Itens do catálogo (ids de get_catalog).',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              quantity: { type: 'number', minimum: 0 },
              hours: { type: 'number', minimum: 0, description: 'Opcional: total manual de horas da linha (substitui quantidade × horas unitárias).' },
            },
            required: ['id', 'quantity'],
            additionalProperties: false,
          },
        },
        customItems: {
          type: 'array',
          description: 'Itens que não existem no catálogo. Prefira sempre itens do catálogo.',
          items: {
            type: 'object',
            properties: {
              module: { type: 'string', description: 'Módulo (campo `module` de get_catalog).' },
              name: { type: 'string' },
              unitHours: { type: 'number', minimum: 0 },
              quantity: { type: 'number', minimum: 0 },
              skill: { type: 'string', description: 'Implantação (padrão), Solution Design, Desenvolvimento, Design ou GP.' },
              scopeIncluded: { type: 'string' },
              scopeExcluded: { type: 'string' },
            },
            required: ['module', 'name', 'unitHours'],
            additionalProperties: false,
          },
        },
        marketplaceApps: {
          type: 'array',
          description: 'Apps do Marketplace Zendesk (5h cada).',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, link: { type: 'string' } },
            required: ['name'],
            additionalProperties: false,
          },
        },
        modules: { type: 'array', items: { type: 'string' }, description: 'Módulos a marcar mesmo sem itens.' },
        percents: {
          type: 'object',
          description: 'Só se o escopo pedir percentuais diferentes do padrão (defaultPercents de get_catalog).',
          properties: { gp: { type: 'number' }, discovery: { type: 'number' }, validation: { type: 'number' } },
          additionalProperties: false,
        },
        technicalScopeLink: { type: 'string', description: 'Link do documento de escopo técnico, se já existir.' },
        zohoLink: { type: 'string', description: 'Link do deal no Zoho CRM.' },
        dryRun: { type: 'boolean', description: 'true = só calcula, não grava.' },
      },
      required: ['projectId', 'description'],
      additionalProperties: false,
    },
    annotations: CREATES,
    input: estimateInput,
    run: createEstimateVersion,
  },
];

// ---------------------------------------------------------------------------
// JSON-RPC
// ---------------------------------------------------------------------------

type JsonRpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

const rpcResult = (id: JsonRpcMessage['id'], result: unknown) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id: JsonRpcMessage['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

function appOrigin(req: Request): string {
  const configured = String(process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  if (configured && !configured.includes('localhost')) return configured;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) return `${req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
  return configured || new URL(req.url).origin;
}

async function callTool(ctx: ToolCenterContext, params: any) {
  const tool = TOOLS.find((t) => t.name === params?.name);
  if (!tool) return null;
  const parsed = tool.input.safeParse(params?.arguments ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(argumentos)'}: ${i.message}`).join('; ');
    return { content: [{ type: 'text', text: `Argumentos inválidos — ${issues}` }], isError: true };
  }
  try {
    const result = await tool.run(ctx, parsed.data);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: Array.isArray(result) ? { results: result } : result,
    };
  } catch (e: any) {
    if (e instanceof ToolCenterError) return { content: [{ type: 'text', text: e.message }], isError: true };
    console.error(`[mcp] ${tool.name} falhou:`, e);
    return { content: [{ type: 'text', text: 'Erro interno no Tool Center. Tente de novo; se persistir, avise o time.' }], isError: true };
  }
}

async function handleMessage(ctx: ToolCenterContext, msg: JsonRpcMessage) {
  // Notificações e respostas não levam resposta.
  if (msg.id === undefined || msg.id === null || !msg.method) return null;
  switch (msg.method) {
    case 'initialize': {
      const requested = msg.params?.protocolVersion;
      return rpcResult(msg.id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(msg.id, {});
    case 'tools/list':
      return rpcResult(msg.id, {
        tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })),
      });
    case 'tools/call': {
      const result = await callTool(ctx, msg.params);
      return result ? rpcResult(msg.id, result) : rpcError(msg.id, -32602, `Ferramenta desconhecida: ${msg.params?.name}`);
    }
    default:
      return rpcError(msg.id, -32601, `Método não suportado: ${msg.method}`);
  }
}

export async function POST(req: Request) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json(rpcError(null, -32001, 'Chave de API ausente, inválida ou revogada. Gere uma no Perfil do Tool Center.'), {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer realm="toolcenter"' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'JSON inválido.'), { status: 400 });
  }

  const ctx: ToolCenterContext = { user, origin: appOrigin(req) };
  const messages: JsonRpcMessage[] = Array.isArray(body) ? body : [body];
  const responses = (await Promise.all(messages.map((m) => handleMessage(ctx, m)))).filter(Boolean);

  if (!responses.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0]);
}

// Sem SSE nem sessão: GET e DELETE não se aplicam no modo sem estado.
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}
