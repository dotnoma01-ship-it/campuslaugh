import { AnimatePresence, motion } from "framer-motion";
import {
  AtSign,
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Heart,
  Megaphone,
  MessageCircle,
  Repeat2,
  Settings2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import type { AppNotification, NotificationKind } from "@/types";
import { cn, dayLabel, timeAgo } from "@/utils/format";
import { Avatar, Badge, Button, Chip, EmptyState } from "@/components/ui/primitives";
import { spring, springSnappy } from "@/components/ui/primitives";
import { pageVariants } from "@/components/ui/motion";

const FILTERS: { id: "all" | "unread" | NotificationKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "like", label: "Likes" },
  { id: "comment", label: "Comments" },
  { id: "follow", label: "Followers" },
  { id: "mention", label: "Mentions" },
  { id: "message", label: "Messages" },
  { id: "campus", label: "Campus" },
];

const KIND_META: Record<NotificationKind, { icon: React.ReactNode; tone: string }> = {
  like: { icon: <Heart className="h-4 w-4" fill="currentColor" />, tone: "bg-coral/16 text-coral" },
  comment: { icon: <MessageCircle className="h-4 w-4" />, tone: "bg-sky2/16 text-sky2" },
  follow: { icon: <UserPlus className="h-4 w-4" />, tone: "bg-mint/16 text-mint" },
  mention: { icon: <AtSign className="h-4 w-4" />, tone: "bg-brand/16 text-brand" },
  repost: { icon: <Repeat2 className="h-4 w-4" />, tone: "bg-mint/16 text-mint" },
  message: { icon: <MessageCircle className="h-4 w-4" />, tone: "bg-brand/16 text-brand" },
  campus: { icon: <Megaphone className="h-4 w-4" />, tone: "bg-[#ffcb5c]/16 text-[#ffcb5c]" },
  account: { icon: <Bell className="h-4 w-4" />, tone: "bg-ink/10 text-ink2" },
};

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, notificationsLoading, notificationsError, reloadNotifications, markAllNotificationsRead, markNotificationRead, clearNotifications, removeNotification, userById, unreadNotifications, toggleFollow, isFollowing } = useStore();
  const { confirm, toast } = useSystem();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const list = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "all") return true;
      if (filter === "unread") return !n.read;
      return n.kind === filter;
    });
  }, [notifications, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    list.forEach((n) => {
      const label = dayLabel(n.createdAt);
      map.set(label, [...(map.get(label) ?? []), n]);
    });
    return Array.from(map.entries());
  }, [list]);

  const open = (n: AppNotification) => {
    if (!n.read) markNotificationRead(n.id);
    if (n.to) navigate(n.to);
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="pb-28 lg:pb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2 px-3 pt-2 lg:px-0">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] font-extrabold leading-none tracking-[-0.035em] text-ink lg:text-[32px]">
            Notifications
          </h1>
          <p className="mt-1.5 text-[12.5px] font-semibold text-ink2">
            {unreadNotifications > 0 ? (
              <span className="text-brand">{unreadNotifications} unread</span>
            ) : (
              "You're all caught up"
            )}{" "}
            · {notifications.length} total
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          icon={<CheckCheck className="h-4 w-4" />}
          onClick={() => {
            markAllNotificationsRead();
            toast({ title: "All notifications marked as read", tone: "success" });
          }}
        >
          Mark all read
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Settings2 className="h-4 w-4" />}
          onClick={() => navigate("/settings?tab=notifications")}
        >
          Preferences
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="h-4 w-4" />}
          onClick={async () => {
            const ok = await confirm({
              title: "Clear all notifications?",
              message: "This permanently deletes all notifications saved to your account.",
              confirmLabel: "Clear all",
              tone: "danger",
            });
            if (ok) {
              clearNotifications();
              toast({ title: "Notifications cleared", tone: "warning" });
            }
          }}
        >
          Clear
        </Button>
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto no-scrollbar px-3 lg:px-0">
        {FILTERS.map((f) => {
          const count = f.id === "unread" ? unreadNotifications : 0;
          return (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
              {count > 0 && <span className="ml-1 text-brand">{count}</span>}
            </Chip>
          );
        })}
      </div>

      <div className="px-3 lg:px-0">
        {notificationsLoading ? (
          <div role="status" className="glass rounded-[22px] p-6 text-center text-sm font-semibold text-ink2">Loading notifications…</div>
        ) : notificationsError ? (
          <EmptyState icon={<BellOff className="h-6 w-6" />} title="Notifications are unavailable" body="We couldn’t load your notification history." action={<Button size="sm" variant="brand" onClick={reloadNotifications}>Try again</Button>} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<BellOff className="h-6 w-6" />}
            title={filter === "all" ? "No notifications yet" : "Nothing in this filter"}
            body="Likes, comments, follows, mentions and campus announcements will appear here."
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="brand" onClick={() => navigate("/home")}>Back to feed</Button>
                <Button size="sm" variant="outline" onClick={() => setFilter("all")}>Show all</Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-5">
            {groups.map(([label, items]) => (
              <section key={label}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-ink3">{label}</h2>
                  <span className="hairline h-px flex-1" />
                  <span className="text-[11px] font-bold text-ink3">{items.length}</span>
                </div>

                <div className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {items.map((n, i) => {
                      const meta = KIND_META[n.kind];
                      const actor = n.actorId ? userById(n.actorId) : null;
                      return (
                        <motion.div
                          key={n.id}
                          layout
                          initial={{ opacity: 0, x: -18 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 60, height: 0, marginBottom: 0 }}
                          transition={{ ...spring, delay: Math.min(i * 0.02, 0.16) }}
                          className="relative overflow-hidden rounded-[22px]"
                        >
                          {/* swipe-to-delete */}
                          <div className="absolute inset-y-0 right-0 flex items-center">
                            <button
                              onClick={() => removeNotification(n.id)}
                              aria-label="Dismiss notification"
                              className="grid h-full w-[74px] place-items-center bg-coral/20 text-coral"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <motion.div
                            drag="x"
                            dragConstraints={{ left: -74, right: 0 }}
                            dragElastic={{ left: 0.06, right: 0.02 }}
                            whileTap={{ scale: 0.995 }}
                            onClick={() => open(n)}
                            className={cn(
                              "glass relative flex cursor-pointer items-start gap-3 rounded-[22px] p-3",
                              !n.read && "border-brand/28 bg-brand/6",
                            )}
                          >
                            <div className="relative shrink-0">
                              {actor ? (
                                <Avatar src={actor.avatar} name={actor.name} size={42} />
                              ) : (
                                <span className="grid h-[42px] w-[42px] place-items-center rounded-full bg-brand/14 text-brand">
                                  {meta.icon}
                                </span>
                              )}
                              <span
                                className={cn(
                                  "absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--c-surface)]",
                                  meta.tone,
                                )}
                              >
                                {meta.icon}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                <p className={cn("min-w-0 flex-1 text-[13.5px] leading-snug", !n.read ? "font-extrabold text-ink" : "font-semibold text-ink2")}>
                                  {n.title}
                                </p>
                                <span className="shrink-0 text-[11px] font-semibold text-ink3 tabular-nums">
                                  {timeAgo(n.createdAt)}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink2">{n.body}</p>

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {!n.read && <Badge tone="brand">New</Badge>}
                                {n.kind === "follow" && n.actorId && (
                                  <Button
                                    size="xs"
                                    variant={isFollowing(n.actorId) ? "outline" : "brand"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const now = toggleFollow(n.actorId!);
                                      toast({ title: now ? "Followed back" : "Unfollowed", tone: now ? "success" : "info" });
                                    }}
                                  >
                                    {isFollowing(n.actorId) ? "Following" : "Follow back"}
                                  </Button>
                                )}
                                {n.kind === "message" && (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      open(n);
                                    }}
                                  >
                                    Open chat
                                  </Button>
                                )}
                                {n.kind === "campus" && <Badge tone="neutral">Announcement</Badge>}
                                <motion.span
                                  whileHover={{ x: 3 }}
                                  transition={springSnappy}
                                  className="ml-auto inline-flex items-center gap-0.5 text-[11.5px] font-bold text-ink3"
                                >
                                  View <ChevronRight className="h-3.5 w-3.5" />
                                </motion.span>
                              </div>
                            </div>

                            {!n.read && <span className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />}
                          </motion.div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
