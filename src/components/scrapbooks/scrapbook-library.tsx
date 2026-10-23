"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { createScrapbook, subscribeToScrapbooks } from "@/lib/firebase/scrapbooks";
import { scrapbookInputSchema } from "@/lib/validations/scrapbook";
import { coverArtworkCatalog, decorationCatalog } from "@/lib/stationery/assets";
import { ScrapbookCoverArtPicker } from "@/components/scrapbooks/cover-art-picker";
import {
  scrapbookCoverLabels,
  scrapbookCoverValues,
  type Scrapbook,
  type ScrapbookCover,
  type ScrapbookInput,
} from "@/types/scrapbook";
import type { ScrapbookCoverArtwork } from "@/types/stationery";

function scrapbookErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code.endsWith("failed-precondition")) return "Firestore needs the scrapbook shelf index. Deploy the updated Firestore indexes, then refresh this page.";
  if (code === "permission-denied") return "Firestore wouldn’t open this shelf. Check that the latest scrapbook rules are deployed.";
  if (code === "unavailable") return "Solace can’t reach Firestore right now. Check your connection and try again.";
  if (code.endsWith("unauthenticated")) return "Your sign-in expired. Sign out, sign in again, and reopen the shelf.";
  return `Your scrapbook shelf couldn’t open${code ? ` (Firebase: ${code})` : ""}. Refresh the page and try again.`;
}

