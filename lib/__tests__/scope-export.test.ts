/**
 * Prompt de escopo (v3) contra dois casos reais:
 *  - Framework: projeto Logos (163), versão V1 (212), 189h — dados do Tool
 *    Center e catálogo da biblioteca congelados em fixtures/;
 *  - Calculadora AE: Elemental Machines (inputs da estimativa), com a
 *    configuração de fábrica.
 *
 * Os blocos completos ficam em fixtures/*.txt (snapshot). Depois de uma mudança
 * intencional no formato, regenere com UPDATE_SNAPSHOTS=1 npm run test:scope e
 * confira o diff.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeFrameworkTotals, VARIABLE_KEYS } from '../framework-calc';
import { buildCalcLines } from '../framework-estimate';
import { buildFrameworkScopeInput, FRAMEWORK_IDS } from '../scope-framework';
import { buildScopePrompt } from '../scope-export';
import { buildAEScopePrompt } from '../ae-scope-prompt';
import { calculateAEEstimate, type AEInputData } from '../ae-engine';
import { SUPPRESSION_FLAGS, resolveFrameworkFlags } from '../scope-flags';
import { formatZohoNotes, formatZohoRecord, htmlToText } from '../zoho-config';
import { dictionaries } from '../../app/i18n/resources';

const FIX = join(__dirname, 'fixtures');
const catalog = JSON.parse(readFileSync(join(FIX, 'framework-catalog.json'), 'utf8'));
const logos = JSON.parse(readFileSync(join(FIX, 'logos-v1.json'), 'utf8'));
const GENERATED_AT = new Date(2026, 10, 11, 12, 0, 0);

/** t() mínimo sobre os dicionários do site (chave pontuada, {{variáveis}}, plural). */
function makeT(lang: 'pt' | 'en' | 'es') {
  const dict = dictionaries[lang];
  const lookup = (key: string) => key.split('.').reduce((acc: any, part) => (acc == null ? acc : acc[part]), dict);
  return (key: string, params: Record<string, any> = {}) => {
    let value = lookup(key);
    if (value == null && params.count !== undefined) value = lookup(`${key}_${Number(params.count) === 1 ? 'one' : 'other'}`);
    if (typeof value !== 'string') return String(params.defaultValue ?? key);
    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name) => String(params[name] ?? ''));
  };
}

function logosData() {
  const data: Record<string, any> = { __planTier: logos.plan, __skuType: logos.sku };
  logos.modules.forEach((m: string) => { data[`check_area_${m}`] = 'on'; });
  Object.entries(logos.quantities).forEach(([id, qty]) => { data[`item_${id}_qty`] = String(qty); });
  Object.entries(logos.manualHours).forEach(([id, hours]) => {
    data[`item_override_check_${id}`] = 'on';
    data[`item_override_val_${id}`] = String(hours);
  });
  return data;
}

function logosPrompt(locale: 'pt' | 'en' | 'es' = 'pt') {
  const data = logosData();
  const { lines, drnPct } = buildCalcLines(catalog, data, { priceMode: 'current' });
  const defOf = (key: string) => catalog.variables.find((v: any) => v.key === key) || null;
  const totals = computeFrameworkTotals({
    lines,
    percents: logos.percents,
    drnPct,
    overrides: { discovery: null, validation: null, gp: null },
    variableDefs: { discovery: defOf(VARIABLE_KEYS.discovery), validation: defOf(VARIABLE_KEYS.validation), gp: defOf(VARIABLE_KEYS.gp) },
  });
  const input = buildFrameworkScopeInput({
    locale,
    catalog,
    data,
    totals,
    percents: logos.percents,
    overrides: { discovery: null, validation: null, gp: null },
    gpDefault: 25,
    customPackages: [],
    marketplaceApps: [],
    hiddenIds: [],
    planTier: logos.plan,
    sku: logos.sku,
    deploymentType: logos.deploymentType,
    project: logos.project,
    version: logos.version,
    versions: logos.versions,
    baseUrl: 'https://aktienowtc.netlify.app',
    generatedAt: GENERATED_AT,
  });
  return { input, totals, text: buildScopePrompt(input) };
}

const elementalInputs: AEInputData = {
  agents: 5,
  brands: 1,
  areas: 1,
  skuType: 'CS',
  zendeskPlan: 'professional',
  operationTypes: ['B2B'],
  selectedModules: ['Support', 'Knowledge', 'Voice'],
  selectedChannels: ['web_form', 'email', 'voice'],
  channelQuantities: { web_form: 1, email: 1, voice: 1 },
  knowledgeArticles: 0,
  selectedNativeConnections: ['Jira', 'Salesforce', 'Slack'],
  selectedActionFlows: [],
  selectedApps: [],
  appQuantities: {},
  hasAppCondicionais: false,
  hasAppTicketManager: false,
  hasSSO: false,
  hasTeamsSideConv: false,
  hasSlackSideConv: true,
};

