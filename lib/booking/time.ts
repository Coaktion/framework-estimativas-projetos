/**
 * Datas no fuso de um calendário (Agendamento). Tudo em milissegundos UTC;
 * os dias-calendário são strings 'yyyy-MM-dd'. Sem dependências: só Intl,
 * que existe no Node e no navegador. Usado pelo motor de horários e pela tela.
 */

const DAY = 86400000;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

/** Componentes de data/hora de um instante no fuso dado. */
export function zonedParts(ms: number, tz: string) {
  const o: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') o[p.type] = Number(p.value);
  }
  return { y: o.year, m: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, min: o.minute, s: o.second };
}

/** Deslocamento (min) do fuso em relação ao UTC no instante dado. */
export function tzOffsetMin(tz: string, ms = Date.now()): number {
  try {
    const p = zonedParts(ms, tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
  } catch {
    return 0;
  }
}

/** O fuso existe? (nome IANA aceito pelo Intl) */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'yyyy-MM-dd' do instante no fuso. */
export function ymdInTz(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** 'HH:mm' do instante no fuso. */
export function hmInTz(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  return `${pad(p.h)}:${pad(p.min)}`;
}

/** 'dd/MM/yyyy' do instante no fuso (usado nos títulos dos eventos). */
export function dmyInTz(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  return `${pad(p.d)}/${pad(p.m)}/${p.y}`;
}

/**
 * Instante (ms) de 'yyyy-MM-dd' + 'HH:mm' no fuso. Em horário de verão, uma
 * hora que não existe avança para a primeira válida.
 */
export function parseInTz(ymd: string, hm: string, tz: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let ms = guess - tzOffsetMin(tz, guess) * 60000;
  const again = guess - tzOffsetMin(tz, ms) * 60000;
  if (again !== ms) ms = again;
  return ms;
}

/** Dia da semana (0 = domingo) de um dia-calendário, independente de fuso. */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Dia-calendário seguinte. */
export function nextYmd(ymd: string, days = 1): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12) + days * DAY);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** nDays dias-calendário a partir de hoje + fromDay, no fuso. */
export function listDays(nDays: number, fromDay: number, tz: string, now = Date.now()): string[] {
  const today = ymdInTz(now, tz);
  const out: string[] = [];
  for (let i = fromDay; i < fromDay + nDays; i++) out.push(nextYmd(today, i));
  return out;
}

/** 'UTC-3', 'UTC+5:30'. */
export function offsetLabel(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `UTC${sign}${h}${m ? `:${pad(m)}` : ''}`;
}

/** 75 → '1h 15m'; 1530 → '1d 1h 30m'; abaixo de 60 → ''. */
export function humanMinutes(min: number): string {
  if (!Number.isFinite(min) || min < 60) return '';
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = Math.round(min % 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
}
