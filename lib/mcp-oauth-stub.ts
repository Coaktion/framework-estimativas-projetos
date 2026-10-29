/**
 * Respostas para clientes MCP que tentam OAuth no Tool Center.
 *
 * O MCP (/api/mcp) autentica só por chave de API. Quando a chave falta ou é
 * inválida, clientes como o mcp-remote recebem 401 e partem para a descoberta
 * OAuth (/.well-known/...) e o registro dinâmico (/register). Sem estas rotas,
 * o middleware de login devolvia a página HTML de login e o cliente quebrava
 * com um erro genérico ("Unexpected token '<'" / "Server disconnected").
 * Respondendo JSON no formato de erro OAuth, o cliente mostra a mensagem abaixo.
 */

import { NextResponse } from 'next/server';

export const MCP_KEY_HELP =
  'O Tool Center não usa OAuth: o MCP autentica por chave de API. Gere uma chave no Perfil ' +
  '(https://aktienowtc.netlify.app/profile) e envie no header "Authorization: Bearer tc_..." ' +
  'ou "x-api-key: tc_...". Se já configurou, a chave está ausente, foi digitada errada ou foi revogada.';

/** 404 para metadados OAuth: o Tool Center não é servidor de autorização. */
export function oauthMetadataNotFound() {
  return NextResponse.json({ error: 'not_found', error_description: MCP_KEY_HELP }, { status: 404 });
}

/** Registro dinâmico de cliente recusado, com a explicação no formato de erro OAuth. */
export function oauthRegistrationRefused() {
  return NextResponse.json({ error: 'invalid_client_metadata', error_description: MCP_KEY_HELP }, { status: 400 });
}
