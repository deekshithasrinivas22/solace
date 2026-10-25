"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  CalendarDays,
  Check,
  CloudRain,
  CloudSun,
  Eye,
  HandHeart,
  Heart,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Maximize2,
  Moon,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { removeMemory, saveMemory, subscribeToMemories } from "@/lib/firebase/memories";
import { MAX_MEMORY_PHOTO_BYTES, MAX_MEMORY_PHOTOS, MEMORY_PHOTO_TYPES } from "@/lib/memories/constants";
import { memoryInputSchema } from "@/lib/validations/memory";
import {
  memoryMoodLabels,
  memoryMoodValues,
  type Memory,
  type MemoryInput,
  type MemoryMood,
  type MemoryPhoto,
} from "@/types/memory";

function todayDate() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function prettyDate(value: string) {
  const date = new Date(value + "T12:00:00");
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function prettyTime(value: string) {
  if (!value) return "";
  const parts = value.split(":").map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return value;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
    .format(new Date(2000, 0, 1, parts[0], parts[1]));
}

function memoryPhotoUrl(memoryId: string, publicId: string) {
  const query = new URLSearchParams({ memoryId, publicId });
  return `/api/memories/photos?${query.toString()}`;
}

type MemoryPhotoDraft =
  | { id: string; kind: "stored"; photo: MemoryPhoto }
  | { id: string; kind: "file"; file: File; previewUrl: string };

async function prepareMemoryPhoto(file: File) {
  if (!MEMORY_PHOTO_TYPES.includes(file.type as (typeof MEMORY_PHOTO_TYPES)[number])) {
    throw new Error("Choose a JPG, PNG, or WebP photo.");
  }
  if (file.size > 24 * 1024 * 1024) throw new Error("Choose a photo smaller than 24 MB.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size <= MAX_MEMORY_PHOTO_BYTES) return file;
    throw new Error("This photo is too large to prepare on this device. Choose one under 8 MB.");
  }

  if (file.size <= MAX_MEMORY_PHOTO_BYTES && Math.max(bitmap.width, bitmap.height) <= 2400) {
    bitmap.close();
    return file;
  }

  try {
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This photo couldn’t be prepared. Try another image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.88, 0.78, 0.68]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob) continue;
      if (blob.size <= MAX_MEMORY_PHOTO_BYTES) {
        const extension = blob.type === "image/webp" ? "webp" : "png";
        const baseName = file.name.replace(/\.[^.]+$/, "") || "memory-photo";
        return new File([blob], `${baseName}.${extension}`, { type: blob.type, lastModified: file.lastModified });
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error("This photo is still too large after compression. Choose one under 8 MB.");
}

function uploadMemoryPhotoRequest(
  memoryId: string,
  file: File,
  idToken: string,
  onProgress: (progress: number) => void,
) {
  const form = new FormData();
  form.set("memoryId", memoryId);
  form.set("file", file, file.name);

  return new Promise<{ photo: MemoryPhoto }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/memories/photos");
    request.setRequestHeader("Authorization", `Bearer ${idToken}`);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      let result: { error?: string; photo?: MemoryPhoto } | null = null;
      try {
        result = JSON.parse(request.responseText || "null") as { error?: string; photo?: MemoryPhoto } | null;
      } catch {
        reject(new Error("Solace couldn’t read the upload response. Please retry this photo."));
        return;
      }
      if (request.status >= 200 && request.status < 300 && result?.photo) {
        resolve({ photo: result.photo });
      } else {
        reject(new Error(result?.error ?? "The photo couldn’t be added. Please try again."));
      }
    });
    request.addEventListener("error", () => reject(new Error("Connection trouble. Check your connection and try the photo again.")));
    request.addEventListener("abort", () => reject(new Error("The photo upload was paused. Try again when you’re ready.")));
    request.send(form);
  });
}

async function reorderMemoryPhotoRequest(memoryId: string, publicIds: string[], idToken: string) {
  const response = await fetch("/api/memories/photos", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ memoryId, publicIds }),
  });
  const result = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(result?.error ?? "The photo order couldn’t be saved. Please try again.");
}

async function deleteMemoryPhotoRequest(memoryId: string, publicId: string, idToken: string) {
  const response = await fetch("/api/memories/photos", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
    body: JSON.stringify({ memoryId, publicId }),
  });
  const result = await response.json().catch(() => null) as { error?: string; photoCleanupPending?: boolean } | null;
  if (!response.ok) throw new Error(result?.error ?? "The photo could not be removed.");
  return { photoCleanupPending: result?.photoCleanupPending ?? false };
}

function savedDateLabel(value: unknown) {
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    date = value.toDate() as Date;
  } else if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  }
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date)
    : "Date saved with this memory";
}

