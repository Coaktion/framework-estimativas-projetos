'use server';

/** Admin › Biblioteca › Atalhos: criar, renomear, ativar/desativar e editar regras. */
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { recordAdminChange } from '@/lib/admin-audit';
import { normalizeRules, normalizeShortcutKey, type EditorShortcut } from '@/lib/editor-shortcuts';
import { loadEditorShortcuts } from '@/lib/editor-shortcuts-server';

async function requireAdmin() {
  const session: any = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) throw new Error('forbidden');
  return Number(session.user.id) || null;
}

type SaveInput = Omit<EditorShortcut, 'id' | 'key'> & { id?: number | null; key?: string };

export async function saveEditorShortcutAction(input: SaveInput): Promise<{ ok: true; shortcuts: EditorShortcut[] } | { ok: false; error: string }> {
  try {
    const adminId = await requireAdmin();
    const name = String(input.name || '').trim().slice(0, 80);
    if (!name) return { ok: false, error: 'name_required' };
    const rules = normalizeRules(input.rules);
    const data = {
      name,
      nameEn: String(input.nameEn || '').trim().slice(0, 80),
      nameEs: String(input.nameEs || '').trim().slice(0, 80),
      description: String(input.description || '').trim().slice(0, 500),
      isActive: Boolean(input.isActive),
      displayOrder: Math.max(0, Math.round(Number(input.displayOrder) || 0)),
      rules: rules as any,
    };
    if (input.id) {
      const before = await prisma.editorShortcut.findUnique({ where: { id: Number(input.id) } });
      if (!before) return { ok: false, error: 'not_found' };
      await prisma.editorShortcut.update({ where: { id: before.id }, data });
      const changes: string[] = [];
      if (before.name !== data.name) changes.push(`nome: ${before.name} → ${data.name}`);
      if (before.isActive !== data.isActive) changes.push(data.isActive ? 'ativado' : 'desativado');
      if (JSON.stringify(normalizeRules(before.rules)) !== JSON.stringify(rules)) changes.push(`regras: ${normalizeRules(before.rules).length} → ${rules.length}`);
      await recordAdminChange({
        userId: adminId, area: 'shortcuts', action: 'update',
        summary: `Atalho "${data.name}"${changes.length ? ` — ${changes.join('; ')}` : ''}`,
        details: { id: before.id, key: before.key },
      });
    } else {
      const base = normalizeShortcutKey(input.key || name) || 'atalho';
      let key = base;
      for (let i = 2; await prisma.editorShortcut.findUnique({ where: { key } }); i++) key = `${base}_${i}`;
      const created = await prisma.editorShortcut.create({ data: { ...data, key } });
      await recordAdminChange({ userId: adminId, area: 'shortcuts', action: 'create', summary: `Atalho novo "${data.name}" (${rules.length} regras)`, details: { id: created.id, key } });
    }
    revalidatePath('/admin');
    return { ok: true, shortcuts: await loadEditorShortcuts() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
