"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, signup, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AuthFormProps {
  mode: "login" | "signup";
}

const COPY = {
  login: {
    submit: "Log in",
    submitting: "Logging in…",
    footer: "No account?",
    footerLinkLabel: "Sign up",
    footerHref: "/signup",
  },
  signup: {
    submit: "Sign up",
    submitting: "Signing up…",
    footer: "Already registered?",
    footerLinkLabel: "Log in",
    footerHref: "/login",
  },
} as const;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const copy = COPY[mode];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await (mode === "login" ? login(email, password) : signup(email, password));
      // refresh() re-runs the middleware and server components with the
      // new session cookie in place.
      router.push("/");
      router.refresh();
    } catch (err) {
      setIsSubmitting(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not reach the analysis service. Check that the backend is running.");
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("rounded-overlay border-line bg-panel flex flex-col gap-5 border p-6")}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="auth-email"
          className="text-mute font-mono text-xs tracking-wide uppercase"
        >
          Email
        </label>
        <Input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
          className="border-line bg-panel text-text placeholder:text-mute rounded-data font-mono"
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="auth-password"
          className="text-mute font-mono text-xs tracking-wide uppercase"
        >
          Password
        </label>
        <Input
          id="auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "signup" ? 8 : 1}
          maxLength={72}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="border-line bg-panel text-text placeholder:text-mute rounded-data font-mono"
          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
        />
      </div>

      {error && (
        <p role="alert" className="text-refutes font-mono text-sm">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="rounded-data bg-signal text-void hover:bg-signal/85 font-mono tracking-wide uppercase"
      >
        {isSubmitting ? copy.submitting : copy.submit}
      </Button>

      <p className="text-mute font-mono text-xs">
        {copy.footer}{" "}
        <Link
          href={copy.footerHref}
          className="text-signal hover:text-text underline underline-offset-2 transition-colors"
        >
          {copy.footerLinkLabel}
        </Link>
      </p>
    </form>
  );
}
