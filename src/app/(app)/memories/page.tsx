import type { Metadata } from "next";
import { MemoryStudio } from "@/components/memories/memory-studio";

export const metadata: Metadata = { title: "Memories" };

export default function MemoriesPage() {
  return <MemoryStudio />;
}
