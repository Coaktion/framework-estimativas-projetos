/**
 * Decisão de elegibilidade por dono de frente (services/decisoes.ts).
 * Donos de teste: Demo → Renato (6), Estimativa → Arthur (5), Escopo →
 * Elisa (7), Estudo → os três.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { criarFakePrisma, semearArtefato, semearSinal } from './fake-prisma';
import { decidir } from '../decisoes';
import { listarSinais } from '../signals';
import type { ResponsaveisResolvidos } from '../../config/responsaveis';

process.env.DATABASE_URL ??= 'postgresql://teste';

type Fake = ReturnType<typeof criarFakePrisma>;
const asPrisma = (f: Fake) => f as unknown as Parameters<typeof decidir>[0];

const RESP: ResponsaveisResolvidos = {
  ESTUDO: ['6', '5', '7'],
  DEMO: ['6'],
  ESTIM: ['5'],
  ESCOPO: ['7'],
};

function cenario() {
  const f = criarFakePrisma();
  // o cadastro que config/responsaveis.ts resolve (a fila lê dali)
  f.estado.users.push(
    { id: 6, email: 'rzanetti@aktienow.com' },
    { id: 5, email: 'aoliveira@aktienow.com' },
    { id: 7, email: 'esimicevic@aktienow.com' },
  );
  const s = semearSinal(f, { produto: 'CONTACT_CENTER', tituloPt: 'Agentes de voz' });
  semearArtefato(f, { chave: 'ESTIM:Canais - Voz', tipo: 'FRAMEWORK', nome: 'Estimativa · Canais - Voz', donoId: '5' });
  // o duplo não resolve relações no select: a fila precisa do artigo e das decisões
  const original = f.psOpsSignal.findMany.bind(f.psOpsSignal);
  (f.psOpsSignal as { findMany: unknown }).findMany = async (args?: { where?: Record<string, unknown> }) =>
    (await original(args)).map((x: Record<string, unknown>) => ({
      ...x,
      rawItem: { htmlUrl: 'https://x/hc/en-us/articles/1', titulo: 'Nota', criadoEm: new Date(), source: { nome: 'Zendesk' } },
      decisoes: f.estado.decisoes.filter((d) => d.signalId === x.id),
    }));
  return { f, s, id: s.id as string };
}

test('marcar a própria frente efetiva: atividade no Backlog de quem decidiu, só dele', async () => {
  const { f, id } = cenario();
  const r = await decidir(asPrisma(f), { signalId: id, usuarioId: '6', marcados: ['DEMO', 'ESTUDO'], responsaveis: RESP });

  assert.deepEqual(r.atividades.map((a) => [a.tipo, a.responsavelId]).sort(), [['DEMO', '6'], ['ESTUDO', '6']]);
  assert.equal(f.estado.activities.length, 2, 'o estudo é só do Renato, não dos outros SEs');
  assert.equal(f.estado.studyNotes.length, 1, 'ficha da feature criada');
  assert.equal(r.status, 'NOVO', 'Arthur e Elisa ainda não decidiram');
  assert.equal(f.estado.signals[0]!.status, 'NOVO');
});

test('marcar a frente de outro dono vira sugestão para ele, com aviso no sininho', async () => {
  const { f, id } = cenario();
  const r = await decidir(asPrisma(f), { signalId: id, usuarioId: '6', marcados: ['DEMO', 'ESTIM'], responsaveis: RESP });

  assert.deepEqual(r.sugestoes, [{ impacto: 'ESTIM', donoId: '5' }]);
  assert.equal(f.estado.activities.filter((a) => a.tipo === 'ESTIM').length, 0, 'sugestão não cria atividade');
  const dec = f.estado.decisoes.find((d) => d.impacto === 'ESTIM' && d.donoId === '5')!;
  assert.equal(dec.sugeridoPor, '6');
  assert.equal(dec.decisao, null);
  assert.equal(f.estado.notificacoes.length, 1);
  assert.equal(f.estado.notificacoes[0]!.userId, 5);
  assert.match(String(f.estado.notificacoes[0]!.link), /triagem\?sinal=/);
});

test('fila do dono: mostra as pendências dele e a sugestão recebida; some quando ele decide', async () => {
  const { f, id } = cenario();
  await decidir(asPrisma(f), { signalId: id, usuarioId: '6', marcados: ['DEMO', 'ESTIM'], responsaveis: RESP });

  // Renato já decidiu as frentes dele (Demo sim, Estudo não): sai da fila dele
  const renato = await listarSinais(asPrisma(f), { status: ['NOVO'], usuarioId: '6', modo: 'minhas' });
  assert.equal(renato.itens.length, 0);

  // Arthur: Estimativa e Estudo pendentes, com a sugestão do Renato na Estimativa
  const arthur = await listarSinais(asPrisma(f), { status: ['NOVO'], usuarioId: '5', modo: 'minhas' });
  assert.equal(arthur.itens.length, 1);
  const item = arthur.itens[0] as unknown as { minhasPendentes: string[]; sugestoesParaMim: Array<{ impacto: string; sugeridoPor: string }> };
  assert.deepEqual(item.minhasPendentes.sort(), ['ESTIM', 'ESTUDO']);
  assert.deepEqual(item.sugestoesParaMim, [{ impacto: 'ESTIM', sugeridoPor: '6' }]);

  // "todas": o Renato continua vendo a novidade em aberto
  const todas = await listarSinais(asPrisma(f), { status: ['NOVO'], usuarioId: '6', modo: 'todas' });
  assert.equal(todas.itens.length, 1);
});

test('quando todos os donos decidem, a novidade sai da fila geral (TRIADO)', async () => {
  const { f, id } = cenario();
  await decidir(asPrisma(f), { signalId: id, usuarioId: '6', marcados: ['DEMO'], responsaveis: RESP });
  await decidir(asPrisma(f), { signalId: id, usuarioId: '5', marcados: ['ESTIM'], responsaveis: RESP });
  const r = await decidir(asPrisma(f), { signalId: id, usuarioId: '7', marcados: [], responsaveis: RESP });

  assert.equal(r.status, 'TRIADO');
  assert.deepEqual(r.naoFazer.sort(), ['ESCOPO', 'ESTUDO']);
  assert.equal(f.estado.signals[0]!.status, 'TRIADO');
  const estim = f.estado.activities.find((a) => a.tipo === 'ESTIM')!;
  assert.equal(estim.responsavelId, '5');
  assert.equal(f.estado.initiatives.length, 1, 'uma iniciativa para a novidade, reaproveitada');
});

test('ninguém vai fazer nada: a novidade sai como DESCARTADO', async () => {
  const { f, id } = cenario();
  for (const u of ['6', '5', '7']) await decidir(asPrisma(f), { signalId: id, usuarioId: u, marcados: [], responsaveis: RESP });
  assert.equal(f.estado.signals[0]!.status, 'DESCARTADO');
  assert.equal(f.estado.activities.length, 0);
});

test('quem já decidiu as suas frentes e não marcou nada recebe erro claro', async () => {
  const { f, id } = cenario();
  await decidir(asPrisma(f), { signalId: id, usuarioId: '6', marcados: [], responsaveis: RESP });
  await assert.rejects(
    () => decidir(asPrisma(f), { signalId: id, usuarioId: '6', marcados: [], responsaveis: RESP }),
    /já decidiu/,
  );
});

test('sugestão não sobrescreve decisão já tomada pelo dono', async () => {
  const { f, id } = cenario();
  await decidir(asPrisma(f), { signalId: id, usuarioId: '5', marcados: [], responsaveis: RESP }); // Arthur: não
  const r = await decidir(asPrisma(f), { signalId: id, usuarioId: '6', marcados: ['ESTIM'], responsaveis: RESP });
  assert.deepEqual(r.sugestoes, []);
  assert.equal(f.estado.decisoes.find((d) => d.impacto === 'ESTIM')!.decisao, 'NAO_FAZER');
});
