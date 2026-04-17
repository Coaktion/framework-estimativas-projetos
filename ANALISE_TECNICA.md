# Análise Técnica — PRE-SALES.AI Framework

**Data:** 2026-04-17  
**Versão analisada:** branch `main` (acc814b)  
**Stack:** Next.js 14 · Prisma · NextAuth.js · SQLite/PostgreSQL · TypeScript · Tailwind CSS

---

## 1. Riscos de Segurança

### CRÍTICO

#### 1.1 Enumeração de usuários via mensagens de erro distintas
**Arquivo:** `lib/auth.ts:26-28`

```ts
// PROBLEMA: erro diferente para "usuário não existe" vs "senha errada"
if (!user || !user.password) {
  throw new Error("Usuário não encontrado ou senha não definida"); // ← revela se o email existe
}
if (!isValid) {
  throw new Error("Senha incorreta"); // ← revela que o email existe
}
```

**Risco:** Um atacante pode enumerar quais e-mails estão cadastrados testando mensagens de erro.  
**Correção:** Retornar sempre `"Credenciais inválidas"` independente do motivo.

---

#### 1.2 Ausência de rate limiting no login
**Arquivo:** `app/api/auth/[...nextauth]/route.ts`

Não há proteção contra brute force na rota de credenciais. Um atacante pode tentar senhas ilimitadas sem bloqueio.  
**Correção:** Adicionar middleware de rate limiting (ex.: `@upstash/ratelimit` + Redis, ou `next-rate-limit`) na rota `/api/auth/signin`.

---

#### 1.3 Senha fraca no seed de produção
**Arquivo:** `prisma/seed.ts:9`

```ts
const hashedDev = await bcrypt.hash('dev', 10) // senha de 3 caracteres
// admin@aktienow.com / dev → isAdmin: true
```

O seed cria um admin com senha `dev`. Se executado em produção (comum em CI/CD), abre acesso total ao painel admin.  
**Correção:** Remover credenciais do seed; usar variáveis de ambiente ou script separado de provisionamento.

---

### ALTO

#### 1.4 Falta de verificação de propriedade ao salvar versão de projeto
**Arquivo:** `app/sc/project/[id]/actions.ts:9-44`

```ts
export async function saveProjectVersionAction(projectId: number, formData: any) {
  // Só verifica role SC/ADMIN — qualquer SC pode escrever em QUALQUER projeto
  if (!session?.user || (session.user.role !== 'SC' && session.user.role !== 'ADMIN')) {
    throw new Error("Não autorizado");
  }
  // Não verifica se o usuário tem acesso ao projectId informado
  await prisma.projectVersion.create({ data: { projectId, ... } });
}
```

**Risco:** Um SC pode criar versões em projetos de outros usuários (inclusive projetos privados) alterando o `projectId` na requisição.  
**Correção:** Verificar que o projeto pertence ao usuário antes de salvar.

```ts
const project = await prisma.project.findFirst({
  where: { id: projectId, OR: [{ ownerId: userId }, { isPrivate: false }] }
});
if (!project) throw new Error("Projeto não encontrado ou sem permissão");
```

---

#### 1.5 Falta de verificação de propriedade ao deletar projeto
**Arquivo:** `app/sc/actions.ts:30-49`

```ts
export async function deleteProjectAction(projectId: number) {
  // Qualquer SC pode deletar qualquer projeto
  if (session.user.role !== 'SC' && session.user.role !== 'ADMIN') throw ...
  await prisma.project.delete({ where: { id: projectId } });
}
```

**Risco:** SC pode deletar projetos de outros usuários.  
**Correção:** Adicionar `ownerId: userId` no filtro do `delete`, ou verificar propriedade explicitamente.

---

#### 1.6 Criação de projeto sem verificação de role
**Arquivo:** `app/sc/actions.ts:9-28`

```ts
export async function createProjectAction(formData: FormData) {
  if (!session?.user?.id) throw new Error("Não autorizado"); // ← só verifica autenticação
  // Qualquer usuário autenticado (inclusive AE) pode criar projetos SC
}
```

**Risco:** Usuários com role `AE` ou `USER` conseguem criar projetos SC contornando as restrições de rota.  
**Correção:** Adicionar verificação de role igual a `createProjectAction` do SC:

```ts
if (session.user.role !== 'SC' && session.user.role !== 'ADMIN') throw new Error("Não autorizado");
```

---

#### 1.7 createFrameworkSnapshotAction autoriza qualquer usuário autenticado
**Arquivo:** `app/admin/actions.ts:8-10`

```ts
export async function createFrameworkSnapshotAction(...) {
  if (!session?.user?.id) throw new Error("Não autorizado"); // ← sem verificação isAdmin
}
```

