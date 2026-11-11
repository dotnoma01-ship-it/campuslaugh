import http from 'node:http';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';
import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { Conversation, Message, User } from './models/index.js';
import { notificationEvents, createNotification } from './utils/notificationEvents.js';
import { chatEvents } from './utils/chatEvents.js';
import { canSendMessage, usersBlockEachOther } from './utils/accountPolicy.js';

const objectId = /^[a-f\d]{24}$/i;
const server = http.createServer(app);
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
const io = new Server(server, {
  cors: { origin: env.frontend, credentials: true },
  maxHttpBufferSize: 1e6,
});

notificationEvents.on('created', ({ recipientId, notification }: { recipientId: string; notification: unknown }) => {
  io.to(`user:${recipientId}`).emit('notification:new', notification);
});
chatEvents.on('message', ({ conversationId, message }: { conversationId: string; message: unknown }) => io.to(`conversation:${conversationId}`).emit('message:new', message));
chatEvents.on('read', (payload: { conversationId: string; userId: string }) => io.to(`conversation:${payload.conversationId}`).emit('message:read-all', payload));
chatEvents.on('group:update', (payload: { conversationId: string }) => io.to(`conversation:${payload.conversationId}`).emit('group:update', payload));
chatEvents.on('group:member-removed', (payload: { conversationId: string; userId: string }) => io.to(`conversation:${payload.conversationId}`).emit('group:member-removed', payload));
chatEvents.on('account:deleted', ({ userId }: { userId: string }) => { io.in(`user:${userId}`).disconnectSockets(true); });
async function broadcastPresence(userId: string, online: boolean) {
  const conversations = await Conversation.find({ members: userId }).select('members').lean();
  const peers = new Set(conversations.flatMap((conversation) => conversation.members.map(String)).filter((id) => id !== userId));
  for (const peer of peers) if (!await usersBlockEachOther(userId, peer)) io.to(`user:${peer}`).emit(online ? 'presence:online' : 'presence:offline', { userId });
}
chatEvents.on('presence:privacy', ({ userId, visible }: { userId: string; visible: boolean }) => { void broadcastPresence(userId, visible); });

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') throw new Error('Missing token');
    const claims = jwt.verify(token, env.accessSecret) as { sub?: string; role?: string; ver?: number };
    if (!claims.sub || !objectId.test(claims.sub)) throw new Error('Invalid token subject');
    const user = await User.findById(claims.sub).select('active tokenVersion privacy.showOnlineStatus');
    if (!user?.active) throw new Error('Account is unavailable');
    if ((claims.ver ?? 0) !== (user.tokenVersion ?? 0)) throw new Error('Session revoked');
    socket.data.userId = claims.sub;
    socket.data.showOnlineStatus = user.privacy?.showOnlineStatus !== false;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket: Socket) => {
  const userId = socket.data.userId as string;
  socket.join(`user:${userId}`);
  void (async () => {
    try {
      if (socket.data.showOnlineStatus) await broadcastPresence(userId, true);
    } catch { /* Presence is best effort. */ }
  })();

  socket.on('conversation:join', async (conversationId: unknown, ack?: (result: { ok: boolean; message?: string }) => void) => {
    if (typeof conversationId !== 'string' || !objectId.test(conversationId)) return ack?.({ ok: false, message: 'Invalid conversation.' });
    try {
      const member = await Conversation.exists({ _id: conversationId, members: userId });
      if (!member) return ack?.({ ok: false, message: 'Conversation access denied.' });
      const conversation = await Conversation.findById(conversationId).select('members');
      for (const peer of conversation?.members ?? []) if (String(peer) !== userId && !await canSendMessage(userId, peer)) return ack?.({ ok: false, message: 'Conversation access denied.' });
      await socket.join(`conversation:${conversationId}`);
      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false, message: 'Could not join conversation.' });
    }
  });

  socket.on('typing', async (payload: unknown) => {
    if (!payload || typeof payload !== 'object') return;
    const { conversationId, active } = payload as { conversationId?: unknown; active?: unknown };
    if (typeof conversationId !== 'string' || !objectId.test(conversationId) || typeof active !== 'boolean') return;
    try {
      const member = await Conversation.exists({ _id: conversationId, members: userId });
      if (member) {
        const conversation = await Conversation.findById(conversationId).select('members');
        let allowed = true;
        for (const peer of conversation?.members ?? []) if (String(peer) !== userId && !await canSendMessage(userId, peer)) allowed = false;
        if (allowed) socket.to(`conversation:${conversationId}`).emit('typing', { conversationId, userId, active });
      }
    } catch { /* A transient typing update can be dropped safely. */ }
  });

  socket.on('message:send', async (payload: unknown, ack?: (result: { message?: unknown; error?: string }) => void) => {
    if (!payload || typeof payload !== 'object') return ack?.({ error: 'Invalid message.' });
    const { conversationId, text, replyTo } = payload as { conversationId?: unknown; text?: unknown; replyTo?: unknown };
    if (typeof conversationId !== 'string' || !objectId.test(conversationId) || typeof text !== 'string' || !text.trim() || text.length > 10_000) return ack?.({ error: 'Message text is required and must be under 10,000 characters.' });
    try {
      const conversation = await Conversation.findOne({ _id: conversationId, members: userId });
      if (!conversation) return ack?.({ error: 'Conversation access denied.' });
      for (const peer of conversation.members) if (String(peer) !== userId && !await canSendMessage(userId, peer)) return ack?.({ error: 'A participant does not accept messages.' });
      if (replyTo !== undefined && (typeof replyTo !== 'string' || !objectId.test(replyTo) || !await Message.exists({ _id: replyTo, conversationId: conversation._id }))) return ack?.({ error: 'Reply target is unavailable.' });
      const message = await Message.create({ conversationId: conversation._id, senderId: userId, text: text.trim(), ...(replyTo ? { replyTo } : {}) });
      conversation.lastMessageAt = new Date();
      for (const member of conversation.members) {
        let unread: any = conversation.unreadBy.find((item: any) => String(item.userId) === String(member));
        if (!unread) { conversation.unreadBy.push({ userId: member, count: 0 } as any); unread = conversation.unreadBy[conversation.unreadBy.length - 1]; }
        if (String(member) === userId) unread.count = 0; else unread.count += 1;
      }
      await conversation.save();
      io.to(`conversation:${conversationId}`).emit('message:new', message);
      const actor = await User.findById(userId).select('name username');
      if (actor) {
        const recipients = conversation.members.filter((member) => String(member) !== userId);
        await Promise.all(recipients.map((recipientId) => createNotification({
          recipientId,
          actorId: actor._id,
          kind: 'message',
          title: `${actor.name} sent you a message`,
          body: text.trim().slice(0, 140),
          targetId: conversation._id,
          conversationId: conversation._id,
        })));
      }
      ack?.({ message });
    } catch {
      ack?.({ error: 'Message could not be sent.' });
    }
  });

  socket.on('message:read', async (payload: unknown, ack?: (result: { ok: boolean }) => void) => {
    if (!payload || typeof payload !== 'object') return ack?.({ ok: false });
    const { conversationId, messageId } = payload as { conversationId?: unknown; messageId?: unknown };
    if (typeof conversationId !== 'string' || typeof messageId !== 'string' || !objectId.test(conversationId) || !objectId.test(messageId)) return ack?.({ ok: false });
    try {
      const member = await Conversation.exists({ _id: conversationId, members: userId });
      if (!member) return ack?.({ ok: false });
      const conversation = await Conversation.findById(conversationId).select('members unreadBy');
      if (!conversation) return ack?.({ ok: false });
      for (const peer of conversation.members) if (String(peer) !== userId && !await canSendMessage(userId, peer)) return ack?.({ ok: false });
      const account = await User.findById(userId).select('privacy.showReadReceipts');
      const updated = account?.privacy?.showReadReceipts === false ? null : await Message.findOneAndUpdate({ _id: messageId, conversationId, readBy: { $ne: userId } }, { $addToSet: { readBy: userId } }, { new: true }).select('_id');
      if (account?.privacy?.showReadReceipts !== false && !updated) {
        const alreadyRead = await Message.exists({ _id: messageId, conversationId, readBy: userId });
        if (!alreadyRead) return ack?.({ ok: false });
        return ack?.({ ok: true });
      }
      if (account?.privacy?.showReadReceipts === false && !await Message.exists({ _id: messageId, conversationId })) return ack?.({ ok: false });
      const unread: any = conversation.unreadBy.find((item: any) => String(item.userId) === userId);
      if (unread) { unread.count = Math.max(0, unread.count - 1); await conversation.save(); }
      if (account?.privacy?.showReadReceipts !== false) socket.to(`conversation:${conversationId}`).emit('message:read', { conversationId, messageId, userId });
      ack?.({ ok: true });
    } catch { ack?.({ ok: false }); }
  });

  socket.on('disconnect', async () => {
    try {
      const remaining = await io.in(`user:${userId}`).fetchSockets();
      if (remaining.length) return;
      if (socket.data.showOnlineStatus) await broadcastPresence(userId, false);
    } catch { /* Presence is best effort. */ }
  });
});

try {
  await connectDatabase();
  server.listen(env.port, () => console.info(`CampusLaugh API listening on port ${env.port}`));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'CampusLaugh API startup failed.');
  process.exitCode = 1;
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(JSON.stringify({ event: 'shutdown_started', signal }));
  const forceExit = setTimeout(() => process.exit(1), 15_000);
  forceExit.unref();
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await (await import('mongoose')).default.disconnect().catch(() => undefined);
  clearTimeout(forceExit);
  console.info(JSON.stringify({ event: 'shutdown_complete', signal }));
}
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });
