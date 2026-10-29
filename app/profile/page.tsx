import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import { canAccessScopes } from "@/lib/segments";
import ProfileClient from "./ProfileClient";
import ApiKeysCard from "./ApiKeysCard";
import { listApiKeysAction } from "./actions";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Profile · Aktie Now Tool Center",
};

/** Endereço público do app, para montar a URL do MCP no comando de configuração. */
function appOrigin(): string {
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  if (host) return `${h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
  return String(process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = session.user as any;
  // Chaves de API só para quem usa o editor de escopos — é o que elas permitem.
  const canUseApi = canAccessScopes(user);
  const apiKeys = canUseApi ? await listApiKeysAction() : [];

  return (
    <ProfileClient
      name={String(user.name || '')}
      email={String(user.email || '')}
      role={String(user.role || '')}
    >
      {canUseApi && <ApiKeysCard initialKeys={apiKeys} mcpUrl={`${appOrigin()}/api/mcp`} />}
    </ProfileClient>
  );
}
