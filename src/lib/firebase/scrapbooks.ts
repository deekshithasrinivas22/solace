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
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type {
  Scrapbook,
  ScrapbookInput,
  ScrapbookPage,
  ScrapbookPageInput,
} from "@/types/scrapbook";

const db = () => getFirebaseDb();
const booksCollection = () => collection(db(), "scrapbooks");
const pagesCollection = (scrapbookId: string) => collection(db(), "scrapbooks", scrapbookId, "pages");

export function subscribeToScrapbooks(
  ownerId: string,
  onBooks: (books: Scrapbook[]) => void,
  onError: (error: Error) => void,
  maximum = 40,
): Unsubscribe {
  const booksQuery = query(
    booksCollection(),
    where("ownerId", "==", ownerId),
    orderBy("updatedAt", "desc"),
    limit(maximum),
  );

  return onSnapshot(
    booksQuery,
    (snapshot) => onBooks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Scrapbook)),
    onError,
  );
}

export function subscribeToScrapbook(
  scrapbookId: string,
  onBook: (book: Scrapbook | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db(), "scrapbooks", scrapbookId),
    (snapshot) => onBook(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Scrapbook) : null),
    onError,
  );
}

export function subscribeToScrapbookPages(
  scrapbookId: string,
  onPages: (pages: ScrapbookPage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const pagesQuery = query(pagesCollection(scrapbookId), orderBy("createdAt", "asc"), limit(100));
  return onSnapshot(
    pagesQuery,
    (snapshot) => onPages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ScrapbookPage)),
    onError,
  );
}

export async function createScrapbook(ownerId: string, input: ScrapbookInput) {
  return addDoc(booksCollection(), {
    ownerId,
    title: input.title,
    description: input.description,
    cover: input.cover,
    coverArtwork: input.coverArtwork,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateScrapbook(scrapbookId: string, ownerId: string, input: ScrapbookInput) {
  await updateDoc(doc(db(), "scrapbooks", scrapbookId), {
    ownerId,
    title: input.title,
    description: input.description,
    cover: input.cover,
    coverArtwork: input.coverArtwork,
    updatedAt: serverTimestamp(),
  });
}

export async function createScrapbookPage(scrapbookId: string, input: ScrapbookPageInput) {
  const database = db();
  const pageRef = doc(pagesCollection(scrapbookId));
  const batch = writeBatch(database);
  const timestamp = serverTimestamp();

  batch.set(pageRef, {
    title: input.title,
    layout: input.layout,
    layoutStyle: input.layoutStyle,
    paper: input.paper,
    textureId: input.textureId,
    tapeId: input.tapeId,
    vibe: input.vibe,
    caption: input.caption,
    memoryId: input.memoryId,
    photos: input.photos,
    track: input.track,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  batch.update(doc(database, "scrapbooks", scrapbookId), { updatedAt: serverTimestamp() });
  await batch.commit();
  return pageRef.id;
}

export async function saveScrapbookPage(
  scrapbookId: string,
  pageId: string,
  input: ScrapbookPageInput,
  idToken: string,
) {
  const response = await fetch("/api/scrapbooks/pages", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ scrapbookId, pageId, page: input }),
  });
  const result = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(result?.error ?? "The page could not be saved. Please try again.");
}
