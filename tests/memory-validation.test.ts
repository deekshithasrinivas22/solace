import { describe, expect, it } from "vitest";
import { memoryInputSchema } from "../src/lib/validations/memory";

const validMemory = {
  title: "A day worth keeping",
  description: "We took the long way home.",
  memoryDate: "2026-10-23",
  location: "By the lake",
  mood: "grateful",
  tags: ["friends", "autumn"],
};

describe("memory input validation", () => {
  it("accepts a real date and trims the written details", () => {
    expect(memoryInputSchema.parse({ ...validMemory, title: "  A day worth keeping  " }).title).toBe(
      "A day worth keeping",
    );
  });

  it("accepts an optional event time and rejects malformed times", () => {
    expect(memoryInputSchema.parse({ ...validMemory }).memoryTime).toBe("");
    expect(memoryInputSchema.parse({ ...validMemory, memoryTime: "09:45" }).memoryTime).toBe("09:45");
    expect(memoryInputSchema.safeParse({ ...validMemory, memoryTime: "25:90" }).success).toBe(false);
  });

  it("rejects impossible calendar dates without throwing", () => {
    expect(memoryInputSchema.safeParse({ ...validMemory, memoryDate: "2026-02-30" }).success).toBe(false);
    expect(memoryInputSchema.safeParse({ ...validMemory, memoryDate: "not-a-date" }).success).toBe(false);
  });

  it("limits the number of tags and requires a title", () => {
    expect(memoryInputSchema.safeParse({ ...validMemory, title: "  " }).success).toBe(false);
    expect(memoryInputSchema.safeParse({ ...validMemory, tags: Array(13).fill("tag") }).success).toBe(false);
  });
});
