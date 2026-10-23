"use client";

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { clearServerSession, createServerSession } from "@/lib/auth/session-client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { ensureUserProfile } from "@/lib/firebase/profiles";
import type { SignInInput, SignUpInput } from "@/lib/validations/auth";

async function rememberSession(user: User) {
  await setPersistence(getFirebaseAuth(), browserLocalPersistence);
  await createServerSession(user);
}

export async function signIn(input: SignInInput) {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInWithEmailAndPassword(auth, input.email, input.password);

  try {
    const profile = await ensureUserProfile(credential.user);
    await rememberSession(credential.user);
    return profile;
  } catch (error) {
    await signOut(auth);
    await clearServerSession().catch(() => undefined);
    throw error;
  }
}

export async function signUp(input: SignUpInput) {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);

  try {
    await updateProfile(credential.user, { displayName: input.displayName });
    const profile = await ensureUserProfile(credential.user, input.displayName);
    await rememberSession(credential.user);
    return profile;
  } catch (error) {
    await signOut(auth);
    await clearServerSession().catch(() => undefined);
    throw error;
  }
}

export async function signOutEverywhere() {
  const auth = getFirebaseAuth();
  await signOut(auth);
  await clearServerSession();
}
