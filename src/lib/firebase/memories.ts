"use client";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { Memory, MemoryInput } from "@/types/memory";

const memoriesCollection = () => collection(getFirebaseDb(), "memories");

export type MemoryArchiveCursor = QueryDocumentSnapshot<DocumentData> | null;

export async function getMemoryArchivePage(
  ownerId: string,
  cursor: MemoryArchiveCursor = null,
  requestedPageSize = 50,
): Promise<{ memories: Memory[]; nextCursor: MemoryArchiveCursor }> {
  const pageSize = Math.max(1, Math.min(100, Math.floor(requestedPageSize)));
  const pageQuery = cursor
    ? query(
      memoriesCollection(),
      where("ownerId", "==", ownerId),
      orderBy("memoryDate", "desc"),
      startAfter(cursor),
      limit(pageSize + 1),
    )
    : query(
      memoriesCollection(),
      where("ownerId", "==", ownerId),
      orderBy("memoryDate", "desc"),
      limit(pageSize + 1),
    );
  const snapshot = await getDocs(pageQuery);
  const pageDocuments = snapshot.docs.slice(0, pageSize);
  const hasMore = snapshot.docs.length > pageSize;

  return {
    memories: pageDocuments.map((item) => ({ id: item.id, ...item.data() }) as Memory),
    nextCursor: hasMore ? pageDocuments.at(-1) ?? null : null,
  };
}

export function subscribeToMemories(
  ownerId: string,
  onMemories: (memories: Memory[]) => void,
  onError: (error: Error) => void,
  maximum = 50,
): Unsubscribe {
  const memoriesQuery = query(
    memoriesCollection(),
    where("ownerId", "==", ownerId),
    orderBy("memoryDate", "desc"),
    limit(maximum),
  );

  return onSnapshot(
    memoriesQuery,
    (snapshot) => {
      onMemories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Memory));
    },
    onError,
  );
}

export async function saveMemory(ownerId: string, input: MemoryInput, memoryId?: string, createIfMissing = false) {
  const values = {
    ownerId,
    title: input.title,
    description: input.description,
    memoryDate: input.memoryDate,
    memoryTime: input.memoryTime ?? "",
    location: input.location,
    mood: input.mood,
    tags: input.tags,
    updatedAt: serverTimestamp(),
  };

  if (memoryId) {
    const reference = doc(getFirebaseDb(), "memories", memoryId);
    if (createIfMissing) {
      await setDoc(reference, { ...values, createdAt: serverTimestamp() });
    } else {
      await updateDoc(reference, values);
    }
    return memoryId;
  }

  const memory = await addDoc(memoriesCollection(), {
    ...values,
    createdAt: serverTimestamp(),
  });
  return memory.id;
}

export async function removeMemory(memoryId: string, idToken: string) {
  const query = new URLSearchParams({ memoryId });
  const response = await fetch(`/api/memories?${query.toString()}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const result = await response.json().catch(() => null) as { error?: string; photoCleanupPending?: boolean } | null;
  if (!response.ok) throw new Error(result?.error ?? "That memory couldn't be removed. Please try again.");
  return { photoCleanupPending: result?.photoCleanupPending ?? false };
}
