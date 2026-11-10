import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/types";
import { cn, mmss } from "@/utils/format";
import { spring } from "@/components/ui/primitives";
import { Portal } from "@/components/ui/overlays";

/* ------------------------------------------------------------------ */
/*  Video player                                                        */
/* ------------------------------------------------------------------ */

export function VideoPlayer({
  item,
  className,
  autoplay = false,
  rounded = "rounded-2xl",
}: {
  item: MediaItem;
  className?: string;
  autoplay?: boolean;
  rounded?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [showUI, setShowUI] = useState(true);
  const [full, setFull] = useState(false);
  const hideTimer = useRef<number | null>(null);

  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => undefined);
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
    poke();
  }, []);

  const poke = () => {
    setShowUI(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => playing && setShowUI(false), 2600);
  };

  useEffect(() => () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }, []);

  const seek = (clientX: number, el: HTMLElement) => {
    const v = ref.current;
    if (!v || !duration) return;
    const r = el.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    v.currentTime = pct * duration;
    setProgress(pct);
  };

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.();
        setFull(true);
      } else {
        await document.exitFullscreen?.();
        setFull(false);
      }
    } catch {
      setFull((f) => !f);
    }
  };

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (autoplay && ref.current) void ref.current.play().catch(() => setPlaying(false));
  }, [autoplay]);

  return (
    <motion.div
      ref={wrapRef}
      layout
      onPointerMove={poke}
      onClick={toggle}
      className={cn(
        "group relative isolate overflow-hidden bg-black select-none",
        rounded,
        full ? "h-full w-full" : className,
      )}
    >
      <video
        ref={ref}
        src={item.src}
        poster={item.poster}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        className={cn("h-full w-full object-cover", full && "object-contain")}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setCurrent(v.currentTime);
          setProgress(v.duration ? v.currentTime / v.duration : 0);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* centre play affordance */}
      <AnimatePresence>
        {!playing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={spring}
            className="pointer-events-none absolute inset-0 grid place-items-center bg-black/25"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-xl">
              <Play className="ml-1 h-7 w-7" fill="currentColor" />
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* controls */}
      <AnimatePresence>
        {showUI && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 pt-8"
          >
            <div
              className="group/seek relative h-5 w-full cursor-pointer"
              onPointerDown={(e) => seek(e.clientX, e.currentTarget)}
              role="slider"
              aria-label="Seek video"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(current)}
              tabIndex={0}
              onKeyDown={(e) => {
                const v = ref.current;
                if (!v) return;
                if (e.key === "ArrowRight") v.currentTime = Math.min(duration, v.currentTime + 5);
                if (e.key === "ArrowLeft") v.currentTime = Math.max(0, v.currentTime - 5);
              }}
            >
              <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-brand" style={{ width: `${progress * 100}%` }} />
              </div>
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand opacity-0 shadow transition-opacity group-hover/seek:opacity-100"
                style={{ left: `${progress * 100}%` }}
              />
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-white">
              <CtlButton label={playing ? "Pause" : "Play"} onClick={toggle}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </CtlButton>
              <CtlButton
                label={muted ? "Unmute" : "Mute"}
                onClick={() => {
                  setMuted((m) => !m);
                  if (ref.current) ref.current.muted = !muted;
                }}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </CtlButton>
              <span className="ml-1 text-[11px] font-semibold tabular-nums text-white/80">
                {mmss(current)} / {mmss(duration)}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <CtlButton label={full ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
                  {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </CtlButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CtlButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-full bg-white/14 backdrop-blur-md transition-colors hover:bg-white/25"
    >
      {children}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/*  Media grid inside a post                                            */
/* ------------------------------------------------------------------ */

export function MediaGrid({
  items,
  onOpen,
  autoPlay = false,
}: {
  items: MediaItem[];
  onOpen: (index: number) => void;
  autoPlay?: boolean;
}) {
  const layout =
    items.length === 1
      ? "grid-cols-1"
      : items.length === 2
        ? "grid-cols-2"
        : items.length === 3
          ? "grid-cols-2 grid-rows-2"
          : "grid-cols-2 grid-rows-2";

  return (
    <div className={cn("mt-3 grid gap-1.5 overflow-hidden rounded-2xl", layout)}>
      {items.slice(0, 4).map((item, i) => (
        <motion.button
          key={item.id}
          layout
          whileTap={{ scale: 0.985 }}
          onClick={() => onOpen(i)}
          className={cn(
            "relative overflow-hidden bg-ink/6",
            items.length === 3 && i === 0 && "row-span-2",
            items.length === 1 ? "aspect-[16/10]" : "aspect-square",
          )}
        >
          {item.kind === "video" ? (
            <VideoPlayer
              item={item}
              className="h-full w-full"
              rounded="rounded-none"
              autoplay={autoPlay && items.length === 1 && i === 0}
            />
          ) : (
            <>
              <img
                src={item.src}
                alt={item.alt ?? "Post media"}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.04]"
              />
              {items.length > 4 && i === 3 && (
                <span className="absolute inset-0 grid place-items-center bg-black/55 text-xl font-extrabold text-white">
                  +{items.length - 4}
                </span>
              )}
            </>
          )}
        </motion.button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fullscreen media viewer (zoom, swipe, keyboard)                     */
/* ------------------------------------------------------------------ */

export function MediaViewer({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const item = items[index];
  const [zoomed, setZoomed] = useState(false);
  const [scale, setScale] = useState(1);
  const pinch = useRef<{ id: number; x: number; y: number }[]>([]);
  const pinchStart = useRef(0);
  const y = useMotionValue(0);
  const bgOpacity = useTransform(y, [-260, 0, 260], [0.15, 1, 0.15]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1) onIndexChange(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onIndexChange, index, items.length]);

  useEffect(() => {
    setZoomed(false);
    setScale(1);
  }, [index]);

  const dist = (pts: { x: number; y: number }[]) => Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);

  const onPointerDownZoom = (e: React.PointerEvent) => {
    pinch.current = [...pinch.current.filter((p) => p.id !== e.pointerId), { id: e.pointerId, x: e.clientX, y: e.clientY }];
    if (pinch.current.length === 2) pinchStart.current = dist(pinch.current);
  };
  const onPointerMoveZoom = (e: React.PointerEvent) => {
    pinch.current = pinch.current.map((p) => (p.id === e.pointerId ? { ...p, x: e.clientX, y: e.clientY } : p));
    if (pinch.current.length === 2 && pinchStart.current > 0) {
      const next = clampScale((dist(pinch.current) / pinchStart.current) * scale);
      setScale(next);
      setZoomed(next > 1.05);
    }
  };
  const onPointerUpZoom = (e: React.PointerEvent) => {
    pinch.current = pinch.current.filter((p) => p.id !== e.pointerId);
    if (pinch.current.length < 2) pinchStart.current = 0;
  };

  if (!item) return null;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (zoomed) return;
    if (Math.abs(info.offset.y) > 130 || Math.abs(info.velocity.y) > 700) onClose();
    else if (info.offset.x < -70 && index < items.length - 1) onIndexChange(index + 1);
    else if (info.offset.x > 70 && index > 0) onIndexChange(index - 1);
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[95] flex flex-col bg-black"
      >
        <motion.div style={{ opacity: bgOpacity }} className="absolute inset-0 bg-black" />

        <div className="relative z-10 flex items-center gap-3 p-4" style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            aria-label="Close viewer"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-xl"
          >
            <X className="h-5 w-5" />
          </motion.button>
          <span className="text-[13px] font-bold tabular-nums text-white/85">
            {index + 1} / {items.length}
          </span>
          {item.alt && <span className="ml-2 truncate text-[13px] text-white/55">{item.alt}</span>}
        </div>

        <motion.div
          style={{ y }}
          onPointerDown={onPointerDownZoom}
          onPointerMove={onPointerMoveZoom}
          onPointerUp={onPointerUpZoom}
          onPointerCancel={onPointerUpZoom}
          onWheel={(e) => {
            if (!item || item.kind !== "image") return;
            const next = clampScale(scale - e.deltaY * 0.0016);
            setScale(next);
            setZoomed(next > 1.05);
          }}
          drag={zoomed ? false : "y"}
          dragElastic={0.12}
          onDragEnd={onDragEnd}
          className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-3 pb-6"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={spring}
              drag={zoomed ? true : false}
              dragElastic={0.08}
              onDoubleClick={() => {
                const next = zoomed ? 1 : 2.2;
                setScale(next);
                setZoomed(next > 1.05);
              }}
              className="relative max-h-full max-w-full overflow-hidden rounded-2xl"
            >
              {item.kind === "video" ? (
                <VideoPlayer item={item} autoplay className="max-h-[76vh] w-[min(96vw,900px)]" rounded="rounded-2xl" />
              ) : (
                <img
                  src={item.src}
                  alt={item.alt ?? "Media"}
                  className="max-h-[76vh] w-auto max-w-[96vw] object-contain"
                />
              )}
            </motion.div>
          </AnimatePresence>

          {items.length > 1 && (
            <>
              <NavArrow dir="left" disabled={index === 0} onClick={() => onIndexChange(index - 1)} />
              <NavArrow dir="right" disabled={index === items.length - 1} onClick={() => onIndexChange(index + 1)} />
            </>
          )}
        </motion.div>

        <div className="relative z-10 flex justify-center gap-1.5 pb-6">
          {items.map((it, i) => (
            <button
              key={it.id}
              onClick={() => onIndexChange(i)}
              aria-label={`Go to media ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-6 bg-brand" : "w-1.5 bg-white/35 hover:bg-white/60",
              )}
            />
          ))}
        </div>
        <p className="pointer-events-none relative z-10 pb-4 text-center text-[11px] font-semibold text-white/40">
          Pinch, scroll or double-tap to zoom · swipe down to close · arrow keys to browse
        </p>
      </motion.div>
    </Portal>
  );
}

const clampScale = (v: number) => Math.min(4, Math.max(1, v));

function NavArrow({ dir, onClick, disabled }: { dir: "left" | "right"; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Previous" : "Next"}
      className={cn(
        "absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-xl md:grid",
        dir === "left" ? "left-5" : "right-5",
        disabled && "pointer-events-none opacity-25",
      )}
    >
      {dir === "left" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </motion.button>
  );
}
