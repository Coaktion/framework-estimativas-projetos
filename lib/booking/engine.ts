/**
 * Motor do Agendamento: ocupação da agenda, busca de horários e criação da
 * reunião com os bloqueios de preparação, pré-reunião, respiro, trabalho
 * subsequente e intervalo entre reuniões.
 *
 * Porte fiel do antigo backend em Apps Script (Code.gs). A agenda chega por
 * uma interface (CalendarApi), então o motor não sabe nada de OAuth nem de
 * banco: o servidor injeta a API do Google e grava o registro devolvido.
 *
 * Regras que valem para tudo:
 *  - Só horário VAZIO conta: qualquer evento bloqueia (inclusive "livre"),
 *    exceto os que o anfitrião recusou, local de trabalho e aniversários,
 *    e os títulos cadastrados como "espaço livre" nas configurações.
 *  - Nada é criado se algum bloqueio exigido não couber POR INTEIRO; uma
 *    falha no meio desfaz tudo o que já tinha sido criado.
 */

import {
  BookingError, applyTemplate, clampInt, effectiveType, isEmail, publicType,
  TEMPLATE_DEFAULTS, type BookingConfig, type MeetingType, type TemplateKey, type TransparentRule,
} from './config';
import { dmyInTz, hmInTz, listDays, parseInTz, weekdayOfYmd, nextYmd, ymdInTz } from './time';

export type Iv = [number, number];
const DAY = 86400000;

export const BOOKING_LIMITS = {
  /** Teto de horários devolvidos por busca. */
  MAX_SLOTS: 2500,
  /** Máximo de agendas de participantes cruzadas por busca. */
  MAX_CHECK_CALS: 10,
  /** Tamanho máximo da página de dias por busca. */
  SLOT_CHUNK_DAYS: 60,
  /** Horizonte de busca de lacunas para a preparação. */
  PREP_SEARCH_DAYS: 120,
  /** Horizonte de busca de lacunas para o trabalho subsequente. */
  POST_SEARCH_DAYS: 30,
  /** Máximo de blocos por conjunto (cada bloco é um evento = uma chamada à API). */
  MAX_FRAGS: 8,
};

/* ------------------------------------------------------------------------ */
/*                         Interface com a agenda                           */
/* ------------------------------------------------------------------------ */

export interface CalEvent {
  id: string;
  status?: string;
  summary?: string;
  eventType?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; self?: boolean; resource?: boolean; responseStatus?: string }[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  extendedProperties?: { private?: Record<string, string> };
}

export interface CalendarApi {
  /** E-mail do dono da agenda (organizador). */
  email: string;
  /** Fuso da agenda principal. */
  timeZone: string;
  /** Lista todos os eventos do intervalo (a paginação fica por conta da implementação). */
  listEvents(params: { timeMin: string; timeMax: string; privateExtendedProperty?: string; showDeleted?: boolean }): Promise<CalEvent[]>;
  /** Ocupação de outras agendas, numa consulta só. */
  freeBusy(emails: string[], timeMin: string, timeMax: string): Promise<Record<string, Iv[] | null>>;
  insertEvent(resource: Record<string, any>, opts?: { sendUpdates?: 'all' | 'none'; conferenceDataVersion?: number }): Promise<CalEvent>;
  patchEvent(id: string, patch: Record<string, any>): Promise<void>;
  /** 'gone' = o evento já não existia. */
  deleteEvent(id: string, opts?: { sendUpdates?: 'all' | 'none' }): Promise<'deleted' | 'gone'>;
}

export type LogFn = (level: 'info' | 'warn' | 'error', code: string, data?: Record<string, unknown>) => void;

/* ------------------------------------------------------------------------ */
/*                              Intervalos                                  */
/* ------------------------------------------------------------------------ */

export function mergeIntervals(arr: Iv[]): Iv[] {
  const sorted = arr.slice().sort((a, b) => a[0] - b[0]);
  const out: Iv[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur[0] <= last[1]) {
      if (cur[1] > last[1]) last[1] = cur[1];
    } else {
      out.push([cur[0], cur[1]]);
    }
  }
  return out;
}

/** Algum intervalo (ordenado) cruza [s, e)? */
export function overlaps(intervals: Iv[], s: number, e: number): boolean {
  for (const iv of intervals) {
    if (iv[0] >= e) return false;
    if (iv[1] > s) return true;
  }
  return false;
}

function hits(s: number, e: number, list: Iv[]): boolean {
  return list.some((iv) => s < iv[1] && iv[0] < e);
}

/** Par [início, fim] utilizável? Barra NaN, Infinity e invertidos. */
function validRange(f: Iv): boolean {
  return Number.isFinite(f[0]) && Number.isFinite(f[1]) && f[1] > f[0] && Math.abs(f[0]) < 8.64e15 && Math.abs(f[1]) < 8.64e15;
}

const fragsMs = (frags: Iv[] | null) => (frags || []).reduce((a, f) => a + (f[1] - f[0]), 0);

/**
 * Primeiro instante em que needMs já cabe POR INTEIRO nas lacunas dadas (mesmas
 * regras do placeFrags). A capacidade só cresce com o tempo, então o teste por
 * horário vira uma comparação.
 */
export function earliestFeasible(gaps: Iv[], needMs: number, mode: string, fragMinM: number, fragMaxM: number): number {
  if (needMs <= 0) return -Infinity;
  if (mode !== 'split') {
    for (const g of gaps) if (g[1] - g[0] >= needMs) return g[0] + needMs;
    return Infinity;
  }
  const minFrag = Math.max(5, fragMinM || 15) * 60000;
  let maxFrag = fragMaxM > 0 ? Math.max(fragMaxM * 60000, minFrag) : Infinity;
  if (maxFrag !== Infinity && needMs / maxFrag > BOOKING_LIMITS.MAX_FRAGS) maxFrag = Math.ceil(needMs / BOOKING_LIMITS.MAX_FRAGS);
  let remaining = needMs;
  let used = 0;
  for (let i = 0; i < gaps.length && used < BOOKING_LIMITS.MAX_FRAGS; i++) {
    const g = gaps[i];
    const take = Math.min(g[1] - g[0], remaining, maxFrag);
    if (take < Math.min(minFrag, remaining)) continue;
    remaining -= take;
    used++;
    if (remaining <= 0) return g[0] + take;
  }
  return Infinity;
}

/**
 * Distribui totalMs nas lacunas. mode 'single' = um bloco; 'split' = vários
 * (cada lacuna recebe no máximo um fragmento, entre fragMin e fragMax minutos;
 * o resto final pode ser menor). placement 'earliest' = primeiro período livre;
 * 'latest' = colado ao alvo. Pode devolver alocação parcial no 'split'.
 */