function elementalPrompt(locale: 'pt' | 'en' | 'es' = 'pt') {
  const estimate = calculateAEEstimate(elementalInputs);
  const text = buildAEScopePrompt({
    estimate,
    inputs: elementalInputs,
    clientName: 'Elemental Machines',
    versionLabel: 'v7',
    versionPosition: { index: 7, total: 7 },
    versionCreatedAt: new Date(2026, 10, 11, 9, 0, 0),
    estimateId: 999,
    baseUrl: 'https://aktienowtc.netlify.app',
    zohoLink: 'https://crm.zoho.com/crm/org882513013/tab/Potentials/6713453000046758010',
    preSalesName: 'Arthur Oliveira',
    clientObjectives: 'Better transparency and traceability from engineering bugs (Jira) to the support tickets they affect.',
    successIndicators: 'Reduzir carga manual de trabalho.',
    deploymentType: 'new',
    marketplaceApps: [],
    locale,
    t: makeT(locale),
    skuLabel: 'Customer Service',
    generatedAt: GENERATED_AT,
  });
  return { estimate, text };
}

function snapshot(name: string, text: string) {
  const file = join(FIX, name);
  if (process.env.UPDATE_SNAPSHOTS || !existsSync(file)) writeFileSync(file, text);
  assert.equal(text, readFileSync(file, 'utf8').split('\r\n').join('\n'), `snapshot ${name} mudou`);
}

const flagValue = (text: string, key: string) => {
  const m = text.match(new RegExp(`^${key}: (sim|nao)`, 'm'));
  return m ? m[1] : null;
};

/* ------------------------------------------------------------------------ */

test('Logos V1: totais iguais aos da tela', () => {
  const { totals } = logosPrompt();
  assert.equal(totals.grandTotal, 189);
  assert.equal(totals.skillTotals['Implantação'], 151.3);
  assert.equal(totals.skillTotals['GP'], 37.8);
  assert.equal(totals.discVal, 14.3);
  assert.equal(totals.validVal, 11.5);
  assert.equal(totals.lines.length, 68);
});

test('Logos V1: envelope v3 e seções da v2 presentes', () => {
  const { text } = logosPrompt();
  assert.match(text, /^===== Aktie Now Tool Center · ESCOPO TÉCNICO · v3 =====$/m);
  assert.match(text, /^ORIGEM: framework$/m);
  assert.doesNotMatch(text, /^TEMPLATE:/m);
  assert.doesNotMatch(text, /^IDIOMA DE SAÍDA:/m);
  for (const header of ['PROJETO', 'DIMENSIONAMENTO', 'PLATAFORMA', 'MÓDULOS EM ESCOPO', 'CANAIS EM ESCOPO',
    'INTEGRAÇÕES E APPS', 'FLAGS DE SUPRESSÃO', 'DETALHAMENTO POR CATEGORIA', 'ITENS SELECIONADOS',
    'DADOS INFORMADOS', 'OUTRAS VERSÕES DO PROJETO', 'ITENS PREENCHIDOS QUE NÃO CONTAM']) {
    assert.ok(text.includes(`[${header}]`), `falta [${header}]`);
  }
  assert.match(text, /^Total de horas: 189h$/m);
  assert.match(text, /^- Implantação: 151,3h$/m);
  assert.match(text, /^- Gerente de Projeto: 37,8h$/m);
  assert.match(text, /^ID do projeto: 163$/m);
  assert.match(text, /^ID da versão: 212$/m);
  assert.match(text, /^Link da versão no Tool Center: https:\/\/aktienowtc\.netlify\.app\/sc\/project\/163\?version_id=212$/m);
  assert.match(text, /^Versão criada em: 04\/11\/2026$/m);
  assert.match(text, /^Horas por fase: Workshop 2,5h · Discovery 14,3h · Setup 95,5h · Validação 11,5h · Treinamento 18,5h · Go-Live e Pós Go-Live 9h$/m);
});

