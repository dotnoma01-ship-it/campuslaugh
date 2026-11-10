import { AnimatePresence, motion } from "framer-motion";
import {
  AtSign,
  Check,
  EyeOff,
  Film,
  Hash,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import { trending, userArray } from "@/data/mock";
import type { MediaItem } from "@/types";
import { cn, extractTags, uid } from "@/utils/format";
import { Avatar, Button } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/overlays";
import { springSnappy } from "@/components/ui/primitives";

const LIMIT = 500;

const sampleMedia: { id: string; src: string; alt: string }[] = [
  { id: "s1", src: "https://images.pexels.com/photos/7972544/pexels-photo-7972544.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=500&w=700", alt: "Students grouping on campus" },
  { id: "s2", src: "https://images.pexels.com/photos/30714883/pexels-photo-30714883.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=500&w=700", alt: "Friends laughing outdoors" },
  { id: "s3", src: "https://images.pexels.com/photos/6140610/pexels-photo-6140610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=500&w=700", alt: "Students in a corridor" },
];

export function Composer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createPost, me } = useStore();
  const { toast, confirm, haptic } = useSystem();
  const [text, setText] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const remaining = LIMIT - text.length;
  const pct = Math.min(1, text.length / LIMIT);

  useEffect(() => {
    if (open) {
      setText("");
      setMedia([]);
      setAnonymous(false);
      setDone(false);
      setPublishing(false);
      setShowSamples(false);
      window.setTimeout(() => areaRef.current?.focus(), 260);
    }
  }, [open]);

  useEffect(() => {
    const match = /(^|\s)@([\w.]*)$/.exec(text);
    setMentionQuery(match ? match[2]! : null);
  }, [text]);

  const mentions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return userArray.filter((u) => u.username.includes(q) || u.name.toLowerCase().includes(q)).slice(0, 5);
  }, [mentionQuery]);

  const suggestions = useMemo(() => trending.slice(0, 5).map((t) => t.tag), []);

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: MediaItem[] = Array.from(files)
      .slice(0, 4 - media.length)
      .map((f) => ({
        id: uid("m"),
        kind: f.type.startsWith("video") ? "video" : "image",
        src: URL.createObjectURL(f),
        alt: f.name,
      }));
    if (!next.length) {
      toast({ title: "Up to 4 media items per post", tone: "warning" });
      return;
    }
    setMedia((m) => [...m, ...next]);
    haptic(6);
  };

  const publish = async () => {
    if (!text.trim() && !media.length) {
      toast({ title: "Write something first", description: "A post needs text or media", tone: "warning" });
      return;
    }
    if (remaining < 0) {
      toast({ title: `Trim ${-remaining} characters`, tone: "error" });
      return;
    }
    setPublishing(true);
    try {
      await createPost({ text: text.trim(), media: media.length ? media : undefined, anonymous });
      setPublishing(false);
      setDone(true);
      haptic([8, 26, 8]);
      toast({
        title: "Post published 🍋",
        description: anonymous ? "Posted anonymously to your campus" : `Posted as @${me.username}`,
        tone: "success",
        actionLabel: "View",
        onAction: () => onClose(),
      });
      window.setTimeout(() => {
        onClose();
        window.setTimeout(() => setDone(false), 300);
      }, 850);
    } catch (error) {
      setPublishing(false);
      toast({ title: "Post wasn’t published", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    }
  };

  const requestClose = async () => {
    if (text.trim() || media.length) {
      const ok = await confirm({
        title: "Discard this post?",
        message: "Everything you've written will be lost.",
        confirmLabel: "Discard",
        cancelLabel: "Keep writing",
        tone: "danger",
      });
      if (!ok) return;
    }
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => void requestClose()}
      grabber
      desktop="center"
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <span>New post</span>
          <AnimatePresence>
            {anonymous && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-bold text-ink2"
              >
                Anonymous
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <ComposerIcon label="Add photo" onClick={() => fileRef.current?.click()}>
              <ImageIcon className="h-[18px] w-[18px]" />
            </ComposerIcon>
            <ComposerIcon label="Add video" onClick={() => fileRef.current?.click()}>
              <Film className="h-[18px] w-[18px]" />
            </ComposerIcon>
            <ComposerIcon label="Add demo media" active={showSamples} onClick={() => setShowSamples((s) => !s)}>
              <Sparkles className="h-[18px] w-[18px]" />
            </ComposerIcon>
            <ComposerIcon label="Tag campus (demo)" onClick={() => toast({ title: "Campus tagged", description: me.campus, tone: "info" })}>
              <MapPin className="h-[18px] w-[18px]" />
            </ComposerIcon>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <CounterRing pct={pct} remaining={remaining} />
            <Button
              variant="brand"
              size="md"
              loading={publishing}
              onClick={() => void publish()}
              icon={done ? <Check className="h-4 w-4" /> : undefined}
            >
              {done ? "Published" : publishing ? "Publishing" : "Publish"}
            </Button>
          </div>
        </div>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="px-4 pb-4">
        <div className="flex items-start gap-3">
          <Avatar
            src={anonymous ? undefined : me.avatar}
            name={anonymous ? "Anonymous" : me.name}
            anonymous={anonymous}
            size={40}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-extrabold text-ink">
              {anonymous ? "Posting anonymously" : me.name}
            </p>
            <p className="truncate text-[11.5px] text-ink3">
              {anonymous ? "Your name stays hidden" : `${me.campus} · Public`}
            </p>
          </div>
          <button
            onClick={() => setAnonymous((a) => !a)}
            aria-pressed={anonymous}
            className={cn(
              "press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold",
              anonymous ? "border-brand/40 bg-brand/14 text-brand" : "border-line text-ink2",
            )}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Anon
          </button>
        </div>

        <div className="relative mt-3">
          <textarea
            ref={areaRef}
            value={text}
            maxLength={LIMIT + 40}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="What's making your campus laugh today?"
            aria-label="Post text"
            className="w-full resize-none bg-transparent text-[16px] leading-relaxed text-ink outline-none placeholder:text-ink3"
          />

          <AnimatePresence>
            {mentions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="glass-solid absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-2xl p-1"
              >
                {mentions.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setText((t) => t.replace(/@([\w.]*)$/, `@${u.username} `));
                      areaRef.current?.focus();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-ink/8"
                  >
                    <Avatar src={u.avatar} name={u.name} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-ink">{u.name}</span>
                      <span className="block truncate text-[11.5px] text-ink3">@{u.username}</span>
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-ink3">
            <Hash className="h-3 w-3" /> Add tag
          </span>
          {suggestions.map((s) => {
            const has = extractTags(text).includes(s);
            return (
              <button
                key={s}
                onClick={() => setText((t) => (has ? t : `${t}${t.endsWith(" ") || !t ? "" : " "}#${s} `))}
                className={cn(
                  "press rounded-full border px-2.5 py-1 text-[11.5px] font-bold",
                  has ? "border-brand/40 bg-brand/14 text-brand" : "border-line text-ink2 hover:text-ink",
                )}
              >
                #{s}
              </button>
            );
          })}
          <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-ink3">
            <AtSign className="h-3 w-3" /> type @ to mention
          </span>
        </div>

        <AnimatePresence>
          {(media.length > 0 || showSamples) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              {media.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <AnimatePresence>
                    {media.map((mm) => (
                      <motion.div
                        key={mm.id}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={springSnappy}
                        className="group relative aspect-square overflow-hidden rounded-2xl border border-line"
                      >
                        {mm.kind === "video" ? (
                          <video src={mm.src} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          <img src={mm.src} alt={mm.alt ?? "Attached"} className="h-full w-full object-cover" />
                        )}
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          {mm.kind}
                        </span>
                        <button
                          onClick={() => setMedia((prev) => prev.filter((x) => x.id !== mm.id))}
                          aria-label="Remove media"
                          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {showSamples && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink3">
                    Demo media (frontend sample assets)
                  </p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {sampleMedia.map((sm) => (
                      <button
                        key={sm.id}
                        onClick={() =>
                          setMedia((m) =>
                            m.length >= 4
                              ? m
                              : [...m, { id: uid("m"), kind: "image", src: sm.src, alt: sm.alt }],
                          )
                        }
                        className="press relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-line"
                      >
                        <img src={sm.src} alt={sm.alt} loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/45 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="grid h-20 w-20 place-items-center rounded-full bg-brand text-onbrand"
            >
              {publishing ? <Loader2 className="h-9 w-9 animate-spin" /> : <Check className="h-10 w-10" strokeWidth={3} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BottomSheet>
  );
}

function ComposerIcon({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border transition-colors",
        active ? "border-brand/40 bg-brand/16 text-brand" : "border-line text-ink2 hover:text-ink",
      )}
    >
      {children}
    </motion.button>
  );
}

function CounterRing({ pct, remaining }: { pct: number; remaining: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  const color = remaining < 0 ? "#FF7A59" : remaining < 60 ? "#ffcb5c" : "var(--color-brand)";
  return (
    <div className="relative grid h-8 w-8 place-items-center">
      <svg viewBox="0 0 28 28" className="absolute inset-0 -rotate-90">
        <circle cx="14" cy="14" r={r} fill="none" stroke="currentColor" className="text-ink/12" strokeWidth="2.4" />
        <motion.circle
          cx="14"
          cy="14"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.25 }}
        />
      </svg>
      {remaining <= 80 && (
        <span
          className={cn("text-[10px] font-extrabold tabular-nums", remaining < 0 ? "text-coral" : "text-ink2")}
        >
          {remaining}
        </span>
      )}
    </div>
  );
}

export function TrashHint() {
  return <Trash2 className="h-4 w-4" />;
}