const moodIcons = {
  joyful: Sun,
  excited: Sparkles,
  peaceful: Moon,
  loved: Heart,
  grateful: HandHeart,
  nostalgic: CalendarDays,
  tender: Heart,
  bittersweet: CloudSun,
  sad: CloudRain,
  anxious: Wind,
  proud: Award,
} satisfies Record<MemoryMood, LucideIcon>;

function memoryErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code === "permission-denied") {
    return "Solace couldn't save this memory. Deploy the latest Firestore rules and indexes, then try again.";
  }
  if (code === "unavailable" || code === "network-request-failed") {
    return "Connection trouble. Your memory is safe to try saving again.";
  }
  return "That memory couldn't be saved. Please try again.";
}

function memoryLoadErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code === "permission-denied") {
    return "Firestore refused this signed-in account. The current Solace rules are deployed; sign out and back in, then refresh. If it continues, share the Firebase error details.";
  }
  if (code === "failed-precondition") {
    return "Firestore rejected the memory query. The Solace memory index is ready; refresh, and share the Firebase error details if it continues.";
  }
  if (code === "unavailable" || code === "network-request-failed") {
    return "Firestore can’t be reached right now. Check your connection and refresh.";
  }
  if (code === "unauthenticated") {
    return "Your sign-in expired. Sign out and back in, then refresh this page.";
  }

  return `Your memory shelf couldn't open. Refresh the page and try again${code ? ` (Firebase: ${code})` : ""}.`;
}

