import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * VERITAS design-system primitives. Small, composable, and the single
 * source for surface / label / stat treatments so every page reads as
 * one instrument rather than a set of unrelated screens.
 * ------------------------------------------------------------------ */

/** A surface. `raised` stacks it a step lighter; `interactive` adds a
 * hover lift + border brighten for clickable panels. */
export function Panel({
  className,
  raised = false,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { raised?: boolean; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-panel border",
        raised ? "bg-panel-raised border-line" : "bg-panel border-line",
        interactive &&
          "transition-[transform,border-color,box-shadow] duration-[var(--v-duration-enter)] ease-[var(--v-ease-enter)] hover:border-line-strong hover:shadow-[var(--v-shadow-md)] hover:-translate-y-0.5",
        className
      )}
      {...props}
    />
  );
}

/** Eyebrow / section label - mono, uppercase, tracked, with a leading
 * tick. Encodes "this is a labelled region of an instrument", not decor. */
export function Eyebrow({
  className,
  children,
  tick = true,
  ...props
}: React.ComponentProps<"div"> & { tick?: boolean }) {
  return (
    <div
      className={cn(
        "text-mute flex items-center gap-2 font-mono text-xs tracking-[0.18em] uppercase",
        className
      )}
      {...props}
    >
      {tick && <span aria-hidden className="bg-signal inline-block h-px w-5" />}
      {children}
    </div>
  );
}

/** A measured value: mono figure over a mute label. The number is always
 * the loud element; the label whispers what it measures. */
export function Stat({
  value,
  label,
  sub,
  className,
  valueClassName,
}: {
  value: React.ReactNode;
  label: string;
  sub?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className={cn("text-text font-mono text-2xl leading-none tabular-nums", valueClassName)}>
        {value}
      </span>
      <span className="text-mute font-mono text-xs tracking-wide uppercase">{label}</span>
      {sub && <span className="text-mute text-xs">{sub}</span>}
    </div>
  );
}

/** Keyboard key chip. */
export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "border-line bg-panel-raised text-mute inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border px-1.5 font-mono text-[11px] leading-none",
        className
      )}
    >
      {children}
    </kbd>
  );
}
