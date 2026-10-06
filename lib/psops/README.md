# Pre-Sales Ops

Monitora as novidades do Zendesk (API pública do Help Center) e transforma cada
mudança que o time julgar relevante em atividades com Definition of Done para
manter atualizados os ativos de pré-venda: **ambiente de demo**, **framework de
estimativa** e **blocos de escopo técnico**, além de uma **ficha de estudo** da
feature.

Segue o mesmo padrão do ZD Auto Config dentro do Tool Center.

## Onde está cada coisa

| | |
|---|---|
| telas | `app/pre-sales-ops/` (Fila de Triagem pronta; Backlog, Mapa de Artefatos e Radar ainda são placeholders) |
| API | `app/api/pre-sales-ops/` (15 rotas, todas exigem sessão + acesso) |
| lógica (servidor) | `lib/psops/` (ingestão, classificação, triagem, artefatos, reconciliação) |
| tipos do cliente | `lib/psops/client/` (seguro para o browser) |
| componentes | `components/psops/` |
| tabelas | `psops_*` no fim de `prisma/schema.prisma` (só acrescenta, não toca em model existente) |
| textos | bloco `psops` em `app/i18n/locales/{pt,en}/common.json` |
| agendamento | `netlify/functions/psops-collect.mts` (07:00 BRT) e `psops-reconcile.mts` (01:00 BRT) |
| quem acessa | `canAccessPreSalesOps` em `lib/segments.ts`: ADMIN e SC. Coletar e definir donos: só admin |

## Testar na homologação

1. Push na `development` → o Netlify publica em `development--aktienowtc.netlify.app`.
   O build roda `prisma db push`, que cria as tabelas `psops_*`.
2. Entrar com um usuário ADMIN → menu **Pre-Sales Ops**.
3. **Coletar agora**: semeia fontes e artefatos (idempotente) e busca as
   novidades. Uma release note semanal costuma render de 20 a 60 sinais; se vier
   bem menos, o parser (`lib/psops/ingest/parser.ts`, H2 = produto, H4 =
   componente) precisa de ajuste.
4. Triar com o teclado: `↑ ↓` navega, `1 2 3 4` marca Estudo, Demo, Estimativa,
   Escopo, `Enter` gera, `X` descarta (pede motivo).

**Funções agendadas não rodam em branch deploy** — o Netlify só as dispara na
publicação de produção. Na homologação, a coleta é pelo botão.

## Variáveis de ambiente

- `PSOPS_INGEST_SECRET` (≥ 16 caracteres): o agendador manda no header
  `x-psops-secret`. Sem ela, a coleta agendada falha e só o botão funciona.
- As demais `PSOPS_*` têm padrão; ver `.env.example` e `lib/psops/lib/env.ts`.

## Testes

```bash
npm run psops:test   # 64 testes, sem banco e sem rede
```

Usam o test runner do Node (via `tsx`), não o Jest — por isso `lib/psops` está
em `testPathIgnorePatterns` no `jest.config.ts`.

## Decisões que valem saber

- **Ids de pessoa são texto, sem relação com `User`** (`donoId`, `responsavelId`
  …). Assim o módulo não altera o model `User` e o `db push` não mexe em tabela
  existente. Os nomes são resolvidos em `services/usuarios.ts`.
- **Artefatos nascem sem dono.** A atividade herda o responsável do dono do
  artefato; enquanto não houver dono, ela aparece como "sem responsável". Hoje
  o dono se define por `PATCH /api/pre-sales-ops/artifacts/:id` (admin); a tela
  vem com o Mapa de Artefatos.
- **As três datas de um artefato nunca se misturam**: `revisaoDeclaradaEm` (o
  clique), `revisaoVerificadaEm` (a fonte confirmou — é o que o semáforo usa) e
  `conferidoEm` (última reconciliação).
- Textos que vêm do banco (nome de artefato, mensagens de erro da API) estão em
  português nos dois idiomas da interface.

## Ainda não existe

- Telas de Backlog (com filtro por responsável), Mapa de Artefatos e Radar.
- Camada de LLM para resumo em português (o slot é a interface `Classificador`
  em `ingest/classify.ts`).
- Verificadores `GDRIVE` e `ZENDESK_ADMIN` na reconciliação (este último por
  OAuth, não por token de API).
