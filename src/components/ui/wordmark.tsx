import Link from "next/link";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="wordmark" aria-label="Solace home">
      <span className="wordmark-mark" aria-hidden="true">s.</span>
      {!compact && <span className="wordmark-name">solace</span>}
    </Link>
  );
}
