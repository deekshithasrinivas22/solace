import { z } from "zod";
import { memoryMoodValues } from "../../types/memory";
import { defaultPaperTexture, defaultTapeStyle, paperTextureValues, tapeStyleValues } from "../../types/stationery";

export const journalEntryInputSchema = z.object({
  title: z.string().trim().min(1, "Give this page a title.").max(120, "Keep the title under 120 characters."),
  body: z.string().trim().min(1, "Write a few words before saving.").max(12000, "Keep this entry under 12,000 characters."),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.").refine((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Choose a real calendar date."),
  mood: z.union([z.literal(""), z.enum(memoryMoodValues)]),
  textureId: z.enum(paperTextureValues).default(defaultPaperTexture),
  tapeId: z.enum(tapeStyleValues).default(defaultTapeStyle),
});

export type JournalEntryInputValues = z.infer<typeof journalEntryInputSchema>;
