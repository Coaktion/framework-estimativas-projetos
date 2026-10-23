'use client';

/**
 * Admin › Zoho CRM: quais campos do negócio, do contato e de um módulo
 * personalizado entram no prompt de escopo, com teste ao vivo por link.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, DownloadCloud, Plus, Save, Search, Trash2 } from 'lucide-react';
import { normalizeZohoConfig, type ZohoConfig, type ZohoFieldRef } from '@/lib/zoho-config';
import { saveZohoConfigAction, zohoFieldsAction, zohoTestAction } from '@/app/admin/zoho_actions';
import { Banner, Button, INPUT, Label, NumberField, SELECT, Section, Switch, TextInput } from './booking/ui';

type Suggestion = { api: string; label: string; type: string };

export default function ZohoAdmin({ initialConfig, configured }: { initialConfig: ZohoConfig; configured: boolean }) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(initialConfig);
  const [config, setConfig] = useState(initialConfig);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({});
  const [testLink, setTestLink] = useState('');
  const [testLines, setTestLines] = useState<string[] | null>(null);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  const errorText = (error: string) => (error === 'not_configured' ? t('zoho.notConfiguredShort') : t('zoho.requestFailed', { detail: error }));

  const loadFields = async (module: string) => {
    if (!module) return;
    setBusy(`fields-${module}`);
    setMessage(null);
    const res = await zohoFieldsAction(module);
    setBusy(null);
    if (!res.ok) { setMessage({ tone: 'error', text: errorText((res as { error: string }).error) }); return; }
    setSuggestions((s) => ({ ...s, [module]: res.fields }));
    setMessage({ tone: 'ok', text: t('zoho.fieldsLoaded', { count: res.fields.length, module }) });
  };

  const save = async () => {
    setBusy('save');
    setMessage(null);
    const res = await saveZohoConfigAction(normalizeZohoConfig(config));
    setBusy(null);
    if (!res.ok) { setMessage({ tone: 'error', text: errorText((res as { error: string }).error) }); return; }
    setSaved(res.config);
    setConfig(res.config);
    setMessage({ tone: 'ok', text: t('zoho.saved') });
  };

  const test = async () => {
    setBusy('test');
    setMessage(null);
    setTestLines(null);
    const res = await zohoTestAction(testLink, normalizeZohoConfig(config));
    setBusy(null);
    if (!res.ok) { setMessage({ tone: 'error', text: errorText((res as { error: string }).error) }); return; }
    setTestLines(res.lines);
  };

  const fieldsEditor = (module: string, fields: ZohoFieldRef[], onChange: (f: ZohoFieldRef[]) => void) => {
    const list = suggestions[module] || [];
    const listId = `zoho-fields-${module}`;
    return (
      <div className="space-y-2">
        <datalist id={listId}>
          {list.map((s) => <option key={s.api} value={s.api}>{`${s.label} (${s.type})`}</option>)}
        </datalist>
        {fields.length === 0 && <p className="text-label text-slate-500">{t('zoho.noFields')}</p>}
        {fields.map((f, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              list={listId}
              value={f.api}
              placeholder={t('zoho.apiName')}
              onChange={(e) => {
                const api = e.target.value.trim();
                const hit = list.find((s) => s.api === api);
                onChange(fields.map((x, j) => (j === i ? { api, label: x.label || (hit ? hit.label : '') } : x)));
              }}
              className={`${INPUT} flex-1 min-w-[180px] font-mono text-label`}
            />
            <input
              value={f.label}
              placeholder={t('zoho.labelInPrompt')}
              onChange={(e) => onChange(fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              className={`${INPUT} flex-1 min-w-[180px]`}
            />
            <button type="button" aria-label={t('common.delete')} onClick={() => onChange(fields.filter((_, j) => j !== i))} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => onChange([...fields, { api: '', label: '' }])}><Plus className="w-4 h-4" /> {t('zoho.addField')}</Button>
          <Button size="sm" variant="ghost" busy={busy === `fields-${module}`} disabled={!configured || !module} onClick={() => loadFields(module)}>
            <DownloadCloud className="w-4 h-4" /> {t('zoho.loadFields')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {configured
        ? <Banner tone="ok"><span className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {t('zoho.configured')}</span></Banner>
        : <Banner tone="warn">{t('zoho.notConfigured')}</Banner>}
      {message && <Banner tone={message.tone}>{message.text}</Banner>}

      <Section
        title={t('zoho.dealTitle')}
        description={t('zoho.dealDesc')}
        actions={
          <div className="flex items-center gap-3">
            {dirty && <span className="text-label font-medium text-amber-700">{t('zoho.unsaved')}</span>}
            <Button variant="primary" busy={busy === 'save'} disabled={!dirty} onClick={save}><Save className="w-4 h-4" /> {t('zoho.save')}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label tip={t('zoho.sectionLabelTip')}>{t('zoho.sectionLabel')}</Label>
            <TextInput value={config.deal.label} onChange={(e) => setConfig({ ...config, deal: { ...config.deal, label: e.target.value } })} />
          </div>
          <div>
            <Label tip={t('zoho.apiVersionTip')}>{t('zoho.apiVersion')}</Label>
            <TextInput value={config.apiVersion} onChange={(e) => setConfig({ ...config, apiVersion: e.target.value.trim() })} />
          </div>
        </div>
        {fieldsEditor('Deals', config.deal.fields, (fields) => setConfig({ ...config, deal: { ...config.deal, fields } }))}
      </Section>

      <Section title={t('zoho.contactTitle')} description={t('zoho.contactDesc')}>
        <div className="space-y-4">
          <Switch checked={config.contact.enabled} onChange={(v) => setConfig({ ...config, contact: { ...config.contact, enabled: v } })} label={t('zoho.include')} />
          {config.contact.enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('zoho.sectionLabel')}</Label>
                  <TextInput value={config.contact.label} onChange={(e) => setConfig({ ...config, contact: { ...config.contact, label: e.target.value } })} />
                </div>
                <div>
                  <Label tip={t('zoho.contactLookupTip')}>{t('zoho.contactLookup')}</Label>
                  <input list="zoho-fields-Deals" value={config.contact.lookupField} onChange={(e) => setConfig({ ...config, contact: { ...config.contact, lookupField: e.target.value.trim() } })} className={`${INPUT} font-mono text-label`} />
                </div>
              </div>
              {fieldsEditor('Contacts', config.contact.fields, (fields) => setConfig({ ...config, contact: { ...config.contact, fields } }))}
            </>
          )}
        </div>
      </Section>

      <Section title={t('zoho.customTitle')} description={t('zoho.customDesc')}>
        <div className="space-y-4">
          <Switch checked={config.custom.enabled} onChange={(v) => setConfig({ ...config, custom: { ...config.custom, enabled: v } })} label={t('zoho.include')} />
          {config.custom.enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label tip={t('zoho.customModuleTip')}>{t('zoho.customModule')}</Label>
                  <TextInput value={config.custom.module} onChange={(e) => setConfig({ ...config, custom: { ...config.custom, module: e.target.value.trim() } })} className="font-mono text-label" />
                </div>
                <div>
                  <Label>{t('zoho.sectionLabel')}</Label>
                  <TextInput value={config.custom.label} onChange={(e) => setConfig({ ...config, custom: { ...config.custom, label: e.target.value } })} />
                </div>
                <div>
                  <Label tip={t('zoho.linkModeTip')}>{t('zoho.linkMode')}</Label>
                  <select value={config.custom.linkMode} onChange={(e) => setConfig({ ...config, custom: { ...config.custom, linkMode: e.target.value as 'search' | 'deal_lookup' } })} className={`${SELECT} w-full`}>
                    <option value="search">{t('zoho.linkModeSearch')}</option>
                    <option value="deal_lookup">{t('zoho.linkModeDeal')}</option>
                  </select>
                </div>
                <div>
                  <Label tip={t(config.custom.linkMode === 'search' ? 'zoho.linkFieldSearchTip' : 'zoho.linkFieldDealTip')}>{t('zoho.linkField')}</Label>
                  <input
                    list={config.custom.linkMode === 'search' ? `zoho-fields-${config.custom.module}` : 'zoho-fields-Deals'}
                    value={config.custom.linkField}
                    onChange={(e) => setConfig({ ...config, custom: { ...config.custom, linkField: e.target.value.trim() } })}
                    className={`${INPUT} font-mono text-label`}
                  />
                </div>
                {config.custom.linkMode === 'search' && (
                  <NumberField label={t('zoho.maxRecords')} minutes={false} min={1} max={10} value={config.custom.maxRecords} onChange={(n) => setConfig({ ...config, custom: { ...config.custom, maxRecords: n } })} />
                )}
              </div>
              {fieldsEditor(config.custom.module, config.custom.fields, (fields) => setConfig({ ...config, custom: { ...config.custom, fields } }))}
            </>
          )}
        </div>
      </Section>

      <Section title={t('zoho.testTitle')} description={t('zoho.testDesc')}>
        <div className="flex flex-wrap gap-2">
          <TextInput value={testLink} onChange={(e) => setTestLink(e.target.value)} placeholder="https://crm.zoho.com/crm/.../tab/Potentials/..." className="flex-1 min-w-[260px]" />
          <Button busy={busy === 'test'} disabled={!configured || !testLink.trim()} onClick={test}><Search className="w-4 h-4" /> {t('zoho.test')}</Button>
        </div>
        {testLines && (
          <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-label text-brand-dark">{['[ZOHO CRM]', ...testLines].join('\n')}</pre>
        )}
      </Section>
    </div>
  );
}
