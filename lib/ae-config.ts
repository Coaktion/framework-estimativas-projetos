/**
 * Configuração da Calculadora AE editável pelo painel Admin.
 *
 * Tudo o que antes era fixo no código do engine mora aqui:
 *   - `numbers`  : horas unitárias, configurações gerais, treinamentos, itens
 *                  fixos, apps, workshops, percentuais, fatores e os limites da
 *                  revisão por Sales Engineer;
 *   - `bindings` : o vínculo de cada hora com um item da biblioteca (Admin ›
 *                  Biblioteca), que é a fonte da verdade — ver `resolveAEConfig`;
 *   - `formulas` : as fórmulas de quantidade (ex.: condicionais de campo =
 *                  campos_ticket × 0,5) e as fórmulas de base dos percentuais;
 *   - `settings` : textos (ex.: categoria da biblioteca com as integrações nativas).
 *
 * `DEFAULT_AE_CONFIG` reproduz exatamente o cálculo que existia no código, de
 * modo que estimativas antigas (salvas sem configuração) continuam batendo.
 */

import { CHANNEL_KEYS } from './ae-engine-keys';
import { FormulaError, formulaVariables, parseFormula } from './formula';

/* ------------------------------------------------------------------ NÚMEROS -- */

export const DEFAULT_AE_NUMBERS = {
  horas_unitarias: {
    funcoes: 0.25,
    grupos: 0.05,
    campos_ticket: 0.08,
    formularios: 0.08,
    condicionais_campos: 0.02,
    campos_usuario: 0.05,
    campos_organizacao: 0.05,
    visualizacoes: 0.08,
    macros: 0.08,
    gatilhos_simples: 0.08,
    gatilhos_complexos: 0.33,
    automacoes_simples: 0.08,
    automacoes_complexas: 0.33,
    politicas_sla: 0.17,
    ivr: 0.59,
    saudacoes: 0.05,
    intencoes: 0.25,
    entidades: 0.33,
    procedimentos: 0.67,
    wfm_localizacoes: 0.25,
    wfm_turnos: 0.25,
    wfm_grupos_trabalho: 0.08,
    wfm_equipes: 0.08,
    wfm_motivos_folga: 0.08,
    wfm_tarefas_gerais: 0.08,
    wfm_automacoes: 0.25,
    wfm_funcoes: 0.17,
    qa_destaques: 0.75,
    qa_quizzes: 0.5,
    qa_filtros: 0.5,
    qa_tabelas_desempenho: 0.5,
    qa_categorias_manuais: 0.17,
    qa_categorias_ia: 0.5,
    qa_usuarios: 0.05,
    qa_bots: 0.17,
    qa_espaco_trabalho: 0.25,
    qa_atribuicoes: 0.5,
    qa_grupos: 0.08,
    qa_hashtags: 0.05,
    membro_equipe: 0.05,
    marca: 0.25,
    canal_email: 0.17,
    canal_web_widget: 0.42,
    canal_exige_reuniao: 0.17,
    canal_exige_reuniao_minimo: 0.5,
    artigo: 0.1,
    knowledge_minimo: 2.0,
    integracao_nativa: 2.0,
    action_flow: 4.5,
    conversa_paralela: 0.5,
    sso: 2.0,
  },
  configuracoes_gerais: {
    support: 1.0,
    community: 1.0,
    analytics: 3.5,
    voice: 0.5,
    copilot: 0.5,
    qa: 1.0,
    wfm: 0.33,
    adpp: 1.5,
  },
  treinamentos: {
    suite: 3.0,
    community: 1.5,
    voice: 2.5,
    copilot: 2.5,
    qa: 2.0,
    wfm: 3.0,
    adpp: 1.0,
  },
  /** Horas de cada item fixo. As quantidades são fórmulas (FIXED_QTY_FORMULAS). */
  itens_fixos: {
    support: {
      encaminhamento_omnichannel: 1.0,
      gatilho_webhook_instancia: 0.5,
      webhooks: 0.33,
    },
    support_nao_team: {
      pesquisa_satisfacao: 0.25,
      programacao_feriados: 0.25,
    },
    wfm: {
      cenarios_previsao: 0.75,
      paineis_desempenho: 0.75,
      urls_monitoradas: 0.05,
    },
    adpp: {
      programacoes_exclusao: 0.25,
      gatilhos_supressao: 0.08,
    },
  },
  apps: {
    condicionais_avancadas_base: 0.33,
    ticket_manager_base: 0.67,
    woocommerce: 1.5,
    dialpad: 1.5,
    aircall: 2.0,
    vtex: 1.0,
    stripe: 1.0,
    pipedrive: 1.0,
    sweethawk: 2.0,
    other_marketplace: 5.0,
  },
  workshops: {
    suite: 1.0,
    voice: 0.5,
    copilot: 0.5,
    qa: 0.5,
    wfm: 0.5,
  },
  percentuais: {
    gerente_projetos: 0.176470588235294,
    comunicacao_tecnica: 0.1,
    discovery: 0.2,
    validacao: 0.15,
    go_live: 0.05,
    limite_gerente_projetos: 30,
  },
  fatores_plano: {
    funcoes: { team: 0, growth: 0, professional: 0, enterprise: 1 },
    campos_ticket: { team: 1, growth: 1.04, professional: 1.08, enterprise: 1.12 },
    sla: { team: 0, growth: 1, professional: 1, enterprise: 1.5 },
  },
  fatores_operacao: {
    campos_usuario: { B2C: 0, B2B: 0, B2E: 3 },
    campos_organizacao: { B2C: 0, B2B: 3, B2E: 3 },
  },
  /** Qualquer um destes limites ultrapassado exige revisão por Sales Engineer. */
  sales_engineer: {
    total_horas: 60,
    artigos_knowledge: 100,
    agentes: 100,
    marcas: 3,
    quantidade_canais: 10,
  },
};

export type AENumbers = typeof DEFAULT_AE_NUMBERS;

/* ----------------------------------------------------------------- FÓRMULAS -- */

export interface FormulaSpec {
  key: string;
  /** Rótulo pt / en. */
  label: { pt: string; en: string; es: string };
  default: string;
}

