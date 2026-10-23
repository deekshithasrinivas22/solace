import type { MemoryMood, MemoryPhoto } from "@/types/memory";
import type { DecorationId, PaperTextureId, TapeStyleId } from "@/types/stationery";

export type JournalEntry = {
  id: string;
  ownerId: string;
  title: string;
  body: string;
  entryDate: string;
  mood: MemoryMood | "";
  textureId?: PaperTextureId;
  tapeId?: TapeStyleId;
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
  textureId: PaperTextureId;
  tapeId: TapeStyleId;
};
