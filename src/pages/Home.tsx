import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  BadgeCheck,
  Flame,
  Megaphone,
  Radio,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserPlus,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { backend } from "@/services/backend";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import { useTheme } from "@/context/ThemeContext";
import { campusAnnouncements, trending, userArray } from "@/data/mock";
import type { Post } from "@/types";
import { cn, compact } from "@/utils/format";
import { Avatar, Badge, Button, EmptyState, IconButton, PostSkeleton, Switch } from "@/components/ui/primitives";
import { spring, springSoft } from "@/components/ui/primitives";
import { PostCard } from "@/components/feed/PostCard";
import { Composer } from "@/components/feed/Composer";
import { pageVariants, staggerItem } from "@/components/ui/motion";

type Tab = "foryou" | "following" | "campus";
const TABS: { value: Tab; label: string }[] = [
  { value: "foryou", label: "For You" },
  { value: "following", label: "Following" },
  { value: "campus", label: "My Campus" },
];

export default function Home() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { posts, remotePosts, setRemoteFeed, ready, toggleFollow, isFollowing, ambient, setAmbient, unreadNotifications } = useStore();
  const { toast, showIsland } = useSystem();
  const { settings, update } = useTheme();

  const [tab, setTab] = useState<Tab>("foryou");
  const [extra, setExtra] = useState<Post[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [remoteError, setRemoteError] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [pull, setPull] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const composeOpen = params.get("compose") === "1";

  const closeComposer = () => {
    params.delete("compose");
    setParams(params, { replace: true });
  };

  const feed = useCallback(
    (list: Post[]) => {
      const base = list.filter((p) => {
        if (remotePosts !== null) return true;
        if (tab === "following") return ["u1", "u2", "u4", "u5", "u6", "me"].includes(p.authorId);
        if (tab === "campus") return p.campus.startsWith("UNILAG") || p.anonymous;
        return true;
      });
      return settings.compactFeed ? base.slice(0, 8) : base;
    },
    [tab, settings.compactFeed, remotePosts],
  );

  const visible = feed([...extra, ...posts]);

  useEffect(() => {
    let live = true;
    setRemoteLoading(true);
    setRemoteError(false);
    setExtra([]);
    setExhausted(false);
    void backend.feed(tab, 0).then((page) => {
      if (!live) return;
      setRemoteFeed(page.items, page.users);
      setCursor(page.nextCursor ?? -1);
      setExhausted(page.nextCursor === null);
    }).catch(() => { if (live) setRemoteError(true); }).finally(() => { if (live) setRemoteLoading(false); });
    return () => { live = false; };
  }, [tab, setRemoteFeed]);

  /* infinite scroll */
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingMore || !ready || remoteLoading || exhausted || cursor < 0) return;
        setLoadingMore(true);
        backend
          .feed(tab, cursor)
          .then((page) => {
            setExtra((prev) => {
              const seen = new Set([...prev, ...posts].map((p) => p.id));
              const fresh = page.items.filter((p) => !seen.has(p.id));
              if (!fresh.length || page.nextCursor === null) setExhausted(true);
              return [...prev, ...fresh];
            });
            setRemoteFeed(posts, page.users);
            setCursor(page.nextCursor ?? -1);
            if (page.nextCursor === null) setExhausted(true);
          })
          .catch(() => setRemoteError(true))
          .finally(() => setLoadingMore(false));
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tab, cursor, loadingMore, ready, remoteLoading, posts, extra, exhausted, setRemoteFeed]);

  useEffect(() => {
    setError(settings.simulateErrors);
  }, [settings.simulateErrors]);

  const refresh = async () => {
    setRefreshing(true);
    setError(false);
    setPull(0);
    if (settings.simulateErrors) {
      setError(true);
      setRefreshing(false);
      toast({ title: "Can't reach CampusLaugh", description: "You appear to be offline", tone: "error" });
      return;
    }
    try {
      const page = await backend.feed(tab, 0);
      setRemoteFeed(page.items, page.users);
      setExtra([]);
      setCursor(page.nextCursor ?? -1);
      setExhausted(page.nextCursor === null);
      setRemoteError(false);
      toast({ title: "Feed refreshed", description: `${compact(page.items.length)} posts loaded`, tone: "success" });
    } catch (e) {
      setRemoteError(true);
      toast({ title: "Couldn’t refresh your feed", description: e instanceof Error ? e.message : "Try again.", tone: "error" });
    } finally { setRefreshing(false); }
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="pb-28 lg:pb-6">
      {/* desktop page header */}
      <div className="hidden items-end justify-between gap-4 px-1 pb-4 pt-2 lg:flex">
        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand">
            <Radio className="h-3 w-3" /> Your campus community
          </p>
          <h1 className="font-display text-[38px] font-extrabold leading-[0.95] tracking-[-0.045em] text-ink">
            Your campus.
            <br />
            <span className="text-brand">Your people.</span> Your laughs.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button variant="brand" size="md" icon={<Sparkles className="h-4 w-4" />} onClick={() => navigate("/home?compose=1")}>
            Create post
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {/* trending marquee */}
          <motion.div variants={staggerItem} className="glass relative mb-3 overflow-hidden rounded-[22px] py-2">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--c-surface)] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--c-surface)] to-transparent" />
            <div className="marquee-track flex w-max items-center gap-6 whitespace-nowrap px-4">
              {[...trending, ...trending].map((t, i) => (
                <button
                  key={`${t.tag}-${i}`}
                  onClick={() => navigate(`/explore?q=${t.tag}`)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink2 transition-colors hover:text-brand"
                >
                  <Flame className="h-3.5 w-3.5 text-coral" />
                  #{t.tag}
                  <span className="font-semibold text-ink3">{compact(t.posts)}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* feed tabs */}
          <motion.div
            variants={staggerItem}
            className="glass-bar sticky top-[68px] z-30 mb-3 flex items-center gap-1 rounded-[22px] p-1.5 lg:top-2"
          >
            {TABS.map((t) => {
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "relative flex-1 rounded-2xl py-2.5 text-[13.5px] font-extrabold transition-colors",
                    active ? "text-onbrand" : "text-ink2 hover:text-ink",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="feed-tab"
                      transition={spring}
                      className="absolute inset-0 rounded-2xl bg-brand shadow-[0_8px_22px_-12px_rgba(183,243,74,1)]"
                    />
                  )}
                  <span className="relative">{t.label}</span>
                </button>
              );
            })}
            <div className="ml-1 hidden items-center gap-1 pl-1 sm:flex">
              <IconButton label="Notifications" size="sm" badge={unreadNotifications} onClick={() => navigate("/notifications")}>
                <Megaphone className="h-4 w-4" />
              </IconButton>
            </div>
          </motion.div>

          {/* pull to refresh handle (touch) */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDrag={(_, i) => window.scrollY < 4 && setPull(Math.max(0, Math.min(110, i.offset.y)))}
            onDragEnd={(_, i) => {
              if (i.offset.y > 78) void refresh();
              else setPull(0);
            }}
            className="flex h-0 items-center justify-center overflow-visible lg:hidden"
          >
            <motion.div
              animate={{ height: pull, opacity: pull > 8 ? 1 : 0 }}
              className="flex items-center gap-2 text-[12px] font-bold text-ink2"
            >
              <motion.span animate={{ rotate: pull > 78 ? 180 : 0 }} transition={spring}>
                <ArrowUp className="h-4 w-4 text-brand" />
              </motion.span>
              {refreshing ? "Refreshing…" : pull > 78 ? "Release to refresh" : "Pull to refresh"}
            </motion.div>
          </motion.div>

          {/* feed body */}
          <AnimatePresence mode="wait">
            {!ready || remoteLoading ? (
              <motion.div key="sk" className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {[0, 1, 2].map((i) => (
                  <PostSkeleton key={i} />
                ))}
              </motion.div>
            ) : error || remoteError ? (
              <motion.div key="err" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <EmptyState
                  icon={<WifiOff className="h-6 w-6" />}
                  title="We couldn't load your feed"
                  body="Your feed service could not be reached. Check the API connection and try again."
                  action={
                    <div className="mt-1 flex flex-wrap justify-center gap-2">
                      <Button variant="brand" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void refresh()}>
                        Try again
                      </Button>
                      <Button variant="outline" onClick={() => update("simulateErrors", false)}>
                        Turn off simulated errors
                      </Button>
                    </div>
                  }
                />
              </motion.div>
            ) : visible.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyState
                  icon={<Sparkles className="h-6 w-6" />}
                  title={tab === "following" ? "Your following feed is quiet" : "Nothing here yet"}
                  body={
                    tab === "following"
                      ? "Follow a few campuses or comedians and their posts will show up right here."
                      : "Be the first to post something for your campus today."
                  }
                  action={
                    <div className="mt-1 flex gap-2">
                      <Button variant="brand" onClick={() => navigate("/explore")}>Explore students</Button>
                      <Button variant="outline" onClick={() => navigate("/home?compose=1")}>Create a post</Button>
                    </div>
                  }
                />
              </motion.div>
            ) : (
              <motion.div key={tab} className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}>
                <AnimatePresence initial={false} mode="popLayout">
                  {visible.map((p, i) => (
                    <motion.div
                      key={p.id}
                      layout="position"
                      variants={staggerItem}
                      initial={i < 4 ? "initial" : false}
                      animate="enter"
                      exit="exit"
                      transition={{ ...springSoft, delay: i < 4 ? i * 0.05 : 0 }}
                    >
                      <PostCard post={p} dense={settings.compactFeed} onOpenProfile={(id) => navigate(`/profile/${id}`)} />
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div ref={sentinel} className="flex justify-center py-6">
                  {loadingMore ? (
                    <div className="flex items-center gap-2 text-[12.5px] font-bold text-ink3">
                      <RefreshCw className="h-4 w-4 animate-spin text-brand" /> Loading more laughs…
                    </div>
                  ) : exhausted ? (
                    <span className="text-[12.5px] font-bold text-ink3">You're all caught up 🍋</span>
                  ) : (
                    <button onClick={() => void refresh()} className="press text-[12.5px] font-bold text-ink3 hover:text-brand">
                      Tap to refresh
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* right rail (desktop) */}
        <aside className="hidden min-w-0 lg:block">
          <div className="sticky top-2 space-y-3">
            <motion.section variants={staggerItem} className="glass overflow-hidden rounded-[24px] p-4">
              <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
                <TrendingUp className="h-4 w-4 text-brand" /> Trending now
              </h2>
              <div className="space-y-1">
                {trending.slice(0, 6).map((t, i) => (
                  <button
                    key={t.tag}
                    onClick={() => navigate(`/explore?q=${t.tag}`)}
                    className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-ink/6"
                  >
                    <span className="w-4 text-[13px] font-extrabold text-ink3 tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold text-ink">#{t.tag}</span>
                      <span className="block text-[11.5px] text-ink3">{compact(t.posts)} posts</span>
                    </span>
                    <Badge tone={t.delta.startsWith("+") ? "mint" : "coral"}>{t.delta}</Badge>
                  </button>
                ))}
              </div>
            </motion.section>

            <motion.section variants={staggerItem} className="glass overflow-hidden rounded-[24px] p-4">
              <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
                <UserPlus className="h-4 w-4 text-brand" /> Students to follow
              </h2>
              <div className="space-y-1">
                {userArray
                  .filter((u) => u.id !== "me")
                  .slice(0, 4)
                  .map((u) => {
                    const following = isFollowing(u.id);
                    return (
                      <div key={u.id} className="flex items-center gap-2.5 rounded-2xl px-1 py-1.5">
                        <button onClick={() => navigate(`/profile/${u.id}`)} className="press min-w-0 flex-1 text-left">
                          <span className="flex items-center gap-2.5">
                            <Avatar src={u.avatar} name={u.name} size={34} online={u.online} />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1">
                                <span className="truncate text-[13px] font-bold text-ink">{u.name}</span>
                                {u.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand" fill="currentColor" />}
                              </span>
                              <span className="block truncate text-[11.5px] text-ink3">{u.campus}</span>
                            </span>
                          </span>
                        </button>
                        <Button
                          size="xs"
                          variant={following ? "outline" : "brand"}
                          onClick={() => {
                            const now = toggleFollow(u.id);
                            toast({
                              title: now ? `Following ${u.name}` : `Unfollowed ${u.name}`,
                              tone: now ? "success" : "info",
                            });
                          }}
                        >
                          {following ? "Following" : "Follow"}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </motion.section>

            <motion.section variants={staggerItem} className="glass overflow-hidden rounded-[24px] p-4">
              <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
                <Megaphone className="h-4 w-4 text-brand" /> Campus announcements
              </h2>
              <div className="space-y-2">
                {campusAnnouncements.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate("/explore")}
                    className="press block w-full rounded-2xl border border-line bg-glass p-3 text-left hover:border-brand/30"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-extrabold text-ink">{a.title}</span>
                      <span className="shrink-0 text-[10.5px] font-bold text-brand">{a.time}</span>
                    </span>
                    <span className="mt-1 block text-[12px] leading-snug text-ink2">{a.body}</span>
                    <span className="mt-1.5 block text-[11px] font-semibold text-ink3">{a.campus}</span>
                  </button>
                ))}
              </div>
            </motion.section>

            <motion.section variants={staggerItem} className="glass flex items-center gap-3 rounded-[24px] p-3.5">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/16 text-brand">
                <Radio className="h-4 w-4" />
                {ambient && <span className="live-ring absolute inset-0 rounded-full" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold text-ink">Demo activity stream</p>
                <p className="text-[11.5px] leading-snug text-ink2">
                  Simulated likes, messages and banners — frontend only.
                </p>
              </div>
              <Switch checked={ambient} onChange={(v) => { setAmbient(v); update("demoActivity", v); }} label="Toggle demo activity" />
            </motion.section>

            <p className="px-2 text-[11px] leading-relaxed text-ink3">
              CampusLaugh · frontend demonstration build. No backend, no real accounts. Bookmarks, chats and preferences
              persist in this browser's localStorage.
            </p>
          </div>
        </aside>
      </div>

      {/* floating compose button (mobile) */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => navigate("/home?compose=1")}
        aria-label="Create post"
        className="fixed bottom-28 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand text-onbrand shadow-[0_18px_38px_-14px_rgba(183,243,74,.95)] lg:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Sparkles className="h-6 w-6" />
      </motion.button>

      <Composer open={composeOpen} onClose={closeComposer} />

      <IslandHint onShow={() => showIsland({ title: "CampusLaugh", subtitle: "Tip: double-tap any post to like it 🍋" })} />
    </motion.div>
  );
}

function IslandHint({ onShow }: { onShow: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (shown) return;
    const t = window.setTimeout(() => {
      setShown(true);
      onShow();
    }, 2600);
    return () => window.clearTimeout(t);
  }, [shown, onShow]);
  return null;
}
