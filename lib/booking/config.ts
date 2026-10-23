/**
 * Regras de agendamento de cada anfitrião (Agendamento / Booking).
 *
 * Cada usuário que recebe agendamentos tem a sua configuração: tipos de
 * reunião, quem pode agendar cada tipo e ajustes globais (intervalo entre
 * reuniões, eventos tratados como espaço livre, títulos dos eventos criados).
 * Porte do antigo backend em Apps Script: os nomes dos campos e os limites
 * são os mesmos, para que um backup antigo possa ser importado.
 *
 * Este arquivo roda no servidor e no navegador (sem dependências de servidor).
 */

export const BOOKING_CONFIG_VERSION = 1;

export const PREP_MODES = ['consec', 'single', 'split'] as const;
export type PrepMode = (typeof PREP_MODES)[number];
export type Placement = 'earliest' | 'latest';
export type PostMode = 'single' | 'split';
export type RequireFree = 'none' | 'day' | 'week';

export interface MeetingItem {
  id: string;
  name: string;
  addMinDur: number;
  addDefDur: number;
  addPrep: number;
  addBuffer: number;
  addPost: number;
  addPre: number;
  addPrepGapMin: number;
  addPrepGapMax: number;
}

export interface MeetingType {
  id: string;
  name: string;
  desc: string;
  minDur: number;
  maxDur: number;
  defDur: number;
  stepMin: number;
  prepMin: number;
  prepMode: PrepMode;
  prepPlacement: Placement;
  prepFragMin: number;
  prepFragMax: number;
  prepFallback: boolean;
  prepGapMin: number;
  prepGapMax: number;
  preMin: number;
  preSkipAtStart: boolean;
  bufferMin: number;
  bufferSkipAtEnd: boolean;
  postMin: number;
  postMode: PostMode;
  postFragMin: number;
  postFragMax: number;
  workStart: string;
  workEnd: string;
  weekdays: number[];
  minNoticeMin: number;
  maxAdvanceD: number;
  noMaxAdvance: boolean;
  zohoField: boolean;
  multiBlock: boolean;
  maxBlocks: number;
  bufferEach: boolean;
  meet: boolean;
  items: MeetingItem[];
  minItems: number;
}

/**
 * Quem pode agendar. As regras se somam: quem bater em mais de uma recebe a
 * união dos tipos. `all` = qualquer usuário com acesso ao Agendamento;
 * `segment` = um segmento do Tool Center; `email` = e-mail exato ou *@domínio.
 */
export interface AuthRule {
  id: string;
  who: 'all' | 'segment' | 'email';
  value: string;
  types: string[];
}

export interface TransparentRule {
  title: string;
  requireFree: RequireFree;
  reschedule: boolean;
}

export const TEMPLATE_KEYS = ['meeting', 'block', 'pre', 'buffer', 'prepSingle', 'prepSplit', 'post', 'gap'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export type EventTemplate = { title: string; desc: string };

export const TEMPLATE_DEFAULTS: Record<TemplateKey, EventTemplate> = {
  meeting: { title: '[Titulo] — [Solicitante]', desc: '' },
  block: { title: '[Titulo] — [Solicitante] (opção [Bloco]/[TotalBlocos])', desc: '' },
  pre: { title: '🔒 Bloqueio pré-reunião — [Titulo] — [Solicitante]', desc: '' },
  buffer: { title: '🌬️ Respiro — [Titulo] — [Solicitante]', desc: '' },
  prepSingle: { title: '⏳ Preparação — [Titulo] — [Solicitante]', desc: '' },
  prepSplit: { title: '⏳ Preparação ([Bloco]/[TotalBlocos]) — [Titulo] — [Solicitante]', desc: '' },
  post: { title: '🛠️ Trabalho subsequente[BlocoInfo] — [Titulo] — [Solicitante]', desc: '' },
  gap: { title: '⏸️ Intervalo entre reuniões[BlocoInfo] — [Titulo] — [Solicitante]', desc: '' },
};

/** Placeholders aceitos nos modelos (o texto de ajuda fica nas traduções). */
export const TEMPLATE_PLACEHOLDERS = [
  'Titulo', 'Solicitante', 'Email', 'Reuniao', 'Itens', 'DataReuniao', 'HoraReuniao', 'DataBloco',
  'HoraBloco', 'Zoho', 'Duracao', 'Convidados', 'Observacoes', 'Organizador', 'Bloco', 'TotalBlocos', 'BlocoInfo',
] as const;

export interface BookingSettings {
  typeGap: { typeIds: string[]; minutes: number; reserve: boolean };
  transparent: { enabled: boolean; onlyNoGuests: boolean; rules: TransparentRule[] };
  templates: Record<TemplateKey, EventTemplate>;
  /** Apaga sozinho os bloqueios de reuniões futuras apagadas ou recusadas (varredura de hora em hora). */
  autoCleanup: boolean;
}

export interface BookingConfig {
  version: number;
  types: MeetingType[];
  auths: AuthRule[];
  settings: BookingSettings;
}

/** Erro de regra de negócio com código estável (traduzido em booking.errors.<code>). */
export class BookingError extends Error {
  constructor(public code: string, public detail?: string) {
    super(code);
  }
}

/* ------------------------------------------------------------------------ */
/*                              Saneamento                                  */
/* ------------------------------------------------------------------------ */

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  let n = typeof v === 'number' ? Math.trunc(v) : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) n = fallback;
  return Math.min(Math.max(n, min), max);
}

