"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitAnalysis, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const EXAMPLE_CLAIM =
  "The new transit line cut average downtown commute times by 30% in its first year.";
const TYPE_SPEED_MS = 45;
const HERO_ANIMATION_SESSION_KEY = "veritas-hero-typed";
const FULL_PLACEHOLDER = "Paste a claim, a headline, or a link.";

const noopSubscribe = () => () => {};
const getServerAlreadyPlayed = () => false;

/** sessionStorage never fires same-tab change events, so there's nothing
 * to subscribe to - this only exists to read the flag safely across the
 * server/client render boundary without a hydration mismatch (mirrors
 * the matchMedia pattern in Spine.tsx's useIsMobile). */
function useAlreadyPlayedHeroAnimation(): boolean {
  const getSnapshot = useCallback(
    () => window.sessionStorage.getItem(HERO_ANIMATION_SESSION_KEY) === "1",
    []
  );
  return useSyncExternalStore(noopSubscribe, getSnapshot, getServerAlreadyPlayed);
}

/**
 * The hero IS the input. The placeholder types itself out once per
 * session (sessionStorage, not localStorage - this is throwaway UI
 * chrome state, not persisted analysis data) and never repeats, so
 * re-visiting the page mid-session doesn't replay the same trick twice.
 */
export function ClaimInput() {
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const alreadyPlayed = useAlreadyPlayedHeroAnimation();
  const shouldAnimate = !alreadyPlayed && !prefersReducedMotion;

  const [text, setText] = useState("");
  const [typedPlaceholder, setTypedPlaceholder] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholder = shouldAnimate ? typedPlaceholder : FULL_PLACEHOLDER;

  useEffect(() => {
    if (!shouldAnimate) return;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setTypedPlaceholder(FULL_PLACEHOLDER.slice(0, i));
      if (i >= FULL_PLACEHOLDER.length) {
        clearInterval(interval);
        window.sessionStorage.setItem(HERO_ANIMATION_SESSION_KEY, "1");
      }
    }, TYPE_SPEED_MS);
    return () => clearInterval(interval);
  }, [shouldAnimate]);

  async function handleSubmit(submittedText: string) {
    const trimmed = submittedText.trim();
    if (trimmed.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { analysisId } = await submitAnalysis(trimmed);
      router.push(`/analyze/${analysisId}`);
    } catch (err) {
      setIsSubmitting(false);
      if (err instanceof ApiError && err.status === 401) {
        // Expired token that slipped past the middleware's presence check.
        router.push("/login");
        return;
      }
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not reach the analysis service. Check that the backend is running.");
      }
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3"
      >
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit(text);
            }
          }}
          placeholder={placeholder}
          rows={4}
          autoFocus
          className={cn(
            "rounded-overlay border-line bg-panel text-text placeholder:text-mute",
            "font-mono text-lg leading-relaxed resize-none"
          )}
          aria-label="Claim, headline, or article URL"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setText(EXAMPLE_CLAIM)}
            title={EXAMPLE_CLAIM}
            className={cn(
              "border-line text-mute hover:border-signal hover:text-text inline-flex max-w-[22rem]",
              "items-center gap-1.5 rounded-data border bg-panel-raised px-2.5 py-1",
              "font-mono text-xs transition-colors duration-hover"
            )}
          >
            <span aria-hidden className="text-signal shrink-0">
              ✦
            </span>
            <span className="truncate">{EXAMPLE_CLAIM}</span>
          </button>

          <Button
            type="button"
            onClick={() => handleSubmit(text)}
            disabled={text.trim().length === 0 || isSubmitting}
            className="rounded-data bg-signal text-void hover:bg-signal/85 font-mono uppercase tracking-wide"
          >
            {isSubmitting ? "Submitting…" : "Analyze"}
          </Button>
        </div>
      </motion.div>

      {error && (
        <p role="alert" className="text-refutes font-mono text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
