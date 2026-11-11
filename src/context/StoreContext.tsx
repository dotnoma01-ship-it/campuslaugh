import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { useSystem } from "@/context/SystemContext";
import { ME } from "@/data/constants";
import { usePersistentState } from "@/hooks";
import type { AppNotification, Comment, Conversation, Message, Post, User, WallpaperId } from "@/types";
import { uid } from "@/utils/format";
import { getAccessToken, request } from "@/services/http";
import { backend } from "@/services/backend";
import { connectChatSocket } from "@/services/chatSocket";

interface NewMessageInput {
  kind?: Message["kind"];
  text?: string;
  media?: Message["media"];
  duration?: number;
  fileName?: string;
  fileSize?: string;
  attachmentIds?: string[];
  replyTo?: Message["replyTo"];
}

interface StoreCtx {
  ready: boolean;
  posts: Post[];
  remotePosts: Post[] | null;
  setRemoteFeed: (posts: Post[], users: User[]) => void;
  setPostComments: (postId: string, comments: Comment[]) => void;
  cacheUser: (user: User) => void;
  apiUserId: string | null;
  conversations: Conversation[];
  notifications: AppNotification[];
  notificationsLoading: boolean;
  notificationsError: boolean;
  reloadNotifications: () => void;
  me: User;
  users: Record<string, User>;
  following: string[];
  requestedFollowing: string[];
  bookmarks: Post[];
  recentSearches: string[];
  unreadTotal: number;
  unreadNotifications: number;

  userById: (id: string) => User;
  postById: (id: string) => Post | undefined;
  conversationById: (id: string) => Conversation | undefined;

  /* feed */
  toggleLike: (postId: string) => void;
  toggleBookmark: (postId: string) => void;
  toggleRepost: (postId: string) => void;
  hidePost: (postId: string) => void;
  reportPost: (postId: string, reason: string) => void;
  votePoll: (postId: string, optionId: string) => void;
  addComment: (postId: string, text: string, parentId?: string) => void;
  toggleCommentLike: (postId: string, commentId: string) => void;
  createPost: (input: { text: string; media?: Post["media"]; anonymous?: boolean }) => Promise<Post>;
  deletePost: (postId: string) => void;

  /* profile */
  updateProfile: (patch: Partial<User>) => Promise<void>;
  toggleFollow: (userId: string) => boolean;
  isFollowing: (userId: string) => boolean;
  isFollowRequested: (userId: string) => boolean;

