import http from 'node:http';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';
import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { Conversation, Message, User } from './models/index.js';

const objectId = /^[a-f\d]{24}$/i;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.frontend, credentials: true },
  maxHttpBufferSize: 1e6,
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') throw new Error('Missing token');
    const claims = jwt.verify(token, env.accessSecret) as { sub?: string; role?: string };
    if (!claims.sub || !objectId.test(claims.sub)) throw new Error('Invalid token subject');
    const user = await User.findById(claims.sub).select('active');
    if (!user?.active) throw new Error('Account is unavailable');
    socket.data.userId = claims.sub;
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
      const conversations = await Conversation.find({ members: userId }).select('members').lean();
      const peers = new Set(conversations.flatMap((conversation) => conversation.members.map(String)).filter((id) => id !== userId));
      for (const id of peers) io.to(`user:${id}`).emit('presence:online', { userId });
    } catch { /* Presence is best effort. */ }
  })();

  socket.on('conversation:join', async (conversationId: unknown, ack?: (result: { ok: boolean; message?: string }) => void) => {
    if (typeof conversationId !== 'string' || !objectId.test(conversationId)) return ack?.({ ok: false, message: 'Invalid conversation.' });
    try {
      const member = await Conversation.exists({ _id: conversationId, members: userId });
      if (!member) return ack?.({ ok: false, message: 'Conversation access denied.' });
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
      if (member) socket.to(`conversation:${conversationId}`).emit('typing', { conversationId, userId, active });
    } catch { /* A transient typing update can be dropped safely. */ }
  });

  socket.on('message:send', async (payload: unknown, ack?: (result: { message?: unknown; error?: string }) => void) => {
    if (!payload || typeof payload !== 'object') return ack?.({ error: 'Invalid message.' });
    const { conversationId, text, replyTo } = payload as { conversationId?: unknown; text?: unknown; replyTo?: unknown };
    if (typeof conversationId !== 'string' || !objectId.test(conversationId) || typeof text !== 'string' || !text.trim() || text.length > 10_000) return ack?.({ error: 'Message text is required and must be under 10,000 characters.' });
    try {
      const conversation = await Conversation.findOne({ _id: conversationId, members: userId });
      if (!conversation) return ack?.({ error: 'Conversation access denied.' });
      if (replyTo !== undefined && (typeof replyTo !== 'string' || !objectId.test(replyTo) || !await Message.exists({ _id: replyTo, conversationId: conversation._id }))) return ack?.({ error: 'Reply target is unavailable.' });
      const message = await Message.create({ conversationId: conversation._id, senderId: userId, text: text.trim(), ...(replyTo ? { replyTo } : {}) });
      conversation.lastMessageAt = new Date();
      await conversation.save();
      io.to(`conversation:${conversationId}`).emit('message:new', message);
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
      const updated = await Message.findOneAndUpdate({ _id: messageId, conversationId }, { $addToSet: { readBy: userId } }, { new: true }).select('_id');
      if (!updated) return ack?.({ ok: false });
      socket.to(`conversation:${conversationId}`).emit('message:read', { conversationId, messageId, userId });
      ack?.({ ok: true });
    } catch { ack?.({ ok: false }); }
  });

  socket.on('disconnect', async () => {
    try {
      const remaining = await io.in(`user:${userId}`).fetchSockets();
      if (remaining.length) return;
      const conversations = await Conversation.find({ members: userId }).select('members').lean();
      const others = new Set(conversations.flatMap((c) => c.members.map(String)).filter((id) => id !== userId));
      for (const id of others) io.to(`user:${id}`).emit('presence:offline', { userId });
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
