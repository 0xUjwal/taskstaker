import { useEffect, useState } from "react";

const KEY = "ts_theme";

export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "light") root.classList.add("light-mode");
  else root.classList.remove("light-mode");
}

export function getStoredTheme() {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

// Dark stays the default. The choice is remembered on this device.
export default function ThemeToggle() {
  const [mode, setMode] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  function toggle() {
    const next = mode === "light" ? "dark" : "light";
    try { localStorage.setItem(KEY, next); } catch {}
    setMode(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
      title={mode === "light" ? "Dark mode" : "Light mode"}
      className="p-2 hover:bg-surface-variant/50 rounded-lg transition-colors"
    >
      <span className="material-symbols-outlined text-on-surface-variant text-xl">
        {mode === "light" ? "dark_mode" : "light_mode"}
      </span>
    </button>
  );
}
