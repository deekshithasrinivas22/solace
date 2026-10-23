import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArrowRight, Clock3, ImagePlus, Sparkles } from "lucide-react";
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
          <span className="eyebrow">Your memory home</span>
          <h1 className="serif">Welcome back, {name}.</h1>
          <p>A quiet place for the stories, photographs, and little details you want to keep.</p>
        </div>
        <span className="dashboard-date">One moment at a time</span>
      </div>

      <section className="dashboard-welcome magical-welcome" aria-labelledby="first-memory-title">
        <div className="welcome-copy">
          <span className="eyebrow">A fresh page</span>
          <h2 id="first-memory-title" className="serif">Your little universe is ready to grow.</h2>
          <p>
            Save a day, a feeling, or the detail you never want to forget. Every memory adds another
            tiny light to your own constellation.
          </p>
          <Link className="button-secondary welcome-cta" href="/memories">
            <Sparkles size={16} /> Keep a memory <ArrowRight size={15} />
          </Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span className="ring" />
          <span className="welcome-star welcome-star-one">✦</span>
          <span className="welcome-star welcome-star-two">✧</span>
          <span className="welcome-star welcome-star-three">✦</span>
          <ImagePlus size={52} strokeWidth={0.9} />
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-panel recent-panel" aria-labelledby="recent-memories-title">
          <div className="panel-heading">
            <h2 id="recent-memories-title">Recently remembered</h2>
            <Link className="panel-link" href="/memories">Your shelf <ArrowRight size={13} /></Link>
          </div>
          <RecentMemories />
        </section>

        <section className="dashboard-panel" aria-labelledby="scrapbooks-title">
          <div className="panel-heading">
            <h2 id="scrapbooks-title">Scrapbooks</h2>
            <Link className="panel-link" href="/scrapbooks">Your shelf <ArrowRight size={13} /></Link>
          </div>
          <RecentScrapbooks />
        </section>

        <section className="dashboard-panel" aria-labelledby="capsules-title">
          <div className="panel-heading">
            <h2 id="capsules-title">For another day</h2>
            <span>TIME CAPSULES</span>
          </div>
          <div className="empty-state">
            <span className="empty-state-icon"><Clock3 size={20} strokeWidth={1.5} /></span>
            <strong>A note for your future self.</strong>
            <p>Time capsules will give a few favorite moments a date to come back to you.</p>
          </div>
        </section>

        <section className="dashboard-panel" aria-labelledby="archive-title">
          <div className="panel-heading">
            <h2 id="archive-title">Little things worth keeping</h2>
            <span>YOUR ARCHIVE</span>
          </div>
          <div className="empty-state">
            <span className="empty-state-icon"><Archive size={20} strokeWidth={1.5} /></span>
            <strong>A place for every chapter.</strong>
            <p>Your archive will make it easy to find a day by date, place, or the way it felt.</p>
          </div>
        </section>
      </div>

      <p className="dashboard-footnote"><Sparkles size={14} /> No feed to keep up with. Just your own pace.</p>
    </div>
  );
}
