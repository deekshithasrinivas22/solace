import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters for your name.")
    .max(80, "Use 80 characters or fewer."),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Use 128 characters or fewer."),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
