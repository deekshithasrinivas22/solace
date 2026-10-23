import type { Metadata } from "next";
import { ScrapbookEditor } from "@/components/scrapbooks/scrapbook-editor";

export const metadata: Metadata = { title: "Scrapbook Studio" };

export default async function ScrapbookEditorPage({
  params,
}: {
  params: Promise<{ scrapbookId: string }>;
}) {
  const { scrapbookId } = await params;
  return <ScrapbookEditor scrapbookId={scrapbookId} />;
}