Enquanto `restoreFrameworkSnapshotAction` exige `isAdmin`, a criação de snapshot não. Qualquer usuário logado pode criar snapshots do framework (incluindo dados internos).  
**Correção:** Adicionar `!session.user.isAdmin` na guarda da função.

---

#### 1.8 Role aceita qualquer string sem validação
**Arquivo:** `app/admin/actions.ts:72-80`

```ts
export async function updateUserRoleAction(userId: number, role: string) {
  await prisma.user.update({ where: { id: userId }, data: { role } });
}
```

**Risco:** Um admin pode definir roles arbitrárias (ex.: `"SUPERADMIN"`, `"*"`) que podem causar comportamento inesperado.  
**Correção:** Validar contra os valores do enum Prisma antes de persistir.

```ts
const VALID_ROLES = ['AE', 'SC', 'DEV', 'CONSULTING', 'USER', 'ADMIN'];
if (!VALID_ROLES.includes(role)) throw new Error("Role inválida");
```

---

### MÉDIO

#### 1.9 Erros internos expostos ao cliente
Todas as `server actions` lançam `throw new Error(...)` com mensagens técnicas que chegam ao cliente via Next.js. Mensagens como `"Source version not found"` ou stack traces podem vazar informações de estrutura interna.  
**Correção:** Implementar um wrapper que loga o erro internamente e retorna mensagem genérica ao usuário.

#### 1.10 Nenhuma validação de input nas server actions
`addPackageAction` não valida que `hours > 0`, que o `link` é uma URL válida, ou que `name` não está vazio. `saveAEEstimateAction` aceita `resultHours` vindo do cliente sem recalcular no servidor.  
**Risco:** Dados corrompidos no banco; possível manipulação de `resultHours` para forçar `needsSC: false`.  
**Correção:** Usar `zod` para validar todos os inputs nas server actions.

#### 1.11 Ausência de arquivo `.env.example`
Não há template das variáveis de ambiente necessárias (`NEXTAUTH_SECRET`, `DATABASE_URL`, `NEXTAUTH_URL`). Novos desenvolvedores podem rodar sem `NEXTAUTH_SECRET`, tornando os JWT previsíveis/inválidos.

---

## 2. Problemas de Performance

### ALTO

#### 2.1 Query ao banco em cada requisição autenticada
**Arquivo:** `lib/auth.ts:48-63`

```ts
async session({ session, token }) {
  // Executa SELECT * FROM User WHERE id = ? em TODA requisição autenticada
  const dbUser = await prisma.user.findUnique({ where: { id: parseInt(token.id) } });
  ...
}
```

Em uma aplicação com múltiplos usuários, isso multiplica o número de queries por todas as páginas abertas simultaneamente.  
**Correção:** Salvar `role` e `isAdmin` no próprio JWT e remover a query da session callback. Só invalidar o token via sign-out quando o admin alterar roles.

```ts
async session({ session, token }) {
  session.user.id = token.id;
  session.user.role = token.role;     // já presente no JWT
  session.user.isAdmin = token.isAdmin;
  return session;
}
```

---

#### 2.2 Seed com N+1 queries sequenciais
**Arquivo:** `prisma/seed.ts:306-319`

```ts
for (const pkg of packages) { // ~100 iterações
  await prisma.package.upsert(...); // 1 query por iteração = 100 queries sequenciais
}
```

**Correção:** Usar `createMany` com `skipDuplicates: true` para inserção em lote. Para o upsert, criar lógica de diff separada.

---

#### 2.3 Restore de snapshot com N queries sequenciais
**Arquivo:** `app/admin/actions.ts:51-58`

```ts
for (const pkg of packages) {
  await prisma.package.create({ data: { ...pkgData, isActive: true } }); // loop sequencial
}
```

**Correção:** Substituir por `prisma.package.createMany({ data: packages })`.

---

### MÉDIO

#### 2.4 Ausência de paginação em todas as listagens
- Lista de projetos SC: busca todos os projetos do usuário sem `take/skip`
- Histórico AE: retorna todos os registros sem limite
- Lista de pacotes no admin: retorna todos os ~100+ pacotes

À medida que o banco cresce, essas queries ficam lentas e a UI carrega dados desnecessários.  
**Correção:** Adicionar `take: 20, skip: offset` e implementar paginação ou infinite scroll.

#### 2.5 Ausência de índices no banco
**Arquivo:** `prisma/schema.prisma`

Campos muito filtrados sem índice explícito:
- `Project.ownerId` — filtrado em toda busca de projetos
- `AEEstimate.createdBy` — filtrado no histórico
- `Package.isActive` + `Package.category` — filtrados em toda listagem de pacotes
- `ProjectVersion.projectId` — filtrado ao carregar versões

**Correção:** Adicionar `@@index` no schema Prisma para esses campos.

