/**
 * Regras de triagem, geração e conclusão.
 *
 * O que estes testes protegem:
 *   · ESTUDO cria ficha e não toca artefato
 *   · Estimativa já aponta para o módulo do produto; Demo e Escopo apontam
 *     para o grupo, e os artefatos se escolhem na conclusão
 *   · o DoD é um gate real, inclusive nas evidências obrigatórias
 *   · concluir Demo/Estimativa/Escopo exige artefato(s) e descrição, e grava
 *     um commit em cada artefato marcado (versão +1, última atualização)
 *   · o responsável vem da configuração do time; sem ela, do dono do artefato
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { criarFakePrisma, semearArtefato, semearSinal } from './fake-prisma';
import { triar, descartar } from '../triage';
import { concluir, marcarDod, atribuir, incrementarVersao, moverAtividade } from '../activities';
import { calcularSaude, historicoArtefato, registrarAtualizacao, saudePorAtualizacao } from '../artifacts';
import { garantirArtefatos } from '../seed';
import { Impacto } from '../../config/taxonomy';

process.env.DATABASE_URL ??= 'postgresql://teste';

type Fake = ReturnType<typeof criarFakePrisma>;
const asPrisma = (f: Fake) => f as unknown as Parameters<typeof triar>[0];

/** A estimativa do módulo de voz, como o seed cria a partir do Framework. */
function semearEstimativaVoz(f: Fake, over: Record<string, unknown> = {}) {
  return semearArtefato(f, {
    chave: 'ESTIM:Canais - Voz',
    tipo: 'FRAMEWORK',
    nome: 'Estimativa · Canais - Voz',
    ...over,
  });
}

function semearDemos(f: Fake) {
  return ['BR', 'US', 'SSAC'].map((p) =>
    semearArtefato(f, { chave: `DEMO:${p}`, tipo: 'DEMO_TEMPLATE', modulo: null, nome: `Ambiente de demo padrão ${p}`, versao: '1' }),
  );
}

const sinalVoz = (f: Fake, over: Record<string, unknown> = {}) =>
  semearSinal(f, { produto: 'CONTACT_CENTER', ...over });

// ──────────────────────────────── Triagem ───────────────────────────────────

test('a ordem canônica coloca ESTUDO primeiro, qualquer que seja a entrada', async () => {
  const f = criarFakePrisma();
  const s = sinalVoz(f);
  semearEstimativaVoz(f, { donoId: 'u-renato' });

  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.ESCOPO, Impacto.DEMO, Impacto.ESTUDO, Impacto.ESTIM],
    usuarioId: 'u-renato',
  });

  assert.deepEqual(r.atividades.map((a) => a.tipo), ['ESTUDO', 'DEMO', 'ESTIM', 'ESCOPO']);
});

test('ESTUDO cria a ficha da feature e não aponta para artefato', async () => {
  const f = criarFakePrisma();
  const s = semearSinal(f);

  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.ESTUDO],
    usuarioId: 'u-renato',
  });

  assert.equal(r.atividades.length, 1);
  assert.equal(r.atividades[0]!.artefato, null, 'estudo não toca artefato');
  assert.equal(f.estado.studyNotes.length, 1, 'ficha criada');
  assert.equal(f.estado.studyNotes[0]!.signalId, s.id);
  assert.equal(f.estado.studyNotes[0]!.activityId, r.atividades[0]!.id);
});

test('Estimativa aponta para o módulo do produto; Demo e Escopo para o grupo', async () => {
  const f = criarFakePrisma();
  const s = sinalVoz(f);
  const est = semearEstimativaVoz(f);
  semearArtefato(f, { chave: 'ESTIM:Zendesk Support', nome: 'Estimativa · Zendesk Support' });
  semearDemos(f);

  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.DEMO, Impacto.ESTIM, Impacto.ESCOPO],
    usuarioId: 'u-renato',
  });

  const ativ = (tipo: string) => f.estado.activities.find((a) => a.tipo === tipo)!;
  assert.equal(ativ('ESTIM').artifactId, est.id, 'voz → estimativa de Canais - Voz');
  assert.equal(ativ('DEMO').artifactId, null, 'os ambientes se escolhem na conclusão');
  assert.equal(ativ('ESCOPO').artifactId, null);
  assert.equal(r.atividades.find((a) => a.tipo === 'DEMO')!.artefato, 'Ambientes de demo (Brasil, EUA, SSAC)');
  assert.deepEqual(r.artefatosCriados, [], 'a triagem não cria artefato');
});

