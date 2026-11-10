import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSystem } from "@/context/SystemContext";
import {
  conversations as seedConversations,
  demoIncoming,
  ME,
  notifications as seedNotifications,
  posts as seedPosts,
  users as userDb,
} from "@/data/mock";
import { usePersistentState } from "@/hooks";
import type { AppNotification, Comment, Conversation, Message, Post, User, WallpaperId } from "@/types";
import { uid } from "@/utils/format";
import { getAccessToken, request } from "@/services/http";
import { backend } from "@/services/backend";

interface NewMessageInput {
  kind?: Message["kind"];
  text?: string;
  media?: Message["media"];
  duration?: number;
  fileName?: string;
  fileSize?: string;
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
  me: User;
  users: Record<string, User>;
  following: string[];
  bookmarks: Post[];
  recentSearches: string[];
  ambient: boolean;
  unreadTotal: number;
  unreadNotifications: number;
  setAmbient: (v: boolean) => void;

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
  updateProfile: (patch: Partial<User>) => void;
  toggleFollow: (userId: string) => boolean;
  isFollowing: (userId: string) => boolean;

  /* chat */
  sendMessage: (conversationId: string, input: NewMessageInput) => void;
  editMessage: (conversationId: string, messageId: string, text: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  reactMessage: (conversationId: string, messageId: string, emoji: string) => void;
  markConversationRead: (conversationId: string) => void;
  togglePin: (conversationId: string) => void;
  toggleMute: (conversationId: string) => void;
  toggleArchive: (conversationId: string) => void;
  setWallpaper: (conversationId: string, w: WallpaperId) => void;
  startConversation: (userId: string) => string;
  forwardMessage: (conversationId: string, message: Message) => void;

  /* notifications */
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;
  pushNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read"> & { createdAt?: number }) => AppNotification;

  /* misc */
  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
  resetDemoData: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);
const isObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

const sortDesc = <T,>(arr: T[], key: (item: T) => number) => [...arr].sort((a, b) => key(b) - key(a));

function StoreProviderInner({ children }: { children: React.ReactNode }) {
  const system = useSystem();
  const [ready, setReady] = useState(false);
  const [posts, setPosts] = usePersistentState<Post[]>("campuslaugh:posts:v2", seedPosts);
  const [remotePosts, setRemotePosts] = useState<Post[] | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Record<string, User>>({});
  const [apiUserId, setApiUserId] = useState<string | null>(null);
  const [conversations, setConversations] = usePersistentState<Conversation[]>("campuslaugh:chats:v2", seedConversations);
  const [notifications, setNotifications] = usePersistentState<AppNotification[]>("campuslaugh:notifs:v2", seedNotifications);
  const [me, setMe] = usePersistentState<User>("campuslaugh:me:v2", userDb[ME]);
  const [following, setFollowing] = usePersistentState<string[]>("campuslaugh:following:v2", ["u1", "u2", "u4", "u5", "u6"]);
  const [recentSearches, setRecentSearches] = usePersistentState<string[]>("campuslaugh:searches:v2", []);
  const [ambient, setAmbient] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 620);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let live = true;
    const restore = async () => {
      if (!getAccessToken()) return;
      try {
        const { user, followingIds } = await backend.currentUser();
        if (!live || !user) return;
        setApiUserId(user.id);
        setFollowing(followingIds);
        setRemoteUsers((previous) => ({ ...previous, [user.id]: user }));
        setMe((previous) => ({
          ...previous,
          id: ME,
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

  const userById = useCallback((id: string) => id === ME || id === me.id ? me : remoteUsers[id] ?? userDb[id] ?? me, [me, remoteUsers]);
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
      if (isObjectId(postId) && remotePosts?.some((p) => p.id === postId)) {
        void backend.toggleLike(postId).catch((error) => {
          patchPost(postId, (p) => ({ ...p, liked: original, likes: Math.max(0, p.likes + (original ? 1 : -1)) }));
          system.toast({ title: "Like wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
        });
      }
    },
    [patchPost, remotePosts, system],
  );

  const toggleBookmark = useCallback(
    (postId: string) => {
      let saved = false;
      const original = remotePosts?.find((p) => p.id === postId)?.bookmarked ?? false;
      patchPost(postId, (p) => {
        saved = !p.bookmarked;
        return { ...p, bookmarked: saved };
      });
      system.toast({
        title: saved ? "Saved to bookmarks" : "Removed from bookmarks",
        description: saved ? "Find it anytime in Profile → Bookmarks" : undefined,
        tone: saved ? "success" : "info",
      });
      if (isObjectId(postId) && remotePosts?.some((p) => p.id === postId)) {
        void backend.toggleBookmark(postId).catch((error) => {
          patchPost(postId, (p) => ({ ...p, bookmarked: original }));
          system.toast({ title: "Bookmark wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
        });
      }
    },
    [patchPost, remotePosts, system],
  );

  const toggleRepost = useCallback(
    (postId: string) => {
      patchPost(postId, (p) => {
        const reposted = !p.reposted;
        if (reposted) system.toast({ title: "Reposted to your campus", tone: "success" });
        return { ...p, reposted, reposts: p.reposts + (reposted ? 1 : -1) };
      });
    },
    [patchPost, system],
  );

  const hidePost = useCallback(
    (postId: string) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      system.toast({ title: "Post hidden", description: "You'll see fewer posts like this", tone: "info" });
    },
    [setPosts, system],
  );

  const reportPost = useCallback(
    (postId: string, reason: string) => {
      if (isObjectId(postId) && remotePosts?.some((p) => p.id === postId)) {
        void backend.report('post', postId, reason).then(() => system.toast({ title: "Report submitted", description: "Thanks for helping keep CampusLaugh safe.", tone: "success" })).catch((error) => system.toast({ title: "Report wasn’t sent", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
        return;
      }
      system.toast({ title: "Report submitted", description: reason, tone: "warning" });
    },
    [remotePosts, system],
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
      if (isObjectId(postId) && remotePosts?.some((p) => p.id === postId)) {
        void backend.addComment(postId, text, parentId).then((saved) => {
          const replace = (comments: Comment[]): Comment[] => comments.map((item) => item.id === comment.id ? saved : { ...item, replies: item.replies ? replace(item.replies) : item.replies });
          patchPost(postId, (p) => ({ ...p, comments: replace(p.comments) }));
        }).catch((error) => {
          system.toast({ title: "Comment wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
        });
      }
      system.haptic(4);
    },
    [patchPost, remotePosts, system],
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
      if (isObjectId(commentId) && remotePosts?.some((p) => p.id === postId)) {
        void backend.toggleCommentLike(commentId).catch((error) => system.toast({ title: "Comment like wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
      }
    },
    [patchPost, remotePosts, system],
  );

  const createPost = useCallback<StoreCtx["createPost"]>(
    async (input) => {
      if (getAccessToken()) {
        const { post, author } = await backend.publishPost(input);
        setRemoteUsers((previous) => ({ ...previous, [author.id]: author }));
        setRemotePosts((previous) => [post, ...(previous ?? [])]);
        return post;
      }
      const hashtags = Array.from(new Set((input.text.match(/#[\w]+/g) ?? []).map((t) => t.slice(1))));
      const post: Post = {
        id: uid("p"),
        authorId: input.anonymous ? "anon" : ME,
        anonymous: input.anonymous,
        text: input.text,
        media: input.media,
        hashtags,
        createdAt: Date.now(),
        likes: 0,
        reposts: 0,
        views: 1,
        comments: [],
        campus: me.campus,
      };
      setPosts((prev) => [post, ...prev]);
      return post;
    },
    [me.campus, setPosts],
  );

  const deletePost = useCallback(
    (postId: string) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (isObjectId(postId) && remotePosts?.some((p) => p.id === postId)) {
        void request(`/posts/${postId}`, { method: "DELETE" }).catch((error) => system.toast({ title: "Post wasn’t deleted", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
        setRemotePosts((prev) => prev?.filter((p) => p.id !== postId) ?? null);
        return;
      }
      system.toast({ title: "Post deleted", tone: "warning" });
    },
    [setPosts, remotePosts, system],
  );

  /* ----------------------------- profile ---------------------------- */

  const updateProfile = useCallback((patch: Partial<User>) => {
    setMe((prev) => ({ ...prev, ...patch }));
    if (getAccessToken()) {
      const safe = { ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.bio !== undefined ? { bio: patch.bio } : {}), ...(patch.course !== undefined ? { course: patch.course } : {}) };
      void backend.updateProfile(safe).then((user) => setMe((previous) => ({ ...previous, name: user.name, bio: user.bio, course: user.course }))).catch((error) => system.toast({ title: "Profile change wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" }));
    }
  }, [setMe, system]);

  const isFollowing = useCallback((userId: string) => following.includes(userId), [following]);

  const toggleFollow = useCallback(
    (userId: string) => {
      const nowFollowing = !following.includes(userId);
      setFollowing((prev) => (nowFollowing ? [...prev, userId] : prev.filter((x) => x !== userId)));
      setMe((prev) => ({ ...prev, following: prev.following + (nowFollowing ? 1 : -1) }));
      if (isObjectId(userId) && remoteUsers[userId] && getAccessToken()) {
        void backend.toggleFollow(userId).catch((error) => {
          setFollowing((prev) => (nowFollowing ? prev.filter((x) => x !== userId) : [...prev, userId]));
          setMe((prev) => ({ ...prev, following: Math.max(0, prev.following + (nowFollowing ? -1 : 1)) }));
          system.toast({ title: "Follow change wasn’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
        });
      }
      system.haptic(nowFollowing ? [6, 20, 6] : 5);
      return nowFollowing;
    },
    [following, setFollowing, setMe, remoteUsers, system],
  );

  /* ------------------------------- chat ----------------------------- */

  const patchConv = useCallback(
    (conversationId: string, fn: (c: Conversation) => Conversation) =>
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? fn(c) : c))),
    [setConversations],
  );

  const deliverLater = useCallback(
    (conversationId: string, messageId: string) => {
      window.setTimeout(() => {
        patchConv(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === messageId && m.status === "sending" ? { ...m, status: "sent" } : m)),
        }));
      }, 420);
      window.setTimeout(() => {
        patchConv(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === messageId && m.status === "sent" ? { ...m, status: "delivered" } : m)),
        }));
      }, 1100);
      window.setTimeout(() => {
        patchConv(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === messageId ? { ...m, status: "read" } : m)),
        }));
      }, 2600);
    },
    [patchConv],
  );

  const simulateReply = useCallback(
    (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return;
      const others = conv.participantIds.filter((id) => id !== ME);
      if (!others.length) return;
      const author = others[Math.floor(Math.random() * others.length)]!;
      const typingDelay = 900 + Math.random() * 700;
      const replyDelay = typingDelay + 1600 + Math.random() * 1800;

      window.setTimeout(() => patchConv(conversationId, (c) => ({ ...c, typing: true })), typingDelay);
      window.setTimeout(() => {
        const text = demoIncoming[Math.floor(Math.random() * demoIncoming.length)]!;
        const message: Message = {
          id: uid("m"),
          conversationId,
          authorId: author,
          kind: "text",
          text,
          createdAt: Date.now(),
          mine: false,
          status: "delivered",
        };
        patchConv(conversationId, (c) => ({ ...c, typing: false, messages: [...c.messages, message] }));
        const openInThread = window.location.hash.includes(conversationId);
        if (!openInThread) {
          pushNotificationLocal({
            kind: "message",
            actorId: author,
            title: `${userDb[author]?.name ?? "Someone"} sent you a message`,
            body: text,
            preview: text,
            conversationId,
            to: `/chats/${conversationId}`,
          });
          system.pushBanner({
            title: userDb[author]?.name ?? "New message",
            body: text,
            avatar: userDb[author]?.avatar,
            time: "now",
            tone: "message",
            onOpen: () => (window.location.hash = `#/chats/${conversationId}`),
            onMarkRead: () => markReadLocal(conversationId),
          });
          system.showIsland({
            leading: undefined,
            title: userDb[author]?.name ?? "Message",
            subtitle: text,
            onOpen: () => (window.location.hash = `#/chats/${conversationId}`),
            duration: 4200,
          });
        }
        system.playSound("pop");
      }, replyDelay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, patchConv, system],
  );

  const pushNotificationLocal = useCallback(
    (n: Omit<AppNotification, "id" | "createdAt" | "read"> & { createdAt?: number }) => {
      const full: AppNotification = { id: uid("n"), createdAt: n.createdAt ?? Date.now(), read: false, ...n };
      setNotifications((prev) => [full, ...prev].slice(0, 60));
      return full;
    },
    [setNotifications],
  );

  const markReadLocal = useCallback(
    (conversationId: string) => patchConv(conversationId, (c) => ({ ...c, unread: 0 })),
    [patchConv],
  );

  const sendMessage = useCallback<StoreCtx["sendMessage"]>(
    (conversationId, input) => {
      const id = uid("m");
      const message: Message = {
        id,
        conversationId,
        authorId: ME,
        kind: input.kind ?? "text",
        text: input.text,
        media: input.media,
        duration: input.duration,
        fileName: input.fileName,
        fileSize: input.fileSize,
        replyTo: input.replyTo,
        createdAt: Date.now(),
        mine: true,
        status: "sending",
      };
      patchConv(conversationId, (c) => ({ ...c, messages: [...c.messages, message] }));
      system.playSound("send");
      system.haptic(6);
      deliverLater(conversationId, id);
      if (Math.random() > 0.25) simulateReply(conversationId);
    },
    [patchConv, system, deliverLater, simulateReply],
  );

  const editMessage = useCallback<StoreCtx["editMessage"]>(
    (conversationId, messageId, text) => {
      patchConv(conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, text, edited: true } : m)),
      }));
      system.toast({ title: "Message updated", tone: "success" });
    },
    [patchConv, system],
  );

