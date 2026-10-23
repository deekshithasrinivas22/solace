"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Hourglass, LoaderCircle, LockKeyhole, Plus, Sparkles, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import type { TimeCapsule } from "@/types/capsule";

function localDateTime(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultUnlockInput() {
  return localDateTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
}

function formattedUnlock(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function countdown(value: string, now: number) {
  const seconds = Math.max(0, Math.floor((new Date(value).getTime() - now) / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h to go`;
  if (hours) return `${hours}h ${minutes}m to go`;
  return `${Math.max(1, minutes)}m to go`;
}

export function TimeCapsuleStudio() {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const reduceMotion = useReducedMotion() ?? false;
  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [unlockAt, setUnlockAt] = useState(defaultUnlockInput);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);
  const [loadedForUid, setLoadedForUid] = useState("");
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/capsules", {
          headers: { Authorization: "Bearer " + idToken },
          cache: "no-store",
        });
        const result = await response.json() as { capsules?: TimeCapsule[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Your time capsules couldn’t open.");
        if (!cancelled) {
          setCapsules(Array.isArray(result.capsules) ? result.capsules : []);
          setNow(Date.now());
          setLoadedForUid(user.uid);
          setError("");
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Your time capsules couldn’t open.");
          setLoading(false);
        }
      }
    };
    void refresh();
    refreshTimer.current = setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 30_000);
    return () => {
      cancelled = true;
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [authLoading, user]);

  async function saveCapsule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!user) {
      setError("Sign in again before saving a capsule.");
      return;
    }
    const revealTime = new Date(unlockAt);
    if (Number.isNaN(revealTime.getTime()) || revealTime.getTime() <= Date.now() + 60_000) {
      setError("Choose a reveal time at least one minute from now.");
      return;
    }

    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/capsules", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
        body: JSON.stringify({ title, message, unlockAt: revealTime.toISOString() }),
      });
      const result = await response.json() as { capsule?: TimeCapsule; error?: string };
      if (!response.ok || !result.capsule) throw new Error(result.error ?? "This capsule couldn’t be saved.");
      setCapsules((current) => [...current, result.capsule!].sort((left, right) => left.unlockAt.localeCompare(right.unlockAt)));
      setTitle("");
      setMessage("");
      setUnlockAt(defaultUnlockInput());
      setNotice("Sealed away. Your note will wait for the right day.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "This capsule couldn’t be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCapsule(capsule: TimeCapsule) {
    if (!user) return;
    setDeletingId(capsule.id);
    setError("");
    setNotice("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/capsules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
        body: JSON.stringify({ id: capsule.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "This capsule couldn’t be removed.");
      setCapsules((current) => current.filter((item) => item.id !== capsule.id));
      setNotice("That capsule has been removed.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "This capsule couldn’t be removed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="capsule-studio">
      <motion.header
        animate={{ opacity: 1, y: 0 }}
        className="capsule-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        transition={{ duration: 0.42 }}
      >
        <div>
          <span className="eyebrow">A note for your future self</span>
          <h1 className="serif">Save a little something for later.</h1>
          <p>Write down what matters now. Solace keeps it sealed until the moment you choose.</p>
        </div>
        <div aria-hidden="true" className="capsule-heading-art"><Hourglass size={56} strokeWidth={1.1} /><Sparkles className="capsule-art-sparkle" size={19} /></div>
      </motion.header>

      {notice && <p className="memory-notice capsule-notice" role="status"><Check size={14} /> {notice}</p>}
      {error && <p className="memory-error" role="alert">{error}</p>}

      {authLoading || Boolean(user && (loading || loadedForUid !== user.uid)) ? (
        <div className="capsule-loading" role="status"><LoaderCircle className="memory-spinner" size={19} /> Opening your time capsules…</div>
      ) : !user ? (
        <section className="capsule-empty"><LockKeyhole size={24} /><h2 className="serif">Sign in to leave a note for later.</h2><p>Your capsules are private to your account.</p></section>
      ) : (
        <div className="capsule-layout">
          <form className="capsule-compose-card" onSubmit={(event) => void saveCapsule(event)}>
            <div className="capsule-compose-heading"><span className="eyebrow">Make a capsule</span><h2 className="serif">What do you want to remember?</h2></div>
            <label className="memory-field"><span>A title for later</span><input autoComplete="off" maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="The first week of summer" required value={title} /></label>
            <label className="memory-field"><span>Your note</span><textarea autoCapitalize="sentences" autoCorrect="on" maxLength={12000} onChange={(event) => setMessage(event.target.value)} placeholder="What do you hope future-you remembers?" required rows={7} spellCheck value={message} /></label>
            <label className="memory-field"><span>Open it on</span><input min={now ? localDateTime(new Date(now + 60_000)) : undefined} onChange={(event) => setUnlockAt(event.target.value)} required type="datetime-local" value={unlockAt} /></label>
            <p className="capsule-privacy-note"><LockKeyhole size={14} /> Your note stays hidden. Solace checks the unlock time on its server before showing it.</p>
            <button className="button-primary capsule-save-button" disabled={saving} type="submit">
              {saving ? <LoaderCircle className="memory-spinner" size={15} /> : <Plus size={15} />}
              {saving ? "Sealing your note…" : "Seal this capsule"}
            </button>
          </form>

          <section aria-label="Your saved time capsules" className="capsule-shelf">
            <div className="capsule-shelf-heading"><div><span className="eyebrow">Waiting for their day</span><h2 className="serif">Your time capsules</h2></div><span>{capsules.length}</span></div>
            {capsules.length === 0 ? (
              <div className="capsule-empty"><Hourglass size={23} /><h3 className="serif">Nothing sealed away yet.</h3><p>Leave a note for a future birthday, after finals, or just a random Tuesday.</p></div>
            ) : (
              <div className="capsule-list">
                <AnimatePresence initial={false}>
                  {capsules.map((capsule, index) => (
                    <motion.article
                      animate={{ opacity: 1, y: 0 }}
                      className={`capsule-card${capsule.isUnlocked ? " is-unlocked" : " is-locked"}`}
                      exit={{ opacity: 0, y: 8 }}
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      key={capsule.id}
                      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.2) }}
                    >
                      <div className="capsule-card-topline">
                        <span>{capsule.isUnlocked ? <Sparkles size={13} /> : <LockKeyhole size={13} />}{capsule.isUnlocked ? "Ready to open" : "Still sealed"}</span>
                        <button aria-label={`Delete ${capsule.title}`} disabled={deletingId === capsule.id} onClick={() => void deleteCapsule(capsule)} type="button">
                          {deletingId === capsule.id ? <LoaderCircle className="memory-spinner" size={13} /> : <Trash2 size={13} />}
                        </button>
                      </div>
                      <h3 className="serif">{capsule.title}</h3>
                      <p className="capsule-date">{capsule.isUnlocked ? "Opened " : "Opens "}{formattedUnlock(capsule.unlockAt)}</p>
                      {capsule.isUnlocked ? (
                        <div className="capsule-revealed-note">{capsule.message}</div>
                      ) : (
                        <p className="capsule-countdown">{countdown(capsule.unlockAt, now)}</p>
                      )}
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
