import type { DecorationId, PaperTextureId, ScrapbookCoverArtwork, ScrapbookVibe, TapeStyleId } from "@/types/stationery";

export const scrapbookCoverValues = ["starlight", "meadow", "ember"] as const;
export const scrapbookLayoutValues = ["polaroid", "postcard", "filmstrip"] as const;
export const scrapbookPaperValues = ["cream", "sage", "rose", "night"] as const;

export type ScrapbookCover = (typeof scrapbookCoverValues)[number];
export type ScrapbookLayout = (typeof scrapbookLayoutValues)[number];
export type ScrapbookPaper = (typeof scrapbookPaperValues)[number];

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
};

export type ScrapbookTrack = {
  title: string;
  artist: string;
  url: string;
  note: string;
};

export type ScrapbookPageInput = Omit<ScrapbookPage, "id" | "createdAt" | "updatedAt" | "decorationIds"> & {
  textureId: PaperTextureId;
  tapeId: TapeStyleId;
  vibe: ScrapbookVibe;
};
