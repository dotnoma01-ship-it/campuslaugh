import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import multer from 'multer';
import crypto from 'node:crypto';
import { env } from './config/env.js';
import { api } from './routes/api.js';
import { uploads } from './routes/uploads.js';
import { ApiError } from './utils/ApiError.js';
import { ok } from './utils/ApiResponse.js';
import { featureApi } from './routes/features.js';

export const app = express();
app.disable('x-powered-by');
if (env.trustProxy) app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.frontend, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
if (env.nodeEnv === 'production') app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  res.setHeader('X-Request-Id', requestId);
  res.once('finish', () => console.info(JSON.stringify({ level: 'info', event: 'http_request', requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Math.round(performance.now() - started) })));
  next();
});
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  const status = connected ? 200 : env.nodeEnv === 'production' ? 503 : 200;
  return res.status(status).json(ok({ status: connected ? 'ok' : 'degraded', mongodb: connected ? 'connected' : 'disconnected', time: new Date().toISOString() }));
});
app.use('/api/uploads', uploads);
app.use('/api', featureApi);
app.use('/api', api);
app.use((_req, _res, next) => next(new ApiError(404, 'Route not found')));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ApiError) return res.status(err.statusCode).json({ success: false, message: err.message, ...(err.details ? { details: err.details } : {}) });
  if (err instanceof multer.MulterError) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 50 MB limit.' : 'Invalid upload.' });
  if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
    const issues = 'issues' in err && Array.isArray(err.issues) ? err.issues : [];
    return res.status(400).json({ success: false, message: 'Invalid request', ...(env.nodeEnv !== 'production' ? { details: issues.map((issue: any) => ({ field: Array.isArray(issue.path) ? issue.path.join('.') : '', message: issue.message })) } : {}) });
  }
  if (err && typeof err === 'object' && 'code' in err && err.code === 11000) return res.status(409).json({ success: false, message: 'A record with that value already exists' });
  if (env.nodeEnv !== 'production') console.error(err);
  if (err && typeof err === 'object' && 'name' in err && err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid identifier or value' });
  return res.status(500).json({ success: false, message: 'Internal server error' });
});
