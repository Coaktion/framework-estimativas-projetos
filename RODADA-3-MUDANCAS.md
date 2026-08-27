# Rodada 3 — Mudanças e auditoria do engine AE

Complementa `I18N.md` e `SEGMENTOS-E-NOMES-BILINGUES.md`.

---

## 1. Horas no formato "00h 00m"

`lib/format-hours.ts` → `formatHoursMinutes()`.

```
0     -> "0m"        1.5  -> "1h 30m"
0.5   -> "30m"       13.5 -> "13h 30m"
15    -> "15h"       0.08 -> "5m"
```

Exibido abaixo do valor decimal em: horas unitárias do item, subtotal da linha,
total de cada cartão de skill, detalhamento por categoria e tabela da
Calculadora AE. Minutos são arredondados (0.336h → "20m").

---

## 2. Plano Zendesk mínimo por item

**Painel Admin** — cada item ganhou dois seletores: `Plano mín. CS` e
`Plano mín. ES`. Vazio = **sem restrição** (vale em todos os planos), que é o
default para nada desaparecer antes de alguém preencher. Cada linha da tabela
mostra selos coloridos (`CS Growth+`, `ES Professional+`).

**Página do framework** — dois seletores novos no topo: tipo de instância
(Customer Service / Employee Service) e tier do Zendesk.

Os tiers são **inclusivos**: um item com mínimo Team aparece em Team, Growth,
Professional e Enterprise. A comparação é sempre por posição
(`PLAN_RANK` em `lib/zendesk-plans.ts`), nunca por igualdade.

Itens acima do plano selecionado saem **das tabelas e do total**. Para que isso
não seja silencioso, aparece um contador âmbar "N itens fora do plano" ao lado
dos seletores.

A escolha de SKU/tier é gravada dentro do JSON `data` da versão
(`__skuType` / `__planTier`), então não exigiu coluna nova e volta ao reabrir.

---

## 3. Detalhamento por categoria

Seção **recolhível** logo acima de "Resumo de Horas". Cada categoria abre para
mostrar as subcategorias, com horas decimais, o formato `00h 00m` e o % do
total. Botões "Expandir todas" / "Recolher todas".

É construída a partir de `totals.itemTotals`, portanto reflete exatamente o que
está sendo contado — quantidade > 0, módulo marcado, overrides manuais
aplicados e o filtro de plano do item 2.

---

## 4. Tabela de resultado da Calculadora AE

Duas peças novas:

- `lib/ae-result-table.ts` — monta as seções a partir da **saída do engine**.
  As horas por unidade vêm de `AE_DATABASE`, não de números repetidos, para a
  tabela nunca divergir do cálculo.
- `components/AEResultTable.tsx` — renderiza, adaptando as colunas.

| Segmento de quem **está lendo** | O que vê |
| :--- | :--- |
| Account Executive | Apenas **quais** itens entram no setup |
| Admin, SC, Gerente de Projeto, Implantação | Itens + **quantidade** + horas |

**Depende de quem lê, não de quem gerou.** Nada da tabela é gravado no banco:
ela é remontada a cada visualização, a partir dos inputs salvos, usando o
segmento da sessão atual. Um Sales Engineer que abre uma estimativa criada por
um AE vê quantidades e horas normalmente.

Aparece nos dois lugares: na Calculadora depois de calcular, e na tela de
estimativa salva (`/ae/[id]`).

Um selo "Visualizando como {segmento}" deixa claro qual visão está ativa, e a
visão de AE traz um aviso explicando que outros perfis veem mais detalhe.

> **Ponto para decidir:** o número grande de horas ("Esforço Estimado") continua
> visível para o AE, porque ele precisa daquilo para cotar. Só a **tabela** ficou
> sem números. Se o AE também não deve ver o total, é uma linha para mudar.

**Conferência feita:** a soma dos subtotais das seções fecha com o total do
engine — diferença de 0.0000h num cenário com Support + Voice + QA, 3 canais,
2 idiomas, integração nativa, Action Flow, SweetHawk, SSO e side conversation.

---

## 5. Botão de sugestões / bugs

`components/FeedbackButton.tsx`, na barra superior, abrindo o formulário do
Google em nova aba (`rel="noopener noreferrer"`).

Foi colocado em `app/layout.tsx` e **não** na `Navbar`: a Navbar é
`hidden md:flex` e retorna `null` sem sessão, ou seja, o botão ficaria invisível
no celular e na tela de login.

---

## 6. Voice na Calculadora AE — era um bug, e maior do que parecia

