/**
 * Rodada de refinamento após a primeira coleta real (out/2026):
 *   · filtro de escopo: Developer/API, incidentes e correções saem da fila
 *   · tipo sem pista não vira mais GA
 *   · a fila existente é reclassificada quando as regras mudam
 *   · título e trecho em português vêm da tradução pt-br do próprio Zendesk
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { criarFakePrisma } from '../../services/__tests__/fake-prisma';
import { coletar } from '../collector';
import { ClassificadorPorRegras, VERSAO_REGRAS } from '../classify';
import { MOTIVO_ESCOPO } from '../noise';
import { reclassificarFila, traduzirPendentes, estruturaBate } from '../manutencao';
import { parseReleaseNote } from '../parser';
import type { ClienteHc } from '../../zendesk/client';
import type { HcArticle } from '../../zendesk/types';
import { RELEASE_NOTE_HTML } from './fixtures/release-note';

process.env.DATABASE_URL ??= 'postgresql://teste';

type Fake = ReturnType<typeof criarFakePrisma>;
const asPrisma = (f: Fake) => f as unknown as Parameters<typeof coletar>[0]['prisma'];
const AGORA = () => new Date('2026-08-12T10:00:00Z');

function artigo(over: Partial<HcArticle> & { id: number }): HcArticle {
  return {
    url: `https://support.zendesk.com/api/v2/help_center/en-us/articles/${over.id}.json`,
    html_url: `https://support.zendesk.com/hc/en-us/articles/${over.id}`,
    title: 'Artigo',
    name: 'Artigo',
    body: '<p>corpo</p>',
    section_id: 4405298833818,
    author_id: 1,
    created_at: '2026-08-10T00:00:00Z',
    updated_at: '2026-08-10T00:00:00Z',
    edited_at: null,
    draft: false,
    promoted: false,
    outdated: false,
    locale: 'en-us',
    source_locale: 'en-us',
    label_names: [],
    ...over,
  };
}

const releaseNote = artigo({
  id: 11109219243546,
  title: 'Release notes through 2026-08-07',
  body: RELEASE_NOTE_HTML,
});

function semearFonte(f: Fake) {
  f.estado.sources.push({
    id: 'src-updates',
    key: 'zendesk-updates',
    nome: 'Zendesk updates (categoria raiz)',
    kind: 'CATEGORY',
    zendeskId: '4405298749210',
    locale: 'en-us',
    isLiveArticle: false,
    ativo: true,
    watermark: null,
  });
}

const hcLista = (lista: HcArticle[], extra?: Partial<ClienteHc>): ClienteHc => ({
  async listarArtigos() {
    return lista;
  },
  async pegarArtigo() {
    throw new Error('sem artigo-vivo neste teste');
  },
  ...extra,
});

const sinal = (f: Fake, ancora: string) => f.estado.signals.find((s) => s.ancora === ancora)!;

// ─────────────────────────────── Filtro de escopo ───────────────────────────

test('escopo: Developer/API, correções e incidentes vão para o arquivo com motivo', async () => {
  const f = criarFakePrisma();
  semearFonte(f);
  const incidente = artigo({
    id: 777,
    section_id: null,
    title: 'Service incident: delays in Support',
    body:
      '<p>On September 16, 2026, from 09:00 UTC to 12:20 UTC, Support customers on multiple pods experienced an issue that caused delays in ticket updates.</p>',
  });

  await coletar({ prisma: asPrisma(f), hc: hcLista([releaseNote, incidente]), agora: AGORA });

  // Apps and integrations > Developer: remoção dos API tokens e endpoint novo
  assert.equal(sinal(f, '4.2.1').status, 'AUTO_ARQUIVADO');
  assert.equal(sinal(f, '4.2.1').motivoRuido, MOTIVO_ESCOPO.dev);
  assert.equal(sinal(f, '4.2.2').status, 'AUTO_ARQUIVADO');

  // Copilot > Fixed: toda correção sai, inclusive a que cita API
  for (const a of ['1.2.1', '1.2.2', '1.2.3']) {
    assert.equal(sinal(f, a).status, 'AUTO_ARQUIVADO', `correção ${a} deveria estar arquivada`);
  }

  const inc = f.estado.signals.find((s) => String(s.trechoOriginal).includes('multiple pods'))!;
  assert.equal(inc.status, 'AUTO_ARQUIVADO');
  assert.equal(inc.motivoRuido, MOTIVO_ESCOPO.incidente);

  // O que interessa continua na fila
  assert.equal(sinal(f, '2.1.2').status, 'NOVO', 'Voice AI agents GA');
  assert.equal(sinal(f, '5.1.1').status, 'NOVO', 'mudança de preço do WhatsApp');
  assert.equal(sinal(f, '2.1.2').classificadoPor, VERSAO_REGRAS);
});

test('tipo: correção pelo texto vira FIX_MINOR; sem pista não vira mais GA', async () => {
  const c = new ClassificadorPorRegras();
  const ctx = { fonte: 'Release notes', tituloArtigo: 'Release notes through 2026-10-03', labels: [] };
  const base = { ancora: '1.1.1', assinatura: 'x', grupoProduto: 'Support', links: [] };

  const fix = await c.classificar(
    { ...base, grupoComponente: 'Agent Workspace', texto: 'Fixed an issue where the side panel did not refresh after a macro was applied.' },
    ctx,
  );
  assert.equal(fix.tipo, 'FIX_MINOR');

  const neutro = await c.classificar(
    { ...base, grupoComponente: 'Agent Workspace', texto: "The ticket sidebar shows the requester's local time next to the name." },
    ctx,
  );
  assert.equal(neutro.tipo, 'UX_INTERFACE');
  assert.deepEqual(neutro.impactosSugeridos, ['DEMO']);

  const novo = await c.classificar(
    { ...base, grupoComponente: 'Omnichannel routing', texto: 'You can now route messaging conversations by skill to agents in a specific group.' },
    ctx,
  );
  assert.equal(novo.tipo, 'GA');
});

// ─────────────────────────────── Reclassificação ────────────────────────────

function semearRawENSinais(f: Fake) {
  semearFonte(f);
  f.estado.rawItems.push({
    id: 'raw-1',
    sourceId: 'src-updates',
    externalId: String(releaseNote.id),
    titulo: releaseNote.title,
    htmlUrl: releaseNote.html_url,
    secaoId: null,
    criadoEm: new Date('2026-08-10T00:00:00Z'),
    labels: [],
    bodyHash: 'h',
    payload: releaseNote,
    traducaoPtEm: null,
  });
  const brutos = parseReleaseNote(RELEASE_NOTE_HTML);
  const mk = (ancora: string, status: string, id: string) => {
    const b = brutos.find((x) => x.ancora === ancora)!;
    f.estado.signals.push({
      id,
      rawItemId: 'raw-1',
      ancora,
      assinatura: b.assinatura,
      titulo: b.texto.slice(0, 80),
      trechoOriginal: b.texto,
      produto: 'SUPPORT',
      modulo: 'SUPPORT',
      tipo: 'GA',
      score: 72,
      impactosSugeridos: ['ESTUDO', 'DEMO', 'ESTIM', 'ESCOPO'],
      classificadoPor: 'regras', // versão antiga
      motivoRuido: null,
      status,
    });
  };
  mk('4.2.1', 'NOVO', 's-dev');
  mk('2.1.2', 'NOVO', 's-voice');
  mk('4.2.2', 'TRIADO', 's-triado');
}

test('reclassificação: fila antiga ganha as regras novas; o que já foi triado não é tocado', async () => {
  const f = criarFakePrisma();
  semearRawENSinais(f);

  const r = await reclassificarFila(asPrisma(f), new ClassificadorPorRegras());
  assert.deepEqual(r, { reclassificados: 2, arquivados: 1 });

  const dev = f.estado.signals.find((s) => s.id === 's-dev')!;
  assert.equal(dev.status, 'AUTO_ARQUIVADO');
  assert.equal(dev.motivoRuido, MOTIVO_ESCOPO.dev);

  const voice = f.estado.signals.find((s) => s.id === 's-voice')!;
  assert.equal(voice.status, 'NOVO');
  assert.equal(voice.classificadoPor, VERSAO_REGRAS);
  assert.equal(voice.produto, 'CONTACT_CENTER');

  const triado = f.estado.signals.find((s) => s.id === 's-triado')!;
  assert.equal(triado.status, 'TRIADO');
  assert.equal(triado.classificadoPor, 'regras', 'decisão humana não se reescreve');

  // idempotente: na segunda passada não há o que reprocessar
  const r2 = await reclassificarFila(asPrisma(f), new ClassificadorPorRegras());
  assert.deepEqual(r2, { reclassificados: 0, arquivados: 0 });
});

// ──────────────────────────────── Tradução pt-br ────────────────────────────

/** Versão "traduzida" com a mesma estrutura: cada bullet ganha o prefixo PT. */
const BODY_PT = RELEASE_NOTE_HTML.replace(/<li>/g, '<li>PT: ');

