/**
 * Carga inicial da área Estudos: o conteúdo da planilha "Aktie Now - Acompanhamento
 * de Estudo do Time" (Matriz de Conhecimento e Acompanhamento Semanal), importado
 * uma vez quando as tabelas estão vazias. Depois disso, a fonte é o banco.
 */
export const PESSOA_POR_NOME: Record<string, string> = {
  Renato: 'rzanetti@aktienow.com',
  Matheus: 'msouza@aktienow.com',
  Arthur: 'aoliveira@aktienow.com',
  Elisa: 'esimicevic@aktienow.com',
};

export interface TopicoInicial { categoria: string; topico: string; descricao: string | null; niveis: Record<string, number> }
export interface RegistroInicial { data: string; pessoa: string; categoria: string | null; atividade: string; tipo: string | null; observacoes: string | null }

export const TOPICOS_INICIAIS: TopicoInicial[] = [
 {
  "categoria": "A. Zendesk — Fundamentos & Administração",
  "topico": "Planos do Suite (Team→Enterprise Plus) e limites por tier",
  "descricao": "O que cada plano libera e impacto comercial.",
  "niveis": {
   "Renato": 4,
   "Matheus": 4,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "A. Zendesk — Fundamentos & Administração",
  "topico": "Admin Center — configuração geral da conta",
  "descricao": "Navegação e principais áreas de configuração.",
  "niveis": {
   "Renato": 4,
   "Matheus": 4,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "A. Zendesk — Fundamentos & Administração",
  "topico": "Usuários, grupos e organizações",
  "descricao": "Modelagem de quem atende o quê e segmentação de clientes.",
  "niveis": {
   "Renato": 4,
   "Matheus": 4,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "A. Zendesk — Fundamentos & Administração",
  "topico": "Roles e permissões customizadas",
  "descricao": "Perfis de acesso de agentes e admins.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "A. Zendesk — Fundamentos & Administração",
  "topico": "Brands / operação multimarca",
  "descricao": "Múltiplas marcas em uma instância.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "A. Zendesk — Fundamentos & Administração",
  "topico": "Sandbox de configuração",
  "descricao": "Ambiente de testes antes de produção.",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Ciclo de vida do ticket (new→closed)",
  "descricao": "Status e transições.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Ticket Forms (formulários por tipo)",
  "descricao": "Formulários distintos por solicitação.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Custom Fields (ticket / user / org)",
  "descricao": "Tipos de campo e onde aplicar.",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Tags e segmentação",
  "descricao": "Uso em regras, filtros e roteamento.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Views (filas de tickets)",
  "descricao": "Listas filtradas para agentes.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Macros",
  "descricao": "Respostas/ações manuais padronizadas.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Triggers (regras por evento)",
  "descricao": "Automação na criação/atualização.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Automations (regras por tempo)",
  "descricao": "Ações periódicas baseadas em tempo.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "SLA Policies",
  "descricao": "Metas de tempo de resposta/resolução.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Omnichannel Routing (skills, prioridade)",
  "descricao": "Distribuição automática push/pull.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Side Conversations",
  "descricao": "Conversas paralelas com back-office/parceiros.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 3,
   "Elisa": 4
  }
 },
 {
  "categoria": "B. Zendesk Support — Core de Tickets",
  "topico": "Custom Objects e lookup relationships",
  "descricao": "Dados estruturados além do ticket.",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 2,
   "Elisa": 2
  }
 },
 {
  "categoria": "C. Canais & Mensageria",
  "topico": "Canal de e-mail / suporte por e-mail",
  "descricao": "Configuração de e-mail de suporte.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "C. Canais & Mensageria",
  "topico": "Web Widget / Zendesk Messaging",
  "descricao": "Chat no site/app e mensageria persistente.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "C. Canais & Mensageria",
  "topico": "Sunshine Conversations (broker omnichannel)",
  "descricao": "Camada que conecta WhatsApp e bots externos.",
  "niveis": {
   "Renato": 3,
   "Matheus": 1,
   "Arthur": 1,
   "Elisa": 1
  }
 },
 {
  "categoria": "C. Canais & Mensageria",
  "topico": "WhatsApp Business API via Zendesk",
  "descricao": "Integração de WhatsApp ao atendimento.",
  "niveis": {
   "Renato": 3,
   "Matheus": 3,
   "Arthur": 2,
   "Elisa": 3
  }
 },
 {
  "categoria": "C. Canais & Mensageria",
  "topico": "Redes sociais (FB, Instagram, etc.)",
  "descricao": "Canais sociais no Zendesk.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "C. Canais & Mensageria",
  "topico": "Zendesk Talk (telefonia)",
  "descricao": "Voz nativa que gera tickets.",
  "niveis": {
   "Renato": 3,
   "Matheus": 1,
   "Arthur": 3,
   "Elisa": 4
  }
 },
 {
  "categoria": "D. Guide / Help Center",
  "topico": "Estrutura Categoria → Seção → Artigo",
  "descricao": "Organização da base de conhecimento.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "D. Guide / Help Center",
  "topico": "Theming (HTML/CSS/Curlybars)",
  "descricao": "Customização visual do Help Center.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "D. Guide / Help Center",
  "topico": "Portal do cliente / request tracking",
  "descricao": "Acompanhamento de tickets pelo cliente.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "D. Guide / Help Center",
  "topico": "Controle de acesso e segmentos de usuário",
  "descricao": "Quem vê qual conteúdo.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "D. Guide / Help Center",
  "topico": "Knowledge management / Knowledge Capture",
  "descricao": "Criação de conhecimento no fluxo de atendimento.",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "D. Guide / Help Center",
  "topico": "Generative search (busca generativa)",
  "descricao": "Resposta de IA no topo da busca do Help Center.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "topico": "AI Agents (Advanced) — bots conversacionais",
  "descricao": "Bots autônomos com IA generativa.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 3
  }
 },
 {
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "topico": "AI Agents — intents, procedures e ações",
  "descricao": "Nome/Motivo do caso de uso, branching, handoff.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "topico": "Agent Builder / Custom Agents",
  "descricao": "Descrever o procedimento e a IA monta o fluxo; Reasoning Controls.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "topico": "Copilot — sugestões e resumos em tempo real",
  "descricao": "Assistente proativo que sugere respostas e resume o ticket ao agente.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "topico": "Copilot — procedures / ações guiadas",
  "descricao": "Copilot executa passos definidos e aciona ações durante o atendimento.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "topico": "Intelligent Triage",
  "descricao": "Classificação automática de intenção, sentimento e idioma.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "topico": "Respostas generativas (Generative AI)",
  "descricao": "Respostas a partir da base de conhecimento.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "F. Analytics & Qualidade",
  "topico": "Explore — dashboards nativos",
  "descricao": "Relatórios prontos por produto.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "F. Analytics & Qualidade",
  "topico": "Explore — custom queries",
  "descricao": "Métricas customizadas.",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 3
  }
 },
 {
  "categoria": "F. Analytics & Qualidade",
  "topico": "Prompt-Based Reporting",
  "descricao": "Geração de relatórios pedindo em linguagem natural à IA.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "F. Analytics & Qualidade",
  "topico": "Zendesk QA (ex-Klaus) — visão geral",
  "descricao": "Plataforma de qualidade de atendimento (humano e IA).",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 3
  }
 },
 {
  "categoria": "F. Analytics & Qualidade",
  "topico": "Zendesk QA — AutoQA / scoring automático",
  "descricao": "Pontuação automática de 100% das conversas.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "F. Analytics & Qualidade",
  "topico": "Zendesk QA — scorecards e calibração",
  "descricao": "Critérios de avaliação e alinhamento entre avaliadores.",
  "niveis": {
   "Renato": 3,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 2
  }
 },
 {
  "categoria": "F. Analytics & Qualidade",
  "topico": "Zendesk WFM (workforce management)",
  "descricao": "Previsão de demanda e escala de agentes.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 2
  }
 },
 {
  "categoria": "F. Analytics & Qualidade",
  "topico": "CSAT / pesquisas de satisfação",
  "descricao": "Medição de satisfação pós-atendimento.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "Zendesk Employee Service — posicionamento e planos",
  "descricao": "Atendimento interno (IT + RH); planos e pricing próprios.",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "Service Catalog (catálogo de serviços)",
  "descricao": "Itens de serviço solicitáveis pelo colaborador.",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "Approvals (aprovações nativas)",
  "descricao": "Fluxos e roteamento automático de aprovação.",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "Tasks / task management (templates de tarefa)",
  "descricao": "Tarefas e checklists dentro do ticket.",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "Change management",
  "descricao": "Workflows de mudança padronizados com templates e compliance.",
  "niveis": {
   "Renato": 3,
   "Matheus": 1,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "Base de conhecimento interna + generative search",
  "descricao": "Procedimentos conhecidos e busca generativa para colaboradores.",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "ITAM nativo (inventário e lifecycle)",
  "descricao": "Inventário, ciclo de vida, patching, lock e provisioning de ativos.",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "ITAM — AssetSonar (tier intermediário)",
  "descricao": "Gestão de ativos com mais recursos.",
  "niveis": {
   "Renato": 2,
   "Matheus": 0,
   "Arthur": 0,
   "Elisa": 0
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "ITAM — Oomnitza (enterprise / CMDB)",
  "descricao": "Cenários regulados e CMDB enterprise.",
  "niveis": {
   "Renato": 2,
   "Matheus": 0,
   "Arthur": 1,
   "Elisa": 0
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "AI Agents for Employee Service",
  "descricao": "Agentes de IA para suporte interno (EAP 30/Jul; GA 02/Dez 2026).",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "Integrações HRIS (Workday, Rippling, BambooHR, HiBob)",
  "descricao": "Conexão com sistemas de RH.",
  "niveis": {
   "Renato": 0,
   "Matheus": 0,
   "Arthur": 0,
   "Elisa": 3
  }
 },
 {
  "categoria": "G. Employee Service / ITSM",
  "topico": "Discovery Playbook de Employee Service",
  "descricao": "Perguntas obrigatórias de IT e RH para account review.",
  "niveis": {
   "Renato": 4,
   "Matheus": 0,
   "Arthur": 2,
   "Elisa": 4
  }
 },
 {
  "categoria": "H. Plataforma, APIs & Apps (Dev + No-Code)",
  "topico": "REST API do Zendesk",
  "descricao": "Leitura/escrita programática de dados.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 2
  }
 },
 {
  "categoria": "H. Plataforma, APIs & Apps (Dev + No-Code)",
  "topico": "Webhooks",
  "descricao": "Notificações de eventos para sistemas externos.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 2
  }
 },
 {
  "categoria": "H. Plataforma, APIs & Apps (Dev + No-Code)",
  "topico": "Zendesk App Framework (ZAF) — apps com código",
  "descricao": "Apps customizados na interface (dev).",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 1,
   "Elisa": 1
  }
 },
 {
  "categoria": "H. Plataforma, APIs & Apps (Dev + No-Code)",
  "topico": "App Builder (no-code, IA)",
  "descricao": "Criação de apps por linguagem natural no Admin Center (sem código).",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 3,
   "Elisa": 4
  }
 },
 {
  "categoria": "H. Plataforma, APIs & Apps (Dev + No-Code)",
  "topico": "Action Builder & Action Flows",
  "descricao": "Studio no-code para orquestrar ações/integrações entre sistemas e agentes IA/humanos.",
  "niveis": {
   "Renato": 2,
   "Matheus": 1,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "H. Plataforma, APIs & Apps (Dev + No-Code)",
  "topico": "Marketplace apps",
  "descricao": "Instalação e avaliação de apps.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "H. Plataforma, APIs & Apps (Dev + No-Code)",
  "topico": "Autenticação (OAuth, API token, SSO)",
  "descricao": "Modelos de autenticação e segurança.",
  "niveis": {
   "Renato": 3,
   "Matheus": 1,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "I. Add-ons & Empacotamento Comercial",
  "topico": "ADPP (Advanced Data Privacy & Protection)",
  "descricao": "Privacidade, redação e retenção de dados.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "I. Add-ons & Empacotamento Comercial",
  "topico": "Advanced AI add-on",
  "descricao": "Capacidades de IA avançada e como são empacotadas.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "I. Add-ons & Empacotamento Comercial",
  "topico": "Cobrança por consumo (App Builder, Action Credits, Voice)",
  "descricao": "Features faturadas por uso acima da franquia do plano.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 3
  }
 },
 {
  "categoria": "I. Add-ons & Empacotamento Comercial",
  "topico": "Dimensionamento de licenças e tiers (Suite vs Support, BR + LATAM)",
  "descricao": "Cálculo de licenças e escolha de plano por cenário.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "J. Tecnologias Adjacentes / Middlewares",
  "topico": "iPaaS — Make (Integromat)",
  "descricao": "Orquestração de integrações low-code.",
  "niveis": {
   "Renato": 1,
   "Matheus": 0,
   "Arthur": 0,
   "Elisa": 0
  }
 },
 {
  "categoria": "J. Tecnologias Adjacentes / Middlewares",
  "topico": "iPaaS — Workato",
  "descricao": "Automação/integração enterprise.",
  "niveis": {
   "Renato": 0,
   "Matheus": 0,
   "Arthur": 0,
   "Elisa": 0
  }
 },
 {
  "categoria": "J. Tecnologias Adjacentes / Middlewares",
  "topico": "iPaaS — Mulesoft",
  "descricao": "Integração enterprise/API-led.",
  "niveis": {
   "Renato": 0,
   "Matheus": 0,
   "Arthur": 0,
   "Elisa": 0
  }
 },
 {
  "categoria": "J. Tecnologias Adjacentes / Middlewares",
  "topico": "iPaaS — Zapier",
  "descricao": "Automações simples entre apps.",
  "niveis": {
   "Renato": 2,
   "Matheus": 2,
   "Arthur": 1,
   "Elisa": 3
  }
 },
 {
  "categoria": "J. Tecnologias Adjacentes / Middlewares",
  "topico": "RPA (conceitos e ferramentas)",
  "descricao": "Automação de processos por robôs.",
  "niveis": {
   "Renato": 1,
   "Matheus": 3,
   "Arthur": 0,
   "Elisa": 0
  }
 },
 {
  "categoria": "J. Tecnologias Adjacentes / Middlewares",
  "topico": "APIs REST / JSON / arquitetura de integração",
  "descricao": "Fundamentos de integração entre sistemas.",
  "niveis": {
   "Renato": 3,
   "Matheus": 3,
   "Arthur": 2,
   "Elisa": 1
  }
 },
 {
  "categoria": "K. Plataformas de Bot & Voz (ecossistema)",
  "topico": "Droz (bot / RAG / arquitetura híbrida)",
  "descricao": "Bot generativo + fluxos manuais.",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 1
  }
 },
 {
  "categoria": "K. Plataformas de Bot & Voz (ecossistema)",
  "topico": "Droz Nexo (Reclame AQUI ↔ Zendesk)",
  "descricao": "Reclamações viram tickets.",
  "niveis": {
   "Renato": 3,
   "Matheus": 1,
   "Arthur": 2,
   "Elisa": 1
  }
 },
 {
  "categoria": "K. Plataformas de Bot & Voz (ecossistema)",
  "topico": "Callwe / Instant (voz)",
  "descricao": "Plataforma de voz para migração de telefonia.",
  "niveis": {
   "Renato": 3,
   "Matheus": 3,
   "Arthur": 2,
   "Elisa": 2
  }
 },
 {
  "categoria": "K. Plataformas de Bot & Voz (ecossistema)",
  "topico": "WhatsApp Business API / BSPs",
  "descricao": "Provedores oficiais de WhatsApp.",
  "niveis": {
   "Renato": 2,
   "Matheus": 1,
   "Arthur": 1,
   "Elisa": 1
  }
 },
 {
  "categoria": "L. Plataformas Concorrentes / Comparativas",
  "topico": "Salesforce Service Cloud",
  "descricao": "CRM de atendimento concorrente.",
  "niveis": {
   "Renato": 2,
   "Matheus": 0,
   "Arthur": 1,
   "Elisa": 3
  }
 },
 {
  "categoria": "L. Plataformas Concorrentes / Comparativas",
  "topico": "ServiceNow (ITSM / CSM)",
  "descricao": "Plataforma de service management.",
  "niveis": {
   "Renato": 1,
   "Matheus": 0,
   "Arthur": 0,
   "Elisa": 0
  }
 },
 {
  "categoria": "L. Plataformas Concorrentes / Comparativas",
  "topico": "Freshdesk / Freshservice",
  "descricao": "Concorrentes de CX/ITSM.",
  "niveis": {
   "Renato": 1,
   "Matheus": 0,
   "Arthur": 0,
   "Elisa": 0
  }
 },
 {
  "categoria": "L. Plataformas Concorrentes / Comparativas",
  "topico": "Jira Service Management",
  "descricao": "ITSM da Atlassian.",
  "niveis": {
   "Renato": 2,
   "Matheus": 0,
   "Arthur": 2,
   "Elisa": 3
  }
 },
 {
  "categoria": "L. Plataformas Concorrentes / Comparativas",
  "topico": "Intercom",
  "descricao": "Mensageria/atendimento concorrente.",
  "niveis": {
   "Renato": 1,
   "Matheus": 0,
   "Arthur": 1,
   "Elisa": 0
  }
 },
 {
  "categoria": "L. Plataformas Concorrentes / Comparativas",
  "topico": "HubSpot Service Hub",
  "descricao": "Atendimento dentro do HubSpot.",
  "niveis": {
   "Renato": 1,
   "Matheus": 0,
   "Arthur": 1,
   "Elisa": 3
  }
 },
 {
  "categoria": "M. Dados & Plataformas Complementares",
  "topico": "Arquitetura de dados / 'Fonte da Verdade'",
  "descricao": "Centralização e governança de dados.",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "M. Dados & Plataformas Complementares",
  "topico": "Databricks / data lake",
  "descricao": "Plataforma de dados/analytics.",
  "niveis": {
   "Renato": 1,
   "Matheus": 2,
   "Arthur": 1,
   "Elisa": 1
  }
 },
 {
  "categoria": "M. Dados & Plataformas Complementares",
  "topico": "Integração com CRMs e ERPs",
  "descricao": "Conexão com sistemas de negócio.",
  "niveis": {
   "Renato": 2,
   "Matheus": 2,
   "Arthur": 2,
   "Elisa": 2
  }
 },
 {
  "categoria": "N. Conhecimento de Segmentos / Verticais",
  "topico": "Varejo / E-commerce",
  "descricao": "Dores e jornadas típicas.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "N. Conhecimento de Segmentos / Verticais",
  "topico": "Financeiro / Bancário / Cobrança",
  "descricao": "Inadimplência, boleto, compliance.",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "N. Conhecimento de Segmentos / Verticais",
  "topico": "Construção / Imobiliário",
  "descricao": "Pós-obra, distrato, jornada longa.",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 2,
   "Elisa": 3
  }
 },
 {
  "categoria": "N. Conhecimento de Segmentos / Verticais",
  "topico": "Saúde",
  "descricao": "Regulação e sensibilidade de dados.",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 2,
   "Elisa": 3
  }
 },
 {
  "categoria": "N. Conhecimento de Segmentos / Verticais",
  "topico": "Telecom",
  "descricao": "Alto volume e churn.",
  "niveis": {
   "Renato": 2,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "N. Conhecimento de Segmentos / Verticais",
  "topico": "Logística / Export",
  "descricao": "Rastreio, parceiros externos, auditoria.",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 2
  }
 },
 {
  "categoria": "N. Conhecimento de Segmentos / Verticais",
  "topico": "SaaS / Tecnologia",
  "descricao": "Suporte técnico e recuperação de conta.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "topico": "Discovery / levantamento de necessidades",
  "descricao": "Condução de reuniões de descoberta.",
  "niveis": {
   "Renato": 4,
   "Matheus": 1,
   "Arthur": 3,
   "Elisa": 4
  }
 },
 {
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "topico": "Assessment operacional de CX (CPC, FCR, TMR, abandono, rechamada)",
  "descricao": "Diagnóstico quantitativo da operação.",
  "niveis": {
   "Renato": 3,
   "Matheus": 1,
   "Arthur": 2,
   "Elisa": 2
  }
 },
 {
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "topico": "Solution design / arquitetura de solução",
  "descricao": "Desenho da solução técnica.",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "topico": "Desenho de escopo / dimensionamento de horas",
  "descricao": "Estimativa e estruturação de entrega.",
  "niveis": {
   "Renato": 4,
   "Matheus": 3,
   "Arthur": 3,
   "Elisa": 4
  }
 },
 {
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "topico": "Proposta comercial (Word / PPTX)",
  "descricao": "Produção de deliverables comerciais.",
  "niveis": {
   "Renato": 3,
   "Matheus": 3,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "topico": "Apresentação executiva",
  "descricao": "Storytelling e pitch para decisores.",
  "niveis": {
   "Renato": 3,
   "Matheus": 2,
   "Arthur": 2,
   "Elisa": 4
  }
 },
 {
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "topico": "Demo / POC de AI Agents",
  "descricao": "Construção e condução de demonstrações.",
  "niveis": {
   "Renato": 4,
   "Matheus": 2,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "topico": "ROI / business case",
  "descricao": "Justificativa financeira da solução.",
  "niveis": {
   "Renato": 2,
   "Matheus": 2,
   "Arthur": 3,
   "Elisa": 3
  }
 },
 {
  "categoria": "P. Fundamentos de CX",
  "topico": "Estratégia e cultura de CX",
  "descricao": "Visão de experiência e orientação a cliente na operação.",
  "niveis": {
   "Renato": 2,
   "Arthur": 1,
   "Elisa": 2
  }
 },
 {
  "categoria": "P. Fundamentos de CX",
  "topico": "Customer Journey Mapping",
  "descricao": "Mapa da jornada e pontos de atrito.",
  "niveis": {
   "Renato": 2,
   "Arthur": 2,
   "Elisa": 2
  }
 },
 {
  "categoria": "P. Fundamentos de CX",
  "topico": "Voice of the Customer (VoC)",
  "descricao": "Captura e tratamento de feedback.",
  "niveis": {
   "Renato": 1,
   "Arthur": 1,
   "Elisa": 2
  }
 },
 {
  "categoria": "P. Fundamentos de CX",
  "topico": "Métricas de percepção (CSAT, NPS, CES)",
  "descricao": "O que medem e quando usar.",
  "niveis": {
   "Renato": 4,
   "Arthur": 3,
   "Elisa": 4
  }
 },
 {
  "categoria": "P. Fundamentos de CX",
  "topico": "Métricas operacionais (TMA, FRT, FCR, etc)",
  "descricao": "Leitura da operação.",
  "niveis": {
   "Renato": 4,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "P. Fundamentos de CX",
  "topico": "SLA / SLO",
  "descricao": "Definição e acompanhamento de metas de tempo.",
  "niveis": {
   "Renato": 4,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "P. Fundamentos de CX",
  "topico": "Estratégia omnichannel",
  "descricao": "Consistência entre canais.",
  "niveis": {
   "Renato": 4,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "P. Fundamentos de CX",
  "topico": "Autoatendimento e deflection",
  "descricao": "Self-service, bots e taxa de resolução automática",
  "niveis": {
   "Renato": 4,
   "Arthur": 4,
   "Elisa": 4
  }
 },
 {
  "categoria": "P. Fundamentos de CX",
  "topico": "Quality Assurance / Monitoria",
  "descricao": "Avaliação de qualidade e feedback ao agente.",
  "niveis": {
   "Renato": 4,
   "Arthur": 4,
   "Elisa": 3
  }
 },
 {
  "categoria": "P. Fundamentos de CX",
  "topico": "Governança de dados / LGPD",
  "descricao": "Privacidade, consentimento e retenção.",
  "niveis": {
   "Renato": 3,
   "Arthur": 3,
   "Elisa": 3
  }
 }
];

export const REGISTROS_INICIAIS: RegistroInicial[] = [
 {
  "data": "2026-06-29",
  "pessoa": "Renato",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "Action flows",
  "tipo": "Hands-on/Lab",
  "observacoes": null
 },
 {
  "data": "2026-06-29",
  "pessoa": "Matheus",
  "categoria": "G. Employee Service / ITSM",
  "atividade": "Principais Conceitos e Casos de Uso",
  "tipo": "Documentação",
  "observacoes": null
 },
 {
  "data": "2026-06-29",
  "pessoa": "Arthur",
  "categoria": "H. Plataforma, APIs & Apps (Dev + No-Code)",
  "atividade": "Teste de novos apps + criação e validação de skills no Claude para potencializar uso",
  "tipo": "Hands-on/Lab",
  "observacoes": null
 },
 {
  "data": "2026-06-29",
  "pessoa": "Elisa",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "Estudando e revisando todo o conteúdo para o teste teórico",
  "tipo": "Curso",
  "observacoes": null
 },
 {
  "data": "2026-07-06",
  "pessoa": "Renato",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "Action flows pt 2",
  "tipo": "Hands-on/Lab",
  "observacoes": null
 },
 {
  "data": "2026-07-06",
  "pessoa": "Elisa",
  "categoria": "M. Dados & Plataformas Complementares",
  "atividade": "Importacao de dados (geração recorrente de tickets e usuários) para Zendesk Support / QA / WFM",
  "tipo": "Hands-on/Lab",
  "observacoes": null
 },
 {
  "data": "2026-07-06",
  "pessoa": "Arthur",
  "categoria": "A. Zendesk — Fundamentos & Administração",
  "atividade": "Leitura de documentação e teste hands-on das \"novas\" funções de snapshot, atualização, deployment e versionamento de sandbox/produção",
  "tipo": "Hands-on/Lab",
  "observacoes": null
 },
 {
  "data": "2026-07-06",
  "pessoa": "Matheus",
  "categoria": "A. Zendesk — Fundamentos & Administração",
  "atividade": "Experimentação de configurações, automações, gatilhos, macros e funcionalidades fundamentais da Zendesk Suite",
  "tipo": "Hands-on/Lab",
  "observacoes": null
 },
 {
  "data": "2026-07-13",
  "pessoa": "Renato",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "EAP de Custom Agents + EAP de MCP + Criação de Mock API para Mock MCP",
  "tipo": "Doc + Lab",
  "observacoes": null
 },
 {
  "data": "2026-07-14",
  "pessoa": "Matheus",
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "atividade": "Zendesk Bootcamp Day 1",
  "tipo": "Mentoria",
  "observacoes": null
 },
 {
  "data": "2026-07-15",
  "pessoa": "Matheus",
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "atividade": "Zendesk Bootcamp Day 2",
  "tipo": "Mentoria",
  "observacoes": null
 },
 {
  "data": "2026-07-16",
  "pessoa": "Matheus",
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "atividade": "Zendesk Bootcamp Day 3",
  "tipo": "Mentoria",
  "observacoes": null
 },
 {
  "data": "2026-07-20",
  "pessoa": "Matheus",
  "categoria": "F. Analytics & Qualidade",
  "atividade": "Testes de configuração nos módulos de QA e WFM",
  "tipo": "Hands-on/Lab",
  "observacoes": null
 },
 {
  "data": "2026-08-03",
  "pessoa": "Matheus",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "Leitura da documentação e primeiro contato com Action Flow",
  "tipo": "Doc + Lab",
  "observacoes": null
 },
 {
  "data": "2026-08-03",
  "pessoa": "Renato",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "EAP de Custom Agents",
  "tipo": "Doc + Lab",
  "observacoes": null
 },
 {
  "data": "2026-08-12",
  "pessoa": "Arthur",
  "categoria": "I. Add-ons & Empacotamento Comercial",
  "atividade": "Zendesk for Contact Center V1 (Foundation | GTM)",
  "tipo": "Certificação",
  "observacoes": null
 },
 {
  "data": "2026-08-17",
  "pessoa": "Arthur",
  "categoria": "I. Add-ons & Empacotamento Comercial",
  "atividade": "Zendesk for Contact Center V1 (Technical Enablement for Partners)",
  "tipo": "Certificação",
  "observacoes": null
 },
 {
  "data": "2026-08-24",
  "pessoa": "Arthur",
  "categoria": "O. Competências Consultivas (Pré-vendas)",
  "atividade": "Treinamento de fundamentos de vendas: BANT, ROI e MEDDPICC",
  "tipo": "Curso",
  "observacoes": null
 },
 {
  "data": "2026-09-14",
  "pessoa": "Arthur",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "Leitura e Hands-on sobre Custom Agents",
  "tipo": "Hands-on/Lab",
  "observacoes": null
 },
 {
  "data": "2026-09-21",
  "pessoa": "Arthur",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "Estudo e testes práticos para projeto de cliente sobre Advanced Action Flow",
  "tipo": "Projeto real",
  "observacoes": null
 },
 {
  "data": "2026-09-28",
  "pessoa": "Renato",
  "categoria": "C. Canais & Mensageria",
  "atividade": "Zendesk for Contact Center V1 (Foundation | GTM)",
  "tipo": "Curso",
  "observacoes": null
 },
 {
  "data": "2026-09-28",
  "pessoa": "Arthur",
  "categoria": "H. Plataforma, APIs & Apps (Dev + No-Code)",
  "atividade": "Estudo e prática de OAuth e APIs Zendesk.",
  "tipo": "Doc + Lab",
  "observacoes": null
 },
 {
  "data": "2026-10-05",
  "pessoa": "Arthur",
  "categoria": "H. Plataforma, APIs & Apps (Dev + No-Code)",
  "atividade": "Possibilidades do Custom Object como database dentro do Zendesk",
  "tipo": "Hands-on/Lab",
  "observacoes": null
 },
 {
  "data": "2026-10-05",
  "pessoa": "Renato",
  "categoria": "G. Employee Service / ITSM",
  "atividade": "Conceitos de ITSM (GMUD, ICs, Incidente/Problema)",
  "tipo": "Outro",
  "observacoes": null
 },
 {
  "data": "2026-10-13",
  "pessoa": "Renato",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "AI Bootcamp",
  "tipo": "Curso",
  "observacoes": null
 },
 {
  "data": "2026-10-14",
  "pessoa": "Renato",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "AI Bootcamp",
  "tipo": "Curso",
  "observacoes": null
 },
 {
  "data": "2026-10-15",
  "pessoa": "Renato",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "AI Bootcamp",
  "tipo": "Curso",
  "observacoes": null
 },
 {
  "data": "2026-10-13",
  "pessoa": "Matheus",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "AI Bootcamp",
  "tipo": "Curso",
  "observacoes": null
 },
 {
  "data": "2026-10-14",
  "pessoa": "Matheus",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "AI Bootcamp",
  "tipo": "Curso",
  "observacoes": null
 },
 {
  "data": "2026-10-15",
  "pessoa": "Matheus",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "AI Bootcamp",
  "tipo": "Curso",
  "observacoes": null
 },
 {
  "data": "2026-11-02",
  "pessoa": "Elisa",
  "categoria": "I. Add-ons & Empacotamento Comercial",
  "atividade": "Zendesk QA",
  "tipo": null,
  "observacoes": null
 },
 {
  "data": "2026-11-02",
  "pessoa": "Renato",
  "categoria": "E. Zendesk IA & Automação Inteligente",
  "atividade": "Custom Agents + Fluxo de ação avançado",
  "tipo": "Projeto real",
  "observacoes": null
 },
 {
  "data": "2026-11-04",
  "pessoa": "Renato",
  "categoria": "C. Canais & Mensageria",
  "atividade": "ZCC",
  "tipo": "Certificação",
  "observacoes": null
 },
 {
  "data": "2026-11-09",
  "pessoa": "Arthur",
  "categoria": "F. Analytics & Qualidade",
  "atividade": "Exploração hands-on do Analytics Copilot",
  "tipo": "Hands-on/Lab",
  "observacoes": null
 }
];
