import { latestBankVersionId, loadBank } from '@/lib/scoping/bank';
import { DEFAULT_MINUTES } from '@/lib/scoping/rules';
import { TIERS, inTier, stageOf } from '@/lib/scoping/themes';
import { requireScopingUser } from '@/lib/scoping/server';
import NewSessionWizard, { type WizardTrack } from './NewSessionWizard';

export default async function NewScopingPage() {
  const me = await requireScopingUser();
  // Primeira abertura depois do deploy: grava o banco de perguntas v1 (idempotente).
  const bank = await loadBank(await latestBankVersionId(me.id));
  // Perguntas que cada trilha leva para a reunião, por porte (as contagens ficam para depois da reunião).
  const tracks: WizardTrack[] = bank.tracks.map((t) => {
    const qs = bank.questions.filter((q) => q.trackKeys.includes(t.key) && stageOf(q) !== 'after');
    const byTier = Object.fromEntries(TIERS.map((tier) => {
      const shown = qs.filter((q) => inTier(q, tier));
      const essential = shown.filter((q) => q.priority === 'essencial').length;
      return [tier, { essential, recommended: shown.length - essential, questions: shown.length }];
    })) as WizardTrack['byTier'];
    return { key: t.key, type: t.type, name: t.name, description: t.description, suggestRules: t.suggestRules, byTier };
  });
  return <NewSessionWizard tracks={tracks} defaultMinutes={DEFAULT_MINUTES} />;
}