export function validHHMM(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback;
}

export function isEmail(s: unknown): boolean {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

const safeId = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);

export function newId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function sanitizeWeekdays(arr: unknown): number[] {
  const out: number[] = [];
  (Array.isArray(arr) ? arr : []).forEach((d) => {
    const n = parseInt(String(d), 10);
    if (n >= 0 && n <= 6 && !out.includes(n)) out.push(n);
  });
  return out.length ? out.sort((a, b) => a - b) : [1, 2, 3, 4, 5];
}

function sanitizeItems(items: unknown): MeetingItem[] {
  const out: MeetingItem[] = [];
  const seen = new Set<string>();
  (Array.isArray(items) ? items : []).slice(0, 50).forEach((raw: any) => {
    const it = raw || {};
    const id = safeId(it.id) || newId('i');
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      name: String(it.name || id).slice(0, 80),
      addMinDur: clampInt(it.addMinDur, 0, 480, 0),
      addDefDur: clampInt(it.addDefDur, 0, 480, 0),
      addPrep: clampInt(it.addPrep, 0, 480, 0),
      addBuffer: clampInt(it.addBuffer, 0, 480, 0),
      addPost: clampInt(it.addPost, 0, 480, 0),
      addPre: clampInt(it.addPre, 0, 480, 0),
      addPrepGapMin: clampInt(it.addPrepGapMin, 0, 43200, 0),
      addPrepGapMax: clampInt(it.addPrepGapMax, 0, 43200, 0),
    });
  });
  return out;
}

export function sanitizeType(raw: any, idHint?: string): MeetingType | null {
  const t = raw || {};
  const id = safeId(t.id || idHint);
  if (!id) return null;
  // Campos antigos do Apps Script: prepConsec (boolean) e minNoticeH (horas).
  const legacyMode = t.prepConsec === false ? 'single' : 'consec';
  const minDur = clampInt(t.minDur, 5, 480, 30);
  const maxDur = clampInt(t.maxDur, minDur, 480, Math.max(60, minDur));
  const items = sanitizeItems(t.items);
  const type: MeetingType = {
    id,
    name: String(t.name || id).slice(0, 80),
    desc: String(t.desc || '').slice(0, 600),
    minDur,
    maxDur,
    defDur: clampInt(t.defDur, minDur, maxDur, Math.min(60, maxDur)),
    stepMin: clampInt(t.stepMin, 5, 120, 30),
    prepMin: clampInt(t.prepMin, 0, 480, 0),
    prepMode: (PREP_MODES as readonly string[]).includes(t.prepMode) ? t.prepMode : legacyMode,
    prepPlacement: t.prepPlacement === 'earliest' ? 'earliest' : 'latest',
    prepFragMin: clampInt(t.prepFragMin, 5, 240, 15),
    prepFragMax: clampInt(t.prepFragMax, 0, 480, 0),
    prepFallback: t.prepFallback !== false,
    prepGapMin: clampInt(t.prepGapMin, 0, 43200, 0),
    prepGapMax: clampInt(t.prepGapMax, 0, 43200, 0),
    preMin: clampInt(t.preMin, 0, 480, 0),
    preSkipAtStart: Boolean(t.preSkipAtStart),
    bufferMin: clampInt(t.bufferMin, 0, 240, 0),
    bufferSkipAtEnd: Boolean(t.bufferSkipAtEnd),
    postMin: clampInt(t.postMin, 0, 480, 0),
    postMode: t.postMode === 'split' ? 'split' : 'single',
    postFragMin: clampInt(t.postFragMin, 5, 240, 15),
    postFragMax: clampInt(t.postFragMax, 0, 480, 0),
    workStart: validHHMM(t.workStart, '09:00'),
    workEnd: validHHMM(t.workEnd, '18:00'),
    weekdays: sanitizeWeekdays(t.weekdays),
    minNoticeMin: clampInt(t.minNoticeMin ?? (typeof t.minNoticeH === 'number' ? t.minNoticeH * 60 : undefined), 0, 43200, 720),
    maxAdvanceD: clampInt(t.maxAdvanceD, 1, 3650, 21),
    noMaxAdvance: Boolean(t.noMaxAdvance),
    zohoField: t.zohoField !== false,
    multiBlock: Boolean(t.multiBlock),
    maxBlocks: clampInt(t.maxBlocks, 2, 10, 3),
    bufferEach: t.bufferEach !== false,
    meet: t.meet === undefined ? true : Boolean(t.meet),
    items,
    minItems: clampInt(t.minItems, 0, items.length, 0),
  };
  // Reserva múltipla não admite preparação consecutiva.
  if (type.multiBlock && type.prepMode === 'consec') type.prepMode = 'single';
  // O intervalo preparação → reunião não se aplica à preparação consecutiva.
  if (type.prepMode === 'consec') {
    type.prepGapMin = 0;
    type.prepGapMax = 0;
  }
  return type;
}

