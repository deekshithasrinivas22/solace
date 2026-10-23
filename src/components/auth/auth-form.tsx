"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { authErrorMessage } from "@/lib/auth/errors";
import { signIn, signUp } from "@/lib/auth/actions";
import { signInSchema, signUpSchema } from "@/lib/validations/auth";
import { Wordmark } from "@/components/ui/wordmark";

type AuthFormProps = {
  mode: "login" | "signup";
  redirectTo?: string;
};

export function AuthForm({ mode, redirectTo = "/home" }: AuthFormProps) {
  const router = useRouter();
  const isSignUp = mode === "signup";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsedSignUp = isSignUp ? signUpSchema.safeParse({ displayName, email, password }) : null;
    const parsedSignIn = isSignUp ? null : signInSchema.safeParse({ email, password });
    if (parsedSignUp && !parsedSignUp.success) {
      setError(parsedSignUp.error.issues[0]?.message ?? "Check your details and try again.");
      return;
    }
    if (parsedSignIn && !parsedSignIn.success) {
      setError(parsedSignIn.error.issues[0]?.message ?? "Check your details and try again.");
      return;
    }

    setPending(true);
    try {
      if (parsedSignUp?.success) await signUp(parsedSignUp.data);
      if (parsedSignIn?.success) await signIn(parsedSignIn.data);
      router.replace(redirectTo as Route);
      router.refresh();
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page page-grain">
      <aside className="auth-aside">
        <Wordmark />
        <div className="auth-aside-copy">
          <span className="eyebrow">A little room for what matters</span>
          <h1 className="serif">The best moments deserve a place to stay.</h1>
          <p>Make a home for the photographs, words, and feelings you want to find again.</p>
        </div>
        <div className="auth-aside-foot">Your memories are yours. Always.</div>
      </aside>

      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Wordmark /></div>
          <span className="eyebrow">{isSignUp ? "Start with a name" : "Good to have you back"}</span>
          <h2 className="serif">{isSignUp ? "Make yourself at home." : "Come on in."}</h2>
          <p className="auth-description">
            {isSignUp
              ? "Create your private corner for the stories you want to keep."
              : "Your little collection of moments is right where you left it."}
          </p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {isSignUp && (
              <div className="field">
                <label htmlFor="displayName">What should we call you?</label>
                <input
                  autoComplete="name"
                  id="displayName"
                  maxLength={80}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  required
                  value={displayName}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                autoComplete="email"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                autoComplete={isSignUp ? "new-password" : "current-password"}
                id="password"
                maxLength={128}
                minLength={isSignUp ? 8 : undefined}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isSignUp ? "At least 8 characters" : "Your password"}
                required
                type="password"
                value={password}
              />
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button-primary" disabled={pending} type="submit">
              {pending ? <LoaderCircle size={17} className="animate-spin" /> : null}
              {pending ? "One moment…" : isSignUp ? "Create my space" : "Sign in"}
              {!pending && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="auth-switch">
            {isSignUp ? "Already have a space? " : "New to Solace? "}
            <Link href={isSignUp ? "/login" : "/signup"}>{isSignUp ? "Sign in" : "Make one here"}</Link>
          </p>
          <Link className="auth-back" href="/"><ArrowLeft size={14} /> Back to Solace</Link>
        </div>
      </section>
    </main>
  );
}
