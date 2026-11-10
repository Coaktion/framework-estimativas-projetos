/**
 * Os cálculos de Resumo e Relatório conferidos contra os números que a
 * própria planilha mostrava (com "hoje" = 10/11/2026), usando a carga inicial.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularRelatorio, calcularResumo, corEscala, segundaDaSemana } from '../calculo';
import { REGISTROS_INICIAIS, TOPICOS_INICIAIS } from '../dados-iniciais';

const ID: Record<string, number> = { Renato: 6, Matheus: 1, Arthur: 5, Elisa: 7 };
const pessoas = [6, 1, 5, 7];
const topicos = TOPICOS_INICIAIS.map((t, i) => ({ id: `t${i}`, categoria: t.categoria, nivelAlvo: null }));
const niveis = TOPICOS_INICIAIS.flatMap((t, i) =>
  Object.entries(t.niveis).map(([nome, nivel]) => ({ topicoId: `t${i}`, userId: ID[nome]!, nivel })),
);
const registros = REGISTROS_INICIAIS.map((r) => ({ userId: ID[r.pessoa]!, data: r.data, categoria: r.categoria, tipo: r.tipo }));
const categorias = Array.from(new Set(TOPICOS_INICIAIS.map((t) => t.categoria)));
const perto = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test('a semana é a segunda-feira da data', () => {
  assert.equal(segundaDaSemana('2026-11-10'), '2026-11-09');
  assert.equal(segundaDaSemana('2026-11-09'), '2026-11-09');
  assert.equal(segundaDaSemana('2026-11-15'), '2026-11-09', 'domingo fecha a semana');
});

test('Resumo: média da categoria igual à da planilha', () => {
  const r = calcularResumo(topicos, niveis, pessoas);
  const media = (prefixo: string) => r.linhas.find((l) => l.categoria.startsWith(prefixo))!.mediaCategoria;
  perto(media('A.'), 3.791666667);
  perto(media('B.'), 3.479166667);
  perto(media('G.'), 2.479166667);
  perto(media('J.'), 0.9166666667);
  perto(r.geral.mediaCategoria, 2.783088235);
  assert.equal(r.linhas.length, 16, 'as 16 categorias A–P');
  assert.equal(r.geral.gap, null, 'sem nível-alvo, sem gap');
});

test('Resumo: gap = alvo médio − média; pessoa sem nível fica de fora da média', () => {
  const ts = [{ id: 'a', categoria: 'X', nivelAlvo: 4 }, { id: 'b', categoria: 'X', nivelAlvo: 2 }];
  const ns = [{ topicoId: 'a', userId: 1, nivel: 2 }, { topicoId: 'b', userId: 1, nivel: 1 }];
  const r = calcularResumo(ts, ns, [1, 2]);
  assert.equal(r.linhas[0]!.porPessoa[1], 1.5);
  assert.equal(r.linhas[0]!.porPessoa[2], null);
  assert.equal(r.linhas[0]!.mediaCategoria, 1.5);
  assert.equal(r.linhas[0]!.alvoMedio, 3);
  assert.equal(r.linhas[0]!.gap, 1.5);
});

test('Relatório: números da planilha em 10/11/2026', () => {
  const rel = calcularRelatorio(registros, pessoas, categorias, '2026-11-10');
  assert.equal(rel.primeiraSemana, '2026-06-29');
  assert.equal(rel.semanaAtual, '2026-11-09');
  assert.equal(rel.semanas, 20);
  assert.equal(rel.total, 34);

  const p = (id: number | 'TIME') => rel.porPessoa.find((l) => l.userId === id)!;
  assert.deepEqual([p(6).treinamentos, p(1).treinamentos, p(5).treinamentos, p(7).treinamentos], [11, 10, 10, 3]);
  assert.deepEqual([p(6).pctSemanas, p(1).pctSemanas, p(5).pctSemanas, p(7).pctSemanas], [0.4, 0.3, 0.5, 0.15]);
  assert.equal(p('TIME').pctSemanas, 0.75);
  assert.equal(p(6).mediaPorSemana, 0.55);
  assert.equal(p('TIME').mediaPorSemana, 1.7);
  assert.deepEqual([p(6).diasSemRegistrar, p(1).diasSemRegistrar, p(5).diasSemRegistrar, p(7).diasSemRegistrar], [6, 26, 1, 8]);
  assert.equal(p('TIME').ultimos30, 10);

  const tipoRenato = rel.porTipo.find((l) => l.userId === 6)!.contagem;
  assert.equal(tipoRenato['Curso'], 4);
  assert.equal(tipoRenato['Doc + Lab'], 2);
  const tipoTime = rel.porTipo.find((l) => l.userId === 'TIME')!.contagem;
  assert.equal(tipoTime['Hands-on/Lab'], 10);

  const catE = rel.porCategoria.find((l) => l.categoria.startsWith('E.'))!;
  assert.deepEqual([catE.porPessoa[6], catE.porPessoa[1], catE.porPessoa[5], catE.porPessoa[7], catE.time], [8, 4, 2, 1, 15]);

  assert.equal(rel.porSemana.length, 20);
  assert.equal(rel.porSemana[0]!.semana, '2026-11-09');
  const s1012 = rel.porSemana.find((s) => s.semana === '2026-10-12')!;
  assert.equal(s1012.time, 6);
});

test('escala de cor: 0 vermelho, 2 amarelo, 4 verde', () => {
  assert.equal(corEscala(0), 'rgb(248, 113, 113)');
  assert.equal(corEscala(2), 'rgb(252, 233, 176)');
  assert.equal(corEscala(4), 'rgb(127, 209, 113)');
  assert.equal(corEscala(null), undefined);
});
