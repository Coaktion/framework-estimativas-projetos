/**
 * Contratos de entrada da API. Um único lugar para o frontend e os handlers
 * concordarem sobre o formato — e a validação acontece na borda, não no meio
 * do serviço.
 */
import { z } from 'zod';

const impacto = z.enum(['ESTUDO', 'DEMO', 'ESTIM', 'ESCOPO']);
const statusSinal = z.enum(['NOVO', 'TRIADO', 'DESCARTADO', 'AUTO_ARQUIVADO', 'NAO_CLASSIFICADO']);
const statusAtividade = z.enum(['TODO', 'DOING', 'DONE', 'CANCELADA']);
const produto = z.enum([
  'SUPPORT', 'MESSAGING', 'CONTACT_CENTER', 'KNOWLEDGE', 'AI_AGENTS', 'COPILOT',
  'ANALYTICS', 'WFM', 'QA', 'ADMIN_SEGURANCA', 'DEVELOPER_API', 'MARKETPLACE', 'OUTRO',
]);
const tipoSinal = z.enum([
  'GA', 'EAP_BETA', 'DEPRECATION', 'BREAKING_CHANGE', 'PRICING_PACKAGING', 'UX_INTERFACE', 'FIX_MINOR',
]);

/** query param que aceita "A" ou "A,B" ou repetido */
const listaCsv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const arr = Array.isArray(v) ? v : v.split(',');
      return arr.map((s) => s.trim()).filter(Boolean);
    })
    .pipe(z.array(item).optional());

// ───────────────────────────────── Sinais ───────────────────────────────────

export const querySinais = z.object({
  status: listaCsv(statusSinal),
  produto: listaCsv(produto),
  tipo: listaCsv(tipoSinal),
  q: z.string().trim().min(2).max(120).optional(),
  scoreMin: z.coerce.number().int().min(0).max(100).optional(),
  limite: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().cuid().optional(),
});

export const bodyTriagem = z.object({
  impactos: z.array(impacto).min(1, 'Marque ao menos um impacto.'),
  nota: z.string().trim().max(1000).optional().nullable(),
});

export const bodyDescarte = z.object({
  motivo: z.string().trim().min(3, 'Diga o motivo — é o que calibra o filtro de ruído.').max(500),
});

export const bodyTriagemLote = z.object({
  itens: z
    .array(z.object({ signalId: z.string().cuid(), impactos: z.array(impacto).min(1) }))
    .min(1)
    .max(100),
});

// ──────────────────────────────── Atividades ────────────────────────────────

export const queryAtividades = z.object({
  responsavelId: z.string().min(1).optional(),
  semResponsavel: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  status: listaCsv(statusAtividade),
  tipo: listaCsv(impacto),
  artifactId: z.string().cuid().optional(),
});

export const bodyAtividade = z
  .object({
    responsavelId: z.string().min(1).nullable().optional(),
    dod: z
      .object({
        indice: z.number().int().min(0),
        feito: z.boolean(),
        evidencia: z.string().trim().max(2000).nullable().optional(),
      })
      .optional(),
  })
  .refine((v) => v.responsavelId !== undefined || v.dod !== undefined, {
    message: 'Informe responsavelId ou dod.',
  });

// ───────────────────────────────── Artefatos ────────────────────────────────

export const bodyArtefato = z
  .object({
    donoId: z.string().min(1).nullable().optional(),
    fonteVerificacao: z.enum(['PORTAL', 'GDRIVE', 'ZENDESK_ADMIN', 'NENHUMA']).optional(),
    fonteRef: z.string().trim().max(300).nullable().optional(),
    nome: z.string().trim().min(3).max(160).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nada para atualizar.' });

// ─────────────────────────────── Ficha de estudo ────────────────────────────

export const bodyFicha = z.object({
  oQueE: z.string().trim().max(600).nullable().optional(),
  comoFunciona: z.string().trim().max(4000).nullable().optional(),
  preRequisitos: z.string().trim().max(2000).nullable().optional(),
  limitacoes: z.string().trim().max(2000).nullable().optional(),
  planoNecessario: z.string().trim().max(200).nullable().optional(),
  linksConsultados: z.array(z.string().url()).max(30).optional(),
  testadoEmSandbox: z.boolean().optional(),
  motivoNaoTestado: z.string().trim().max(500).nullable().optional(),
});

// ──────────────────────────────── Radar / timeline ──────────────────────────

export const queryTimeline = z.object({
  semanas: z.coerce.number().int().min(1).max(26).optional(),
  produto: listaCsv(produto),
  q: z.string().trim().min(2).max(120).optional(),
  arquivados: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type QuerySinais = z.infer<typeof querySinais>;
export type BodyTriagem = z.infer<typeof bodyTriagem>;
export type QueryAtividades = z.infer<typeof queryAtividades>;
