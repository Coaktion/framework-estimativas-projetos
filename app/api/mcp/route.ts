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
  simulateInput, simulateEstimate,
  estimateInput, createEstimateVersion,
  getVersionInput, getVersion,
} from '@/lib/toolcenter';
import {
  scopingToolsEnabled,
  listTracksInput, scopingListTracks,
  searchSessionsInput, scopingSearchSessions,
  createSessionInput, scopingCreateSession,
  getSessionInput, scopingGetSession,
  proposeInput, scopingProposeAnswers,
  setPendingInput, scopingSetPending,
  sessionIdInput, scopingPreviewEstimate, scopingGetNotes,
  exportInput, scopingExport,
  appendNotesInput, scopingAppendNotes,
} from '@/lib/toolcenter-scoping';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SERVER_INFO = { name: 'aktienow-toolcenter', title: 'Aktie Now Tool Center', version: '1.0.0' };
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = [
  'Tool Center da Aktie Now: catálogo de itens do Framework de estimativas e projetos de escopo.',
  'Fluxo para estimar um escopo novo: (1) search_projects para não duplicar o cliente;',
  '(2) get_catalog para escolher itens e quantidades SÓ entre os itens existentes (use os ids);',
  '(3) simulate_estimate para conferir totais e avisos (não grava; o projeto é opcional);',
  '(4) create_project se o cliente ainda não tiver projeto; (5) create_estimate_version para salvar a versão nova.',
  'Nenhuma ferramenta altera ou apaga versões existentes. Responda ao usuário com o link da versão.',
  ...(scopingToolsEnabled ? [
    'Scoping a partir de uma gravação: (1) leia a transcrição com as ferramentas de reunião que você tiver;',
    '(2) scoping_search_sessions (ou scoping_create_session) para achar a sessão; (3) scoping_get_session (sem onlyOpen, para ver também o que o pré-vendas já anotou) e scoping_get_notes;',
    '(4) scoping_propose_answers só com o que o cliente disse, cada proposta com citação literal e o minuto; para pergunta já respondida, proponha só o que falta (mode complement);',
    '(4b) scoping_append_notes com o que não cabe em nenhuma pergunta;',
    '(5) scoping_set_pending para o que ficou de o cliente confirmar; (6) responda com o link de revisão e a lista de reuniões usadas.',
    'Propostas nunca viram resposta sozinhas: o pré-vendas revisa no Tool Center.',
  ] : []),
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

/**
 * Campos do conteúdo de uma estimativa — os mesmos em simulate_estimate e
 * create_estimate_version (ver estimateFields em lib/toolcenter.ts).
 */
const ESTIMATE_PROPERTIES: Record<string, unknown> = {
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
};

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
    name: 'simulate_estimate',
    title: 'Simular estimativa',
    description: 'Calcula uma estimativa SEM gravar nada, com o mesmo cálculo do editor: totais por skill e por módulo, Discovery/Validação/GP e avisos de itens que não contam (plano, dependência, item oculto). O projeto é opcional: dá para simular antes de criá-lo.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'integer', description: 'Opcional: projeto em que a versão seria salva.' },
        ...ESTIMATE_PROPERTIES,
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    input: simulateInput,
    run: simulateEstimate,
  },
  {
    name: 'create_estimate_version',
    title: 'Criar versão de estimativa',
    description: 'GRAVA uma NOVA versão (V1, V2...) da estimativa de um projeto, com o mesmo cálculo do editor, e devolve totais, avisos e o link. Antes, confira o resultado com simulate_estimate (mesmos campos, não grava).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'integer' },
        description: {
          type: 'string',
          maxLength: 120,
          description: 'Título CURTO da versão (até 120 caracteres), que aparece no seletor de versões do editor. Ex.: "Cenário A — sem saneamento retroativo" ou "Sugestão inicial da discovery de 28/10". Premissas e detalhes do escopo vão no documento, não aqui.',
        },
        ...ESTIMATE_PROPERTIES,
        technicalScopeLink: { type: 'string', description: 'Link do documento de escopo técnico, se já existir.' },
        zohoLink: { type: 'string', description: 'Link do deal no Zoho CRM.' },
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
// Scoping (lib/toolcenter-scoping.ts): só onde o módulo está ligado
// ---------------------------------------------------------------------------

const LANG_PROP = { type: 'string', enum: ['pt', 'en', 'es'], description: 'Idioma dos textos. Padrão: o da sessão.' };
const SESSION_PROP = { type: 'string', description: 'sessionId (de scoping_search_sessions ou scoping_create_session).' };

const SCOPING_TOOLS: Tool[] = [
  {
    name: 'scoping_list_tracks',
    title: 'Scoping: trilhas e etapas',
    description: 'Trilhas do banco de perguntas (núcleo, produtos, casos de uso, segmentos), os portes da oportunidade (P, M, G) e as etapas do roteiro da reunião.',
    inputSchema: { type: 'object', properties: { language: LANG_PROP }, additionalProperties: false },
    annotations: READ_ONLY,
    input: listTracksInput,
    run: scopingListTracks,
  },
  {
    name: 'scoping_search_sessions',
    title: 'Scoping: buscar sessões',
    description: 'Sessões de scoping pelo nome do cliente ou título (as 20 mais recentes sem filtro). Use antes de criar, para não duplicar.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Parte do nome do cliente ou do título.' } }, additionalProperties: false },
    annotations: READ_ONLY,
    input: searchSessionsInput,
    run: scopingSearchSessions,
  },
  {
    name: 'scoping_create_session',
    title: 'Scoping: criar sessão',
    description: 'Cria uma sessão de scoping para um cliente. Só crie se scoping_search_sessions não encontrar uma.',
    inputSchema: {
      type: 'object',
      properties: {
        clientName: { type: 'string' },
        title: { type: 'string', description: 'Ex.: "Reunião de scoping 1".' },
        language: { type: 'string', enum: ['pt', 'en', 'es'], description: 'Idioma das perguntas. Padrão: pt.' },
        deploymentType: { type: 'string', enum: ['new', 'optimization'] },
        sku: { type: 'string', enum: ['CS', 'ES'] },
        plan: { type: 'string', enum: ['team', 'growth', 'professional', 'enterprise'] },
        tier: { type: 'string', enum: ['P', 'M', 'G'], description: 'Porte da oportunidade: P até 30 agentes; M 30 a 150; G acima de 150, vários produtos, migração ou ITSM. Padrão: M.' },
        trackKeys: { type: 'array', items: { type: 'string' }, description: 'Trilhas além do núcleo (keys de scoping_list_tracks).' },
      },
      required: ['clientName'],
      additionalProperties: false,
    },
    annotations: CREATES,
    input: createSessionInput,
    run: scopingCreateSession,
  },
  {
    name: 'scoping_get_session',
    title: 'Scoping: perguntas da sessão',
    description: 'Perguntas ativas da sessão com key, etapa, porte, texto, tipo, opções, unidade, colunas, itens do catálogo, resposta atual, status e origem. Com onlyOpen=true, só as que não estão respondidas: é o ponto de partida para propor respostas a partir de uma gravação.',
    inputSchema: { type: 'object', properties: { sessionId: SESSION_PROP, language: LANG_PROP, onlyOpen: { type: 'boolean' } }, required: ['sessionId'], additionalProperties: false },
    annotations: READ_ONLY,
    input: getSessionInput,
    run: scopingGetSession,
  },
  {
    name: 'scoping_propose_answers',
    title: 'Scoping: propor respostas',
    description: 'Grava PROPOSTAS de resposta tiradas de uma gravação ou das notas, inclusive para COMPLEMENTAR perguntas que o pré-vendas já respondeu (mode complement: proponha só o que falta, sem repetir o que já está anotado). Nada vira resposta: um humano aceita, edita ou rejeita na aba "Para revisar". Cada proposta precisa de citação literal (source.quote); sem ela é recusada. Proponha só o que o cliente disse de fato, no formato do tipo da pergunta (valueFormats de scoping_get_session). Não chute contagens de configuração (gatilhos, macros etc.) que o cliente não falou.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: SESSION_PROP,
        proposals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              questionKey: { type: 'string' },
              value: { description: 'Valor no formato do tipo da pergunta.' },
              note: { type: 'string', description: 'Comentário que acompanha a resposta (ex.: contexto, ressalva).' },
              confidence: { type: 'string', enum: ['alta', 'media', 'baixa'] },
              rationale: { type: 'string', description: 'Por que esta resposta, em uma frase.' },
              mode: { type: 'string', enum: ['complement', 'replace'], description: 'complement (padrão quando já há resposta): junta com o que o pré-vendas anotou (texto acrescentado, opções e linhas somadas). replace: substitui, use só se a gravação contradiz a anotação, e diga isso no rationale.' },
              source: {
                type: 'object',
                properties: {
                  provider: { type: 'string', enum: ['tldv', 'claude_meetings', 'notes', 'other'] },
                  meetingTitle: { type: 'string' },
                  meetingDate: { type: 'string', description: 'AAAA-MM-DD' },
                  url: { type: 'string', description: 'Link da gravação (de preferência já no minuto do trecho).' },
                  timestamp: { type: 'string', description: 'Minuto do trecho, ex.: "00:23:41".' },
                  quote: { type: 'string', description: 'Citação literal da transcrição. Obrigatória.' },
                },
                required: ['provider', 'quote'],
                additionalProperties: false,
              },
            },
            required: ['questionKey', 'value', 'confidence', 'source'],
            additionalProperties: false,
          },
        },
      },
      required: ['sessionId', 'proposals'],
      additionalProperties: false,
    },
    annotations: CREATES,
    input: proposeInput,
    run: scopingProposeAnswers,
  },
  {
    name: 'scoping_set_pending',
    title: 'Scoping: marcar pendência',
    description: 'Marca uma pergunta como pendente, com dono e prazo (ex.: "o cliente vai confirmar com a TI até sexta"). Não age sobre pergunta já respondida.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: SESSION_PROP,
        questionKey: { type: 'string' },
        owner: { type: 'string', description: 'Pessoa ou área do cliente ou da Aktie.' },
        dueDate: { type: 'string', description: 'AAAA-MM-DD' },
        note: { type: 'string' },
      },
      required: ['sessionId', 'questionKey', 'owner', 'dueDate'],
      additionalProperties: false,
    },
    annotations: CREATES,
    input: setPendingInput,
    run: scopingSetPending,
  },
  {
    name: 'scoping_append_notes',
    title: 'Scoping: complementar as notas',
    description: 'Acrescenta um bloco ao fim das notas da sessão (nunca apaga): o que a gravação trouxe e não cabe em nenhuma pergunta, como participantes e cargos, contexto do negócio e próximos passos combinados. Não repita o que já está nas notas (veja scoping_get_notes).',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: SESSION_PROP,
        text: { type: 'string' },
        sourceLabel: { type: 'string', description: 'Ex.: "tl;dv · Discovery 24/11".' },
      },
      required: ['sessionId', 'text'],
      additionalProperties: false,
    },
    annotations: CREATES,
    input: appendNotesInput,
    run: scopingAppendNotes,
  },
  {
    name: 'scoping_preview_estimate',
    title: 'Scoping: simular horas',
    description: 'Simula as horas com as respostas ACEITAS da sessão, no mesmo motor do simulate_estimate. Não grava nada.',
    inputSchema: { type: 'object', properties: { sessionId: SESSION_PROP }, required: ['sessionId'], additionalProperties: false },
    annotations: READ_ONLY,
    input: sessionIdInput,
    run: scopingPreviewEstimate,
  },
  {
    name: 'scoping_get_notes',
    title: 'Scoping: notas da reunião',
    description: 'Notas livres que o pré-vendas escreveu na sessão. Úteis para propor respostas (provider "notes").',
    inputSchema: { type: 'object', properties: { sessionId: SESSION_PROP }, required: ['sessionId'], additionalProperties: false },
    annotations: READ_ONLY,
    input: sessionIdInput,
    run: scopingGetNotes,
  },
  {
    name: 'scoping_export',
    title: 'Scoping: exportar',
    description: 'A sessão em Markdown (respostas, status e pendências), e o link do .xlsx no formato do template.',
    inputSchema: { type: 'object', properties: { sessionId: SESSION_PROP, language: LANG_PROP }, required: ['sessionId'], additionalProperties: false },
    annotations: READ_ONLY,
    input: exportInput,
    run: scopingExport,
  },
];

const ALL_TOOLS: Tool[] = scopingToolsEnabled ? [...TOOLS, ...SCOPING_TOOLS] : TOOLS;

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
  const tool = ALL_TOOLS.find((t) => t.name === params?.name);
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
        tools: ALL_TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })),
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