#### 2.6 JSON blobs grandes em campos de texto
`ProjectVersion.data` e `AEEstimate.data` armazenam toda a estrutura do formulário como JSON string. Em projetos com muitos pacotes selecionados, esses campos podem ultrapassar dezenas de KB, tornando queries lentas e dificultando consultas parciais.  
**Sugestão de longo prazo:** Normalizar as seleções de pacotes em tabela relacional `ProjectVersionPackage`.

---

## 3. Pontos de Melhoria de Código

### Tipos e Type Safety

#### 3.1 TypeScript strict mode desabilitado
**Arquivo:** `tsconfig.json`

```json
{ "compilerOptions": { "strict": false } }
```

Com strict desabilitado, erros comuns como acesso a propriedades possivelmente `undefined`, `null` não tratado e parâmetros implicitamente `any` não são detectados em build time.  
**Correção:** Habilitar `"strict": true` e corrigir os erros que surgirem.

#### 3.2 Uso de `any` em pontos críticos

```ts
// app/sc/project/[id]/actions.ts:9
async function saveProjectVersionAction(projectId: number, formData: any)

// app/ae/actions.ts:8
async function saveAEEstimateAction(formData: any)

// lib/auth.ts:48,64
async session({ session, token }: any)
async jwt({ token, user }: any)
```

**Correção:** Definir interfaces/tipos para os formData e para os callbacks do NextAuth.

---

### Consistência e Padrões

#### 3.3 Autorização inconsistente entre actions
| Action | Verificação |
|--------|-------------|
| `createProjectAction` | Apenas autenticado |
| `deleteProjectAction` | Role SC/ADMIN |
| `createFrameworkSnapshotAction` | Apenas autenticado |
| `restoreFrameworkSnapshotAction` | isAdmin |
| `addPackageAction` | isAdmin |

Não há um padrão claro. Cada action implementa guarda de forma diferente.  
**Correção:** Criar helpers reutilizáveis:

```ts
async function requireAuth() { ... }
async function requireRole(role: string[]) { ... }
async function requireAdmin() { ... }
```

#### 3.4 Magic numbers nas fórmulas de cálculo
**Arquivo:** `app/ae/AEClient.tsx`

```ts
totalHours += agents * 0.03;
totalHours += brands * 0.25;
totalHours += 1.3; // base config
// copilot: 0.37h base + 10h se external API
// AI Agents: 1.88h base
```

Esses valores não têm nomes que expliquem o que representam, dificultando manutenção e revisão futura.  
**Correção:** Extrair para constantes nomeadas ou buscar da tabela `Variable` do banco (que já existe para esse propósito).

---

### Arquitetura e Manutenibilidade

#### 3.5 Ausência total de testes
Jest está configurado (`jest.config.ts`) mas nenhum arquivo `.test.ts` existe. As fórmulas do calculador AE e SC têm lógica de negócio crítica sem cobertura.  
**Mínimo recomendado:**
- Testes unitários para o engine de cálculo AE (`calculateTotalHours`)
- Testes de integração para as server actions principais

#### 3.6 Funcionalidade de export incompleta
**Arquivo:** `app/sc/project/[id]/export/route.ts`

A rota de export existe mas a funcionalidade não está completa (sem estrutura de CSV/PDF adequada). Isso pode confundir usuários que encontrarem o endpoint.

#### 3.7 Feature `Spreadsheet` definida mas não implementada
O modelo `Spreadsheet` existe no schema Prisma e a tabela é deletada no `deleteProjectAction`, mas não há UI para criar/visualizar planilhas anexadas a projetos.

#### 3.8 Ausência de error boundaries no React
Nenhum componente `ErrorBoundary` existe. Erros em componentes filhos derrubam a página inteira sem mensagem amigável.  
**Correção:** Usar o arquivo `error.tsx` do Next.js App Router em cada segmento de rota.

---

## Resumo Executivo

| Categoria | Nível | Quantidade |
|-----------|-------|-----------|
| Segurança Crítica | 🔴 | 3 |
| Segurança Alta | 🟠 | 5 |
| Segurança Média | 🟡 | 3 |
| Performance Alta | 🔴 | 2 |
| Performance Média | 🟡 | 3 |
| Qualidade de Código | 🔵 | 8 |

### Prioridade de ação

1. **Imediato:** Corrigir enumeração de usuário (1.1) + verificações de propriedade de projeto (1.4, 1.5)
2. **Curto prazo:** Rate limiting no login (1.2) + remover seed de prod (1.3) + eliminar query por request (2.1)
3. **Médio prazo:** Validação de inputs com `zod` (1.10) + paginação (2.4) + índices de banco (2.5)
4. **Longo prazo:** Strict mode TypeScript (3.1) + testes (3.5) + normalização do JSON data (2.6)
