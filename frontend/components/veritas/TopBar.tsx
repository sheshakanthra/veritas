"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { UserMenu } from "@/components/veritas/UserMenu";
import { Kbd } from "@/components/veritas/primitives";

const HIDE_ON = ["/login", "/signup"];

/** Persistent app chrome: wordmark, global search trigger, account.
 * Hidden on the auth pages, which are their own centered surfaces. */
export function TopBar() {
  const pathname = usePathname();
  if (HIDE_ON.includes(pathname)) return null;

  return (
    <header className="border-line bg-void/70 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="text-text inline-flex items-center gap-2 font-mono text-sm font-semibold tracking-[0.2em]"
        >
          <span aria-hidden className="bg-signal size-2 rounded-full" />
          VERITAS
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("veritas:command"))}
            className="border-line bg-panel text-mute hover:text-text hover:border-line-strong group inline-flex items-center gap-2 rounded-data border px-2.5 py-1.5 transition-colors duration-[var(--v-duration-hover)]"
            aria-label="Open command menu"
          >
            <Search className="size-3.5" />
            <span className="hidden font-mono text-xs sm:inline">Search</span>
            <Kbd className="ml-0.5">⌘K</Kbd>
          </button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
