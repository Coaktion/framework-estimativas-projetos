import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { getServerT } from "@/app/i18n/server";
import { normalizeSegment, syncIsAdmin } from "@/lib/segments";
import { resolveNextAuthUrl } from "@/lib/auth-url";

// NEXTAUTH_URL certo para este deploy (branch deploys do Netlify): ver lib/auth-url.ts.
resolveNextAuthUrl();

// Hash bcrypt (cost 10) de um valor aleatório: só serve para igualar o tempo
// de resposta quando o e-mail não existe.
const DUMMY_HASH = '$2b$10$v2q4nNpzvougSDIzReAEAuTsmtDZ4zeGBVJ3fxdwlpayc2diPHWJ6';

const JANELA_MS = 15 * 60 * 1000;
const MAX_FALHAS = 10;
const falhas = new Map<string, { n: number; desde: number }>();

function loginBloqueado(email: string) {
  const f = falhas.get(email);
  if (!f) return false;
  if (Date.now() - f.desde > JANELA_MS) { falhas.delete(email); return false; }
  return f.n >= MAX_FALHAS;
}

function registrarFalha(email: string) {
  const f = falhas.get(email);
  if (!f || Date.now() - f.desde > JANELA_MS) falhas.set(email, { n: 1, desde: Date.now() });
  else f.n += 1;
  if (falhas.size > 5000) falhas.clear(); // não deixa o mapa crescer sem limite
}

function limparFalhas(email: string) {
  falhas.delete(email);
}

/**
 * SSO Google: só contas do Google Workspace deste domínio entram, e o e-mail
 * precisa já existir na tabela de usuários (quem cria usuário é o admin).
 * O Google só autentica; segmento e permissões continuam vindo do banco.
 */
export const SSO_DOMAIN = 'aktienow.com';

/**
 * O botão do Google só aparece quando o OAuth do login está configurado.
 * Variáveis PRÓPRIAS do SSO: GOOGLE_CLIENT_ID/SECRET pertencem a outra
 * integração (Agendamento) e não devem ser trocadas por causa do login.
 */
const ssoClientId = process.env.GOOGLE_SSO_CLIENT_ID?.trim() || '';
const ssoClientSecret = process.env.GOOGLE_SSO_CLIENT_SECRET?.trim() || '';
export const googleSsoEnabled = Boolean(ssoClientId && ssoClientSecret);

export const authOptions: NextAuthOptions = {
  // Sem adapter: as sessões são JWT e os usuários já existem no banco. Um
  // adapter faria o NextAuth tentar CRIAR usuário/conta no primeiro login OAuth.
  providers: [
    ...(googleSsoEnabled
      ? [
          GoogleProvider({
            clientId: ssoClientId,
            clientSecret: ssoClientSecret,
            authorization: {
              params: {
                // `hd` só filtra a tela de contas do Google; a checagem de
                // verdade é no callback `signIn` abaixo.
                hd: SSO_DOMAIN,
                prompt: 'select_account',
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error(getServerT()('errors.emailPasswordRequired'));
        }

        // E-mails são gravados em minúsculas; normalizamos a entrada para que
        // maiúsculas/espaços digitados (ou preenchidos pelo autocomplete) não
        // façam a busca falhar e a tela exibir "credenciais inválidas".
        const email = String(credentials.email).trim().toLowerCase();

        // Limite simples de tentativas por e-mail (por instância do servidor):
        // freia força bruta sem depender de serviço externo.
        if (loginBloqueado(email)) {
          throw new Error('TOO_MANY_ATTEMPTS'); // a tela de login traduz o código
        }

        const user = await prisma.user.findUnique({
          where: { email }
        });

        // Sempre roda o bcrypt (com um hash falso se o usuário não existe) e
        // devolve a MESMA mensagem nos dois casos: assim não dá para descobrir
        // quais e-mails têm conta, nem pela mensagem nem pelo tempo.
        const isValid = await bcrypt.compare(credentials.password, user?.password || DUMMY_HASH);

        if (!user || !user.password || !isValid) {
          registrarFalha(email);
          throw new Error(getServerT()('login.invalidCredentials'));
        }
        limparFalhas(email);

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    /**
     * Regras do SSO Google. Recusas voltam para /login?error=<código>, que a
     * tela traduz (ver app/login/page.tsx).
     */
    async signIn({ account, profile }: any) {
      if (account?.provider !== 'google') return true; // credenciais: já validadas no authorize

      const email = String(profile?.email || '').trim().toLowerCase();
      const domainOk =
        profile?.email_verified === true &&
        profile?.hd === SSO_DOMAIN &&
        email.endsWith(`@${SSO_DOMAIN}`);
      if (!domainOk) return '/login?error=SsoDomain';

      const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!dbUser) return '/login?error=SsoNotRegistered';
      return true;
    },
    async session({ session, token }: any) {
      if (session.user && token.id) {
        // Fetch fresh user data from database to ensure roles and isAdmin are up to date
        const dbUser = await prisma.user.findUnique({
          where: { id: parseInt(token.id) }
        });

        if (dbUser) {
          session.user.id = dbUser.id.toString();
          // Normaliza valores legados ("USER", "DEV", "CONSULTING"...) para um segmento válido.
          const segment = normalizeSegment(dbUser.role);
          session.user.role = segment;
          // ADMIN é o segmento que concede privilégio; respeitamos também o flag
          // gravado no banco para não rebaixar administradores existentes.
          session.user.isAdmin = dbUser.isAdmin || syncIsAdmin(segment);
          session.user.name = dbUser.name;
        }
      }
      return session;
    },
    async jwt({ token, user, account, profile }: any) {
      if (account?.provider === 'google') {
        // `user.id` aqui é o id do Google: troca pelo id do usuário no banco.
        const email = String(profile?.email || user?.email || '').trim().toLowerCase();
        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (!dbUser) throw new Error('SsoNotRegistered'); // não deveria acontecer: o signIn já barrou
        token.id = dbUser.id.toString();
        token.email = dbUser.email;
        token.name = dbUser.name;
        token.role = normalizeSegment(dbUser.role);
        token.isAdmin = dbUser.isAdmin || syncIsAdmin(normalizeSegment(dbUser.role));
        // Foto do Google no perfil, enquanto o usuário não tiver uma.
        if (!dbUser.picture && profile?.picture) {
          await prisma.user.update({ where: { id: dbUser.id }, data: { picture: String(profile.picture) } }).catch(() => {});
        }
        return token;
      }
      if (user) {
        token.id = user.id;
        token.role = normalizeSegment(user.role);
        token.isAdmin = user.isAdmin || syncIsAdmin(normalizeSegment(user.role));
      }
      return token;
    }
  },
  pages: {
    signIn: '/login',
  },
};