const hcComTraducao = (body: string | null): ClienteHc =>
  hcLista([], {
    async pegarTraducao() {
      return body === null
        ? null
        : artigo({ id: releaseNote.id, title: 'Notas da versão até 07/08/2026', body, locale: 'pt-br' });
    },
  });

test('tradução: estrutura igual → título e trecho em português, bullet a bullet', async () => {
  const f = criarFakePrisma();
  semearRawENSinais(f);

  const r = await traduzirPendentes(asPrisma(f), hcComTraducao(BODY_PT), { agora: AGORA });
  assert.equal(r.conferidos, 1);
  assert.equal(r.artigosTraduzidos, 1);
  assert.equal(r.sinaisTraduzidos, 3, 'inclui o já triado: tradução é só leitura');

  const voice = f.estado.signals.find((s) => s.id === 's-voice')!;
  assert.match(String(voice.trechoPt), /^PT: Voice AI agents are now generally available/);
  assert.match(String(voice.tituloPt), /^AI Agents: PT: Voice AI agents/);
  assert.ok(f.estado.rawItems[0]!.traducaoPtEm instanceof Date);

  // artigo já traduzido não é consultado de novo
  const r2 = await traduzirPendentes(asPrisma(f), hcComTraducao(BODY_PT), { agora: AGORA });
  assert.equal(r2.conferidos, 0);
});

