/**
 * Os cálculos das abas Resumo e Relatório da planilha de estudos, em funções
 * puras (sem banco), para a tela e para os testes.
 *
 * Datas de registro são "AAAA-MM-DD" (dia, sem hora). A semana é a segunda-
 * feira daquela data, como na planilha.
 */

export const NIVEIS = [0, 1, 2, 3, 4] as const;

/** Cores da matriz, iguais às da planilha (0 cinza → 4 verde). */
export const COR_NIVEL: Record<number, string> = {
  0: '#F2F2F2',
  1: '#F8C9C9',
  2: '#FCE9B0',
  3: '#CDFFB5',
  4: '#7FD171',
};

export const PRIORIDADES = ['Alta', 'Média', 'Baixa'] as const;
export const COR_PRIORIDADE: Record<string, { fundo: string; texto: string }> = {
  Alta: { fundo: '#F87171', texto: '#FFFFFF' },
  Média: { fundo: '#FCE9B0', texto: '#1A1A1A' },
  Baixa: { fundo: '#CDFFB5', texto: '#1A1A1A' },
};

export const TIPOS_ATIVIDADE = [
  'Certificação', 'Curso', 'Demo/POC', 'Documentação', 'Doc + Lab',
  'Hands-on/Lab', 'Mentoria', 'Projeto real', 'Webinar', 'Outro',
] as const;

