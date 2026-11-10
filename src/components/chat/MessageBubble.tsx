import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCheck, Clock3, FileText, Forward, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { Message } from "@/types";
import { clockTime, cn, mmss } from "@/utils/format";
import { Avatar } from "@/components/ui/primitives";
import { springSnappy } from "@/components/ui/primitives";

export function StatusTicks({ status }: { status?: Message["status"] }) {
  if (!status) return null;
  if (status === "sending") return <Clock3 className="h-3 w-3 text-ink3" />;
  if (status === "sent") return <Check className="h-3.5 w-3.5 text-ink3" />;
  return (
    <CheckCheck className={cn("h-3.5 w-3.5", status === "read" ? "text-brand" : "text-ink3")} />
  );
}

export function VoiceNote({ message }: { message: Message }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duration = message.duration ?? 12;

  useEffect(() => {
    if (message.media?.src) {
      const a = new Audio(message.media.src);
      audioRef.current = a;
      a.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
      });
      return () => {
        a.pause();
        audioRef.current = null;
      };
    }
    return undefined;
  }, [message.media?.src]);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (audio) {
      if (playing) {
        audio.pause();
        setPlaying(false);
        if (timer.current) window.clearInterval(timer.current);
      } else {
        void audio.play().catch(() => undefined);
        setPlaying(true);
        timer.current = window.setInterval(() => {
          if (audio.duration) setProgress(audio.currentTime / audio.duration);
        }, 120);
      }
      return;
    }
    /* no real audio (demo voice note) — animate a synthetic waveform */
    if (playing) {
      setPlaying(false);
      if (timer.current) window.clearInterval(timer.current);
      return;
    }
    setPlaying(true);
    const started = Date.now() - progress * duration * 1000;
    timer.current = window.setInterval(() => {
      const p = (Date.now() - started) / (duration * 1000);
      if (p >= 1) {
        setProgress(0);
        setPlaying(false);
        if (timer.current) window.clearInterval(timer.current);
      } else setProgress(p);
    }, 90);
  };

  const bars = 26;
  const seed = message.id.charCodeAt(2) ?? 3;

  return (
    <div className="flex min-w-[190px] items-center gap-2.5 py-0.5">
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full",
          message.mine ? "bg-onbrand/85 text-brand" : "bg-brand text-onbrand",
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
      </motion.button>
      <div className="flex h-8 flex-1 items-center gap-[2.5px]">
        {Array.from({ length: bars }).map((_, i) => {
          const active = i / bars <= progress;
          const h = 6 + Math.abs(Math.sin((i + seed) * 1.7)) * 20;
          return (
            <motion.span
              key={i}
              animate={playing && active ? { scaleY: [1, 1.28, 0.86, 1] } : { scaleY: 1 }}
              transition={{ duration: 0.7, repeat: playing && active ? Infinity : 0, delay: i * 0.02 }}
              className={cn(
                "w-[3px] origin-center rounded-full transition-colors duration-200",
                active ? (message.mine ? "bg-onbrand" : "bg-brand") : message.mine ? "bg-onbrand/28" : "bg-ink/22",
              )}
              style={{ height: h }}
            />
          );
        })}
      </div>
      <span className="shrink-0 text-[11px] font-bold tabular-nums opacity-70">
        {mmss(playing || progress ? progress * duration : duration)}
      </span>
    </div>
  );
}

