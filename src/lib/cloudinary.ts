import { createHash, randomUUID } from "node:crypto";
import type { MemoryPhoto } from "@/types/memory";
import type { ScrapbookPhoto } from "@/types/scrapbook";
import type { JournalPhoto } from "@/types/journal";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const supportedFormats = ["jpg", "png", "webp"] as const;

type CloudinarySettings = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

function getSettings(): CloudinarySettings {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured. Add its server-only values to .env.local and restart Solace.");
  }
  return { cloudName, apiKey, apiSecret };
}

function signRequest(parameters: Record<string, string>, apiSecret: string) {
  const serialized = Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
}

export function scrapbookPhotoFolder(ownerId: string, scrapbookId: string, pageId: string) {
  return `solace/${ownerId}/scrapbooks/${scrapbookId}/${pageId}`;
}

export function memoryPhotoFolder(ownerId: string, memoryId: string) {
  return `solace/${ownerId}/memories/${memoryId}`;
}

export function journalPhotoFolder(ownerId: string, entryId: string) {
  return `solace/${ownerId}/journal/${entryId}`;
}

export function isOwnedScrapbookPhoto(
  publicId: string,
  ownerId: string,
  scrapbookId: string,
  pageId: string,
) {
  return publicId.startsWith(`${scrapbookPhotoFolder(ownerId, scrapbookId, pageId)}/`)
    && /^[A-Za-z0-9_/-]+$/.test(publicId);
}

export function isOwnedMemoryPhoto(publicId: string, ownerId: string, memoryId: string) {
  return publicId.startsWith(`${memoryPhotoFolder(ownerId, memoryId)}/`)
    && /^[A-Za-z0-9_/-]+$/.test(publicId)
    && publicId.split("/").length === 5;
}

export function isOwnedJournalPhoto(publicId: string, ownerId: string, entryId: string) {
  return publicId.startsWith(`${journalPhotoFolder(ownerId, entryId)}/`)
    && /^[A-Za-z0-9_/-]+$/.test(publicId)
    && publicId.split("/").length === 5;
}

export function isScrapbookPhoto(value: unknown): value is ScrapbookPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Partial<ScrapbookPhoto>;
  const position = photo.position;
  return typeof photo.publicId === "string"
    && Number.isInteger(photo.version) && Number(photo.version) > 0
    && supportedFormats.includes(photo.format as (typeof supportedFormats)[number])
    && Number.isInteger(photo.width) && Number(photo.width) > 0 && Number(photo.width) <= 12_000
    && Number.isInteger(photo.height) && Number(photo.height) > 0 && Number(photo.height) <= 12_000
    && Number.isInteger(photo.bytes) && Number(photo.bytes) > 0 && Number(photo.bytes) <= MAX_PHOTO_BYTES
    && (position === undefined || (
      typeof position === "object" && position !== null
      && Number.isFinite(position.x) && position.x >= 0 && position.x <= 100
      && Number.isFinite(position.y) && position.y >= 0 && position.y <= 100
    ));
}

export function isMemoryPhoto(value: unknown): value is MemoryPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Partial<MemoryPhoto>;
  return typeof photo.publicId === "string"
    && Number.isInteger(photo.version) && Number(photo.version) > 0
    && supportedFormats.includes(photo.format as (typeof supportedFormats)[number])
    && Number.isInteger(photo.width) && Number(photo.width) > 0 && Number(photo.width) <= 12_000
    && Number.isInteger(photo.height) && Number(photo.height) > 0 && Number(photo.height) <= 12_000
    && Number.isInteger(photo.bytes) && Number(photo.bytes) > 0 && Number(photo.bytes) <= MAX_PHOTO_BYTES;
}

export function isJournalPhoto(value: unknown): value is JournalPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Partial<JournalPhoto>;
  return typeof photo.publicId === "string"
    && Number.isInteger(photo.version) && Number(photo.version) > 0
    && supportedFormats.includes(photo.format as (typeof supportedFormats)[number])
    && Number.isInteger(photo.width) && Number(photo.width) > 0 && Number(photo.width) <= 12_000
    && Number.isInteger(photo.height) && Number(photo.height) > 0 && Number(photo.height) <= 12_000
    && Number.isInteger(photo.bytes) && Number(photo.bytes) > 0 && Number(photo.bytes) <= MAX_PHOTO_BYTES;
}

function imageFormatForType(contentType: string): "jpg" | "png" | "webp" | null {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return null;
}

export function validImageFile(file: File) {
  return file.size > 0 && file.size <= MAX_PHOTO_BYTES && imageFormatForType(file.type) !== null;
}

