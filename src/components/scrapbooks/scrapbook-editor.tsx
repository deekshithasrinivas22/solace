"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Images,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Music2,
  PencilLine,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { subscribeToMemories } from "@/lib/firebase/memories";
import {
  createScrapbookPage,
  saveScrapbookPage,
  subscribeToScrapbook,
  subscribeToScrapbookPages,
  updateScrapbook,
} from "@/lib/firebase/scrapbooks";
import { scrapbookInputSchema, scrapbookPageInputSchema } from "@/lib/validations/scrapbook";
import {
  scrapbookCoverLabels,
  scrapbookCoverValues,
  scrapbookLayoutLabels,
  scrapbookLayoutValues,
  scrapbookPaperLabels,
  scrapbookPaperValues,
  type Scrapbook,
  type ScrapbookCover,
  type ScrapbookInput,
  type ScrapbookLayout,
  type ScrapbookPage,
  type ScrapbookPageInput,
  type ScrapbookPhoto,
  type ScrapbookPaper,
  type ScrapbookTrack,
} from "@/types/scrapbook";
import { memoryMoodLabels, type Memory, type MemoryMood } from "@/types/memory";
import { StationeryDecorationLayer, StationeryPageDecorations, StationeryPicker } from "@/components/stationery/stationery-picker";
import { ScrapbookCoverArtPicker } from "@/components/scrapbooks/cover-art-picker";
import { defaultPaperTexture, defaultTapeStyle, scrapbookVibeLabels, scrapbookVibeValues } from "@/types/stationery";
import type { DecorationId, ScrapbookCoverArtwork, ScrapbookVibe } from "@/types/stationery";

function pageInput(page: ScrapbookPage): ScrapbookPageInput {
  return {
    title: page.title,
    layout: page.layout,
    paper: page.paper,
    textureId: page.textureId ?? defaultPaperTexture,
    tapeId: page.tapeId ?? defaultTapeStyle,
    vibe: page.vibe ?? "core-memory",
    caption: page.caption,
    memoryId: page.memoryId,
    photos: page.photos ?? [],
    track: page.track ?? null,
  };
}

type ScrapbookControlSection = "page" | "story" | "photos";

function firestoreError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
  if (code === "permission-denied") return "Firestore didn’t allow that change. Check that the latest scrapbook rules are deployed.";
  if (code === "invalid-argument") return "This page was missing a required detail. Refresh the scrapbook, then try again.";
  if (code === "unavailable") return "Solace can’t reach Firestore right now. Check your connection and try again.";
  return `That change couldn’t be saved${code ? ` (Firebase: ${code})` : ""}. Please try again.`;
}

