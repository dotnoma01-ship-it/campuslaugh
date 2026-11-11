import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bookmark,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share,
  ShieldAlert,
  Trash2,
  EyeOff,
  BadgeCheck,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSystem } from "@/context/SystemContext";
import { useTheme } from "@/context/ThemeContext";
import { useStore } from "@/context/StoreContext";
import { ME, reportReasons } from "@/data/constants";
import type { MediaItem, Post } from "@/types";
import { cn, compact, copyText, timeAgo } from "@/utils/format";
import { Avatar, IconButton } from "@/components/ui/primitives";
import { springSnappy } from "@/components/ui/primitives";
import { ContextMenu, useContextMenu } from "@/components/ui/overlays";
import { MediaGrid, MediaViewer } from "./Media";
import { CommentsSheet } from "./CommentsSheet";

/* ------------------------------------------------------------------ */
/*  Rich text: highlights #hashtags and @mentions                       */
/* ------------------------------------------------------------------ */

export function RichText({ text, className }: { text: string; className?: string }) {
  const navigate = useNavigate();
  const parts = useMemo(() => text.split(/(#[\w]+|@[\w.]+)/g), [text]);
  return (
    <p className={cn("whitespace-pre-wrap text-[14.5px] leading-[1.62] text-ink", className)}>
      {parts.map((part, i) => {
        if (part.startsWith("#"))
          return (
            <button
              key={i}
              onClick={() => navigate(`/explore?q=${encodeURIComponent(part.slice(1))}`)}
              className="font-semibold text-brand transition-opacity hover:opacity-75"
            >
              {part}
            </button>
          );
        if (part.startsWith("@"))
          return (
            <button
              key={i}
              onClick={() => navigate(`/explore?q=${encodeURIComponent(part.slice(1))}`)}
              className="font-semibold text-mint transition-opacity hover:opacity-75"
            >
              {part}
            </button>
          );
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Like button with particle burst                                     */
/* ------------------------------------------------------------------ */

interface Burst {
  id: number;
  angle: number;
  dist: number;
  size: number;
}

export function LikeButton({ liked, count, onToggle }: { liked?: boolean; count: number; onToggle: () => void }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const idRef = useRef(0);

  const fire = () => {
    const next: Burst[] = Array.from({ length: 9 }, () => ({
      id: idRef.current++,
      angle: Math.random() * Math.PI * 2,
      dist: 26 + Math.random() * 30,
      size: 4 + Math.random() * 5,
    }));
    setBursts((b) => [...b, ...next]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => !next.includes(x))), 750);
  };

  return (
    <motion.button
      onClick={() => {
        if (!liked) fire();
        onToggle();
      }}
      whileTap={{ scale: 0.86 }}
      aria-pressed={!!liked}
      aria-label={liked ? "Unlike post" : "Like post"}
      className={cn(
        "press relative inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-bold transition-colors",
        liked ? "text-coral" : "text-ink2 hover:text-ink",
      )}
    >
      <span className="relative grid h-5 w-5 place-items-center">
        <AnimatePresence>
          {bursts.map((b) => (
            <motion.span
              key={b.id}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{
                opacity: 0,
                x: Math.cos(b.angle) * b.dist,
                y: Math.sin(b.angle) * b.dist,
                scale: 0.2,
              }}
              transition={{ duration: 0.68, ease: [0.16, 0.8, 0.3, 1] }}
              className="absolute rounded-full"
              style={{
                width: b.size,
                height: b.size,
                background: b.id % 3 === 0 ? "#FF7A59" : "var(--color-brand)",
                boxShadow: "0 0 8px rgba(183,243,74,.6)",
              }}
            />
          ))}
        </AnimatePresence>
        <motion.span
          key={liked ? "on" : "off"}
          initial={liked ? { scale: 0.4 } : false}
          animate={{ scale: liked ? [0.4, 1.32, 0.94, 1.06, 1] : 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <Heart className="h-[19px] w-[19px]" fill={liked ? "currentColor" : "none"} strokeWidth={2.1} />
        </motion.span>
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={count}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={springSnappy}
          className="tabular-nums"
        >
          {compact(count)}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/** Big floating heart for double-tap likes. */
export function DoubleTapHeart({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.25, 1, 1.35] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, times: [0, 0.25, 0.6, 1] }}
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
        >
          <Heart className="h-24 w-24 text-brand drop-shadow-[0_8px_24px_rgba(0,0,0,.55)]" fill="currentColor" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Post card                                                           */
/* ------------------------------------------------------------------ */

export function PostCard({
  post,
  dense,
  onOpenProfile,
  onOpenPost,
}: {
  post: Post;
  dense?: boolean;
  onOpenProfile?: (userId: string) => void;
  onOpenPost?: (postId: string) => void;
}) {
  const { userById, toggleLike, toggleBookmark, toggleRepost, hidePost, reportPost, votePoll, deletePost } = useStore();
  const { toast, showOverlay, actionSheet, haptic, confirm } = useSystem();
  const { settings } = useTheme();
  const navigate = useNavigate();
  const menu = useContextMenu();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [viewer, setViewer] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const [doubleTap, setDoubleTap] = useState(false);
  const [pollVote, setPollVote] = useState<string | null>(null);
  const [longPressAt, setLongPressAt] = useState<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const author = userById(post.authorId);
  const isAnon = !!post.anonymous;
  const mine = post.authorId === ME;

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLongPressAt({ x: e.clientX, y: e.clientY });
    menu.openFromEvent(e);
  };

  const handleSurfaceTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!post.liked) toggleLike(post.id);
      setDoubleTap(true);
      haptic([8, 30, 8]);
      window.setTimeout(() => setDoubleTap(false), 900);
    }
    lastTap.current = now;
  };

  const copyLink = async () => {
    const ok = await copyText(`https://campuslaugh.app/post/${post.id}`);
    toast({
      title: ok ? "Link copied" : "Couldn't copy link",
      description: ok ? "campuslaugh.app/post/" + post.id : undefined,
      tone: ok ? "success" : "error",
    });
  };

  const sharePost = () => showOverlay({ kind: "share", postId: post.id });

  const deleteWithConfirm = async (id: string) => {
    const ok = await confirm({
      title: "Delete this post?",
      message: "It will be removed from your profile and everyone's feed. This can't be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (ok) deletePost(id);
  };

  const reportFlow = async () => {
    const choice = await actionSheet({
      title: "Report this post?",
      message: "Reports are sent to the CampusLaugh moderation queue.",
      actions: reportReasons.map((r) => ({ id: r, label: r })),
    });
    if (choice) reportPost(post.id, choice);
  };

  const totalPollVotes = post.poll ? post.poll.options.reduce((s, o) => s + o.votes, 0) : 0;

  return (
    <>
      <motion.article
        layout="position"
        initial={{ opacity: 0, y: 26, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96, y: -10, transition: { duration: 0.22 } }}
        transition={springSoftLocal}
        whileHover={{ y: -2 }}
        className="glass glass-sheen group relative overflow-hidden rounded-[26px]"
        onPointerDown={(e) => {
          const t = window.setTimeout(() => {
            setLongPressAt({ x: e.clientX, y: e.clientY });
            menu.openAt(e.clientX, e.clientY);
            haptic(14);
          }, 520);
          const cancel = () => window.clearTimeout(t);
          e.currentTarget.addEventListener("pointerup", cancel, { once: true });
          e.currentTarget.addEventListener("pointermove", cancel, { once: true });
          e.currentTarget.addEventListener("pointercancel", cancel, { once: true });
        }}
      >
        {post.reposted && (
          <div className="flex items-center gap-1.5 px-4 pt-3 text-[11.5px] font-bold uppercase tracking-wide text-ink3">
            <Repeat2 className="h-3.5 w-3.5" /> You reposted this
          </div>
        )}

        <header className="flex items-start gap-3 px-4 pt-3.5">
          <button onClick={() => (isAnon ? undefined : onOpenProfile?.(post.authorId))} className="press shrink-0">
            <Avatar
              src={isAnon ? undefined : author.avatar}
              name={isAnon ? "Anonymous" : author.name}
              anonymous={isAnon}
              size={dense ? 36 : 42}
              online={!isAnon && author.online}
            />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <button
                onClick={() => onOpenProfile?.(post.authorId)}
                className="truncate text-[14.5px] font-extrabold tracking-[-0.01em] text-ink hover:underline"
              >
                {isAnon ? "Anonymous" : author.name}
              </button>
              {!isAnon && author.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand" fill="currentColor" />}
              <span className="truncate text-[12.5px] text-ink3">
                @{isAnon ? "anonymous" : author.username}
              </span>
              <span className="text-ink3">·</span>
              <time className="shrink-0 text-[12.5px] text-ink3" dateTime={new Date(post.createdAt).toISOString()}>
                {timeAgo(post.createdAt)}
              </time>
            </div>
            <button
              onClick={() => navigate(`/explore?q=${encodeURIComponent(post.campus)}`)}
              className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[11.5px] font-semibold text-ink2 hover:text-brand"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span className="truncate">{isAnon ? "Hidden campus" : author.institution}</span>
            </button>
          </div>

          <IconButton label="More options" size="sm" onClick={openMenu}>
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
        </header>

        <div onClick={handleSurfaceTap} className="relative cursor-default px-4 pb-1 pt-2.5">
          <DoubleTapHeart show={doubleTap} />
          <RichText text={post.text} />
        </div>

        {post.poll && (
          <div className="mx-4 mt-3 space-y-2 rounded-2xl border border-line bg-glass p-3">
            <p className="text-[13px] font-extrabold text-ink">{post.poll.question}</p>
            {post.poll.options.map((o) => {
              const pct = totalPollVotes ? Math.round((o.votes / totalPollVotes) * 100) : 0;
              const voted = pollVote === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => {
                    if (pollVote) return;
                    setPollVote(o.id);
                    votePoll(post.id, o.id);
                  }}
                  className={cn(
                    "relative block w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors",
                    voted ? "border-brand/50" : "border-line hover:border-line2",
                  )}
                >
                  {pollVote && (
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${voted ? pct : pct}%` }}
                      transition={{ duration: 0.7, ease: [0.16, 0.8, 0.3, 1] }}
                      className={cn("absolute inset-y-0 left-0", voted ? "bg-brand/26" : "bg-ink/7")}
                    />
                  )}
                  <span className="relative flex items-center justify-between gap-2 text-[13px] font-semibold text-ink">
                    <span className="truncate">{o.label}</span>
                    {pollVote && <span className="shrink-0 tabular-nums text-ink2">{pct}%</span>}
                  </span>
                </button>
              );
            })}
            <p className="text-[11.5px] font-semibold text-ink3">
              {compact(totalPollVotes + (pollVote ? 1 : 0))} votes
            </p>
          </div>
        )}

        {post.media?.length ? (
          <div className="px-4 pb-1">
            <MediaGrid
              items={post.media}
              autoPlay={settings.mediaAutoplay}
              onOpen={(i) => setViewer({ items: post.media!, index: i })}
            />
          </div>
        ) : null}

        <footer className="flex items-center gap-1 px-2.5 py-2">
          <LikeButton liked={post.liked} count={post.likes} onToggle={() => toggleLike(post.id)} />

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setCommentsOpen(true)}
            aria-label={`Comments (${post.comments.length})`}
            className="press inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-bold text-ink2 hover:text-sky2"
          >
            <MessageCircle className="h-[19px] w-[19px]" strokeWidth={2.1} />
            <span className="tabular-nums">{compact(post.comments.length)}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={(e) => {
              e.stopPropagation();
              setLongPressAt({ x: e.clientX, y: e.clientY });
              void actionSheet({
                title: "Repost",
                message: `${compact(post.reposts)} reposts · reach ${post.campus} and beyond`,
                actions: [
                  {
                    id: "repost",
                    label: post.reposted ? "Undo repost" : "Repost to your feed",
                    icon: <Repeat2 className="h-4 w-4" />,
                    tone: "brand",
                    onSelect: () => toggleRepost(post.id),
                  },
                  {
                    id: "quote",
                    label: "Quote post",
                    icon: <MessageCircle className="h-4 w-4" />,
                    onSelect: () => {
                      showOverlay({ kind: "post", postId: post.id });
                      toast({ title: "Quote composer opened", description: "Add your take above the post", tone: "info" });
                    },
                  },
                  { id: "copy", label: "Copy link to post", icon: <Link2 className="h-4 w-4" />, onSelect: () => void copyLink() },
                  { id: "stats", label: "View post insights", icon: <BarChart3 className="h-4 w-4" />, onSelect: () => onOpenPost?.(post.id) ?? showOverlay({ kind: "post", postId: post.id }) },
                ],
              });
            }}
            aria-label="Repost"
            className={cn(
              "press inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-bold",
              post.reposted ? "text-mint" : "text-ink2 hover:text-mint",
            )}
          >
            <Repeat2 className="h-[19px] w-[19px]" strokeWidth={2.1} />
            <span className="tabular-nums">{compact(post.reposts)}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => toggleBookmark(post.id)}
            aria-pressed={!!post.bookmarked}
            aria-label="Bookmark post"
            className={cn(
              "press inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-bold",
              post.bookmarked ? "text-brand" : "text-ink2 hover:text-ink",
            )}
          >
            <motion.span
              animate={post.bookmarked ? { y: [0, -5, 0], rotate: [0, -8, 0] } : {}}
              transition={{ duration: 0.42 }}
            >
              <Bookmark className="h-[19px] w-[19px]" fill={post.bookmarked ? "currentColor" : "none"} strokeWidth={2.1} />
            </motion.span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={sharePost}
            aria-label="Share post"
            className="press ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-bold text-ink2 hover:text-ink"
          >
            <Share className="h-[18px] w-[18px]" strokeWidth={2.1} />
          </motion.button>
        </footer>

        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11.5px] font-semibold text-ink3">
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> {compact(post.views)} views
          </span>
          {post.hashtags.length > 0 && (
            <span className="truncate">{post.hashtags.map((h) => `#${h}`).join(" ")}</span>
          )}
        </div>
      </motion.article>

      <ContextMenu
        open={menu.open}
        onClose={menu.close}
        x={longPressAt?.x ?? menu.x}
        y={longPressAt?.y ?? menu.y}
        header={
          <div className="flex items-center gap-2">
            <Avatar src={isAnon ? undefined : author.avatar} name={isAnon ? "Anonymous" : author.name} size={28} anonymous={isAnon} />
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-bold text-ink">{isAnon ? "Anonymous post" : `@${author.username}`}</p>
              <p className="truncate text-[11px] text-ink3">{post.campus}</p>
            </div>
          </div>
        }
        items={[
          { id: "save", label: post.bookmarked ? "Remove bookmark" : "Save post", icon: <Bookmark className="h-4 w-4" />, onSelect: () => toggleBookmark(post.id) },
          { id: "copy", label: "Copy link", icon: <Link2 className="h-4 w-4" />, onSelect: () => void copyLink() },
          { id: "share", label: "Share…", icon: <Share className="h-4 w-4" />, onSelect: sharePost },
          { id: "profile", label: isAnon ? "About anonymous posts" : `View @${author.username}`, icon: <BadgeCheck className="h-4 w-4" />, onSelect: () => onOpenProfile?.(post.authorId) },
          ...(mine
            ? [{ id: "delete", label: "Delete post", icon: <Trash2 className="h-4 w-4" />, tone: "danger" as const, onSelect: () => void deleteWithConfirm(post.id) }]
            : [
                { id: "hide", label: "Hide this post", icon: <EyeOff className="h-4 w-4" />, onSelect: () => hidePost(post.id) },
                { id: "report", label: "Report post", icon: <ShieldAlert className="h-4 w-4" />, tone: "danger" as const, onSelect: () => void reportFlow() },
              ]),
        ]}
      />

      <CommentsSheet post={post} open={commentsOpen} onClose={() => setCommentsOpen(false)} />

      <AnimatePresence>
        {viewer && (
          <MediaViewer
            items={viewer.items}
            index={viewer.index}
            onClose={() => setViewer(null)}
            onIndexChange={(i) => setViewer({ ...viewer, index: i })}
          />
        )}
      </AnimatePresence>
    </>
  );
}

const springSoftLocal = { type: "spring" as const, stiffness: 300, damping: 32 };
