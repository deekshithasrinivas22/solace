import type { DecorationId, PaperTextureId, ScrapbookCoverArtwork, ScrapbookVibe, TapeStyleId } from "@/types/stationery";

export const scrapbookCoverValues = ["starlight", "meadow", "ember"] as const;
export const scrapbookLayoutValues = ["polaroid", "postcard", "filmstrip"] as const;
export const scrapbookPaperValues = ["cream", "sage", "rose", "night"] as const;
export const scrapbookLayoutStyleValues = [
  "polaroid-classic", "polaroid-soft", "polaroid-color",
  "postcard-vintage", "postcard-airmail", "postcard-modern",
  "filmstrip-35mm", "filmstrip-super8", "filmstrip-color",
] as const;

export type ScrapbookCover = (typeof scrapbookCoverValues)[number];
export type ScrapbookLayout = (typeof scrapbookLayoutValues)[number];
export type ScrapbookPaper = (typeof scrapbookPaperValues)[number];
export type ScrapbookLayoutStyle = (typeof scrapbookLayoutStyleValues)[number];

export const scrapbookLayoutStyleChoices: Record<ScrapbookLayout, { value: ScrapbookLayoutStyle; label: string }[]> = {
  polaroid: [
    { value: "polaroid-classic", label: "Classic white border" },
    { value: "polaroid-soft", label: "Soft paper frame" },
    { value: "polaroid-color", label: "Colorful frame" },
  ],
  postcard: [
    { value: "postcard-vintage", label: "Vintage postcard" },
    { value: "postcard-airmail", label: "Airmail edges" },
    { value: "postcard-modern", label: "Clean and modern" },
  ],
  filmstrip: [
    { value: "filmstrip-35mm", label: "Classic 35 mm" },
    { value: "filmstrip-super8", label: "Warm Super 8" },
    { value: "filmstrip-color", label: "Color negative" },
  ],
};

export function defaultScrapbookLayoutStyle(layout: ScrapbookLayout): ScrapbookLayoutStyle {
  if (layout === "postcard") return "postcard-vintage";
  if (layout === "filmstrip") return "filmstrip-35mm";
  return "polaroid-classic";
}

export type ScrapbookPhotoPosition = { x: number; y: number };

export function defaultScrapbookPhotoPosition(layout: ScrapbookLayout, index: number): ScrapbookPhotoPosition {
  const columns = layout === "postcard" ? 2 : layout === "filmstrip" ? 4 : 3;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = columns === 2 ? (column === 0 ? 35 : 65) : columns === 3 ? 25 + column * 25 : 17 + column * 22;
  return { x, y: Math.min(84, 24 + row * 18) };
}

export const scrapbookCoverLabels: Record<ScrapbookCover, string> = {
  starlight: "Starlight",
  meadow: "Wild meadow",
  ember: "Golden hour",
};

export const scrapbookLayoutLabels: Record<ScrapbookLayout, string> = {
  polaroid: "Polaroid",
  postcard: "Postcard",
  filmstrip: "Film strip",
};

export const scrapbookPaperLabels: Record<ScrapbookPaper, string> = {
  cream: "Warm ivory",
  sage: "Soft sage",
  rose: "Petal pink",
  night: "Twilight",
};

export type Scrapbook = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  cover: ScrapbookCover;
  coverArtwork?: ScrapbookCoverArtwork;
  createdAt: unknown;
  updatedAt: unknown;
};

export type ScrapbookInput = Omit<Scrapbook, "id" | "ownerId" | "createdAt" | "updatedAt" | "coverArtwork"> & {
  coverArtwork: ScrapbookCoverArtwork;
};

export type ScrapbookPage = {
  id: string;
  title: string;
  layout: ScrapbookLayout;
  layoutStyle?: ScrapbookLayoutStyle;
  paper: ScrapbookPaper;
  textureId?: PaperTextureId;
  tapeId?: TapeStyleId;
  decorationIds?: DecorationId[];
  vibe?: ScrapbookVibe;
  caption: string;
  memoryId: string;
  photos: ScrapbookPhoto[];
  track: ScrapbookTrack | null;
  createdAt: unknown;
  updatedAt: unknown;
};

export type ScrapbookPhoto = {
  publicId: string;
  version: number;
  format: "jpg" | "png" | "webp";
  width: number;
  height: number;
  bytes: number;
  position?: ScrapbookPhotoPosition;
};

export type ScrapbookTrack = {
  title: string;
  artist: string;
  url: string;
  note: string;
};

export type ScrapbookPageInput = Omit<ScrapbookPage, "id" | "createdAt" | "updatedAt" | "decorationIds"> & {
  layoutStyle: ScrapbookLayoutStyle;
  textureId: PaperTextureId;
  tapeId: TapeStyleId;
  vibe: ScrapbookVibe;
};
