import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auth, optionalAuth } from '../middleware/auth.js';
import { User, Post, Comment, Hashtag, FollowRequest, Conversation, Message, Notification, MediaAsset, RefreshToken, PasswordReset, Announcement, InstitutionRequest, Report } from '../models/index.js';
import { wrap } from '../middleware/async.js';
import { createNotification } from '../utils/notificationEvents.js';
import { chatEvents } from '../utils/chatEvents.js';
import { canSendMessage, canViewProfile, usersBlockEachOther } from '../utils/accountPolicy.js';
import { consumePasswordReset, issuePasswordReset, passwordResetEmailConfigured } from '../services/passwordReset.js';
import { env } from '../config/env.js';
import { cloudinary } from '../config/cloudinary.js';

export const featureApi = Router();
const passwordResetLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });
const id = (value: string) => mongoose.isValidObjectId(value);
const pageArgs = (req: any) => ({ page: Math.max(1, Number(req.query.page) || 1), limit: Math.min(50, Math.max(1, Number(req.query.limit) || 20)) });
const privateFields = 'name username institution campus institutionId avatar cover bio course department location website role isPrivate privacy followers following active notificationPreferences';
const visibleAuthorIds = async (viewerId: string, discovery = false) => {
  const viewer = await User.findById(viewerId).select('following blocked');
  if (!viewer) return [];
  const blocksMe = await User.find({ blocked: viewerId }).distinct('_id');
  const denied = [...viewer.blocked.map(String), ...blocksMe.map(String)];
  return User.find({ active: true, ...(discovery ? { 'privacy.showActivity': { $ne: false } } : {}), _id: { $nin: denied }, $or: [{ isPrivate: false }, { _id: { $in: [...viewer.following, viewerId] } }] }).distinct('_id');
};
const canReadPost = async (viewerId: string, post: any) => {
  const author = await User.findById(post.authorId).select('active isPrivate followers blocked');
  if (!author || !await canViewProfile(viewerId, author)) return false;
  if (post.visibility === 'followers' && !author.followers.some((f: unknown) => String(f) === viewerId) && String(author._id) !== viewerId) return false;
  return true;
};
const postView = (p: any, viewerId: string) => ({ ...p.toObject(), ...(p.anonymous ? { authorId: { name: 'Campus Confession', username: 'anonymous', avatar: '' } } : {}), likedByMe: p.likes?.some((x: unknown) => String(x) === viewerId), repostedByMe: p.reposts?.some((x: unknown) => String(x) === viewerId), bookmarkedByMe: p.bookmarks?.some((x: unknown) => String(x) === viewerId) });
const interactionAllowed = async (actorId: string, targetId: unknown) => {
  if (!targetId || await usersBlockEachOther(actorId, targetId)) return false;
  const owner = await User.findById(targetId).select('privacy');
  return owner?.privacy?.allowPostInteractions !== false;
};
const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const postMediaSchema = z.array(z.object({ id: z.string().min(1).max(160), kind: z.enum(['image', 'video']), src: z.string().url().max(2048), alt: z.string().max(500).optional() }).strict()).max(4);
const extractTags = (text: string) => [...new Set((text.match(/#([\p{L}\p{N}_]{1,50})/gu) ?? []).map((tag) => tag.slice(1).normalize('NFKC').toLowerCase()))];
const notifyMentions = async (text: string, actorId: unknown, targetId: unknown) => {
  const names = [...new Set((text.match(/@([a-zA-Z0-9_.]{3,24})/g) ?? []).map((name) => name.slice(1).toLowerCase()))];
  if (!names.length) return;
  const [actor, targets] = await Promise.all([User.findById(actorId).select('name'), User.find({ username: { $in: names }, active: true }).select('_id')]);
  if (actor) await Promise.all(targets.filter((target) => String(target._id) !== String(actorId)).map((target) => createNotification({ recipientId: target._id, actorId, kind: 'mention', title: `${actor.name} mentioned you`, body: text.slice(0, 140), targetId })));
};
const normalizePostMedia = async (media: z.infer<typeof postMediaSchema>, ownerId: string) => {
  if (!media.length) return [];
  const assets = await MediaAsset.find({ ownerId, publicId: { $in: media.map((item) => item.id) }, context: 'post', conversationId: { $exists: false } }).select('publicId url resourceType');
  if (assets.length !== media.length || media.some((item) => !assets.some((asset) => asset.publicId === item.id && asset.url === item.src))) return null;
  return media;
};

featureApi.post('/auth/refresh', wrap(async (req, res) => {
  if (req.get('origin') && req.get('origin') !== env.frontend) return res.status(403).json({ message: 'Origin is not allowed.' });
  const token = req.cookies?.refreshToken;
  const clearCookie = () => res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production' });
  if (typeof token !== 'string') { clearCookie(); return res.status(401).json({ message: 'Refresh token missing.' }); }
  let claims: { sub?: string; jti?: string };
  try {
    claims = jwt.verify(token, env.refreshSecret) as { sub?: string; jti?: string };
  } catch { clearCookie(); return res.status(401).json({ message: 'Refresh token is invalid or expired.' }); }
  if (!claims.sub || !mongoose.isValidObjectId(claims.sub)) { clearCookie(); return res.status(401).json({ message: 'Refresh token is invalid.' }); }
  const old = await RefreshToken.findOneAndDelete({ tokenHash: tokenHash(token), userId: claims.sub });
  if (!old) {
    clearCookie();
    return res.status(401).json({ message: 'Refresh token has already been used. Sign in again.' });
  }
  const user = await User.findOne({ _id: claims.sub, active: true }).select('role tokenVersion');
  if (!user) { clearCookie(); return res.status(401).json({ message: 'Session is unavailable.' }); }
  const next = jwt.sign({ sub: String(user._id), jti: crypto.randomUUID() }, env.refreshSecret, { expiresIn: '30d' });
  await RefreshToken.create({ userId: user._id, tokenHash: tokenHash(next), expiresAt: new Date(Date.now() + 30 * 864e5), remember: old.remember });
  const accessToken = jwt.sign({ sub: String(user._id), role: user.role, ver: user.tokenVersion ?? 0 }, env.accessSecret, { expiresIn: '15m' });
  res.cookie('refreshToken', next, { httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production', ...(old.remember ? { maxAge: 30 * 864e5 } : {}) });
  res.json({ accessToken });
}));
featureApi.post('/auth/logout', wrap(async (req, res) => {
  if (req.get('origin') && req.get('origin') !== env.frontend) return res.status(403).json({ message: 'Origin is not allowed.' });
  const token = req.cookies?.refreshToken;
  if (typeof token === 'string') await RefreshToken.deleteOne({ tokenHash: tokenHash(token) });
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production' });
  res.json({ ok: true });
}));

featureApi.post('/auth/forgot-password', passwordResetLimiter, wrap(async (req, res) => {
  const { email } = z.object({ email: z.string().email().max(254) }).parse(req.body);
  if (!passwordResetEmailConfigured) return res.status(503).json({ message: 'Password-reset email delivery is not configured.' });
  try { await issuePasswordReset(email); }
  catch { return res.status(503).json({ message: 'Password-reset email could not be sent. Try again later.' }); }
  res.status(202).json({ message: 'If an active account uses that email, password-reset instructions have been sent.' });
}));
featureApi.post('/auth/reset-password', passwordResetLimiter, wrap(async (req, res) => {
  const body = z.object({ token: z.string().min(40).max(60), password: z.string().min(8).max(100).regex(/[A-Za-z]/).regex(/[0-9]/) }).strict().parse(req.body);
  const changed = await consumePasswordReset(body.token, body.password);
  if (!changed) return res.status(400).json({ message: 'This password-reset link is invalid or expired. Request a new one.' });
  res.json({ message: 'Password updated. Please sign in again.' });
}));

featureApi.get('/users/me', auth, wrap(async (req, res) => {
  const user = await User.findById(req.userId).select('-passwordHash -email -tokenVersion -deletedAt');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
}));
featureApi.patch('/users/me', auth, wrap(async (req, res) => {
  const body = z.object({ name: z.string().min(2).max(80).optional(), username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_.]+$/).optional(), bio: z.string().max(280).optional(), course: z.string().max(120).optional(), department: z.string().max(120).optional(), location: z.string().max(120).optional(), website: z.string().max(240).refine((value) => !value || /^https:\/\//i.test(value), 'Website must use HTTPS').optional(), avatar: z.string().url().or(z.literal('')).optional(), cover: z.string().url().or(z.literal('')).optional() }).strict().parse(req.body);
  if (body.username && await User.exists({ username: body.username.toLowerCase(), _id: { $ne: req.userId } })) return res.status(409).json({ message: 'Username is already taken.' });
  for (const key of ['avatar', 'cover'] as const) if (body[key] && !await MediaAsset.exists({ ownerId: req.userId, url: body[key] })) return res.status(400).json({ message: `Upload your ${key} image before saving it.` });
  const update = { ...body, ...(body.username ? { username: body.username.toLowerCase() } : {}) };
  const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true, runValidators: true }).select('-passwordHash -email');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
}));
featureApi.patch('/users/me/settings', auth, wrap(async (req, res) => {
  const body = z.object({ isPrivate: z.boolean().optional(), privacy: z.object({ showFollowers: z.boolean().optional(), showFollowing: z.boolean().optional(), showOnlineStatus: z.boolean().optional(), showActivity: z.boolean().optional(), allowPostInteractions: z.boolean().optional(), showReadReceipts: z.boolean().optional(), whoCanMessage: z.enum(['everyone', 'following', 'campus']).optional() }).strict().optional(), notificationPreferences: z.object({ likes: z.boolean().optional(), comments: z.boolean().optional(), replies: z.boolean().optional(), followers: z.boolean().optional(), mentions: z.boolean().optional(), reposts: z.boolean().optional(), messages: z.boolean().optional(), announcements: z.boolean().optional(), administrative: z.boolean().optional() }).strict().optional() }).strict().refine((v) => Object.keys(v).length > 0).parse(req.body);
  const update: Record<string, unknown> = {};
  if (body.isPrivate !== undefined) update.isPrivate = body.isPrivate;
  for (const key of ['privacy', 'notificationPreferences'] as const) if (body[key]) for (const [name, value] of Object.entries(body[key]!)) update[`${key}.${name}`] = value;
  const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true, runValidators: true }).select('isPrivate privacy notificationPreferences');
  if (body.privacy?.showOnlineStatus !== undefined) chatEvents.emit('presence:privacy', { userId: String(req.userId), visible: body.privacy.showOnlineStatus });
  res.json({ settings: user });
}));

featureApi.delete('/users/me', auth, wrap(async (req, res) => {
  const body = z.object({ currentPassword: z.string().min(1).max(100), confirmation: z.literal('DELETE') }).strict().parse(req.body);
  const user = await User.findById(req.userId).select('+passwordHash name username email');
  if (!user || !await bcrypt.compare(body.currentPassword, user.passwordHash)) return res.status(400).json({ message: 'Current password is incorrect.' });
  const userId = user._id;
  const userIdString = String(userId);
  const ownPosts = await Post.find({ authorId: userId }).select('_id hashtags').lean();
  const postIds = ownPosts.map((post) => post._id);
  const ownedAssets = await MediaAsset.find({ ownerId: userId }).select('publicId resourceType').lean();
  const conversations = await Conversation.find({ members: userId });
  const groupIds: mongoose.Types.ObjectId[] = [];
  const directIds: mongoose.Types.ObjectId[] = [];
  for (const conversation of conversations) {
    if (!conversation.group) { directIds.push(conversation._id); continue; }
    conversation.members = conversation.members.filter((member) => String(member) !== userIdString) as any;
    conversation.admins = conversation.admins.filter((member) => String(member) !== userIdString) as any;
    conversation.unreadBy = conversation.unreadBy.filter((entry: any) => String(entry.userId) !== userIdString) as any;
    conversation.readCursors = conversation.readCursors.filter((entry: any) => String(entry.userId) !== userIdString) as any;
    conversation.archivedBy = conversation.archivedBy.filter((member) => String(member) !== userIdString) as any;
    conversation.pinnedBy = conversation.pinnedBy.filter((member) => String(member) !== userIdString) as any;
    conversation.mutedBy = conversation.mutedBy.filter((member) => String(member) !== userIdString) as any;
    if (String(conversation.ownerId ?? '') === userIdString) conversation.ownerId = conversation.members[0];
    if (conversation.members.length < 2) directIds.push(conversation._id);
    else { await conversation.save(); groupIds.push(conversation._id); }
  }
  if (directIds.length) {
    await Message.deleteMany({ conversationId: { $in: directIds } });
    await Conversation.deleteMany({ _id: { $in: directIds } });
  }
  await Promise.all([
    Post.deleteMany({ authorId: userId }),
    Comment.deleteMany({ $or: [{ authorId: userId }, { postId: { $in: postIds } }] }),
    Post.updateMany({}, { $pull: { likes: userId, reposts: userId, bookmarks: userId, hiddenBy: userId, mentions: userId } }),
    Comment.updateMany({}, { $pull: { likes: userId } }),
    User.updateMany({ _id: { $ne: userId } }, { $pull: { followers: userId, following: userId, blocked: userId, muted: userId } }),
    FollowRequest.deleteMany({ $or: [{ requesterId: userId }, { targetId: userId }] }),
    Notification.deleteMany({ $or: [{ recipientId: userId }, { actorId: userId }] }),
    RefreshToken.deleteMany({ userId }),
    PasswordReset.deleteMany({ userId }),
    MediaAsset.deleteMany({ ownerId: userId }),
    InstitutionRequest.updateMany({ requestedBy: userId }, { $unset: { requestedBy: 1 } }),
    Report.updateMany({ reporterId: userId }, { $unset: { reporterId: 1 } }),
    Announcement.updateMany({ createdBy: userId }, { $unset: { createdBy: 1 } }),
    Message.updateMany({ conversationId: { $in: groupIds }, senderId: userId }, { $set: { deleted: true, text: '', attachments: [], reactions: [] }, $unset: { forwardedFrom: 1 } }),
  ]);
  for (const name of new Set(ownPosts.flatMap((post) => post.hashtags ?? []))) {
    const total = await Post.countDocuments({ hashtags: name });
    await Hashtag.updateOne({ name }, { $set: { uses: total } });
  }
  const cleanup = await Promise.allSettled(ownedAssets.map((asset) => cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType })));
  await User.updateOne({ _id: userId }, { $set: {
    name: 'Deleted account', username: `deleted_${userIdString}`, email: `${userIdString}@deleted.invalid`,
    passwordHash: await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12),
    institution: '', campus: '', course: '', department: '', location: '', website: '', bio: '', avatar: '', cover: '',
    followers: [], following: [], blocked: [], muted: [], active: false, deletedAt: new Date(), isPrivate: true,
  }, $unset: { institutionId: 1, privacy: 1, notificationPreferences: 1, settings: 1 } });
  chatEvents.emit('account:deleted', { userId: userIdString });
  for (const conversationId of groupIds) chatEvents.emit('group:member-removed', { conversationId: String(conversationId), userId: userIdString });
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production' });
  res.json({ ok: true, accountDeleted: true, mediaCleanupComplete: cleanup.every((result) => result.status === 'fulfilled') });
}));

