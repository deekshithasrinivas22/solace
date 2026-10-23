import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  destroyScrapbookPhoto,
  hasValidImageSignature,
  isOwnedScrapbookPhoto,
  isScrapbookPhoto,
  signedScrapbookPhotoUrl,
  uploadScrapbookPhoto,
  validImageFile,
} from "@/lib/cloudinary";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/session";

export const runtime = "nodejs";

const tokenSchema = z.object({ idToken: z.string().min(1).max(10_000) });
const photoActionSchema = z.object({
  action: z.enum(["deliver-scrapbook-photos", "remove-scrapbook-photo"]),
  scrapbookId: z.string().min(1).max(128),
  pageId: z.string().min(1).max(128),
  publicId: z.string().min(1).max(300).optional(),
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
    const expectedOrigin = new URL(`${expectedProtocol}://${expectedHost}`).origin;
    return originUrl.origin === origin && originUrl.origin === expectedOrigin;
  } catch {
    return false;
  }
}

async function getVerifiedUid(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  try {
    const token = authorization.slice("Bearer ".length);
    return (await getAdminAuth().verifyIdToken(token, true)).uid;
  } catch {
    return null;
  }
}

async function getOwnedPage(uid: string, scrapbookId: string, pageId: string) {
  const db = getAdminDb();
  const bookRef = db.collection("scrapbooks").doc(scrapbookId);
  const pageRef = bookRef.collection("pages").doc(pageId);
  const [bookSnapshot, pageSnapshot] = await Promise.all([bookRef.get(), pageRef.get()]);
  if (!bookSnapshot.exists || bookSnapshot.data()?.ownerId !== uid || !pageSnapshot.exists) return null;
  return { db, bookRef, pageRef, pageData: pageSnapshot.data() ?? {} };
}

function photoRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : "Photo action could not be completed.";
  if (message.startsWith("Cloudinary is not configured")) {
    return NextResponse.json({ error: "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to .env.local, then restart Solace." }, { status: 503 });
  }
  if (message.startsWith("Firebase Admin is not configured")) {
    return NextResponse.json({ error: "Firebase’s server settings are missing from .env.local." }, { status: 503 });
  }
  console.error("Solace scrapbook photo request failed:", message);
  return NextResponse.json({ error: message }, { status: 400 });
}

