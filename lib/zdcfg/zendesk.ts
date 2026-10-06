/**
 * Cliente da API Zendesk (porte de client.py). SÓ SERVIDOR.
 *
 * Diferença de propósito em relação ao Python: no Netlify cada chamada ao
 * servidor dura poucos segundos, então esperas longas de rate limit (429) não
 * dormem aqui — viram TenteDepois, e a tela repete o passo após o intervalo.
 * Cada passo do provisionamento faz suas LEITURAS antes da única ESCRITA, por
 * isso repetir um passo não duplica recursos.
 */

export type Credenciais =
  | { auth: 'token'; subdomain: string; email: string; token: string }
  | { auth: 'oauth'; subdomain: string; clientId: string; clientSecret: string };

export class ZendeskError extends Error {
  constructor(public status: number, public body: string, public url: string) {
    super(`HTTP ${status} em ${url}: ${body.slice(0, 300)}`);
  }
}

/** Rate limit longo: a tela espera `segundos` e repete o mesmo passo. */
export class TenteDepois extends Error {
  constructor(public segundos: number) {
    super(`limite de requisições do Zendesk; tentando de novo em ${segundos}s`);
  }
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ESPERA_MAX_INLINE = 4; // segundos que vale esperar dentro do mesmo passo

// Access token OAuth reaproveitado enquanto a função estiver "quente".
const bearerCache = new Map<string, { token: string; expira: number }>();

export class ZendeskClient {
  readonly base: string;
  guideSub: string;
  readonly subdomain: string;
  /** Contador de IDs falsos do dry-run; vem e volta no contexto da execução. */
  fakeId: number;

  constructor(private creds: Credenciais, public dryRun: boolean, fakeId = 1000, guideSub?: string) {
    this.subdomain = creds.subdomain;
    this.base = `https://${creds.subdomain}.zendesk.com/api/v2`;
    this.guideSub = guideSub || creds.subdomain;
    this.fakeId = fakeId;
  }

  private chaveCache() {
    return this.creds.auth === 'oauth' ? `${this.creds.subdomain}:${this.creds.clientId}` : '';
  }

  private async bearer(forcar = false): Promise<string> {
    if (this.creds.auth !== 'oauth') return '';
    const k = this.chaveCache();
    const c = bearerCache.get(k);
    if (!forcar && c && c.expira > Date.now() + 60_000) return c.token;
    const url = `https://${this.creds.subdomain}.zendesk.com/oauth/tokens`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.creds.clientId,
        client_secret: this.creds.clientSecret,
        scope: 'read write',
        expires_in: '14400',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const txt = await r.text();
    if (r.status >= 400) throw new ZendeskError(r.status, txt, url);
    const tok = (JSON.parse(txt || '{}') as any).access_token;
    if (!tok) throw new ZendeskError(500, 'sem access_token na resposta OAuth', url);
    bearerCache.set(k, { token: tok, expira: Date.now() + 14_000_000 });
    return tok;
  }

  private async headers(forcarBearer = false): Promise<Record<string, string>> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.creds.auth === 'oauth') h.Authorization = `Bearer ${await this.bearer(forcarBearer)}`;
    else {
      const user = `${this.creds.email}/token`;
      h.Authorization = `Basic ${Buffer.from(`${user}:${this.creds.token}`).toString('base64')}`;
    }
    return h;
  }

  private async req(method: string, url: string, json?: unknown): Promise<any> {
    if (this.dryRun) {
      this.fakeId += 1;
      return { _dry: true, id: this.fakeId };
    }
    let tentativas401 = 0;
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const r = await fetch(url, {
        method,
        headers: await this.headers(tentativas401 > 0),
        body: json === undefined ? undefined : JSON.stringify(json),
        signal: AbortSignal.timeout(20_000),
      });
      if (r.status === 429) {
        const espera = parseInt(r.headers.get('Retry-After') || '', 10) || 2 ** tentativa;
        if (espera > ESPERA_MAX_INLINE) throw new TenteDepois(espera);
        await dormir(espera * 1000);
        continue;
      }
      // 401 depois de chamadas OK costuma ser transitório (throttle/blip).
      if (r.status === 401 && tentativas401 < 2) {
        tentativas401 += 1;
        await dormir(800 * tentativas401);
        continue;
      }
      const txt = await r.text();
      if (r.status >= 400) throw new ZendeskError(r.status, txt, url);
      return txt ? JSON.parse(txt) : {};
    }
    throw new TenteDepois(5);
  }

  url(path: string): string {
    if (path.startsWith('http')) return path;
    const p = path.startsWith('/') ? path : `/${path}`;
    if (p.startsWith('/help_center')) return `https://${this.guideSub}.zendesk.com/api/v2${p}`;
    return this.base + p;
  }

  get(path: string) { return this.req('GET', this.url(path)); }
  post(path: string, body: unknown) { return this.req('POST', this.url(path), body); }
  put(path: string, body: unknown) { return this.req('PUT', this.url(path), body); }
  delete(path: string) { return this.req('DELETE', this.url(path)); }
}
