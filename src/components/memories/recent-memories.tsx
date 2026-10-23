"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Heart, LoaderCircle, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { subscribeToMemories } from "@/lib/firebase/memories";
import { useAuthStore } from "@/stores/auth-store";
import { memoryMoodLabels, type Memory, type MemoryMood } from "@/types/memory";

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value + "T12:00:00"));
}

export function RecentMemories() {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const reduceMotion = useReducedMotion() ?? false;
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadedForUid, setLoadedForUid] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToMemories(
      user.uid,
      (nextMemories) => {
        setMemories(nextMemories);
        setLoadError(false);
        setLoadedForUid(user.uid);
      },
      () => {
        setMemories([]);
        setLoadError(true);
        setLoadedForUid(user.uid);
      },
      3,
    );
  }, [user]);

  if (authLoading || (user && loadedForUid !== user.uid)) {
    return <div className="recent-loading"><LoaderCircle size={17} className="memory-spinner" /> Gathering your moments…</div>;
  }

  if (!user) {
    return (
      <div className="empty-state recent-empty">
        <span className="empty-state-icon"><Sparkles size={19} strokeWidth={1.5} /></span>
        <strong>Your memories are waiting.</strong>
        <p>Sign in to revisit the moments you have kept.</p>
      </div>
    );
  }

  if (loadError) {
    return <p className="memory-error" role="status">Your recent moments couldn’t be gathered just now.</p>;
  }

  const visibleMemories = loadedForUid === user.uid ? memories : [];

  if (!visibleMemories.length) {
    return (
      <div className="empty-state recent-empty">
        <span className="empty-state-icon"><Sparkles size={19} strokeWidth={1.5} /></span>
        <strong>Your first story will live here.</strong>
        <p>Save a moment, and it will be waiting when you return.</p>
        <Link className="recent-create-link" href="/memories">Keep your first memory <ArrowRight size={14} /></Link>
      </div>
    );
  }

  return (
    <div className="recent-memory-list">
      {visibleMemories.map((memory, index) => (
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          initial={reduceMotion ? false : { opacity: 0, x: -8 }}
          key={memory.id}
          transition={{ duration: 0.28, delay: reduceMotion ? 0 : index * 0.07 }}
        >
          <Link className="recent-memory-item" href="/memories">
            <span className={"recent-memory-gem recent-memory-gem-" + ((index % 3) + 1)}><Heart size={15} /></span>
            <span className="recent-memory-copy">
              <strong>{memory.title}</strong>
              <span><CalendarDays size={12} /> {shortDate(memory.memoryDate)}{memory.mood ? " · " + memoryMoodLabels[memory.mood as MemoryMood] : ""}</span>
            </span>
            <ArrowRight className="recent-memory-arrow" size={15} />
          </Link>
        </motion.div>
      ))}
      <Link className="recent-view-all" href="/memories">Visit your memory shelf <ArrowRight size={14} /></Link>
    </div>
  );
}
