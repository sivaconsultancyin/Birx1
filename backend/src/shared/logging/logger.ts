import pino from 'pino';
import {serverEnv} from '../config/env.ts';
export const logger=pino({level:serverEnv.logLevel,base:undefined,redact:{paths:['req.headers.authorization','req.headers.cookie','*.password','*.token','*.secret'],remove:true}});
export interface GameLogContext {game?:string;roundId?:string;userId?:string;event?:string;requestId?:string;transactionId?:string;}