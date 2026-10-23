export const paperTextureValues = [
  "handmade-ivory",
  "lined-paper",
  "aged-parchment",
  "seamless-old-paper",
  "sunwashed-wood",
  "walnut-wood",
] as const;

export type PaperTextureId = (typeof paperTextureValues)[number];

export const tapeStyleValues = [
  "none",
  "washi-01",
  "washi-02",
  "washi-03",
  "washi-04",
  "washi-05",
  "washi-06",
  "washi-07",
  "washi-08",
  "washi-09",
  "washi-10",
  "washi-11",
  "washi-12",
  "washi-13",
  "washi-14",
] as const;

export type TapeStyleId = (typeof tapeStyleValues)[number];

export const decorationIdValues = [
  "air-mail-envelope",
  "baby-breath",
  "cassette-01",
  "cassette-02",
  "cassette-03",
  "closed-envelope",
  "coffee-stains",
  "feather",
  "filmstrip-01",
  "filmstrip-02",
  "flower-01",
  "flower-02",
  "flower-03",
  "flower-04",
  "flower-05",
  "folded-letter",
  "luggage-tag",
  "note-01",
  "note-02",
  "note-03",
  "olive-branch",
  "open-envelope",
  "pin-01",
  "pin-02",
  "pin-03",
  "pin-04",
  "record-01",
  "record-02",
  "record-03",
  "sticky-sage",
  "sticky-01",
  "sticky-02",
  "sticky-03",
  "ticket-01",
  "ticket-02",
  "ticket-03",
  "ticket-04",
  "torn-folded-note",
  "torn-quote-note",
  "twine-bow",
] as const;

export type DecorationId = (typeof decorationIdValues)[number];
export type DecorationCategory = "botanical" | "paper" | "travel" | "music";

export type PlacedDecoration = {
  id: string;
  assetId: DecorationId;
  x: number;
  y: number;
  size: number;
  rotation: number;
  zIndex: number;
  createdAt: unknown;
  updatedAt: unknown;
};

export type PlacedDecorationTarget =
  | { kind: "scrapbook-page"; scrapbookId: string; pageId: string }
  | { kind: "journal-entry"; entryId: string };

export const scrapbookVibeValues = [
  "core-memory",
  "photo-dump",
  "main-character",
  "soft-life",
  "chaotic-good",
  "after-hours",
] as const;

export type ScrapbookVibe = (typeof scrapbookVibeValues)[number];

export const scrapbookVibeLabels: Record<ScrapbookVibe, string> = {
  "core-memory": "Core memory",
  "photo-dump": "Photo dump",
  "main-character": "Main character",
  "soft-life": "Soft life",
  "chaotic-good": "Chaotic good",
  "after-hours": "After hours",
};

export const scrapbookCoverArtworkValues = [
  "polaroid-01",
  "polaroid-02",
  "polaroid-03",
  "polaroid-04",
  "polaroid-05",
  "polaroid-06",
  "polaroid-07",
  "polaroid-08",
  "polaroid-09",
] as const;

export type ScrapbookCoverArtwork = (typeof scrapbookCoverArtworkValues)[number];

export const defaultPaperTexture: PaperTextureId = "handmade-ivory";
export const defaultTapeStyle: TapeStyleId = "washi-06";
