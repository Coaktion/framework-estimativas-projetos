# Handoff para produção — rodadas 5 e 6

Lista objetiva do que precisa ser feito e do que precisa ser observado. Os
detalhes técnicos de cada item estão em `RODADA-5-MUDANCAS.md` e
`RODADA-6-MUDANCAS.md`.

---

## 1. Banco de dados — obrigatório antes de subir

Duas colunas novas em `Category`, ambas com `@default("")`:

```prisma
minPlanCS  String @default("")
minPlanES  String @default("")
```

```bash
npx prisma generate
npx prisma db push
```

Nenhuma linha existente quebra. **Não** é preciso rodar o seed — mas se rodar,
é seguro: o upsert de categorias só grava a porteira de plano quando o mapa
`CATEGORY_MIN_PLAN` do seed define um valor, e ele nasce vazio de propósito.
Restrição configurada no painel Admin não é sobrescrita.

---

## 2. Conferir a coluna `role` antes do deploy

`DEV` mudou de significado. Antes era um valor legado normalizado para `IMPL`
("Desenvolvimento"); agora é o segmento **Developer**.

```sql
SELECT role, count(*) FROM "User" GROUP BY role;
```

Se aparecer alguma linha com `role = 'DEV'` no sentido antigo, ela passará a ser
lida como Developer. Como a migração de segmentos já rodou, o esperado é só
encontrar os valores canônicos.

---

## 3. Mudanças que alteram NÚMEROS já salvos

Duas coisas nesta entrega mudam valores. O site não está em produção, mas vale
saber onde olhar ao validar.

**a) Tags de incidência passaram a valer.** Discovery, Validação e GP agora
descontam da base as horas de itens marcados como não incidentes no painel
Admin. Frameworks salvos que usem essas tags vão recalcular **para menos**. Se
os números parecerem baixos, confira as tags do item antes de tratar como bug.

**b) Módulos acima do plano na Calculadora AE.** A tabela deixou de desenhar
seções de módulos que o plano não permite (ex.: WFM em Growth). O total sempre
esteve certo; o que muda é que a seção some da tela em vez de aparecer com
subtotal zero.

O que **não** mudou: nenhum total da Calculadora AE. Isso foi verificado em 400
cenários aleatórios contra o engine anterior — zero diferença.

---

## 4. O que testar depois de subir

**Calculadora AE — tabela de resultado**
- Nenhuma linha com quantidade preenchida e `0.00h`.
- Em cada seção, a soma das linhas bate com o subtotal do cabeçalho.
- Nenhum rótulo com prefixo numérico (`2.14 Side Conversations` etc.).
- Configurações gerais, Treinamentos e Workshops aparecem **por módulo**.
- Selecionar WFM ou QA num plano Growth: a seção não deve aparecer.

**Calculadora AE — nova versão** (bug da rodada 5)
- Criar estimativa grande que exija SE → deve mostrar a mensagem de SE.
- Criar nova versão da mesma, pequena o bastante para mostrar horas → deve
  mostrar as horas, **não** a mensagem anterior.

**Histórico `/ae/history`**
- Cada chip de versão mostra as horas (`V3 · 148h`).
- Versão que exige SE mostra `V2 · SE`, sem horas.

**Framework — plano por categoria**
- Admin › Categorias: definir plano mínimo numa categoria; o selo aparece na
  lista.
- No framework, abaixo desse plano a categoria some inteira e o selo vermelho
  ao lado dos seletores nomeia o que foi escondido.
- A busca não deve retornar itens de categoria escondida.

**Framework — toggle de horas proporcionais**
- Ligar o toggle: a soma das contribuições tem de fechar com o bloco
  "Resumo de horas".
- Desligado, os números têm de ser idênticos aos de antes.

**Relatório Executivo**
- Só admin vê. Outros segmentos veem apenas a tabela.

**Botão "Copiar como prompt"**
- Framework: recusa exportar rascunho não salvo.
- Calculadora AE: aparece abaixo da tabela após calcular.

---

## 5. Skill `scope-creator` — instalação separada

Não faz parte do deploy da aplicação. É instalada por quem for usar, a partir do
arquivo `scope-creator.skill`.

Só há template em **português**. A saída é sempre pt-BR, mesmo com a conversa em
inglês. Quando os templates em inglês existirem, entram em `assets/` e o campo
`IDIOMA DE SAÍDA` do envelope passa a decidir.

O botão no site **não** chama a API da Claude — a cópia é manual, por decisão de
projeto. Não é um recurso pendente.

---

## 6. Coisas que já estavam assim (não mexer achando que é regressão)

- **Imports órfãos** — há 19 espalhados por `AdminClient`, `AEClient`,
  `AEViewClient` e `ProjectEditorClient`. São anteriores a estas rodadas;
  foram deixados como estão para não inflar o diff.
- **Numeração no Relatório Executivo** — os rótulos `aeReport.*` continuam
  numerados de propósito: ali a numeração é o sumário do documento. Só a tabela
  usa os rótulos limpos (`aeTable.*`).

---

## 7. Decisões que ainda dependem do time

- **Matriz de acesso** de Sales Ops, Customer Success e Developer. Foram
  espelhadas em PM (os dois primeiros) e Implantação (o último), e estão
  marcadas como proposta no comentário de `lib/segments.ts`.
- **Plano mínimo por categoria** — o mapa do seed está vazio. Preencher pelo
  painel Admin, ou fixar padrões de fábrica em `CATEGORY_MIN_PLAN`.
