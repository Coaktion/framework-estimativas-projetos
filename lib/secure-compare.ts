import { createHash, timingSafeEqual } from 'crypto';

/**
 * Compara um segredo recebido (header) com o esperado em tempo constante.
 * Os dois lados passam por SHA-256 para terem o mesmo tamanho: assim nem o
 * comprimento do segredo vaza pelo tempo de resposta.
 */
export function secretMatches(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || !received) return false;
  const a = createHash('sha256').update(received).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
