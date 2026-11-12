'use client';

/**
 * Admin › Biblioteca › Atalhos: os botões do editor de estimativas que
 * preenchem itens sozinhos (Treinamento, Workshop, Go-live e os que o admin
 * criar). Cada atalho tem regras: item + quantidade + condições, em grupos
 * ligados por OU (dentro do grupo, tudo por E). Ver lib/editor-shortcuts.ts.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Save, Trash2, Zap } from 'lucide-react';
import { saveEditorShortcutAction } from '@/app/admin/shortcut_actions';
import { ZENDESK_PLANS, PLAN_LABEL, type ZendeskPlanTier } from '@/lib/zendesk-plans';
import type { EditorShortcut, ShortcutCondition, ShortcutRule } from '@/lib/editor-shortcuts';

type LibraryItem = { id: number; name: string; root: string; sub: string };
type Props = {
  initialShortcuts: EditorShortcut[];
  items: LibraryItem[];
  roots: Array<{ key: string; label: string }>;
  subcategories: Array<{ key: string; label: string; root: string }>;
};

const INPUT = 'w-full h-10 bg-white dark:bg-[color:var(--bg-input-solid)] border border-slate-300 dark:border-[color:var(--border-main)] rounded-lg px-3 text-label text-brand-dark outline-none focus:border-brand-primary';
const SELECT = `${INPUT} pr-8`;

const emptyShortcut = (order: number): EditorShortcut => ({
  id: 0, key: '', name: '', nameEn: '', nameEs: '', description: '', isActive: true, displayOrder: order, rules: [],
});

export default function ShortcutsAdmin({ initialShortcuts, items, roots, subcategories }: Props) {
  const { t } = useTranslation();
  const [shortcuts, setShortcuts] = useState<EditorShortcut[]>(initialShortcuts);
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(initialShortcuts[0]?.id ?? null);
  const [draft, setDraft] = useState<EditorShortcut | null>(initialShortcuts[0] ? JSON.parse(JSON.stringify(initialShortcuts[0])) : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [bulkRoot, setBulkRoot] = useState('');

  const saved = selectedId === 'new' ? null : shortcuts.find((s) => s.id === selectedId) || null;
  const dirty = Boolean(draft) && JSON.stringify(draft) !== JSON.stringify(saved || emptyShortcut(shortcuts.length));

  const itemsByRoot = useMemo(() => {
    const map = new Map<string, LibraryItem[]>();
    items.forEach((i) => {
      if (!map.has(i.root)) map.set(i.root, []);
      map.get(i.root)!.push(i);
    });
    return roots.filter((r) => map.has(r.key)).map((r) => ({ ...r, items: map.get(r.key)!.sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [items, roots]);
  const itemName = (id: number) => items.find((i) => i.id === id)?.name || `#${id}`;

  const select = (id: number | 'new') => {
    if (dirty && !confirm(t('common.unsavedChangesConfirm'))) return;
    setMessage(null);
    setSelectedId(id);
    setDraft(id === 'new' ? emptyShortcut(shortcuts.length) : JSON.parse(JSON.stringify(shortcuts.find((s) => s.id === id)!)));
  };

  const update = (patch: Partial<EditorShortcut>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateRule = (index: number, patch: Partial<ShortcutRule>) =>
    setDraft((d) => (d ? { ...d, rules: d.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)) } : d));
  const removeRule = (index: number) => setDraft((d) => (d ? { ...d, rules: d.rules.filter((_, i) => i !== index) } : d));
  const addRule = () => setDraft((d) => (d ? { ...d, rules: [...d.rules, { itemId: items[0]?.id || 0, quantity: 1, groups: [] }] } : d));

  const addAllFromRoot = () => {
    if (!bulkRoot || !draft) return;
    const existing = new Set(draft.rules.map((r) => r.itemId));
    const extra = items.filter((i) => i.root === bulkRoot && !existing.has(i.id)).map((i) => ({ itemId: i.id, quantity: 1, groups: [] }));
    update({ rules: [...draft.rules, ...extra] });
  };

  const defaultCondition = (): ShortcutCondition => ({ type: 'module', category: roots[0]?.key || '', mode: 'selected' });
  const setGroups = (ruleIndex: number, groups: ShortcutCondition[][]) => updateRule(ruleIndex, { groups });

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    const res = await saveEditorShortcutAction({ ...draft, id: draft.id || null });
    setBusy(false);
    if (!res.ok) {
      setMessage({ tone: 'error', text: (res as { error: string }).error === 'name_required' ? t('shortcuts.nameRequired') : (res as { error: string }).error });
      return;
    }
    setShortcuts(res.shortcuts);
    const match = draft.id ? res.shortcuts.find((s) => s.id === draft.id) : res.shortcuts.find((s) => !shortcuts.some((o) => o.id === s.id));
    if (match) { setSelectedId(match.id); setDraft(JSON.parse(JSON.stringify(match))); }
    setMessage({ tone: 'ok', text: t('shortcuts.saved') });
  };

  const conditionEditor = (ruleIndex: number, groupIndex: number, condIndex: number, cond: ShortcutCondition, groups: ShortcutCondition[][]) => {
    const replace = (next: ShortcutCondition) =>
      setGroups(ruleIndex, groups.map((g, gi) => (gi === groupIndex ? g.map((c, ci) => (ci === condIndex ? next : c)) : g)));
    const remove = () =>
      setGroups(ruleIndex, groups.map((g, gi) => (gi === groupIndex ? g.filter((_, ci) => ci !== condIndex) : g)).filter((g) => g.length));
    const typeValue = cond.type === 'module' ? `module_${cond.mode}` : cond.type;
    const changeType = (value: string) => {
      if (value === 'module_selected' || value === 'module_hours') replace({ type: 'module', category: roots[0]?.key || '', mode: value === 'module_hours' ? 'hours' : 'selected', negate: cond.negate });
      else if (value === 'item') replace({ type: 'item', itemId: items[0]?.id || 0, negate: cond.negate });
      else if (value === 'subcategory') replace({ type: 'subcategory', category: subcategories[0]?.key || '', negate: cond.negate });
      else if (value === 'deployment') replace({ type: 'deployment', value: 'new', negate: cond.negate });
      else if (value === 'plan') replace({ type: 'plan', values: ['enterprise'], negate: cond.negate });
      else if (value === 'sku') replace({ type: 'sku', value: 'CS', negate: cond.negate });
    };
    return (
      <div key={condIndex} className="flex flex-wrap items-center gap-2">
        {condIndex > 0 && <span className="text-caption font-bold text-slate-400 w-6">{t('shortcuts.and')}</span>}
        <label className="inline-flex items-center gap-1.5 text-caption text-slate-500">
          <input type="checkbox" checked={Boolean(cond.negate)} onChange={(e) => replace({ ...cond, negate: e.target.checked || undefined } as ShortcutCondition)} />
          {t('shortcuts.not')}
        </label>
        <select value={typeValue} onChange={(e) => changeType(e.target.value)} className={`${SELECT} w-52`}>
          <option value="module_selected">{t('shortcuts.condModuleSelected')}</option>
          <option value="module_hours">{t('shortcuts.condModuleHours')}</option>
          <option value="item">{t('shortcuts.condItem')}</option>
          <option value="subcategory">{t('shortcuts.condSubcategory')}</option>
          <option value="deployment">{t('shortcuts.condDeployment')}</option>
          <option value="plan">{t('shortcuts.condPlan')}</option>
          <option value="sku">{t('shortcuts.condSku')}</option>
        </select>
        {cond.type === 'module' && (
          <select value={cond.category} onChange={(e) => replace({ ...cond, category: e.target.value })} className={`${SELECT} w-60`}>
            {roots.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        )}
        {cond.type === 'item' && (
          <select value={cond.itemId} onChange={(e) => replace({ ...cond, itemId: Number(e.target.value) })} className={`${SELECT} w-72`}>
            {itemsByRoot.map((g) => (
              <optgroup key={g.key} label={g.label}>
                {g.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </optgroup>
            ))}
          </select>
        )}
        {cond.type === 'subcategory' && (
          <select value={cond.category} onChange={(e) => replace({ ...cond, category: e.target.value })} className={`${SELECT} w-72`}>
            {subcategories.map((s) => <option key={`${s.root}/${s.key}`} value={s.key}>{s.label}</option>)}
          </select>
        )}
        {cond.type === 'deployment' && (
          <select value={cond.value} onChange={(e) => replace({ ...cond, value: e.target.value === 'optimization' ? 'optimization' : 'new' })} className={`${SELECT} w-56`}>
            <option value="new">{t('editor.deploymentNew')}</option>
            <option value="optimization">{t('editor.deploymentOptimization')}</option>
          </select>
        )}
        {cond.type === 'plan' && (
          <span className="inline-flex flex-wrap gap-2">
            {ZENDESK_PLANS.map((plan) => (
              <label key={plan} className="inline-flex items-center gap-1 text-caption text-slate-600">
                <input
                  type="checkbox"
                  checked={cond.values.includes(plan)}
                  onChange={(e) => {
                    const values = e.target.checked ? [...cond.values, plan] : cond.values.filter((v) => v !== plan);
                    replace({ ...cond, values: (values.length ? values : [plan]) as ZendeskPlanTier[] });
                  }}
                />
                {PLAN_LABEL[plan]}
              </label>
            ))}
          </span>
        )}
        {cond.type === 'sku' && (
          <select value={cond.value} onChange={(e) => replace({ ...cond, value: e.target.value === 'ES' ? 'ES' : 'CS' })} className={`${SELECT} w-48`}>
            <option value="CS">{t('plans.customerService')}</option>
            <option value="ES">{t('plans.employeeService')}</option>
          </select>
        )}
        <button type="button" onClick={remove} title={t('shortcuts.removeCondition')} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
      <aside className="space-y-2">
        <p className="text-caption text-slate-500">{t('shortcuts.intro')}</p>
        {shortcuts.map((sc) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => select(sc.id)}
            className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${selectedId === sc.id ? 'border-brand-primary bg-brand-soft' : 'border-slate-200 hover:border-slate-400 bg-white dark:bg-[color:var(--bg-card)]'}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium text-brand-dark truncate">{sc.name}</span>
              {!sc.isActive && <span className="text-caption text-slate-400">{t('shortcuts.inactive')}</span>}
            </span>
            <span className="block text-caption text-slate-500">{t('shortcuts.ruleCount', { count: sc.rules.length })}</span>
          </button>
        ))}
        <button type="button" onClick={() => select('new')} className="w-full h-10 rounded-full border border-dashed border-slate-400 text-label font-medium text-slate-600 inline-flex items-center justify-center gap-2 hover:border-brand-primary hover:text-brand-dark">
          <Plus className="w-4 h-4" /> {t('shortcuts.new')}
        </button>
      </aside>

      {draft ? (
        <section className="bg-white dark:bg-[color:var(--bg-card)] rounded-3xl border border-slate-200 dark:border-[color:var(--border-main)] p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl brand-bg-primary flex items-center justify-center"><Zap className="w-5 h-5" /></div>
              <div>
                <h3 className="text-title font-bold text-brand-dark">{draft.name || t('shortcuts.new')}</h3>
                {draft.key && <code className="text-caption text-slate-400">{draft.key}</code>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-label text-slate-600">
                <input type="checkbox" checked={draft.isActive} onChange={(e) => update({ isActive: e.target.checked })} />
                {t('shortcuts.active')}
              </label>
              <button type="button" onClick={save} disabled={busy || !dirty} className="h-10 px-5 rounded-full brand-bg-primary text-label font-medium inline-flex items-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('common.save')}
              </button>
            </div>
          </div>

          {message && <p role="status" className={`text-label ${message.tone === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="space-y-1"><span className="text-caption font-medium text-slate-500">{t('shortcuts.namePt')}</span><input className={INPUT} value={draft.name} onChange={(e) => update({ name: e.target.value })} /></label>
            <label className="space-y-1"><span className="text-caption font-medium text-slate-500">{t('shortcuts.nameEn')}</span><input className={INPUT} value={draft.nameEn} onChange={(e) => update({ nameEn: e.target.value })} /></label>
            <label className="space-y-1"><span className="text-caption font-medium text-slate-500">{t('shortcuts.nameEs')}</span><input className={INPUT} value={draft.nameEs} onChange={(e) => update({ nameEs: e.target.value })} /></label>
            <label className="space-y-1"><span className="text-caption font-medium text-slate-500">{t('shortcuts.order')}</span><input type="number" min={0} className={INPUT} value={draft.displayOrder} onChange={(e) => update({ displayOrder: Math.max(0, Number(e.target.value) || 0) })} /></label>
          </div>
          <label className="block space-y-1">
            <span className="text-caption font-medium text-slate-500">{t('shortcuts.description')}</span>
            <input className={INPUT} value={draft.description} maxLength={500} onChange={(e) => update({ description: e.target.value })} placeholder={t('shortcuts.descriptionPlaceholder')} />
          </label>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-body font-bold text-brand-dark">{t('shortcuts.rulesTitle', { count: draft.rules.length })}</h4>
              <div className="flex flex-wrap items-center gap-2">
                <select value={bulkRoot} onChange={(e) => setBulkRoot(e.target.value)} className={`${SELECT} w-56`}>
                  <option value="">{t('shortcuts.bulkPick')}</option>
                  {roots.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
                <button type="button" onClick={addAllFromRoot} disabled={!bulkRoot} className="h-10 px-3 rounded-full border border-slate-300 text-label font-medium text-slate-600 disabled:opacity-40">{t('shortcuts.bulkAdd')}</button>
                <button type="button" onClick={addRule} className="h-10 px-4 rounded-full border border-brand-primary text-label font-medium text-brand-dark inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> {t('shortcuts.addRule')}</button>
              </div>
            </div>
            <p className="text-caption text-slate-500">{t('shortcuts.rulesHint')}</p>
            {draft.rules.length === 0 && <p className="text-label text-slate-500">{t('shortcuts.noRules')}</p>}
            {draft.rules.map((rule, ri) => (
              <div key={ri} className="rounded-2xl border border-slate-200 dark:border-[color:var(--border-main)] p-4 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="space-y-1 flex-1 min-w-[260px]">
                    <span className="text-caption font-medium text-slate-500">{t('shortcuts.item')}</span>
                    <select value={rule.itemId} onChange={(e) => updateRule(ri, { itemId: Number(e.target.value) })} className={SELECT}>
                      {!items.some((i) => i.id === rule.itemId) && <option value={rule.itemId}>{itemName(rule.itemId)}</option>}
                      {itemsByRoot.map((g) => (
                        <optgroup key={g.key} label={g.label}>
                          {g.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 w-28">
                    <span className="text-caption font-medium text-slate-500">{t('shortcuts.quantity')}</span>
                    <input type="number" min={0} step="any" className={INPUT} value={rule.quantity} onChange={(e) => updateRule(ri, { quantity: Math.max(0, Number(e.target.value) || 0) })} />
                  </label>
                  <button type="button" onClick={() => removeRule(ri)} title={t('shortcuts.removeRule')} className="h-10 px-3 rounded-full text-slate-400 hover:text-red-600 inline-flex items-center"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2">
                  {rule.groups.length === 0 ? (
                    <p className="text-caption text-slate-500">{t('shortcuts.always')}</p>
                  ) : rule.groups.map((group, gi) => (
                    <div key={gi} className="space-y-2">
                      {gi > 0 && <div className="text-caption font-bold text-brand-primary">{t('shortcuts.or')}</div>}
                      <div className="rounded-xl bg-slate-50 dark:bg-[color:var(--bg-input)] p-3 space-y-2">
                        {group.map((cond, ci) => conditionEditor(ri, gi, ci, cond, rule.groups))}
                        <button
                          type="button"
                          onClick={() => setGroups(ri, rule.groups.map((g, i) => (i === gi ? [...g, defaultCondition()] : g)))}
                          className="text-caption font-medium text-brand-dark hover:underline"
                        >
                          + {t('shortcuts.addAndCondition')}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setGroups(ri, [...rule.groups, [defaultCondition()]])} className="text-caption font-medium text-brand-primary hover:underline">
                    + {rule.groups.length ? t('shortcuts.addOrGroup') : t('shortcuts.addCondition')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-label text-slate-500">{t('shortcuts.pick')}</p>
      )}
    </div>
  );
}
