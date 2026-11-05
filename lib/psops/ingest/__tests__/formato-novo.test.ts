/**
 * Formato das release notes a partir de out/2026 e a reconstrução da fila.
 *
 * O que estes testes protegem:
 *   · o índice antes do 1º H2 e a seção "no updates" não viram sinal
 *   · bullet que só agrupa (rótulo + lista dentro) não vira sinal: os filhos
 *     viram, com o rótulo no título — sem duplicata e sem texto emendado
 *   · <p><strong>Fixed</strong></p> marca correção → vai para o arquivo
 *   · H3 sob H2 é componente; "<strong>Nome</strong>: descrição" vira título
 *   · reconstrução: artigo sem decisão humana é quebrado de novo; com decisão,
 *     não é tocado
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { criarFakePrisma } from '../../services/__tests__/fake-prisma';
import { parseReleaseNote } from '../parser';
import { tituloDoBruto } from '../artigo';
import { ClassificadorPorRegras, VERSAO_REGRAS } from '../classify';
import { avaliarEscopo, avaliarRuido, decidirArquivamento, MOTIVO_ESCOPO } from '../noise';
import { reconstruirArtigos } from '../collector';

process.env.DATABASE_URL ??= 'postgresql://teste';

/** Recorte fiel da "Release notes through 2026-10-23". */
const NOVO_FORMATO = `
<div class="note tip">See the <a href="https://support.zendesk.com/hc/en-us/articles/1">What's New</a> section.</div>
<p>This week's release notes include:</p>
<ul>
  <li><a href="#ai_agents">AI agents</a></li>
  <li><a href="#contact_center">Contact Center</a></li>
  <li><a href="#no_updates">Products with no updates this week</a></li>
</ul>
<h2 id="ai_agents">AI agents</h2>
<p><strong>New</strong></p>
<h3>AI Agents Insights</h3>
<ul><li><div><strong>Article and procedure recommendations for email</strong>: AI agent onboarding now includes article and procedure recommendations for the email channel.</div></li></ul>
<h2 id="contact_center">Contact Center</h2>
<p><strong>Fixed</strong></p>
<ul><li class="wysiwyg-list-bold"><strong>Contact Center</strong><ul>
  <li>Voicemail tickets now keep tags added by triggers and business rules when the voicemail tag is applied.</li>
  <li>Dialer country selection now includes more countries supported by Amazon Connect, including Iraq and Laos.</li>
</ul></li></ul>
<h2 id="app_marketplace">App Marketplace</h2>
<ul><li class="wysiwyg-list-bold"><a href="https://www.zendesk.com/marketplace/apps/support/1301619/rastro-for-bling/"><strong>Rastro for Bling</strong></a><strong> (Support) (paid)</strong><ul>
  <li>Rastro for Bling matches a ticket requester to a Bling customer by email, CPF, or CNPJ, and shows the customer's latest orders and their status in the ticket sidebar.</li>
</ul></li></ul>
<h2 id="no_updates">Products with no updates this week</h2>
<ul><li>Workforce management (WFM)</li><li>Zendesk Analytics and Explore</li></ul>
`;

test('formato novo: índice e "no updates" ficam fora; grupo não vira sinal, os filhos sim', () => {
  const s = parseReleaseNote(NOVO_FORMATO);
  assert.equal(s.length, 4, 'insights + 2 do Contact Center + Rastro');
  assert.ok(!s.some((x) => /This week|no updates|Workforce/i.test(x.texto)), 'índice e seção vazia não entram');
  assert.ok(!s.some((x) => x.texto.startsWith('Contact Center')), 'o bullet que só agrupa não vira sinal');

  const voicemail = s.find((x) => x.texto.startsWith('Voicemail'))!;
  assert.equal(voicemail.rotulo, 'Contact Center');
  assert.equal(voicemail.marcador, 'Fixed');

  const rastro = s.find((x) => x.texto.startsWith('Rastro'))!;
  assert.equal(rastro.rotulo, 'Rastro for Bling (Support) (paid)');
  assert.ok(!rastro.texto.includes('(paid)'), 'o texto é só a descrição, sem o rótulo emendado');

  const insights = s.find((x) => x.texto.startsWith('Article and procedure'))!;
  assert.equal(insights.grupoComponente, 'AI Agents Insights', 'H3 sob H2 é componente');
  assert.equal(insights.marcador, 'New');
  assert.equal(insights.destaque, 'Article and procedure recommendations for email');
});

