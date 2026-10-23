"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import {
  CalendarDays,
  Check,
  Heart,
  ImagePlus,
  LoaderCircle,
  MapPin,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { removeMemory, saveMemory, subscribeToMemories } from "@/lib/firebase/memories";
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
  const [photoError, setPhotoError] = useState("");
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

  async function handleSave(input: MemoryInput) {
    if (!user) throw new Error("Sign in again to save this memory.");
    await saveMemory(user.uid, input, editingMemory?.id);
    setNotice(editingMemory ? "Your memory has been updated." : "Your memory is tucked safely away.");
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
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    const memory = memories.find((item) => item.id === photoTargetId);
    setPhotoTargetId("");
    if (!file || !memory || !user) return;

    if ((memory.photos?.length ?? 0) >= 5) {
      setPhotoError("A memory can hold up to five photos.");
      return;
    }
    if (!/^(image\/(jpeg|png|webp))$/.test(file.type) || file.size > 8 * 1024 * 1024) {
      setPhotoError("Choose a JPG, PNG, or WebP photo smaller than 8 MB.");
      return;
    }

    setPhotoPendingId(memory.id);
    setPhotoError("");
    setNotice("");
    try {
      const form = new FormData();
      form.set("memoryId", memory.id);
      form.set("file", file);
      const response = await fetch("/api/memories/photos", {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        body: form,
      });
      const result = await response.json() as { error?: string; photo?: MemoryPhoto; url?: string };
      if (!response.ok || !result.photo || !result.url) {
        throw new Error(result.error ?? "The photo could not be added.");
      }
      setNotice("Your photo is safely tucked into this memory.");
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "The photo could not be added. Please try again.");
    } finally {
      setPhotoPendingId("");
    }
  }

  async function removePhoto(memoryId: string, photo: MemoryPhoto) {
    if (!user) return;
    setPhotoPendingId(`${memoryId}:${photo.publicId}`);
    setPhotoError("");
    try {
      const response = await fetch("/api/memories/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ memoryId, publicId: photo.publicId }),
      });
      const result = await response.json() as { error?: string; photoCleanupPending?: boolean };
      if (!response.ok) throw new Error(result.error ?? "The photo could not be removed.");
      setNotice(result.photoCleanupPending
        ? "The photo was removed from this memory and will finish clearing shortly."
        : "The photo was removed from this memory.");
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "The photo could not be removed. Please try again.");
    } finally {
      setPhotoPendingId("");
    }
  }

  return (
    <div className="memory-page">
      <input
        ref={photoInputRef}
        accept="image/jpeg,image/png,image/webp"
        className="memory-file-input"
        onChange={(event) => void uploadPhoto(event)}
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
              <div className={"memory-card-art memory-card-art-" + ((index % 3) + 1)} aria-hidden="true">
                <span className="memory-card-art-orbit" />
                <span className="memory-card-art-star">✦</span>
                <span className="memory-card-art-date">{prettyDate(memory.memoryDate)}</span>
                <span className="memory-card-art-caption">kept close</span>
              </div>
              <div className="memory-card-body">
                <div className="memory-card-kicker">
                  <span><CalendarDays size={13} /> {prettyDate(memory.memoryDate)}</span>
                  {memory.mood && <span className="memory-mood"><Heart size={12} /> {memoryMoodLabels[memory.mood]}</span>}
                </div>
                <h2 className="serif">{memory.title}</h2>
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
                      {(memory.photos?.length ?? 0) < 5 && (
                        <button
                          className="memory-add-photo-button"
                          disabled={Boolean(photoPendingId)}
                          onClick={() => choosePhoto(memory.id)}
                          type="button"
                        >
                          {photoPendingId === memory.id ? <LoaderCircle className="memory-spinner" size={14} /> : <ImagePlus size={14} />}
                          {photoPendingId === memory.id ? "Adding…" : "Add photo"}
                        </button>
                      )}
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
}: {
  memory: Memory | null;
  onClose: () => void;
  onSave: (input: MemoryInput) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [title, setTitle] = useState(memory?.title ?? "");
  const [description, setDescription] = useState(memory?.description ?? "");
  const [memoryDate, setMemoryDate] = useState(memory?.memoryDate ?? todayDate());
  const [location, setLocation] = useState(memory?.location ?? "");
  const [mood, setMood] = useState<MemoryMood | "">(memory?.mood ?? "");
  const [tags, setTags] = useState(memory?.tags.join(", ") ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = memoryInputSchema.safeParse({
      title,
      description,
      memoryDate,
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
      await onSave(parsed.data);
      onClose();
    } catch (saveError) {
      setError(memoryErrorMessage(saveError));
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.div
      className="memory-modal-backdrop"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
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
            <h2 className="serif" id="memory-form-title">{memory ? "Edit your memory." : "Write it down."}</h2>
          </div>
          <button aria-label="Close memory form" className="memory-close-button" disabled={pending} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form className="memory-form" onSubmit={submit}>
          <label className="memory-field memory-field-full">
            <span>Give this day a name</span>
            <input
              autoFocus
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="The afternoon we took the long way home"
              required
              value={title}
            />
          </label>
          <label className="memory-field memory-field-full">
            <span>What do you want to remember?</span>
            <textarea
              maxLength={5000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="The light, the laughter, the little thing someone said…"
              rows={4}
              value={description}
            />
          </label>
          <div className="memory-form-row">
            <label className="memory-field">
              <span>When was it?</span>
              <input onChange={(event) => setMemoryDate(event.target.value)} required type="date" value={memoryDate} />
            </label>
            <label className="memory-field">
              <span>Where were you?</span>
              <input
                maxLength={120}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="A place, or a little corner"
                value={location}
              />
            </label>
          </div>
          <div className="memory-form-row">
            <label className="memory-field">
              <span>How did it feel?</span>
              <select onChange={(event) => setMood(event.target.value as MemoryMood | "")} value={mood}>
                <option value="">Keep it open</option>
                {memoryMoodValues.map((value) => <option key={value} value={value}>{memoryMoodLabels[value]}</option>)}
              </select>
            </label>
            <label className="memory-field">
              <span>Little tags</span>
              <input
                onChange={(event) => setTags(event.target.value)}
                placeholder="summer, friends, home, milestone"
                value={tags}
              />
            </label>
          </div>
          <p className="memory-private-note"><Heart size={14} /> Private to your Solace space. After saving, add up to five photos on the memory card.</p>
          {error && <p className="memory-error" role="alert">{error}</p>}
          <div className="memory-form-actions">
            <button className="button-secondary" disabled={pending} onClick={onClose} type="button">Let it wait</button>
            <button className="button-primary" disabled={pending} type="submit">
              {pending ? <LoaderCircle size={16} className="memory-spinner" /> : <Sparkles size={16} />}
              {pending ? "Saving…" : memory ? "Save changes" : "Keep this memory"}
            </button>
          </div>
        </form>
      </motion.section>
    </motion.div>
  );
}
