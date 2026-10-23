import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  destroyCloudinaryPhoto,
  hasValidImageSignature,
  isJournalPhoto,
  isOwnedJournalPhoto,
  signedJournalPhotoUrl,
  uploadJournalPhoto,
  validImageFile,
} from "@/lib/cloudinary";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { JournalPhoto } from "@/types/journal";

export const runtime = "nodejs";

const actionSchema = z.object({
  entryId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  publicId: z.string().min(1).max(300).regex(/^[A-Za-z0-9_/-]+$/),
});
const photoContentTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
const maximumPhotos = 10;

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const expectedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
    const expectedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(/:$/, "");
    return Boolean(expectedHost) && originUrl.origin === origin
      && originUrl.origin === new URL(`${expectedProtocol}://${expectedHost}`).origin;
  } catch {
    return false;
  }
}

async function getVerifiedUid(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  try {
    return (await getAdminAuth().verifyIdToken(authorization.slice("Bearer ".length), true)).uid;
  } catch {
    return null;
  }
}

function response(body: BodyInit | null, status = 200, contentType?: string) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  if (contentType) headers.set("Content-Type", contentType);
  return new NextResponse(body, { status, headers });
}

function photoRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : "Photo action could not be completed.";
  if (message.startsWith("Cloudinary is not configured")) {
    return NextResponse.json({ error: "Add Cloudinary’s server-only values to .env.local, then restart Solace." }, { status: 503 });
  }
  if (message.startsWith("Firebase Admin is not configured")) {
    return NextResponse.json({ error: "Firebase’s server settings are missing from .env.local." }, { status: 503 });
  }
  console.error("Solace journal photo request failed:", message);
  return NextResponse.json({ error: "That photo change couldn’t be completed. Please try again." }, { status: 500 });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const uid = await getVerifiedUid(request);
  if (!uid) return NextResponse.json({ error: "Sign in again before adding a photo." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8 * 1024 * 1024 + 128 * 1024) {
    return NextResponse.json({ error: "Choose a photo smaller than 8 MB." }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "The photo upload could not be read." }, { status: 400 });
  const entryId = String(form.get("entryId") ?? "");
  const file = form.get("file");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(entryId) || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a photo for this saved journal page." }, { status: 400 });
  }
  if (!validImageFile(file) || !(await hasValidImageSignature(file))) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP photo smaller than 8 MB." }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const entryRef = db.collection("journalEntries").doc(entryId);
    const entrySnapshot = await entryRef.get();
    if (!entrySnapshot.exists || entrySnapshot.data()?.ownerId !== uid) {
      return NextResponse.json({ error: "This journal page could not be found." }, { status: 404 });
    }
    if ((Array.isArray(entrySnapshot.data()?.photos) ? entrySnapshot.data()?.photos.length : 0) >= maximumPhotos) {
      return NextResponse.json({ error: `A journal page can hold up to ${maximumPhotos} photos.` }, { status: 409 });
    }

    const photo = await uploadJournalPhoto(file, uid, entryId);
    try {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(entryRef);
        if (!current.exists || current.data()?.ownerId !== uid) throw new Error("ENTRY_NOT_FOUND");
        const photos = Array.isArray(current.data()?.photos) ? current.data()?.photos as unknown[] : [];
        if (photos.length >= maximumPhotos) throw new Error("ENTRY_FULL");
        transaction.update(entryRef, { photos: [...photos, photo], updatedAt: FieldValue.serverTimestamp() });
      });
    } catch (error) {
      await destroyCloudinaryPhoto(photo.publicId).catch(() => undefined);
      throw error;
    }
    const query = new URLSearchParams({ entryId, publicId: photo.publicId });
    return NextResponse.json({ photo, url: `/api/journal/photos?${query.toString()}` });
  } catch (error) {
    if (error instanceof Error && error.message === "ENTRY_FULL") {
      return NextResponse.json({ error: `A journal page can hold up to ${maximumPhotos} photos.` }, { status: 409 });
    }
    if (error instanceof Error && error.message === "ENTRY_NOT_FOUND") {
      return NextResponse.json({ error: "This journal page could not be found." }, { status: 404 });
    }
    return photoRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const uid = await getVerifiedUid(request);
  if (!uid) return NextResponse.json({ error: "Sign in again before removing a photo." }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "This photo request is incomplete." }, { status: 400 });

  try {
    const db = getAdminDb();
    const entryRef = db.collection("journalEntries").doc(parsed.data.entryId);
    const entrySnapshot = await entryRef.get();
    if (!entrySnapshot.exists || entrySnapshot.data()?.ownerId !== uid) {
      return NextResponse.json({ error: "This journal page could not be found." }, { status: 404 });
    }
    const photos = Array.isArray(entrySnapshot.data()?.photos)
      ? entrySnapshot.data()?.photos.filter(isJournalPhoto) as JournalPhoto[]
      : [];
    const photo = photos.find((item) => item.publicId === parsed.data.publicId);
    if (!photo || !isOwnedJournalPhoto(photo.publicId, uid, parsed.data.entryId)) {
      return NextResponse.json({ error: "This photo could not be verified." }, { status: 404 });
    }
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(entryRef);
      if (!current.exists || current.data()?.ownerId !== uid) throw new Error("ENTRY_NOT_FOUND");
      const currentPhotos = Array.isArray(current.data()?.photos) ? current.data()?.photos as unknown[] : [];
      if (!currentPhotos.some((item) => isJournalPhoto(item) && item.publicId === parsed.data.publicId)) {
        throw new Error("PHOTO_NOT_FOUND");
      }
      transaction.update(entryRef, {
        photos: currentPhotos.filter((item) => !isJournalPhoto(item) || item.publicId !== parsed.data.publicId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    try {
      await destroyCloudinaryPhoto(photo.publicId);
      return NextResponse.json({ ok: true, photoCleanupPending: false });
    } catch (cleanupError) {
      console.error("Solace could not remove a journal photo asset:", cleanupError);
      return NextResponse.json({ ok: true, photoCleanupPending: true });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "ENTRY_NOT_FOUND") {
      return NextResponse.json({ error: "This journal page could not be found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PHOTO_NOT_FOUND") {
      return NextResponse.json({ error: "This photo is no longer attached to the page." }, { status: 404 });
    }
    return photoRouteError(error);
  }
}

export async function GET(request: NextRequest) {
  const parsed = actionSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) return response("Photo not found.", 404, "text/plain; charset=utf-8");
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return response("Sign in to view this photo.", 401, "text/plain; charset=utf-8");

  let uid: string;
  try {
    ({ uid } = await getAdminAuth().verifySessionCookie(sessionCookie, true));
  } catch {
    return response("Sign in again to view this photo.", 401, "text/plain; charset=utf-8");
  }

  try {
    const { entryId, publicId } = parsed.data;
    const entrySnapshot = await getAdminDb().collection("journalEntries").doc(entryId).get();
    if (!entrySnapshot.exists || entrySnapshot.data()?.ownerId !== uid) return response("Photo not found.", 404, "text/plain; charset=utf-8");
    const photos = Array.isArray(entrySnapshot.data()?.photos) ? entrySnapshot.data()?.photos as unknown[] : [];
    const photo = photos.find((item): item is JournalPhoto => isJournalPhoto(item) && item.publicId === publicId);
    if (!photo || !isOwnedJournalPhoto(publicId, uid, entryId)) return response("Photo not found.", 404, "text/plain; charset=utf-8");

    const cloudinaryResponse = await fetch(signedJournalPhotoUrl(photo), { cache: "no-store" });
    if (!cloudinaryResponse.ok || !cloudinaryResponse.body) return response("Photo could not be opened.", 502, "text/plain; charset=utf-8");
    const contentType = cloudinaryResponse.headers.get("content-type")?.split(";")[0]?.toLowerCase();
    if (contentType !== photoContentTypes[photo.format]) return response("Photo could not be verified.", 502, "text/plain; charset=utf-8");
    const result = response(cloudinaryResponse.body, 200, contentType);
    const contentLength = Number(cloudinaryResponse.headers.get("content-length"));
    if (Number.isSafeInteger(contentLength) && contentLength > 0 && contentLength <= 8 * 1024 * 1024) {
      result.headers.set("Content-Length", String(contentLength));
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo access could not be verified.";
    if (message.startsWith("Firebase Admin is not configured") || message.startsWith("Cloudinary is not configured")) {
      return response("Photo service is not configured.", 503, "text/plain; charset=utf-8");
    }
    return response("Photo could not be opened.", 502, "text/plain; charset=utf-8");
  }
}
