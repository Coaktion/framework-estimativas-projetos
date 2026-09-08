# Rodada 7 — Mudanças

Onze ajustes pedidos após os testes da versão anterior, mais uma planilha de
consulta da lógica de cálculo da Calculadora AE.

**Resumo de risco:** uma migração de banco (coluna nova, aditiva), nenhuma
quebra de dado existente. Estimativas e versões antigas continuam abrindo — o
que muda é que algumas passam a recalcular com números diferentes, de propósito
(ver "Impacto em dados existentes" no fim).

---

## 1 · AI Agents fora da Calculadora AE

O módulo saiu por completo da Calculadora. Continua existindo no Framework e no
painel administrativo — a remoção vale só aqui.

| Onde | O que saiu |
| :--- | :--- |
| `lib/ae-engine.ts` | `configuracoes_gerais.ai_agents` (0,75h), `treinamentos.ai_agents` (4h), `workshops.ai_agents` (0,5h) |
| `lib/ae-engine.ts` | `'AI Agents'` do tipo `ModuleKey` |
| `lib/ae-engine.ts` | cláusula `hasAIAgents` do gatilho de revisão por Sales Engineer |
| `app/ae/AEClient.tsx` | o módulo da lista de seleção, as três linhas do Relatório Executivo |
| `app/ae/[id]/AEViewClient.tsx` | o módulo do filtro de plano |
| `app/sc/project/[id]/ProjectEditorClient.tsx` | o chip "AI Agents" do painel legado de resumo de estimativa AE |
| `app/i18n/locales/*/common.json` | `aeModules.ai_agents`; menções em `report.reviewAnyway` e `report.triggerCriteria` |

Um projeto que marcava só AI Agents cobrava **5,25h** (0,75 + 4 + 0,5) sem
nenhum item de configuração por trás. Isso deixou de acontecer.

**Higiene de dado legado.** Estimativas salvas antes desta rodada ainda trazem
`'AI Agents'` no JSON. O módulo é descartado em três pontos — na entrada do
engine (`AE_UNSUPPORTED_MODULES`), na montagem de inputs de cada cliente e na
reidratação do formulário — para que reabrir uma estimativa antiga recalcule
**sem** ele, em vez de exibir uma tabela que não fecha com o subtotal.

A flag de supressão `ai-agents` continua existindo em `lib/scope-export.ts`,
porque o Framework ainda tem as categorias de AI Agents. O prompt gerado pela
Calculadora força essa flag para `nao`.

---

## 2 · Knowledge: uma linha só, e ela É a configuração geral

Antes havia duas linhas: uma "Configuração geral: Knowledge" fixa de **0,1h**
(vinda de `configuracoes_gerais`) e, separada, a linha de artigos. A primeira
não representava esforço nenhum.

Agora a configuração geral de Knowledge **é** o cálculo de artigos:

```
horas = MAX( 2 ; artigos × 0,1 )
```

Uma linha na tabela, rotulada `Configuração geral: Knowledge (X artigos)`, com
o número real de artigos no rótulo. Com 0 artigos a quantidade exibida é 1 (um
pacote mínimo de 2h), porque "0 × 2h = 2h" não se sustentaria na tela; a hora
unitária mostrada é sempre a **efetiva**, para que `qtd × unitário = horas`
feche em qualquer cenário. Verificado em 0, 1, 15, 20, 60, 100 e 150 artigos.

> **Ponto em aberto (não decidido por mim).** O pedido descreve a faixa "de 0 a
> 100 artigos". A conta é linear e **sem teto**: 150 artigos geram 15h. Deixei
> assim porque truncar em 10h subestimaria o esforço em silêncio, e porque
> acima de 100 artigos a estimativa já cai na trava de revisão por Sales
> Engineer. Se a intenção for travar o **input** em 100, o lugar é a validação
> do campo — não a fórmula. Está anotado no código, em `lib/ae-engine.ts`.

---

## 3 · Detalhamento por Categoria: reposicionado e redesenhado

**Posição.** Passou a ficar **depois** do "Resumo de Horas". O número que fecha
a conversa é o total geral; o detalhamento existe para explicá-lo, não para
antecedê-lo. Continua recolhido por padrão.

**Redesenho.** O problema era que as parcelas de Discovery / Validação / GP
apareciam como três números coloridos empilhados no canto direito, sem rótulo —
identificáveis só voltando à legenda do toggle — enquanto o meio da faixa ficava
vazio. O que mudou:

- **Cabeçalho de colunas.** As parcelas agora têm nome: `Base`, `Discovery`,
  `Validação`, `GP`, `Total`. A cor virou reforço, não a única pista.
