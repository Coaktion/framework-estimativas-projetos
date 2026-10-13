/**
 * Seções que a tela deixa escolher (porte de _secoes_status / _aplicar_selecao).
 */
import type { Blueprint } from './blueprint';

export type SecaoKey =
  | 'marca' | 'grupos' | 'campos_ticket' | 'condicionais' | 'gatilhos' | 'macros' | 'guide'
  | 'sla' | 'views' | 'campos_usuario' | 'campos_org' | 'programacao' | 'feriados';

export type Secao = { key: SecaoKey; label: string; default: boolean; presente: boolean; qtd: number };

export function secoesStatus(bp: Blueprint): Secao[] {
  const g = bp.grupos.length;
  const cat: [SecaoKey, string, boolean, boolean, number][] = [
    ['marca', 'Marca + Help Center', true, bp.marca !== null, bp.marca ? 1 : 0],
    ['grupos', 'Grupos', true, g > 0, g],
    ['campos_ticket', 'Campos de ticket + formulario', true, bp.campos_ticket.length > 0, bp.campos_ticket.length],
    ['condicionais', 'Campos condicionais', true, bp.condicionais.length > 0, bp.condicionais.length],
    ['gatilhos', 'Gatilhos padrao', true, bp.gatilhos_padrao.length > 0, bp.gatilhos_padrao.length],
    ['macros', 'Macros', true, bp.macros.length > 0, bp.macros.length],
    ['guide', 'Help Center: secoes + artigos + guia', true,
      Boolean(bp.guide_secoes.length || bp.guide_artigos.length || bp.guia_apresentacao), bp.guide_artigos.length],
    ['sla', 'Group SLA (por grupo)', true, bp.sla !== null, bp.sla ? g : 0],
    ['views', 'Views', false, bp.views.length > 0, bp.views.length],
    ['campos_usuario', 'Campos de usuario', false, bp.campos_usuario.length > 0, bp.campos_usuario.length],
    ['campos_org', 'Campos de organizacao', false, bp.campos_org.length > 0, bp.campos_org.length],
    ['programacao', 'Programacao (horario comercial)', false, bp.programacao !== null, bp.programacao ? 1 : 0],
    ['feriados', 'Feriados', false, bp.feriados.length > 0, bp.feriados.length],
  ];
  return cat.map(([key, label, d, presente, qtd]) => ({ key, label, default: d, presente, qtd }));
}

/** Mantém só o que estiver marcado. Devolve uma CÓPIA (o original fica intacto). */
export function aplicarSelecao(bp: Blueprint, escolhas: Partial<Record<SecaoKey, boolean>>): Blueprint {
  const e: Record<string, boolean> = Object.fromEntries(secoesStatus(bp).map((s) => [s.key, s.default]));
  for (const [k, v] of Object.entries(escolhas || {})) e[k] = Boolean(v);
  const b: Blueprint = JSON.parse(JSON.stringify(bp));
  if (!e.marca) b.marca = null;
  if (!e.grupos) b.grupos = [];
  if (!e.campos_ticket) b.campos_ticket = [];
  if (!e.condicionais) b.condicionais = [];
  if (!e.gatilhos) b.gatilhos_padrao = [];
  if (!e.macros) b.macros = [];
  if (!e.guide) { b.guide_secoes = []; b.guide_artigos = []; b.guia_apresentacao = null; }
  if (!e.sla) b.sla = null;
  if (!e.views) b.views = [];
  if (!e.campos_usuario) b.campos_usuario = [];
  if (!e.campos_org) b.campos_org = [];
  if (!e.programacao) b.programacao = null;
  if (!e.feriados) b.feriados = [];
  return b;
}
