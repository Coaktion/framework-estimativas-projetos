'use client';

/**
 * Tipos de reunião do anfitrião (Agendamento): lista à esquerda, formulário à
 * direita. Os campos condicionais seguem as mesmas regras do saneamento em
 * lib/booking/config (ex.: reserva múltipla não admite preparação consecutiva).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Plus, Trash2, X } from 'lucide-react';
import { DATE_LOCALE, normalizeLanguage } from '@/app/i18n/settings';
import { blankType, newId, type BookingConfig, type MeetingItem, type MeetingType } from '@/lib/booking/config';
import { CARD, Check, Chip, Hint, INPUT, Label, NumberField, Switch, TextArea, TextInput, Button } from './ui';

export default function TypesEditor({ config, onChange }: { config: BookingConfig; onChange: (c: BookingConfig) => void }) {
  const { t, i18n } = useTranslation();
  const locale = DATE_LOCALE[normalizeLanguage(i18n.language)];
  const [selId, setSelId] = useState<string | null>(config.types[0]?.id || null);
  const type = config.types.find((x) => x.id === selId) || null;
  const weekdayNames = [0, 1, 2, 3, 4, 5, 6].map((d) => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + d, 12))));

  const setTypes = (types: MeetingType[]) => {
    const ids = new Set(types.map((x) => x.id));
    onChange({
      ...config,
      types,
      // Autorizações e a regra de intervalo não podem apontar para tipos apagados.
      auths: config.auths.map((a) => ({ ...a, types: a.types.filter((id) => ids.has(id)) })),
      settings: { ...config.settings, typeGap: { ...config.settings.typeGap, typeIds: config.settings.typeGap.typeIds.filter((id) => ids.has(id)) } },
    });
  };
  const update = (patch: Partial<MeetingType>) => {
    if (!type) return;
    const next = { ...type, ...patch };
    if (next.multiBlock && next.prepMode === 'consec') next.prepMode = 'single';
    if (next.maxDur < next.minDur) next.maxDur = next.minDur;
    if (next.minItems > next.items.length) next.minItems = next.items.length;
    setTypes(config.types.map((x) => (x.id === type.id ? next : x)));
  };
  const updateItem = (index: number, patch: Partial<MeetingItem>) => update({ items: type!.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });

  const add = () => {
    const created = blankType(t('booking.types.newName'));
    setTypes([...config.types, created]);
    setSelId(created.id);
  };
  const duplicate = () => {
    if (!type) return;
    const copy: MeetingType = { ...JSON.parse(JSON.stringify(type)), id: newId('t'), name: `${t('booking.types.copyPrefix')} ${type.name}` };
    copy.items = copy.items.map((it) => ({ ...it, id: newId('i') }));
    setTypes([...config.types, copy]);
    setSelId(copy.id);
  };
  const remove = () => {
    if (!type || !window.confirm(t('booking.types.deleteConfirm', { name: type.name }))) return;
    const rest = config.types.filter((x) => x.id !== type.id);
    setTypes(rest);
    setSelId(rest[0]?.id || null);
  };

  const radio = (field: 'prepMode' | 'prepPlacement' | 'postMode', value: string, label: string, hint?: string) => (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <input type="radio" name={`${type!.id}-${field}`} checked={type![field] === value} onChange={() => update({ [field]: value } as any)} className="mt-1 border-slate-300 text-brand-primary focus:ring-brand-primary" />
      <span>
        <span className="block text-body text-brand-dark">{label}</span>
        {hint && <span className="block text-caption text-slate-500">{hint}</span>}
      </span>
    </label>
  );
  const divider = (title: string, tip?: string, hint?: string) => (
    <div className="md:col-span-2 border-t border-slate-200 pt-5 mt-1">
      <Label tip={tip}>{title}</Label>
      {hint && <Hint className="mt-0">{hint}</Hint>}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
      <div className={`${CARD} p-2 flex flex-col gap-1`}>
        {config.types.map((x) => (
          <button key={x.id} type="button" onClick={() => setSelId(x.id)} className={`text-left px-3 py-2.5 rounded-xl text-body truncate ${x.id === selId ? 'brand-bg-primary text-brand-ink font-medium' : 'text-brand-dark hover:bg-slate-100'}`}>
            {x.name || x.id}
          </button>
        ))}
        <button type="button" onClick={add} className="text-left px-3 py-2.5 rounded-xl text-body font-medium text-brand-dark hover:bg-slate-100 inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('booking.types.add')}
        </button>
      </div>

      {!type ? (
        <div className={`${CARD} p-10 text-center text-body text-slate-500`}>{t('booking.types.empty')}</div>
      ) : (
        <div className={`${CARD} p-6`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <Label tip={t('booking.types.nameTip')}>{t('booking.types.name')}</Label>
              <TextInput maxLength={80} value={type.name} onChange={(e) => update({ name: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label tip={t('booking.types.descTip')}>{t('booking.types.desc')}</Label>
              <TextArea rows={3} maxLength={600} value={type.desc} onChange={(e) => update({ desc: e.target.value })} />
            </div>
            <NumberField label={t('booking.types.minDur')} tip={t('booking.types.minDurTip')} value={type.minDur} min={5} max={480} onChange={(n) => update({ minDur: n })} />
            <NumberField label={t('booking.types.maxDur')} tip={t('booking.types.maxDurTip')} value={type.maxDur} min={5} max={480} onChange={(n) => update({ maxDur: n })} />
            <NumberField label={t('booking.types.defDur')} tip={t('booking.types.defDurTip')} value={type.defDur} min={5} max={480} onChange={(n) => update({ defDur: n })} />
            <NumberField label={t('booking.types.stepMin')} tip={t('booking.types.stepMinTip')} hint={t('booking.types.stepMinHint')} value={type.stepMin} min={5} max={120} onChange={(n) => update({ stepMin: n })} />
            <NumberField label={t('booking.types.prepMin')} tip={t('booking.types.prepMinTip')} hint={t('booking.types.zeroNone')} value={type.prepMin} max={480} onChange={(n) => update({ prepMin: n })} />
            <NumberField label={t('booking.types.preMin')} tip={t('booking.types.preMinTip')} hint={t('booking.types.zeroNone')} value={type.preMin} max={480} onChange={(n) => update({ preMin: n })} />
            {type.preMin > 0 && (
              <div className="md:col-span-2">
                <Switch checked={type.preSkipAtStart} onChange={(v) => update({ preSkipAtStart: v })} label={t('booking.types.preSkipAtStart')} tip={t('booking.types.preSkipAtStartTip')} />
              </div>
            )}
            <NumberField label={t('booking.types.bufferMin')} tip={t('booking.types.bufferMinTip')} hint={t('booking.types.zeroNone')} value={type.bufferMin} max={240} onChange={(n) => update({ bufferMin: n })} />
            <div />
            {type.bufferMin > 0 && (
              <div className="md:col-span-2">
                <Switch checked={type.bufferSkipAtEnd} onChange={(v) => update({ bufferSkipAtEnd: v })} label={t('booking.types.bufferSkipAtEnd')} tip={t('booking.types.bufferSkipAtEndTip')} />
              </div>
            )}

            {divider(t('booking.types.prepModeTitle'))}
            <div className="md:col-span-2">
              {type.multiBlock
                ? <Hint className="mt-0 mb-1">{t('booking.types.prepModeMultiNote')}</Hint>
                : radio('prepMode', 'consec', t('booking.types.prepConsec'), t('booking.types.prepConsecHint'))}
              {radio('prepMode', 'single', t('booking.types.prepSingle'), t('booking.types.prepSingleHint'))}
              {radio('prepMode', 'split', t('booking.types.prepSplit'), t('booking.types.prepSplitHint'))}
            </div>
            {type.prepMode === 'split' && (
              <>
                <NumberField label={t('booking.types.prepFragMin')} tip={t('booking.types.fragMinTip')} value={type.prepFragMin} min={5} max={240} onChange={(n) => update({ prepFragMin: n })} />
                <NumberField label={t('booking.types.prepFragMax')} tip={t('booking.types.fragMaxTip')} hint={t('booking.types.zeroNoMax')} value={type.prepFragMax} max={480} onChange={(n) => update({ prepFragMax: n })} />
              </>
            )}
            {type.prepMode !== 'consec' && (
              <>
                <div className="md:col-span-2">
                  <Label tip={t('booking.types.prepPlacementTip')}>{t('booking.types.prepPlacementTitle')}</Label>
                  {radio('prepPlacement', 'earliest', t('booking.types.prepEarliest'))}
                  {radio('prepPlacement', 'latest', t('booking.types.prepLatest'))}
                </div>
                <NumberField label={t('booking.types.prepGapMin')} tip={t('booking.types.prepGapMinTip')} value={type.prepGapMin} max={43200} onChange={(n) => update({ prepGapMin: n })} />
                <NumberField label={t('booking.types.prepGapMax')} tip={t('booking.types.prepGapMaxTip')} hint={t('booking.types.zeroNoMax')} value={type.prepGapMax} max={43200} onChange={(n) => update({ prepGapMax: n })} />
                <div className="md:col-span-2">
                  <Switch checked={type.prepFallback} onChange={(v) => update({ prepFallback: v })} label={t('booking.types.prepFallback')} tip={t('booking.types.prepFallbackTip')} />
                </div>
              </>
            )}

            {divider(t('booking.types.postTitle'), t('booking.types.postTip'), t('booking.types.postHint'))}
            <NumberField label={t('booking.types.postMin')} tip={t('booking.types.postMinTip')} hint={t('booking.types.zeroNone')} value={type.postMin} max={480} onChange={(n) => update({ postMin: n })} />
            <div>
              {radio('postMode', 'single', t('booking.types.postSingle'), t('booking.types.postSingleHint'))}
              {radio('postMode', 'split', t('booking.types.postSplit'), t('booking.types.postSplitHint'))}
            </div>
            {type.postMode === 'split' && (
              <>
                <NumberField label={t('booking.types.postFragMin')} tip={t('booking.types.fragMinTip')} value={type.postFragMin} min={5} max={240} onChange={(n) => update({ postFragMin: n })} />
                <NumberField label={t('booking.types.postFragMax')} tip={t('booking.types.fragMaxTip')} hint={t('booking.types.zeroNoMax')} value={type.postFragMax} max={480} onChange={(n) => update({ postFragMax: n })} />
              </>
            )}

            {divider(t('booking.types.multiTitle'))}
            <div className="md:col-span-2">
              <Switch checked={type.multiBlock} onChange={(v) => update({ multiBlock: v })} label={t('booking.types.multiBlock')} tip={t('booking.types.multiBlockTip')} />
            </div>
            {type.multiBlock && (
              <>
                <NumberField label={t('booking.types.maxBlocks')} tip={t('booking.types.maxBlocksTip')} hint="2–10" minutes={false} value={type.maxBlocks} min={2} max={10} onChange={(n) => update({ maxBlocks: n })} />
                <div className="self-end">
                  <Check checked={type.bufferEach} onChange={(v) => update({ bufferEach: v })} label={t('booking.types.bufferEach')} hint={t('booking.types.bufferEachHint')} />
                </div>
              </>
            )}

            {divider(t('booking.types.itemsTitle'), t('booking.types.itemsTip'), t('booking.types.itemsHint'))}
            <div className="md:col-span-2 space-y-3">
              {type.items.map((it, i) => (
                <div key={it.id} className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input value={it.name} maxLength={80} onChange={(e) => updateItem(i, { name: e.target.value })} placeholder={t('booking.types.itemName')} className={`${INPUT} flex-1`} />
                    <button type="button" aria-label={t('common.delete')} onClick={() => update({ items: type.items.filter((_, j) => j !== i) })} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['addMinDur', 'addDefDur', 'addPrep', 'addPre', 'addBuffer', 'addPost', 'addPrepGapMin', 'addPrepGapMax'] as const).map((k) => (
                      <label key={k} className="text-caption text-slate-500">
                        {t(`booking.types.item.${k}`)}
                        <input type="number" min={0} value={it[k]} onChange={(e) => updateItem(i, { [k]: Math.max(0, parseInt(e.target.value, 10) || 0) } as any)} className={`${INPUT} h-9 mt-1 tabular-nums`} />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <Button size="sm" onClick={() => update({ items: [...type.items, { id: newId('i'), name: t('booking.types.newItem'), addMinDur: 0, addDefDur: 0, addPrep: 0, addBuffer: 0, addPost: 0, addPre: 0, addPrepGapMin: 0, addPrepGapMax: 0 }] })}>
                <Plus className="w-4 h-4" /> {t('booking.types.addItem')}
              </Button>
            </div>
            {type.items.length > 0 && (
              <NumberField label={t('booking.types.minItems')} tip={t('booking.types.minItemsTip')} hint={t('booking.types.minItemsHint', { max: type.items.length })} minutes={false} value={type.minItems} max={type.items.length} onChange={(n) => update({ minItems: Math.min(Math.max(n, 0), type.items.length) })} />
            )}

            {divider(t('booking.types.hoursTitle'))}
            <div>
              <Label tip={t('booking.types.workStartTip')}>{t('booking.types.workStart')}</Label>
              <TextInput type="time" value={type.workStart} onChange={(e) => update({ workStart: e.target.value || '09:00' })} />
            </div>
            <div>
              <Label tip={t('booking.types.workEndTip')}>{t('booking.types.workEnd')}</Label>
              <TextInput type="time" value={type.workEnd} onChange={(e) => update({ workEnd: e.target.value || '18:00' })} />
            </div>
            <div className="md:col-span-2">
              <Label tip={t('booking.types.weekdaysTip')}>{t('booking.types.weekdays')}</Label>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                  const on = type.weekdays.includes(d);
                  return (
                    <Chip key={d} on={on} onClick={() => {
                      const next = on ? type.weekdays.filter((x) => x !== d) : [...type.weekdays, d].sort();
                      if (next.length) update({ weekdays: next });
                    }}>
                      {weekdayNames[d]}
                    </Chip>
                  );
                })}
              </div>
            </div>
            <NumberField label={t('booking.types.minNoticeMin')} tip={t('booking.types.minNoticeMinTip')} value={type.minNoticeMin} max={43200} onChange={(n) => update({ minNoticeMin: n })} />
            <NumberField label={t('booking.types.maxAdvanceD')} tip={t('booking.types.maxAdvanceDTip')} minutes={false} disabled={type.noMaxAdvance} value={type.maxAdvanceD} min={1} max={3650} onChange={(n) => update({ maxAdvanceD: n })} />
            <div className="md:col-span-2 space-y-4">
              <Switch checked={type.noMaxAdvance} onChange={(v) => update({ noMaxAdvance: v })} label={t('booking.types.noMaxAdvance')} tip={t('booking.types.noMaxAdvanceTip')} />
              <Switch checked={type.meet} onChange={(v) => update({ meet: v })} label={t('booking.types.meet')} tip={t('booking.types.meetTip')} />
              <Switch checked={type.zohoField} onChange={(v) => update({ zohoField: v })} label={t('booking.types.zohoField')} tip={t('booking.types.zohoFieldTip')} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-8 pt-5 border-t border-slate-200">
            <Button size="sm" onClick={duplicate}><Copy className="w-4 h-4" /> {t('booking.types.duplicate')}</Button>
            <Button size="sm" variant="danger" onClick={remove}><Trash2 className="w-4 h-4" /> {t('booking.types.delete')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
