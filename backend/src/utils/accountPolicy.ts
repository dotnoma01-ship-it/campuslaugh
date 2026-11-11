import { User } from '../models/index.js';

export async function usersBlockEachOther(firstId: unknown, secondId: unknown) {
  const [firstBlocksSecond, secondBlocksFirst] = await Promise.all([
    User.exists({ _id: firstId, blocked: secondId }),
    User.exists({ _id: secondId, blocked: firstId }),
  ]);
  return Boolean(firstBlocksSecond || secondBlocksFirst);
}

export async function canViewProfile(viewerId: unknown, target: any) {
  if (!target?.active) return false;
  if (viewerId && String(viewerId) === String(target._id)) return true;
  if (!viewerId) return !target.isPrivate;
  if (await usersBlockEachOther(viewerId, target._id)) return false;
  if (!target.isPrivate) return true;
  return target.followers?.some((id: unknown) => String(id) === String(viewerId)) ?? false;
}

export async function canSendMessage(senderId: unknown, recipientId: unknown) {
  if (String(senderId) === String(recipientId) || await usersBlockEachOther(senderId, recipientId)) return false;
  const [sender, recipient] = await Promise.all([
    User.findById(senderId).select('active institutionId'),
    User.findById(recipientId).select('active institutionId following privacy'),
  ]);
  if (!sender?.active || !recipient?.active) return false;
  const policy = recipient.privacy?.whoCanMessage ?? 'everyone';
  if (policy === 'following' && !recipient.following.some((id: unknown) => String(id) === String(senderId))) return false;
  if (policy === 'campus' && String(sender.institutionId ?? '') !== String(recipient.institutionId ?? '')) return false;
  return true;
}

export function notificationPreferenceFor(kind: string) {
  if (kind === 'like') return 'likes';
  if (kind === 'comment') return 'comments';
  if (kind === 'reply') return 'replies';
  if (kind === 'follow') return 'followers';
  if (kind === 'mention') return 'mentions';
  if (kind === 'repost') return 'reposts';
  if (kind === 'message') return 'messages';
  if (kind === 'campus') return 'announcements';
  return 'administrative';
}
