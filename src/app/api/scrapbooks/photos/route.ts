import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { isOwnedScrapbookPhoto, isScrapbookPhoto, signedScrapbookPhotoUrl } from "@/lib/cloudinary";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { ScrapbookPhoto } from "@/types/scrapbook";

export const runtime = "nodejs";

const photoRequestSchema = z.object({
  scrapbookId: z.string().min(1).max(128),
  pageId: z.string().min(1).max(128),
  publicId: z.string().min(1).max(300),
});

const photoContentTypes = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

function privatePhotoResponse(body: BodyInit | null, status = 200, contentType?: string) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  if (contentType) headers.set("Content-Type", contentType);
  return new NextResponse(body, { status, headers });
}

export async function GET(request: NextRequest) {
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = photoRequestSchema.safeParse(query);
  if (!parsed.success) return privatePhotoResponse("Photo not found.", 404, "text/plain; charset=utf-8");

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return privatePhotoResponse("Sign in to view this photo.", 401, "text/plain; charset=utf-8");

  let uid: string;
  try {
    ({ uid } = await getAdminAuth().verifySessionCookie(sessionCookie, true));
  } catch {
    return privatePhotoResponse("Sign in again to view this photo.", 401, "text/plain; charset=utf-8");
  }

  try {
    const { scrapbookId, pageId, publicId } = parsed.data;
    const db = getAdminDb();
    const bookRef = db.collection("scrapbooks").doc(scrapbookId);
    const pageRef = bookRef.collection("pages").doc(pageId);
    const [bookSnapshot, pageSnapshot] = await Promise.all([bookRef.get(), pageRef.get()]);
    if (!bookSnapshot.exists || bookSnapshot.data()?.ownerId !== uid || !pageSnapshot.exists) {
      return privatePhotoResponse("Photo not found.", 404, "text/plain; charset=utf-8");
    }

    const photos = Array.isArray(pageSnapshot.data()?.photos) ? pageSnapshot.data()?.photos as unknown[] : [];
    const photo = photos.find(
      (candidate): candidate is ScrapbookPhoto => isScrapbookPhoto(candidate) && candidate.publicId === publicId,
    );
    if (!photo || !isOwnedScrapbookPhoto(publicId, uid, scrapbookId, pageId)) {
      return privatePhotoResponse("Photo not found.", 404, "text/plain; charset=utf-8");
    }

    const cloudinaryResponse = await fetch(signedScrapbookPhotoUrl(photo), {
      cache: "no-store",
    });
    if (!cloudinaryResponse.ok || !cloudinaryResponse.body) {
      return privatePhotoResponse("Photo could not be opened.", 502, "text/plain; charset=utf-8");
    }

    const contentType = cloudinaryResponse.headers.get("content-type")?.split(";")[0]?.toLowerCase();
    if (contentType !== photoContentTypes[photo.format]) {
      return privatePhotoResponse("Photo could not be verified.", 502, "text/plain; charset=utf-8");
    }
    const response = privatePhotoResponse(cloudinaryResponse.body, 200, contentType);
    const contentLength = Number(cloudinaryResponse.headers.get("content-length"));
    if (Number.isSafeInteger(contentLength) && contentLength > 0 && contentLength <= 8 * 1024 * 1024) {
      response.headers.set("Content-Length", String(contentLength));
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo access could not be verified.";
    if (message.startsWith("Firebase Admin is not configured")) {
      return privatePhotoResponse("Photo service is not configured.", 503, "text/plain; charset=utf-8");
    }
    return privatePhotoResponse("Photo could not be opened.", 502, "text/plain; charset=utf-8");
  }
}
