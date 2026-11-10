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
  // Anúncio avulso: o título do artigo é o nome da feature (na tradução, o
  // título em pt-br) — vira o `destaque`, que é o que o título do sinal usa.
  const brutos =
    m === 'release-note'
      ? parseReleaseNote(body)
      : [{ ...parseArtigoUnico({ title: artigo.title, body }), destaque: nomeDoAnuncio(artigo.title) }];
  return { nomeFonte, modo: m, brutos };
}

/** Primeira frase do texto (até o primeiro ". " / "! " / "? "). */
export function primeiraFrase(texto: string): string {
  const m = texto.match(/^(.+?[.!?])(\s|$)/);
  const frase = m ? m[1]! : texto;
  // frase curtíssima ("New.") não diz nada: fica o texto todo
  return frase.length >= 25 ? frase.replace(/\.$/, '') : texto;
}

/**
 * Etiquetas de status/edição que o Zendesk põe no nome e não fazem parte dele:
 * "(GA)", "(EAP)", "(beta)", "(Support)", "(paid)", "(pago)"…
 */
const RX_ETIQUETAS_NOME = /\s*\((ga|eap|beta|early access|legacy|support|suporte|soporte|paid|pago|free|gratuito|ai|ia)\)/gi;

/** Prefixos de anúncio que antecedem o nome da feature no título do artigo. */
const RX_PREFIXO_ANUNCIO =
  /^(announcing|announcement:|introducing|now available:|anúncio:?\s*(d[aeo]s?\s+)?|anunciando|apresentando|lançamento d[aeo]s?\s+|anuncio:?\s*(de\s+(la|los|las)\s+)?)\s*/i;

/** Nome limpo: sem etiquetas de status, sem ponto final, com inicial maiúscula. */
function limparNome(s: string): string {
  const limpo = s.replace(RX_ETIQUETAS_NOME, '').replace(/[.:;]\s*$/, '').trim();
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

/**
 * Sem nome explícito, o começo da primeira frase até a primeira pausa
 * (vírgula, travessão, dois-pontos, "que"/"which") — o trecho que diz O QUE é,
 * e não os detalhes. Curto demais, fica a frase inteira.
 */
export function nomeDaFrase(texto: string): string {
  // "Nome da feature: descrição" sem o negrito — o que vem antes dos dois-pontos é o nome
  const comNome = texto.match(/^([^:.!?]{10,80}):\s+\S/);
  if (comNome) return comNome[1]!.trim();
  const frase = primeiraFrase(texto);
  // frase curta já é o nome: cortar na vírgula só estraga listas ("o tom e o formato")
  if (frase.length <= 90) return frase;
  const rx = /,\s|\s[—–-]\s|:\s|\s(que|which|that|so that|para que|allowing|permitindo)\s/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(frase))) {
    if (m.index >= 40) return frase.slice(0, m.index);
  }
  return frase;
}

/**
 * O título do sinal é o NOME DA FEATURE, montado do mesmo jeito em qualquer
 * idioma, nunca "contexto: descrição" emendado. Em ordem de preferência:
 *
 *   1. o nome em negrito do bullet ("<strong>Nome</strong>: descrição"),
 *      o rótulo da feature que agrupa sub-itens, ou o título do anúncio;
 *   2. sem isso, o começo da primeira frase até a primeira pausa.
 *
 * Produto e componente não entram: aparecem como etiquetas na tela.
 */
export function tituloDoBruto(b: SinalBruto): string {
  const nome = b.destaque ? limparNome(b.destaque) : limparNome(nomeDaFrase(b.texto));
  return titulo(nome, 90);
}

/** Título de anúncio ("Announcing custom summaries…") → nome da feature. */
export function nomeDoAnuncio(tituloArtigo: string): string {
  return limparNome(tituloArtigo.replace(RX_PREFIXO_ANUNCIO, ''));
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
    destaque: b.nome,
  }));
}
