# Rodada 7 — Checklist de implantação

Para quem vai subir. Ordem importa nos passos 1 a 3.

---

## Antes de começar

- [ ] Backup do banco. Há uma coluna nova; é aditiva, mas backup é backup.
- [ ] Confirmar que `DATABASE_URL` aponta para o ambiente certo.

---

## 1 · Arquivos alterados

Substituir por completo:

```
lib/ae-engine.ts
lib/ae-result-table.ts
lib/scope-export.ts
lib/segments.ts
app/ae/AEClient.tsx
app/ae/actions.ts
app/ae/[id]/AEViewClient.tsx
app/sc/page.tsx
app/sc/ProjectDashboardClient.tsx
app/sc/project/[id]/actions.ts
app/sc/project/[id]/ProjectEditorClient.tsx
app/i18n/locales/pt/common.json
app/i18n/locales/en/common.json
prisma/schema.prisma
```

Arquivo **novo**:

```
lib/ae-scope-prompt.ts
```

Documentação (não afeta build):

```
RODADA-7-MUDANCAS.md
RODADA-7-CHECKLIST-IMPLANTACAO.md
```

---

## 2 · Banco

Uma coluna nova em `ProjectVersion`:

```prisma
totalHours  Float  @default(0)
```

```bash
npx prisma generate
npx prisma db push
```

Aditiva e com default — **não há perda de dado**. Versões antigas ficam com `0`
e passam a ter total no próximo salvamento.

> O `npm run build` do projeto já roda `prisma generate && prisma db push`. Se o
> deploy usa esse script, os comandos acima são só para validar antes.

---

## 3 · Build

```bash
npm install
npm run build
```

Sem dependência nova. `next.config.js` mantém `ignoreBuildErrors: true`, então o
build **não** falha por tipo — a verificação de TypeScript foi feita à parte e
está limpa (zero erros novos contra a base original).

---

## 4 · Testes de fumaça

### Calculadora AE

- [ ] `/ae` — a lista de módulos **não** traz "AI Agents".
- [ ] Marcar Analytics — **não** aparece seletor de treinamento Básico/Avançado.
- [ ] Marcar Knowledge com **0 artigos** → tabela mostra uma linha
      `Configuração geral: Knowledge (0 artigos)` = **2,0h**. Não deve existir
      uma segunda linha de Knowledge de 0,1h.
- [ ] Knowledge com **60 artigos** → `Configuração geral: Knowledge (60 artigos)`
      = **6,0h**.
- [ ] Calcular e conferir que o subtotal da seção fecha com a soma das linhas.

### Estimativas antigas

- [ ] Abrir por `/ae/history` uma estimativa **anterior** que tivesse AI Agents.
      Deve abrir normalmente, sem AI Agents na tabela, com total recalculado
      menor. **Esperado** — ver "Impacto em dados existentes" no changelog.
- [ ] O botão **"Copiar como prompt"** aparece no cabeçalho dessa tela.

### Prompt

- [ ] Copiar o prompt (Calculadora AE) e conferir:
      - não existe seção `[CRM]`;
      - existe `[CONTEXTO DO CLIENTE]` quando os campos de objetivos/indicadores
        estão preenchidos, e **não** existe quando estão vazios;
      - `IDIOMA DE SAÍDA: pt-BR`.
- [ ] Trocar a interface para **inglês**, copiar de novo:
      - a instrução do topo está em inglês;
      - `IDIOMA DE SAÍDA: en-US`;
      - as tags `[PROJETO]`, `[DIMENSIONAMENTO]`… continuam em português
        (**correto** — são chaves de parse, ver changelog item 11).

### Framework

- [ ] `/sc/project/{id}` — o primeiro bloco traz o toggle
      **Nova implantação / Otimização**.
- [ ] Escolher "Otimização", salvar, reabrir a versão: a escolha persistiu.
- [ ] O **Detalhamento por Categoria** aparece **depois** do Resumo de Horas e
      começa recolhido.
- [ ] Abrir o detalhamento e ligar o toggle de horas proporcionais: as colunas
      têm cabeçalho (`Base`, `Discovery`, `Validação`, `GP`, `Total`), os números
      ficam alinhados e o rodapé fecha com o total.
- [ ] Conferir em tela estreita (ou reduzindo a janela) que cada número imprime
      o próprio rótulo.
- [ ] Salvar uma versão e conferir que o **link do Zoho** persiste ao reabrir
      (era o bug corrigido de passagem).

### Projetos

- [ ] `/sc` — cada card mostra os chips de versão. Depois de salvar ao menos uma
      versão nova, o chip traz horas (`V3 · 148h`).
- [ ] Chips de versões **antigas** mostram só `V1`, sem horas. **Esperado.**
- [ ] Clicar num chip abre `?version_id=` daquela versão.

### Admin

- [ ] Painel de usuários → o seletor de segmento traz **Solution Designer**.
- [ ] Atribuir o segmento a um usuário de teste e confirmar que ele acessa
      Projetos e Calculadora AE, e **não** acessa o Admin nem o Relatório
      Executivo.

---

## 5 · Depois de subir

- [ ] Avisar o time de AE que estimativas antigas com AI Agents, Analytics
      avançado ou Knowledge vão exibir totais menores ao reabrir, e que o total
      **gravado** não mudou.
- [ ] Repassar a planilha `Calculadora-AE-Logica-de-Calculo.xlsx` a quem valida
      as regras de cálculo.

---

## Rollback

Reverter os arquivos do passo 1 e rebuildar. A coluna `totalHours` pode ficar no
banco sem efeito — nenhum código antigo a lê, e o default `0` não quebra
`INSERT`. Não é preciso dropar nada.
