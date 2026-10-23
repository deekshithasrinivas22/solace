import type {
  DecorationCategory,
  DecorationId,
  PaperTextureId,
  ScrapbookCoverArtwork,
  TapeStyleId,
} from "@/types/stationery";

export type StationeryAsset = { label: string; src: string };

export const paperTextureCatalog: Record<PaperTextureId, StationeryAsset> = {
  "handmade-ivory": { label: "Handmade ivory", src: "/decorations/papers/handmade-ivory.webp" },
  "lined-paper": { label: "Notebook lines", src: "/decorations/papers/lined-paper.webp" },
  "aged-parchment": { label: "Aged parchment", src: "/decorations/papers/aged-parchment.webp" },
  "seamless-old-paper": { label: "Sepia paper", src: "/decorations/papers/seamless-old-paper.webp" },
  "sunwashed-wood": { label: "Sunwashed wood", src: "/decorations/papers/sunwashed-wood.webp" },
  "walnut-wood": { label: "Walnut grain", src: "/decorations/papers/walnut-wood.webp" },
};

export const tapeCatalog: Record<Exclude<TapeStyleId, "none">, StationeryAsset> = {
  "washi-01": { label: "Torn kraft", src: "/decorations/tapes/washi-01.webp" },
  "washi-02": { label: "Notebook grid", src: "/decorations/tapes/washi-02.webp" },
  "washi-03": { label: "Natural kraft", src: "/decorations/tapes/washi-03.webp" },
  "washi-04": { label: "Sage gingham", src: "/decorations/tapes/washi-04.webp" },
  "washi-05": { label: "Soft linen", src: "/decorations/tapes/washi-05.webp" },
  "washi-06": { label: "Cream paper", src: "/decorations/tapes/washi-06.webp" },
  "washi-07": { label: "Blue blossoms", src: "/decorations/tapes/washi-07.webp" },
  "washi-08": { label: "Tiny hearts", src: "/decorations/tapes/washi-08.webp" },
  "washi-09": { label: "Petal dots", src: "/decorations/tapes/washi-09.webp" },
  "washi-10": { label: "Old parchment", src: "/decorations/tapes/washi-10.webp" },
  "washi-11": { label: "Printed story", src: "/decorations/tapes/washi-11.webp" },
  "washi-12": { label: "Honeycomb", src: "/decorations/tapes/washi-12.webp" },
  "washi-13": { label: "Blue confetti", src: "/decorations/tapes/washi-13.webp" },
  "washi-14": { label: "Wildflower", src: "/decorations/tapes/washi-14.webp" },
};

type DecorationAsset = StationeryAsset & { category: DecorationCategory };