/**
 * Fórmulas de QUANTIDADE. Uma fórmula pode usar qualquer outra quantidade: a
 * ordem de cálculo sai das dependências (ver `quantityEvaluationOrder`), e só
 * não pode haver ciclo (A usa B e B usa A).
 */
export const QUANTITY_FORMULAS: FormulaSpec[] = [
  { key: 'funcoes', label: { pt: 'Funções', en: 'Roles', es: 'Roles' }, default: 'min(((0,1 * agentes + areas) * (0,25 + 0,75 * marcas)) * fator_plano_funcoes; agentes)' },
  { key: 'grupos', label: { pt: 'Grupos', en: 'Groups', es: 'Grupos' }, default: '(0,1 * agentes + 0,3 * areas) * (0,25 + 0,75 * marcas) * (0,4 + qtd_operacoes * 0,6)' },
  { key: 'campos_ticket', label: { pt: 'Campos de ticket', en: 'Ticket fields', es: 'Campos de ticket' }, default: '(tem_canal_web_form * 10 + tem_canal_email * 8 + tem_canal_whatsapp * 8 + tem_canal_voice * 5 + outros_tipos_canais * 6) * (0,7 + 0,3 * marcas) * fator_plano_campos_ticket' },
  { key: 'formularios', label: { pt: 'Formulários', en: 'Forms', es: 'Formularios' }, default: 'se(plano_team; 1; max(areas * 0,5 * marcas; qtd_operacoes; canal_web_form))' },
  { key: 'condicionais_campos', label: { pt: 'Condicionais de campo', en: 'Field conditions', es: 'Condiciones de campo' }, default: 'se(plano_team; 0; campos_ticket * 0,5)' },
  { key: 'campos_usuario', label: { pt: 'Campos de usuário', en: 'User fields', es: 'Campos de usuario' }, default: '(2 * grupos + 2 * areas) * (1 + soma_fator_operacao_usuario)' },
  { key: 'campos_organizacao', label: { pt: 'Campos de organização', en: 'Organization fields', es: 'Campos de organización' }, default: '2 * areas * (1 + soma_fator_operacao_organizacao)' },
  { key: 'visualizacoes', label: { pt: 'Visualizações', en: 'Views', es: 'Vistas' }, default: '12 + formularios + 0,1 * campos_ticket * areas + tem_copilot * 5' },
  { key: 'macros', label: { pt: 'Macros', en: 'Macros', es: 'Macros' }, default: 'campos_ticket * 0,5' },
  { key: 'gatilhos_simples', label: { pt: 'Gatilhos simples', en: 'Simple triggers', es: 'Desencadenadores simples' }, default: '3 + campos_ticket * 0,05 * formularios + tipos_canais * (3 + tem_copilot * 2)' },
  { key: 'gatilhos_complexos', label: { pt: 'Gatilhos complexos', en: 'Complex triggers', es: 'Desencadenadores complejos' }, default: 'gatilhos_simples * 0,25' },
  { key: 'automacoes_simples', label: { pt: 'Automações simples', en: 'Simple automations', es: 'Automatizaciones simples' }, default: '3 + (gatilhos_simples + gatilhos_complexos) * 0,1' },
  { key: 'automacoes_complexas', label: { pt: 'Automações complexas', en: 'Complex automations', es: 'Automatizaciones complejas' }, default: 'automacoes_simples * 0,25' },
  { key: 'politicas_sla', label: { pt: 'Políticas de SLA', en: 'SLA policies', es: 'Directivas de SLA' }, default: '(total_qtd_canais * (0,7 + 0,3 * marcas) + grupos + formularios) * fator_plano_sla' },
  { key: 'ivr', label: { pt: 'IVR', en: 'IVR', es: 'IVR' }, default: 'se(plano_team + plano_growth; 0; 6 * canal_voice)' },
  { key: 'saudacoes', label: { pt: 'Saudações', en: 'Greetings', es: 'Saludos' }, default: '4,5 * ivr' },
  { key: 'intencoes', label: { pt: 'Intenções (Copilot)', en: 'Intents (Copilot)', es: 'Intenciones (Copilot)' }, default: '4 + campos_ticket * 0,2 * (1 + tem_qa * 0,2) * qtd_operacoes' },
  { key: 'entidades', label: { pt: 'Entidades (Copilot)', en: 'Entities (Copilot)', es: 'Entidades (Copilot)' }, default: 'campos_ticket * 0,1' },
  { key: 'procedimentos', label: { pt: 'Procedimentos (Copilot)', en: 'Procedures (Copilot)', es: 'Procedimientos (Copilot)' }, default: '(areas + grupos) * 0,5 * marcas * qtd_operacoes' },
  { key: 'wfm_localizacoes', label: { pt: 'WFM: localizações', en: 'WFM: locations', es: 'WFM: ubicaciones' }, default: 'areas * qtd_operacoes' },
  { key: 'wfm_turnos', label: { pt: 'WFM: turnos', en: 'WFM: shifts', es: 'WFM: turnos' }, default: 'wfm_localizacoes * 2' },
  { key: 'wfm_grupos_trabalho', label: { pt: 'WFM: grupos de trabalho', en: 'WFM: work groups', es: 'WFM: grupos de trabajo' }, default: 'grupos + marcas * qtd_operacoes + tipos_canais' },
  { key: 'wfm_equipes', label: { pt: 'WFM: equipes', en: 'WFM: teams', es: 'WFM: equipos' }, default: 'grupos' },
  { key: 'wfm_motivos_folga', label: { pt: 'WFM: motivos de folga', en: 'WFM: time-off reasons', es: 'WFM: motivos de tiempo libre' }, default: '5 + agentes * 0,1' },
  { key: 'wfm_tarefas_gerais', label: { pt: 'WFM: tarefas gerais', en: 'WFM: general tasks', es: 'WFM: tareas generales' }, default: '(2 + grupos + areas + marcas) * qtd_operacoes * 0,5' },
  { key: 'wfm_automacoes', label: { pt: 'WFM: automações', en: 'WFM: automations', es: 'WFM: automatizaciones' }, default: '2 + wfm_equipes * 0,5 * wfm_turnos' },
  { key: 'wfm_funcoes', label: { pt: 'WFM: funções', en: 'WFM: roles', es: 'WFM: roles' }, default: '2 + funcoes' },
  { key: 'qa_destaques', label: { pt: 'QA: destaques', en: 'QA: spotlights', es: 'QA: destacados' }, default: 'min(10; max(0; marcas + qtd_operacoes + areas))' },
  { key: 'qa_quizzes', label: { pt: 'QA: quizzes', en: 'QA: quizzes', es: 'QA: cuestionarios' }, default: 'areas + marcas + qtd_operacoes' },
  { key: 'qa_filtros', label: { pt: 'QA: filtros', en: 'QA: filters', es: 'QA: filtros' }, default: '(1 + 0,05 * grupos) * qa_destaques' },
  { key: 'qa_tabelas_desempenho', label: { pt: 'QA: tabelas de desempenho', en: 'QA: scorecards', es: 'QA: tarjetas de puntuación' }, default: 'areas * qtd_operacoes * marcas' },
  { key: 'qa_categorias_manuais', label: { pt: 'QA: categorias manuais', en: 'QA: manual categories', es: 'QA: categorías manuales' }, default: 'qa_tabelas_desempenho * 3' },
  { key: 'qa_categorias_ia', label: { pt: 'QA: categorias de IA', en: 'QA: AI categories', es: 'QA: categorías de IA' }, default: 'max(0; 10 - qa_destaques)' },
  { key: 'qa_usuarios', label: { pt: 'QA: usuários', en: 'QA: users', es: 'QA: usuarios' }, default: 'agentes * 0,9' },
  { key: 'qa_bots', label: { pt: 'QA: bots', en: 'QA: bots', es: 'QA: bots' }, default: 'marcas' },
  { key: 'qa_espaco_trabalho', label: { pt: 'QA: espaço de trabalho', en: 'QA: workspace', es: 'QA: espacio de trabajo' }, default: 'marcas' },
  { key: 'qa_atribuicoes', label: { pt: 'QA: atribuições', en: 'QA: assignments', es: 'QA: asignaciones' }, default: '0,5 * grupos' },
  { key: 'qa_grupos', label: { pt: 'QA: grupos', en: 'QA: groups', es: 'QA: grupos' }, default: 'grupos' },
  { key: 'qa_hashtags', label: { pt: 'QA: hashtags', en: 'QA: hashtags', es: 'QA: hashtags' }, default: 'campos_ticket * 0,05' },
];

