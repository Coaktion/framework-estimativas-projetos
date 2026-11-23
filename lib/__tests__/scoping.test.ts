/**
 * Scoping (RNF-06): integridade do seed, fallback de tradução, regras de
 * mapeamento de catálogo (RF-30), completude (RF-13), exportação e o caso de
 * regressão Nimbo Varejo (Apêndice B).
 *
 * O catálogo usado na simulação é o fixture congelado de framework-catalog.json
 * (o mesmo do teste do prompt de escopo); os números de horas aqui conferem o
 * comportamento do motor, não o catálogo de produção.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSeedBank } from '../scoping/seed';
import { validateAgainstCatalog } from '../scoping/bank';
import { tr, normalizeScopingLang } from '../scoping/i18n';
import { mapAnswersToItems } from '../scoping/mapping';
import { completeness, pendingItems, suggestedByAnswers, suggestedTracks, visibleQuestions, meetingOrder } from '../scoping/rules';
import { groupByStage, inTier, stageOf, suggestTier, tierOf, unmappedSections } from '../scoping/themes';
import { simulateScopingEstimate } from '../scoping/estimate';
import { exportMarkdown, exportXlsx } from '../scoping/export';
import { answerValueSchema, type Bank, type SessionAnswer } from '../scoping/types';
import { NIMBO_BASE, NIMBO_CONTEXT, NIMBO_TRACKS, nimboFull } from './fixtures/scoping-nimbo';
import { dictionaries } from '../../app/i18n/resources';

const catalog = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'framework-catalog.json'), 'utf8'));
const bank: Bank = { id: 1, ...buildSeedBank() };

const a = (questionKey: string, v: unknown, extra: Partial<SessionAnswer> = {}): SessionAnswer => ({
  questionKey, value: { v: v as any }, status: 'respondida', pendingOwner: null, pendingDue: null, naReason: null,
  source: 'manual', sourceRef: null, version: 1, ...extra,
});
const qtyOf = (items: { itemId: number; quantity: number }[], id: number) => items.find((i) => i.itemId === id)?.quantity ?? 0;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

test('seed: keys únicas, seções existentes e três idiomas em todo texto', () => {
  const keys = bank.questions.map((q) => q.key);
  assert.equal(new Set(keys).size, keys.length, 'key duplicada');
  const sections = new Set(bank.sections.map((s) => s.key));
  const trackKeys = new Set(bank.tracks.map((t) => t.key));
  for (const q of bank.questions) {
    assert.ok(sections.has(q.sectionKey), `${q.key}: seção ${q.sectionKey} não existe`);
    q.trackKeys.forEach((t) => assert.ok(trackKeys.has(t) || t === 'product.callwe', `${q.key}: trilha ${t} não existe`));
    for (const l of ['pt', 'en', 'es'] as const) assert.ok(q.text[l]?.trim(), `${q.key}: texto ${l} vazio`);
    q.options.forEach((o) => ['pt', 'en', 'es'].forEach((l) => assert.ok((o.label as any)[l], `${q.key}/${o.value}: opção sem ${l}`)));
    if (q.showIf) assert.ok(keys.includes(q.showIf.questionKey), `${q.key}: showIf aponta para key inexistente`);
    if (q.type === 'table' || q.type === 'ai_usecases') assert.ok(q.tableColumns.length > 0, `${q.key}: tabela sem colunas`);
    if (q.type === 'single' || q.type === 'multi') assert.ok(q.options.length > 0, `${q.key}: escolha sem opções`);
  }
  for (const s of bank.sections) for (const l of ['pt', 'en', 'es'] as const) assert.ok(s.title[l], `seção ${s.key} sem título ${l}`);
});

test('seed: RF-04, nenhuma pergunta de quantidade guardada como texto nas perguntas da Aktie', () => {
  const quantityWords = /^(quantos|quantas)\b/i;
  const offenders = bank.questions.filter((q) => quantityWords.test(q.text.pt || '') && !['number', 'table', 'ai_usecases'].includes(q.type));
  assert.deepEqual(offenders.map((q) => q.key), []);
});

test('seed: as perguntas não pressupõem que o cliente já escolheu o Zendesk', () => {
  const rx = /zendesk|go-live|implanta[çc][ãa]o|implementaci[óo]n|implementation|vai usar|will you use/i;
  const offenders = bank.questions.filter((q) => (['pt', 'en', 'es'] as const).some((l) => rx.test(q.text[l] || '')));
  assert.deepEqual(offenders.map((q) => `${q.key}: ${q.text.pt}`), []);
});

test('seed: todo item mapeado existe no catálogo de produção (conferido em 18/11/2026)', () => {
  // IDs ativos no get_catalog de produção em 18/11/2026.
  const PROD_IDS = new Set([1, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 47, 49, 50, 51, 52, 53, 56, 61, 62, 64, 66, 67, 68, 69, 70, 73, 74, 75, 77, 78, 83, 84, 85, 86, 87, 88, 89, 92, 93, 94, 95, 96, 97, 98, 105, 106, 110, 111, 112, 116, 117, 118, 119, 120, 121, 122, 125, 128, 133, 134, 135, 138, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 178, 179, 181, 182, 183, 184, 185, 186, 187, 188, 193, 194, 196, 197, 211, 222, 223, 224, 228, 229, 230, 231, 234]);
  const { warnings } = validateAgainstCatalog(buildSeedBank(), PROD_IDS);
  assert.deepEqual(warnings, []);
});

test('seed: RF-31, item inexistente sai do mapeamento e vira aviso', () => {
  const ids = new Set<number>([17]);
  const { bank: b, warnings } = validateAgainstCatalog(buildSeedBank(), ids);
  assert.ok(warnings.length > 0);
  const agents = b.questions.find((q) => q.key === 'core.users.agents')!;
  assert.equal(agents.catalogMappings.length, 1);
  const macros = b.questions.find((q) => q.key === 'core.macros')!;
  assert.equal(macros.catalogMappings.length, 0);
  assert.ok(b.tracks.every((t) => t.fixedItems.every((f) => ids.has(f.itemId))));
});

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

test('i18n: fallback idioma da sessão → pt → en', () => {
  assert.equal(tr({ pt: 'Olá', en: 'Hi', es: 'Hola' }, 'es'), 'Hola');
  assert.equal(tr({ pt: 'Olá', en: 'Hi' }, 'es'), 'Olá');
  assert.equal(tr({ en: 'Hi' }, 'es'), 'Hi');
  assert.equal(tr(null, 'pt'), '');
  assert.equal(normalizeScopingLang('pt-BR'), 'pt');
  assert.equal(normalizeScopingLang('fr'), 'pt');
});

test('i18n: as chaves scoping.* existem nos três idiomas da tela', () => {
  const flat = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
  const pt = flat(dictionaries.pt.scoping).sort();
  assert.deepEqual(flat(dictionaries.en.scoping).sort(), pt);
  assert.deepEqual(flat(dictionaries.es.scoping).sort(), pt);
});

// ---------------------------------------------------------------------------
// Mapeamento (RF-30, RF-11, RF-33)
// ---------------------------------------------------------------------------

test('mapeamento: quantity soma agentes + light agents no item 17', () => {
  const r = mapAnswersToItems(bank, [], [a('core.users.agents', 140), a('core.users.light_agents', 20)]);
  assert.equal(qtyOf(r.items, 17), 160);
});

test('mapeamento: faixa usa o máximo e marca isRange (RF-11)', () => {
  const r = mapAnswersToItems(bank, [], [a('core.macros', { min: 40, max: 60 })]);
  const item = r.items.find((i) => i.itemId === 56)!;
  assert.equal(item.quantity, 60);
  assert.equal(item.isRange, true);
});

test('mapeamento: fixed_if_yes e fixed_if_positive (92 uma vez com painéis e relatórios)', () => {
  const r = mapAnswersToItems(bank, [], [a('core.sso', 'sim'), a('core.csat', 'nao'), a('core.analytics.dashboards', 4), a('core.analytics.reports', 3)]);
  assert.equal(qtyOf(r.items, 14), 1);
  assert.equal(qtyOf(r.items, 70), 0);
  assert.equal(qtyOf(r.items, 94), 4);
  assert.equal(qtyOf(r.items, 93), 3);
  assert.equal(qtyOf(r.items, 92), 1);
});

test('mapeamento: per_option com quantidade vinda de outra pergunta', () => {
  const r = mapAnswersToItems(bank, [], [
    a('core.channels.list', ['whatsapp', 'web_widget', 'email_domain', 'voice']),
    a('core.channels.whatsapp_numbers', 2),
  ]);
  assert.equal(qtyOf(r.items, 222), 2);
  assert.equal(qtyOf(r.items, 32), 1);
  assert.equal(qtyOf(r.items, 112), 1, 'sem a quantidade de e-mails, vale 1');
});

test('mapeamento: combine max evita contar formulário duas vezes (núcleo × ITSM)', () => {
  const r = mapAnswersToItems(bank, ['usecase.itsm_cmdb'], [a('core.forms', 4), a('itsm.catalog_items', 10)]);
  assert.equal(qtyOf(r.items, 27), 10);
});

test('mapeamento: table_count, table_item_qty e ai_usecase_complexity', () => {
  const r = mapAnswersToItems(bank, ['product.ai_agents'], [
    a('core.apps.marketplace', [{ app: 'A' }, { app: 'B' }, { app: '' }]),
    a('core.training.groups', [{ training: 'support_agent', groups: 3 }, { training: 'voice_agent' }]),
    a('ai.usecases', [{ name: 'x', complexity: 'simples' }, { name: 'y', complexity: 'simples' }, { name: 'z', complexity: 'complexo' }]),
  ]);
  assert.equal(qtyOf(r.items, 73), 2, 'linha vazia não conta');
  assert.equal(qtyOf(r.items, 193), 3);
  assert.equal(qtyOf(r.items, 196), 1, 'turmas vazias = 1');
  assert.equal(qtyOf(r.items, 106), 2);
  assert.equal(qtyOf(r.items, 164), 1);
  assert.equal(qtyOf(r.items, 163), 0);
});

test('mapeamento: só respondidas contam; pendente vira "sem quantidade"; trilha inativa não aparece', () => {
  const r = mapAnswersToItems(bank, [], [
    a('core.macros', 80, { status: 'pendente', pendingOwner: 'TI', pendingDue: '2026-12-01' }),
    a('ai.bots', 2),
  ]);
  assert.equal(qtyOf(r.items, 56), 0);
  assert.ok(r.missing.includes('core.macros'));
  assert.equal(qtyOf(r.items, 105), 0, 'ai.bots fora das trilhas ativas');
});

test('mapeamento: itens fixos das trilhas e requiresTrack', () => {
  const r = mapAnswersToItems(bank, ['product.voice_zcc'], [a('voice.outbound', 3)]);
  assert.equal(qtyOf(r.items, 1), 1);
  assert.equal(qtyOf(r.items, 228), 1);
  assert.equal(qtyOf(r.items, 49), 1);
  assert.equal(qtyOf(r.items, 211), 0, 'campanhas só com a trilha CallWe');
  assert.ok(r.manual.some((m) => m.questionKey === 'zcc.queues'), 'ZCC sem item no catálogo vira hora manual');
});

// ---------------------------------------------------------------------------
// Regras da sessão
// ---------------------------------------------------------------------------

test('visibilidade: showIf esconde a pergunta até a resposta disparar', () => {
  const keys = (ans: SessionAnswer[]) => visibleQuestions(bank, [], ans).map((q) => q.key);
  assert.ok(!keys([]).includes('core.channels.whatsapp_numbers'));
  assert.ok(keys([a('core.channels.list', ['whatsapp'])]).includes('core.channels.whatsapp_numbers'));
});

test('completude (RF-13): pendente exige dono e prazo; NA exige motivo', () => {
  const ess = visibleQuestions(bank, [], []).filter((q) => q.priority === 'essencial');
  const all = ess.map((q) => a(q.key, null, { status: 'nao_se_aplica', naReason: 'teste' }));
  assert.equal(completeness(bank, [], all).canComplete, true);

  const noReason = all.map((x, i) => (i === 0 ? { ...x, naReason: null } : x));
  assert.equal(completeness(bank, [], noReason).canComplete, false);

  const pendNoDue = all.map((x, i) => (i === 0 ? { ...x, status: 'pendente' as const, naReason: null, pendingOwner: 'TI' } : x));
  assert.equal(completeness(bank, [], pendNoDue).canComplete, false);
  const pendOk = pendNoDue.map((x, i) => (i === 0 ? { ...x, pendingDue: '2026-12-01' } : x));
  assert.equal(completeness(bank, [], pendOk).canComplete, true);
  assert.equal(pendingItems(bank, [], pendOk)[0].owner, 'TI');
});

test('remover trilha esconde as perguntas, mas a resposta continua (RF-09)', () => {
  const ans = [a('ai.bots', 2)];
  assert.ok(visibleQuestions(bank, ['product.ai_agents'], ans).some((q) => q.key === 'ai.bots'));
  assert.ok(!visibleQuestions(bank, [], ans).some((q) => q.key === 'ai.bots'));
  assert.equal(ans.length, 1);
});

test('sugestão de trilhas: SKU ES sugere ITSM/ESM', () => {
  assert.ok(suggestedTracks(bank.tracks, { sku: 'ES', plan: 'professional', deploymentType: 'new' }).includes('usecase.itsm_cmdb'));
  assert.ok(!suggestedTracks(bank.tracks, { sku: 'CS', plan: 'professional', deploymentType: 'new' }).includes('usecase.itsm_cmdb'));
});

test('Modo reunião: essenciais primeiro', () => {
  const order = meetingOrder(visibleQuestions(bank, [], []), bank);
  const firstNonEss = order.findIndex((q) => q.priority !== 'essencial');
  assert.ok(order.slice(firstNonEss).every((q) => q.priority !== 'essencial'));
});

test('validação do valor por tipo', () => {
  assert.equal(answerValueSchema('number').safeParse({ v: { min: 5, max: 2 } }).success, false);
  assert.equal(answerValueSchema('number').safeParse({ v: { min: 2, max: 5 } }).success, true);
  assert.equal(answerValueSchema('yes_no').safeParse({ v: 'talvez' }).success, false);
  assert.equal(answerValueSchema('date').safeParse({ v: '2026-12-01' }).success, true);
});

// ---------------------------------------------------------------------------
// Simulação e regressão Nimbo
// ---------------------------------------------------------------------------

test('simulação: chama o motor sem gravar e avisa item fora do plano', () => {
  const r = mapAnswersToItems(bank, [], [a('core.users.custom_roles', 2), a('core.macros', 10)]);
  const est = simulateScopingEstimate(catalog, { plan: 'professional', sku: 'CS', deploymentType: 'new' }, r.items);
  assert.ok(est.grandTotal > 0);
  assert.ok(est.warnings.some((w) => w.kind === 'item_off_plan' && w.itemId === 18), 'Funções exige Enterprise no CS');
  const ent = simulateScopingEstimate(catalog, { plan: 'enterprise', sku: 'CS', deploymentType: 'new' }, r.items);
  assert.ok(!ent.warnings.some((w) => 'itemId' in w && w.itemId === 18));
  assert.ok(ent.grandTotal > est.grandTotal);
});

test('Nimbo Varejo: as perguntas novas sobem a simulação', () => {
  const base = mapAnswersToItems(bank, NIMBO_TRACKS, NIMBO_BASE);
  const full = mapAnswersToItems(bank, NIMBO_TRACKS, nimboFull());
  const hBase = simulateScopingEstimate(catalog, NIMBO_CONTEXT, base.items).grandTotal;
  const hFull = simulateScopingEstimate(catalog, NIMBO_CONTEXT, full.items).grandTotal;
  // Apêndice B: 25 visualizações, 8 menus de URA, 6 procedimentos do Copilot, 10 ações e 8 entidades.
  assert.equal(qtyOf(full.items, 116), 25);
  assert.equal(qtyOf(full.items, 53), 8);
  assert.equal(qtyOf(full.items, 98), 6);
  assert.equal(qtyOf(full.items, 168), 10);
  assert.equal(qtyOf(full.items, 169), 8);
  assert.equal(qtyOf(full.items, 196), 2);
  assert.equal(qtyOf(full.items, 188), 1);
  assert.equal(qtyOf(full.items, 197), 2);
  assert.equal(qtyOf(full.items, 182), 1);
  assert.ok(hFull > hBase, `${hFull} deveria ser maior que ${hBase}`);
  if (process.env.SCOPING_DEBUG) console.log(`Nimbo (catálogo do fixture): base ${hBase} h, com as novas ${hFull} h`);
});

test('Nimbo Varejo: só conclui depois que as essenciais tiverem status', () => {
  assert.equal(completeness(bank, NIMBO_TRACKS, nimboFull()).canComplete, false);
});

test('exportação: Markdown e .xlsx com respostas e pendências', async () => {
  const answers = [...nimboFull(), a('mig.source', null, { status: 'pendente', pendingOwner: 'Gerente de CX', pendingDue: '2026-12-10' })];
  const s = { clientName: 'Nimbo Varejo', title: '', language: 'pt' as const, ...NIMBO_CONTEXT, trackKeys: [...NIMBO_TRACKS, 'usecase.migration'], status: 'em_andamento', createdAt: '2026-11-18T12:00:00Z' };
  const md = exportMarkdown(bank, s, answers, 'pt', 'nota livre');
  assert.match(md, /# Scoping · Nimbo Varejo/);
  assert.match(md, /\(visualizações\)\?/);
  assert.match(md, /Gerente de CX/);
  assert.match(md, /nota livre/);
  assert.doesNotMatch(md, /\bh\b.*horas/i);
  const en = exportMarkdown(bank, s, answers, 'en');
  assert.match(en, /\(views\)\?/);
  const buf = await exportXlsx(bank, s, answers, 'es');
  assert.ok(buf.length > 5000);
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
});

// ---------------------------------------------------------------------------
// Banco v3: obrigatórias, situacionais, temas e trilhas sugeridas pela conversa
// ---------------------------------------------------------------------------

test('v3: poucas obrigatórias no núcleo e só elas travam a conclusão', () => {
  const start = visibleQuestions(bank, [], []);
  const req = start.filter((q) => q.priority === 'essencial');
  assert.ok(req.length <= 12, `núcleo começa com ${req.length} obrigatórias`);
  const done = req.map((q) => a(q.key, 'x', { status: 'nao_se_aplica', naReason: 'teste' }));
  assert.equal(completeness(bank, [], done).canComplete, true, 'recomendadas em branco não travam');
});

test('v3: situacionais aparecem só quando a conversa pede', () => {
  const keys = (ans: SessionAnswer[]) => new Set(visibleQuestions(bank, [], ans).map((q) => q.key));
  assert.ok(!keys([]).has('core.ctx.platforms'));
  assert.ok(keys([a('core.ctx.decision_stage', 'evaluating')]).has('core.ctx.platforms'));
  assert.ok(!keys([a('core.ctx.decision_stage', 'zendesk_customer')]).has('core.ctx.platforms'));
  assert.ok(!keys([]).has('core.slas.breach_handling'));
  assert.ok(keys([a('core.slas.existing', 'sim')]).has('core.slas.breach_handling'));
  assert.ok(keys([a('core.channels.list', ['instagram'])]).has('core.channels.social_pages'), 'multi com "in"');
  assert.ok(keys([a('core.integrations.systems', 'ERP')]).has('core.integrations.read_write'), 'answered');
});

test('v3: obrigatória escondida não trava (ex.: plataformas quando já usa Zendesk)', () => {
  const c = completeness(bank, [], [a('core.ctx.decision_stage', 'zendesk_customer')]);
  assert.ok(!c.essentialOpen.some((q) => q.key === 'core.ctx.platforms'));
});

test('v3: situacional vem logo depois da pergunta que a dispara', () => {
  const sec = bank.questions.filter((q) => q.sectionKey === 'slas').map((q) => q.key);
  assert.equal(sec[sec.indexOf('core.slas.existing') + 1], 'core.slas.targets');
});

test('v3: duplicadas do template saíram', () => {
  const keys = new Set(bank.questions.map((q) => q.key));
  ['core.ai_agent.handoff', 'core.migration.source_platform', 'core.hidden.agent_lookups'].forEach((k) => assert.ok(!keys.has(k), k));
});

test('etapas: toda seção tem etapa e a reunião abre pela abertura', () => {
  assert.deepEqual(unmappedSections(bank), []);
  const groups = groupByStage(bank, visibleQuestions(bank, [], []));
  assert.equal(groups[0].stage.key, 'opening');
  assert.equal(groups[0].questions[0].key, 'core.ctx.problem');
});

test('etapas: contagens de configuração ficam para depois da reunião', () => {
  const q = (k: string) => bank.questions.find((x) => x.key === k)!;
  assert.equal(stageOf(q('core.macros')), 'after');
  assert.equal(stageOf(q('core.rules.triggers_simple')), 'after');
  assert.equal(stageOf(q('core.training.groups')), 'after');
  assert.equal(stageOf(q('core.users.agents')), 'operation', 'nº de agentes é do roteiro');
  assert.equal(stageOf(q('ai.usecases')), 'future');
});

test('porte: a reunião cresce de P para G e as obrigatórias estão sempre no P', () => {
  const vis = visibleQuestions(bank, [], []);
  const meeting = (tier: 'P' | 'M' | 'G') => vis.filter((x) => stageOf(x) !== 'after' && inTier(x, tier)).length;
  assert.ok(meeting('P') < meeting('M') && meeting('M') < meeting('G'), `${meeting('P')} ${meeting('M')} ${meeting('G')}`);
  assert.ok(meeting('M') <= 30, `porte médio com ${meeting('M')} perguntas no início`);
  bank.questions.filter((x) => x.priority === 'essencial').forEach((x) => assert.equal(tierOf(x), 'P', x.key));
  assert.ok(vis.some((x) => x.priority === 'opcional' && !inTier(x, 'G')), 'aprofundamento só com "aprofundar"');
});

test('porte: sugestão por agentes e trilhas', () => {
  assert.equal(suggestTier(20, []), 'P');
  assert.equal(suggestTier(80, []), 'M');
  assert.equal(suggestTier(20, ['usecase.migration']), 'G');
  assert.equal(suggestTier(400, []), 'G');
});

test('trilhas sugeridas pela conversa', () => {
  assert.deepEqual(suggestedByAnswers(bank.tracks, [], []), []);
  assert.ok(suggestedByAnswers(bank.tracks, [], [a('core.channels.list', ['voice'])]).includes('product.voice_zcc'));
  assert.ok(!suggestedByAnswers(bank.tracks, ['product.voice_zcc'], [a('core.channels.list', ['voice'])]).includes('product.voice_zcc'), 'já ativa');
  assert.ok(!suggestedTracks(bank.tracks, { sku: 'CS', plan: 'professional', deploymentType: 'new' }).includes('product.voice_zcc'), 'regra de resposta não vira regra de contexto');
});
