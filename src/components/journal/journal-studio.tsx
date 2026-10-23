"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookHeart, Check, ImagePlus, Images, LoaderCircle, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { StationeryDecorationLayer, StationeryPageDecorations, StationeryPicker } from "@/components/stationery/stationery-picker";
import { createJournalEntry, deleteJournalEntry, subscribeToJournalEntries, updateJournalEntry } from "@/lib/firebase/journal";
import { journalEntryInputSchema } from "@/lib/validations/journal";
import { useAuthStore } from "@/stores/auth-store";
import { memoryMoodLabels, memoryMoodValues, type MemoryMood } from "@/types/memory";
import { defaultPaperTexture, defaultTapeStyle, type DecorationId } from "@/types/stationery";
import type { JournalEntry, JournalEntryInput, JournalPhoto } from "@/types/journal";

function localToday() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function emptyEntry(): JournalEntryInput {
  return {
    title: "",
    body: "",
    entryDate: localToday(),
    mood: "",
    textureId: defaultPaperTexture,
    tapeId: defaultTapeStyle,
  };
}

function entryInput(entry: JournalEntry): JournalEntryInput {
  return {
    title: entry.title,
    body: entry.body,
    entryDate: entry.entryDate,
    mood: entry.mood,
    textureId: entry.textureId ?? defaultPaperTexture,
    tapeId: entry.tapeId ?? defaultTapeStyle,
  };
}

function journalErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
  if (code === "permission-denied") return "Firestore didn’t allow this entry. Check that the latest journal rules are deployed.";
  if (code === "unavailable") return "Solace can’t reach Firestore right now. Check your connection and try again.";
  if (code.endsWith("failed-precondition")) return "Firestore needs the journal shelf index. Deploy the updated Firestore indexes, then refresh.";
  return `That journal page couldn’t be saved${code ? ` (Firebase: ${code})` : ""}. Please try again.`;
}

function formattedDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

