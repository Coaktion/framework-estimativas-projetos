/**
 * Leitor mínimo de .xlsx (sem dependências além do fflate para descompactar).
 *
 * Por que próprio: a biblioteca usada antes decodificava entidades numéricas com
 * String.fromCharCode e corrompia emojis (o identificador "06💻" virava lixo).
 * Aqui seguimos o mesmo comportamento do openpyxl(data_only=True) usado no
 * Python: valores em cache, textos compartilhados, rich text concatenado,
 * escapes _xHHHH_ e fim de linha normalizado para "\n".
 *
 * Funciona no navegador e no Node.
 */
import { unzipSync, strFromU8 } from 'fflate';
import type { Aba, Cell } from './planilha';

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Entidades XML, inclusive numéricas fora do BMP (emojis). */
function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e[0] !== '#') return ENT[e];
    const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
  });
}

/** Escapes do Excel para caracteres de controle: _x000D_ -> \r (o openpyxl desfaz igual). */
function unescapeExcel(s: string): string {
  return s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** Texto final de uma célula: entidades, escapes do Excel e fim de linha do XML. */
function texto(raw: string): string {
  return unescapeExcel(decodeXml(raw)).replace(/\r\n?/g, '\n');
}

/** Junta os <t> de um <si>/<is>, ignorando a guia fonética (<rPh>). */
function textoRico(xml: string): string {
  const semFonetica = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(semFonetica))) out += m[1] ?? '';
  return texto(out);
}

function attr(tag: string, nome: string): string | null {
  const m = new RegExp(`\\b${nome}="([^"]*)"`).exec(tag);
  return m ? decodeXml(m[1]) : null;
}

function colunaIdx(ref: string): number {
  let n = 0;
  const letras = ref.replace(/\d+/g, '');
  for (let i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
  return n - 1;
}

function numero(v: string): number | string {
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

function caminho(base: string, alvo: string): string {
  if (alvo.startsWith('/')) return alvo.slice(1);
  const partes = base.split('/').slice(0, -1);
  for (const p of alvo.split('/')) {
    if (p === '..') partes.pop();
    else if (p !== '.') partes.push(p);
  }
  return partes.join('/');
}

export function lerXlsx(bytes: Uint8Array): Aba[] {
  const arq = unzipSync(bytes);
  const ler = (p: string) => (arq[p] ? strFromU8(arq[p]) : '');

  const shared: string[] = [];
  const sst = ler('xl/sharedStrings.xml');
  for (const m of Array.from(sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g))) shared.push(textoRico(m[1] ?? ''));

  const rels: Record<string, string> = {};
  for (const m of Array.from(ler('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g))) {
    const id = attr(m[0], 'Id');
    const alvo = attr(m[0], 'Target');
    if (id && alvo) rels[id] = caminho('xl/workbook.xml', alvo);
  }

  const abas: Aba[] = [];
  for (const m of Array.from(ler('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g))) {
    const nome = attr(m[0], 'name') ?? '';
    const rid = attr(m[0], 'r:id');
    const xml = rid && rels[rid] ? ler(rels[rid]) : '';
    const linhas: Cell[][] = [];
    let ultimaLinha = 0;
    for (const rm of Array.from(xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g))) {
      const rAttr = attr(rm[0].slice(0, rm[0].indexOf('>') + 1), 'r');
      const rIdx = rAttr ? parseInt(rAttr, 10) - 1 : ultimaLinha;
      ultimaLinha = rIdx + 1;
      const linha: Cell[] = [];
      let proxCol = 0;
      for (const cm of Array.from((rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g))) {
        const abre = `<c${cm[1]}>`;
        const ref = attr(abre, 'r');
        const col = ref ? colunaIdx(ref) : proxCol;
        proxCol = col + 1;
        const t = attr(abre, 't');
        const corpo = cm[2] ?? '';
        const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
        let val: Cell = null;
        if (t === 's') val = v !== undefined ? shared[parseInt(v, 10)] ?? null : null;
        else if (t === 'inlineStr') val = textoRico(/<is>([\s\S]*?)<\/is>/.exec(corpo)?.[1] ?? '');
        else if (t === 'str') val = v !== undefined ? texto(v) : null;
        else if (t === 'b') val = v === '1';
        else if (t === 'e') val = v !== undefined ? texto(v) : null;
        else if (t === 'd') val = v !== undefined ? texto(v) : null;
        else if (v !== undefined) val = numero(texto(v));
        linha[col] = val;
      }
      for (let i = 0; i < linha.length; i++) if (linha[i] === undefined) linha[i] = null;
      linhas[rIdx] = linha;
    }
    const largura = Math.max(0, ...linhas.filter(Boolean).map((l) => l.length));
    const data: Cell[][] = [];
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i] ?? [];
      data.push(Array.from({ length: largura }, (_, c) => (l[c] === undefined ? null : l[c])));
    }
    abas.push({ sheet: nome, data });
  }
  return abas;
}
