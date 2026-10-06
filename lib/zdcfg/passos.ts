/**
 * Executor dos passos (porte dos módulos de provisioner/modules/*.py). SÓ SERVIDOR.
 *
 * Cada função faz as leituras de que precisa e no máximo UMA escrita no fim,
 * para que repetir o passo (rate limit) não duplique nada. Payloads e mensagens
 * de log são os mesmos do Python.
 */
import { display, optionTag } from './blueprint';
import type { Base, Ctx, Passo } from './plano';
import { ZendeskClient, ZendeskError } from './zendesk';

export class FaltaRef extends Error {}

export type Criado = [string, number | string];
export type Resultado = {
  logs: string[];
  criados: Criado[];
  ctx: Ctx;
  /** Pula os passos restantes deste módulo (equivale ao "return" do Python). */
  fimModulo?: boolean;
  /** Help Center precisa ser ativado na tela antes de seguir. */
  pausa?: { url: string };
  preflightOk?: boolean;
  view?: 'ok' | 'falha' | 'pulada';
  /** theme_poll: job ainda rodando, chame de novo. */
  denovo?: boolean;
  membCriados?: number;
};

const id = (r: any, chave: string) => (r?.[chave] && typeof r[chave] === 'object' ? r[chave] : r)?.id;

function grupo(ctx: Ctx, nome: string): number {
  if (!(nome in ctx.groups)) throw new FaltaRef(`Grupo nao resolvido: '${nome}'`);
  return ctx.groups[nome];
}
function campo(ctx: Ctx, ref: string): number {
  if (!(ref in ctx.fields)) throw new FaltaRef(`Campo (chave_ref) nao resolvido: '${ref}'`);
  return ctx.fields[ref];
}
function relancar(e: unknown) {
  if (!(e instanceof ZendeskError)) throw e;
}

// ---------------------------------------------------------------- views (catálogo)
const COLS = ['subject', 'requester', 'created_at', 'status'];
const CAT_TR: Record<string, Record<string, string>> = {
  'en-us': { 'Tickets com prioridade': 'Priority tickets', 'Tickets por status': 'Tickets by status', 'Tickets por canais': 'Tickets by channel' },
  es: { 'Tickets com prioridade': 'Tickets prioritarios', 'Tickets por status': 'Tickets por estado', 'Tickets por canais': 'Tickets por canal' },
};
const NAME_TR: Record<string, Record<string, string>> = {
  'en-us': {
    'Tickets com sentimento negativo': 'Negative sentiment tickets', 'SLA Vencido': 'SLA breached', 'VIP tickets': 'VIP tickets',
    'Meus tickets abertos': 'My open tickets', 'Abertos no grupo': 'Open in group', Novos: 'New',
    'Aguardando aprovação': 'Awaiting approval', 'Pendentes (Clientes)': 'Pending (Customers)',
    'Em espera (Interno)': 'On hold (Internal)', Resolvidos: 'Solved', 'Abertos em outros grupos': 'Open in other groups',
    'E-mail': 'Email', 'Formulário Web': 'Web form', Whatsapp: 'WhatsApp', 'Chat / Mensageria': 'Chat / Messaging',
    'SMS ou Telefone': 'SMS or Phone', 'Mídias Sociais': 'Social media',
  },
  es: {
    'Tickets com sentimento negativo': 'Tickets con sentimiento negativo', 'SLA Vencido': 'SLA vencido', 'VIP tickets': 'Tickets VIP',
    'Meus tickets abertos': 'Mis tickets abiertos', 'Abertos no grupo': 'Abiertos en el grupo', Novos: 'Nuevos',
    'Aguardando aprovação': 'Esperando aprobación', 'Pendentes (Clientes)': 'Pendientes (Clientes)',
    'Em espera (Interno)': 'En espera (Interno)', Resolvidos: 'Resueltos', 'Abertos em outros grupos': 'Abiertos en otros grupos',
    'E-mail': 'Correo', 'Formulário Web': 'Formulario web', Whatsapp: 'WhatsApp', 'Chat / Mensageria': 'Chat / Mensajería',
    'SMS ou Telefone': 'SMS o Teléfono', 'Mídias Sociais': 'Redes sociales',
  },
};
// \w do Python é Unicode: letras, dígitos e "_" de qualquer alfabeto
// (RegExp montada em tempo de execução: o tsconfig do projeto não aceita a flag "u" literal)
const RE_INICIO = new RegExp('^[^\\p{L}\\p{N}_À-ÿ(]*', 'u');
export const viewBase = (nome: string) => nome.replace(RE_INICIO, '').trim();
export function viewTitulo(loc: string, categoria: string, nome: string, base: string) {
  const prefix = RE_INICIO.exec(nome)?.[0] ?? '';
  return `${CAT_TR[loc]?.[categoria] ?? categoria}::${prefix}${NAME_TR[loc]?.[base] ?? base}`;
}
const GRP = { field: 'group_id', operator: 'is', value: 'current_groups' };
const STYPE = { field: 'support_type', operator: 'is', value: '0' };
const NOTSELF = { field: 'requester_id', operator: 'is_not', value: 'assignee_id' };
const OPEN_LT = { field: 'status', operator: 'less_than', value: 'solved' };
const tagC = (v: string) => ({ field: 'current_tags', operator: 'includes', value: v });
const viaC = (v: string) => ({ field: 'via_id', operator: 'is', value: v });
type Cond = { all: object[]; any: object[] };

