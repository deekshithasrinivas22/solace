import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { destroyCloudinaryPhoto, isMemoryPhoto, isOwnedMemoryPhoto } from "@/lib/cloudinary";
import type { MemoryPhoto } from "@/types/memory";

export const runtime = "nodejs";

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

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return NextResponse.json({ error: "Sign in again before deleting this memory." }, { status: 401 });

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(authorization.slice("Bearer ".length), true)).uid;
  } catch {
    return NextResponse.json({ error: "Sign in again before deleting this memory." }, { status: 401 });
  }

  const memoryId = request.nextUrl.searchParams.get("memoryId") ?? "";
  if (!memoryId || memoryId.length > 128 || memoryId.includes("/")) {
    return NextResponse.json({ error: "This memory request is incomplete." }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const memoryRef = db.collection("memories").doc(memoryId);
    let photosToDelete: MemoryPhoto[] = [];
    await db.runTransaction(async (transaction) => {
      const memorySnapshot = await transaction.get(memoryRef);
      if (!memorySnapshot.exists || memorySnapshot.data()?.ownerId !== uid) throw new Error("MEMORY_NOT_FOUND");
      const photos = Array.isArray(memorySnapshot.data()?.photos) ? memorySnapshot.data()?.photos as unknown[] : [];
      photosToDelete = photos.filter((photo): photo is MemoryPhoto => isMemoryPhoto(photo)
        && isOwnedMemoryPhoto(photo.publicId, uid, memoryId));
      transaction.delete(memoryRef);
    });

    const cleanup = await Promise.allSettled(photosToDelete.map((photo) => destroyCloudinaryPhoto(photo.publicId)));
    const photoCleanupPending = cleanup.some((result) => result.status === "rejected");
    if (photoCleanupPending) console.error("Solace could not remove every deleted memory photo from Cloudinary.");
    return NextResponse.json({ ok: true, photoCleanupPending });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMORY_NOT_FOUND") {
      return NextResponse.json({ error: "This memory could not be found." }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "The memory could not be deleted.";
    if (message.startsWith("Firebase Admin is not configured")) {
      return NextResponse.json({ error: "Firebase’s server settings are missing from .env.local." }, { status: 503 });
    }
    console.error("Solace memory deletion failed:", message);
    return NextResponse.json({ error: "That memory couldn’t be removed. Please try again." }, { status: 500 });
  }
}
