# Segmentos de usuário e nomes bilíngues

Complementa o `I18N.md`. Cobre duas mudanças: a segmentação de usuários e os
nomes em dois idiomas dos itens configuráveis.

---

## Parte 1 — Segmentos de usuário

### Os cinco segmentos

| Código | PT-BR | EN |
| :--- | :--- | :--- |
| `ADMIN` | Admin | Admin |
| `SC` | Sales Engineer | Sales Engineer |
| `AE` | Account Executive | Account Executive |
| `PM` | Gerente de Projeto | Project Manager |
| `IMPL` | Implantação | Implementation |

Cada usuário pertence a **exatamente um** segmento. O valor fica na coluna
`User.role` — o nome da coluna foi preservado para não quebrar o código de
autorização que já existia.

### ⚠️ Decisão importante: Admin virou segmento, não mais uma caixa de seleção

Antes existiam **dois** campos independentes: um `role` (User/SC/AE/DEV) e uma
caixa "Privilégio Admin". Isso permitia, por exemplo, um Sales Engineer que
também fosse administrador.

Como você pediu que cada usuário pertença a exatamente um segmento e que
"somente admins" possam alterar segmentos, `isAdmin` passou a ser **derivado**
do segmento:

```
segmento === 'ADMIN'  ⟺  isAdmin === true
```

Consequências:

- A caixa "Privilégio Admin" saiu do formulário. No lugar dela há um indicador
  que acende quando o segmento escolhido é ADMIN.
- O botão de escudo na lista de usuários virou um ícone informativo, não
  clicável. Para promover alguém, mude o segmento dele para Admin.
- **Todas as verificações `session.user.isAdmin` do app continuam funcionando
  sem alteração** — eram cerca de 25 e nenhuma precisou mudar.

> **Se você quiser um administrador que também seja Sales Engineer**, essa
> combinação não existe mais neste modelo. É uma mudança de uma linha: separar
> `isAdmin` do segmento novamente em `lib/segments.ts`. Me avise e eu ajusto.

### Matriz de acesso

Definida em **um único lugar** (`lib/segments.ts`), lida pela Navbar, pela home e
pelos guards de página e de server action:

| Segmento | Projetos/Escopo | Calculadora AE | Admin |
| :--- | :---: | :---: | :---: |
| ADMIN | sim | sim | sim |
| SC | sim | sim | não |
| AE | não | sim | não |
| PM | sim | sim | não |
| IMPL | sim | não | não |

Antes da mudança: Escopo = `SC` ou admin; AE = `AE`, `SC` ou admin. As linhas de
**PM e IMPL são proposta minha** — você não especificou. Ajuste as constantes
`SCOPE_SEGMENTS` e `AE_SEGMENTS` se não corresponder ao fluxo do time.

### "Somente admins podem alterar segmentos"

Aplicado em **três camadas**:

1. **Servidor (a que importa):** `updateUserSegmentAction` chama
   `canManageSegments()` e recusa com erro traduzido se quem chamou não for admin.
2. **Validação de valor:** um segmento fora da lista é rejeitado.
3. **UI:** o `<select>` fica desabilitado com tooltip explicativo para não-admins.

Duas proteções extras:

- **Último administrador:** a action recusa remover o segmento ADMIN se ele for o
  único administrador restante, para o sistema não ficar sem acesso.
- **Auto-rebaixamento:** se você tirar o seu próprio ADMIN, aparece uma
  confirmação antes.

### Migração dos usuários existentes

Valores antigos são normalizados por `normalizeSegment()`:

| Valor antigo | Vira |
| :--- | :--- |
| `SC`, `AE`, `ADMIN` | mantido |
| `CONSULTING` | `AE` |
| `DEV`, `Desenvolvimento` | `IMPL` |
| `GP` | `PM` |
| `USER`, vazio, desconhecido | `IMPL` (padrão) |

**Quem já era `isAdmin = true` vai para o segmento ADMIN**, para ninguém perder
acesso na virada.

Rode uma vez, depois de aplicar o schema:

```bash
npx prisma db push
npx tsx prisma/migrate-segments.ts
```

O script é idempotente e avisa se sobrar zero administradores.

---

## Parte 2 — Nomes em português e inglês

### O que aceita dois nomes

| Entidade | Campo PT (chave) | Campo EN (exibição) |
| :--- | :--- | :--- |
| Pacote / item | `name`, `tooltip` | `nameEn`, `tooltipEn` |
| Categoria | `displayName` | `displayNameEn` |
| Skill | `name` | `nameEn` |
| Variável | `label` | `labelEn` |

### A regra que evita corromper dados

**O campo em português continua sendo a chave canônica gravada no banco.** O
campo `...En` é *só exibição* e nunca é gravado como valor.

Isso importa porque `Package.name` é `@unique` e serve de chave em vários
lugares: as buscas de pacote no `AEClient`, as relações do Prisma, o
`layoutConfig` salvo por usuário e os valores de `selectedApps` /
`selectedNativeConnections` que alimentam o engine de cálculo. Se o nome em
inglês fosse gravado, um usuário em EN salvaria `"User Field"` e um em PT
`"Campo de Usuário"` para a mesma coisa — dividindo os dados em silêncio.

Na prática, nas listas de opções da Calculadora AE o `value` é o nome português
e só o `label` muda de idioma.

**Se o nome em inglês estiver vazio, a exibição cai no português.** Nada
desaparece da tela enquanto as traduções não forem preenchidas — e no painel
Admin esses itens ganham um selo âmbar "Sem tradução" para você achar o que
falta.

### Busca em todos os idiomas

Toda busca varre **os dois idiomas ao mesmo tempo**, independente do idioma
exibido. Um usuário em português digitando `user field` encontra
"Campo de Usuário", e vice-versa.

Detalhes da implementação (`lib/localized-names.ts`):

- **Insensível a acento e caixa:** `configuracoes` acha "Configurações".
- **Várias palavras casam em qualquer ordem:** `field user` acha "User Field".
- Cobre nome PT + nome EN + tooltip PT + tooltip EN de cada item.

Vale para a busca de itens do painel Admin e para a busca de
categoria/subcategoria/item do editor de escopo.

### Onde preencher

Painel Admin:

- **Biblioteca › Itens** — formulário de novo item tem Nome (PT-BR) e Nome (EN),
  mais Tooltip nos dois idiomas. A edição em linha da tabela tem os quatro campos.
- **Biblioteca › Categorias** — Nome de Exibição (PT-BR) e (EN).
- **Biblioteca › Skills** — campo de nome em inglês em cada cartão, salvo ao sair
  do campo.
- **Variáveis** — Rótulo (PT-BR) e (EN). A `key` técnica continua aparecendo
  abaixo do rótulo.

Categorias e skills do seed já vêm com nome em inglês. Os **109 itens do seed
não** — o nome em inglês deles fica em branco (e portanto aparece em português)
até alguém preencher pelo painel. Traduzir os 109 é uma decisão de conteúdo, não
de código; se quiser, eu gero uma primeira versão para vocês revisarem.

---

## Migração de banco necessária

`prisma/schema.prisma` mudou. Colunas novas:

```prisma
User.role            // agora guarda o segmento (default mudou para "IMPL")
Category.displayNameEn
Skill.nameEn
Package.nameEn
Package.tooltipEn
Variable.label
Variable.labelEn
```

Todas têm valor padrão, então nenhuma linha existente quebra. Aplique com
`npx prisma db push` e depois rode `prisma/migrate-segments.ts`.
