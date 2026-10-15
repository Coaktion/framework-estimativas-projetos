import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ProfileClient from "./ProfileClient";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Profile · Aktie Now Tool Center",
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = session.user as any;

  return (
    <ProfileClient
      name={String(user.name || '')}
      email={String(user.email || '')}
      role={String(user.role || '')}
    />
  );
}