/**
 * Quantidade de cada ITEM FIXO. Por enquanto são números (1, 2, 5, 10), mas
 * aceitam fórmula como as demais quantidades. As horas vêm de Números › Itens
 * fixos (ou do item da biblioteca vinculado).
 */
export const FIXED_QTY_FORMULAS: FormulaSpec[] = [
  { key: 'qtd_encaminhamento_omnichannel', label: { pt: 'Itens fixos: Encaminhamento omnichannel', en: 'Fixed items: Omnichannel routing', es: 'Ítems fijos: Enrutamiento omnicanal' }, default: '1' },
  { key: 'qtd_gatilho_webhook_instancia', label: { pt: 'Itens fixos: Gatilho de webhook da instância', en: 'Fixed items: Instance webhook trigger', es: 'Ítems fijos: Desencadenador de webhook de la instancia' }, default: '1' },
  { key: 'qtd_webhooks', label: { pt: 'Itens fixos: Webhooks', en: 'Fixed items: Webhooks', es: 'Ítems fijos: Webhooks' }, default: '1' },
  { key: 'qtd_pesquisa_satisfacao', label: { pt: 'Itens fixos: Pesquisa de satisfação (CSAT)', en: 'Fixed items: Satisfaction survey (CSAT)', es: 'Ítems fijos: Encuesta de satisfacción (CSAT)' }, default: '1' },
  { key: 'qtd_programacao_feriados', label: { pt: 'Itens fixos: Programação de feriados', en: 'Fixed items: Holiday schedule', es: 'Ítems fijos: Programación de feriados' }, default: '1' },
  { key: 'qtd_cenarios_previsao', label: { pt: 'Itens fixos: Cenários de previsão (WFM)', en: 'Fixed items: Forecast scenarios (WFM)', es: 'Ítems fijos: Escenarios de previsión (WFM)' }, default: '2' },
  { key: 'qtd_paineis_desempenho', label: { pt: 'Itens fixos: Painéis de desempenho (WFM)', en: 'Fixed items: Performance dashboards (WFM)', es: 'Ítems fijos: Paneles de desempeño (WFM)' }, default: '1' },
  { key: 'qtd_urls_monitoradas', label: { pt: 'Itens fixos: URLs monitoradas (WFM)', en: 'Fixed items: Monitored URLs (WFM)', es: 'Ítems fijos: URL supervisadas (WFM)' }, default: '10' },
  { key: 'qtd_programacoes_exclusao', label: { pt: 'Itens fixos: Programações de exclusão (ADPP)', en: 'Fixed items: Deletion schedules (ADPP)', es: 'Ítems fijos: Programaciones de eliminación (ADPP)' }, default: '2' },
  { key: 'qtd_gatilhos_supressao', label: { pt: 'Itens fixos: Gatilhos de supressão (ADPP)', en: 'Fixed items: Suppression triggers (ADPP)', es: 'Ítems fijos: Desencadenadores de supresión (ADPP)' }, default: '5' },
];

/** Chave da fórmula de quantidade de um item fixo. */
export const fixedQtyKey = (itemKey: string) => `qtd_${itemKey}`;

/** Fórmulas de HORAS (apps da Aktie Now) — usam as quantidades acima. */
export const APP_FORMULAS: FormulaSpec[] = [
  { key: 'horas_app_condicionais', label: { pt: 'App Condicionais Avançadas (horas)', en: 'Advanced Conditions app (hours)', es: 'App Condiciones Avanzadas (horas)' }, default: 'base_condicionais_avancadas + (visualizacoes * 0,1 + gatilhos_simples * 0,125 + formularios) * 0,25' },
  { key: 'horas_app_ticket_manager', label: { pt: 'App Ticket Manager (horas)', en: 'Ticket Manager app (hours)', es: 'App Ticket Manager (horas)' }, default: 'base_ticket_manager + campos_ticket * 0,02 * qtd_operacoes' },
];

