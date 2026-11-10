import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import type { SheetAction, ToastItem } from "@/types";
import { uid, vibrate } from "@/utils/format";

export type OverlayRequest =
  | { kind: "post"; postId: string }
  | { kind: "profile"; userId: string }
  | { kind: "share"; postId: string }
  | { kind: "report"; postId: string }
  | { kind: "media"; src: string; poster?: string; alt?: string; kind2: "image" | "video" }
  | null;

export interface BannerPayload {
  id: string;
  title: string;
  body: string;
  avatar?: string;
  icon?: React.ReactNode;
  time: string;
  tone?: "default" | "message" | "system";
  onOpen?: () => void;
  onReply?: (text: string) => void;
  onMarkRead?: () => void;
  expandedBody?: string;
}

export interface IslandPayload {
  id: string;
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  expand?: React.ReactNode;
  tone?: string;
  onOpen?: () => void;
  duration?: number;
}

interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "brand" | "default";
}

interface SystemCtx {
  toasts: ToastItem[];
  toast: (t: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;

  banners: BannerPayload[];
  pushBanner: (b: Omit<BannerPayload, "id"> & { id?: string }) => void;
  dismissBanner: (id: string) => void;

  island: IslandPayload | null;
  showIsland: (i: Omit<IslandPayload, "id"> & { id?: string }) => void;
  hideIsland: () => void;

  overlay: OverlayRequest;
  showOverlay: (o: OverlayRequest) => void;
  closeOverlay: () => void;

  confirm: (req: ConfirmRequest) => Promise<boolean>;
  confirmState: (ConfirmRequest & { resolve: (v: boolean) => void }) | null;
  resolveConfirm: (value: boolean) => void;

  actionSheet: (req: { title?: string; message?: string; actions: SheetAction[] }) => Promise<string | null>;
  sheetState: {
    title?: string;
    message?: string;
    actions: SheetAction[];
    resolve: (v: string | null) => void;
  } | null;
  resolveSheet: (id: string | null) => void;

  playSound: (type?: "pop" | "chime" | "send") => void;
  haptic: (pattern?: number | number[]) => void;
}

const Ctx = createContext<SystemCtx | null>(null);

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [banners, setBanners] = useState<BannerPayload[]>([]);
  const [island, setIsland] = useState<IslandPayload | null>(null);
  const [overlay, setOverlay] = useState<OverlayRequest>(null);
  const [confirmState, setConfirmState] = useState<SystemCtx["confirmState"]>(null);
  const [sheetState, setSheetState] = useState<SystemCtx["sheetState"]>(null);

  const audioRef = useRef<AudioContext | null>(null);
  const unlockedRef = useRef(false);

  /* unlock WebAudio on the first real user gesture (browser policy) */
  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) audioRef.current = new AC();
      } catch {
        audioRef.current = null;
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audioRef.current?.close().catch(() => undefined);
    };
  }, []);

  const playSound = useCallback<SystemCtx["playSound"]>(
    (type = "pop") => {
      if (!settings.sound || !audioRef.current) return;
      try {
        const ctx = audioRef.current;
        if (ctx.state === "suspended") void ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const base = type === "chime" ? 880 : type === "send" ? 620 : 440;
        osc.type = "sine";
        osc.frequency.setValueAtTime(base, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(base * (type === "send" ? 1.8 : 1.35), ctx.currentTime + 0.09);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.24);
      } catch {
        /* audio is a nicety, never a requirement */
      }
    },
    [settings.sound],
  );

  const haptic = useCallback<SystemCtx["haptic"]>(
    (pattern = 8) => {
      if (settings.vibration) vibrate(pattern);
    },
    [settings.vibration],
  );

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<SystemCtx["toast"]>(
    (t) => {
      const id = uid("toast");
      const item: ToastItem = { id, tone: "success", duration: 3200, ...t };
      setToasts((prev) => [...prev.slice(-2), item]);
      if (item.duration && item.duration > 0) {
        window.setTimeout(() => dismissToast(id), item.duration);
      }
      return id;
    },
    [dismissToast],
  );

  const dismissBanner = useCallback((id: string) => setBanners((b) => b.filter((x) => x.id !== id)), []);

  const pushBanner = useCallback<SystemCtx["pushBanner"]>(
    (b) => {
      if (!settings.banners) return;
      const id = b.id ?? uid("ban");
      setBanners((prev) => [...prev.slice(-1), { ...b, id }]);
      playSound("chime");
      haptic([10, 30, 10]);
      window.setTimeout(() => setBanners((prev) => prev.filter((x) => x.id !== id)), 6500);
    },
    [settings.banners, playSound, haptic],
  );

  const islandTimer = useRef<number | null>(null);
  const hideIsland = useCallback(() => setIsland(null), []);

  const showIsland = useCallback<SystemCtx["showIsland"]>((i) => {
    if (!settings.island) return;
    const id = i.id ?? uid("isl");
    setIsland({ ...i, id });
    if (islandTimer.current) window.clearTimeout(islandTimer.current);
    islandTimer.current = window.setTimeout(() => setIsland(null), i.duration ?? 4200);
  }, [settings.island]);

  const showOverlay = useCallback((o: OverlayRequest) => setOverlay(o), []);
  const closeOverlay = useCallback(() => setOverlay(null), []);

  const confirm = useCallback<SystemCtx["confirm"]>(
    (req) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ confirmLabel: "Confirm", cancelLabel: "Cancel", tone: "default", ...req, resolve });
      }),
    [],
  );

  const resolveConfirm = useCallback(
    (value: boolean) => {
      confirmState?.resolve(value);
      setConfirmState(null);
    },
    [confirmState],
  );

  const actionSheet = useCallback<SystemCtx["actionSheet"]>(
    (req) => new Promise<string | null>((resolve) => setSheetState({ ...req, resolve })),
    [],
  );

  const resolveSheet = useCallback(
    (id: string | null) => {
      sheetState?.resolve(id);
      setSheetState(null);
    },
    [sheetState],
  );

  const value = useMemo<SystemCtx>(
    () => ({
      toasts,
      toast,
      dismissToast,
      banners,
      pushBanner,
      dismissBanner,
      island,
      showIsland,
      hideIsland,
      overlay,
      showOverlay,
      closeOverlay,
      confirm,
      confirmState,
      resolveConfirm,
      actionSheet,
      sheetState,
      resolveSheet,
      playSound,
      haptic,
    }),
    [
      toasts, toast, dismissToast, banners, pushBanner, dismissBanner, island, showIsland, hideIsland,
      overlay, showOverlay, closeOverlay, confirm, confirmState, resolveConfirm, actionSheet, sheetState,
      resolveSheet, playSound, haptic,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSystem() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSystem must be used inside SystemProvider");
  return ctx;
}
