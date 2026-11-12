/**
 * Atalhos do editor no banco. SÓ SERVIDOR.
 *
 * Na primeira leitura (tabela vazia), cria os três atalhos de fábrica a partir
 * dos campos antigos da biblioteca — o editor continua fazendo exatamente o
 * que fazia antes da tela de atalhos existir.
 */
import prisma from '@/lib/prisma';
import { loadFrameworkCatalog } from '@/lib/framework-catalog';
import { legacyShortcuts, normalizeRules, type EditorShortcut } from '@/lib/editor-shortcuts';

function toShortcut(row: any): EditorShortcut {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    nameEn: row.nameEn || '',
    nameEs: row.nameEs || '',
    description: row.description || '',
    isActive: Boolean(row.isActive),
    displayOrder: Number(row.displayOrder) || 0,
    rules: normalizeRules(row.rules),
  };
}

export async function loadEditorShortcuts(): Promise<EditorShortcut[]> {
  try {
    let rows = await prisma.editorShortcut.findMany({ orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
    if (!rows.length) {
      const catalog = await loadFrameworkCatalog();
      for (const sc of legacyShortcuts(catalog)) {
        // Duas instâncias criando ao mesmo tempo: a chave única barra a segunda.
        await prisma.editorShortcut.create({ data: { ...sc, rules: sc.rules as any } }).catch(() => null);
      }
      rows = await prisma.editorShortcut.findMany({ orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
    }
    return rows.map(toShortcut);
  } catch (error) {
    console.error('[editor-shortcuts] indisponível:', error);
    return [];
  }
}