/** Fórmulas das BASES dos percentuais (Discovery, Validação, Go-live, Comunicação técnica e GP). */
export const BASE_FORMULAS: FormulaSpec[] = [
  { key: 'base_percentuais', label: { pt: 'Base de Discovery, Validação, Go-live e Comunicação técnica', en: 'Base of Discovery, Validation, Go-live and Technical communication', es: 'Base de Discovery, Validación, Go-live y Comunicación técnica' }, default: 'horas_itens - horas_treinamento - horas_integracoes_nativas - horas_apps_marketplace' },
  { key: 'gatilho_gp', label: { pt: 'Gatilho do GP (comparado ao limite)', en: 'PM trigger (compared to the threshold)', es: 'Disparador del PM (comparado con el límite)' }, default: 'horas_itens + horas_comunicacao_tecnica + horas_discovery + horas_validacao + horas_golive' },
  { key: 'base_gp', label: { pt: 'Base do GP', en: 'PM base', es: 'Base del PM' }, default: 'horas_itens - horas_integracoes_nativas - horas_apps_marketplace + horas_discovery + horas_validacao + horas_golive' },
];

export const ALL_FORMULAS: FormulaSpec[] = [...QUANTITY_FORMULAS, ...FIXED_QTY_FORMULAS, ...APP_FORMULAS, ...BASE_FORMULAS];

/* ---------------------------------------------------------------- VARIÁVEIS -- */

export interface FormulaVariable {
  name: string;
  description: { pt: string; en: string; es: string };
}

const MODULE_FLAGS = ['support', 'knowledge', 'community', 'analytics', 'voice', 'copilot', 'qa', 'wfm', 'adpp'];
const PLAN_FLAGS = ['team', 'growth', 'professional', 'enterprise'];

/** Variáveis de entrada, disponíveis para todas as fórmulas. */
export const INPUT_VARIABLES: FormulaVariable[] = [
  { name: 'agentes', description: { pt: 'Número de agentes', en: 'Number of agents', es: 'Número de agentes' } },
  { name: 'marcas', description: { pt: 'Número de marcas', en: 'Number of brands', es: 'Número de marcas' } },
  { name: 'areas', description: { pt: 'Número de áreas', en: 'Number of areas', es: 'Número de áreas' } },
  { name: 'artigos_knowledge', description: { pt: 'Artigos de Knowledge', en: 'Knowledge articles', es: 'Artículos de Knowledge' } },
  { name: 'qtd_operacoes', description: { pt: 'Quantidade de tipos de operação (B2C/B2B/B2E), mínimo 1', en: 'Number of operation types (B2C/B2B/B2E), at least 1', es: 'Cantidad de tipos de operación (B2C/B2B/B2E), mínimo 1' } },
  { name: 'total_qtd_canais', description: { pt: 'Soma das quantidades de todos os canais ativos', en: 'Sum of the quantities of all active channels', es: 'Suma de las cantidades de todos los canales activos' } },
  { name: 'tipos_canais', description: { pt: 'Quantos canais diferentes estão ativos', en: 'How many different channels are active', es: 'Cuántos canales distintos están activos' } },
  { name: 'outros_tipos_canais', description: { pt: 'Canais ativos além de e-mail, formulário web, voz e WhatsApp', en: 'Active channels other than email, web form, voice and WhatsApp', es: 'Canales activos además de correo electrónico, formulario web, voz y WhatsApp' } },
  { name: 'fator_plano_funcoes', description: { pt: 'Fator de plano para funções (Números › fatores de plano)', en: 'Plan factor for roles (Numbers › plan factors)', es: 'Factor de plan para roles (Números › factores de plan)' } },
  { name: 'fator_plano_campos_ticket', description: { pt: 'Fator de plano para campos de ticket', en: 'Plan factor for ticket fields', es: 'Factor de plan para campos de ticket' } },
  { name: 'fator_plano_sla', description: { pt: 'Fator de plano para SLA', en: 'Plan factor for SLA', es: 'Factor de plan para SLA' } },
  { name: 'soma_fator_operacao_usuario', description: { pt: 'Soma dos fatores de operação para campos de usuário', en: 'Sum of operation factors for user fields', es: 'Suma de los factores de operación para campos de usuario' } },
  { name: 'soma_fator_operacao_organizacao', description: { pt: 'Soma dos fatores de operação para campos de organização', en: 'Sum of operation factors for organization fields', es: 'Suma de los factores de operación para campos de organización' } },
  ...PLAN_FLAGS.map((p) => ({ name: `plano_${p}`, description: { pt: `1 se o plano for ${p}, senão 0`, en: `1 if the plan is ${p}, otherwise 0`, es: `1 si el plan es ${p}, si no 0` } })),
  { name: 'sku_cs', description: { pt: '1 se a instância for Customer Service', en: '1 if the instance is Customer Service', es: '1 si la instancia es Customer Service' } },
  { name: 'sku_es', description: { pt: '1 se a instância for Employee Service', en: '1 if the instance is Employee Service', es: '1 si la instancia es Employee Service' } },
  ...MODULE_FLAGS.map((m) => ({ name: `tem_${m}`, description: { pt: `1 se o módulo ${m} estiver no escopo (e no plano)`, en: `1 if the ${m} module is in scope (and on the plan)`, es: `1 si el módulo ${m} está en el alcance (y en el plan)` } })),
  ...CHANNEL_KEYS.map((c) => ({ name: `canal_${c}`, description: { pt: `Quantidade do canal ${c}`, en: `Quantity of channel ${c}`, es: `Cantidad del canal ${c}` } })),
  ...CHANNEL_KEYS.map((c) => ({ name: `tem_canal_${c}`, description: { pt: `1 se o canal ${c} estiver ativo`, en: `1 if channel ${c} is active`, es: `1 si el canal ${c} está activo` } })),
];