export function placeFrags(gaps: Iv[], totalMs: number, mode: string, placement: string, fragMinM: number, fragMaxM: number): Iv[] | null {
  if (mode !== 'split') {
    if (placement === 'earliest') {
      for (const g of gaps) if (g[1] - g[0] >= totalMs) return [[g[0], g[0] + totalMs]];
    } else {
      for (let i = gaps.length - 1; i >= 0; i--) {
        const g = gaps[i];
        if (g[1] - g[0] >= totalMs) return [[g[1] - totalMs, g[1]]];
      }
    }
    return null;
  }
  const minFrag = Math.max(5, fragMinM || 15) * 60000;
  let maxFrag = fragMaxM > 0 ? Math.max(fragMaxM * 60000, minFrag) : Infinity;
  // Cada fragmento vira um evento; sem teto, um preparo longo com fragmento
  // pequeno geraria dezenas de chamadas à API.
  if (maxFrag !== Infinity && totalMs / maxFrag > BOOKING_LIMITS.MAX_FRAGS) maxFrag = Math.ceil(totalMs / BOOKING_LIMITS.MAX_FRAGS);
  let remaining = totalMs;
  const frags: Iv[] = [];
  const order = placement === 'earliest' ? gaps : gaps.slice().reverse();
  for (let i = 0; i < order.length && remaining > 0 && frags.length < BOOKING_LIMITS.MAX_FRAGS; i++) {
    const g = order[i];
    const take = Math.min(g[1] - g[0], remaining, maxFrag);
    if (take < Math.min(minFrag, remaining)) continue;
    frags.push(placement === 'earliest' ? [g[0], g[0] + take] : [g[1] - take, g[1]]);
    remaining -= take;
  }
  if (!frags.length) return null;
  return frags.sort((a, b) => a[0] - b[0]);
}

/* ------------------------------------------------------------------------ */
/*                     Expediente (fuso da agenda)                          */
/* ------------------------------------------------------------------------ */

type WorkHours = Pick<MeetingType, 'workStart' | 'workEnd' | 'weekdays'>;
const DEFAULT_HOURS: WorkHours = { workStart: '09:00', workEnd: '18:00', weekdays: [1, 2, 3, 4, 5] };

class WorkClock {
  private memo = new Map<string, Iv[]>();
  constructor(private tz: string) {}

  /** Lacunas LIVRES entre fromMs e toMs, recortadas ao expediente do tipo. */
  freeGaps(t: WorkHours, busy: Iv[], fromMs: number, toMs: number): Iv[] {
    const gaps: Iv[] = [];
    if (!(toMs > fromMs)) return gaps;
    let ymd = ymdInTz(fromMs, this.tz);
    const lastYmd = ymdInTz(toMs, this.tz);
    let guard = 0;
    while (ymd <= lastYmd && guard++ < 400) {
      if (t.weekdays.includes(weekdayOfYmd(ymd))) {
        const ws = Math.max(parseInTz(ymd, t.workStart, this.tz), fromMs);
        const we = Math.min(parseInTz(ymd, t.workEnd, this.tz), toMs);
        let cur = ws;
        for (let i = 0; i < busy.length && cur < we; i++) {
          if (busy[i][1] <= cur) continue;
          if (busy[i][0] >= we) break;
          if (busy[i][0] > cur) gaps.push([cur, Math.min(busy[i][0], we)]);
          cur = Math.max(cur, busy[i][1]);
        }
        if (cur < we) gaps.push([cur, we]);
      }
      ymd = nextYmd(ymd);
    }
    return gaps;
  }

  /** Janelas de expediente (independem de ocupação). */
  workWindows(t: WorkHours, fromMs: number, toMs: number): Iv[] {
    if (!(toMs > fromMs)) return [];
    const key = `${t.workStart}|${t.workEnd}|${t.weekdays.join('')}|${fromMs}|${toMs}`;
    const cached = this.memo.get(key);
    if (cached) return cached;
    const out: Iv[] = [];
    let ymd = ymdInTz(fromMs, this.tz);
    const lastYmd = ymdInTz(toMs, this.tz);
    let guard = 0;
    while (ymd <= lastYmd && guard++ < 800) {
      if (t.weekdays.includes(weekdayOfYmd(ymd))) {
        const ws = Math.max(parseInTz(ymd, t.workStart, this.tz), fromMs);
        const we = Math.min(parseInTz(ymd, t.workEnd, this.tz), toMs);
        if (we > ws) out.push([ws, we]);
      }
      ymd = nextYmd(ymd);
    }
    this.memo.set(key, out);
    return out;
  }

  /** Instante que fica `minutes` de EXPEDIENTE depois de anchorMs. */
  shiftForward(t: WorkHours, anchorMs: number, minutes: number, horizonDays = 60): number {
    let need = minutes * 60000;
    if (need <= 0) return anchorMs;
    const ceil = anchorMs + horizonDays * DAY;
    for (const w of this.workWindows(t, anchorMs, ceil)) {
      const len = w[1] - w[0];
      if (len >= need) return w[0] + need;
      need -= len;
    }
    return ceil;
  }

  /** Instante que fica `minutes` de EXPEDIENTE antes de anchorMs. */
  shiftBack(t: WorkHours, anchorMs: number, minutes: number, horizonDays = 60): number {
    let need = minutes * 60000;
    if (need <= 0) return anchorMs;
    const floor = anchorMs - horizonDays * DAY;
    const wins = this.workWindows(t, floor, anchorMs);
    for (let i = wins.length - 1; i >= 0; i--) {
      const len = wins[i][1] - wins[i][0];
      if (len >= need) return wins[i][1] - need;
      need -= len;
    }
    return floor;
  }

  /** Minutos de EXPEDIENTE (livres ou ocupados) entre dois instantes. */
  minutesBetween(t: WorkHours, aMs: number, bMs: number): number {
    if (bMs <= aMs) return 0;
    return Math.round(this.workWindows(t, aMs, bMs).reduce((a, w) => a + (w[1] - w[0]), 0) / 60000);
  }
}

/* ------------------------------------------------------------------------ */
/*                                Motor                                     */
/* ------------------------------------------------------------------------ */

type Candidate = { id: string; title: string; s: number; e: number; rule: TransparentRule; moveTo?: Iv };
type BusyResult = { busy: Iv[]; allBusy: Iv[]; transparent: Candidate[] };

export type Lang = 'pt' | 'en' | 'es';

