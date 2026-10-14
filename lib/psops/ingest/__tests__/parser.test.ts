/**
 * Testes do parser, do filtro de ruído e do classificador por regras.
 *
 * Roda com o test runner nativo do Node — nenhuma dependência de teste é
 * adicionada ao portal:  npm run psops:test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseReleaseNote, parseArtigoUnico, parseArtigoEap, blocosNovos } from '../parser';
import { avaliarRuido } from '../noise';
import { ClassificadorPorRegras, type ContextoClassificacao } from '../classify';
import { Impacto, Produto, SignalTipo, Modulo } from '../../config/taxonomy';
import { RELEASE_NOTE_HTML, EAP_ARTICLE_HTML, ANNOUNCEMENTS } from './fixtures/release-note';

const clf = new ClassificadorPorRegras();
const ctxRelease: ContextoClassificacao = {
  fonte: 'Release notes',
  tituloArtigo: 'Release notes through 2026-08-07',
  labels: [],
};

// ─────────────────────────────── Parser ─────────────────────────────────────

test('quebra a release note em um sinal por bullet', () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  assert.equal(sinais.length, 13, 'a fixture tem 13 bullets acionáveis');
});

test('herda o produto do H2 e o componente do H4', () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const voz = sinais.find((s) => s.texto.includes('voice testing widget'));
  assert.ok(voz);
  assert.equal(voz.grupoProduto, 'Contact Center');
  assert.equal(voz.grupoComponente, 'AI Agents');
});

test('a âncora é estável e única dentro do artigo', () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const ancoras = sinais.map((s) => s.ancora);
  assert.equal(new Set(ancoras).size, ancoras.length, 'sem âncora repetida');
  // 2º H2, 1º H4, 1º bullet
  const voz = sinais.find((s) => s.texto.includes('voice testing widget'));
  assert.equal(voz?.ancora, '2.1.1');
});

test('reparsear o mesmo body produz as mesmas assinaturas (idempotência)', () => {
  const a = parseReleaseNote(RELEASE_NOTE_HTML).map((s) => s.assinatura);
  const b = parseReleaseNote(RELEASE_NOTE_HTML).map((s) => s.assinatura);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length, 'sem assinatura duplicada');
});

test('captura os links citados no bullet', () => {
  const s = parseArtigoUnico(ANNOUNCEMENTS[0]!);
  assert.ok(s.links.some((l) => l.includes('developer.zendesk.com')));
});

test('announcement vira exatamente um sinal', () => {
  const s = parseArtigoUnico(ANNOUNCEMENTS[2]!);
  assert.equal(s.ancora, '1.0.1');
  assert.ok(s.texto.includes('MCP client'));
});

// ──────────────────────────── Filtro de ruído ───────────────────────────────

test('arquiva ajuste cosmético sob "Fixed"', () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const glitch = sinais.find((s) => s.texto.includes('visual glitch'));
  const typo = sinais.find((s) => s.texto.includes('typo'));
  assert.equal(avaliarRuido(glitch!).arquivar, true);
  assert.equal(avaliarRuido(typo!).arquivar, true);
  assert.match(avaliarRuido(typo!).motivo!, /cosm/i);
});

test('NÃO arquiva correção sob "Fixed" que mexe em API', () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const api = sinais.find((s) => s.texto.includes('returned a 500'));
  assert.equal(avaliarRuido(api!).arquivar, false);
});

test('o corte de ruído mantém a fila em tamanho triável', () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const arquivados = sinais.filter((s) => avaliarRuido(s).arquivar).length;
  assert.ok(arquivados >= 2, 'algum ruído precisa ser cortado');
  assert.ok(arquivados < sinais.length / 2, 'mas o filtro não pode engolir a fila');
});

// ──────────────────────── Classificador por regras ──────────────────────────

test('deprecation com data limite: tipo, data e os quatro impactos', async () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const dep = sinais.find((s) => s.texto.includes('removal of API tokens'));
  const c = await clf.classificar(dep!, ctxRelease);

  assert.equal(c.tipo, SignalTipo.DEPRECATION);
  assert.equal(c.dataLimite?.toISOString().slice(0, 10), '2026-09-30');
  assert.deepEqual(c.impactosSugeridos, [
    Impacto.ESTUDO,
    Impacto.DEMO,
    Impacto.ESTIM,
    Impacto.ESCOPO,
  ]);
  assert.ok(c.score >= 80, `score alto esperado, recebi ${c.score}`);
});

test('a deprecation com prazo lidera a fila da release note', async () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const classificados = await Promise.all(
    sinais
      .filter((s) => !avaliarRuido(s).arquivar)
      .map(async (s) => ({ s, c: await clf.classificar(s, ctxRelease) })),
  );
  classificados.sort((a, b) => b.c.score - a.c.score);
  assert.match(classificados[0]!.s.texto, /removal of API tokens/);
});

test('produto de sinal sob container ("Apps and integrations") usa H4 e texto', async () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const tokens = sinais.find((s) => s.texto.includes('removal of API tokens'))!;
  const madcap = sinais.find((s) => s.texto.includes('MadCap Connect'))!;

  const cTokens = await clf.classificar(tokens, ctxRelease);
  const cMadcap = await clf.classificar(madcap, ctxRelease);

  assert.equal(cTokens.produto, Produto.DEVELOPER_API, 'H4 "Developer" desempata');
  assert.equal(cMadcap.produto, Produto.MARKETPLACE, 'app de terceiro segue Marketplace');
});

test('mudança de preço sugere estimativa e escopo, nunca demo', async () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const preco = sinais.find((s) => s.texto.includes('WhatsApp Business messaging pricing'));
  const c = await clf.classificar(preco!, ctxRelease);

  assert.equal(c.tipo, SignalTipo.PRICING_PACKAGING);
  assert.equal(c.afetaPreco, true);
  assert.ok(c.impactosSugeridos.includes(Impacto.ESTIM));
  assert.ok(c.impactosSugeridos.includes(Impacto.ESCOPO));
  assert.ok(!c.impactosSugeridos.includes(Impacto.DEMO));
});

test('GA com configuração no admin sugere os quatro destinos', async () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const cfg = sinais.find((s) => s.texto.includes('configure which auto assist'));
  const c = await clf.classificar(cfg!, ctxRelease);

  assert.equal(c.requerConfiguracao, true);
  assert.equal(c.planoMinimo, 'Advanced AI add-on');
  assert.deepEqual(c.impactosSugeridos.sort(), ['DEMO', 'ESCOPO', 'ESTIM', 'ESTUDO']);
});

test('UX puro sugere só demo — não mexe em escopo nem em horas', async () => {
  const s = parseArtigoUnico(ANNOUNCEMENTS[4]!); // unified navigation
  const c = await clf.classificar(s, {
    fonte: "What's new",
    tituloArtigo: ANNOUNCEMENTS[4]!.title,
    labels: [],
  });
  assert.equal(c.tipo, SignalTipo.UX_INTERFACE);
  assert.deepEqual(c.impactosSugeridos, [Impacto.DEMO]);
});

test('EAP sugere estudo mas não estimativa', async () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const eap = sinais.find((s) => s.texto.includes('conversational help center'));
  const c = await clf.classificar(eap!, ctxRelease);

  assert.equal(c.tipo, SignalTipo.EAP_BETA);
  assert.ok(c.impactosSugeridos.includes(Impacto.ESTUDO));
  assert.ok(!c.impactosSugeridos.includes(Impacto.ESTIM));
});

test('novo endpoint promove estimativa e escopo por requerDev', async () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const api = sinais.find((s) => s.texto.includes('conversations endpoint'));
  const c = await clf.classificar(api!, ctxRelease);

  assert.equal(c.requerDev, true);
  assert.ok(c.impactosSugeridos.includes(Impacto.ESTIM));
  assert.ok(c.impactosSugeridos.includes(Impacto.ESCOPO));
});

test('fix menor não sugere nada', async () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const fix = sinais.find((s) => s.texto.includes('returned a 500'));
  const c = await clf.classificar(fix!, ctxRelease);
  assert.equal(c.tipo, SignalTipo.FIX_MINOR);
  assert.deepEqual(c.impactosSugeridos, []);
});

test('produto e módulo: Contact Center cai na frente Voice', async () => {
  const sinais = parseReleaseNote(RELEASE_NOTE_HTML);
  const voz = sinais.find((s) => s.texto.includes('voice testing widget'));
  const c = await clf.classificar(voz!, ctxRelease);
  assert.equal(c.produto, Produto.CONTACT_CENTER);
  assert.equal(c.modulo, Modulo.VOICE);
});

test('Developer/API cai na frente Integrações', async () => {
  const s = parseArtigoUnico(ANNOUNCEMENTS[0]!);
  const c = await clf.classificar(s, {
    fonte: 'Developer updates',
    tituloArtigo: ANNOUNCEMENTS[0]!.title,
    labels: [],
  });
  assert.equal(c.produto, Produto.DEVELOPER_API);
  assert.equal(c.modulo, Modulo.INTEGRACOES);
});

test('score é determinístico', async () => {
  const s = parseArtigoUnico(ANNOUNCEMENTS[1]!);
  const ctx = { fonte: 'Announcements', tituloArtigo: ANNOUNCEMENTS[1]!.title, labels: [] };
  const a = await clf.classificar(s, ctx);
  const b = await clf.classificar(s, ctx);
  assert.equal(a.score, b.score);
});

// ──────────────────────── Artigo-vivo (EAPs) e diff ─────────────────────────

test('quebra o artigo de EAPs em blocos por categoria e nome', () => {
  const blocos = parseArtigoEap(EAP_ARTICLE_HTML);
  assert.equal(blocos.length, 3);
  const voz = blocos.find((b) => b.nome === 'Voice AI agents');
  assert.equal(voz?.categoria, 'AI agents');
  assert.ok(voz!.descricao.includes('agentic voice automation'));
});

test('diff do artigo-vivo: sem mudança, nenhum sinal novo', () => {
  const blocos = parseArtigoEap(EAP_ARTICLE_HTML);
  const vistos = new Set(blocos.map((b) => b.assinatura));
  assert.equal(blocosNovos(blocos, vistos).length, 0);
});

test('diff do artigo-vivo: bloco alterado gera exatamente um sinal', () => {
  const antes = parseArtigoEap(EAP_ARTICLE_HTML);
  const vistos = new Set(antes.map((b) => b.assinatura));

  const depois = parseArtigoEap(
    EAP_ARTICLE_HTML.replace(
      'with seamless human agent escalation.',
      'with seamless human agent escalation. Now supports Portuguese (Brazil).',
    ),
  );
  const novos = blocosNovos(depois, vistos);
  assert.equal(novos.length, 1);
  assert.equal(novos[0]!.nome, 'Voice AI agents');
});
