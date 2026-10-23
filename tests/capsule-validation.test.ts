import { describe, expect, it } from "vitest";
import { timeCapsuleIdSchema, timeCapsuleInputSchema } from "../src/lib/validations/capsule";

const validCapsule = {
  title: "After finals",
  message: "Remember to take one slow day before planning the next thing.",
  unlockAt: "2027-01-12T08:00:00.000Z",
};

describe("time capsule validation", () => {
  it("trims the title and accepts a dated note", () => {
    expect(timeCapsuleInputSchema.parse({ ...validCapsule, title: "  After finals  " }).title).toBe("After finals");
  });

  it("requires a title, message, and valid reveal time", () => {
    expect(timeCapsuleInputSchema.safeParse({ ...validCapsule, title: " " }).success).toBe(false);
    expect(timeCapsuleInputSchema.safeParse({ ...validCapsule, message: " " }).success).toBe(false);
    expect(timeCapsuleInputSchema.safeParse({ ...validCapsule, unlockAt: "not-a-date" }).success).toBe(false);
  });

  it("keeps the note and title within their limits and validates capsule ids", () => {
    expect(timeCapsuleInputSchema.safeParse({ ...validCapsule, title: "x".repeat(101) }).success).toBe(false);
    expect(timeCapsuleInputSchema.safeParse({ ...validCapsule, message: "x".repeat(12001) }).success).toBe(false);
    expect(timeCapsuleIdSchema.safeParse("capsule_01").success).toBe(true);
    expect(timeCapsuleIdSchema.safeParse("capsule/private").success).toBe(false);
  });
});
