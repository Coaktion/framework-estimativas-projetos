/**
 * Planilha (zd_auto_template) -> Blueprint. Porte fiel de mapper_xlsx.py.
 *
 * Recebe as abas já lidas (nome + matriz de células), então funciona igual no
 * navegador e no servidor; quem lê o .xlsx é o chamador. A planilha CONTÉM
 * tudo: a escolha do que provisionar é feita na tela, não aqui.
 */
import {
  ACCESSES, CHANNELS, FIELD_TYPES,
  type Access, type Blueprint, type Brand, type Channel, type CustomField, type FieldType,
  type GuideArticle, type Holiday, type Locale, type Schedule, type SLA, splitOpcoes,
} from './blueprint';

export type Cell = string | number | boolean | Date | null | undefined;
export type Aba = { sheet: string; data: Cell[][] };
type Row = Record<string, Cell>;

/** str() do Python, para manter o mesmo resultado do mapper original. */
function pyStr(v: Cell): string {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (v instanceof Date) return v.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  return String(v);
}

function vazio(v: Cell): boolean {
  return v === null || v === undefined || pyStr(v).trim() === '';
}

/** dict.get(chave, padrão): só usa o padrão se a COLUNA não existir. */
function get(row: Row, key: string, def: Cell = null): Cell {
  return key in row ? row[key] : def;
}

function sim(v: Cell): boolean {
  return ['S', 'SIM', 'TRUE', '1', 'Y'].includes(pyStr(v).trim().toUpperCase());
}

function toInt(v: Cell, def: number): number {
  if (v === null || v === undefined || v === '') return def;
  if (typeof v === 'number') return Math.trunc(v);
  const n = Number(String(v).trim());
  if (!Number.isFinite(n)) throw new Error(`valor numérico inválido: "${v}"`);
  return Math.trunc(n);
}

function linhas(aba: Aba): Row[] {
  const [cab = [], ...resto] = aba.data;
  const headers = cab.map((h) => (h === null || h === undefined ? 'None' : String(h)));
  const out: Row[] = [];
  for (const r of resto) {
    if (!r || r.every(vazio)) continue;
    const row: Row = {};
    headers.forEach((h, i) => { row[h] = r[i] ?? null; });
    out.push(row);
  }
  return out;
}

function enumVal<T extends string>(v: string, validos: readonly T[], oque: string): T {
  if ((validos as readonly string[]).includes(v)) return v as T;
  throw new Error(`${oque} inválido na planilha: "${v}" (aceitos: ${validos.join(', ')})`);
}

