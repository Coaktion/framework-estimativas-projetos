/**
 * Reconciliação — de onde vem o controle.
 *
 * O clique em "concluir" é declaração. Este job é o que transforma declaração
 * em fato: para cada artefato, pergunta À FONTE se aquilo realmente mudou, e
 * preenche `revisaoVerificadaEm`. Quando declarada e verificada divergem além
 * do limite configurado, o artefato é marcado como divergente.
 *
 * Efeito colateral desejável: se alguém atualizar o artefato direto na fonte,
 * sem passar pelo portal, o reconciliador percebe e zera a idade de qualquer
 * forma. O mecanismo não pode exigir que o trabalho passe por ele para contar
 * — senão as pessoas contornam e o painel mente.
 *
 * ┌─ ESTADO ATUAL ────────────────────────────────────────────────────────────┐
 * │ O verificador PORTAL está implementado (o write é a prova).               │
 * │ GDRIVE e ZENDESK_ADMIN estão como stubs com a assinatura pronta e o que   │
 * │ falta documentado em cada um. Enquanto não forem implementados, o artefato│
 * │ fica com saúde NAO_VERIFICADO — que é a resposta honesta.                 │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

import type { PrismaClient } from '@prisma/client';
import { env } from '../lib/env';

const DIA = 86_400_000;

export interface Observacao {
  /** a fonte confirma alteração e desde quando */
  verificadoEm: Date | null;
  /** hash, checksum ou version da fonte, para detectar mudança futura */
  assinatura: string | null;
  /** null = não foi possível verificar (fonte não configurada ou indisponível) */
  conclusivo: boolean;
  detalhe: string;
}

export interface Verificador {
  readonly fonte: 'PORTAL' | 'GDRIVE' | 'ZENDESK_ADMIN';
  observar(args: {
    artifactId: string;
    fonteRef: string | null;
    assinaturaAnterior: string | null;
    revisaoDeclaradaEm: Date | null;
  }): Promise<Observacao>;
}

/**
 * Artefato que mora numa tabela deste portal. A atualização e o registro são o
 * mesmo evento, então não existe o que verificar: a data declarada É a
 * verificada. É por isso que vale migrar o framework de estimativa e os blocos
 * de escopo para dentro do portal.
 */
export const verificadorPortal: Verificador = {
  fonte: 'PORTAL',
  async observar({ revisaoDeclaradaEm }) {
    return {
      verificadoEm: revisaoDeclaradaEm,
      assinatura: revisaoDeclaradaEm ? String(revisaoDeclaradaEm.getTime()) : null,
      conclusivo: true,
      detalhe: 'Artefato mora no portal: a escrita é a própria prova.',
    };
  },
};

/**
 * Planilha ou documento no Google Drive.
 *
 * A IMPLEMENTAR:
 *   GET https://www.googleapis.com/drive/v3/files/{fileId}
 *       ?fields=modifiedTime,version,lastModifyingUser,md5Checksum
 *   · `modifiedTime` posterior a revisaoDeclaradaEm confirma a alteração
 *   · `version` incrementa a cada revisão e serve como assinatura
 *   · `md5Checksum` só existe para arquivo binário (xlsx de verdade).
 *     Google Sheets nativo NÃO tem hash — nesse caso use `version`.
 *   · `revisions.list` dá o histórico, útil para mostrar quem alterou.
 *
 * Requer uma service account com acesso de leitura à pasta.
 */
export const verificadorGDrive: Verificador = {
  fonte: 'GDRIVE',
  async observar({ fonteRef }) {
    return {
      verificadoEm: null,
      assinatura: null,
      conclusivo: false,
      detalhe: fonteRef
        ? `Verificador do Drive não implementado (fileId ${fonteRef}).`
        : 'fonteRef vazio: informe o fileId do arquivo no Drive.',
    };
  },
};

