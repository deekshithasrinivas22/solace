import type { Metadata } from "next";
import { getVerifiedSession } from "@/lib/auth/session";
import { getServerProfile } from "@/lib/firebase/server-profiles";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { ThemePicker } from "@/components/settings/theme-picker";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getVerifiedSession();
  const profile = session?.uid ? await getServerProfile(session.uid) : null;
  const email = profile?.email || session?.email || "";
  const displayName = profile?.displayName || session?.name || "Memory keeper";

  return (
    <div>
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">Your corner</span>
          <h1 className="serif">A few details.</h1>
          <p>Make your space feel like yours. Your profile is private.</p>
        </div>
      </div>
      <section className="settings-theme-card" aria-labelledby="theme-heading">
        <div><span className="eyebrow">Your look</span><h2 id="theme-heading">Pick your Solace mood.</h2><p>Choose a color story that feels like you. It is saved on this device.</p></div>
        <ThemePicker />
      </section>
      <section className="settings-card" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Profile</h2>
        <p>Your email keeps your sign-in secure. Change the name you see around Solace here.</p>
        <ProfileSettingsForm displayName={displayName} email={email} />
      </section>
    </div>
  );
}
