# Rodada 5 — Relatório Executivo, novos segmentos, horas proporcionais, plano por categoria e Escopo Técnico

Complementa `RODADA-3-MUDANCAS.md`.

---

## Migração de banco necessária

Duas colunas novas em `Category`, ambas com default — nenhuma linha existente
quebra:

```prisma
Category.minPlanCS  String @default("")
Category.minPlanES  String @default("")
```

```bash
npx prisma db push
```

O `npx prisma db seed` continua seguro: o upsert de categorias só grava a
porteira de plano quando o mapa `CATEGORY_MIN_PLAN` do seed define um valor, e
ele nasce **vazio**. Restrição configurada no painel Admin não é apagada.

---

## 1. Revisão do código recebido — dois defeitos não documentados

Tudo o que está em `RODADA-3-MUDANCAS.md` confere. Ao ler o código, apareceram
dois problemas que não estavam no changelog.

### 1.1 `AEViewClient` chamava o engine com assinatura antiga

```ts
const errs = validateAEInputs(ei, variablesMap, packages || []);
const est  = calculateAEEstimate(ei, variablesMap, packages || []);
```

As duas funções recebem **um** argumento. Em JavaScript os extras são ignorados
em silêncio, então parecia funcionar. Mas o arquivo depois lia `est.total`,
`est.needsSC` e `est.variables` — nenhum deles existe na saída do engine, que
devolve `totalHours`, `requiresSalesEngineer` e nada de `variables`.

Consequências:

- `estimation.total` vinha `undefined` e caía no `resultHours` gravado **por
  sorte** (`estimation?.total ?? resultHours`);
- a seção 9 do relatório da estimativa salva imprimia **sempre** "dentro dos
  limites", mesmo em estimativa que exigia Sales Engineer;
- `calculateAEEstimate` **lança** quando os inputs são inválidos, e o resultado
  nunca era protegido: uma estimativa antiga incompleta derrubava a página.

Corrigido: chamada com um argumento, validação respeitada antes da chamada,
`try/catch` com fallback, e uma ponte explícita traduzindo `totalHours` →
`total`, `requiresSalesEngineer` → `needsSC` e montando `variables`.

### 1.2 `calculateVariable` é código morto — as tags de incidência não fazem nada

`ProjectEditorClient` define `calculateVariable` e **nunca a chama**. É a única
função que lê `Package.excludedFromVariables`, `Variable.targetItems`,
`Variable.targetCategories` e `Variable.excludedItems`.

Portanto, hoje: **toda regra de incidência configurada no painel Admin não afeta
nenhum número do app.** Discovery e Validação incidem sobre todo o Setup, e o GP
sobre todo o consolidado, independentemente das tags.

Nada foi alterado nos totais — mudaria valores de estimativas existentes e é
decisão de produto. Mas o toggle do item 4 (abaixo) é o **primeiro lugar do app
onde essas tags surtem efeito**, e a rodada 6 deveria decidir se o cálculo
principal passa a respeitá-las.

---

## 2. Relatório Executivo restrito a administradores

`canViewExecutiveReport()` em `lib/segments.ts`, aplicado na Calculadora
(`app/ae/AEClient.tsx`) e na estimativa salva (`app/ae/[id]/AEViewClient.tsx`).

Quem não é admin não vê o card e **o markdown nem é montado** — não faz sentido
gerar e guardar em estado um texto que não vai aparecer.

A tabela de resultado continua para todos, com o comportamento que já existia:
visão reduzida para o Account Executive, completa para os demais. Essa regra
saiu de dentro do componente para `usesSimplifiedAETable()`, ao lado do resto da
matriz de acesso — se amanhã Sales Ops ou Customer Success também devem ter a
visão reduzida, é uma linha.

> Não há barreira de servidor aqui, e não precisa haver: o relatório só contém
> dados dos próprios inputs mais as regras do engine, e `lib/ae-engine.ts` já vai
> para o browser porque é importado num client component. A mudança é de
> apresentação, não de segurança.

---

## 3. Três segmentos novos

`SALES_OPS`, `CS` e `DEV` em `lib/segments.ts`, com rótulo, sigla e apelidos de
grafia legada.

| Segmento | Escopo | Calculadora AE | Admin | Relatório Exec. |
| :--- | :---: | :---: | :---: | :---: |
| Sales Ops | sim | sim | não | não |
| Customer Success | sim | sim | não | não |
| Developer | sim | não | não | não |

