"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BookHeart, Bold, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Eye,
  ImagePlus, Images, Italic, List, LoaderCircle, Moon, PenLine, Plus, Quote,
  Search, Save, Sparkles, Trash2, X,
} from "lucide-react";
import { StationeryDecorationLayer, StationeryPageDecorations, StationeryPicker } from "@/components/stationery/stationery-picker";
import { createJournalEntry, deleteJournalEntry, subscribeToJournalEntries, updateJournalEntry } from "@/lib/firebase/journal";
import { journalEntryInputSchema } from "@/lib/validations/journal";
import { useAuthStore } from "@/stores/auth-store";
import { memoryMoodLabels, memoryMoodValues, type MemoryMood } from "@/types/memory";
import { defaultPaperTexture, defaultTapeStyle, type DecorationId } from "@/types/stationery";
import type { JournalEntry, JournalEntryInput, JournalPhoto } from "@/types/journal";

const moodSymbols: Record<MemoryMood, string> = {
  joyful: "☀", grateful: "✿", nostalgic: "⌂", peaceful: "☾",
  excited: "✦", tender: "♡", bittersweet: "☁",
};
const writingPrompts = [
  "What felt like a small kindness today?",
  "What do you wish you could tell someone?",
  "When did you feel most like yourself?",
  "What is something you want to remember about this season?",
  "What can you let be unfinished for now?",
];

function localToday() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function emptyEntry(date = localToday()): JournalEntryInput {
  return { title: "", body: "", entryDate: date, mood: "", tags: [], textureId: defaultPaperTexture, tapeId: defaultTapeStyle };
}

function entryInput(entry: JournalEntry): JournalEntryInput {
  return {
    title: entry.title ?? "",
    body: entry.body,
    entryDate: entry.entryDate,
    mood: entry.mood,
    tags: entry.tags ?? [],
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
  return "That journal page couldn’t be saved. Please try again.";
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return value;
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" })
    .format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function inlineMarkdown(value: string): ReactNode[] {
  const pieces = value.split(/(\*\*.+?\*\*|~~.+?~~|\u0060[^\u0060]+\u0060|\*[^*]+\*)/g);
  return pieces.filter(Boolean).map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) return <strong key={index}>{piece.slice(2, -2)}</strong>;
    if (piece.startsWith("~~") && piece.endsWith("~~")) return <s key={index}>{piece.slice(2, -2)}</s>;
    if (piece.startsWith("\u0060") && piece.endsWith("\u0060")) return <code key={index}>{piece.slice(1, -1)}</code>;
    if (piece.startsWith("*") && piece.endsWith("*")) return <em key={index}>{piece.slice(1, -1)}</em>;
    return piece;
  });
}

function markdownPreview(value: string) {
  if (!value.trim()) return <p className="journal-preview-placeholder">Your words will appear here.</p>;
  return value.split("\n").map((line, index) => {
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) return <h3 className="journal-preview-heading" key={index}>{inlineMarkdown(heading[1])}</h3>;
    if (line.startsWith(">")) return <blockquote className="journal-preview-quote" key={index}>{inlineMarkdown(line.slice(1).trim())}</blockquote>;
    if (/^[-*]\s+/.test(line)) return <p className="journal-preview-list-item" key={index}>• {inlineMarkdown(line.slice(2))}</p>;
    if (/^\d+\.\s+/.test(line)) return <p className="journal-preview-list-item" key={index}>{inlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</p>;
    if (!line.trim()) return <div aria-hidden="true" className="journal-preview-space" key={index} />;
    return <p key={index}>{inlineMarkdown(line)}</p>;
  });
}

