import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: ['.env.local', '.env'] });

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/campuslaugh'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32).refine((s) => !s.toLowerCase().includes('replace_with'), 'Replace the example JWT secret'),
  JWT_REFRESH_SECRET: z.string().min(32).refine((s) => !s.toLowerCase().includes('replace_with'), 'Replace the example JWT secret'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
}).superRefine((v, ctx) => {
  if (v.JWT_ACCESS_SECRET === v.JWT_REFRESH_SECRET) ctx.addIssue({ code: 'custom', path: ['JWT_REFRESH_SECRET'], message: 'Access and refresh secrets must differ' });
  const cloudValues = [v.CLOUDINARY_CLOUD_NAME, v.CLOUDINARY_API_KEY, v.CLOUDINARY_API_SECRET];
  if (cloudValues.some(Boolean) && !cloudValues.every(Boolean)) ctx.addIssue({ code: 'custom', path: ['CLOUDINARY_API_SECRET'], message: 'Set all Cloudinary values or leave them all blank' });
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
  accessSecret: parsed.data.JWT_ACCESS_SECRET,
  refreshSecret: parsed.data.JWT_REFRESH_SECRET,
  cloudinary: { cloudName: parsed.data.CLOUDINARY_CLOUD_NAME, apiKey: parsed.data.CLOUDINARY_API_KEY, apiSecret: parsed.data.CLOUDINARY_API_SECRET },
};