/** Variáveis extras, só das fórmulas de apps. */
export const APP_VARIABLES: FormulaVariable[] = [
  { name: 'base_condicionais_avancadas', description: { pt: 'Números › apps › condicionais_avancadas_base', en: 'Numbers › apps › condicionais_avancadas_base', es: 'Números › apps › condicionais_avancadas_base' } },
  { name: 'base_ticket_manager', description: { pt: 'Números › apps › ticket_manager_base', en: 'Numbers › apps › ticket_manager_base', es: 'Números › apps › ticket_manager_base' } },
];

/** Variáveis das fórmulas de base dos percentuais. */
export const BASE_VARIABLES: FormulaVariable[] = [
  { name: 'horas_itens', description: { pt: 'Soma de todas as linhas de item (antes dos percentuais)', en: 'Sum of every line item (before the percentages)', es: 'Suma de todas las líneas de ítem (antes de los porcentajes)' } },
  { name: 'horas_treinamento', description: { pt: 'Horas de treinamento', en: 'Training hours', es: 'Horas de capacitación' } },
  { name: 'horas_workshops', description: { pt: 'Horas de workshop', en: 'Workshop hours', es: 'Horas de workshop' } },
  { name: 'horas_integracoes_nativas', description: { pt: 'Horas de integrações nativas', en: 'Native integration hours', es: 'Horas de integraciones nativas' } },
  { name: 'horas_apps_marketplace', description: { pt: 'Horas de apps de Marketplace', en: 'Marketplace app hours', es: 'Horas de apps de Marketplace' } },
  { name: 'horas_action_flow', description: { pt: 'Horas de Action Flow', en: 'Action Flow hours', es: 'Horas de Action Flow' } },
  { name: 'horas_discovery', description: { pt: 'Discovery já calculado (só em gatilho_gp e base_gp)', en: 'Discovery already calculated (gatilho_gp and base_gp only)', es: 'Discovery ya calculado (solo en gatilho_gp y base_gp)' } },
  { name: 'horas_validacao', description: { pt: 'Validação já calculada (só em gatilho_gp e base_gp)', en: 'Validation already calculated (gatilho_gp and base_gp only)', es: 'Validación ya calculada (solo en gatilho_gp y base_gp)' } },
  { name: 'horas_golive', description: { pt: 'Go-live já calculado (só em gatilho_gp e base_gp)', en: 'Go-live already calculated (gatilho_gp and base_gp only)', es: 'Go-live ya calculado (solo en gatilho_gp y base_gp)' } },
  { name: 'horas_comunicacao_tecnica', description: { pt: 'Comunicação técnica já calculada (só em gatilho_gp e base_gp)', en: 'Technical communication already calculated (gatilho_gp and base_gp only)', es: 'Comunicación técnica ya calculada (solo en gatilho_gp y base_gp)' } },
];

/* ------------------------------------------------------------------ CONFIG -- */

/** Vínculo de uma hora da Calculadora com um item da biblioteca. */
export interface AEBinding {
  /** Item da biblioteca (null = sem vínculo: vale o número da Calculadora). */
  packageId: number | null;
  /** Ajuste manual: vale o número da Calculadora mesmo com o item vinculado. */
  override: boolean;
}

export interface AEConfig {
  numbers: AENumbers;
  formulas: Record<string, string>;
  settings: {
    /** Categoria da biblioteca cujos itens são oferecidos como integrações nativas. */
    nativeIntegrationsCategory: string;
  };
  /**
   * Vínculos com a biblioteca, por caminho do número ("horas_unitarias.funcoes").
   * Ausente = configuração anterior aos vínculos: vale só o número salvo.
   */
  bindings?: Record<string, AEBinding>;
  /**
   * Horas de cada integração nativa (nome do item → horas), vindas da
   * biblioteca. Preenchido em tempo de execução por `resolveAEConfig` ou pelo
   * retrato salvo na estimativa — nunca gravado na configuração.
   */
  nativeIntegrationHours?: Record<string, number>;
}

export const DEFAULT_AE_CONFIG: AEConfig = {
  numbers: DEFAULT_AE_NUMBERS,
  formulas: Object.fromEntries(ALL_FORMULAS.map((f) => [f.key, f.default])),
  settings: { nativeIntegrationsCategory: 'Integrações Nativas' },
};

function mergeNumbers(defaults: any, saved: any): any {
  if (defaults && typeof defaults === 'object') {
    const out: any = {};
    for (const key of Object.keys(defaults)) {
      out[key] = mergeNumbers(defaults[key], saved?.[key]);
    }
    return out;
  }
  const n = typeof saved === 'number' ? saved : parseFloat(String(saved ?? ''));
  return Number.isFinite(n) ? n : defaults;
}

/**
 * Completa uma configuração salva com os padrões (chaves novas, valores
 * inválidos) — assim uma configuração gravada antes de uma chave existir
 * continua funcionando.
 */
export function normalizeAEConfig(raw: any): AEConfig {
  const source = typeof raw === 'string' ? safeParse(raw) : raw || {};
  // Configurações antigas guardavam itens fixos como { qtd, horas }: a hora
  // continua em Números e a quantidade vira a fórmula do item.
  const savedNumbers = source?.numbers ? JSON.parse(JSON.stringify(source.numbers)) : undefined;
  const legacyQty: Record<string, number> = {};
  Object.values(savedNumbers?.itens_fixos || {}).forEach((group: any) => {
    Object.entries(group || {}).forEach(([key, value]: [string, any]) => {
      if (value && typeof value === 'object') {
        const qty = Number(value.qtd);
        if (Number.isFinite(qty)) legacyQty[key] = qty;
        group[key] = value.horas;
      }
    });
  });
  const formulas: Record<string, string> = {};
  for (const spec of ALL_FORMULAS) {
    const saved = source?.formulas?.[spec.key];
    const legacy = spec.key.startsWith('qtd_') ? legacyQty[spec.key.slice(4)] : undefined;
    formulas[spec.key] = typeof saved === 'string' && saved.trim()
      ? saved
      : legacy !== undefined ? String(legacy) : spec.default;
  }
  const category = String(source?.settings?.nativeIntegrationsCategory ?? '').trim();
  const config: AEConfig = {
    numbers: mergeNumbers(DEFAULT_AE_NUMBERS, savedNumbers),
    formulas,
    settings: { nativeIntegrationsCategory: category || DEFAULT_AE_CONFIG.settings.nativeIntegrationsCategory },
  };
  if (source?.bindings && typeof source.bindings === 'object') {
    const bindings: Record<string, AEBinding> = {};
    for (const spec of BINDABLE_NUMBERS) {
      const b = source.bindings[spec.path];
      if (!b || typeof b !== 'object') continue;
      const id = Number(b.packageId);
      bindings[spec.path] = { packageId: Number.isInteger(id) && id > 0 ? id : null, override: Boolean(b.override) };
    }
    config.bindings = bindings;
  }
  return config;
}

