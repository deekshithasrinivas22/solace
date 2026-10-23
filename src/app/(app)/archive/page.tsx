import type { Metadata } from "next";
import { ArchiveStudio } from "@/components/archive/archive-studio";

export const metadata: Metadata = { title: "Memory archive" };

export default function ArchivePage() {
  return <ArchiveStudio />;
}
