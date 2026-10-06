/**
 * Duplo em memória do PrismaClient — só os métodos que triage.ts e
 * activities.ts realmente chamam.
 *
 * Serve para testar as REGRAS (ordem dos impactos, herança de responsável,
 * criação de artefato órfão, gate do DoD, incremento de versão, registro da
 * aplicação, declarada vs verificada) sem precisar de banco.
 *
 * NÃO substitui o teste de integração: as consultas SQL de verdade só são
 * exercitadas rodando `prisma migrate dev` + os scripts no ambiente do portal.
 */

type Row = Record<string, unknown>;

let seq = 0;
const id = (p: string) => `${p}${String(++seq).padStart(6, '0')}`;

export interface Estado {
  sources: Row[];
  ingestRuns: Row[];
  rawItems: Row[];
  signals: Row[];
  triages: Row[];
  initiatives: Row[];
  activities: Row[];
  artifacts: Row[];
  studyNotes: Row[];
  artifactSignals: Row[];
}

/**
 * Defaults declarados no schema Prisma. O duplo precisa aplicá-los, senão os
 * testes passam a exercitar um objeto diferente do que o banco devolveria.
 */
const DEFAULTS: Record<keyof Estado, Row> = {
  sources: {
    ativo: true, isLiveArticle: false, locale: 'en-us',
    baseUrl: 'https://support.zendesk.com', watermark: null,
    ultimoRunEm: null, ultimoRunOk: null, ultimoRunErro: null,
  },
  ingestRuns: {
    ok: false, itensNovos: 0, itensAtualizados: 0,
    sinaisCriados: 0, sinaisArquivados: 0, erro: null, finalizadoEm: null,
  },
  rawItems: { secaoId: null, editadoEm: null, labels: [] },
  signals: { status: 'NOVO', impactosSugeridos: [], score: 0 },
  triages: { impactos: [], motivoDescarte: null, nota: null },
  initiatives: {},
  activities: {
    status: 'TODO', responsavelId: null, artifactId: null,
    concluidoEm: null, concluidoPor: null, criterioVerificavel: null,
  },
  artifacts: {
    donoId: null, versao: '1', modulo: null,
    revisaoDeclaradaEm: null, revisaoVerificadaEm: null, conferidoEm: null,
    fonteVerificacao: 'NENHUMA', fonteRef: null, fonteAssinatura: null,
    divergente: false, divergenciaDetalhe: null,
  },
  studyNotes: {
    linksConsultados: [], testadoEmSandbox: false, versao: 1,
    publicadoEm: null, autorId: null, activityId: null,
  },
  artifactSignals: { versaoResultante: null },
};

const casa = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (v !== null && typeof v === 'object' && 'in' in (v as Row)) {
      return ((v as { in: unknown[] }).in ?? []).includes(row[k]);
    }
    if (v !== null && typeof v === 'object' && 'not' in (v as Row)) {
      return row[k] !== (v as { not: unknown }).not;
    }
    if (v !== null && typeof v === 'object' && 'gte' in (v as Row)) {
      const a = row[k] as Date | number | null | undefined;
      const b = (v as { gte: Date | number }).gte;
      return a != null && +a >= +b;
    }
    return row[k] === v;
  });

