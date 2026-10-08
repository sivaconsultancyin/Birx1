import 'dotenv/config';
const required=(key:string):string=>{const value=process.env[key]?.trim();if(!value)throw new Error(`Missing required environment variable: ${key}`);return value;};
export const serverEnv=Object.freeze({
 nodeEnv:process.env.NODE_ENV||'development',
 port:Number(process.env.PORT||10000),
 frontendUrl:process.env.FRONTEND_URL||'http://localhost:5173',
 databaseUrl:process.env.DATABASE_URL||'',
 supabaseUrl:process.env.SUPABASE_URL||'',
 supabaseServiceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY||'',
 supabaseAnonKey:process.env.SUPABASE_ANON_KEY||'',
 logLevel:process.env.LOG_LEVEL||'info'
});
export {required};