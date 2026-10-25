import type { MemoryMood, MemoryPhoto } from "@/types/memory";
import type { DecorationId, PaperTextureId, TapeStyleId } from "@/types/stationery";

export const journalPostItColorValues = ["butter", "pink", "blue", "mint", "lilac"] as const;
export type JournalPostItColor = (typeof journalPostItColorValues)[number];

export type JournalEntry = {
  id: string;
  ownerId: string;
  title: string;
  body: string;
  entryDate: string;
  mood: MemoryMood | "";
  tags?: string[];
  textureId?: PaperTextureId;
  tapeId?: TapeStyleId;
  postItText?: string;
  postItColor?: JournalPostItColor;
  checklistItems?: string[];
  checklistChecked?: boolean[];
  reminderDate?: string;
  decorationIds?: DecorationId[];
  photos?: JournalPhoto[];
  createdAt: unknown;
  updatedAt: unknown;
};

export type JournalPhoto = MemoryPhoto;

export type JournalEntryInput = {
  title: string;
  body: string;
  entryDate: string;
  mood: MemoryMood | "";
  tags: string[];
  textureId: PaperTextureId;
  tapeId: TapeStyleId;
  postItText: string;
  postItColor: JournalPostItColor;
  checklistItems: string[];
  checklistChecked: boolean[];
  reminderDate: string;
};
