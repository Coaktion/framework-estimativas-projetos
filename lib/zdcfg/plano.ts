/**
 * Plano de execução: a ordem de passos que a TELA conduz, um por chamada ao
 * servidor. Mesma ordem e mesmas regras do runner.py + modules/__init__.py:
 *   preflight -> marca -> (Help Center) -> groups, ticket_fields, ticket_form,
 *   triggers, views, macros, guide, guide_theme, sla, schedules, users, memberships
 *
 * Cada passo leva só o pedaço da planilha de que precisa (a planilha inteira
 * não viaja a cada chamada). Código compartilhado navegador/servidor.
 */
import {
  type Blueprint, type CustomField, type DefaultTrigger, type GuideArticle, type Holiday,
  type Macro, type View, display, grupoPadrao, optionTag,
} from './blueprint';

/** O que o servidor precisa saber da demo em qualquer passo. */
export type Base = {
  cliente: string;
  identificador: string;
  idioma: Blueprint['idioma'];
  tag_prefix: string;
  grupos: string[];
};

/** Estado que o servidor devolve e a tela reenvia (o resolver do Python). */
export type Ctx = {
  fakeId: number;
  brandId: number | null;
  guideSub: string | null;
  groups: Record<string, number>;
  fields: Record<string, number>;
  fieldOptions: Record<string, Record<string, string>>;
  formId: number | null;
  categoryIds: Record<string, number>;
  sections: Record<string, number>;
  chanSubject?: string;
  sentId?: number | string | null;
  guide?: { loc: string; cat: number | null; segs: Record<string, number>; perm: number | null };
  theme?: { jobId: string | null; themeId: string | null };
  staff?: number[];
  scheduleId?: number | null;
};

export const ctxInicial = (): Ctx => ({
  fakeId: 1000, brandId: null, guideSub: null, groups: {}, fields: {}, fieldOptions: {},
  formId: null, categoryIds: {}, sections: {},
});

export type Passo =
  | { tipo: 'log'; msg: string } // só na tela, sem chamada ao servidor
  | { tipo: 'preflight'; tags: string[]; campos: [string, string][]; grupos: [string, string][] }
  | { tipo: 'brand'; nome: string; subdominio: string }
  | { tipo: 'hc_check' }
  | { tipo: 'group'; nome: string }
  | { tipo: 'field'; campo: CustomField }
  | { tipo: 'form_create'; refs: string[] }
  | { tipo: 'form_conditions'; condicionais: Blueprint['condicionais'] }
  | { tipo: 'trig_setup' }
  | { tipo: 'trigger'; gatilho: DefaultTrigger }
  | { tipo: 'views_setup' }
  | { tipo: 'view'; view: View }
  | { tipo: 'macro'; macro: Macro }
  | { tipo: 'guide_setup' }
  | { tipo: 'section'; titulo: string }
  | { tipo: 'article'; artigo: GuideArticle }
  | { tipo: 'guia_section' }
  | { tipo: 'guia_article'; artigo: GuideArticle }
  | { tipo: 'theme_start'; arquivo: string }
  | { tipo: 'theme_poll' }
  | { tipo: 'theme_publish' }
  | { tipo: 'sla'; grupo: string; pos: number; alvos: Record<string, number> }
  | { tipo: 'schedule_create'; nome: string }
  | { tipo: 'schedule_workweek'; programacao: NonNullable<Blueprint['programacao']> }
  | { tipo: 'holiday'; feriado: Holiday }
  | { tipo: 'memb_staff' }
  | { tipo: 'memb_batch'; lote: number };

/** Módulos, na ordem do Python. Cada um vira "== nome ==" no log. */
export type Modulo = { nome: string; passos: Passo[]; aoFinal?: 'views' | 'memberships' };

export function baseDe(bp: Blueprint): Base {
  return {
    cliente: bp.cliente, identificador: bp.identificador, idioma: bp.idioma,
    tag_prefix: bp.tag_prefix, grupos: bp.grupos.map((g) => g.nome),
  };
}

export const TEMA_POR_IDIOMA: Record<string, string> = {
  'pt-br': 'tema_hc_br.zip', 'en-us': 'tema_hc_en.zip', es: 'tema_hc_es.zip',
};

