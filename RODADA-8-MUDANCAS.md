# Rodada 8 — Mudanças

Recalibração das fórmulas da Calculadora AE, travas de plano, remoção do
multi-idioma e trava do prompt em pt-BR.

**Resumo de risco:** nenhuma migração de banco. Todas as mudanças são de
cálculo e de UI. Como o app ainda não subiu, estimativas antigas não são
preocupação — mas o efeito das novas fórmulas está medido em 24 cenários (ver
`RODADA-8-ANALISE-SIMULACOES.md`).

---

## 1 · Tipo de projeto no prompt copiado

Já implementado na Rodada 7 e verificado agora nas duas telas da Calculadora AE
(cálculo novo e estimativa salva) e no Framework. Sai na seção `[PROJETO]`:

```
Tipo de projeto: Nova implantação
Tipo de projeto: Otimização
```

---

## 2 · Novo item "Formulários" no lugar de "Canal: Formulário web"

O canal media só os formulários **publicados ao usuário final**. O item novo
mede o **total de formulários criados** — mesmo um projeto sem nenhum
formulário voltado ao cliente precisa de formulários internos.

```
SE plano = Team      → 1
SENÃO                → MAX( Áreas × 0,5 × Marcas ; QtdOperações ; QtdFormuláriosWeb )
```

Condição: Support selecionado. **0,08h por unidade** (mesma tarifa do canal
antigo).

**Onde ficou.** Saiu do "Setup base" e entrou na **configuração de Support**.
Deixou de ser um item de canal e virou um item de estrutura do escopo — é dele
que quatro outras fórmulas passam a depender. O canal `web_form` continua
existindo como canal selecionável e continua pesando 10 pontos em Campos de
Ticket; só não tem mais linha de cobrança própria.

**Como a regra se comporta na prática** (medido):

| Cenário | Estrutura | Operações | Web forms | Vence |
| :--- | ---: | ---: | ---: | :--- |
| Growth, 1 área, 1 marca, 1 op, 1 form | 0,5 | 1 | 1 | operações |
| Growth, 4 áreas, 2 marcas, 1 op, 1 form | 4,0 | 1 | 1 | estrutura |
| Growth, 3 áreas, 1 marca, 1 op, 2 forms | 1,5 | 1 | 2 | web forms |
| Professional, 6 áreas, 3 marcas, 2 ops | 9,0 | 2 | 2 | estrutura |

As três leituras se revezam — nenhuma domina, que é o ponto do "pegue o maior".

---

## 3 a 9 · Fórmulas recalibradas

| Item | Antes | Depois |
| :--- | :--- | :--- |
| Visualizações | `12 + 0,1×CT×Ár + 5×[Copilot]` | `12 + Form + 0,1×CT×Ár + 5×[Copilot]` |
| Gatilhos simples | `3 + (CT×0,2 + TC×(3+2×[Copilot]))` | `3 + CT×0,05×Form + TC×(3+2×[Copilot])` |
| Automações simples | `3 + (GS+GC) × 0,3` | `3 + (GS+GC) × 0,1` |
| Políticas de SLA | `(QC×(0,3+0,7×M) + Grupos) × Fator` | `(QC×(0,7+0,3×M) + Grupos + Form) × Fator` |
| Saudações | `6 × IVR` | `4,5 × IVR` |
| Intenções | `4 + CT×0,1×(1+0,2×[QA])×O` | `4 + CT×0,2×(1+0,2×[QA])×O` |
| Localizações (WFM) | `Marcas × Operações` | `Áreas × Operações` |

Efeito medido nas quantidades, média de 24 cenários:

```
formularios           novo -> 3,40
visualizacoes        25,41 -> 28,81   +13,4%
gatilhos_simples     20,00 -> 20,35    +1,8%
automacoes_simples   10,50 ->  5,54   -47,2%
politicas_sla        17,21 -> 18,65    +8,4%
saudacoes             6,00 ->  4,50   -25,0%
intencoes             9,02 -> 14,03   +55,6%
wfm_localizacoes      2,29 ->  4,75  +107,3%
condicionais_campos  16,66 -> 15,20    -8,8%
```

---

## 10 · Condicionais de campo só de Growth para cima

`condicionais_campos = 0` em Suite Team. O plano não tem o recurso; antes a
linha cobrava horas por algo que o cliente não conseguiria configurar.

---

## 11, 12, 13 · Travas de plano

O cálculo é **bloqueado** e a mensagem aparece na lista "Antes de calcular":

