import { useEffect, useState } from "react";
import { IconButton } from "./IconButton";

type Theme = "light" | "dark";

const STORAGE_KEY = "soteria-theme";

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function applyStoredTheme() {
  const stored = readStored();
  if (stored) document.documentElement.dataset.theme = stored;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(() => readStored());

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable — the in-memory toggle still works */
    }
  }, [theme]);

  const resolved: Theme =
    theme ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");
  const next: Theme = resolved === "dark" ? "light" : "dark";

  return (
    <IconButton
      label={`Switch to ${next} theme`}
      aria-pressed={resolved === "dark"}
      onClick={() => setTheme(next)}
    >
      {resolved === "dark" ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="8" cy="8" r="3.2" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M13 3l-1.4 1.4M4.4 11.6L3 13" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" />
        </svg>
      )}
    </IconButton>
  );
}
