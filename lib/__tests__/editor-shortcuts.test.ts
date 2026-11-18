/**
 * Atalhos do editor (regras com grupos OU / condições E) e a passagem da
 * Calculadora AE para uma estimativa do Framework.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  legacyShortcuts, reconcileShortcuts, turnOffShortcut, shortcutAppliedKey, type EditorShortcut,
} from '../editor-shortcuts';
import { aeToFrameworkItems, roundHalfUpInt } from '../ae-to-framework';
import { calculateAEEstimate, type AEInputData } from '../ae-engine';
import { DEFAULT_AE_CONFIG } from '../ae-config';

const catalog = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'framework-catalog.json'), 'utf8'));

const shortcut = (rules: EditorShortcut['rules'], key = 'teste'): EditorShortcut => ({
  id: 1, key, name: 'Teste', nameEn: '', nameEs: '', description: '', isActive: true, displayOrder: 0, rules,
});

test('regra sem condição sempre preenche; desligar desfaz só o que o atalho pôs', () => {
  const sc = shortcut([{ itemId: 223, quantity: 1, groups: [] }]);
  const on = reconcileShortcuts({ __shortcut_teste: 'on' }, [sc], catalog);
  assert.equal(on.item_223_qty, '1');
  assert.equal(on['check_area_Go-Live'], 'on');
  assert.deepEqual(JSON.parse(on[shortcutAppliedKey('teste')]), { 223: 1 });
  const off = turnOffShortcut(on, sc);
  assert.equal(off.item_223_qty, undefined);
  // Quantidade alterada à mão fica.
  const edited = turnOffShortcut({ ...on, item_223_qty: '2' }, sc);
  assert.equal(edited.item_223_qty, '2');
});

test('grupos: (Voice selecionado E Enterprise) OU item WhatsApp com quantidade', () => {
  const sc = shortcut([{
    itemId: 181, quantity: 1, groups: [
      [{ type: 'module', category: 'Canais - Voz', mode: 'selected' }, { type: 'plan', values: ['enterprise'] }],
      [{ type: 'item', itemId: 222 }],
    ],
  }]);
  const base = { __shortcut_teste: 'on', __planTier: 'professional', __skuType: 'CS' };
  assert.equal(reconcileShortcuts({ ...base, 'check_area_Canais - Voz': 'on' }, [sc], catalog).item_181_qty, undefined);
  assert.equal(reconcileShortcuts({ ...base, 'check_area_Canais - Voz': 'on', __planTier: 'enterprise' }, [sc], catalog).item_181_qty, '1');
  const viaWhatsApp = reconcileShortcuts({ ...base, 'check_area_Zendesk Support': 'on', item_222_qty: '1' }, [sc], catalog);
  assert.equal(viaWhatsApp.item_181_qty, '1');
  // Condição deixou de valer: o item volta a ficar vazio.
  const after = reconcileShortcuts({ ...viaWhatsApp, item_222_qty: '0' }, [sc], catalog);
  assert.equal(after.item_181_qty, undefined);
});

test('subcategoria, tipo de projeto e negação', () => {
  const sc = shortcut([{
    itemId: 223, quantity: 2, groups: [[
      { type: 'subcategory', category: 'Integrações nativas' },
      { type: 'deployment', value: 'optimization', negate: true },
    ]],
  }]);
  const data = { __shortcut_teste: 'on', 'check_area_Zendesk Support': 'on', item_76_qty: '1' };
  assert.equal(reconcileShortcuts(data, [sc], catalog).item_223_qty, '2');
  assert.equal(reconcileShortcuts({ ...data, __deploymentType: 'optimization' }, [sc], catalog).item_223_qty, undefined);
});

test('atalhos de fábrica vêm dos campos antigos (moduleLink / goLiveShortcutQty)', () => {
  const withLegacy = JSON.parse(JSON.stringify(catalog));
  withLegacy.packagesByCategory['Treinamentos'].find((p: any) => p.id === 181).moduleLink = 'Canais - Voz';
  withLegacy.packagesByCategory['Go-Live'].find((p: any) => p.id === 223).goLiveShortcutQty = 1;
  const [training, , golive] = legacyShortcuts(withLegacy);
  assert.deepEqual(training.rules, [{ itemId: 181, quantity: 1, groups: [[{ type: 'module', category: 'Canais - Voz', mode: 'selected' }]] }]);
  assert.deepEqual(golive.rules, [{ itemId: 223, quantity: 1, groups: [] }]);
  assert.equal(training.key, 'training');
});

test('Calculadora AE → itens do Framework, arredondando com ,5 para cima', () => {
  assert.equal(roundHalfUpInt(24.84), 25);
  assert.equal(roundHalfUpInt(12.5), 13);
  assert.equal(roundHalfUpInt(0.4), 0);
  const inputs: AEInputData = {
    agents: 5, brands: 1, areas: 1, skuType: 'CS', zendeskPlan: 'professional', operationTypes: ['B2B'],
    selectedModules: ['Support', 'Knowledge', 'Voice'], selectedChannels: ['web_form', 'email', 'voice', 'whatsapp'],
    channelQuantities: { web_form: 1, email: 1, voice: 1, whatsapp: 2 }, knowledgeArticles: 0,
    selectedNativeConnections: ['Jira', 'Salesforce', 'Slack'], selectedActionFlows: [], selectedApps: [], appQuantities: {},
    hasAppCondicionais: false, hasAppTicketManager: false, hasSSO: false, hasTeamsSideConv: false, hasSlackSideConv: true,
  };
  const library = Object.values(catalog.packagesByCategory).flatMap((pkgs: any) =>
    pkgs.map((p: any) => ({ id: p.id, name: p.name, hours: p.hours, categoryName: p.categoryName })));
  const estimate = calculateAEEstimate(inputs);
  const result = aeToFrameworkItems({ estimate, inputs, config: DEFAULT_AE_CONFIG, library });
  const qty = (id: number) => result.items.find((i) => i.id === id)?.quantity;
  assert.equal(qty(117), Math.floor(Number(estimate.quantities.campos_ticket) + 0.5)); // Campos de ticket
  assert.equal(qty(17), 5); // Agentes
  assert.equal(qty(81), 1); // Jira
  assert.equal(qty(76), 1); // Salesforce
  assert.equal(qty(222), 2); // WhatsApp
  assert.equal(qty(110), 1); // Conversas Paralelas via Slack
  assert.equal(qty(89), 1); // Central de ajuda básica (piso do Knowledge)
  assert.equal(qty(178), 1); // Support - Admin (treinamento Suite)
  assert.equal(result.plan, 'professional');
  assert.equal(result.sku, 'CS');
});