const TEXTS: Record<Lang, Record<string, string>> = {
  pt: {
    scheduled: 'Agendado pelo Agendamento do Aktie Now Tool Center.', type: 'Tipo', requester: 'Solicitante', items: 'Itens',
    guests: 'Convidados adicionais', notes: 'Observações', notInformed: 'Não informado', untitled: '(sem título)',
    multi: 'Reserva múltipla: {n} horários bloqueados para confirmação posterior — os demais devem ser liberados.',
    focus: 'Estou em um bloco de foco reservado automaticamente. Por favor, proponha outro horário.',
  },
  en: {
    scheduled: 'Booked through Aktie Now Tool Center Booking.', type: 'Type', requester: 'Requested by', items: 'Items',
    guests: 'Additional guests', notes: 'Notes', notInformed: 'Not provided', untitled: '(untitled)',
    multi: 'Multiple hold: {n} time slots held for later confirmation — the others must be released.',
    focus: 'I am in an automatically reserved focus block. Please propose another time.',
  },
  es: {
    scheduled: 'Agendado mediante Agendamiento de Aktie Now Tool Center.', type: 'Tipo', requester: 'Solicitante', items: 'Ítems',
    guests: 'Invitados adicionales', notes: 'Observaciones', notInformed: 'No informado', untitled: '(sin título)',
    multi: 'Reserva múltiple: {n} horarios bloqueados para confirmación posterior — los demás deben liberarse.',
    focus: 'Estoy en un bloque de foco reservado automáticamente. Por favor, propón otro horario.',
  },
};

export interface FindSlotsParams {
  typeId: string;
  itemIds?: string[];
  durationMin?: number;
  multi?: boolean;
  fromDay?: number;
  days?: number;
  /** Ocupação de outras agendas (solicitante / convidados marcados) — só vale para o núcleo da reunião. */
  othersBusy?: (fromMs: number, toMs: number) => Promise<{ busy: Iv[]; unavailable: string[] }>;
}

export interface BookParams {
  typeId: string;
  itemIds?: string[];
  durationMin?: number;
  starts: string[];
  title: string;
  zoho?: string;
  notes?: string;
  guests?: string[];
  requester: { email: string; name: string };
}

export type RoleSummary = { blocks: { start: string; end: string }[]; minutes: number; outsideWindow?: boolean } | null;

export interface BookResult {
  group: string;
  title: string;
  multi: boolean;
  typeId: string;
  typeName: string;
  durationMin: number;
  bookings: { eventId: string; start: string; end: string; meetLink: string | null }[];
  blocks: { i: string; r: string; s: string; e: string }[];
  roles: Record<'pre' | 'prep' | 'buffer' | 'post' | 'gap', RoleSummary>;
  tz: string;
}

export type BlockRecord = { i: string; r: string; s: string; e: string };
export type MeetingRecord = { i: string; s: string; e: string };

export type EventState = { state: 'ok' | 'deleted' | 'declined'; by?: string };

function agzProps(group: string, role: string, typeId: string) {
  return { private: { agzApp: '1', agzGroup: group, agzRole: role, agzType: typeId } };
}

function extractMeet(ev: CalEvent): string | null {
  if (ev.hangoutLink) return ev.hangoutLink;
  for (const ep of ev.conferenceData?.entryPoints || []) {
    if (ep.entryPointType === 'video' && ep.uri) return ep.uri;
  }
  return null;
}

function isQuotaError(e: unknown): boolean {
  const m = String((e as any)?.message ?? e ?? '').toLowerCase();
  return ['rate limit', 'quota', 'too many', 'ratelimitexceeded', 'backenderror'].some((k) => m.includes(k));
}

/** Executa fn em até `limit` itens por vez, na ordem. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let failed: unknown = null;
  async function worker() {
    while (next < items.length && !failed) {
      const index = next++;
      try {
        out[index] = await fn(items[index], index);
      } catch (e) {
        failed = failed ?? e;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failed) throw failed;
  return out;
}

/** Conta sem Focus Time (contas pessoais): evita tentar de novo a cada bloco. */
const focusUnsupported = new Set<string>();

export class BookingEngine {
  private clock: WorkClock;
  private now: number;
  private log: LogFn;
  private lang: Lang;

  constructor(private api: CalendarApi, private config: BookingConfig, opts: { now?: number; log?: LogFn; lang?: Lang } = {}) {
    this.clock = new WorkClock(api.timeZone);
    this.now = opts.now ?? Date.now();
    this.log = opts.log ?? (() => {});
    this.lang = opts.lang ?? 'pt';
  }

  get tz() {
    return this.api.timeZone;
  }

  type(typeId: string): MeetingType {
    const t = this.config.types.find((x) => x.id === typeId);
    if (!t) throw new BookingError('type_not_allowed');
    return t;
  }

  private parse(ymd: string, hm: string) {
    return parseInTz(ymd, hm, this.tz);
  }

  /* ------------------------------ Ocupação ------------------------------ */

  async getBusy(startMs: number, endMs: number, type?: MeetingType): Promise<BusyResult> {
    const intervals: Iv[] = [];
    const allIntervals: Iv[] = [];
    const candidates: Candidate[] = [];
    const tr = this.config.settings.transparent;
    const trOn = tr.enabled && tr.rules.length > 0;
    const ruleFor = (ev: CalEvent) => {
      if (!trOn) return null;
      const summary = ev.summary ?? '';
      return tr.rules.find((r) => r.title === summary) || null;
    };
    const hasGuests = (ev: CalEvent) => (ev.attendees || []).some((a) => !a.self && !a.resource);

    const events = await this.api.listEvents({ timeMin: new Date(startMs).toISOString(), timeMax: new Date(endMs).toISOString() });
    for (const ev of events) {
      if (ev.status === 'cancelled') continue;
      const et = ev.eventType || 'default';
      if (et === 'workingLocation' || et === 'birthday') continue;
      const me = (ev.attendees || []).find((a) => a.self);
      if (me && me.responseStatus === 'declined') continue; // recusado = livre
      let s: number;
      let e: number;
      let allDay = false;
      if (ev.start?.dateTime && ev.end?.dateTime) {
        s = new Date(ev.start.dateTime).getTime();
        e = new Date(ev.end.dateTime).getTime();
      } else if (ev.start?.date && ev.end?.date) {
        s = this.parse(ev.start.date, '00:00');
        e = this.parse(ev.end.date, '00:00'); // end.date é exclusivo
        allDay = true;
      } else {
        continue;
      }
      if (!(e > s)) continue;
      allIntervals.push([s, e]);
      const rule = ruleFor(ev);
      if (rule && !allDay && !(tr.onlyNoGuests && hasGuests(ev))) {
        candidates.push({ id: ev.id, title: ev.summary || '', s, e, rule });
        continue; // a ocupação efetiva é decidida abaixo
      }
      intervals.push([s, e]);
    }

    const allBusy = mergeIntervals(allIntervals);
    // Regras "só se houver espaço vazio no dia/semana" precisam de um destino
    // real, medido contra a agenda COMPLETA (incluindo os próprios eventos).
    const transparent: Candidate[] = [];
    const claimed: Iv[] = [];
    for (const cand of candidates) {
      if (cand.rule.requireFree === 'none') {
        transparent.push(cand);
        continue;
      }
      const slot = this.findRelocationSlot(cand, allBusy, cand.rule.requireFree, type, claimed);
      if (slot) {
        cand.moveTo = slot;
        claimed.push(slot);
        transparent.push(cand);
      } else {
        intervals.push([cand.s, cand.e]); // sem destino: continua ocupando
      }
    }
    return { busy: mergeIntervals(intervals), allBusy, transparent };
  }

