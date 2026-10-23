import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  destroyCloudinaryPhoto,
  hasValidImageSignature,
  isMemoryPhoto,
  isOwnedMemoryPhoto,
  signedMemoryPhotoUrl,
  uploadMemoryPhoto,
  validImageFile,
} from "@/lib/cloudinary";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { MemoryPhoto } from "@/types/memory";

export const runtime = "nodejs";

const photoActionSchema = z.object({
  memoryId: z.string().min(1).max(128).refine((value) => !value.includes("/")),
  publicId: z.string().min(1).max(300),
});
const photoQuerySchema = photoActionSchema;
const photoContentTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.headers.get("host");
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const expectedProtocol = forwardedProtocol || request.nextUrl.protocol.replace(/:$/, "");
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

function photoResponse(body: BodyInit | null, status = 200, contentType?: string) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  if (contentType) headers.set("Content-Type", contentType);
  return new NextResponse(body, { status, headers });
}

function photoActionError(error: unknown) {
  const message = error instanceof Error ? error.message : "Photo action could not be completed.";
  if (message.startsWith("Cloudinary is not configured")) {
    return NextResponse.json({ error: "Add Cloudinary's server-only values to .env.local, then restart Solace." }, { status: 503 });
  }
  if (message.startsWith("Firebase Admin is not configured")) {
    return NextResponse.json({ error: "Firebase’s server settings are missing from .env.local." }, { status: 503 });
  }
  console.error("Solace memory photo request failed:", message);
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
  const memoryId = String(form.get("memoryId") ?? "");
  const file = form.get("file");
  if (!memoryId || memoryId.length > 128 || memoryId.includes("/") || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a photo for this memory and try again." }, { status: 400 });
  }
  if (!validImageFile(file) || !(await hasValidImageSignature(file))) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP photo smaller than 8 MB." }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const memoryRef = db.collection("memories").doc(memoryId);
    const memorySnapshot = await memoryRef.get();
    if (!memorySnapshot.exists || memorySnapshot.data()?.ownerId !== uid) {
      return NextResponse.json({ error: "This memory could not be found." }, { status: 404 });
    }
    const currentPhotos = Array.isArray(memorySnapshot.data()?.photos) ? memorySnapshot.data()?.photos as unknown[] : [];
    if (currentPhotos.length >= 5) return NextResponse.json({ error: "A memory can hold up to five photos." }, { status: 409 });

    const photo = await uploadMemoryPhoto(file, uid, memoryId);
    try {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(memoryRef);
        if (!current.exists || current.data()?.ownerId !== uid) throw new Error("MEMORY_NOT_FOUND");
        const photos = Array.isArray(current.data()?.photos) ? current.data()?.photos as unknown[] : [];
        if (photos.length >= 5) throw new Error("MEMORY_FULL");
        transaction.update(memoryRef, { photos: [...photos, photo], updatedAt: FieldValue.serverTimestamp() });
      });
    } catch (error) {
      await destroyCloudinaryPhoto(photo.publicId).catch(() => undefined);
      throw error;
    }
    const query = new URLSearchParams({ memoryId, publicId: photo.publicId });
    return NextResponse.json({ photo, url: `/api/memories/photos?${query.toString()}` });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMORY_FULL") {
      return NextResponse.json({ error: "A memory can hold up to five photos." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "MEMORY_NOT_FOUND") {
      return NextResponse.json({ error: "This memory could not be found." }, { status: 404 });
    }
    return photoActionError(error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const uid = await getVerifiedUid(request);
  if (!uid) return NextResponse.json({ error: "Sign in again before removing a photo." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = photoActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "This photo request is incomplete." }, { status: 400 });

  try {
    const db = getAdminDb();
    const memoryRef = db.collection("memories").doc(parsed.data.memoryId);
    const memorySnapshot = await memoryRef.get();
    if (!memorySnapshot.exists || memorySnapshot.data()?.ownerId !== uid) {
      return NextResponse.json({ error: "This memory could not be found." }, { status: 404 });
    }
    const photos = Array.isArray(memorySnapshot.data()?.photos)
      ? memorySnapshot.data()?.photos.filter(isMemoryPhoto) as MemoryPhoto[]
      : [];
    const photo = photos.find((item) => item.publicId === parsed.data.publicId);
    if (!photo || !isOwnedMemoryPhoto(photo.publicId, uid, parsed.data.memoryId)) {
      return NextResponse.json({ error: "This photo could not be verified." }, { status: 404 });
    }

    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(memoryRef);
      if (!current.exists || current.data()?.ownerId !== uid) throw new Error("MEMORY_NOT_FOUND");
      const latestPhotos = Array.isArray(current.data()?.photos) ? current.data()?.photos as unknown[] : [];
      if (!latestPhotos.some((item) => isMemoryPhoto(item) && item.publicId === parsed.data.publicId)) {
        throw new Error("PHOTO_NOT_FOUND");
      }
      transaction.update(memoryRef, {
        photos: latestPhotos.filter((item) => !isMemoryPhoto(item) || item.publicId !== parsed.data.publicId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await destroyCloudinaryPhoto(photo.publicId);
    return NextResponse.json({ ok: true, photoCleanupPending: false });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMORY_NOT_FOUND") {
      return NextResponse.json({ error: "This memory could not be found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PHOTO_NOT_FOUND") {
      return NextResponse.json({ error: "This photo is no longer attached to the memory." }, { status: 404 });
    }
    if (error instanceof Error && error.message.startsWith("Cloudinary")) {
      console.error("Solace could not remove a memory photo asset:", error.message);
      return NextResponse.json({ ok: true, photoCleanupPending: true });
    }
    return photoActionError(error);
  }
}

export async function GET(request: NextRequest) {
  const parsed = photoQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) return photoResponse("Photo not found.", 404, "text/plain; charset=utf-8");
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return photoResponse("Sign in to view this photo.", 401, "text/plain; charset=utf-8");

  let uid: string;
  try {
    ({ uid } = await getAdminAuth().verifySessionCookie(sessionCookie, true));
  } catch {
    return photoResponse("Sign in again to view this photo.", 401, "text/plain; charset=utf-8");
  }

  try {
    const { memoryId, publicId } = parsed.data;
    const memorySnapshot = await getAdminDb().collection("memories").doc(memoryId).get();
    if (!memorySnapshot.exists || memorySnapshot.data()?.ownerId !== uid) {
      return photoResponse("Photo not found.", 404, "text/plain; charset=utf-8");
    }
    const photos = Array.isArray(memorySnapshot.data()?.photos) ? memorySnapshot.data()?.photos as unknown[] : [];
    const photo = photos.find((item): item is MemoryPhoto => isMemoryPhoto(item) && item.publicId === publicId);
    if (!photo || !isOwnedMemoryPhoto(publicId, uid, memoryId)) {
      return photoResponse("Photo not found.", 404, "text/plain; charset=utf-8");
    }

    const cloudinaryResponse = await fetch(signedMemoryPhotoUrl(photo), { cache: "no-store" });
    if (!cloudinaryResponse.ok || !cloudinaryResponse.body) {
      return photoResponse("Photo could not be opened.", 502, "text/plain; charset=utf-8");
    }
    const contentType = cloudinaryResponse.headers.get("content-type")?.split(";")[0]?.toLowerCase();
    if (contentType !== photoContentTypes[photo.format]) {
      return photoResponse("Photo could not be verified.", 502, "text/plain; charset=utf-8");
    }
    const response = photoResponse(cloudinaryResponse.body, 200, contentType);
    const contentLength = Number(cloudinaryResponse.headers.get("content-length"));
    if (Number.isSafeInteger(contentLength) && contentLength > 0 && contentLength <= 8 * 1024 * 1024) {
      response.headers.set("Content-Length", String(contentLength));
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo access could not be verified.";
    if (message.startsWith("Firebase Admin is not configured") || message.startsWith("Cloudinary is not configured")) {
      return photoResponse("Photo service is not configured.", 503, "text/plain; charset=utf-8");
    }
    return photoResponse("Photo could not be opened.", 502, "text/plain; charset=utf-8");
  }
}
