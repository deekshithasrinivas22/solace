"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
import { scrapbookInputSchema, scrapbookPageInputSchema, scrapbookTrackSchema } from "@/lib/validations/scrapbook";
import {
  scrapbookCoverLabels,
  scrapbookCoverValues,
  scrapbookLayoutLabels,
  scrapbookLayoutStyleChoices,
  scrapbookLayoutValues,
  scrapbookPaperLabels,
  scrapbookPaperValues,
  defaultScrapbookLayoutStyle,
  defaultScrapbookPhotoPosition,
  type Scrapbook,
  type ScrapbookCover,
  type ScrapbookInput,
  type ScrapbookLayout,
  type ScrapbookLayoutStyle,
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
    layoutStyle: page.layoutStyle ?? defaultScrapbookLayoutStyle(page.layout),
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
            if (next[page.id]) {
              const localPhotos = next[page.id].photos;
              next[page.id] = {
                ...next[page.id],
                photos: (page.photos ?? []).map((photo) => {
                  const localPhoto = localPhotos.find((item) => item.publicId === photo.publicId);
                  return localPhoto?.position ? { ...photo, position: localPhoto.position } : photo;
                }),
              };
            }
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
  const previewTrackResult = draft ? scrapbookTrackSchema.safeParse(draft.track) : null;
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

  function updateLayout(layout: ScrapbookLayout) {
    if (!selectedPage) return;
    setDrafts((current) => {
      const base = current[selectedPage.id] ?? pageInput(selectedPage);
      return {
        ...current,
        [selectedPage.id]: { ...base, layout, layoutStyle: defaultScrapbookLayoutStyle(layout) },
      };
    });
    setNotice("");
  }

  function updatePhotoPosition(publicId: string, position: ScrapbookPhoto["position"]) {
    if (!selectedPage || !draft || !position) return;
    updateDraft("photos", draft.photos.map((photo) => photo.publicId === publicId ? { ...photo, position } : photo));
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
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length || !book || !selectedPage || !user || !draft) return;
    if (files.some((file) => !/^(image\/(jpeg|png|webp))$/.test(file.type) || file.size > 8 * 1024 * 1024)) {
      setActionError("Choose JPG, PNG, or WebP photos smaller than 8 MB each.");
      return;
    }

    setPending("upload");
    setActionError("");
    setPhotoLoadingError("");
    setNotice("");
    let uploadedCount = 0;
    try {
      const idToken = await user.getIdToken();
      for (const file of files) {
        const form = new FormData();
        form.set("scrapbookId", book.id);
        form.set("pageId", selectedPage.id);
        form.set("file", file);
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: form,
        });
        const result = await response.json() as { error?: string; photo?: ScrapbookPhoto; url?: string };
        if (!response.ok || !result.photo || !result.url) throw new Error(result.error ?? `“${file.name}” could not be added.`);
        setPhotoUrls((current) => ({
          ...current,
          [selectedPage.id]: { ...current[selectedPage.id], [result.photo!.publicId]: result.url! },
        }));
        setDrafts((current) => {
          const base = current[selectedPage.id] ?? pageInput(selectedPage);
          if (base.photos.some((photo) => photo.publicId === result.photo!.publicId)) return current;
          return { ...current, [selectedPage.id]: { ...base, photos: [...base.photos, result.photo!] } };
        });
        uploadedCount += 1;
      }
      setNotice(files.length === 1 ? "Your photo is safely on this page." : `${files.length} photos are safely on this page.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The photo could not be added. Please try again.";
      setActionError(uploadedCount ? `${message} ${uploadedCount} ${uploadedCount === 1 ? "photo is" : "photos are"} already saved.` : message);
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
        layoutStyle: defaultScrapbookLayoutStyle("polaroid"),
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
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error("Sign in again before saving this page.");
      await saveScrapbookPage(book.id, selectedPage.id, parsed.data, idToken);
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

      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose scrapbook photos"
        className="scrapbook-file-input"
        disabled={pending === "upload"}
        multiple
        onChange={(event) => void uploadPhoto(event)}
        ref={photoInputRef}
        type="file"
      />

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
              <ScrapbookPagePreview key={book.id + "-" + selectedPage.id} book={book} draft={draft} linkedMemory={linkedMemory} photoUrls={photoUrls[selectedPage.id] ?? {}} previewTrack={previewTrack} scrapbookId={book.id} pageId={selectedPage.id} legacyDecorationIds={selectedPage.decorationIds ?? []} pendingDecorationId={pendingDecorationId} onDecorationPlaced={() => { setPendingDecorationId(null); setNotice("Keepsake placed. Drag it into the perfect spot if you want to tweak it."); }} onCancelPlacement={() => setPendingDecorationId(null)} onRequestAddPhoto={() => photoInputRef.current?.click()} onPhotoPositionChange={updatePhotoPosition} onTextChange={(key, value) => updateDraft(key, value)} />
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
                <button aria-controls="scrapbook-control-content" aria-pressed={controlSection === "photos"} className={controlSection === "photos" ? "active" : ""} onClick={() => setControlSection("photos")} type="button"><Images size={15} /><span>Photos</span><small>{draft.photos.length}</small></button>
              </div>
              <div className="scrapbook-control-content" id="scrapbook-control-content">
                {controlSection === "page" && <div className="scrapbook-control-section" role="group" aria-label="Page design">
                  <label className="memory-field"><span>Page layout</span><select onChange={(event) => updateLayout(event.target.value as ScrapbookLayout)} value={draft.layout}>{scrapbookLayoutValues.map((layout) => <option key={layout} value={layout}>{scrapbookLayoutLabels[layout]}</option>)}</select></label>
                  <label className="memory-field"><span>{scrapbookLayoutLabels[draft.layout]} style</span><select onChange={(event) => updateDraft("layoutStyle", event.target.value as ScrapbookLayoutStyle)} value={draft.layoutStyle}>{scrapbookLayoutStyleChoices[draft.layout].map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
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
                    <button
                      className="button-secondary scrapbook-upload-button"
                      disabled={pending === "upload"}
                      onClick={() => photoInputRef.current?.click()}
                      type="button"
                    >
                      {pending === "upload" ? <LoaderCircle className="memory-spinner" size={15} /> : <ImagePlus size={15} />}
                      {pending === "upload" ? "Adding photo…" : "Add a photo"}
                    </button>
                    <span>{draft.photos.length} {draft.photos.length === 1 ? "photo" : "photos"} · Add as many as you need, up to 8 MB each</span>
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
  onRequestAddPhoto,
  onPhotoPositionChange,
  onTextChange,
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
  onRequestAddPhoto: () => void;
  onPhotoPositionChange: (publicId: string, position: NonNullable<ScrapbookPhoto["position"]>) => void;
  onTextChange: (key: "title" | "caption", value: string) => void;
}) {
  type DragState = {
    publicId: string;
    pointerId: number;
    pageLeft: number;
    pageTop: number;
    pageWidth: number;
    pageHeight: number;
    offsetX: number;
    offsetY: number;
    frameWidth: number;
    frameHeight: number;
  };
  const dragRef = useRef<DragState | null>(null);
  const [dragPosition, setDragPosition] = useState<{ publicId: string; x: number; y: number } | null>(null);

  function photoPosition(photo: ScrapbookPhoto, index: number) {
    return photo.position ?? defaultScrapbookPhotoPosition(draft.layout, index);
  }

  function beginPhotoDrag(event: ReactPointerEvent<HTMLDivElement>, photo: ScrapbookPhoto, index: number) {
    if (event.button !== 0) return;
    const sheet = event.currentTarget.closest<HTMLElement>(".scrapbook-page-sheet");
    if (!sheet) return;
    const page = sheet.getBoundingClientRect();
    const frame = event.currentTarget.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      publicId: photo.publicId,
      pointerId: event.pointerId,
      pageLeft: page.left,
      pageTop: page.top,
      pageWidth: page.width,
      pageHeight: page.height,
      offsetX: event.clientX - frame.left,
      offsetY: event.clientY - frame.top,
      frameWidth: frame.width,
      frameHeight: frame.height,
    };
    const position = photoPosition(photo, index);
    setDragPosition({ publicId: photo.publicId, ...position });
  }

  function movePhotoDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = Math.max(0, Math.min(100, ((event.clientX - drag.pageLeft - drag.offsetX + drag.frameWidth / 2) / drag.pageWidth) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - drag.pageTop - drag.offsetY + drag.frameHeight / 2) / drag.pageHeight) * 100));
    setDragPosition({ publicId: drag.publicId, x, y });
  }

  function finishPhotoDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = Math.max(0, Math.min(100, ((event.clientX - drag.pageLeft - drag.offsetX + drag.frameWidth / 2) / drag.pageWidth) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - drag.pageTop - drag.offsetY + drag.frameHeight / 2) / drag.pageHeight) * 100));
    onPhotoPositionChange(drag.publicId, { x, y });
    dragRef.current = null;
    setDragPosition(null);
  }

  function nudgePhoto(event: ReactKeyboardEvent<HTMLDivElement>, photo: ScrapbookPhoto, index: number) {
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const position = photoPosition(photo, index);
    onPhotoPositionChange(photo.publicId, {
      x: Math.max(0, Math.min(100, position.x + delta[0])),
      y: Math.max(0, Math.min(100, position.y + delta[1])),
    });
  }

  const photoWidth = Math.max(16, Math.min(44, 46 / Math.sqrt(Math.max(1, draft.photos.length))));
  return (
    <div className="scrapbook-page-stage">
      <div className="scrapbook-stage-toolbar">
        <div className="scrapbook-stage-caption"><Sparkles size={13} /> Click the title or note to write · Drag photos anywhere</div>
        <button className="scrapbook-stage-add-photo" onClick={onRequestAddPhoto} type="button"><ImagePlus size={14} /> Add photos</button>
      </div>
      <article className={`scrapbook-page-sheet scrapbook-paper-${draft.paper} scrapbook-layout-sheet-${draft.layout} scrapbook-style-${draft.layoutStyle}`}>
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
          {draft.photos.length === 0 ? (
            <button className="scrapbook-photo-slot scrapbook-photo-placeholder" onClick={onRequestAddPhoto} type="button">
              <ImagePlus size={24} strokeWidth={1.35} /><span>Add a photo</span>
            </button>
          ) : draft.photos.map((photo, index) => {
            const position = dragPosition?.publicId === photo.publicId ? dragPosition : photoPosition(photo, index);
            const rotation = index % 2 === 0 ? -1.6 : 1.8;
            return (
              <div
                aria-label={`Photo ${index + 1} on ${draft.title}. Use arrow keys to move it.`}
                className={`scrapbook-photo-slot scrapbook-photo-draggable scrapbook-photo-${draft.layout}`}
                key={photo.publicId}
                onKeyDown={(event) => nudgePhoto(event, photo, index)}
                onPointerCancel={finishPhotoDrag}
                onPointerDown={(event) => beginPhotoDrag(event, photo, index)}
                onPointerMove={movePhotoDrag}
                onPointerUp={finishPhotoDrag}
                role="img"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: `${photoWidth}%`,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                }}
                tabIndex={0}
              >
                {photoUrls[photo.publicId] ? (
                  <Image alt="" className="scrapbook-photo-image" fill sizes="(max-width: 760px) 42vw, 24vw" src={photoUrls[photo.publicId]} unoptimized />
                ) : (
                  <><Images size={20} strokeWidth={1.35} /><span>Opening photo…</span></>
                )}
              </div>
            );
          })}
        </div>
        <div className="scrapbook-page-writing">
          <span className="handwritten">{book.title}</span>
          <span className={"scrapbook-vibe scrapbook-vibe-" + draft.vibe}>{scrapbookVibeLabels[draft.vibe]}</span>
          <input aria-label="Page title. Click here to write." className="scrapbook-page-title-input serif" maxLength={80} onChange={(event) => onTextChange("title", event.target.value)} placeholder="A page to remember" value={draft.title} />
          <textarea aria-label="Page note. Click here to write." className="scrapbook-page-caption-input" maxLength={1600} onChange={(event) => onTextChange("caption", event.target.value)} placeholder="Click here to write your story…" rows={3} value={draft.caption} />
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
