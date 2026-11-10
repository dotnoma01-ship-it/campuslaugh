import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/ApiError.js';
export const validate = (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
  const parsed = schema.safeParse({ body: req.body, query: req.query, params: req.params });
  if (!parsed.success) return next(new ApiError(400, 'Invalid request', parsed.error.issues));
  Object.assign(req, parsed.data);
  next();
};