  /** Primeira lacuna verdadeiramente livre que comporta o evento, no mesmo dia ou semana. */
  private findRelocationSlot(cand: { s: number; e: number }, allBusy: Iv[], scope: string, type: WorkHours | undefined, extraBusy: Iv[]): Iv | null {
    const t = type || DEFAULT_HOURS;
    const durMs = cand.e - cand.s;
    const ymd = ymdInTz(cand.s, this.tz);
    let fromMs: number;
    let toMs: number;
    if (scope === 'day') {
      fromMs = this.parse(ymd, '00:00');
      toMs = this.parse(nextYmd(ymd), '00:00');
    } else {
      const wd = weekdayOfYmd(ymd);
      fromMs = this.parse(nextYmd(ymd, -wd), '00:00');
      toMs = this.parse(nextYmd(ymd, 7 - wd), '00:00');
    }
    fromMs = Math.max(fromMs, this.now); // nunca reagendar para trás
    if (toMs <= fromMs) return null;
    const occupied = extraBusy.length ? mergeIntervals(allBusy.concat(extraBusy)) : allBusy;
    for (const g of this.clock.freeGaps(t, occupied, fromMs, toMs)) {
      if (g[1] - g[0] >= durMs) return [g[0], g[0] + durMs];
    }
    return null;
  }

  /** Reuniões do app (não os blocos) dos tipos dados — base da regra de intervalo. */
  private async groupMeetings(typeIds: string[], startMs: number, endMs: number): Promise<Iv[]> {
    const out: Iv[] = [];
    for (const tid of typeIds) {
      let events: CalEvent[] = [];
      try {
        events = await this.api.listEvents({
          timeMin: new Date(startMs).toISOString(), timeMax: new Date(endMs).toISOString(), privateExtendedProperty: `agzType=${tid}`,
        });
      } catch {
        continue;
      }
      for (const ev of events) {
        if (ev.status === 'cancelled' || !ev.start?.dateTime || !ev.end?.dateTime) continue;
        // Os bloqueios também levam agzType; o intervalo é medido só entre reuniões.
        const role = ev.extendedProperties?.private?.agzRole;
        if (role && role !== 'meeting' && role !== 'block') continue;
        const s = new Date(ev.start.dateTime).getTime();
        const e = new Date(ev.end.dateTime).getTime();
        if (e > s) out.push([s, e]);
      }
    }
    return out.sort((a, b) => a[0] - b[0]);
  }

  /* ------------------------------ Busca --------------------------------- */

  async findSlots(p: FindSlotsParams) {
    const type = this.type(p.typeId);
    const eff = effectiveType(type, p.itemIds);
    const dur = clampInt(p.durationMin, eff.minDur, eff.maxDur, eff.defDur);
    const durMs = dur * 60000;
    const prepMs = eff.prepMin * 60000;
    // Reserva múltipla: preparação nunca é consecutiva e o respiro por bloqueio
    // depende de bufferEach. O bloqueio pré-reunião vale sempre.
    const multi = Boolean(p.multi) && type.multiBlock;
    const bufMs = multi && !type.bufferEach ? 0 : eff.bufferMin * 60000;
    const preMs = eff.preMin * 60000;
    const stepMs = Math.max(5, type.stepMin) * 60000;
    const now = this.now;
    const earliest = now + type.minNoticeMin * 60000;

    const windowD = type.noMaxAdvance ? Infinity : Math.max(type.maxAdvanceD, 1);
    const fromDay = clampInt(p.fromDay, 0, 36500, 0);
    const reqDays = clampInt(p.days, 1, BOOKING_LIMITS.SLOT_CHUNK_DAYS, Math.min(Number.isFinite(windowD) ? windowD : BOOKING_LIMITS.SLOT_CHUNK_DAYS, BOOKING_LIMITS.SLOT_CHUNK_DAYS));
    const lastDay = Number.isFinite(windowD) ? Math.min(fromDay + reqDays, windowD) : fromDay + reqDays;
    const nDays = lastDay - fromDay;
    const base = {
      durationMin: dur, tz: this.tz, fromDay, maxBlocks: type.maxBlocks,
      blockBufferMin: Math.round(bufMs / 60000), type: publicType(type),
    };
    if (nDays <= 0) return { ...base, slots: [] as string[], unavailable: [] as string[], days: 0, hasMoreDays: false };

    const dayList = listDays(nDays, fromDay, this.tz, now);
    const fetchStart = Math.max(now - DAY, this.parse(dayList[0], '00:00') - DAY);
    const fetchEnd = this.parse(dayList[dayList.length - 1], '23:59') + DAY;
    const { busy } = await this.getBusy(fetchStart, fetchEnd, type);

    let othersBusy: Iv[] = [];
    let unavailable: string[] = [];
    if (p.othersBusy) {
      const r = await p.othersBusy(fetchStart, fetchEnd);
      othersBusy = mergeIntervals(r.busy);
      unavailable = r.unavailable;
    }

    // Preparação consecutiva entra na janela do horário; nos outros modos é
    // resolvida no agendamento. Ordem: [preparação][pré-reunião][reunião][respiro].
    const consec = !multi && type.prepMode === 'consec';
    const leadMs = preMs + (consec ? prepMs : 0);

    // Intervalo mínimo entre reuniões dos tipos marcados (minutos de expediente).
    const gapRule = this.config.settings.typeGap;
    const gapMin = gapRule.typeIds.includes(type.id) ? gapRule.minutes : 0;
    const gapZones: { s: number; e: number; after: number; before: number }[] = [];
    if (gapMin > 0) {
      const marginMs = Math.min(30, Math.ceil(gapMin / 480) + 2) * DAY;
      const meets = await this.groupMeetings(gapRule.typeIds, fetchStart - marginMs, fetchEnd + marginMs);
      for (const m of meets) {
        gapZones.push({
          s: m[0], e: m[1],
          after: this.clock.shiftForward(type, m[1], gapMin, 120),
          before: this.clock.shiftBack(type, m[0], gapMin, 120),
        });
      }
    }
    const gapOk = (s: number, e: number) => {
      for (const z of gapZones) {
        if (z.e <= s) { if (s < z.after) return false; }
        else if (z.s >= e) { if (e > z.before) return false; }
        else return false;
      }
      return true;
    };

    // Preparação não consecutiva: o horário mínimo a partir do qual ela cabe.
    let minStartForPrep = -Infinity;
    if (!consec && prepMs > 0) {
      const horizonEnd = this.parse(dayList[dayList.length - 1], '23:59');
      const prepGaps = this.clock.freeGaps(type, busy, now, horizonEnd);
      const ready = earliestFeasible(prepGaps, prepMs, type.prepMode, type.prepFragMin, type.prepFragMax);
      if (ready === Infinity) {
        minStartForPrep = Infinity;
      } else {
        minStartForPrep = ready + preMs;
        if (eff.prepGapMin > 0) {
          minStartForPrep = Math.max(minStartForPrep, this.clock.shiftForward(type, ready, eff.prepGapMin, BOOKING_LIMITS.PREP_SEARCH_DAYS));
        }
      }
    }

    const slots: string[] = [];
    outer: for (const day of dayList) {
      if (!type.weekdays.includes(weekdayOfYmd(day))) continue;
      const ws = this.parse(day, type.workStart);
      const we = this.parse(day, type.workEnd);
      // Extremos do expediente podem dispensar o pré-reunião / o respiro.
      const skipPreHere = type.preSkipAtStart && preMs > 0;
      const skipBufHere = type.bufferSkipAtEnd && bufMs > 0;
      const first = ws + (skipPreHere ? (consec ? prepMs : 0) : leadMs);
      for (let t = first; t + durMs <= we; t += stepMs) {
        if (t < earliest) continue;
        const preHere = skipPreHere && t === ws ? 0 : preMs;
        const leadHere = preHere + (consec ? prepMs : 0);
        const bufHere = skipBufHere && t + durMs === we ? 0 : bufMs;
        if (t - leadHere < ws) continue;
        if (t + durMs + bufHere > we) continue;
        if (t < minStartForPrep) continue;
        if (overlaps(busy, t - leadHere, t + durMs + bufHere)) continue;
        if (othersBusy.length && overlaps(othersBusy, t, t + durMs)) continue;
        if (gapMin > 0 && !gapOk(t, t + durMs)) continue;
        slots.push(new Date(t).toISOString());
        if (slots.length >= BOOKING_LIMITS.MAX_SLOTS) break outer;
      }
    }

    return {
      ...base, slots, unavailable, days: nDays,
      hasMoreDays: !Number.isFinite(windowD) || fromDay + nDays < windowD,
    };
  }

