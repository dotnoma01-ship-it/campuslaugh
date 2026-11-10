import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  BellOff,
  CheckCheck,
  Inbox,
  MoreVertical,
  Pin,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import { ME, userArray } from "@/data/mock";
import type { Conversation } from "@/types";
import { cn, clockTime, timeAgo } from "@/utils/format";
import { Avatar, Button, Chip, EmptyState, IconButton, SearchField } from "@/components/ui/primitives";
import { BottomSheet, ContextMenu, useContextMenu } from "@/components/ui/overlays";
import { spring } from "@/components/ui/primitives";

/** remembers the inbox scroll offset so returning from a chat feels continuous */
let savedScroll = 0;

type Filter = "all" | "unread" | "pinned" | "groups" | "archived";

export function ChatInbox() {
  const navigate = useNavigate();
  const { conversations, userById, togglePin, toggleMute, toggleArchive, markConversationRead, startConversation } = useStore();
  const { confirm, toast } = useSystem();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const menu = useContextMenu();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: savedScroll });
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => {
        if (filter === "archived") return !!c.archived;
        if (c.archived) return false;
        if (filter === "unread") return c.unread > 0;
        if (filter === "pinned") return !!c.pinned;
        if (filter === "groups") return !!c.group;
        return true;
      })
      .filter((c) => {
        if (!q) return true;
        const title = conversationTitle(c);
        return (
          title.toLowerCase().includes(q) ||
          c.messages.some((m) => (m.text ?? "").toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        const la = a.messages.at(-1)?.createdAt ?? 0;
        const lb = b.messages.at(-1)?.createdAt ?? 0;
        return lb - la;
      });
  }, [conversations, filter, query]);

  const conversationTitle = (c: Conversation) =>
    c.group ? c.title ?? "Group" : userById(c.participantIds[0] ?? ME).name;

  const openChat = (c: Conversation) => {
    savedScroll = listRef.current?.scrollTop ?? 0;
    navigate(`/chats/${c.id}`);
  };

  const unreadCount = conversations.reduce((s, c) => s + (c.archived ? 0 : c.unread), 0);

  return (
    <div className="relative flex h-full flex-col">
      {/* header */}
      <div className="sticky top-0 z-20 px-3 pb-2 pt-3 lg:px-0 lg:pt-0">
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[26px] font-extrabold leading-none tracking-[-0.035em] text-ink">
              Messages
            </h1>
            <p className="mt-1.5 text-[12.5px] font-semibold text-ink2">
              {conversations.filter((c) => !c.archived).length} conversations
              {unreadCount > 0 && <span className="text-brand"> · {unreadCount} unread</span>}
            </p>
          </div>
          <IconButton label="Search conversations" onClick={() => setSearchOpen((s) => !s)} active={searchOpen}>
            <Search className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label="New message" onClick={() => setNewOpen(true)}>
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </IconButton>
          <IconButton
            label="Inbox options"
            onClick={(e) => {
              menu.openFromEvent(e);
              setPick("inbox");
            }}
          >
            <MoreVertical className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 overflow-hidden"
            >
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Search people and messages"
                autoFocus
                leading={<Search className="h-4 w-4" />}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {(
            [
              ["all", "All"],
              ["unread", `Unread${unreadCount ? ` ${unreadCount}` : ""}`],
              ["pinned", "Pinned"],
              ["groups", "Groups"],
              ["archived", "Archived"],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <Chip key={value} active={filter === value} onClick={() => setFilter(value)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {/* list */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto thin-scrollbar px-3 pb-28 lg:px-0 lg:pb-4">
        {rows.length === 0 ? (
          <EmptyState
            className="mt-6 border-0"
            icon={<Inbox className="h-6 w-6" />}
            title={query ? "No matches" : filter === "archived" ? "Archive is empty" : "Nothing here yet"}
            body={
              query
                ? `No conversation or message matches “${query}”.`
                : "Swipe a conversation left to pin, mute or archive it."
            }
            action={
              query ? (
                <Button size="sm" variant="outline" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              ) : (
                <Button size="sm" variant="brand" onClick={() => setNewOpen(true)}>
                  Start a conversation
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {rows.map((c, i) => {
                const other = userById(c.participantIds[0] ?? ME);
                const title = conversationTitle(c);
                const last = c.messages.at(-1);
                const preview = last
                  ? last.deleted
                    ? "🚫 Message deleted"
                    : last.kind === "image"
                      ? "📷 Photo"
                      : last.kind === "video"
                        ? "🎬 Video"
                        : last.kind === "voice"
                          ? `🎤 Voice message · ${last.duration ?? 0}s`
                          : last.kind === "document"
                            ? `📎 ${last.fileName}`
                            : (last.text ?? "")
                  : "No messages yet";
                return (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -60, height: 0, marginBottom: 0 }}
                    transition={{ ...spring, delay: Math.min(i * 0.025, 0.2) }}
                    className="relative overflow-hidden rounded-[22px]"
                  >
                    {/* swipe actions behind the row */}
                    <div className="absolute inset-y-0 right-0 flex items-stretch">
                      <SwipeAction
                        tone="brand"
                        label={c.pinned ? "Unpin" : "Pin"}
                        icon={<Pin className="h-4 w-4" />}
                        onClick={() => togglePin(c.id)}
                      />
                      <SwipeAction
                        tone="warn"
                        label={c.muted ? "Unmute" : "Mute"}
                        icon={<BellOff className="h-4 w-4" />}
                        onClick={() => toggleMute(c.id)}
                      />
                      <SwipeAction
                        tone="neutral"
                        label={c.archived ? "Restore" : "Archive"}
                        icon={c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        onClick={() => toggleArchive(c.id)}
                      />
                      <SwipeAction
                        tone="danger"
                        label="Delete"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Delete conversation with ${title}?`,
                            message: "All messages in this demo conversation will be removed from this device.",
                            confirmLabel: "Delete",
                            tone: "danger",
                          });
                          if (ok) {
                            toggleArchive(c.id);
                            toast({ title: "Conversation removed from inbox", tone: "warning" });
                          }
                        }}
                      />
                    </div>

                    <motion.button
                      drag="x"
                      dragConstraints={{ left: -232, right: 0 }}
                      dragElastic={{ left: 0.08, right: 0.02 }}
                      whileTap={{ scale: 0.995 }}
                      onPointerDown={(e) => {
                        const t = window.setTimeout(() => {
                          setPick(c.id);
                          menu.openAt(e.clientX, e.clientY);
                        }, 480);
                        const cancel = () => window.clearTimeout(t);
                        e.currentTarget.addEventListener("pointerup", cancel, { once: true });
                        e.currentTarget.addEventListener("pointermove", cancel, { once: true });
                      }}
                      onClick={() => openChat(c)}
                      className={cn(
                        "glass relative flex w-full items-center gap-3 rounded-[22px] p-3 text-left",
                        c.unread > 0 && "border-brand/25",
                      )}
                    >
                      <div className="relative shrink-0">
                        {c.group ? (
                          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/16 text-brand">
                            <Users className="h-5 w-5" />
                          </span>
                        ) : (
                          <Avatar src={other.avatar} name={other.name} size={48} online={other.online} />
                        )}
                        {c.muted && (
                          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--c-surface)] bg-ink/70 text-[9px] text-white">
                            <BellOff className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className={cn("truncate text-[14px]", c.unread ? "font-extrabold text-ink" : "font-bold text-ink")}>
                            {title}
                          </span>
                          {c.pinned && <Pin className="h-3 w-3 shrink-0 rotate-45 text-brand" />}
                          <span className="ml-auto shrink-0 text-[11px] font-semibold text-ink3 tabular-nums">
                            {last ? (Date.now() - last.createdAt < 86400000 ? clockTime(last.createdAt) : timeAgo(last.createdAt)) : ""}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {last?.mine && (
                            <CheckCheck
                              className={cn("h-3.5 w-3.5 shrink-0", last.status === "read" ? "text-brand" : "text-ink3")}
                            />
                          )}
                          <span className={cn("truncate text-[12.5px]", c.unread ? "font-semibold text-ink" : "text-ink2")}>
                            {c.typing ? (
                              <span className="text-brand">typing…</span>
                            ) : c.group && last && !last.mine ? (
                              <>
                                <span className="font-bold text-ink2">{userById(last.authorId).name.split(" ")[0]}:</span>{" "}
                                {preview}
                              </>
                            ) : (
                              preview
                            )}
                          </span>
                          {c.unread > 0 && (
                            <span className="ml-auto grid h-[19px] min-w-[19px] shrink-0 place-items-center rounded-full bg-brand px-1 text-[10.5px] font-extrabold text-onbrand">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* long-press context menu */}
      <ContextMenu
        open={menu.open}
        onClose={menu.close}
        x={menu.x}
        y={menu.y}
        items={
          pick === "inbox"
            ? [
                { id: "read", label: "Mark all as read", icon: <CheckCheck className="h-4 w-4" />, onSelect: () => { conversations.forEach((c) => markConversationRead(c.id)); toast({ title: "All conversations marked read", tone: "success" }); } },
                { id: "archived", label: "View archived", icon: <Archive className="h-4 w-4" />, onSelect: () => setFilter("archived") },
                { id: "unread", label: "Filter unread only", icon: <Inbox className="h-4 w-4" />, onSelect: () => setFilter("unread") },
                { id: "new", label: "New message", icon: <Users className="h-4 w-4" />, tone: "brand", onSelect: () => setNewOpen(true) },
              ]
            : (() => {
                const c = conversations.find((x) => x.id === pick);
                if (!c) return [];
                const title = conversationTitle(c);
                return [
                  { id: "open", label: "Open chat", icon: <Inbox className="h-4 w-4" />, onSelect: () => openChat(c) },
                  { id: "read", label: c.unread ? "Mark as read" : "Mark as unread", icon: <CheckCheck className="h-4 w-4" />, onSelect: () => { if (c.unread) markConversationRead(c.id); else toast({ title: `Marked ${title} unread (demo)`, tone: "info" }); } },
                  { id: "pin", label: c.pinned ? "Unpin" : "Pin to top", icon: <Pin className="h-4 w-4" />, onSelect: () => togglePin(c.id) },
                  { id: "mute", label: c.muted ? "Unmute" : "Mute notifications", icon: <BellOff className="h-4 w-4" />, onSelect: () => toggleMute(c.id) },
                  { id: "archive", label: c.archived ? "Restore" : "Archive", icon: c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />, onSelect: () => toggleArchive(c.id) },
                  { id: "profile", label: "View profile", icon: <Users className="h-4 w-4" />, onSelect: () => navigate(`/profile/${c.participantIds[0]}`) },
                ];
              })()
        }
      />

      {/* new message picker */}
      <BottomSheet open={newOpen} onClose={() => setNewOpen(false)} title="New message" desktop="panel">
        <div className="space-y-1 p-3">
          {userArray
            .filter((u) => u.id !== ME)
            .map((u, i) => (
              <motion.button
                key={u.id}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const id = startConversation(u.id);
                  setNewOpen(false);
                  savedScroll = listRef.current?.scrollTop ?? 0;
                  navigate(`/chats/${id}`);
                }}
                className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-ink/6"
              >
                <Avatar src={u.avatar} name={u.name} size={42} online={u.online} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-ink">{u.name}</span>
                  <span className="block truncate text-[12px] text-ink3">
                    @{u.username} · {u.institution}
                  </span>
                </span>
                {u.online && <span className="shrink-0 text-[11px] font-bold text-mint">Online</span>}
              </motion.button>
            ))}
        </div>
      </BottomSheet>

    </div>
  );
}

function SwipeAction({
  label,
  icon,
  onClick,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone: "brand" | "warn" | "neutral" | "danger";
}) {
  const tones = {
    brand: "bg-brand/22 text-brand",
    warn: "bg-[#ffcb5c]/20 text-[#ffcb5c]",
    neutral: "bg-ink/12 text-ink2",
    danger: "bg-coral/20 text-coral",
  };
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn("flex w-[58px] flex-col items-center justify-center gap-1 text-[10px] font-bold", tones[tone])}
    >
      {icon}
      {label}
    </motion.button>
  );
}