export function ScrapbookEditor({ scrapbookId }: { scrapbookId: string }) {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const reduceMotion = useReducedMotion() ?? false;
  const [book, setBook] = useState<Scrapbook | null>(null);
  const [pages, setPages] = useState<ScrapbookPage[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [bookLoadedForUid, setBookLoadedForUid] = useState("");
  const [pagesLoadedForUid, setPagesLoadedForUid] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ScrapbookPageInput>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, Record<string, string>>>({});
  const [photoLoadingError, setPhotoLoadingError] = useState("");
  const [bookError, setBookError] = useState("");
  const [pageError, setPageError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"create" | "save" | "rename" | "upload" | "remove" | "delete" | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deletePageOpen, setDeletePageOpen] = useState(false);
  const [pendingDecorationId, setPendingDecorationId] = useState<DecorationId | null>(null);
  const [controlSection, setControlSection] = useState<ScrapbookControlSection>("page");
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribeBook = subscribeToScrapbook(
      scrapbookId,
      (nextBook) => {
        setBook(nextBook);
        setBookError("");
        setBookLoadedForUid(user.uid);
      },
      (error) => {
        console.error("Solace scrapbook failed to load:", error);
        setBookError("This scrapbook couldn’t be opened. It may not exist or may belong to another account.");
        setBookLoadedForUid(user.uid);
      },
    );
    const unsubscribePages = subscribeToScrapbookPages(
      scrapbookId,
      (nextPages) => {
        setPages(nextPages);
        setDrafts((current) => {
          const next = { ...current };
          for (const page of nextPages) {
            if (next[page.id]) next[page.id] = { ...next[page.id], photos: page.photos ?? [] };
          }
          return next;
        });
        setPageError("");
        setPagesLoadedForUid(user.uid);
      },
      (error) => {
        console.error("Solace scrapbook pages failed to load:", error);
        setPageError(firestoreError(error));
        setPagesLoadedForUid(user.uid);
      },
    );
    const unsubscribeMemories = subscribeToMemories(user.uid, setMemories, () => setMemories([]), 50);
    return () => {
      unsubscribeBook();
      unsubscribePages();
      unsubscribeMemories();
    };
  }, [scrapbookId, user]);

  const loading = authLoading || Boolean(user && (bookLoadedForUid !== user.uid || pagesLoadedForUid !== user.uid));
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null;
  const draft = selectedPage ? drafts[selectedPage.id] ?? pageInput(selectedPage) : null;
  const photoIdsKey = (selectedPage?.photos ?? []).map((photo) => photo.publicId).join("|");
  const savedInput = selectedPage ? pageInput(selectedPage) : null;
  const dirty = Boolean(draft && savedInput && JSON.stringify(draft) !== JSON.stringify(savedInput));
  const linkedMemory = memories.find((memory) => memory.id === draft?.memoryId) ?? null;
  const previewTrackResult = draft ? scrapbookPageInputSchema.shape.track.safeParse(draft.track) : null;
  const previewTrack = previewTrackResult?.success ? previewTrackResult.data : null;

  const activeBookId = book?.id;
  const activePageId = selectedPage?.id;

  useEffect(() => {
    if (!user || !activeBookId || !activePageId || !photoIdsKey) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "deliver-scrapbook-photos", scrapbookId: activeBookId, pageId: activePageId }),
      });
      const result = await response.json() as {
        error?: string;
        photos?: Array<{ photo: ScrapbookPhoto; url: string }>;
      };
      if (!response.ok || !result.photos) throw new Error(result.error ?? "Photos could not be opened.");
      if (cancelled) return;
      setPhotoUrls((current) => ({
        ...current,
        [activePageId]: Object.fromEntries(result.photos!.map(({ photo, url }) => [photo.publicId, url])),
      }));
      setPhotoLoadingError("");
    })().catch((error: unknown) => {
      if (!cancelled) setPhotoLoadingError(error instanceof Error ? error.message : "Photos could not be opened.");
    });
    return () => { cancelled = true; };
  }, [activeBookId, activePageId, photoIdsKey, user]);

  function updateDraft<K extends keyof ScrapbookPageInput>(key: K, value: ScrapbookPageInput[K]) {
    if (!selectedPage) return;
    setDrafts((current) => ({
      ...current,
      [selectedPage.id]: { ...(current[selectedPage.id] ?? pageInput(selectedPage)), [key]: value },
    }));
    setNotice("");
  }

  function updateTrack(key: keyof ScrapbookTrack, value: string) {
    if (!selectedPage) return;
    setDrafts((current) => {
      const base = current[selectedPage.id] ?? pageInput(selectedPage);
      const track = base.track ?? { title: "", artist: "", url: "", note: "" };
      return { ...current, [selectedPage.id]: { ...base, track: { ...track, [key]: value } } };
    });
    setNotice("");
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !book || !selectedPage || !user || !draft) return;
    if (draft.photos.length >= 3) {
      setActionError("This page already has three photos. Remove one before adding another.");
      return;
    }
    if (!/^(image\/(jpeg|png|webp))$/.test(file.type) || file.size > 8 * 1024 * 1024) {
      setActionError("Choose a JPG, PNG, or WebP photo smaller than 8 MB.");
      return;
    }

    setPending("upload");
    setActionError("");
    setPhotoLoadingError("");
    setNotice("");
    try {
      const form = new FormData();
      form.set("scrapbookId", book.id);
      form.set("pageId", selectedPage.id);
      form.set("file", file);
      const idToken = await user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: form,
      });
      const result = await response.json() as { error?: string; photo?: ScrapbookPhoto; url?: string };
      if (!response.ok || !result.photo || !result.url) throw new Error(result.error ?? "The photo could not be added.");
      setPhotoUrls((current) => ({
        ...current,
        [selectedPage.id]: { ...current[selectedPage.id], [result.photo!.publicId]: result.url! },
      }));
      setNotice("Your photo is safely on this page.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The photo could not be added. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function removePhoto(photo: ScrapbookPhoto) {
    if (!book || !selectedPage || !user) return;
    setPending("remove");
    setActionError("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          action: "remove-scrapbook-photo",
          scrapbookId: book.id,
          pageId: selectedPage.id,
          publicId: photo.publicId,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The photo could not be removed.");
      setPhotoUrls((current) => {
        const pageUrls = { ...current[selectedPage.id] };
        delete pageUrls[photo.publicId];
        return { ...current, [selectedPage.id]: pageUrls };
      });
      setNotice("The photo was removed from this page.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The photo could not be removed. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function addPage() {
    if (!book) return;
    setPending("create");
    setNotice("");
    setActionError("");
    try {
      const pageId = await createScrapbookPage(book.id, {
        title: `Page ${pages.length + 1}`,
        layout: "polaroid",
        paper: "cream",
        textureId: defaultPaperTexture,
        tapeId: defaultTapeStyle,
        vibe: "core-memory",
        caption: "",
        memoryId: "",
        photos: [],
        track: null,
      });
      setSelectedPageId(pageId);
      setControlSection("page");
      setPendingDecorationId(null);
      setNotice("A new page is ready for you.");
    } catch (error) {
      setActionError(firestoreError(error));
    } finally {
      setPending(null);
    }
  }

  function addDecoration(assetId: DecorationId) {
    if (!selectedPage || !book) return;
    setPendingDecorationId(assetId);
    setNotice("Click the exact spot on the page where you want it.");
  }

  async function deletePage() {
    if (!book || !selectedPage || !user) throw new Error("Sign in again to delete this page.");
    setPending("delete");
    setActionError("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/scrapbooks/pages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ scrapbookId: book.id, pageId: selectedPage.id }),
      });
      const result = await response.json() as { error?: string; photoCleanupPending?: boolean };
      if (!response.ok) throw new Error(result.error ?? "The page could not be deleted.");

      const deletedPageId = selectedPage.id;
      const nextPage = pages.find((page) => page.id !== deletedPageId);
      setPages((current) => current.filter((page) => page.id !== deletedPageId));
      setSelectedPageId(nextPage?.id ?? "");
      setControlSection("page");
      setPendingDecorationId(null);
      setDrafts((current) => {
        const next = { ...current };
        delete next[deletedPageId];
        return next;
      });
      setPhotoUrls((current) => {
        const next = { ...current };
        delete next[deletedPageId];
        return next;
      });
      setDeletePageOpen(false);
      setNotice(result.photoCleanupPending
        ? "The page was deleted. Its private photo files could not all be removed yet."
        : "The page and its photos were deleted.");
    } finally {
      setPending(null);
    }
  }

  async function savePage() {
    if (!book || !selectedPage || !draft) return;
    const parsed = scrapbookPageInputSchema.safeParse(draft);
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Check the page details and try again.");
      return;
    }
    setPending("save");
    setActionError("");
    try {
      await saveScrapbookPage(book.id, selectedPage.id, parsed.data);
      setNotice("This page is tucked safely into your scrapbook.");
    } catch (error) {
      setActionError(firestoreError(error));
    } finally {
      setPending(null);
    }
  }

  async function renameBook(input: ScrapbookInput) {
    if (!book || !user) throw new Error("Sign in again to edit this scrapbook.");
    setPending("rename");
    try {
      await updateScrapbook(book.id, user.uid, input);
      setRenameOpen(false);
      setNotice("Your scrapbook cover has been updated.");
    } finally {
      setPending(null);
    }
  }

  if (loading) {
    return <div className="scrapbook-loading"><LoaderCircle className="memory-spinner" size={20} /> Opening your scrapbook…</div>;
  }

  if (!user) {
    return <div className="scrapbook-empty"><BookOpen size={24} /><h1 className="serif">Sign in to open this scrapbook.</h1></div>;
  }

  if (bookError || !book) {
    return (
      <div className="scrapbook-editor-error">
        <Link className="scrapbook-back-link" href="/scrapbooks"><ArrowLeft size={15} /> Your shelf</Link>
        <div className="scrapbook-empty"><BookOpen size={24} /><h1 className="serif">This scrapbook is out of reach.</h1><p>{bookError || "It may have been moved or may belong to another account."}</p></div>
      </div>
    );
  }

  return (
    <div className="scrapbook-editor">
      <motion.header
        className="scrapbook-editor-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38 }}
      >
        <div className="scrapbook-editor-title-row">
          <Link className="scrapbook-back-link" href="/scrapbooks"><ArrowLeft size={15} /> Your shelf</Link>
          <ChevronRight size={13} className="scrapbook-breadcrumb-divider" />
          <span className="scrapbook-breadcrumb-current">Studio</span>
        </div>
        <div className="scrapbook-editor-title-line">
          <div>
            <span className="eyebrow">A scrapbook in progress</span>
            <h1 className="serif">{book.title}</h1>
            {book.description && <p>{book.description}</p>}
          </div>
          <div className="scrapbook-editor-actions">
            <button className="button-secondary scrapbook-rename-button" onClick={() => setRenameOpen(true)} type="button"><PencilLine size={15} /> Edit cover</button>
            <button className="button-primary" disabled={pending === "create"} onClick={() => void addPage()} type="button">
              {pending === "create" ? <LoaderCircle className="memory-spinner" size={16} /> : <Plus size={16} />}
              Add a page
            </button>
          </div>
        </div>
      </motion.header>

      {notice && <p className="memory-notice" role="status"><Check size={15} /> {notice}</p>}
      {(pageError || actionError) && <p className="memory-error" role="alert">{pageError || actionError}</p>}

      <div className="scrapbook-editor-layout">
        <div className="scrapbook-canvas-column">
          <aside className="scrapbook-pages-rail" aria-label="Scrapbook pages">
            <div className="scrapbook-rail-heading"><span className="eyebrow">Pages in this book</span><strong>{pages.length} {pages.length === 1 ? "page" : "pages"}</strong></div>
            <div className="scrapbook-page-browser">
              {pages.length ? (
                <div className="scrapbook-page-tabs">
                  {pages.map((page, index) => (
                    <button
                      aria-current={selectedPage?.id === page.id ? "page" : undefined}
                      className={`scrapbook-page-tab ${selectedPage?.id === page.id ? "active" : ""}`}
                      key={page.id}
                      onClick={() => { setSelectedPageId(page.id); setControlSection("page"); setPendingDecorationId(null); setNotice(""); setPhotoLoadingError(""); }}
                      type="button"
                    >
                      <span className={`scrapbook-page-tab-preview scrapbook-paper-${page.paper}`}><span>{index + 1}</span><i /></span>
                      <span><strong>{page.title}</strong><small>{scrapbookLayoutLabels[page.layout]}</small></span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="scrapbook-pages-empty"><Sparkles size={16} /><p>Your first page will appear here.</p></div>
              )}
              <button className="scrapbook-add-page-rail" disabled={pending === "create"} onClick={() => void addPage()} type="button"><Plus size={14} /> Add page</button>
            </div>
          </aside>

          <section className="scrapbook-canvas-area" aria-label="Page preview">
            {selectedPage && draft ? (
              <ScrapbookPagePreview key={book.id + "-" + selectedPage.id} book={book} draft={draft} linkedMemory={linkedMemory} photoUrls={photoUrls[selectedPage.id] ?? {}} previewTrack={previewTrack} scrapbookId={book.id} pageId={selectedPage.id} legacyDecorationIds={selectedPage.decorationIds ?? []} pendingDecorationId={pendingDecorationId} onDecorationPlaced={() => { setPendingDecorationId(null); setNotice("Keepsake placed. Drag it into the perfect spot if you want to tweak it."); }} onCancelPlacement={() => setPendingDecorationId(null)} />
            ) : (
              <div className="scrapbook-canvas-empty">
                <span><BookOpen size={25} /></span>
                <h2 className="serif">Your story starts on the next page.</h2>
                <p>Choose a layout and a page will unfold here. You can save its paper, writing, and memory link.</p>
                <button className="button-primary" disabled={pending === "create"} onClick={() => void addPage()} type="button"><Plus size={16} /> Create the first page</button>
              </div>
            )}
          </section>
        </div>

        <aside className="scrapbook-page-controls" aria-label="Page details">
          {selectedPage && draft ? (
            <>
              <div className="scrapbook-controls-heading">
                <div><span className="eyebrow">One page at a time</span><h2 className="serif">Make it yours</h2></div>
                <span className={`scrapbook-save-state${dirty ? " is-dirty" : ""}`}>{dirty ? "Unsaved" : "Saved"}</span>
              </div>
              <div className="scrapbook-control-tabs" role="group" aria-label="Choose what to edit">
                <button aria-controls="scrapbook-control-content" aria-pressed={controlSection === "page"} className={controlSection === "page" ? "active" : ""} onClick={() => setControlSection("page")} type="button"><PencilLine size={15} /><span>Page</span></button>
                <button aria-controls="scrapbook-control-content" aria-pressed={controlSection === "story"} className={controlSection === "story" ? "active" : ""} onClick={() => setControlSection("story")} type="button"><BookOpen size={15} /><span>Story</span></button>
                <button aria-controls="scrapbook-control-content" aria-pressed={controlSection === "photos"} className={controlSection === "photos" ? "active" : ""} onClick={() => setControlSection("photos")} type="button"><Images size={15} /><span>Photos</span><small>{draft.photos.length}/3</small></button>
              </div>
              <div className="scrapbook-control-content" id="scrapbook-control-content">
                {controlSection === "page" && <div className="scrapbook-control-section" role="group" aria-label="Page design">
                  <label className="memory-field"><span>Page title</span><input maxLength={80} onChange={(event) => updateDraft("title", event.target.value)} value={draft.title} /></label>
                  <label className="memory-field"><span>Page layout</span><select onChange={(event) => updateDraft("layout", event.target.value as ScrapbookLayout)} value={draft.layout}>{scrapbookLayoutValues.map((layout) => <option key={layout} value={layout}>{scrapbookLayoutLabels[layout]}</option>)}</select></label>
                  <label className="memory-field"><span>Paper</span><select onChange={(event) => updateDraft("paper", event.target.value as ScrapbookPaper)} value={draft.paper}>{scrapbookPaperValues.map((paper) => <option key={paper} value={paper}>{scrapbookPaperLabels[paper]}</option>)}</select></label>
                  <label className="memory-field"><span>Page vibe</span><select onChange={(event) => updateDraft("vibe", event.target.value as ScrapbookVibe)} value={draft.vibe}>{scrapbookVibeValues.map((vibe) => <option key={vibe} value={vibe}>{scrapbookVibeLabels[vibe]}</option>)}</select></label>
                  <StationeryPicker
                    onAddDecoration={addDecoration}
                    pendingDecorationId={pendingDecorationId}
                    onCancelPlacement={() => setPendingDecorationId(null)}
                    onTapeChange={(value) => updateDraft("tapeId", value)}
                    onTextureChange={(value) => updateDraft("textureId", value)}
                    tapeId={draft.tapeId}
                    textureId={draft.textureId}
                  />
                </div>}

                {controlSection === "story" && <div className="scrapbook-control-section" role="group" aria-label="Story details">
                  <label className="memory-field"><span>Link a memory</span><select onChange={(event) => updateDraft("memoryId", event.target.value)} value={draft.memoryId}><option value="">No memory linked</option>{memories.map((memory) => <option key={memory.id} value={memory.id}>{memory.title}</option>)}</select></label>
                  {memories.length === 0 && <p className="scrapbook-field-note">Save a memory first, then you can link it here. <Link href="/memories">Open Memories</Link></p>}
                  <label className="memory-field"><span>Write a little caption</span><textarea maxLength={1600} onChange={(event) => updateDraft("caption", event.target.value)} placeholder="A few words about this page…" rows={5} value={draft.caption} /></label>
                  <details className="scrapbook-control-foldout scrapbook-soundtrack-foldout" open={Boolean(draft.track)}>
                    <summary>Soundtrack {draft.track ? "· Added" : "· Optional"}</summary>
                    <section className="scrapbook-track-tools" aria-labelledby="scrapbook-track-heading">
                      <div className="scrapbook-track-heading"><span className="eyebrow">A little soundtrack</span><h3 className="serif" id="scrapbook-track-heading">A song for this page</h3></div>
                      {draft.track ? <>
                        <label className="memory-field"><span>Song title</span><input maxLength={120} onChange={(event) => updateTrack("title", event.target.value)} placeholder="The song from that day" value={draft.track.title} /></label>
                        <label className="memory-field"><span>Artist</span><input maxLength={120} onChange={(event) => updateTrack("artist", event.target.value)} placeholder="Artist name" value={draft.track.artist} /></label>
                        <label className="memory-field"><span>Song link</span><input maxLength={500} onChange={(event) => updateTrack("url", event.target.value)} placeholder="https://open.spotify.com/..." type="url" value={draft.track.url} /></label>
                        <label className="memory-field"><span>Why it belongs here</span><input maxLength={500} onChange={(event) => updateTrack("note", event.target.value)} placeholder="It played all the way home…" value={draft.track.note} /></label>
                        <button className="scrapbook-track-remove" onClick={() => updateDraft("track", null)} type="button">Remove song</button>
                      </> : <>
                        <p className="scrapbook-field-note">Add a link from Spotify, Apple Music, YouTube Music, or SoundCloud. Solace won’t store or play the song itself.</p>
                        <button className="button-secondary scrapbook-track-add" onClick={() => updateDraft("track", { title: "", artist: "", url: "", note: "" })} type="button"><Music2 size={15} /> Add a song link</button>
                      </>}
                    </section>
                  </details>
                </div>}

                {controlSection === "photos" && <div className="scrapbook-control-section" role="group" aria-label="Page photos">
                  <div className="scrapbook-photo-tools">
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Choose a scrapbook photo"
                      className="scrapbook-file-input"
                      disabled={pending === "upload" || draft.photos.length >= 3}
                      onChange={(event) => void uploadPhoto(event)}
                      ref={photoInputRef}
                      type="file"
                    />
                    <button
                      className="button-secondary scrapbook-upload-button"
                      disabled={pending === "upload" || draft.photos.length >= 3}
                      onClick={() => photoInputRef.current?.click()}
                      type="button"
                    >
                      {pending === "upload" ? <LoaderCircle className="memory-spinner" size={15} /> : <ImagePlus size={15} />}
                      {pending === "upload" ? "Adding photo…" : "Add a photo"}
                    </button>
                    <span>{draft.photos.length}/3 photos · JPG, PNG, WebP up to 8 MB</span>
                  </div>
                  {photoLoadingError && <p className="memory-error" role="alert">{photoLoadingError}</p>}
                  {draft.photos.length > 0 && <div className="scrapbook-photo-list" aria-label="Photos on this page">
                    {draft.photos.map((photo, index) => <div className="scrapbook-photo-item" key={photo.publicId}>
                      {photoUrls[selectedPage.id]?.[photo.publicId] ? <Image alt={`Photo ${index + 1} on ${draft.title}`} className="scrapbook-photo-thumb" height={54} src={photoUrls[selectedPage.id][photo.publicId]} unoptimized width={54} /> : <span className="scrapbook-photo-thumb-loading"><Images size={15} /></span>}
                      <span>Photo {index + 1}</span>
                      <button aria-label={`Remove photo ${index + 1}`} className="scrapbook-photo-remove" disabled={pending === "remove"} onClick={() => void removePhoto(photo)} type="button"><Trash2 size={13} /></button>
                    </div>)}
                  </div>}
                  <div className="scrapbook-photo-note"><Images size={15} /><span>Photos stay private and load only for you.</span></div>
                </div>}
              </div>
              <div className="scrapbook-controls-actions">
                <button className="button-primary scrapbook-save-page" disabled={pending === "save" || !dirty} onClick={() => void savePage()} type="button">
                  {pending === "save" ? <LoaderCircle className="memory-spinner" size={16} /> : dirty ? <Save size={16} /> : <Check size={16} />}
                  {pending === "save" ? "Saving page…" : dirty ? "Save this page" : "All changes saved"}
                </button>
                <button className="scrapbook-delete-page" disabled={pending !== null} onClick={() => setDeletePageOpen(true)} type="button"><Trash2 size={14} /> Delete this page</button>
              </div>
            </>
          ) : (
            <div className="scrapbook-controls-empty"><Sparkles size={20} /><h2 className="serif">Ready when you are.</h2><p>Add a page to choose a layout, paper, and caption.</p></div>
          )}
        </aside>
      </div>

      <AnimatePresence>
        {renameOpen && <ScrapbookDetailsComposer book={book} pending={pending === "rename"} onClose={() => setRenameOpen(false)} onSave={renameBook} />}
        {deletePageOpen && selectedPage && (
          <DeleteScrapbookPageConfirmation
            pageTitle={selectedPage.title}
            pending={pending === "delete"}
            onClose={() => setDeletePageOpen(false)}
            onDelete={deletePage}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ScrapbookPagePreview({
  book,
  draft,
  linkedMemory,
  photoUrls,
  previewTrack,
  scrapbookId,
  pageId,
  legacyDecorationIds,
  pendingDecorationId,
  onDecorationPlaced,
  onCancelPlacement,
}: {
  book: Scrapbook;
  draft: ScrapbookPageInput;
  linkedMemory: Memory | null;
  photoUrls: Record<string, string>;
  previewTrack: ScrapbookTrack | null;
  scrapbookId: string;
  pageId: string;
  legacyDecorationIds: DecorationId[];
  pendingDecorationId: DecorationId | null;
  onDecorationPlaced: () => void;
  onCancelPlacement: () => void;
}) {
  const slotCount = draft.layout === "filmstrip" ? 3 : draft.layout === "postcard" ? 2 : 1;
  return (
    <div className="scrapbook-page-stage">
      <div className="scrapbook-stage-caption"><Sparkles size={13} /> A little preview of your page</div>
      <article className={`scrapbook-page-sheet scrapbook-paper-${draft.paper} scrapbook-layout-sheet-${draft.layout}`}>
        <StationeryDecorationLayer
          tapeId={draft.tapeId}
          textureId={draft.textureId}
        />
        <StationeryPageDecorations
          legacyDecorationIds={legacyDecorationIds}
          onPlaced={onDecorationPlaced}
          onCancelPlacement={onCancelPlacement}
          pendingAssetId={pendingDecorationId}
          target={{ kind: "scrapbook-page", scrapbookId, pageId }}
        />
        <span className="scrapbook-page-stamp">✦</span>
        <div className="scrapbook-page-content">
        <div className={`scrapbook-photo-arrangement scrapbook-layout-${draft.layout}`}>
          {Array.from({ length: slotCount }, (_, index) => (
            <div className="scrapbook-photo-slot" key={index}>
              {draft.photos[index] && photoUrls[draft.photos[index].publicId] ? (
                <Image
                  alt={`Photo ${index + 1} on ${draft.title}`}
                  className="scrapbook-photo-image"
                  fill
                  sizes="(max-width: 760px) 80vw, 45vw"
                  src={photoUrls[draft.photos[index].publicId]}
                  unoptimized
                />
              ) : (
                <><Images size={20} strokeWidth={1.35} /><span>{draft.photos[index] ? "Opening photo…" : "Add a photo"}</span></>
              )}
            </div>
          ))}
        </div>
        <div className="scrapbook-page-writing">
          <span className="handwritten">{book.title}</span>
          <span className={"scrapbook-vibe scrapbook-vibe-" + draft.vibe}>{scrapbookVibeLabels[draft.vibe]}</span>
          <h2 className="serif">{draft.title || "A page to remember"}</h2>
          <p>{draft.caption || "Your words will find a home here…"}</p>
          {linkedMemory && (
            <span className="scrapbook-linked-memory"><MapPin size={12} /> From “{linkedMemory.title}”{linkedMemory.mood ? ` · ${memoryMoodLabels[linkedMemory.mood as MemoryMood]}` : ""}</span>
          )}
          {previewTrack && (
            <div className="scrapbook-preview-track">
              <a href={previewTrack.url} rel="noopener noreferrer" target="_blank"><Music2 size={13} /> Listen to “{previewTrack.title}”{previewTrack.artist ? ` · ${previewTrack.artist}` : ""}</a>
              {previewTrack.note && <span>{previewTrack.note}</span>}
            </div>
          )}
        </div>
        <footer><span>solace</span><span>kept close, always</span></footer>
        </div>
      </article>
    </div>
  );
}

function ScrapbookDetailsComposer({
  book,
  pending,
  onClose,
  onSave,
}: {
  book: Scrapbook;
  pending: boolean;
  onClose: () => void;
  onSave: (input: ScrapbookInput) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [title, setTitle] = useState(book.title);
  const [description, setDescription] = useState(book.description);
  const [cover, setCover] = useState<ScrapbookCover>(book.cover);
  const [coverArtwork, setCoverArtwork] = useState<ScrapbookCoverArtwork>(book.coverArtwork ?? "polaroid-01");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = scrapbookInputSchema.safeParse({ title, description, cover, coverArtwork });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the cover details and try again.");
      return;
    }
    try {
      await onSave(parsed.data);
    } catch (saveError) {
      setError(firestoreError(saveError));
    }
  }

  return (
    <motion.div animate={{ opacity: 1 }} className="scrapbook-modal-backdrop" exit={{ opacity: 0 }} initial={reduceMotion ? false : { opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <motion.section animate={{ opacity: 1, y: 0, scale: 1 }} aria-labelledby="scrapbook-edit-title" aria-modal="true" className="scrapbook-modal" exit={{ opacity: 0, y: 12, scale: 0.98 }} initial={reduceMotion ? false : { opacity: 0, y: 15, scale: 0.98 }} role="dialog" transition={{ duration: 0.22 }}>
        <div className="scrapbook-modal-heading"><div><span className="eyebrow">Your cover, revisited</span><h2 className="serif" id="scrapbook-edit-title">Edit scrapbook details.</h2></div><button aria-label="Close" className="memory-close-button" disabled={pending} onClick={onClose} type="button"><X size={18} /></button></div>
        <form className="scrapbook-form" onSubmit={submit}>
          <label className="memory-field"><span>Scrapbook title <small>appears on the cover and your shelf</small></span><input maxLength={100} onChange={(event) => setTitle(event.target.value)} required value={title} /></label>
          <label className="memory-field"><span>Cover note</span><textarea maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={3} value={description} /></label>
          <label className="memory-field"><span>Cover mood</span><select onChange={(event) => setCover(event.target.value as ScrapbookCover)} value={cover}>{scrapbookCoverValues.map((value) => <option key={value} value={value}>{scrapbookCoverLabels[value]}</option>)}</select></label>
          <ScrapbookCoverArtPicker onChange={setCoverArtwork} value={coverArtwork} />
          {error && <p className="memory-error" role="alert">{error}</p>}
          <div className="scrapbook-form-actions"><button className="button-secondary" disabled={pending} onClick={onClose} type="button">Cancel</button><button className="button-primary" disabled={pending} type="submit">{pending ? <LoaderCircle className="memory-spinner" size={16} /> : <Check size={16} />}{pending ? "Saving…" : "Save cover"}</button></div>
        </form>
      </motion.section>
    </motion.div>
  );
}

function DeleteScrapbookPageConfirmation({
  pageTitle,
  pending,
  onClose,
  onDelete,
}: {
  pageTitle: string;
  pending: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [error, setError] = useState("");

  async function confirmDelete() {
    setError("");
    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The page could not be deleted. Please try again.");
    }
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="scrapbook-modal-backdrop"
      exit={{ opacity: 0 }}
      initial={reduceMotion ? false : { opacity: 0 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}
    >
      <motion.section
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-labelledby="scrapbook-delete-title"
        aria-modal="true"
        className="scrapbook-modal scrapbook-delete-modal"
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        initial={reduceMotion ? false : { opacity: 0, y: 15, scale: 0.98 }}
        role="alertdialog"
        transition={{ duration: 0.22 }}
      >
        <div className="scrapbook-modal-heading">
          <div>
            <span className="eyebrow">A page to let go</span>
            <h2 className="serif" id="scrapbook-delete-title">Delete “{pageTitle}”?</h2>
          </div>
          <button aria-label="Close" className="memory-close-button" disabled={pending} onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <p className="scrapbook-delete-copy">This removes the page and its photos from your scrapbook. This can’t be undone.</p>
        {error && <p className="memory-error" role="alert">{error}</p>}
        <div className="scrapbook-form-actions">
          <button className="button-secondary" disabled={pending} onClick={onClose} type="button">Keep page</button>
          <button className="scrapbook-confirm-delete" disabled={pending} onClick={() => void confirmDelete()} type="button">
            {pending ? <LoaderCircle className="memory-spinner" size={15} /> : <Trash2 size={15} />}
            {pending ? "Deleting…" : "Delete page"}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
