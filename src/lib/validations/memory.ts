import { z } from "zod";
import { memoryMoodValues } from "../../types/memory";

export const memoryInputSchema = z.object({
  title: z.string().trim().min(1, "Give this memory a title.").max(120, "Keep the title under 120 characters."),
  description: z.string().trim().max(5000, "Keep your story under 5,000 characters."),
  memoryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, "Choose a real calendar date."),
  memoryTime: z.union([
    z.literal(""),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time."),
  ]).default(""),
  location: z.string().trim().max(120, "Keep the place name under 120 characters."),
  mood: z.union([z.literal(""), z.enum(memoryMoodValues)]),
  tags: z.array(z.string().trim().min(1).max(24)).max(12, "Add up to 12 tags."),
});

export type MemoryInputValues = z.infer<typeof memoryInputSchema>;
