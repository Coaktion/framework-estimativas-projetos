import { notFound } from 'next/navigation';
import { estimateFor, loadSessionView, requireScopingUser } from '@/lib/scoping/server';
import SessionClient from './SessionClient';

export default async function ScopingSessionPage({ params }: { params: { id: string } }) {
  const me = await requireScopingUser();
  const view = await loadSessionView(params.id);
  if (!view) notFound();
  const estimate = await estimateFor(view.bank, view.session, view.answers).catch(() => null);
  return (
    <SessionClient
      session={view.session}
      bank={view.bank}
      initialAnswers={view.answers}
      initialNote={view.note}
      initialEstimate={estimate}
      canDelete={me.isAdmin || view.session.createdBy === me.id}
    />
  );
}
