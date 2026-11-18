import { latestBankVersionId, loadBank } from '@/lib/scoping/bank';
import { DEFAULT_MINUTES, trackCost } from '@/lib/scoping/rules';
import { requireScopingUser } from '@/lib/scoping/server';
import NewSessionWizard, { type WizardTrack } from './NewSessionWizard';

export default async function NewScopingPage() {
  const me = await requireScopingUser();
  // Primeira abertura depois do deploy: grava o banco de perguntas v1 (idempotente).
  const bank = await loadBank(await latestBankVersionId(me.id));
  const tracks: WizardTrack[] = bank.tracks.map((t) => {
    const cost = trackCost(bank, t.key, DEFAULT_MINUTES);
    return {
      key: t.key, type: t.type, name: t.name, description: t.description, suggestRules: t.suggestRules,
      essential: cost.essential, recommended: cost.recommended, questions: cost.questions,
    };
  });
  return <NewSessionWizard tracks={tracks} defaultMinutes={DEFAULT_MINUTES} />;
}
