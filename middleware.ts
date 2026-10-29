import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protege a raiz e todas as sub-rotas, exceto login, api de auth, os temas
  // do Help Center do ZD Auto Config (arquivos públicos que o próprio servidor baixa)
  // as duas rotas do Pre-Sales Ops que o agendador do Netlify chama sem sessão
  // e os assets da marca em /public/brand (logos e fundos aparecem também no login).
  // Essas duas se protegem sozinhas: exigem o header x-psops-secret OU sessão de admin.
  // A limpeza do Agendamento (api/booking/cleanup) idem: exige x-booking-secret.
  // O MCP do Tool Center (api/mcp) idem: exige chave de API (Authorization: Bearer).
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico|brand/|zdcfg/temas|api/pre-sales-ops/ingest/run|api/pre-sales-ops/reconcile|api/booking/cleanup|api/mcp).*)"],
};
