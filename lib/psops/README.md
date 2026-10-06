# Pre-Sales Ops

No portal aparece como **Radar** (menu e título da página). No código, o
prefixo continua `psops` / `pre-sales-ops`.

Monitora as novidades do Zendesk (API pública do Help Center) e transforma cada
mudança que o time julgar relevante em atividades com Definition of Done para
manter atualizados os ativos de pré-venda: **ambiente de demo**, **framework de
estimativa** e **blocos de escopo técnico**, além de uma **ficha de estudo** da
feature.

Segue o mesmo padrão do ZD Auto Config dentro do Tool Center.

## Onde está cada coisa

| | |
|---|---|
| telas | `app/pre-sales-ops/`: Fila de Triagem, Backlog, Mapa de Artefatos e Linha do tempo |
| API | `app/api/pre-sales-ops/` (16 rotas, todas exigem sessão + acesso) |
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
2. Entrar com um usuário ADMIN → menu **Radar** (no topo do portal).
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
npm run psops:test   # 73 testes, sem banco e sem rede
```

Usam o test runner do Node (via `tsx`), não o Jest — por isso `lib/psops` está
em `testPathIgnorePatterns` no `jest.config.ts`.

## Decisões que valem saber

- **Ids de pessoa são texto, sem relação com `User`** (`donoId`, `responsavelId`
  …). Assim o módulo não altera o model `User` e o `db push` não mexe em tabela
  existente. Os nomes são resolvidos em `services/usuarios.ts`.
- **Artefatos nascem sem dono.** A atividade herda o responsável do dono do
  artefato; enquanto não houver dono, ela aparece como "sem responsável". Hoje
  o dono se define no Mapa de Artefatos (só admin). Ao ganhar dono, as
  atividades abertas que estavam sem responsável passam para ele.
- **As três datas de um artefato nunca se misturam**: `revisaoDeclaradaEm` (o
  clique), `revisaoVerificadaEm` (a fonte confirmou — é o que o semáforo usa) e
  `conferidoEm` (última reconciliação).
- Textos que vêm do banco (nome de artefato, mensagens de erro da API) estão em
  português nos dois idiomas da interface.

## O que a coleta faz além de coletar

- **Filtro de escopo** (`ingest/noise.ts`): Developer/API e SDKs mobile,
  incidentes e manutenção, e toda correção ("Fixed…") vão direto para o
  arquivo, com o motivo. Decisão do time em out/2026.
- **Reclassificação** (`ingest/manutencao.ts`): as regras têm versão
  (`VERSAO_REGRAS` em `ingest/classify.ts`). Ao mudar uma regra, suba a versão:
  na coleta seguinte, o que ainda está na fila é reprocessado a partir da
  camada crua. Triado ou descartado nunca é tocado.
- **Tradução** (`ingest/manutencao.ts`): título e trecho em português vêm da
  versão pt-br que o próprio Zendesk publica no Help Center. Só é aplicada
  quando a estrutura bate bullet a bullet com a original; cada artigo é
  conferido por 30 dias, até 12 por coleta.

## Ainda não existe

- Tela de consulta das fichas de estudo publicadas (hoje a ficha é preenchida e
  publicada pelo Backlog, mas não há uma lista para consulta).
- Camada de LLM para resumo em português (o slot é a interface `Classificador`
  em `ingest/classify.ts`).
- Verificadores `GDRIVE` e `ZENDESK_ADMIN` na reconciliação (este último por
  OAuth, não por token de API).
