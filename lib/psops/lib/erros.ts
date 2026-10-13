/**
 * Erros de acesso do módulo.
 *
 * Ficam num arquivo sem dependências para que `http.ts` (e, por tabela, os
 * serviços e os testes) não precisem importar a sessão do NextAuth só para
 * conhecer a classe do erro.
 */

export class NaoAutenticado extends Error {
  readonly status = 401;
  constructor() {
    super('Sessão ausente ou expirada.');
  }
}

export class SemPermissao extends Error {
  readonly status = 403;
  constructor(acao: string) {
    super(`Sem permissão para: ${acao}`);
  }
}
