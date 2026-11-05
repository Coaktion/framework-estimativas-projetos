/**
 * Parser: quebra o artigo em SINAIS ATÔMICOS.
 *
 * Esta é a decisão estrutural que sustenta o mecanismo. Uma release note do
 * Zendesk carrega de 30 a 60 mudanças; triar "a release note" como um item
 * produz card genérico, ninguém sabe o que é done, e o processo morre na
 * terceira semana.
 *
 * Estrutura das release notes — dois formatos convivem:
 *
 *   até set/2026                          a partir de out/2026
 *   <h2>  Produto                         <h2>  Produto
 *     <h4>  Componente (ou New/Fixed)       <p><strong>New</strong></p>  (ou Fixed)
 *       <ul><li>  Mudança                   <h3>  Componente
 *                                             <ul><li><strong>Rótulo</strong>
 *                                                   <ul><li>  Mudança
 *
 * 1 bullet = 1 SINAL. No formato novo, o bullet que só agrupa (rótulo + lista
 * dentro) não é sinal: cada filho é, com o rótulo como contexto do título.
 * Fica fora: o índice antes do primeiro H2 ("This week's release notes
 * include") e a seção "Products with no updates this week".
 *
 * Announcements, What's new e Developer updates vêm atômicos: 1 artigo = 1 sinal.
 */

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { hashConteudo } from '../lib/hash';

export interface SinalBruto {
  /** posição estável no documento: "2.1.3" = 3º bullet do 1º H4 do 2º H2 */
  ancora: string;
  /** hash do conteúdo — dedupe entre versões editadas do mesmo artigo */
  assinatura: string;
  /** texto do H2 (produto), quando existir */
  grupoProduto: string | null;
  /** texto do H4 (componente ou "New"/"Fixed") — ou do H3, no formato novo */
  grupoComponente: string | null;
  /** o texto da mudança, já limpo */
  texto: string;
  /** links citados no bullet — entram na ficha de estudo */
  links: string[];
  /** "New", "Fixed"… — no formato novo vem num <p><strong>, no antigo é o H4 */
  marcador?: string | null;
  /** rótulo do bullet que agrupa este (ex.: "Rastro for Bling (Support) (paid)") */
  rotulo?: string | null;
  /** nome em negrito que abre o bullet ("<strong>Nome</strong>: descrição") */
  destaque?: string | null;
}

/** Cabeçalhos que dizem o tipo da mudança, e não o componente. */
export const RX_MARCADOR = /^(new|fixed|fixes|bug fixes|updates?|changes?|improvements?|novo|novidades|corrigido|correções|corrigidos|melhorias|atualizações|nuevo|corregido|correcciones)$/i;

/** Seção sem conteúdo: só lista os produtos que não mudaram. */
const RX_SEM_ATUALIZACOES = /(no updates|sem atualiza|sin actualizaciones)/i;

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function limpar(s: string): string {
  return s
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trunca preservando palavra, para virar título de sinal. */
export function titulo(texto: string, max = 120): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const ultimoEspaco = corte.lastIndexOf(' ');
  return `${corte.slice(0, ultimoEspaco > 40 ? ultimoEspaco : max).trimEnd()}…`;
}

/**
 * Parser de release note: percorre o body em ordem de documento mantendo o
 * contexto de H2 e H4, e emite um sinal por <li> de lista.
 *
 * Parágrafos soltos sob um H4 sem lista também viram sinal — algumas release
 * notes descrevem a mudança em prosa em vez de bullet.
 */
