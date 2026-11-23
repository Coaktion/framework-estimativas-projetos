'use client';

/**
 * Assistente de criação da sessão (RF-08): Contexto → Trilhas → Resumo.
 * O núcleo está sempre marcado; as trilhas sugeridas pelo contexto vêm
 * marcadas e com selo "sugerida".
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check } from 'lucide-react';
import { Banner, Button, CARD, INPUT, Label, PageHeader, SELECT, TextInput } from '@/components/booking/ui';
import { normalizeScopingLang, tr } from '@/lib/scoping/i18n';
import { suggestedTracks } from '@/lib/scoping/rules';
import { PLANS, type I18nText, type SuggestRule, type TrackType } from '@/lib/scoping/types';
import { TIERS, type Tier } from '@/lib/scoping/themes';
import { createSessionAction, updateSessionAction } from '../actions';

export interface WizardTrack {
  key: string;
  type: TrackType;
  name: I18nText;
  description: I18nText;
  suggestRules: SuggestRule[];
  /** perguntas da trilha que entram na reunião, por porte (sem as contagens de depois da reunião) */
  byTier: Record<Tier, { essential: number; recommended: number; questions: number }>;
}

const TYPE_ORDER: TrackType[] = ['core', 'product', 'usecase', 'segment'];

export default function NewSessionWizard({ tracks, defaultMinutes }: { tracks: WizardTrack[]; defaultMinutes: { essential: number; recommended: number } }) {
  const { t, i18n } = useTranslation();
  const uiLang = normalizeScopingLang(i18n.language);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState('');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'pt' | 'en' | 'es'>('pt');
  const [deploymentType, setDeploymentType] = useState('new');
  const [sku, setSku] = useState('CS');
  const [plan, setPlan] = useState('professional');
  const [tier, setTier] = useState<Tier>('M');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);
  const [minEss, setMinEss] = useState(defaultMinutes.essential);
  const [minRec, setMinRec] = useState(defaultMinutes.recommended);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const suggested = useMemo(
    () => new Set(suggestedTracks(tracks.map((x) => ({ ...x, order: 0, fixedItems: [] })), { sku, plan, deploymentType })),
    [tracks, sku, plan, deploymentType],
  );
  // Enquanto a pessoa não mexeu nas trilhas, as sugeridas acompanham o contexto.
  useEffect(() => { if (!touched) setSelected(new Set(suggested)); }, [suggested, touched]);

  const active = tracks.filter((x) => x.type === 'core' || selected.has(x.key));
  const totals = active.reduce((acc, x) => ({ essential: acc.essential + x.byTier[tier].essential, recommended: acc.recommended + x.byTier[tier].recommended, questions: acc.questions + x.byTier[tier].questions }), { essential: 0, recommended: 0, questions: 0 });
  const minutes = (x: { essential: number; recommended: number }) => x.essential * minEss + x.recommended * minRec;

  const toggle = (key: string) => {
    setTouched(true);
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const start = () => {
    setError(null);
    startTransition(async () => {
      const res = await createSessionAction({ clientName, title, language, deploymentType, sku, plan, tier, trackKeys: Array.from(selected) });
      if (!res.ok) {
        setError(t(`scoping.errors.${res.error}`, { defaultValue: t('scoping.errors.server_error') }));
        return;
      }
      if (minEss !== defaultMinutes.essential || minRec !== defaultMinutes.recommended) {
        await updateSessionAction(res.id, { settings: { minutesEssential: minEss, minutesRecommended: minRec } });
      }
      router.push(`/scoping/${res.id}`);
    });
  };

  const canNext = clientName.trim().length >= 2;
  const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <PageHeader
        back={<Link href="/scoping" className="inline-flex items-center gap-1 text-label text-slate-500 hover:text-brand-dark mb-2"><ArrowLeft className="w-4 h-4" /> {t('scoping.wizard.back')}</Link>}
        title={t('scoping.wizard.titleA')}
        accent={t('scoping.wizard.titleB')}
      />

      <ol className="flex flex-wrap gap-2" aria-label={t('scoping.wizard.steps')}>
        {[1, 2, 3].map((n) => (
          <li key={n}>
            <button
              type="button"
              disabled={n > 1 && !canNext}
              onClick={() => setStep(n)}
              aria-current={step === n ? 'step' : undefined}
              className={`px-4 py-2 rounded-full text-label font-medium border ${step === n ? 'brand-bg-primary text-brand-ink border-transparent' : 'bg-white border-slate-200 text-slate-500'} disabled:opacity-40`}
            >
              {n}. {t(`scoping.wizard.step${n}`)}
            </button>
          </li>
        ))}
      </ol>

      {error && <Banner tone="error">{error}</Banner>}

      {step === 1 && (
        <section className={`${CARD} p-6 grid gap-5 sm:grid-cols-2`}>
          <div className="sm:col-span-2">
            <Label htmlFor="sc-client">{t('scoping.wizard.client')}</Label>
            <TextInput id="sc-client" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={120} autoFocus />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="sc-title">{t('scoping.wizard.sessionTitle')}</Label>
            <TextInput id="sc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t('scoping.wizard.sessionTitlePh')} />
          </div>
          <div>
            <Label htmlFor="sc-lang" tip={t('scoping.wizard.languageTip')}>{t('scoping.wizard.language')}</Label>
            <select id="sc-lang" className={SELECT} value={language} onChange={(e) => setLanguage(e.target.value as any)}>
              <option value="pt">Português (BR)</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div>
            <Label htmlFor="sc-dep">{t('scoping.wizard.deployment')}</Label>
            <select id="sc-dep" className={SELECT} value={deploymentType} onChange={(e) => setDeploymentType(e.target.value)}>
              <option value="new">{t('scoping.wizard.deploymentNew')}</option>
              <option value="optimization">{t('scoping.wizard.deploymentOpt')}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="sc-sku">SKU</Label>
            <select id="sc-sku" className={SELECT} value={sku} onChange={(e) => setSku(e.target.value)}>
              <option value="CS">CS · Customer Service</option>
              <option value="ES">ES · Employee Service</option>
            </select>
          </div>
          <div>
            <Label htmlFor="sc-plan">{t('scoping.wizard.plan')}</Label>
            <select id="sc-plan" className={SELECT} value={plan} onChange={(e) => setPlan(e.target.value)}>
              {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="block text-label font-medium text-brand-dark mb-1.5">{t('scoping.tier.label')}</legend>
            <p className="text-caption text-slate-500 mb-2">{t('scoping.tier.hint')}</p>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
              {TIERS.map((tr2) => (
                <button
                  key={tr2}
                  type="button"
                  role="radio"
                  aria-checked={tier === tr2}
                  onClick={() => setTier(tr2)}
                  className={`text-left rounded-xl border p-3 ${tier === tr2 ? 'border-transparent ring-2 ring-[color:var(--primary)]' : 'border-slate-200 hover:border-slate-400'}`}
                >
                  <span className="block text-body font-semibold text-brand-dark">{t(`scoping.tier.${tr2}`)}</span>
                  <span className="block text-caption text-slate-500">{t(`scoping.tier.${tr2}desc`)}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2 flex justify-end">
            <Button variant="primary" disabled={!canNext} onClick={() => setStep(2)}>{t('scoping.wizard.next')}</Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          {TYPE_ORDER.map((type) => {
            const list = tracks.filter((x) => x.type === type);
            if (!list.length) return null;
            return (
              <div key={type} className="space-y-3">
                <h2 className="text-title font-bold text-brand-dark">{t(`scoping.trackType.${type}`)}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((x) => {
                    const on = type === 'core' || selected.has(x.key);
                    return (
                      <button
                        key={x.key}
                        type="button"
                        aria-pressed={on}
                        disabled={type === 'core'}
                        onClick={() => toggle(x.key)}
                        className={`${CARD} text-left p-4 transition-colors ${on ? 'ring-2 ring-[color:var(--primary)]' : 'hover:border-slate-400'} disabled:cursor-default`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-body font-semibold text-brand-dark">{tr(x.name, uiLang)}</span>
                          {on && <Check className="w-5 h-5 text-brand-primary shrink-0" aria-hidden />}
                        </div>
                        <p className="text-caption text-slate-500 mt-1">{tr(x.description, uiLang)}</p>
                        <p className="text-caption text-slate-600 mt-3 tabular-nums">
                          {t('scoping.wizard.trackCost', { n: x.byTier[tier].questions, e: x.byTier[tier].essential, time: fmtMin(minutes(x.byTier[tier])) })}
                        </p>
                        {type === 'core' && <span className="mt-2 inline-block text-caption text-slate-500">{t('scoping.wizard.alwaysOn')}</span>}
                        {type !== 'core' && suggested.has(x.key) && <span className="mt-2 inline-block rounded-full border border-dashed border-slate-400 px-2 py-[2px] text-caption text-slate-600">{t('scoping.wizard.suggested')}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className={`${CARD} p-4 flex flex-wrap items-end gap-4`}>
            <div>
              <Label htmlFor="sc-me">{t('scoping.wizard.minEssential')}</Label>
              <input id="sc-me" type="number" min={0} max={30} value={minEss} onChange={(e) => setMinEss(Math.max(0, Math.min(30, Number(e.target.value) || 0)))} className={`${INPUT} w-28`} />
            </div>
            <div>
              <Label htmlFor="sc-mr">{t('scoping.wizard.minRecommended')}</Label>
              <input id="sc-mr" type="number" min={0} max={30} value={minRec} onChange={(e) => setMinRec(Math.max(0, Math.min(30, Number(e.target.value) || 0)))} className={`${INPUT} w-28`} />
            </div>
            <div className="ml-auto flex gap-3">
              <Button onClick={() => setStep(1)}>{t('scoping.wizard.prev')}</Button>
              <Button variant="primary" onClick={() => setStep(3)}>{t('scoping.wizard.next')}</Button>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className={`${CARD} p-6 space-y-5`}>
          <dl className="grid gap-3 sm:grid-cols-2 text-body">
            <div><dt className="text-caption text-slate-500">{t('scoping.wizard.client')}</dt><dd className="font-medium">{clientName}{title ? ` · ${title}` : ''}</dd></div>
            <div><dt className="text-caption text-slate-500">{t('scoping.wizard.context')}</dt><dd>{language.toUpperCase()} · {deploymentType === 'new' ? t('scoping.wizard.deploymentNew') : t('scoping.wizard.deploymentOpt')} · {sku} · {plan}</dd></div>
            <div className="sm:col-span-2"><dt className="text-caption text-slate-500">{t('scoping.wizard.tracksLabel')}</dt><dd>{active.map((x) => tr(x.name, uiLang)).join(', ')}</dd></div>
          </dl>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              [t('scoping.wizard.totalQuestions'), totals.questions],
              [t('scoping.priority.essencial'), totals.essential],
              [t('scoping.priority.recomendada'), totals.recommended],
              [t('scoping.wizard.estimatedTime'), fmtMin(minutes(totals))],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 p-4">
                <div className="text-caption text-slate-500">{label}</div>
                <div className="font-heading text-kpi text-brand-dark tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          <p className="text-caption text-slate-500">{t('scoping.wizard.timeHint')}</p>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setStep(2)}>{t('scoping.wizard.prev')}</Button>
            <Button variant="primary" busy={busy} disabled={!canNext} onClick={start}>{t('scoping.wizard.start')}</Button>
          </div>
        </section>
      )}
    </div>
  );
}
