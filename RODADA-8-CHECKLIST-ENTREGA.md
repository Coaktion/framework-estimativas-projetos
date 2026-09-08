# Rodada 8 — Checklist de entrega

Para quem vai subir. **Sem migração de banco nesta rodada** — só código.

> Se você está vindo da Rodada 7 e ainda não subiu nada, leia primeiro o
> `RODADA-7-CHECKLIST-IMPLANTACAO.md`: é lá que está a coluna nova
> (`ProjectVersion.totalHours`) e o `prisma db push`.

---

## 1 · Arquivos a substituir

```
lib/ae-engine.ts
lib/ae-result-table.ts
lib/ae-scope-prompt.ts
lib/scope-export.ts
app/ae/AEClient.tsx
app/ae/actions.ts
app/ae/[id]/AEViewClient.tsx
app/i18n/locales/pt/common.json
app/i18n/locales/en/common.json
```

Documentação (não afeta o build):

```
RODADA-8-MUDANCAS.md
RODADA-8-ANALISE-SIMULACOES.md
RODADA-8-CHECKLIST-ENTREGA.md
```

Nenhum arquivo novo de código. Nenhuma dependência nova.

---

## 2 · Banco

**Nada a fazer.** Nenhuma alteração de schema nesta rodada.

---

## 3 · Build

```bash
npm install
npm run build
```

O TypeScript foi conferido à parte e está limpo — zero erros novos em relação
ao código original. Lembrando que o `next.config.js` mantém
`ignoreBuildErrors: true`, então o build não falharia por tipo de qualquer
forma.

---

## 4 · Testes de fumaça

### Travas de plano — o mais importante desta rodada

Abra `/ae` e teste cada caso. O botão de calcular fica **desabilitado** e a
mensagem aparece no bloco "Antes de calcular".

- [ ] **Team + 2 formulários web** → bloqueia com
      *"O plano Team permite apenas um único formulário web."*
- [ ] **Team + 2 marcas** → bloqueia com
      *"O plano Team permite apenas uma única marca."*
- [ ] **Team + 3 marcas + 4 formulários** → mostra **as duas** mensagens juntas.
- [ ] **Team + 1 marca + 1 formulário** → calcula normalmente.
- [ ] **Growth + 6 marcas** → bloqueia com
      *"Suite Growth permite no máximo 5 marcas."*
- [ ] **Growth + 5 marcas** → calcula normalmente.
- [ ] **Professional + 6 marcas** → bloqueia, citando *Suite Professional*.
- [ ] **Enterprise + 12 marcas** → calcula normalmente (sem teto).
- [ ] **Growth + 9 formulários web** → calcula normalmente (só Team tem teto de
      formulário).
- [ ] Troque a interface para **inglês** e confira que as mensagens aparecem em
      inglês. Antes elas vinham sempre em inglês, mesmo em português.

### Item novo "Formulários"

- [ ] Em qualquer plano acima de Team, a tabela de resultado traz uma linha
      **"Formulários"** dentro da configuração de Support.
- [ ] A linha **"Canal: Formulário web"** **não** aparece mais no Setup base.
- [ ] Em **Team**, a quantidade de Formulários é sempre **1**, independentemente
      de áreas e marcas.
- [ ] Confira o "pegue o maior" com um caso fácil: Growth, **4 áreas, 2 marcas,
      1 operação, 1 formulário web** → deve dar **4 formulários**
      (`4 × 0,5 × 2 = 4`, que vence as outras duas leituras).

### Condicionais de campo

- [ ] Em **Team**, a linha "Condicionais de campos" mostra quantidade **0** (ou
      não aparece).
- [ ] Em Growth ou acima, continua sendo metade dos campos de ticket.

### Multi-idioma removido

- [ ] O campo **"Idiomas da Operação"** sumiu da tela de serviços adicionais.
- [ ] Nenhuma linha de **"Conteúdo dinâmico"** na tabela de resultado.
- [ ] No Relatório Executivo (visível só para admin), não existe mais a seção de
      idiomas/conteúdo dinâmico.

### Prompt

- [ ] Copie o prompt com a interface em **português**: confira
      `IDIOMA DE SAÍDA: pt-BR`.
- [ ] Troque para **inglês** e copie de novo: o texto tem de sair **exatamente
      igual**, ainda em português, com `IDIOMA DE SAÍDA: pt-BR`. **Isso é o
      comportamento correto** — o inglês volta quando existir template próprio.
- [ ] Confira que a linha `Tipo de projeto:` aparece, tanto com "Nova
      implantação" quanto com "Otimização".
- [ ] Copie também pela tela de estimativa salva (`/ae/history` → abrir uma
      estimativa) e confira que o botão está lá e gera o mesmo bloco.

### Sanidade de cálculo

- [ ] Monte uma estimativa média (Professional, 20 agentes, 2 marcas, 4 áreas,
      Support + Knowledge + Analytics) e confira que **cada seção fecha**: a
      soma das linhas bate com o subtotal exibido.
- [ ] Compare o total com o que a versão anterior dava. Esperado: **algo entre
      2% e 4% mais baixo**. Se der uma diferença muito maior, avise antes de
      liberar.

---

## 5 · Depois de subir

- [ ] Mandar a planilha `Calculadora-AE-Logica-de-Calculo-v2.xlsx` para quem
      valida as regras. As linhas **verdes** são itens novos e as **amarelas**
      são fórmulas que mudaram — dá para filtrar pela coluna "Rodada 8".
- [ ] Repassar ao time de AE dois avisos práticos:
      1. Estimativas em Team com mais de uma marca ou mais de um formulário
         **não calculam mais** — é limite do plano Zendesk, não bug.
      2. Os totais caíram cerca de 2% na média. Projetos que estavam raspando os
         60h podem passar a sair sem revisão de Sales Engineer.

---

## 6 · Dois pontos em aberto (não são bloqueio)

Estão detalhados no `RODADA-8-ANALISE-SIMULACOES.md`, mas resumindo:

1. **WFM subiu de 30% a 80%** em projetos onde há mais áreas do que marcas. A
   mudança em Localizações foi pedida e está certa; o que amplifica é a fórmula
   de **Automações WFM**, que não foi revisada. Vale validar contra um projeto
   real antes de usar em cliente.
2. **O degrau de 60h do Sales Engineer** ficou mais fácil de escapar, já que a
   base caiu ~2%. Dois cenários de teste que exigiam revisão deixaram de exigir.

---

## Rollback

Reverter os arquivos do passo 1 e rebuildar. Não há nada no banco para desfazer.
