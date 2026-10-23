import { getAdminDb } from "@/lib/firebase/admin";
import type { PublicUserProfile } from "@/types/user";

export async function getServerProfile(userId: string): Promise<PublicUserProfile | null> {
  const snapshot = await getAdminDb().collection("users").doc(userId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data();
  return {
    uid: userId,
    email: typeof data?.email === "string" ? data.email : "",
    displayName: typeof data?.displayName === "string" ? data.displayName : "Memory keeper",
  };
}
