import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import prisma from "./prisma";
import { normalizeSegment, syncIsAdmin } from "@/lib/segments";
import { resolveNextAuthUrl } from "@/lib/auth-url";
import { SSO_DOMAINS, isAllowedEmail } from "@/lib/sso-domains";

// NEXTAUTH_URL certo para este deploy (branch deploys do Netlify): ver lib/auth-url.ts.
resolveNextAuthUrl();

/**
 * Login SÓ com Google (SSO): só contas do Google Workspace dos domínios de
 * lib/sso-domains.ts entram, e o e-mail precisa já existir na tabela de usuários (quem cria
 * usuário é o admin). O Google só autentica; segmento e permissões continuam
 * vindo do banco. Não existe mais login por senha.
 */
export { SSO_DOMAINS } from "@/lib/sso-domains";

/**
 * O botão do Google só aparece quando o OAuth do login está configurado.
 * Variáveis PRÓPRIAS do SSO: GOOGLE_CLIENT_ID/SECRET pertencem a outra
 * integração (Agendamento) e não devem ser trocadas por causa do login.
 */
const ssoClientId = process.env.GOOGLE_SSO_CLIENT_ID?.trim() || '';
const ssoClientSecret = process.env.GOOGLE_SSO_CLIENT_SECRET?.trim() || '';
export const googleSsoEnabled = Boolean(ssoClientId && ssoClientSecret);

/** De quanto em quanto tempo, no máximo, o último acesso de uma pessoa é regravado. */
const ACESSO_INTERVALO_MS = 10 * 60 * 1000;

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
                // `hd` só filtra a tela de contas do Google (a checagem de
                // verdade é no callback `signIn`). O Google aceita um domínio
                // só; com vários, '*' mostra apenas contas de Workspace.
                hd: (SSO_DOMAINS as readonly string[]).length === 1 ? SSO_DOMAINS[0] : '*',
                prompt: 'select_account',
              },
            },
          }),
        ]
      : []),
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
      if (account?.provider !== 'google') return false; // só existe login com Google

      const email = String(profile?.email || '').trim().toLowerCase();
      // `hd` é o domínio da ORGANIZAÇÃO do Workspace (o principal): um e-mail
      // @coaktion.com que seja domínio secundário do Workspace da aktienow vem
      // com hd = aktienow.com; se for outra organização, hd = coaktion.com.
      // Por isso os dois são conferidos contra a lista, separadamente.
      const domainOk =
        profile?.email_verified === true &&
        (SSO_DOMAINS as readonly string[]).includes(String(profile?.hd || '').toLowerCase()) &&
        isAllowedEmail(email);
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

          // Último acesso: quem está usando o portal. A sessão é lida a cada
          // página, então grava no máximo a cada 10 min por pessoa (na Netlify, um write solto pode ser cortado).
          const agora = Date.now();
          if (!dbUser.ultimoAcessoEm || agora - dbUser.ultimoAcessoEm.getTime() > ACESSO_INTERVALO_MS) {
            await prisma.user
              .update({ where: { id: dbUser.id }, data: { ultimoAcessoEm: new Date(agora) } })
              .catch(() => {});
          }
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
        // Login registrado: data e contagem (aparecem na lista de usuários do Admin).
        await prisma.user
          .update({
            where: { id: dbUser.id },
            data: { ultimoLoginEm: new Date(), ultimoAcessoEm: new Date(), totalLogins: { increment: 1 } },
          })
          .catch(() => {});
        // Foto do Google no perfil, enquanto o usuário não tiver uma.
        if (!dbUser.picture && profile?.picture) {
          await prisma.user.update({ where: { id: dbUser.id }, data: { picture: String(profile.picture) } }).catch(() => {});
        }
        return token;
      }
      return token;
    }
  },
  pages: {
    signIn: '/login',
  },
};