test('Logos V1: flags batem com os itens', () => {
  const { text } = logosPrompt();
  const expected: Record<string, string> = {
    'action-flow': 'sim', 'integracoes-nativas': 'sim', 'side-conversations': 'sim', itam: 'nao',
    'ai-agents': 'sim', 'ai-agents-api': 'nao', sso: 'sim', 'conteudo-dinamico': 'sim', 'central-de-ajuda': 'sim',
    email: 'sim', voz: 'sim', knowledge: 'sim', analytics: 'sim', copilot: 'sim', whatsapp: 'nao', wfm: 'nao',
    qa: 'nao', 'marketplace-apps': 'nao', sla: 'sim', csat: 'sim', 'objetos-customizados': 'nao',
    desenvolvimento: 'nao', design: 'nao',
  };
  Object.entries(expected).forEach(([key, value]) => assert.equal(flagValue(text, key), value, `flag ${key}`));
});

test('Logos V1: canais, integrações e itens', () => {
  const { text } = logosPrompt();
  assert.match(text, /^- Email com domínio do cliente: 5$/m);
  assert.match(text, /^- Formulários e Catálogos de Serviço: 5$/m);
  assert.match(text, /^- Web Widget: 1$/m);
  assert.match(text, /^- Linhas \/ Números \(Zendesk Voice\): 7$/m);
  assert.match(text, /^- Integração nativa: Salesforce$/m);
  assert.match(text, /^- Integração nativa: Slack$/m);
  assert.match(text, /^- Criador de aplicativos: Criador de aplicativos: com conexão API externa$/m);
  assert.match(text, /^- Conversas paralelas: Conversas Paralelas via Slack$/m);
  assert.doesNotMatch(text, /× 0h/);
  assert.match(text, /^- Campos de ticket condicionais — 9 × 0,02h = 0,2h · Implantação$/m);
  assert.match(text, /^- Suporte Pós Go-Live — 3h \(horas ajustadas manualmente; quantidade 1; padrão 1 × 6h = 6h\) · Implantação$/m);
  assert.match(text, /^Zendesk Support — 47,4h\n  Com Discovery, Validação e GP rateados: /m);
  const itemLines = text.split('\n[ITENS SELECIONADOS]\n')[1].split('\n\n')[0].split('\n').filter((l) => l.startsWith('- '));
  assert.equal(itemLines.length, 68);
});

test('Logos V1: descrição (tooltip) dos itens e outras versões', () => {
  const { text } = logosPrompt();
  const withTooltip = catalog.packagesByCategory['Zendesk Support'].find((p: any) => p.id === 1);
  if (withTooltip.tooltip) assert.match(text, /- Configurações gerais \(Support\) — .*\n  Descrição: /);
  assert.match(text, /^- V2 — 104h · criada em 04\/11\/2026 — Suite \+ Copilot/m);
  assert.doesNotMatch(text.split('[OUTRAS VERSÕES DO PROJETO]')[1].split('\n\n')[0], /^- V1 /m);
});

