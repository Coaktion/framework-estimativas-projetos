'use client';

/**
 * Configurações do anfitrião (Agendamento): intervalo mínimo entre tipos,
 * eventos tratados como espaço livre, títulos/descrições dos eventos criados,
 * backup das regras e registro de atividade.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { DATE_LOCALE, normalizeLanguage } from '@/app/i18n/settings';
import {
  TEMPLATE_DEFAULTS, TEMPLATE_KEYS, TEMPLATE_PLACEHOLDERS, buildBookingExport, parseBookingImport,
  type BookingConfig, type RequireFree, type TransparentRule,
} from '@/lib/booking/config';
import { clearBookingLogAction, getBookingLogAction } from '@/app/booking/actions';
import { Banner, Button, Check, Chip, Hint, INPUT, Label, NumberField, Section, Switch, TextArea, errorText } from './ui';

type LogEntry = { t: string; l: string; c: string; d: Record<string, unknown> };

export default function SettingsEditor({ config, onChange, ownerEmail }: { config: BookingConfig; onChange: (c: BookingConfig) => void; ownerEmail: string }) {
  const { t, i18n } = useTranslation();
  const locale = DATE_LOCALE[normalizeLanguage(i18n.language)];
  const s = config.settings;
  const setSettings = (patch: Partial<BookingConfig['settings']>) => onChange({ ...config, settings: { ...s, ...patch } });
  const fileRef = useRef<HTMLInputElement>(null);
  const [ioNote, setIoNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const tg = s.typeGap;
  const tr = s.transparent;
  const setRules = (rules: TransparentRule[]) => setSettings({ transparent: { ...tr, rules } });
  const updateRule = (i: number, patch: Partial<TransparentRule>) => setRules(tr.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const download = (name: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importFile = async (file: File) => {
    const parsed = parseBookingImport(await file.text());
    if (!parsed) { setIoNote({ tone: 'error', text: t('booking.settings.importInvalid') }); return; }
    if (!window.confirm(t('booking.settings.importConfirm'))) return;
    onChange(parsed);
    setIoNote({ tone: 'ok', text: t('booking.settings.importDone', { types: parsed.types.length, auths: parsed.auths.length }) });
  };

  const loadLog = async () => {
    setLogBusy(true);
    setLogError(null);
    const res = await getBookingLogAction();
    setLogBusy(false);
    if (!res.ok) { setLogError(errorText(t, res)); return; }
    setLog(res.entries);
  };

  return (
    <div className="space-y-6">
      <Section title={t('booking.settings.gapTitle')} tip={t('booking.settings.gapTip')} description={t('booking.settings.gapDesc')}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {config.types.length === 0 && <span className="text-label text-slate-500">{t('booking.types.empty')}</span>}
            {config.types.map((tp) => {
              const on = tg.typeIds.includes(tp.id);
              return <Chip key={tp.id} on={on} onClick={() => setSettings({ typeGap: { ...tg, typeIds: on ? tg.typeIds.filter((x) => x !== tp.id) : [...tg.typeIds, tp.id] } })}>{tp.name}</Chip>;
            })}
          </div>
          <div className="max-w-xs">
            <NumberField label={t('booking.settings.gapMinutes')} tip={t('booking.settings.gapMinutesTip')} value={tg.minutes} max={43200} onChange={(n) => setSettings({ typeGap: { ...tg, minutes: n } })} />
          </div>
          <Check checked={tg.reserve} onChange={(v) => setSettings({ typeGap: { ...tg, reserve: v } })} label={t('booking.settings.gapReserve')} hint={t('booking.settings.gapReserveHint')} />
        </div>
      </Section>

      <Section title={t('booking.settings.transparentTitle')} tip={t('booking.settings.transparentTip')}>
        <div className="space-y-4">
          <Switch checked={tr.enabled} onChange={(v) => setSettings({ transparent: { ...tr, enabled: v } })} label={t('booking.settings.transparentEnable')} hint={t('booking.settings.transparentEnableHint')} />
          {tr.enabled && (
            <>
              <Check checked={tr.onlyNoGuests} onChange={(v) => setSettings({ transparent: { ...tr, onlyNoGuests: v } })} label={t('booking.settings.onlyNoGuests')} hint={t('booking.settings.onlyNoGuestsHint')} />
              {tr.rules.length === 0 && <p className="text-label text-slate-500">{t('booking.settings.transparentEmpty')}</p>}
              {tr.rules.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={r.title} maxLength={200} onChange={(e) => updateRule(i, { title: e.target.value })} placeholder={t('booking.settings.transparentTitlePlaceholder')} className={`${INPUT} flex-1`} />
                    <button type="button" aria-label={t('common.delete')} onClick={() => setRules(tr.rules.filter((_, j) => j !== i))} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {(['day', 'week'] as RequireFree[]).map((scope) => (
                    <Check
                      key={scope}
                      checked={r.requireFree === scope}
                      onChange={(on) => {
                        const requireFree: RequireFree = on ? scope : r.requireFree === scope ? 'none' : r.requireFree;
                        updateRule(i, { requireFree, reschedule: requireFree === 'none' ? false : r.reschedule });
                      }}
                      label={t(`booking.settings.requireFree.${scope}`)}
                      hint={t(`booking.settings.requireFreeHint.${scope}`)}
                    />
                  ))}
                  {r.requireFree !== 'none' && (
                    <div className="pl-7">
                      <Check checked={r.reschedule} onChange={(v) => updateRule(i, { reschedule: v })} label={t('booking.settings.reschedule')} hint={t('booking.settings.rescheduleHint')} />
                    </div>
                  )}
                </div>
              ))}
              <Button size="sm" onClick={() => setRules([...tr.rules, { title: '', requireFree: 'none', reschedule: false }])}>
                <Plus className="w-4 h-4" /> {t('booking.settings.transparentAdd')}
              </Button>
            </>
          )}
        </div>
      </Section>

      <Section title={t('booking.settings.templatesTitle')} tip={t('booking.settings.templatesTip')} description={t('booking.settings.templatesDesc')}>
        <div className="space-y-5">
          {TEMPLATE_KEYS.map((k) => {
            const cur = s.templates[k];
            return (
              <div key={k} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label tip={t(`booking.settings.tpl.${k}.desc`)}>{t(`booking.settings.tpl.${k}.name`)}</Label>
                  <Button size="sm" variant="ghost" onClick={() => setSettings({ templates: { ...s.templates, [k]: { ...TEMPLATE_DEFAULTS[k] } } })}>
                    <RotateCcw className="w-3.5 h-3.5" /> {t('booking.settings.restoreDefault')}
                  </Button>
                </div>
                <input value={cur.title} maxLength={250} onChange={(e) => setSettings({ templates: { ...s.templates, [k]: { ...cur, title: e.target.value } } })} className={INPUT} aria-label={t('booking.settings.tplTitle')} />
                <TextArea
                  rows={2}
                  maxLength={3000}
                  value={cur.desc}
                  placeholder={t(k === 'meeting' || k === 'block' ? 'booking.settings.tplDescMeeting' : 'booking.settings.tplDescBlock')}
                  onChange={(e) => setSettings({ templates: { ...s.templates, [k]: { ...cur, desc: e.target.value } } })}
                />
              </div>
            );
          })}
          <details className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <summary className="text-label font-medium text-brand-dark cursor-pointer">{t('booking.settings.placeholders', { count: TEMPLATE_PLACEHOLDERS.length })}</summary>
            <Hint className="mb-3">{t('booking.settings.placeholdersHint')}</Hint>
            <dl className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-x-4 gap-y-2 text-label">
              {TEMPLATE_PLACEHOLDERS.map((p) => (
                <div key={p} className="contents">
                  <dt><code className="text-brand-dark">[{p}]</code></dt>
                  <dd className="text-slate-500">{t(`booking.settings.ph.${p}`)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </Section>

      <Section title={t('booking.settings.backupTitle')} tip={t('booking.settings.backupTip')} description={t('booking.settings.backupDesc')}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => download(`agendamento-regras-${new Date().toISOString().slice(0, 10)}.json`, buildBookingExport(config, ownerEmail))}>
              <Download className="w-4 h-4" /> {t('booking.settings.export')}
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> {t('booking.settings.import')}
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />
          </div>
          {ioNote && <Banner tone={ioNote.tone}>{ioNote.text}</Banner>}
        </div>
      </Section>

      <Section title={t('booking.settings.logTitle')} tip={t('booking.settings.logTip')}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button size="sm" busy={logBusy} onClick={loadLog}>{t('booking.settings.logView')}</Button>
            {log && log.length > 0 && <Button size="sm" onClick={() => download(`agendamento-registro-${new Date().toISOString().slice(0, 10)}.json`, log)}><Download className="w-4 h-4" /> {t('booking.settings.logDownload')}</Button>}
            <Button size="sm" variant="danger" onClick={async () => {
              if (!window.confirm(t('booking.settings.logClearConfirm'))) return;
              const res = await clearBookingLogAction();
              if (res.ok) setLog([]);
              else setLogError(errorText(t, res));
            }}>
              <Trash2 className="w-4 h-4" /> {t('booking.settings.logClear')}
            </Button>
          </div>
          {logError && <Banner tone="error">{logError}</Banner>}
          {log && (log.length === 0 ? (
            <p className="text-label text-slate-500">{t('booking.settings.logEmpty')}</p>
          ) : (
            <ul className="max-h-[420px] overflow-auto divide-y divide-slate-200 rounded-xl border border-slate-200">
              {log.map((e, i) => (
                <li key={i} className="px-3 py-2 text-label">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-caption font-bold uppercase ${e.l === 'error' ? 'text-red-600' : e.l === 'warn' ? 'text-amber-700' : 'text-slate-400'}`}>{e.l}</span>
                    <span className="font-medium text-brand-dark">{t(`booking.log.${e.c}`, { defaultValue: e.c })}</span>
                    <span className="text-slate-400 tabular-nums">{new Date(e.t).toLocaleString(locale)}</span>
                  </div>
                  <p className="text-caption text-slate-500 break-words">
                    {Object.entries(e.d).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </Section>
    </div>
  );
}
