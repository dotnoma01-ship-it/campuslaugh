import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Check, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useSystem, type BannerPayload } from "@/context/SystemContext";
import { Avatar } from "@/components/ui/primitives";
import { Portal } from "@/components/ui/overlays";
import { spring } from "@/components/ui/primitives";
import { cn, timeAgo } from "@/utils/format";

/* ------------------------------------------------------------------ */
/*  Floating notification banners (system-style)                        */
/* ------------------------------------------------------------------ */

function Banner({ banner, onDismiss }: { banner: BannerPayload; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-7, 7]);
  const opacity = useTransform(x, [-260, -90, 0, 90, 260], [0, 1, 1, 1, 0]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -90, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -70, scale: 0.94, filter: "blur(4px)" }}
      transition={spring}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.75}
      style={{ x, rotate, opacity }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 110 || Math.abs(info.velocity.x) > 550) onDismiss();
      }}
      className="pointer-events-auto w-full max-w-md"
    >
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.4, bottom: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.y < -60 || info.velocity.y < -400) onDismiss();
        }}
        className="glass-solid overflow-hidden rounded-[24px]"
      >
        <div className="relative flex gap-3 p-3">
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <button
            onClick={() => {
              banner.onOpen?.();
              onDismiss();
            }}
            aria-label={`Open ${banner.title}`}
            className="press shrink-0"
          >
            {banner.avatar ? (
              <Avatar src={banner.avatar} name={banner.title} size={42} />
            ) : (
              <span className="grid h-[42px] w-[42px] place-items-center rounded-full bg-brand/16 text-brand">
                {banner.icon ?? <Sparkles className="h-5 w-5" />}
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="truncate text-[13.5px] font-extrabold text-ink">{banner.title}</p>
              <span className="ml-auto shrink-0 text-[11px] font-semibold text-ink3">
                {banner.time === "now" ? "now" : timeAgo(Date.now())}
              </span>
            </div>
            <p className={cn("text-[13px] leading-snug text-ink2", !expanded && "line-clamp-1")}>{banner.body}</p>

            <AnimatePresence initial={false}>
              {expanded && banner.expandedBody && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden pt-1 text-[12px] text-ink3"
                >
                  {banner.expandedBody}
                </motion.p>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {replying && banner.onReply && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!draft.trim()) return;
                    banner.onReply?.(draft.trim());
                    setDraft("");
                    setReplying(false);
                    onDismiss();
                  }}
                  className="mt-2 flex items-center gap-2 overflow-hidden"
                >
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Quick reply…"
                    className="field h-9 flex-1 rounded-full px-3.5 text-[13px] outline-none"
                  />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    type="submit"
                    aria-label="Send reply"
                    className="grid h-9 w-9 place-items-center rounded-full bg-brand text-onbrand"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="mt-2 flex items-center gap-1.5">
              <BannerAction
                label={expanded ? "Less" : "More"}
                onClick={() => setExpanded((v) => !v)}
                icon={<ArrowRight className={cn("h-3 w-3 transition-transform", expanded && "-rotate-90")} />}
              />
              {banner.onReply && !replying && (
                <BannerAction label="Reply" onClick={() => setReplying(true)} icon={<MessageCircle className="h-3 w-3" />} />
              )}
              {banner.onMarkRead && (
                <BannerAction
                  label="Mark read"
                  onClick={() => {
                    banner.onMarkRead?.();
                    onDismiss();
                  }}
                  icon={<Check className="h-3 w-3" />}
                />
              )}
              {banner.onOpen && (
                <BannerAction
                  label="Open"
                  primary
                  onClick={() => {
                    banner.onOpen?.();
                    onDismiss();
                  }}
                  icon={<ArrowRight className="h-3 w-3" />}
                />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BannerAction({
  label,
  onClick,
  icon,
  primary,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "press inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-bold",
        primary
          ? "border-transparent bg-brand text-onbrand"
          : "border-line bg-glass text-ink2 hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function BannerHost() {
  const { banners, dismissBanner } = useSystem();
  return (
    <Portal>
      <div className="pointer-events-none fixed inset-x-0 top-[68px] z-[88] flex flex-col items-center gap-2 px-3 lg:top-5 lg:items-end lg:pr-5">
        <AnimatePresence initial={false}>
          {banners.map((b) => (
            <Banner key={b.id} banner={b} onDismiss={() => dismissBanner(b.id)} />
          ))}
        </AnimatePresence>
      </div>
    </Portal>
  );
}

/* ------------------------------------------------------------------ */
/*  Island — CampusLaugh's floating capsule (Dynamic-Island-inspired)    */
/* ------------------------------------------------------------------ */

export function Island() {
  const { island, hideIsland } = useSystem();
  const [hovered, setHovered] = useState(false);
  const expanded = !!island && hovered;

  useEffect(() => {
    if (!island) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hideIsland();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [island, hideIsland]);

  return (
    <Portal>
      <div className="pointer-events-none fixed inset-x-0 top-2 z-[90] flex justify-center px-3">
        <AnimatePresence mode="wait">
          {island && (
            <motion.button
              key={island.id}
              layout
              onClick={() => {
                island.onOpen?.();
                hideIsland();
              }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              initial={{ opacity: 0, scale: 0.72, y: -22 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.78, y: -16 }}
              transition={spring}
              className={cn(
                "glass-solid pointer-events-auto flex items-center gap-2.5 overflow-hidden rounded-full border-white/10 px-3 text-left",
                expanded ? "max-w-[min(440px,92vw)] py-2.5" : "py-1.5",
              )}
            >
              <span className="relative grid h-6 w-6 shrink-0 place-items-center">
                <span className="absolute inset-0 rounded-full bg-brand/25" />
                <motion.span
                  animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0.15, 0.7] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-brand/40"
                />
                {island.leading ?? <span className="relative h-2 w-2 rounded-full bg-brand" />}
              </span>

              <span className="min-w-0 flex-1">
                <motion.span
                  layout
                  className={cn(
                    "block truncate font-extrabold text-ink",
                    expanded ? "text-[13px]" : "text-[11.5px]",
                  )}
                >
                  {island.title}
                </motion.span>
                <AnimatePresence initial={false}>
                  {(expanded || island.subtitle) && (
                    <motion.span
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="block truncate text-[11.5px] text-ink2"
                    >
                      {island.subtitle}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>

              <AnimatePresence>
                {expanded && island.trailing && (
                  <motion.span
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="shrink-0"
                  >
                    {island.trailing}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  );
}
