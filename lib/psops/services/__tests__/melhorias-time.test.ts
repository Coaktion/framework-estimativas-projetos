/**
 * Melhorias pedidas pelo time (nov/2026):
 *   · commit num documento de estimativa gera tarefa SKILL para o Renato
 *   · fila de triagem: ordem por data de publicação e aba própria de EAPs
 *   · texto e link da novidade em espanhol com o portal em espanhol
 *   · relato resolvido avisa quem enviou
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { criarFakePrisma, semearArtefato, semearSinal } from './fake-prisma';
import { categoriaDoProduto } from '../../../estudos/radar';
import { registrarAtualizacao } from '../artifacts';
import { concluir } from '../activities';
import { abaDoSinal, ordenarFila, textoDoSinal, urlDaNota } from '../../client/tipos';
import { notificarRelatoResolvido } from '../../../notificacoes';

process.env.DATABASE_URL ??= 'postgresql://teste';

type Fake = ReturnType<typeof criarFakePrisma>;
const asPrisma = (f: Fake) => f as unknown as Parameters<typeof registrarAtualizacao>[0];

function comRenato(f: Fake) {
  f.estado.users.push({ id: 6, email: 'rzanetti@aktienow.com', name: 'Renato Zanetti' });
}

// ───────────────────────────── Tarefa de skill ──────────────────────────────

test('commit num documento de estimativa gera tarefa SKILL para o Renato, com aviso', async () => {
  const f = criarFakePrisma();
  comRenato(f);
  const art = semearArtefato(f, { chave: 'ESTIM:Canais - Voz', tipo: 'FRAMEWORK', nome: 'Estimativa · Zendesk Voice' });

  const r = await registrarAtualizacao(asPrisma(f), {
    artifactId: art.id as string,
    autorId: '5',
    descricao: 'Novo item de URA com IA',
  });

  assert.ok(r.tarefaSkill?.nova);
  const tarefas = f.estado.activities.filter((a) => a.tipo === 'SKILL');
  assert.equal(tarefas.length, 1);
  assert.equal(tarefas[0]!.responsavelId, '6');
  assert.equal(tarefas[0]!.artifactId, art.id);
  assert.equal(tarefas[0]!.initiativeId, null, 'commit direto no Mapa: sem novidade de origem');
  assert.match(String(tarefas[0]!.titulo), /Zendesk Voice: Novo item de URA/);
  assert.equal(f.estado.notificacoes.length, 1);
  assert.equal(f.estado.notificacoes[0]!.userId, 6);
});

test('segundo commit no mesmo documento não duplica a tarefa aberta, só avisa de novo', async () => {
  const f = criarFakePrisma();
  comRenato(f);
  const art = semearArtefato(f, { chave: 'ESTIM:Zendesk Support', tipo: 'FRAMEWORK', nome: 'Estimativa · Zendesk Support' });

  await registrarAtualizacao(asPrisma(f), { artifactId: art.id as string, autorId: '5', descricao: 'Revisão de horas de gatilhos' });
  const r = await registrarAtualizacao(asPrisma(f), { artifactId: art.id as string, autorId: '5', descricao: 'Item novo de SLA' });

  assert.equal(r.tarefaSkill?.nova, false);
  assert.equal(f.estado.activities.filter((a) => a.tipo === 'SKILL').length, 1);
  assert.equal(f.estado.notificacoes.length, 2);
});

test('demo e escopo não geram tarefa de skill', async () => {
  const f = criarFakePrisma();
  comRenato(f);
  const demo = semearArtefato(f, { chave: 'DEMO:BR', tipo: 'DEMO_TEMPLATE', nome: 'Ambiente de demo padrão Brasil' });
  const escopo = semearArtefato(f, { chave: 'ESCOPO:TM:PT', tipo: 'ESCOPO', nome: 'Time & Materials · PT' });

  await registrarAtualizacao(asPrisma(f), { artifactId: demo.id as string, autorId: '6', descricao: 'Gatilho novo na demo' });
  await registrarAtualizacao(asPrisma(f), { artifactId: escopo.id as string, autorId: '7', descricao: 'Cláusula nova de horas' });

  assert.equal(f.estado.activities.filter((a) => a.tipo === 'SKILL').length, 0);
});

test('concluir uma tarefa SKILL não pede artefato nem gera outra tarefa', async () => {
  const f = criarFakePrisma();
  comRenato(f);
  const art = semearArtefato(f, { chave: 'ESTIM:Zendesk QA', tipo: 'FRAMEWORK', nome: 'Estimativa · Zendesk QA' });
  const r = await registrarAtualizacao(asPrisma(f), { artifactId: art.id as string, autorId: '5', descricao: 'Horas de calibração' });

  await concluir(asPrisma(f) as never, { activityId: r.tarefaSkill!.id, usuarioId: '6' });

  const tarefas = f.estado.activities.filter((a) => a.tipo === 'SKILL');
  assert.equal(tarefas.length, 1);
  assert.equal(tarefas[0]!.status, 'DONE');
});

// ─────────────────────────────── Fila de triagem ────────────────────────────

const sinal = (id: string, score: number, publicadoEm: string, extra: Record<string, unknown> = {}) => ({
  id,
  score,
  publicadoEm,
  criadoEm: publicadoEm,
  produto: 'SUPPORT' as const,
  eap: false,
  ...extra,
});

test('fila por data: novidade publicada mais recentemente primeiro; relevância mantém a ordem do score', () => {
  const itens = [sinal('a', 90, '2026-10-01T00:00:00Z'), sinal('b', 40, '2026-11-10T00:00:00Z'), sinal('c', 70, '2026-11-01T00:00:00Z')];
  assert.deepEqual(ordenarFila(itens, 'data').map((s) => s.id), ['b', 'c', 'a']);
  assert.deepEqual(ordenarFila(itens, 'relevancia').map((s) => s.id), ['a', 'b', 'c']);
});

test('EAPs e betas têm aba própria; o resto vai pelo módulo', () => {
  assert.equal(abaDoSinal({ produto: 'AI_AGENTS', eap: true }), 'EAP');
  assert.equal(abaDoSinal({ produto: 'AI_AGENTS', eap: false }), 'AI_AGENTS');
  assert.equal(abaDoSinal({ produto: 'MARKETPLACE' }), 'OUTROS');
});

// ─────────────────────────────────── Espanhol ───────────────────────────────

test('portal em espanhol mostra a tradução em espanhol; sem ela, o original', () => {
  const s = {
    titulo: 'Voice AI agents',
    trechoOriginal: 'EN text',
    tituloPt: 'Agentes de IA de voz',
    trechoPt: 'texto PT',
    tituloEs: 'Agentes de IA de voz (ES)',
    trechoEs: 'texto ES',
  };
  assert.equal(textoDoSinal(s, 'es').titulo, 'Agentes de IA de voz (ES)');
  assert.equal(textoDoSinal(s, 'pt').titulo, 'Agentes de IA de voz');
  const semEs = textoDoSinal({ ...s, tituloEs: null, trechoEs: null }, 'es');
  assert.equal(semEs.titulo, 'Voice AI agents');
  assert.equal(semEs.pendente, true);
});

test('link da nota em espanhol com o portal em espanhol; senão pt-br', () => {
  const url = 'https://support.zendesk.com/hc/en-us/articles/123-Release-notes';
  assert.equal(urlDaNota(url, 'es'), 'https://support.zendesk.com/hc/es/articles/123');
  assert.equal(urlDaNota(url, 'en'), 'https://support.zendesk.com/hc/pt-br/articles/123');
  assert.equal(urlDaNota(url), 'https://support.zendesk.com/hc/pt-br/articles/123');
});

// ──────────────────────────────── Relatos ───────────────────────────────────

test('relato resolvido avisa quem enviou, com a atualização escrita', async () => {
  const f = criarFakePrisma();
  const ok = await notificarRelatoResolvido(
    f as never,
    { id: 12, userId: 30, kind: 'bug', body: 'O botão de salvar não funciona', pageUrl: '/sc/project/4' },
    6,
    'Corrigido no deploy de hoje',
  );
  assert.equal(ok, true);
  const n = f.estado.notificacoes[0]!;
  assert.equal(n.userId, 30);
  assert.equal(n.titulo, 'Seu bug foi resolvido');
  assert.match(String(n.corpo), /Atualização: Corrigido no deploy de hoje/);
  assert.match(String(n.corpo), /Relato #12/);
  assert.equal(n.link, '/sc/project/4');
});

test('quem resolve o próprio relato não é avisado; relato anônimo também não', async () => {
  const f = criarFakePrisma();
  assert.equal(await notificarRelatoResolvido(f as never, { id: 1, userId: 6, kind: 'suggestion', body: 'x' }, 6), false);
  assert.equal(await notificarRelatoResolvido(f as never, { id: 2, userId: null, kind: 'bug', body: 'x' }, 6), false);
  assert.equal(f.estado.notificacoes.length, 0);
});

// ─────────────────────── Estudo concluído → área Estudos ────────────────────

function estudoDoRadar(f: Fake, produto: string, responsavelId = '6') {
  const s = semearSinal(f, { produto, titulo: 'Voice AI agents', tituloPt: 'Agentes de IA de voz' });
  f.estado.initiatives.push({ id: 'ini-1', signalId: s.id, titulo: 'x', ciclo: '2026-W46' });
  f.estado.activities.push({
    id: 'act-estudo',
    initiativeId: 'ini-1',
    tipo: 'ESTUDO',
    titulo: 'Estudar: Voice AI agents',
    responsavelId,
    status: 'TODO',
    artifactId: null,
    dod: [],
  });
  f.estado.studyNotes.push({ id: 'stn-1', signalId: s.id, comoFunciona: 'Testei no sandbox', versao: 1, publicadoEm: null });
  for (const c of ['B. Zendesk Support — Core de Tickets', 'E. Zendesk IA & Automação Inteligente']) {
    f.estado.estudoTopicos.push({ id: c, categoria: c, topico: 't', ordem: 0 });
  }
}

test('estudo concluído vira registro nos Estudos, na categoria do módulo', async () => {
  const f = criarFakePrisma();
  estudoDoRadar(f, 'AI_AGENTS');

  const r = await concluir(asPrisma(f) as never, { activityId: 'act-estudo', usuarioId: '6' });

  assert.equal(r.estudo?.registrado, true);
  const reg = f.estado.estudoRegistros[0]!;
  assert.equal(reg.userId, 6);
  assert.equal(reg.categoria, 'E. Zendesk IA & Automação Inteligente');
  assert.equal(reg.atividade, 'Radar: Agentes de IA de voz');
  assert.equal(reg.tipo, 'Documentação');
  assert.equal(reg.observacoes, 'Testei no sandbox');
  assert.equal(reg.atividadeRadarId, 'act-estudo');
});

test('sem categoria correspondente, não registra e devolve a sugestão para a janela', async () => {
  const f = criarFakePrisma();
  estudoDoRadar(f, 'OUTRO');

  const r = await concluir(asPrisma(f) as never, { activityId: 'act-estudo', usuarioId: '6' });

  assert.equal(r.estudo?.registrado, false);
  assert.equal(f.estado.estudoRegistros.length, 0);
  if (r.estudo && !r.estudo.registrado) {
    assert.equal(r.estudo.motivo, 'sem_categoria');
    assert.equal(r.estudo.sugestao.atividade, 'Radar: Agentes de IA de voz');
    assert.equal(r.estudo.sugestao.categorias.length, 2);
  }
});

test('categoria casa pela letra: renomear a categoria na matriz não quebra', () => {
  assert.equal(categoriaDoProduto('SUPPORT', ['B. Support (novo nome)']), 'B. Support (novo nome)');
  assert.equal(categoriaDoProduto('WFM', ['B. x']), null);
});

test('concluir, reabrir e concluir de novo não duplica o registro', async () => {
  const f = criarFakePrisma();
  estudoDoRadar(f, 'SUPPORT');
  await concluir(asPrisma(f) as never, { activityId: 'act-estudo', usuarioId: '6' });
  f.estado.activities.find((a) => a.id === 'act-estudo')!.status = 'DOING';
  await concluir(asPrisma(f) as never, { activityId: 'act-estudo', usuarioId: '6' });
  assert.equal(f.estado.estudoRegistros.length, 1);
});
