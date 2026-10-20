/**
 * Numeração automática das versões de um projeto (V1, V2, V3...).
 *
 * O próximo número é o maior entre a quantidade de versões existentes e o
 * maior "Vn" já usado, mais um. Assim versões antigas com nome livre
 * ("Proposta Final") continuam contando, e um "V5" existente nunca é repetido.
 */
export function nextVersionNumber(existingNames: string[]): number {
  const maxUsed = existingNames.reduce((max, name) => {
    const match = /^\s*v(\d+)\s*$/i.exec(String(name || ''));
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return Math.max(existingNames.length, maxUsed) + 1;
}

export function versionNameFor(n: number): string {
  return `V${n}`;
}
