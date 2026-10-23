import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const candidate = Array.isArray(next) ? next[0] : next;
  const redirectTo = candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/home";

  return <AuthForm mode="login" redirectTo={redirectTo} />;
}
