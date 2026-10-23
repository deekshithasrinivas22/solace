"use client";

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type {
  DecorationId,
  PlacedDecoration,
  PlacedDecorationTarget,
} from "@/types/stationery";

function parentDocument(target: PlacedDecorationTarget) {
  const database = getFirebaseDb();
  if (target.kind === "scrapbook-page") {
    return doc(database, "scrapbooks", target.scrapbookId, "pages", target.pageId);
  }
  return doc(database, "journalEntries", target.entryId);
}

function decorationsCollection(target: PlacedDecorationTarget) {
  return collection(parentDocument(target), "decorations");
}

export function subscribeToPlacedDecorations(
  target: PlacedDecorationTarget,
  onDecorations: (decorations: PlacedDecoration[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(decorationsCollection(target), orderBy("createdAt", "asc")),
    (snapshot) => onDecorations(
      snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as PlacedDecoration),
    ),
    onError,
  );
}

export async function addPlacedDecoration(
  target: PlacedDecorationTarget,
  assetId: DecorationId,
  placement?: Pick<PlacedDecoration, "x" | "y" | "size" | "rotation" | "zIndex">,
) {
  const decorationRef = doc(decorationsCollection(target));
  const seed = decorationRef.id.split("").reduce((value, character) => value + character.charCodeAt(0), 0);
  const nextPlacement = placement ?? {
    x: 18 + (seed % 65),
    y: 18 + ((seed * 31) % 65),
    size: 16,
    rotation: (seed % 7) - 3,
    zIndex: Date.now() % 2000000000,
  };
  await setDoc(decorationRef, {
    assetId,
    ...nextPlacement,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return decorationRef.id;
}

export async function updatePlacedDecoration(
  target: PlacedDecorationTarget,
  decorationId: string,
  placement: Pick<PlacedDecoration, "x" | "y" | "size" | "rotation" | "zIndex">,
) {
  await updateDoc(doc(decorationsCollection(target), decorationId), {
    ...placement,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePlacedDecoration(
  target: PlacedDecorationTarget,
  decorationId: string,
) {
  await deleteDoc(doc(decorationsCollection(target), decorationId));
}

export async function migrateLegacyDecorations(
  target: PlacedDecorationTarget,
  assetIds: DecorationId[],
) {
  if (!assetIds.length) return;
  const database = getFirebaseDb();
  const batch = writeBatch(database);
  const timestamp = serverTimestamp();

  assetIds.forEach((assetId, index) => {
    const decorationRef = doc(decorationsCollection(target), "legacy-" + String(index + 1));
    batch.set(decorationRef, {
      assetId,
      x: Math.max(10, 78 - index * 22),
      y: 24 + index * 22,
      size: 16,
      rotation: index % 2 === 0 ? -4 : 4,
      zIndex: index + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  batch.update(parentDocument(target), {
    decorationIds: deleteField(),
    updatedAt: serverTimestamp(),
    ...(target.kind === "scrapbook-page" ? { vibe: "core-memory" } : {}),
  });
  await batch.commit();
}
