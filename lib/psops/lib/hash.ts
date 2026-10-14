import { createHash } from 'node:crypto';

/** sha256 hex. Usado para detectar edição em artigo-vivo e assinar blocos. */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Normaliza HTML antes do hash: espaços colapsados, sem quebras irrelevantes. */
export function hashConteudo(html: string): string {
  return sha256(html.replace(/\s+/g, ' ').trim());
}