export async function hasValidImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (file.type === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function uploadScrapbookPhoto(file: File, ownerId: string, scrapbookId: string, pageId: string) {
  const settings = getSettings();
  const folder = scrapbookPhotoFolder(ownerId, scrapbookId, pageId);
  const publicId = randomUUID().replaceAll("-", "");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed = {
    folder,
    overwrite: "false",
    public_id: publicId,
    timestamp,
    type: "authenticated",
  };
  const form = new FormData();
  form.set("file", file, file.name);
  for (const [key, value] of Object.entries(signed)) form.set(key, value);
  form.set("api_key", settings.apiKey);
  form.set("signature", signRequest(signed, settings.apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${settings.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const result = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !result) {
    throw new Error("Cloudinary could not save this photo. Check the account settings and try again.");
  }

  const returnedPublicId = typeof result.public_id === "string" ? result.public_id : "";
  const format = typeof result.format === "string" ? result.format : "";
  const photo: ScrapbookPhoto = {
    publicId: returnedPublicId,
    version: Number(result.version),
    format: format as ScrapbookPhoto["format"],
    width: Number(result.width),
    height: Number(result.height),
    bytes: Number(result.bytes),
  };
  if (!isOwnedScrapbookPhoto(photo.publicId, ownerId, scrapbookId, pageId) || !isScrapbookPhoto(photo)) {
    throw new Error("Cloudinary returned photo details Solace could not verify.");
  }
  return photo;
}

export async function uploadMemoryPhoto(file: File, ownerId: string, memoryId: string) {
  const settings = getSettings();
  const folder = memoryPhotoFolder(ownerId, memoryId);
  const publicId = randomUUID().replaceAll("-", "");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed = { folder, overwrite: "false", public_id: publicId, timestamp, type: "authenticated" };
  const form = new FormData();
  form.set("file", file, file.name);
  for (const [key, value] of Object.entries(signed)) form.set(key, value);
  form.set("api_key", settings.apiKey);
  form.set("signature", signRequest(signed, settings.apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${settings.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const result = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !result) {
    throw new Error("Cloudinary could not save this photo. Check the account settings and try again.");
  }

  const photo: MemoryPhoto = {
    publicId: typeof result.public_id === "string" ? result.public_id : "",
    version: Number(result.version),
    format: (typeof result.format === "string" ? result.format : "") as MemoryPhoto["format"],
    width: Number(result.width),
    height: Number(result.height),
    bytes: Number(result.bytes),
  };
  if (!isOwnedMemoryPhoto(photo.publicId, ownerId, memoryId) || !isMemoryPhoto(photo)) {
    throw new Error("Cloudinary returned photo details Solace could not verify.");
  }
  return photo;
}

export async function uploadJournalPhoto(file: File, ownerId: string, entryId: string) {
  const settings = getSettings();
  const folder = journalPhotoFolder(ownerId, entryId);
  const publicId = randomUUID().replaceAll("-", "");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed = { folder, overwrite: "false", public_id: publicId, timestamp, type: "authenticated" };
  const form = new FormData();
  form.set("file", file, file.name);
  for (const [key, value] of Object.entries(signed)) form.set(key, value);
  form.set("api_key", settings.apiKey);
  form.set("signature", signRequest(signed, settings.apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${settings.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const result = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !result) {
    throw new Error("Cloudinary could not save this photo. Check the account settings and try again.");
  }

  const photo: JournalPhoto = {
    publicId: typeof result.public_id === "string" ? result.public_id : "",
    version: Number(result.version),
    format: (typeof result.format === "string" ? result.format : "") as JournalPhoto["format"],
    width: Number(result.width),
    height: Number(result.height),
    bytes: Number(result.bytes),
  };
  if (!isOwnedJournalPhoto(photo.publicId, ownerId, entryId) || !isJournalPhoto(photo)) {
    throw new Error("Cloudinary returned photo details Solace could not verify.");
  }
  return photo;
}

export function signedScrapbookPhotoUrl(photo: ScrapbookPhoto) {
  const settings = getSettings();
  if (!isScrapbookPhoto(photo)) throw new Error("This photo could not be verified.");
  const path = `v${photo.version}/${photo.publicId}.${photo.format}`;
  const signature = createHash("sha1")
    .update(`${path}${settings.apiSecret}`)
    .digest("base64url")
    .slice(0, 8);
  const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `https://res.cloudinary.com/${settings.cloudName}/image/authenticated/s--${signature}--/${encodedPath}`;
}

export function signedMemoryPhotoUrl(photo: MemoryPhoto) {
  const settings = getSettings();
  if (!isMemoryPhoto(photo)) throw new Error("This photo could not be verified.");
  const path = `v${photo.version}/${photo.publicId}.${photo.format}`;
  const signature = createHash("sha1")
    .update(`${path}${settings.apiSecret}`)
    .digest("base64url")
    .slice(0, 8);
  const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `https://res.cloudinary.com/${settings.cloudName}/image/authenticated/s--${signature}--/${encodedPath}`;
}

export function signedJournalPhotoUrl(photo: JournalPhoto) {
  const settings = getSettings();
  if (!isJournalPhoto(photo)) throw new Error("This photo could not be verified.");
  const path = `v${photo.version}/${photo.publicId}.${photo.format}`;
  const signature = createHash("sha1")
    .update(`${path}${settings.apiSecret}`)
    .digest("base64url")
    .slice(0, 8);
  const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `https://res.cloudinary.com/${settings.cloudName}/image/authenticated/s--${signature}--/${encodedPath}`;
}

export async function destroyCloudinaryPhoto(publicId: string) {
  const settings = getSettings();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed = { public_id: publicId, timestamp, type: "authenticated" };
  const form = new FormData();
  for (const [key, value] of Object.entries(signed)) form.set(key, value);
  form.set("api_key", settings.apiKey);
  form.set("signature", signRequest(signed, settings.apiSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${settings.cloudName}/image/destroy`, {
    method: "POST",
    body: form,
  });
  const result = await response.json().catch(() => null) as { result?: string } | null;
  if (!response.ok || (result?.result !== "ok" && result?.result !== "not found")) {
    throw new Error("Cloudinary could not remove this photo.");
  }
}

export async function destroyScrapbookPhoto(publicId: string) {
  return destroyCloudinaryPhoto(publicId);
}
