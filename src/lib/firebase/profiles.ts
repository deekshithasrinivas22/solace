import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { updateProfile, type User } from "firebase/auth";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { UserProfile } from "@/types/user";

function profileReference(userId: string) {
  return doc(getFirebaseDb(), "users", userId);
}

export async function ensureUserProfile(user: User, displayName?: string): Promise<UserProfile> {
  const reference = profileReference(user.uid);
  const profileSnapshot = await getDoc(reference);
  const resolvedName = displayName?.trim() || user.displayName?.trim() || "Memory keeper";

  if (!profileSnapshot.exists()) {
    const profile: Omit<UserProfile, "createdAt" | "updatedAt"> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      uid: user.uid,
      email: user.email ?? "",
      displayName: resolvedName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(reference, profile);
    return { ...profile, createdAt: null, updatedAt: null };
  }

  return profileSnapshot.data() as UserProfile;
}

export async function updateUserDisplayName(user: User, displayName: string) {
  const cleanedName = displayName.trim();
  await updateProfile(user, { displayName: cleanedName });
  await updateDoc(profileReference(user.uid), {
    displayName: cleanedName,
    email: user.email ?? "",
    updatedAt: serverTimestamp(),
  });
}
