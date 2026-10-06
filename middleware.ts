import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protege a raiz e todas as sub-rotas, exceto login, api de auth e os temas
  // do Help Center do ZD Auto Config (arquivos públicos que o próprio servidor baixa)
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico|zdcfg/temas).*)"],
};
