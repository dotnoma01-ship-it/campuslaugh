import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, CornerDownRight, Heart, MessageSquareOff, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import type { Comment, Post } from "@/types";
import { cn, timeAgo } from "@/utils/format";
import { Avatar, Button, EmptyState } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/overlays";
import { spring, springSnappy } from "@/components/ui/primitives";
import { backend } from "@/services/backend";

export function CommentsSheet({
  post,
  open,
  onClose,
}: {
  post: Post;
  open: boolean;
  onClose: () => void;
}) {
  const { userById, addComment, toggleCommentLike, setPostComments } = useStore();
  const { haptic, toast } = useSystem();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setReplyTo(null);
      setDraft("");
      if (/^[a-f\d]{24}$/i.test(post.id)) {
        void backend.getComments(post.id).then((comments) => setPostComments(post.id, comments)).catch((error) => toast({ title: "Couldn’t load comments", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
      }
    }
  }, [open, post.id, setPostComments, toast]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, 260);
    return () => window.clearTimeout(t);
  }, [open, post.comments.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    addComment(post.id, text, replyTo?.id);
    setDraft("");
    setReplyTo(null);
    haptic([6, 18, 6]);
  };

  const all = post.comments;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Comments</span>
          <span className="rounded-full bg-brand/16 px-2 py-0.5 text-[11.5px] font-extrabold text-brand tabular-nums">
            {all.length}
          </span>
        </div>
      }
      footer={
        <div className="space-y-2">
          <AnimatePresence>
            {replyTo && (
              <motion.div
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: 6, height: 0 }}
                transition={springSnappy}
                className="flex items-center gap-2 overflow-hidden rounded-2xl border border-brand/25 bg-brand/8 px-3 py-2"
              >
                <CornerDownRight className="h-4 w-4 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-bold text-brand">
                    Replying to {userById(replyTo.authorId).name}
                  </p>
                  <p className="truncate text-[12px] text-ink2">{replyTo.text}</p>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  aria-label="Cancel reply"
                  className="press shrink-0 text-[11.5px] font-bold text-ink3 hover:text-ink"
                >
                  Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2">
            <div className="field flex h-11 flex-1 items-center gap-2 rounded-full px-3.5">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
                aria-label="Write a comment"
                className="h-full w-full bg-transparent text-[14px] outline-none"
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.86 }}
              animate={draft.trim() ? { scale: 1, rotate: 0 } : { scale: 0.92, rotate: -8 }}
              transition={springSnappy}
              onClick={send}
              disabled={!draft.trim()}
              aria-label="Send comment"
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors",
                draft.trim()
                  ? "bg-brand text-onbrand shadow-[0_10px_24px_-10px_rgba(183,243,74,.9)]"
                  : "bg-ink/10 text-ink3",
              )}
            >
              {draft.trim() ? <ArrowUp className="h-5 w-5" strokeWidth={2.6} /> : <Send className="h-[18px] w-[18px]" />}
            </motion.button>
          </div>
        </div>
      }
    >
      <div ref={listRef} className="max-h-[52vh] space-y-1 px-3 pb-3 lg:max-h-[56vh]">
        <div className="glass mb-3 flex items-start gap-3 rounded-2xl p-3">
          <Avatar src={userById(post.authorId).avatar} name={userById(post.authorId).name} size={34} anonymous={post.anonymous} />
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-ink">{userById(post.authorId).name}</p>
            <p className="mt-0.5 line-clamp-3 text-[13px] leading-snug text-ink2">{post.text}</p>
          </div>
        </div>

        {all.length === 0 ? (
          <EmptyState
            className="border-0 bg-transparent px-4 py-8"
            icon={<MessageSquareOff className="h-6 w-6" />}
            title="No comments yet"
            body="Be the first to add to the joke. Kindness still counts as comedy."
          />
        ) : (
          <AnimatePresence initial={false}>
            {all.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                postId={post.id}
                onReply={(target) => {
                  setReplyTo(target);
                  window.setTimeout(() => inputRef.current?.focus(), 120);
                }}
                onLike={() => toggleCommentLike(post.id, c.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </BottomSheet>
  );
}

function CommentRow({
  comment,
  postId,
  onReply,
  onLike,
  depth = 0,
}: {
  comment: Comment;
  postId: string;
  onReply: (c: Comment) => void;
  onLike?: () => void;
  depth?: number;
}) {
  const { userById } = useStore();
  const author = userById(comment.authorId);
  const [dragX, setDragX] = useState(0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={spring}
      className="relative"
      style={{ marginLeft: depth * 18 }}
    >
      {depth > 0 && <span className="absolute -left-3 top-2 h-[calc(100%-8px)] w-px bg-line" />}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 56 }}
        dragElastic={{ left: 0, right: 0.35 }}
        onDrag={(_, i) => setDragX(i.offset.x)}
        onDragEnd={() => {
          if (dragX > 40) onReply(comment);
          setDragX(0);
        }}
        className="relative flex items-start gap-2.5 rounded-2xl px-2 py-2"
      >
        {dragX > 8 && (
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-brand opacity-70">
            <CornerDownRight className="h-4 w-4" />
          </span>
        )}
        <Avatar src={author.avatar} name={author.name} size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-extrabold text-ink">{author.name}</span>
            <span className="shrink-0 text-[11px] text-ink3">@{author.username}</span>
            <span className="ml-auto shrink-0 text-[11px] text-ink3">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-[13.5px] leading-snug text-ink2">{comment.text}</p>
          <div className="mt-1 flex items-center gap-3">
            <button
              onClick={onLike}
              aria-label={comment.liked ? "Unlike comment" : "Like comment"}
              className={cn(
                "press inline-flex items-center gap-1 text-[11.5px] font-bold",
                comment.liked ? "text-coral" : "text-ink3 hover:text-ink2",
              )}
            >
              <Heart className="h-3.5 w-3.5" fill={comment.liked ? "currentColor" : "none"} />
              {comment.likes > 0 && comment.likes}
            </button>
            <button
              onClick={() => onReply(comment)}
              className="press text-[11.5px] font-bold text-ink3 hover:text-brand"
            >
              Reply
            </button>
          </div>
        </div>
      </motion.div>

      {comment.replies?.map((r) => (
        <CommentRow
          key={r.id}
          comment={r}
          postId={postId}
          onReply={onReply}
          depth={depth + 1}
        />
      ))}
    </motion.div>
  );
}

export function CommentCTA({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} icon={<MessageSquareOff className="h-4 w-4" />}>
      {count} comments
    </Button>
  );
}
