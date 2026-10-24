import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: "demo-solace-rules",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnvironment?.cleanup();
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

function profileData(uid: string, email: string) {
  return {
    uid,
    email,
    displayName: "Ari",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function memoryData(ownerId: string) {
  return {
    ownerId,
    title: "A day worth keeping",
    description: "We took the long way home.",
    memoryDate: "2026-10-23",
    location: "By the lake",
    mood: "grateful",
    tags: ["friends", "autumn"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function scrapbookData(ownerId: string) {
  return {
    ownerId,
    title: "Autumn by the lake",
    description: "Little moments from October.",
    cover: "meadow",
    coverArtwork: "polaroid-01",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function scrapbookPageData(memoryId = "") {
  return {
    title: "The long way home",
    layout: "polaroid",
    paper: "cream",
    textureId: "handmade-ivory",
    tapeId: "washi-06",
    vibe: "core-memory",
    decorationIds: ["flower-05", "ticket-04"],
    caption: "We stayed until the sky turned pink.",
    memoryId,
    photos: [],
    track: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function placedDecorationData(assetId = "flower-01") {
  return {
    assetId,
    x: 52.5,
    y: 43,
    size: 16,
    rotation: -4,
    zIndex: 1024,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function journalEntryData(ownerId: string) {
  return {
    ownerId,
    title: "The ride home",
    body: "The sky went rose gold.",
    entryDate: "2026-10-23",
    mood: "nostalgic",
    textureId: "lined-paper",
    tapeId: "washi-08",
    decorationIds: ["flower-05", "ticket-04"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

describe("Firestore user profile rules", () => {
  it("allows a user to create and update their own profile", async () => {
    const db = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const profile = doc(db, "users", "ari");

    await assertSucceeds(setDoc(profile, profileData("ari", "ari@example.com")));
    await assertSucceeds(updateDoc(profile, { displayName: "Ari M.", updatedAt: serverTimestamp() }));
  });

  it("keeps profiles private and blocks forged or unexpected fields", async () => {
    const ariDb = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const samDb = testEnvironment.authenticatedContext("sam", { email: "sam@example.com" }).firestore();
    const ariProfile = doc(ariDb, "users", "ari");

    await assertSucceeds(setDoc(ariProfile, profileData("ari", "ari@example.com")));
    await assertFails(getDoc(doc(samDb, "users", "ari")));
    await assertFails(setDoc(doc(samDb, "users", "ari"), profileData("ari", "ari@example.com")));
    await assertFails(
      setDoc(doc(ariDb, "users", "ari"), {
        ...profileData("ari", "ari@example.com"),
        role: "admin",
      }),
    );
  });
});

describe("Firestore private memory rules", () => {
  it("allows an owner to create, read, edit, and remove a memory", async () => {
    const db = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const memory = doc(db, "memories", "ari-memory");

    await assertSucceeds(setDoc(memory, memoryData("ari")));
    await assertSucceeds(getDoc(memory));
    await assertSucceeds(updateDoc(memory, { title: "A day I still love", updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(memory));
  });

  it("keeps memories private and blocks forged owners or unexpected fields", async () => {
    const ariDb = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const samDb = testEnvironment.authenticatedContext("sam", { email: "sam@example.com" }).firestore();
    const ariMemory = doc(ariDb, "memories", "ari-memory");
    const samMemory = doc(samDb, "memories", "sam-memory");

    await assertSucceeds(setDoc(ariMemory, memoryData("ari")));
    await assertFails(getDoc(doc(samDb, "memories", "ari-memory")));
    await assertFails(updateDoc(doc(samDb, "memories", "ari-memory"), { title: "stolen" }));
    await assertFails(deleteDoc(doc(samDb, "memories", "ari-memory")));
    await assertFails(setDoc(samMemory, memoryData("ari")));
    await assertFails(setDoc(doc(ariDb, "memories", "extra-field"), { ...memoryData("ari"), shared: true }));
    await assertFails(setDoc(doc(testEnvironment.unauthenticatedContext().firestore(), "memories", "guest"), memoryData("ari")));
  });

  it("allows bounded private photo metadata only inside its owner's memory folder", async () => {
    const db = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const memory = doc(db, "memories", "ari-memory");
    const photo = {
      publicId: "solace/ari/memories/ari-memory/photo_1",
      version: 1730000000,
      format: "jpg",
      width: 1200,
      height: 900,
      bytes: 240000,
    };

    await assertSucceeds(setDoc(memory, memoryData("ari")));
    await assertSucceeds(updateDoc(memory, { photos: [photo], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(memory, {
      photos: [{ ...photo, publicId: "solace/sam/memories/ari-memory/photo_1" }],
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(memory, { photos: Array(6).fill(photo), updatedAt: serverTimestamp() }));
  });
});

describe("Firestore private scrapbook rules", () => {
  it("allows an owner to create, read, update, and delete a scrapbook", async () => {
    const db = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const scrapbook = doc(db, "scrapbooks", "ari-book");

    await assertSucceeds(setDoc(scrapbook, scrapbookData("ari")));
    await assertSucceeds(getDoc(scrapbook));
    await assertSucceeds(updateDoc(scrapbook, { title: "October, kept close", updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(scrapbook));
  });

  it("keeps a scrapbook private and prevents forged owners or unexpected fields", async () => {
    const ariDb = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const samDb = testEnvironment.authenticatedContext("sam", { email: "sam@example.com" }).firestore();

    await assertSucceeds(setDoc(doc(ariDb, "scrapbooks", "ari-book"), scrapbookData("ari")));
    await assertFails(getDoc(doc(samDb, "scrapbooks", "ari-book")));
    await assertFails(updateDoc(doc(samDb, "scrapbooks", "ari-book"), { title: "stolen" }));
    await assertFails(setDoc(doc(samDb, "scrapbooks", "forged"), scrapbookData("ari")));
    await assertFails(setDoc(doc(ariDb, "scrapbooks", "extra-field"), { ...scrapbookData("ari"), shared: true }));
  });

  it("allows an owner to save pages and rejects strangers and links to another user's memory", async () => {
    const ariDb = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const samDb = testEnvironment.authenticatedContext("sam", { email: "sam@example.com" }).firestore();
    const book = doc(ariDb, "scrapbooks", "ari-book");
    const page = doc(ariDb, "scrapbooks", "ari-book", "pages", "page-one");

    await assertSucceeds(setDoc(book, scrapbookData("ari")));
    await assertSucceeds(setDoc(page, scrapbookPageData()));
    await assertSucceeds(getDoc(page));
    await assertSucceeds(updateDoc(page, { caption: "The clouds went pink.", updatedAt: serverTimestamp() }));

    const keepsake = doc(ariDb, "scrapbooks", "ari-book", "pages", "page-one", "decorations", "flower-one");
    await assertSucceeds(setDoc(keepsake, placedDecorationData()));
    await assertSucceeds(updateDoc(keepsake, { x: 71.25, rotation: 8, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(keepsake, { x: 101, updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(samDb, "scrapbooks", "ari-book", "pages", "page-one", "decorations", "flower-one")));
    await assertSucceeds(deleteDoc(page));

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "memories", "ari-memory"), memoryData("ari"));
      await setDoc(doc(context.firestore(), "memories", "sam-memory"), memoryData("sam"));
    });
    await assertSucceeds(setDoc(doc(ariDb, "scrapbooks", "ari-book", "pages", "linked-page"), scrapbookPageData("ari-memory")));
    await assertFails(setDoc(doc(ariDb, "scrapbooks", "ari-book", "pages", "foreign-memory"), scrapbookPageData("sam-memory")));
    await assertFails(getDoc(doc(samDb, "scrapbooks", "ari-book", "pages", "page-one")));
    await assertFails(setDoc(doc(samDb, "scrapbooks", "ari-book", "pages", "sam-page"), scrapbookPageData()));
  });
});

describe("Firestore private journal rules", () => {
  it("allows an owner to create, read, edit, and delete a private entry", async () => {
    const db = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const samDb = testEnvironment.authenticatedContext("sam", { email: "sam@example.com" }).firestore();
    const entry = doc(db, "journalEntries", "ari-entry");

    await assertSucceeds(setDoc(entry, journalEntryData("ari")));
    await assertSucceeds(getDoc(entry));
    await assertSucceeds(updateDoc(entry, { body: "The clouds went pink.", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(entry, { title: "", tags: ["quiet day", "friends"], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(entry, { tags: Array(13).fill("tag"), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(entry, { tags: ["x".repeat(31)], updatedAt: serverTimestamp() }));

    const keepsake = doc(db, "journalEntries", "ari-entry", "decorations", "flower-one");
    await assertSucceeds(setDoc(keepsake, placedDecorationData("ticket-04")));
    await assertSucceeds(updateDoc(keepsake, { y: 67.5, updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(samDb, "journalEntries", "ari-entry", "decorations", "flower-one")));
    await assertSucceeds(deleteDoc(entry));
  });

  it("keeps journal entries private and rejects forged or unknown decorations", async () => {
    const ariDb = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const samDb = testEnvironment.authenticatedContext("sam", { email: "sam@example.com" }).firestore();
    const entry = doc(ariDb, "journalEntries", "ari-entry");

    await assertSucceeds(setDoc(entry, journalEntryData("ari")));
    await assertFails(getDoc(doc(samDb, "journalEntries", "ari-entry")));
    await assertFails(updateDoc(doc(samDb, "journalEntries", "ari-entry"), { body: "stolen" }));
    await assertFails(deleteDoc(doc(samDb, "journalEntries", "ari-entry")));
    await assertFails(setDoc(doc(ariDb, "journalEntries", "forged"), journalEntryData("sam")));
    await assertFails(setDoc(doc(ariDb, "journalEntries", "unknown-art"), {
      ...journalEntryData("ari"),
      decorationIds: ["external-image-url"],
    }));
  });

  it("allows bounded private journal photos only inside the owner’s page folder", async () => {
    const db = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const entry = doc(db, "journalEntries", "ari-entry");
    const photo = {
      publicId: "solace/ari/journal/ari-entry/photo_1",
      version: 1730000000,
      format: "jpg",
      width: 1200,
      height: 900,
      bytes: 240000,
    };

    await assertSucceeds(setDoc(entry, journalEntryData("ari")));
    await assertSucceeds(updateDoc(entry, { photos: [photo], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(entry, {
      photos: [{ ...photo, publicId: "solace/sam/journal/ari-entry/photo_1" }],
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(entry, { photos: Array(11).fill(photo), updatedAt: serverTimestamp() }));
  });
});

describe("Firestore trusted time capsule rules", () => {
  it("blocks direct client reads and writes so unlock checks stay on the server", async () => {
    const db = testEnvironment.authenticatedContext("ari", { email: "ari@example.com" }).firestore();
    const capsule = doc(db, "timeCapsules", "ari-capsule");

    await assertFails(getDoc(capsule));
    await assertFails(setDoc(capsule, {
      ownerId: "ari",
      title: "Later",
      message: "A note kept sealed.",
      unlockAt: new Date("2027-01-01T00:00:00.000Z"),
    }));
  });
});
