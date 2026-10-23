import { describe, expect, it } from "vitest";
import { journalEntryInputSchema } from "../src/lib/validations/journal";

const validEntry = {
  title: "The ride home",
  body: "The sky went rose gold and everyone was a little quieter.",
  entryDate: "2026-10-23",
  mood: "nostalgic",
  textureId: "lined-paper",
  tapeId: "washi-08",
};

describe("journal entry validation", () => {
  it("accepts a private journal entry with stationery choices", () => {
    expect(journalEntryInputSchema.safeParse(validEntry).success).toBe(true);
  });

  it("requires a title, words, and a real calendar date", () => {
    expect(journalEntryInputSchema.safeParse({ ...validEntry, title: " " }).success).toBe(false);
    expect(journalEntryInputSchema.safeParse({ ...validEntry, body: " " }).success).toBe(false);
    expect(journalEntryInputSchema.safeParse({ ...validEntry, entryDate: "2026-02-30" }).success).toBe(false);
  });

  it("keeps the journal stationery choices within the built-in collection", () => {
    expect(journalEntryInputSchema.safeParse({ ...validEntry, textureId: "remote-image" }).success).toBe(false);
  });
});
