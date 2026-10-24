import { describe, expect, it } from "vitest";
import { journalEntryInputSchema } from "../src/lib/validations/journal";

const validEntry = {
  title: "The ride home",
  body: "The sky went rose gold and everyone was a little quieter.",
  entryDate: "2026-10-23",
  mood: "nostalgic",
  tags: ["friendship", "little things"],
  textureId: "lined-paper",
  tapeId: "washi-08",
};

describe("journal entry validation", () => {
  it("accepts a private journal entry with stationery and optional tags", () => {
    expect(journalEntryInputSchema.safeParse(validEntry).success).toBe(true);
  });

  it("allows an optional title while requiring words and a real calendar date", () => {
    expect(journalEntryInputSchema.safeParse({ ...validEntry, title: "" }).success).toBe(true);
    expect(journalEntryInputSchema.safeParse({ ...validEntry, title: " ", body: " " }).success).toBe(false);
    expect(journalEntryInputSchema.safeParse({ ...validEntry, entryDate: "2026-02-30" }).success).toBe(false);
  });

  it("bounds tags and stationery choices", () => {
    expect(journalEntryInputSchema.safeParse({ ...validEntry, tags: Array(13).fill("tag") }).success).toBe(false);
    expect(journalEntryInputSchema.safeParse({ ...validEntry, tags: ["x".repeat(31)] }).success).toBe(false);
    expect(journalEntryInputSchema.safeParse({ ...validEntry, textureId: "remote-image" }).success).toBe(false);
  });
});