  const deleteMessage = useCallback<StoreCtx["deleteMessage"]>(
    (conversationId, messageId) => {
      patchConv(conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, deleted: true, text: "This message was deleted", media: undefined, reactions: [] } : m)),
      }));
      system.toast({ title: "Message deleted", tone: "warning" });
    },
    [patchConv, system],
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
      system.haptic(4);
    },
    [patchConv, system],
  );

  const togglePin = useCallback(
    (conversationId: string) => patchConv(conversationId, (c) => ({ ...c, pinned: !c.pinned })),
    [patchConv],
  );
  const toggleMute = useCallback(
    (conversationId: string) => patchConv(conversationId, (c) => ({ ...c, muted: !c.muted })),
    [patchConv],
  );
  const toggleArchive = useCallback(
    (conversationId: string) => {
      let archived = false;
      patchConv(conversationId, (c) => {
        archived = !c.archived;
        return { ...c, archived };
      });
      system.toast({ title: archived ? "Conversation archived" : "Restored to inbox", tone: "info" });
    },
    [patchConv, system],
  );
  const setWallpaper = useCallback<StoreCtx["setWallpaper"]>(
    (conversationId, w) => patchConv(conversationId, (c) => ({ ...c, wallpaper: w })),
    [patchConv],
  );

  const markConversationRead = useCallback<StoreCtx["markConversationRead"]>(
    (conversationId) => {
      patchConv(conversationId, (c) => ({ ...c, unread: 0 }));
      setNotifications((prev) => prev.map((n) => (n.conversationId === conversationId ? { ...n, read: true } : n)));
    },
    [patchConv, setNotifications],
  );

  const startConversation = useCallback<StoreCtx["startConversation"]>(
    (userId) => {
      const existing = conversations.find((c) => !c.group && c.participantIds[0] === userId);
      if (existing) {
        setConversations((prev) => prev.map((c) => (c.id === existing.id ? { ...c, archived: false } : c)));
        return existing.id;
      }
      const id = uid("cv");
      const conv: Conversation = { id, participantIds: [userId], messages: [], unread: 0, wallpaper: "midnight" };
      setConversations((prev) => [conv, ...prev]);
      return id;
    },
    [conversations, setConversations],
  );

  const forwardMessage = useCallback<StoreCtx["forwardMessage"]>(
    (conversationId, message) => {
      const id = uid("m");
      const copy: Message = {
        ...message,
        id,
        conversationId,
        authorId: ME,
        mine: true,
        status: "sending",
        createdAt: Date.now(),
        reactions: [],
        replyTo: undefined,
        forwarded: true,
        deleted: false,
      };
      patchConv(conversationId, (c) => ({ ...c, messages: [...c.messages, copy] }));
      deliverLater(conversationId, id);
      system.toast({ title: "Message forwarded", tone: "success" });
    },
    [patchConv, deliverLater, system],
  );

  /* -------------------------- notifications ------------------------- */

  const markNotificationRead = useCallback(
    (id: string) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
    [setNotifications],
  );
  const markAllNotificationsRead = useCallback(
    () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    [setNotifications],
  );
  const clearNotifications = useCallback(() => setNotifications([]), [setNotifications]);
  const removeNotification = useCallback(
    (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id)),
    [setNotifications],
  );

  const pushNotification = useCallback<StoreCtx["pushNotification"]>(
    (n) => pushNotificationLocal(n),
    [pushNotificationLocal],
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

  const resetDemoData = useCallback(() => {
    setPosts(seedPosts);
    setConversations(seedConversations);
    setNotifications(seedNotifications);
    setMe(userDb[ME]);
    setFollowing(["u1", "u2", "u4", "u5", "u6"]);
    system.toast({ title: "Demo data restored", tone: "info" });
  }, [setPosts, setConversations, setNotifications, setMe, setFollowing, system]);

  /* -------------------- ambient demo activity stream ---------------- */
  useEffect(() => {
    if (!ambient || !ready) return;
    let cancelled = false;
    const schedule = () => {
      const wait = 38000 + Math.random() * 26000;
      return window.setTimeout(fire, wait);
    };
    const fire = () => {
      if (cancelled || document.visibilityState !== "visible") {
        timer = schedule();
        return;
      }
      const roll = Math.random();
      const actorPool = ["u1", "u2", "u4", "u5", "u6", "u9"];
      const actor = actorPool[Math.floor(Math.random() * actorPool.length)]!;
      const u = userDb[actor];
      if (roll < 0.5) {
        const body = demoIncoming[Math.floor(Math.random() * demoIncoming.length)]!;
        const conv = conversations.find((c) => c.participantIds.includes(actor)) ?? conversations[0];
        if (conv) {
          const message: Message = {
            id: uid("m"),
            conversationId: conv.id,
            authorId: actor,
            kind: "text",
            text: body,
            createdAt: Date.now(),
            mine: false,
            status: "delivered",
          };
          patchConv(conv.id, (c) => ({ ...c, messages: [...c.messages, message], unread: c.unread + 1 }));
          pushNotificationLocal({
            kind: "message",
            actorId: actor,
            title: `${u?.name ?? "Someone"} sent you a message`,
            body,
            preview: body,
            conversationId: conv.id,
            to: `/chats/${conv.id}`,
          });
          system.pushBanner({
            title: u?.name ?? "New message",
            body,
            avatar: u?.avatar,
            time: "now",
            tone: "message",
            onOpen: () => (window.location.hash = `#/chats/${conv.id}`),
            onMarkRead: () => markReadLocal(conv.id),
            onReply: (text) =>
              sendMessage(conv.id, { text }),
            expandedBody: `${conv.group ? conv.title : u?.institution ?? ""} · tap to open the conversation`,
          });
          system.showIsland({ title: u?.name ?? "Message", subtitle: body, duration: 4200 });
        }
      } else if (roll < 0.8) {
        const n = pushNotificationLocal({
          kind: roll < 0.65 ? "like" : "follow",
          actorId: actor,
          title:
            roll < 0.65
              ? `${u?.name ?? "Someone"} liked your post`
              : `${u?.name ?? "Someone"} started following you`,
          body: roll < 0.65 ? "“Shipped a tiny feature tonight…”" : `${u?.institution ?? ""} · ${u?.followers ?? 0} followers`,
          to: roll < 0.65 ? "/home" : `/profile/${actor}`,
        });
        system.pushBanner({
          title: n.title,
          body: n.body,
          avatar: u?.avatar,
          time: "now",
          onOpen: () => (window.location.hash = `#${n.to}`),
          onMarkRead: () => markNotificationRead(n.id),
        });
      } else {
        system.showIsland({
          title: "CampusLaugh",
          subtitle: "Trending near you: #HostelChronicles · 12.4K posts",
          duration: 5200,
        });
      }
      timer = schedule();
    };
    let timer = schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient, ready]);

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
      me,
      users: { ...userDb, [ME]: me, ...remoteUsers },
      following,
      bookmarks,
      recentSearches,
      ambient,
      unreadTotal,
      unreadNotifications,
      setAmbient,
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
      sendMessage,
      editMessage,
      deleteMessage,
      reactMessage,
      markConversationRead,
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
      pushNotification,
      addRecentSearch,
      clearRecentSearches,
      resetDemoData,
    }),
    [
      ready, posts, visiblePosts, remotePosts, setRemoteFeed, setPostComments, cacheUser, apiUserId, remoteUsers, conversations, notifications, me, following, bookmarks, recentSearches, ambient,
      unreadTotal, unreadNotifications, userById, toggleLike, toggleBookmark, toggleRepost, hidePost,
      reportPost, votePoll, addComment, toggleCommentLike, createPost, deletePost, updateProfile,
      toggleFollow, isFollowing, sendMessage, editMessage, deleteMessage, reactMessage,
      markConversationRead, togglePin, toggleMute, toggleArchive, setWallpaper, startConversation,
      forwardMessage, markNotificationRead, markAllNotificationsRead, clearNotifications,
      removeNotification, pushNotification, addRecentSearch, clearRecentSearches, resetDemoData,
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
