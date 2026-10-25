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
    expect(scrapbookPageInputSchema.parse({ ...validPage, layout: "filmstrip" }).layoutStyle).toBe("filmstrip-35mm");
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, layout: "postcard", layoutStyle: "polaroid-classic" }).success).toBe(false);
  });

  it("limits scrapbook notes, page captions, and memory references", () => {
    expect(scrapbookInputSchema.safeParse({ ...validScrapbook, description: "x".repeat(501) }).success).toBe(false);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, caption: "x".repeat(1601) }).success).toBe(false);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, memoryId: "x".repeat(129) }).success).toBe(false);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, memoryId: "memory/other" }).success).toBe(false);
  });

  it("accepts more than three photos and stores freeform positions", () => {
    const photos = Array.from({ length: 8 }, (_, index) => ({
      publicId: `solace/owner/scrapbooks/book/page/photo${index}`,
      version: 1,
      format: "jpg" as const,
      width: 1200,
      height: 900,
      bytes: 120_000,
      position: { x: 10 + index * 8, y: 20 + index * 5 },
    }));
    const parsed = scrapbookPageInputSchema.parse({ ...validPage, photos });
    expect(parsed.photos).toHaveLength(8);
    expect(parsed.photos[7]?.position).toEqual({ x: 66, y: 55 });
  });

  it("accepts a supported song link and rejects unsupported hosts", () => {
    const track = { title: "Blue Hour", artist: "The Lanterns", url: "https://open.spotify.com/track/abc123", note: "For the ride home." };
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, track }).success).toBe(true);
    expect(scrapbookPageInputSchema.safeParse({ ...validPage, track: { ...track, url: "https://example.com/song" } }).success).toBe(false);
  });
});