  /* chat */
  sendMessage: (conversationId: string, input: NewMessageInput) => void;
  editMessage: (conversationId: string, messageId: string, text: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  reactMessage: (conversationId: string, messageId: string, emoji: string) => void;
  markConversationRead: (conversationId: string) => void;
  setTyping: (conversationId: string, active: boolean) => void;
  togglePin: (conversationId: string) => void;
  toggleMute: (conversationId: string) => void;
  toggleArchive: (conversationId: string) => void;
  setWallpaper: (conversationId: string, w: WallpaperId) => void;
  startConversation: (userId: string) => Promise<string>;
  forwardMessage: (conversationId: string, message: Message) => void;

  /* notifications */
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;

  /* misc */
  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);
const isObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

const sortDesc = <T,>(arr: T[], key: (item: T) => number) => [...arr].sort((a, b) => key(b) - key(a));

function StoreProviderInner({ children }: { children: React.ReactNode }) {
  const system = useSystem();
  const [ready, setReady] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [remotePosts, setRemotePosts] = useState<Post[] | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Record<string, User>>({});
  const [apiUserId, setApiUserId] = useState<string | null>(null);
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(false);
  const [me, setMe] = useState<User>({ id: ME, name: "", username: "", institution: "", campus: "", avatar: "", followers: 0, following: 0 });
  const [following, setFollowing] = useState<string[]>([]);
  const [requestedFollowing, setRequestedFollowing] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = usePersistentState<string[]>("campuslaugh:searches:v2", []);
  useEffect(() => {
    try {
      ["campuslaugh:notifs:v2", "campuslaugh:posts:v2", "campuslaugh:chats:v2", "campuslaugh:me:v2", "campuslaugh:following:v2"].forEach((key) => localStorage.removeItem(key));
    } catch { /* Storage may be unavailable. */ }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 620);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let live = true;
    const restore = async () => {
      if (!getAccessToken()) {
        setApiUserId(null);
        setNotifications([]);
        setConversations([]);
        setMe({ id: ME, name: "", username: "", institution: "", campus: "", avatar: "", followers: 0, following: 0 });
        setFollowing([]);
        setRequestedFollowing([]);
        setRecentSearches([]);
        setRemotePosts(null);
        setRemoteUsers({});
        return;
      }
      try {
        const { user, followingIds, requestedIds } = await backend.currentUser();
        if (!live || !user) return;
        setApiUserId(user.id);
        setFollowing(followingIds);
        setRequestedFollowing(requestedIds);
        setRemoteUsers((previous) => ({ ...previous, [user.id]: user }));
        setMe((previous) => ({
          ...previous,
          id: user.id,
          name: user.name,
          username: user.username,
          institution: user.institution ?? "",
          campus: user.campus ?? user.institution ?? "",
          course: user.course,
          bio: user.bio ?? "",
          avatar: user.avatar ?? "",
          cover: user.cover ?? previous.cover,
          followers: user.followers,
          following: user.following,
        }));
      } catch {
        if (live) system.toast({ title: "Could not restore your profile", description: "The API is unavailable. Sign in again when it is online.", tone: "error" });
      }
    };
    const onSession = () => void restore();
    window.addEventListener("campuslaugh:session", onSession);
    void restore();
    return () => { live = false; window.removeEventListener("campuslaugh:session", onSession); };
  // The toast callback is stable; depending on the full System context would refetch after every overlay update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMe, system.toast]);

  const reloadNotifications = useCallback(() => {
    if (!apiUserId) { setNotifications([]); setNotificationsLoading(false); return; }
    setNotificationsLoading(true);
    setNotificationsError(false);
    void backend.getNotifications().then((items) => {
      setNotifications(items);
      setRemoteUsers((previous) => ({ ...previous, ...Object.fromEntries(backend.getConversationUsers().map((user) => [user.id, user])) }));
    }).catch(() => {
      setNotificationsError(true);
      system.toast({ title: "Could not load notifications", description: "Try again when the connection is available.", tone: "error" });
    }).finally(() => setNotificationsLoading(false));
  }, [apiUserId, system.toast]);

  useEffect(() => {
    reloadNotifications();
  }, [reloadNotifications]);

  useEffect(() => {
    if (!apiUserId) return;
    let live = true;
    void backend.getConversations().then((items) => { if (live) { setConversations(items); setRemoteUsers((previous) => ({ ...previous, ...Object.fromEntries(backend.getConversationUsers().map((user) => [user.id, user])) })); } }).catch(() => {
      if (live) system.toast({ title: "Could not load conversations", description: "Try again when the connection is available.", tone: "error" });
    });
    const socket = connectChatSocket();
    if (!socket) return () => { live = false; };
    setChatSocket(socket);
    socket.on("message:new", (raw: unknown) => {
      const candidate = raw as { _id?: string; conversationId?: string; senderId?: string | { _id?: string } };
      if (!candidate?._id || !candidate.conversationId) return;
      const message = backend.mapMessage(raw, candidate.conversationId);
      setConversations((previous) => previous.map((conversation) => conversation.id !== candidate.conversationId ? conversation : {
        ...conversation,
        messages: conversation.messages.some((entry) => entry.id === message.id) ? conversation.messages : [...conversation.messages, message],
        unread: message.mine ? conversation.unread : conversation.unread + 1,
      }));
    });
    socket.on("notification:new", (raw: unknown) => {
      if (!live) return;
      const notification = backend.mapNotification(raw);
      if (!isObjectId(notification.id)) return;
      setNotifications((previous) => [notification, ...previous.filter((item) => item.id !== notification.id)]);
    });
    socket.on("typing", (payload: { conversationId?: string; active?: boolean }) => {
      if (!payload.conversationId || typeof payload.active !== "boolean") return;
      setConversations((previous) => previous.map((conversation) => conversation.id === payload.conversationId ? { ...conversation, typing: payload.active } : conversation));
    });
    socket.on("message:read", (payload: { conversationId?: string; messageId?: string; userId?: string }) => {
      if (!payload.conversationId || !payload.messageId) return;
      setConversations((previous) => previous.map((conversation) => conversation.id !== payload.conversationId ? conversation : {
        ...conversation,
        messages: conversation.messages.map((message) => message.id === payload.messageId ? { ...message, status: "read" } : message),
      }));
    });
    socket.on("presence:online", (payload: { userId?: string }) => { if (payload.userId) setRemoteUsers((previous) => previous[payload.userId!] ? { ...previous, [payload.userId!]: { ...previous[payload.userId!], online: true } } : previous); });
    socket.on("presence:offline", (payload: { userId?: string }) => { if (payload.userId) setRemoteUsers((previous) => previous[payload.userId!] ? { ...previous, [payload.userId!]: { ...previous[payload.userId!], online: false } } : previous); });
    socket.on("connect", () => {
      void backend.getConversations().then((items) => {
        if (!live) return;
        setRemoteUsers((previous) => ({ ...previous, ...Object.fromEntries(backend.getConversationUsers().map((user) => [user.id, user])) }));
        items.forEach((conversation) => socket.emit("conversation:join", conversation.id));
      }).catch(() => undefined);
    });
    return () => { live = false; socket.disconnect(); setChatSocket(null); };
  }, [apiUserId, setConversations, system.toast]);

  useEffect(() => {
    if (!chatSocket?.connected) return;
    conversations.forEach((conversation) => {
      if (isObjectId(conversation.id)) chatSocket.emit("conversation:join", conversation.id);
    });
  }, [chatSocket, conversations]);

  const userById = useCallback((id: string) => id === ME || id === me.id ? me : remoteUsers[id] ?? me, [me, remoteUsers]);
  const setRemoteFeed = useCallback((items: Post[], users: User[]) => {
    setRemotePosts(items);
    setRemoteUsers((previous) => ({ ...previous, ...Object.fromEntries(users.map((user) => [user.id, user])) }));
  }, []);
  const cacheUser = useCallback((user: User) => setRemoteUsers((previous) => ({ ...previous, [user.id]: user })), []);

  /* ------------------------------ feed ------------------------------ */

  const patchPost = useCallback(
    (postId: string, fn: (p: Post) => Post) => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? fn(p) : p)));
      setRemotePosts((prev) => prev?.map((p) => (p.id === postId ? fn(p) : p)) ?? null);
    },
    [setPosts],
  );
  const setPostComments = useCallback((postId: string, comments: Comment[]) => {
    setPosts((prev) => prev.map((post) => post.id === postId ? { ...post, comments } : post));
    setRemotePosts((prev) => prev?.map((post) => post.id === postId ? { ...post, comments } : post) ?? null);
  }, [setPosts]);

  const toggleLike = useCallback(
    (postId: string) => {
      const original = remotePosts?.find((p) => p.id === postId)?.liked ?? false;
      patchPost(postId, (p) => {
        const liked = !p.liked;
        if (liked) system.haptic(6);
        return { ...p, liked, likes: p.likes + (liked ? 1 : -1) };
      });
      if (apiUserId && isObjectId(postId)) {
        void backend.toggleLike(postId).catch((error) => {
          patchPost(postId, (p) => ({ ...p, liked: original, likes: Math.max(0, p.likes + (original ? 1 : -1)) }));
          system.toast({ title: "Like wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
        });
      }
    },
    [apiUserId, patchPost, remotePosts, system],
  );

  const toggleBookmark = useCallback(
    (postId: string) => {
      let saved = false;
      const original = remotePosts?.find((p) => p.id === postId)?.bookmarked ?? false;
      patchPost(postId, (p) => {
        saved = !p.bookmarked;
        return { ...p, bookmarked: saved };
      });
      if (apiUserId && isObjectId(postId)) {
        void backend.toggleBookmark(postId).then(() => system.toast({
          title: saved ? "Saved to bookmarks" : "Removed from bookmarks",
          description: saved ? "Find it anytime in Profile → Bookmarks" : undefined,
          tone: saved ? "success" : "info",
        })).catch((error) => {
          patchPost(postId, (p) => ({ ...p, bookmarked: original }));
          system.toast({ title: "Bookmark wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
        });
      } else system.toast({ title: "Bookmark unavailable", description: "Sign in to save posts.", tone: "warning" });
    },
    [apiUserId, patchPost, remotePosts, system],
  );

  const toggleRepost = useCallback(
    (postId: string) => {
      const previous = remotePosts?.find((post) => post.id === postId)?.reposted ?? false;
      const next = !previous;
      patchPost(postId, (p) => {
        const reposted = !p.reposted;
        return { ...p, reposted, reposts: p.reposts + (reposted ? 1 : -1) };
      });
      if (apiUserId && isObjectId(postId)) void backend.toggleRepost(postId).then(() => {
        system.toast({ title: next ? "Reposted to your campus" : "Repost removed", tone: next ? "success" : "info" });
      }).catch((error) => {
        patchPost(postId, (p) => ({ ...p, reposted: previous, reposts: Math.max(0, p.reposts + (previous ? 1 : -1)) }));
        system.toast({ title: "Repost wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
      });
    },
    [apiUserId, patchPost, remotePosts, system],
  );

  const hidePost = useCallback(
    (postId: string) => {
      if (!apiUserId || !isObjectId(postId)) return system.toast({ title: "Hide unavailable", description: "Sign in to hide posts.", tone: "warning" });
      void backend.hidePost(postId).then(() => {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setRemotePosts((prev) => prev?.filter((p) => p.id !== postId) ?? null);
        system.toast({ title: "Post hidden", description: "You'll see fewer posts like this", tone: "info" });
      }).catch((error) => system.toast({ title: "Post wasn’t hidden", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
    },
    [apiUserId, setPosts, system],
  );

  const reportPost = useCallback(
    (postId: string, reason: string) => {
      if (!apiUserId || !isObjectId(postId)) {
        system.toast({ title: "Report unavailable", description: "Sign in to report posts.", tone: "warning" });
        return;
      }
      void backend.report('post', postId, reason).then(() => system.toast({ title: "Report submitted", description: "Thanks for helping keep CampusLaugh safe.", tone: "success" })).catch((error) => system.toast({ title: "Report wasn’t sent", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
    },
    [apiUserId, system],
  );

  const votePoll = useCallback(
    (postId: string, optionId: string) => {
      patchPost(postId, (p) =>
        p.poll
          ? { ...p, poll: { ...p.poll, options: p.poll.options.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)) } }
          : p,
      );
      system.haptic(5);
    },
    [patchPost, system],
  );

  const addComment = useCallback(
    (postId: string, text: string, parentId?: string) => {
      if (!apiUserId || !isObjectId(postId)) {
        system.toast({ title: "Comment unavailable", description: "Sign in to comment.", tone: "warning" });
        return;
      }
      const comment: Comment = {
        id: uid("c"),
        authorId: ME,
        text,
        createdAt: Date.now(),
        likes: 0,
        replies: [],
      };
      patchPost(postId, (p) => {
        if (!parentId) return { ...p, comments: [...p.comments, comment] };
        return {
          ...p,
          comments: p.comments.map((c) => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), comment] } : c)),
        };
      });
      void backend.addComment(postId, text, parentId).then((saved) => {
        const replace = (comments: Comment[]): Comment[] => comments.map((item) => item.id === comment.id ? saved : { ...item, replies: item.replies ? replace(item.replies) : item.replies });
        patchPost(postId, (p) => ({ ...p, comments: replace(p.comments) }));
      }).catch((error) => {
        patchPost(postId, (p) => ({ ...p, comments: p.comments.filter((entry) => entry.id !== comment.id).map((entry) => ({ ...entry, replies: entry.replies?.filter((reply) => reply.id !== comment.id) })) }));
        system.toast({ title: "Comment wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
      });
      system.haptic(4);
    },
    [apiUserId, patchPost, system],
  );

  const toggleCommentLike = useCallback(
    (postId: string, commentId: string) => {
      const walk = (list: Comment[]): Comment[] =>
        list.map((c) =>
          c.id === commentId
            ? { ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) }
            : { ...c, replies: c.replies ? walk(c.replies) : c.replies },
        );
      patchPost(postId, (p) => ({ ...p, comments: walk(p.comments) }));
      if (apiUserId && isObjectId(commentId)) {
        void backend.toggleCommentLike(commentId).catch((error) => system.toast({ title: "Comment like wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
      }
    },
    [apiUserId, patchPost, system],
  );

  const createPost = useCallback<StoreCtx["createPost"]>(
    async (input) => {
      if (!getAccessToken()) throw new Error("Sign in to publish a post.");
      const { post, author } = await backend.publishPost(input);
      setRemoteUsers((previous) => ({ ...previous, [author.id]: author }));
      setRemotePosts((previous) => [post, ...(previous ?? [])]);
      return post;
    },
    [],
  );

  const deletePost = useCallback(
    (postId: string) => {
      if (!apiUserId || !isObjectId(postId)) return system.toast({ title: "Delete unavailable", description: "Sign in to delete posts.", tone: "warning" });
      void request(`/posts/${postId}`, { method: "DELETE" }).then(() => {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setRemotePosts((prev) => prev?.filter((p) => p.id !== postId) ?? null);
        system.toast({ title: "Post deleted", tone: "success" });
      }).catch((error) => system.toast({ title: "Post wasn’t deleted", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
    },
    [apiUserId, setPosts, system],
  );

  /* ----------------------------- profile ---------------------------- */

  const updateProfile = useCallback(async (patch: Partial<User>) => {
    if (!apiUserId) throw new Error("Sign in to update your profile.");
    const safe = {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      ...(patch.course !== undefined ? { course: patch.course } : {}),
      ...(patch.username !== undefined ? { username: patch.username } : {}),
      ...(patch.department !== undefined ? { department: patch.department } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.website !== undefined ? { website: patch.website } : {}),
      ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
      ...(patch.cover !== undefined ? { cover: patch.cover } : {}),
    };
    const user = await backend.updateProfile(safe);
    setMe((previous) => ({ ...previous, ...user }));
  }, [apiUserId, setMe]);

  const isFollowing = useCallback((userId: string) => following.includes(userId), [following]);
  const isFollowRequested = useCallback((userId: string) => requestedFollowing.includes(userId), [requestedFollowing]);

  const toggleFollow = useCallback(
    (userId: string) => {
      if (!apiUserId || !isObjectId(userId)) {
        system.toast({ title: "Follow unavailable", description: "Follow users loaded from the authenticated service.", tone: "warning" });
        return following.includes(userId);
      }
      const wasFollowing = following.includes(userId);
      const wasRequested = requestedFollowing.includes(userId);
      const optimisticFollowing = !wasFollowing && !wasRequested;
      const nowFollowing = !wasFollowing;
      if (wasFollowing) { setFollowing((prev) => prev.filter((x) => x !== userId)); setMe((prev) => ({ ...prev, following: Math.max(0, prev.following - 1) })); }
      else if (wasRequested) setRequestedFollowing((prev) => prev.filter((x) => x !== userId));
      else { setFollowing((prev) => [...new Set([...prev, userId])]); setMe((prev) => ({ ...prev, following: prev.following + 1 })); }
      void backend.toggleFollow(userId).then((result) => {
        setFollowing((prev) => result.following ? [...new Set([...prev, userId])] : prev.filter((x) => x !== userId));
        setRequestedFollowing((prev) => result.requested ? [...new Set([...prev, userId])] : prev.filter((x) => x !== userId));
        setMe((prev) => ({ ...prev, following: Math.max(0, prev.following + (result.following ? 1 : 0) - (optimisticFollowing ? 1 : 0)) }));
        if (result.requested) system.toast({ title: "Follow request sent", tone: "success" });
        else if (wasRequested) system.toast({ title: "Follow request cancelled", tone: "info" });
        else system.toast({ title: result.following ? "Followed account" : "Unfollowed account", tone: result.following ? "success" : "info" });
      }).catch((error) => {
        setFollowing((prev) => wasFollowing ? [...new Set([...prev, userId])] : prev.filter((x) => x !== userId));
        setRequestedFollowing((prev) => wasRequested ? [...new Set([...prev, userId])] : prev.filter((x) => x !== userId));
        setMe((prev) => ({ ...prev, following: Math.max(0, prev.following + (wasFollowing ? 1 : 0) - (optimisticFollowing ? 1 : 0)) }));
        system.toast({ title: "Follow change wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
      });
      system.haptic(nowFollowing ? [6, 20, 6] : 5);
      return nowFollowing;
    },
    [following, requestedFollowing, setFollowing, setMe, apiUserId, system],
  );

  /* ------------------------------- chat ----------------------------- */

  const patchConv = useCallback(
    (conversationId: string, fn: (c: Conversation) => Conversation) =>
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? fn(c) : c))),
    [setConversations],
  );

  const sendMessage = useCallback<StoreCtx["sendMessage"]>(
    (conversationId, input) => {
      if (!apiUserId || !isObjectId(conversationId)) {
        system.toast({ title: "Sign in to send messages", tone: "warning" });
        return;
      }
      {
        if ((input.kind ?? "text") !== "text" && !input.attachmentIds?.length || !input.text?.trim() && !input.attachmentIds?.length) {
          system.toast({ title: "Message is empty", description: "Add text or an attachment before sending.", tone: "warning" });
          return;
        }
        const id = uid("pending");
        const optimistic: Message = { id, conversationId, authorId: ME, kind: input.kind ?? "text", text: input.text?.trim(), replyTo: input.replyTo, createdAt: Date.now(), mine: true, status: "sending" };
        patchConv(conversationId, (conversation) => ({ ...conversation, messages: [...conversation.messages, optimistic] }));
        const finish = (raw: unknown) => {
          const message = backend.mapMessage(raw, conversationId);
          patchConv(conversationId, (conversation) => {
            const withoutPending = conversation.messages.filter((item) => item.id !== id);
            return { ...conversation, messages: withoutPending.some((item) => item.id === message.id) ? withoutPending : [...withoutPending, message] };
          });
          system.playSound("send");
        };
        if (input.attachmentIds?.length) {
          void backend.sendAttachments(conversationId, input.attachmentIds, input.text?.trim()).then(finish).catch((error) => {
            patchConv(conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.filter((item) => item.id !== id) }));
            system.toast({ title: "Attachment wasn’t sent", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
          });
        } else if (chatSocket) {
          chatSocket.emit("message:send", { conversationId, text: input.text!.trim(), replyTo: input.replyTo?.id }, (result: { message?: unknown; error?: string }) => {
            if (result?.message) finish(result.message);
            else {
              patchConv(conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.filter((item) => item.id !== id) }));
              system.toast({ title: "Message wasn’t sent", description: result?.error ?? "Reconnect and try again.", tone: "error" });
            }
          });
        } else {
          void backend.sendMessage(conversationId, input.text!.trim(), input.replyTo?.id).then(finish).catch((error) => {
            patchConv(conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.filter((item) => item.id !== id) }));
            system.toast({ title: "Message wasn’t sent", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
          });
        }
        return;
      }
    },
    [patchConv, system, apiUserId, chatSocket],
  );

  const editMessage = useCallback<StoreCtx["editMessage"]>(
    (conversationId, messageId, text) => {
      patchConv(conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, text, edited: true } : m)),
      }));
      if (isObjectId(messageId) && apiUserId) void request(`/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ text }) }).catch((error) => system.toast({ title: "Message edit wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
      system.toast({ title: "Message updated", tone: "success" });
    },
    [patchConv, apiUserId, system],
  );

  const deleteMessage = useCallback<StoreCtx["deleteMessage"]>(
    (conversationId, messageId) => {
      patchConv(conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, deleted: true, text: "This message was deleted", media: undefined, reactions: [] } : m)),
      }));
      if (isObjectId(messageId) && apiUserId) void request(`/messages/${messageId}`, { method: "DELETE" }).catch((error) => system.toast({ title: "Message deletion wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
      system.toast({ title: "Message deleted", tone: "warning" });
    },
    [patchConv, apiUserId, system],
  );

  const reactMessage = useCallback<StoreCtx["reactMessage"]>(
    (conversationId, messageId, emoji) => {
      patchConv(conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions ?? [];
          const found = existing.find((r) => r.emoji === emoji);
          let next;
          if (found) {
            next = found.byMe
              ? existing.map((r) => (r.emoji === emoji ? { ...r, byMe: false, count: Math.max(0, r.count - 1) } : r)).filter((r) => r.count > 0)
              : existing.map((r) => (r.emoji === emoji ? { ...r, byMe: true, count: r.count + 1 } : r));
          } else {
            next = [...existing, { emoji, count: 1, byMe: true }];
          }
          return { ...m, reactions: next };
        }),
      }));
      if (isObjectId(messageId) && apiUserId) void request(`/messages/${messageId}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) }).catch((error) => system.toast({ title: "Reaction wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
      system.haptic(4);
    },
    [patchConv, apiUserId, system],
  );

  const togglePin = useCallback(
    (conversationId: string) => { const pinned = !conversations.find((c) => c.id === conversationId)?.pinned; patchConv(conversationId, (c) => ({ ...c, pinned })); if (isObjectId(conversationId) && apiUserId) void request(`/conversations/${conversationId}/settings`, { method: "PATCH", body: JSON.stringify({ pinned }) }).catch((error) => system.toast({ title: "Pin setting wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" })); },
    [patchConv, conversations, apiUserId, system],
  );
  const toggleMute = useCallback(
    (conversationId: string) => { const muted = !conversations.find((c) => c.id === conversationId)?.muted; patchConv(conversationId, (c) => ({ ...c, muted })); if (isObjectId(conversationId) && apiUserId) void request(`/conversations/${conversationId}/settings`, { method: "PATCH", body: JSON.stringify({ muted }) }).catch((error) => system.toast({ title: "Mute setting wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" })); },
    [patchConv, conversations, apiUserId, system],
  );
  const toggleArchive = useCallback(
    (conversationId: string) => {
      let archived = false;
      patchConv(conversationId, (c) => {
        archived = !c.archived;
        return { ...c, archived };
      });
      if (isObjectId(conversationId) && apiUserId) void request(`/conversations/${conversationId}/settings`, { method: "PATCH", body: JSON.stringify({ archived }) }).catch((error) => system.toast({ title: "Archive setting wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
      system.toast({ title: archived ? "Conversation archived" : "Restored to inbox", tone: "info" });
    },
    [patchConv, apiUserId, system],
  );
  const setWallpaper = useCallback<StoreCtx["setWallpaper"]>(
    (conversationId, w) => patchConv(conversationId, (c) => ({ ...c, wallpaper: w })),
    [patchConv],
  );

  const markConversationRead = useCallback<StoreCtx["markConversationRead"]>(
    (conversationId) => {
      patchConv(conversationId, (c) => ({ ...c, unread: 0 }));
      setNotifications((prev) => prev.map((n) => (n.conversationId === conversationId ? { ...n, read: true } : n)));
      if (apiUserId && isObjectId(conversationId)) void backend.readConversation(conversationId).catch((error) => system.toast({ title: "Read status wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
    },
    [patchConv, setNotifications, apiUserId, system],
  );

  const setTyping = useCallback((conversationId: string, active: boolean) => {
    if (chatSocket && isObjectId(conversationId)) chatSocket.emit("typing", { conversationId, active });
  }, [chatSocket]);

  const startConversation = useCallback<StoreCtx["startConversation"]>(
    (userId) => {
      const existing = conversations.find((c) => !c.group && c.participantIds[0] === userId);
      if (existing) {
        setConversations((prev) => prev.map((c) => (c.id === existing.id ? { ...c, archived: false } : c)));
        return Promise.resolve(existing.id);
      }
      if (apiUserId && isObjectId(userId)) return backend.createConversation(userId).then(({ conversation }) => {
        const id = conversation._id;
        const created: Conversation = { id, participantIds: [userId], messages: [], unread: 0, wallpaper: "midnight" };
        setConversations((prev) => [created, ...prev.filter((item) => item.id !== id)]);
        return id;
      }).catch((error) => { system.toast({ title: "Could not start conversation", description: error instanceof Error ? error.message : "Try again.", tone: "error" }); throw error; });
      system.toast({ title: "Sign in to start a conversation", tone: "warning" });
      return Promise.reject(new Error("Sign in to start a conversation."));
    },
    [conversations, setConversations, apiUserId, system],
  );

  const forwardMessage = useCallback<StoreCtx["forwardMessage"]>(
    (conversationId, message) => {
      if (!apiUserId || !isObjectId(message.id) || !isObjectId(conversationId)) {
        system.toast({ title: "Message could not be forwarded", description: "This message or conversation is not available on the authenticated service.", tone: "warning" });
        return;
      }
      void backend.forwardMessage(message.id, [conversationId]).then(({ messages }) => {
        for (const raw of messages) {
          const forwarded = backend.mapMessage(raw, conversationId);
          patchConv(conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.some((item) => item.id === forwarded.id) ? conversation.messages : [...conversation.messages, forwarded] }));
        }
        system.toast({ title: "Message forwarded", tone: "success" });
      }).catch((error) => system.toast({ title: "Message wasn’t forwarded", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
    },
    [apiUserId, patchConv, system],
  );

  /* -------------------------- notifications ------------------------- */

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      if (isObjectId(id)) void request(`/notifications/${id}/read`, { method: "PATCH" }).catch(() => system.toast({ title: "Read status wasn’t saved", tone: "error" }));
    },
    [setNotifications, system],
  );
  const markAllNotificationsRead = useCallback(
    () => { setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); if (apiUserId) void request("/notifications/read-all", { method: "PATCH" }).catch(() => system.toast({ title: "Read status wasn’t saved", tone: "error" })); },
    [apiUserId, setNotifications, system],
  );
  const clearNotifications = useCallback(() => { setNotifications([]); if (apiUserId) void request("/notifications", { method: "DELETE" }).catch(() => system.toast({ title: "Notifications weren’t cleared", tone: "error" })); }, [apiUserId, setNotifications, system]);
  const removeNotification = useCallback(
    (id: string) => { setNotifications((prev) => prev.filter((n) => n.id !== id)); if (isObjectId(id)) void request(`/notifications/${id}`, { method: "DELETE" }).catch(() => system.toast({ title: "Notification wasn’t removed", tone: "error" })); },
    [setNotifications, system],
  );

  /* ------------------------------ search ---------------------------- */

  const addRecentSearch = useCallback(
    (term: string) => {
      const t = term.trim();
      if (!t) return;
      setRecentSearches((prev) => [t, ...prev.filter((x) => x !== t)].slice(0, 8));
    },
    [setRecentSearches],
  );
  const clearRecentSearches = useCallback(() => setRecentSearches([]), [setRecentSearches]);

  const visiblePosts = remotePosts ?? posts;
  const bookmarks = useMemo(() => visiblePosts.filter((p) => p.bookmarked), [visiblePosts]);
  const unreadTotal = useMemo(() => conversations.reduce((s, c) => s + (c.archived ? 0 : c.unread), 0), [conversations]);
  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<StoreCtx>(
    () => ({
      ready,
      posts: sortDesc(visiblePosts, (p) => p.createdAt),
      remotePosts,
      setRemoteFeed,
      setPostComments,
      cacheUser,
      apiUserId,
      conversations,
      notifications: sortDesc(notifications, (n) => n.createdAt),
      notificationsLoading,
      notificationsError,
      reloadNotifications,
      me,
      users: { [ME]: me, ...remoteUsers },
      following,
      requestedFollowing,
      bookmarks,
      recentSearches,
      unreadTotal,
      unreadNotifications,
      userById,
      postById: (id) => visiblePosts.find((p) => p.id === id) ?? posts.find((p) => p.id === id),
      conversationById: (id) => conversations.find((c) => c.id === id),
      toggleLike,
      toggleBookmark,
      toggleRepost,
      hidePost,
      reportPost,
      votePoll,
      addComment,
      toggleCommentLike,
      createPost,
      deletePost,
      updateProfile,
      toggleFollow,
      isFollowing,
      isFollowRequested,
      sendMessage,
      editMessage,
      deleteMessage,
      reactMessage,
      markConversationRead,
      setTyping,
      togglePin,
      toggleMute,
      toggleArchive,
      setWallpaper,
      startConversation,
      forwardMessage,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      removeNotification,
      addRecentSearch,
      clearRecentSearches,
    }),
    [
      ready, posts, visiblePosts, remotePosts, setRemoteFeed, setPostComments, cacheUser, apiUserId, remoteUsers, conversations, notifications, notificationsLoading, notificationsError, reloadNotifications, me, following, requestedFollowing, bookmarks, recentSearches,
      unreadTotal, unreadNotifications, userById, toggleLike, toggleBookmark, toggleRepost, hidePost,
      reportPost, votePoll, addComment, toggleCommentLike, createPost, deletePost, updateProfile,
      toggleFollow, isFollowing, isFollowRequested, sendMessage, editMessage, deleteMessage, reactMessage,
      markConversationRead, setTyping, togglePin, toggleMute, toggleArchive, setWallpaper, startConversation,
      forwardMessage, markNotificationRead, markAllNotificationsRead, clearNotifications,
      removeNotification, addRecentSearch, clearRecentSearches,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return <StoreProviderInner>{children}</StoreProviderInner>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
