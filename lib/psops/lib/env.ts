/**
 * Variáveis de ambiente do módulo. Validadas no primeiro acesso para falhar
 * no boot, e não no meio de um job noturno.
 */
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),

  /** Base do Help Center. Só muda em teste. */
  PSOPS_ZENDESK_HC_BASE: z.string().url().default('https://support.zendesk.com'),
  /** Timeout por request à API do Zendesk, em ms. */
  PSOPS_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  /** Tentativas por request antes de desistir da fonte. */
  PSOPS_HTTP_RETRIES: z.coerce.number().int().min(0).max(5).default(3),
  /** Quantos artigos buscar por página. A API aceita até 100. */
  PSOPS_PAGE_SIZE: z.coerce.number().int().min(1).max(100).default(30),
  /** Teto de páginas por fonte por execução — evita varrer o histórico inteiro. */
  PSOPS_MAX_PAGES: z.coerce.number().int().min(1).max(50).default(3),

  /** Segredo do endpoint de ingestão, para o agendador do Netlify chamar. */
  PSOPS_INGEST_SECRET: z.string().min(16).optional(),

  /**
   * Dias de tolerância entre revisaoDeclaradaEm e revisaoVerificadaEm antes de
   * marcar o artefato como divergente.
   */
  PSOPS_DIVERGENCIA_DIAS: z.coerce.number().int().min(0).default(7),

  /** Idade em dias para os estados do semáforo de saúde. */
  PSOPS_SAUDE_ATENCAO_DIAS: z.coerce.number().int().positive().default(45),
  PSOPS_SAUDE_CRITICO_DIAS: z.coerce.number().int().positive().default(90),
  PSOPS_SAUDE_CRITICO_PENDENTES: z.coerce.number().int().positive().default(8),
});

export type PsOpsEnv = z.infer<typeof schema>;

let cache: PsOpsEnv | null = null;

export function env(): PsOpsEnv {
  if (cache) return cache;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const campos = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`[psops] variáveis de ambiente inválidas ou ausentes: ${campos}`);
  }
  cache = parsed.data;
  return cache;
}
