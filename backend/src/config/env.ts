import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: ['.env.local', '.env'] });

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/campuslaugh'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  JWT_ACCESS_SECRET: z.string().min(32).refine((s) => !s.toLowerCase().includes('replace_with'), 'Replace the example JWT secret'),
  JWT_REFRESH_SECRET: z.string().min(32).refine((s) => !s.toLowerCase().includes('replace_with'), 'Replace the example JWT secret'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  EMAIL_HOST: z.string().optional().default(''),
  EMAIL_PORT: z.coerce.number().int().min(1).max(65535).optional().default(587),
  EMAIL_USER: z.string().optional().default(''),
  EMAIL_PASSWORD: z.string().optional().default(''),
  EMAIL_FROM: z.string().email().optional().or(z.literal('')).default(''),
  PASSWORD_RESET_URL: z.string().url().optional().default('http://localhost:5173/#/reset-password'),
}).superRefine((v, ctx) => {
  if (v.JWT_ACCESS_SECRET === v.JWT_REFRESH_SECRET) ctx.addIssue({ code: 'custom', path: ['JWT_REFRESH_SECRET'], message: 'Access and refresh secrets must differ' });
  const cloudValues = [v.CLOUDINARY_CLOUD_NAME, v.CLOUDINARY_API_KEY, v.CLOUDINARY_API_SECRET];
  if (cloudValues.some(Boolean) && !cloudValues.every(Boolean)) ctx.addIssue({ code: 'custom', path: ['CLOUDINARY_API_SECRET'], message: 'Set all Cloudinary values or leave them all blank' });
  const emailValues = [v.EMAIL_HOST, v.EMAIL_USER, v.EMAIL_PASSWORD, v.EMAIL_FROM];
  if (emailValues.some(Boolean) && !emailValues.every(Boolean)) ctx.addIssue({ code: 'custom', path: ['EMAIL_PASSWORD'], message: 'Set all email values or leave them all blank' });
  if (v.NODE_ENV === 'production') {
    if (!v.FRONTEND_URL.startsWith('https://') || /localhost|127\.0\.0\.1/i.test(v.FRONTEND_URL)) ctx.addIssue({ code: 'custom', path: ['FRONTEND_URL'], message: 'Production frontend URL must use HTTPS and cannot be localhost' });
    try { if (new URL(v.FRONTEND_URL).origin !== v.FRONTEND_URL.replace(/\/$/, '')) ctx.addIssue({ code: 'custom', path: ['FRONTEND_URL'], message: 'Frontend URL must be an origin without a path' }); } catch { /* The URL schema reports invalid URLs. */ }
    if (!/^mongodb(?:\+srv)?:\/\//i.test(v.MONGODB_URI) || /(?:localhost|127\.0\.0\.1)(?=[:/]|$)/i.test(v.MONGODB_URI)) ctx.addIssue({ code: 'custom', path: ['MONGODB_URI'], message: 'Production MongoDB URI must point to a non-local database' });
    if (!v.PASSWORD_RESET_URL.startsWith('https://') || /localhost|127\.0\.0\.1/i.test(v.PASSWORD_RESET_URL)) ctx.addIssue({ code: 'custom', path: ['PASSWORD_RESET_URL'], message: 'Production password reset URL must use HTTPS and cannot be localhost' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = {
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  mongo: parsed.data.MONGODB_URI,
  frontend: parsed.data.FRONTEND_URL,
  trustProxy: parsed.data.TRUST_PROXY,
  accessSecret: parsed.data.JWT_ACCESS_SECRET,
  refreshSecret: parsed.data.JWT_REFRESH_SECRET,
  cloudinary: { cloudName: parsed.data.CLOUDINARY_CLOUD_NAME, apiKey: parsed.data.CLOUDINARY_API_KEY, apiSecret: parsed.data.CLOUDINARY_API_SECRET },
  email: { host: parsed.data.EMAIL_HOST, port: parsed.data.EMAIL_PORT, user: parsed.data.EMAIL_USER, password: parsed.data.EMAIL_PASSWORD, from: parsed.data.EMAIL_FROM, resetUrl: parsed.data.PASSWORD_RESET_URL },
};
