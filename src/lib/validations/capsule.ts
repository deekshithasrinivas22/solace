import { z } from "zod";

export const timeCapsuleInputSchema = z.object({
  title: z.string().trim().min(1, "Give your capsule a title.").max(100, "Keep the title under 100 characters."),
  message: z.string().trim().min(1, "Write a note before saving this capsule.").max(12000, "Keep the note under 12,000 characters."),
  unlockAt: z.string().datetime("Choose a valid reveal time."),
});

export const timeCapsuleIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
