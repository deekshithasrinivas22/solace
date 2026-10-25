import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookHeart, BookOpen, ImagePlus, Sparkles } from "lucide-react";
import { RecentMemories } from "@/components/memories/recent-memories";
import { RecentScrapbooks } from "@/components/scrapbooks/recent-scrapbooks";
import { getVerifiedSession } from "@/lib/auth/session";
import { getServerProfile } from "@/lib/firebase/server-profiles";

export const metadata: Metadata = { title: "Your memory home" };

export default async function HomePage() {
  const session = await getVerifiedSession();
  const profile = session?.uid ? await getServerProfile(session.uid) : null;
  const fallbackName = session?.email?.split("@")[0] || "friend";
  const name = profile?.displayName || session?.name || fallbackName;

  return (
    <div className="home-dashboard">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow"><Sparkles size={13} /> YOUR SOLACE SPACE</span>
          <h1 className="serif">Welcome back, {name}<span className="heading-period">.</span></h1>
          <p>Your life, in little keepsake-sized chapters.</p>
        </div>
        <span className="dashboard-date">A little space that is yours</span>
      </div>

      <section className="dashboard-welcome magical-welcome board-hero" aria-labelledby="first-memory-title">
        <div className="welcome-copy">
          <span className="eyebrow">A MOODBOARD FOR YOUR LIFE</span>
          <h2 id="first-memory-title" className="serif">Life lately,<br />saved in color.</h2>
          <p>
            The blurry photos, the tiny wins, the people who feel like home. Put the good stuff somewhere lovely.
          </p>
          <div className="board-hero-actions">
            <Link className="button-primary" href="/memories"><ImagePlus size={16} /> Add a memory</Link>
            <Link className="board-hero-secondary" href="/scrapbooks">Make a scrapbook <ArrowRight size={15} /></Link>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span className="ring" />
          <span className="welcome-star welcome-star-one">✦</span>
          <span className="welcome-star welcome-star-two">✧</span>
          <span className="welcome-star welcome-star-three">✦</span>
          <ImagePlus size={52} strokeWidth={0.9} />
          <span className="hero-polaroid hero-polaroid-back" />
          <span className="hero-polaroid hero-polaroid-front"><Sparkles size={20} /><small>little things, lately</small></span>
        </div>
        <span className="board-hero-sticker" aria-hidden="true">made of<br />moments ✳</span>
      </section>

      <div className="board-section-heading">
        <div><span className="eyebrow">THE GOOD STUFF</span><h2>Your shelves, lately</h2></div>
        <span>Private, just for you</span>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel recent-panel board-pin board-pin-memories" aria-labelledby="recent-memories-title">
          <div className="panel-heading">
            <h2 id="recent-memories-title">Recently remembered</h2>
            <Link className="panel-link" href="/memories">Your shelf <ArrowRight size={13} /></Link>
          </div>
          <RecentMemories />
        </section>

        <section className="dashboard-panel board-pin board-pin-scrapbooks" aria-labelledby="scrapbooks-title">
          <div className="panel-heading">
            <h2 id="scrapbooks-title">Scrapbooks</h2>
            <Link className="panel-link" href="/scrapbooks">Your shelf <ArrowRight size={13} /></Link>
          </div>
          <RecentScrapbooks />
        </section>

      </div>

      <section className="dashboard-shortcuts" aria-label="More ways to keep a moment">
        <div className="shortcut-heading"><span className="eyebrow">MAKE IT YOURS</span><h2>More ways to keep a moment</h2></div>
        <div className="shortcut-grid">
          <Link className="dashboard-shortcut shortcut-journal" href="/journal">
            <span className="shortcut-icon"><BookHeart size={20} /></span>
            <span><strong>Journal</strong><small>Make room for the words and the in-between.</small></span>
            <ArrowUpRight size={17} />
          </Link>
          <Link className="dashboard-shortcut shortcut-capsules" href="/capsules">
            <span className="shortcut-icon"><Sparkles size={20} /></span>
            <span><strong>Time capsules</strong><small>Leave a little something for future you.</small></span>
            <ArrowUpRight size={17} />
          </Link>
          <Link className="dashboard-shortcut shortcut-archive" href="/archive">
            <span className="shortcut-icon"><BookOpen size={20} /></span>
            <span><strong>Memory archive</strong><small>Find your way back to a favorite day.</small></span>
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>

      <p className="dashboard-footnote"><Sparkles size={14} /> No feed to keep up with. Just your own pace.</p>
    </div>
  );
}