featureApi.get('/users/blocked', auth, wrap(async (req, res) => {
  const user = await User.findById(req.userId).select('blocked').populate('blocked', 'name username avatar institution');
  res.json({ items: user?.blocked ?? [] });
}));
featureApi.post('/users/:id/block', auth, wrap(async (req, res) => {
  if (!id(String(req.params.id)) || String(req.params.id) === req.userId) return res.status(400).json({ message: 'Choose another valid account.' });
  const target = await User.findOne({ _id: String(req.params.id), active: true }).select('_id');
  if (!target) return res.status(404).json({ message: 'User not found' });
  await User.findByIdAndUpdate(req.userId, { $addToSet: { blocked: target._id } });
  await Promise.all([
    User.updateOne({ _id: req.userId }, { $pull: { following: target._id, followers: target._id } }),
    User.updateOne({ _id: target._id }, { $pull: { following: req.userId, followers: req.userId } }),
    FollowRequest.deleteMany({ $or: [{ requesterId: req.userId, targetId: target._id }, { requesterId: target._id, targetId: req.userId }] }),
  ]);
  res.json({ ok: true });
}));
featureApi.delete('/users/:id/block', auth, wrap(async (req, res) => {
  if (!id(String(req.params.id))) return res.status(400).json({ message: 'Invalid user id.' });
  await User.findByIdAndUpdate(req.userId, { $pull: { blocked: String(req.params.id) } });
  res.json({ ok: true });
}));

