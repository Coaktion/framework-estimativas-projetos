# PRE-SALES.AI | Smart Scoping Framework

Framework para o time de pré-vendas (SC e AE), focado em padronização de escopo e estimativa de esforço técnico.

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
| Autenticação | NextAuth.js v4 — Credentials Provider + JWT |
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

Para alterar essas variáveis: **Netlify Dashboard → Site → Site configuration → Environment variables**. Após alterar, é necessário fazer um novo deploy.

---

## Estrutura de Acesso (RBAC)

| Perfil | Acesso |
|--------|--------|
| `AE` | Calculadora de viabilidade e histórico pessoal |
| `SC` | Projetos técnicos, checklists de escopo e calculadora |
| `ADMIN` | Tudo acima + gestão de usuários, pacotes e variáveis globais |

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

# Criar as tabelas no banco
npx prisma db push

# Popular com pacotes e usuários padrão
npx prisma db seed
```

### 4. Rodar

```bash
npm run dev
```

Acesse em `http://localhost:3000`.

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

Se o schema do Prisma for alterado, após o push para `main` é necessário rodar as migrações apontando para o banco de produção:

```bash
# Com DATABASE_URL do Neon no .env.local
npx prisma db push
```

Ou, se estiver usando migrations formais:

```bash
npx prisma migrate deploy
```

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
