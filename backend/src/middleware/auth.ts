import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
declare global { namespace Express { interface Request { userId?: string; role?: string } } }
export function auth(req:Request,res:Response,next:NextFunction){const token=req.headers.authorization?.replace(/^Bearer\s+/i,''); if(!token)return res.status(401).json({success:false,message:'Authentication required'});void (async()=>{try{const p=jwt.verify(token,env.accessSecret) as {sub?:string};if(!p.sub)return res.status(401).json({success:false,message:'Invalid access token'});const user=await User.findById(p.sub).select('role active');if(!user||!user.active)return res.status(401).json({success:false,message:'Account is unavailable'});req.userId=String(user._id);req.role=user.role;next()}catch(error){if(error instanceof jwt.JsonWebTokenError||error instanceof jwt.TokenExpiredError)return res.status(401).json({success:false,message:'Invalid or expired access token'});next(error)}})()}
export function optionalAuth(req:Request,_res:Response,next:NextFunction){const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token)return next();try{const p=jwt.verify(token,env.accessSecret) as {sub:string;role:string};req.userId=p.sub;req.role=p.role}catch{/* Public access remains anonymous when an optional token is invalid. */}next()}
export function admin(req:Request,res:Response,next:NextFunction){if(req.role!=='admin')return res.status(403).json({message:'Administrator access required'});next()}
