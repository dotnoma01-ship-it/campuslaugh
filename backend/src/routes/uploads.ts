import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { cloudinary } from '../config/cloudinary.js';
import { Conversation, MediaAsset } from '../models/index.js';
import { env } from '../config/env.js';

export const uploads = Router();
const supported = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime)|audio\/(mpeg|ogg|wav|webm)|application\/pdf)$/;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, supported.test(file.mimetype)) });

function contentMatches(file: Express.Multer.File) {
  const b = file.buffer;
  const starts = (...values: number[]) => values.every((value, index) => b[index] === value);
  if (file.mimetype === 'image/jpeg') return starts(0xff, 0xd8, 0xff);
  if (file.mimetype === 'image/png') return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (file.mimetype === 'image/gif') return b.toString('ascii', 0, 3) === 'GIF';
  if (file.mimetype === 'image/webp') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  if (file.mimetype === 'application/pdf') return b.toString('ascii', 0, 5) === '%PDF-';
  if (file.mimetype === 'video/webm' || file.mimetype === 'audio/webm') return starts(0x1a, 0x45, 0xdf, 0xa3);
  if (file.mimetype === 'video/mp4' || file.mimetype === 'video/quicktime') return b.toString('ascii', 4, 8) === 'ftyp';
  if (file.mimetype === 'audio/ogg') return b.toString('ascii', 0, 4) === 'OggS';
  if (file.mimetype === 'audio/wav') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE';
  if (file.mimetype === 'audio/mpeg') return b.toString('ascii', 0, 3) === 'ID3' || starts(0xff, b[1]! & 0xe0);
  return false;
}

uploads.post('/', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a supported image, video, audio, or PDF file (maximum 50 MB).' });
    if (!contentMatches(req.file)) return res.status(415).json({ message: 'File content does not match its declared file type.' });
    if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) return res.status(503).json({ message: 'Media storage is not configured.' });
    const context = z.enum(['profile-avatar', 'profile-cover', 'post', 'chat', 'group']).default('post').parse(req.body.context);
    const conversationId = req.body.conversationId ? z.string().length(24).parse(req.body.conversationId) : undefined;
    if (context === 'chat' && (!conversationId || !await Conversation.exists({ _id: conversationId, members: req.userId }))) return res.status(404).json({ message: 'Conversation not found.' });
    const resourceType = req.file.mimetype.startsWith('video/') || req.file.mimetype.startsWith('audio/') ? 'video' : req.file.mimetype === 'application/pdf' ? 'raw' : 'image';
    const result: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ resource_type: resourceType, folder: `campuslaugh/${context}`, public_id: `${req.userId}-${Date.now()}` }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
      stream.end(req.file!.buffer);
    });
    const asset = await MediaAsset.create({ ownerId: req.userId, context, ...(conversationId ? { conversationId } : {}), publicId: result.public_id, url: result.secure_url, resourceType: result.resource_type, format: result.format, bytes: result.bytes });
    res.status(201).json({ url: asset.url, publicId: asset.publicId, resourceType: asset.resourceType, bytes: asset.bytes, format: asset.format, assetId: asset.id });
  } catch (error) { next(error); }
});
