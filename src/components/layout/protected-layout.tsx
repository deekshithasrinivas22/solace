import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getVerifiedSession } from "@/lib/auth/session";
import { getServerProfile } from "@/lib/firebase/server-profiles";

export async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getVerifiedSession();
  if (!session?.uid) redirect("/login");

  const profile = await getServerProfile(session.uid);
  if (!profile) {
    return (
      <AppShell
        profile={{
          uid: session.uid,
          email: session.email ?? "",
          displayName: session.name ?? "Memory keeper",
        }}
      >
        {children}
      </AppShell>
    );
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
