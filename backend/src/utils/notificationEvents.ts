import { EventEmitter } from 'node:events';
import { Notification, User } from '../models/index.js';
import { notificationPreferenceFor, usersBlockEachOther } from './accountPolicy.js';

export const notificationEvents = new EventEmitter();
notificationEvents.setMaxListeners(0);

export async function createNotification(input: {
  recipientId: unknown;
  actorId?: unknown;
  kind: string;
  title: string;
  body: string;
  targetId?: unknown;
  conversationId?: unknown;
}) {
  if (String(input.recipientId) === String(input.actorId)) return null;
  const recipient = await User.findById(input.recipientId).select('notificationPreferences muted');
  if (!recipient || recipient.notificationPreferences?.[notificationPreferenceFor(input.kind)] === false) return null;
  if (input.actorId && (recipient.muted?.some((id: unknown) => String(id) === String(input.actorId)) || await usersBlockEachOther(input.recipientId, input.actorId))) return null;
  const notification = await Notification.create(input);
  const actor = input.actorId ? await User.findById(input.actorId).select('name username avatar').lean() : null;
  notificationEvents.emit('created', {
    recipientId: String(input.recipientId),
    notification: { ...notification.toObject(), ...(actor ? { actorId: actor } : {}) },
  });
  return notification;
}
