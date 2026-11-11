import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { io } from 'socket.io-client';

const origin = process.env.CAMPUSLAUGH_API_ORIGIN ?? 'http://127.0.0.1:5000';
const created = [];
const sockets = [];
let mongoose;
let User;
let RefreshToken;
let Conversation;
let Message;
let Notification;
let institution;

const waitFor = (socket, event, timeout = 6000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
  socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
});
const emitAck = (socket, event, payload, timeout = 6000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event} acknowledgement`)), timeout);
  socket.emit(event, payload, (result) => { clearTimeout(timer); resolve(result); });
});

before(async () => {
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200, 'Start the local backend before running this suite.');
  assert.equal((await health.json()).data.mongodb, 'connected');
  const [{ connectDatabase }, models] = await Promise.all([import('../dist/config/database.js'), import('../dist/models/index.js')]);
  ({ User, RefreshToken, Conversation, Message, Notification } = models);
  await connectDatabase();
  mongoose = (await import('mongoose')).default;
  institution = await models.Institution.findOne({ active: true }).select('_id').lean();
  assert.ok(institution, 'Seed an active institution before running this suite.');
});

after(async () => {
  for (const socket of sockets) socket.disconnect();
  if (!mongoose?.connection.readyState) return;
  const ids = created.map((user) => user.id);
  if (ids.length) {
    const conversations = await Conversation.find({ members: { $in: ids } }).distinct('_id');
    await Message.deleteMany({ conversationId: { $in: conversations } });
    await Conversation.deleteMany({ _id: { $in: conversations } });
    await Notification.deleteMany({ $or: [{ recipientId: { $in: ids } }, { actorId: { $in: ids } }] });
    await RefreshToken.deleteMany({ userId: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids }, username: { $in: created.map((user) => user.username) } });
  }
  await mongoose.disconnect();
});

test('two accounts exchange persistent Socket.IO messages with membership enforcement', async () => {
  const nonce = randomBytes(6).toString('hex');
  const password = `Local-${nonce}-Pass9`;
  const register = async (suffix) => {
    const username = `chat_${nonce}_${suffix}`;
    const response = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `Local Chat ${suffix}`,
        username,
        email: `${username}@example.com`,
        password,
        institutionId: String(institution._id),
        terms: true,
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 201, JSON.stringify(body));
    created.push({ id: body.user.id, username });
    return { ...body, username };
  };

  const alice = await register('alice');
  const bob = await register('bob');
  const outsider = await register('out');
  const conversationResponse = await fetch(`${origin}/api/conversations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${alice.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ memberIds: [bob.user.id] }),
  });
  assert.equal(conversationResponse.status, 201);
  const { conversation } = await conversationResponse.json();

  const connect = (token) => {
    const socket = io(origin, { auth: { token }, transports: ['websocket'], timeout: 6000 });
    sockets.push(socket);
    return socket;
  };
  const aliceSocket = connect(alice.accessToken);
  const bobSocket = connect(bob.accessToken);
  const outsiderSocket = connect(outsider.accessToken);
  await Promise.all([aliceSocket, bobSocket, outsiderSocket].map((socket) => waitFor(socket, 'connect')));

  const aliceJoin = await emitAck(aliceSocket, 'conversation:join', conversation._id);
  const bobJoin = await emitAck(bobSocket, 'conversation:join', conversation._id);
  const outsiderJoin = await emitAck(outsiderSocket, 'conversation:join', conversation._id);
  assert.deepEqual(aliceJoin, { ok: true });
  assert.deepEqual(bobJoin, { ok: true });
  assert.equal(outsiderJoin.ok, false);

  const incoming = waitFor(bobSocket, 'message:new');
  const sent = await emitAck(aliceSocket, 'message:send', { conversationId: conversation._id, text: `local socket ${nonce}` });
  assert.ok(sent.message?._id);
  const delivered = await incoming;
  assert.equal(String(delivered._id), String(sent.message._id));
  assert.equal(delivered.text, `local socket ${nonce}`);

  const typing = waitFor(aliceSocket, 'typing');
  bobSocket.emit('typing', { conversationId: conversation._id, active: true });
  assert.equal((await typing).active, true);

  const readReceipt = waitFor(aliceSocket, 'message:read');
  const read = await emitAck(bobSocket, 'message:read', { conversationId: conversation._id, messageId: sent.message._id });
  assert.deepEqual(read, { ok: true });
  assert.equal((await readReceipt).messageId, sent.message._id);

  const historyResponse = await fetch(`${origin}/api/conversations/${conversation._id}/messages`, { headers: { authorization: `Bearer ${bob.accessToken}` } });
  assert.equal(historyResponse.status, 200);
  assert.ok((await historyResponse.json()).items.some((message) => String(message._id) === String(sent.message._id)));

  const groupResponse = await fetch(`${origin}/api/conversations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${alice.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ memberIds: [bob.user.id], group: true, title: 'Local test group' }),
  });
  assert.equal(groupResponse.status, 201);
  assert.equal((await groupResponse.json()).conversation.group, true);
});
