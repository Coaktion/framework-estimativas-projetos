/**
 * Scheduled Function do Netlify: limpeza automática do Agendamento, de hora
 * em hora. Só chama a rota — a lógica fica no route handler.
 */
import type { Config } from '@netlify/functions';

export default async () => {
  const base = process.env.DEPLOY_PRIME_URL || process.env.URL;
  const segredo = process.env.BOOKING_CRON_SECRET;
  if (!base || !segredo) return new Response('config ausente', { status: 500 });

  const res = await fetch(`${base}/api/booking/cleanup`, {
    method: 'POST',
    headers: { 'x-booking-secret': segredo },
  });
  const corpo = await res.text();
  console.log(`[booking] limpeza em ${base} status=${res.status} ${corpo.slice(0, 400)}`);
  return new Response(corpo, { status: res.ok ? 200 : 500 });
};

export const config: Config = {
  schedule: '20 * * * *',
};
