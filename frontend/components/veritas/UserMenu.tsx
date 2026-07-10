"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentUser, logout, type AuthUser } from "@/lib/api";

/**
 * The session cookie is httpOnly, so client JS cannot read it - asking
 * the backend via /me is the honest way to know who is logged in.
 */
export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        // Backend unreachable - render nothing rather than a broken menu.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Even if the request fails, send the user to /login - the
      // middleware will bounce them back if the cookie is still valid.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="fixed top-6 right-6 z-10 flex items-center gap-3">
      <span className="text-mute font-mono text-xs">{user.email}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="border-line text-mute hover:border-signal hover:text-text rounded-data duration-hover border px-2.5 py-1 font-mono text-xs transition-colors"
      >
        Logout
      </button>
    </div>
  );
}
