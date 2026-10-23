import { describe, expect, it } from "vitest";
import { scrapbookInputSchema, scrapbookPageInputSchema } from "../src/lib/validations/scrapbook";

const validScrapbook = {
  title: "Autumn by the lake",
  description: "Little moments from October.",
  cover: "meadow",
};

const validPage = {
  title: "The long way home",
  layout: "polaroid",
  paper: "cream",
  caption: "We stayed until the sky turned pink.",
  memoryId: "",
  photos: [],
  track: null,
};

describe("scrapbook input validation", () => {
  it("trims scrapbook titles and accepts supported covers", () => {
    expect(scrapbookInputSchema.parse({ ...validScrapbook, title: "  Autumn by the lake  " }).title).toBe(
      "Autumn by the lake",
    );
    expect(scrapbookInputSchema.safeParse({ ...validScrapbook, cover: "unknown" }).success).toBe(false);
  });

  it("requires a page title and supported layout and paper", () => {
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, title: " " }).success).toBe(false);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, layout: "freeform" }).success).toBe(false);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, paper: "blue" }).success).toBe(false);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, vibe: "not-a-vibe" }).success).toBe(false);
    expect(scrapbookPageInputSchema.parse(validPage).vibe).toBe("core-memory");
  });

  it("limits scrapbook notes, page captions, and memory references", () => {
    expect(scrapbookInputSchema.safeParse({ ...validScrapbook, description: "x".repeat(501) }).success).toBe(false);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, caption: "x".repeat(1601) }).success).toBe(false);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, memoryId: "x".repeat(129) }).success).toBe(false);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, memoryId: "memory/other" }).success).toBe(false);
  });

  it("accepts a supported song link and rejects unsupported hosts", () => {
    const track = { title: "Blue Hour", artist: "The Lanterns", url: "https://open.spotify.com/track/abc123", note: "For the ride home." };
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, track }).success).toBe(true);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, track: { ...track, url: "https://example.com/song" } }).success).toBe(false);
  });
});