featureApi.get('/follow-requests/incoming', auth, wrap(async (req, res) => {
  const { page, limit } = pageArgs(req);
  const [items, total] = await Promise.all([FollowRequest.find({ targetId: req.userId, status: 'pending' }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('requesterId', 'name username avatar institution'), FollowRequest.countDocuments({ targetId: req.userId, status: 'pending' })]);
  res.json({ items, page, limit, total });
}));
featureApi.get('/follow-requests/outgoing', auth, wrap(async (req, res) => {
  const { page, limit } = pageArgs(req);
  const [items, total] = await Promise.all([FollowRequest.find({ requesterId: req.userId, status: 'pending' }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('targetId', 'name username avatar institution'), FollowRequest.countDocuments({ requesterId: req.userId, status: 'pending' })]);
  res.json({ items, page, limit, total });
}));
featureApi.post('/users/:id/follow', auth, wrap(async (req, res) => {
  const target = await User.findOne({ _id: String(req.params.id), active: true });
  if (!target || String(target._id) === req.userId) return res.status(404).json({ message: 'User not found' });
  if (await usersBlockEachOther(req.userId, target._id)) return res.status(404).json({ message: 'User not found' });
  const following = target.followers.some((x: unknown) => String(x) === req.userId);
  if (following) {
    await Promise.all([User.updateOne({ _id: target._id }, { $pull: { followers: req.userId } }), User.updateOne({ _id: req.userId }, { $pull: { following: target._id } }), FollowRequest.deleteOne({ requesterId: req.userId, targetId: target._id, status: 'pending' })]);
    return res.json({ following: false, requested: false });
  }
  if (target.isPrivate) {
    const existing = await FollowRequest.findOne({ requesterId: req.userId, targetId: target._id, status: 'pending' });
    if (existing) {
      existing.status = 'cancelled';
      await existing.save();
      return res.json({ following: false, requested: false });
    }
    await FollowRequest.findOneAndUpdate({ requesterId: req.userId, targetId: target._id }, { $set: { status: 'pending' } }, { new: true, upsert: true, runValidators: true });
    return res.status(202).json({ following: false, requested: true });
  }
  await Promise.all([User.updateOne({ _id: target._id }, { $addToSet: { followers: req.userId } }), User.updateOne({ _id: req.userId }, { $addToSet: { following: target._id } })]);
  const actor = await User.findById(req.userId).select('name username');
  if (actor) await createNotification({ recipientId: target._id, actorId: actor._id, kind: 'follow', title: `${actor.name} started following you`, body: `@${actor.username} is now following you.` });
  res.json({ following: true, requested: false });
}));
featureApi.patch('/follow-requests/:id', auth, wrap(async (req, res) => {
  const { status } = z.object({ status: z.enum(['accepted', 'rejected']) }).parse(req.body);
  if (!id(String(req.params.id))) return res.status(404).json({ message: 'Follow request not found' });
  const request = await FollowRequest.findOne({ _id: String(req.params.id), targetId: req.userId, status: 'pending' });
  if (!request) return res.status(404).json({ message: 'Follow request not found' });
  if (status === 'accepted') {
    if (await usersBlockEachOther(request.requesterId, request.targetId)) return res.status(409).json({ message: 'This follow request is no longer available.' });
    await Promise.all([User.updateOne({ _id: request.targetId }, { $addToSet: { followers: request.requesterId } }), User.updateOne({ _id: request.requesterId }, { $addToSet: { following: request.targetId } })]);
  }
  request.status = status;
  await request.save();
  if (status === 'accepted') {
    const actor = await User.findById(req.userId).select('name username');
    if (actor) await createNotification({ recipientId: request.requesterId, actorId: actor._id, kind: 'follow', title: `${actor.name} accepted your follow request`, body: `You now follow @${actor.username}.` });
  }
  res.json({ ok: true, status });
}));
featureApi.delete('/follow-requests/:id', auth, wrap(async (req, res) => {
  const result = await FollowRequest.updateOne({ _id: String(req.params.id), requesterId: req.userId, status: 'pending' }, { $set: { status: 'cancelled' } });
  if (!result.modifiedCount) return res.status(404).json({ message: 'Follow request not found' });
  res.json({ ok: true });
}));

featureApi.get('/users/search', auth, wrap(async (req, res) => {
  const raw = String(req.query.q ?? '').trim().slice(0, 100);
  const { page, limit } = pageArgs(req);
  const viewer = await User.findById(req.userId).select('blocked');
  const blocksMe = await User.find({ blocked: req.userId }).distinct('_id');
  const denied = [...(viewer?.blocked ?? []).map(String), ...blocksMe.map(String)];
  const term = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const criteria: any = { active: true, _id: { $nin: denied } };
  if (raw) criteria.$or = [{ name: { $regex: term, $options: 'i' } }, { username: { $regex: term, $options: 'i' } }, { institution: { $regex: term, $options: 'i' } }];
  criteria['privacy.showActivity'] = { $ne: false };
  const [users, total] = await Promise.all([User.find(criteria).select('name username avatar institution campus bio course isPrivate privacy followers following').sort({ name: 1 }).skip((page - 1) * limit).limit(limit), User.countDocuments(criteria)]);
  const items = users.map((user) => {
    const accepted = user.followers.some((x: unknown) => String(x) === req.userId);
    if (user.isPrivate && !accepted && String(user._id) !== req.userId) return { _id: user._id, name: user.name, username: user.username, avatar: user.avatar, isPrivate: true, inaccessible: true };
    const data: any = user.toObject();
    if (user.privacy?.showFollowers === false && String(user._id) !== req.userId) data.followers = undefined;
    if (user.privacy?.showFollowing === false && String(user._id) !== req.userId) data.following = undefined;
    delete data.privacy;
    return data;
  });
  res.json({ items, page, limit, total });
}));
featureApi.get('/users/:id', optionalAuth, wrap(async (req, res) => {
  if (!id(String(req.params.id))) return res.status(404).json({ message: 'User not found' });
  const user = await User.findOne({ _id: String(req.params.id), active: true }).select(privateFields);
  if (!user || req.userId && await usersBlockEachOther(req.userId, user._id)) return res.status(404).json({ message: 'User not found' });
  const canView = await canViewProfile(req.userId, user);
  if (!canView) return res.status(403).json({ message: 'This account is private.' });
  const own = String(user._id) === req.userId;
  const followersCount = user.followers.length;
  const followingCount = user.following.length;
  const data: any = user.toObject();
  if (!own && user.privacy?.showFollowers === false) data.followers = undefined;
  if (!own && user.privacy?.showFollowing === false) data.following = undefined;
  data.followersCount = own || user.privacy?.showFollowers !== false ? followersCount : undefined;
  data.followingCount = own || user.privacy?.showFollowing !== false ? followingCount : undefined;
  delete data.notificationPreferences;
  delete data.privacy;
  res.json({ user: data });
}));
featureApi.get('/users/:id/stats', optionalAuth, wrap(async (req, res) => {
  if (!id(String(req.params.id))) return res.status(404).json({ message: 'Profile not found' });
  const user = await User.findById(String(req.params.id)).select('followers following isPrivate privacy');
  if (!user || req.userId && await usersBlockEachOther(req.userId, user._id) || !await canViewProfile(req.userId, user)) return res.status(404).json({ message: 'Profile not found' });
  const own = req.userId === String(user._id);
  if (!own && user.privacy?.showActivity === false) return res.json({ stats: { posts: 0, likes: 0, reposts: 0, followers: user.privacy?.showFollowers === false ? undefined : user.followers.length, following: user.privacy?.showFollowing === false ? undefined : user.following.length } });
  const [summary] = await Post.aggregate([{ $match: { authorId: user._id, deleted: false } }, { $group: { _id: null, posts: { $sum: 1 }, likes: { $sum: { $size: { $ifNull: ['$likes', []] } } }, reposts: { $sum: { $size: { $ifNull: ['$reposts', []] } } } } }]);
  const saved = own ? await Post.countDocuments({ bookmarks: user._id, deleted: false }) : undefined;
  res.json({ stats: { posts: summary?.posts ?? 0, likes: summary?.likes ?? 0, reposts: summary?.reposts ?? 0, followers: user.followers.length, following: user.following.length, ...(own ? { saved } : {}) } });
}));
featureApi.get('/users/:id/posts', optionalAuth, wrap(async (req, res) => {
  if (!id(String(req.params.id))) return res.status(404).json({ message: 'Profile not found' });
  const owner = await User.findById(String(req.params.id)).select('followers isPrivate');
  if (!owner || !await canViewProfile(req.userId, owner)) return res.status(404).json({ message: 'Profile not found' });
  const { page, limit } = pageArgs(req);
  const tab = z.enum(['posts', 'replies', 'media', 'likes', 'reposts', 'saved']).catch('posts').parse(req.query.tab);
  if (tab === 'saved' && req.userId !== String(req.params.id)) return res.status(403).json({ message: 'Saved posts are private.' });
  let criteria: any = { deleted: false };
  if (tab === 'posts' || tab === 'media') criteria.authorId = String(req.params.id);
  if (tab === 'media') criteria['media.0'] = { $exists: true };
  if (tab === 'likes') criteria.likes = String(req.params.id);
  if (tab === 'reposts') criteria.reposts = String(req.params.id);
  if (tab === 'saved') criteria.bookmarks = req.userId;
  if (tab === 'replies') criteria._id = { $in: await Comment.find({ authorId: String(req.params.id), deleted: false }).distinct('postId') };
  const [items, total] = await Promise.all([Post.find(criteria).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('authorId', 'name username avatar institution'), Post.countDocuments(criteria)]);
  const safe: any[] = [];
  for (const post of items) if (await canReadPost(req.userId ?? '', post)) safe.push(postView(post, req.userId ?? ''));
  res.json({ items: safe, page, limit, total });
}));

featureApi.get('/posts', auth, wrap(async (req, res) => {
  const { page, limit } = pageArgs(req);
  const allowed = await visibleAuthorIds(req.userId!);
  const viewer = await User.findById(req.userId).select('following institutionId');
  const filter: any = { deleted: false, hiddenBy: { $ne: req.userId }, authorId: { $in: allowed } };
  if (req.query.feed === 'following') filter.authorId.$in = viewer?.following ?? [];
  if (req.query.feed === 'campus') filter.institutionId = viewer?.institutionId;
  const followedPrivate = await User.find({ _id: { $in: viewer?.following ?? [] } }).distinct('_id');
  filter.$or = [{ visibility: { $ne: 'followers' } }, { authorId: { $in: [...followedPrivate, req.userId] } }];
  const [items, total] = await Promise.all([Post.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('authorId', 'name username avatar institution'), Post.countDocuments(filter)]);
  res.json({ items: items.map((post) => { const author: any = post.authorId; const result = postView(post, req.userId!); if (post.anonymous) result.authorId = { name: 'Campus Confession', username: 'anonymous', avatar: '' }; else result.campus = author?.institution ?? ''; return result; }), page, limit, total });
}));

featureApi.get('/posts/:id/comments', auth, wrap(async (req, res) => {
  const post = await Post.findOne({ _id: String(req.params.id), deleted: false });
  if (!post || !await canReadPost(req.userId!, post)) return res.status(404).json({ message: 'Post not found' });
  const items = await Comment.find({ postId: post._id, deleted: false }).sort({ createdAt: 1 }).populate('authorId', 'name username avatar');
  res.json({ items });
}));

featureApi.patch('/posts/:id', auth, wrap(async (req, res) => {
  const body = z.object({ text: z.string().max(5000), media: postMediaSchema.optional(), anonymous: z.boolean().optional() }).strict().parse(req.body);
  const post = await Post.findOne({ _id: String(req.params.id), authorId: req.userId, deleted: false });
  if (!post) return res.status(404).json({ message: 'Post not found.' });
  const media = body.media ?? post.media;
  if (!await normalizePostMedia(media as z.infer<typeof postMediaSchema>, req.userId!)) return res.status(400).json({ message: 'Upload each changed media attachment through your account before saving.' });
  const nextTags = extractTags(body.text);
  const previousTags = new Set(post.hashtags);
  for (const tag of nextTags) if (!previousTags.has(tag)) await Hashtag.updateOne({ name: tag }, { $inc: { uses: 1 }, $set: { lastUsedAt: new Date() } }, { upsert: true });
  for (const tag of previousTags) if (!nextTags.includes(tag)) await Hashtag.updateOne({ name: tag }, { $inc: { uses: -1 } });
  post.text = body.text.trim(); post.media = media as any; post.hashtags = nextTags;
  if (body.anonymous !== undefined) post.anonymous = body.anonymous;
  await post.save();
  await notifyMentions(post.text, req.userId, post._id);
  const populated = await Post.findById(post._id).populate('authorId', 'name username avatar institution campus');
  res.json({ post: postView(populated, req.userId!) });
}));
featureApi.delete('/posts/:id', auth, wrap(async (req, res) => {
  const result = await Post.updateOne({ _id: String(req.params.id), authorId: req.userId, deleted: false }, { $set: { deleted: true } });
  if (!result.modifiedCount) return res.status(404).json({ message: 'Post not found.' });
  res.json({ ok: true });
}));
featureApi.post('/posts/:id/hide', auth, wrap(async (req, res) => {
  const post = await Post.findOne({ _id: String(req.params.id), deleted: false });
  if (!post || !await canReadPost(req.userId!, post)) return res.status(404).json({ message: 'Post not found.' });
  await Post.updateOne({ _id: post._id }, { $addToSet: { hiddenBy: req.userId } });
  res.json({ ok: true });
}));
featureApi.post('/posts/:id/bookmark', auth, wrap(async (req, res) => {
  const post = await Post.findOne({ _id: String(req.params.id), deleted: false });
  if (!post || !await canReadPost(req.userId!, post) || !await interactionAllowed(req.userId!, post.authorId)) return res.status(404).json({ message: 'Post not found.' });
  const saved = post.bookmarks.some((member: unknown) => String(member) === req.userId);
  await Post.updateOne({ _id: post._id }, saved ? { $pull: { bookmarks: req.userId } } : { $addToSet: { bookmarks: req.userId } });
  res.json({ bookmarked: !saved });
}));
featureApi.post('/comments/:id/like', auth, wrap(async (req, res) => {
  const comment = await Comment.findOne({ _id: String(req.params.id), deleted: false }).populate({ path: 'postId', match: { deleted: false } });
  const post: any = comment?.postId;
  if (!comment || !post || !await canReadPost(req.userId!, post) || !await interactionAllowed(req.userId!, post.authorId) || !await interactionAllowed(req.userId!, comment.authorId)) return res.status(404).json({ message: 'Comment not found.' });
  const liked = comment.likes.some((member: unknown) => String(member) === req.userId);
  await Comment.updateOne({ _id: comment._id }, liked ? { $pull: { likes: req.userId } } : { $addToSet: { likes: req.userId } });
  res.json({ liked: !liked });
}));
featureApi.patch('/comments/:id', auth, wrap(async (req, res) => {
  const text = z.string().trim().min(1).max(2000).parse(req.body.text);
  const comment = await Comment.findOne({ _id: String(req.params.id), authorId: req.userId, deleted: false });
  if (!comment) return res.status(404).json({ message: 'Comment not found.' });
  const post = await Post.findOne({ _id: comment.postId, deleted: false });
  if (!post || !await canReadPost(req.userId!, post)) return res.status(404).json({ message: 'Comment not found.' });
  comment.text = text; await comment.save();
  res.json({ comment });
}));
featureApi.delete('/comments/:id', auth, wrap(async (req, res) => {
  const comment = await Comment.findOneAndUpdate({ _id: String(req.params.id), authorId: req.userId, deleted: false }, { $set: { deleted: true } }, { new: true });
  if (!comment) return res.status(404).json({ message: 'Comment not found.' });
  res.json({ ok: true });
}));

featureApi.post('/messages/:id/reactions', auth, wrap(async (req, res) => {
  const emoji = z.string().min(1).max(16).parse(req.body.emoji);
  const message = await Message.findById(String(req.params.id));
  if (!message || message.deleted) return res.status(404).json({ message: 'Message not found.' });
  const conversation = await Conversation.findOne({ _id: message.conversationId, members: req.userId });
  if (!conversation) return res.status(404).json({ message: 'Message not found.' });
  for (const member of conversation.members) if (String(member) !== req.userId && await usersBlockEachOther(req.userId, member)) return res.status(404).json({ message: 'Message not found.' });
  const current = message.reactions.findIndex((reaction: any) => String(reaction.userId) === req.userId && reaction.emoji === emoji);
  if (current < 0) message.reactions.push({ userId: req.userId as any, emoji } as any); else message.reactions.splice(current, 1);
  await message.save();
  res.json({ reactions: message.reactions });
}));

featureApi.post('/reports', auth, wrap(async (req, res) => {
  const body = z.object({ targetType: z.enum(['user', 'post', 'comment', 'message']), targetId: z.string().length(24), reason: z.string().trim().min(3).max(80), details: z.string().trim().max(1000).optional() }).strict().parse(req.body);
  if (!id(body.targetId)) return res.status(400).json({ message: 'Invalid report target.' });
  let exists = false;
  if (body.targetType === 'user') exists = Boolean(await User.exists({ _id: body.targetId, active: true }));
  if (body.targetType === 'post') { const post = await Post.findOne({ _id: body.targetId, deleted: false }); exists = Boolean(post && await canReadPost(req.userId!, post)); }
  if (body.targetType === 'comment') {
    const comment = await Comment.findOne({ _id: body.targetId, deleted: false });
    const post = comment ? await Post.findOne({ _id: comment.postId, deleted: false }) : null;
    exists = Boolean(post && await canReadPost(req.userId!, post));
  }
  if (body.targetType === 'message') {
    const message = await Message.findOne({ _id: body.targetId, deleted: false });
    exists = Boolean(message && await Conversation.exists({ _id: message.conversationId, members: req.userId }));
  }
  if (!exists) return res.status(404).json({ message: 'Report target not found.' });
  if (await Report.exists({ reporterId: req.userId, targetType: body.targetType, targetId: body.targetId, status: 'open' })) return res.status(409).json({ message: 'You already have an open report for this item.' });
  const report = await Report.create({ ...body, reporterId: req.userId });
  res.status(201).json({ report: { id: report.id, status: report.status } });
}));
featureApi.get('/reports', auth, wrap(async (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ message: 'Administrator access required.' });
  const { page, limit } = pageArgs(req);
  const [items, total] = await Promise.all([Report.find({ status: 'open' }).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit).populate('reporterId', 'name username').lean(), Report.countDocuments({ status: 'open' })]);
  res.json({ items, page, limit, total });
}));
featureApi.patch('/reports/:id', auth, wrap(async (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ message: 'Administrator access required.' });
  const body = z.object({ status: z.enum(['resolved', 'dismissed']), action: z.enum(['none', 'remove_content', 'suspend_user']).default('none'), note: z.string().trim().max(1000).optional() }).strict().parse(req.body);
  const report = await Report.findOne({ _id: String(req.params.id), status: 'open' });
  if (!report) return res.status(404).json({ message: 'Open report not found.' });
  if (body.action === 'remove_content') {
    if (report.targetType === 'post') await Post.updateOne({ _id: report.targetId }, { $set: { deleted: true } });
    else if (report.targetType === 'comment') await Comment.updateOne({ _id: report.targetId }, { $set: { deleted: true } });
    else if (report.targetType === 'message') await Message.updateOne({ _id: report.targetId }, { $set: { deleted: true, text: '', attachments: [] }, $unset: { forwardedFrom: 1 } });
    else return res.status(400).json({ message: 'Remove content action does not apply to account reports.' });
  }
  if (body.action === 'suspend_user') {
    const targetId = report.targetType === 'user' ? report.targetId : report.targetType === 'post' ? await Post.findById(report.targetId).select('authorId').then((post) => post?.authorId) : report.targetType === 'comment' ? await Comment.findById(report.targetId).select('authorId').then((comment) => comment?.authorId) : await Message.findById(report.targetId).select('senderId').then((message) => message?.senderId);
    if (!targetId || String(targetId) === req.userId) return res.status(400).json({ message: 'Cannot suspend the administrator or an unavailable account.' });
    await User.updateOne({ _id: targetId }, { $set: { active: false } });
    await RefreshToken.deleteMany({ userId: targetId });
    chatEvents.emit('account:deleted', { userId: String(targetId) });
  }
  report.status = body.status; report.action = body.action; report.moderatorNote = body.note; report.resolvedBy = req.userId as any;
  await report.save();
  res.json({ ok: true, report: { id: report.id, status: report.status, action: report.action } });
}));

