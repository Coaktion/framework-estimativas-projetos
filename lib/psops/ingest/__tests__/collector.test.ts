/**
 * Orquestração do coletor.
 *
 * O que estes testes protegem:
 *   · idempotência — rodar duas vezes no mesmo dia não duplica nada
 *   · marca d'água — só o que é mais novo entra
 *   · artigo editado não recria sinal para conteúdo que já tínhamos
 *   · artigo-vivo (EAPs) gera sinal só para o bloco que mudou
 *   · falha numa fonte não impede as outras
 *   · a camada crua fica imutável (o artigo antigo é preservado)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { criarFakePrisma } from '../../services/__tests__/fake-prisma';
import { coletar, semanaIso } from '../collector';
import type { ClienteHc } from '../../zendesk/client';
import type { HcArticle } from '../../zendesk/types';
import { RELEASE_NOTE_HTML, EAP_ARTICLE_HTML, ANNOUNCEMENTS } from './fixtures/release-note';

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

/** Cliente HC falso: devolve o que o teste mandar, sem rede. */
function hcFalso(cfg: {
  lista?: HcArticle[];
  vivo?: HcArticle;
  erroEm?: (kind: string) => boolean;
}): ClienteHc {
  return {
    async listarArtigos({ kind }) {
      if (cfg.erroEm?.(kind)) throw new Error('Zendesk HC 503 — indisponível');
      return cfg.lista ?? [];
    },
    async pegarArtigo() {
      if (!cfg.vivo) throw new Error('artigo-vivo não configurado no teste');
      return cfg.vivo;
    },
  };
}

function semearFontes(f: Fake, opts?: { comVivo?: boolean; watermark?: Date }) {
  f.estado.sources.push({
    id: 'src-updates',
    key: 'zendesk-updates',
    nome: 'Zendesk updates (categoria raiz)',
    kind: 'CATEGORY',
    zendeskId: '4405298749210',
    locale: 'en-us',
    isLiveArticle: false,
    ativo: true,
    watermark: opts?.watermark ?? null,
  });
  if (opts?.comVivo) {
    f.estado.sources.push({
      id: 'src-eaps',
      key: 'eaps-betas',
      nome: 'Current and upcoming EAPs and betas',
      kind: 'ARTICLE',
      zendeskId: '4408829663642',
      locale: 'en-us',
      isLiveArticle: true,
      ativo: true,
      watermark: null,
    });
  }
}

const releaseNote = artigo({
  id: 11109219243546,
  title: 'Release notes through 2026-08-07',
  body: RELEASE_NOTE_HTML,
  section_id: 4405298847002, // seção Release notes
  created_at: '2026-08-10T00:05:19Z',
});

// ─────────────────────────── Coleta e idempotência ──────────────────────────

test('coleta a release note e cria um sinal por bullet, separando o ruído', async () => {
  const f = criarFakePrisma();
  semearFontes(f);

  const r = await coletar({
    prisma: asPrisma(f),
    hc: hcFalso({ lista: [releaseNote] }),
    agora: AGORA,
  });

  assert.equal(r.porFonte[0]!.ok, true);
  assert.equal(r.porFonte[0]!.itensNovos, 1);
  assert.equal(f.estado.rawItems.length, 1, 'camada crua gravada');
  assert.equal(f.estado.signals.length, 13, 'os 13 bullets viraram sinal');
  assert.equal(r.totalSinaisCriados + r.totalSinaisArquivados, 13);
  assert.ok(r.totalSinaisArquivados >= 2, 'o ruído foi separado, não descartado');

  const arquivados = f.estado.signals.filter((s) => s.status === 'AUTO_ARQUIVADO');
  assert.ok(arquivados.every((s) => s.motivoRuido), 'todo arquivamento tem motivo registrado');
});

test('rodar duas vezes não duplica nada', async () => {
  const f = criarFakePrisma();
  semearFontes(f);
  const hc = hcFalso({ lista: [releaseNote] });

  await coletar({ prisma: asPrisma(f), hc, agora: AGORA });
  const depoisDaPrimeira = f.estado.signals.length;

  // a marca d'água foi avançada; a segunda rodada não traz nada
  const r2 = await coletar({ prisma: asPrisma(f), hc, agora: AGORA });

  assert.equal(f.estado.signals.length, depoisDaPrimeira);
  assert.equal(f.estado.rawItems.length, 1);
  assert.equal(r2.totalSinaisCriados, 0);
});

