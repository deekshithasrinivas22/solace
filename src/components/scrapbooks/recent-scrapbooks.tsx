"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen, LoaderCircle, Sparkles } from "lucide-react";
import { subscribeToScrapbooks } from "@/lib/firebase/scrapbooks";
import { useAuthStore } from "@/stores/auth-store";
import { scrapbookCoverLabels, type Scrapbook } from "@/types/scrapbook";

function updatedLabel(value: unknown) {
  if (typeof value !== "object" || value === null || !("toDate" in value)) return "Just started";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    (value as { toDate: () => Date }).toDate(),
  );
}

export function RecentScrapbooks() {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const reduceMotion = useReducedMotion() ?? false;
  const [books, setBooks] = useState<Scrapbook[]>([]);
  const [loadedForUid, setLoadedForUid] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToScrapbooks(
      user.uid,
      (nextBooks) => {
        setBooks(nextBooks);
        setLoadError(false);
        setLoadedForUid(user.uid);
      },
      (error) => {
        console.error("Solace recent scrapbooks failed to load:", error);
        setBooks([]);
        setLoadError(true);
        setLoadedForUid(user.uid);
      },
      3,
    );
  }, [user]);

  if (authLoading || (user && loadedForUid !== user.uid)) {
    return <div className="recent-loading"><LoaderCircle className="memory-spinner" size={17} /> Opening your shelf…</div>;
  }

  const visibleBooks = user && loadedForUid === user.uid ? books : [];

  if (loadError) return <p className="memory-error" role="status">Your scrapbooks couldn’t be gathered just now.</p>;

  if (!visibleBooks.length) {
    return (
      <div className="empty-state recent-empty">
        <span className="empty-state-icon"><Sparkles size={19} strokeWidth={1.5} /></span>
        <strong>Your first scrapbook is waiting.</strong>
        <p>Give a season, trip, or friendship its own little book.</p>
        <Link className="recent-create-link" href="/scrapbooks">Start a scrapbook <ArrowRight size={14} /></Link>
      </div>
    );
  }

  return (
    <div className="recent-scrapbook-list">
      {visibleBooks.map((book, index) => (
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          initial={reduceMotion ? false : { opacity: 0, x: -8 }}
          key={book.id}
          transition={{ duration: 0.28, delay: reduceMotion ? 0 : index * 0.07 }}
        >
          <Link className="recent-scrapbook-item" href={`/scrapbooks/${book.id}`}>
            <span className={`recent-scrapbook-cover recent-scrapbook-cover-${book.cover}`}><BookOpen size={16} /></span>
            <span className="recent-memory-copy"><strong>{book.title}</strong><span>{scrapbookCoverLabels[book.cover]} · {updatedLabel(book.updatedAt)}</span></span>
            <ArrowRight className="recent-memory-arrow" size={15} />
          </Link>
        </motion.div>
      ))}
      <Link className="recent-view-all" href="/scrapbooks">Visit your scrapbook shelf <ArrowRight size={14} /></Link>
    </div>
  );
}