test('sem configuração do time, o responsável é o dono do artefato', async () => {
  const f = criarFakePrisma();
  const s = sinalVoz(f);
  semearEstimativaVoz(f, { donoId: 'u-arthur' });

  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.ESTIM, Impacto.DEMO],
    usuarioId: 'u-quem-triou',
  });
  assert.equal(r.atividades.find((a) => a.tipo === 'ESTIM')!.responsavelId, 'u-arthur');
  assert.equal(r.atividades.find((a) => a.tipo === 'DEMO')!.responsavelId, null, 'ninguém configurado → sem responsável');
});

test('triar o mesmo sinal duas vezes é erro, não duplicação', async () => {
  const f = criarFakePrisma();
  const s = sinalVoz(f);
  semearEstimativaVoz(f, { donoId: 'u-renato' });

  await triar(asPrisma(f), { signalId: s.id as string, impactos: [Impacto.ESTIM], usuarioId: 'u1' });
  await assert.rejects(
    () => triar(asPrisma(f), { signalId: s.id as string, impactos: [Impacto.ESTIM], usuarioId: 'u1' }),
    /já foi triado/i,
  );
  assert.equal(f.estado.activities.length, 1);
});

test('triagem sem impacto é rejeitada — use descartar', async () => {
  const f = criarFakePrisma();
  const s = semearSinal(f);
  await assert.rejects(
    () => triar(asPrisma(f), { signalId: s.id as string, impactos: [], usuarioId: 'u1' }),
    /ao menos um impacto/i,
  );
});

test('descarte registra o motivo, que é o que calibra o filtro de ruído', async () => {
  const f = criarFakePrisma();
  const s = semearSinal(f);
  await descartar(asPrisma(f), {
    signalId: s.id as string,
    usuarioId: 'u1',
    motivo: 'só muda tela do agente, sem impacto em ativo',
  });
  assert.equal(f.estado.signals[0]!.status, 'DESCARTADO');
  assert.match(String(f.estado.triages[0]!.motivoDescarte), /sem impacto/);
});

test('o sinal triado sai da fila', async () => {
  const f = criarFakePrisma();
  const s = sinalVoz(f);
  semearEstimativaVoz(f, { donoId: 'u1' });
  await triar(asPrisma(f), { signalId: s.id as string, impactos: [Impacto.ESTIM], usuarioId: 'u1' });
  assert.equal(f.estado.signals[0]!.status, 'TRIADO');
});

// ─────────────────────── DoD, conclusão e commits ───────────────────────────

async function cenarioConclusao() {
  const f = criarFakePrisma();
  const s = sinalVoz(f);
  const art = semearEstimativaVoz(f, { donoId: 'u-arthur', versao: '2026.Q2' });
  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.ESTIM],
    usuarioId: 'u-renato',
  });
  return { f, activityId: r.atividades[0]!.id, signalId: s.id as string, art };
}

async function marcarTudo(f: Fake, activityId: string) {
  const dod = f.estado.activities.find((a) => a.id === activityId)!.dod as Array<{
    exigeEvidencia?: boolean;
  }>;
  for (let i = 0; i < dod.length; i++) {
    await marcarDod(asPrisma(f), {
      activityId, indice: i, feito: true,
      ...(dod[i]!.exigeEvidencia ? { evidencia: 'https://evidencia/exemplo' } : {}),
    });
  }
}

async function concluirTudo(
  f: Fake,
  activityId: string,
  usuarioId = 'u-arthur',
  extra: { artefatoIds?: string[]; descricao?: string | null } = { descricao: 'Itens de voz com IA incluídos no módulo' },
) {
  await marcarTudo(f, activityId);
  return concluir(asPrisma(f), { activityId, usuarioId, ...extra });
}

test('conclui sem checklist: disse que está feito, está feito', async () => {
  const { f, activityId, art } = await cenarioConclusao();
  const r = await concluir(asPrisma(f), { activityId, usuarioId: 'u-arthur' });
  assert.equal(f.estado.activities[0]!.status, 'DONE');
  assert.deepEqual(r.artefatos, [], 'sem descrição não há commit');
  assert.equal(art.versao, '2026.Q2', 'artefato intocado');
});

