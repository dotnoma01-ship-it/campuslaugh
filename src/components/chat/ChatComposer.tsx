import { AnimatePresence, motion } from "framer-motion";
import {
  CornerDownRight,
  FileText,
  Image as ImageIcon,
  Mic,
  Send,
  Smile,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import { emojiGroups } from "@/data/constants";
import type { Message } from "@/types";
import { cn } from "@/utils/format";
import { Avatar } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/overlays";
import { spring, springSnappy } from "@/components/ui/primitives";
import { uploadMedia } from "@/services/upload";

const EMOJI_RECENTS = emojiGroups[0]!.emojis;

export function ChatComposer({
  conversationId,
  replyTo,
  onCancelReply,
  editTarget,
  onCancelEdit,
}: {
  conversationId: string;
  replyTo: Message | null;
  onCancelReply: () => void;
  editTarget: Message | null;
  onCancelEdit: () => void;
}) {
  const { sendMessage, editMessage, setTyping, userById, me } = useStore();
  const { toast } = useSystem();
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (replyTo || editTarget) {
      if (editTarget) setText(editTarget.text ?? "");
      window.setTimeout(() => areaRef.current?.focus(), 140);
    }
  }, [replyTo, editTarget]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  useEffect(() => () => { if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current); setTyping(conversationId, false); }, [conversationId, setTyping]);

  const canSend = text.trim().length > 0;

  const send = () => {
    const value = text.trim();
    if (!value) return;
    setTyping(conversationId, false);
    if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
    if (editTarget) {
      editMessage(conversationId, editTarget.id, value);
      onCancelEdit();
      setText("");
      return;
    }
    sendMessage(conversationId, {
      kind: "text",
      text: value,
      replyTo: replyTo
        ? { id: replyTo.id, authorId: replyTo.authorId, text: replyTo.text ?? (replyTo.kind === "voice" ? "Voice message" : "Attachment") }
        : undefined,
    });
    setText("");
    onCancelReply();
    if (areaRef.current) areaRef.current.style.height = "0px";
  };

  /* ---------------------------- attachments --------------------------- */

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, 10);
    setUploading(true);
    try {
      const uploaded = await Promise.all(selected.map((file) => uploadMedia(file, undefined, { context: "chat", conversationId })));
      sendMessage(conversationId, { attachmentIds: uploaded.map((asset) => asset.publicId), text: text.trim() || undefined });
      setText("");
      toast({ title: `${uploaded.length} attachment${uploaded.length === 1 ? "" : "s"} sent`, tone: "success" });
    } catch (error) {
      toast({ title: "Attachment wasn’t sent", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    } finally {
      setUploading(false);
    }
  };

  const attachOptions = useMemo(
    () => [
      { id: "photo", label: "Photos", icon: <ImageIcon className="h-5 w-5" />, tone: "bg-brand/16 text-brand", action: () => fileRef.current?.click() },
      { id: "video", label: "Videos", icon: <Video className="h-5 w-5" />, tone: "bg-sky2/16 text-sky2", action: () => fileRef.current?.click() },
    ],
    [],
  );

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        multiple
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="relative shrink-0 px-2 pb-2 pt-1 lg:px-0">
        {/* reply / edit preview */}
        <AnimatePresence>
          {(replyTo || editTarget) && (
            <motion.div
              initial={{ opacity: 0, y: 16, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 10, height: 0 }}
              transition={springSnappy}
              className="mb-1.5 overflow-hidden"
            >
              <div className="glass flex items-center gap-2 rounded-2xl border-brand/25 px-3 py-2">
                {editTarget ? (
                  <FileText className="h-4 w-4 shrink-0 text-brand" />
                ) : (
                  <CornerDownRight className="h-4 w-4 shrink-0 text-brand" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-extrabold text-brand">
                    {editTarget ? "Editing message" : `Replying to ${userById(replyTo!.authorId).name}`}
                  </p>
                  <p className="truncate text-[12.5px] text-ink2">
                    {(editTarget ?? replyTo)?.text ?? "Attachment"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (editTarget) {
                      onCancelEdit();
                      setText("");
                    } else onCancelReply();
                  }}
                  aria-label="Cancel"
                  className="press grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/10 text-ink2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* emoji picker */}
        <AnimatePresence>
          {emojiOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={spring}
              className="glass-solid absolute inset-x-2 bottom-full z-30 mb-2 max-h-[46vh] overflow-y-auto thin-scrollbar rounded-[24px] p-3 lg:left-0 lg:right-auto lg:w-[380px]"
            >
              {emojiGroups.map((g) => (
                <div key={g.label} className="mb-2">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink3">{g.label}</p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {g.emojis.map((e) => (
                      <motion.button
                        key={e}
                        whileTap={{ scale: 0.82 }}
                        whileHover={{ scale: 1.18 }}
                        onClick={() => {
                          setText((t) => t + e);
                          areaRef.current?.focus();
                        }}
                        className="grid h-9 w-9 place-items-center rounded-xl text-[19px] hover:bg-ink/8"
                      >
                        {e}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="pb-1 text-center text-[10.5px] font-semibold text-ink3">
                Recently used: {EMOJI_RECENTS.slice(0, 6).join(" ")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* composer row */}
        <div className="glass-bar flex items-end gap-1.5 rounded-[26px] p-1.5">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setEmojiOpen((v) => !v)}
            aria-label="Emoji picker"
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors",
              emojiOpen ? "bg-brand/16 text-brand" : "text-ink2 hover:text-ink",
            )}
          >
            <Smile className="h-[21px] w-[21px]" />
          </motion.button>

          <textarea
            ref={areaRef}
            rows={1}
            value={text}
            onChange={(e) => {
              const value = e.target.value;
              setText(value);
              setTyping(conversationId, Boolean(value.trim()));
              if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
              if (value.trim()) typingTimerRef.current = window.setTimeout(() => setTyping(conversationId, false), 1600);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={editTarget ? "Edit message…" : "Message"}
            aria-label="Message"
            className="max-h-[132px] min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[14.5px] leading-snug outline-none placeholder:text-ink3"
          />

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setAttachOpen(true)}
            disabled={uploading}
            aria-label="Attachments"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink2 hover:text-ink disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21.4 11.05 12.3 20.14a5.5 5.5 0 0 1-7.78-7.78l9.1-9.09a3.67 3.67 0 0 1 5.19 5.19l-9.1 9.09a1.83 1.83 0 1 1-2.6-2.59l8.4-8.4" />
            </svg>
          </motion.button>

          <AnimatePresence mode="wait" initial={false}>
            {canSend || editTarget ? (
              <motion.button
                key="send"
                initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={springSnappy}
                whileTap={{ scale: 0.86 }}
                onClick={send}
                aria-label={editTarget ? "Save changes" : "Send message"}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-onbrand shadow-[0_10px_22px_-10px_rgba(183,243,74,.95)]"
              >
                {editTarget ? <FileText className="h-[18px] w-[18px]" /> : <Send className="h-[18px] w-[18px]" />}
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                initial={{ scale: 0.5, opacity: 0, rotate: 30 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={springSnappy}
                whileTap={{ scale: 0.86 }}
                onClick={() => toast({ title: "Voice messages aren’t available yet", description: "Chat media uploads are not connected to the server.", tone: "info" })}
                aria-label="Voice messages unavailable"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/10 text-ink hover:bg-brand/16 hover:text-brand"
              >
                <Mic className="h-[19px] w-[19px]" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-1 flex items-center justify-between px-2 text-[10.5px] font-semibold text-ink3">
          <span className="inline-flex items-center gap-1">
            <Avatar src={me.avatar} name={me.name} size={14} /> sending as @{me.username}
          </span>
          <span>Enter to send · Shift+Enter for a new line · hold a bubble for actions</span>
        </div>
      </div>

      {/* attachment sheet */}
      <BottomSheet open={attachOpen} onClose={() => setAttachOpen(false)} title="Attach" desktop="center" className="max-h-none">
        <div className="grid grid-cols-2 gap-3 p-4">
          {attachOptions.map((o, i) => (
            <motion.button
              key={o.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, ...springSnappy }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                o.action();
                setAttachOpen(false);
              }}
              className="flex flex-col items-center gap-2"
            >
              <span className={cn("grid h-14 w-14 place-items-center rounded-2xl border border-line", o.tone)}>
                {o.icon}
              </span>
              <span className="text-[11.5px] font-bold text-ink2">{o.label}</span>
            </motion.button>
          ))}
        </div>
        <p className="px-4 pb-4 text-[11.5px] leading-relaxed text-ink3">
          Image and video messages will be available when chat uploads are connected to the server.
        </p>
      </BottomSheet>
    </>
  );
}
