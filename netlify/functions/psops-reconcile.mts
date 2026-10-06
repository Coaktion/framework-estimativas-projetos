/**
 * Scheduled Function do Netlify: reconciliação noturna.
 *
 * 04:00 UTC = 01:00 BRT — roda depois de todo mundo ter parado de mexer nos
 * artefatos, e antes da coleta das 07:00.
 */
import type { Config } from '@netlify/functions';

export default async () => {
  // DEPLOY_PRIME_URL aponta para o deploy que está rodando (em produção, o
  // próprio site; num "Run now" do branch deploy, o development). URL é
  // sempre a produção — fica só de reserva.
  const base = process.env.DEPLOY_PRIME_URL || process.env.URL;
  const segredo = process.env.PSOPS_INGEST_SECRET;
  if (!base || !segredo) return new Response('config ausente', { status: 500 });

  const res = await fetch(`${base}/api/pre-sales-ops/reconcile`, {
    method: 'POST',
    headers: { 'x-psops-secret': segredo },
  });
  const corpo = await res.text();
  console.log(`[psops] reconciliação em ${base} status=${res.status} ${corpo.slice(0, 400)}`);
  return new Response(corpo, { status: res.ok ? 200 : 500 });
};

export const config: Config = {
  schedule: '0 4 * * *',
};