test('marcar o primeiro item move TODO para DOING sozinho', async () => {
  const { f, activityId } = await cenarioConclusao();
  assert.equal(f.estado.activities[0]!.status, 'TODO');
  await marcarDod(asPrisma(f), { activityId, indice: 0, feito: true });
  assert.equal(f.estado.activities[0]!.status, 'DOING');
});

test('desmarcar item limpa a evidência (evita evidência órfã)', async () => {
  const { f, activityId } = await cenarioConclusao();
  await marcarDod(asPrisma(f), { activityId, indice: 5, feito: true, evidencia: 'https://x/y' });
  let dod = f.estado.activities[0]!.dod as Array<{ evidencia?: string | null }>;
  assert.equal(dod[5]!.evidencia, 'https://x/y');

  await marcarDod(asPrisma(f), { activityId, indice: 5, feito: false });
  dod = f.estado.activities[0]!.dod as Array<{ evidencia?: string | null }>;
  assert.equal(dod[5]!.evidencia, null);
});

test('concluir grava um commit no artefato: descrição, autor, atividade e feature', async () => {
  const { f, activityId, signalId, art } = await cenarioConclusao();
  await concluirTudo(f, activityId);

  assert.equal(f.estado.artifactUpdates.length, 1);
  const c = f.estado.artifactUpdates[0]!;
  assert.equal(c.artifactId, art.id);
  assert.equal(c.autorId, 'u-arthur');
  assert.equal(c.descricao, 'Itens de voz com IA incluídos no módulo');
  assert.equal(c.activityId, activityId);
  assert.equal(c.signalId, signalId);
  assert.equal(art.versao, '2026.Q3', 'versão sobe');
  assert.ok(art.revisaoDeclaradaEm instanceof Date, 'última atualização = agora');
  assert.equal(f.estado.artifactSignals.length, 0, 'a aplicação antiga não é mais gravada');
});

test('Demo: um commit em cada ambiente marcado', async () => {
  const f = criarFakePrisma();
  const s = sinalVoz(f);
  const [br, us, ssac] = semearDemos(f);
  const r = await triar(asPrisma(f), { signalId: s.id as string, impactos: [Impacto.DEMO], usuarioId: 'u-renato' });

  const res = await concluirTudo(f, r.atividades[0]!.id, 'u-renato', {
    artefatoIds: [br!.id as string, ssac!.id as string],
    descricao: 'Fluxo de voz com IA nos ambientes BR e SSAC',
  });
  assert.equal(res.artefatos.length, 2);
  assert.deepEqual(f.estado.artifactUpdates.map((u) => u.artifactId).sort(), [br!.id, ssac!.id].sort());
  assert.equal(us!.versao, '1', 'o ambiente não marcado fica como está');
  assert.equal(br!.versao, '2');
});

test('Demo sem artefato marcado não conclui', async () => {
  const f = criarFakePrisma();
  const s = sinalVoz(f);
  semearDemos(f);
  const r = await triar(asPrisma(f), { signalId: s.id as string, impactos: [Impacto.DEMO], usuarioId: 'u-renato' });
  await assert.rejects(
    () => concluirTudo(f, r.atividades[0]!.id, 'u-renato', { descricao: 'Ambientes atualizados' }),
    /Marque qual artefato/,
  );
  assert.equal(f.estado.activities[0]!.status !== 'DONE', true);
});

test('artefato marcado sem descrição não conclui; descrição vazia conclui sem commit', async () => {
  const { f, activityId, art } = await cenarioConclusao();
  await assert.rejects(
    () => concluir(asPrisma(f), { activityId, usuarioId: 'u-arthur', artefatoIds: [art.id as string], descricao: 'ok' }),
    /Descreva o que mudou/,
  );
  await concluir(asPrisma(f), { activityId, usuarioId: 'u-arthur', descricao: '   ' });
  assert.equal(f.estado.activities[0]!.status, 'DONE');
  assert.equal(f.estado.artifactUpdates.length, 0);
});

