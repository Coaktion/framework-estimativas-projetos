/**
 * Regras de triagem, geração e conclusão.
 *
 * O que estes testes protegem:
 *   · ESTUDO cria ficha e não toca artefato
 *   · o responsável é HERDADO do dono do artefato, não sorteado
 *   · artefato inexistente é criado sem dono (e isso é visível)
 *   · o DoD é um gate real, inclusive nas evidências obrigatórias
 *   · concluir grava a aplicação e incrementa a versão
 *   · declarada ≠ verificada: só artefato do portal ganha a data verificada
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { criarFakePrisma, semearArtefato, semearSinal } from './fake-prisma';
import { triar, descartar } from '../triage';
import { concluir, marcarDod, atribuir, incrementarVersao } from '../activities';
import { calcularSaude } from '../artifacts';
import { Impacto } from '../../config/taxonomy';

process.env.DATABASE_URL ??= 'postgresql://teste';

type Fake = ReturnType<typeof criarFakePrisma>;
const asPrisma = (f: Fake) => f as unknown as Parameters<typeof triar>[0];

// ──────────────────────────────── Triagem ───────────────────────────────────

test('a ordem canônica coloca ESTUDO primeiro, qualquer que seja a entrada', async () => {
  const f = criarFakePrisma();
  const s = semearSinal(f);
  semearArtefato(f, { chave: 'FRAMEWORK:VOICE', donoId: 'u-renato' });
  semearArtefato(f, { chave: 'ESCOPO:VOICE', tipo: 'ESCOPO', nome: 'Bloco escopo · Voice', donoId: 'u-renato' });
  semearArtefato(f, { chave: 'DEMO_TEMPLATE', tipo: 'DEMO_TEMPLATE', modulo: null, nome: 'Template de demo', donoId: 'u-carla' });

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

test('o responsável é herdado do dono do artefato', async () => {
  const f = criarFakePrisma();
  const s = semearSinal(f);
  semearArtefato(f, { chave: 'FRAMEWORK:VOICE', donoId: 'u-renato' });
  semearArtefato(f, {
    chave: 'DEMO_TEMPLATE', tipo: 'DEMO_TEMPLATE', modulo: null,
    nome: 'Template de demo', donoId: 'u-carla',
  });

  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.DEMO, Impacto.ESTIM],
    usuarioId: 'u-quem-triou',
  });

  const demo = r.atividades.find((a) => a.tipo === 'DEMO')!;
  const est = r.atividades.find((a) => a.tipo === 'ESTIM')!;
  assert.equal(demo.responsavelId, 'u-carla');
  assert.equal(est.responsavelId, 'u-renato');
  assert.notEqual(demo.responsavelId, 'u-quem-triou', 'não é quem triou');
});

test('artefato que não existe é criado SEM dono, e o card fica órfão', async () => {
  const f = criarFakePrisma();
  const s = semearSinal(f, { modulo: 'ANALYTICS', titulo: 'Agentic analytics (EAP)' });

  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.ESCOPO],
    usuarioId: 'u-renato',
  });

  assert.deepEqual(r.artefatosCriados, ['Bloco escopo · Analytics']);
  assert.equal(r.atividades[0]!.responsavelId, null, 'sem dono → sem responsável');
  const art = f.estado.artifacts.find((a) => a.chave === 'ESCOPO:ANALYTICS')!;
  assert.equal(art.donoId, null);
  assert.equal(art.fonteVerificacao, 'NENHUMA', 'nasce sem fonte de verificação');
});

test('triar o mesmo sinal duas vezes é erro, não duplicação', async () => {
  const f = criarFakePrisma();
  const s = semearSinal(f);
  semearArtefato(f, { chave: 'FRAMEWORK:VOICE', donoId: 'u-renato' });

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
  const s = semearSinal(f);
  semearArtefato(f, { chave: 'FRAMEWORK:VOICE', donoId: 'u1' });
  await triar(asPrisma(f), { signalId: s.id as string, impactos: [Impacto.ESTIM], usuarioId: 'u1' });
  assert.equal(f.estado.signals[0]!.status, 'TRIADO');
});

// ─────────────────────── DoD, conclusão e artefato ──────────────────────────

async function cenarioConclusao(over?: { fonteVerificacao?: string }) {
  const f = criarFakePrisma();
  const s = semearSinal(f);
  semearArtefato(f, {
    chave: 'FRAMEWORK:VOICE',
    donoId: 'u-renato',
    versao: '2026.Q2',
    fonteVerificacao: over?.fonteVerificacao ?? 'NENHUMA',
  });
  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.ESTIM],
    usuarioId: 'u-renato',
  });
  return { f, activityId: r.atividades[0]!.id, signalId: s.id as string };
}

test('não conclui com o DoD incompleto', async () => {
  const { f, activityId } = await cenarioConclusao();
  await assert.rejects(
    () => concluir(asPrisma(f), { activityId, usuarioId: 'u-renato' }),
    /Definition of Done incompleto/,
  );
});

test('item que exige evidência não fecha só com o check', async () => {
  const { f, activityId } = await cenarioConclusao();
  const dod = f.estado.activities[0]!.dod as Array<{ t: string; d: boolean; exigeEvidencia?: boolean }>;

  // marca tudo, mas sem anexar evidência onde é exigida
  for (let i = 0; i < dod.length; i++) {
    await marcarDod(asPrisma(f), { activityId, indice: i, feito: true });
  }
  const exigentes = dod.filter((i) => i.exigeEvidencia).length;
  assert.ok(exigentes > 0, 'o template EST tem item com evidência obrigatória');

  await assert.rejects(
    () => concluir(asPrisma(f), { activityId, usuarioId: 'u-renato' }),
    /sem evidência anexada/,
  );

  // anexa e agora fecha
  for (let i = 0; i < dod.length; i++) {
    if (dod[i]!.exigeEvidencia) {
      await marcarDod(asPrisma(f), {
        activityId, indice: i, feito: true,
        evidencia: 'https://portal.aktienow.com/framework/voice/changelog#v2026Q3',
      });
    }
  }
  const r = await concluir(asPrisma(f), { activityId, usuarioId: 'u-renato' });
  assert.equal(r.artefato?.versao, '2026.Q3');
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

async function concluirTudo(f: Fake, activityId: string, usuarioId = 'u-renato') {
  const dod = f.estado.activities.find((a) => a.id === activityId)!.dod as Array<{
    exigeEvidencia?: boolean;
  }>;
  for (let i = 0; i < dod.length; i++) {
    await marcarDod(asPrisma(f), {
      activityId, indice: i, feito: true,
      ...(dod[i]!.exigeEvidencia ? { evidencia: 'https://evidencia/exemplo' } : {}),
    });
  }
  return concluir(asPrisma(f), { activityId, usuarioId });
}

test('concluir grava a aplicação: artefato ← sinal ← atividade', async () => {
  const { f, activityId, signalId } = await cenarioConclusao();
  await concluirTudo(f, activityId);

  assert.equal(f.estado.artifactSignals.length, 1);
  const ap = f.estado.artifactSignals[0]!;
  assert.equal(ap.signalId, signalId);
  assert.equal(ap.activityId, activityId);
  assert.equal(ap.versaoResultante, '2026.Q3');
});

test('artefato NÃO do portal: avança só a data declarada', async () => {
  const { f, activityId } = await cenarioConclusao({ fonteVerificacao: 'GDRIVE' });
  await concluirTudo(f, activityId);

  const art = f.estado.artifacts[0]!;
  assert.ok(art.revisaoDeclaradaEm, 'declarada preenchida');
  assert.equal(art.revisaoVerificadaEm, null, 'verificada permanece vazia — é do reconciliador');
});

test('artefato do portal: a escrita é a prova, verificada avança junto', async () => {
  const { f, activityId } = await cenarioConclusao({ fonteVerificacao: 'PORTAL' });
  await concluirTudo(f, activityId);

  const art = f.estado.artifacts[0]!;
  assert.ok(art.revisaoDeclaradaEm);
  assert.ok(art.revisaoVerificadaEm, 'verificada preenchida por construção');
  assert.equal(art.divergente, false);
});

test('quem conclui assume o artefato órfão', async () => {
  const f = criarFakePrisma();
  const s = semearSinal(f, { modulo: 'ANALYTICS' });
  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.ESCOPO],
    usuarioId: 'u-lucas',
  });
  await concluirTudo(f, r.atividades[0]!.id, 'u-lucas');
  assert.equal(f.estado.artifacts[0]!.donoId, 'u-lucas');
});

test('concluir duas vezes é erro', async () => {
  const { f, activityId } = await cenarioConclusao();
  await concluirTudo(f, activityId);
  await assert.rejects(
    () => concluir(asPrisma(f), { activityId, usuarioId: 'u-renato' }),
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

test('concluir ESTUDO publica a ficha', async () => {
  const f = criarFakePrisma();
  const s = semearSinal(f);
  const r = await triar(asPrisma(f), {
    signalId: s.id as string,
    impactos: [Impacto.ESTUDO],
    usuarioId: 'u-bruno',
  });
  const res = await concluirTudo(f, r.atividades[0]!.id, 'u-bruno');

  assert.equal(res.fichaPublicada, true);
  assert.equal(res.artefato, null);
  assert.ok(f.estado.studyNotes[0]!.publicadoEm, 'ficha ganhou data de publicação');
  assert.equal(f.estado.studyNotes[0]!.autorId, 'u-bruno');
});

// ─────────────────────────── Versão e semáforo ──────────────────────────────

test('incremento de versão cobre os formatos que usamos', () => {
  assert.equal(incrementarVersao('11'), '12');
  assert.equal(incrementarVersao('2026.Q2'), '2026.Q3');
  assert.equal(incrementarVersao('1'), '2');
  assert.equal(incrementarVersao('v'), 'v.1');
});

test('semáforo usa a data VERIFICADA, não a declarada', () => {
  const hoje = new Date('2026-08-12T00:00:00Z');
  const ontem = new Date('2026-08-11T00:00:00Z');
  const antigo = new Date('2026-01-01T00:00:00Z');

  // Declarada ontem, verificada em janeiro: NÃO pode aparecer saudável.
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

test('sem fonte de verificação o estado é NAO_VERIFICADO, não saudável', () => {
  const s = calcularSaude(
    {
      revisaoDeclaradaEm: new Date('2026-08-11T00:00:00Z'),
      revisaoVerificadaEm: null,
      fonteVerificacao: 'NENHUMA',
      divergente: false,
      pendentes: 0,
    },
    new Date('2026-08-12T00:00:00Z'),
  );
  assert.equal(s.estado, 'NAO_VERIFICADO');
  assert.match(s.detalhe, /declarada, não confirmada/);
});

test('divergente vence qualquer idade', () => {
  const s = calcularSaude(
    {
      revisaoDeclaradaEm: new Date('2026-08-11T00:00:00Z'),
      revisaoVerificadaEm: new Date('2026-08-11T00:00:00Z'),
      fonteVerificacao: 'GDRIVE',
      divergente: true,
      pendentes: 0,
    },
    new Date('2026-08-12T00:00:00Z'),
  );
  assert.equal(s.estado, 'DIVERGENTE');
});

test('muitos sinais pendentes derrubam para crítico mesmo com idade boa', () => {
  const s = calcularSaude(
    {
      revisaoDeclaradaEm: new Date('2026-08-11T00:00:00Z'),
      revisaoVerificadaEm: new Date('2026-08-11T00:00:00Z'),
      fonteVerificacao: 'PORTAL',
      divergente: false,
      pendentes: 9,
    },
    new Date('2026-08-12T00:00:00Z'),
  );
  assert.equal(s.estado, 'CRITICO');
});
