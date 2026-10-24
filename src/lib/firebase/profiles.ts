"use client";

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { updateProfile, type User } from "firebase/auth";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { UserProfile } from "@/types/user";

const pendingProfiles = new Map<string, Promise<UserProfile>>();

function profileReference(userId: string) {
  return doc(getFirebaseDb(), "users", userId);
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

async function readOrCreateProfile(user: User, displayName?: string): Promise<UserProfile> {
  const reference = profileReference(user.uid);
  const resolvedName = displayName?.trim() || user.displayName?.trim() || "Memory keeper";

  try {
    return await runTransaction(getFirebaseDb(), async (transaction) => {
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
  } catch (error) {
    // A second browser tab can create this profile after this transaction reads it.
    if (errorCode(error) === "already-exists") {
      const profileSnapshot = await getDoc(reference);
      if (profileSnapshot.exists()) return profileSnapshot.data() as UserProfile;
    }
    throw error;
  }
}

export function ensureUserProfile(user: User, displayName?: string): Promise<UserProfile> {
  const resolvedName = displayName?.trim();
  const pending = pendingProfiles.get(user.uid);

  if (pending) {
    return pending.then((profile) => {
      if (resolvedName && profile.displayName !== resolvedName) {
        return ensureUserProfile(user, resolvedName);
      }
      return profile;
    });
  }

  const request = readOrCreateProfile(user, displayName).finally(() => {
    if (pendingProfiles.get(user.uid) === request) pendingProfiles.delete(user.uid);
  });
  pendingProfiles.set(user.uid, request);
  return request;
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
