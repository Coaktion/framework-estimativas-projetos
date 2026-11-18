/**
 * Base mínima para o módulo funcionar: as fontes do Help Center e os artefatos.
 *
 * Idempotente. Roda antes de toda coleta (manual ou agendada), então um banco
 * recém-criado pelo `prisma db push` do build já sai funcionando no primeiro
 * "Coletar agora", sem ninguém precisar rodar script na mão.
 *
 * Os artefatos nascem com o dono do destino (config/responsaveis.ts): Demo do
 * Renato, Estimativa do Arthur, Escopo da Elisa. Trocar no Mapa vale mais.
 */
import type { PrismaClient } from '@prisma/client';
import { SOURCE_SEEDS, ZENDESK_HC_BASE, ZENDESK_HC_LOCALE } from '../config/sources';
import { Impacto, Modulo } from '../config/taxonomy';
import {
  DEMOS, DOCUMENTOS_ESCOPO, IDIOMAS_ESCOPO, chaveEscopo, chaveEstimativa, ehArtefatoAtual,
} from '../config/artefatos';
import { resolverResponsaveis } from '../config/responsaveis';

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

  const artefatos = await garantirArtefatos(prisma);
  return { fontes: SOURCE_SEEDS.length, artefatos };
}

/**
 * Os artefatos do time (config/artefatos.ts): 3 ambientes de demo, uma
 * estimativa por módulo do Framework e os 5 documentos de escopo × 3 idiomas.
 *
 *   · cria o que falta e mantém o nome em dia; nunca mexe em versão, datas ou
 *     histórico de um artefato que já existe
 *   · dono: o responsável do destino (config/responsaveis.ts), só quando o
 *     artefato ainda não tem dono — dono escolhido no Mapa não é sobrescrito
 *   · os artefatos do formato antigo (template único, framework e escopo por
 *     módulo) saem, desde que nunca tenham sido usados
 */
export async function garantirArtefatos(prisma: PrismaClient): Promise<number> {
  const categorias = (await prisma.category.findMany({
    where: { isActive: true, parentName: null },
    select: { name: true, displayName: true },
  })) as Array<{ name: string; displayName: string | null }>;

  const lista: Array<{ chave: string; tipo: 'DEMO_TEMPLATE' | 'FRAMEWORK' | 'ESCOPO'; nome: string; impacto: Impacto }> = [
    ...DEMOS.map((d) => ({ chave: d.chave, tipo: 'DEMO_TEMPLATE' as const, nome: d.nome, impacto: Impacto.DEMO })),
    ...categorias.map((c) => ({
      chave: chaveEstimativa(c.name),
      tipo: 'FRAMEWORK' as const,
      nome: `Estimativa · ${c.displayName || c.name}`,
      impacto: Impacto.ESTIM,
    })),
    ...DOCUMENTOS_ESCOPO.flatMap((d) =>
      IDIOMAS_ESCOPO.map((i) => ({
        chave: chaveEscopo(d.id, i.id),
        tipo: 'ESCOPO' as const,
        nome: `${d.nome} · ${i.id}`,
        impacto: Impacto.ESCOPO,
      })),
    ),
  ];

  const responsaveis = await resolverResponsaveis(prisma);
  for (const a of lista) {
    await prisma.psOpsArtifact.upsert({
      where: { chave: a.chave },
      create: { chave: a.chave, tipo: a.tipo, nome: a.nome, donoId: responsaveis[a.impacto]?.[0] ?? null },
      update: { nome: a.nome },
    });
  }
  // dono do destino para quem ainda não tem (não sobrescreve escolha do Mapa)
  for (const impacto of [Impacto.DEMO, Impacto.ESTIM, Impacto.ESCOPO]) {
    const dono = responsaveis[impacto]?.[0];
    if (!dono) continue;
    await prisma.psOpsArtifact.updateMany({
      where: { donoId: null, chave: { in: lista.filter((a) => a.impacto === impacto).map((a) => a.chave) } },
      data: { donoId: dono },
    });
  }

  // formato antigo, nunca usado: sai do Mapa
  const antigos = ((await prisma.psOpsArtifact.findMany({
    select: { id: true, chave: true, _count: { select: { atividades: true, aplicacoes: true, atualizacoes: true } } },
  })) as Array<{ id: string; chave: string; _count?: { atividades: number; aplicacoes: number; atualizacoes: number } }>)
    .filter((a) => !ehArtefatoAtual(a.chave))
    .filter((a) => !a._count || a._count.atividades + a._count.aplicacoes + a._count.atualizacoes === 0);
  if (antigos.length) {
    await prisma.psOpsArtifact.deleteMany({ where: { id: { in: antigos.map((a) => a.id) } } });
  }

  return lista.length;
}