export function parseReleaseNote(bodyHtml: string): SinalBruto[] {
  const $ = cheerio.load(bodyHtml, null, false);
  const sinais: SinalBruto[] = [];

  let h2 = 0;
  let h4 = 0;
  let li = 0;
  let grupoProduto: string | null = null;
  let grupoComponente: string | null = null;
  let marcador: string | null = null;
  /** seção "Products with no updates this week": nada aqui vira sinal */
  let secaoVazia = false;

  const emitir = (texto: string, $no: cheerio.Cheerio<AnyNode>, extra: { rotulo?: string | null; destaque?: string | null }) => {
    li += 1;
    sinais.push(montar({ h2, h4, li, grupoProduto, grupoComponente, marcador, texto, $li: $no, $, ...extra }));
  };

  /**
   * Um <li> que tem lista dentro só agrupa: o texto dele (sem a lista) é o
   * rótulo, e cada filho vira sinal. Sem lista dentro, o <li> é o sinal.
   */
  const percorrerLista = ($lista: cheerio.Cheerio<AnyNode>, rotulo: string | null) => {
    $lista.children('li').each((__, liEl) => {
      const $li = $(liEl);
      const sublistas = $li.find('ul, ol').filter((___, l) => $(l).parents('li').first()[0] === liEl);
      if (sublistas.length > 0) {
        const $semSub = $li.clone();
        $semSub.find('ul, ol').remove();
        const proprio = limpar($semSub.text()).replace(/[:\-–]\s*$/, '');
        sublistas.each((___, sub) => percorrerLista($(sub), proprio || rotulo));
        return;
      }
      const texto = limpar($li.text());
      if (texto.length < 12) return; // ruído estrutural
      if (ehSoAncoraInterna($li, $)) return; // item de índice: "Contact Center" → #contact_center
      emitir(texto, $li, { rotulo, destaque: destaqueDe($li, $, texto) });
    });
  };

  // Percorre os nós relevantes em ordem de documento, em qualquer nível de
  // aninhamento — algumas notas embrulham seções em <div>.
  $.root()
    .find('h1, h2, h3, h4, h5, h6, ul, ol, p')
    .each((_, el) => {
      const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
      const $el = $(el);

      if (HEADINGS.has(tag)) {
        const txt = limpar($el.text());
        if (!txt) return;
        // h1/h2 abrem produto. h3 também, no formato antigo (sem h2 antes);
        // no novo, h3 sob um h2 é componente. h4 e além: componente.
        if (tag === 'h1' || tag === 'h2' || (tag === 'h3' && !grupoProduto)) {
          h2 += 1;
          h4 = 0;
          li = 0;
          grupoProduto = txt;
          grupoComponente = null;
          marcador = null;
          secaoVazia = RX_SEM_ATUALIZACOES.test(txt);
        } else {
          h4 += 1;
          li = 0;
          grupoComponente = txt;
          // Formato antigo: cada H4 é um componente OU o próprio "New"/"Fixed".
          // Formato novo: o marcador vem num <p> ANTES do H3 e vale para ele.
          if (tag !== 'h3') marcador = RX_MARCADOR.test(txt) ? txt : null;
        }
        return;
      }

      // Antes do primeiro H2 só há introdução e índice do artigo.
      if (!grupoProduto || secaoVazia) return;

      if (tag === 'ul' || tag === 'ol') {
        // Sublistas são tratadas pela lista de fora (percorrerLista).
        if ($el.parents('li').length > 0) return;
        percorrerLista($el, null);
        return;
      }

      if (tag === 'p') {
        if ($el.parents('li').length > 0) return; // já capturado pelo ramo da lista
        const texto = limpar($el.text());
        // formato novo: <p><strong>New</strong></p> marca o tipo das mudanças abaixo
        if (RX_MARCADOR.test(texto)) {
          marcador = texto;
          return;
        }
        // Parágrafo só conta se estiver sob um componente e não for introdução
        // genérica. Evita capturar "Veja também" e chamadas de rodapé.
        if (!grupoComponente) return;
        if (texto.length < 40) return;
        if (/^(see|for more|learn more|veja|saiba)/i.test(texto)) return;
        emitir(texto, $el, { destaque: destaqueDe($el, $, texto) });
      }
    });

  return sinais;
}

/** Item que só aponta para uma seção do próprio artigo (índice). */
function ehSoAncoraInterna($li: cheerio.Cheerio<AnyNode>, $: cheerio.CheerioAPI): boolean {
  const links = $li.find('a[href]');
  if (links.length !== 1) return false;
  const href = links.attr('href') ?? '';
  return href.startsWith('#') && limpar(links.text()) === limpar($li.text());
}

/**
 * "<strong>Nome da feature</strong>: descrição" → "Nome da feature". É o
 * melhor título que o bullet oferece. Só vale se o negrito abre o texto e é
 * seguido de dois-pontos ou travessão.
 */
function destaqueDe($no: cheerio.Cheerio<AnyNode>, $: cheerio.CheerioAPI, texto: string): string | null {
  const forte = limpar($no.find('strong, b').first().text());
  if (!forte || forte.length < 4 || forte.length > 120) return null;
  if (!texto.startsWith(forte)) return null;
  const resto = texto.slice(forte.length).trimStart();
  return /^[:\-–—]/.test(resto) ? forte.replace(/[:\-–—]\s*$/, '') : null;
}

