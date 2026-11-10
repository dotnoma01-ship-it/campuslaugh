import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

let server;
let baseUrl;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_012345678901234567890';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_012345678901234567890';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  const { app } = await import('../dist/app.js');
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health reports server status without requiring MongoDB', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.data.mongodb, 'disconnected');
});

test('protected profile route rejects anonymous requests', async () => {
  const response = await fetch(`${baseUrl}/users/me`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, 'Authentication required');
});

test('admin route is protected before administrator authorization', async () => {
  const response = await fetch(`${baseUrl}/reports`);
  assert.equal(response.status, 401);
});

test('registration validates before attempting a database connection', async () => {
  const response = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).success, false);
});

test('password reset does not claim success when email delivery is unavailable', async () => {
  const response = await fetch(`${baseUrl}/auth/forgot-password`, { method: 'POST' });
  assert.equal(response.status, 503);
});

test('unknown API paths return a structured 404', async () => {
  const response = await fetch(`${baseUrl}/does-not-exist`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).success, false);
});