test('a marca d\'água avança para o created_at mais novo', async () => {
  const f = criarFakePrisma();
  semearFontes(f);

  await coletar({
    prisma: asPrisma(f),
    hc: hcFalso({
      lista: [
        releaseNote,
        artigo({ id: 999, title: ANNOUNCEMENTS[0]!.title, body: ANNOUNCEMENTS[0]!.body, created_at: '2026-08-11T12:00:00Z' }),
      ],
    }),
    agora: AGORA,
  });

  const fonte = f.estado.sources[0]!;
  assert.equal((fonte.watermark as Date).toISOString(), '2026-08-11T12:00:00.000Z');
});

test('artigo anterior à marca d\'água é ignorado', async () => {
  const f = criarFakePrisma();
  semearFontes(f, { watermark: new Date('2026-08-10T23:00:00Z') });

  const r = await coletar({
    prisma: asPrisma(f),
    hc: hcFalso({ lista: [releaseNote] }), // created_at 2026-08-10T00:05
    agora: AGORA,
  });

  assert.equal(r.porFonte[0]!.itensNovos, 0);
  assert.equal(f.estado.signals.length, 0);
});

test('artigo editado preserva o item cru anterior e não recria sinal repetido', async () => {
  const f = criarFakePrisma();
  semearFontes(f);
  const hc1 = hcFalso({ lista: [releaseNote] });
  await coletar({ prisma: asPrisma(f), hc: hc1, agora: AGORA });
  const sinaisAntes = f.estado.signals.length;

  // mesma nota com um bullet novo acrescentado e created_at mais recente
  const editada = artigo({
    ...releaseNote,
    id: releaseNote.id,
    created_at: '2026-08-11T00:00:00Z',
    body:
      RELEASE_NOTE_HTML +
      '<h2>Support</h2><h4>New</h4><ul><li>Admins can now configure ticket sharing agreements per brand in Admin Center.</li></ul>',
  });

  const r = await coletar({
    prisma: asPrisma(f),
    hc: hcFalso({ lista: [editada] }),
    agora: AGORA,
  });

  assert.equal(f.estado.rawItems.length, 2, 'a camada crua é imutável: guarda as duas versões');
  assert.equal(r.totalSinaisCriados, 1, 'só o bullet novo virou sinal');
  assert.equal(f.estado.signals.length, sinaisAntes + 1);
});

// ───────────────────────────── Artigo-vivo (EAPs) ───────────────────────────

test('artigo-vivo: primeira coleta gera sinal para cada bloco', async () => {
  const f = criarFakePrisma();
  f.estado.sources.push({
    id: 'src-eaps', key: 'eaps-betas', nome: 'EAPs e Betas', kind: 'ARTICLE',
    zendeskId: '4408829663642', locale: 'en-us', isLiveArticle: true, ativo: true, watermark: null,
  });

  const vivo = artigo({
    id: 4408829663642,
    title: 'Current and upcoming Zendesk early access programs (EAPs)',
    body: EAP_ARTICLE_HTML,
  });

  const r = await coletar({ prisma: asPrisma(f), hc: hcFalso({ vivo }), agora: AGORA });

  assert.equal(r.porFonte[0]!.itensNovos, 1);
  assert.equal(f.estado.signals.length, 3, 'três EAPs na fixture');
});

test('artigo-vivo: bloco alterado gera exatamente um sinal novo', async () => {
  const f = criarFakePrisma();
  f.estado.sources.push({
    id: 'src-eaps', key: 'eaps-betas', nome: 'EAPs e Betas', kind: 'ARTICLE',
    zendeskId: '4408829663642', locale: 'en-us', isLiveArticle: true, ativo: true, watermark: null,
  });

  const base = { id: 4408829663642, title: 'EAPs' };
  await coletar({
    prisma: asPrisma(f),
    hc: hcFalso({ vivo: artigo({ ...base, body: EAP_ARTICLE_HTML }) }),
    agora: AGORA,
  });
  assert.equal(f.estado.signals.length, 3);

  const alterado = EAP_ARTICLE_HTML.replace(
    'with seamless human agent escalation.',
    'with seamless human agent escalation. Now supports Portuguese (Brazil).',
  );
  const r = await coletar({
    prisma: asPrisma(f),
    hc: hcFalso({ vivo: artigo({ ...base, body: alterado }) }),
    agora: AGORA,
  });

  assert.equal(r.totalSinaisCriados + r.totalSinaisArquivados, 1);
  assert.equal(f.estado.signals.length, 4);
  assert.equal(f.estado.rawItems.length, 2);
});

