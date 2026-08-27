/**
 * Converte horas decimais no formato "00h 00m".
 *
 *   0     -> "0m"
 *   0.5   -> "30m"
 *   1.5   -> "1h 30m"
 *   13.5  -> "13h 30m"
 *   15    -> "15h"
 *
 * Os minutos são arredondados, então 0.336h vira "20m" e não "20.16m".
 * Valores negativos são exibidos com sinal (aparecem em ajustes manuais).
 */
export function formatHoursMinutes(hours: unknown): string {
  const value = Number(hours);
  if (!Number.isFinite(value)) return '0m';

  const sign = value < 0 ? '-' : '';
  const totalMinutes = Math.round(Math.abs(value) * 60);

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h > 0 && m > 0) return `${sign}${h}h ${m}m`;
  if (h > 0) return `${sign}${h}h`;
  return `${sign}${m}m`;
}