| Plano | Regra | Mensagem |
| :--- | :--- | :--- |
| Team | Formulários web > 1 | O plano Team permite apenas um único formulário web. |
| Team | Marcas > 1 | O plano Team permite apenas uma única marca. |
| Growth / Professional | Marcas > 5 | *{plano}* permite no máximo 5 marcas. |
| Enterprise | — | sem teto |

Os limites vivem em `BRAND_LIMIT_BY_PLAN` e `WEB_FORM_LIMIT_BY_PLAN`, tabelas
no topo de `lib/ae-engine.ts` — mudar um teto é editar um número.

### Mensagens de validação agora são traduzidas

Efeito colateral necessário. A validação devolvia frases em inglês cravadas no
engine, que apareciam em inglês mesmo com a interface em português.
`AEValidationResult` passou a carregar `issues: { code, params, message }`, e a
UI monta o texto com `t('aeValidation.' + code, params)`. As doze mensagens
existem nos dois idiomas. O campo `errors: string[]` continua existindo para
quem já o consumia.

---

## 14 · Multi-idioma / conteúdo dinâmico removido

Saiu por completo: o campo "Idiomas da Operação" da tela, `operationLanguages`
do engine e dos inputs, a tarifa `conteudo_dinamico`, o grupo
`operationLanguages` do breakdown, as linhas de detalhe, a seção 6.5 do
Relatório Executivo, a persistência e as chaves de i18n.

Era a única linha do cálculo sem porteira de módulo — um escopo só de Voice
gerava conteúdo dinâmico derivado de quantidades de Support que não estavam
contratadas.

---

## 15 · App Condicionais Avançadas

```
0,33 + ( Visualizações×0,1 + GatilhosSimples×0,125 + Formulários ) × 0,25
```

---

## 16 · Prompt travado em português

`LOCK_OUTPUT_TO_PT = true` em `lib/scope-export.ts`. O prompt sai inteiro em
pt-BR independentemente do idioma da interface, e `IDIOMA DE SAÍDA` diz sempre
`pt-BR`. Verificado: `locale: 'en'` produz texto **byte a byte idêntico** ao
`locale: 'pt'`.

Motivo: a skill `scope-creator` tem um único template, em pt-BR. Um prompt em
inglês pedindo documento em inglês produziria um `.docx` meio traduzido, com a
estrutura de um template que não existe.

A mecânica de tradução continua montada — `PROSE.en` está completo no arquivo e
os chamadores já passam o idioma. Ligar o inglês, quando houver template e
skill próprios, é trocar `true` por `false`.

---

## Verificação

- **TypeScript**: `tsc` na base inteira, comparado com o baseline original.
  **Zero erros novos.**
- **Travas de plano**: 10 casos, todos passando — Team com 1 e com 2
  formulários, Team com 2 e 3 marcas, Growth com 5 e 6, Professional com 5 e 6,
  Growth com 9 formulários (permitido), Enterprise com 12 marcas (permitido).
- **Tabela de resultado**: todas as seções fecham — `qtd × unitário = horas` em
  cada linha e a soma das linhas bate com o subtotal.
- **Prompt**: 10 asserções, incluindo a igualdade byte a byte entre `pt` e `en`.
- **Simulações**: 24 cenários baixo/médio, engine anterior contra o novo. Ver
  `RODADA-8-ANALISE-SIMULACOES.md`.
- **Planilha**: auditoria cruzada — todas as 51 chaves de `horas_unitarias`, 8
  de `configuracoes_gerais`, 7 de `treinamentos`, 5 de `workshops`, 10 de
  `apps` e 10 de itens fixos têm linha correspondente.

---

## Arquivos alterados

```
lib/ae-engine.ts              fórmulas, formulários, travas de plano, purga do multi-idioma
lib/ae-result-table.ts        linha de Formulários, remoção do conteúdo dinâmico
lib/scope-export.ts           LOCK_OUTPUT_TO_PT
lib/ae-scope-prompt.ts        remoção do grupo multi-idioma
app/ae/AEClient.tsx           campo de idiomas, seções do relatório, validação traduzida
app/ae/[id]/AEViewClient.tsx  remoção do multi-idioma
app/ae/actions.ts             remoção do multi-idioma da persistência
app/i18n/locales/pt/common.json   +aeValidation, +cfg.forms, −chaves de multi-idioma
app/i18n/locales/en/common.json   idem
```

Nenhum arquivo novo. Nenhuma mudança de schema.