test('artigo-vivo sem mudança nenhuma não cria item cru novo', async () => {
  const f = criarFakePrisma();
  f.estado.sources.push({
    id: 'src-eaps', key: 'eaps-betas', nome: 'EAPs e Betas', kind: 'ARTICLE',
    zendeskId: '4408829663642', locale: 'en-us', isLiveArticle: true, ativo: true, watermark: null,
  });
  const vivo = artigo({ id: 4408829663642, title: 'EAPs', body: EAP_ARTICLE_HTML });

  await coletar({ prisma: asPrisma(f), hc: hcFalso({ vivo }), agora: AGORA });
  const r = await coletar({ prisma: asPrisma(f), hc: hcFalso({ vivo }), agora: AGORA });

  assert.equal(r.porFonte[0]!.itensNovos, 0);
  assert.equal(f.estado.rawItems.length, 1);
});

// ────────────────────────────── Robustez do run ─────────────────────────────

test('fonte que falha não impede as outras, e o erro fica registrado', async () => {
  const f = criarFakePrisma();
  semearFontes(f, { comVivo: true });

  const r = await coletar({
    prisma: asPrisma(f),
    hc: hcFalso({
      erroEm: (kind) => kind === 'CATEGORY',
      vivo: artigo({ id: 4408829663642, title: 'EAPs', body: EAP_ARTICLE_HTML }),
    }),
    agora: AGORA,
  });

  const categoria = r.porFonte.find((x) => x.fonte === 'zendesk-updates')!;
  const eaps = r.porFonte.find((x) => x.fonte === 'eaps-betas')!;

  assert.equal(categoria.ok, false);
  assert.match(categoria.erro!, /503/);
  assert.equal(eaps.ok, true, 'a outra fonte seguiu');
  assert.equal(f.estado.signals.length, 3);

  const src = f.estado.sources.find((s) => s.key === 'zendesk-updates')!;
  assert.equal(src.ultimoRunOk, false);
  assert.match(String(src.ultimoRunErro), /503/);
});

test('o run é registrado com os totais e o status agregado', async () => {
  const f = criarFakePrisma();
  semearFontes(f);
  const r = await coletar({
    prisma: asPrisma(f),
    hc: hcFalso({ lista: [releaseNote] }),
    agora: AGORA,
  });

  const run = f.estado.ingestRuns.find((x) => x.id === r.runId)!;
  assert.equal(run.ok, true);
  assert.equal(run.itensNovos, 1);
  assert.equal(run.sinaisCriados, r.totalSinaisCriados);
  assert.equal(run.sinaisArquivados, r.totalSinaisArquivados);
  assert.ok(run.finalizadoEm);
});

test('fonte inativa não é coletada', async () => {
  const f = criarFakePrisma();
  semearFontes(f);
  f.estado.sources[0]!.ativo = false;

  const r = await coletar({
    prisma: asPrisma(f),
    hc: hcFalso({ lista: [releaseNote] }),
    agora: AGORA,
  });
  assert.equal(r.porFonte.length, 0);
  assert.equal(f.estado.signals.length, 0);
});

test('semanaIso devolve o ciclo semanal no formato ISO', () => {
  assert.equal(semanaIso(new Date('2026-08-11T00:00:00Z')), '2026-W33');
  assert.equal(semanaIso(new Date('2026-08-04T00:00:00Z')), '2026-W32');
  assert.equal(semanaIso(new Date('2026-01-01T00:00:00Z')), '2026-W01');
});

test('primeira coleta (sem marca d\'água) só pega a janela de dias, não o histórico inteiro', async () => {
  const f = criarFakePrisma();
  semearFontes(f);

  const antigo = artigo({
    id: 501,
    title: ANNOUNCEMENTS[0]!.title,
    body: ANNOUNCEMENTS[0]!.body,
    created_at: '2026-07-01T00:00:00Z', // 42 dias antes de AGORA
  });
  const recente = artigo({
    id: 502,
    title: ANNOUNCEMENTS[0]!.title,
    body: ANNOUNCEMENTS[0]!.body,
    created_at: '2026-08-05T00:00:00Z', // 7 dias antes de AGORA
  });

  let pararEmRecebido: Date | null | undefined;
  const hc: ClienteHc = {
    async listarArtigos({ pararEm }) {
      pararEmRecebido = pararEm;
      return [recente, antigo];
    },
    async pegarArtigo() {
      throw new Error('sem artigo-vivo neste teste');
    },
  };

  const r = await coletar({ prisma: asPrisma(f), hc, agora: AGORA, primeiraColetaDias: 14 });

  const fonte = r.porFonte.find((x) => x.fonte === 'zendesk-updates')!;
  assert.equal(fonte.itensNovos, 1, 'só o artigo dentro da janela entra');
  assert.equal(
    pararEmRecebido?.toISOString(),
    '2026-07-29T10:00:00.000Z',
    'a paginação para no corte da janela',
  );
  assert.equal(
    (f.estado.sources[0]!.watermark as Date).toISOString(),
    '2026-08-05T00:00:00.000Z',
    'a marca d\'água nasce no artigo mais novo',
  );
});
