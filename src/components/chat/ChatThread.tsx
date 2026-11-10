import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  BellOff,
  CheckCheck,
  Copy,
  CornerDownRight,
  FileText,
  Forward,
  Image as ImageIcon,
  Info,
  MoreVertical,
  Palette,
  Phone,
  Pin,
  Search,
  ShieldAlert,
  Trash2,
  User as UserIcon,
  Video as VideoIcon,
  Archive,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import { useTheme } from "@/context/ThemeContext";
import { demoReactions, ME, reportReasons } from "@/data/mock";
import type { MediaItem, Message, WallpaperId } from "@/types";
import { cn, copyText, dayLabel, mmss } from "@/utils/format";
import { Avatar, Badge, Button, IconButton } from "@/components/ui/primitives";
import { BottomSheet, ContextMenu, Modal, useContextMenu } from "@/components/ui/overlays";
import { springSnappy } from "@/components/ui/primitives";
import { MessageBubble, TypingBubble } from "./MessageBubble";
import { ChatComposer } from "./ChatComposer";
import { MediaViewer } from "@/components/feed/Media";

const WALLPAPERS: { id: WallpaperId; label: string; css: string; chip: string }[] = [
  {
    id: "midnight",
    label: "Midnight",
    chip: "linear-gradient(140deg,#0d0f13,#1a1d24)",
    css: "radial-gradient(120% 70% at 50% 0%, rgba(183,243,74,0.09), transparent 55%), linear-gradient(180deg, #0b0d11, #08090b)",
  },
  {
    id: "linen",
    label: "Linen",
    chip: "linear-gradient(140deg,#fdfdfd,#eceef2)",
    css: "radial-gradient(120% 70% at 50% 0%, rgba(183,243,74,0.14), transparent 55%), linear-gradient(180deg, #fbfbfd, #f1f2f5)",
  },
  {
    id: "aurora",
    label: "Citrus",
    chip: "linear-gradient(140deg,#b7f34a,#4fd8b0)",
    css: "radial-gradient(90% 60% at 20% 10%, rgba(183,243,74,0.18), transparent 60%), radial-gradient(90% 60% at 85% 85%, rgba(79,216,176,0.16), transparent 60%), linear-gradient(180deg,#0b0d11,#08090b)",
  },
  {
    id: "graphite",
    label: "Graphite",
    chip: "linear-gradient(140deg,#2b2f36,#111318)",
    css: "repeating-linear-gradient(135deg, rgba(255,255,255,0.028) 0 2px, transparent 2px 9px), linear-gradient(180deg,#101216,#08090b)",
  },
  {
    id: "lime",
    label: "Lime haze",
    chip: "linear-gradient(140deg,#d9fb9b,#b7f34a)",
    css: "radial-gradient(80% 50% at 50% 0%, rgba(183,243,74,0.28), transparent 62%), linear-gradient(180deg,#0d0f13,#08090b)",
  },
];

export function wallpaperStyle(id: WallpaperId | undefined, resolved: "light" | "dark") {
  const w = WALLPAPERS.find((x) => x.id === id) ?? WALLPAPERS[0]!;
  if (resolved === "light" && (w.id === "midnight" || w.id === "graphite" || w.id === "aurora" || w.id === "lime")) {
    return WALLPAPERS.find((x) => x.id === "linen")!.css;
  }
  return w.css;
}

