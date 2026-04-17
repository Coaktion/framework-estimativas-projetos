import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create default admin users
  const hashedAdmin123 = await bcrypt.hash('admin123', 10)
  const hashedDev = await bcrypt.hash('dev', 10)

  // msouza user
  await prisma.user.upsert({
    where: { email: 'msouza@aktienow.com' },
    update: { 
      name: 'Matheus Souza',
      password: hashedAdmin123,
      role: 'AE',
      isAdmin: false
    },
    create: {
      email: 'msouza@aktienow.com',
      name: 'Matheus Souza',
      password: hashedAdmin123,
      role: 'AE',
      isAdmin: false
    }
  })

  // admin user
  await prisma.user.upsert({
    where: { email: 'admin@aktienow.com' },
    update: { 
      name: 'Admin',
      password: hashedDev,
      role: 'ADMIN',
      isAdmin: true
    },
    create: {
      email: 'admin@aktienow.com',
      name: 'Admin',
      password: hashedDev,
      role: 'ADMIN',
      isAdmin: true
    }
  })

  const packages = [
    // Zendesk Support
    { name: "Support: Configurações gerais (Config Base)", hours: 1.3, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Configurações de Segurança (Auth, 2FA, IP)", hours: 0.25, category: "Zendesk Support", skill: "Implantação" }, // 15 min = 0.25h
    { name: "Support: Aparência (cor, nome, favicon)", hours: 0.05, category: "Zendesk Support", skill: "Implantação" }, // 3 min = 0.05h
    { name: "Support: Localização (fuso, idioma)", hours: 0.08, category: "Zendesk Support", skill: "Implantação" }, // 5 min = 0.08h
    { name: "Support: Eventos de perfil de usuário", hours: 0.08, category: "Zendesk Support", skill: "Implantação" }, // 5 min = 0.08h
    { name: "Support: Configuração de usuários finais", hours: 0.17, category: "Zendesk Support", skill: "Implantação" }, // 10 min = 0.17h
    { name: "Support: Customização do Cartão de usuário", hours: 0.17, category: "Zendesk Support", skill: "Implantação" }, // 10 min = 0.17h
    { name: "Support: Interface do agente", hours: 0.17, category: "Zendesk Support", skill: "Implantação" }, // 10 min = 0.17h
    { name: "Support: Painel de Contexto", hours: 0.17, category: "Zendesk Support", skill: "Implantação" }, // 10 min = 0.17h
    { name: "Support: Configuração de conversas paralelas", hours: 0.08, category: "Zendesk Support", skill: "Implantação" }, // 5 min = 0.08h
    { name: "Support: Solicitações de aprovação (approvals)", hours: 0.02, category: "Zendesk Support", skill: "Implantação" }, // 1 min = 0.02h
    { name: "Support: Configurações de ticket", hours: 0.08, category: "Zendesk Support", skill: "Implantação" }, // 5 min = 0.08h
    { name: "Support: Criação de chaves API", hours: 0.08, category: "Zendesk Support", skill: "Implantação" }, // 5 min = 0.08h
    { name: "Support: Single Sign-On (SAML / JWT / OpenID)", hours: 3.0, category: "Zendesk Support", skill: "Desenvolvimento" },
    { name: "Support: Programações de exclusão de dados (cada)", hours: 0.5, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Marcas (por marca)", hours: 0.25, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Membros de equipe / Agentes Light (por agente)", hours: 0.03, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Funções (por função)", hours: 0.33, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Grupos (por grupo)", hours: 0.08, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Campos do usuário (por campo)", hours: 0.07, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Campos da organização (por campo)", hours: 0.07, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Importação de usuários (por arquivo)", hours: 0.25, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Importação de organizações (por arquivo)", hours: 0.25, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: IPs a serem banidos (por IP)", hours: 0.08, category: "Zendesk Support", skill: "Implantação" },

    // Canais - Ticket
    { name: "Ticket: Email (por endereço)", hours: 0.33, category: "Canais - Ticket", skill: "Implantação" },
    { name: "Ticket: Template HTML (por marca)", hours: 1.0, category: "Canais - Ticket", skill: "Design" },
    { name: "Ticket: Formulários/Catálogos (por form)", hours: 0.5, category: "Canais - Ticket", skill: "Implantação" },
    { name: "Ticket: Condicionais (por condição)", hours: 0.03, category: "Canais - Ticket", skill: "Implantação" },
    { name: "Ticket: Facebook Page (Timeline)", hours: 1.0, category: "Canais - Ticket", skill: "Implantação" },
    { name: "Ticket: X (Mensagens Públicas)", hours: 1.0, category: "Canais - Ticket", skill: "Implantação" },
    { name: "Ticket: Microsoft Teams integration", hours: 1.0, category: "Canais - Ticket", skill: "Implantação" },

    // Canais - Messaging
    { name: "Messaging: Web Widget (por widget)", hours: 0.42, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Facebook Messenger (por página)", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Instagram Direct (por página)", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Android SDK", hours: 1.0, category: "Canais - Messaging", skill: "Desenvolvimento" },
    { name: "Messaging: iOS SDK", hours: 1.0, category: "Canais - Messaging", skill: "Desenvolvimento" },
    { name: "Messaging: Unity SDK", hours: 1.0, category: "Canais - Messaging", skill: "Desenvolvimento" },
    { name: "Messaging: LINE", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Apple Messages for Business", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Slack", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: X Corp DM (por página)", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: WeChat", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Google RCS", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Google Business Messages", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: KakaoTalk", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Telegram", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Text/SMS (por número)", hours: 0.17, category: "Canais - Messaging", skill: "Implantação" },

    // Voz
    { name: "Voz: Outra integração via marketplace", hours: 3.0, category: "Canais - Voz", skill: "Desenvolvimento" },
    { name: "Voz: Configurações gerais (Fila, Espera)", hours: 0.25, category: "Canais - Voz", skill: "Implantação" },
    { name: "Voz: Linhas / Números", hours: 0.08, category: "Canais - Voz", skill: "Implantação" },
    { name: "Voz: Saudações", hours: 0.12, category: "Canais - Voz", skill: "Implantação" },
    { name: "Voz: Números bloqueados", hours: 0.03, category: "Canais - Voz", skill: "Implantação" },
    { name: "Voz: IVR (Menus e Níveis)", hours: 0.59, category: "Canais - Voz", skill: "Implantação" },

    // Conversas Paralelas
    { name: "Conversas Paralelas: Slack (cada)", hours: 1.0, category: "Zendesk Support", skill: "Implantação" },
    { name: "Conversas Paralelas: Teams (cada)", hours: 1.0, category: "Zendesk Support", skill: "Implantação" },
    { name: "Conversas Paralelas: Mensagem proativa (cada)", hours: 1.0, category: "Zendesk Support", skill: "Implantação" },

    // Compartilhamento
    { name: "Compartilhamento: Entre Zendesk", hours: 1.0, category: "Zendesk Support", skill: "Implantação" },
    { name: "Compartilhamento: Com outros sistemas", hours: 5.0, category: "Zendesk Support", skill: "Desenvolvimento" },

    // AI Agents Essential
    { name: "AI Essential: Instruções (cada)", hours: 0.38, category: "AI Agents Essential", skill: "Solution Design" },
    { name: "AI Essential: Visualizações (cada)", hours: 0.38, category: "AI Agents Essential", skill: "Solution Design" },

    // Produtividade & Objetos
    { name: "Macros (cada)", hours: 0.25, category: "Produtividade", skill: "Implantação" },
    { name: "Conteúdo dinâmico (cada)", hours: 0.08, category: "Produtividade", skill: "Implantação" },
    { name: "Disposições (Layouts) (cada)", hours: 0.5, category: "Produtividade", skill: "Implantação" },
    { name: "Espaço de trabalho contextual (cada)", hours: 0.5, category: "Produtividade", skill: "Implantação" },
    { name: "Tarefas (Tasks) (cada)", hours: 0.5, category: "Produtividade", skill: "Implantação" },
    { name: "Campos de ticket (cada)", hours: 0.07, category: "Zendesk Support", skill: "Implantação" },
    { name: "Status de ticket personalizados (cada)", hours: 0.17, category: "Zendesk Support", skill: "Implantação" },
    { name: "Objeto personalizado (por tipo)", hours: 0.5, category: "Zendesk Support", skill: "Implantação" },
    { name: "Registros (records) (cada)", hours: 0.18, category: "Zendesk Support", skill: "Implantação" },
    { name: "Encaminhamento omnichannel (Full Setup)", hours: 2.0, category: "Automação", skill: "Implantação" },

    // Automação
    { name: "Gatilho Simples (Sem Webhook)", hours: 0.08, category: "Automação", skill: "Implantação" },
    { name: "Gatilho Complexo / Mensagens", hours: 0.33, category: "Automação", skill: "Implantação" },
    { name: "Webhook: Endpoint Instância", hours: 1.0, category: "Automação", skill: "Desenvolvimento" },
    { name: "Webhook: Endpoint Externo", hours: 2.0, category: "Automação", skill: "Desenvolvimento" },
    { name: "Metas de mensagens (messaging goals)", hours: 0.67, category: "Automação", skill: "Solution Design" },
    { name: "Automações (cada)", hours: 0.25, category: "Automação", skill: "Implantação" },
    { name: "Habilidades (cada)", hours: 0.17, category: "Automação", skill: "Implantação" },
    { name: "Políticas de SLA (cada)", hours: 0.25, category: "Automação", skill: "Implantação" },
    { name: "Programação e feriados (cada)", hours: 0.25, category: "Automação", skill: "Implantação" },
    { name: "Pesquisa de satisfação (CSAT)", hours: 0.5, category: "Automação", skill: "Implantação" },

    // Apps AktieNow
    { name: "App AktieNow: Condicionais Avançadas (Regra)", hours: 0.33, category: "Aplicativos AktieNow", skill: "Implantação" },
    { name: "App AktieNow: Ticket Manager (Modelo .csv)", hours: 1.0, category: "Aplicativos AktieNow", skill: "Implantação" },

    // Marketplace & Builder
    { name: "App Marketplace (Lista Infinita)", hours: 5.0, category: "Marketplace", skill: "Implantação" },
    { name: "App Builder: Sem conexão API externa", hours: 2.0, category: "Marketplace", skill: "Desenvolvimento" },
    { name: "App Builder: Com conexão API externa", hours: 10.0, category: "Marketplace", skill: "Desenvolvimento" },

    // Integrações Nativas
    { name: "Integração Nativa: Salesforce", hours: 2.0, category: "Integrações Nativas", skill: "Implantação" },
    { name: "Integração Nativa: Shopify", hours: 2.0, category: "Integrações Nativas", skill: "Implantação" },
    { name: "Integração Nativa: Slack", hours: 2.0, category: "Integrações Nativas", skill: "Implantação" },
    { name: "Integração Nativa: Workday", hours: 2.0, category: "Integrações Nativas", skill: "Implantação" },
    { name: "Integração Nativa: Google Agenda", hours: 2.0, category: "Integrações Nativas", skill: "Implantação" },
    { name: "Integração Nativa: Jira", hours: 2.0, category: "Integrações Nativas", skill: "Implantação" },
    { name: "Integração Nativa: Microsoft 365 Copilot", hours: 2.0, category: "Integrações Nativas", skill: "Implantação" },
    { name: "Ação personalizada (custom action)", hours: 1.0, category: "Integrações Nativas", skill: "Desenvolvimento" },
    { name: "Fluxo de ação: Simples", hours: 1.0, category: "Integrações Nativas", skill: "Desenvolvimento" },
    { name: "Fluxo de ação: Complexo", hours: 3.0, category: "Integrações Nativas", skill: "Desenvolvimento" },
    { name: "Serviços externos nativos (cada seleção)", hours: 1.0, category: "Integrações Nativas", skill: "Implantação" },
    { name: "Ação externa personalizada (cada ação)", hours: 1.0, category: "Integrações Nativas", skill: "Desenvolvimento" },
    { name: "Conexões", hours: 0.5, category: "Integrações Nativas", skill: "Implantação" },
    { name: "Alvos (targets)", hours: 0.5, category: "Automação", skill: "Implantação" },
    { name: "Webhooks (General)", hours: 0.33, category: "Automação", skill: "Implantação" },

    // Asset Management
    { name: "Asset: Ativar sincronização nativa (Intune/Jamf)", hours: 1.0, category: "Asset Management", skill: "Desenvolvimento" },
    { name: "Asset: Tipos de ativo (cada)", hours: 0.05, category: "Asset Management", skill: "Implantação" },
    { name: "Asset: Locais (cada)", hours: 0.05, category: "Asset Management", skill: "Implantação" },
    { name: "Asset: Campos (cada)", hours: 0.07, category: "Asset Management", skill: "Implantação" },
    { name: "Asset: Registros (records) (cada)", hours: 0.42, category: "Asset Management", skill: "Implantação" },
    { name: "Asset: Importação por .csv (por arquivo)", hours: 1.0, category: "Asset Management", skill: "Implantação" },

    // Knowledge
    { name: "Knowledge: Central de ajuda básica", hours: 5.0, category: "Zendesk Knowledge", skill: "Implantação" },
    { name: "Knowledge: Central de ajuda intermediária", hours: 50.0, category: "Zendesk Knowledge", skill: "Desenvolvimento" },
    { name: "Knowledge: Central de ajuda completa", hours: 80.0, category: "Zendesk Knowledge", skill: "Desenvolvimento" },
    { name: "Knowledge: Configuração completa Community", hours: 1.0, category: "Zendesk Knowledge", skill: "Implantação" },

    // Analytics
    { name: "Analytics: Configuração básica", hours: 2.0, category: "Zendesk Analytics", skill: "Implantação" },
    { name: "Analytics: Relatórios personalizados (cada)", hours: 1.0, category: "Zendesk Analytics", skill: "Implantação" },
    { name: "Analytics: Painéis personalizados (cada)", hours: 1.0, category: "Zendesk Analytics", skill: "Implantação" },

    // Copilot
    { name: "Copilot: Configuração básica", hours: 0.37, category: "Zendesk Copilot", skill: "Solution Design" },
    { name: "Copilot: Intenções personalizadas (cada)", hours: 0.12, category: "Zendesk Copilot", skill: "Solution Design" },
    { name: "Copilot: Entidades (cada)", hours: 0.25, category: "Zendesk Copilot", skill: "Solution Design" },
    { name: "Copilot: Procedimentos (cada)", hours: 0.75, category: "Zendesk Copilot", skill: "Solution Design" },

    // WFM
    { name: "WFM: Configurações gerais", hours: 0.35, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Painéis (Dashboards) (cada)", hours: 1.0, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Relatórios (cada)", hours: 1.0, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Painéis de desempenho (Performance Boards)", hours: 0.75, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Cenários de previsão (forecast scenarios)", hours: 0.75, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Regras de aprovação automática folgas", hours: 0.5, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Localizações (cada)", hours: 0.42, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Turnos (cada)", hours: 1.0, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Grupos de trabalho (workstreams) (cada)", hours: 0.33, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Equipes (cada)", hours: 0.33, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Motivos de folga (cada)", hours: 0.17, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Tarefas gerais (cada)", hours: 0.17, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Automações (cada)", hours: 0.5, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: Funções (cada)", hours: 0.33, category: "Zendesk WFM", skill: "Implantação" },
    { name: "WFM: URLs externas monitoradas (cada)", hours: 0.25, category: "Zendesk WFM", skill: "Implantação" },

    // QA
    { name: "QA: Configurações gerais", hours: 1.12, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Filtros (cada)", hours: 0.5, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Quizzes (cada)", hours: 0.5, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Conexão para notificações Slack", hours: 1.0, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Tabelas de desempenho (Scorecards) (cada)", hours: 1.0, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Categorias manuais (cada)", hours: 0.12, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Categorias de IA (cada)", hours: 0.5, category: "Zendesk QA", skill: "Solution Design" },
    { name: "QA: Destaques de IA (Insights) (cada)", hours: 0.75, category: "Zendesk QA", skill: "Solution Design" },
    { name: "QA: Usuários (total de licenças full) (cada)", hours: 0.05, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Grupos (cada)", hours: 0.08, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Bots (cada)", hours: 0.08, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Espaço de trabalho (cada)", hours: 0.25, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Criação de hashtags (cada)", hours: 0.03, category: "Zendesk QA", skill: "Implantação" },
    { name: "QA: Atribuições (cada)", hours: 0.5, category: "Zendesk QA", skill: "Implantação" },

    // AI Agents Advanced
    { name: "AI Advanced: Configurações básicas", hours: 1.88, category: "AI Agents Advanced", skill: "Solution Design" },
    { name: "AI Advanced: Procedures (cada)", hours: 1.0, category: "AI Agents Advanced", skill: "Solution Design" },
    { name: "AI Advanced: Dialogues simples (cada)", hours: 1.0, category: "AI Agents Advanced", skill: "Solution Design" },
    { name: "AI Advanced: Dialogues intermediários (cada)", hours: 3.0, category: "AI Agents Advanced", skill: "Solution Design" },
    { name: "AI Advanced: Dialogues complexos (cada)", hours: 5.0, category: "AI Agents Advanced", skill: "Solution Design" },
    { name: "AI Advanced: Segments (cada)", hours: 0.42, category: "AI Agents Advanced", skill: "Solution Design" },
    { name: "AI Advanced: Knowledge Sources (Zendesk) (cada)", hours: 0.17, category: "AI Agents Advanced", skill: "Implantação" },
    { name: "AI Advanced: Knowledge Sources (Outras) (cada)", hours: 1.0, category: "AI Agents Advanced", skill: "Implantação" },
    { name: "AI Advanced: Regras de busca (cada)", hours: 0.33, category: "AI Agents Advanced", skill: "Solution Design" },
    { name: "AI Advanced: Actions (cada)", hours: 0.5, category: "AI Agents Advanced", skill: "Desenvolvimento" },
    { name: "AI Advanced: Entities (cada)", hours: 0.33, category: "AI Agents Advanced", skill: "Solution Design" },
    { name: "AI Advanced: Horários de operação (cada)", hours: 0.17, category: "AI Agents Advanced", skill: "Implantação" },
    { name: "AI Advanced: Instructions (cada)", hours: 0.33, category: "AI Agents Advanced", skill: "Solution Design" },
    { name: "AI Advanced: Forms Templates (cada)", hours: 0.5, category: "AI Agents Advanced", skill: "Design" },
    { name: "AI Advanced: Webview Templates (cada)", hours: 1.0, category: "AI Agents Advanced", skill: "Design" },
    { name: "AI Advanced: Custom JSON Templates (validar dev)", hours: 8.0, category: "AI Agents Advanced", skill: "Desenvolvimento" },
    { name: "AI Advanced: API integration (por endpoint)", hours: 3.5, category: "AI Agents Advanced", skill: "Desenvolvimento" },
    { name: "AI Advanced: Conectar CRM personalizado", hours: 5.0, category: "AI Agents Advanced", skill: "Desenvolvimento" },

    // ADPP
    { name: "ADPP: Configuração geral", hours: 1.5, category: "Advanced Data Privacy", skill: "Implantação" },
    { name: "ADPP: Programações de exclusão (cada)", hours: 0.5, category: "Advanced Data Privacy", skill: "Implantação" },
    { name: "ADPP: Gatilhos para supressão automática", hours: 0.08, category: "Advanced Data Privacy", skill: "Implantação" },

    // Treinamentos Admin
    { name: "Treinamento Admin: Support (incl. AI Essential)", hours: 6.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: Knowledge", hours: 1.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: Community", hours: 1.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: Voice", hours: 1.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: Analytics básico", hours: 3.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: Analytics completo", hours: 8.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: Copilot", hours: 2.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: WFM", hours: 3.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: QA", hours: 3.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: AI Agents Advanced", hours: 4.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: Droz", hours: 6.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: CallWe", hours: 5.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: App Condicionais Avançadas", hours: 2.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Admin: App Ticket Manager", hours: 2.0, category: "Treinamentos", skill: "Solution Design" },

    // Treinamentos Agente
    { name: "Treinamento Agente: Support", hours: 6.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Agente: Knowledge", hours: 0.5, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Agente: Community", hours: 0.5, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Agente: Voice", hours: 1.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Agente: Copilot", hours: 2.0, category: "Treinamentos", skill: "Solution Design" },
    { name: "Treinamento Agente: CallWe", hours: 3.0, category: "Treinamentos", skill: "Solution Design" },

    // DROZ
    { name: "DROZ: Configurações gerais", hours: 0.5, category: "DROZ", skill: "Implantação" },
    { name: "DROZ: Total de Fluxos + subfluxos (cada)", hours: 0.75, category: "DROZ", skill: "Implantação" },
    { name: "DROZ: Fluxos acessíveis por NLP (cada)", hours: 0.75, category: "DROZ", skill: "Implantação" },
    { name: "DROZ: Template para WhatsApp (cada)", hours: 0.75, category: "DROZ", skill: "Implantação" },
    { name: "DROZ: Integração Zendesk", hours: 1.0, category: "DROZ", skill: "Implantação" },
    { name: "DROZ: Integração Salesforce", hours: 5.0, category: "DROZ", skill: "Desenvolvimento" },
    { name: "DROZ: Droz AI + Base", hours: 2.0, category: "DROZ", skill: "Implantação" },
    { name: "DROZ: Droz Chat", hours: 2.0, category: "DROZ", skill: "Implantação" },
    { name: "DROZ: Salesforce Chat (Web)", hours: 5.0, category: "DROZ", skill: "Desenvolvimento" },
    { name: "DROZ: Movidesk Chat (Web)", hours: 5.0, category: "DROZ", skill: "Desenvolvimento" },
    { name: "DROZ: Neoassist Chat (Web)", hours: 5.0, category: "DROZ", skill: "Desenvolvimento" },
    { name: "DROZ: Conectores personalizados (cada)", hours: 2.0, category: "DROZ", skill: "Desenvolvimento" },
    { name: "DROZ: Testes de Endpoint Postman (cada)", hours: 1.5, category: "DROZ", skill: "Desenvolvimento" },
    { name: "DROZ: Personalização visual Widget (Web)", hours: 0.5, category: "DROZ", skill: "Design" },
    { name: "DROZ: Componente Javascript (cada)", hours: 1.0, category: "DROZ", skill: "Desenvolvimento" },
    { name: "DROZ: Componente Ações de IA (cada)", hours: 1.0, category: "DROZ", skill: "Solution Design" },

    // CallWe
    { name: "CallWe: Configurações gerais", hours: 0.25, category: "CallWe", skill: "Implantação" },
  ]

  console.log('Iniciando limpeza da biblioteca antiga...')
  // Opcional: deletar pacotes antigos que não estão na nova lista se quiser uma limpeza total
  // await prisma.package.deleteMany({}) 

  console.log('Upserting novos pacotes...')
  for (const pkg of packages) {
    await prisma.package.upsert({
      where: { name: pkg.name },
      update: { 
        hours: pkg.hours, 
        category: pkg.category, 
        skill: pkg.skill 
      },
      create: {
        ...pkg,
        isActive: true
      }
    })
  }

  // Adicionar variáveis globais se não existirem
  const globalVars = [
    { key: "GP_PERCENTAGE", value: "0.15", category: "Global" },
    { key: "AE_GP_PERCENTAGE", value: "0.15", category: "AE" },
    { key: "CLONE_DISCOUNT", value: "0.30", category: "Global" }
  ]

  for (const v of globalVars) {
    await prisma.variable.upsert({
      where: { key: v.key },
      update: { value: v.value, category: v.category },
      create: {
        ...v,
        isActive: true
      }
    })
  }

  console.log('Biblioteca de pacotes e variáveis globais atualizadas com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
