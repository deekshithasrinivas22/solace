"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { authErrorMessage } from "@/lib/auth/errors";
import { updateUserDisplayName } from "@/lib/firebase/profiles";
import { useAuthStore } from "@/stores/auth-store";
import { signUpSchema } from "@/lib/validations/auth";

export function ProfileSettingsForm({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const setSession = useAuthStore((state) => state.setSession);
  const [name, setName] = useState(displayName);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const parsed = signUpSchema.shape.displayName.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your name.");
      return;
    }
    if (!user) {
      setError("Your sign-in is still loading. Please try again in a moment.");
      return;
    }

    setPending(true);
    try {
      await updateUserDisplayName(user, parsed.data);
      if (profile) setSession(user, { ...profile, displayName: parsed.data });
      setMessage("Your name has been saved.");
    } catch (saveError) {
      setError(authErrorMessage(saveError));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={save}>
      <div className="field">
        <label htmlFor="profile-name">Display name</label>
        <input
          id="profile-name"
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </div>
      <div className="field">
        <label htmlFor="profile-email">Email address</label>
        <input id="profile-email" readOnly value={email} />
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="settings-success" role="status">{message}</p>}
      <button className="button-primary" disabled={pending} type="submit">
        {pending ? <LoaderCircle size={16} className="animate-spin" /> : null}
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
