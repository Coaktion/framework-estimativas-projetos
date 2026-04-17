import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protege a raiz e todas as sub-rotas, exceto login e api de auth
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
