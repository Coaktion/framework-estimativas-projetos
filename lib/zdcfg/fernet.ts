/**
 * Fernet (spec 0x80) — compatível com cryptography.fernet do Python.
 * Os tokens Zendesk migrados para o banco foram cifrados assim; a mesma chave
 * (ZDCFG_FERNET_KEY) abre e fecha nos dois lados. SÓ SERVIDOR.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function b64urlEncode(b: Buffer): string {
  // cryptography usa base64 urlsafe COM padding
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

function chaves(chave: string) {
  const k = b64urlDecode(chave.trim());
  if (k.length !== 32) throw new Error('ZDCFG_FERNET_KEY inválida (precisa ter 32 bytes em base64)');
  return { assinatura: k.subarray(0, 16), cifra: k.subarray(16) };
}

export function fernetEncrypt(texto: string, chave: string): string {
  const { assinatura, cifra } = chaves(chave);
  const iv = randomBytes(16);
  const ts = Buffer.alloc(8);
  ts.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)));
  const c = createCipheriv('aes-128-cbc', cifra, iv);
  const ct = Buffer.concat([c.update(Buffer.from(texto, 'utf8')), c.final()]);
  const corpo = Buffer.concat([Buffer.from([0x80]), ts, iv, ct]);
  const mac = createHmac('sha256', assinatura).update(corpo).digest();
  return b64urlEncode(Buffer.concat([corpo, mac]));
}

export function fernetDecrypt(token: string, chave: string): string {
  const { assinatura, cifra } = chaves(chave);
  const d = b64urlDecode(token);
  if (d.length < 57 || d[0] !== 0x80) throw new Error('segredo cifrado inválido');
  const corpo = d.subarray(0, d.length - 32);
  const mac = d.subarray(d.length - 32);
  const esperado = createHmac('sha256', assinatura).update(corpo).digest();
  if (!timingSafeEqual(mac, esperado)) throw new Error('chave não confere com o segredo (ZDCFG_FERNET_KEY errada?)');
  const iv = d.subarray(9, 25);
  const ct = d.subarray(25, d.length - 32);
  const dc = createDecipheriv('aes-128-cbc', cifra, iv);
  return Buffer.concat([dc.update(ct), dc.final()]).toString('utf8');
}
