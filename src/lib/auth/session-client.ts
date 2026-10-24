import type { User } from "firebase/auth";

const pendingSessions = new Map<string, Promise<void>>();

async function postServerSession(user: User) {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error ?? "We couldn't start a secure session. Please try again.");
  }
}

export function createServerSession(user: User) {
  const existing = pendingSessions.get(user.uid);
  if (existing) return existing;

  const request = postServerSession(user).finally(() => {
    if (pendingSessions.get(user.uid) === request) pendingSessions.delete(user.uid);
  });
  pendingSessions.set(user.uid, request);
  return request;
}

export async function clearServerSession() {
  const response = await fetch("/api/auth/session", { method: "DELETE" });
  if (!response.ok) throw new Error("We couldn't end the secure session. Please try again.");
}