`availableModules` **nunca** incluía `'Voice'`, então `hasVoice` era sempre
`false`. Medido: marcar o canal Voice somava **1.87h**, e isso vinha apenas de um
efeito colateral em `campos_ticket`. Zero de config de voz, zero de treinamento
de voz, zero de workshop de voz.

Pior: o canal Voice também não tem linha de cobrança em `channelSetupHoras`
(só email, web_form e web_widget têm), porque o engine assume que o esforço de
voz vem pelo módulo. Com o módulo inacessível, **voz não custava nada**.

Corrigido e verificado: o mesmo cenário passou de **18.04h para 39.63h**.

Também liguei os dois, porque a dependência não é óbvia: a quantidade de IVR vem
de `channelQuantities.voice`, mas as horas só são faturadas com o **módulo**
Voice ligado. Marcar só um dos dois produzia ~0 hora de voz em silêncio. Agora,
escolher o canal Voice liga o módulo automaticamente.

---

## 7. Botão de ocultar item

O olho (`EyeOff`) era `opacity-0` até passar o mouse na linha. Agora fica sempre
visível.

---

## 8. Auditoria do engine AE — achados (nenhum código alterado)

Conforme pedido, esta seção é só diagnóstico.

### Bugs confirmados

1. **WhatsApp aponta para o pacote errado.**
   `{ id: 'whatsapp', package: 'Messaging: LINE' }` — idêntico à entrada do LINE.
   Erro de copiar/colar.

2. **Canal X inconsistente.** Rotulado "X (Twitter)" com pacote
   `Ticket: X (Mensagens Públicas)` (mensagens públicas), mas mapeado para
   `x_dm` (mensagens diretas). Um dos dois está errado.

3. **Falha silenciosa do engine.** `calculateAEEstimate` estava dentro de
   `try { } catch { result = null }`, e depois `const db = result || {…zeros}`.
   Um plano desconhecido faz `normalizePlan` lançar erro — e o usuário via uma
   estimativa de 0 hora com aparência normal. Confirmei o erro com
   `'Suite Enterprise Plus'`. *(Nesta rodada acrescentei um `console.error`, mas
   o comportamento de cair para zero continua — corrigir de verdade pede uma
   decisão de UX: mostrar erro na tela em vez de zerar.)*

4. **`'Outros'` e `'App Marketplace'` mapeiam para `other_marketplace`.**
   Selecionando os dois, `appQuantities` é sobrescrito pelo último processado e
   uma quantidade se perde.

5. **Quatro canais do engine são inacessíveis pela UI:**
   `facebook_pages`, `instagram_page`, `x_pages`, `telegram`.

### Suspeitos — vale conferir contra a planilha

6. **`q.saudacoes = 6 * q.ivr`, e `q.ivr = 6 * canaisVoice`.**
   Um número de telefone → 6 IVRs → **36 saudações**. Cinco números → 180.
   O 6× aplicado sobre um número que já é 6× parece fórmula que deveria ser
   `6 * channelQty('voice')`.

7. **Voz é grátis em Team e Growth.** `q.ivr` é zerado abaixo de Professional,
   então Voice nesses tiers rende só 3.5h de config/treinamento/workshop, sem
   nenhum esforço por linha.

8. **Toda a base depende de Support.** `agentSetup`, `brandSetup` e
   `channelSetup` exigem o módulo Support. Um negócio só de Voice, ou só de WFM,
   sai com zero agente, zero marca e zero canal.

9. **Treinamento e workshop de Analytics discordam.** Em Team só com Analytics:
   treinamento aplica (3h) mas o workshop não (0h), porque `workshopSuite` exige
   Professional+ para Analytics e `TR.suite` não.

10. **Base do GP ≠ gatilho do GP.** O gatilho inclui `commTechHours`; a base
    exclui, mas inclui treinamentos. Está comentado como intencional — vale
    confirmar contra a planilha.

### Verificado e correto (testei porque pareciam errados)

- **Funções (roles) só em Enterprise** e **SLA fora do Team**: os dois batem com
  o empacotamento real do Zendesk.
- **WhatsApp não é contado duas vezes** em `campos_ticket`.
- **Elegibilidade de side conversations** concorda entre cliente e engine
  (CS Professional+, ES Growth+).
- **`percentBase` não pode ficar negativo** — tentei forçar e não consegui,
  porque native/apps também entram em `lineItemHours`.

---

## Migração de banco necessária

```prisma
Package.minPlanCS   String @default("")
Package.minPlanES   String @default("")
```

Ambas com default, então nenhuma linha existente quebra:

```bash
npx prisma db push
```

