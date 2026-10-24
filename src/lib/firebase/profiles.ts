"use client";

import {
  doc,
  runTransaction,
  serverTimestamp,
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
  const resolvedName = displayName?.trim() || user.displayName?.trim() || "Memory keeper";

  return runTransaction(getFirebaseDb(), async (transaction) => {
    const profileSnapshot = await transaction.get(reference);

    if (!profileSnapshot.exists()) {
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email ?? "",
        displayName: resolvedName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      transaction.set(reference, profile);
      return { ...profile, createdAt: null, updatedAt: null };
    }

    const existingProfile = profileSnapshot.data() as UserProfile;
    if (displayName?.trim() && existingProfile.displayName !== resolvedName) {
      transaction.update(reference, {
        displayName: resolvedName,
        email: user.email ?? "",
        updatedAt: serverTimestamp(),
      });
      return {
        ...existingProfile,
        displayName: resolvedName,
        email: user.email ?? "",
        updatedAt: null,
      };
    }

    return existingProfile;
  });
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