export function JournalStudio() {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const reduceMotion = useReducedMotion() ?? false;
  const previousUserId = useRef("");
  const sessionId = useRef(0);
  const saving = useRef(false);
  const savedVersions = useRef(new Map<string, string>());
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadedForUid, setLoadedForUid] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<JournalEntryInput>(emptyEntry);
  const [pending, setPending] = useState<"delete" | null>(null);
  const [saveState, setSaveState] = useState<"quiet" | "saving" | "saved" | "error">("quiet");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [mindUnload, setMindUnload] = useState(false);
  const [preview, setPreview] = useState(false);
  const [view, setView] = useState<"timeline" | "calendar">("timeline");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(localToday);
  const [searchText, setSearchText] = useState("");
  const [tagText, setTagText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingDecorationId, setPendingDecorationId] = useState<DecorationId | null>(null);
  const [photoPending, setPhotoPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const isAccountChange = Boolean(previousUserId.current && previousUserId.current !== user.uid);
    previousUserId.current = user.uid;
    if (isAccountChange) {
      sessionId.current += 1;
      savedVersions.current.clear();
      setEntries([]);
      setSelectedEntryId(null);
      setDraft(emptyEntry());
      setMindUnload(false);
      setDeleteConfirm(false);
      setSaveState("quiet");
    }
    return subscribeToJournalEntries(
      user.uid,
      (nextEntries) => {
        setEntries(nextEntries);
        setLoadedForUid(user.uid);
        setError("");
      },
      (loadError) => {
        console.error("Solace journal failed to load:", loadError);
        setError(journalErrorMessage(loadError));
        if (isAccountChange) setEntries([]);
        setLoadedForUid(user.uid);
      },
    );
  }, [user]);

  const loading = authLoading || Boolean(user && loadedForUid !== user.uid);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const entryPhotos = selectedEntry?.photos ?? [];
  const draftKey = JSON.stringify(draft);
  const selectedKey = selectedEntry ? JSON.stringify(entryInput(selectedEntry)) : "";
  const dirty = selectedEntryId
    ? Boolean(selectedEntry && draftKey !== selectedKey)
    : Boolean(draft.title.trim() || draft.body.trim() || draft.tags.length);

  const persistDraft = useCallback(async (
    input: JournalEntryInput,
    entryId: string | null,
    currentSession: number,
  ) => {
    if (!user || saving.current) return null;
    const parsed = journalEntryInputSchema.safeParse(input);
    if (!parsed.success) {
      if (currentSession === sessionId.current) setError(parsed.error.issues[0]?.message ?? "Check this page and try again.");
      return null;
    }
    saving.current = true;
    if (currentSession === sessionId.current) {
      setError("");
      setSaveState("saving");
    }
    try {
      let savedId = entryId;
      if (savedId) await updateJournalEntry(savedId, user.uid, parsed.data);
      else savedId = (await createJournalEntry(user.uid, parsed.data)).id;
      savedVersions.current.set(savedId, JSON.stringify(parsed.data));
      if (currentSession === sessionId.current) {
        if (!entryId) setSelectedEntryId(savedId);
        setSavedAt(new Date());
        setSaveState("saved");
      }
      return savedId;
    } catch (saveError) {
      console.error("Solace journal entry failed to save:", saveError);
      if (currentSession === sessionId.current) {
        setError(journalErrorMessage(saveError));
        setSaveState("error");
      }
      return null;
    } finally {
      saving.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user || loading || !dirty || !draft.body.trim() || pending === "delete") return;
    const parsed = journalEntryInputSchema.safeParse(draft);
    if (!parsed.success) return;
    const payload = parsed.data;
    const payloadKey = JSON.stringify(payload);
    const entryId = selectedEntryId;
    const currentSession = sessionId.current;
    if (entryId && selectedEntry && JSON.stringify(entryInput(selectedEntry)) === payloadKey) return;
    if (entryId && savedVersions.current.get(entryId) === payloadKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const attemptSave = () => {
      if (cancelled) return;
      if (saving.current) {
        timer = setTimeout(attemptSave, 350);
        return;
      }
      void persistDraft(payload, entryId, currentSession);
    };
    timer = setTimeout(attemptSave, 950);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, dirty, loading, pending, persistDraft, selectedEntry, selectedEntryId, user]);

  const sortedEntries = useMemo(
    () => [...entries].sort((first, second) => second.entryDate.localeCompare(first.entryDate)
      || String(second.updatedAt).localeCompare(String(first.updatedAt))),
    [entries],
  );
  const visibleEntries = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) return sortedEntries;
    return sortedEntries.filter((entry) => [entry.title, entry.body, ...(entry.tags ?? []), entry.mood]
      .join(" ").toLowerCase().includes(needle));
  }, [searchText, sortedEntries]);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(calendarMonth);
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [calendarMonth]);
  const datesWithEntries = useMemo(() => new Set(entries.map((entry) => entry.entryDate)), [entries]);
  function setDraftValue<K extends keyof JournalEntryInput>(key: K, value: JournalEntryInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
    setSaveState("quiet");
  }

  function resetToNew(date = localToday(), unload = false) {
    sessionId.current += 1;
    setSelectedEntryId(null);
    setDraft(emptyEntry(date));
    setMindUnload(unload);
    setPreview(false);
    setPendingDecorationId(null);
    setDeleteConfirm(false);
    setError("");
    setNotice("");
    setSaveState("quiet");
    setSelectedDate(date);
  }

  function confirmLeavingDraft() {
    return !dirty || window.confirm("Leave this journal page? Solace is still saving any recent changes.");
  }

  function startNewEntry(date = localToday()) {
    if (confirmLeavingDraft()) resetToNew(date);
  }

  function startMindUnload() {
    if (confirmLeavingDraft()) resetToNew(localToday(), true);
  }

  function openEntry(entry: JournalEntry) {
    if (entry.id === selectedEntryId || !confirmLeavingDraft()) return;
    sessionId.current += 1;
    setSelectedEntryId(entry.id);
    setDraft(entryInput(entry));
    setSelectedDate(entry.entryDate);
    setMindUnload(false);
    setPreview(false);
    setPendingDecorationId(null);
    setDeleteConfirm(false);
    setError("");
    setNotice("");
    setSaveState("saved");
  }

  function handleCalendarDate(date: Date) {
    const key = dateKey(date);
    setSelectedDate(key);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    const entry = entries.find((item) => item.entryDate === key);
    if (entry) openEntry(entry);
    else startNewEntry(key);
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!user) {
      setError("Sign in again before saving your journal page.");
      return;
    }
    if (saving.current) return;
    const parsed = journalEntryInputSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check this page and try again.");
      setSaveState("error");
      return;
    }
    await persistDraft(parsed.data, selectedEntryId, sessionId.current);
  }

  function addDecoration(assetId: DecorationId) {
    if (!selectedEntryId) {
      setNotice("Your page will save as you write. Add keepsakes after its first save.");
      return;
    }
    setPendingDecorationId(assetId);
    setNotice("Choose a quiet little spot for it on the page.");
  }

  function addTags() {
    const nextTags = tagText.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!nextTags.length) return;
    const uniqueTags = Array.from(new Set([...draft.tags, ...nextTags])).slice(0, 12);
    setDraftValue("tags", uniqueTags);
    setTagText("");
  }

  function removeTag(tagToRemove: string) {
    setDraftValue("tags", draft.tags.filter((tag) => tag !== tagToRemove));
  }

  function insertFormat(before: string, after = before, eachLine = false) {
    const editor = bodyRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = draft.body.slice(start, end) || "your words";
    const formatted = eachLine
      ? selected.split("\n").map((line) => before + line).join("\n")
      : before + selected + after;
    const next = draft.body.slice(0, start) + formatted + draft.body.slice(end);
    setDraftValue("body", next);
    requestAnimationFrame(() => {
      editor.focus();
      const selectionStart = start + before.length;
      const selectionEnd = selectionStart + (eachLine ? formatted.length - before.length : selected.length);
      editor.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function insertPrompt() {
    const prompt = writingPrompts[promptIndex % writingPrompts.length];
    setPromptIndex((index) => index + 1);
    setDraftValue("body", draft.body ? draft.body + "\n\n" + prompt + "\n\n" : prompt + "\n\n");
    requestAnimationFrame(() => bodyRef.current?.focus());
  }

  async function uploadPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length || !user) return;
    if (!selectedEntryId || !selectedEntry) {
      setError("Let the page save once before adding photos.");
      return;
    }
    const remaining = 10 - entryPhotos.length;
    if (files.length > remaining) {
      setError("A journal page can hold up to 10 photos.");
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
        const response = await fetch("/api/journal/photos", {
          method: "POST",
          headers: { Authorization: "Bearer " + await user.getIdToken() },
          body: form,
        });
        const result = await response.json() as { error?: string; photo?: JournalPhoto };
        if (!response.ok || !result.photo) throw new Error(result.error ?? "A photo could not be added.");
      }
      setNotice(files.length === 1 ? "Your photo is tucked into this entry." : "Your photos are tucked into this entry.");
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
      const response = await fetch("/api/journal/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken() },
        body: JSON.stringify({ entryId: selectedEntryId, publicId: photo.publicId }),
      });
      const result = await response.json() as { error?: string; photoCleanupPending?: boolean };
      if (!response.ok) throw new Error(result.error ?? "The photo could not be removed.");
      setNotice(result.photoCleanupPending ? "The photo was removed. Its cloud file may take longer to clean up." : "The photo was removed from this entry.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "The photo could not be removed. Try again.");
    } finally {
      setPhotoPending(false);
    }
  }

  async function removeEntry() {
    if (!selectedEntryId || !user || saving.current) return;
    setPending("delete");
    setError("");
    try {
      const result = await deleteJournalEntry(selectedEntryId, await user.getIdToken());
      const deletedId = selectedEntryId;
      setEntries((current) => current.filter((entry) => entry.id !== deletedId));
      savedVersions.current.delete(deletedId);
      resetToNew();
      setNotice(result.photoCleanupPending
        ? "That journal page is gone. Its photos may take a little longer to clear."
        : "That journal page has been removed.");
    } catch (deleteError) {
      setError(journalErrorMessage(deleteError));
    } finally {
      setPending(null);
    }
  }

  async function saveMindUnloadAsPage() {
    if (!user || saving.current) return;
    const parsed = journalEntryInputSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Write a few words before saving.");
      setSaveState("error");
      return;
    }
    const savedId = await persistDraft(parsed.data, selectedEntryId, sessionId.current);
    if (savedId) {
      setMindUnload(false);
      setView("timeline");
    }
  }
  async function discardMindUnload() {
    if (!window.confirm("Discard this mind unload? This cannot be undone.")) return;
    if (saving.current) {
      setError("Let the last change finish saving, then discard it.");
      return;
    }
    if (selectedEntryId) {
      await removeEntry();
      return;
    }
    resetToNew();
  }

  const saveLabel = saveState === "saving"
    ? "Saving quietly…"
    : saveState === "error"
      ? "Couldn’t save · try again"
      : selectedEntryId && !dirty
        ? savedAt ? "Saved just now" : "All changes saved"
        : saveState === "saved"
          ? "Saved just now"
          : "Private draft";
  const isCalendarMonth = (date: Date) => date.getMonth() === calendarMonth.getMonth();

  return (
    <div className={"journal-studio" + (mindUnload ? " journal-studio-unload" : "")}>
      {!mindUnload ? (
        <motion.header
          animate={{ opacity: 1, y: 0 }}
          className="journal-heading journal-dear-me-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          transition={{ duration: 0.38 }}
        >
          <div>
            <span className="eyebrow">Your field journal · private by default</span>
            <h1 className="serif">A little story, kept in your own words.</h1>
            <p>Small moments, whole seasons, and everything in between.</p>
          </div>
          {user && <div className="journal-heading-actions">
            <button className="button-secondary" onClick={startMindUnload} type="button"><Moon size={16} /> Mind unload</button>
            <button className="button-primary journal-heading-new-page" onClick={() => startNewEntry()} type="button"><Plus size={15} /> New page</button>
          </div>}
        </motion.header>
      ) : (
        <header className="journal-unload-header">
          <div><span className="eyebrow">A little room to breathe</span><h1 className="serif">Let it out.</h1></div>
          <button className="button-secondary" onClick={() => setMindUnload(false)} type="button"><X size={15} /> Back to journal</button>
        </header>
      )}

      {notice && <p className="memory-notice journal-notice" role="status"><Check size={14} /> {notice}</p>}
      {error && <p className="memory-error journal-error" role="alert">{error}</p>}

      {loading ? (
        <div className="journal-workspace-empty" role="status"><LoaderCircle className="memory-spinner" size={20} /><p>Opening your private journal…</p></div>
      ) : !user ? (
        <div className="journal-workspace-empty"><BookHeart size={26} /><h2 className="serif">Sign in to open your journal.</h2><p>Your journal pages are private to your account.</p></div>
      ) : (
        <div className={"journal-layout" + (mindUnload ? " journal-layout-unload" : "")}>          {!mindUnload && <details className="journal-library">
            <summary className="journal-library-summary">
              <span className="journal-library-title"><BookHeart size={17} /> Your pages</span>
              <strong>{entries.length} {entries.length === 1 ? "page" : "pages"}</strong>
              <span className="journal-library-browse">Browse your journal</span>
              <ChevronDown className="journal-library-chevron" size={17} aria-hidden="true" />
            </summary>
            <aside aria-label="Find a journal page" className="journal-browse-panel">
            <div className="journal-browse-heading">
              <div><span className="eyebrow">Your pages</span><strong>{entries.length}</strong></div>
              <div className="journal-view-switch" role="group" aria-label="Page view">
                <button aria-pressed={view === "timeline"} className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")} type="button"><Clock3 size={14} /> Timeline</button>
                <button aria-pressed={view === "calendar"} className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")} type="button"><CalendarDays size={14} /> Calendar</button>
              </div>
            </div>
            {view === "calendar" ? (
              <section className="journal-calendar" aria-label="Journal calendar">
                <div className="journal-calendar-heading">
                  <button aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} type="button"><ChevronLeft size={16} /></button>
                  <h2>{monthLabel}</h2>
                  <button aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} type="button"><ChevronRight size={16} /></button>
                </div>
                <div className="journal-calendar-weekdays" aria-hidden="true">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={day + index}>{day}</span>)}</div>
                <div className="journal-calendar-grid">
                  {calendarDays.map((date) => {
                    const key = dateKey(date);
                    const hasEntry = datesWithEntries.has(key);
                    const selected = selectedDate === key;
                    return <button
                      aria-label={formatDate(key, { month: "long", day: "numeric", year: "numeric" }) + (hasEntry ? ", journal page saved" : "")}
                      aria-pressed={selected}
                      className={"journal-calendar-day" + (!isCalendarMonth(date) ? " outside" : "") + (selected ? " selected" : "") + (hasEntry ? " has-entry" : "")}
                      key={key}
                      onClick={() => handleCalendarDate(date)}
                      type="button"
                    >
                      {date.getDate()}
                      {hasEntry && <i aria-hidden="true" />}
                    </button>;
                  })}
                </div>
                <p className="journal-calendar-hint">A small dot marks a day with a saved page.</p>
              </section>
            ) : (
              <>
                <label className="journal-search"><Search size={15} /><span className="sr-only">Search journal pages</span><input onChange={(event) => setSearchText(event.target.value)} placeholder="Search your words or tags" value={searchText} /></label>
                <div className="journal-entry-list" aria-label="Journal timeline">
                  {visibleEntries.length ? visibleEntries.map((entry) => (
                    <button
                      aria-current={selectedEntryId === entry.id ? "page" : undefined}
                      className={"journal-entry-item" + (selectedEntryId === entry.id ? " active" : "")}
                      key={entry.id}
                      onClick={() => openEntry(entry)}
                      type="button"
                    >
                      <span className="journal-entry-item-date">{formatDate(entry.entryDate, { month: "short", day: "numeric" })}<i>{entry.mood ? moodSymbols[entry.mood] : ""}</i></span>
                      <span className="journal-entry-item-copy">
                        <strong>{entry.title.trim() || "A page from " + formatDate(entry.entryDate, { month: "long", day: "numeric" })}</strong>
                        <small>{entry.body.slice(0, 78) || "A quiet moment, kept."}</small>
                        {(entry.tags ?? []).length > 0 && <span className="journal-entry-item-tags">{entry.tags?.slice(0, 3).join(" · ")}</span>}
                      </span>
                    </button>
                  )) : (
                    <div className="journal-entry-empty"><BookHeart size={19} /><p>{entries.length ? "No pages match that search yet." : "Your pages will gather here, one at a time."}</p></div>
                  )}
                </div>
                <button className="journal-new-from-list" onClick={() => startNewEntry()} type="button"><Plus size={15} /> Write a page</button>
              </>
            )}
          </aside>
          </details>}

          <form className="journal-editor" onSubmit={(event) => void saveEntry(event)}>
            {mindUnload && <div className="journal-unload-note"><span>Nothing needs to be polished. Just begin.</span><span>{saveLabel}</span></div>}
            {!mindUnload && <div className="journal-editor-topline">
              <span>{selectedEntryId ? "A page from your journal" : "A new page, whenever you’re ready"}</span>
              <span className={"journal-save-status" + (saveState === "error" ? " error" : "")}>
                {saveState === "saving" ? <LoaderCircle className="memory-spinner" size={14} /> : saveState === "saved" || (selectedEntryId && !dirty) ? <Check size={14} /> : <span className="journal-save-dot" />}
                {saveLabel}
                {savedAt && saveState !== "saving" && <time dateTime={savedAt.toISOString()}>{savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>}
              </span>
            </div>}

            <div className="journal-entry-fields">
              {!mindUnload && <label className="journal-title-field"><span className="sr-only">Optional page title</span><input
                autoComplete="off"
                aria-label="Optional page title"
                maxLength={120}
                onChange={(event) => setDraftValue("title", event.target.value)}
                placeholder="Give today a name, if one comes to mind"
                value={draft.title}
              /></label>}

              {!mindUnload && <div className="journal-mood-row">
                <span className="journal-field-label">How are you holding this moment?</span>
                <div className="journal-mood-options" role="group" aria-label="Choose an optional mood">
                  {memoryMoodValues.map((mood) => <button
                    aria-pressed={draft.mood === mood}
                    className={"journal-mood-option" + (draft.mood === mood ? " active" : "")}
                    key={mood}
                    onClick={() => setDraftValue("mood", draft.mood === mood ? "" : mood)}
                    type="button"
                  ><span aria-hidden="true">{moodSymbols[mood]}</span>{memoryMoodLabels[mood]}</button>)}
                </div>
              </div>}

              {!mindUnload && <div className="journal-tag-editor">
                <span className="journal-field-label">Keep a few words for finding this later</span>
                <div className="journal-tag-row">
                  {draft.tags.map((tag) => <span className="journal-tag" key={tag}>{tag}<button aria-label={"Remove tag " + tag} onClick={() => removeTag(tag)} type="button"><X size={12} /></button></span>)}
                  {draft.tags.length < 12 && <input
                    aria-label="Add a journal tag"
                    maxLength={30}
                    onBlur={() => { if (tagText.trim()) addTags(); }}
                    onChange={(event) => setTagText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addTags();
                      }
                    }}
                    placeholder={draft.tags.length ? "Add another tag…" : "Try “friendship” or “new beginnings”"}
                    value={tagText}
                  />}
                </div>
              </div>}
            </div>

            {!mindUnload && <div className="journal-prompts">
              <Sparkles size={15} />
              <span>{writingPrompts[promptIndex % writingPrompts.length]}</span>
              <button onClick={insertPrompt} type="button">Use this prompt</button>
              <button aria-label="Show another writing prompt" onClick={() => setPromptIndex((index) => index + 1)} type="button"><ChevronRight size={15} /></button>
            </div>}

            {!mindUnload && <div className="journal-format-toolbar" role="toolbar" aria-label="Text formatting">
              <button aria-label="Bold" onClick={() => insertFormat("**")} type="button"><Bold size={16} /></button>
              <button aria-label="Italic" onClick={() => insertFormat("*")} type="button"><Italic size={16} /></button>
              <button aria-label="Quote" onClick={() => insertFormat("> ", "", true)} type="button"><Quote size={16} /></button>
              <button aria-label="Bullet list" onClick={() => insertFormat("- ", "", true)} type="button"><List size={16} /></button>
              <span>Basic Markdown formatting</span>
              <button className="journal-preview-toggle" aria-pressed={preview} onClick={() => setPreview((current) => !current)} type="button">{preview ? <PenLine size={15} /> : <Eye size={15} />}{preview ? "Write" : "Preview"}</button>
            </div>}
            <div className={"journal-writing-surface" + (mindUnload ? " journal-writing-surface-unload" : "")}>
              {!mindUnload && <>
                <StationeryDecorationLayer tapeId={draft.tapeId} textureId={draft.textureId} />
                <StationeryPageDecorations
                  key={selectedEntryId ?? "new-journal-entry"}
                  disabled={!selectedEntryId}
                  legacyDecorationIds={selectedEntry?.decorationIds ?? []}
                  onPlaced={() => { setPendingDecorationId(null); setNotice("Your keepsake is in place."); }}
                  onCancelPlacement={() => setPendingDecorationId(null)}
                  pendingAssetId={pendingDecorationId}
                  target={selectedEntryId ? { kind: "journal-entry", entryId: selectedEntryId } : null}
                />
              </>}
              {preview && !mindUnload ? (
                <div className="journal-markdown-preview" aria-label="Writing preview">{markdownPreview(draft.body)}</div>
              ) : (
                <textarea
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  autoFocus={mindUnload}
                  className="journal-body-input"
                  maxLength={12000}
                  onChange={(event) => setDraftValue("body", event.target.value)}
                  placeholder={mindUnload ? "Start wherever your mind is. No title, no mood, no tidy ending needed." : "What happened today? What did it feel like from the inside?"}
                  ref={bodyRef}
                  value={draft.body}
                  spellCheck
                />
              )}
              <div className="journal-writing-footer">
                <span>{mindUnload ? "This space belongs only to you." : "Private by default"}</span>
                <span>{draft.body.length.toLocaleString()} / 12,000</span>
              </div>
            </div>

            {entryPhotos.length > 0 && selectedEntryId && <div className="journal-photos-strip" aria-label="Photos attached to this entry">
              {entryPhotos.map((photo, index) => <div className="journal-photo-thumb" key={photo.publicId}>
                <Image
                  alt={"Photo attached to journal entry, " + String(index + 1)}
                  height={110}
                  src={"/api/journal/photos?" + new URLSearchParams({ entryId: selectedEntryId, publicId: photo.publicId }).toString()}
                  unoptimized
                  width={140}
                />
                <button aria-label={"Remove attached photo " + String(index + 1)} disabled={photoPending} onClick={() => void removePhoto(photo)} type="button"><Trash2 size={13} /></button>
              </div>)}
            </div>}

            {!mindUnload && <details className="journal-keepsakes">
              <summary><Images size={15} /> Optional keepsakes <span>Photos and paper touches, if you want them</span></summary>
              <div className="journal-keepsakes-content">
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
                <span className="journal-keepsakes-hint">{entryPhotos.length}/10 photos · JPG, PNG, WebP up to 8 MB</span>
                {!selectedEntryId && <p className="journal-keepsakes-hint">Write a little first so the page can save.</p>}
                <StationeryPicker
                  disabled={!selectedEntryId}
                  onAddDecoration={addDecoration}
                  pendingDecorationId={pendingDecorationId}
                  onCancelPlacement={() => setPendingDecorationId(null)}
                  onTapeChange={(value) => setDraftValue("tapeId", value)}
                  onTextureChange={(value) => setDraftValue("textureId", value)}
                  tapeId={draft.tapeId}
                  textureId={draft.textureId}
                />
              </div>
            </details>}

            <div className="journal-editor-actions">
              {!mindUnload ? <button className="button-primary journal-save-button" disabled={pending !== null || saveState === "saving" || (!dirty && selectedEntryId !== null) || !draft.body.trim()} type="submit">
                {saveState === "saving" ? <LoaderCircle className="memory-spinner" size={15} /> : saveState === "saved" ? <Check size={15} /> : <Save size={15} />}
                {saveState === "saving" ? "Saving…" : saveState === "error" ? "Try saving again" : selectedEntryId ? "Save now" : "Save this page"}
              </button> : <>
                <button className="button-primary journal-save-button" disabled={saveState === "saving" || !draft.body.trim()} onClick={() => void saveMindUnloadAsPage()} type="button"><Check size={15} /> Save as a journal page</button>
                <button className="journal-discard-button" disabled={saveState === "saving" || pending === "delete"} onClick={() => void discardMindUnload()} type="button"><Trash2 size={14} /> Discard writing</button>
              </>}
              {!mindUnload && selectedEntryId && !deleteConfirm && <button className="journal-delete-entry" disabled={pending !== null || saveState === "saving"} onClick={() => setDeleteConfirm(true)} type="button"><Trash2 size={14} /> Delete page</button>}
            </div>

            <AnimatePresence>
              {!mindUnload && deleteConfirm && (
                <motion.div animate={{ opacity: 1, y: 0 }} className="journal-delete-confirmation" exit={{ opacity: 0, y: 5 }} initial={reduceMotion ? false : { opacity: 0, y: 5 }}>
                  <p>Delete this journal page for good? This can’t be undone.</p>
                  <div><button className="button-secondary" disabled={pending !== null} onClick={() => setDeleteConfirm(false)} type="button">Keep page</button><button className="journal-delete-entry" disabled={pending !== null} onClick={() => void removeEntry()} type="button">{pending === "delete" ? <LoaderCircle className="memory-spinner" size={13} /> : <Trash2 size={13} />}{pending === "delete" ? "Deleting…" : "Delete"}</button></div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      )}
    </div>
  );
}