export function catalogo(sentId: number | string | null | undefined): Record<string, Cond> {
  const st = (s: string) => ({ field: 'status', operator: 'is', value: s });
  const cat: Record<string, Cond> = {
    'SLA Vencido': { all: [{ field: 'sla_next_breach_at', operator: 'greater_than', value: '0' }, GRP, STYPE], any: [] },
    'VIP tickets': { all: [NOTSELF, GRP, tagC('vip_premier'), STYPE], any: [] },
    'Meus tickets abertos': { all: [{ field: 'assignee_id', operator: 'is', value: 'current_user' }, OPEN_LT, STYPE], any: [] },
    'Abertos no grupo': { all: [st('open'), GRP, STYPE], any: [] },
    Novos: { all: [st('new'), GRP, STYPE], any: [] },
    'Aguardando aprovação': { all: [OPEN_LT, GRP, STYPE, tagC('aguardando_aprovacao')], any: [] },
    'Pendentes (Clientes)': { all: [st('pending'), GRP, STYPE], any: [] },
    'Em espera (Interno)': { all: [st('hold'), GRP, STYPE], any: [] },
    Resolvidos: { all: [{ field: 'status', operator: 'greater_than', value: 'hold' }, GRP], any: [] },
    'Abertos em outros grupos': { all: [OPEN_LT, STYPE], any: [] },
    'E-mail': { all: [NOTSELF, tagC('ocr_email email'), GRP, OPEN_LT, STYPE], any: [] },
    'Formulário Web': { all: [NOTSELF, OPEN_LT, STYPE], any: [viaC('0')] },
    Whatsapp: { all: [NOTSELF, OPEN_LT, STYPE], any: [tagC('whatsapp'), viaC('74')] },
    'Chat / Mensageria': { all: [NOTSELF, OPEN_LT, tagC('chat'), GRP, STYPE], any: [] },
    'SMS ou Telefone': { all: [NOTSELF, tagC('talk ura_callwe'), OPEN_LT, STYPE], any: [] },
    'Mídias Sociais': { all: [NOTSELF, OPEN_LT, STYPE], any: [viaC('38'), viaC('41'), viaC('30'), viaC('86')] },
  };
  if (sentId) {
    const cf = `custom_fields_${sentId}`;
    cat['Tickets com sentimento negativo'] = {
      all: [OPEN_LT, GRP, STYPE],
      any: [{ field: cf, operator: 'is', value: 'sentiment__negative' }, { field: cf, operator: 'is', value: 'sentiment__very_negative' }],
    };
  }
  return cat;
}

/** Critério livre da planilha: "tags:a,b; status:open; abertos; grupo; meus". */
export function condDoCriterio(criterio: string): Cond | null {
  if (!criterio) return null;
  const alls: object[] = [];
  for (const parte of String(criterio).split(';')) {
    const p = parte.trim().toLowerCase();
    if (!p) continue;
    if (p.startsWith('tags:')) {
      const tags = p.slice(5).split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length) alls.push({ field: 'current_tags', operator: 'includes', value: tags.join(' ') });
    } else if (p.startsWith('status:')) alls.push({ field: 'status', operator: 'is', value: p.slice(7).trim() });
    else if (['abertos', 'aberto', 'open'].includes(p)) alls.push(OPEN_LT);
    else if (['grupo', 'meus grupos', 'group'].includes(p)) alls.push(GRP);
    else if (['meus', 'meu', 'mine'].includes(p)) alls.push({ field: 'assignee_id', operator: 'is', value: 'current_user' });
  }
  if (!alls.length) return null;
  alls.push(STYPE);
  return { all: alls, any: [] };
}

// ---------------------------------------------------------------- constantes
const VIA_ID: Record<string, string> = { web: '0', email: '4', messaging: '75', whatsapp: '74', voice: '34', social: '38' };
const STATUS: Record<string, string> = { aberto: 'open', pendente: 'pending', espera: 'hold', resolvido: 'solved' };
const PRIOR: Record<string, string> = { baixa: 'low', normal: 'normal', alta: 'high', urgente: 'urgent' };
const SECAO_APRESENTACAO: Record<string, string> = {
  'pt-br': 'Guia de Apresentacao (interno)', 'en-us': 'Presentation Guide (internal)', es: 'Guía de presentación (interno)',
};
const CATEGORIA_PADRAO: Record<string, string> = { 'pt-br': 'Geral', 'en-us': 'General', es: 'General' };
const TERMO_ROTEAMENTO: Record<string, string> = { 'pt-br': 'Roteamento', 'en-us': 'Routing', es: 'Enrutamiento' };
const DIAS: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

