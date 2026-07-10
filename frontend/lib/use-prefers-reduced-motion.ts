import { useCallback, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * framer-motion's own `useReducedMotion()` can resolve synchronously on
 * the client's very first render (it reads matchMedia eagerly), while the
 * server can never know this value - that mismatch caused a real
 * hydration warning on the hero's typed placeholder (server always
 * renders as if reduced-motion is unknown; a client whose OS/browser
 * actually prefers reduced motion resolved to the opposite branch before
 * hydration even committed). useSyncExternalStore guarantees the
 * server snapshot is used for the client's hydration pass too, with the
 * real value only taking effect on the next render - the same fix
 * already applied to useIsMobile in components/spine/Spine.tsx.
 */
export function usePrefersReducedMotion(): boolean {
  const subscribe = useCallback((callback: () => void) => {
    const query = window.matchMedia(QUERY);
    query.addEventListener("change", callback);
    return () => query.removeEventListener("change", callback);
  }, []);
  const getSnapshot = useCallback(() => window.matchMedia(QUERY).matches, []);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
