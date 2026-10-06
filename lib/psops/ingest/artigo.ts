/**
 * Do artigo do Help Center aos sinais brutos.
 *
 * Fica separado do coletor porque três caminhos precisam da MESMA quebra:
 * a coleta, a reclassificação (que reprocessa a camada crua) e a tradução
 * (que quebra a versão pt-br e casa bullet a bullet pela âncora). Se cada um
 * quebrasse do seu jeito, as âncoras não bateriam.
 */
import { SECTION_NAMES } from '../config/sources';
import { parseArtigoEap, parseArtigoUnico, parseReleaseNote, titulo, type SinalBruto } from './parser';

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

/** O título do sinal, montado do mesmo jeito em qualquer idioma. */
export function tituloDoBruto(b: SinalBruto): string {
  return titulo(b.grupoComponente ? `${b.grupoComponente}: ${b.texto}` : b.texto);
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