test('título: nome em negrito ou primeira frase, com o rótulo/componente na frente', () => {
  const s = parseReleaseNote(NOVO_FORMATO);
  const porTexto = (ini: string) => tituloDoBruto(s.find((x) => x.texto.startsWith(ini))!);

  assert.equal(porTexto('Article and procedure'), 'AI Agents Insights: Article and procedure recommendations for email');
  assert.match(porTexto('Rastro'), /^Rastro for Bling \(Support\) \(paid\): Rastro for Bling matches a ticket requester/);
  // rótulo igual ao produto (Contact Center) não se repete: já aparece como etiqueta
  assert.equal(
    porTexto('Voicemail'),
    'Voicemail tickets now keep tags added by triggers and business rules when the voicemail tag is applied',
  );
});

test('classificação: item sob <p><strong>Fixed</strong> é correção e vai para o arquivo', async () => {
  const s = parseReleaseNote(NOVO_FORMATO);
  const voicemail = s.find((x) => x.texto.startsWith('Voicemail'))!;
  const c = await new ClassificadorPorRegras().classificar(voicemail, { fonte: 'Release notes', tituloArtigo: 'Release notes', labels: [] });
  assert.equal(c.tipo, 'FIX_MINOR', 'o "now keep" do texto não engana mais');
  const d = decidirArquivamento(
    avaliarEscopo({
      texto: voicemail.texto, fonte: 'Release notes', tituloArtigo: 'Release notes',
      grupoProduto: voicemail.grupoProduto, grupoComponente: voicemail.grupoComponente,
      produto: c.produto, tipo: c.tipo,
    }),
    avaliarRuido(voicemail),
  );
  assert.deepEqual(d, { arquivar: true, motivo: MOTIVO_ESCOPO.correcao });
});

// ─────────────────────────────── Reconstrução ───────────────────────────────

function semear(f: ReturnType<typeof criarFakePrisma>) {
  f.estado.sources.push({
    id: 'src', key: 'zendesk-updates', nome: 'Release notes', kind: 'CATEGORY',
    zendeskId: '1', locale: 'en-us', isLiveArticle: false, ativo: true, watermark: null,
  });
  const raw = (id: string, externalId: string) => ({
    id, sourceId: 'src', externalId, titulo: 'Release notes through 2026-10-23',
    htmlUrl: `https://support.zendesk.com/hc/en-us/articles/${externalId}`, secaoId: null,
    criadoEm: new Date('2026-10-23T00:00:00Z'), labels: [], bodyHash: id,
    payload: { title: 'Release notes through 2026-10-23', body: NOVO_FORMATO, section_id: null },
    traducaoPtEm: new Date('2026-10-24T00:00:00Z'),
  });
  f.estado.rawItems.push(raw('raw-livre', '100'), raw('raw-triado', '200'));
  // sinais do leitor antigo: o grupo emendado + um filho duplicado
  const sinal = (id: string, rawItemId: string, status: string) => ({
    id, rawItemId, ancora: '2.0.1', assinatura: id, titulo: 'Contact Center Voicemail…',
    trechoOriginal: 'Contact Center Voicemail tickets…', produto: 'CONTACT_CENTER', modulo: 'CONTACT_CENTER',
    tipo: 'GA', score: 68, impactosSugeridos: [], classificadoPor: 'regras@2', motivoRuido: null, status,
  });
  f.estado.signals.push(
    sinal('velho-1', 'raw-livre', 'NOVO'),
    sinal('velho-2', 'raw-livre', 'AUTO_ARQUIVADO'),
    sinal('velho-3', 'raw-triado', 'NOVO'),
    sinal('velho-4', 'raw-triado', 'TRIADO'),
  );
}

test('reconstrução: artigo sem decisão humana é quebrado de novo com o leitor atual', async () => {
  const f = criarFakePrisma();
  semear(f);

  const r = await reconstruirArtigos(f as never, new ClassificadorPorRegras());
  assert.equal(r.artigos, 1);
  assert.equal(r.sinaisRemovidos, 2);

  const livres = f.estado.signals.filter((s) => s.rawItemId === 'raw-livre');
  assert.equal(livres.length, 4, 'os 4 sinais do leitor novo');
  assert.ok(livres.every((s) => s.classificadoPor === VERSAO_REGRAS));
  assert.ok(!livres.some((s) => s.id === 'velho-1' || s.id === 'velho-2'));
  assert.equal(f.estado.rawItems.find((x) => x.id === 'raw-livre')!.traducaoPtEm, null, 'tradução volta a pendente');

  // com uma decisão humana, o artigo não é tocado
  const triados = f.estado.signals.filter((s) => s.rawItemId === 'raw-triado').map((s) => s.id).sort();
  assert.deepEqual(triados, ['velho-3', 'velho-4']);
  assert.ok(f.estado.rawItems.find((x) => x.id === 'raw-triado')!.traducaoPtEm instanceof Date);

  // idempotente: na segunda passada não há artigo para reconstruir
  const r2 = await reconstruirArtigos(f as never, new ClassificadorPorRegras());
  assert.equal(r2.artigos, 0);
});