  /* ---------------------------- Agendamento ----------------------------- */

  async book(p: BookParams): Promise<BookResult> {
    const type = this.type(p.typeId);
    const T = TEXTS[this.lang];
    const userTitle = String(p.title || '').trim().slice(0, 120);
    if (!userTitle) throw new BookingError('title_required');
    const eff = effectiveType(type, p.itemIds);

    const seen = new Set<string>();
    const starts: number[] = [];
    for (const iso of p.starts || []) {
      const ms = new Date(iso).getTime();
      if (!Number.isFinite(ms)) throw new BookingError('bad_start');
      const key = new Date(ms).toISOString();
      if (!seen.has(key)) { seen.add(key); starts.push(ms); }
    }
    if (!starts.length) throw new BookingError('bad_start');
    starts.sort((a, b) => a - b);
    const multi = starts.length > 1;
    if (multi) {
      if (!type.multiBlock) throw new BookingError('multi_not_allowed');
      if (starts.length > type.maxBlocks) throw new BookingError('too_many_blocks');
    }

    const dur = clampInt(p.durationMin, eff.minDur, eff.maxDur, eff.defDur);
    const durMs = dur * 60000;
    const prepMs = eff.prepMin * 60000;
    const bufMs = eff.bufferMin * 60000;
    const postMs = eff.postMin * 60000;
    const preMs = eff.preMin * 60000;
    const now = this.now;
    const perBlockBuf = multi ? (type.bufferEach ? bufMs : 0) : bufMs;
    const consec = !multi && type.prepMode === 'consec';

    // Validação de cada horário: antecedência, dia da semana, expediente, sobreposição.
    const minNoticeMs = type.minNoticeMin * 60000;
    const perStart: { pre: number; buf: number }[] = [];
    starts.forEach((sMs, v) => {
      if (sMs < now + minNoticeMs - 300000) throw new BookingError('too_soon');
      const ymd = ymdInTz(sMs, this.tz);
      if (!type.weekdays.includes(weekdayOfYmd(ymd))) throw new BookingError('outside_hours');
      const dayWs = this.parse(ymd, type.workStart);
      const dayWe = this.parse(ymd, type.workEnd);
      const preHere = type.preSkipAtStart && preMs > 0 && sMs === dayWs ? 0 : preMs;
      const bufHere = type.bufferSkipAtEnd && perBlockBuf > 0 && sMs + durMs === dayWe ? 0 : perBlockBuf;
      perStart.push({ pre: preHere, buf: bufHere });
      const wS = sMs - preHere - (consec ? prepMs : 0);
      const wE = sMs + durMs + bufHere;
      if (wS < dayWs || wE > dayWe) throw new BookingError('outside_hours');
      if (v > 0 && wS < starts[v - 1] + durMs + perStart[v - 1].buf) throw new BookingError('blocks_overlap');
    });
    const first = starts[0];
    const lastEndMs = starts[starts.length - 1] + durMs;

    // Revalidação (condição de corrida): as janelas ainda estão vazias? A busca
    // começa em "agora" porque a preparação pode cair em qualquer lacuna até lá.
    const busyRes = await this.getBusy(
      Math.min(now - 3600000, first - DAY),
      lastEndMs + (postMs > 0 ? BOOKING_LIMITS.POST_SEARCH_DAYS + 1 : 1) * DAY,
      type,
    );
    const busy = busyRes.busy;
    starts.forEach((s2, v) => {
      const lead = perStart[v].pre + (consec ? prepMs : 0);
      if (overlaps(busy, s2 - lead, s2 + durMs + perStart[v].buf)) throw new BookingError('conflict');
    });

    const gapRule = this.config.settings.typeGap;
    const gapMin = gapRule.typeIds.includes(type.id) ? gapRule.minutes : 0;
    if (gapMin > 0) {
      const meets = await this.groupMeetings(gapRule.typeIds, first - 60 * DAY, lastEndMs + 60 * DAY);
      for (const m of meets) {
        for (const cs of starts) {
          const ce = cs + durMs;
          if (m[1] <= cs) { if (this.clock.minutesBetween(type, m[1], cs) < gapMin) throw new BookingError('type_gap'); }
          else if (m[0] >= ce) { if (this.clock.minutesBetween(type, ce, m[0]) < gapMin) throw new BookingError('type_gap'); }
          else throw new BookingError('conflict');
        }
      }
    }

    const me = this.api.email.toLowerCase();
    const requesterEmail = p.requester.email.trim().toLowerCase();
    const guests = Array.from(new Set((p.guests || []).map((g) => String(g || '').trim().toLowerCase())))
      .filter((g) => isEmail(g) && g !== me && g !== requesterEmail)
      .slice(0, 30);
    const attendees: { email: string; responseStatus?: string }[] = [{ email: me, responseStatus: 'accepted' }];
    if (requesterEmail !== me) attendees.push({ email: requesterEmail });
    guests.forEach((g) => attendees.push({ email: g }));

    const reqName = p.requester.name.trim() || requesterEmail;
    const zoho = type.zohoField ? String(p.zoho || '').trim().slice(0, 500) : '';
    const notes = String(p.notes || '').slice(0, 2000);
    const itemNames = type.items.filter((it) => eff.itemIds.includes(it.id)).map((it) => it.name);
    const templates = this.config.settings.templates;
    const tplFor = (key: TemplateKey) => ({ title: templates[key]?.title || TEMPLATE_DEFAULTS[key].title, desc: templates[key]?.desc || '' });
    const vars = (idx: number, total: number, whenMs: number) => ({
      titulo: userTitle, solicitante: reqName, email: requesterEmail, reuniao: type.name, itens: itemNames.join(', '),
      datareuniao: dmyInTz(first, this.tz), horareuniao: hmInTz(first, this.tz),
      databloco: dmyInTz(whenMs, this.tz), horabloco: hmInTz(whenMs, this.tz),
      zoho: zoho || T.notInformed, duracao: `${dur} min`, convidados: guests.join(', '), observacoes: notes,
      organizador: me, bloco: idx || 1, totalblocos: total || 1, blocoinfo: total > 1 ? ` (${idx}/${total})` : '',
    });
    const tplTitle = (key: TemplateKey, idx: number, total: number, whenMs: number) => applyTemplate(tplFor(key).title, vars(idx, total, whenMs)).slice(0, 250);
    const tplDesc = (key: TemplateKey, idx: number, total: number, whenMs: number) => {
      const raw = tplFor(key).desc;
      return raw ? applyTemplate(raw, vars(idx, total, whenMs)).slice(0, 6000) : '';
    };

    const title = tplTitle('meeting', 1, 1, first);
    const descLines = [
      T.scheduled,
      `${T.type}: ${type.name}`,
      `${T.requester}: ${reqName !== requesterEmail ? `${reqName} <${requesterEmail}>` : requesterEmail}`,
    ];
    if (itemNames.length) descLines.push(`${T.items}: ${itemNames.join(', ')}`);
    // O link do Zoho só entra se o anfitrião usar [Zoho] em algum modelo.
    if (guests.length) descLines.push(`${T.guests}: ${guests.join(', ')}`);
    if (multi) descLines.push(T.multi.replace('{n}', String(starts.length)));
    if (notes) descLines.push('', `${T.notes}:`, notes);

    const group = 'g' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

    /* FASE 0 — destinos dos eventos que serão reagendados. Vem antes do
       planejamento: o espaço para onde um evento vai deixa de estar livre. */
    const movable = busyRes.transparent.filter((tv) => tv.rule.reschedule && tv.moveTo);
    const coreOccupied: Iv[] = starts.map((s0, i) => [s0 - perStart[i].pre, s0 + durMs + perStart[i].buf]);
    const toMove: Candidate[] = [];
    const reserved: Iv[] = [];
    const noSlotFor: string[] = [];
    for (const tv of movable) {
      if (!hits(tv.s, tv.e, coreOccupied)) continue;
      const dest = this.findRelocationSlot(tv, busyRes.allBusy, tv.rule.requireFree, type, coreOccupied.concat(reserved));
      if (!dest) { noSlotFor.push(tv.title || T.untitled); continue; }
      tv.moveTo = dest;
      reserved.push(dest);
      toMove.push(tv);
    }
    const busyPlan = reserved.length ? mergeIntervals(busy.concat(reserved)) : busy;

    /* FASE 1 — planejamento. Nada é criado aqui. */
    type PlanItem = { role: string; tplKey: TemplateKey; idx: number; total: number; s: number; e: number };
    const plan: PlanItem[] = [];
    let planFail: string | null = null;
    const addPlan = (role: string, tplKey: TemplateKey, frags: Iv[]) => {
      frags.forEach((f, i) => plan.push({ role, tplKey, idx: i + 1, total: frags.length, s: f[0], e: f[1] }));
    };

    // (a) pré-reunião: colado antes de cada horário
    if (preMs > 0) {
      const frags: Iv[] = [];
      starts.forEach((s0, i) => { if (perStart[i].pre) frags.push([s0 - perStart[i].pre, s0]); });
      if (frags.some((f) => !validRange(f))) planFail = 'pre';
      else if (frags.length) addPlan('pre', 'pre', frags);
    }
    // (b) respiro: colado depois de cada horário
    if (!planFail && perBlockBuf > 0) {
      const frags: Iv[] = [];
      starts.forEach((s0, i) => { if (perStart[i].buf) frags.push([s0 + durMs, s0 + durMs + perStart[i].buf]); });
      if (frags.some((f) => !validRange(f))) planFail = 'buffer';
      else if (frags.length) addPlan('buffer', 'buffer', frags);
    }
    // (c) preparação: toda antes do primeiro horário
    let prepOutsideWindow = false;
    if (!planFail && prepMs > 0) {
      let frags: Iv[] | null;
      if (consec) {
        const pc = first - preMs;
        frags = [[pc - prepMs, pc]];
      } else {
        const placement = type.prepPlacement === 'earliest' ? 'earliest' : 'latest';
        const horizon = BOOKING_LIMITS.PREP_SEARCH_DAYS * DAY;
        let ceil = eff.prepGapMin > 0 ? this.clock.shiftBack(type, first, eff.prepGapMin, BOOKING_LIMITS.PREP_SEARCH_DAYS) : first - preMs;
        ceil = Math.min(ceil, first - preMs);
        const floorGap = eff.prepGapMax > 0 ? this.clock.shiftBack(type, first, eff.prepGapMax, BOOKING_LIMITS.PREP_SEARCH_DAYS) : null;
        let fromMs = placement === 'earliest' ? now : Math.max(now, ceil - horizon);
        if (floorGap !== null) fromMs = Math.max(fromMs, floorGap);
        const toMs = placement === 'earliest' ? Math.min(ceil, now + horizon) : ceil;
        frags = placeFrags(this.clock.freeGaps(type, busyPlan, fromMs, toMs), prepMs, type.prepMode, placement, type.prepFragMin, type.prepFragMax);
        // Só aceita alocação completa; se faltou, tenta a janela ampla.
        if ((!frags || fragsMs(frags) < prepMs) && type.prepFallback) {
          const wide = placeFrags(this.clock.freeGaps(type, busyPlan, Math.max(now, ceil - horizon), ceil), prepMs, type.prepMode, placement, type.prepFragMin, type.prepFragMax);
          if (wide && fragsMs(wide) >= prepMs) { frags = wide; prepOutsideWindow = true; }
        }
      }
      if (!frags || fragsMs(frags) < prepMs) planFail = 'prep';
      else addPlan('prep', frags.length > 1 ? 'prepSplit' : 'prepSingle', frags);
    }
    // (d) trabalho subsequente: todo depois do último horário
    if (!planFail && postMs > 0) {
      const postFrom = lastEndMs + perStart[starts.length - 1].buf;
      const frags = placeFrags(this.clock.freeGaps(type, busyPlan, postFrom, postFrom + BOOKING_LIMITS.POST_SEARCH_DAYS * DAY), postMs, type.postMode, 'earliest', type.postFragMin, type.postFragMax);
      if (!frags || fragsMs(frags) < postMs) planFail = 'post';
      else addPlan('post', 'post', frags);
    }
    // (e) intervalo entre reuniões reservado: depois de tudo
    if (!planFail && gapMin > 0 && gapRule.reserve) {
      let afterMs = lastEndMs + perStart[starts.length - 1].buf;
      plan.forEach((pi) => { if (pi.role === 'post') afterMs = Math.max(afterMs, pi.e); });
      const frags = placeFrags(this.clock.freeGaps(type, busyPlan, afterMs, afterMs + BOOKING_LIMITS.POST_SEARCH_DAYS * DAY), gapMin * 60000, 'split', 'earliest', 5, 0) || [];
      if (!frags.length || fragsMs(frags) < gapMin * 60000) planFail = 'typeGap';
      else addPlan('gap', 'gap', frags);
    }
    if (!planFail) {
      const bad = plan.find((pi) => !validRange([pi.s, pi.e]));
      if (bad) planFail = bad.role;
    }
    // Blocos planejados sobre outros eventos reagendáveis: mover também.
    if (!planFail) {
      const plannedRanges: Iv[] = plan.map((pi) => [pi.s, pi.e]);
      for (const tv of movable) {
        if (toMove.includes(tv) || !hits(tv.s, tv.e, plannedRanges)) continue;
        const dest = this.findRelocationSlot(tv, busyRes.allBusy, tv.rule.requireFree, type, reserved.concat(plannedRanges, coreOccupied));
        if (dest) { tv.moveTo = dest; reserved.push(dest); toMove.push(tv); }
        else noSlotFor.push(tv.title || T.untitled);
      }
    }
    if (planFail) {
      this.log('warn', 'plan_incomplete', {
        group, type: type.id, block: planFail, title: userTitle, email: requesterEmail,
        starts: starts.map((s) => new Date(s).toISOString()), durationMin: dur,
      });
      throw new BookingError('blocks_dont_fit', planFail);
    }

    /* FASE 2 — execução. Qualquer falha desfaz tudo. */
    const created: { id: string; meeting: boolean }[] = [];
    const movedBack: { id: string; from: string; fromEnd: string }[] = [];
    const moved: { title: string }[] = [];
    const bookings: BookResult['bookings'] = [];
    const recBlocks: BlockRecord[] = [];
    const tz = this.tz;
    const rollback = async (why: string) => {
      await mapLimit(created, 4, async (c) => {
        try { await this.api.deleteEvent(c.id, { sendUpdates: c.meeting ? 'all' : 'none' }); } catch { /* segue */ }
      });
      for (const m of movedBack) {
        try { await this.api.patchEvent(m.id, { start: { dateTime: m.from, timeZone: tz }, end: { dateTime: m.fromEnd, timeZone: tz } }); } catch { /* segue */ }
      }
      this.log('error', 'book_rollback', { group, type: type.id, reason: why.slice(0, 300), undone: created.length, email: requesterEmail });
    };

    try {
      for (const tv of toMove) {
        try {
          await this.api.patchEvent(tv.id, {
            start: { dateTime: new Date(tv.moveTo![0]).toISOString(), timeZone: tz },
            end: { dateTime: new Date(tv.moveTo![1]).toISOString(), timeZone: tz },
          });
          moved.push({ title: tv.title });
          movedBack.push({ id: tv.id, from: new Date(tv.s).toISOString(), fromEnd: new Date(tv.e).toISOString() });
        } catch (e) {
          this.log('warn', 'reschedule_failed', { title: tv.title, detail: String((e as any)?.message || e).slice(0, 300) });
        }
      }
      for (let k = 0; k < starts.length; k++) {
        const st0 = starts[k];
        const evKey: TemplateKey = multi ? 'block' : 'meeting';
        const resource: Record<string, any> = {
          summary: tplTitle(evKey, k + 1, starts.length, st0),
          description: tplDesc(evKey, k + 1, starts.length, st0) || descLines.join('\n'),
          start: { dateTime: new Date(st0).toISOString(), timeZone: tz },
          end: { dateTime: new Date(st0 + durMs).toISOString(), timeZone: tz },
          attendees,
          guestsCanSeeOtherGuests: true,
          reminders: { useDefault: true },
          extendedProperties: agzProps(group, evKey, type.id),
        };
        const opts: { sendUpdates: 'all'; conferenceDataVersion?: number } = { sendUpdates: 'all' };
        if (type.meet) {
          resource.conferenceData = { createRequest: { requestId: `${group}-${k}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
          opts.conferenceDataVersion = 1;
        }
        const ev = await this.api.insertEvent(resource, opts);
        created.push({ id: ev.id, meeting: true });
        bookings.push({ eventId: ev.id, start: new Date(st0).toISOString(), end: new Date(st0 + durMs).toISOString(), meetLink: extractMeet(ev) });
      }
      await mapLimit(plan, 4, async (pi) => {
        const id = await this.createBlock(pi.s, pi.e, tplTitle(pi.tplKey, pi.idx, pi.total, pi.s), tplDesc(pi.tplKey, pi.idx, pi.total, pi.s), agzProps(group, pi.role, type.id));
        created.push({ id, meeting: false });
        recBlocks.push({ i: id, r: pi.role, s: new Date(pi.s).toISOString(), e: new Date(pi.e).toISOString() });
      });
    } catch (e) {
      const msg = String((e as any)?.message || e);
      await rollback(msg);
      if (isQuotaError(e)) {
        this.log('error', 'quota_exceeded', { detail: msg.slice(0, 300) });
        throw new BookingError('rate_limited', msg);
      }
      throw new BookingError('create_failed', msg);
    }
    recBlocks.sort((a, b) => a.s.localeCompare(b.s));

    const byRole = (role: string): RoleSummary => {
      const list = recBlocks.filter((x) => x.r === role);
      if (!list.length) return null;
      const ms = list.reduce((a, x) => a + (new Date(x.e).getTime() - new Date(x.s).getTime()), 0);
      return { blocks: list.map((x) => ({ start: x.s, end: x.e })), minutes: Math.round(ms / 60000) };
    };
    const roles = { pre: byRole('pre'), prep: byRole('prep'), buffer: byRole('buffer'), post: byRole('post'), gap: byRole('gap') };
    if (roles.prep && prepOutsideWindow) roles.prep.outsideWindow = true;

    // Observações operacionais vão para o registro do anfitrião, nunca para quem agenda.
    if (noSlotFor.length) this.log('warn', 'reschedule_no_slot', { group, count: noSlotFor.length, detail: noSlotFor.slice(0, 8).join(', ').slice(0, 400) });
    const notMoved = busyRes.transparent.filter((tv) => !toMove.includes(tv));
    if (notMoved.length) {
      this.log('info', 'transparent_kept', {
        group, count: notMoved.length,
        detail: notMoved.slice(0, 8).map((tv) => `${tv.title || T.untitled} [${!tv.rule.reschedule ? 'no-reschedule' : !tv.moveTo ? 'no-free-slot' : 'no-conflict'}]`).join('; ').slice(0, 500),
      });
    }
    if (moved.length) this.log('info', 'events_rescheduled', { group, count: moved.length, detail: moved.map((m) => m.title).join(', ').slice(0, 400) });
    if (prepOutsideWindow) this.log('warn', 'prep_outside_window', { group, type: type.id });
    this.log('info', 'book_ok', {
      group, type: type.id, title: userTitle, email: requesterEmail, requester: reqName,
      blocks: recBlocks.length, meetings: bookings.length, start: bookings[0]?.start,
    });

    return { group, title, multi, typeId: type.id, typeName: type.name, durationMin: dur, bookings, blocks: recBlocks, roles, tz };
  }

  /** Bloqueio na agenda: tenta "Focus time" (Workspace) e cai para evento privado comum. */
  private async createBlock(startMs: number, endMs: number, title: string, description: string, props: Record<string, any>): Promise<string> {
    const base: Record<string, any> = {
      summary: title,
      start: { dateTime: new Date(startMs).toISOString(), timeZone: this.tz },
      end: { dateTime: new Date(endMs).toISOString(), timeZone: this.tz },
      transparency: 'opaque',
      extendedProperties: props,
    };
    if (description) base.description = description;
    const key = this.api.email;
    if (!focusUnsupported.has(key)) {
      try {
        const ev = await this.api.insertEvent({
          ...base,
          eventType: 'focusTime',
          focusTimeProperties: { autoDeclineMode: 'declineOnlyNewConflictingInvitations', chatStatus: 'doNotDisturb', declineMessage: TEXTS[this.lang].focus },
        });
        return ev.id;
      } catch (e) {
        if (isQuotaError(e)) throw e;
        focusUnsupported.add(key);
      }
    }
    const ev = await this.api.insertEvent({ ...base, visibility: 'private', reminders: { useDefault: false } });
    return ev.id;
  }

  /* ------------------------- Gestão dos registros ------------------------ */

  /** Estado real de cada evento do app numa só listagem (ids ausentes = apagados). */
  async loadEventStates(records: { meetings: MeetingRecord[]; blocks: BlockRecord[] }[]): Promise<Map<string, EventState>> {
    const map = new Map<string, EventState>();
    let minMs: number | null = null;
    let maxMs: number | null = null;
    records.forEach((r) => {
      [...r.meetings, ...r.blocks].forEach((x) => {
        const s = new Date(x.s).getTime();
        const e = new Date(x.e || x.s).getTime();
        if (Number.isFinite(s)) minMs = minMs === null ? s : Math.min(minMs, s);
        if (Number.isFinite(e)) maxMs = maxMs === null ? e : Math.max(maxMs, e);
      });
    });
    if (minMs === null || maxMs === null) return map;
    const events = await this.api.listEvents({
      timeMin: new Date(minMs - DAY).toISOString(), timeMax: new Date(maxMs + DAY).toISOString(),
      privateExtendedProperty: 'agzApp=1', showDeleted: true,
    });
    for (const ev of events) {
      if (!ev.id) continue;
      if (ev.status === 'cancelled') { map.set(ev.id, { state: 'deleted' }); continue; }
      const declined = (ev.attendees || []).find((a) => a.responseStatus === 'declined');
      map.set(ev.id, declined ? { state: 'declined', by: declined.email || '' } : { state: 'ok' });
    }
    return map;
  }

  /** Apaga eventos de um agendamento. scope: all | blocks | before | after. */
  async deleteEvents(record: { meetings: MeetingRecord[]; blocks: BlockRecord[] }, scope: 'all' | 'blocks' | 'before' | 'after') {
    const firstStart = record.meetings.reduce<number | null>((mn, m) => {
      const t = new Date(m.s).getTime();
      return mn === null ? t : Math.min(mn, t);
    }, null);
    const lastEnd = record.meetings.reduce((mx, m) => Math.max(mx, new Date(m.e || m.s).getTime() || 0), 0);
    const targets: { id: string; meeting: boolean }[] = [];
    if (scope === 'all') record.meetings.forEach((m) => targets.push({ id: m.i, meeting: true }));
    record.blocks.forEach((x) => {
      const s = new Date(x.s).getTime();
      if (scope === 'all' || scope === 'blocks') targets.push({ id: x.i, meeting: false });
      else if (scope === 'before' && firstStart !== null && s < firstStart) targets.push({ id: x.i, meeting: false });
      else if (scope === 'after' && s >= lastEnd) targets.push({ id: x.i, meeting: false });
    });
    let removed = 0;
    let failed = 0;
    await mapLimit(targets.filter((t) => t.id), 4, async (t) => {
      try {
        if ((await this.api.deleteEvent(t.id, { sendUpdates: t.meeting ? 'all' : 'none' })) === 'deleted') removed++;
      } catch {
        failed++;
      }
    });
    return { removed, failed };
  }
}
