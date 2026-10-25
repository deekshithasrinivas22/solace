import { z } from "zod";
import { memoryMoodValues } from "../../types/memory";
import { defaultPaperTexture, defaultTapeStyle, paperTextureValues, tapeStyleValues } from "../../types/stationery";
import { journalPostItColorValues } from "../../types/journal";

function isValidOptionalDate(value: string) {
  if (!value) return true;
  const date = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value;
}

export const journalEntryInputSchema = z.object({
  title: z.string().trim().max(120, "Keep the title under 120 characters.").default(""),
  body: z.string().trim().max(12000, "Keep this entry under 12,000 characters.").default(""),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.").refine((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Choose a real calendar date."),
  mood: z.union([z.literal(""), z.enum(memoryMoodValues)]),
  tags: z.array(z.string().trim().min(1).max(30, "Keep each tag under 30 characters.")).max(12, "A page can have up to 12 tags.").default([]),
  textureId: z.enum(paperTextureValues).default(defaultPaperTexture),
  tapeId: z.enum(tapeStyleValues).default(defaultTapeStyle),
  postItText: z.string().trim().max(500, "Keep a Post-it under 500 characters.").default(""),
  postItColor: z.enum(journalPostItColorValues).default("butter"),
  checklistItems: z.array(z.string().trim().min(1, "Checklist items can’t be blank.").max(160, "Keep each checklist item under 160 characters.")).max(12, "A page can hold up to 12 checklist items.").default([]),
  checklistChecked: z.array(z.boolean()).max(12).default([]),
  reminderDate: z.string().refine(isValidOptionalDate, "Choose a real reminder date.").default(""),
}).superRefine((entry, context) => {
  if (entry.checklistItems.length !== entry.checklistChecked.length) {
    context.addIssue({ code: "custom", path: ["checklistChecked"], message: "Checklist items and check marks must match." });
  }
  if (!entry.body.trim() && !entry.postItText.trim() && entry.checklistItems.length === 0) {
    context.addIssue({ code: "custom", path: ["body"], message: "Write something, add a Post-it, or make a checklist before saving." });
  }
});

export type JournalEntryInputValues = z.infer<typeof journalEntryInputSchema>;