test('artefato de outro destino é recusado na conclusão', async () => {
  const { f, activityId } = await cenarioConclusao();
  const [br] = semearDemos(f);
  await assert.rejects(
    () => concluirTudo(f, activityId, 'u-arthur', { artefatoIds: [br!.id as string], descricao: 'Atualizei a demo' }),
    /não são deste destino/,
  );
});

test('quem conclui assume o artefato sem dono', async () => {
  const f = criarFakePrisma();
  const s = sinalVoz(f);
  const doc = semearArtefato(f, { chave: 'ESCOPO:PH_SE:PT', tipo: 'ESCOPO', modulo: null, nome: 'Custom SE Pacote de Horas · PT' });
  const r = await triar(asPrisma(f), { signalId: s.id as string, impactos: [Impacto.ESCOPO], usuarioId: 'u-lucas' });
  await concluirTudo(f, r.atividades[0]!.id, 'u-lucas', { artefatoIds: [doc.id as string], descricao: 'Cláusula de voz com IA' });
  assert.equal(doc.donoId, 'u-lucas');
});

test('concluir duas vezes é erro', async () => {
  const { f, activityId } = await cenarioConclusao();
  await concluirTudo(f, activityId);
  await assert.rejects(
    () => concluir(asPrisma(f), { activityId, usuarioId: 'u-arthur', descricao: 'de novo' }),
    /já concluída/i,
  );
});

test('atividade concluída não muda de responsável', async () => {
  const { f, activityId } = await cenarioConclusao();
  await concluirTudo(f, activityId);
  await assert.rejects(
    () => atribuir(asPrisma(f), { activityId, responsavelId: 'u-outro' }),
    /não muda de responsável/i,
  );
});

test('concluir ESTUDO publica a ficha e não pede artefato', async () => {
  const f = criarFakePrisma();
  const s = semearSinal(f);
  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.ESTUDO],
    usuarioId: 'u-bruno',
  });
  const res = await concluirTudo(f, r.atividades[0]!.id, 'u-bruno', {});

  assert.equal(res.fichaPublicada, true);
  assert.deepEqual(res.artefatos, []);
  assert.ok(f.estado.studyNotes[0]!.publicadoEm, 'ficha ganhou data de publicação');
  assert.equal(f.estado.studyNotes[0]!.autorId, 'u-bruno');
});

// ─────────────────────────── Mover o card no quadro ─────────────────────────

test('arrastar: A fazer → Em andamento → Concluídas → reabrir', async () => {
  const { f, activityId } = await cenarioConclusao();
  const at = () => f.estado.activities[0]!;
  await moverAtividade(asPrisma(f), { activityId, status: 'DOING', usuarioId: 'u-arthur' });
  assert.equal(at().status, 'DOING');
  await moverAtividade(asPrisma(f), { activityId, status: 'DONE', usuarioId: 'u-arthur' });
  assert.equal(at().status, 'DONE');
  assert.equal(at().concluidoPor, 'u-arthur');
  await moverAtividade(asPrisma(f), { activityId, status: 'TODO', usuarioId: 'u-arthur' });
  assert.equal(at().status, 'TODO');
  assert.equal(at().concluidoEm, null, 'reabrir apaga a data de conclusão');
});

test('arquivar tira do quadro e desarquivar devolve para A fazer', async () => {
  const { f, activityId } = await cenarioConclusao();
  await moverAtividade(asPrisma(f), { activityId, status: 'CANCELADA', usuarioId: 'u-renato' });
  assert.equal(f.estado.activities[0]!.status, 'CANCELADA');
  assert.equal(f.estado.activities[0]!.concluidoEm, null, 'arquivar não conclui');
  await moverAtividade(asPrisma(f), { activityId, status: 'TODO', usuarioId: 'u-renato' });
  assert.equal(f.estado.activities[0]!.status, 'TODO');
});

// ───────────────────── Registrar atualização pelo Mapa ──────────────────────