function novoSub(base: string): string {
  const core = (base || 'zddemo').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18) || 'zddemo';
  return `${core}${1000 + Math.floor(Math.random() * 9000)}`;
}

// ---------------------------------------------------------------- execução
export async function executarPasso(
  passo: Passo, base: Base, ctxIn: Ctx, c: ZendeskClient, origem: string,
): Promise<Resultado> {
  const ctx: Ctx = JSON.parse(JSON.stringify(ctxIn));
  const logs: string[] = [];
  const criados: Criado[] = [];
  const log = (m: string) => logs.push(m);
  const rec = (k: string, v: any) => { if (v !== null && v !== undefined) criados.push([k, v]); };
  const out = (extra: Partial<Resultado> = {}): Resultado => ({ logs, criados, ctx: { ...ctx, fakeId: c.fakeId }, ...extra });
  const disp = (s: string) => display(base, s);
  const catRoteamento = () => disp(`${base.cliente} - ${TERMO_ROTEAMENTO[base.idioma] ?? 'Roteamento'}`);

  switch (passo.tipo) {
    case 'log':
      log(passo.msg);
      return out();

    // ------------------------------------------------------------ preflight
    case 'preflight': {
      const colisoes: string[] = [];
      const camposEx: string[] = [];
      const gruposEx: string[] = [];
      if (c.dryRun) {
        const vistos = new Set<string>();
        for (const t of passo.tags) { if (vistos.has(t)) colisoes.push(t); vistos.add(t); }
      } else {
        const data = await c.get('/ticket_fields.json');
        const tf: any[] = data.ticket_fields || [];
        const existentes = new Set<string>();
        for (const f of tf) for (const o of f.custom_field_options || []) existentes.add(o.value || '');
        for (const t of Array.from(new Set(passo.tags))) if (existentes.has(t)) colisoes.push(t);
        const titulos = new Set(tf.map((f) => f.title));
        for (const [nome, d] of passo.campos) if (titulos.has(d)) camposEx.push(nome);
        const gd = await c.get('/groups.json');
        const gnomes = new Set((gd.groups || []).map((g: any) => g.name));
        for (const [nome, d] of passo.grupos) if (gnomes.has(d)) gruposEx.push(nome);
      }
      const linhas: string[] = [];
      if (colisoes.length) linhas.push(`TAGS EM COLISAO (${colisoes.length}): ${colisoes.slice(0, 20).join(', ')}`);
      if (camposEx.length) linhas.push(`Campos ja existentes: ${camposEx.slice(0, 20).join(', ')}`);
      if (gruposEx.length) linhas.push(`Grupos ja existentes: ${gruposEx.slice(0, 20).join(', ')}`);
      log(linhas.join('\n') || 'Sem colisoes detectadas.');
      return out({ preflightOk: c.dryRun ? !colisoes.length : !(colisoes.length || camposEx.length) });
    }

    // ------------------------------------------------------------ marca
    case 'brand': {
      let sub = passo.subdominio;
      let ultimo: unknown = null;
      for (let i = 0; i < 5; i++) {
        try {
          const r = await c.post('/brands.json', { brand: { name: disp(passo.nome), subdomain: sub } });
          ctx.brandId = id(r, 'brand');
          ctx.guideSub = sub;
          rec('brand', ctx.brandId);
          log(`marca: ${disp(passo.nome)} -> ${ctx.brandId} (guide host: ${sub})`);
          return out();
        } catch (e) {
          ultimo = e;
          relancar(e);
          const ze = e as ZendeskError;
          const body = (ze.body || '').toLowerCase();
          const colisao = ze.status === 422 && ['subdomain', 'reservedvalue', 'reservado', 'recipient_addresses',
            'duplicate', 'ja existe', 'já existe'].some((t) => body.includes(t));
          if (!colisao) throw e;
          const novo = novoSub(sub);
          log(`subdominio '${sub}' indisponivel (reservado/duplicado); tentando '${novo}'`);
          sub = novo;
        }
      }
      throw ultimo;
    }

    case 'hc_check': {
      if (!ctx.brandId) return out();
      if (c.dryRun) { log('(dry-run) Help Center nao e ativado de verdade; seguindo.'); return out(); }
      try { await c.put(`/brands/${ctx.brandId}.json`, { brand: { has_help_center: true } }); } catch (e) { relancar(e); }
      let b: any = {};
      try { b = (await c.get(`/brands/${ctx.brandId}.json`)).brand || {}; } catch (e) { relancar(e); }
      if (b.has_help_center || ['enabled', 'restricted'].includes(b.help_center_state)) {
        log('Help Center ativo.');
        return out();
      }
      const url = `https://${c.subdomain}.zendesk.com/knowledge/generation/newHelpCenter/?brand_id=${ctx.brandId}`;
      log(`ATENCAO: ative o Help Center da marca '${c.guideSub}'. Ao ativar, escolha a opcao 'Comece do zero' `
        + '(NAO deixe a IA da Zendesk criar artigos - nos criamos os artigos por API). Depois clique em Continuar.');
      log(`Abrindo a pagina de ativacao: ${url}`);
      return out({ pausa: { url } });
    }

    // ------------------------------------------------------------ grupos e campos
    case 'group': {
      const nome = disp(passo.nome);
      const r = await c.post('/groups.json', { group: { name: nome } });
      const gid = id(r, 'group');
      ctx.groups[passo.nome] = gid;
      rec('group', gid);
      log(`grupo: ${nome} -> ${gid}`);
      return out();
    }

    case 'field': {
      const f = passo.campo;
      const tf: any = {
        title: disp(f.nome),
        title_in_portal: f.nome_portal || f.nome,
        type: f.tipo === 'dropdown' ? 'tagger' : f.tipo,
        visible_in_portal: f.visivel_portal,
        editable_in_portal: f.visivel_portal,
        description: '',
      };
      if (f.tipo === 'dropdown' || f.tipo === 'multiselect') {
        const mapa: Record<string, string> = {};
        tf.custom_field_options = f.opcoes.map((o) => {
          const tag = optionTag(base, f.chave_ref, o);
          mapa[o.label] = tag;
          return { name: o.label, value: tag };
        });
        ctx.fieldOptions[f.chave_ref] = mapa;
      }
      const r = await c.post('/ticket_fields.json', { ticket_field: tf });
      const fid = id(r, 'ticket_field');
      ctx.fields[f.chave_ref] = fid;
      rec('ticket_field', fid);
      log(`campo: ${disp(f.nome)} (${f.tipo}) -> ${fid}`);
      return out();
    }

    // ------------------------------------------------------------ formulário
    case 'form_create': {
      let sys: number[] = [90001, 90002];
      if (!c.dryRun) {
        const achado: Record<string, number> = {};
        for (const f of (await c.get('/ticket_fields.json')).ticket_fields || []) {
          if (f.type === 'tickettype' || f.type === 'priority') achado[f.type] = f.id;
        }
        sys = ['tickettype', 'priority'].filter((k) => k in achado).map((k) => achado[k]);
      }
      const ids = [...sys, ...passo.refs.map((ref) => campo(ctx, ref))];
      const nome = disp(base.cliente);
      const form: any = { name: nome, display_name: nome, active: true, end_user_visible: true, position: 9999, ticket_field_ids: ids };
      if (ctx.brandId) { form.in_all_brands = false; form.restricted_brand_ids = [ctx.brandId]; }
      const r = await c.post('/ticket_forms.json', { ticket_form: form });
      ctx.formId = id(r, 'ticket_form');
      rec('ticket_form', ctx.formId);
      log(`formulario: ${nome} -> ${ctx.formId} (visivel em: ${ctx.brandId ? `marca ${ctx.brandId}` : 'todas as marcas'})`);
      return out();
    }

    case 'form_conditions': {
      const build = (ok: (p: string) => boolean) => passo.condicionais.filter((x) => ok(x.publico)).map((x) => ({
        parent_field_id: ctx.fields[x.campo_pai_ref] ?? null,
        value: ctx.fieldOptions[x.campo_pai_ref]?.[x.quando_valor] ?? x.quando_valor,
        child_fields: x.mostrar_refs.map((ref) => ({ id: ctx.fields[ref] ?? null, is_required: x.obrigatorios_refs.includes(ref) })),
      }));
      const eu = build((p) => p === 'usuario' || p === 'ambos');
      const ag = build((p) => p === 'agente' || p === 'ambos');
      if (eu.length || ag.length) {
        await c.put(`/ticket_forms/${ctx.formId}.json`, { ticket_form: { id: ctx.formId, end_user_conditions: eu, agent_conditions: ag } });
        log(`condicionais: ${eu.length} usuario / ${ag.length} agente`);
      }
      return out();
    }

    // ------------------------------------------------------------ gatilhos
    case 'trig_setup': {
      grupo(ctx, base.grupos[0]);
      let subj = 'via_id';
      if (!c.dryRun) {
        subj = 'current_via_id';
        try {
          const defs = (await c.get('/triggers/definitions.json')).definitions || {};
          const s = new Set([...(defs.conditions_all || []), ...(defs.conditions_any || [])].map((x: any) => x.subject));
          if (s.has('via_id')) subj = 'via_id';
          else if (s.has('current_via_id')) subj = 'current_via_id';
        } catch {
          /* igual ao Python: qualquer falha cai em current_via_id */
        }
      }
      ctx.chanSubject = subj;
      const catNome = catRoteamento();
      const r = await c.post('/trigger_categories', { trigger_category: { name: catNome } });
      const cid = id(r, 'trigger_category');
      ctx.categoryIds[catNome] = cid;
      rec('trigger_category', cid);
      log(`categoria de gatilho: ${catNome} -> ${cid}`);
      return out();
    }

    case 'trigger': {
      const t = passo.gatilho;
      const grupo0 = base.grupos[0];
      const gid = grupo(ctx, grupo0);
      const cid = ctx.categoryIds[catRoteamento()];
      const via = VIA_ID[t.canal];
      let nomeT = t.nome;
      for (const tok of ['1o grupo', '1º grupo', '1o Grupo', 'primeiro grupo', '1st group', '1er grupo']) nomeT = nomeT.split(tok).join(grupo0);
      if (t.copilot) nomeT += ' + Copilot';
      const all: object[] = [
        { field: 'update_type', operator: 'is', value: 'Create' },
        { field: 'group_id', operator: 'is', value: '' },
      ];
      if (via !== undefined) all.push({ field: ctx.chanSubject || 'via_id', operator: 'is', value: via });
      const any: object[] = [];
      if (ctx.brandId) any.push({ field: 'brand_id', operator: 'is', value: String(ctx.brandId) });
      if (ctx.formId) any.push({ field: 'ticket_form_id', operator: 'is', value: String(ctx.formId) });
      const actions: object[] = [
        { field: 'group_id', value: String(gid) },
        { field: 'priority', value: 'normal' },
        { field: 'type', value: 'question' },
      ];
      if (t.copilot) actions.push({ field: 'current_tags', value: 'agent_copilot_enabled' });
      const r = await c.post('/triggers.json', {
        trigger: { title: disp(nomeT), category_id: cid, active: true, actions, conditions: { all, any } },
      });
      rec('trigger', id(r, 'trigger'));
      log(`gatilho: ${disp(nomeT)} [canal ${t.canal}=${via}]`);
      return out();
    }

    // ------------------------------------------------------------ views
    case 'views_setup': {
      let sent: number | string | null = 'SENT';
      if (!c.dryRun) {
        sent = null;
        for (const f of (await c.get('/ticket_fields.json')).ticket_fields || []) {
          const t = String(f.title || '').toLowerCase();
          if (t.includes('sentiment') || t.includes('sentimento')) { sent = f.id; break; }
        }
      }
      ctx.sentId = sent;
      return out();
    }

    case 'view': {
      const v = passo.view;
      const b = viewBase(v.nome);
      if (b === 'Tickets com sentimento negativo' && !ctx.sentId) {
        log(`view PULADA: ${v.nome} (campo de sentimento/IA nao encontrado neste ambiente)`);
        return out({ view: 'pulada' });
      }
      const cond = catalogo(ctx.sentId)[b] || condDoCriterio(v.criterio) || { all: [OPEN_LT, STYPE], any: [] };
      const titulo = viewTitulo(base.idioma, v.categoria, v.nome, b);
      try {
        const r = await c.post('/views.json', {
          view: { title: titulo, active: true, conditions: { all: cond.all, any: cond.any }, execution: { columns: COLS } },
        });
        rec('view', id(r, 'view'));
        log(`view: ${titulo}`);
        return out({ view: 'ok' });
      } catch (e) {
        relancar(e);
        const ze = e as ZendeskError;
        log(`view FALHOU: ${titulo} -> HTTP ${ze.status}: ${ze.body.slice(0, 150)}`);
        return out({ view: 'falha' });
      }
    }

    // ------------------------------------------------------------ macros
    case 'macro': {
      const m = passo.macro;
      if (!m.status_ticket || !m.grupo_destino) {
        log(`AVISO: macro '${m.nome}' sem status e/ou grupo destino (regra: macros devem alterar status e grupo de atribuicao)`);
      }
      const actions: object[] = [
        { field: 'comment_value_html', value: `<p>${m.mensagem}</p>` },
        { field: 'comment_mode_is_public', value: m.publico ? 'true' : 'false' },
      ];
      if (m.status_ticket) actions.push({ field: 'status', value: STATUS[m.status_ticket.toLowerCase()] ?? m.status_ticket });
      if (m.prioridade) actions.push({ field: 'priority', value: PRIOR[m.prioridade.toLowerCase()] ?? m.prioridade });
      if (m.grupo_destino) actions.push({ field: 'group', value: String(grupo(ctx, m.grupo_destino)) });
      const body: any = { macro: { title: disp(m.nome), active: true, actions } };
      const vids = m.grupo_visualizador ? [grupo(ctx, m.grupo_visualizador)] : Object.values(ctx.groups);
      if (vids.length) body.macro.restriction = { type: 'Group', id: vids[0], ids: vids };
      const r = await c.post('/macros.json', body);
      rec('macro', id(r, 'macro'));
      log(`macro: ${disp(m.nome)}`);
      return out();
    }

    // ------------------------------------------------------------ guide
    case 'guide_setup': {
      const idi = base.idioma;
      let loc: string = idi;
      let segs: Record<string, number> = { logado: 90, staff: 91 };
      let perm: number | null = 80;
      if (!c.dryRun) {
        try {
          const d = await c.get('/help_center/locales.json');
          const locais: string[] = (d.locales || []).map((x: any) => String(x).toLowerCase());
          const padrao = d.default_locale || idi;
          const w = idi.toLowerCase();
          if (locais.length) {
            if (locais.includes(w)) loc = w;
            else {
              const b = w.split('-')[0];
              const cand = locais.find((x) => x === b || x.startsWith(`${b}-`));
              if (cand) { log(`locale: '${idi}' nao habilitado; usando '${cand}' do Help Center`); loc = cand; }
              else { log(`locale: '${idi}' indisponivel; usando default do Help Center '${padrao}'`); loc = padrao; }
            }
          }
        } catch (e) { relancar(e); }
        segs = {};
        try {
          for (const s of (await c.get('/help_center/user_segments.json')).user_segments || []) {
            const ut = String(s.user_type || '').toLowerCase();
            if (ut === 'signed_in_users' || ut === 'signed-in users') segs.logado = s.id;
            else if (ut === 'staff') segs.staff = s.id;
          }
        } catch (e) { relancar(e); }
        perm = null;
        try {
          for (const pg of (await c.get('/guide/permission_groups.json')).permission_groups || []) {
            if (String(pg.name || '').toLowerCase().includes('manage') || pg.built_in) { perm = pg.id; break; }
          }
        } catch (e) { relancar(e); }
      }
      const nomeCat = CATEGORIA_PADRAO[idi] ?? 'Geral';
      let cat: number | null = null;
      try {
        const r = await c.post(`/help_center/${loc}/categories.json`, { category: { name: nomeCat, locale: loc } });
        cat = id(r, 'category');
        rec('category', cat);
        log(`categoria: ${nomeCat} -> ${cat}`);
      } catch (e) {
        relancar(e);
        try {
          const cats = (await c.get(`/help_center/${loc}/categories.json`)).categories || [];
          if (cats.length) { cat = cats[0].id; log(`categoria existente reutilizada -> ${cat}`); }
        } catch (e2) { relancar(e2); }
        if (cat === null) log(`nao foi possivel criar categoria (HTTP ${(e as ZendeskError).status})`);
      }
      ctx.guide = { loc, cat, segs, perm };
      if (cat === null) { log('sem categoria - pulando Guide'); return out({ fimModulo: true }); }
      return out();
    }

    case 'section': {
      const g = ctx.guide!;
      const r = await c.post(`/help_center/${g.loc}/categories/${g.cat}/sections.json`,
        { section: { name: passo.titulo, locale: g.loc, position: 1 } });
      const sid = id(r, 'section');
      ctx.sections[passo.titulo] = sid;
      rec('section', sid);
      log(`secao: ${passo.titulo} -> ${sid}`);
      return out();
    }

    case 'article':
    case 'guia_article': {
      const g = ctx.guide!;
      const a = passo.artigo;
      const guia = passo.tipo === 'guia_article';
      const secao = guia ? SECAO_APRESENTACAO[base.idioma] ?? SECAO_APRESENTACAO['pt-br'] : a.secao_titulo;
      const sid = ctx.sections[secao];
      if (sid === undefined) { log(`artigo '${a.titulo}': secao '${a.secao_titulo}' nao encontrada - pulando`); return out(); }
      const seg = guia ? g.segs.staff : a.acesso === 'logado' ? g.segs.logado : a.acesso === 'agente' ? g.segs.staff : undefined;
      const titulo = guia ? disp(a.titulo) : a.titulo;
      const art: any = { title: titulo, body: a.corpo, locale: g.loc, draft: false };
      if (seg !== undefined && seg !== null) art.user_segment_id = seg;
      if (g.perm !== null && g.perm !== undefined) art.permission_group_id = g.perm;
      const r = await c.post(`/help_center/${g.loc}/sections/${sid}/articles.json`, { article: art });
      rec('article', id(r, 'article'));
      log(`artigo: ${titulo}`);
      if (guia) log('guia de apresentacao: artigo interno (Agentes e admins) criado');
      return out();
    }

    case 'guia_section': {
      const g = ctx.guide!;
      const nome = SECAO_APRESENTACAO[base.idioma] ?? SECAO_APRESENTACAO['pt-br'];
      const r = await c.post(`/help_center/${g.loc}/categories/${g.cat}/sections.json`,
        { section: { name: nome, locale: g.loc, position: 9999 } });
      const sid = id(r, 'section');
      ctx.sections[nome] = sid;
      rec('section', sid);
      return out();
    }

    // ------------------------------------------------------------ tema
    case 'theme_start': {
      if (!ctx.brandId) { log('tema: sem marca criada - pulando'); return out({ fimModulo: true }); }
      if (c.dryRun) { log(`tema: (dry-run) importaria '${passo.arquivo}' na marca ${ctx.brandId}`); return out({ fimModulo: true }); }
      const zipResp = await fetch(new URL(`/zdcfg/temas/${encodeURIComponent(passo.arquivo)}`, origem), { signal: AbortSignal.timeout(15_000) });
      if (!zipResp.ok) { log(`tema: arquivo nao encontrado '${passo.arquivo}' - pulando`); return out({ fimModulo: true }); }
      const zip = await zipResp.arrayBuffer();
      const r = await c.post('/guide/theming/jobs/themes/imports', { job: { attributes: { brand_id: String(ctx.brandId), format: 'zip' } } });
      const job = r.job || r;
      const data = job.data || {};
      const upload = data.upload || {};
      if (!upload.url) { log(`tema: resposta inesperada ao criar job -> ${JSON.stringify(r).slice(0, 300)}`); return out({ fimModulo: true }); }
      ctx.theme = { jobId: job.id ?? null, themeId: data.theme_id ?? null };
      log(`tema: job de import criado (${job.id}); theme_id=${data.theme_id}; enviando .zip...`);
      const fd = new FormData();
      for (const [k, v] of Object.entries(upload.parameters || {})) fd.append(k, String(v));
      fd.append('file', new Blob([zip], { type: 'application/zip' }), passo.arquivo);
      const up = await fetch(upload.url, { method: 'POST', body: fd, signal: AbortSignal.timeout(25_000) });
      log(`tema: upload HTTP ${up.status}`);
      if (up.status >= 400) { log(`tema: falha no upload -> ${(await up.text()).slice(0, 300)}`); return out({ fimModulo: true }); }
      return out();
    }

    case 'theme_poll': {
      const t = ctx.theme!;
      const j = (await c.get(`/guide/theming/jobs/${t.jobId}`)).job || {};
      const tid = j.data?.theme_id;
      if (tid) t.themeId = tid;
      if (j.status === 'completed' || j.status === 'failed') {
        log(`tema: job ${j.status}`);
        if (j.status === 'failed') { log(`tema: erros -> ${JSON.stringify(j.errors)}`); return out({ fimModulo: true }); }
        return out();
      }
      return out({ denovo: true });
    }

    case 'theme_publish': {
      const t = ctx.theme!;
      if (!t.themeId) { log('tema: nao obtive theme_id (verifique o job na tela)'); return out(); }
      rec('theme', t.themeId);
      try {
        const pub = await c.post(`/guide/theming/themes/${t.themeId}/publish`, {});
        const live = pub.theme?.live;
        log(`tema: importado e PUBLICADO (live=${live === undefined ? 'None' : live ? 'True' : 'False'}) -> ${t.themeId}`);
      } catch (e) {
        relancar(e);
        log(`tema: importado -> ${t.themeId} (falha ao publicar; defina como ativo na tela; HTTP ${(e as ZendeskError).status})`);
      }
      return out();
    }

    // ------------------------------------------------------------ SLA
    case 'sla': {
      const gid = grupo(ctx, passo.grupo);
      const metrics = Object.entries(passo.alvos).map(([p, t]) => ({ priority: p, metric: 'group_ownership_time', target: t, business_hours: false }));
      const r = await c.post('/group_slas/policies.json', {
        group_sla_policy: {
          title: disp(`SLA ${passo.grupo}`),
          description: `Group SLA da demo para ${passo.grupo}`,
          position: passo.pos,
          filter: { all: [{ field: 'group_id', operator: 'includes', value: [gid] }], any: [] },
          policy_metrics: metrics,
        },
      });
      rec('group_sla_policy', id(r, 'group_sla_policy'));
      log(`GROUP SLA: ${disp(`SLA ${passo.grupo}`)} (posse do grupo ${passo.grupo})`);
      return out();
    }

    // ------------------------------------------------------------ programação
    case 'schedule_create': {
      const r = await c.post('/business_hours/schedules.json', { schedule: { name: disp(passo.nome), time_zone: 'Brasilia' } });
      ctx.scheduleId = id(r, 'schedule');
      rec('schedule', ctx.scheduleId);
      log(`programacao: ${passo.nome} -> ${ctx.scheduleId}`);
      return out();
    }

    case 'schedule_workweek': {
      const sc = passo.programacao;
      const di = DIAS[sc.dia_inicio] ?? 1;
      const df = DIAS[sc.dia_fim] ?? 5;
      const hi = Math.max(0, Math.trunc(sc.hora_inicio));
      const hf = Math.trunc(sc.hora_fim);
      const full = hf <= hi || hf >= 24;
      const intervals: object[] = [];
      for (let d = di; d <= df; d++) {
        const b = d * 1440;
        const start = b + (full ? 0 : hi * 60);
        const end = b + (full ? 1439 : hf * 60);
        if (end > start) intervals.push({ start_time: start, end_time: end });
      }
      if (intervals.length) {
        try {
          await c.put(`/business_hours/schedules/${ctx.scheduleId}/workweek.json`, { workweek: { intervals } });
          log(`programacao: workweek aplicado (${full ? '24h' : `${hi}h-${hf}h`})`);
        } catch (e) {
          relancar(e);
          log(`programacao: workweek nao aplicado (HTTP ${(e as ZendeskError).status}); horario padrao mantido`);
        }
      }
      return out();
    }

    case 'holiday': {
      const h = passo.feriado;
      const p2 = (n: number) => String(n).padStart(2, '0');
      const start = `${h.ano}-${p2(h.mes)}-${p2(h.dia_inicio)}`;
      const end = `${h.ano}-${p2(h.mes)}-${p2(h.dia_fim)}`;
      try {
        await c.post(`/business_hours/schedules/${ctx.scheduleId}/holidays.json`, { holiday: { name: h.nome, start_date: start, end_date: end } });
        log(`feriado: ${h.nome} (${start}..${end})`);
      } catch (e) {
        relancar(e);
        log(`feriado '${h.nome}' nao criado (HTTP ${(e as ZendeskError).status})`);
      }
      return out();
    }

    // ------------------------------------------------------------ memberships
    case 'memb_staff': {
      const gids = Object.values(ctx.groups);
      if (!gids.length) return out({ fimModulo: true });
      let staff: number[] = [1, 2, 3];
      if (!c.dryRun) {
        const users: any[] = [];
        let url: string | null = '/users.json?role[]=agent&role[]=admin&per_page=100';
        while (url) {
          const j: any = await c.get(url);
          users.push(...(j.users || []));
          url = j.next_page || null;
        }
        staff = users.filter((u) => !u.suspended).map((u) => u.id);
      }
      if (!staff.length) { log('membership: nenhum agente/admin encontrado'); return out({ fimModulo: true }); }
      ctx.staff = staff;
      log(`membership: ${staff.length} agentes/admins x ${gids.length} grupos = ${staff.length * gids.length} vinculos`);
      return out();
    }

    case 'memb_batch': {
      const gids = Object.values(ctx.groups);
      const vinc = (ctx.staff || []).flatMap((u) => gids.map((g) => ({ user_id: u, group_id: g, default: false })));
      const lote = vinc.slice(passo.lote * 100, passo.lote * 100 + 100);
      try {
        await c.post('/group_memberships/create_many.json', { group_memberships: lote });
        return out({ membCriados: lote.length });
      } catch (e) {
        relancar(e);
        const ze = e as ZendeskError;
        log(`membership: lote falhou HTTP ${ze.status}: ${ze.body.slice(0, 120)}`);
        return out({ membCriados: 0 });
      }
    }
  }
  throw new Error(`passo desconhecido: ${(passo as any).tipo}`);
}

