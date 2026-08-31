# Rodada 6 — Incidência de variáveis, tabela da Calculadora AE e horas no histórico

Complementa `RODADA-5-MUDANCAS.md`.

**Não há mudança de banco nesta rodada.** O `npx prisma db push` da rodada 5
(colunas `minPlanCS` / `minPlanES` em `Category`) continua sendo o único
pré-requisito.

---

## 1. As tags de incidência passaram a valer

### O que estava errado

`ProjectEditorClient` definia `calculateVariable` — a única função que lia
`Package.excludedFromVariables`, `Variable.targetItems`,
`Variable.targetCategories` e `Variable.excludedItems` — e **nunca a chamava**.

Discovery e Validação incidiam sobre TODO o bucket de Setup; o GP, sobre TODO o
consolidado. Ou seja: toda regra de incidência configurada no painel Admin era
inerte, e nada na tela indicava isso.

### Como ficou

A regra saiu da função morta e entrou no fluxo real de cálculo:

1. `bucketFor(categoria)` foi extraída como função **pura** (antes a lógica de
   bucket vivia dentro de `assignImplantBucket`, que não devolvia nada). É
   preciso saber quais horas caíram em **Setup**, porque é só sobre elas que
   Discovery e Validação incidem.
2. `trackExclusions(pkg, categoria, horas)` roda na varredura dos itens, onde
   ainda se conhece o item e a categoria de origem, e acumula:
   - `setupExcluded.discovery` / `.validation` — apenas o que caiu em Setup;
   - `gpExcluded` — qualquer item, já que a base do GP é o consolidado.
3. As bases passam a ser `baseDiscovery`, `baseValidation` e um `totalBaseGP` já
   descontado. Todos os ramos (`PERCENT`, `FLAT`, `MIXED` e o fallback) usam a
   base descontada — não só o caminho feliz.

`calculateVariable` foi **removida**. Deixá-la ali, morta, foi exatamente o que
fez parecer que as tags funcionavam; um comentário no lugar explica o histórico.

### Efeito colateral desejado

O toggle "incluir horas proporcionais" da rodada 5 usa o mesmo
`variableEligibility`. Antes ele respeitava as tags enquanto os totais não —
convivência estranha, ainda que a soma fechasse. Agora os dois olham para o
mesmo critério: o memo foi movido para **antes** de `totals`, e é consumido nos
dois lugares.

### Conferência

Sete cenários: sem tags (comportamento idêntico ao anterior); item fora de
Discovery via `excludedFromVariables`; item excluído pela `Variable`; variável
com `targetCategories` restrito; exclusão fora do bucket de Setup (não mexe em
Discovery, mas mexe no GP); item fora do GP; e tudo excluído (base 0, sem
negativo). Todos passam.

> **Atenção ao subir:** estimativas já salvas que tenham itens com tags vão
> **recalcular com números menores**. É o comportamento correto, mas é uma
> mudança de valor — vale avisar quem usa.

---

## 2. Tabela de resultado da Calculadora AE

### Os totais estavam certos

Respondendo diretamente à pergunta: **sim, os totais estavam corretos.** Os
subtotais de seção vinham do `breakdown` do engine e sempre bateram. O defeito
era só de exibição — mas era maior do que o print mostrava.

### Quatro causas distintas

**a) Tarifas unitárias fixadas em zero.** Marketplace Apps, Condicionais
Avançadas, Ticket Manager, Configurações gerais, Treinamentos, Workshops,
Pacotes fixos e conteúdo dinâmico passavam `0` como hora unitária. Daí o
`0.00h` com o subtotal certo logo acima.

**b) Canais somados com uma tarifa média.** E-mail, formulário web e widget têm
tarifas próprias, e os demais entram num bloco com piso de 0,5 h. A tabela
multiplicava o total de canais pela tarifa de "canal que exige reunião" — por
isso "Setup base" fechava 2,33 h contra um subtotal de 2,91 h.

**c) Seções desenhadas para módulos que o plano não permite.** Com WFM em
Growth, o engine descarta o módulo, mas a tabela desenhava a seção assim mesmo:
linhas somando 5,35 h sob um subtotal de 0,00 h.