- **Grade compartilhada** entre cabeçalho, categorias, subcategorias e rodapé
  (`breakdownGridClass`), então os números ficam **alinhados em coluna** em vez
  de amontoados.
- **Barra de participação** ocupando o espaço morto do meio, com o percentual
  ao lado. A proporção fica legível sem ler número nenhum. Subcategorias têm a
  própria barra, proporcional à categoria-mãe.
- **Rodapé de fechamento** com o total do detalhamento, para conferir contra o
  Resumo sem somar linha a linha.
- **Cartões do toggle** em vez de texto corrido: cada variável ganhou um chip
  com percentual e total distribuído.
- **Mobile**: a grade colapsa e cada número passa a imprimir o próprio rótulo —
  sem isso voltaria a ser um valor solto, que era exatamente o problema.

---

## 4 · Analytics: fim do Treinamento Básico/Avançado

Removidos o seletor da tela, o campo `analyticsTrainingType` (engine, inputs,
persistência) e a linha `treinamentos.analytics_avancado` (+6h). Analytics
entra pelo **treinamento de Suite (3h)**, como Support e Knowledge, mais a
configuração geral (3,5h) e o workshop de Suite (1h).

Payloads antigos que ainda enviem `analyticsTrainingType: 'advanced'` são
ignorados — verificado: o total sai idêntico ao de um payload limpo.

---

## 5 · Novo segmento: Solution Designer

Chave `SD`, rótulo "Solution Designer" nos dois idiomas, sigla `SD`. Aparece
automaticamente no painel Admin (a lista lê `SEGMENTS`).

Aliases de valores legados aceitos na normalização: `SOLUTION_DESIGNER`,
`SOLUTIONDESIGNER`, `SOLUTION DESIGNER`, `SOLUTION_DESIGN`, `SOLUTION DESIGN`.

> **Proposta, não decisão.** Dei ao SD os mesmos acessos do SC — Projetos/Escopo
> **e** Calculadora AE — por desenhar a solução a partir dos dois. Se o time
> preferir que o Solution Designer não abra a Calculadora, basta tirar `'SD'` de
> `AE_SEGMENTS` em `lib/segments.ts`. Nada mais depende disso.

---

## 6 · Framework: toggle Nova implantação / Otimização

No primeiro bloco de informações, junto de SKU e plano — mesmo controle que já
existia na Calculadora AE.

É **informativo**: não altera cálculo nenhum. Viaja no prompt do Escopo Técnico
(`Tipo de projeto:` na seção `[PROJETO]`) para que a skill saiba se o documento
fala de uma implantação do zero ou de um ajuste sobre um Zendesk em produção.

Persistido em `data.__deploymentType`, como SKU e plano — sem coluna nova.

---

## 7 · Seção [CRM] fora do prompt

A seção inteira deixou de ser emitida. Era um bloco de nove campos
"(pendente — Zoho)" que só ensinava a skill a preencher o documento com
placeholders.

Os tipos (`ScopeExportCrm`, o campo `crm`) **continuam no código de propósito**.
Quando os endpoints do Zoho existirem, religar é trocar uma constante:

```ts
// lib/scope-export.ts
const EMIT_CRM_SECTION = false;   // -> true
```

---

## 8 · Contexto do cliente no prompt da Calculadora AE

Os campos "Objetivos e dores do cliente" e "Indicadores de sucesso" — que o AE
já preenchia e que já eram salvos, mas não saíam no prompt — agora viram um
bloco próprio:

```
[CONTEXTO DO CLIENTE]
# Texto livre escrito pelo Account Executive. Use para redigir as seções de
# contexto, dores e objetivos — nunca para acrescentar entregas ao escopo.
Objetivos e dores do cliente:
- Reduzir tempo de primeira resposta.
- Unificar atendimento de 3 marcas.
Indicadores de sucesso:
- FRT abaixo de 2h
```

Bloco **separado** do dimensionamento, com a advertência explícita, para que a
regra de precedência continue clara: contexto não cria entrega. Quebras de
linha viram bullets. Se os dois campos estiverem vazios, a seção não aparece.

---

## 9 · Atalhos de versão na tela de Projetos

Cada card lista as versões do projeto como chips clicáveis — `V1 · 108h`,
`V2 · 148h` — no mesmo espírito dos chips da Calculadora AE. A versão mais
recente vem primeiro, destacada em verde. O card em si continua abrindo a mais
recente; os chips existem para pular direto para uma anterior.

**Isto exigiu uma coluna nova.** Versões de projeto não guardavam total nenhum —
o número só existia recalculado em tela. `ProjectVersion.totalHours` congela o
total no momento do salvamento, pelo mesmo motivo de `AEEstimate.resultHours`: o
histórico deve mostrar o que foi acordado naquela versão, ainda que a biblioteca
de itens mude depois.