// ---------------------------------------------------------------- rollback
const DELETE: Record<string, string | null> = {
  user: null,
  schedule: '/business_hours/schedules/{id}.json',
  sla_policy: '/slas/policies/{id}.json',
  group_sla_policy: '/group_slas/policies/{id}.json',
  theme: '/guide/theming/themes/{id}',
  article: null,
  section: null,
  view: '/views/{id}.json',
  macro: '/macros/{id}.json',
  trigger: '/triggers/{id}.json',
  trigger_category: '/trigger_categories/{id}',
  ticket_form: '/ticket_forms/{id}.json',
  ticket_field: '/ticket_fields/{id}.json',
  group: '/groups/{id}.json',
  brand: '/brands/{id}.json',
};

/** Remove UM recurso; true = removido (ou nada a remover). Porte de _del_one. */
export async function removerUm(c: ZendeskClient, kind: string, rid: number | string, log: (m: string) => void): Promise<boolean> {
  try {
    if (kind === 'brand') {
      try { await c.put(`/brands/${rid}.json`, { brand: { active: false } }); } catch (e) { relancar(e); }
      await c.delete(`/brands/${rid}.json`);
      log(`- removido brand ${rid}`);
      return true;
    }
    const p = DELETE[kind];
    if (!p) { log(`(mantido) ${kind} ${rid}`); return true; }
    await c.delete(p.replace('{id}', String(rid)));
    log(`- removido ${kind} ${rid}`);
    return true;
  } catch (e) {
    relancar(e);
    log(`! falha ao remover ${kind} ${rid}: ${(e as ZendeskError).status}`);
    return false;
  }
}
