import { AnimatePresence, motion } from "framer-motion";
import { Check, Link2, MessageCircle, MoreHorizontal, Share2, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSystem } from "@/context/SystemContext";
import { useStore } from "@/context/StoreContext";
import { reportReasons } from "@/data/constants";
import { cn, copyText } from "@/utils/format";
import { Avatar, Button } from "@/components/ui/primitives";
import { springSnappy } from "@/components/ui/primitives";
import { ActionSheetHost, BottomSheet, ConfirmHost, Modal } from "@/components/ui/overlays";
import { PostCard } from "@/components/feed/PostCard";
import { MediaViewer } from "@/components/feed/Media";
import { ProfilePreview } from "@/components/profile/ProfilePreview";
import { backend } from "@/services/backend";

/**
 * Renders every globally-triggered overlay: post detail, profile preview,
 * share sheet, report dialog, media viewer, plus the system confirm and
 * action-sheet hosts. Nothing in the app uses window.alert/confirm/prompt.
 */
export function GlobalOverlays() {
  const { overlay, closeOverlay, toast } = useSystem();
  const { postById, userById } = useStore();
  const navigate = useNavigate();

  const post = overlay?.kind === "post" || overlay?.kind === "share" || overlay?.kind === "report"
    ? postById(overlay.postId)
    : undefined;
  const profileId = overlay?.kind === "profile" ? overlay.userId : null;

  return (
    <>
      {/* post detail */}
      <Modal open={overlay?.kind === "post"} onClose={closeOverlay} title="Post" width="max-w-xl">
        {post && <PostCard post={post} onOpenProfile={(id) => { closeOverlay(); navigate(`/profile/${id}`); }} />}
      </Modal>

      {/* profile preview */}
      <ProfilePreview userId={profileId} open={overlay?.kind === "profile"} onClose={closeOverlay} />

      {/* share sheet */}
      <ShareSheet
        open={overlay?.kind === "share"}
        onClose={closeOverlay}
        postId={overlay?.kind === "share" ? overlay.postId : null}
        postAuthor={post ? userById(post.authorId).name : ""}
      />

      {/* report dialog */}
      <ReportDialog
        open={overlay?.kind === "report"}
        onClose={closeOverlay}
        onReport={async (reason, details) => {
          if (overlay?.kind !== "report" || !post) throw new Error("This post is no longer available.");
          await backend.report("post", overlay.postId, reason, details);
          closeOverlay();
          toast({ title: "Report submitted", description: "Thanks for helping keep CampusLaugh safe.", tone: "success" });
        }}
      />

      {/* standalone media overlay */}
      <AnimatePresence>
        {overlay?.kind === "media" && (
          <MediaViewer
            items={[{ id: "ov", kind: overlay.kind2, src: overlay.src, poster: overlay.poster, alt: overlay.alt }]}
            index={0}
            onClose={closeOverlay}
            onIndexChange={() => undefined}
          />
        )}
      </AnimatePresence>

      <ConfirmHost />
      <ActionSheetHost />
    </>
  );
}

/* ------------------------------ share ------------------------------ */