Versões salvas antes da coluna existir ficam com `0` e o chip mostra só `V2`,
sem horas — melhor do que anunciar "0h" como se fosse um escopo vazio. Elas
passam a ter total no próximo salvamento.

A numeração `V1, V2…` é **ordinal por data de criação**, não `versionName` —
esse campo é texto livre ("Proposta Final", "Rev. cliente") e não serve como
identificador. O `versionName` aparece no `title` do chip.

### Correção incidental

`saveProjectVersionAction` recebia `zohoLink` e `safetyHours` do editor e nunca
os gravava — o link do Zoho voltava vazio a cada reabertura da versão, embora a
tela o lesse de volta em `currentVersion?.zohoLink`. Passaram a ser
persistidos. `cloneProjectVersionAction` também copia os dois.

---

## 10 · Botão "Copiar como prompt" na estimativa salva

O botão existia só logo depois de calcular. Reabrir a estimativa por
`/ae/history` levava a uma tela sem ele — o dado estava lá, o prompt não.

A montagem foi extraída para **`lib/ae-scope-prompt.ts`**, que depende apenas do
resultado do engine e dos inputs. A tela de cálculo passa o snapshot congelado;
a de visualização passa o recálculo feito a partir do JSON salvo. O prompt sai
idêntico pelos dois caminhos.

---

## 11 · Prompt no idioma da interface

O prompt saía em pt-BR mesmo com a interface em inglês — e, com ele, o documento.

**O que passou a ser traduzido:** a instrução de uso, a regra de precedência, os
comentários `#`, os textos de ausência (`(não informado)` → `(not provided)`) e,
o que de fato importa, a linha `IDIOMA DE SAÍDA`, que passa a dizer `en-US`.

**O que continua em português, de propósito:** as tags de seção (`[PROJETO]`,
`[DIMENSIONAMENTO]`…), os rótulos de campo antes dos dois-pontos e os valores de
enum (`sim`/`nao`).

É a mesma decisão já tomada para os nomes gravados no banco — chave canônica em
português, tradução só na exibição. Traduzir as tags quebraria o parser da skill
`scope-creator` a cada troca de idioma, e um prompt copiado em inglês deixaria de
ser lido. Em inglês o envelope carrega um glossário dos rótulos, para que a
leitura humana não fique refém do português.

> ⚠️ **Dependência.** O prompt em inglês já pede documento em inglês, mas a
> skill `scope-creator` só tem template pt-BR. Até existir o template em inglês,
> um prompt `en-US` vai gerar um documento com estrutura pt-BR e conteúdo em
> inglês, ou a skill vai avisar. Nada quebra — mas vale saber antes de usar em
> cliente.

---

## Verificação

- **TypeScript**: `tsc` contra a base inteira, comparado erro a erro com o
  código original. **Zero erros novos.** Dois erros pré-existentes foram
  corrigidos de passagem (`ACTION_FLOW_OPTIONS.find(o => o.value === …)` — a
  lista é de strings, não de objetos `{value,label}`; funcionava por acidente,
  caindo sempre no fallback).
- **Engine**: nove cenários executados de verdade contra o motor compilado —
  descarte de AI Agents legado, Knowledge em sete faixas de artigos, Analytics
  com e sem o campo legado de treinamento, gatilho de Sales Engineer, ausência
  das chaves removidas em `AE_DATABASE`.
- **Prompt**: 24 asserções nos dois idiomas — ausência de `[CRM]`, presença e
  formato de `[CONTEXTO DO CLIENTE]`, `IDIOMA DE SAÍDA` correto, tags
  estruturais **idênticas** entre pt e en, flags detectadas, `ai-agents` forçada
  em `nao`.
- **i18n**: 772 chaves por idioma, paridade pt/en verificada programaticamente.
- **Planilha**: auditoria cruzada contra o engine — todas as 52 chaves de
  `horas_unitarias`, 8 de `configuracoes_gerais`, 7 de `treinamentos`, 5 de
  `workshops`, 10 de `apps` e 10 de itens fixos têm linha correspondente.

---

## Impacto em dados existentes

Nenhum dado é perdido ou corrompido. Três mudanças de **número**, todas
intencionais:

1. Estimativas AE com **AI Agents** recalculam **até 5,25h a menos**.
2. Estimativas AE com **Knowledge** recalculam **0,1h a menos** (a linha fixa
   sumiu; a de artigos continua).
3. Estimativas AE com **Analytics + treinamento avançado** recalculam **6h a
   menos**.

O valor gravado em `AEEstimate.resultHours` **não** é reescrito — o histórico
preserva o total acordado. O que muda é o recálculo exibido ao reabrir. Se
alguma proposta em negociação depender do número antigo, vale conferir antes de
publicar.
