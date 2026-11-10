import { useCallback, useEffect, useRef, useState } from "react";
import { readStore, writeStore } from "@/utils/format";

/** State that survives reloads via localStorage. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStore<T>(key, initial));
  useEffect(() => {
    writeStore(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

/** "up" when the user scrolls toward the top, "down" when away. */
export function useScrollDirection(target: HTMLElement | Window | null = window, threshold = 6) {
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [y, setY] = useState(0);
  const last = useRef(0);

  useEffect(() => {
    if (!target) return;
    const onScroll = () => {
      const current = "scrollY" in target ? target.scrollY : target.scrollTop;
      setY(current);
      if (Math.abs(current - last.current) > threshold) {
        setDirection(current > last.current && current > 80 ? "down" : "up");
        last.current = current;
      }
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [target, threshold]);

  return { direction, y };
}

export function useOnClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  handler: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return;
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener, { passive: true });
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler, active]);
}

export function useEscape(handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler, active]);
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

interface LongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  duration?: number;
}

/** Pointer-based long press that still allows a normal tap through. */
export function useLongPress({ onLongPress, onClick, duration = 420 }: LongPressOptions) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(() => {
    fired.current = false;
    clear();
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, duration);
  }, [clear, duration, onLongPress]);

  const cancel = useCallback(() => clear(), [clear]);

  const click = useCallback(() => {
    clear();
    if (!fired.current) onClick?.();
    fired.current = false;
  }, [clear, onClick]);

  useEffect(() => clear, [clear]);

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClick: click,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      clear();
      fired.current = true;
      onLongPress();
    },
  };
}

/** Tracks the scroll progress (0 → 1) of an element. */
export function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? el.scrollTop / max : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [ref]);
  return progress;
}
