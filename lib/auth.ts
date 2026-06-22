import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";
import bcrypt from "bcryptjs";

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
          throw new Error("Email e senha são obrigatórios");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.password) {
          throw new Error("Usuário não encontrado ou senha não definida");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Senha incorreta");
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
          session.user.role = dbUser.role;
          session.user.isAdmin = dbUser.isAdmin;
          session.user.name = dbUser.name;
        }
      }
      return session;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isAdmin = user.isAdmin;
      }
      return token;
    }
  },
  pages: {
    signIn: '/login',
  },
};
