"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, FileText, Gauge, Link2, Quote, Search, ShieldQuestion } from "lucide-react";
import { ClaimInput } from "@/components/veritas/ClaimInput";
import { Eyebrow, Panel } from "@/components/veritas/primitives";

const PIPELINE = [
  { key: "ingest", title: "Read", body: "Detect whether the input is a claim, a headline, or a URL, and extract the article text." },
  { key: "decompose", title: "Decompose", body: "Break it into one to five atomic claims that can each be checked on their own." },
  { key: "retrieve", title: "Retrieve", body: "Search the web and evidence corpus, then rank and de-duplicate what comes back." },
  { key: "stance", title: "Weigh", body: "Judge each source as supporting, refuting, or neutral — anchored to a verbatim span." },
  { key: "adjudicate", title: "Adjudicate", body: "Aggregate the stances into a verdict through an explicit, unit-tested rule table." },
  { key: "synthesize", title: "Explain", body: "Write a plain-language verdict grounded only in the quotes that survived review." },
];

const PRINCIPLES = [
  {
    icon: Quote,
    title: "The reasoning is the output",
    body: "Every verdict that isn't “unverifiable” links to a verbatim quote from a real source. A conclusion with no evidence trail is treated as a bug.",
  },
  {
    icon: ShieldQuestion,
    title: "Unverifiable is a real answer",
    body: "When the evidence is thin, VERITAS says so plainly instead of guessing. It is a first-class outcome, never a hidden failure.",
  },
  {
    icon: Gauge,
    title: "Confidence is measured, not claimed",
    body: "Confidence comes from evidence features — source tier, agreement, coverage — and is shown as a calibrated interval, never a bare percentage.",
  },
];

const EXAMPLES = [
  { type: "Statistical", icon: FileText, text: "The new transit line cut average downtown commute times by 30% in its first year." },
  { type: "Headline", icon: Search, text: "Study finds coffee drinkers live ten years longer than everyone else." },
  { type: "Causal", icon: FileText, text: "Switching to renewables caused electricity prices to fall for the first time in a decade." },
  { type: "URL", icon: Link2, text: "https://example.com/press/quarterly-economic-growth-report" },
];

const HERO_STATS = [
  { value: "6", label: "pipeline stages" },
  { value: "4", label: "verdict types" },
  { value: "3", label: "source tiers" },
  { value: "0", label: "unquoted spans" },
];

export function Landing() {
  const [seed, setSeed] = useState<{ value: string; nonce: number } | undefined>(undefined);

  function pick(value: string) {
    setSeed((prev) => ({ value, nonce: (prev?.nonce ?? 0) + 1 }));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="relative overflow-hidden px-6 pt-28 pb-16 sm:pt-32">
        <div aria-hidden className="instrument-glow pointer-events-none absolute inset-0 -z-10" />
        <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0 -z-10" />

        <div className="mx-auto w-full max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Eyebrow className="mb-6">Forensic claim verification</Eyebrow>
            <h1 className="text-text text-5xl leading-[1.03] font-semibold tracking-tight text-balance sm:text-6xl">
              Fact-checking you can audit.
            </h1>
            <p className="text-text-2 mt-6 max-w-xl text-lg leading-relaxed">
              Paste a claim, a headline, or a link. VERITAS breaks it into checkable parts, gathers
              sources, weighs each one, and returns a calibrated verdict — with every conclusion
              traced back to a verbatim quote.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10"
          >
            {/* remount on each example pick so the box re-seeds from initialText */}
            <ClaimInput key={seed?.nonce ?? "base"} initialText={seed?.value} />
          </motion.div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            {HERO_STATS.map((s) => (
              <div key={s.label} className="flex items-baseline gap-2">
                <span className="text-text font-mono text-xl tabular-nums">{s.value}</span>
                <span className="text-mute font-mono text-xs tracking-wide uppercase">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="rule-fade" />
      </div>

      {/* ---- How it works ------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <Eyebrow className="mb-4">How it works</Eyebrow>
          <h2 className="text-text text-3xl font-semibold tracking-tight text-balance">
            Six stages from claim to verdict.
          </h2>
          <p className="text-text-2 mt-3 text-base leading-relaxed">
            A strictly linear pipeline. Each stage is instrumented and timed — you watch the graph
            execute in real time, not a spinner.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE.map((step, i) => (
            <div key={step.key} className="bg-panel p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-mute/70 font-mono text-2xl tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-mute font-mono text-xs tracking-wide lowercase">{step.key}</span>
              </div>
              <h3 className="text-text mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="text-text-2 mt-2 text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Principles --------------------------------------------- */}
      <section className="border-line border-y bg-panel/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <Eyebrow className="mb-4">Why trust it</Eyebrow>
            <h2 className="text-text text-3xl font-semibold tracking-tight text-balance">
              Built to be doubted.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {PRINCIPLES.map((p) => {
              const Icon = p.icon;
              return (
                <Panel key={p.title} className="p-6">
                  <span className="border-line bg-panel-raised text-signal flex size-10 items-center justify-center rounded-card border">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="text-text mt-5 text-lg font-semibold">{p.title}</h3>
                  <p className="text-text-2 mt-2 text-sm leading-relaxed">{p.body}</p>
                </Panel>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- Examples ----------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow className="mb-4">Start here</Eyebrow>
            <h2 className="text-text text-3xl font-semibold tracking-tight text-balance">
              Try a real example.
            </h2>
          </div>
          <p className="text-mute max-w-xs text-sm">
            Pick one to load it into the search above, then analyze.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {EXAMPLES.map((ex) => {
            const Icon = ex.icon;
            return (
              <button key={ex.text} type="button" onClick={() => pick(ex.text)} className="text-left">
                <Panel interactive className="flex h-full flex-col p-6">
                  <div className="flex items-center gap-2">
                    <Icon className="text-signal size-3.5" />
                    <span className="text-mute font-mono text-xs tracking-wide uppercase">{ex.type}</span>
                  </div>
                  <p className="text-text mt-4 flex-1 text-base leading-relaxed">{ex.text}</p>
                  <span className="text-text-2 mt-5 inline-flex items-center gap-1.5 font-mono text-xs tracking-wide uppercase">
                    Analyze this
                    <ArrowRight className="size-3.5" />
                  </span>
                </Panel>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---- Footer ------------------------------------------------- */}
      <footer className="border-line border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-text font-mono text-sm font-semibold tracking-[0.2em]">VERITAS</div>
            <p className="text-mute mt-1 text-sm">Transparent, evidence-backed verdicts.</p>
          </div>
          <nav className="flex items-center gap-6 font-mono text-xs tracking-wide uppercase">
            <Link href="/calibration" className="text-text-2 hover:text-text inline-flex items-center gap-1 transition-colors">
              Calibration
              <ArrowUpRight className="size-3" />
            </Link>
            <span className="text-mute">Mock mode · no network</span>
          </nav>
        </div>
      </footer>
    </main>
  );
}