featureApi.post('/posts/:id/like', auth, wrap(async (req, res) => {
  const post = await Post.findOne({ _id: String(req.params.id), deleted: false });
  if (!post || !await canReadPost(req.userId!, post) || !await interactionAllowed(req.userId!, post.authorId)) return res.status(404).json({ message: 'Post not found' });
  const at = post.likes.findIndex((x: unknown) => String(x) === req.userId);
  if (at < 0) post.likes.push(req.userId as any); else post.likes.splice(at, 1);
  await post.save();
  if (at < 0) { const actor = await User.findById(req.userId).select('name'); if (actor) await createNotification({ recipientId: post.authorId, actorId: actor._id, kind: 'like', title: `${actor.name} liked your post`, body: post.text.slice(0, 140), targetId: post._id }); }
  res.json({ liked: at < 0, likes: post.likes.length });
}));
featureApi.post('/posts/:id/repost', auth, wrap(async (req, res) => {
  const post = await Post.findOne({ _id: String(req.params.id), deleted: false });
  if (!post || !await canReadPost(req.userId!, post) || !await interactionAllowed(req.userId!, post.authorId)) return res.status(404).json({ message: 'Post not found' });
  const at = post.reposts.findIndex((x: unknown) => String(x) === req.userId);
  if (at < 0) post.reposts.push(req.userId as any); else post.reposts.splice(at, 1);
  await post.save();
  if (at < 0) { const actor = await User.findById(req.userId).select('name'); if (actor) await createNotification({ recipientId: post.authorId, actorId: actor._id, kind: 'repost', title: `${actor.name} reposted your post`, body: post.text.slice(0, 140), targetId: post._id }); }
  res.json({ reposted: at < 0, reposts: post.reposts.length });
}));
featureApi.post('/posts/:id/comments', auth, wrap(async (req, res) => {
  const body = z.object({ text: z.string().min(1).max(2000), parentId: z.string().length(24).optional() }).strict().parse(req.body);
  const post = await Post.findOne({ _id: String(req.params.id), deleted: false });
  if (!post || !await canReadPost(req.userId!, post) || !await interactionAllowed(req.userId!, post.authorId)) return res.status(404).json({ message: 'Post not found' });
  const actor = await User.findById(req.userId).select('name username');
  if (!actor) return res.status(401).json({ message: 'Session unavailable' });
  const parent = body.parentId ? await Comment.findOne({ _id: body.parentId, postId: post._id, deleted: false }) : null;
  if (body.parentId && !parent) return res.status(404).json({ message: 'Comment not found' });
  if (parent && !await interactionAllowed(req.userId!, parent.authorId)) return res.status(404).json({ message: 'Comment not found' });
  const comment = await Comment.create({ postId: post._id, authorId: req.userId, text: body.text, ...(parent ? { parentId: parent._id } : {}) });
  const recipient = parent?.authorId ?? post.authorId;
  await createNotification({ recipientId: recipient, actorId: actor._id, kind: parent ? 'reply' : 'comment', title: parent ? `${actor.name} replied to your comment` : `${actor.name} commented on your post`, body: body.text.slice(0, 140), targetId: post._id });
  await notifyMentions(body.text, actor._id, comment._id);
  res.status(201).json({ comment });
}));

