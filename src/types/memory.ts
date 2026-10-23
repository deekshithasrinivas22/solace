export const memoryMoodValues = [
  "joyful",
  "grateful",
  "nostalgic",
  "peaceful",
  "excited",
  "tender",
  "bittersweet",
] as const;

export type MemoryMood = (typeof memoryMoodValues)[number];

export type MemoryPhoto = {
  publicId: string;
  version: number;
  format: "jpg" | "png" | "webp";
  width: number;
  height: number;
  bytes: number;
};

export const memoryMoodLabels: Record<MemoryMood, string> = {
  joyful: "Joyful",
  grateful: "Grateful",
  nostalgic: "Nostalgic",
  peaceful: "Peaceful",
  excited: "Excited",
  tender: "Tender",
  bittersweet: "Bittersweet",
};

export type Memory = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  memoryDate: string;
  location: string;
  mood: MemoryMood | "";
  tags: string[];
  photos?: MemoryPhoto[];
  createdAt: unknown;
  updatedAt: unknown;
};

export type MemoryInput = Omit<Memory, "id" | "ownerId" | "photos" | "createdAt" | "updatedAt">;
