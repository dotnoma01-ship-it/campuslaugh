import { request } from '@/services/http';
import type { AppNotification, Comment, Conversation, Message, Post, User } from '@/types';

type ApiUser = { _id?: string; id?: string; name?: string; username?: string; institution?: string; campus?: string; course?: string; avatar?: string; cover?: string; bio?: string; followers?: unknown[]; following?: unknown[]; verified?: boolean };
type ApiPost = { _id: string; authorId: string | ApiUser; text: string; media?: Post['media']; anonymous?: boolean; hashtags?: string[]; createdAt: string; likes?: unknown[]; reposts?: unknown[]; bookmarks?: unknown[]; likedByMe?: boolean; repostedByMe?: boolean; bookmarkedByMe?: boolean; campus?: string; comments?: Comment[] };
type ApiComment = { _id: string; authorId: string | ApiUser; parentId?: string; text: string; createdAt: string; likes?: unknown[]; likedByMe?: boolean; deleted?: boolean };
type ApiNotification = { _id: string; actorId?: string | ApiUser; kind: string; title?: string; body?: string; targetId?: string; createdAt: string; readAt?: string | null };
const mapUser = (u: ApiUser): User => ({ id: String(u._id ?? u.id), name: u.name ?? 'Campus student', username: u.username ?? 'student', institution: u.institution ?? '', campus: u.campus ?? u.institution ?? '', course: u.course, avatar: u.avatar ?? '', cover: u.cover, bio: u.bio, followers: u.followers?.length ?? 0, following: u.following?.length ?? 0, verified: u.verified });
let currentApiUser: User | null = null;
const mapPost = (p: ApiPost): { post: Post; author: User } => {
  const rawAuthorId = typeof p.authorId === 'string' ? p.authorId : String(p.authorId._id ?? p.authorId.id);
  const author = typeof p.authorId === 'string' ? (currentApiUser?.id === rawAuthorId ? currentApiUser : { id: rawAuthorId, name: 'Campus student', username: 'student', institution: p.campus ?? '', campus: p.campus ?? '', avatar: '', followers: 0, following: 0 }) : mapUser(p.authorId);
  const authorId = p.anonymous ? 'anon' : currentApiUser?.id === author.id ? 'me' : author.id;
  return { author, post: { id: p._id, authorId, anonymous: p.anonymous, text: p.text, media: p.media ?? [], hashtags: p.hashtags ?? [], createdAt: new Date(p.createdAt).getTime(), likes: p.likes?.length ?? 0, liked: p.likedByMe, reposts: p.reposts?.length ?? 0, reposted: p.repostedByMe, bookmarked: p.bookmarkedByMe, views: 0, comments: p.comments ?? [], campus: p.campus ?? author.campus } };
};
const mapComment = (c: ApiComment): Comment => { const authorId = typeof c.authorId === 'string' ? c.authorId : String(c.authorId._id ?? c.authorId.id); return { id: c._id, authorId: currentApiUser?.id === authorId ? 'me' : authorId, text: c.deleted ? 'This comment was removed' : c.text, createdAt: new Date(c.createdAt).getTime(), likes: c.likes?.length ?? 0, liked: c.likedByMe, replies: [] }; };

export const backend = {
  async currentUser() { const data = await request<{ user: ApiUser }>('/auth/me'); currentApiUser = mapUser(data.user); return { user: currentApiUser, followingIds: (data.user.following ?? []).map(String) }; },
  async getUser(id: string) { const { user } = await request<{ user: ApiUser }>(`/users/${id}`); return mapUser(user); },
  async feed(tab: 'foryou' | 'following' | 'campus', cursor = 0) {
    const page = cursor + 1;
    const data = await request<{ items: ApiPost[]; total: number }>(`/posts?feed=${tab}&page=${page}`);
    const mapped = data.items.map(mapPost);
    return { items: mapped.map((x) => x.post), users: mapped.map((x) => x.author), nextCursor: page * 20 < data.total ? cursor + 1 : null };
  },
  async search(query: string, page = 1) {
    const data = await request<{ people: ApiUser[]; posts: ApiPost[]; tags: { name: string }[] }>(`/search?q=${encodeURIComponent(query)}&page=${page}`);
    const mapped = data.posts.map(mapPost);
    return { people: data.people.map(mapUser), posts: mapped.map((entry) => entry.post), authors: mapped.map((entry) => entry.author), tags: data.tags.map((tag) => tag.name) };
  },
  async publishPost(input: { text: string; media?: Post['media']; anonymous?: boolean }) {
    const data = await request<{ post: ApiPost }>('/posts', { method: 'POST', body: JSON.stringify(input) });
    return mapPost(data.post);
  },
  toggleLike(id: string) { return request<{ liked: boolean; likes: number }>(`/posts/${id}/like`, { method: 'POST' }); },
  toggleRepost(id: string) { return request<{ reposted: boolean; reposts: number }>(`/posts/${id}/repost`, { method: 'POST' }); },
  hidePost(id: string) { return request<{ ok: boolean }>(`/posts/${id}/hide`, { method: 'POST' }); },
  toggleBookmark(id: string) { return request<{ bookmarked: boolean }>(`/posts/${id}/bookmark`, { method: 'POST' }); },
  toggleFollow(id: string) { return request<{ following: boolean }>(`/users/${id}/follow`, { method: 'POST' }); },
  report(targetType: 'user' | 'post' | 'comment' | 'message', targetId: string, reason: string) { return request('/reports', { method: 'POST', body: JSON.stringify({ targetType, targetId, reason }) }); },
  updateProfile(input: Partial<Pick<User, 'name' | 'bio' | 'course'>>) { return request<{ user: ApiUser }>('/users/me', { method: 'PATCH', body: JSON.stringify(input) }).then(({ user }) => mapUser(user)); },
  async getNotifications() { const { items } = await request<{ items: ApiNotification[] }>('/notifications'); return items.map((n): AppNotification => { const actor = typeof n.actorId === 'object' ? mapUser(n.actorId) : undefined; return { id: n._id, kind: (['like','comment','reply','follow','mention','repost','message','campus','account'].includes(n.kind) ? n.kind : 'account') as AppNotification['kind'], actorId: actor?.id, title: n.title ?? 'CampusLaugh update', body: n.body ?? '', createdAt: new Date(n.createdAt).getTime(), read: Boolean(n.readAt), postId: ['like','comment','repost'].includes(n.kind) ? n.targetId : undefined, to: n.kind === 'follow' && actor ? `/profile/${actor.id}` : undefined }; }); },
  getConversations() { return request<{ items: Conversation[] }>('/conversations'); },
  getMessages(id: string) { return request<{ items: Message[] }>(`/conversations/${id}/messages`); },
  async getComments(postId: string) {
    const { items } = await request<{ items: ApiComment[] }>(`/posts/${postId}/comments`);
    const mapped = items.map(mapComment);
    const byId = new Map(mapped.map((comment) => [comment.id, comment]));
    const roots: Comment[] = [];
    for (const raw of items) {
      const comment = byId.get(raw._id)!;
      if (raw.parentId && byId.has(raw.parentId)) byId.get(raw.parentId)!.replies!.push(comment);
      else roots.push(comment);
    }
    return roots;
  },
  async addComment(postId: string, text: string, parentId?: string) { const { comment } = await request<{ comment: ApiComment }>(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text, parentId }) }); return mapComment(comment); },
  async toggleCommentLike(id: string) { return request<{ liked: boolean; likes: number }>(`/comments/${id}/like`, { method: 'POST' }); },
};