export function criarFakePrisma(inicial?: Partial<Estado>) {
  const st: Estado = {
    sources: [],
    ingestRuns: [],
    rawItems: [],
    signals: [],
    triages: [],
    initiatives: [],
    activities: [],
    artifacts: [],
    studyNotes: [],
    artifactSignals: [],
    ...inicial,
  };

  const tabela = (nome: keyof Estado, prefixo: string) => ({
    async findUnique({ where, include }: { where: Row; include?: Row }) {
      const w = achatarWhere(where);
      const row = st[nome].find((r) => casaComRelacao(r, w)) ?? null;
      return row ? expandir(row, include) : null;
    },
    async findFirst({ where }: { where: Row }) {
      return st[nome].find((r) => casaComRelacao(r, achatarWhere(where))) ?? null;
    },
    async findMany({ where }: { where?: Row } = {}) {
      return where ? st[nome].filter((r) => casaComRelacao(r, achatarWhere(where))) : [...st[nome]];
    },
    async count({ where }: { where?: Row } = {}) {
      return (where ? st[nome].filter((r) => casaComRelacao(r, achatarWhere(where))) : st[nome]).length;
    },
    async create({ data }: { data: Row }) {
      const row = { id: id(prefixo), ...DEFAULTS[nome], ...data };
      st[nome].push(row);
      return row;
    },
    async update({ where, data }: { where: Row; data: Row }) {
      const w = achatarWhere(where);
      const row = st[nome].find((r) => casa(r, w));
      if (!row) throw new Error(`${nome}: registro não encontrado`);
      Object.assign(row, data);
      return row;
    },
    async upsert({ where, create, update }: { where: Row; create: Row; update: Row }) {
      const w = achatarWhere(where);
      const row = st[nome].find((r) => casa(r, w));
      if (row) {
        Object.assign(row, update);
        return row;
      }
      const novo = { id: id(prefixo), ...DEFAULTS[nome], ...create };
      st[nome].push(novo);
      return novo;
    },
  });

  /**
   * Traduz o `where` do Prisma para um objeto plano:
   *   · chave composta  { a_b_c: { a, b, c } }  → { a, b, c }
   *   · relação         { rawItem: { sourceId } } → { __rawItem_sourceId }
   *     (resolvido em `casa` via os campos do registro pai)
   */
  function achatarWhere(where: Row): Row {
    const saida: Row = {};
    for (const [k, v] of Object.entries(where)) {
      if (k === 'rawItem' && v && typeof v === 'object') {
        // filtra sinais pelos campos do RawItem pai
        const cond = v as Row;
        saida.__viaRawItem = cond;
      } else if (v && typeof v === 'object' && k.includes('_')) {
        Object.assign(saida, v as Row);
      } else {
        saida[k] = v;
      }
    }
    return saida;
  }

  /** Resolve o filtro por relação rawItem antes de comparar. */
  function casaComRelacao(row: Row, where: Row): boolean {
    const { __viaRawItem, ...resto } = where;
    if (__viaRawItem) {
      const pai = st.rawItems.find((r) => r.id === row.rawItemId);
      if (!pai || !casa(pai, __viaRawItem as Row)) return false;
    }
    return casa(row, resto);
  }

  /** só o include que os serviços usam: artifact e initiative.signalId */
  function expandir(row: Row, include?: Row): Row {
    if (!include) return row;
    const out: Row = { ...row };
    if (include.artifact) {
      out.artifact = st.artifacts.find((a) => a.id === row.artifactId) ?? null;
    }
    if (include.initiative) {
      const ini = row.initiativeId
        ? st.initiatives.find((i) => i.id === row.initiativeId)          // activity → initiative
        : st.initiatives.find((i) => i.signalId === row.id);             // signal ← initiative (reversa)
      out.initiative = ini ? { signalId: ini.signalId, id: ini.id } : null;
    }
    return out;
  }

  const client = {
    estado: st,
    psOpsSource: tabela('sources', 'src'),
    psOpsIngestRun: tabela('ingestRuns', 'run'),
    psOpsRawItem: tabela('rawItems', 'raw'),
    psOpsSignal: tabela('signals', 'sig'),
    psOpsTriage: tabela('triages', 'tri'),
    psOpsInitiative: tabela('initiatives', 'ini'),
    psOpsActivity: tabela('activities', 'act'),
    psOpsArtifact: tabela('artifacts', 'art'),
    psOpsStudyNote: tabela('studyNotes', 'stn'),
    psOpsArtifactSignal: tabela('artifactSignals', 'aps'),
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      // sem rollback: os testes verificam o caminho felizes e as validações,
      // que acontecem antes da transação
      return fn(client);
    },
  };

  return client;
}

export function semearSinal(
  fake: ReturnType<typeof criarFakePrisma>,
  over?: Partial<Row>,
): Row {
  const sinal: Row = {
    id: id('sig'),
    titulo: 'Voice AI agents disponível em GA',
    modulo: 'VOICE',
    tipo: 'GA',
    status: 'NOVO',
    criadoEm: new Date('2026-08-11T00:00:00Z'),
    ...over,
  };
  fake.estado.signals.push(sinal);
  return sinal;
}

export function semearArtefato(
  fake: ReturnType<typeof criarFakePrisma>,
  over: Partial<Row> & { chave: string },
): Row {
  const art: Row = {
    id: id('art'),
    tipo: 'FRAMEWORK',
    modulo: 'VOICE',
    nome: 'Framework · Voice',
    donoId: null,
    versao: '2026.Q2',
    revisaoDeclaradaEm: null,
    revisaoVerificadaEm: null,
    conferidoEm: null,
    fonteVerificacao: 'NENHUMA',
    fonteRef: null,
    fonteAssinatura: null,
    divergente: false,
    ...over,
  };
  fake.estado.artifacts.push(art);
  return art;
}
