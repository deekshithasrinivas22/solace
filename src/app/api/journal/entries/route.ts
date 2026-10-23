import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { destroyCloudinaryPhoto, isJournalPhoto, isOwnedJournalPhoto } from "@/lib/cloudinary";
import type { JournalPhoto } from "@/types/journal";

export const runtime = "nodejs";

const deleteEntrySchema = z.object({
  entryId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
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
    return originUrl.origin === origin
      && originUrl.origin === new URL(expectedProtocol + "://" + expectedHost).origin;
  } catch {
    return false;
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
  const parsed = deleteEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "This journal page request is incomplete." }, { status: 400 });
  }

  try {
    const uid = (await getAdminAuth().verifyIdToken(authorization.slice("Bearer ".length), true)).uid;
    const database = getAdminDb();
    const entryRef = database.collection("journalEntries").doc(parsed.data.entryId);
    const entry = await entryRef.get();
    if (!entry.exists || entry.data()?.ownerId !== uid) {
      return NextResponse.json({ error: "This journal page could not be found." }, { status: 404 });
    }
    const photos: JournalPhoto[] = Array.isArray(entry.data()?.photos)
      ? (entry.data()?.photos as unknown[]).filter(isJournalPhoto).filter((photo: JournalPhoto) => isOwnedJournalPhoto(photo.publicId, uid, parsed.data.entryId))
      : [];
    await database.recursiveDelete(entryRef);
    const cleanup = await Promise.allSettled(photos.map((photo) => destroyCloudinaryPhoto(photo.publicId)));
    const photoCleanupPending = cleanup.some((result) => result.status === "rejected");
    if (photoCleanupPending) console.error("Solace could not remove every Cloudinary photo for a deleted journal page.");
    return NextResponse.json({ ok: true, photoCleanupPending });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Firebase Admin is not configured")) {
      return NextResponse.json({ error: "Firebase’s server settings are missing from .env.local." }, { status: 503 });
    }
    console.error("Solace journal page deletion failed:", message);
    return NextResponse.json({ error: "The journal page could not be deleted. Please try again." }, { status: 500 });
  }
}