/**
 * Tenant de demonstração — o único nível que prova de verdade.
 *
 * A IMPLEMENTAR: ler o critério verificável da atividade
 * (PsOpsActivity.criterioVerificavel) e conferir na Admin API do tenant que o
 * objeto existe. Exemplos:
 *   GET /api/v2/triggers        → procurar por título
 *   GET /api/v2/ticket_fields   → procurar pela key
 *   GET /api/v2/macros, /views, /slas/policies, /custom_objects
 *
 * IMPORTANTE: autenticar com OAuth, não com API token. A remoção dos API
 * tokens como método de autenticação já foi anunciada pela Zendesk — usar
 * token aqui seria construir dívida com data marcada.
 */
export const verificadorZendeskAdmin: Verificador = {
  fonte: 'ZENDESK_ADMIN',
  async observar({ fonteRef }) {
    return {
      verificadoEm: null,
      assinatura: null,
      conclusivo: false,
      detalhe: fonteRef
        ? `Verificador da Admin API não implementado (tenant ${fonteRef}).`
        : 'fonteRef vazio: informe o subdomínio do tenant de demo.',
    };
  },
};

const VERIFICADORES: Record<string, Verificador> = {
  PORTAL: verificadorPortal,
  GDRIVE: verificadorGDrive,
  ZENDESK_ADMIN: verificadorZendeskAdmin,
};

export interface ResultadoReconciliacao {
  conferidos: number;
  confirmados: number;
  divergentes: number;
  inconclusivos: number;
  detalhes: Array<{ artefato: string; estado: string; detalhe: string }>;
}

export async function reconciliar(
  prisma: PrismaClient,
  opts?: { agora?: Date },
): Promise<ResultadoReconciliacao> {
  const agora = opts?.agora ?? new Date();
  const limiteDias = env().PSOPS_DIVERGENCIA_DIAS;

  const artefatos = await prisma.psOpsArtifact.findMany({
    where: { fonteVerificacao: { not: 'NENHUMA' } },
  });

  const res: ResultadoReconciliacao = {
    conferidos: 0,
    confirmados: 0,
    divergentes: 0,
    inconclusivos: 0,
    detalhes: [],
  };

  for (const a of artefatos) {
    const v = VERIFICADORES[a.fonteVerificacao];
    if (!v) continue;
    res.conferidos += 1;

    const obs = await v.observar({
      artifactId: a.id,
      fonteRef: a.fonteRef,
      assinaturaAnterior: a.fonteAssinatura,
      revisaoDeclaradaEm: a.revisaoDeclaradaEm,
    });

    if (!obs.conclusivo) {
      res.inconclusivos += 1;
      res.detalhes.push({ artefato: a.nome, estado: 'inconclusivo', detalhe: obs.detalhe });
      await prisma.psOpsArtifact.update({
        where: { id: a.id },
        data: { conferidoEm: agora },
      });
      continue;
    }

    // Divergência: existe declaração mais nova que o que a fonte confirma,
    // e a distância passou do limite de tolerância.
    const declarada = a.revisaoDeclaradaEm?.getTime() ?? null;
    const verificada = obs.verificadoEm?.getTime() ?? null;
    const divergente =
      declarada !== null &&
      (verificada === null || declarada - verificada > limiteDias * DIA);

    await prisma.psOpsArtifact.update({
      where: { id: a.id },
      data: {
        revisaoVerificadaEm: obs.verificadoEm,
        fonteAssinatura: obs.assinatura,
        conferidoEm: agora,
        divergente,
        divergenciaDetalhe: divergente
          ? `Declarado em ${a.revisaoDeclaradaEm?.toISOString().slice(0, 10)}, ` +
            `fonte confirma ${obs.verificadoEm?.toISOString().slice(0, 10) ?? 'nada'}.`
          : null,
      },
    });

    if (divergente) {
      res.divergentes += 1;
      res.detalhes.push({ artefato: a.nome, estado: 'divergente', detalhe: obs.detalhe });
    } else {
      res.confirmados += 1;
    }
  }

  return res;
}
