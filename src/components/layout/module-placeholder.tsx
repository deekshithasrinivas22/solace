import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export function ModulePlaceholder({
  title,
  eyebrow,
  description,
}: {
  title: string;
  eyebrow: string;
  description: string;
}) {
  return (
    <section className="placeholder-page">
      <span className="empty-state-icon"><Sparkles size={21} strokeWidth={1.5} /></span>
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="serif">{title}</h1>
      <p>{description}</p>
      <span className="topline-caption">This part is planned for a later milestone.</span>
      <Link className="auth-back" href="/home"><ArrowLeft size={14} /> Return to your memory home</Link>
    </section>
  );
}
