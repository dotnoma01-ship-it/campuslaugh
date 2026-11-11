import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CornerDownRight,
  FileText,
  Image as ImageIcon,
  MapPin,
  Mic,
  Send,
  Smile,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import { emojiGroups, quickReplies } from "@/data/mock";
import type { Message } from "@/types";
import { cn, mmss, uid } from "@/utils/format";
import { Avatar } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/overlays";
import { spring, springSnappy } from "@/components/ui/primitives";

const EMOJI_RECENTS = emojiGroups[0]!.emojis;

export function ChatComposer({
  conversationId,
  replyTo,
  onCancelReply,
  editTarget,
  onCancelEdit,
  onPickMedia,
}: {
  conversationId: string;
  replyTo: Message | null;
  onCancelReply: () => void;
  editTarget: Message | null;
  onCancelEdit: () => void;
  onPickMedia: (item: Message) => void;
}) {
  const { sendMessage, editMessage, setTyping, userById, me } = useStore();
  const { toast, haptic, showIsland } = useSystem();
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(24).fill(0.15));
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  /* ---------------------------- voice notes --------------------------- */

  const stopAnalyser = () => {
    if (analyserRef.current) window.clearInterval(analyserRef.current);
    analyserRef.current = null;
  };

  const startRecording = async () => {
    setRecordSeconds(0);
    chunksRef.current = [];
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.start();
      setRecording(true);
      haptic([12, 40, 12]);
      showIsland({ title: "Recording voice note", subtitle: "Tap the mic again or press send when you're done", duration: 3200 });

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyserRef.current = window.setInterval(() => {
        analyser.getByteFrequencyData(data);
        setLevels(Array.from({ length: 24 }, (_, i) => 0.14 + (data[i % data.length]! / 255) * 0.86));
      }, 90);
      tickRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setRecording(false);
      stopAnalyser();
      toast({
        title: "Microphone unavailable",
        description: "Permission denied or unsupported — sending a demo voice note instead.",
        tone: "warning",
        actionLabel: "Send demo",
        onAction: () => sendDemoVoice(7),
      });
    }
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    stopAnalyser();
    setLevels(Array(24).fill(0.15));
  };

  const finishRecording = (sendIt: boolean) => {
    const rec = recorderRef.current;
    const seconds = Math.max(1, recordSeconds);
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        cleanupStream();
        recorderRef.current = null;
        setRecording(false);
        if (sendIt && blob.size > 0) {
          sendMessage(conversationId, {
            kind: "voice",
            text: "Voice message",
            duration: seconds,
            media: { id: uid("v"), kind: "image", src: URL.createObjectURL(blob), alt: "Voice note" },
          });
        } else if (sendIt) {
          sendDemoVoice(seconds);
        }
      };
      rec.stop();
    } else {
      cleanupStream();
      setRecording(false);
      if (sendIt) sendDemoVoice(seconds);
    }
  };

  const sendDemoVoice = (seconds: number) => {
    sendMessage(conversationId, { kind: "voice", text: "Voice message", duration: Math.max(3, seconds) });
  };

  /* ---------------------------- attachments --------------------------- */

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    Array.from(files)
      .slice(0, 4)
      .forEach((f) => {
        const isVideo = f.type.startsWith("video");
        const item: Message = {
          id: uid("m"),
          conversationId,
          authorId: "me",
          kind: isVideo ? "video" : "image",
          createdAt: Date.now(),
          mine: true,
          status: "sending",
          media: {
            id: uid("md"),
            kind: isVideo ? "video" : "image",
            src: URL.createObjectURL(f),
            alt: f.name,
          },
          text: undefined,
        };
        onPickMedia(item);
      });
  };

  const attachOptions = useMemo(
    () => [
      { id: "photo", label: "Photos", icon: <ImageIcon className="h-5 w-5" />, tone: "bg-brand/16 text-brand", action: () => fileRef.current?.click() },
      { id: "video", label: "Videos", icon: <Video className="h-5 w-5" />, tone: "bg-sky2/16 text-sky2", action: () => fileRef.current?.click() },
      { id: "camera", label: "Camera", icon: <Camera className="h-5 w-5" />, tone: "bg-coral/16 text-coral", action: () => toast({ title: "Camera (demo)", description: "A real build would open the device camera here.", tone: "info" }) },
      {
        id: "doc",
        label: "Document",
        icon: <FileText className="h-5 w-5" />,
        tone: "bg-mint/16 text-mint",
        action: () => {
          sendMessage(conversationId, {
            kind: "document",
            fileName: "Lecture-Notes-Week-9.pdf",
            fileSize: "1.8 MB",
            text: "Document",
          });
          toast({ title: "Document sent (demo asset)", tone: "success" });
        },
      },
      { id: "loc", label: "Location", icon: <MapPin className="h-5 w-5" />, tone: "bg-[#ffcb5c]/16 text-[#ffcb5c]", action: () => toast({ title: "Location sharing coming soon", description: "Future-ready control — not wired to maps yet.", tone: "info" }) },
    ],
    [conversationId, sendMessage, toast],
  );

  return (
    <>
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
              <div className="mb-2 flex flex-wrap gap-1.5">
                {quickReplies.map((q) => (
                  <button
                    key={q}
                    onClick={() => setText((t) => `${t}${t ? " " : ""}${q}`)}
                    className="press rounded-full border border-line bg-glass px-2.5 py-1 text-[12px] font-bold text-ink2 hover:text-ink"
                  >
                    {q}
                  </button>
                ))}
              </div>
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

        {/* recording bar */}
        <AnimatePresence>
          {recording && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={spring}
              className="glass-solid absolute inset-x-2 bottom-0 z-30 flex items-center gap-3 rounded-[24px] p-3 lg:left-0 lg:right-0"
            >
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => finishRecording(false)}
                aria-label="Cancel recording"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral/16 text-coral"
              >
                <Trash2 className="h-4 w-4" />
              </motion.button>
              <div className="flex h-10 flex-1 items-center gap-[3px] overflow-hidden">
                {levels.map((l, i) => (
                  <motion.span
                    key={i}
                    animate={{ height: `${Math.max(6, l * 34)}px` }}
                    transition={{ duration: 0.12 }}
                    className="w-[3px] shrink-0 rounded-full bg-brand"
                  />
                ))}
              </div>
              <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-brand">{mmss(recordSeconds)}</span>
              <motion.span
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-coral"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => finishRecording(true)}
                aria-label="Send voice note"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-onbrand"
              >
                <Send className="h-[18px] w-[18px]" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* composer row */}
        <div className={cn("glass-bar flex items-end gap-1.5 rounded-[26px] p-1.5", recording && "opacity-0")}>
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
            aria-label="Attachments"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink2 hover:text-ink"
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
                onClick={() => void startRecording()}
                aria-label="Record voice message"
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
        <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-5">
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
          Files are handled entirely in your browser for this frontend demo — nothing is uploaded to a server.
        </p>
      </BottomSheet>
    </>
  );
}
