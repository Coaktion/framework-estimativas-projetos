/**
 * Scheduled Function do Netlify: dispara a coleta diária.
 *
 * O cron do Netlify roda em UTC. 10:00 UTC = 07:00 BRT (UTC-3).
 * A função só chama a rota — a lógica fica no route handler, para que coleta
 * manual e agendada sigam exatamente o mesmo caminho.
 */
import type { Config } from '@netlify/functions';

export default async (req: Request) => {
  // DEPLOY_PRIME_URL aponta para o deploy que está rodando (em produção, o
  // próprio site; num "Run now" do branch deploy, o development). URL é
  // sempre a produção — fica só de reserva.
  const base = process.env.DEPLOY_PRIME_URL || process.env.URL;
  const segredo = process.env.PSOPS_INGEST_SECRET;

  if (!base || !segredo) {
    console.error('[psops] URL ou PSOPS_INGEST_SECRET ausentes no ambiente.');
    return new Response('config ausente', { status: 500 });
  }

  const res = await fetch(`${base}/api/pre-sales-ops/ingest/run`, {
    method: 'POST',
    headers: { 'x-psops-secret': segredo },
  });
  const corpo = await res.text();
  console.log(`[psops] coleta em ${base} status=${res.status} ${corpo.slice(0, 400)}`);

  return new Response(corpo, { status: res.ok ? 200 : 500 });
};

export const config: Config = {
  schedule: '0 10 * * *',
};