function montar(args: {
  h2: number;
  h4: number;
  li: number;
  grupoProduto: string | null;
  grupoComponente: string | null;
  marcador: string | null;
  rotulo?: string | null;
  destaque?: string | null;
  texto: string;
  $li: cheerio.Cheerio<AnyNode>;
  $: cheerio.CheerioAPI;
}): SinalBruto {
  const { h2, h4, li, grupoProduto, grupoComponente, marcador, texto, $li } = args;
  const links: string[] = [];
  $li.find('a[href]').each((_, a) => {
    const href = args.$(a).attr('href');
    if (href && /^https?:\/\//i.test(href) && !links.includes(href)) links.push(href);
  });
  return {
    ancora: `${h2}.${h4}.${li}`,
    assinatura: hashConteudo(texto),
    grupoProduto,
    grupoComponente,
    texto,
    links,
    marcador,
    rotulo: args.rotulo ?? null,
    destaque: args.destaque ?? null,
  };
}

/**
 * Announcements, What's new e Developer updates: o artigo já é a unidade.
 * O título carrega a mudança; o corpo é contexto.
 */
export function parseArtigoUnico(article: { title: string; body: string }): SinalBruto {
  const $ = cheerio.load(article.body, null, false);
  const links: string[] = [];
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href');
    if (href && /^https?:\/\//i.test(href) && !links.includes(href)) links.push(href);
  });

  const primeiroParagrafo = limpar($('p').first().text());
  const texto = primeiroParagrafo.length > 30 ? primeiroParagrafo : limpar(article.title);

  return {
    ancora: '1.0.1',
    assinatura: hashConteudo(`${article.title}|${texto}`),
    grupoProduto: null,
    grupoComponente: null,
    texto,
    links: links.slice(0, 12),
  };
}

// ─────────────────── Artigo-vivo: a lista de EAPs e betas ───────────────────

export interface BlocoEap {
  /** categoria de produto (H2) */
  categoria: string;
  /** nome do EAP (H3 ou negrito de abertura) */
  nome: string;
  descricao: string;
  assinatura: string;
  ancora: string;
  links: string[];
}

/**
 * O artigo de EAPs é atualizado no lugar — não ganha created_at novo. Então é
 * controlado por hash: quebramos em blocos, e o diff entre a coleta anterior
 * e a atual gera um sinal por bloco novo ou alterado.
 */
export function parseArtigoEap(bodyHtml: string): BlocoEap[] {
  const $ = cheerio.load(bodyHtml, null, false);
  const blocos: BlocoEap[] = [];

  let categoria = 'Geral';
  let iCat = 0;
  let iBloco = 0;
  let atual: { nome: string; partes: string[]; links: string[] } | null = null;

  const fechar = () => {
    if (!atual) return;
    const descricao = limpar(atual.partes.join(' '));
    if (atual.nome && descricao.length > 20) {
      iBloco += 1;
      blocos.push({
        categoria,
        nome: atual.nome,
        descricao,
        assinatura: hashConteudo(`${atual.nome}|${descricao}`),
        ancora: `${iCat}.0.${iBloco}`,
        links: atual.links,
      });
    }
    atual = null;
  };

  $.root()
    .find('h1, h2, h3, h4, h5, p, ul, ol')
    .each((_, el) => {
      const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
      const $el = $(el);
      const txt = limpar($el.text());

      if (tag === 'h1' || tag === 'h2') {
        fechar();
        if (txt) {
          categoria = txt;
          iCat += 1;
          iBloco = 0;
        }
        return;
      }
      if (tag === 'h3' || tag === 'h4' || tag === 'h5') {
        fechar();
        if (txt) atual = { nome: txt, partes: [], links: [] };
        return;
      }
      if (!atual || !txt) return;
      atual.partes.push(txt);
      $el.find('a[href]').each((__, a) => {
        const href = $(a).attr('href');
        if (href && /^https?:\/\//i.test(href) && !atual!.links.includes(href)) {
          atual!.links.push(href);
        }
      });
    });

  fechar();
  return blocos;
}

/**
 * Diff de blocos: devolve os que são novos ou cuja descrição mudou.
 * `anteriores` é o conjunto de assinaturas já vistas neste artigo.
 */
export function blocosNovos(atuais: BlocoEap[], anteriores: Set<string>): BlocoEap[] {
  return atuais.filter((b) => !anteriores.has(b.assinatura));
}
