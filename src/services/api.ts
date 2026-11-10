import { conversations, notifications, posts, trending, users } from "@/data/mock";
import type { AppNotification, Conversation, Post, User } from "@/types";

/**
 * API-ready service layer.
 *
 * CampusLaugh's frontend talks to the app exclusively through these
 * functions. Today they resolve from bundled demonstration data with a
 * small simulated latency; swapping in a real HTTP client later means
 * changing this one file — no component needs to be rebuilt.
 */

const LATENCY = 520;
const delay = (ms = LATENCY) => new Promise<void>((r) => setTimeout(r, ms));

export interface FeedPage {
  items: Post[];
  nextCursor: number | null;
}

export const api = {
  async getMe(): Promise<User> {
    await delay(160);
    return users.me;
  },

  async getUsers(): Promise<Record<string, User>> {
    await delay(120);
    return users;
  },

  /** Paginated feed. `cursor` is an index into the demo dataset. */
  async getFeed(tab: "foryou" | "following" | "campus", cursor = 0): Promise<FeedPage> {
    await delay();
    let pool = posts;
    if (tab === "following") pool = posts.filter((p) => ["u1", "u2", "u4", "u5", "u6"].includes(p.authorId));
    if (tab === "campus") pool = posts.filter((p) => p.campus.startsWith("UNILAG") || p.authorId === "anon");
    const size = 4;
    const start = cursor * size;
    const slice = pool.slice(start, start + size);
    // loop the demo pool so infinite scroll always has more content
    const items = slice.length
      ? slice.map((p) => ({ ...p, id: start >= pool.length ? `${p.id}_${cursor}` : p.id }))
      : pool.slice(0, size).map((p) => ({ ...p, id: `${p.id}_${cursor}` }));
    return { items, nextCursor: cursor + 1 };
  },

  async getPost(id: string): Promise<Post | undefined> {
    await delay(200);
    return posts.find((p) => p.id === id);
  },

  async getConversations(): Promise<Conversation[]> {
    await delay(420);
    return conversations;
  },

  async getNotifications(): Promise<AppNotification[]> {
    await delay(380);
    return notifications;
  },

  async getTrending() {
    await delay(300);
    return trending;
  },

  async publishPost(input: { text: string; media?: Post["media"]; anonymous?: boolean }): Promise<Post> {
    await delay(700);
    const hashtags = Array.from(new Set((input.text.match(/#[\w]+/g) ?? []).map((t) => t.slice(1))));
    return {
      id: `local_${Date.now()}`,
      authorId: input.anonymous ? "anon" : "me",
      anonymous: input.anonymous,
      text: input.text,
      media: input.media,
      hashtags,
      createdAt: Date.now(),
      likes: 0,
      reposts: 0,
      views: 1,
      comments: [],
      campus: users.me.campus,
    };
  },
};

export type Api = typeof api;
