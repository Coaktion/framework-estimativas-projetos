# PRE-SALES.AI | Smart Scoping Framework
Última atualização: 03/11/2026

Framework para o time de pré-vendas, focado em padronização de escopo e estimativa de esforço técnico.

Módulos:

- **Projetos / Escopo** (`/sc`) — projetos técnicos com versões e estimativa de horas pelo framework.
- **Calculadora AE** (`/ae`) — estimativa rápida de viabilidade e histórico.
- **ZD Auto Config** (`/zd-auto-config`) — provisionador de ambientes de demonstração Zendesk.
- **Pre-Sales Ops** (`/pre-sales-ops`) — monitoramento das novidades do Zendesk e backlog dos ativos de pré-venda (detalhes em `lib/psops/README.md`).
- **Agendamento** (`/booking`) — agenda dos SEs integrada ao Google Calendar.
- **Pastas de Cliente** (`/folders`) — cria a estrutura padrão do cliente no Google Drive (Apps Script em `scripts/apps-script/`).
- **Tool Center / MCP** (`/api/mcp`) — acesso às estimativas por clientes MCP com chave de API (gerada no Perfil).
- **Admin** (`/admin`) — usuários, biblioteca de pacotes, variáveis, configuração da Calculadora AE e Zoho CRM.

---

## Stack Técnica

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 14 (App Router) |
| Estilização | Tailwind CSS + SCSS |
| Ícones | Lucide React |
| ORM | Prisma 5 |
| Banco (produção) | PostgreSQL via Neon |
| Banco (local) | Na máquina do dev ou outra conta no Neon |
| Autenticação | NextAuth.js v4 — Google (SSO @aktienow.com) + e-mail/senha, sessão JWT |
| Deploy | Netlify (com `@netlify/plugin-nextjs`) |
| i18n | i18next |

---

## Infraestrutura de Produção

### Banco de Dados — Neon

