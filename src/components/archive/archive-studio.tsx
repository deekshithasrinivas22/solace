"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Heart,
  LoaderCircle,
  MapPin,
  Search,
  Sparkles,
  Tag,
} from "lucide-react";
import { getMemoryArchivePage, type MemoryArchiveCursor } from "@/lib/firebase/memories";
import { subscribeToScrapbookPages, subscribeToScrapbooks } from "@/lib/firebase/scrapbooks";
import { useAuthStore } from "@/stores/auth-store";
import { memoryMoodLabels, memoryMoodValues, type Memory, type MemoryMood } from "@/types/memory";
import type { Scrapbook, ScrapbookPage } from "@/types/scrapbook";

type ArchiveView = "timeline" | "calendar";

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${value}T12:00:00`));
}

function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

const noSubscription = () => () => {};
const currentDateKey = () => dateKey(new Date());
const serverDateKey = () => "";

function memoryPhotoUrl(memory: Memory) {
  const photo = memory.photos?.[0];
  if (!photo) return "";
  const query = new URLSearchParams({ memoryId: memory.id, publicId: photo.publicId });
  return `/api/memories/photos?${query.toString()}`;
}

function errorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
  if (code === "permission-denied" || code === "unauthenticated") return "Your sign-in expired. Sign out and back in, then reopen the archive.";
  if (code === "failed-precondition") return "Firestore needs its memory date index. Deploy the latest Solace indexes, then refresh.";
  if (code === "unavailable" || code === "network-request-failed") return "The archive couldn’t reach Firestore. Check your connection and try again.";
  return "Your archive couldn’t open. Refresh the page and try again.";
}

function isMilestone(memory: Memory) {
  return memory.tags?.some((tag) => tag.trim().toLowerCase() === "milestone") ?? false;
}

export function ArchiveStudio() {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const reduceMotion = useReducedMotion() ?? false;
  const userId = user?.uid ?? "";
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesForUid, setMemoriesForUid] = useState("");
  const [loadedForUid, setLoadedForUid] = useState("");
  const [cursor, setCursor] = useState<MemoryArchiveCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [errorForUid, setErrorForUid] = useState("");
  const [scrapbooks, setScrapbooks] = useState<Scrapbook[]>([]);
  const [scrapbooksForUid, setScrapbooksForUid] = useState("");
  const [scrapbookError, setScrapbookError] = useState("");
  const [scrapbookErrorKey, setScrapbookErrorKey] = useState("");
  const [scrapbookFilter, setScrapbookFilter] = useState("");
  const [bookMemoryIds, setBookMemoryIds] = useState<Set<string> | null>(null);
  const [pagesForScrapbookId, setPagesForScrapbookId] = useState("");
  const [scrapbookFilterForUid, setScrapbookFilterForUid] = useState("");
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<MemoryMood | "">("");
  const [tagFilter, setTagFilter] = useState("");
  const [milestonesOnly, setMilestonesOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [view, setView] = useState<ArchiveView>("timeline");
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [calendarDay, setCalendarDay] = useState("");

  useEffect(() => {
    if (!userId) return;

    let active = true;
    getMemoryArchivePage(userId).then((page) => {
      if (!active) return;
      setMemories(page.memories);
      setMemoriesForUid(userId);
      setCursor(page.nextCursor);
      setHasMore(Boolean(page.nextCursor));
      setError("");
      setErrorForUid(userId);
      setLoadedForUid(userId);
    }).catch((loadError: unknown) => {
      if (!active) return;
      console.error("Solace archive failed to load:", loadError);
      setError(errorMessage(loadError));
      setErrorForUid(userId);
      setLoadedForUid(userId);
    });

    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToScrapbooks(
      userId,
      (books) => {
        setScrapbooks(books);
        setScrapbooksForUid(userId);
        setScrapbookError("");
        setScrapbookErrorKey("");
      },
      (loadError) => {
        console.error("Solace archive scrapbook filter failed to load:", loadError);
        setScrapbookError("Scrapbook filters couldn’t open right now.");
        setScrapbookErrorKey("list");
      },
    );
  }, [userId]);

  const activeScrapbooks = scrapbooksForUid === userId ? scrapbooks : [];
  const activeScrapbookFilter = scrapbookFilterForUid === userId && activeScrapbooks.some((book) => book.id === scrapbookFilter) ? scrapbookFilter : "";

  useEffect(() => {
    if (!userId || !activeScrapbookFilter) return;
    return subscribeToScrapbookPages(
      activeScrapbookFilter,
      (pages: ScrapbookPage[]) => {
        setBookMemoryIds(new Set(pages.map((page) => page.memoryId).filter(Boolean)));
        setPagesForScrapbookId(activeScrapbookFilter);
        setScrapbookError("");
        setScrapbookErrorKey("");
      },
      (loadError) => {
        console.error("Solace archive scrapbook pages failed to load:", loadError);
        setScrapbookError("That scrapbook’s linked memories couldn’t be loaded.");
        setScrapbookErrorKey(`book:${activeScrapbookFilter}`);
        setBookMemoryIds(new Set());
        setPagesForScrapbookId(activeScrapbookFilter);
      },
    );
  }, [activeScrapbookFilter, userId]);

  const pagesLoading = Boolean(activeScrapbookFilter && pagesForScrapbookId !== activeScrapbookFilter);
  const todayKey = useSyncExternalStore(noSubscription, currentDateKey, serverDateKey);
  const calendarMonth = useMemo(() => {
    const year = todayKey ? Number(todayKey.slice(0, 4)) : 2000;
    const month = todayKey ? Number(todayKey.slice(5, 7)) - 1 : 0;
    return new Date(year, month + calendarMonthOffset, 1);
  }, [calendarMonthOffset, todayKey]);
  const activeMemories = useMemo(() => memoriesForUid === userId ? memories : [], [memories, memoriesForUid, userId]);

  async function loadOlderMemories() {
    if (!userId || !cursor || loadingOlder) return;
    const requestedUserId = userId;
    setLoadingOlder(true);
    setError("");
    try {
      const page = await getMemoryArchivePage(userId, cursor);
      if (useAuthStore.getState().user?.uid !== requestedUserId) return;
      setError("");
      setErrorForUid(requestedUserId);
      setMemoriesForUid(requestedUserId);
      setMemories((current) => {
        const existingIds = new Set(current.map((memory) => memory.id));
        return [...current, ...page.memories.filter((memory) => !existingIds.has(memory.id))];
      });
      setCursor(page.nextCursor);
      setHasMore(Boolean(page.nextCursor));
    } catch (loadError) {
      if (useAuthStore.getState().user?.uid === requestedUserId) {
        setError(errorMessage(loadError));
        setErrorForUid(requestedUserId);
      }
    } finally {
      setLoadingOlder(false);
    }
  }

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    activeMemories.forEach((memory) => memory.tags?.forEach((tag) => {
      const normalized = tag.trim();
      if (normalized) tags.add(normalized);
    }));
    return [...tags].sort((left, right) => left.localeCompare(right));
  }, [activeMemories]);

  const visibleMemories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeMemories.filter((memory) => {
      const searchable = [
        memory.title,
        memory.description,
        memory.location,
        memoryMoodLabels[memory.mood as MemoryMood] ?? "",
        ...(memory.tags ?? []),
      ].join(" ").toLowerCase();
      if (term && !searchable.includes(term)) return false;
      if (moodFilter && memory.mood !== moodFilter) return false;
      if (tagFilter && !memory.tags?.some((tag) => tag.toLowerCase() === tagFilter.toLowerCase())) return false;
      if (milestonesOnly && !isMilestone(memory)) return false;
      if (startDate && memory.memoryDate < startDate) return false;
      if (endDate && memory.memoryDate > endDate) return false;
      if (activeScrapbookFilter && !bookMemoryIds?.has(memory.id)) return false;
      return true;
    });
  }, [activeMemories, activeScrapbookFilter, bookMemoryIds, endDate, milestonesOnly, moodFilter, search, startDate, tagFilter]);

  const milestoneMemories = activeMemories.filter(isMilestone);
  const onThisDayMemories = todayKey
    ? activeMemories.filter((memory) => memory.memoryDate.slice(5) === todayKey.slice(5) && memory.memoryDate.slice(0, 4) < todayKey.slice(0, 4))
    : [];

  const timelineGroups = useMemo(() => {
    const groups: { key: string; label: string; memories: Memory[] }[] = [];
    visibleMemories.forEach((memory) => {
      const key = memory.memoryDate.slice(0, 7);
      let group = groups.find((item) => item.key === key);
      if (!group) {
        group = { key, label: formatDate(`${key}-01`, { month: "long", year: "numeric" }), memories: [] };
        groups.push(group);
      }
      group.memories.push(memory);
    });
    return groups;
  }, [visibleMemories]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const firstVisibleDay = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => new Date(firstVisibleDay.getFullYear(), firstVisibleDay.getMonth(), firstVisibleDay.getDate() + index));
  }, [calendarMonth]);

  const calendarCounts = useMemo(() => {
    const counts = new Map<string, number>();
    visibleMemories.forEach((memory) => counts.set(memory.memoryDate, (counts.get(memory.memoryDate) ?? 0) + 1));
    return counts;
  }, [visibleMemories]);

  const calendarMemories = calendarDay
    ? visibleMemories.filter((memory) => memory.memoryDate === calendarDay)
    : visibleMemories.filter((memory) => memory.memoryDate.slice(0, 7) === `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`);

  function clearFilters() {
    setSearch("");
    setMoodFilter("");
    setTagFilter("");
    setMilestonesOnly(false);
    setStartDate("");
    setEndDate("");
    setScrapbookFilter("");
    setCalendarDay("");
  }

  function shiftCalendarMonth(amount: number) {
    setCalendarMonthOffset((offset) => offset + amount);
    setCalendarDay("");
  }

  function chooseCalendarDay(day: Date, key: string, outside: boolean) {
    if (outside && todayKey) {
      const todayYear = Number(todayKey.slice(0, 4));
      const todayMonth = Number(todayKey.slice(5, 7)) - 1;
      setCalendarMonthOffset((day.getFullYear() - todayYear) * 12 + day.getMonth() - todayMonth);
    }
    setCalendarDay((selected) => selected === key ? "" : key);
  }

  const loading = authLoading || Boolean(userId && loadedForUid !== userId);

  return (
    <div className="archive-studio">
      <motion.header
        className="archive-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="archive-heading-copy">
          <span className="eyebrow">Memory archive · a way back</span>
          <h1 className="serif">Find your way back.</h1>
          <p>Follow the dates, feelings, and little details that still mean something.</p>
          <Link className="archive-heading-link" href="/memories"><ArrowLeft size={14} /> Back to your memory shelf</Link>
        </div>
        <div aria-hidden="true" className="archive-heading-art">
          <span className="archive-orbit archive-orbit-one" />
          <span className="archive-orbit archive-orbit-two" />
          <span className="archive-art-sparkle">✦</span>
          <Archive size={64} strokeWidth={1.1} />
        </div>
      </motion.header>

      {error && errorForUid === userId && <p className="memory-error" role="alert">{error}</p>}
      {scrapbookError && ((scrapbookErrorKey === "list" && scrapbooksForUid === userId) || scrapbookErrorKey === `book:${activeScrapbookFilter}`) && <p className="archive-soft-error" role="status">{scrapbookError}</p>}

      {loading ? (
        <div className="archive-loading" role="status"><LoaderCircle className="memory-spinner" size={20} /> Gathering your memories…</div>
      ) : !user ? (
        <section className="archive-empty">
          <span className="archive-empty-icon"><Archive size={22} /></span>
          <h2 className="serif">Your archive is waiting.</h2>
          <p>Sign in to revisit the moments you’ve kept.</p>
        </section>
      ) : (
        <>
          <section className="archive-echoes" aria-label="Memory highlights">
            {onThisDayMemories.length > 0 && (
              <div className="archive-echo-card archive-on-this-day">
                <span className="archive-echo-icon"><Sparkles size={17} /></span>
                <div><span className="eyebrow">From another year</span><h2 className="serif">On this day, once.</h2>
                  <p>{onThisDayMemories[0]?.title} · {formatDate(onThisDayMemories[0]?.memoryDate ?? "2000-01-01", { year: "numeric" })}{onThisDayMemories.length > 1 ? ` and ${onThisDayMemories.length - 1} more` : ""}</p>
                </div>
                <button className="archive-echo-action" onClick={() => { clearFilters(); setView("timeline"); }} type="button">Revisit <ArrowRight size={14} /></button>
              </div>
            )}
            <button aria-pressed={milestonesOnly} className={`archive-echo-card archive-milestone-card${milestonesOnly ? " selected" : ""}`} disabled={!milestoneMemories.length} onClick={() => setMilestonesOnly(!milestonesOnly)} type="button">
              <span className="archive-echo-icon"><Heart size={17} /></span>
              <span><span className="eyebrow">Little landmarks</span><strong className="serif">Milestones</strong><small>{milestoneMemories.length ? `${milestoneMemories.length} tagged ${milestoneMemories.length === 1 ? "moment" : "moments"}` : "Tag a memory “milestone” to start your collection."}</small></span>
              <span aria-hidden="true" className="archive-milestone-count">{milestonesOnly ? "✓" : milestoneMemories.length}</span>
            </button>
          </section>

          <section aria-label="Search and filter the archive" className="archive-controls">
            <div className="archive-search-row">
              <label className="archive-search">
                <Search aria-hidden="true" size={17} />
                <span className="sr-only">Search memory titles, stories, places, and tags</span>
                <input onChange={(event) => setSearch(event.target.value)} placeholder="Search a title, place, or detail…" type="search" value={search} />
              </label>
              <div aria-label="Archive view" className="archive-view-switch" role="group">
                <button aria-pressed={view === "timeline"} className={view === "timeline" ? "active" : ""} onClick={() => { setView("timeline"); setCalendarDay(""); }} type="button"><Archive size={15} /> Timeline</button>
                <button aria-pressed={view === "calendar"} className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")} type="button"><CalendarDays size={15} /> Calendar</button>
              </div>
            </div>

            <div className="archive-filter-row">
              <label className="archive-select"><span className="sr-only">Filter by feeling</span>
                <select onChange={(event) => setMoodFilter(event.target.value as MemoryMood | "")} value={moodFilter}>
                  <option value="">Every feeling</option>
                  {memoryMoodValues.map((mood) => <option key={mood} value={mood}>{memoryMoodLabels[mood]}</option>)}
                </select>
              </label>
              <label className="archive-select"><span className="sr-only">Filter by scrapbook</span>
                <select onChange={(event) => { setScrapbookFilter(event.target.value); setScrapbookFilterForUid(userId); }} value={activeScrapbookFilter}>
                  <option value="">Every scrapbook</option>
                  {activeScrapbooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
                </select>
              </label>
              <label className="archive-date-filter"><span>From</span><input aria-label="Start date" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></label>
              <label className="archive-date-filter"><span>To</span><input aria-label="End date" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} /></label>
              {(search || moodFilter || activeScrapbookFilter || tagFilter || milestonesOnly || startDate || endDate) && <button className="archive-clear-filter" onClick={clearFilters} type="button">Clear filters</button>}
            </div>

            {startDate && endDate && startDate > endDate && <p className="archive-date-error" role="status">Choose a start date that comes before the end date.</p>}

            {allTags.length > 0 && (
              <div className="archive-tag-filter-row" aria-label="Filter by tag" role="group">
                <span><Tag size={13} /> Tags</span>
                <button aria-pressed={!tagFilter} className={!tagFilter ? "active" : ""} onClick={() => setTagFilter("")} type="button">All</button>
                {allTags.map((tag) => <button aria-pressed={tagFilter === tag} className={tagFilter === tag ? "active" : ""} key={tag} onClick={() => setTagFilter(tagFilter === tag ? "" : tag)} type="button">#{tag}</button>)}
              </div>
            )}
          </section>

          <div className="archive-results-heading">
            <div><span className="eyebrow">Your stories, in their own time</span><h2 className="serif">{visibleMemories.length} {visibleMemories.length === 1 ? "moment" : "moments"} found</h2></div>
            {hasMore && <span className="archive-more-note">Showing {activeMemories.length} loaded moments · search further back with the button below</span>}
          </div>

          {activeScrapbookFilter && pagesLoading ? (
            <div className="archive-loading archive-filter-loading" role="status"><LoaderCircle className="memory-spinner" size={17} /> Finding the pages in that scrapbook…</div>
          ) : visibleMemories.length === 0 ? (
            <section className="archive-empty">
              <span className="archive-empty-icon"><Sparkles size={22} /></span>
              <h2 className="serif">{activeMemories.length ? "Nothing in this corner yet." : "Your first memory starts a timeline."}</h2>
              <p>{activeMemories.length ? "Try another date, feeling, scrapbook, or search." : "Keep a moment on your memory shelf, then find it here by date, feeling, or detail."}</p>
              <div className="archive-empty-actions">
                {activeMemories.length > 0 && <button className="button-secondary" onClick={clearFilters} type="button">Clear filters</button>}
                <Link className="button-primary" href="/memories">{activeMemories.length ? "Open your memory shelf" : "Keep your first memory"}<ArrowRight size={15} /></Link>
              </div>
            </section>
          ) : view === "calendar" ? (
            <div className="archive-calendar-layout">
              <section aria-label="Memory calendar" className="archive-calendar">
                <div className="archive-calendar-heading">
                  <div><span className="eyebrow">A little time travel</span><h2 className="serif">{formatDate(dateKey(calendarMonth), { month: "long", year: "numeric" })}</h2></div>
                  <div className="archive-calendar-nav"><button aria-label="Previous month" onClick={() => shiftCalendarMonth(-1)} type="button"><ChevronLeft size={18} /></button><button aria-label="Next month" onClick={() => shiftCalendarMonth(1)} type="button"><ChevronRight size={18} /></button></div>
                </div>
                <div aria-hidden="true" className="archive-calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
                <div className="archive-calendar-grid">
                  {calendarDays.map((day) => {
                    const key = dateKey(day);
                    const count = calendarCounts.get(key) ?? 0;
                    const outside = day.getMonth() !== calendarMonth.getMonth();
                    return <button aria-label={`${formatDate(key)}${count ? `, ${count} ${count === 1 ? "memory" : "memories"}` : ", no memories"}`} aria-pressed={calendarDay === key} className={`archive-calendar-day${outside ? " outside" : ""}${count ? " has-memory" : ""}${calendarDay === key ? " selected" : ""}`} key={key} onClick={() => chooseCalendarDay(day, key, outside)} type="button"><span>{day.getDate()}</span>{count > 0 && <i>{count > 1 ? count : "✦"}</i>}</button>;
                  })}
                </div>
                <div className="archive-calendar-footer"><span><i /> A moment lives on this day</span>{calendarDay && <button onClick={() => setCalendarDay("")} type="button">Show the whole month</button>}</div>
              </section>
              <section aria-live="polite" className="archive-calendar-moments">
                <span className="eyebrow">{calendarDay ? "On this date" : "This month"}</span>
                <h2 className="serif">{calendarDay ? formatDate(calendarDay) : formatDate(dateKey(calendarMonth), { month: "long" })}</h2>
                {calendarMemories.length ? <div className="archive-calendar-list">{calendarMemories.map((memory) => <ArchiveMemoryCard key={memory.id} memory={memory} reducedMotion={reduceMotion} />)}</div> : <p className="archive-calendar-empty">No saved moments here yet. Try another day, or keep one for later.</p>}
              </section>
            </div>
          ) : (
            <div className="archive-timeline">
              <AnimatePresence mode="popLayout">
                {timelineGroups.map((group) => (
                  <motion.section className="archive-timeline-group" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} key={group.key} layout>
                    <div className="archive-month-heading"><span className="archive-month-mark"><CalendarDays size={16} /></span><h2 className="serif">{group.label}</h2><span>{group.memories.length} {group.memories.length === 1 ? "moment" : "moments"}</span></div>
                    <div className="archive-timeline-list">{group.memories.map((memory, index) => <ArchiveMemoryCard index={index} key={memory.id} memory={memory} reducedMotion={reduceMotion} />)}</div>
                  </motion.section>
                ))}
              </AnimatePresence>
            </div>
          )}

          {hasMore && (
            <div className="archive-load-older-wrap">
              <button className="button-secondary archive-load-older" disabled={loadingOlder} onClick={() => void loadOlderMemories()} type="button">
                {loadingOlder ? <LoaderCircle className="memory-spinner" size={16} /> : <ArrowLeft size={15} />}
                {loadingOlder ? "Gathering earlier moments…" : "Find earlier moments"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ArchiveMemoryCard({ memory, index = 0, reducedMotion }: { memory: Memory; index?: number; reducedMotion: boolean }) {
  const imageUrl = memoryPhotoUrl(memory);
  return (
    <motion.article
      className="archive-memory-card"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reducedMotion ? 0 : Math.min(index * 0.035, 0.18) }}
      layout
    >
      <div className="archive-memory-date"><strong>{formatDate(memory.memoryDate, { day: "2-digit" })}</strong><span>{formatDate(memory.memoryDate, { month: "short" })}</span></div>
      <div className={`archive-memory-photo${imageUrl ? " has-photo" : ""}`}>
        {imageUrl ? <Image alt={`${memory.title}, saved photo`} fill sizes="(max-width: 700px) 92px, 112px" src={imageUrl} unoptimized /> : <Sparkles aria-hidden="true" size={23} strokeWidth={1.2} />}
      </div>
      <div className="archive-memory-copy">
        <div className="archive-memory-kicker">
          <span>{formatDate(memory.memoryDate, { weekday: "long" })}</span>
          {memory.mood && <span className="archive-memory-mood"><Heart size={12} /> {memoryMoodLabels[memory.mood]}</span>}
          {isMilestone(memory) && <span className="archive-memory-milestone">Milestone</span>}
        </div>
        <h3 className="serif">{memory.title}</h3>
        {memory.location && <p className="archive-memory-location"><MapPin size={13} /> {memory.location}</p>}
        {memory.description && <p className="archive-memory-description">{memory.description}</p>}
        {!!memory.tags?.length && <div className="archive-memory-tags">{memory.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        <Link className="archive-memory-link" href="/memories">Open memory shelf <ArrowRight size={13} /></Link>
      </div>
    </motion.article>
  );
}