Sales Ops e Customer Success espelham a linha do PM (apoiam o ciclo comercial e
precisam ver estimativa e escopo); Developer espelha Implantação (consome o
escopo técnico, mas não dimensiona pré-venda). **As três linhas são propostas** —
marcadas como tal no comentário da matriz, igual ao que foi feito com PM e IMPL.

### Atenção: `DEV` mudou de significado

Antes, `DEV` era um valor **legado** que o mapa normalizava para `IMPL`
("Desenvolvimento"). Agora `DEV` é um segmento próprio, e `DESENVOLVIMENTO`
passou a apontar para ele — que é o destino semanticamente correto.

Como a migração de segmentos já rodou, a coluna `role` só deveria conter os
cinco valores canônicos. Mas se alguma linha ainda tiver `role = 'DEV'` com o
sentido antigo, ela passa a ler **Developer** em vez de Implantação. Vale um
`SELECT role, count(*) FROM "User" GROUP BY role` antes de subir.

---

## 4. Toggle de horas proporcionais no detalhamento por categoria

Toggle **"Incluir horas proporcionais de Discovery, GP e validação"** dentro da
seção de detalhamento. Desligado, o comportamento é o que já existia.

### Como a repartição funciona

Discovery e Validação incidem sobre o **Setup** (`setupBaseParaVariaveis`), e o
GP sobre o **consolidado** — nenhum dos três incide sobre as horas de cada item.
Então "horas proporcionais por categoria" exige uma regra de repartição:

> Cada categoria recebe a fatia da variável correspondente à sua participação na
> **base elegível** daquela variável.

O valor repartido é o **já calculado** no bloco "Resumo de horas" (respeitando
override manual), não um recálculo. Isso dá a propriedade que importa: **a soma
das contribuições é exatamente igual ao total do resumo.** O toggle nunca cria
nem destrói hora — apenas mostra onde ela cai.

### As tags de não incidência são respeitadas

Item marcado como fora de uma variável (via `excludedFromVariables`, ou pelos
`targetItems`/`targetCategories`/`excludedItems` da variável) sai do
**denominador** daquela variável. Uma categoria inteiramente não incidente
recebe 0 e as demais absorvem a diferença.

Como explicado em 1.2, essas tags não afetam os totais do resumo. Não há
contradição: elas mudam a **distribuição**, nunca a soma. Mas é bom saber que o
toggle e o resumo enxergam as tags de maneira diferente.

### Exibição

Ligado, cada categoria e subcategoria mostra o total com as variáveis somadas e,
abaixo, a decomposição: base, `+D`, `+V`, `+GP`, em cores distintas. O cabeçalho
da seção mostra o percentual e o total de cada variável sendo distribuído. As
subcategorias continuam fechando com a categoria.

### Conferência feita

Quatro cenários testados: elegibilidade total (repartição fecha 100% nas três
variáveis, subcategorias somam a categoria, Support com 30h de 50h recebe 60% do
Discovery); categoria marcada fora de Discovery (recebe 0, a outra absorve os
10h, e Validação/GP continuam normais); ninguém elegível (sem `NaN`, contribuição
0, total não infla); toggle desligado (reproduz os números originais).

---

## 5. Bug da nova versão da Calculadora AE — corrigido

### O que acontecia

Criar uma estimativa que exige SE, depois criar uma **nova versão** pequena o
suficiente para mostrar horas: a tela exibia a mensagem de SE e a tabela da
versão anterior. O registro salvo no banco estava **certo** — só a tela mentia.

### Causa

`saveAEEstimateAction` termina com `revalidatePath('/ae')`. Isso faz o Next
refazer o payload RSC da rota atual (`/ae?cloneFrom=X`), e `initialData` chega
como um **objeto novo**. O efeito de hidratação do formulário dependia da
identidade do objeto:

```ts
}, [initialData, initialClientName]);
```

Então ele rodava de novo e sobrescrevia os inputs reduzidos com a configuração
da versão clonada. `showResult` continuava `true` (o efeito só chama
`resetForm()` quando não há `initialData`), e o painel renderizava a partir do
estado revertido.

Agravante: `setEngineResult` e `setEngineInputsState` eram chamados **dentro do
`useMemo`** de `estimation` — atualização de estado em fase de render. A tabela
era derivada do estado vivo, não do que havia sido calculado.