**d) Travas de elegibilidade ignoradas.** Side Conversations apareciam mesmo em
plano inelegível, e a linha de Knowledge ignorava o piso de 2 h.

### A correção

Em vez de corrigir tarifa por tarifa, mudou-se a **origem** dos números. O
engine passou a publicar um contrato `details`:

```ts
details: {
  generalConfig, training, workshops,   // por MÓDULO
  fixedItems, marketplaceApps, aktieApps,
  channelSetup, dynamicContent, baseSetup,
  knowledge, sideConversations,
}
allowedModules: string[]                 // módulos que o plano permitiu
```

Cada linha traz `qty`, `unitHours` e `hours` prontos. A tabela só exibe. Não
existe mais um segundo lugar onde a conta possa divergir — que era a causa raiz.

Detalhes que o teste obrigou a acertar:

- Onde há **piso** (Knowledge com poucos artigos, canais de reunião), a tarifa
  exibida é a **efetiva** (`horas ÷ quantidade`), senão a linha não fecha com
  ela mesma.
- Sem nenhum artigo, Knowledge vira `articles_minimum` com quantidade 1 — com
  quantidade 0 a conta "0 × 2 h = 2 h" não se sustentaria na tela.
- A quantidade de conteúdo dinâmico **não** é arredondada no engine; quem
  arredonda é a UI. Arredondar na origem quebrava `qty × unitHours = hours`.

### "Configurações gerais por módulo" foi aberta

Como pedido, virou uma linha por módulo — "Configuração geral: Support",
"…: Knowledge" — cada uma com a tarifa real. **Treinamentos e Workshops
receberam o mesmo tratamento**, porque sofriam do mesmo defeito (quantidade 10,
0,00 h).

### Conferência

- **400 cenários aleatórios** comparando o engine refatorado com o original:
  zero diferença em qualquer total, chave de `breakdown` ou na flag de SE.
- **300 cenários** atravessando a tabela: toda seção fecha (linhas = subtotal),
  nenhuma linha com quantidade > 0 e 0 h, nenhum rótulo faltando, e a soma de
  todos os subtotais bate com o `grandTotal`.

---

## 3. Numeração removida dos rótulos da tabela

As chaves `aeReport.*` são compartilhadas com o **Relatório Executivo**, onde a
numeração é o sumário do documento. Tirar o número na origem quebraria o
relatório.

Criou-se o namespace `aeTable.*` com rótulos limpos, mais `aeModules`,
`aeFixed`, `aeApps` e `aeChannels` para as linhas novas. O relatório segue
intacto.

> Um cuidado: as chaves dinâmicas (`aeModules.${key}`) usam `defaultValue`, que
> mascara chave faltante exibindo a chave crua. Foi feita uma verificação
> cruzando **todas** as chaves que o engine pode emitir contra os locales —
> nenhuma ausente.

---

## 4. Horas por versão no `/ae/history`

Cada chip de versão passa a mostrar as horas daquela versão (`V3 · 148h`), e o
card mostra as horas da versão mais recente ao lado da tag de status.

Duas decisões:

- O número vem de `resultHours` **gravado no banco**, não de um recálculo. O
  histórico deve mostrar o que foi acordado naquela versão, mesmo que a tabela
  de preços tenha mudado depois.
- Versão que exige Sales Engineer mostra `V2 · SE` em vez de horas. Ela não tem
  número fechado, e exibir um daria a impressão de um valor acordado que não
  existe.

---

## Arquivos alterados nesta rodada

| Arquivo | + | − |
| :--- | ---: | ---: |
| `lib/ae-engine.ts` | 243 | 46 |
| `lib/ae-result-table.ts` | 97 | 36 |
| `app/sc/project/[id]/ProjectEditorClient.tsx` | 582 | 147 |
| `app/ae/history/page.tsx` | 7 | 0 |
| `app/ae/history/AEHistoryClient.tsx` | 25 | 2 |
| `app/i18n/locales/{pt,en}/common.json` | novos namespaces | — |

---

## Pendências

- **Fase 2 do Zoho** — preencher `ScopeExportInput.crm`.
- **Templates em inglês** do Escopo Técnico.
- **Matriz de acesso** dos segmentos Sales Ops / Customer Success / Developer —
  confirmar com o time.
