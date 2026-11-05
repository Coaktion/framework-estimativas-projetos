/**
 * Do artigo do Help Center aos sinais brutos.
 *
 * Fica separado do coletor porque três caminhos precisam da MESMA quebra:
 * a coleta, a reclassificação (que reprocessa a camada crua) e a tradução
 * (que quebra a versão pt-br e casa bullet a bullet pela âncora). Se cada um
 * quebrasse do seu jeito, as âncoras não bateriam.
 */
import { SECTION_NAMES } from '../config/sources';
import { parseArtigoEap, parseArtigoUnico, parseReleaseNote, titulo, RX_MARCADOR, type SinalBruto } from './parser';

export function nomeFonteDoArtigo(secaoId: number | string | null, fonteNome: string): string {
  if (secaoId && SECTION_NAMES[String(secaoId)]) return SECTION_NAMES[String(secaoId)]!;
  return fonteNome;
}

export const ehReleaseNote = (fonte: string, tituloArtigo: string) =>
  /release notes/i.test(fonte) || /^release notes/i.test(tituloArtigo);

export type ModoQuebra = 'release-note' | 'artigo-unico';

/**
 * Release note vira um sinal por bullet; o resto, um sinal por artigo.
 *
 * `modo` existe para a tradução: o título em português ("Notas da versão…")
 * não casa com /release notes/, então a versão pt-br tem de ser quebrada no
 * MESMO modo que a original decidiu — senão as âncoras nunca batem.
 */
export function brutosDoArtigo(
  artigo: { title: string; body: string | null; section_id: number | string | null },
  fonteNome: string,
  modo?: ModoQuebra,
): { nomeFonte: string; modo: ModoQuebra; brutos: SinalBruto[] } {
  const nomeFonte = nomeFonteDoArtigo(artigo.section_id, fonteNome);
  const body = artigo.body ?? '';
  const m: ModoQuebra =
    modo ?? (ehReleaseNote(nomeFonte, artigo.title) ? 'release-note' : 'artigo-unico');
  const brutos =
    m === 'release-note' ? parseReleaseNote(body) : [parseArtigoUnico({ title: artigo.title, body })];
  return { nomeFonte, modo: m, brutos };
}

const normalizar = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase();

/** Primeira frase do texto (até o primeiro ". " / "! " / "? "). */
export function primeiraFrase(texto: string): string {
  const m = texto.match(/^(.+?[.!?])(\s|$)/);
  const frase = m ? m[1]! : texto;
  // frase curtíssima ("New.") não diz nada: fica o texto todo
  return frase.length >= 25 ? frase.replace(/\.$/, '') : texto;
}

/**
 * O título do sinal, montado do mesmo jeito em qualquer idioma:
 *
 *   [contexto: ] nome em negrito  — ou —  [contexto: ] primeira frase
 *
 * Contexto = o rótulo do grupo ("Rastro for Bling (Support) (paid)") ou o
 * componente ("Web Crawler"), quando dizem algo além do produto (que já
 * aparece como etiqueta) e não são só "New"/"Fixed".
 */
export function tituloDoBruto(b: SinalBruto): string {
  const corpo = b.destaque || primeiraFrase(b.texto);
  const candidatos = [b.rotulo, b.grupoComponente];
  const contexto = candidatos.find(
    (c) =>
      c &&
      !RX_MARCADOR.test(c.trim()) &&
      normalizar(c) !== normalizar(b.grupoProduto) &&
      !normalizar(corpo).startsWith(normalizar(c)),
  );
  return titulo(contexto ? `${contexto}: ${corpo}` : corpo, 110);
}

/** Blocos do artigo-vivo (lista de EAPs) no mesmo formato de sinal bruto. */
export function brutosDoArtigoVivo(body: string | null): SinalBruto[] {
  return parseArtigoEap(body ?? '').map((b) => ({
    ancora: b.ancora,
    assinatura: b.assinatura,
    grupoProduto: b.categoria,
    grupoComponente: b.nome,
    texto: `${b.nome}. ${b.descricao}`,
    links: b.links,
  }));
}
