import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import multer from 'multer';
import { env } from './config/env.js';
import { api } from './routes/api.js';
import { uploads } from './routes/uploads.js';
import { ApiError } from './utils/ApiError.js';
import { ok } from './utils/ApiResponse.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.frontend, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json(ok({ status: 'ok', mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', time: new Date().toISOString() })));
app.use('/api/uploads', uploads);
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
  return res.status(500).json({ success: false, message: 'Internal server error' });
});