export function planilhaParaBlueprint(abas: Aba[]): Blueprint {
  const S = new Map(abas.map((a) => [a.sheet, a]));
  const aba = (n: string) => S.get(n);

  // ---- _Controle: só parâmetros (col0 = rótulo, col1 = valor) ----
  const params: Record<string, string> = {};
  for (const row of (aba('_Controle')?.data ?? []).slice(1)) {
    const label = row && row[0] ? String(row[0]).trim() : '';
    const val = row && row.length > 1 ? row[1] : null;
    if (label && val !== null && val !== undefined && val !== '') params[label] = pyStr(val).trim();
  }
  const idiomaRaw = params['Idioma da demo'] ?? 'pt-br';
  const idioma: Locale = (['pt-br', 'en-us', 'es'] as const).includes(idiomaRaw as Locale)
    ? (idiomaRaw as Locale) : 'pt-br';
  // identificador = número + emoji, SEM espaço (ex.: "056🛒")
  const identificador = (params['Identificador da demo'] ?? '').replace(/ /g, '');

  // ---- 0_Marca ----
  let marca: Brand | null = null;
  const am = aba('0_Marca');
  if (am) {
    const m = linhas(am)[0];
    if (m && get(m, 'Marca')) {
      marca = {
        criar: true,
        nome: pyStr(get(m, 'Marca', '')),
        subdominio: pyStr(get(m, 'Subdominio', '') || ''),
        tipo: pyStr(get(m, 'Tipo (simple/full)', 'full')),
      };
    }
  }

  // ---- 1_Grupos (ordenados pela coluna Ordem; vazio = 999) ----
  let grupos: { nome: string }[] = [];
  const ag = aba('1_Grupos');
  if (ag) {
    const ordem = (x: Row) => {
      const o = get(x, 'Ordem', 999);
      return (typeof o === 'number' ? o : Number(o)) || 999;
    };
    grupos = linhas(ag)
      .map((r, i) => ({ r, i }))
      .sort((a, b) => ordem(a.r) - ordem(b.r) || a.i - b.i)
      .filter(({ r }) => get(r, 'Grupo'))
      .map(({ r }) => ({ nome: pyStr(r['Grupo']) }));
  }

  // ---- campos (ticket / usuário / org) ----
  const campos = (nome: string): CustomField[] => {
    const a = aba(nome);
    if (!a) return [];
    const out: CustomField[] = [];
    for (const row of linhas(a)) {
      if ('Criar?' in row && !sim(row['Criar?'])) continue;
      const opc = 'Opcoes (se lista, por virgula)' in row
        ? row['Opcoes (se lista, por virgula)'] : get(row, 'Opcoes (se lista)', '');
      out.push({
        nome: pyStr(get(row, 'Nome do Campo', '')),
        tipo: enumVal<FieldType>(pyStr(get(row, 'Tipo', 'text')).trim(), FIELD_TYPES, 'Tipo de campo'),
        chave_ref: pyStr(get(row, 'Chave_ref', '')).trim(),
        opcoes: splitOpcoes(opc ? pyStr(opc) : ''),
        visivel_portal: sim(get(row, 'Visivel portal?', 'S')),
        nome_portal: get(row, 'Nome no portal') ? pyStr(row['Nome no portal']) : null,
      });
    }
    return out;
  };

  // ---- 2b_Condicionais ----
  const split = (s: Cell) => (s ? pyStr(s) : '').split(',').map((x) => x.trim()).filter(Boolean);
  const condicionais = linhas(aba('2b_Condicionais') ?? { sheet: '', data: [] })
    .filter((row) => sim(get(row, 'Criar?', 'S')))
    .map((row) => ({
      criar: true,
      campo_pai_ref: pyStr(get(row, 'Campo Pai (Chave_ref)', '')).trim(),
      quando_valor: pyStr(get(row, 'Quando valor for', '')).trim(),
      mostrar_refs: split(get(row, 'Mostrar campos (Chave_ref)')),
      obrigatorios_refs: split(get(row, 'Tornar obrigatorios (Chave_ref)')),
      publico: pyStr(get(row, 'Publico', 'ambos')).trim(),
    }));

  // ---- 3_Views ----
  const views = linhas(aba('3_Views') ?? { sheet: '', data: [] })
    .filter((row) => sim(get(row, 'Criar?', 'S')))
    .map((row) => ({
      criar: true,
      categoria: pyStr(get(row, 'Grupo (categoria visual)', '')),
      nome: pyStr(get(row, 'Nome da View', '')),
      criterio: pyStr(get(row, 'Definicao / criterio', '')),
    }));

  // ---- 4_Gatilhos_Padrao ----
  const gatilhos_padrao = linhas(aba('4_Gatilhos_Padrao') ?? { sheet: '', data: [] })
    .filter((row) => sim(get(row, 'Criar?', 'S')))
    .map((row) => ({
      criar: true,
      nome: pyStr(get(row, 'Nome do Gatilho', '')),
      canal: enumVal<Channel>(pyStr(get(row, 'Canal', 'web')).trim(), CHANNELS, 'Canal de gatilho'),
      grupo_destino: '__PRIMEIRO_GRUPO__',
      categoria: 'Roteamento',
      copilot: sim(get(row, 'Copilot?', 'N')),
    }));

  // ---- 8_Macros ----
  const opt = (row: Row, k: string) => (get(row, k) ? pyStr(row[k]) : null);
  const macros = linhas(aba('8_Macros') ?? { sheet: '', data: [] })
    .filter((row) => sim(get(row, 'Criar?', 'S')))
    .map((row) => ({
      criar: true,
      nome: pyStr(get(row, 'Nome', '')),
      mensagem: pyStr(get(row, 'Mensagem', '')),
      status_ticket: opt(row, 'Status ticket'),
      prioridade: opt(row, 'Prioridade'),
      publico: sim(get(row, 'Publico?', 'S')),
      grupo_visualizador: opt(row, 'Grupo visualizador'),
      grupo_destino: opt(row, 'Grupo destino'),
    }));

  // ---- 9_SLA ----
  let sla: SLA | null = null;
  const as = aba('9_SLA');
  if (as) {
    const s = linhas(as)[0];
    if (s) {
      const keys = ['urgent', 'high', 'normal', 'low'];
      const fr = ['Urgente 1a Resp (min)', 'Alta 1a Resp', 'Normal 1a Resp', 'Baixa 1a Resp'];
      const rs = ['Urgente Resol', 'Alta Resol', 'Normal Resol', 'Baixa Resol'];
      const mapa = (cols: string[]) => {
        const o: Record<string, number> = {};
        cols.forEach((c, i) => {
          const v = get(s, c);
          if (v !== null && v !== undefined) o[keys[i]] = toInt(v, 0);
        });
        return o;
      };
      sla = { criar: true, first_reply: mapa(fr), resolution: mapa(rs) };
    }
  }

  // ---- Guide ----
  const guide_secoes = linhas(aba('10_Guide_Secoes') ?? { sheet: '', data: [] })
    .filter((row) => sim(get(row, 'Criar?', 'S')))
    .map((row) => ({ criar: true, titulo: pyStr(get(row, 'Titulo', '')) }));
  const guide_artigos: GuideArticle[] = linhas(aba('10_Guide_Artigos') ?? { sheet: '', data: [] })
    .filter((row) => sim(get(row, 'Criar?', 'S')))
    .map((row) => ({
      criar: true,
      secao_titulo: pyStr(get(row, 'Secao (Titulo)', '')),
      titulo: pyStr(get(row, 'Titulo', '')),
      corpo: pyStr(get(row, 'Corpo', '')),
      acesso: enumVal<Access>(pyStr(get(row, 'Acesso', 'aberto')).trim(), ACCESSES, 'Acesso de artigo'),
    }));

  // ---- Programação + feriados ----
  let programacao: Schedule | null = null;
  const ap = aba('12_Programacao');
  if (ap) {
    const p = linhas(ap)[0];
    if (p && get(p, 'Nome')) {
      programacao = {
        criar: true,
        nome: pyStr(get(p, 'Nome', 'Comercial')),
        dia_inicio: pyStr(get(p, 'Dia inicio', 'seg')),
        dia_fim: pyStr(get(p, 'Dia fim', 'sex')),
        hora_inicio: toInt(get(p, 'Hora inicio', 8), 8),
        hora_fim: toInt(get(p, 'Hora fim', 18), 18),
        feriados_modo: pyStr(get(p, 'Feriados (normal/prolongado)')) || null,
      };
    }
  }
  const feriados: Holiday[] = linhas(aba('12_Feriados') ?? { sheet: '', data: [] })
    .filter((row) => get(row, 'Nome'))
    .map((row) => ({
      nome: pyStr(get(row, 'Nome', '')),
      ano: toInt(get(row, 'Ano', 2026), 2026),
      mes: toInt(get(row, 'Mes', 1), 1),
      dia_inicio: toInt(get(row, 'Dia inicio', 1), 1),
      dia_fim: toInt(get(row, 'Dia fim', 1), 1),
    }));

  // ---- _Guia_Apresentacao (artigo interno) ----
  let guia_apresentacao: GuideArticle | null = null;
  const aga = aba('_Guia_Apresentacao');
  if (aga) {
    const vals: Record<string, Cell> = {};
    for (const row of aga.data) {
      if (row && row[0]) vals[String(row[0]).trim().toLowerCase()] = row[1] ?? null;
    }
    const titulo = vals['titulo'] || vals['titulo (agente)'];
    const corpo = vals['corpo'];
    if (titulo && corpo && !pyStr(corpo).toLowerCase().includes('reservado')) {
      guia_apresentacao = {
        criar: true, secao_titulo: 'Guia de Apresentacao (interno)',
        titulo: pyStr(titulo), corpo: pyStr(corpo), acesso: 'agente',
      };
    }
  }

  // ---- _Lembretes, _Copilot, _AI_Agents (informativos) ----
  const titulo = (row: Row) => get(row, 'Titulo') || get(row, 'Título');
  const lembretes = linhas(aba('_Lembretes') ?? { sheet: '', data: [] })
    .filter((row) => titulo(row))
    .map((row) => ({ titulo: pyStr(titulo(row)), detalhe: pyStr(get(row, 'Detalhe', '') || '') }));
  const copilots = linhas(aba('_Copilot') ?? { sheet: '', data: [] })
    .filter((row) => titulo(row))
    .map((row) => ({
      titulo: pyStr(titulo(row)),
      quando_utilizar: pyStr(get(row, 'Quando utilizar', '') || ''),
      corpo: pyStr(get(row, 'Corpo', '') || ''),
    }));
  const ai_agents = linhas(aba('_AI_Agents') ?? { sheet: '', data: [] })
    .filter((row) => get(row, 'Nome'))
    .map((row) => ({
      nome: pyStr(row['Nome']),
      descricao: pyStr(('Descricao' in row ? row['Descricao'] : get(row, 'Descrição', '')) || ''),
      prompt: pyStr(get(row, 'Prompt', '') || ''),
    }));

  return {
    cliente: marca ? marca.nome : 'Demo',
    tag_prefix: params['Prefixo_TAG (global desta demo)'] ?? 'demo',
    identificador,
    idioma,
    guia_apresentacao,
    marca,
    grupos,
    campos_ticket: campos('2_Campos_Ticket'),
    condicionais,
    views,
    gatilhos_padrao,
    campos_usuario: campos('5_Campos_Usuario'),
    campos_org: campos('6_Campos_Org'),
    macros,
    sla,
    guide_secoes,
    guide_artigos,
    programacao,
    feriados,
    lembretes,
    copilots,
    ai_agents,
  };
}
