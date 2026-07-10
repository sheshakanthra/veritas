"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CornerDownLeft, FileText, Link2, Loader2, Search } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { submitAnalysis, ApiError } from "@/lib/api";
import { Kbd } from "@/components/veritas/primitives";
import { cn } from "@/lib/utils";

const ROTATING_PLACEHOLDERS = [
  "The new transit line cut average downtown commute times by 30% in its first year.",
  "Renewable energy was the cheapest source of new electricity in 2024.",
  "Paste a news headline to trace it back to its primary sources.",
  "Drop a link — an article, a study, a press release.",
  "A single volcano emits more CO₂ than all of human activity.",
];

const BASE_PLACEHOLDER = "Paste a claim, a headline, or a link…";
const ROTATE_MS = 3600;

const EXAMPLE_CHIPS: { label: string; icon: typeof FileText; text: string }[] = [
  {
    label: "Statistical claim",
    icon: FileText,
    text: "The new transit line cut average downtown commute times by 30% in its first year.",
  },
  {
    label: "Viral headline",
    icon: Search,
    text: "Study finds coffee drinkers live ten years longer than everyone else.",
  },
  {
    label: "Article URL",
    icon: Link2,
    text: "https://example.com/press/quarterly-economic-growth-report",
  },
];

function looksLikeUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

export function ClaimInput({ initialText }: { initialText?: string }) {
  const router = useRouter();
  const reduce = usePrefersReducedMotion();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState(initialText ?? "");
  const [focused, setFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = text.trim().length === 0;
  const showRotating = isEmpty && !focused && !reduce;
  const isUrl = looksLikeUrl(text);

  // Rotate the placeholder only while the field is idle and empty.
  useEffect(() => {
    if (!showRotating) return;
    const id = setInterval(
      () => setPlaceholderIndex((i) => (i + 1) % ROTATING_PLACEHOLDERS.length),
      ROTATE_MS
    );
    return () => clearInterval(id);
  }, [showRotating]);

  // Focus the search from anywhere with the "/" key.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && tag !== "TEXTAREA" && tag !== "INPUT") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSubmit(submitted: string) {
    const trimmed = submitted.trim();
    if (trimmed.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { analysisId } = await submitAnalysis(trimmed);
      router.push(`/analyze/${analysisId}`);
    } catch (err) {
      setIsSubmitting(false);
      if (err instanceof ApiError && err.status === 401) {
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

  function applyExample(value: string) {
    setText(value);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(text);
        }}
      >
        <motion.div
          animate={{
            borderColor: focused ? "var(--v-signal)" : "var(--v-line)",
            boxShadow: focused
              ? "0 0 0 4px color-mix(in srgb, var(--v-signal) 14%, transparent), var(--v-shadow-lg)"
              : "0 0 0 0px transparent, var(--v-shadow-md)",
          }}
          transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-panel bg-panel border"
        >
          <div className="flex items-start gap-3 px-5 pt-5">
            <Search
              className={cn(
                "mt-1 size-5 shrink-0 transition-colors",
                focused ? "text-signal" : "text-mute"
              )}
              aria-hidden
            />
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(text);
                  }
                }}
                rows={2}
                autoFocus
                aria-label="Claim, headline, or article URL"
                placeholder={showRotating ? "" : BASE_PLACEHOLDER}
                className={cn(
                  "text-text placeholder:text-mute w-full resize-none bg-transparent",
                  "font-sans text-lg leading-relaxed outline-none"
                )}
              />
              {/* rotating placeholder overlay - only while idle + empty */}
              {showRotating && (
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={placeholderIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="text-mute font-sans text-lg leading-relaxed"
                    >
                      {ROTATING_PLACEHOLDERS[placeholderIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-data border px-2 py-1 font-mono text-xs",
                  isUrl ? "border-signal/40 text-signal" : "border-line text-mute"
                )}
              >
                {isUrl ? <Link2 className="size-3" /> : <FileText className="size-3" />}
                {isUrl ? "Link" : "Claim"}
              </span>
              {!isEmpty && (
                <span className="text-mute font-mono text-xs tabular-nums">
                  {text.trim().length} chars
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-mute hidden items-center gap-1.5 font-mono text-xs sm:inline-flex">
                <Kbd>
                  <CornerDownLeft className="size-3" />
                </Kbd>
                to analyze
              </span>
              <button
                type="submit"
                disabled={isEmpty || isSubmitting}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-data px-4 py-2 font-mono text-sm font-medium tracking-wide uppercase",
                  "bg-signal text-void transition-all duration-[var(--v-duration-hover)]",
                  "hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Analyzing
                  </>
                ) : (
                  <>
                    Analyze
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </form>

      {error && (
        <p role="alert" className="text-refutes font-mono text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-mute mr-1 font-mono text-xs tracking-wide uppercase">Try</span>
        {EXAMPLE_CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => applyExample(chip.text)}
              className={cn(
                "group inline-flex items-center gap-1.5 rounded-data border px-2.5 py-1.5 font-mono text-xs",
                "border-line text-text-2 hover:border-line-strong hover:bg-panel-raised hover:text-text",
                "transition-colors duration-[var(--v-duration-hover)]"
              )}
            >
              <Icon className="text-mute group-hover:text-signal size-3 transition-colors" />
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