O banco de dados é um **PostgreSQL serverless** hospedado no [Neon](https://neon.tech), plano gratuito.

- Acesso: console em `console.neon.tech`
- Projeto: configurado na conta vinculada ao deploy
- A `DATABASE_URL` fica nas variáveis de ambiente do Netlify (não está no repositório)
- O schema é gerenciado via Prisma (`prisma/schema.prisma`)
- Para inspecionar o banco localmente: `npx prisma studio` (com `.env.local` configurado)

### Deploy — Netlify

O app roda no [Netlify](https://netlify.com) usando o plugin oficial do Next.js.

- Arquivo de configuração: `netlify.toml` na raiz do repositório
- O deploy é **automático**: todo push na branch `main` dispara um novo build
- Build command: `npm run build`
- Publish directory: `.next`
- O plugin `@netlify/plugin-nextjs` habilita SSR, Server Actions e API Routes no Netlify

**Variáveis de ambiente configuradas no Netlify:**

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | String de conexão PostgreSQL do Neon |
| `NEXTAUTH_SECRET` | Secret para assinar tokens JWT da sessão |
| `NEXTAUTH_URL` | URL pública do site no Netlify |
| demais | Segredos de cada módulo (ZD Auto Config, Pre-Sales Ops, Agendamento, Zoho, Pastas) — lista comentada no `.env.example` |

Para alterar essas variáveis: **Netlify Dashboard → Site → Site configuration → Environment variables**. Após alterar, é necessário fazer um novo deploy.

---

## Estrutura de Acesso (RBAC)

Cada usuário tem **um segmento** (coluna `User.role`). A matriz completa fica em `lib/segments.ts`, que é o único lugar que decide o acesso.

| Segmento | Escopo | Calc. AE | ZD Auto Config / Pre-Sales Ops / Agendamento | Pastas | Admin |
|----------|:------:|:--------:|:--------------------------------------------:|:------:|:-----:|
| `ADMIN` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `SC` | ✔ | ✔ | ✔ | ✔ | |
| `SD`, `PM`, `SALES_OPS`, `CS` | ✔ | ✔ | | | |
| `AE` | | ✔ | | ✔ | |
| `IMPL`, `DEV` | ✔ | | | | |

### Login

- **Google (SSO)** — só contas `@aktienow.com` do Google Workspace, e o e-mail precisa estar cadastrado (o admin cria o usuário). O Google só autentica: o segmento continua vindo do banco. Configuração em `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (ver `.env.example`).
- **E-mail e senha** — continua disponível. Usuário criado sem senha entra só pelo Google.

Projetos privados só são vistos pelo dono e por admins. Em projetos públicos, qualquer usuário de Escopo pode abrir e salvar versões, mas só o dono ou um admin renomeia ou exclui.

---

## Rodando Localmente

### 1. Pré-requisitos

- Node.js 18+
- Conta no [Neon](https://neon.tech) com um projeto criado

### 2. Variáveis de ambiente

Crie um arquivo `.env.local` na raiz (não é commitado):

```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
NEXTAUTH_SECRET="qualquer-string-aleatoria"
NEXTAUTH_URL="http://localhost:3000"
```

A `DATABASE_URL` é obtida no console do Neon: **Dashboard → projeto → Connection string**.

### 3. Instalar e configurar

```bash
npm install

# Criar as tabelas no banco (aplica as migrations de prisma/migrations)
npx prisma migrate deploy

# Popular com pacotes, variáveis e o admin inicial
npx prisma db seed
```

O seed só cria o admin se a base ainda não tiver nenhum, e nunca altera a senha de usuários existentes. Defina `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD`; sem a senha, ela é gerada e mostrada uma vez no console. As demais variáveis (Agendamento, ZD Auto Config, Pre-Sales Ops, Zoho, Pastas) estão documentadas no `.env.example`.

### 4. Rodar

```bash
npm run dev
```

Acesse em `http://localhost:3000`.

### 5. Testes

```bash
npm test   # testes do Pre-Sales Ops (test runner do Node)
```

## Schema do banco

O schema completo está em `prisma/schema.prisma`. Principais modelos:

- `User` — usuários com perfil e senha
- `Package` — biblioteca de pacotes de implantação com horas estimadas
- `Variable` — variáveis globais de cálculo (ex: percentual de GP)
- `Project` / `ProjectVersion` — projetos técnicos e suas versões
- `AEEstimate` — histórico de estimativas feitas pelos AEs
- `FrameworkVersion` — snapshots versionados do framework

Para visualizar o banco graficamente:

```bash
npx prisma studio
```

---

## Atualizar o schema em produção

O schema é versionado em migrations (`prisma/migrations`). Para mudar o banco:

```bash
# cria a migration a partir da mudança no schema.prisma (banco local)
npm run db:migrate
```

Commite a pasta da migration junto com o código. No deploy, o `npm run build` roda `prisma migrate deploy` e aplica as migrations pendentes no banco de produção. Não use `prisma db push` em produção: ele altera o banco sem registrar a migration.

---

### 📐 Princípios de Design
- **DRY (Don't Repeat Yourself)**: Lógica de cálculo e componentes de UI centralizados para evitar duplicidade.
- **YAGNI (You Ain't Gonna Need It)**: Implementação focada nas funcionalidades reais do time de pré-vendas, sem over-engineering.
- **SOLID (S e D)**:
  - **Single Responsibility Principle (S)**: Componentes e Server Actions com responsabilidades únicas e bem definidas.
  - **Dependency Inversion Principle (D)**: Uso de abstrações para acesso a dados (Prisma Client) e serviços de autenticação.
- **Clean Code**: Nomenclatura semântica, funções pequenas e código autoexplicativo.

---

### 🔧 Qualidade de Código
- **Linting & Formatting**: ESLint + Prettier configurados para manter a consistência do código.
- **Conventional Commits**: Padrão de mensagens de commit para histórico semântico e legível.
- **Metodologia**: Escrita de código baseada em Clean Code e componentização atômica.

---

*Desenvolvido para o time Aktie Now.*
