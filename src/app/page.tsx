import Link from "next/link";
import { ArrowUpRight, Heart, Leaf } from "lucide-react";
import { HeroArtwork } from "@/app/hero-artwork";
import { Wordmark } from "@/components/ui/wordmark";

export default function LandingPage() {
  return (
    <main className="landing page-grain">
      <header className="landing-header">
        <Wordmark />
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#the-feeling">The feeling</a>
          <Link href="/login">Sign in</Link>
          <Link className="button-primary" href="/signup">
            Make a little space <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">A digital home for your memories</span>
          <h1 id="hero-title" className="serif">
            Keep the<br />
            <em>feeling,</em> too.
          </h1>
          <p>
            Your life is more than a camera roll. Gather the photographs, words, songs, and small details
            that make a moment yours.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" href="/signup">
              Begin your memory journal <ArrowUpRight size={16} />
            </Link>
            <Link className="button-secondary" href="/login">I have an account</Link>
          </div>
          <div className="hero-note"><Heart size={14} fill="currentColor" /> Made for keeping, not keeping up.</div>
        </div>
        <HeroArtwork />
      </section>

      <section id="the-feeling" className="landing-ribbon" aria-label="What Solace is for">
        <div className="landing-ribbon-inner">
          <article className="ribbon-item">
            <span className="eyebrow">01 / Gather</span>
            <h2>More than a photo folder</h2>
            <p>Bring the words, places, music, and little fragments along with the pictures.</p>
          </article>
          <article className="ribbon-item">
            <span className="eyebrow">02 / Make it yours</span>
            <h2>Pages with a little soul</h2>
            <p>Arrange a moment in a scrapbook that feels like something you would keep.</p>
          </article>
          <article className="ribbon-item">
            <span className="eyebrow">03 / Return</span>
            <h2>Find your way back</h2>
            <p>Keep your stories close, private by default, and ready to revisit when you are.</p>
          </article>
        </div>
      </section>

      <footer className="landing-footer">
        <span>Solace · Keep your memories. Share your moments. Revisit how life felt.</span>
        <span><Leaf size={13} aria-hidden="true" /> A softer place to land</span>
      </footer>
    </main>
  );
}