function safeParse(text: string): any {
  try { return JSON.parse(text); } catch { return {}; }
}

const orderCache = new Map<string, { order: string[]; cycle: string[] }>();

/**
 * Ordem de cálculo das quantidades a partir das dependências entre fórmulas
 * (ordenação topológica que preserva a ordem padrão sempre que possível).
 * `cycle` lista as quantidades presas num ciclo — com ciclo, elas vão para o
 * fim na ordem padrão e a validação impede salvar.
 */
export function quantityEvaluationOrder(formulas: Record<string, string>): { order: string[]; cycle: string[] } {
  const keys = QUANTITY_FORMULAS.map((f) => f.key);
  const cacheKey = JSON.stringify(keys.map((k) => formulas[k] || ''));
  const cached = orderCache.get(cacheKey);
  if (cached) return cached;

  const keySet = new Set(keys);
  const deps = new Map<string, Set<string>>();
  for (const spec of QUANTITY_FORMULAS) {
    let used = new Set<string>();
    try {
      used = formulaVariables(parseFormula(formulas[spec.key] || spec.default));
    } catch {
      /* erro de sintaxe é reportado pela validação */
    }
    deps.set(spec.key, new Set(Array.from(used).filter((n) => keySet.has(n))));
  }

  const order: string[] = [];
  const done = new Set<string>();
  let progressed = true;
  while (order.length < keys.length && progressed) {
    progressed = false;
    for (const key of keys) {
      if (done.has(key)) continue;
      if (Array.from(deps.get(key) || []).every((d) => done.has(d))) {
        order.push(key);
        done.add(key);
        progressed = true;
        break; // recomeça do início para manter a ordem padrão
      }
    }
  }
  const blocked = keys.filter((k) => !done.has(k));
  // Dos bloqueados, só quem está DE FATO num ciclo (alcança a si mesmo); os
  // demais apenas dependem do ciclo e se resolvem quando ele for corrigido.
  const reaches = (from: string, target: string): boolean => {
    const stack = Array.from(deps.get(from) || []);
    const seen = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === target) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      stack.push(...Array.from(deps.get(cur) || []));
    }
    return false;
  };
  const cycle = blocked.filter((k) => reaches(k, k));
  const result = { order: [...order, ...blocked], cycle };
  orderCache.set(cacheKey, result);
  return result;
}

export interface AEConfigIssue {
  /** Chave da fórmula ou caminho do número ("percentuais.discovery"). */
  field: string;
  message: string;
}

/** Valida números e fórmulas. Lista vazia = configuração pode ser salva. */
export function validateAEConfig(config: AEConfig): AEConfigIssue[] {
  const issues: AEConfigIssue[] = [];

  const walk = (value: any, path: string) => {
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k));
      return;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ field: path, message: 'Número inválido.' });
    } else if (value < 0) {
      issues.push({ field: path, message: 'O valor não pode ser negativo.' });
    }
  };
  walk(config.numbers, '');

  const inputNames = new Set(INPUT_VARIABLES.map((v) => v.name));
  const quantityNames = QUANTITY_FORMULAS.map((f) => f.key);
  const appNames = new Set(APP_VARIABLES.map((v) => v.name));
  const baseNames = new Set(BASE_VARIABLES.map((v) => v.name));
  const percentOnly = new Set(['horas_discovery', 'horas_validacao', 'horas_golive', 'horas_comunicacao_tecnica']);

  const check = (spec: FormulaSpec, allowed: Set<string>, laterQuantities: Set<string>, extraAllowed?: Set<string>) => {
    const source = config.formulas[spec.key];
    try {
      const ast = parseFormula(source);
      for (const name of Array.from(formulaVariables(ast))) {
        if (allowed.has(name) || extraAllowed?.has(name)) continue;
        if (laterQuantities.has(name)) {
          issues.push({ field: spec.key, message: `"${name}" é calculada DEPOIS desta fórmula e não pode ser usada aqui.` });
        } else {
          issues.push({ field: spec.key, message: `Variável desconhecida: "${name}".` });
        }
      }
    } catch (e: any) {
      const pos = e instanceof FormulaError ? ` (posição ${e.position + 1})` : '';
      issues.push({ field: spec.key, message: `${e?.message || String(e)}${pos}` });
    }
  };

  const allQuantities = new Set([...Array.from(inputNames), ...quantityNames]);
  QUANTITY_FORMULAS.forEach((spec) => check(spec, allQuantities, new Set()));
  FIXED_QTY_FORMULAS.forEach((spec) => check(spec, allQuantities, new Set()));
  const { cycle } = quantityEvaluationOrder(config.formulas);
  cycle.forEach((key) => {
    issues.push({ field: key, message: `Dependência circular: esta fórmula depende (direta ou indiretamente) dela mesma. Envolvidas: ${cycle.join(', ')}.` });
  });
  APP_FORMULAS.forEach((spec) => check(spec, allQuantities, new Set(), appNames));
  BASE_FORMULAS.forEach((spec) => {
    const allowed = new Set([...Array.from(allQuantities), ...Array.from(baseNames)]);
    if (spec.key === 'base_percentuais') percentOnly.forEach((n) => allowed.delete(n));
    check(spec, allowed, spec.key === 'base_percentuais' ? percentOnly : new Set());
  });

  if (!config.settings.nativeIntegrationsCategory.trim()) {
    issues.push({ field: 'settings.nativeIntegrationsCategory', message: 'Informe a categoria das integrações nativas.' });
  }
  return issues;
}

