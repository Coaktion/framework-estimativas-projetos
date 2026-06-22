import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";
import bcrypt from "bcryptjs";

// Ensure NEXTAUTH_URL is set in production to avoid localhost:3000 default
if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = 'https://framework-sc.netlify.app';
}

export const authOptions: NextAuthOptions = {
  // Removing PrismaAdapter for now as it's not needed for Credentials + JWT 
  // and can sometimes cause issues in serverless environments
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
      console.log("Session Callback - Token ID:", token?.id);
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.isAdmin = token.isAdmin;
      }
      return session;
    },
    async jwt({ token, user }: any) {
      if (user) {
        console.log("JWT Callback - User Found:", user.email);
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