function dateLabel(value: unknown) {
  if (typeof value !== "object" || value === null || !("toDate" in value)) return "A new little world";
  const date = (value as { toDate: () => Date }).toDate();
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

export function ScrapbookLibrary() {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const [books, setBooks] = useState<Scrapbook[]>([]);
  const [loadedForUid, setLoadedForUid] = useState("");
  const [loadError, setLoadError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToScrapbooks(
      user.uid,
      (nextBooks) => {
        setBooks(nextBooks);
        setLoadError("");
        setLoadedForUid(user.uid);
      },
      (error) => {
        console.error("Solace scrapbook shelf failed to load:", error);
        setLoadError(scrapbookErrorMessage(error));
        setLoadedForUid(user.uid);
      },
    );
  }, [user]);

  async function handleCreate(input: ScrapbookInput) {
    if (!user) throw new Error("Sign in again to create your scrapbook.");
    const created = await createScrapbook(user.uid, input);
    setComposerOpen(false);
    router.push(`/scrapbooks/${created.id}`);
  }

  const loading = authLoading || Boolean(user && loadedForUid !== user.uid);

  return (
    <div className="scrapbook-library">
      <motion.header
        className="scrapbook-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div>
          <span className="eyebrow">Your scrapbook studio</span>
          <h1 className="serif">Little worlds, made by you.</h1>
          <p>Gather a trip, a season, or a friendship into pages you can open again.</p>
        </div>
        <button className="button-primary" onClick={() => setComposerOpen(true)} type="button">
          <Plus size={17} /> Start a scrapbook
        </button>
      </motion.header>

      <section className="scrapbook-studio-hero" aria-label="Scrapbook studio">
        <div className="scrapbook-hero-copy">
          <span><Sparkles size={14} /> A keepsake in the making</span>
          <h2 className="serif">Collect the pieces that feel like a chapter.</h2>
          <p>Choose the paper, arrange a page, and give a favorite memory a place to live.</p>
        </div>
        <div className="scrapbook-hero-art" aria-hidden="true">
          <span className="scrapbook-hero-glow" />
          <span className="scrapbook-hero-book scrapbook-hero-book-back" />
          <span className="scrapbook-hero-book scrapbook-hero-book-front"><BookOpen size={42} strokeWidth={1.1} /></span>
          <Image alt="" className="scrapbook-hero-cassette" height={220} src={decorationCatalog["cassette-01"].src} width={300} />
          <span className="scrapbook-hero-star scrapbook-hero-star-one">✦</span>
          <span className="scrapbook-hero-star scrapbook-hero-star-two">✧</span>
        </div>
      </section>

      <div className="scrapbook-shelf-heading">
        <div><span className="eyebrow">Made by you</span><h2 className="serif">Your shelf</h2></div>
        {books.length > 0 && <span>{books.length} {books.length === 1 ? "scrapbook" : "scrapbooks"}</span>}
      </div>

      {loading ? (
        <div className="scrapbook-loading" role="status"><LoaderCircle className="memory-spinner" size={20} /> Opening your shelf…</div>
      ) : !user ? (
        <div className="scrapbook-empty"><BookOpen size={24} /><h2 className="serif">Your shelf is waiting.</h2><p>Sign in to open your scrapbook studio.</p></div>
      ) : loadError ? (
        <p className="memory-error" role="alert">{loadError}</p>
      ) : books.length === 0 ? (
        <div className="scrapbook-empty">
          <span className="scrapbook-empty-sparkle"><Sparkles size={22} /></span>
          <h2 className="serif">A blank page is full of possibility.</h2>
          <p>Start with a trip, a favorite season, or the people who make life feel like home.</p>
          <button className="button-primary" onClick={() => setComposerOpen(true)} type="button"><Plus size={16} /> Make your first scrapbook</button>
        </div>
      ) : (
        <div className="scrapbook-grid">
          {books.map((book, index) => (
            <motion.article
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              className="scrapbook-shelf-card"
              initial={reduceMotion ? false : { opacity: 0, y: 14, rotate: index % 2 ? 0.5 : -0.5 }}
              key={book.id}
              transition={{ duration: 0.38, delay: reduceMotion ? 0 : Math.min(index * 0.06, 0.3) }}
            >
              <Link className="scrapbook-card-link" href={`/scrapbooks/${book.id}`}>
                <div className={`scrapbook-cover-art scrapbook-cover-${book.cover}`}>
                  <span className="scrapbook-cover-tape" />
                  <span className="scrapbook-cover-orbit" />
                  <span className="scrapbook-cover-glyph">✦</span>
                  <div className="scrapbook-cover-copy">
                    <span className="scrapbook-cover-small">A SOLACE KEEPSAKE</span>
                    <strong className="serif scrapbook-cover-title">{book.title}</strong>
                    <span className="scrapbook-cover-label">{scrapbookCoverLabels[book.cover]}</span>
                  </div>
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="scrapbook-cover-photo"
                    height={250}
                    src={coverArtworkCatalog[book.coverArtwork ?? "polaroid-01"].src}
                    width={250}
                  />
                </div>
                <div className="scrapbook-card-meta">
                  <span>{dateLabel(book.updatedAt)}</span><span>Open studio <ArrowRight size={14} /></span>
                </div>
                {book.description && <p>{book.description}</p>}
              </Link>
            </motion.article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {composerOpen && <ScrapbookComposer onClose={() => setComposerOpen(false)} onCreate={handleCreate} />}
      </AnimatePresence>
    </div>
  );
}

function ScrapbookComposer({ onClose, onCreate }: { onClose: () => void; onCreate: (input: ScrapbookInput) => Promise<void> }) {
  const reduceMotion = useReducedMotion() ?? false;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<ScrapbookCover>("starlight");
  const [coverArtwork, setCoverArtwork] = useState<ScrapbookCoverArtwork>("polaroid-01");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = scrapbookInputSchema.safeParse({ title, description, cover, coverArtwork });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the scrapbook details and try again.");
      return;
    }
    setPending(true);
    try {
      await onCreate(parsed.data);
    } catch (createError) {
      setError(scrapbookErrorMessage(createError));
    } finally {
      setPending(false);
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
        aria-labelledby="scrapbook-create-title"
        aria-modal="true"
        className="scrapbook-modal"
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        initial={reduceMotion ? false : { opacity: 0, y: 15, scale: 0.98 }}
        role="dialog"
        transition={{ duration: 0.22 }}
      >
        <div className="scrapbook-modal-heading">
          <div><span className="eyebrow">A new little world</span><h2 className="serif" id="scrapbook-create-title">Name your scrapbook.</h2></div>
          <button aria-label="Close" className="memory-close-button" disabled={pending} onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form className="scrapbook-form" onSubmit={submit}>
          <label className="memory-field"><span>Scrapbook title <small>appears on the cover and your shelf</small></span><input autoFocus maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="A summer by the sea" required value={title} /></label>
          <label className="memory-field"><span>A note for the cover <small>optional</small></span><textarea maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="The people, places, and small details inside…" rows={3} value={description} /></label>
          <label className="memory-field"><span>Choose a cover mood</span><select onChange={(event) => setCover(event.target.value as ScrapbookCover)} value={cover}>{scrapbookCoverValues.map((value) => <option key={value} value={value}>{scrapbookCoverLabels[value]}</option>)}</select></label>
          <ScrapbookCoverArtPicker onChange={setCoverArtwork} value={coverArtwork} />
          {error && <p className="memory-error" role="alert">{error}</p>}
          <div className="scrapbook-form-actions"><button className="button-secondary" disabled={pending} onClick={onClose} type="button">Let it wait</button><button className="button-primary" disabled={pending} type="submit">{pending ? <LoaderCircle className="memory-spinner" size={16} /> : <Sparkles size={16} />}{pending ? "Making your scrapbook…" : "Create scrapbook"}</button></div>
        </form>
      </motion.section>
    </motion.div>
  );
}