/* ------------------------------------------------- VÍNCULOS COM A BIBLIOTECA -- */

/**
 * Horas da Calculadora que podem ser governadas pela biblioteca (Admin ›
 * Biblioteca é a fonte da verdade). `candidates` são os nomes usados para
 * sugerir o vínculo automaticamente (comparação sem acento nem caixa); sem
 * candidato, o admin vincula à mão. Mínimos e o padrão de integração nativa
 * não são horas de item e ficam só na Calculadora.
 */
export interface BindableNumber {
  path: string;
  group: string;
  key: string;
  candidates: string[];
}

const UNIT_CANDIDATES: Record<string, string[]> = {
  funcoes: ['Funções'],
  grupos: ['Grupos'],
  campos_ticket: ['Campos de ticket'],
  formularios: ['Formulários e Catálogos de Serviço', 'Formulários'],
  condicionais_campos: ['Campos de ticket condicionais'],
  campos_usuario: ['Campos do usuário', 'Campos de usuário'],
  campos_organizacao: ['Campos da organização', 'Campos de organização'],
  visualizacoes: ['Visualizações'],
  macros: ['Macros'],
  gatilhos_simples: ['Gatilhos Simples'],
  gatilhos_complexos: ['Gatilhos Complexos'],
  automacoes_simples: ['Automações simples'],
  automacoes_complexas: ['Automações complexas'],
  politicas_sla: ['Políticas de SLA'],
  ivr: ['URA', 'IVR'],
  saudacoes: ['Saudações'],
  intencoes: ['Intenções (Copilot)', 'Intenções'],
  entidades: ['Entidades (Copilot)'],
  procedimentos: ['Procedimentos (Copilot)', 'Procedimentos'],
  wfm_localizacoes: ['Localizações'],
  wfm_turnos: ['Turnos'],
  wfm_grupos_trabalho: ['Grupos de trabalho'],
  wfm_equipes: ['Equipes'],
  wfm_motivos_folga: ['Motivos de folga'],
  wfm_tarefas_gerais: ['Tarefas Gerais'],
  wfm_automacoes: ['Automações (WFM)'],
  wfm_funcoes: ['Funções (WFM)'],
  qa_destaques: ['Destaques / Insights de IA'],
  qa_quizzes: ['Quizzes'],
  qa_filtros: ['Filtros'],
  qa_tabelas_desempenho: ['Tabelas de desempenho'],
  qa_categorias_manuais: ['Categorias manuais'],
  qa_categorias_ia: ['Categorias de IA'],
  qa_usuarios: ['Usuários (QA)'],
  qa_bots: ['Bots'],
  qa_espaco_trabalho: ['Espaços de trabalho'],
  qa_atribuicoes: ['Atribuições'],
  qa_grupos: ['Grupos (QA)'],
  qa_hashtags: ['Hashtags'],
  membro_equipe: ['Agentes'],
  marca: ['Marcas'],
  canal_email: ['Email Zendesk'],
  canal_web_widget: ['Web Widget'],
  canal_exige_reuniao: [],
  artigo: ['Artigos'],
  action_flow: ['Fluxos de ação: sistemas externos'],
  conversa_paralela: ['Conversas Paralelas via Slack'],
  sso: ['Single Sign-On (SSO)'],
};

const MODULE_NAME: Record<string, string> = {
  support: 'Support', community: 'Community', analytics: 'Analytics', voice: 'Voice',
  copilot: 'Copilot', qa: 'QA', wfm: 'WFM', adpp: 'ADPP', suite: 'Suite',
};

const FIXED_CANDIDATES: Record<string, string[]> = {
  encaminhamento_omnichannel: ['Encaminhamento omnichannel'],
  gatilho_webhook_instancia: [],
  webhooks: ['Webhook', 'Webhooks'],
  pesquisa_satisfacao: ['Pesquisa de satisfação (CSAT)'],
  programacao_feriados: ['Programação e feriados'],
  cenarios_previsao: ['Cenários de previsão'],
  paineis_desempenho: ['Painéis de desempenho'],
  urls_monitoradas: ['URLs externas monitoradas'],
  programacoes_exclusao: ['Programações de exclusão de dados'],
  gatilhos_supressao: [],
};

const APP_CANDIDATES: Record<string, string[]> = {
  condicionais_avancadas_base: ['Condicionais Avançadas: instalação'],
  ticket_manager_base: ['Ticket Manager: instalação'],
  woocommerce: ['WooCommerce'],
  dialpad: ['DialPad'],
  aircall: ['AirCall'],
  vtex: ['VTEX'],
  stripe: ['Stripe'],
  pipedrive: ['Pipedrive'],
  sweethawk: ['Apps SweetHawk'],
  other_marketplace: ['App Marketplace'],
};

export const BINDABLE_NUMBERS: BindableNumber[] = [
  ...Object.keys(UNIT_CANDIDATES).map((key) => ({ path: `horas_unitarias.${key}`, group: 'horas_unitarias', key, candidates: UNIT_CANDIDATES[key] })),
  ...Object.keys(DEFAULT_AE_NUMBERS.configuracoes_gerais).map((key) => ({
    path: `configuracoes_gerais.${key}`, group: 'configuracoes_gerais', key,
    candidates: [`Configurações gerais (${MODULE_NAME[key] || key})`],
  })),
  // Treinamentos da Calculadora agrupam admin + agente; sem nome equivalente
  // exato na biblioteca, o vínculo é feito à mão.
  ...Object.keys(DEFAULT_AE_NUMBERS.treinamentos).map((key) => ({ path: `treinamentos.${key}`, group: 'treinamentos', key, candidates: [] as string[] })),
  ...Object.keys(DEFAULT_AE_NUMBERS.workshops).map((key) => ({
    path: `workshops.${key}`, group: 'workshops', key, candidates: [`Workshop ${MODULE_NAME[key] || key}`],
  })),
  ...Object.keys(APP_CANDIDATES).map((key) => ({ path: `apps.${key}`, group: 'apps', key, candidates: APP_CANDIDATES[key] })),
  ...Object.entries(DEFAULT_AE_NUMBERS.itens_fixos).flatMap(([group, items]) =>
    Object.keys(items).map((key) => ({ path: `itens_fixos.${group}.${key}`, group: 'itens_fixos', key, candidates: FIXED_CANDIDATES[key] || [] })),
  ),
];