export function MemoryStudio() {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const reduceMotion = useReducedMotion() ?? false;
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadedForUid, setLoadedForUid] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deleteId, setDeleteId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [photoTargetId, setPhotoTargetId] = useState("");
  const [photoPendingId, setPhotoPendingId] = useState("");
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError, setPhotoError] = useState("");
  const [viewingMemoryId, setViewingMemoryId] = useState("");
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<MemoryMood | "">("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToMemories(
      user.uid,
      (nextMemories) => {
        setMemories(nextMemories);
        setLoadError("");
        setLoadedForUid(user.uid);
      },
      (error) => {
        console.error("Solace memory shelf failed to load:", error);
        setMemories([]);
        setLoadError(memoryLoadErrorMessage(error));
        setLoadedForUid(user.uid);
      },
    );
  }, [user]);

  const visibleMemories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return memories.filter((memory) => {
      const searchable = [
        memory.title,
        memory.description,
        memory.location,
        memoryMoodLabels[memory.mood as MemoryMood] ?? "",
        ...(memory.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return (!term || searchable.includes(term)) && (!moodFilter || memory.mood === moodFilter);
    });
  }, [memories, moodFilter, search]);

  function openNewMemory() {
    setEditingMemory(null);
    setFormOpen(true);
    setNotice("");
  }

  function openEditMemory(memory: Memory) {
    setEditingMemory(memory);
    setFormOpen(true);
    setNotice("");
  }

  async function handleSave(input: MemoryInput, memoryId?: string) {
    if (!user) throw new Error("Sign in again to save this memory.");
    const isCreating = !editingMemory;
    const savedId = await saveMemory(user.uid, input, memoryId ?? editingMemory?.id, isCreating);
    setNotice(memoryId || editingMemory ? "Your memory has been updated." : "Your memory is tucked safely away.");
    return savedId;
  }

  async function uploadPhotoForMemory(
    memoryId: string,
    file: File,
    onProgress: (progress: number) => void,
  ) {
    if (!user) throw new Error("Sign in again before adding a photo.");
    const preparedFile = await prepareMemoryPhoto(file);
    return uploadMemoryPhotoRequest(memoryId, preparedFile, await user.getIdToken(), onProgress);
  }

  async function handleReorderPhotos(memoryId: string, publicIds: string[]) {
    if (!user) throw new Error("Sign in again before arranging these photos.");
    await reorderMemoryPhotoRequest(memoryId, publicIds, await user.getIdToken());
  }

  async function removePhotoForMemory(memoryId: string, photo: MemoryPhoto) {
    if (!user) throw new Error("Sign in again before removing this photo.");
    return deleteMemoryPhotoRequest(memoryId, photo.publicId, await user.getIdToken());
  }

  async function handleDelete(memoryId: string) {
    if (!user) return;
    setDeleting(true);
    setLoadError("");
    try {
      const result = await removeMemory(memoryId, await user.getIdToken());
      setDeleteId("");
      setNotice(result.photoCleanupPending
        ? "That memory is gone. A photo file may need a little longer to clear away."
        : "That memory has been removed.");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "That memory couldn't be removed. Try again in a moment.");
    } finally {
      setDeleting(false);
    }
  }

  function choosePhoto(memoryId: string) {
    setPhotoTargetId(memoryId);
    setPhotoError("");
    photoInputRef.current?.click();
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    const memory = memories.find((item) => item.id === photoTargetId);
    setPhotoTargetId("");
    if (!files.length || !memory || !user) return;

    const remaining = MAX_MEMORY_PHOTOS - (memory.photos?.length ?? 0);
    if (files.length > remaining) {
      setPhotoError(`This memory has room for ${remaining} more ${remaining === 1 ? "photo" : "photos"}.`);
      return;
    }
    if (files.some((file) => !MEMORY_PHOTO_TYPES.includes(file.type as (typeof MEMORY_PHOTO_TYPES)[number]) || file.size > 24 * 1024 * 1024)) {
      setPhotoError("Choose JPG, PNG, or WebP photos smaller than 24 MB each.");
      return;
    }

    setPhotoPendingId(memory.id);
    setPhotoError("");
    setNotice("");
    try {
      for (const [index, file] of files.entries()) {
        const preparedFile = await prepareMemoryPhoto(file);
        await uploadMemoryPhotoRequest(memory.id, preparedFile, await user.getIdToken(), setPhotoProgress);
        setNotice(files.length > 1
          ? `Added ${index + 1} of ${files.length} photos to this memory.`
          : "Your photo is safely tucked into this memory.");
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "The photo could not be added. Please try again.");
    } finally {
      setPhotoPendingId("");
      setPhotoProgress(0);
    }
  }

  async function removePhoto(memoryId: string, photo: MemoryPhoto) {
    if (!user) return;
    setPhotoPendingId(`${memoryId}:${photo.publicId}`);
    setPhotoError("");
    try {
      const result = await removePhotoForMemory(memoryId, photo);
      setNotice(result.photoCleanupPending
        ? "The photo was removed from this memory and will finish clearing shortly."
        : "The photo was removed from this memory.");
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "The photo could not be removed. Please try again.");
    } finally {
      setPhotoPendingId("");
    }
  }

  const viewingMemory = memories.find((memory) => memory.id === viewingMemoryId) ?? null;

  return (
    <div className="memory-page">
      <input
        ref={photoInputRef}
        accept="image/jpeg,image/png,image/webp"
        className="memory-file-input"
        onChange={(event) => void uploadPhoto(event)}
        multiple
        type="file"
      />
      <motion.header
        className="memory-page-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div>
          <span className="eyebrow">A constellation of moments</span>
          <h1 className="serif">Your memories, still glowing.</h1>
          <p>Keep the small details close: the day, the feeling, and the little story around it.</p>
        </div>
        <button className="button-primary memory-create-button" onClick={openNewMemory} type="button">
          <Plus size={17} /> Keep a memory
        </button>
      </motion.header>

      <section className="memory-hero" aria-label="A little magic for your memories">
        <div className="memory-hero-copy">
          <span className="memory-hero-eyebrow"><Sparkles size={14} /> A place that keeps the feeling</span>
          <h2 className="serif">Some days deserve to stay with you.</h2>
          <p>Write down what happened, where you were, and how it felt. Your shelf is private to you.</p>
          <div className="memory-hero-foot"><Heart size={14} /> Made for remembering, at your own pace</div>
        </div>
        <div className="memory-sky-art" aria-hidden="true">
          <span className="memory-sky-orbit memory-sky-orbit-one" />
          <span className="memory-sky-orbit memory-sky-orbit-two" />
          <span className="memory-sky-moon" />
          <span className="memory-star memory-star-one">✦</span>
          <span className="memory-star memory-star-two">✧</span>
          <span className="memory-star memory-star-three">✦</span>
          <span className="memory-star memory-star-four">✧</span>
          <span className="memory-sky-note">little things, forever</span>
        </div>
      </section>

      <div className="memory-toolbar">
        <div className="memory-count">
          <strong>{memories.length}</strong>
          <span>{memories.length === 1 ? "moment kept" : "moments kept"}</span>
        </div>
        <label className="memory-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search your memories</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a detail, place, or feeling"
            type="search"
            value={search}
          />
        </label>
        <label className="memory-filter">
          <span className="sr-only">Filter by feeling</span>
          <select onChange={(event) => setMoodFilter(event.target.value as MemoryMood | "")} value={moodFilter}>
            <option value="">All feelings</option>
            {memoryMoodValues.map((mood) => <option key={mood} value={mood}>{memoryMoodLabels[mood]}</option>)}
          </select>
        </label>
      </div>

      {notice && <p className="memory-notice" role="status"><Check size={15} /> {notice}</p>}
      {loadError && <p className="memory-error" role="alert">{loadError}</p>}
      {photoError && <p className="memory-error" role="alert">{photoError}</p>}

      {authLoading || (user && loadedForUid !== user.uid) ? (
        <div className="memory-loading" role="status"><LoaderCircle size={22} className="memory-spinner" /> Gathering your moments…</div>
      ) : !user ? (
        <div className="memory-empty">
          <span className="memory-empty-icon"><Heart size={22} /></span>
          <h2 className="serif">Your shelf is waiting.</h2>
          <p>Sign in to keep your memories close.</p>
        </div>
      ) : visibleMemories.length === 0 ? (
        <div className="memory-empty">
          <span className="memory-empty-icon"><Sparkles size={22} /></span>
          <h2 className="serif">{memories.length ? "No little details found." : "Your first memory is a beginning."}</h2>
          <p>
            {memories.length
              ? "Try another search or feeling."
              : "Start with a day you want to return to. A sentence is enough."}
          </p>
          {!memories.length && (
            <button className="button-primary" onClick={openNewMemory} type="button"><Plus size={16} /> Save the first one</button>
          )}
        </div>
      ) : (
        <div className="memory-grid">
          {visibleMemories.map((memory, index) => (
            <motion.article
              className="memory-card"
              key={memory.id}
              layout
              initial={reduceMotion ? false : { opacity: 0, y: 14, rotate: index % 2 ? 0.7 : -0.7 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.38, delay: reduceMotion ? 0 : Math.min(index * 0.055, 0.28) }}
            >
              <div className={"memory-card-art memory-card-art-" + ((index % 3) + 1) + (memory.photos?.[0] ? " has-memory-cover" : "")}>
                {memory.photos?.[0] ? (
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="memory-card-cover"
                    fill
                    sizes="(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 360px"
                    src={memoryPhotoUrl(memory.id, memory.photos[0].publicId)}
                    unoptimized
                  />
                ) : (
                  <>
                    <span className="memory-card-art-orbit" />
                    <span className="memory-card-art-star">✦</span>
                  </>
                )}
                <span className="memory-card-art-date">{prettyDate(memory.memoryDate)}</span>
                <span className="memory-card-art-caption">kept close</span>
              </div>
              <div className="memory-card-body">
                <div className="memory-card-kicker">
                  <span><CalendarDays size={13} /> {prettyDate(memory.memoryDate)}</span>
                  {memory.memoryTime && <span>{prettyTime(memory.memoryTime)}</span>}
                  {memory.mood && <span className="memory-mood"><Heart size={12} /> {memoryMoodLabels[memory.mood]}</span>}
                </div>
                <h2 className="serif"><button className="memory-card-title" onClick={() => setViewingMemoryId(memory.id)} type="button">{memory.title}</button></h2>
                {memory.location && <p className="memory-location"><MapPin size={13} /> {memory.location}</p>}
                {memory.description && <p className="memory-description">{memory.description}</p>}
                {!!memory.tags?.length && (
                  <div className="memory-tags">
                    {memory.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                  </div>
                )}
                {!!memory.photos?.length && (
                  <div className="memory-photo-strip" aria-label={`Photos for ${memory.title}`} role="group">
                    {memory.photos.map((photo, photoIndex) => {
                      const query = new URLSearchParams({ memoryId: memory.id, publicId: photo.publicId });
                      return (
                        <div className="memory-photo-thumb-wrap" key={photo.publicId}>
                          <Image
                            alt={`${memory.title}, photo ${photoIndex + 1}`}
                            className="memory-photo-thumb"
                            fill
                            sizes="76px"
                            src={`/api/memories/photos?${query.toString()}`}
                            unoptimized
                          />
                          <button
                            aria-label={`Remove photo ${photoIndex + 1} from ${memory.title}`}
                            className="memory-photo-remove"
                            disabled={Boolean(photoPendingId)}
                            onClick={() => void removePhoto(memory.id, photo)}
                            type="button"
                          ><X size={12} /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="memory-card-actions">
                  {deleteId === memory.id ? (
                    <div className="memory-delete-confirm">
                      <span>Let this memory go?</span>
                      <button disabled={deleting} onClick={() => void handleDelete(memory.id)} type="button">
                        {deleting ? "Removing…" : "Remove"}
                      </button>
                      <button onClick={() => setDeleteId("")} type="button">Keep it</button>
                    </div>
                  ) : (
                    <>
                      {(memory.photos?.length ?? 0) < MAX_MEMORY_PHOTOS && (
                        <button
                          className="memory-add-photo-button"
                          disabled={Boolean(photoPendingId)}
                          onClick={() => choosePhoto(memory.id)}
                          type="button"
                        >
                          {photoPendingId === memory.id ? <LoaderCircle className="memory-spinner" size={14} /> : <ImagePlus size={14} />}
                          {photoPendingId === memory.id ? "Adding photo " + photoProgress + "%" : "Add photos"}
                        </button>
                      )}
                      <button className="memory-edit-button" onClick={() => setViewingMemoryId(memory.id)} type="button">
                        <Eye size={14} /> Open
                      </button>
                      <button className="memory-edit-button" onClick={() => openEditMemory(memory)} type="button">
                        <PenLine size={14} /> Edit
                      </button>
                      <button
                        aria-label={"Remove " + memory.title}
                        className="memory-remove-button"
                        onClick={() => setDeleteId(memory.id)}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {formOpen && (
          <MemoryComposer
            key={editingMemory?.id ?? "new-memory"}
            memory={editingMemory}
            onClose={() => setFormOpen(false)}
            onSave={handleSave}
            onUploadPhoto={uploadPhotoForMemory}
            onRemovePhoto={removePhotoForMemory}
            onReorderPhotos={handleReorderPhotos}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {viewingMemory && (
          <MemoryDetail
            key={viewingMemory.id}
            memory={viewingMemory}
            onClose={() => setViewingMemoryId("")}
            onEdit={() => {
              setViewingMemoryId("");
              openEditMemory(viewingMemory);
            }}
            onDelete={() => {
              setViewingMemoryId("");
              setDeleteId(viewingMemory.id);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MemoryComposer({
  memory,
  onClose,
  onSave,
  onUploadPhoto,
  onRemovePhoto,
  onReorderPhotos,
}: {
  memory: Memory | null;
  onClose: () => void;
  onSave: (input: MemoryInput, memoryId?: string) => Promise<string>;
  onUploadPhoto: (memoryId: string, file: File, onProgress: (progress: number) => void) => Promise<{ photo: MemoryPhoto }>;
  onRemovePhoto: (memoryId: string, photo: MemoryPhoto) => Promise<{ photoCleanupPending: boolean }>;
  onReorderPhotos: (memoryId: string, publicIds: string[]) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [title, setTitle] = useState(memory?.title ?? "");
  const [description, setDescription] = useState(memory?.description ?? "");
  const [memoryDate, setMemoryDate] = useState(memory?.memoryDate ?? todayDate());
  const [memoryTime, setMemoryTime] = useState(memory?.memoryTime ?? "");
  const [location, setLocation] = useState(memory?.location ?? "");
  const [mood, setMood] = useState<MemoryMood | "">(memory?.mood ?? "");
  const [tags, setTags] = useState(memory?.tags.join(", ") ?? "");
  const [photos, setPhotos] = useState<MemoryPhotoDraft[]>(
    (memory?.photos ?? []).map((photo) => ({ id: photo.publicId, kind: "stored", photo })),
  );
  const [removedPhotos, setRemovedPhotos] = useState<MemoryPhoto[]>([]);
  const [savedMemoryId, setSavedMemoryId] = useState(memory?.id ?? "");
  const [hasSavedThisAttempt, setHasSavedThisAttempt] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<{ id: string; value: number } | null>(null);
  const [draggedPhotoId, setDraggedPhotoId] = useState("");
  const previewUrls = useRef(new Set<string>());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  function addPhotos(files: FileList | File[]) {
    const selected = Array.from(files);
    if (!selected.length) return;
    const remaining = MAX_MEMORY_PHOTOS - photos.length;
    if (selected.length > remaining) {
      setError("There is room for " + remaining + " more " + (remaining === 1 ? "photo" : "photos") + " in this memory.");
      return;
    }
    const invalidFile = selected.find((file) =>
      !MEMORY_PHOTO_TYPES.includes(file.type as (typeof MEMORY_PHOTO_TYPES)[number]) || file.size > 24 * 1024 * 1024,
    );
    if (invalidFile) {
      setError("Choose JPG, PNG, or WebP photos under 24 MB each.");
      return;
    }
    const additions: MemoryPhotoDraft[] = selected.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      return { id: crypto.randomUUID(), kind: "file", file, previewUrl };
    });
    setPhotos((current) => [...current, ...additions]);
    setError("");
  }

  function removeDraftPhoto(photo: MemoryPhotoDraft) {
    if (photo.kind === "file") {
      URL.revokeObjectURL(photo.previewUrl);
      previewUrls.current.delete(photo.previewUrl);
    } else {
      setRemovedPhotos((current) => current.some((item) => item.publicId === photo.photo.publicId)
        ? current
        : [...current, photo.photo]);
    }
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
  }

  function movePhoto(photoId: string, offset: -1 | 1) {
    setPhotos((current) => {
      const from = current.findIndex((photo) => photo.id === photoId);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [photo] = next.splice(from, 1);
      next.splice(to, 0, photo);
      return next;
    });
  }

  function dropPhoto(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    const sourceId = draggedPhotoId || event.dataTransfer.getData("text/plain");
    setDraggedPhotoId("");
    if (!sourceId || sourceId === targetId) return;
    setPhotos((current) => {
      const from = current.findIndex((photo) => photo.id === sourceId);
      const to = current.findIndex((photo) => photo.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [photo] = next.splice(from, 1);
      next.splice(to, 0, photo);
      return next;
    });
  }

  function closeComposer() {
    if (pending) return;
    const changed = memory
      ? title !== memory.title
        || description !== memory.description
        || memoryDate !== memory.memoryDate
        || memoryTime !== (memory.memoryTime ?? "")
        || location !== memory.location
        || mood !== memory.mood
        || tags !== memory.tags.join(", ")
        || removedPhotos.length > 0
        || photos.some((photo) => photo.kind === "file")
        || photos.map((photo) => photo.id).join("|") !== (memory.photos ?? []).map((photo) => photo.publicId).join("|")
      : Boolean(title.trim() || description.trim() || location.trim() || mood || tags.trim() || photos.length);
    if (changed && !window.confirm("Leave this memory editor? Your unsaved changes will be discarded. Already saved details will stay on your shelf.")) {
      return;
    }
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = memoryInputSchema.safeParse({
      title,
      description,
      memoryDate,
      memoryTime,
      location,
      mood,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the details and try again.");
      return;
    }

    setPending(true);
    try {
      let memoryId = savedMemoryId || memory?.id || crypto.randomUUID();
      setSavedMemoryId(memoryId);
      try {
        memoryId = await onSave(parsed.data, memoryId);
        setSavedMemoryId(memoryId);
        setHasSavedThisAttempt(true);
      } catch (saveError) {
        setError(memoryErrorMessage(saveError));
        return;
      }

      let nextPhotos = [...photos];
      for (const draft of nextPhotos) {
        if (draft.kind !== "file") continue;
        setPhotoProgress({ id: draft.id, value: 0 });
        const result = await onUploadPhoto(memoryId, draft.file, (value) => setPhotoProgress({ id: draft.id, value }));
        const stored: MemoryPhotoDraft = { id: result.photo.publicId, kind: "stored", photo: result.photo };
        URL.revokeObjectURL(draft.previewUrl);
        previewUrls.current.delete(draft.previewUrl);
        nextPhotos = nextPhotos.map((photo) => photo.id === draft.id ? stored : photo);
        setPhotos(nextPhotos);
      }
      setPhotoProgress(null);

      for (const photo of removedPhotos) {
        await onRemovePhoto(memoryId, photo);
        setRemovedPhotos((current) => current.filter((item) => item.publicId !== photo.publicId));
      }

      const desiredOrder = nextPhotos.map((photo) => photo.kind === "stored" ? photo.photo.publicId : "");
      await onReorderPhotos(memoryId, desiredOrder);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "That memory couldn’t be saved. Please try again.");
    } finally {
      setPending(false);
      setPhotoProgress(null);
    }
  }

  return (
    <motion.div
      className="memory-modal-backdrop"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeComposer();
      }}
    >
      <motion.section
        aria-labelledby="memory-form-title"
        aria-modal="true"
        className="memory-composer"
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        role="dialog"
        transition={{ duration: 0.22 }}
      >
        <div className="memory-composer-heading">
          <div>
            <span className="eyebrow">{memory ? "A moment, revisited" : "A moment to keep"}</span>
            <h2 className="serif" id="memory-form-title">{memory ? "A moment worth keeping." : "A moment worth keeping."}</h2>
          </div>
          <button aria-label="Close memory form" className="memory-close-button" disabled={pending} onClick={closeComposer} type="button"><X size={18} /></button>
        </div>

        <form className="memory-form" onSubmit={submit}>
          <label className="memory-field memory-field-full">
            <span>What would you call this moment?</span>
            <input autoFocus maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="The afternoon we took the long way home" required value={title} />
          </label>
          <label className="memory-field memory-field-full">
            <span>A little note about this moment</span>
            <textarea maxLength={5000} onChange={(event) => setDescription(event.target.value)} placeholder="The light, the laughter, the little thing someone said…" rows={4} value={description} />
          </label>
          <div className="memory-form-row">
            <label className="memory-field">
              <span>When did it happen?</span>
              <input onChange={(event) => setMemoryDate(event.target.value)} required type="date" value={memoryDate} />
            </label>
            <label className="memory-field">
              <span>About what time? <small>Optional</small></span>
              <input onChange={(event) => setMemoryTime(event.target.value)} type="time" value={memoryTime} />
            </label>
          </div>
          <label className="memory-field memory-field-full">
            <span>Where did it happen? <small>Optional</small></span>
            <input maxLength={120} onChange={(event) => setLocation(event.target.value)} placeholder="A place, or a little corner" value={location} />
          </label>
          <div className="memory-form-row memory-details-row">
            <label className="memory-field">
              <span>Little tags <small>Optional, up to 12</small></span>
              <input onChange={(event) => setTags(event.target.value)} placeholder="summer, friends, home, milestone" value={tags} />
            </label>
            <div className="memory-field">
              <span>How did it feel? <small>Any feeling is welcome</small></span>
              <div className="memory-mood-grid" role="group" aria-label="Choose a feeling">
                <button aria-pressed={!mood} className={"memory-mood-chip" + (!mood ? " selected" : "")} onClick={() => setMood("")} type="button"><Heart size={14} /> Keep it open</button>
                {memoryMoodValues.map((value) => {
                  const MoodIcon = moodIcons[value];
                  return <button aria-pressed={mood === value} className={"memory-mood-chip" + (mood === value ? " selected" : "")} key={value} onClick={() => setMood(value)} type="button"><MoodIcon size={14} /> {memoryMoodLabels[value]}</button>;
                })}
              </div>
            </div>
          </div>

          <section className="memory-upload-section" aria-labelledby="memory-upload-title">
            <div className="memory-upload-heading">
              <div><span className="memory-upload-title" id="memory-upload-title"><ImagePlus size={16} /> Add photos or keepsakes</span><p>Choose up to {MAX_MEMORY_PHOTOS}. Photos stay private to your Solace space.</p></div>
              <span className="memory-photo-count">{photos.length}/{MAX_MEMORY_PHOTOS}</span>
            </div>
            <div className="memory-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              event.preventDefault();
              if (event.dataTransfer.files.length) addPhotos(event.dataTransfer.files);
            }}>
              <ImagePlus size={19} />
              <strong>Drop photos here, or choose from your device</strong>
              <span>JPG, PNG, or WebP · up to 24 MB each before gentle compression</span>
              <button className="button-secondary" disabled={pending || photos.length >= MAX_MEMORY_PHOTOS} onClick={() => fileInputRef.current?.click()} type="button"><Plus size={15} /> Choose photos</button>
              <input accept="image/jpeg,image/png,image/webp" className="memory-file-input" multiple onChange={(event) => {
                if (event.target.files) addPhotos(event.target.files);
                event.target.value = "";
              }} ref={fileInputRef} type="file" />
            </div>
            {photos.length > 0 && <div className="memory-draft-photo-grid" aria-label="Photos attached to this memory">
              {photos.map((photo, index) => {
                const src = photo.kind === "file" ? photo.previewUrl : memoryPhotoUrl(memory?.id ?? savedMemoryId, photo.photo.publicId);
                return <div className={"memory-draft-photo" + (draggedPhotoId === photo.id ? " is-dragging" : "")} draggable key={photo.id}
                  onDragStart={(event) => { setDraggedPhotoId(photo.id); event.dataTransfer.setData("text/plain", photo.id); event.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => setDraggedPhotoId("")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropPhoto(event, photo.id)}>
                  <Image alt={photo.kind === "file" ? photo.file.name : "Saved memory photo"} className="memory-draft-photo-image" fill sizes="150px" src={src} unoptimized />
                  <span className="memory-draft-photo-number">{index + 1}</span>
                  {photo.kind === "file" && photoProgress?.id === photo.id && <span className="memory-photo-progress" role="status">Uploading {photoProgress.value}%</span>}
                  <div className="memory-draft-photo-actions">
                    <button aria-label={"Move photo " + (index + 1) + " earlier"} disabled={pending || index === 0} onClick={() => movePhoto(photo.id, -1)} type="button"><ArrowUp size={14} /></button>
                    <button aria-label={"Move photo " + (index + 1) + " later"} disabled={pending || index === photos.length - 1} onClick={() => movePhoto(photo.id, 1)} type="button"><ArrowDown size={14} /></button>
                    <button aria-label={"Remove photo " + (index + 1)} disabled={pending} onClick={() => removeDraftPhoto(photo)} type="button"><X size={14} /></button>
                  </div>
                </div>;
              })}
            </div>}
          </section>

          <p className="memory-private-note"><Heart size={14} /> Your memory and photos stay private. Event date and the day it was saved are kept separately.</p>
          {hasSavedThisAttempt && photos.some((photo) => photo.kind === "file") && <p className="memory-upload-resume" role="status">If an upload did not finish, save again to continue. Photos already uploaded will stay attached.</p>}
          {error && <p className="memory-error" role="alert">{error}</p>}
          <div className="memory-form-actions">
            <button className="button-secondary" disabled={pending} onClick={closeComposer} type="button">Let it wait</button>
            <button className="button-primary" disabled={pending} type="submit">
              {pending ? <LoaderCircle size={16} className="memory-spinner" /> : <Sparkles size={16} />}
              {pending ? (photoProgress ? "Adding photos…" : "Saving…") : hasSavedThisAttempt && photos.some((photo) => photo.kind === "file") ? "Retry photo uploads" : memory ? "Save changes" : "Keep this memory"}
            </button>
          </div>
        </form>
      </motion.section>
    </motion.div>
  );
}

function MemoryDetail({ memory, onClose, onEdit, onDelete }: {
  memory: Memory;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const photos = memory.photos ?? [];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (lightboxIndex !== null) { setLightboxIndex(null); setZoomed(false); }
        else onClose();
      } else if (lightboxIndex !== null && event.key === "ArrowRight") {
        setLightboxIndex((current) => current === null || photos.length < 2 ? current : (current + 1) % photos.length);
        setZoomed(false);
      } else if (lightboxIndex !== null && event.key === "ArrowLeft") {
        setLightboxIndex((current) => current === null || photos.length < 2 ? current : (current - 1 + photos.length) % photos.length);
        setZoomed(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, onClose, photos.length]);

  function showAdjacentPhoto(direction: -1 | 1) {
    setLightboxIndex((current) => current === null || photos.length < 2 ? current : (current + direction + photos.length) % photos.length);
    setZoomed(false);
  }

  return <motion.div className="memory-modal-backdrop memory-detail-backdrop" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.section aria-labelledby="memory-detail-title" aria-modal="true" className="memory-detail"
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.985 }} role="dialog" transition={{ duration: 0.2 }}>
      <header className="memory-detail-header">
        <div><span className="eyebrow">A moment, kept close</span><span className="memory-detail-saved">Saved {savedDateLabel(memory.createdAt)}</span></div>
        <button aria-label="Close memory details" className="memory-close-button" onClick={onClose} type="button"><X size={18} /></button>
      </header>
      <div className="memory-detail-content">
        <div className="memory-detail-copy">
          <h2 className="serif" id="memory-detail-title">{memory.title}</h2>
          <div className="memory-detail-meta">
            <span><CalendarDays size={15} /> {prettyDate(memory.memoryDate)}{memory.memoryTime ? " · " + prettyTime(memory.memoryTime) : ""}</span>
            {memory.location && <span><MapPin size={15} /> {memory.location}</span>}
            {memory.mood && <span className="memory-mood"><Heart size={14} /> {memoryMoodLabels[memory.mood]}</span>}
          </div>
          {memory.description && <p className="memory-detail-description">{memory.description}</p>}
          {!!memory.tags?.length && <div className="memory-tags">{memory.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
          <p className="memory-detail-date-note">This happened on {prettyDate(memory.memoryDate)}. It was added to Solace on {savedDateLabel(memory.createdAt)}.</p>
        </div>
        {photos.length > 0 ? <section className="memory-detail-gallery" aria-label="Memory photos">
          <div className="memory-detail-gallery-heading"><h3 className="serif">The little things in the frame</h3><span>{photos.length} {photos.length === 1 ? "photo" : "photos"}</span></div>
          <div className="memory-detail-photo-grid">{photos.map((photo, index) => <button aria-label={"Open photo " + (index + 1) + " of " + photos.length}
            className="memory-detail-photo" key={photo.publicId} onClick={() => setLightboxIndex(index)} type="button">
            <Image alt={memory.title + ", photo " + (index + 1)} className="memory-detail-image" fill sizes="(max-width: 680px) 45vw, 280px" src={memoryPhotoUrl(memory.id, photo.publicId)} unoptimized />
            <span><Maximize2 size={14} /> View</span>
          </button>)}</div>
        </section> : <div className="memory-detail-no-photos"><ImagePlus size={19} /><span>No photos attached to this moment yet.</span></div>}
      </div>
      <footer className="memory-detail-actions">
        <button className="button-secondary memory-detail-delete" onClick={onDelete} type="button"><Trash2 size={15} /> Delete memory</button>
        <div><button className="button-secondary" onClick={onClose} type="button">Close</button><button className="button-primary" onClick={onEdit} type="button"><PenLine size={15} /> Edit memory</button></div>
      </footer>
    </motion.section>
    <AnimatePresence>
      {lightboxIndex !== null && photos[lightboxIndex] && <motion.div aria-label="Photo viewer" aria-modal="true" className="memory-lightbox"
        initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" transition={{ duration: 0.18 }}
        onClick={(event) => { if (event.target === event.currentTarget) { setLightboxIndex(null); setZoomed(false); } }}
        onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const touch = event.changedTouches[0];
          const difference = touch ? touch.clientX - touchStartX.current : 0;
          if (Math.abs(difference) > 55) showAdjacentPhoto(difference < 0 ? 1 : -1);
          touchStartX.current = null;
        }}>
        <button aria-label="Close photo viewer" className="memory-lightbox-close" onClick={() => { setLightboxIndex(null); setZoomed(false); }} type="button"><X size={21} /></button>
        {photos.length > 1 && <button aria-label="Previous photo" className="memory-lightbox-nav previous" onClick={() => showAdjacentPhoto(-1)} type="button"><ArrowLeft size={21} /></button>}
        <button aria-label={zoomed ? "Zoom out" : "Zoom in"} className="memory-lightbox-image-wrap" onClick={() => setZoomed((current) => !current)} type="button">
          <Image alt={memory.title + ", photo " + (lightboxIndex + 1)} className={"memory-lightbox-image" + (zoomed ? " is-zoomed" : "")} fill sizes="100vw" src={memoryPhotoUrl(memory.id, photos[lightboxIndex].publicId)} unoptimized />
        </button>
        {photos.length > 1 && <button aria-label="Next photo" className="memory-lightbox-nav next" onClick={() => showAdjacentPhoto(1)} type="button"><ArrowRight size={21} /></button>}
        <span className="memory-lightbox-count">{lightboxIndex + 1} / {photos.length} <span>· {zoomed ? "tap to zoom out" : "tap to zoom"}</span></span>
      </motion.div>}
    </AnimatePresence>
  </motion.div>;
}
