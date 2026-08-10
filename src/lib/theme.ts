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
    key: "camo",
    label: "Camo",
    className: "theme-camo",
    swatch: ["#4b5320", "#78866b", "#3b3126", "#1c1c15"],
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
  {
    key: "nebula",
    label: "Nebula",
    className: "theme-nebula",
    swatch: ["#150c26", "#a855f7", "#e9b3ff", "#2b1a4d"],
    premium: true,
  },
  {
    key: "sunset",
    label: "Sunset",
    className: "theme-sunset",
    swatch: ["#1d1109", "#ff8a3d", "#ffd08a", "#7a2d1a"],
    premium: true,
  },
  {
    key: "arctic",
    label: "Arctic",
    className: "theme-arctic",
    swatch: ["#eef4fb", "#7fb3e8", "#3b6fa8", "#dbe8f7"],
    premium: true,
  },
  {
    key: "rosegold",
    label: "Rose Gold",
    className: "theme-rosegold",
    swatch: ["#1a0f0f", "#e8b4a0", "#f7d9c8", "#4a2a24"],
    premium: true,
  },
  {
    key: "cyber",
    label: "Cyber",
    className: "theme-cyber",
    swatch: ["#0d0518", "#ff2fa8", "#25e5ff", "#2a0f3d"],
    premium: true,
  },
  {
    key: "emerald",
    label: "Emerald",
    className: "theme-emerald",
    swatch: ["#0b1a14", "#2fbf8f", "#a8f0d4", "#153a2c"],
    premium: true,
  },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];

export function isPremiumTheme(key: string): boolean {
  return THEMES.some((t) => t.key === key && "premium" in t && t.premium === true);
}

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
