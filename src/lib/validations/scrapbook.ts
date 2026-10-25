import { z } from "zod";
import {
  scrapbookCoverValues,
  scrapbookLayoutValues,
  scrapbookLayoutStyleValues,
  scrapbookPaperValues,
} from "../../types/scrapbook";
import {
  defaultPaperTexture,
  defaultTapeStyle,
  paperTextureValues,
  scrapbookVibeValues,
  scrapbookCoverArtworkValues,
  tapeStyleValues,
} from "../../types/stationery";

export const scrapbookInputSchema = z.object({
  title: z.string().trim().min(1, "Give your scrapbook a name.").max(100, "Keep the name under 100 characters."),
  description: z.string().trim().max(500, "Keep the note under 500 characters."),
  cover: z.enum(scrapbookCoverValues),
  coverArtwork: z.enum(scrapbookCoverArtworkValues).default("polaroid-01"),
});

function isSupportedSongUrl(value: string) {
  try {
    const parsed = new URL(value);
    const supportedHosts = [
      "open.spotify.com",
      "music.apple.com",
      "music.youtube.com",
      "youtube.com",
      "youtu.be",
      "soundcloud.com",
      "on.soundcloud.com",
    ];
    return parsed.protocol === "https:" && supportedHosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

export const scrapbookTrackSchema = z.object({
  title: z.string().trim().min(1, "Add the song title.").max(120, "Keep the song title under 120 characters."),
  artist: z.string().trim().min(1, "Add the artist name.").max(120, "Keep the artist name under 120 characters."),
  url: z.string().trim().url("Add a valid song link.").max(500).refine(
    isSupportedSongUrl,
    "Use a Spotify, Apple Music, YouTube Music, or SoundCloud link.",
  ),
  note: z.string().trim().max(500, "Keep your song note under 500 characters."),
});

export const scrapbookPageInputSchema = z.object({
  title: z.string().trim().min(1, "Give this page a title.").max(80, "Keep the page title under 80 characters."),
  layout: z.enum(scrapbookLayoutValues),
  layoutStyle: z.enum(scrapbookLayoutStyleValues).optional(),
  paper: z.enum(scrapbookPaperValues),
  textureId: z.enum(paperTextureValues).default(defaultPaperTexture),
  tapeId: z.enum(tapeStyleValues).default(defaultTapeStyle),
  vibe: z.enum(scrapbookVibeValues).default("core-memory"),
  caption: z.string().trim().max(1600, "Keep the page note under 1,600 characters."),
  memoryId: z.string().max(128).refine((value) => !value.includes("/"), "Choose a memory from your shelf."),
  track: scrapbookTrackSchema.nullable(),
  photos: z.array(z.object({
    publicId: z.string().min(1).max(300).regex(/^solace\/[A-Za-z0-9_-]+\/scrapbooks\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/),
    version: z.number().int().positive(),
    format: z.enum(["jpg", "png", "webp"]),
    width: z.number().int().positive().max(12000),
    height: z.number().int().positive().max(12000),
    bytes: z.number().int().positive().max(8 * 1024 * 1024),
    position: z.object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    }).optional(),
  })),
}).transform((value) => ({
  ...value,
  layoutStyle: value.layoutStyle ?? (value.layout === "postcard" ? "postcard-vintage" : value.layout === "filmstrip" ? "filmstrip-35mm" : "polaroid-classic"),
})).refine((value) => value.layoutStyle.startsWith(`${value.layout}-`), {
  path: ["layoutStyle"],
  message: "Choose a style made for this page layout.",
});

export type ScrapbookInputValues = z.infer<typeof scrapbookInputSchema>;
export type ScrapbookPageInputValues = z.infer<typeof scrapbookPageInputSchema>;
