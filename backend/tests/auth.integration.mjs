import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

let app;
let mongoose;
let User;
let RefreshToken;
let Post;
let server;
let baseUrl;
let institution;
let createdUserId;
let createdPostId;
let username;
let email;
const password = `Campus-${randomBytes(18).toString('base64url')}9`;
const cookieFrom = (response) => response.headers.getSetCookie().find((value) => value.startsWith('refreshToken='))?.split(';', 1)[0];
const registerBody = () => ({ name: 'Integration Test Student', username, email, password, institutionId: String(institution._id), terms: true });

before(async () => {
  const [{ app: application }, db, models] = await Promise.all([
    import('../dist/app.js'),
    import('../dist/config/database.js'),
    import('../dist/models/index.js'),
  ]);
  app = application;
  mongoose = (await import('mongoose')).default;
  User = models.User;
  RefreshToken = models.RefreshToken;
  Post = models.Post;
  await db.connectDatabase();
  institution = await models.Institution.findOne({ active: true }).select('_id').lean();
  assert.ok(institution, 'Seed an active institution before running this integration test.');
  username = `it_${randomBytes(6).toString('hex')}`;
  email = `${username}@example.invalid`;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (createdUserId) {
    if (createdPostId) await Post.deleteOne({ _id: createdPostId, authorId: createdUserId });
    await RefreshToken.deleteMany({ userId: createdUserId });
    await User.deleteOne({ _id: createdUserId, username });
  }
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (mongoose?.connection.readyState) await mongoose.disconnect();
});

test('MongoDB-backed registration, authentication, refresh rotation and logout', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).data.mongodb, 'connected');

  const registration = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(registerBody()) });
  assert.equal(registration.status, 201);
  let body = await registration.json();
  createdUserId = body.user.id;
  assert.ok(body.accessToken);
  const stored = await User.findById(createdUserId).select('+passwordHash');
  assert.ok(stored.passwordHash !== password);
  assert.equal(await bcrypt.compare(password, stored.passwordHash), true);

  const duplicateEmail = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...registerBody(), username: `${username}_other` }) });
  assert.equal(duplicateEmail.status, 409);
  const duplicateUsername = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...registerBody(), email: `other_${email}` }) });
  assert.equal(duplicateUsername.status, 409);
  const invalidRegistration = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(invalidRegistration.status, 400);

  const invalidLogin = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: username, password: 'wrong-password' }) });
  assert.equal(invalidLogin.status, 401);
  const login = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: username, password }) });
  assert.equal(login.status, 200);
  body = await login.json();
  const originalCookie = cookieFrom(login);
  assert.ok(originalCookie);

  const protectedResponse = await fetch(`${baseUrl}/auth/me`, { headers: { authorization: `Bearer ${body.accessToken}` } });
  assert.equal(protectedResponse.status, 200);
  assert.equal((await protectedResponse.json()).user.username, username);

  const fixturePost = await Post.create({ authorId: createdUserId, text: `C++ campus test ${username}`, hashtags: [] });
  createdPostId = fixturePost.id;
  const search = await fetch(`${baseUrl}/search?q=${encodeURIComponent('C++')}`, { headers: { authorization: `Bearer ${body.accessToken}` } });
  assert.equal(search.status, 200);
  assert.ok((await search.json()).posts.some((post) => post._id === createdPostId));

  const refresh = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers: { cookie: originalCookie } });
  assert.equal(refresh.status, 200);
  const refreshedBody = await refresh.json();
  const rotatedCookie = cookieFrom(refresh);
  assert.ok(refreshedBody.accessToken);
  assert.ok(rotatedCookie);
  const replay = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers: { cookie: originalCookie } });
  assert.equal(replay.status, 401);

  const logout = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { cookie: rotatedCookie } });
  assert.equal(logout.status, 200);
  const afterLogout = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers: { cookie: rotatedCookie } });
  assert.equal(afterLogout.status, 401);

  await User.updateOne({ _id: createdUserId }, { $set: { active: false } });
  const inactiveLogin = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: username, password }) });
  assert.equal(inactiveLogin.status, 401);
  const inactiveSession = await fetch(`${baseUrl}/auth/me`, { headers: { authorization: `Bearer ${refreshedBody.accessToken}` } });
  assert.equal(inactiveSession.status, 401);
  await User.updateOne({ _id: createdUserId }, { $set: { active: true } });
});
