import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Clock,
  Compass,
  Flame,
  Hash,
  Image as ImageIcon,
  MessageCircle,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import { campusAnnouncements, institutions, recentSearches as seedSearches, trending, userArray } from "@/data/mock";
import type { MediaItem, Post, User } from "@/types";
import { cn, compact } from "@/utils/format";
import { Avatar, Badge, Button, Chip, EmptyState, Segmented } from "@/components/ui/primitives";
import { spring, springSnappy } from "@/components/ui/primitives";
import { pageVariants } from "@/components/ui/motion";
import { PostCard } from "@/components/feed/PostCard";
import { MediaViewer } from "@/components/feed/Media";
import { backend } from "@/services/backend";
import { getAccessToken } from "@/services/http";

type Scope = "all" | "posts" | "people" | "tags";

export default function Explore() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { posts, addRecentSearch, recentSearches, clearRecentSearches, toggleFollow, isFollowing, userById, cacheUser } = useStore();
  const { toast } = useSystem();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [focused, setFocused] = useState(params.get("focus") === "1");
  const [scope, setScope] = useState<Scope>("all");
  const [viewer, setViewer] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const [remoteResults, setRemoteResults] = useState<{ query: string; posts: Post[]; people: User[]; tags: string[] } | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState(false);
  const [retrySearch, setRetrySearch] = useState(0);

  useEffect(() => {
    const q = params.get("q");
    if (q !== null && q !== query) setQuery(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const q = query.trim().toLowerCase();
  const authenticated = Boolean(getAccessToken());

  useEffect(() => {
    if (!q || !authenticated) {
      setRemoteResults(null);
      setRemoteLoading(false);
      setRemoteError(false);
      return;
    }
    let live = true;
    setRemoteLoading(true);
    setRemoteError(false);
    const timer = window.setTimeout(() => {
      void backend.search(q).then((result) => {
        if (!live) return;
        result.people.forEach(cacheUser);
        result.authors.forEach(cacheUser);
        setRemoteResults({ query: q, posts: result.posts, people: result.people, tags: result.tags });
      }).catch(() => { if (live) setRemoteError(true); }).finally(() => { if (live) setRemoteLoading(false); });
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [q, authenticated, retrySearch, cacheUser]);

  const results = useMemo(() => {
    if (!q) return { posts: [], people: [], tags: [] as string[], campuses: [] as string[] };
    if (authenticated) {
      const current = remoteResults?.query === q ? remoteResults : null;
      return { posts: current?.posts ?? [], people: current?.people ?? [], tags: current?.tags ?? [], campuses: [] };
    }
    return {
      posts: posts.filter(
        (p) =>
          p.text.toLowerCase().includes(q) ||
          p.hashtags.some((h) => h.toLowerCase().includes(q.replace("#", ""))) ||
          p.campus.toLowerCase().includes(q),
      ),
      people: userArray.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.institution.toLowerCase().includes(q),
      ),
      tags: trending.filter((t) => t.tag.toLowerCase().includes(q.replace("#", ""))).map((t) => t.tag),
      campuses: institutions.filter((i) => i.toLowerCase().includes(q)),
    };
  }, [q, posts, authenticated, remoteResults]);

  const suggestions = useMemo(() => {
    const base = [
      ...trending.slice(0, 4).map((t) => ({ kind: "tag" as const, label: `#${t.tag}`, meta: `${compact(t.posts)} posts` })),
      ...userArray.slice(1, 4).map((u) => ({ kind: "user" as const, label: `@${u.username}`, meta: u.institution })),
      { kind: "campus" as const, label: "UNILAG · Akoka", meta: "Your campus" },
    ];
    if (!q) return base;
    return [
      ...results.tags.map((t) => ({ kind: "tag" as const, label: `#${t}`, meta: "Hashtag" })),
      ...results.people.slice(0, 4).map((u) => ({ kind: "user" as const, label: `@${u.username}`, meta: u.name })),
      ...results.campuses.slice(0, 3).map((c) => ({ kind: "campus" as const, label: c, meta: "Institution" })),
    ];
  }, [q, results]);

  const hotDiscussions = useMemo(
    () => [...posts].sort((a, b) => b.comments.length - a.comments.length).slice(0, 3),
    [posts],
  );

  const mosaic = useMemo(() => {
    const items: { media: MediaItem; postId: string }[] = [];
    posts.forEach((p) => p.media?.forEach((m) => items.push({ media: m, postId: p.id })));
    return items.slice(0, 9);
  }, [posts]);

  const submit = (term: string) => {
    const t = term.trim();
    setQuery(t);
    if (t) {
      addRecentSearch(t);
      setParams({ q: t }, { replace: true });
    } else setParams({}, { replace: true });
    setFocused(false);
  };

  const searching = q.length > 0;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="pb-28 lg:pb-8">
      {/* search */}
      <div className="sticky top-[64px] z-30 mb-3 px-3 pt-2 lg:relative lg:top-0 lg:px-0">
        <motion.div
          animate={focused ? { scale: 1.005 } : { scale: 1 }}
          transition={springSnappy}
          className="glass relative"
        >
          <div className="field flex items-center gap-2.5 rounded-[22px] border-0 bg-transparent px-3.5 py-3">
            <Search className={cn("h-[18px] w-[18px] shrink-0 transition-colors", focused ? "text-brand" : "text-ink3")} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 160)}
              onKeyDown={(e) => e.key === "Enter" && submit(query)}
              placeholder="Search students, memes, campuses, #tags"
              aria-label="Search CampusLaugh"
              className="h-6 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink3"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setParams({}, { replace: true });
                }}
                aria-label="Clear"
                className="press grid h-7 w-7 place-items-center rounded-full bg-ink/12 text-ink2"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <Button size="sm" variant={query ? "brand" : "outline"} onClick={() => submit(query)}>
              Search
            </Button>
          </div>

          <AnimatePresence>
            {focused && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={springSnappy}
                className="overflow-hidden border-t border-line"
              >
                <div className="max-h-[46vh] overflow-y-auto thin-scrollbar p-2">
                  {!searching && recentSearches.length > 0 && (
                    <div className="mb-2 flex items-center gap-2 px-2 pt-1">
                      <Clock className="h-3.5 w-3.5 text-ink3" />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-ink3">Recent</span>
                      <button
                        onClick={() => {
                          clearRecentSearches();
                          toast({ title: "Recent searches cleared", tone: "info" });
                        }}
                        className="ml-auto text-[11px] font-bold text-coral"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                  {!searching &&
                    (recentSearches.length ? recentSearches : seedSearches).map((term) => (
                      <button
                        key={term}
                        onMouseDown={() => submit(term)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-ink/6"
                      >
                        <Clock className="h-4 w-4 shrink-0 text-ink3" />
                        <span className="truncate text-[13.5px] font-semibold text-ink2">{term}</span>
                      </button>
                    ))}

                  {suggestions.map((s) => (
                    <button
                      key={`${s.kind}-${s.label}`}
                      onMouseDown={() => submit(s.label.replace("#", ""))}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-ink/6"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/14 text-brand">
                        {s.kind === "tag" ? <Hash className="h-3.5 w-3.5" /> : s.kind === "user" ? <Users className="h-3.5 w-3.5" /> : <Compass className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold text-ink">{s.label}</span>
                        <span className="block truncate text-[11.5px] text-ink3">{s.meta}</span>
                      </span>
                      <Search className="h-3.5 w-3.5 text-ink3" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="px-3 lg:px-0">
        <AnimatePresence mode="wait">
          {searching ? (
            <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[12.5px] font-semibold text-ink2">
                  {remoteLoading && authenticated ? <span className="text-ink3">Searching CampusLaugh…</span> : <><span className="text-brand">{results.posts.length + results.people.length + results.tags.length}</span> results</>}
                  {!remoteLoading || !authenticated ? ` for “${query}”` : null}
                </p>
                <Segmented
                  size="sm"
                  className="w-auto"
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: "all", label: "All" },
                    { value: "posts", label: "Posts" },
                    { value: "people", label: "People" },
                    { value: "tags", label: "Tags" },
                  ]}
                />
              </div>

              {remoteError && authenticated ? (
                <EmptyState icon={<Search className="h-6 w-6" />} title="Search is unavailable" body="We couldn’t load live results. Check your connection and try again." action={<Button size="sm" variant="brand" onClick={() => setRetrySearch((value) => value + 1)}>Try again</Button>} />
              ) : remoteLoading && authenticated ? (
                <div className="glass rounded-[22px] p-5 text-center text-[13px] font-semibold text-ink2">Searching real CampusLaugh posts, students, and hashtags…</div>
              ) : results.posts.length + results.people.length + results.tags.length === 0 ? (
                <EmptyState
                  icon={<Search className="h-6 w-6" />}
                  title={`Nothing found for “${query}”`}
                  body="Try a hashtag like #HostelChronicles, a student's @username, or an institution name."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      {trending.slice(0, 3).map((t) => (
                        <Chip key={t.tag} onClick={() => submit(t.tag)}>#{t.tag}</Chip>
                      ))}
                    </div>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {(scope === "all" || scope === "tags") && results.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {results.tags.map((t) => (
                        <Chip key={t} active onClick={() => submit(t)}>#{t}</Chip>
                      ))}
                    </div>
                  )}
                  {(scope === "all" || scope === "people") && results.people.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {results.people.map((u) => (
                        <PersonCard key={u.id} userId={u.id} />
                      ))}
                    </div>
                  )}
                  {(scope === "all" || scope === "posts") &&
                    results.posts.map((p) => (
                      <PostCard key={p.id} post={p} onOpenProfile={(id) => navigate(`/profile/${id}`)} />
                    ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* trending */}
              <section>
                <SectionTitle icon={<Flame className="h-4 w-4" />} title="Trending across campuses" sub="Updated for the demo feed" />
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {trending.map((t, i) => (
                    <motion.button
                      key={t.tag}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.035, ...springSnappy }}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => submit(t.tag)}
                      className="glass glass-sheen relative overflow-hidden rounded-[22px] p-3.5 text-left"
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink3">#{i + 1} trending</span>
                        <Badge tone={t.delta.startsWith("+") ? "mint" : "coral"}>{t.delta}</Badge>
                      </span>
                      <span className="mt-2 block font-display text-[17px] font-extrabold tracking-[-0.03em] text-ink">
                        #{t.tag}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-ink2">{compact(t.posts)} posts</span>
                      <span className="pointer-events-none absolute -bottom-6 -right-4 h-20 w-20 rounded-full bg-brand/12 blur-xl" />
                    </motion.button>
                  ))}
                </div>
              </section>

              {/* people */}
              <section>
                <SectionTitle icon={<UserPlus className="h-4 w-4" />} title="Students you should know" sub="Across 11 institutions" />
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {userArray.filter((u) => u.id !== "me").slice(0, 6).map((u) => (
                    <PersonCard key={u.id} userId={u.id} />
                  ))}
                </div>
              </section>

              {/* discussions */}
              <section>
                <SectionTitle icon={<MessageCircle className="h-4 w-4" />} title="Popular discussions" sub="Most replies right now" />
                <div className="space-y-3">
                  {hotDiscussions.map((p) => (
                    <PostCard key={p.id} post={p} dense onOpenProfile={(id) => navigate(`/profile/${id}`)} />
                  ))}
                </div>
              </section>

              {/* media mosaic */}
              <section>
                <SectionTitle icon={<ImageIcon className="h-4 w-4" />} title="Campus gallery" sub="Photos & clips students shared" />
                <div className="grid grid-cols-3 gap-1.5">
                  {mosaic.map((it, i) => (
                    <motion.button
                      key={it.media.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setViewer({ items: mosaic.map((x) => x.media), index: i })}
                      className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-ink/6"
                    >
                      {it.media.kind === "video" ? (
                        <>
                          <img src={it.media.poster} alt={it.media.alt} loading="lazy" className="h-full w-full object-cover" />
                          <span className="absolute inset-0 grid place-items-center bg-black/30">
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur-md">▶</span>
                          </span>
                        </>
                      ) : (
                        <img src={it.media.src} alt={it.media.alt} loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </section>

              {/* announcements */}
              <section>
                <SectionTitle icon={<Sparkles className="h-4 w-4" />} title="Campus announcements" sub="Official notices" />
                <div className="grid gap-2 sm:grid-cols-3">
                  {campusAnnouncements.map((a) => (
                    <div key={a.id} className="glass rounded-[22px] p-4">
                      <Badge tone="brand">{a.time}</Badge>
                      <h3 className="mt-2 font-display text-[15px] font-extrabold leading-tight text-ink">{a.title}</h3>
                      <p className="mt-1 text-[12.5px] leading-snug text-ink2">{a.body}</p>
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink3">{a.campus}</p>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
    </motion.div>
  );

  function PersonCard({ userId }: { userId: string }) {
    const u = userById(userId);
    const following = isFollowing(userId);
    return (
      <motion.div
        whileHover={{ y: -3 }}
        transition={spring}
        className="glass glass-sheen flex items-start gap-3 rounded-[22px] p-3.5"
      >
        <button onClick={() => navigate(`/profile/${u.id}`)} className="press shrink-0">
          <Avatar src={u.avatar} name={u.name} size={46} online={u.online} />
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={() => navigate(`/profile/${u.id}`)} className="block w-full text-left">
            <span className="flex items-center gap-1">
              <span className="truncate text-[13.5px] font-extrabold text-ink">{u.name}</span>
              {u.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand" fill="currentColor" />}
            </span>
            <span className="block truncate text-[11.5px] text-ink3">@{u.username}</span>
          </button>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink2">{u.bio}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink3">
              <TrendingUp className="h-3 w-3" /> {compact(u.followers)}
            </span>
            <Button
              size="xs"
              variant={following ? "outline" : "brand"}
              className="ml-auto"
              onClick={() => {
                const now = toggleFollow(u.id);
                toast({ title: now ? `Following ${u.name}` : `Unfollowed ${u.name}`, tone: now ? "success" : "info" });
              }}
            >
              {following ? "Following" : "Follow"}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="mb-2.5 flex items-end gap-2 px-1">
      <span className="grid h-7 w-7 place-items-center rounded-xl bg-brand/14 text-brand">{icon}</span>
      <div>
        <h2 className="font-display text-[16px] font-extrabold leading-none tracking-[-0.03em] text-ink">{title}</h2>
        {sub && <p className="mt-1 text-[11.5px] font-semibold text-ink3">{sub}</p>}
      </div>
    </div>
  );
}
