import type { Metadata } from "next";
import { ScrapbookLibrary } from "@/components/scrapbooks/scrapbook-library";

export const metadata: Metadata = { title: "Scrapbooks" };

export default function ScrapbooksPage() {
  return <ScrapbookLibrary />;
}
