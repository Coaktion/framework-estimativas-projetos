import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protege a raiz e todas as sub-rotas, exceto login, api de auth, os temas
  // do Help Center do ZD Auto Config (arquivos públicos que o próprio servidor baixa)
  // e as duas rotas do Pre-Sales Ops que o agendador do Netlify chama sem sessão.
  // Essas duas se protegem sozinhas: exigem o header x-psops-secret OU sessão de admin.
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico|zdcfg/temas|api/pre-sales-ops/ingest/run|api/pre-sales-ops/reconcile).*)"],
};