function ShareSheet({
  open,
  onClose,
  postId,
  postAuthor,
}: {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  postAuthor: string;
}) {
  const { toast, showOverlay } = useSystem();
  const { sendMessage, conversations, userById } = useStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const link = postId ? `${window.location.origin}/#/home?post=${encodeURIComponent(postId)}` : window.location.origin;
  const shareTargets = conversations.filter((conversation) => !conversation.archived).map((conversation) => {
    const person = conversation.group ? undefined : userById(conversation.participantIds[0] ?? "me");
    return { id: conversation.id, label: conversation.group ? conversation.title ?? "Group chat" : person?.name ?? "Conversation", avatar: person?.avatar };
  });

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const copy = async () => {
    const ok = await copyText(link);
    setCopied(ok);
    toast({ title: ok ? "Link copied to clipboard" : "Couldn't copy link", tone: ok ? "success" : "error" });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Share${postAuthor ? ` · ${postAuthor}` : ""}`} desktop="center" className="max-h-[86vh]">
      <div className="space-y-4 p-4">
        <div className="glass flex items-center gap-3 rounded-2xl p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/14 text-brand">
            <Link2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink2">{link}</span>
          <Button size="sm" variant={copied ? "solid" : "brand"} icon={copied ? <Check className="h-4 w-4" /> : undefined} onClick={() => void copy()}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink3">Send to</p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {shareTargets.map((t, i) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035, ...springSnappy }}
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  sendMessage(t.id, { kind: "text", text: `Check this out: ${link}` });
                  toast({ title: "Sharing to conversation", description: t.label, tone: "info" });
                  onClose();
                }}
                className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
              >
                <Avatar src={t.avatar} name={t.label} size={52} />
                <span className="line-clamp-2 text-center text-[11px] font-semibold text-ink2">{t.label}</span>
              </motion.button>
            ))}
            {shareTargets.length === 0 && <p className="text-xs text-ink3">No conversations available to share to.</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "chat", label: "Messages", icon: <MessageCircle className="h-5 w-5" />, action: () => { onClose(); navigate("/chats"); } },
            { id: "more", label: "More", icon: <MoreHorizontal className="h-5 w-5" />, action: () => { if (navigator.share) void navigator.share({ title: "CampusLaugh", url: link }).catch(() => undefined); else void copy(); } },
          ].map((o, i) => (
            <motion.button
              key={o.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08 + i * 0.04 }}
              whileTap={{ scale: 0.93 }}
              onClick={o.action}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-glass p-3"
            >
              <span className="text-brand">{o.icon}</span>
              <span className="text-[11px] font-bold text-ink2">{o.label}</span>
            </motion.button>
          ))}
        </div>

        <button
          onClick={() => {
            showOverlay({ kind: "report", postId: postId ?? "" });
          }}
          className="press flex w-full items-center gap-2 rounded-2xl border border-coral/25 bg-coral/10 px-3.5 py-3 text-[13.5px] font-bold text-coral"
        >
          <ShieldAlert className="h-4 w-4" /> Report this post
        </button>
      </div>
    </BottomSheet>
  );
}

/* ------------------------------ report ----------------------------- */

function ReportDialog({
  open,
  onClose,
  onReport,
}: {
  open: boolean;
  onClose: () => void;
  onReport: (reason: string, details: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setReason(null);
      setDetails("");
      setSending(false);
      setError("");
    }
  }, [open]);

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    setError("");
    try { await onReport(reason, details.trim()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send your report."); }
    finally { setSending(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report content"
      subtitle="Reports are sent to the CampusLaugh moderation queue."
      width="max-w-md"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" block onClick={onClose}>Cancel</Button>
          <Button variant="danger" block loading={sending} disabled={!reason} onClick={() => void submit()}>
            Submit report
          </Button>
        </div>
      }
    >
      <div className="space-y-1.5 pb-1">
        {error && <p role="alert" className="rounded-xl border border-coral/30 bg-coral/10 p-3 text-xs text-coral">{error}</p>}
        {reportReasons.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-[13.5px] font-semibold transition-colors",
              reason === r ? "border-coral/50 bg-coral/12 text-coral" : "border-line bg-glass text-ink hover:border-line2",
            )}
          >
            <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", reason === r ? "border-coral bg-coral" : "border-line2")}>
              {reason === r && <Check className="h-3 w-3 text-white" strokeWidth={3.4} />}
            </span>
            {r}
          </button>
        ))}

        <div className="pt-2">
          <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wide text-ink3">
            Additional details (optional)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="Tell the moderation team what happened…"
            className="field w-full resize-none rounded-2xl px-3.5 py-3 text-[13.5px] outline-none"
          />
          <p className="mt-1 text-right text-[11px] font-semibold text-ink3">{details.length}/280</p>
        </div>
      </div>
    </Modal>
  );
}

export function CloseIcon() {
  return <X className="h-4 w-4" />;
}
export function ShareIcon() {
  return <Share2 className="h-4 w-4" />;
}
