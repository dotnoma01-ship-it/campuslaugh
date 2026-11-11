import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { PasswordReset, RefreshToken, User } from '../models/index.js';

type Sender = (to: string, name: string, resetUrl: string) => Promise<void>;
const smtpConfigured = Boolean(env.email.host && env.email.user && env.email.password && env.email.from);
const smtp = smtpConfigured ? nodemailer.createTransport({ host: env.email.host, port: env.email.port, secure: env.email.port === 465, auth: { user: env.email.user, pass: env.email.password } }) : null;
let sender: Sender = async (to, name, resetUrl) => {
  if (!smtp) throw new Error('Password-reset email delivery is not configured.');
  await smtp.sendMail({ from: env.email.from, to, subject: 'Reset your CampusLaugh password', text: `Hi ${name},\n\nUse this link within 30 minutes to reset your password:\n${resetUrl}\n\nIf you did not request this, ignore this email.`, html: `<p>Hi ${escapeHtml(name)},</p><p>Use this link within 30 minutes to reset your password:</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>If you did not request this, ignore this email.</p>` });
};
export function setPasswordResetSenderForTests(value?: Sender) { sender = value ?? (async (to, name, url) => { if (!smtp) throw new Error('Password-reset email delivery is not configured.'); await smtp.sendMail({ from: env.email.from, to, subject: 'Reset your CampusLaugh password', text: `Hi ${name}. Reset your password: ${url}` }); }); }
export const passwordResetEmailConfigured = smtpConfigured;

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }
function tokenHash(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }

export async function issuePasswordReset(email: string) {
  const user = await User.findOne({ email: email.toLowerCase(), active: true }).select('_id name email');
  if (!user) return;
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  await PasswordReset.deleteMany({ userId: user._id, usedAt: { $exists: false } });
  await PasswordReset.create({ userId: user._id, tokenHash: tokenHash(token), expiresAt });
  const resetUrl = new URL(env.email.resetUrl);
  const route = resetUrl.hash.replace(/^#/, '').split('?', 1)[0] || '/reset-password';
  resetUrl.hash = `${route}?token=${encodeURIComponent(token)}`;
  try { await sender(user.email, user.name, resetUrl.toString()); }
  catch (error) { await PasswordReset.deleteOne({ userId: user._id, tokenHash: tokenHash(token) }); throw error; }
}

export async function consumePasswordReset(token: string, password: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return false;
  const reset = await PasswordReset.findOneAndUpdate({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() }, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } }, { new: true });
  if (!reset) return false;
  const user = await User.findOne({ _id: reset.userId, active: true }).select('+passwordHash');
  if (!user) return false;
  user.passwordHash = await (await import('bcryptjs')).default.hash(password, 12);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  await Promise.all([RefreshToken.deleteMany({ userId: user._id }), PasswordReset.deleteMany({ userId: user._id })]);
  return true;
}