/** Modelo de um tipo novo (botão "Novo tipo"). */
export function blankType(name: string): MeetingType {
  return sanitizeType({
    id: newId('t'), name, minDur: 30, maxDur: 90, defDur: 60, stepMin: 30,
    bufferMin: 0, minNoticeMin: 720, maxAdvanceD: 21, meet: true,
  })!;
}

function defaultTemplates(): Record<TemplateKey, EventTemplate> {
  return JSON.parse(JSON.stringify(TEMPLATE_DEFAULTS));
}

/** Configuração inicial de quem ainda não salvou nada (mesma do antigo initialSetup). */
export function defaultBookingConfig(): BookingConfig {
  const discovery = sanitizeType({
    id: 'descoberta',
    name: 'Reunião de descoberta',
    desc: 'Primeira conversa para entender contexto e objetivos.',
    minDur: 30, maxDur: 90, defDur: 60, stepMin: 30,
    prepMin: 15, prepMode: 'consec', prepPlacement: 'latest',
    bufferMin: 15, workStart: '09:00', workEnd: '18:00', weekdays: [1, 2, 3, 4, 5],
    minNoticeMin: 720, maxAdvanceD: 21, meet: true,
  })!;
  return {
    version: BOOKING_CONFIG_VERSION,
    types: [discovery],
    auths: [{ id: 'a-all', who: 'all', value: '', types: [discovery.id] }],
    settings: {
      typeGap: { typeIds: [], minutes: 0, reserve: false },
      transparent: { enabled: false, onlyNoGuests: false, rules: [] },
      templates: defaultTemplates(),
      autoCleanup: false,
    },
  };
}

/**
 * Valida e completa uma configuração vinda do banco, do formulário ou de um
 * arquivo importado. Aceita também o formato do antigo Apps Script
 * (meetingTypes como objeto e auths com `pattern`).
 */
