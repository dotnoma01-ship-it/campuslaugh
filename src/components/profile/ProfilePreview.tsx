import { motion } from "framer-motion";
import { BadgeCheck, MapPin, MessageCircle, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import { compact, cn } from "@/utils/format";
import { Avatar, Badge, Button } from "@/components/ui/primitives";
import { springSnappy } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";

/** Compact profile card used by global profile previews. */
export function ProfilePreview({
  userId,
  open,
  onClose,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { userById, toggleFollow, isFollowing, posts, startConversation } = useStore();
  const { toast } = useSystem();
  const user = userId ? userById(userId) : null;
  if (!user) return null;
  const userPosts = posts.filter((p) => p.authorId === user.id);
  const following = isFollowing(user.id);

  return (
    <Modal open={open} onClose={onClose} width="max-w-md" title={undefined}>
      <div className="pb-1">
        <div className="relative -mx-5 -mt-5 h-28 overflow-hidden rounded-t-[28px]">
          <img
            src={user.cover ?? user.avatar}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--c-glass-2)] to-transparent" />
        </div>

        <div className="-mt-10 flex items-end gap-3 px-1">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springSnappy}>
            <Avatar src={user.avatar} name={user.name} size={76} ring online={user.online} />
          </motion.div>
          <div className="mb-1 flex flex-1 justify-end gap-1.5">
            {user.id !== "me" && (
              <>
                <Button
                  size="sm"
                  variant={following ? "outline" : "brand"}
                  icon={following ? <BadgeCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  onClick={() => {
                    const now = toggleFollow(user.id);
                    toast({ title: now ? `Following ${user.name}` : `Unfollowed`, tone: now ? "success" : "info" });
                  }}
                >
                  {following ? "Following" : "Follow"}
                </Button>
                <Button
                  size="sm"
                  variant="glass"
                  icon={<MessageCircle className="h-4 w-4" />}
                  onClick={() => {
                    void startConversation(user.id).then((id) => { onClose(); navigate(`/chats/${id}`); }).catch(() => undefined);
                  }}
                >
                  Message
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-2 px-1">
          <h2 className="flex items-center gap-1.5 font-display text-[19px] font-extrabold tracking-[-0.03em] text-ink">
            {user.name}
            {user.verified && <BadgeCheck className="h-4 w-4 text-brand" fill="currentColor" />}
          </h2>
          <p className="text-[13px] font-semibold text-ink3">@{user.username}</p>
          {user.bio && <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">{user.bio}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">
              <MapPin className="h-3 w-3" /> {user.campus}
            </Badge>
            {user.course && <Badge>{user.course}</Badge>}
            {user.online ? <Badge tone="mint">Online</Badge> : <Badge>Last seen {user.lastSeen ?? "recently"}</Badge>}
          </div>

          <div className={cn("mt-4 grid grid-cols-3 gap-2")}>
            {[
              { label: "Posts", value: userPosts.length },
              { label: "Followers", value: user.followers },
              { label: "Following", value: user.following },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl p-2.5 text-center">
                <p className="font-display text-[17px] font-extrabold text-ink tabular-nums">{compact(s.value)}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink3">{s.label}</p>
              </div>
            ))}
          </div>

          <Button
            className="mt-3"
            block
            variant="outline"
            onClick={() => {
              onClose();
              navigate(`/profile/${user.id}`);
            }}
          >
            View full profile
          </Button>
        </div>
      </div>
    </Modal>
  );
}