---

# Rodada 4 — Correções dos bugs (a) a (e)

## (a) WhatsApp apontava para o pacote errado

`{ id: 'whatsapp', package: 'Messaging: LINE' }` → `'Messaging: WhatsApp'`.

**Boa notícia:** o campo `package` das opções de canal **nunca é consumido em
código** — é metadado de documentação. Nenhuma estimativa passada saiu errada
por causa disso.

**Achado maior:** não existia pacote de WhatsApp na biblioteca. Foi adicionado
ao seed (`Messaging: WhatsApp`, 1.0h, Canais - Messaging), então agora o
framework também tem o item.

Corrigidos no mesmo passo dois nomes de pacote que não existiam no seed:
`Messaging: Apple Messages` → `Messaging: Apple Messages for Business` e
`Messaging: Google Business` → `Messaging: Google Business Messages`.
Auditoria final: **todos** os 21 nomes de pacote referenciados existem no seed.

## (b) X separado em dois canais

| Opção | Chave do engine | Pacote |
| :--- | :--- | :--- |
| X DMs | `x_dm` | `Messaging: X Corp DM (por página)` |
| X (Mensagens Públicas) | `x_pages` | `Ticket: X (Mensagens Públicas)` |

O rótulo antigo dizia "público" mas mapeava para DM. A chave legada `x` continua
no mapa apontando para `x_dm`, então estimativas já salvas não mudam de valor.

## (c) Marketplace — o problema era pior que o relatado

As opções vinham da categoria `Marketplace` do **banco**, cujos nomes reais são
`App Marketplace (Lista Infinita)`, `App Builder: Sem conexão API externa` e
`App Builder: Com conexão API externa`. Nenhum deles existia em
`MARKETPLACE_APP_LABEL_TO_KEY` — ou seja, **nenhum app de marketplace era
contabilizado**: selecionar qualquer um somava 0h.

A lista agora é a dos apps que o engine realmente tarifa (`AE_DATABASE.apps`):
WooCommerce, Dialpad, Aircall, VTEX, Stripe, Pipedrive, SweetHawk e Outros.

Com isso o pedido fica atendido: **"Outros" existe, "App Marketplace" saiu da
Calculadora.** O rótulo `App Marketplace` permanece apenas no mapa de leitura,
para que estimativas antigas que o gravaram continuem somando certo.

Verificado: WooCommerce 1×→1.5h, SweetHawk 3×→6h, Outros 2×→10h.

## (d) Quatro canais inacessíveis

Adicionados: `facebook_pages` (Facebook Page Feed), `instagram_page`
(Instagram Page Feed), `x_pages` (via item b) e `telegram`.
`Ticket: Instagram Page (Feed)` não existia no seed e foi criado.

Auditoria: **0 canais do engine sem opção na UI** (eram 4).

> Não adicionei um canal Android, apesar de existir `Messaging: Android SDK` na
> biblioteca: `android` não é uma `ChannelKey` declarada no engine, e criar um
> canal que o engine só trata por acidente seria um furo de tipagem.

## (e) Analytics apenas em Professional+

Aplicado em **três** camadas:

1. **UI** — `availableModules` só oferece Analytics a partir de Professional.
2. **Fronteira cliente→engine** — `buildEngineInputs` (Calculadora) e o mesmo
   filtro no `AEViewClient` descartam Analytics abaixo de Professional.
3. **Engine** — novo `MODULE_MIN_PLAN` + `modulesAllowedOnPlan()` em
   `lib/ae-engine.ts`.

A terceira camada é a que resolve o bug de verdade. A divergência original era
**interna ao engine**: com Analytics em Team, `TR.suite` cobrava treinamento mas
`workshopSuite` exigia Professional+ e não cobrava workshop. Só travar na UI
deixaria a incoerência viva para qualquer chamada direta e para estimativas
antigas. Agora o engine descarta o módulo sozinho.

O mesmo gate cobre Community, Copilot, QA e WFM (Professional+) e ADPP
(Enterprise) — regras que também viviam apenas nos clientes.

Verificado: Analytics não altera mais nada em Team/Growth; em Professional e
Enterprise config, treinamento e workshop entram juntos. QA/WFM/ADPP idem.

## Migração

Nada de novo no schema. Para aplicar os pacotes novos e o gate de Analytics na
biblioteca:

```bash
npx prisma db seed
```

O `upsert` de pacotes passou a propagar `minPlanCS`/`minPlanES`, mas **somente
quando o seed define um valor** — restrições configuradas à mão no painel Admin
em outros itens não são apagadas.
