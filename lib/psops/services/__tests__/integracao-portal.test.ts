/**
 * O que mudou ao entrar no Tool Center: nomes de pessoas vêm do User do portal
 * e a prévia da triagem cobre os quatro destinos.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { IMPACTOS_ORDEM } from '../../config/taxonomy';
import { previaImpactos } from '../signals';
import { iniciaisDe, pessoasPorId } from '../usuarios';
import { criarFakePrisma, semearArtefato } from './fake-prisma';

test('iniciais: primeiro e último nome; nome único vira duas letras', () => {
  assert.equal(iniciaisDe('Renato Zanetti'), 'RZ');
  assert.equal(iniciaisDe('  Ana Maria de Souza '), 'AS');
  assert.equal(iniciaisDe('rzanetti'), 'RZ');
  assert.equal(iniciaisDe(''), '?');
});

test('pessoasPorId ignora id que não é do User do portal (não numérico) sem consultar o banco', async () => {
  let consultou = false;
  const prisma = {
    user: {
      findMany: async () => {
        consultou = true;
        return [];
      },
    },
  };
  const r = await pessoasPorId(prisma as never, ['dev-renato', null, undefined, '']);
  assert.deepEqual(r, {});
  assert.equal(consultou, false);
});

test('pessoasPorId usa o nome e, sem nome, o começo do e-mail', async () => {
  const prisma = {
    user: {
      findMany: async ({ where }: { where: { id: { in: number[] } } }) => {
        assert.deepEqual(where.id.in.sort(), [7, 9]);
        return [
          { id: 7, name: 'Renato Zanetti', email: 'rzanetti@aktienow.com' },
          { id: 9, name: null, email: 'mtavares@aktienow.com' },
        ];
      },
    },
  };
  const r = await pessoasPorId(prisma as never, ['7', '9', '7']);
  assert.equal(r['7']?.nome, 'Renato Zanetti');
  assert.equal(r['7']?.iniciais, 'RZ');
  assert.equal(r['9']?.nome, 'mtavares');
});

test('prévia com os quatro destinos herda o dono de cada artefato', async () => {
  const fake = criarFakePrisma();
  semearArtefato(fake, { chave: 'DEMO_TEMPLATE', tipo: 'DEMO_TEMPLATE', nome: 'Template de demo', donoId: '3' });
  semearArtefato(fake, { chave: 'FRAMEWORK:VOICE', donoId: '7' });
  // ESCOPO:VOICE não existe: aparece como artefato novo, sem dono

  const previa = await previaImpactos(fake as never, 'VOICE', IMPACTOS_ORDEM);

  assert.deepEqual(
    previa.map((p) => p.impacto),
    ['ESTUDO', 'DEMO', 'ESTIM', 'ESCOPO'],
  );
  const por = Object.fromEntries(previa.map((p) => [p.impacto, p]));
  assert.equal(por.ESTUDO!.artefatoChave, null, 'estudo gera ficha, não toca artefato');
  assert.equal(por.DEMO!.responsavelId, '3');
  assert.equal(por.ESTIM!.responsavelId, '7');
  assert.equal(por.ESCOPO!.artefatoExiste, false);
  assert.equal(por.ESCOPO!.responsavelId, null);
});
