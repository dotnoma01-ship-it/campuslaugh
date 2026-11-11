import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatInbox } from "@/components/chat/ChatInbox";
import { ChatThread } from "@/components/chat/ChatThread";
import { useStore } from "@/context/StoreContext";
import { Button, EmptyState } from "@/components/ui/primitives";
import { pageVariants } from "@/components/ui/motion";

/**
 * Two-panel messaging on desktop, single-panel stack on mobile.
 * The inbox stays mounted on large screens so switching chats never
 * loses scroll position or search state.
 */
export default function Chats() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { conversationById } = useStore();
  const conversation = id ? conversationById(id) : undefined;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="flex h-[calc(100dvh-96px)] gap-4 pb-24 lg:h-[calc(100dvh-2rem)] lg:pb-0"
    >
      {/* inbox column */}
      <div
        className={
          id
            ? "hidden min-w-0 flex-1 lg:flex lg:max-w-[380px] lg:shrink-0 lg:flex-col"
            : "flex min-w-0 flex-1 flex-col lg:max-w-[380px]"
        }
      >
        <ChatInbox />
      </div>

      {/* thread column */}
      <div className={id ? "flex min-w-0 flex-[2] flex-col" : "hidden min-w-0 flex-1 lg:flex lg:flex-col"}>
        {conversation ? (
          <ChatThread key={conversation.id} conversationId={conversation.id} />
        ) : (
          <div className="hidden h-full place-items-center lg:grid">
            <EmptyState
              className="max-w-sm border-0 bg-transparent"
              icon={<MessageCircle className="h-6 w-6" />}
              title="Pick a conversation"
              body="Select a conversation on the left or start a new one. Messages are saved to your account."
              action={
                <Button variant="brand" size="sm" onClick={() => navigate("/chats")}>
                  Open inbox
                </Button>
              }
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
