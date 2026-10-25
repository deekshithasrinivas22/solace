import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { destroyScrapbookPhoto, isOwnedScrapbookPhoto, isScrapbookPhoto } from "@/lib/cloudinary";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { scrapbookPageInputSchema } from "@/lib/validations/scrapbook";
import type { ScrapbookPhoto } from "@/types/scrapbook";

export const runtime = "nodejs";

const deletePageSchema = z.object({
  scrapbookId: z.string().min(1).max(128),
  pageId: z.string().min(1).max(128),
});

const savePageSchema = z.object({
  scrapbookId: z.string().min(1).max(128),
  pageId: z.string().min(1).max(128),
  page: scrapbookPageInputSchema,
});

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.headers.get("host");
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const expectedProtocol = forwardedProtocol || request.nextUrl.protocol.replace(/:$/, "");
    if (!expectedHost) return false;
    return originUrl.origin === origin && originUrl.origin === new URL(`${expectedProtocol}://${expectedHost}`).origin;
  } catch {
    return false;
  }
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Sign in again before saving this page." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = savePageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the page details and try again." }, { status: 400 });
  }

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(authorization.slice("Bearer ".length), true)).uid;
  } catch {
    return NextResponse.json({ error: "Sign in again before saving this page." }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const bookRef = db.collection("scrapbooks").doc(parsed.data.scrapbookId);
    const pageRef = bookRef.collection("pages").doc(parsed.data.pageId);
    await db.runTransaction(async (transaction) => {
      const [bookSnapshot, pageSnapshot] = await Promise.all([
        transaction.get(bookRef),
        transaction.get(pageRef),
      ]);
      if (!bookSnapshot.exists || bookSnapshot.data()?.ownerId !== uid || !pageSnapshot.exists) {
        throw new Error("PAGE_NOT_FOUND");
      }

      const page = parsed.data.page;
      if (page.memoryId) {
        const memorySnapshot = await transaction.get(db.collection("memories").doc(page.memoryId));
        if (!memorySnapshot.exists || memorySnapshot.data()?.ownerId !== uid) {
          throw new Error("MEMORY_NOT_OWNED");
        }
      }
      const submittedPhotos = new Map(page.photos.map((photo) => [photo.publicId, photo]));
      const storedPhotos = Array.isArray(pageSnapshot.data()?.photos)
        ? (pageSnapshot.data()?.photos as unknown[]).filter(
          (photo): photo is ScrapbookPhoto => isScrapbookPhoto(photo)
            && isOwnedScrapbookPhoto(photo.publicId, uid, parsed.data.scrapbookId, parsed.data.pageId),
        )
        : [];
      if ([...submittedPhotos.keys()].some((publicId) => !storedPhotos.some((photo) => photo.publicId === publicId))) {
        throw new Error("PHOTO_NOT_FOUND");
      }
      const photos = storedPhotos.map((photo) => {
        const position = submittedPhotos.get(photo.publicId)?.position;
        return position ? { ...photo, position } : photo;
      });

      transaction.update(pageRef, {
        title: page.title,
        layout: page.layout,
        layoutStyle: page.layoutStyle,
        paper: page.paper,
        textureId: page.textureId,
        tapeId: page.tapeId,
        vibe: page.vibe,
        caption: page.caption,
        memoryId: page.memoryId,
        photos,
        track: page.track,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(bookRef, { updatedAt: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "PAGE_NOT_FOUND") {
      return NextResponse.json({ error: "This scrapbook page could not be found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PHOTO_NOT_FOUND") {
      return NextResponse.json({ error: "A photo changed in another tab. Refresh the page, then try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "MEMORY_NOT_OWNED") {
      return NextResponse.json({ error: "Choose a memory from your own shelf." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "The page could not be saved.";
    if (message.startsWith("Firebase Admin is not configured")) {
      return NextResponse.json({ error: "Firebase’s server settings are missing from .env.local." }, { status: 503 });
    }
    console.error("Solace scrapbook page save failed:", message);
    return NextResponse.json({ error: "The page could not be saved. Please try again." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Sign in again before deleting this page." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deletePageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "This page request is incomplete." }, { status: 400 });

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(authorization.slice("Bearer ".length), true)).uid;
  } catch {
    return NextResponse.json({ error: "Sign in again before deleting this page." }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const bookRef = db.collection("scrapbooks").doc(parsed.data.scrapbookId);
    const pageRef = bookRef.collection("pages").doc(parsed.data.pageId);
    const [bookSnapshot, pageSnapshot] = await Promise.all([bookRef.get(), pageRef.get()]);
    if (!bookSnapshot.exists || bookSnapshot.data()?.ownerId !== uid || !pageSnapshot.exists) {
      return NextResponse.json({ error: "This scrapbook page could not be found." }, { status: 404 });
    }

    const photos = Array.isArray(pageSnapshot.data()?.photos) ? pageSnapshot.data()?.photos as unknown[] : [];
    const ownedPhotos = photos.filter(
      (photo): photo is ScrapbookPhoto => isScrapbookPhoto(photo)
        && isOwnedScrapbookPhoto(photo.publicId, uid, parsed.data.scrapbookId, parsed.data.pageId),
    );

    await db.runTransaction(async (transaction) => {
      const [currentBook, currentPage] = await Promise.all([
        transaction.get(bookRef),
        transaction.get(pageRef),
      ]);
      if (!currentBook.exists || currentBook.data()?.ownerId !== uid || !currentPage.exists) {
        throw new Error("PAGE_NOT_FOUND");
      }
      transaction.delete(pageRef);
      transaction.update(bookRef, { updatedAt: FieldValue.serverTimestamp() });
    });

    await db.recursiveDelete(pageRef);

    const cleanupResults = await Promise.allSettled(ownedPhotos.map((photo) => destroyScrapbookPhoto(photo.publicId)));
    const photoCleanupPending = cleanupResults.some((result) => result.status === "rejected");
    if (photoCleanupPending) console.error("Solace could not remove every scrapbook page photo from Cloudinary.");

    return NextResponse.json({ ok: true, photoCleanupPending });
  } catch (error) {
    if (error instanceof Error && error.message === "PAGE_NOT_FOUND") {
      return NextResponse.json({ error: "This scrapbook page could not be found." }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "The page could not be deleted.";
    if (message.startsWith("Firebase Admin is not configured")) {
      return NextResponse.json({ error: "Firebase’s server settings are missing from .env.local." }, { status: 503 });
    }
    console.error("Solace scrapbook page deletion failed:", message);
    return NextResponse.json({ error: "The page could not be deleted. Please try again." }, { status: 500 });
  }
}