test('tradução: estrutura diferente → fica em inglês e tenta de novo depois', async () => {
  const f = criarFakePrisma();
  semearRawENSinais(f);
  // a tradução "perdeu" um bullet: as âncoras deixam de bater
  const corpoTorto = BODY_PT.replace(/<li>PT: Fixed a typo[^<]*<\/li>/, '');

  const r = await traduzirPendentes(asPrisma(f), hcComTraducao(corpoTorto), { agora: AGORA });
  assert.equal(r.estruturaDiferente, 1);
  assert.equal(r.sinaisTraduzidos, 0);
  assert.equal(f.estado.signals.find((s) => s.id === 's-voice')!.trechoPt, undefined);
  assert.equal(f.estado.rawItems[0]!.traducaoPtEm, null, 'continua pendente');
});

test('tradução: ainda não publicada, ou artigo velho demais → nada muda', async () => {
  const f = criarFakePrisma();
  semearRawENSinais(f);

  const semTraducao = await traduzirPendentes(asPrisma(f), hcComTraducao(null), { agora: AGORA });
  assert.deepEqual(
    { c: semTraducao.conferidos, a: semTraducao.artigosTraduzidos },
    { c: 1, a: 0 },
  );

  // 40 dias depois o artigo sai da janela de conferência
  const depois = () => new Date('2026-09-19T10:00:00Z');
  const velho = await traduzirPendentes(asPrisma(f), hcComTraducao(BODY_PT), { agora: depois });
  assert.equal(velho.conferidos, 0);
});

test('estruturaBate exige mesma quantidade e mesmas âncoras, na mesma ordem', () => {
  const en = parseReleaseNote(RELEASE_NOTE_HTML);
  assert.equal(estruturaBate(en, parseReleaseNote(BODY_PT)), true);
  assert.equal(estruturaBate(en, en.slice(1)), false);
  assert.equal(estruturaBate([], []), false, 'vazio não é tradução');
});