export const decorationCatalog: Record<DecorationId, DecorationAsset> = {
  "air-mail-envelope": { label: "Air mail", src: "/decorations/ephemera/air-mail-envelope.webp", category: "travel" },
  "baby-breath": { label: "Baby’s breath", src: "/decorations/ephemera/baby-breath.webp", category: "botanical" },
  "cassette-01": { label: "Vintage cassette", src: "/decorations/ephemera/cass1.webp", category: "music" },
  "cassette-02": { label: "Orange cassette", src: "/decorations/ephemera/cass2.webp", category: "music" },
  "cassette-03": { label: "Midnight cassette", src: "/decorations/ephemera/cass3.webp", category: "music" },
  "closed-envelope": { label: "Sealed envelope", src: "/decorations/ephemera/closed-envelope.webp", category: "paper" },
  "coffee-stains": { label: "Coffee rings", src: "/decorations/ephemera/coffee-stains.webp", category: "paper" },
  feather: { label: "Feather", src: "/decorations/ephemera/feather.webp", category: "botanical" },
  "filmstrip-01": { label: "Black film strip", src: "/decorations/ephemera/film1.webp", category: "music" },
  "filmstrip-02": { label: "Sepia film strip", src: "/decorations/ephemera/film2.webp", category: "music" },
  "flower-01": { label: "Wild stems", src: "/decorations/ephemera/flower1.webp", category: "botanical" },
  "flower-02": { label: "Pressed petals", src: "/decorations/ephemera/flower2.webp", category: "botanical" },
  "flower-03": { label: "Lavender sprig", src: "/decorations/ephemera/flower3.webp", category: "botanical" },
  "flower-04": { label: "Autumn berries", src: "/decorations/ephemera/flower4.webp", category: "botanical" },
  "flower-05": { label: "Daisy", src: "/decorations/ephemera/flower5.webp", category: "botanical" },
  "folded-letter": { label: "Folded letter", src: "/decorations/ephemera/folded-letter.webp", category: "paper" },
  "luggage-tag": { label: "Luggage tag", src: "/decorations/ephemera/luggage-tag.webp", category: "travel" },
  "note-01": { label: "The little things", src: "/decorations/ephemera/note1.webp", category: "paper" },
  "note-02": { label: "Collect beautiful moments", src: "/decorations/ephemera/note2.webp", category: "paper" },
  "note-03": { label: "August 14, 2023", src: "/decorations/ephemera/note3.webp", category: "paper" },
  "olive-branch": { label: "Olive branch", src: "/decorations/ephemera/olive-branch.webp", category: "botanical" },
  "open-envelope": { label: "Open envelope", src: "/decorations/ephemera/open-envelope.webp", category: "paper" },
  "pin-01": { label: "Brass paperclip", src: "/decorations/ephemera/pin1.webp", category: "paper" },
  "pin-02": { label: "Charcoal paperclip", src: "/decorations/ephemera/pin2.webp", category: "paper" },
  "pin-03": { label: "Brass binder clip", src: "/decorations/ephemera/pin3.webp", category: "paper" },
  "pin-04": { label: "Golden pin", src: "/decorations/ephemera/pin4.webp", category: "paper" },
  "record-01": { label: "Black vinyl", src: "/decorations/ephemera/rec1.webp", category: "music" },
  "record-02": { label: "Soft black vinyl", src: "/decorations/ephemera/rec2.webp", category: "music" },
  "record-03": { label: "Terracotta vinyl", src: "/decorations/ephemera/rec3.webp", category: "music" },
  "sticky-sage": { label: "Sage note", src: "/decorations/ephemera/sticky-sage.webp", category: "paper" },
  "sticky-01": { label: "Grid note", src: "/decorations/ephemera/sticky1.webp", category: "paper" },
  "sticky-02": { label: "Cream note", src: "/decorations/ephemera/sticky2.webp", category: "paper" },
  "sticky-03": { label: "Petal note", src: "/decorations/ephemera/sticky3.webp", category: "paper" },
  "ticket-01": { label: "Museum ticket", src: "/decorations/ephemera/ticket1.webp", category: "travel" },
  "ticket-02": { label: "Boarding pass", src: "/decorations/ephemera/ticket2.webp", category: "travel" },
  "ticket-03": { label: "Coffee receipt", src: "/decorations/ephemera/ticket3.webp", category: "travel" },
  "ticket-04": { label: "Cinema ticket", src: "/decorations/ephemera/ticket4.webp", category: "travel" },
  "torn-folded-note": { label: "Torn journal page", src: "/decorations/ephemera/torn-folded-note.webp", category: "paper" },
  "torn-quote-note": { label: "A note in the margins", src: "/decorations/ephemera/torn-quote-note.webp", category: "paper" },
  "twine-bow": { label: "Twine bow", src: "/decorations/ephemera/twine-bow.webp", category: "botanical" },
};

export const coverArtworkCatalog: Record<ScrapbookCoverArtwork, StationeryAsset> = {
  "polaroid-01": { label: "Golden hour", src: "/decorations/covers/polaroid-01.webp" },
  "polaroid-02": { label: "Window light", src: "/decorations/covers/polaroid-02.webp" },
  "polaroid-03": { label: "Sunday pages", src: "/decorations/covers/polaroid-03.webp" },
  "polaroid-04": { label: "A little above the clouds", src: "/decorations/covers/polaroid-04.webp" },
  "polaroid-05": { label: "City evenings", src: "/decorations/covers/polaroid-05.webp" },
  "polaroid-06": { label: "Salt air", src: "/decorations/covers/polaroid-06.webp" },
  "polaroid-07": { label: "Tide & time", src: "/decorations/covers/polaroid-07.webp" },
  "polaroid-08": { label: "The little hours", src: "/decorations/covers/polaroid-08.webp" },
  "polaroid-09": { label: "A day outdoors", src: "/decorations/covers/polaroid-09.webp" },
};

export const decorationCategoryLabels: Record<DecorationCategory, string> = {
  botanical: "Botanical",
  paper: "Paper & keepsakes",
  travel: "Places & tickets",
  music: "Music & film",
};
