import type {ErrorRequestHandler,RequestHandler} from 'express';
import {AppError} from './AppError.ts';
import {logger} from '../logging/logger.ts';
export const notFoundHandler:RequestHandler=(_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Route not found'}});
export const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{const err=error instanceof AppError?error:new AppError('INTERNAL_ERROR',500,'Internal server error');if(err.status>=500)logger.error({err},err.message);res.status(err.status).json({error:{code:err.code,message:err.message}});};