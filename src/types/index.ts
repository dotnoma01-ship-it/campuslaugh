export type ThemeMode = "light" | "dark" | "system";

export interface User {
  id: string;
  username: string;
  name: string;
  institution: string;
  campus: string;
  avatar: string;
  cover?: string;
  bio?: string;
  course?: string;
  followers: number;
  following: number;
  verified?: boolean;
  online?: boolean;
  lastSeen?: string;
}

export type MediaKind = "image" | "video";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  src: string;
  poster?: string;
  alt?: string;
  w?: number;
  h?: number;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
  likes: number;
  liked?: boolean;
  replies?: Comment[];
}

export interface Post {
  id: string;
  authorId: string;
  anonymous?: boolean;
  text: string;
  media?: MediaItem[];
  hashtags: string[];
  mentions?: string[];
  createdAt: number;
  likes: number;
  liked?: boolean;
  reposts: number;
  reposted?: boolean;
  bookmarked?: boolean;
  views: number;
  comments: Comment[];
  campus: string;
  kind?: "post" | "repost";
  poll?: {
    question: string;
    options: { id: string; label: string; votes: number }[];
  };
}

export type MessageKind = "text" | "image" | "video" | "voice" | "document" | "system";

export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface Reaction {
  emoji: string;
  byMe?: boolean;
  count: number;
}

export interface Message {
  id: string;
  conversationId: string;
  authorId: string;
  kind: MessageKind;
  text?: string;
  media?: MediaItem;
  duration?: number;
  fileSize?: string;
  fileName?: string;
  createdAt: number;
  mine: boolean;
  status?: MessageStatus;
  replyTo?: { id: string; authorId: string; text: string };
  reactions?: Reaction[];
  edited?: boolean;
  deleted?: boolean;
  forwarded?: boolean;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  group?: boolean;
  title?: string;
  messages: Message[];
  unread: number;
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
  typing?: boolean;
  wallpaper?: WallpaperId;
}

export type WallpaperId = "midnight" | "linen" | "aurora" | "graphite" | "lime";

export type NotificationKind =
  | "like"
  | "comment"
  | "follow"
  | "mention"
  | "repost"
  | "message"
  | "campus"
  | "account";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  actorId?: string;
  title: string;
  body: string;
  preview?: string;
  createdAt: number;
  read: boolean;
  postId?: string;
  conversationId?: string;
  to?: string;
}

export interface Settings {
  theme: ThemeMode;
  accent: "lime" | "mint" | "coral";
  whoCanMessage: "everyone" | "following" | "campus";
  onlineVisibility: boolean;
  readReceipts: boolean;
  institutionVisibility: boolean;
  notifyMessages: boolean;
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollowers: boolean;
  notifyMentions: boolean;
  notifyCampus: boolean;
  sound: boolean;
  vibration: boolean;
  banners: boolean;
  island: boolean;
  reduceMotion: boolean;
  mediaAutoplay: boolean;
  wallpaper: WallpaperId;
  compactFeed: boolean;
  simulateErrors: boolean;
  demoActivity: boolean;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone?: "success" | "error" | "warning" | "info";
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

export interface SheetAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  tone?: "default" | "danger" | "brand";
  disabled?: boolean;
  onSelect?: () => void;
}
