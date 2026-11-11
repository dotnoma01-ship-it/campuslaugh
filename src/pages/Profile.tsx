import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  BadgeCheck,
  Bookmark,
  Calendar,
  Check,
  Image as ImageIcon,
  Link2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Share,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import { ME, userArray } from "@/data/mock";
import { cn, compact, copyText } from "@/utils/format";
import { Avatar, Badge, Button, EmptyState, IconButton } from "@/components/ui/primitives";
import { spring } from "@/components/ui/primitives";
import { ContextMenu, Modal, useContextMenu } from "@/components/ui/overlays";
import { pageVariants } from "@/components/ui/motion";
import { PostCard } from "@/components/feed/PostCard";
import { MediaViewer } from "@/components/feed/Media";
import type { MediaItem, User } from "@/types";
import { backend } from "@/services/backend";

type Tab = "posts" | "replies" | "media" | "saved";

const TABS: { id: Tab; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "replies", label: "Replies" },
  { id: "media", label: "Media" },
  { id: "saved", label: "Likes" },
];

const SAMPLE_AVATARS = [
  "https://images.pexels.com/photos/29615996/pexels-photo-29615996.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200",
  "https://images.pexels.com/photos/6102841/pexels-photo-6102841.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200",
  "https://images.pexels.com/photos/40322798/pexels-photo-40322798.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200",
  "https://images.pexels.com/photos/34081654/pexels-photo-34081654.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200",
  "https://images.pexels.com/photos/16160871/pexels-photo-16160871.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200",
];

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { userById, users, posts, me, apiUserId, cacheUser, updateProfile, toggleFollow, isFollowing, startConversation, bookmarks } = useStore();
  const { toast, actionSheet, confirm, showOverlay } = useSystem();
  const menu = useContextMenu();
  const [tab, setTab] = useState<Tab>("posts");
  const [editing, setEditing] = useState(false);
  const [viewer, setViewer] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  const isMe = !userId || userId === ME || userId === "me" || userId === apiUserId;
  const user = isMe ? me : userById(userId!);

  useEffect(() => {
    if (!userId || !/^[a-f\d]{24}$/i.test(userId) || users[userId]) return;
    void backend.getUser(userId).then(cacheUser).catch(() => undefined);
  }, [userId, users, cacheUser]);

  const { scrollY } = useScroll();
  const coverY = useTransform(scrollY, [0, 260], [0, 70]);
  const coverScale = useTransform(scrollY, [0, 260], [1, 1.12]);
  const headerOpacity = useTransform(scrollY, [120, 210], [0, 1]);

  useEffect(() => setTab("posts"), [userId]);

  const userPosts = useMemo(() => posts.filter((p) => p.authorId === user.id), [posts, user.id]);
  const replies = useMemo(
    () =>
      posts.filter((p) =>
        p.comments.some((c) => c.authorId === user.id || c.replies?.some((r) => r.authorId === user.id)),
      ),
    [posts, user.id],
  );
  const media = useMemo(() => {
    const items: { media: MediaItem; postId: string }[] = [];
    userPosts.forEach((p) => p.media?.forEach((m) => items.push({ media: m, postId: p.id })));
    return items;
  }, [userPosts]);
  const liked = useMemo(() => posts.filter((p) => p.liked), [posts]);

  const shown = tab === "posts" ? userPosts : tab === "replies" ? replies : tab === "saved" ? (isMe ? bookmarks : liked) : [];

  const following = isFollowing(user.id);

  const copyProfileLink = async () => {
    const ok = await copyText(`https://campuslaugh.app/@${user.username}`);
    toast({ title: ok ? "Profile link copied" : "Couldn't copy link", tone: ok ? "success" : "error" });
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="pb-28 lg:pb-8">
      {/* cover */}
      <div ref={coverRef} className="relative h-40 overflow-hidden sm:h-52 lg:h-64">
        <motion.img
          style={{ y: coverY, scale: coverScale }}
          src={user.cover ?? user.avatar}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--c-bg)] via-[var(--c-bg)]/35 to-transparent" />
        <div className="grain absolute inset-0 opacity-20 mix-blend-overlay" />
        <div className="absolute right-3 top-3 flex gap-1.5">
          {!isMe && (
            <IconButton label="Message" onClick={() => { void startConversation(user.id).then((id) => navigate(`/chats/${id}`)).catch(() => undefined); }}>
              <MessageCircle className="h-4 w-4" />
            </IconButton>
          )}
          <IconButton label="Share profile" onClick={() => void copyProfileLink()}>
            <Share className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="More options"
            onClick={(e) => {
              menu.openFromEvent(e);
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {/* compact sticky header */}
      <motion.div
        style={{ opacity: headerOpacity }}
        className="glass-bar pointer-events-none sticky top-[64px] z-30 -mt-1 flex items-center gap-2.5 rounded-none px-3 py-2 lg:top-0"
      >
        <Avatar src={user.avatar} name={user.name} size={30} />
        <span className="truncate text-[13.5px] font-extrabold text-ink">{user.name}</span>
        <span className="pointer-events-auto ml-auto flex gap-1.5">
          {isMe ? (
            <Button size="xs" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          ) : (
            <Button size="xs" variant={following ? "outline" : "brand"} onClick={() => toggleFollow(user.id)}>
              {following ? "Following" : "Follow"}
            </Button>
          )}
        </span>
      </motion.div>

      <div className="px-3 lg:px-0">
        {/* identity */}
        <div className="-mt-12 flex flex-wrap items-end gap-3">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
            className="relative"
          >
            <Avatar src={user.avatar} name={user.name} size={92} ring online={user.online} />
            {isMe && (
              <button
                onClick={() => setEditing(true)}
                aria-label="Change profile photo"
                className="press absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--c-bg)] bg-brand text-onbrand"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.div>

          <div className="ml-auto flex gap-2">
            {isMe ? (
              <>
                <Button variant="glass" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                  Edit profile
                </Button>
                <Button variant="outline" size="sm" icon={<Bookmark className="h-4 w-4" />} onClick={() => navigate("/bookmarks")}>
                  Saved
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={following ? "outline" : "brand"}
                  size="sm"
                  icon={following ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  onClick={() => {
                    const now = toggleFollow(user.id);
                    toast({ title: now ? `Following ${user.name}` : `Unfollowed ${user.name}`, tone: now ? "success" : "info" });
                  }}
                >
                  {following ? "Following" : "Follow"}
                </Button>
                <Button
                  variant="glass"
                  size="sm"
                  icon={<MessageCircle className="h-4 w-4" />}
                  onClick={() => { void startConversation(user.id).then((id) => navigate(`/chats/${id}`)).catch(() => undefined); }}
                >
                  Message
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <h1 className="flex items-center gap-1.5 font-display text-[24px] font-extrabold leading-tight tracking-[-0.04em] text-ink sm:text-[28px]">
            {user.name}
            {user.verified && <BadgeCheck className="h-5 w-5 text-brand" fill="currentColor" />}
          </h1>
          <p className="text-[13.5px] font-semibold text-ink3">@{user.username}</p>
          {user.bio && <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-ink2">{user.bio}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12.5px] font-semibold text-ink2">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-brand" /> {user.institution}
            </span>
            {user.course && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-brand" /> {user.course}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-brand" /> Joined September 2024
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-brand" /> campuslaugh.app/@{user.username}
            </span>
          </div>

          <div className="mt-3.5 flex flex-wrap gap-4">
            {[
              { label: "Posts", value: userPosts.length },
              { label: "Followers", value: user.followers },
              { label: "Following", value: user.following },
              { label: "Laughs given", value: 12840 },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => (s.label === "Followers" || s.label === "Following" ? showOverlay({ kind: "profile", userId: user.id }) : setTab("posts"))}
                className="press text-left"
              >
                <span className="block font-display text-[18px] font-extrabold leading-none text-ink tabular-nums">
                  {compact(s.value)}
                </span>
                <span className="mt-1 block text-[11.5px] font-bold uppercase tracking-wide text-ink3">{s.label}</span>
              </button>
            ))}
          </div>

          {!isMe && (
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">{user.campus}</Badge>
              {user.online ? <Badge tone="mint">Online now</Badge> : <Badge>Last seen {user.lastSeen ?? "recently"}</Badge>}
              <div className="ml-1 flex -space-x-2">
                {userArray.slice(0, 3).map((u) => (
                  <Avatar key={u.id} src={u.avatar} name={u.name} size={22} />
                ))}
              </div>
              <span className="text-[11.5px] font-semibold text-ink3">Followed by Zainab, Kwame and 12 others</span>
            </div>
          )}
        </div>

        {/* tabs */}
        <div className="glass-bar sticky top-[112px] z-20 mt-4 flex gap-1 rounded-[22px] p-1.5 lg:top-[52px]">
          {TABS.map((t) => {
            const label = isMe && t.id === "saved" ? "Bookmarks" : t.label;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex-1 rounded-2xl py-2.5 text-[13px] font-extrabold transition-colors",
                  active ? "text-onbrand" : "text-ink2 hover:text-ink",
                )}
              >
                {active && <motion.span layoutId="profile-tab" transition={spring} className="absolute inset-0 rounded-2xl bg-brand" />}
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>

        {/* tab content */}
        <div className="mt-3">
          <AnimatePresence mode="wait">
            {tab === "media" ? (
              <motion.div
                key="media"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={springSoftLocal}
              >
                {media.length === 0 ? (
                  <EmptyState icon={<ImageIcon className="h-6 w-6" />} title="No media yet" body="Photos and clips shared by this profile will collect here." />
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {media.map((it, i) => (
                      <motion.button
                        key={it.media.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setViewer({ items: media.map((x) => x.media), index: i })}
                        className="relative aspect-square overflow-hidden rounded-2xl border border-line"
                      >
                        {it.media.kind === "video" ? (
                          <>
                            <img src={it.media.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              <Repeat2 className="inline h-3 w-3" /> video
                            </span>
                          </>
                        ) : (
                          <img src={it.media.src} alt={it.media.alt} loading="lazy" className="h-full w-full object-cover" />
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : shown.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyState
                  icon={tab === "saved" ? <Bookmark className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
                  title={
                    tab === "saved"
                      ? isMe
                        ? "No bookmarks yet"
                        : "Liked posts are private"
                      : tab === "replies"
                        ? "No replies yet"
                        : "No posts yet"
                  }
                  body={
                    tab === "saved" && isMe
                      ? "Tap the bookmark icon on any post to keep it here for later."
                      : "When there's activity it shows up in this tab instantly."
                  }
                  action={
                    isMe ? (
                      <Button size="sm" variant="brand" onClick={() => navigate("/explore")}>Find something funny</Button>
                    ) : undefined
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={springSoftLocal}
                className="space-y-3"
              >
                {shown.map((p) => (
                  <PostCard key={p.id} post={p} onOpenProfile={(id) => navigate(`/profile/${id}`)} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* profile options */}
      <ContextMenu
        open={menu.open}
        onClose={menu.close}
        x={menu.x}
        y={menu.y}
        items={
          isMe
            ? [
                { id: "edit", label: "Edit profile", icon: <Pencil className="h-4 w-4" />, onSelect: () => setEditing(true) },
                { id: "share", label: "Copy profile link", icon: <Link2 className="h-4 w-4" />, onSelect: () => void copyProfileLink() },
                { id: "saved", label: "Bookmarks", icon: <Bookmark className="h-4 w-4" />, onSelect: () => navigate("/bookmarks") },
                { id: "settings", label: "Settings & privacy", icon: <ShieldAlert className="h-4 w-4" />, onSelect: () => navigate("/settings") },
              ]
            : [
                { id: "share", label: "Copy profile link", icon: <Link2 className="h-4 w-4" />, onSelect: () => void copyProfileLink() },
                { id: "msg", label: "Send message", icon: <MessageCircle className="h-4 w-4" />, onSelect: () => { void startConversation(user.id).then((id) => navigate(`/chats/${id}`)).catch(() => undefined); } },
                { id: "mute", label: `Mute @${user.username}`, icon: <ShieldAlert className="h-4 w-4" />, onSelect: () => toast({ title: `Muted ${user.name}`, description: "Manage in Settings → Safety", tone: "info" }) },
                {
                  id: "block",
                  label: `Block ${user.name}`,
                  icon: <ShieldAlert className="h-4 w-4" />,
                  tone: "danger",
                  onSelect: () =>
                    void confirm({ title: `Block ${user.name}?`, message: "They won't see your posts or message you in this demo session.", confirmLabel: "Block", tone: "danger" }).then((ok) => ok && toast({ title: `${user.name} blocked`, tone: "warning" })),
                },
                { id: "report", label: "Report profile", icon: <ShieldAlert className="h-4 w-4" />, tone: "danger", onSelect: () => void actionSheet({ title: "Report profile", message: "Choose a reason — queued locally in this demo.", actions: [{ id: "spam", label: "Spam or scam" }, { id: "harass", label: "Harassment" }, { id: "fake", label: "Impersonation" }, { id: "other", label: "Something else" }] }).then((r) => r && toast({ title: "Report submitted", description: r, tone: "warning" })) },
              ]
        }
      />

      <EditProfileModal open={editing} onClose={() => setEditing(false)} user={user} onSave={(patch) => { updateProfile(patch); toast({ title: "Profile updated", tone: "success" }); }} />

      <AnimatePresence>
        {viewer && (
          <MediaViewer items={viewer.items} index={viewer.index} onClose={() => setViewer(null)} onIndexChange={(i) => setViewer({ ...viewer, index: i })} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const springSoftLocal = { type: "spring" as const, stiffness: 300, damping: 32 };

/* ------------------------------ edit modal ------------------------------ */

function EditProfileModal({
  open,
  onClose,
  user,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
  onSave: (patch: Partial<User>) => void;
}) {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? "");
  const [institution, setInstitution] = useState(user.institution);
  const [course, setCourse] = useState(user.course ?? "");
  const [avatar, setAvatar] = useState(user.avatar);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setBio(user.bio ?? "");
      setInstitution(user.institution);
      setCourse(user.course ?? "");
      setAvatar(user.avatar);
    }
  }, [open, user]);

  const onFile = (f: FileList | null) => {
    const file = f?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setAvatar(URL.createObjectURL(file));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit profile"
      subtitle="Changes are saved to this browser only (frontend demo)."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" block onClick={onClose}>Cancel</Button>
          <Button variant="brand" block icon={<Check className="h-4 w-4" />} onClick={() => { onSave({ name, bio, institution, course, avatar }); onClose(); }}>
            Save changes
          </Button>
        </div>
      }
    >
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files); e.target.value = ""; }} />

      <div className="space-y-4 pb-1">
        <div className="flex items-center gap-3">
          <Avatar src={avatar} name={name} size={72} ring />
          <div className="flex flex-col gap-1.5">
            <Button size="sm" variant="glass" icon={<ImageIcon className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
              Upload photo
            </Button>
            <span className="text-[11px] font-semibold text-ink3">or pick a sample below</span>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {SAMPLE_AVATARS.map((s) => (
            <motion.button
              key={s}
              whileTap={{ scale: 0.9 }}
              onClick={() => setAvatar(s)}
              className={cn("relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2", avatar === s ? "border-brand" : "border-line")}
            >
              <img src={s} alt="Sample avatar" loading="lazy" className="h-full w-full object-cover" />
            </motion.button>
          ))}
        </div>

        <Field label="Full name" value={name} onChange={setName} maxLength={40} />
        <Field label="Bio" value={bio} onChange={setBio} maxLength={160} multiline placeholder="Tell your campus who you are" />
        <Field label="Institution" value={institution} onChange={setInstitution} maxLength={60} />
        <Field label="Course / level" value={course} onChange={setCourse} maxLength={60} placeholder="B.Sc Computer Science · 400 Level" />

        <div className="glass rounded-2xl p-3">
          <p className="text-[12px] font-bold text-ink">@{(name || "student").toLowerCase().replace(/[^a-z0-9]/g, "")}</p>
          <p className="mt-0.5 text-[11.5px] text-ink3">
            Usernames stay fixed in this demo build — @{user.username}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[11.5px] font-bold uppercase tracking-wide text-ink3">
        {label}
        {maxLength && (
          <span className="tabular-nums">
            {value.length}/{maxLength}
          </span>
        )}
      </span>
      {multiline ? (
        <textarea
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="field w-full resize-none rounded-2xl px-3.5 py-3 text-[14px] outline-none"
        />
      ) : (
        <input
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="field h-11 w-full rounded-2xl px-3.5 text-[14px] outline-none"
        />
      )}
    </label>
  );
}

/** Simple bookmarks screen (reuses the profile list styles). */
export function BookmarksPage() {
  const navigate = useNavigate();
  const { bookmarks } = useStore();
  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="px-3 pb-28 lg:px-0 lg:pb-8">
      <div className="mb-3 flex items-center gap-2 pt-2">
        <div className="flex-1">
          <h1 className="font-display text-[26px] font-extrabold leading-none tracking-[-0.035em] text-ink lg:text-[32px]">
            Bookmarks
          </h1>
          <p className="mt-1.5 text-[12.5px] font-semibold text-ink2">{bookmarks.length} saved posts</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/profile")}>Back to profile</Button>
      </div>

      {bookmarks.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-6 w-6" />}
          title="Nothing saved yet"
          body="Tap the bookmark icon on any post and it lands here — stored in this browser."
          action={<Button size="sm" variant="brand" onClick={() => navigate("/home")}>Browse the feed</Button>}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {bookmarks.map((p) => (
              <motion.div key={p.id} layout exit={{ opacity: 0, scale: 0.95 }}>
                <PostCard post={p} onOpenProfile={(id) => navigate(`/profile/${id}`)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