test('registrar atualização pelo Mapa: commit, versão e última atualização', async () => {
  const f = criarFakePrisma();
  const art = semearEstimativaVoz(f, { donoId: 'u-arthur', versao: '3' });
  const agora = new Date('2026-11-10T12:00:00Z');

  await registrarAtualizacao(asPrisma(f), { artifactId: art.id as string, autorId: 'u-arthur', descricao: 'Revisão geral de horas', agora });
  await registrarAtualizacao(asPrisma(f), { artifactId: art.id as string, autorId: 'u-arthur', descricao: 'Item novo de URA', agora });

  assert.equal(art.versao, '5');
  assert.equal(+(art.revisaoDeclaradaEm as Date), +agora);
  const h = await historicoArtefato(asPrisma(f), art.id as string);
  assert.deepEqual(h.atualizacoes.map((u) => u.descricao).sort(), ['Item novo de URA', 'Revisão geral de horas']);
  assert.equal(h.atualizacoes[0]!.sinal, null, 'commit avulso não tem feature');
});

test('descrição curta demais é recusada', async () => {
  const f = criarFakePrisma();
  const art = semearEstimativaVoz(f);
  await assert.rejects(
    () => registrarAtualizacao(asPrisma(f), { artifactId: art.id as string, autorId: 'u1', descricao: 'ok' }),
    /pelo menos 5/,
  );
  assert.equal(f.estado.artifactUpdates.length, 0);
});

// ─────────────────────── Seed da lista de artefatos ─────────────────────────

test('seed: 3 demos, uma estimativa por módulo do Framework e 15 documentos de escopo', async () => {
  const f = criarFakePrisma();
  semearTime(f);
  f.estado.categories.push(
    { name: 'Zendesk Support', displayName: 'Zendesk Support', isActive: true, parentName: null },
    { name: 'Canais - Voz', displayName: null, isActive: true, parentName: null },
    { name: 'Sub item', isActive: true, parentName: 'Zendesk Support' },
    { name: 'Antigo', isActive: false, parentName: null },
  );
  // formato antigo: o usado fica, o nunca usado sai
  semearArtefato(f, { chave: 'FRAMEWORK:VOICE', nome: 'Framework · Voice' });

  const n = await garantirArtefatos(asPrisma(f) as never);
  assert.equal(n, 3 + 2 + 15);
  const chaves = f.estado.artifacts.map((a) => a.chave as string);
  assert.ok(chaves.includes('DEMO:SSAC'));
  assert.ok(chaves.includes('ESTIM:Canais - Voz'));
  assert.ok(chaves.includes('ESCOPO:TM:ES'));
  assert.ok(!chaves.includes('ESTIM:Sub item'), 'só categorias raiz');
  assert.ok(!chaves.includes('ESTIM:Antigo'), 'só categorias ativas');
  assert.ok(!chaves.includes('FRAMEWORK:VOICE'), 'antigo sem uso sai');

  const dono = (chave: string) => f.estado.artifacts.find((a) => a.chave === chave)!.donoId;
  assert.equal(dono('DEMO:BR'), '6', 'Demo → Renato');
  assert.equal(dono('ESTIM:Zendesk Support'), '5', 'Estimativa → Arthur');
  assert.equal(dono('ESCOPO:PH_SE:EN'), '7', 'Escopo → Elisa');
  assert.equal(f.estado.artifacts.find((a) => a.chave === 'ESTIM:Canais - Voz')!.nome, 'Estimativa · Canais - Voz');

  // idempotente e não sobrescreve o dono escolhido no Mapa
  f.estado.artifacts.find((a) => a.chave === 'DEMO:BR')!.donoId = '60';
  await garantirArtefatos(asPrisma(f) as never);
  assert.equal(f.estado.artifacts.length, 20);
  assert.equal(dono('DEMO:BR'), '60');
});

// ─────────────────────────── Versão e semáforo ──────────────────────────────

test('incremento de versão cobre os formatos que usamos', () => {
  assert.equal(incrementarVersao('11'), '12');
  assert.equal(incrementarVersao('2026.Q2'), '2026.Q3');
  assert.equal(incrementarVersao('1'), '2');
  assert.equal(incrementarVersao('v'), 'v.1');
});

test('saúde pela última atualização: nunca, recente e antiga', () => {
  const hoje = new Date('2026-11-10T00:00:00Z');
  assert.equal(saudePorAtualizacao(null, 0, hoje).estado, 'NAO_VERIFICADO');
  const recente = saudePorAtualizacao(new Date('2026-11-08T00:00:00Z'), 0, hoje);
  assert.equal(recente.estado, 'SAUDAVEL');
  assert.equal(recente.idadeDias, 2);
  assert.equal(saudePorAtualizacao(new Date('2026-01-01T00:00:00Z'), 0, hoje).estado, 'CRITICO');
});