### Correção, em três partes

1. **Chave estável de hidratação.** `initialDataKey` serializa o conteúdo de
   `initialData` + cliente + `cloneFromId`, e um `useRef` guarda a última chave
   hidratada. A reidratação só ocorre quando os dados **realmente** mudam.
2. **Snapshot do resultado.** `resultSnapshot` congela engine, inputs, total,
   horas técnicas, `needsSC` e variáveis no instante do cálculo. Todo o painel
   passou a ler dele (`shown.*`), nunca do `estimation` vivo.
3. **Fim do setState em render.** `engineResult` sai do `useMemo` como valor de
   retorno.

O painel agora exibe exatamente o que foi calculado e salvo.

---

## 6. Plano Zendesk mínimo por categoria

Porteira **independente** da dos itens: abaixo do mínimo, a categoria inteira
desaparece do framework — mesmo que algum item dentro dela não tenha restrição
própria. É o que faz uma categoria como ADPP não aparecer fora do Suite
Enterprise, em vez de aparecer vazia.

As duas regras se somam: o item também precisa passar no próprio mínimo. Nenhuma
afrouxa a outra.

**Painel Admin** — dois seletores no editor da categoria (`Plano mín. da
categoria (CS)` / `(ES)`) mais uma explicação curta. Vazio = sem restrição. A
lista de categorias mostra selos `CS Enterprise+` / `ES Enterprise+`, para a
porteira ser visível sem abrir o editor.

**Página do framework** — a porteira é aplicada em **cinco** lugares, porque
aplicar em menos deixa incoerência:

1. o dropdown de módulos;
2. a renderização das seções;
3. a **busca** — item fora do plano deixou de ser retornado, porque clicar no
   resultado levava a uma seção que não está na tela;
4. o motor de cálculo;
5. a base dos percentuais.

Um selo vermelho ao lado dos seletores nomeia as categorias que o tier está
escondendo, para que nada desapareça em silêncio.

> `orderedCategories` continua sendo a lista **completa**, de propósito: é ela
> que a reordenação usa. `visibleCategories` é a filtrada, usada só na exibição.
> Assim, categoria escondida pelo plano não perde a posição salva quando o tier
> volta.

---

## 7. Escopo Técnico — botão "Copiar como prompt" + skill `scope-creator`

Fluxo novo: no site, o botão copia todos os dados da versão salva como um prompt;
na Claude, a skill `scope-creator` transforma isso num `.docx` pré-preenchido a
partir do template, **sem alterar a formatação**. A cópia é manual por decisão de
projeto — nenhuma chamada de API.

### `lib/scope-export.ts`

`buildScopePrompt()` puro e testável, mais a tabela `SUPPRESSION_FLAGS` com 22
flags. Cada flag carrega um campo `governs` nomeando o trecho exato do template
que ela controla — a tabela é a documentação.

Seções emitidas: `[PROJETO]`, `[CRM]`, `[DIMENSIONAMENTO]`, `[PLATAFORMA]`,
`[MÓDULOS EM ESCOPO]`, `[CANAIS EM ESCOPO]`, `[INTEGRAÇÕES E APPS]`,
`[FLAGS DE SUPRESSÃO]`, `[DETALHAMENTO POR CATEGORIA]`, `[ITENS SELECIONADOS]`.

Três decisões de formato:

- **Blocos `Rótulo: valor`, não JSON.** O SE vai revisar e ajustar o texto antes
  de colar, e JSON editado à mão quebra.
- **A regra de precedência viaja dentro do texto copiado**, não só na skill.
  Assim ela vale mesmo que a skill seja editada depois.
- **`[CRM]` já é emitida**, com todos os campos do Zoho marcados
  `(pendente — Zoho)`. A fase 2 só precisa preencher `input.crm` — sem mudar o
  formato nem a skill.

Detecção de módulos e canais deriva das **categorias que têm hora**, não de uma
lista fixa de módulos, então sobrevive a mudanças na biblioteca. As flags
`desenvolvimento` e `design` vêm das **horas por skill**, não de palavra-chave —
é esse o sinal correto para decidir se a seção 5.3 (Premissas de
Desenvolvimento) fica no documento.

Saída medida num cenário realista: **130 linhas, 4,6 KB**.