export function MessageBubble({
  message,
  showAvatar,
  grouped,
  onOpenMenu,
  onReplyPreview,
  highlighted,
  inGroup,
}: {
  message: Message;
  showAvatar?: boolean;
  grouped?: boolean;
  onOpenMenu: (e: { clientX: number; clientY: number }, message: Message) => void;
  onReplyPreview?: (message: Message) => void;
  highlighted?: boolean;
  inGroup?: boolean;
}) {
  const { userById } = useStore();
  const author = userById(message.authorId);
  const mine = message.mine;

  const radius = cn(
    "rounded-[22px]",
    mine
      ? grouped
        ? "rounded-br-[22px] rounded-tr-[8px]"
        : "rounded-br-[8px]"
      : grouped
        ? "rounded-bl-[22px] rounded-tl-[8px]"
        : "rounded-bl-[8px]",
  );

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={springSnappy}
      className={cn("group/msg flex w-full items-end gap-2 px-1", mine ? "flex-row-reverse" : "flex-row")}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenMenu({ clientX: e.clientX, clientY: e.clientY }, message);
      }}
    >
      {inGroup && !mine && (
        <div className="w-7 shrink-0">
          {showAvatar && <Avatar src={author.avatar} name={author.name} size={28} />}
        </div>
      )}

      <div className={cn("flex max-w-[min(78%,520px)] flex-col", mine ? "items-end" : "items-start")}>
        {inGroup && !mine && showAvatar && !message.deleted && (
          <span className="mb-1 ml-1 text-[11px] font-bold text-ink3">{author.name.split(" ")[0]}</span>
        )}

        <motion.button
          whileTap={{ scale: 0.985 }}
          onPointerDown={(e) => {
            const t = window.setTimeout(() => onOpenMenu({ clientX: e.clientX, clientY: e.clientY }, message), 460);
            const cancel = () => window.clearTimeout(t);
            e.currentTarget.addEventListener("pointerup", cancel, { once: true });
            e.currentTarget.addEventListener("pointermove", cancel, { once: true });
            e.currentTarget.addEventListener("pointercancel", cancel, { once: true });
          }}
          onClick={() => undefined}
          className={cn(
            "relative block w-full overflow-hidden border text-left",
            radius,
            highlighted && "ring-2 ring-brand",
            message.deleted
              ? "border-line bg-glass"
              : mine
                ? "border-brand/30 bg-brand/92 text-onbrand shadow-[0_10px_26px_-16px_rgba(183,243,74,.9)]"
                : "border-line bg-glass2 backdrop-blur-2xl",
          )}
        >
          {message.replyTo && !message.deleted && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onReplyPreview?.(message);
              }}
              className={cn(
                "mb-1 flex items-start gap-1.5 rounded-xl border-l-2 px-2.5 py-1.5 text-[12px] leading-snug",
                mine ? "border-onbrand/60 bg-onbrand/8" : "border-brand bg-brand/10",
              )}
              role="button"
              tabIndex={0}
            >
              <span className={cn("min-w-0 flex-1")}>
                <span className={cn("block truncate text-[11.5px] font-extrabold", mine ? "text-onbrand/80" : "text-brand")}>
                  {userById(message.replyTo.authorId).name}
                </span>
                <span className={cn("block truncate", mine ? "text-onbrand/70" : "text-ink2")}>
                  {message.replyTo.text}
                </span>
              </span>
            </span>
          )}

          <span className="block px-3.5 pt-2.5">
            {message.forwarded && !message.deleted && (
              <span className={cn("mb-1 flex items-center gap-1 text-[11px] font-bold", mine ? "text-onbrand/70" : "text-ink3")}>
                <Forward className="h-3 w-3" /> Forwarded
              </span>
            )}

            {message.deleted ? (
              <span className="block pb-2.5 text-[13.5px] italic text-ink3">🚫 {message.text}</span>
            ) : message.kind === "voice" ? (
              <span className="block pb-2">
                <VoiceNote message={message} />
              </span>
            ) : message.kind === "image" && message.media ? (
              <span className="-mx-3.5 -mt-2.5 block">
                <img src={message.media.src} alt={message.media.alt ?? "Shared photo"} loading="lazy" className="max-h-[320px] w-full object-cover" />
                {message.text && (
                  <span className="block px-3.5 pt-2 text-[14px] leading-snug">{message.text}</span>
                )}
              </span>
            ) : message.kind === "video" && message.media ? (
              <span className="-mx-3.5 -mt-2.5 block">
                <video src={message.media.src} poster={message.media.poster} controls playsInline className="max-h-[340px] w-full bg-black object-cover" />
              </span>
            ) : message.kind === "document" ? (
              <span className="flex items-center gap-2.5 pb-2.5">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", mine ? "bg-onbrand/12" : "bg-brand/16 text-brand")}>
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold">{message.fileName}</span>
                  <span className={cn("block text-[11.5px]", mine ? "text-onbrand/70" : "text-ink3")}>{message.fileSize}</span>
                </span>
              </span>
            ) : (
              <span className="block whitespace-pre-wrap pb-2.5 text-[14.5px] leading-[1.5]">{message.text}</span>
            )}
          </span>

          <span className={cn("flex items-center justify-end gap-1 px-3 pb-2 text-[10.5px] font-semibold", mine ? "text-onbrand/65" : "text-ink3")}>
            {message.edited && !message.deleted && <span className="italic">edited</span>}
            <span className="tabular-nums">{clockTime(message.createdAt)}</span>
            {mine && <StatusTicks status={message.status} />}
          </span>

          {/* reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <span
              className={cn(
                "absolute -bottom-2.5 flex gap-0.5 rounded-full border border-line bg-[var(--c-surface)] px-1.5 py-0.5 shadow-md",
                mine ? "right-2" : "left-2",
              )}
            >
              <AnimatePresence>
                {message.reactions.map((r) => (
                  <motion.span
                    key={r.emoji}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    className={cn("text-[12px] leading-none", r.byMe && "ring-1 ring-brand/60 rounded-full px-0.5")}
                  >
                    {r.emoji}
                    {r.count > 1 && <span className="ml-0.5 text-[9.5px] font-bold text-ink3">{r.count}</span>}
                  </motion.span>
                ))}
              </AnimatePresence>
            </span>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

export function TypingBubble({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-end gap-2 px-1"
    >
      <div className="glass2 flex items-center gap-1.5 rounded-[20px] rounded-bl-[8px] border border-line px-3.5 py-3 backdrop-blur-2xl">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot h-1.5 w-1.5 rounded-full bg-ink2"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
      <span className="mb-1 text-[11px] font-semibold text-ink3">{name} is typing…</span>
    </motion.div>
  );
}