featureApi.get('/search', auth, wrap(async (req, res) => {
  const raw = String(req.query.q ?? '').trim().slice(0, 100);
  if (!raw) return res.json({ people: [], posts: [], tags: [], institutions: [] });
  const { page, limit } = pageArgs(req);
  const term = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const allowed = await visibleAuthorIds(req.userId!, true);
  const [people, posts, tags, institutions] = await Promise.all([
    User.find({ active: true, 'privacy.showActivity': { $ne: false }, _id: { $in: await visibleAuthorIds(req.userId!, true) }, $or: [{ name: { $regex: term, $options: 'i' } }, { username: { $regex: term, $options: 'i' } }, { institution: { $regex: term, $options: 'i' } }] }).select('name username avatar institution bio followers following isPrivate').limit(limit),
    Post.find({ authorId: { $in: allowed }, deleted: false, text: { $regex: term, $options: 'i' } }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('authorId', 'name username avatar institution'),
    Hashtag.find({ name: { $regex: term.replace(/^#/, '').toLowerCase(), $options: 'i' } }).sort({ uses: -1, name: 1 }).limit(10),
    (await import('../models/index.js')).Institution.find({ active: true, $or: [{ name: { $regex: term, $options: 'i' } }, { officialName: { $regex: term, $options: 'i' } }, { abbreviation: { $regex: term, $options: 'i' } }] }).select('name abbreviation state category').limit(limit),
  ]);
  const safePosts = [];
  for (const post of posts) if (await canReadPost(req.userId!, post)) safePosts.push(postView(post, req.userId!));
  res.json({ people, posts: safePosts, tags, institutions, page, limit });
}));

featureApi.get('/hashtags/trending', optionalAuth, wrap(async (req, res) => {
  const since = new Date(Date.now() - 7 * 86400000);
  const authors = req.userId ? await visibleAuthorIds(req.userId, true) : await User.find({ active: true, isPrivate: false, 'privacy.showActivity': { $ne: false } }).distinct('_id');
  const items = await Post.aggregate([
    { $match: { authorId: { $in: authors }, deleted: false, createdAt: { $gte: since }, hashtags: { $exists: true, $ne: [] } } },
    { $lookup: { from: 'comments', let: { postId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$postId', '$$postId'] }, { $eq: ['$deleted', false] }] } } }, { $count: 'count' }], as: 'commentStats' } },
    { $unwind: '$hashtags' },
    { $addFields: { ageHours: { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 3600000] }, commentCount: { $ifNull: [{ $arrayElemAt: ['$commentStats.count', 0] }, 0] } } },
    { $addFields: { engagement: { $add: [{ $size: { $ifNull: ['$likes', []] } }, { $multiply: [{ $size: { $ifNull: ['$reposts', []] } }, 2] }, { $multiply: ['$commentCount', 1.5] }] } } },
    { $group: { _id: '$hashtags', uses: { $sum: 1 }, score: { $sum: { $divide: [{ $add: ['$engagement', 1] }, { $add: [1, { $divide: ['$ageHours', 24] }] }] } } } },
    { $sort: { score: -1, uses: -1 } }, { $limit: 20 }, { $project: { _id: 0, name: '$_id', uses: 1, score: 1 } },
  ]);
  res.json({ items });
}));
featureApi.get('/hashtags/:name/posts', optionalAuth, wrap(async (req, res) => {
  const name = decodeURIComponent(String(req.params.name)).replace(/^#/, '').normalize('NFKC').toLowerCase();
  const { page, limit } = pageArgs(req);
  const authors = req.userId ? await visibleAuthorIds(req.userId, true) : await User.find({ active: true, isPrivate: false, 'privacy.showActivity': { $ne: false } }).distinct('_id');
  const filter = { hashtags: name, authorId: { $in: authors }, deleted: false };
  const [items, total] = await Promise.all([Post.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('authorId', 'name username avatar institution'), Post.countDocuments(filter)]);
  const visible = [];
  for (const post of items) if (await canReadPost(req.userId ?? '', post)) visible.push(req.userId ? postView(post, req.userId) : post);
  res.json({ items: visible, page, limit, total });
}));

featureApi.get('/users/:id/followers', auth, wrap(async (req, res) => {
  const owner = await User.findById(String(req.params.id)).select('followers isPrivate privacy');
  if (!owner || !await canViewProfile(req.userId, owner) || String(owner._id) !== req.userId && owner.privacy?.showFollowers === false) return res.status(404).json({ message: 'Followers are unavailable.' });
  const { page, limit } = pageArgs(req);
  const items = await User.find({ _id: { $in: owner.followers }, active: true }).select('name username avatar institution').skip((page - 1) * limit).limit(limit);
  res.json({ items, total: owner.followers.length, page, limit });
}));
featureApi.get('/users/:id/following', auth, wrap(async (req, res) => {
  const owner = await User.findById(String(req.params.id)).select('following isPrivate privacy');
  if (!owner || !await canViewProfile(req.userId, owner) || String(owner._id) !== req.userId && owner.privacy?.showFollowing === false) return res.status(404).json({ message: 'Following list is unavailable.' });
  const { page, limit } = pageArgs(req);
  const items = await User.find({ _id: { $in: owner.following }, active: true }).select('name username avatar institution').skip((page - 1) * limit).limit(limit);
  res.json({ items, total: owner.following.length, page, limit });
}));

featureApi.get('/users/me/bookmarks', auth, wrap(async (req, res) => {
  const { page, limit } = pageArgs(req);
  const [items, total] = await Promise.all([
    Post.find({ bookmarks: req.userId, deleted: false }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('authorId', 'name username avatar institution campus'),
    Post.countDocuments({ bookmarks: req.userId, deleted: false }),
  ]);
  const visible = [];
  for (const post of items) if (await canReadPost(req.userId!, post)) visible.push(postView(post, req.userId!));
  res.json({ items: visible, page, limit, total });
}));

featureApi.post('/posts', auth, wrap(async (req, res) => {
  const body = z.object({ text: z.string().max(5000).default(''), media: postMediaSchema.optional(), anonymous: z.boolean().optional() }).strict().parse(req.body);
  const media = body.media ?? [];
  if (!body.text.trim() && !media.length) return res.status(400).json({ message: 'A post needs text or media.' });
  const ownedMedia = await normalizePostMedia(media, req.userId!);
  if (!ownedMedia) return res.status(400).json({ message: 'Upload every media attachment with your account before publishing.' });
  const hashtags = extractTags(body.text);
  const usernames = [...new Set((body.text.match(/@([a-zA-Z0-9_.]{3,24})/g) ?? []).map((name) => name.slice(1).toLowerCase()))];
  const [author, mentions] = await Promise.all([User.findById(req.userId).select('institutionId name username'), User.find({ username: { $in: usernames }, active: true }).select('_id')]);
  if (!author) return res.status(401).json({ message: 'Session is unavailable.' });
  const post = await Post.create({ authorId: author._id, text: body.text.trim(), media: ownedMedia, anonymous: body.anonymous ?? false, hashtags, mentions: mentions.map((user) => user._id), institutionId: author.institutionId, visibility: 'public' });
  await Promise.all(hashtags.map((name) => Hashtag.updateOne({ name }, { $inc: { uses: 1 }, $set: { lastUsedAt: new Date() } }, { upsert: true })));
  await notifyMentions(post.text, author._id, post._id);
  const result = await Post.findById(post._id).populate('authorId', 'name username avatar institution campus');
  res.status(201).json({ post: postView(result, req.userId!) });
}));

featureApi.get('/conversations', auth, wrap(async (req, res) => {
  const conversations = await Conversation.find({ members: req.userId, archivedBy: { $ne: req.userId } }).sort({ lastMessageAt: -1 }).populate('members', 'name username avatar institution isPrivate blocked');
  const results = [];
  for (const conversation of conversations) {
    const peers = conversation.members.filter((member: any) => String(member._id) !== req.userId);
    if (peers.some((peer: any) => (peer.blocked ?? []).some((x: unknown) => String(x) === req.userId))) continue;
    const blocked = await User.findById(req.userId).select('blocked');
    if (peers.some((peer: any) => blocked?.blocked.some((x: unknown) => String(x) === String(peer._id)))) continue;
    const unread = conversation.unreadBy.find((entry: any) => String(entry.userId) === req.userId)?.count ?? 0;
    results.push({ ...conversation.toObject(), unread });
  }
  res.json({ items: results });
}));

featureApi.post('/conversations', auth, wrap(async (req, res) => {
  const body = z.object({ memberIds: z.array(z.string().length(24)).min(1).max(99), group: z.boolean().optional(), title: z.string().trim().min(1).max(80).optional(), image: z.string().url().optional() }).strict().parse(req.body);
  const members = [...new Set([req.userId!, ...body.memberIds])];
  if (members.length !== body.memberIds.length + 1) return res.status(400).json({ message: 'Duplicate conversation members are not allowed.' });
  const users = await User.find({ _id: { $in: members }, active: true }).select('isPrivate followers blocked privacy institutionId');
  if (users.length !== members.length) return res.status(400).json({ message: 'One or more participants are unavailable.' });
  for (const peer of members.filter((member) => member !== req.userId)) if (!await canSendMessage(req.userId, peer)) return res.status(403).json({ message: 'A participant does not allow this conversation.' });
  const group = body.group ?? members.length > 2;
  if (!group && members.length !== 2) return res.status(400).json({ message: 'A direct conversation needs one other participant.' });
  let conversation: any = group ? null : await Conversation.findOne({ group: false, members: { $all: members, $size: members.length } });
  if (!conversation) conversation = await Conversation.create({ members, group, ...(group ? { title: body.title, image: body.image, ownerId: req.userId, admins: [req.userId] } : {}), unreadBy: members.map((userId) => ({ userId, count: 0 })), readCursors: members.map((userId) => ({ userId, readAt: new Date() })) });
  res.status(201).json({ conversation });
}));

const requireConversation = async (conversationId: string, userId: string) => id(conversationId) ? Conversation.findOne({ _id: conversationId, members: userId }) : null;
featureApi.get('/conversations/:id/messages', auth, wrap(async (req, res) => {
  const conversation = await requireConversation(String(req.params.id), req.userId!);
  if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
  const peers = conversation.members.filter((member: unknown) => String(member) !== req.userId);
  for (const peer of peers) if (!await canSendMessage(req.userId, peer)) return res.status(404).json({ message: 'Conversation not found' });
  const { page, limit } = pageArgs(req);
  const items = await Message.find({ conversationId: conversation._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('senderId', 'name username avatar').populate('forwardedFrom.senderId', 'name username');
  await Message.updateMany({ _id: { $in: items.map((m) => m._id) }, senderId: { $ne: req.userId } }, { $addToSet: { deliveredTo: req.userId } });
  res.json({ items: items.reverse(), page, limit });
}));
featureApi.post('/conversations/:id/messages', auth, wrap(async (req, res) => {
  const conversation = await requireConversation(String(req.params.id), req.userId!);
  if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
  const peers = conversation.members.filter((member: unknown) => String(member) !== req.userId);
  for (const peer of peers) if (!await canSendMessage(req.userId, peer)) return res.status(403).json({ message: 'A conversation participant has blocked you or does not accept messages.' });
  const body = z.object({ text: z.string().max(10000).optional(), replyTo: z.string().length(24).optional(), attachmentIds: z.array(z.string().min(1)).max(10).optional() }).strict().parse(req.body);
  if (!body.text?.trim() && !body.attachmentIds?.length) return res.status(400).json({ message: 'Message text or an attachment is required.' });
  if (body.replyTo && !await Message.exists({ _id: body.replyTo, conversationId: conversation._id })) return res.status(400).json({ message: 'Reply target is unavailable.' });
  const assets = body.attachmentIds?.length ? await MediaAsset.find({ publicId: { $in: body.attachmentIds }, ownerId: req.userId, $or: [{ conversationId: conversation._id }, { conversationId: { $exists: false } }] }) : [];
  if (assets.length !== (body.attachmentIds?.length ?? 0)) return res.status(400).json({ message: 'One or more attachments are unavailable.' });
  const attachments = assets.map((asset) => ({ url: asset.url, publicId: asset.publicId, resourceType: asset.resourceType, format: asset.format, bytes: asset.bytes }));
  const kind = assets.some((asset) => asset.resourceType === 'video') ? 'video' : assets.length ? assets[0]!.resourceType === 'raw' ? 'document' : 'image' : 'text';
  const message = await Message.create({ conversationId: conversation._id, senderId: req.userId, ...(body.text?.trim() ? { text: body.text.trim() } : {}), kind, attachments, ...(body.replyTo ? { replyTo: body.replyTo } : {}) });
  if (assets.length) await MediaAsset.updateMany({ publicId: { $in: assets.map((asset) => asset.publicId) }, ownerId: req.userId }, { $set: { conversationId: conversation._id, attachedAt: new Date() } });
  conversation.lastMessageAt = new Date();
  for (const member of conversation.members) {
    const entry: any = conversation.unreadBy.find((item: any) => String(item.userId) === String(member));
    if (String(member) === req.userId) { if (entry) entry.count = 0; continue; }
    if (entry) entry.count += 1; else conversation.unreadBy.push({ userId: member, count: 1 } as any);
  }
  await conversation.save();
  chatEvents.emit('message', { conversationId: String(conversation._id), message: message.toObject() });
  const actor = await User.findById(req.userId).select('name username');
  if (actor) await Promise.all(peers.map((recipientId: unknown) => createNotification({ recipientId, actorId: actor._id, kind: 'message', title: `${actor.name} sent you a message`, body: (body.text ?? 'Sent an attachment').slice(0, 140), targetId: conversation._id, conversationId: conversation._id })));
  res.status(201).json({ message });
}));
featureApi.patch('/conversations/:id/read', auth, wrap(async (req, res) => {
  const conversation = await requireConversation(String(req.params.id), req.userId!);
  if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
  const now = new Date();
  const cursor: any = conversation.readCursors.find((x: any) => String(x.userId) === req.userId);
  if (cursor) cursor.readAt = now; else conversation.readCursors.push({ userId: req.userId as any, readAt: now } as any);
  const unread: any = conversation.unreadBy.find((x: any) => String(x.userId) === req.userId);
  if (unread) unread.count = 0; else conversation.unreadBy.push({ userId: req.userId as any, count: 0 } as any);
  await conversation.save();
  const account = await User.findById(req.userId).select('privacy.showReadReceipts');
  const changed = account?.privacy?.showReadReceipts === false ? { modifiedCount: 0 } : await Message.updateMany({ conversationId: conversation._id, senderId: { $ne: req.userId }, readBy: { $ne: req.userId } }, { $addToSet: { readBy: req.userId } });
  if (account?.privacy?.showReadReceipts !== false) chatEvents.emit('read', { conversationId: String(conversation._id), userId: req.userId });
  res.json({ ok: true, modified: changed.modifiedCount, receiptsVisible: account?.privacy?.showReadReceipts !== false });
}));

featureApi.patch('/conversations/:id/group', auth, wrap(async (req, res) => {
  const body = z.object({ title: z.string().trim().min(1).max(80).optional(), image: z.string().url().optional() }).strict().parse(req.body);
  const conversation = await Conversation.findOne({ _id: String(req.params.id), group: true, members: req.userId, $or: [{ ownerId: req.userId }, { admins: req.userId }] });
  if (!conversation) return res.status(404).json({ message: 'Group or administrator permission not found.' });
  Object.assign(conversation, body);
  await conversation.save();
  chatEvents.emit('group:update', { conversationId: String(conversation._id), title: conversation.title, image: conversation.image });
  res.json({ conversation });
}));
featureApi.post('/conversations/:id/members', auth, wrap(async (req, res) => {
  const { userIds } = z.object({ userIds: z.array(z.string().length(24)).min(1).max(20) }).strict().parse(req.body);
  const conversation = await Conversation.findOne({ _id: String(req.params.id), group: true, members: req.userId, $or: [{ ownerId: req.userId }, { admins: req.userId }] });
  if (!conversation) return res.status(404).json({ message: 'Group or administrator permission not found.' });
  const newIds = [...new Set(userIds)].filter((userId) => !conversation.members.some((m: unknown) => String(m) === userId));
  if (conversation.members.length + newIds.length > 100) return res.status(400).json({ message: 'Groups can contain at most 100 members.' });
  const users = await User.find({ _id: { $in: newIds }, active: true }).select('isPrivate followers blocked');
  if (users.length !== newIds.length) return res.status(400).json({ message: 'One or more accounts are unavailable.' });
  for (const newId of newIds) if (!await canSendMessage(req.userId, newId)) return res.status(403).json({ message: 'A participant does not allow this group invitation.' });
  conversation.members.push(...newIds as any);
  conversation.unreadBy.push(...newIds.map((userId) => ({ userId, count: 0 })) as any);
  conversation.readCursors.push(...newIds.map((userId) => ({ userId, readAt: new Date() })) as any);
  await conversation.save();
  res.json({ conversation });
}));
featureApi.delete('/conversations/:id/members/:memberId', auth, wrap(async (req, res) => {
  const conversation = await Conversation.findOne({ _id: String(req.params.id), group: true, members: req.userId });
  if (!conversation) return res.status(404).json({ message: 'Group not found.' });
  const isAdmin = String(conversation.ownerId) === req.userId || conversation.admins.some((x: unknown) => String(x) === req.userId);
  const leaving = String(req.params.memberId) === req.userId;
  if (!isAdmin && !leaving) return res.status(403).json({ message: 'Administrator access required.' });
  if (!id(String(req.params.memberId)) || String(conversation.ownerId) === String(req.params.memberId)) return res.status(400).json({ message: 'Transfer ownership before removing the group owner.' });
  conversation.members = conversation.members.filter((x: unknown) => String(x) !== String(req.params.memberId)) as any;
  conversation.admins = conversation.admins.filter((x: unknown) => String(x) !== String(req.params.memberId)) as any;
  conversation.unreadBy = conversation.unreadBy.filter((x: any) => String(x.userId) !== String(req.params.memberId)) as any;
  conversation.readCursors = conversation.readCursors.filter((x: any) => String(x.userId) !== String(req.params.memberId)) as any;
  await conversation.save();
  chatEvents.emit('group:member-removed', { conversationId: String(conversation._id), userId: String(req.params.memberId) });
  res.json({ ok: true });
}));
featureApi.post('/conversations/:id/transfer-ownership', auth, wrap(async (req, res) => {
  const { userId } = z.object({ userId: z.string().length(24) }).parse(req.body);
  const conversation = await Conversation.findOne({ _id: String(req.params.id), group: true, ownerId: req.userId, members: userId });
  if (!conversation) return res.status(404).json({ message: 'Group owner or member not found.' });
  conversation.ownerId = userId as any;
  if (!conversation.admins.some((x: unknown) => String(x) === userId)) conversation.admins.push(userId as any);
  await conversation.save();
  res.json({ conversation });
}));
featureApi.post('/conversations/:id/admins/:memberId', auth, wrap(async (req, res) => {
  const conversation = await Conversation.findOne({ _id: String(req.params.id), group: true, ownerId: req.userId, members: String(req.params.memberId) });
  if (!conversation) return res.status(404).json({ message: 'Group owner or member not found.' });
  if (!conversation.admins.some((x: unknown) => String(x) === String(req.params.memberId))) conversation.admins.push(String(req.params.memberId) as any);
  await conversation.save();
  res.json({ ok: true });
}));
featureApi.delete('/conversations/:id/admins/:memberId', auth, wrap(async (req, res) => {
  const conversation = await Conversation.findOne({ _id: String(req.params.id), group: true, ownerId: req.userId });
  if (!conversation) return res.status(404).json({ message: 'Group owner not found.' });
  conversation.admins = conversation.admins.filter((x: unknown) => String(x) !== String(req.params.memberId)) as any;
  await conversation.save();
  res.json({ ok: true });
}));

featureApi.post('/messages/:id/forward', auth, wrap(async (req, res) => {
  const { conversationIds } = z.object({ conversationIds: z.array(z.string().length(24)).min(1).max(10), text: z.string().max(2000).optional() }).strict().parse(req.body);
  const source = await Message.findById(String(req.params.id)).populate('senderId', 'name username');
  if (!source || source.deleted) return res.status(404).json({ message: 'Message not found.' });
  const sourceConversation = await Conversation.findOne({ _id: source.conversationId, members: req.userId });
  if (!sourceConversation) return res.status(404).json({ message: 'Message not found.' });
  const recipients = await Conversation.find({ _id: { $in: conversationIds }, members: req.userId });
  if (recipients.length !== new Set(conversationIds).size) return res.status(404).json({ message: 'One or more destination conversations are unavailable.' });
  for (const conversation of recipients) for (const member of conversation.members) if (String(member) !== req.userId && !await canSendMessage(req.userId, member)) return res.status(403).json({ message: 'A destination participant does not accept this message.' });
  const sender: any = source.senderId;
  const forwarded = await Promise.all(recipients.map(async (conversation) => {
    const message = await Message.create({ conversationId: conversation._id, senderId: req.userId, text: req.body.text?.trim() || source.text, kind: source.kind, attachments: source.attachments, forwardedFrom: { messageId: source._id, senderId: sender._id, senderName: sender.name } });
    conversation.lastMessageAt = new Date();
    for (const member of conversation.members) { const unread: any = conversation.unreadBy.find((x: any) => String(x.userId) === String(member)); if (String(member) !== req.userId) { if (unread) unread.count++; else conversation.unreadBy.push({ userId: member, count: 1 } as any); } }
    await conversation.save();
    chatEvents.emit('message', { conversationId: String(conversation._id), message: message.toObject() });
    const actor = await User.findById(req.userId).select('name username');
    if (actor) await Promise.all(conversation.members.filter((member: unknown) => String(member) !== req.userId).map((recipientId: unknown) => createNotification({ recipientId, actorId: actor._id, kind: 'message', title: `${actor.name} forwarded you a message`, body: (message.text ?? 'Forwarded an attachment').slice(0, 140), targetId: conversation._id, conversationId: conversation._id })));
    return message;
  }));
  res.status(201).json({ messages: forwarded });
}));

featureApi.patch('/messages/:id', auth, wrap(async (req, res) => {
  const text = z.string().min(1).max(10000).parse(req.body.text);
  const message = await Message.findOneAndUpdate({ _id: String(req.params.id), senderId: req.userId, deleted: false }, { $set: { text, editedAt: new Date() } }, { new: true });
  if (!message || !await Conversation.exists({ _id: message.conversationId, members: req.userId })) return res.status(404).json({ message: 'Message not found.' });
  chatEvents.emit('message:edited', { conversationId: String(message.conversationId), message });
  res.json({ message });
}));
featureApi.delete('/messages/:id', auth, wrap(async (req, res) => {
  const message = await Message.findOneAndUpdate({ _id: String(req.params.id), senderId: req.userId, deleted: false }, { $set: { deleted: true, text: '', attachments: [] } }, { new: true });
  if (!message || !await Conversation.exists({ _id: message.conversationId, members: req.userId })) return res.status(404).json({ message: 'Message not found.' });
  chatEvents.emit('message:deleted', { conversationId: String(message.conversationId), messageId: String(message._id) });
  res.json({ ok: true });
}));