test('Logos V1: inglês e espanhol traduzem os rótulos, mas não as flags', () => {
  const en = logosPrompt('en').text;
  const es = logosPrompt('es').text;
  assert.match(en, /^===== Aktie Now Tool Center · ESCOPO TÉCNICO · v3 =====$/m);
  assert.match(en, /^\[SUPPRESSION FLAGS\]$/m);
  assert.match(en, /^integracoes-nativas: sim  # /m);
  assert.match(en, /^Total hours: 189h$/m);
  assert.match(en, /^- Implementation: 151\.3h$/m);
  assert.match(en, /^Version created on: 11\/04\/2026$/m);
  assert.match(es, /^\[FLAGS DE SUPRESIÓN\]$/m);
  assert.match(es, /^- Implementación: 151\.3h$/m);
  assert.match(es, /^ORIGEN: framework$/m);
});

test('Logos V1: snapshot', () => {
  snapshot('logos-v1.pt.txt', logosPrompt('pt').text);
});

/* ------------------------------------------------------------------------ */

test('Elemental: flags, detalhamento e itens considerados', () => {
  const { estimate, text } = elementalPrompt();
  assert.equal(flagValue(text, 'integracoes-nativas'), 'sim');
  assert.equal(flagValue(text, 'csat'), 'sim');
  assert.equal(flagValue(text, 'central-de-ajuda'), 'sim');
  assert.equal(flagValue(text, 'side-conversations'), 'sim');
  assert.equal(flagValue(text, 'sla'), 'sim');
  assert.equal(flagValue(text, 'voz'), 'sim');
  assert.equal(flagValue(text, 'ai-agents-api'), 'nao');
  const breakdown = text.split('[DETALHAMENTO POR CATEGORIA]\n')[1].split('\n\n')[0];
  assert.doesNotMatch(breakdown, /sem horas lançadas/);
  assert.ok(breakdown.split('\n').filter((l) => / — \d/.test(l)).length >= 6, 'seis grupos com subtotal');
  assert.match(breakdown, new RegExp(`Total dos itens: ${estimate.lineItemHours.toFixed(2).replace('.', ',')}h`));
  assert.doesNotMatch(text, /^- (Jira|Salesforce|Slack|Email) — 0h$/m);
  assert.match(text, /^- Jira — 1 × 2,00h = 2,00h$/m);
  assert.match(text, /^- Web Form — horas no grupo "Configuração Support"$/m);
  const considered = text.split('\n').filter((l, i, all) => l.startsWith('- ') && all.slice(0, i).reverse().find((x) => !x.startsWith('- ') && !x.startsWith('  ') && !x.startsWith('#'))?.includes('Itens considerados'));
  assert.ok(considered.length >= 30, `itens considerados: ${considered.length}`);
  assert.match(text, /^Versão: 7 de 7$/m);
  assert.match(text, /^- Discovery 20% sobre [\d,]+h = [\d,]+h$/m);
  assert.match(text, /^Apps de Marketplace: nenhum$/m);
  assert.match(text, /^Action Flow: nenhum$/m);
});

test('Elemental: snapshot', () => {
  snapshot('elemental.pt.txt', elementalPrompt('pt').text);
});

/* ------------------------------------------------------------------------ */

test('toda linha com quantidade numa subcategoria/item mapeado liga a flag', () => {
  // Uma linha de cada vez, de cada item da biblioteca: a flag precisa ligar
  // sempre que o item casa com a regra dela (e só então).
  Object.entries(catalog.packagesByCategory).forEach(([root, pkgs]: [string, any]) => {
    pkgs.forEach((pkg: any) => {
      const line = { kind: 'package' as const, packageId: pkg.id, category: root, subcategory: pkg.__subcategory, name: pkg.name, hours: 1 };
      const flags = resolveFrameworkFlags([line], {});
      if (pkg.__subcategory === 'Integrações nativas') assert.equal(flags['integracoes-nativas'], true, pkg.name);
      if (pkg.__subcategory === 'Gestão de ativos') assert.equal(flags.itam, true, pkg.name);
      if (pkg.__subcategory === 'Apps de Marketplace') assert.equal(flags['marketplace-apps'], true, pkg.name);
      if (pkg.__subcategory !== 'Gestão de ativos') assert.equal(flags.itam, false, `${pkg.name} não é ITAM`);
    });
  });
});

test('ids usados pelas flags e seções derivadas existem na biblioteca', () => {
  const ids = new Set<number>();
  Object.values(catalog.packagesByCategory).forEach((pkgs: any) => pkgs.forEach((p: any) => ids.add(Number(p.id))));
  SUPPRESSION_FLAGS.forEach((rule) => (rule.framework.itemIds || []).forEach((id) => assert.ok(ids.has(id), `flag ${rule.key}: item ${id}`)));
  Object.entries(FRAMEWORK_IDS).forEach(([name, value]) => {
    (Array.isArray(value) ? value : [value]).forEach((id) => assert.ok(ids.has(Number(id)), `${name}: item ${id}`));
  });
});

/* ------------------------------------------------------------------------ */

test('Zoho: vazios viram "---", texto de várias linhas mantém as quebras', () => {
  const lines = formatZohoRecord(
    [{ api: 'A', label: 'Pain Points' }, { api: 'B', label: 'Industry' }, { api: 'C', label: 'Segment' }],
    { A: 'Centrais — o que move a troca\nIntegração Jira rasa.\n\nOperacionais\nOrganizações não sincronizam.', B: null, C: '' },
  );
  assert.deepEqual(lines, [
    '- Pain Points:',
    '    Centrais — o que move a troca',
    '    Integração Jira rasa.',
    '    Operacionais',
    '    Organizações não sincronizam.',
    '- Industry e Segment: ---',
  ]);
});

test('Zoho: notas em texto puro, mais antigas primeiro', () => {
  assert.equal(
    htmlToText('<div>Linha 1<br>Linha 2</div><ul><li>Item</li></ul><a href="https://x.y">doc</a> &amp; mais'),
    'Linha 1\nLinha 2\n\n- Item\ndoc (https://x.y) & mais',
  );
  const out = formatZohoNotes([
    { createdAt: new Date(2026, 9, 25), author: 'B', title: '', text: 'segunda' },
    { createdAt: new Date(2026, 9, 20), author: 'A', title: '', text: 'primeira' },
  ]);
  assert.deepEqual(out, ['- 20/10/2026 · A:', '    primeira', '- 25/10/2026 · B:', '    segunda']);
});
