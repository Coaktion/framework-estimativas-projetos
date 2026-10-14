/**
 * Base mínima para o módulo funcionar: as fontes do Help Center e os artefatos.
 *
 * Idempotente. Roda antes de toda coleta (manual ou agendada), então um banco
 * recém-criado pelo `prisma db push` do build já sai funcionando no primeiro
 * "Coletar agora", sem ninguém precisar rodar script na mão.
 *
 * Os artefatos nascem SEM dono de propósito: dono é decisão do time, não do
 * seed. Enquanto não houver dono, as atividades geradas aparecem como
 * "sem responsável" — que é a verdade.
 */
import type { PrismaClient } from '@prisma/client';
import { SOURCE_SEEDS, ZENDESK_HC_BASE, ZENDESK_HC_LOCALE } from '../config/sources';
import { Modulo, MODULO_LABEL } from '../config/taxonomy';

/** Frentes que já existem no nosso catálogo de propostas. */
export const MODULOS_ATIVOS: Modulo[] = [
  Modulo.SUPPORT,
  Modulo.VOICE,
  Modulo.KNOWLEDGE,
  Modulo.COPILOT,
  Modulo.AI_AGENTS,
  Modulo.ANALYTICS,
  Modulo.INTEGRACOES,
];

export interface ResultadoBase {
  fontes: number;
  artefatos: number;
}

export async function garantirBase(prisma: PrismaClient): Promise<ResultadoBase> {
  for (const s of SOURCE_SEEDS) {
    await prisma.psOpsSource.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        nome: s.nome,
        kind: s.kind,
        zendeskId: s.zendeskId,
        baseUrl: ZENDESK_HC_BASE,
        locale: ZENDESK_HC_LOCALE,
        isLiveArticle: s.isLiveArticle ?? false,
        ativo: s.ativo ?? true,
      },
      // não sobrescreve watermark nem ativo: a operação manda nisso
      update: { nome: s.nome, kind: s.kind, zendeskId: s.zendeskId },
    });
  }

  // Template de demo: único, versionado. Mora numa planilha no Drive, então a
  // verificação é GDRIVE — informe o fileId em fonteRef depois.
  await prisma.psOpsArtifact.upsert({
    where: { chave: 'DEMO_TEMPLATE' },
    create: {
      chave: 'DEMO_TEMPLATE',
      tipo: 'DEMO_TEMPLATE',
      nome: 'Template de demo · zd_auto_template',
      fonteVerificacao: 'GDRIVE',
    },
    update: {},
  });

  for (const m of MODULOS_ATIVOS) {
    // Framework e blocos de escopo moram no portal — é o que torna a
    // atualização verificável por construção.
    await prisma.psOpsArtifact.upsert({
      where: { chave: `FRAMEWORK:${m}` },
      create: {
        chave: `FRAMEWORK:${m}`,
        tipo: 'FRAMEWORK',
        modulo: m,
        nome: `Framework · ${MODULO_LABEL[m]}`,
        fonteVerificacao: 'PORTAL',
      },
      update: {},
    });
    await prisma.psOpsArtifact.upsert({
      where: { chave: `ESCOPO:${m}` },
      create: {
        chave: `ESCOPO:${m}`,
        tipo: 'ESCOPO',
        modulo: m,
        nome: `Bloco escopo · ${MODULO_LABEL[m]}`,
        fonteVerificacao: 'PORTAL',
      },
      update: {},
    });
  }

  return { fontes: SOURCE_SEEDS.length, artefatos: 1 + MODULOS_ATIVOS.length * 2 };
}
