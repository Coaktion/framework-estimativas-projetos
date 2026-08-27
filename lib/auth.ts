import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { getServerT } from "@/app/i18n/server";
import { normalizeSegment, syncIsAdmin } from "@/lib/segments";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.password) {
          throw new Error(getServerT()('errors.userNotFound'));
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error(getServerT()('errors.wrongPassword'));
        }

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
    async jwt({ token, user }: any) {
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