const SLA_PADRAO = { urgent: 60, high: 120, normal: 240, low: 480 };

export function passoPreflight(bp: Blueprint): Passo {
  const tags: string[] = [];
  for (const f of [...bp.campos_ticket, ...bp.campos_usuario, ...bp.campos_org]) {
    for (const o of f.opcoes) tags.push(optionTag(bp, f.chave_ref, o));
  }
  return {
    tipo: 'preflight',
    tags,
    campos: bp.campos_ticket.map((f) => [f.nome, display(bp, f.nome)]),
    grupos: bp.grupos.map((g) => [g.nome, display(bp, g.nome)]),
  };
}

export function modulos(bp: Blueprint, temaArquivo: string | null): Modulo[] {
  const temGuide = bp.guide_secoes.length || bp.guide_artigos.length || bp.guia_apresentacao;
  const g = bp.guia_apresentacao;
  const sla = bp.sla && bp.sla.criar ? bp.sla : null;
  const alvos = sla
    ? (Object.keys(sla.resolution).length ? sla.resolution
      : Object.keys(sla.first_reply).length ? sla.first_reply : SLA_PADRAO)
    : SLA_PADRAO;
  const prog = bp.programacao && bp.programacao.criar ? bp.programacao : null;

  return [
    { nome: 'groups', passos: bp.grupos.map((x) => ({ tipo: 'group', nome: x.nome })) },
    { nome: 'ticket_fields', passos: bp.campos_ticket.map((campo) => ({ tipo: 'field', campo })) },
    {
      nome: 'ticket_form',
      passos: [
        { tipo: 'form_create', refs: bp.campos_ticket.map((f) => f.chave_ref) },
        { tipo: 'form_conditions', condicionais: bp.condicionais },
      ],
    },
    {
      nome: 'triggers',
      passos: !bp.gatilhos_padrao.length ? []
        : grupoPadrao(bp) === null ? [{ tipo: 'log', msg: 'SEM grupos - pulando gatilhos padrao' }]
          : [{ tipo: 'trig_setup' } as Passo, ...bp.gatilhos_padrao.map((gatilho) => ({ tipo: 'trigger', gatilho }) as Passo)],
    },
    { nome: 'views', passos: [{ tipo: 'views_setup' }, ...bp.views.map((view) => ({ tipo: 'view', view }) as Passo)], aoFinal: 'views' },
    { nome: 'macros', passos: bp.macros.map((macro) => ({ tipo: 'macro', macro })) },
    {
      nome: 'guide',
      passos: temGuide
        ? [
          { tipo: 'guide_setup' } as Passo,
          ...bp.guide_secoes.map((s) => ({ tipo: 'section', titulo: s.titulo }) as Passo),
          ...bp.guide_artigos.map((artigo) => ({ tipo: 'article', artigo }) as Passo),
          ...(g && g.criar ? [{ tipo: 'guia_section' } as Passo, { tipo: 'guia_article', artigo: g } as Passo] : []),
        ]
        : [],
    },
    {
      nome: 'guide_theme',
      passos: temaArquivo ? [{ tipo: 'theme_start', arquivo: temaArquivo }, { tipo: 'theme_poll' }, { tipo: 'theme_publish' }] : [],
    },
    {
      nome: 'sla',
      passos: sla ? bp.grupos.map((x, i) => ({ tipo: 'sla', grupo: x.nome, pos: i + 1, alvos }) as Passo) : [],
    },
    {
      nome: 'schedules',
      passos: prog
        ? [
          { tipo: 'schedule_create', nome: prog.nome } as Passo,
          { tipo: 'schedule_workweek', programacao: prog } as Passo,
          ...bp.feriados.map((feriado) => ({ tipo: 'holiday', feriado }) as Passo),
        ]
        : [],
    },
    { nome: 'users', passos: [] },
    { nome: 'memberships', passos: [{ tipo: 'memb_staff' }], aoFinal: 'memberships' },
  ];
}

/** Lotes de vínculos (100 por chamada), como no Python. */
export function lotesMembership(staff: number[], groupIds: number[]): number {
  return Math.ceil((staff.length * groupIds.length) / 100);
}
