import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "../src/lib/validations/auth";

describe("authentication input validation", () => {
  it("normalizes email addresses before sign-in", () => {
    expect(signInSchema.parse({ email: "  PERSON@Example.com ", password: "not-empty" })).toEqual({
      email: "person@example.com",
      password: "not-empty",
    });
  });

  it("requires a usable name, valid email, and a longer registration password", () => {
    expect(signUpSchema.safeParse({ displayName: "A", email: "bad", password: "short" }).success).toBe(false);
    expect(
      signUpSchema.safeParse({ displayName: "Ari", email: "ari@example.com", password: "eight888" }).success,
    ).toBe(true);
  });
});
