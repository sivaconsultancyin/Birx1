import type {RequestHandler} from 'express';
import {AppError} from '../errors/AppError.ts';
export const requireAuthenticated:RequestHandler=(req,_res,next)=>{if(!req.user) return next(new AppError('AUTHENTICATION_ERROR',401,'Authentication required'));next();};
export const requireAuthorized=(roles:string[]):RequestHandler=>(req,_res,next)=>{if(!req.user)return next(new AppError('AUTHENTICATION_ERROR',401,'Authentication required'));if(roles.length&&!roles.includes(String(req.user.role)))return next(new AppError('AUTHORIZATION_ERROR',403,'Not authorized'));next();};