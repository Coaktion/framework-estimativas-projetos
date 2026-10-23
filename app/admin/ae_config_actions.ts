'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";
import { DEFAULT_AE_CONFIG, normalizeAEConfig, suggestBindings, syncBoundNumbers, validateAEConfig, type AEConfigIssue } from "@/lib/ae-config";
import { getAeLibrary } from "@/lib/ae-config-server";

type SaveResult =
  | { success: true; id: number }
  | { success: false; error: string; issues?: AEConfigIssue[] };

/**
 * Salva uma nova versão da configuração da Calculadora AE (números, fórmulas
 * e vínculos com a biblioteca). Nunca altera uma versão existente: estimativas
 * já salvas guardam o id da configuração com que foram calculadas.
 */
export async function saveAeConfigAction(raw: any, note?: string, resetToFactory = false): Promise<SaveResult> {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || !user.isAdmin) return { success: false, error: getServerT()('errors.notAuthorized') };

  const library = await getAeLibrary();
  // Padrão de fábrica continua governado pela biblioteca: vínculos sugeridos por nome.
  const source = resetToFactory ? { ...DEFAULT_AE_CONFIG, bindings: suggestBindings(library) } : raw;
  // As horas vinculadas são gravadas com o valor atual da biblioteca (reserva
  // em dia caso o item deixe de existir).
  const config = syncBoundNumbers(normalizeAEConfig(source), library);
  const issues = validateAEConfig(config);
  if (issues.length) {
    return { success: false, error: getServerT()('aeConfig.invalidConfig'), issues };
  }

  try {
    const row = await prisma.aeConfig.create({
      data: {
        data: JSON.stringify(config),
        note: String(note || '').trim().slice(0, 300) || null,
        createdBy: user.id ? parseInt(user.id) : null,
      },
    });
    revalidatePath('/admin');
    revalidatePath('/ae');
    return { success: true, id: row.id };
  } catch (error: any) {
    console.error('[ae-config] erro ao salvar:', error);
    return { success: false, error: `${getServerT()('aeConfig.saveFailed')}: ${error?.message || String(error)}` };
  }
}
