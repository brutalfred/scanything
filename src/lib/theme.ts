export const THEMES = [
  {
    key: "gold",
    label: "Gold",
    className: "",
    swatch: ["#0a0a0a", "#c9a84c", "#f0d78c", "#1a1a1a"],
  },
  {
    key: "matrix",
    label: "Matrix",
    className: "theme-matrix",
    swatch: ["#000000", "#00ff41", "#0a2f14", "#7dffa8"],
  },
  {
    key: "jungle",
    label: "Jungle",
    className: "theme-jungle",
    swatch: ["#1a3c2a", "#2d5a3d", "#5a8a5c", "#a0c49d"],
  },
  {
    key: "peach",
    label: "Peach",
    className: "theme-peach",
    swatch: ["#fff5f0", "#f8c8d8", "#e88aab", "#bfe3f5"],
  },
  {
    key: "water",
    label: "Water",
    className: "theme-water",
    swatch: ["#0c2340", "#1a4a6e", "#2d8a9e", "#8fd6ea"],
  },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];

export const THEME_STORAGE_KEY = "scanything-theme";

export function isThemeKey(v: unknown): v is ThemeKey {
  return typeof v === "string" && THEMES.some((t) => t.key === v);
}

export function applyTheme(key: ThemeKey) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const t of THEMES) if (t.className) root.classList.remove(t.className);
  const next = THEMES.find((t) => t.key === key);
  if (next?.className) root.classList.add(next.className);
}
