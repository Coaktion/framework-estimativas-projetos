/**
 * Quem comanda a operação do Radar (coletar, reconciliar, definir donos).
 *
 * O que estes testes protegem:
 *   · admin do portal é sempre gestor
 *   · e-mail listado em PSOPS_GESTORES é gestor, sem diferença de caixa/espaços
 *   · a lista aceita vírgula, ponto e vírgula, espaço e quebra de linha
 *   · sem lista (ou e-mail vazio), só admin é gestor — nunca "todo mundo"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ehGestorPor, parseGestores } from '../../lib/gestores';

test('admin é gestor mesmo sem lista', () => {
  assert.equal(ehGestorPor({ admin: true, email: 'x@aktienow.com' }, parseGestores(undefined)), true);
});

test('e-mail listado é gestor, sem diferença de caixa e espaços', () => {
  const lista = parseGestores('  RZanetti@AktieNow.com ');
  assert.equal(ehGestorPor({ admin: false, email: 'rzanetti@aktienow.com' }, lista), true);
  assert.equal(ehGestorPor({ admin: false, email: ' RZANETTI@aktienow.com' }, lista), true);
});

test('lista aceita vírgula, ponto e vírgula, espaço e quebra de linha', () => {
  const lista = parseGestores('a@aktienow.com, b@aktienow.com;c@aktienow.com d@aktienow.com\ne@aktienow.com');
  assert.deepEqual(Array.from(lista).sort(), ['a@aktienow.com', 'b@aktienow.com', 'c@aktienow.com', 'd@aktienow.com', 'e@aktienow.com']);
});

test('quem não é admin nem está na lista não é gestor', () => {
  const lista = parseGestores('rzanetti@aktienow.com');
  assert.equal(ehGestorPor({ admin: false, email: 'outra@aktienow.com' }, lista), false);
});

test('sem lista, ou sem e-mail, ninguém além de admin é gestor', () => {
  assert.equal(ehGestorPor({ admin: false, email: 'rzanetti@aktienow.com' }, parseGestores('')), false);
  assert.equal(ehGestorPor({ admin: false, email: null }, parseGestores('rzanetti@aktienow.com')), false);
  assert.equal(ehGestorPor({ admin: false, email: '' }, parseGestores(', ;')), false);
});
