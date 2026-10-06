/**
 * Parser: quebra o artigo em SINAIS ATÔMICOS.
 *
 * Esta é a decisão estrutural que sustenta o mecanismo. Uma release note do
 * Zendesk carrega de 30 a 60 mudanças; triar "a release note" como um item
 * produz card genérico, ninguém sabe o que é done, e o processo morre na
 * terceira semana.
 *
 * Estrutura observada nas release notes (estável desde 2024):
 *
 *   <h2>  Produto            → Copilot · Contact Center · Knowledge & AI agents…
 *     <h4>  Componente       → AI Agents · Web Crawler · Editor…  (ou "New"/"Fixed")
 *       <ul><li>  Mudança    → 1 bullet = 1 SINAL
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
  /** texto do H4 (componente ou "New"/"Fixed") */
  grupoComponente: string | null;
  /** o texto da mudança, já limpo */
  texto: string;
  /** links citados no bullet — entram na ficha de estudo */
  links: string[];
}

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

  // Percorre todos os nós relevantes em ordem de documento, em qualquer nível
  // de aninhamento — algumas notas embrulham seções em <div>.
  $.root()
    .find('h1, h2, h3, h4, h5, h6, ul, ol, p')
    .each((_, el) => {
      const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
      const $el = $(el);

      if (HEADINGS.has(tag)) {
        const txt = limpar($el.text());
        if (!txt) return;
        // h2 e h3 abrem produto; h4 e além abrem componente
        if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
          h2 += 1;
          h4 = 0;
          li = 0;
          grupoProduto = txt;
          grupoComponente = null;
        } else {
          h4 += 1;
          li = 0;
          grupoComponente = txt;
        }
        return;
      }

      if (tag === 'ul' || tag === 'ol') {
        // só os <li> diretos: sublistas entram no texto do pai
        $el.children('li').each((__, liEl) => {
          const $li = $(liEl);
          const texto = limpar($li.text());
          if (texto.length < 12) return; // ruído estrutural
          li += 1;
          sinais.push(montar({ h2, h4, li, grupoProduto, grupoComponente, texto, $li, $ }));
        });
        return;
      }

      if (tag === 'p') {
        // Parágrafo só conta se estiver sob um componente e não for introdução
        // genérica. Evita capturar "Veja também" e chamadas de rodapé.
        if (!grupoComponente) return;
        const texto = limpar($el.text());
        if (texto.length < 40) return;
        if (/^(see|for more|learn more|veja|saiba)/i.test(texto)) return;
        // parágrafo dentro de <li> já foi capturado pelo ramo da lista
        if ($el.parents('li').length > 0) return;
        li += 1;
        sinais.push(montar({ h2, h4, li, grupoProduto, grupoComponente, texto, $li: $el, $ }));
      }
    });

  return sinais;
}

function montar(args: {
  h2: number;
  h4: number;
  li: number;
  grupoProduto: string | null;
  grupoComponente: string | null;
  texto: string;
  $li: cheerio.Cheerio<AnyNode>;
  $: cheerio.CheerioAPI;
}): SinalBruto {
  const { h2, h4, li, grupoProduto, grupoComponente, texto, $li } = args;
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
