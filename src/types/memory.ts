export const memoryMoodValues = [
  "joyful",
  "excited",
  "peaceful",
  "loved",
  "grateful",
  "nostalgic",
  "tender",
  "bittersweet",
  "sad",
  "anxious",
  "proud",
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
  joyful: "Happy",
  excited: "Excited",
  peaceful: "Peaceful",
  loved: "Loved",
  grateful: "Grateful",
  nostalgic: "Nostalgic",
  tender: "Tender",
  bittersweet: "Bittersweet",
  sad: "Sad",
  anxious: "Anxious",
  proud: "Proud",
};

export type Memory = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  memoryDate: string;
  memoryTime?: string;
  location: string;
  mood: MemoryMood | "";
  tags: string[];
  photos?: MemoryPhoto[];
  createdAt: unknown;
  updatedAt: unknown;
};

export type MemoryInput = Omit<Memory, "id" | "ownerId" | "photos" | "createdAt" | "updatedAt">;
