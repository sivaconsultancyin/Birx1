import crypto from 'node:crypto';
import pg from 'pg';
const {Pool}=pg;
const mobile=process.env.E2E_TEST_MOBILE?.replace(/\D/g,'');
const password=process.env.E2E_TEST_PASSWORD;
const url=process.env.DATABASE_URL;
if(!url||!mobile||!password) throw new Error('DATABASE_URL, E2E_TEST_MOBILE and E2E_TEST_PASSWORD are required');
const pool=new Pool({connectionString:url,ssl:process.env.PGSSL==='true'?{rejectUnauthorized:false}:undefined});
await pool.query('alter table users add column if not exists password_hash text');
const salt=crypto.randomBytes(16).toString('hex');
const hash=crypto.scryptSync(password,salt,64).toString('hex');
const passwordHash=`scrypt$${salt}$${hash}`;
const email=`${mobile}@auth.brix.games`;
const id='e2e_'+mobile;
await pool.query(`insert into users(id,mobile,email,username,role,vip_tier,is_demo,password_hash)
values($1,$2,$3,'E2E Player','PLAYER','Bronze',false,$4)
on conflict(id) do update set mobile=excluded.mobile,email=excluded.email,role='PLAYER',password_hash=excluded.password_hash`,
[id,mobile,email,passwordHash]);
await pool.query(`insert into wallets(user_id,balance,bonus,currency,is_demo)
values($1,5000,500,'INR',false) on conflict(user_id) do nothing`,[id]);
await pool.end();
console.log('E2E PostgreSQL user seeded:',mobile);
