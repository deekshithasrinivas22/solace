import { NextResponse, type NextRequest } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { timeCapsuleIdSchema, timeCapsuleInputSchema } from "@/lib/validations/capsule";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest, allowMissingOrigin = false) {
  const origin = request.headers.get("origin");
  if (!origin) return allowMissingOrigin;
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

function timestampDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function capsuleResponse(id: string, data: FirebaseFirestore.DocumentData) {
  const unlockDate = timestampDate(data.unlockAt);
  if (!unlockDate) return null;
  const isUnlocked = unlockDate.getTime() <= Date.now();
  const createdAt = timestampDate(data.createdAt);
  return {
    id,
    title: typeof data.title === "string" ? data.title : "A little note",
    unlockAt: unlockDate.toISOString(),
    createdAt: createdAt?.toISOString() ?? null,
    isUnlocked,
    ...(isUnlocked && typeof data.message === "string" ? { message: data.message } : {}),
  };
}

function firebaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Capsule request failed.";
  if (message.startsWith("Firebase Admin is not configured")) {
    return NextResponse.json({ error: "Firebase’s server settings are missing from .env.local." }, { status: 503 });
  }
  console.error("Solace time capsule request failed:", message);
  return NextResponse.json({ error: "That capsule change couldn’t be saved. Please try again." }, { status: 500 });
}

async function readRequest(request: NextRequest, allowMissingOrigin = false) {
  if (!isSameOrigin(request, allowMissingOrigin)) {
    return { response: NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 }) };
  }
  const uid = await getVerifiedUid(request);
  if (!uid) return { response: NextResponse.json({ error: "Sign in again to open your time capsules." }, { status: 401 }) };
  return { uid };
}

function validateFutureReveal(unlockAt: string) {
  return new Date(unlockAt).getTime() > Date.now() + 60_000;
}

export async function GET(request: NextRequest) {
  const auth = await readRequest(request, true);
  if ("response" in auth) return auth.response;
  try {
    const snapshot = await getAdminDb().collection("timeCapsules")
      .where("ownerId", "==", auth.uid)
      .orderBy("unlockAt", "asc")
      .get();
    const capsules = snapshot.docs
      .map((item) => capsuleResponse(item.id, item.data()))
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return NextResponse.json({ capsules });
  } catch (error) {
    return firebaseError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await readRequest(request);
  if ("response" in auth) return auth.response;
  const parsed = timeCapsuleInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the capsule details." }, { status: 400 });
  if (!validateFutureReveal(parsed.data.unlockAt)) {
    return NextResponse.json({ error: "Choose a reveal time at least one minute from now." }, { status: 400 });
  }

  try {
    const reference = getAdminDb().collection("timeCapsules").doc();
    await reference.set({
      ownerId: auth.uid,
      title: parsed.data.title,
      message: parsed.data.message,
      unlockAt: Timestamp.fromDate(new Date(parsed.data.unlockAt)),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const saved = await reference.get();
    const capsule = capsuleResponse(reference.id, saved.data() ?? {});
    return NextResponse.json({ capsule }, { status: 201 });
  } catch (error) {
    return firebaseError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await readRequest(request);
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = timeCapsuleIdSchema.safeParse(body?.id);
  if (!id.success) return NextResponse.json({ error: "This capsule could not be found." }, { status: 400 });
  try {
    const reference = getAdminDb().collection("timeCapsules").doc(id.data);
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.data()?.ownerId !== auth.uid) {
      return NextResponse.json({ error: "This capsule could not be found." }, { status: 404 });
    }
    await reference.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return firebaseError(error);
  }
}