### Onde ficou o botão

- **Framework** (`ProjectEditorClient`) — na barra de ações. Recusa exportar
  rascunho não salvo: o escopo descreve a versão salva, e exportar rascunho como
  se fosse versão seria pior que recusar.
- **Calculadora AE** (`AEClient`) — abaixo da tabela de resultado, saindo do
  snapshot congelado. Mesmo envelope, com `ORIGEM: calculadora-ae` e
  `TEMPLATE: escopo-padrao-60h`.

### A skill

```
scope-creator/
├── SKILL.md                            (247 linhas)
├── references/mapeamento-templates.md  (296 linhas)
├── scripts/fill_scope.py               (508 linhas)
└── assets/  pacote-de-horas.docx + escopo-padrao-60h.docx
```

`fill_scope.py` copia o `.docx` inteiro e reescreve **apenas**
`word/document.xml`. Verificado por hash: estilos, numeração, cabeçalho, rodapé,
fontes e mídia ficam **byte a byte idênticos**. Valida o XML antes de gravar —
XML inválido aborta sem produzir arquivo.

Operações: `replace` (global), `replace_once` (primeira ocorrência),
`replace_nth` (N-ésima), `delete_paragraphs` (substring) e `delete_between`
(faixa, casamento exato, com limite).

### Quatro defeitos que só o teste encontrou

1. **`merge_runs` destruía `<w:hyperlink>`.** Juntar runs fragmentados é
   necessário (senão o placeholder não existe como string contígua no XML), mas a
   primeira versão reconstruía o parágrafo a partir dos runs e apagava o que
   estava **entre** eles. Hyperlinks caíram de 26 para 21 e o arquivo não abria.
   Agora o parágrafo é tokenizado em gap/run/gap e só se mesclam runs sem nada no
   meio.
2. **Exclusão de parágrafo deixava âncora de comentário órfã** —
   `commentRangeStart` sem o `End`, que é exatamente o que faz o Word acusar
   arquivo corrompido. `fix_comment_orphans` remove os pares incompletos.
3. **`delete_between` por substring comeu 187 parágrafos.** "Zendesk AI Agents"
   é título em três lugares; a faixa abriu no primeiro e passou longe do fim.
   Agora o casamento é **exato** e há um `max` que aborta em vez de mutilar o
   documento. Foi assim que se descobriu que o título real é
   `5.3··Premissas - Desenvolvimento`, com **dois** espaços.
4. **Remover subseção numerada deixa buraco visível** (`3.1.2` seguido de
   `3.1.4`), porque a numeração é texto digitado, não campo do Word. E o Sumário
   é estático, com números de página à mão: seção removida continua listada e a
   paginação erra. A skill agora renumera (de baixo para cima, porque `replace` é
   global) e avisa para conferir o Sumário — sem tentar chutar página.

### Armadilha de mapeamento

Os dois templates usam **convenções de colchete diferentes**: no template A a
Ficha é `[...]` e as dores são `[[...]]`; no B é `[[...]]` em tudo. Errar troca
só o miolo e entrega documento com colchete à vista. Está tabelado no
`mapeamento-templates.md`.

### Conferência

Os dois templates preenchidos e verificados: XML válido; **só
`word/document.xml`** difere do original; contagens de `bookmarkStart/End`,
`commentRange*`, `tbl`, `tr`, `tc`, `sectPr` e `hyperlink` idênticas às do
template. Renderizado em PDF e inspecionado: capa com logo, Bebas Neue, filetes
verdes e paginação do rodapé intactos; Ficha preenchida com os três campos do
Zoho deliberadamente como placeholder; tabela de configurações do template B
mostrando só plano, SKU, módulos e canais selecionados.

`paragraph_text` foi conferida contra um parser XML real nos 537 parágrafos do
template A: **zero divergência**.

---

## Pendências desta rodada

- **Fase 2 do Zoho** — preencher `ScopeExportInput.crm`. Nada mais muda.
- **Templates em inglês** — quando existirem, entram em `assets/` e o campo
  `IDIOMA DE SAÍDA` do envelope passa a decidir. Hoje a saída é sempre pt-BR.
- **`calculateVariable` morta** (ver 1.2) — decidir se os totais passam a
  respeitar as tags de incidência.
- **Matriz de acesso dos três segmentos novos** — confirmar com o time.