export function JournalStudio() {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const reduceMotion = useReducedMotion() ?? false;
  const previousUserId = useRef("");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadedForUid, setLoadedForUid] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<JournalEntryInput>(emptyEntry);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingDecorationId, setPendingDecorationId] = useState<DecorationId | null>(null);
  const [photoPending, setPhotoPending] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const isAccountChange = Boolean(previousUserId.current && previousUserId.current !== user.uid);
    previousUserId.current = user.uid;
    return subscribeToJournalEntries(
      user.uid,
      (nextEntries) => {
        setEntries(nextEntries);
        if (isAccountChange) {
          setSelectedEntryId(null);
          setDraft(emptyEntry());
          setDeleteConfirm(false);
        }
        setLoadedForUid(user.uid);
        setError("");
      },
      (loadError) => {
        console.error("Solace journal failed to load:", loadError);
        setError(journalErrorMessage(loadError));
        if (isAccountChange) {
          setEntries([]);
          setSelectedEntryId(null);
          setDraft(emptyEntry());
          setDeleteConfirm(false);
        }
        setLoadedForUid(user.uid);
      },
    );
  }, [user]);

  const loading = authLoading || Boolean(user && loadedForUid !== user.uid);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const entryPhotos = selectedEntry?.photos ?? [];
  const dirty = selectedEntryId
    ? Boolean(selectedEntry && JSON.stringify(draft) !== JSON.stringify(entryInput(selectedEntry)))
    : Boolean(draft.title.trim() || draft.body.trim());

  function setDraftValue<K extends keyof JournalEntryInput>(key: K, value: JournalEntryInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  function addDecoration(assetId: DecorationId) {
    if (!selectedEntryId) {
      setNotice("Save this journal page first, then you can place keepsakes on it.");
      return;
    }
    setPendingDecorationId(assetId);
    setNotice("Click the exact spot on the page where you want it.");
  }

  async function uploadPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length || !user) return;
    if (!selectedEntryId) {
      setError("Save this journal page before adding photos.");
      return;
    }
    if (!selectedEntry) {
      setError("Your saved page is still opening. Try choosing the photos again in a moment.");
      return;
    }
    const remaining = 10 - entryPhotos.length;
    if (files.length > remaining) {
      setError(`You can add ${remaining > 0 ? `up to ${remaining} more` : "no more"} photos to this page. Journal pages can hold 10 photos.`);
      return;
    }
    for (const file of files) {
      if (!/^(image\/(jpeg|png|webp))$/.test(file.type) || file.size > 8 * 1024 * 1024) {
        setError("Choose JPG, PNG, or WebP photos smaller than 8 MB each.");
        return;
      }
    }

    setPhotoPending(true);
    setError("");
    setNotice("");
    try {
      for (const file of files) {
        const form = new FormData();
        form.set("entryId", selectedEntryId);
        form.set("file", file);
        const idToken = await user.getIdToken();
        const response = await fetch("/api/journal/photos", {
          method: "POST",
          headers: { Authorization: "Bearer " + idToken },
          body: form,
        });
        const result = await response.json() as { error?: string; photo?: JournalPhoto };
        if (!response.ok || !result.photo) throw new Error(result.error ?? "A photo could not be added.");
      }
      setNotice(files.length === 1 ? "Your photo is tucked onto this page." : `${files.length} photos are tucked onto this page.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "A photo could not be added. Try again.");
    } finally {
      setPhotoPending(false);
    }
  }

  async function removePhoto(photo: JournalPhoto) {
    if (!selectedEntryId || !user) return;
    setPhotoPending(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/journal/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
        body: JSON.stringify({ entryId: selectedEntryId, publicId: photo.publicId }),
      });
      const result = await response.json() as { error?: string; photoCleanupPending?: boolean };
      if (!response.ok) throw new Error(result.error ?? "The photo could not be removed.");
      setNotice(result.photoCleanupPending ? "The photo was removed. Its cloud file may take longer to clean up." : "The photo was removed from this page.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "The photo could not be removed. Try again.");
    } finally {
      setPhotoPending(false);
    }
  }

  function confirmLeavingDraft() {
    return !dirty || window.confirm("Leave this journal page without saving your changes?");
  }

  function startNewEntry() {
    if (!confirmLeavingDraft()) return;
    setSelectedEntryId(null);
    setDraft(emptyEntry());
    setPendingDecorationId(null);
    setDeleteConfirm(false);
    setError("");
    setNotice("");
  }

  function openEntry(entry: JournalEntry) {
    if (entry.id === selectedEntryId || !confirmLeavingDraft()) return;
    setSelectedEntryId(entry.id);
    setDraft(entryInput(entry));
    setPendingDecorationId(null);
    setDeleteConfirm(false);
    setError("");
    setNotice("");
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!user) {
      setError("Sign in again before saving your journal page.");
      return;
    }

    const parsed = journalEntryInputSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check this page and try again.");
      return;
    }

    setPending("save");
    try {
      if (selectedEntryId) {
        await updateJournalEntry(selectedEntryId, user.uid, parsed.data);
        setNotice("Your words are tucked safely into your journal.");
      } else {
        const created = await createJournalEntry(user.uid, parsed.data);
        setSelectedEntryId(created.id);
        setNotice("Your first journal page is saved.");
      }
      setDraft(parsed.data);
    } catch (saveError) {
      console.error("Solace journal entry failed to save:", saveError);
      setError(journalErrorMessage(saveError));
    } finally {
      setPending(null);
    }
  }

  async function removeEntry() {
    if (!selectedEntryId || !user) return;
    setPending("delete");
    setError("");
    try {
      const result = await deleteJournalEntry(selectedEntryId, await user.getIdToken());
      setEntries((current) => current.filter((entry) => entry.id !== selectedEntryId));
      setSelectedEntryId(null);
      setDraft(emptyEntry());
      setDeleteConfirm(false);
      setNotice(result.photoCleanupPending
        ? "That journal page has been removed. Its photos may take longer to clean up."
        : "That journal page has been removed.");
    } catch (deleteError) {
      setError(journalErrorMessage(deleteError));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="journal-studio">
      <motion.header
        animate={{ opacity: 1, y: 0 }}
        className="journal-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        transition={{ duration: 0.42 }}
      >
        <div>
          <span className="eyebrow">A quieter corner</span>
          <h1 className="serif">Room for the words, too.</h1>
          <p>A private page for the details you want to remember in your own words.</p>
        </div>
        {user && <button className="button-primary journal-heading-new-page" onClick={startNewEntry} type="button"><Plus size={15} /> Write a new page</button>}
      </motion.header>

      {notice && <p className="memory-notice journal-notice" role="status"><Check size={14} /> {notice}</p>}
      {error && <p className="memory-error" role="alert">{error}</p>}

      <div className="journal-workspace">
        {loading ? (
          <div className="journal-workspace-empty" role="status"><LoaderCircle className="memory-spinner" size={20} /><p>Opening your private journal…</p></div>
        ) : !user ? (
          <div className="journal-workspace-empty"><BookHeart size={26} /><h2 className="serif">Sign in to open your journal.</h2><p>Your journal pages are private to your account.</p></div>
        ) : (
          <form className="scrapbook-editor-layout journal-editor-layout" onSubmit={(event) => void saveEntry(event)}>
            <aside aria-label="Saved journal pages" className="scrapbook-pages-rail journal-entry-rail">
              <div className="scrapbook-rail-heading"><span className="eyebrow">Your pages</span><strong>{entries.length} {entries.length === 1 ? "page" : "pages"}</strong></div>
              {entries.length ? (
                <div className="scrapbook-page-tabs">
                  {entries.map((entry, index) => (
                    <button
                      aria-current={selectedEntryId === entry.id ? "page" : undefined}
                      className={`scrapbook-page-tab${selectedEntryId === entry.id ? " active" : ""}`}
                      key={entry.id}
                      onClick={() => openEntry(entry)}
                      type="button"
                    >
                      <span className="scrapbook-page-tab-preview scrapbook-paper-cream"><span>{entries.length - index}</span><i /></span>
                      <span><strong>{entry.title}</strong><small>{formattedDate(entry.entryDate)}</small></span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="scrapbook-pages-empty"><BookHeart size={17} /><p>Your saved pages will gather here.</p></div>
              )}
              <button className="scrapbook-add-page-rail" onClick={startNewEntry} type="button"><Plus size={14} /> New page</button>
            </aside>

            <section aria-label="Journal page preview" className="scrapbook-canvas-area journal-canvas-area">
              <div className="journal-page-stage">
                <div className="scrapbook-stage-caption"><Sparkles size={13} /> A page from your journal</div>
                <article className="scrapbook-page-sheet scrapbook-paper-cream journal-paper-sheet">
                  <StationeryDecorationLayer tapeId={draft.tapeId} textureId={draft.textureId} />
                  <StationeryPageDecorations
                    key={selectedEntryId ?? "new-journal-entry"}
                    disabled={!selectedEntryId}
                    legacyDecorationIds={selectedEntry?.decorationIds ?? []}
                    onPlaced={() => { setPendingDecorationId(null); setNotice("Keepsake placed. Drag it into the perfect spot if you want to tweak it."); }}
                    onCancelPlacement={() => setPendingDecorationId(null)}
                    pendingAssetId={pendingDecorationId}
                    target={selectedEntryId ? { kind: "journal-entry", entryId: selectedEntryId } : null}
                  />
                  <span className="scrapbook-page-stamp">✦</span>
                  <div className="scrapbook-page-content journal-paper-content">
                    <span className="handwritten journal-page-kicker">A Solace journal page</span>
                    <span className="journal-page-date">{formattedDate(draft.entryDate)}{draft.mood ? ` · ${memoryMoodLabels[draft.mood]}` : " · a moment in time"}</span>
                    <label className="sr-only" htmlFor="journal-title">Page title</label>
                    <input
                      autoComplete="off"
                      aria-label="Journal page title"
                      className="journal-title-input"
                      id="journal-title"
                      maxLength={120}
                      onChange={(event) => setDraftValue("title", event.target.value)}
                      placeholder="A page to remember"
                      value={draft.title}
                    />
                    <label className="sr-only" htmlFor="journal-body">Your words</label>
                    <textarea
                      autoCapitalize="sentences"
                      autoCorrect="off"
                      className="journal-body-input"
                      id="journal-body"
                      maxLength={12000}
                      onChange={(event) => setDraftValue("body", event.target.value)}
                      placeholder="The little things are worth keeping. What do you hope you remember about today?"
                      value={draft.body}
                      spellCheck={false}
                    />
                    {entryPhotos.length > 0 && selectedEntryId && (
                      <section aria-label="Photos tucked into this page" className="journal-page-photos">
                        <span className="journal-page-photos-label"><Images size={13} /> Little moments, kept close</span>
                        <div className="journal-page-photo-strip">
                          {entryPhotos.map((photo, index) => (
                            <figure className="journal-page-polaroid" key={photo.publicId}>
                              <Image
                                alt={`Photo memory ${index + 1}`}
                                height={180}
                                src={`/api/journal/photos?${new URLSearchParams({ entryId: selectedEntryId, publicId: photo.publicId }).toString()}`}
                                unoptimized
                                width={200}
                              />
                              <figcaption>{formattedDate(draft.entryDate)} · {index + 1}</figcaption>
                            </figure>
                          ))}
                        </div>
                      </section>
                    )}
                    <footer className="journal-paper-footer"><span>Solace · private by default</span><span>{draft.body.length.toLocaleString()} / 12,000</span></footer>
                  </div>
                </article>
              </div>
            </section>

            <aside aria-label="Journal page details" className="scrapbook-page-controls journal-style-panel">
              <div className="scrapbook-controls-heading"><span className="eyebrow">Make it yours</span><h2 className="serif">Page details</h2></div>
              <label className="memory-field"><span>Entry date</span><input className="journal-date-input" id="journal-date" onChange={(event) => setDraftValue("entryDate", event.target.value)} type="date" value={draft.entryDate} /></label>
              <label className="memory-field"><span>Feeling</span><select className="journal-mood-input" id="journal-mood" onChange={(event) => setDraftValue("mood", event.target.value as MemoryMood | "")} value={draft.mood}><option value="">Keep it open</option>{memoryMoodValues.map((mood) => <option key={mood} value={mood}>{memoryMoodLabels[mood]}</option>)}</select></label>
              <details className="scrapbook-control-foldout" open={entryPhotos.length > 0}>
                <summary>Photos · {entryPhotos.length}/10</summary>
                <div className="scrapbook-photo-tools journal-photo-tools">
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Choose photos for this journal page"
                    className="scrapbook-file-input"
                    disabled={!selectedEntryId || !selectedEntry || photoPending || entryPhotos.length >= 10}
                    multiple
                    onChange={(event) => void uploadPhotos(event)}
                    ref={photoInputRef}
                    type="file"
                  />
                  <button className="button-secondary scrapbook-upload-button" disabled={!selectedEntryId || !selectedEntry || photoPending || entryPhotos.length >= 10} onClick={() => photoInputRef.current?.click()} type="button">
                    {photoPending ? <LoaderCircle className="memory-spinner" size={15} /> : <ImagePlus size={15} />}
                    {photoPending ? "Adding photos…" : "Add photos"}
                  </button>
                  <span>{entryPhotos.length}/10 photos · JPG, PNG, WebP up to 8 MB</span>
                  {!selectedEntryId && <p className="scrapbook-field-note">Save your page first to add photos.</p>}
                  {entryPhotos.length > 0 && (
                    <div className="scrapbook-photo-list journal-photo-list" aria-label="Photos on this page">
                      {entryPhotos.map((photo, index) => (
                        <div className="scrapbook-photo-item" key={photo.publicId}>
                          <Image
                            alt={`Journal photo ${index + 1}`}
                            className="scrapbook-photo-thumb"
                            height={54}
                            src={`/api/journal/photos?${new URLSearchParams({ entryId: selectedEntryId ?? "", publicId: photo.publicId }).toString()}`}
                            unoptimized
                            width={54}
                          />
                          <span>Photo {index + 1}</span>
                          <button aria-label={`Remove journal photo ${index + 1}`} className="scrapbook-photo-remove" disabled={photoPending} onClick={() => void removePhoto(photo)} type="button"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
              <StationeryPicker
                disabled={!selectedEntryId}
                openDecorations
                onAddDecoration={addDecoration}
                pendingDecorationId={pendingDecorationId}
                onCancelPlacement={() => setPendingDecorationId(null)}
                onTapeChange={(value) => setDraftValue("tapeId", value)}
                onTextureChange={(value) => setDraftValue("textureId", value)}
                tapeId={draft.tapeId}
                textureId={draft.textureId}
              />
              <button className="button-primary scrapbook-save-page" disabled={pending !== null || !dirty} type="submit">
                {pending === "save" ? <LoaderCircle className="memory-spinner" size={15} /> : dirty ? <Save size={15} /> : <Check size={15} />}
                {pending === "save" ? "Saving page…" : dirty ? selectedEntryId ? "Save changes" : "Save this page" : selectedEntryId ? "All changes saved" : "Start writing to save"}
              </button>
              {selectedEntryId && !deleteConfirm && <button className="journal-delete-entry scrapbook-delete-page" disabled={pending !== null} onClick={() => setDeleteConfirm(true)} type="button"><Trash2 size={14} /> Delete this page</button>}
              <AnimatePresence>
                {deleteConfirm && (
                  <motion.div animate={{ opacity: 1, y: 0 }} className="journal-delete-confirmation" exit={{ opacity: 0, y: 5 }} initial={reduceMotion ? false : { opacity: 0, y: 5 }}>
                    <p>Delete this page for good? This can’t be undone.</p>
                    <div><button className="button-secondary" disabled={pending !== null} onClick={() => setDeleteConfirm(false)} type="button">Keep it</button><button className="journal-delete-entry" disabled={pending !== null} onClick={() => void removeEntry()} type="button">{pending === "delete" ? <LoaderCircle className="memory-spinner" size={13} /> : <Trash2 size={13} />}{pending === "delete" ? "Deleting…" : "Delete"}</button></div>
                  </motion.div>
                )}
              </AnimatePresence>
              <p className="scrapbook-photo-note"><Sparkles size={14} /><span>Photos and decorations stay with this page.</span></p>
            </aside>
          </form>
        )}
      </div>
    </div>
  );
}
