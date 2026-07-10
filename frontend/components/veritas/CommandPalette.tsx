"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { BarChart3, CornerDownLeft, LogOut, Moon, Plus, Search } from "lucide-react";
import { logout } from "@/lib/api";
import { setThemeCookie, type Theme } from "@/lib/theme";
import { Kbd } from "@/components/veritas/primitives";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon: typeof Search;
  run: () => void | Promise<void>;
}

/**
 * Global command menu. Opens on Cmd/Ctrl-K or the "veritas:command" event
 * dispatched by the top bar. Self-contained: manages its own open state so
 * no cross-tree wiring is needed.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "new",
        label: "New analysis",
        hint: "Home",
        keywords: "search claim verify home",
        icon: Plus,
        run: () => router.push("/"),
      },
      {
        id: "calibration",
        label: "View calibration report",
        hint: "Reliability",
        keywords: "confidence reliability accuracy",
        icon: BarChart3,
        run: () => router.push("/calibration"),
      },
      {
        id: "theme",
        label: "Toggle theme",
        hint: "Light / dark",
        keywords: "dark light appearance lab",
        icon: Moon,
        run: () => {
          const el = document.documentElement;
          const next: Theme = el.getAttribute("data-theme") === "light" ? "dark" : "light";
          el.setAttribute("data-theme", next);
          setThemeCookie(next);
        },
      },
      {
        id: "logout",
        label: "Log out",
        keywords: "sign out session",
        icon: LogOut,
        run: async () => {
          try {
            await logout();
          } catch {
            /* fall through to the login page regardless */
          }
          router.push("/login");
          router.refresh();
        },
      },
    ],
    [router]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  // Mirror open into a ref so the global key handler can branch on it
  // without re-subscribing on every open/close.
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) setOpen(false);
        else openPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("veritas:command", openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("veritas:command", openPalette);
    };
  }, [openPalette]);

  function handleQueryChange(next: string) {
    setQuery(next);
    setActive(0);
  }

  function runAt(index: number) {
    const cmd = filtered[index];
    if (!cmd) return;
    setOpen(false);
    void cmd.run();
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className={cn(
            "rounded-overlay border-line bg-panel-raised fixed top-[16vh] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden border shadow-[var(--v-popover-shadow)] outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0"
          )}
          onKeyDown={onListKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          <div className="border-line flex items-center gap-3 border-b px-4">
            <Search className="text-mute size-4 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Type a command…"
              className="text-text placeholder:text-mute h-12 w-full bg-transparent font-sans text-sm outline-none"
              aria-label="Command menu"
            />
          </div>

          <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <p className="text-mute px-3 py-6 text-center font-mono text-xs">No matching commands</p>
            )}
            {filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onMouseMove={() => setActive(i)}
                  onClick={() => runAt(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-data px-3 py-2.5 text-left transition-colors",
                    i === active ? "bg-panel-hover text-text" : "text-text-2"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", i === active ? "text-signal" : "text-mute")} />
                  <span className="flex-1 text-sm">{cmd.label}</span>
                  {cmd.hint && <span className="text-mute font-mono text-xs">{cmd.hint}</span>}
                </button>
              );
            })}
          </div>

          <div className="border-line text-mute flex items-center justify-end gap-4 border-t px-4 py-2 font-mono text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>
                <CornerDownLeft className="size-3" />
              </Kbd>
              select
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>esc</Kbd>
              close
            </span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