const BINDABLE_BY_PATH = new Map(BINDABLE_NUMBERS.map((b) => [b.path, b]));
export const isBindablePath = (path: string) => BINDABLE_BY_PATH.has(path);

/** Item da biblioteca, no formato que os vínculos precisam. */
export interface AELibraryItem {
  id: number;
  name: string;
  hours: number;
  categoryName?: string | null;
}

export function numberAt(numbers: any, path: string): number {
  return Number(path.split('.').reduce((node, key) => (node == null ? node : node[key]), numbers));
}

function setNumberAt(numbers: any, path: string, value: number) {
  const keys = path.split('.');
  let node = numbers;
  keys.slice(0, -1).forEach((k) => { node = node[k]; });
  node[keys[keys.length - 1]] = value;
}

const foldName = (value: unknown) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** Vínculos sugeridos por nome (só correspondência exata, sem acento nem caixa). */
export function suggestBindings(library: AELibraryItem[]): Record<string, AEBinding> {
  const byName = new Map<string, AELibraryItem>();
  library.forEach((item) => { if (!byName.has(foldName(item.name))) byName.set(foldName(item.name), item); });
  const out: Record<string, AEBinding> = {};
  for (const spec of BINDABLE_NUMBERS) {
    const match = spec.candidates.map((c) => byName.get(foldName(c))).find(Boolean);
    out[spec.path] = { packageId: match ? match.id : null, override: false };
  }
  return out;
}

export interface ResolvedBinding {
  path: string;
  packageId: number | null;
  /** Item vinculado (null = sem vínculo ou item não encontrado/inativo). */
  item: AELibraryItem | null;
  override: boolean;
  /** Vínculo aponta para um item que não existe mais (ou está inativo). */
  missing: boolean;
  /** Valor que o cálculo usa. */
  effective: number;
}

export function resolveBindings(config: AEConfig, library: AELibraryItem[]): Record<string, ResolvedBinding> {
  const byId = new Map(library.map((item) => [item.id, item]));
  const out: Record<string, ResolvedBinding> = {};
  for (const spec of BINDABLE_NUMBERS) {
    const binding = config.bindings?.[spec.path] || { packageId: null, override: false };
    const item = binding.packageId != null ? byId.get(binding.packageId) || null : null;
    const stored = numberAt(config.numbers, spec.path);
    out[spec.path] = {
      path: spec.path,
      packageId: binding.packageId,
      item,
      override: binding.override,
      missing: binding.packageId != null && !item,
      effective: item && !binding.override ? Number(item.hours) || 0 : stored,
    };
  }
  return out;
}

/**
 * Configuração com os valores que o cálculo deve usar: horas vinculadas vêm
 * da biblioteca (salvo ajuste manual) e as integrações nativas usam as horas
 * de cada item. Configurações sem `bindings` (anteriores aos vínculos) voltam
 * como estão, para nada mudar até um admin salvar uma versão com vínculos.
 */
export function resolveAEConfig(config: AEConfig, library: AELibraryItem[]): AEConfig {
  if (!config.bindings) return config;
  const numbers = JSON.parse(JSON.stringify(config.numbers));
  Object.values(resolveBindings(config, library)).forEach((b) => setNumberAt(numbers, b.path, b.effective));
  const category = foldName(config.settings.nativeIntegrationsCategory);
  const nativeIntegrationHours: Record<string, number> = {};
  library
    .filter((item) => foldName(item.categoryName) === category)
    .forEach((item) => { nativeIntegrationHours[item.name] = Number(item.hours) || 0; });
  return { ...config, numbers, nativeIntegrationHours };
}

/** Grava as horas efetivas da biblioteca nos números (mantém o valor de reserva em dia). */
export function syncBoundNumbers(config: AEConfig, library: AELibraryItem[]): AEConfig {
  if (!config.bindings) return config;
  const numbers = JSON.parse(JSON.stringify(config.numbers));
  Object.values(resolveBindings(config, library)).forEach((b) => {
    if (b.item && !b.override) setNumberAt(numbers, b.path, Number(b.item.hours) || 0);
  });
  return { ...config, numbers };
}

/** Uma diferença entre duas versões da configuração. */
export interface AEConfigDiff {
  field: string;
  from: string;
  to: string;
}

function flattenConfig(config: AEConfig): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (value: any, path: string) => {
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k));
    } else {
      out[path] = String(value);
    }
  };
  walk(config.numbers, 'numbers');
  Object.entries(config.formulas).forEach(([k, v]) => { out[`formulas.${k}`] = v; });
  out['settings.nativeIntegrationsCategory'] = config.settings.nativeIntegrationsCategory;
  Object.entries(config.bindings || {}).forEach(([path, b]) => {
    out[`bindings.${path}`] = b.packageId == null ? '—' : `#${b.packageId}${b.override ? ' (manual)' : ''}`;
  });
  return out;
}

/** Diferenças de `from` para `to` (números, fórmulas, vínculos e ajustes). */
export function diffAEConfigs(from: AEConfig, to: AEConfig): AEConfigDiff[] {
  const a = flattenConfig(from);
  const b = flattenConfig(to);
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  return keys
    .filter((key) => (a[key] ?? '—') !== (b[key] ?? '—'))
    .map((key) => ({ field: key, from: a[key] ?? '—', to: b[key] ?? '—' }));
}

/**
 * Itens da biblioteca vinculados à configuração ativa da Calculadora, por id:
 * o painel usa para impedir a exclusão e para mostrar o "!" do ajuste manual.
 */
export function aeBindingUsage(config: AEConfig): Record<number, Array<{ path: string; override: boolean }>> {
  const usage: Record<number, Array<{ path: string; override: boolean }>> = {};
  Object.entries(config.bindings || {}).forEach(([path, binding]) => {
    if (binding.packageId == null) return;
    (usage[binding.packageId] = usage[binding.packageId] || []).push({ path, override: binding.override });
  });
  return usage;
}