export function normalizeBookingConfig(raw: any): BookingConfig {
  const base = defaultBookingConfig();
  if (!raw || typeof raw !== 'object') return base;

  const typeSource: any[] = Array.isArray(raw.types)
    ? raw.types
    : raw.meetingTypes && typeof raw.meetingTypes === 'object'
      ? Object.entries(raw.meetingTypes).map(([id, t]: [string, any]) => ({ ...(t || {}), id: t?.id || id }))
      : base.types;
  const types: MeetingType[] = [];
  typeSource.slice(0, 50).forEach((t) => {
    const clean = sanitizeType(t);
    if (clean && !types.some((x) => x.id === clean.id)) types.push(clean);
  });
  const typeIds = new Set(types.map((t) => t.id));

  const auths: AuthRule[] = [];
  (Array.isArray(raw.auths) ? raw.auths : []).slice(0, 200).forEach((a: any, index: number) => {
    if (!a || typeof a !== 'object') return;
    let who: AuthRule['who'] = a.who === 'all' || a.who === 'segment' || a.who === 'email' ? a.who : 'email';
    let value = String(a.value ?? a.pattern ?? '').trim();
    if (who === 'email') {
      value = value.toLowerCase();
      if (!isEmail(value) && !/^\*@[^\s@]+\.[^\s@]{2,}$/.test(value)) return;
    } else if (who === 'segment') {
      value = value.toUpperCase().slice(0, 30);
      if (!value) return;
    } else {
      value = '';
    }
    const ts = (Array.isArray(a.types) ? a.types : []).map(String).filter((id: string) => typeIds.has(id));
    auths.push({ id: String(a.id || `a${index}`).slice(0, 40), who, value, types: Array.from(new Set(ts)) });
  });

  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const tg = s.typeGap && typeof s.typeGap === 'object' ? s.typeGap : {};
  const tr = s.transparent && typeof s.transparent === 'object' ? s.transparent : {};
  const tpl = s.templates && typeof s.templates === 'object' ? s.templates : {};
  const templates = defaultTemplates();
  TEMPLATE_KEYS.forEach((k) => {
    const t0 = tpl[k] || {};
    const title = typeof t0.title === 'string' ? t0.title.trim() : '';
    templates[k] = {
      title: title ? title.slice(0, 250) : TEMPLATE_DEFAULTS[k].title,
      desc: typeof t0.desc === 'string' ? t0.desc.slice(0, 3000) : '',
    };
  });

  return {
    version: BOOKING_CONFIG_VERSION,
    types,
    auths,
    settings: {
      typeGap: {
        typeIds: Array.from(new Set<string>((Array.isArray(tg.typeIds) ? tg.typeIds : []).map(String))).filter((id) => typeIds.has(id)),
        minutes: clampInt(tg.minutes, 0, 43200, 0),
        reserve: Boolean(tg.reserve),
      },
      transparent: {
        enabled: Boolean(tr.enabled),
        onlyNoGuests: Boolean(tr.onlyNoGuests),
        rules: (Array.isArray(tr.rules) ? tr.rules : [])
          .map((r: any): TransparentRule => {
            const requireFree: RequireFree = r?.requireFree === 'day' || r?.requireFree === 'week' ? r.requireFree : 'none';
            // Comparação EXATA do título: sensível a maiúsculas e espaços.
            return { title: String(r?.title ?? '').slice(0, 200), requireFree, reschedule: requireFree === 'none' ? false : Boolean(r?.reschedule) };
          })
          .filter((r: TransparentRule) => r.title.trim() !== '')
          .slice(0, 50),
      },
      templates,
      autoCleanup: Boolean(s.autoCleanup ?? raw.autoCleanup),
    },
  };
}

/* ------------------------------------------------------------------------ */
/*                        Autorização de quem agenda                         */
/* ------------------------------------------------------------------------ */

export type Booker = { email: string; segment: string };

export function authRuleMatches(rule: AuthRule, booker: Booker): boolean {
  const email = booker.email.trim().toLowerCase();
  if (rule.who === 'all') return true;
  if (rule.who === 'segment') return rule.value === String(booker.segment).toUpperCase();
  const p = rule.value.toLowerCase();
  return p === email || (p.startsWith('*@') && email.endsWith(p.slice(1)));
}

/** Tipos que o usuário pode agendar com este anfitrião (vazio = nenhum). */
export function allowedTypes(config: BookingConfig, booker: Booker): MeetingType[] {
  const ids = new Set<string>();
  config.auths.forEach((rule) => {
    if (authRuleMatches(rule, booker)) rule.types.forEach((id) => ids.add(id));
  });
  return config.types.filter((t) => ids.has(t.id));
}

/* ------------------------------------------------------------------------ */
/*                    Valores efetivos com os itens marcados                 */
/* ------------------------------------------------------------------------ */

export interface EffectiveType {
  minDur: number;
  maxDur: number;
  defDur: number;
  prepMin: number;
  bufferMin: number;
  postMin: number;
  preMin: number;
  prepGapMin: number;
  prepGapMax: number;
  itemIds: string[];
}

/** Soma os itens marcados aos valores do tipo. Lança bad_items / items_required. */
export function effectiveType(type: MeetingType, itemIds: unknown): EffectiveType {
  const ids = Array.from(new Set((Array.isArray(itemIds) ? itemIds : []).map((i) => String(i ?? ''))));
  const byId = new Map(type.items.map((it) => [it.id, it]));
  const eff: EffectiveType = {
    minDur: Math.max(5, type.minDur),
    maxDur: Math.max(5, type.maxDur),
    defDur: type.defDur,
    prepMin: type.prepMin,
    bufferMin: type.bufferMin,
    postMin: type.postMin,
    preMin: type.preMin,
    prepGapMin: type.prepGapMin,
    prepGapMax: type.prepGapMax,
    itemIds: ids,
  };
  if (eff.maxDur < eff.minDur) eff.maxDur = eff.minDur;
  for (const id of ids) {
    const it = byId.get(id);
    if (!it) throw new BookingError('bad_items');
    eff.minDur += it.addMinDur;
    eff.defDur += it.addDefDur;
    eff.prepMin += it.addPrep;
    eff.bufferMin += it.addBuffer;
    eff.postMin += it.addPost;
    eff.preMin += it.addPre;
    eff.prepGapMin += it.addPrepGapMin;
    eff.prepGapMax += it.addPrepGapMax;
  }
  if (ids.length < type.minItems) throw new BookingError('items_required');
  eff.minDur = Math.min(eff.minDur, type.maxDur);
  eff.defDur = Math.min(Math.max(eff.defDur, eff.minDur), eff.maxDur);
  return eff;
}

