export type Theme = "dark" | "light";

export const THEME_COOKIE = "veritas-theme";

/**
 * Inline, render-blocking script string injected into <head>. Reads the
 * theme cookie if present (a user's explicit toggle survives reload), or
 * falls back to prefers-color-scheme on first-ever visit. Runs before
 * paint so there is no flash of the wrong theme. No localStorage per the
 * project's hard constraint - a cookie is the persistence mechanism, and
 * it's also what lets the server-rendered <html> pick the right theme on
 * the very first response (see app/layout.tsx).
 */
export function themeInitScript(): string {
  return `(function(){try{
    var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(dark|light)/);
    var theme=m?m[1]:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
    document.documentElement.setAttribute('data-theme',theme);
  }catch(e){}})();`;
}

export function readThemeCookie(cookieHeader: string | undefined): Theme {
  if (!cookieHeader) return "dark";
  const match = cookieHeader.match(new RegExp(`${THEME_COOKIE}=(dark|light)`));
  return match ? (match[1] as Theme) : "dark";
}

export function setThemeCookie(theme: Theme): void {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${oneYear}; SameSite=Lax`;
}