/** Escala de cor do Resumo: 0 vermelho, 2 amarelo, 4 verde (interpolado). */
export function corEscala(v: number | null): string | undefined {
  if (v === null || Number.isNaN(v)) return undefined;
  const pontos: Array<[number, [number, number, number]]> = [
    [0, [0xf8, 0x71, 0x71]],
    [2, [0xfc, 0xe9, 0xb0]],
    [4, [0x7f, 0xd1, 0x71]],
  ];
  const x = Math.max(0, Math.min(4, v));
  const [a, b] = x <= 2 ? [pontos[0]!, pontos[1]!] : [pontos[1]!, pontos[2]!];
  const f = (x - a[0]) / (b[0] - a[0]);
  const c = a[1].map((ca, i) => Math.round(ca + (b[1][i]! - ca) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const media = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

// ─────────────────────────────── Resumo ─────────────────────────────────────

export interface TopicoCalc {
  id: string;
  categoria: string;
  nivelAlvo: number | null;
}
export interface NivelCalc {
  topicoId: string;
  userId: number;
  nivel: number;
}

export interface LinhaResumo {
  categoria: string;
  /** média de cada pessoa na categoria (null = nenhum nível preenchido) */
  porPessoa: Record<number, number | null>;
  /** média das médias das pessoas */
  mediaCategoria: number | null;
  alvoMedio: number | null;
  /** alvo − média; null sem alvo */
  gap: number | null;
}

export function calcularResumo(
  topicos: TopicoCalc[],
  niveis: NivelCalc[],
  pessoas: number[],
): { linhas: LinhaResumo[]; geral: LinhaResumo } {
  const nivelDe = new Map(niveis.map((n) => [`${n.topicoId}:${n.userId}`, n.nivel]));
  const categorias = Array.from(new Set(topicos.map((t) => t.categoria)));

  const linha = (categoria: string, doGrupo: TopicoCalc[]): LinhaResumo => {
    const porPessoa: Record<number, number | null> = {};
    for (const p of pessoas) {
      const vs = doGrupo
        .map((t) => nivelDe.get(`${t.id}:${p}`))
        .filter((v): v is number => typeof v === 'number');
      porPessoa[p] = media(vs);
    }
    const mediaCategoria = media(Object.values(porPessoa).filter((v): v is number => v !== null));
    const alvoMedio = media(doGrupo.map((t) => t.nivelAlvo).filter((v): v is number => v !== null));
    const gap = alvoMedio !== null && mediaCategoria !== null ? alvoMedio - mediaCategoria : null;
    return { categoria, porPessoa, mediaCategoria, alvoMedio, gap };
  };

  return {
    linhas: categorias.map((c) => linha(c, topicos.filter((t) => t.categoria === c))),
    geral: linha('MÉDIA GERAL', topicos),
  };
}

// ────────────────────────────── Relatório ───────────────────────────────────

export interface RegistroCalc {
  userId: number;
  /** AAAA-MM-DD */
  data: string;
  categoria: string | null;
  tipo: string | null;
}

const DIA = 86_400_000;
const paraUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const paraIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Segunda-feira da semana da data (AAAA-MM-DD). */
export function segundaDaSemana(iso: string): string {
  const ms = paraUtc(iso);
  const dia = new Date(ms).getUTCDay() || 7; // domingo = 7
  return paraIso(ms - (dia - 1) * DIA);
}

export interface LinhaPessoa {
  userId: number | 'TIME';
  treinamentos: number;
  semanasComRegistro: number;
  pctSemanas: number;
  mediaPorSemana: number;
  ultimos30: number;
  ultimoRegistro: string | null;
  diasSemRegistrar: number | null;
}

export interface Relatorio {
  primeiraSemana: string | null;
  semanaAtual: string;
  semanas: number;
  total: number;
  porPessoa: LinhaPessoa[];
  tipos: string[];
  porTipo: Array<{ userId: number | 'TIME'; contagem: Record<string, number> }>;
  porCategoria: Array<{ categoria: string; porPessoa: Record<number, number>; time: number }>;
  /** da semana atual para trás, uma linha por semana */
  porSemana: Array<{ semana: string; porPessoa: Record<number, number>; time: number }>;
}

export function calcularRelatorio(
  registros: RegistroCalc[],
  pessoas: number[],
  categorias: string[],
  hoje: string,
): Relatorio {
  const semanaAtual = segundaDaSemana(hoje);
  const primeiraSemana = registros.length
    ? segundaDaSemana(registros.map((r) => r.data).sort()[0]!)
    : null;
  const semanas = primeiraSemana
    ? Math.round((paraUtc(semanaAtual) - paraUtc(primeiraSemana)) / (7 * DIA)) + 1
    : 0;
  const limite30 = paraUtc(hoje) - 30 * DIA;

  const linhaDe = (userId: number | 'TIME', rs: RegistroCalc[]): LinhaPessoa => {
    const semanasCom = new Set(rs.map((r) => segundaDaSemana(r.data))).size;
    const ultimo = rs.length ? rs.map((r) => r.data).sort().slice(-1)[0]! : null;
    return {
      userId,
      treinamentos: rs.length,
      semanasComRegistro: semanasCom,
      pctSemanas: semanas ? semanasCom / semanas : 0,
      mediaPorSemana: semanas ? rs.length / semanas : 0,
      ultimos30: rs.filter((r) => paraUtc(r.data) >= limite30).length,
      ultimoRegistro: ultimo,
      diasSemRegistrar: ultimo ? Math.round((paraUtc(hoje) - paraUtc(ultimo)) / DIA) : null,
    };
  };
  const de = (p: number) => registros.filter((r) => r.userId === p);

  const tipos = Array.from(new Set(registros.map((r) => r.tipo).filter((t): t is string => Boolean(t)))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
  const contarTipos = (rs: RegistroCalc[]) =>
    Object.fromEntries(tipos.map((t) => [t, rs.filter((r) => r.tipo === t).length]));

  const porSemana: Relatorio['porSemana'] = [];
  for (let i = 0; i < semanas; i++) {
    const semana = paraIso(paraUtc(semanaAtual) - i * 7 * DIA);
    const daSemana = registros.filter((r) => segundaDaSemana(r.data) === semana);
    porSemana.push({
      semana,
      porPessoa: Object.fromEntries(pessoas.map((p) => [p, daSemana.filter((r) => r.userId === p).length])),
      time: daSemana.length,
    });
  }

  return {
    primeiraSemana,
    semanaAtual,
    semanas,
    total: registros.length,
    porPessoa: [...pessoas.map((p) => linhaDe(p, de(p))), linhaDe('TIME', registros)],
    tipos,
    porTipo: [
      ...pessoas.map((p) => ({ userId: p, contagem: contarTipos(de(p)) })),
      { userId: 'TIME' as const, contagem: contarTipos(registros) },
    ],
    porCategoria: categorias.map((c) => {
      const daCat = registros.filter((r) => r.categoria === c);
      return {
        categoria: c,
        porPessoa: Object.fromEntries(pessoas.map((p) => [p, daCat.filter((r) => r.userId === p).length])),
        time: daCat.length,
      };
    }),
    porSemana,
  };
}
