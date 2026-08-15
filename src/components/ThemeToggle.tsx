"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readTheme(): Theme {
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : getSystemTheme();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setTheme(theme: Theme) {
  localStorage.setItem("theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  listeners.forEach((listener) => listener());
}

// null on the server -- theme depends on localStorage/OS preference, which
// the server can't know. useSyncExternalStore (rather than a
// useState+useEffect pair) keeps this both hydration-safe and re-render
// correct when toggle() fires.
function getServerSnapshot(): Theme | null {
  return null;
}

// Shared by anything that needs to know the current theme reactively (e.g.
// picking chart colors) without duplicating the read/subscribe logic below.
export function useTheme(): Theme | null {
  return useSyncExternalStore<Theme | null>(subscribe, readTheme, getServerSnapshot);
}

export function ThemeToggle({
  className = "text-on-surface-variant hover:bg-surface-container-high",
}: {
  className?: string;
}) {
  const theme = useSyncExternalStore<Theme | null>(subscribe, readTheme, getServerSnapshot);

  if (theme === null) {
    return <div className="h-9 w-9" aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${className}`}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor" className="h-5 w-5">
          <circle cx="10" cy="10" r="4" />
          <path
            d="M10 1.7v2M10 16.3v2M18.3 10h-2M3.7 10h-2M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4M15.7 15.7l-1.4-1.4M5.7 5.7 4.3 4.3"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor" className="h-5 w-5">
          <path d="M17.5 11.2A7.5 7.5 0 1 1 8.8 2.5a6 6 0 0 0 8.7 8.7Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
