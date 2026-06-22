import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed...')

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

  const packagesData = [
    // Zendesk Support
    { name: "Support: Configurações gerais (Config Base)", hours: 1.3, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Configurações de Segurança (Auth, 2FA, IP)", hours: 0.25, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Aparência (cor, nome, favicon)", hours: 0.05, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Localização (fuso, idioma)", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Eventos de perfil de usuário", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Configuração de usuários finais", hours: 0.17, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Customização do Cartão de usuário", hours: 0.17, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Interface do agente", hours: 0.17, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Painel de Contexto", hours: 0.17, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Configuração de conversas paralelas", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Solicitações de aprovação (approvals)", hours: 0.02, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Configurações de ticket", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Criação de chaves API", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Single Sign-On (SAML / JWT / OpenID)", hours: 3.0, categoryName: "Zendesk Support", skillName: "Desenvolvimento" },
    { name: "Support: Programações de exclusão de dados (cada)", hours: 0.5, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Marcas (por marca)", hours: 0.25, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Membros de equipe / Agentes Light (por agente)", hours: 0.03, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Funções (por função)", hours: 0.33, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Grupos (por grupo)", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Campos do usuário (por campo)", hours: 0.07, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Campos da organização (por campo)", hours: 0.07, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Importação de usuários (por arquivo)", hours: 0.25, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Importação de organizações (por arquivo)", hours: 0.25, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: IPs a serem banidos (por IP)", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },

    // Canais - Ticket
    { name: "Ticket: Email (por endereço)", hours: 0.33, categoryName: "Canais - Ticket", skillName: "Implantação" },
    { name: "Ticket: Template HTML (por marca)", hours: 1.0, categoryName: "Canais - Ticket", skillName: "Design" },
    { name: "Ticket: Formulários/Catálogos (por form)", hours: 0.5, categoryName: "Canais - Ticket", skillName: "Implantação" },
    { name: "Ticket: Condicionais (por condição)", hours: 0.03, categoryName: "Canais - Ticket", skillName: "Implantação" },
    { name: "Ticket: Facebook Page (Timeline)", hours: 1.0, categoryName: "Canais - Ticket", skillName: "Implantação" },
    { name: "Ticket: X (Mensagens Públicas)", hours: 1.0, categoryName: "Canais - Ticket", skillName: "Implantação" },
    { name: "Ticket: Microsoft Teams integration", hours: 1.0, categoryName: "Canais - Ticket", skillName: "Implantação" },

    // Canais - Messaging
    { name: "Messaging: Web Widget (por widget)", hours: 0.42, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Facebook Messenger (por página)", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Instagram Direct (por página)", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Android SDK", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Desenvolvimento" },
    { name: "Messaging: iOS SDK", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Desenvolvimento" },
    { name: "Messaging: Unity SDK", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Desenvolvimento" },
    { name: "Messaging: LINE", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Apple Messages for Business", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Slack", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: X Corp DM (por página)", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: WeChat", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Google RCS", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Google Business Messages", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: KakaoTalk", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Telegram", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Text/SMS (por número)", hours: 0.17, categoryName: "Canais - Messaging", skillName: "Implantação" },

    // Voz
    { name: "Voz: Outra integração via marketplace", hours: 3.0, categoryName: "Canais - Voz", skillName: "Desenvolvimento" },
    { name: "Voz: Configurações gerais (Fila, Espera)", hours: 0.25, categoryName: "Canais - Voz", skillName: "Implantação" },
    { name: "Voz: Linhas / Números", hours: 0.08, categoryName: "Canais - Voz", skillName: "Implantação" },
    { name: "Voz: Saudações", hours: 0.12, categoryName: "Canais - Voz", skillName: "Implantação" },
    { name: "Voz: Números bloqueados", hours: 0.03, categoryName: "Canais - Voz", skillName: "Implantação" },
    { name: "Voz: IVR (Menus e Níveis)", hours: 0.59, categoryName: "Canais - Voz", skillName: "Implantação" },

    // AI Agents Essential
    { name: "AI Essential: Instruções (cada)", hours: 0.38, categoryName: "AI Agents Essential", skillName: "Solution Design" },
    { name: "AI Essential: Visualizações (cada)", hours: 0.38, categoryName: "AI Agents Essential", skillName: "Solution Design" },

    // Produtividade & Objetos
    { name: "Macros (cada)", hours: 0.25, categoryName: "Produtividade", skillName: "Implantação" },
    { name: "Conteúdo dinâmico (cada)", hours: 0.08, categoryName: "Produtividade", skillName: "Implantação" },
    { name: "Disposições (Layouts) (cada)", hours: 0.5, categoryName: "Produtividade", skillName: "Implantação" },
    { name: "Espaço de trabalho contextual (cada)", hours: 0.5, categoryName: "Produtividade", skillName: "Implantação" },
    { name: "Tarefas (Tasks) (cada)", hours: 0.5, categoryName: "Produtividade", skillName: "Implantação" },

    // Automação
    { name: "Gatilho Simples (Sem Webhook)", hours: 0.08, categoryName: "Automação", skillName: "Implantação" },
    { name: "Gatilho Complexo / Mensagens", hours: 0.33, categoryName: "Automação", skillName: "Implantação" },
    { name: "Webhook: Endpoint Instância", hours: 1.0, categoryName: "Automação", skillName: "Desenvolvimento" },
    { name: "Webhook: Endpoint Externo", hours: 2.0, categoryName: "Automação", skillName: "Desenvolvimento" },
    { name: "Metas de mensagens (messaging goals)", hours: 0.67, categoryName: "Automação", skillName: "Solution Design" },
    { name: "Automações (cada)", hours: 0.25, categoryName: "Automação", skillName: "Implantação" },
    { name: "Habilidades (cada)", hours: 0.17, categoryName: "Automação", skillName: "Implantação" },
    { name: "Políticas de SLA (cada)", hours: 0.25, categoryName: "Automação", skillName: "Implantação" },
    { name: "Programação e feriados (cada)", hours: 0.25, categoryName: "Automação", skillName: "Implantação" },
    { name: "Pesquisa de satisfação (CSAT)", hours: 0.5, categoryName: "Automação", skillName: "Implantação" },

    // Apps AktieNow
    { name: "App AktieNow: Condicionais Avançadas (Regra)", hours: 0.33, categoryName: "Aplicativos AktieNow", skillName: "Implantação" },
    { name: "App AktieNow: Ticket Manager (Modelo .csv)", hours: 1.0, categoryName: "Aplicativos AktieNow", skillName: "Implantação" },

    // Marketplace & Builder
    { name: "App Marketplace (Lista Infinita)", hours: 5.0, categoryName: "Marketplace", skillName: "Implantação" },
    { name: "App Builder: Sem conexão API externa", hours: 2.0, categoryName: "Marketplace", skillName: "Desenvolvimento" },
    { name: "App Builder: Com conexão API externa", hours: 10.0, categoryName: "Marketplace", skillName: "Desenvolvimento" },

    // Integrações Nativas
    { name: "Integração Nativa: Salesforce", hours: 2.0, categoryName: "Integrações Nativas", skillName: "Implantação" },
    { name: "Integração Nativa: Shopify", hours: 2.0, categoryName: "Integrações Nativas", skillName: "Implantação" },
    { name: "Integração Nativa: Slack", hours: 2.0, categoryName: "Integrações Nativas", skillName: "Implantação" },
    { name: "Integração Nativa: Workday", hours: 2.0, categoryName: "Integrações Nativas", skillName: "Implantação" },
    { name: "Integração Nativa: Google Agenda", hours: 2.0, categoryName: "Integrações Nativas", skillName: "Implantação" },
    { name: "Integração Nativa: Jira", hours: 2.0, categoryName: "Integrações Nativas", skillName: "Implantação" },
    { name: "Integração Nativa: Microsoft 365 Copilot", hours: 2.0, categoryName: "Integrações Nativas", skillName: "Implantação" },

    // Asset Management
    { name: "Asset: Ativar sincronização nativa (Intune/Jamf)", hours: 1.0, categoryName: "Asset Management", skillName: "Desenvolvimento" },
    { name: "Asset: Tipos de ativo (cada)", hours: 0.05, categoryName: "Asset Management", skillName: "Implantação" },
    { name: "Asset: Locais (cada)", hours: 0.05, categoryName: "Asset Management", skillName: "Implantação" },
    { name: "Asset: Campos (cada)", hours: 0.07, categoryName: "Asset Management", skillName: "Implantação" },
    { name: "Asset: Registros (records) (cada)", hours: 0.42, categoryName: "Asset Management", skillName: "Implantação" },
    { name: "Asset: Importação por .csv (por arquivo)", hours: 1.0, categoryName: "Asset Management", skillName: "Implantação" },

    // Knowledge
    { name: "Knowledge: Central de ajuda básica", hours: 5.0, categoryName: "Zendesk Knowledge", skillName: "Implantação" },
    { name: "Knowledge: Central de ajuda intermediária", hours: 50.0, categoryName: "Zendesk Knowledge", skillName: "Desenvolvimento" },
    { name: "Knowledge: Central de ajuda completa", hours: 80.0, categoryName: "Zendesk Knowledge", skillName: "Desenvolvimento" },

    // Analytics
    { name: "Analytics: Configuração básica", hours: 2.0, categoryName: "Zendesk Analytics", skillName: "Implantação" },
    { name: "Analytics: Relatórios personalizados (cada)", hours: 1.0, categoryName: "Zendesk Analytics", skillName: "Implantação" },
    { name: "Analytics: Painéis personalizados (cada)", hours: 1.0, categoryName: "Zendesk Analytics", skillName: "Implantação" },

    // Copilot
    { name: "Copilot: Configuração básica", hours: 0.37, categoryName: "Zendesk Copilot", skillName: "Solution Design" },
    { name: "Copilot: Intenções personalizadas (cada)", hours: 0.12, categoryName: "Zendesk Copilot", skillName: "Solution Design" },
    { name: "Copilot: Entidades (cada)", hours: 0.25, categoryName: "Zendesk Copilot", skillName: "Solution Design" },
    { name: "Copilot: Procedimentos (cada)", hours: 0.75, categoryName: "Zendesk Copilot", skillName: "Solution Design" },

    // WFM
    { name: "WFM: Configurações gerais", hours: 0.35, categoryName: "Zendesk WFM", skillName: "Implantação" },
    { name: "WFM: Painéis (Dashboards) (cada)", hours: 1.0, categoryName: "Zendesk WFM", skillName: "Implantação" },
    { name: "WFM: Relatórios (cada)", hours: 1.0, categoryName: "Zendesk WFM", skillName: "Implantação" },

    // QA
    { name: "QA: Configurações gerais", hours: 1.12, categoryName: "Zendesk QA", skillName: "Implantação" },
    { name: "QA: Filtros (cada)", hours: 0.5, categoryName: "Zendesk QA", skillName: "Implantação" },
    { name: "QA: Quizzes (cada)", hours: 0.5, categoryName: "Zendesk QA", skillName: "Implantação" },

    // AI Agents Advanced
    { name: "AI Advanced: Configurações básicas", hours: 1.88, categoryName: "AI Agents Advanced", skillName: "Solution Design" },
    { name: "AI Advanced: Procedures (cada)", hours: 1.0, categoryName: "AI Agents Advanced", skillName: "Solution Design" },

    // DROZ
    { name: "DROZ: Configurações gerais", hours: 0.5, categoryName: "DROZ", skillName: "Implantação" },
    { name: "DROZ: Total de Fluxos + subfluxos (cada)", hours: 0.75, categoryName: "DROZ", skillName: "Implantação" },

    // CallWe
    { name: "CallWe: Configurações gerais", hours: 0.25, categoryName: "CallWe", skillName: "Implantação" },
  ]

  // 1. Extract and Upsert Categories
  const uniqueCategories = Array.from(new Set(packagesData.map(p => p.categoryName)))
  console.log(`Upserting ${uniqueCategories.length} categories...`)
  for (const catName of uniqueCategories) {
    await prisma.category.upsert({
      where: { name: catName },
      update: { isActive: true },
      create: { name: catName, isActive: true }
    })
  }

  // 2. Extract and Upsert Skills
  const uniqueSkills = Array.from(new Set(packagesData.map(p => p.skillName)))
  console.log(`Upserting ${uniqueSkills.length} skills...`)
  for (const skillName of uniqueSkills) {
    await prisma.skill.upsert({
      where: { name: skillName },
      update: { isActive: true },
      create: { name: skillName, isActive: true }
    })
  }

  // 3. Upsert Packages
  console.log(`Upserting ${packagesData.length} packages...`)
  for (const pkg of packagesData) {
    await prisma.package.upsert({
      where: { name: pkg.name },
      update: { 
        hours: pkg.hours, 
        categoryName: pkg.categoryName, 
        skillName: pkg.skillName 
      },
      create: {
        ...pkg,
        isActive: true
      }
    })
  }

  // 4. Upsert Global Variables
  const globalVars = [
    { key: "GP_PERCENTAGE", value: "0.15", category: "Global" },
    { key: "AE_GP_PERCENTAGE", value: "0.15", category: "AE" },
    { key: "CLONE_DISCOUNT", value: "0.30", category: "Global" },
    { key: "GP_STANDARD", value: "25", type: "PERCENT", category: "Global" },
    { key: "DISCOVERY_STANDARD", value: "0", type: "PERCENT", category: "Global" },
    { key: "VALIDATION_STANDARD", value: "0", type: "PERCENT", category: "Global" }
  ]

  console.log(`Upserting ${globalVars.length} global variables...`)
  for (const v of globalVars) {
    await prisma.variable.upsert({
      where: { key: v.key },
      update: { 
        value: v.value, 
        category: v.category,
        type: v.type || "PERCENT"
      },
      create: {
        ...v,
        isActive: true
      }
    })
  }

  console.log('Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