test('semáforo antigo usa a data VERIFICADA, não a declarada', () => {
  const hoje = new Date('2026-08-12T00:00:00Z');
  const ontem = new Date('2026-08-11T00:00:00Z');
  const antigo = new Date('2026-01-01T00:00:00Z');

  const s = calcularSaude(
    {
      revisaoDeclaradaEm: ontem,
      revisaoVerificadaEm: antigo,
      fonteVerificacao: 'GDRIVE',
      divergente: false,
      pendentes: 0,
    },
    hoje,
  );
  assert.equal(s.estado, 'CRITICO');
  assert.equal(s.idadeDias, 223);
  assert.equal(s.idadeDeclaradaDias, 1);
});

// ─────────────────────── Responsáveis por destino ───────────────────────────

/** O time real, como está no cadastro de usuários do portal. */
function semearTime(f: Fake) {
  f.estado.users.push(
    { id: 6, email: 'rzanetti@aktienow.com', name: 'Renato Zanetti' },
    { id: 5, email: 'aoliveira@aktienow.com', name: 'Arthur Oliveira' },
    { id: 1, email: 'msouza@aktienow.com', name: 'Matheus Souza' },
    { id: 7, email: 'esimicevic@aktienow.com', name: 'Elisa Simicevic' },
    { id: 60, email: 'fcastro@aktienow.com', name: 'Francisco Alexander' },
  );
}

test('cada destino vai para o dono configurado: Demo Renato, Estimativa Arthur, Escopo Elisa', async () => {
  const f = criarFakePrisma();
  semearTime(f);
  const s = sinalVoz(f);
  // dono do artefato é outra pessoa: a configuração do time vale mais
  semearEstimativaVoz(f, { donoId: 'u-outro' });

  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.DEMO, Impacto.ESTIM, Impacto.ESCOPO],
    usuarioId: '6',
  });
  const de = (tipo: string) => r.atividades.filter((a) => a.tipo === tipo).map((a) => a.responsavelId);
  assert.deepEqual(de('DEMO'), ['6']);
  assert.deepEqual(de('ESTIM'), ['5']);
  assert.deepEqual(de('ESCOPO'), ['7']);
});

test('Estudo gera uma atividade para cada SE e UMA ficha compartilhada', async () => {
  const f = criarFakePrisma();
  semearTime(f);
  const s = semearSinal(f);

  const r = await triar(asPrisma(f), { signalId: s.id as string, impactos: [Impacto.ESTUDO], usuarioId: '6' });
  const estudos = r.atividades.filter((a) => a.tipo === 'ESTUDO');
  assert.deepEqual(estudos.map((a) => a.responsavelId).sort(), ['1', '5', '6', '60', '7']);
  assert.equal(f.estado.studyNotes.length, 1, 'uma ficha só para a feature');
  assert.equal(f.estado.studyNotes[0]!.signalId, s.id);

  // concluir o estudo de qualquer um publica a ficha da feature
  const res = await concluirTudo(f, estudos[3]!.id, '7', {});
  assert.equal(res.fichaPublicada, true);
  assert.ok(f.estado.studyNotes[0]!.publicadoEm instanceof Date);
  // os outros estudos continuam abertos: cada SE conclui o seu
  assert.equal(f.estado.activities.filter((a) => a.tipo === 'ESTUDO' && a.status !== 'DONE').length, 4);
});

test('pessoa da configuração que não está no cadastro é ignorada, sem quebrar a triagem', async () => {
  const f = criarFakePrisma();
  f.estado.users.push({ id: 6, email: 'rzanetti@aktienow.com', name: 'Renato Zanetti' });
  const s = semearSinal(f);
  const r = await triar(asPrisma(f), { signalId: s.id as string, impactos: [Impacto.ESTUDO, Impacto.ESCOPO], usuarioId: '6' });
  assert.deepEqual(r.atividades.filter((a) => a.tipo === 'ESTUDO').map((a) => a.responsavelId), ['6']);
  assert.deepEqual(r.atividades.filter((a) => a.tipo === 'ESCOPO').map((a) => a.responsavelId), [null], 'Elisa não está no cadastro → sem responsável');
});
