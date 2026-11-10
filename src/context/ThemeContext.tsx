import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePersistentState } from "@/hooks";
import type { Settings, ThemeMode } from "@/types";

export const defaultSettings: Settings = {
  theme: "dark",
  accent: "lime",
  whoCanMessage: "campus",
  onlineVisibility: true,
  readReceipts: true,
  institutionVisibility: true,
  notifyMessages: true,
  notifyLikes: true,
  notifyComments: true,
  notifyFollowers: true,
  notifyMentions: true,
  notifyCampus: true,
  sound: false,
  vibration: true,
  banners: true,
  island: true,
  reduceMotion: false,
  mediaAutoplay: true,
  wallpaper: "midnight",
  compactFeed: false,
  simulateErrors: false,
  demoActivity: true,
};

interface ThemeCtx {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  resolved: "light" | "dark";
  accentVar: string;
  reducedMotion: boolean;
}

const Ctx = createContext<ThemeCtx | null>(null);

const ACCENTS: Record<Settings["accent"], string> = {
  lime: "#B7F34A",
  mint: "#4FD8B0",
  coral: "#FF7A59",
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = usePersistentState<Settings>("campuslaugh:settings", defaultSettings);
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolved: "light" | "dark" =
    settings.theme === "system" ? (systemDark ? "dark" : "light") : settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", resolved === "dark" ? "#08090B" : "#F2F3F6");
  }, [resolved]);

  useEffect(() => {
    document.documentElement.style.setProperty("--color-brand", ACCENTS[settings.accent]);
  }, [settings.accent]);

  const update = useCallback<ThemeCtx["update"]>(
    (key, value) => setSettings((s) => ({ ...s, [key]: value })),
    [setSettings],
  );

  const value = useMemo<ThemeCtx>(
    () => ({
      settings,
      update,
      reset: () => setSettings(defaultSettings),
      theme: settings.theme,
      setTheme: (t) => update("theme", t),
      resolved,
      accentVar: ACCENTS[settings.accent],
      reducedMotion: settings.reduceMotion,
    }),
    [settings, update, setSettings, resolved],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