async function uploadScrapbookPhotoRequest(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const uid = await getVerifiedUid(request);
  if (!uid) return NextResponse.json({ error: "Sign in again before adding a photo." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8 * 1024 * 1024 + 128 * 1024) {
    return NextResponse.json({ error: "Choose a photo smaller than 8 MB." }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "The photo upload could not be read." }, { status: 400 });
  const scrapbookId = String(form.get("scrapbookId") ?? "");
  const pageId = String(form.get("pageId") ?? "");
  const file = form.get("file");
  if (!scrapbookId || scrapbookId.length > 128 || !pageId || pageId.length > 128 || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a photo from this page and try again." }, { status: 400 });
  }
  if (!validImageFile(file) || !(await hasValidImageSignature(file))) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP photo smaller than 8 MB." }, { status: 400 });
  }

  try {
    const ownedPage = await getOwnedPage(uid, scrapbookId, pageId);
    if (!ownedPage) return NextResponse.json({ error: "This scrapbook page could not be found." }, { status: 404 });
    const currentPhotos = Array.isArray(ownedPage.pageData.photos) ? ownedPage.pageData.photos : [];
    if (currentPhotos.length >= 3) return NextResponse.json({ error: "This page already has three photos." }, { status: 409 });

    const photo = await uploadScrapbookPhoto(file, uid, scrapbookId, pageId);
    try {
      await ownedPage.db.runTransaction(async (transaction) => {
        const bookSnapshot = await transaction.get(ownedPage.bookRef);
        const pageSnapshot = await transaction.get(ownedPage.pageRef);
        if (!bookSnapshot.exists || bookSnapshot.data()?.ownerId !== uid || !pageSnapshot.exists) {
          throw new Error("PAGE_NOT_FOUND");
        }
        const photos = Array.isArray(pageSnapshot.data()?.photos) ? pageSnapshot.data()?.photos as unknown[] : [];
        if (photos.length >= 3) throw new Error("PAGE_FULL");
        transaction.update(ownedPage.pageRef, { photos: [...photos, photo], updatedAt: FieldValue.serverTimestamp() });
        transaction.update(ownedPage.bookRef, { updatedAt: FieldValue.serverTimestamp() });
      });
    } catch (error) {
      await destroyScrapbookPhoto(photo.publicId).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ photo, url: signedScrapbookPhotoUrl(photo) });
  } catch (error) {
    if (error instanceof Error && error.message === "PAGE_FULL") {
      return NextResponse.json({ error: "This page already has three photos." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "PAGE_NOT_FOUND") {
      return NextResponse.json({ error: "This scrapbook page could not be found." }, { status: 404 });
    }
    return photoRouteError(error);
  }
}

async function scrapbookPhotoAction(request: NextRequest, body: unknown) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const parsed = photoActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "This photo request is incomplete." }, { status: 400 });
  const uid = await getVerifiedUid(request);
  if (!uid) return NextResponse.json({ error: "Sign in again before opening these photos." }, { status: 401 });

  try {
    const { action, scrapbookId, pageId, publicId } = parsed.data;
    const ownedPage = await getOwnedPage(uid, scrapbookId, pageId);
    if (!ownedPage) return NextResponse.json({ error: "This scrapbook page could not be found." }, { status: 404 });
    const photos = Array.isArray(ownedPage.pageData.photos)
      ? ownedPage.pageData.photos.filter(isScrapbookPhoto)
      : [];

    if (action === "deliver-scrapbook-photos") {
      const verifiedPhotos = photos.filter((photo) => isOwnedScrapbookPhoto(photo.publicId, uid, scrapbookId, pageId));
      return NextResponse.json({
        photos: verifiedPhotos.map((photo) => {
          const query = new URLSearchParams({ scrapbookId, pageId, publicId: photo.publicId });
          return { photo, url: `/api/scrapbooks/photos?${query.toString()}` };
        }),
      });
    }

    if (!publicId || !isOwnedScrapbookPhoto(publicId, uid, scrapbookId, pageId)) {
      return NextResponse.json({ error: "This photo could not be verified." }, { status: 400 });
    }
    const photo = photos.find((item) => item.publicId === publicId);
    if (!photo) return NextResponse.json({ error: "This photo is no longer on the page." }, { status: 404 });

    await ownedPage.db.runTransaction(async (transaction) => {
      const bookSnapshot = await transaction.get(ownedPage.bookRef);
      const pageSnapshot = await transaction.get(ownedPage.pageRef);
      if (!bookSnapshot.exists || bookSnapshot.data()?.ownerId !== uid || !pageSnapshot.exists) {
        throw new Error("PAGE_NOT_FOUND");
      }
      const latestPhotos = Array.isArray(pageSnapshot.data()?.photos)
        ? pageSnapshot.data()?.photos as unknown[]
        : [];
      transaction.update(ownedPage.pageRef, {
        photos: latestPhotos.filter((item) => !isScrapbookPhoto(item) || item.publicId !== publicId),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(ownedPage.bookRef, { updatedAt: FieldValue.serverTimestamp() });
    });
    await destroyScrapbookPhoto(publicId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return photoRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    return uploadScrapbookPhotoRequest(request);
  }

  const body = await request.json().catch(() => null);
  if (typeof body === "object" && body !== null && "action" in body) {
    return scrapbookPhotoAction(request, body);
  }
  const parsed = tokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid Firebase sign-in token is required." }, { status: 400 });
  }

  try {
    await getAdminAuth().verifyIdToken(parsed.data.idToken, true);
    const sessionCookie = await getAdminAuth().createSessionCookie(parsed.data.idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firebase session could not be created.";
    const status = message.startsWith("Firebase Admin is not configured") ? 503 : 401;
    return NextResponse.json(
      {
        error:
          status === 503
            ? "Add the server-only Firebase Admin values from .env.example to .env.local."
            : "Your sign-in could not be verified. Please sign in again.",
      },
      { status },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