export function ChatThread({ conversationId }: { conversationId: string }) {
  const navigate = useNavigate();
  const {
    conversationById, userById, markConversationRead, sendMessage, deleteMessage,
    reactMessage, forwardMessage, togglePin, toggleMute, toggleArchive, setWallpaper, conversations,
  } = useStore();
  const { toast, confirm, actionSheet, showIsland, haptic } = useSystem();
  const { resolved } = useTheme();

  const conversation = conversationById(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editTarget, setEditTarget] = useState<Message | null>(null);
  const [menuMsg, setMenuMsg] = useState<Message | null>(null);
  const [viewer, setViewer] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [callState, setCallState] = useState<{ kind: "voice" | "video"; seconds: number } | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const menu = useContextMenu();
  const openedUnread = useRef(conversation?.unread ?? 0);


  const other = conversation ? userById(conversation.participantIds[0] ?? ME) : null;
  const title = conversation?.group ? conversation.title ?? "Group" : other?.name ?? "Chat";

  /* mark as read while open */
  useEffect(() => {
    if (!conversation) return;
    markConversationRead(conversation.id);
    const t = window.setInterval(() => markConversationRead(conversation.id), 2500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, conversation?.messages.length]);

  /* keep pinned to the newest message */
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [conversationId, scrollToBottom]);

  useEffect(() => {
    if (atBottom) scrollToBottom(true);
  }, [conversation?.messages.length, conversation?.typing, atBottom, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };

  /* simulated call */
  useEffect(() => {
    if (!callState) return;
    const t = window.setInterval(() => setCallState((c) => (c ? { ...c, seconds: c.seconds + 1 } : c)), 1000);
    return () => window.clearInterval(t);
  }, [callState]);

  const mediaMessages = useMemo(
    () => (conversation?.messages ?? []).filter((m) => !m.deleted && (m.kind === "image" || m.kind === "video") && m.media),
    [conversation?.messages],
  );

  const filteredMessages = useMemo(() => {
    if (!conversation) return [];
    if (!searchQuery.trim()) return conversation.messages;
    const q = searchQuery.toLowerCase();
    return conversation.messages.filter((m) => (m.text ?? "").toLowerCase().includes(q) || (m.fileName ?? "").toLowerCase().includes(q));
  }, [conversation, searchQuery]);

  if (!conversation || !other) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="glass max-w-sm rounded-3xl p-6 text-center">
          <h3 className="text-lg font-extrabold text-ink">Conversation not found</h3>
          <p className="mt-1.5 text-sm text-ink2">It may have been deleted from this device's demo data.</p>
          <Button className="mt-4" variant="brand" onClick={() => navigate("/chats")}>Back to inbox</Button>
        </div>
      </div>
    );
  }

  const startCall = (kind: "voice" | "video") => {
    setCallState({ kind, seconds: 0 });
    showIsland({
      title: `${kind === "voice" ? "Voice" : "Video"} call · ${title}`,
      subtitle: "Connecting… (frontend demo — no real call is placed)",
      duration: 3800,
    });
    toast({ title: `${kind === "voice" ? "Voice" : "Video"} call started (demo)`, description: "Calls are a future-ready control in this build.", tone: "info" });
  };

  const openMessageMenu = (pos: { clientX: number; clientY: number }, message: Message) => {
    setMenuMsg(message);
    haptic(10);
    menu.openAt(pos.clientX, pos.clientY);
  };

  const handleCopy = async (message: Message) => {
    const ok = await copyText(message.text ?? "");
    toast({ title: ok ? "Message copied" : "Nothing to copy", tone: ok ? "success" : "warning" });
  };

  const handleForward = async (message: Message) => {
    const target = await actionSheet({
      title: "Forward message to…",
      actions: conversations
        .filter((c) => c.id !== conversation.id)
        .map((c) => ({
          id: c.id,
          label: c.group ? c.title ?? "Group" : userById(c.participantIds[0] ?? ME).name,
          icon: <Forward className="h-4 w-4" />,
        })),
    });
    if (target) forwardMessage(target, message);
  };

  const clearChat = async () => {
    const ok = await confirm({
      title: "Clear this conversation?",
      message: "All messages in this demo thread will be removed from this device.",
      confirmLabel: "Clear chat",
      tone: "danger",
    });
    if (!ok) return;
    conversation.messages.forEach((m) => deleteMessage(conversation.id, m.id));
    toast({ title: "Conversation cleared", tone: "warning" });
  };

  async function reportFlow() {
    const choice = await actionSheet({
      title: `Report ${title}?`,
      message: "Reports are queued locally in this frontend demo.",
      actions: [
        ...reportReasons.map((r) => ({ id: r, label: r })),
        { id: "__block", label: `Block ${title}`, tone: "danger" as const },
      ],
    });
    if (!choice) return;
    if (choice === "__block") {
      const ok = await confirm({ title: `Block ${title}?`, message: "They won't be able to message you in this demo session.", confirmLabel: "Block", tone: "danger" });
      if (ok) toast({ title: `${title} blocked`, description: "Manage this in Settings → Safety", tone: "warning" });
    } else {
      toast({ title: "Report submitted", description: choice, tone: "warning" });
    }
  }

  /* group messages with day separators + read boundary */
  const rows: { kind: "day" | "unread" | "msg"; label?: string; message?: Message; index: number; msgIndex?: number }[] = [];
  let lastDay = "";
  const firstUnreadIndex = openedUnread.current
    ? filteredMessages.findIndex((m) => !m.mine && m.status !== "read")
    : -1;
  filteredMessages.forEach((m, i) => {
    const day = dayLabel(m.createdAt);
    if (day !== lastDay) {
      rows.push({ kind: "day", label: day, index: rows.length });
      lastDay = day;
    }
    if (i === firstUnreadIndex && firstUnreadIndex > 0) rows.push({ kind: "unread", index: rows.length });
    rows.push({ kind: "msg", message: m, index: rows.length, msgIndex: i });
  });

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden lg:rounded-[28px] lg:border lg:border-line">
      {/* wallpaper */}
      <div className="pointer-events-none absolute inset-0" style={{ background: wallpaperStyle(conversation.wallpaper, resolved) }} />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.12]" />

      {/* header */}
      <motion.header
        className="glass-bar relative z-20 flex shrink-0 items-center gap-2 border-b border-line px-2 py-2.5 lg:px-3"
      >
        <IconButton label="Back to inbox" onClick={() => navigate("/chats")} className="lg:hidden">
          <ArrowLeft className="h-[18px] w-[18px]" />
        </IconButton>

        <button
          onClick={() => setInfoOpen(true)}
          className="press flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-1 py-1 text-left"
        >
          {conversation.group ? (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/16 text-brand">
              <UserIcon className="h-5 w-5" />
            </span>
          ) : (
            <Avatar src={other.avatar} name={other.name} size={40} online={other.online} />
          )}
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] font-extrabold text-ink">{title}</span>
            <span className="block truncate text-[11.5px] font-semibold text-ink2">
              {conversation.typing ? (
                <span className="text-brand">typing…</span>
              ) : conversation.group ? (
                `${conversation.participantIds.length + 1} members · ${conversation.participantIds.map((p) => userById(p).name.split(" ")[0]).join(", ")}`
              ) : other.online ? (
                <span className="text-mint">Online</span>
              ) : (
                `Last seen ${other.lastSeen ?? "recently"}`
              )}
            </span>
          </span>
        </button>

        <IconButton label="Search in conversation" size="sm" onClick={() => setSearchOpen((s) => !s)} active={searchOpen}>
          <Search className="h-4 w-4" />
        </IconButton>
        <IconButton label="Voice call (demo)" size="sm" onClick={() => startCall("voice")} className="hidden sm:grid">
          <Phone className="h-4 w-4" />
        </IconButton>
        <IconButton label="Video call (demo)" size="sm" onClick={() => startCall("video")} className="hidden sm:grid">
          <VideoIcon className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="More options"
          size="sm"
          onClick={(e) => {
            menu.openFromEvent(e);
            setMenuMsg(null);
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </IconButton>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="absolute inset-x-2 top-full z-30 mt-2 overflow-hidden"
            >
              <div className="glass-solid flex items-center gap-2 rounded-2xl px-3 py-2">
                <Search className="h-4 w-4 text-ink3" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in this conversation"
                  className="h-8 flex-1 bg-transparent text-[13.5px] outline-none"
                />
                <span className="text-[11.5px] font-bold text-ink3">{filteredMessages.length} results</span>
                <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }} aria-label="Close search" className="press text-ink3 hover:text-ink">
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} className="relative z-10 min-h-0 flex-1 overflow-y-auto thin-scrollbar px-2 py-3 lg:px-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-[3px]">
          <div className="mb-3 flex flex-col items-center gap-2 py-2 text-center">
            <Avatar src={conversation.group ? undefined : other.avatar} name={title} size={64} />
            <div>
              <h2 className="font-display text-[19px] font-extrabold text-ink">{title}</h2>
              <p className="text-[12.5px] font-semibold text-ink2">
                {conversation.group ? "Group conversation" : `@${other.username} · ${other.institution}`}
              </p>
            </div>
            <span className="glass rounded-full px-3 py-1 text-[11px] font-semibold text-ink3">
              🔒 End-to-end demo — messages live only on this device
            </span>
          </div>

          <AnimatePresence initial={false}>
            {rows.map((row) => {
              if (row.kind === "day")
                return (
                  <motion.div
                    key={`day-${row.label}-${row.index}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="my-3 flex justify-center"
                  >
                    <span className="glass rounded-full px-3 py-1 text-[11px] font-bold text-ink2">{row.label}</span>
                  </motion.div>
                );
              if (row.kind === "unread")
                return (
                  <motion.div
                    key={`unread-${row.index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="my-3 flex items-center gap-2"
                  >
                    <span className="h-px flex-1 bg-coral/40" />
                    <span className="rounded-full bg-coral/16 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-coral">
                      Unread messages
                    </span>
                    <span className="h-px flex-1 bg-coral/40" />
                  </motion.div>
                );

              const m = row.message!;
              const mi = row.msgIndex ?? 0;
              const prev = filteredMessages[mi - 1];
              const next = filteredMessages[mi + 1];
              const grouped = !!prev && prev.authorId === m.authorId && m.createdAt - prev.createdAt < 5 * 60_000;
              const isLastOfGroup = !next || next.authorId !== m.authorId || next.createdAt - m.createdAt > 5 * 60_000;
              return (
                <motion.div
                  key={m.id}
                  layout="position"
                  className={cn(grouped ? "mt-[2px]" : "mt-2.5", m.reactions?.length && isLastOfGroup && "mb-3")}
                  data-mid={m.id}
                >
                  <MessageBubble
                    message={m}
                    grouped={grouped}
                    showAvatar={!grouped}
                    inGroup={conversation.group}
                    highlighted={menuMsg?.id === m.id && menu.open}
                    onOpenMenu={openMessageMenu}
                    onReplyPreview={(target) => {
                      const original = conversation.messages.find((x) => x.id === target.replyTo?.id);
                      if (original) original && scrollRef.current?.querySelector(`[data-mid="${original.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>

          <AnimatePresence>
            {conversation.typing && (
              <div className="mt-2">
                <TypingBubble name={conversation.group ? userById(conversation.participantIds[0] ?? ME).name.split(" ")[0]! : title} />
              </div>
            )}
          </AnimatePresence>
          <div className="h-2" />
        </div>
      </div>

      {/* jump to latest */}
      <AnimatePresence>
        {!atBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.6, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 12 }}
            transition={springSnappy}
            whileTap={{ scale: 0.9 }}
            onClick={() => scrollToBottom()}
            aria-label="Scroll to latest message"
            className="glass-solid absolute bottom-28 right-4 z-20 grid h-10 w-10 place-items-center rounded-full text-brand lg:bottom-24"
          >
            <ArrowDown className="h-[18px] w-[18px]" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* composer */}
      <div className="relative z-20 shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ChatComposer
          conversationId={conversation.id}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editTarget={editTarget}
          onCancelEdit={() => setEditTarget(null)}
          onPickMedia={(item) => {
            sendMessage(conversation.id, {
              kind: item.kind,
              media: item.media,
              text: item.text,
            });
          }}
        />
      </div>

      {/* message context menu */}
      <ContextMenu
        open={menu.open}
        onClose={() => {
          menu.close();
          setMenuMsg(null);
        }}
        x={menu.x}
        y={menu.y}
        header={
          menuMsg && !menuMsg.deleted ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">React</p>
              <div className="flex gap-1">
                {demoReactions.map((e) => (
                  <motion.button
                    key={e}
                    whileHover={{ scale: 1.25, y: -2 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => {
                      reactMessage(conversation.id, menuMsg.id, e);
                      menu.close();
                      setMenuMsg(null);
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full bg-ink/6 text-[18px] hover:bg-brand/16"
                  >
                    {e}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : undefined
        }
        items={
          menuMsg
            ? menuMsg.deleted
              ? [{ id: "info", label: "This message was deleted", icon: <Info className="h-4 w-4" /> }]
              : [
                  { id: "reply", label: "Reply", icon: <CornerDownRight className="h-4 w-4" />, tone: "brand", onSelect: () => { setReplyTo(menuMsg); setEditTarget(null); } },
                  { id: "copy", label: "Copy text", icon: <Copy className="h-4 w-4" />, onSelect: () => void handleCopy(menuMsg) },
                  ...(menuMsg.mine
                    ? [
                        { id: "edit", label: "Edit message", icon: <FileText className="h-4 w-4" />, onSelect: () => { setEditTarget(menuMsg); setReplyTo(null); } },
                        { id: "delete", label: "Delete message", icon: <Trash2 className="h-4 w-4" />, tone: "danger" as const, onSelect: () => { void confirm({ title: "Delete this message?", message: "It will be replaced with a deletion notice for everyone in this demo thread.", confirmLabel: "Delete", tone: "danger" }).then((ok) => ok && deleteMessage(conversation.id, menuMsg.id)); } },
                      ]
                    : []),
                  { id: "forward", label: "Forward…", icon: <Forward className="h-4 w-4" />, onSelect: () => void handleForward(menuMsg) },
                  ...(menuMsg.media
                    ? [{ id: "view", label: "Open media", icon: <ImageIcon className="h-4 w-4" />, onSelect: () => { const idx = mediaMessages.findIndex((x) => x.id === menuMsg.id); setViewer({ items: mediaMessages.map((x) => x.media!), index: Math.max(0, idx) }); } }]
                    : []),
                  { id: "info", label: "Message info", icon: <Info className="h-4 w-4" />, onSelect: () => toast({ title: `Sent ${dayLabel(menuMsg.createdAt)}`, description: `Status: ${menuMsg.status ?? "delivered"} · reactions: ${menuMsg.reactions?.length ?? 0}`, tone: "info" }) },
                ]
            : [
                { id: "info", label: "Conversation info", icon: <Info className="h-4 w-4" />, onSelect: () => setInfoOpen(true) },
                { id: "wallpaper", label: "Chat wallpaper", icon: <Palette className="h-4 w-4" />, onSelect: () => setInfoOpen(true) },
                { id: "pin", label: conversation.pinned ? "Unpin conversation" : "Pin conversation", icon: <Pin className="h-4 w-4" />, onSelect: () => togglePin(conversation.id) },
                { id: "mute", label: conversation.muted ? "Unmute" : "Mute notifications", icon: <BellOff className="h-4 w-4" />, onSelect: () => toggleMute(conversation.id) },
                { id: "archive", label: conversation.archived ? "Restore" : "Archive conversation", icon: <Archive className="h-4 w-4" />, onSelect: () => toggleArchive(conversation.id) },
                { id: "clear", label: "Clear chat", icon: <Trash2 className="h-4 w-4" />, tone: "danger", onSelect: () => void clearChat() },
                { id: "report", label: "Report or block", icon: <ShieldAlert className="h-4 w-4" />, tone: "danger", onSelect: () => void reportFlow() },
              ]
        }
      />

      {/* conversation info / wallpaper */}
      <BottomSheet open={infoOpen} onClose={() => setInfoOpen(false)} title="Conversation info" desktop="panel">
        <div className="space-y-4 p-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar src={conversation.group ? undefined : other.avatar} name={title} size={72} online={other.online} />
            <h3 className="font-display text-[18px] font-extrabold text-ink">{title}</h3>
            <p className="text-[12.5px] text-ink2">
              {conversation.group ? `${conversation.participantIds.length + 1} members` : `${other.institution} · @${other.username}`}
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {conversation.pinned && <Badge tone="brand">Pinned</Badge>}
              {conversation.muted && <Badge tone="coral">Muted</Badge>}
              {conversation.archived && <Badge>Archived</Badge>}
              <Badge tone="mint">{mediaMessages.length} media</Badge>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink3">Wallpaper</p>
            <div className="grid grid-cols-5 gap-2">
              {WALLPAPERS.map((w) => (
                <motion.button
                  key={w.id}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setWallpaper(conversation.id, w.id);
                    toast({ title: `Wallpaper set to ${w.label}`, tone: "success" });
                  }}
                  className={cn(
                    "relative h-16 overflow-hidden rounded-2xl border-2",
                    (conversation.wallpaper ?? "midnight") === w.id ? "border-brand" : "border-line",
                  )}
                  style={{ background: w.chip }}
                  aria-label={w.label}
                >
                  {(conversation.wallpaper ?? "midnight") === w.id && (
                    <motion.span layoutId="wall-check" className="absolute inset-0 grid place-items-center bg-black/35 text-brand">
                      <CheckCheck className="h-5 w-5" />
                    </motion.span>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" icon={<Pin className="h-4 w-4" />} onClick={() => togglePin(conversation.id)}>
              {conversation.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button variant="outline" size="sm" icon={<BellOff className="h-4 w-4" />} onClick={() => toggleMute(conversation.id)}>
              {conversation.muted ? "Unmute" : "Mute"}
            </Button>
            <Button variant="outline" size="sm" icon={<Archive className="h-4 w-4" />} onClick={() => { toggleArchive(conversation.id); setInfoOpen(false); navigate("/chats"); }}>
              {conversation.archived ? "Restore" : "Archive"}
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => void clearChat()}>
              Clear chat
            </Button>
          </div>

          {mediaMessages.length > 0 && (
            <div>
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink3">Shared media</p>
              <div className="grid grid-cols-4 gap-1.5">
                {mediaMessages.map((m, i) => (
                  <motion.button
                    key={m.id}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setViewer({ items: mediaMessages.map((x) => x.media!), index: i })}
                    className="aspect-square overflow-hidden rounded-xl border border-line"
                  >
                    {m.kind === "video" ? (
                      <video src={m.media!.src} poster={m.media!.poster} muted className="h-full w-full object-cover" />
                    ) : (
                      <img src={m.media!.src} alt={m.media!.alt ?? "media"} loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {!conversation.group && (
            <Button variant="ghost" size="sm" block icon={<UserIcon className="h-4 w-4" />} onClick={() => { setInfoOpen(false); navigate(`/profile/${other.id}`); }}>
              View {other.name.split(" ")[0]}'s profile
            </Button>
          )}
        </div>
      </BottomSheet>

      {/* active call overlay */}
      <AnimatePresence>
        {callState && (
          <Modal open onClose={() => setCallState(null)} width="max-w-xs">
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              >
                <Avatar src={other.avatar} name={title} size={84} ring />
              </motion.div>
              <div>
                <p className="text-[15px] font-extrabold text-ink">{title}</p>
                <p className="text-[12.5px] font-semibold text-brand tabular-nums">
                  {callState.kind === "voice" ? "Voice call" : "Video call"} · {mmss(callState.seconds)}
                </p>
              </div>
              <p className="max-w-[240px] text-[12px] leading-relaxed text-ink3">
                Calling is a future-ready control in this frontend build — no audio or video is transmitted.
              </p>
              <div className="mt-1 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCallState(null)}>Mute (demo)</Button>
                <Button variant="danger" size="sm" onClick={() => { toast({ title: "Call ended", description: mmss(callState.seconds), tone: "info" }); setCallState(null); }}>
                  End call
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

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
    </div>
  );
}
