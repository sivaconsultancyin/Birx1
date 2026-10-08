import {Pool, type QueryResultRow} from 'pg';
import {serverEnv} from '../config/env.ts';
export const dbPool=serverEnv.databaseUrl?new Pool({connectionString:serverEnv.databaseUrl,max:10,ssl:serverEnv.nodeEnv==='production'?{rejectUnauthorized:false}:undefined}):null;
export async function query<T extends QueryResultRow=QueryResultRow>(text:string,params:unknown[]=[]){if(!dbPool)throw new Error('DATABASE_URL is not configured');return dbPool.query<T>(text,params);}
export async function closeDatabase(){if(dbPool)await dbPool.end();}
