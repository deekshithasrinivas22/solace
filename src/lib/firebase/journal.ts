"use client";

import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { JournalEntry, JournalEntryInput } from "@/types/journal";

const db = () => getFirebaseDb();
const entriesCollection = () => collection(db(), "journalEntries");

export function subscribeToJournalEntries(
  ownerId: string,
  onEntries: (entries: JournalEntry[]) => void,
  onError: (error: Error) => void,
  maximum = 80,
): Unsubscribe {
  const entriesQuery = query(
    entriesCollection(),
    where("ownerId", "==", ownerId),
    orderBy("updatedAt", "desc"),
    limit(maximum),
  );

  return onSnapshot(
    entriesQuery,
    (snapshot) => onEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as JournalEntry)),
    onError,
  );
}

export async function createJournalEntry(ownerId: string, input: JournalEntryInput) {
  return addDoc(entriesCollection(), {
    ownerId,
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateJournalEntry(entryId: string, ownerId: string, input: JournalEntryInput) {
  await updateDoc(doc(db(), "journalEntries", entryId), {
    ownerId,
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteJournalEntry(entryId: string, idToken: string) {
  const response = await fetch("/api/journal/entries", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + idToken,
    },
    body: JSON.stringify({ entryId }),
  });
  const result = await response.json() as { error?: string; photoCleanupPending?: boolean };
  if (!response.ok) throw new Error(result.error ?? "That journal page could not be deleted.");
  return { photoCleanupPending: Boolean(result.photoCleanupPending) };
}