/** Duração mínima e padrão no navegador (sem lançar erro). */
export function effectiveDurations(
  type: Pick<MeetingType, 'minDur' | 'defDur' | 'maxDur'> & { items: { id: string; addMinDur: number; addDefDur: number }[] },
  itemIds: string[],
) {
  let minDur = type.minDur;
  let defDur = type.defDur;
  type.items.forEach((it) => {
    if (!itemIds.includes(it.id)) return;
    minDur += it.addMinDur;
    defDur += it.addDefDur;
  });
  minDur = Math.min(minDur, type.maxDur);
  defDur = Math.min(Math.max(defDur, minDur), type.maxDur);
  return { minDur, defDur, maxDur: type.maxDur };
}

/* ------------------------------------------------------------------------ */
/*                            Modelos de evento                             */
/* ------------------------------------------------------------------------ */

const fold = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Substitui os placeholders [Campo] de um modelo. Aceita acentos e qualquer
 * caixa; um nome desconhecido fica como está, para o erro de digitação aparecer.
 */
export function applyTemplate(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  if (!tpl) return '';
  const map = new Map(Object.entries(vars).map(([k, v]) => [fold(k), v]));
  return String(tpl).replace(/\[([^[\]]+)\]/g, (full, name) => {
    const key = fold(String(name));
    if (!map.has(key)) return full;
    const v = map.get(key);
    return v === null || v === undefined ? '' : String(v);
  });
}

/* ------------------------------------------------------------------------ */
/*                    Dados públicos de um tipo (para quem agenda)           */
/* ------------------------------------------------------------------------ */

export interface PublicType {
  id: string;
  name: string;
  desc: string;
  minDur: number;
  maxDur: number;
  defDur: number;
  stepMin: number;
  weekdays: number[];
  maxAdvanceD: number;
  noMaxAdvance: boolean;
  meet: boolean;
  minItems: number;
  multiBlock: boolean;
  maxBlocks: number;
  zohoField: boolean;
  items: { id: string; name: string; addMinDur: number; addDefDur: number }[];
}

export function publicType(t: MeetingType): PublicType {
  return {
    id: t.id, name: t.name, desc: t.desc, minDur: t.minDur, maxDur: t.maxDur, defDur: t.defDur,
    stepMin: t.stepMin, weekdays: t.weekdays, maxAdvanceD: t.maxAdvanceD, noMaxAdvance: t.noMaxAdvance,
    meet: t.meet, minItems: t.minItems, multiBlock: t.multiBlock, maxBlocks: t.maxBlocks, zohoField: t.zohoField,
    items: t.items.map((it) => ({ id: it.id, name: it.name, addMinDur: it.addMinDur, addDefDur: it.addDefDur })),
  };
}

/** Arquivo de backup das regras (Exportar / Importar). */
export const BOOKING_EXPORT_FORMAT = 'aktienow-booking-rules';

export function buildBookingExport(config: BookingConfig, owner: string) {
  return { format: BOOKING_EXPORT_FORMAT, formatVersion: BOOKING_CONFIG_VERSION, exportedAt: new Date().toISOString(), owner, config };
}

/** Lê um backup (deste formato ou do antigo Apps Script). Null se não reconhecer. */
export function parseBookingImport(text: string): BookingConfig | null {
  let data: any;
  try {
    data = JSON.parse(String(text || '').trim());
  } catch {
    return null;
  }
  const raw = data?.config && typeof data.config === 'object' ? data.config : data?.export && typeof data.export === 'object' ? data.export : data;
  if (!raw || typeof raw !== 'object' || !(Array.isArray(raw.types) || (raw.meetingTypes && typeof raw.meetingTypes === 'object'))) return null;
  return normalizeBookingConfig(raw);
}
