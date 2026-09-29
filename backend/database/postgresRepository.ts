import { randomUUID } from 'node:crypto';
import { getPostgresPool } from './postgres.ts';
import type { CoinRecharge, GameHistoryEntry, Transaction, User, UserRole, Wallet, WithdrawalRequest } from '../../src/types.ts';

function db() {
  const pool = getPostgresPool();
  if (!pool) throw new Error('DATABASE_URL is not configured');
  return pool;
}

function mapUser(r: any): User {
  return {
    id:r.id,email:r.email,mobile:r.mobile,username:r.username,role:r.role as UserRole,
    parentId:r.parent_id,vipTier:r.vip_tier,avatarUrl:r.avatar_url,isDemo:r.is_demo,createdAt:r.created_at
  };
}
function mapWallet(r: any): Wallet {
  return { balance:Number(r.balance),bonus:Number(r.bonus),lockedAmount:Number(r.locked_amount||0),currency:r.currency,isDemo:r.is_demo };
}
function mapTx(r:any): Transaction {
  return { id:r.id,userId:r.user_id,type:r.type,amount:Number(r.amount),status:r.status,gameId:r.game_id,description:r.description,referenceId:r.reference_id,idempotencyKey:r.idempotency_key,createdAt:r.created_at };
}
function mapRecharge(r:any): CoinRecharge {
  return { id:r.id,userId:r.user_id,username:r.username||'Player',amount:Number(r.amount),method:r.method,status:r.status,approvedBy:r.approved_by,transactionId:r.transaction_id,createdAt:r.created_at };
}
function mapWithdrawal(r:any): WithdrawalRequest {
  return { id:r.id,userId:r.user_id,amount:Number(r.amount),upiId:r.upi_id,bankDetails:r.bank_details,status:r.status,approvedBy:r.approved_by,transactionId:r.transaction_id,createdAt:r.created_at };
}

export const postgresRepo = {
  async checkConnectivity(){ try { await db().query('select 1'); return {configured:true,reachable:true}; } catch { return {configured:true,reachable:false}; } },

  async getUserByAuthId(authUserId:string){
    const {rows}=await db().query('select * from users where auth_user_id=$1 limit 1',[authUserId]);
    return rows[0]?mapUser(rows[0]):null;
  },
  async getUserAndWalletByAuthId(authUserId:string){
    const {rows}=await db().query('select u.*,w.balance,w.bonus,w.locked_amount,w.currency,w.is_demo as wallet_is_demo from users u join wallets w on w.user_id=u.id where u.auth_user_id=$1 limit 1',[authUserId]);
    if(!rows[0]) return null;
    return {user:mapUser(rows[0]),wallet:mapWallet({...rows[0],is_demo:rows[0].wallet_is_demo})};
  },
  async getUserById(id:string){ const {rows}=await db().query('select * from users where id=$1',[id]); return rows[0]?mapUser(rows[0]):null; },
  async getUserByEmailOrMobile(identifier:string){
    const clean=identifier.trim().toLowerCase();
    const {rows}=await db().query('select * from users where lower(email)=lower($1) or mobile=$1 or lower(username)=lower($1) limit 1',[clean]);
    return rows[0]?mapUser(rows[0]):null;
  },
  async createUser(user:User){
    const client=await db().connect();
    try{
      await client.query('begin');
      await client.query(`insert into users(id,email,mobile,username,role,parent_id,vip_tier,is_demo,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[user.id,user.email,user.mobile,user.username,user.role,user.parentId,user.vipTier,user.isDemo,user.createdAt]);
      await client.query(`insert into wallets(user_id,balance,bonus,currency,is_demo) values($1,5000,500,'INR',$2) on conflict(user_id) do nothing`,[user.id,user.isDemo]);
      await client.query('commit'); return user;
    }catch(e){await client.query('rollback');throw e}finally{client.release()}
  },
  async updateUserRole(id:string,role:UserRole){
    const {rows}=await db().query('update users set role=$2,updated_at=now() where id=$1 returning *',[id,role]);
    return rows[0]?mapUser(rows[0]):null;
  },
  async getVisibleUsers(actor:User){
    const {rows}=await db().query('select * from users order by created_at desc');
    const users=rows.map(mapUser);
    if(actor.role==='OWNER') return users;
    if(actor.role==='SUPER_ADMIN') return users.filter(u=>u.role==='ADMIN'||u.role==='PLAYER');
    if(actor.role==='ADMIN') return users.filter(u=>u.role==='PLAYER'&&(u.parentId===actor.id||!u.parentId));
    return users.filter(u=>u.id===actor.id);
  },
  async getWallet(userId:string){
    const {rows}=await db().query('select * from wallets where user_id=$1',[userId]);
    if(!rows[0]) throw new Error('Wallet not found');
    return mapWallet(rows[0]);
  },

  async atomicDebit(userId:string,amount:number,type:any,description:string,gameId?:string,idempotencyKey?:string){
    if(amount<=0) throw new Error('Invalid debit amount');
    const client=await db().connect();
    try{
      await client.query('begin');
      if(idempotencyKey){const q=await client.query('select response_payload from idempotency_records where key=$1',[idempotencyKey]);if(q.rows[0]){await client.query('commit');return q.rows[0].response_payload;}}
      const w=await client.query('select * from wallets where user_id=$1 for update',[userId]);
      if(!w.rows[0]) throw new Error('Wallet not found');
      if(Number(w.rows[0].balance)<amount) throw new Error(`Insufficient wallet balance. Available: ₹${w.rows[0].balance}, Required: ₹${amount}`);
      const updated=await client.query('update wallets set balance=balance-$2,updated_at=now() where user_id=$1 returning *',[userId,amount]);
      const txId=randomUUID(), ref='REF-'+Math.floor(100000+Math.random()*900000);
      const tx=await client.query(`insert into wallet_transactions(id,user_id,wallet_id,type,amount,status,game_id,description,reference_id,idempotency_key) values($1,$2,$3,$4,$5,'success',$6,$7,$8,$9) returning *`,[txId,userId,updated.rows[0].id,type,amount,gameId||null,description,ref,idempotencyKey||null]);
      const result={success:true,wallet:mapWallet(updated.rows[0]),transaction:mapTx(tx.rows[0])};
      if(idempotencyKey) await client.query('insert into idempotency_records(key,user_id,action_type,response_payload) values($1,$2,$3,$4)',[idempotencyKey,userId,String(type),result]);
      await client.query('commit'); return result;
    }catch(e){await client.query('rollback');throw e}finally{client.release()}
  },

  async atomicCredit(userId:string,amount:number,type:any,description:string,gameId?:string,idempotencyKey?:string){
    if(amount<=0) throw new Error('Invalid credit amount');
    const client=await db().connect();
    try{
      await client.query('begin');
      if(idempotencyKey){const q=await client.query('select response_payload from idempotency_records where key=$1',[idempotencyKey]);if(q.rows[0]){await client.query('commit');return q.rows[0].response_payload;}}
      const w=await client.query('select * from wallets where user_id=$1 for update',[userId]); if(!w.rows[0]) throw new Error('Wallet not found');
      const updated=await client.query('update wallets set balance=balance+$2,updated_at=now() where user_id=$1 returning *',[userId,amount]);
      const tx=await client.query(`insert into wallet_transactions(id,user_id,wallet_id,type,amount,status,game_id,description,reference_id,idempotency_key) values($1,$2,$3,$4,$5,'success',$6,$7,$8,$9) returning *`,[randomUUID(),userId,updated.rows[0].id,type,amount,gameId||null,description,'REF-'+Math.floor(100000+Math.random()*900000),idempotencyKey||null]);
      const result={success:true,wallet:mapWallet(updated.rows[0]),transaction:mapTx(tx.rows[0])};
      if(idempotencyKey) await client.query('insert into idempotency_records(key,user_id,action_type,response_payload) values($1,$2,$3,$4)',[idempotencyKey,userId,String(type),result]);
      await client.query('commit'); return result;
    }catch(e){await client.query('rollback');throw e}finally{client.release()}
  },

  async createRecharge(userId:string,amount:number,method='UPI',idempotencyKey?:string){
    if(idempotencyKey){const q=await db().query('select r.*,u.username from coin_recharges r join users u on u.id=r.user_id where r.idempotency_key=$1',[idempotencyKey]);if(q.rows[0])return mapRecharge(q.rows[0]);}
    const id='rch_'+randomUUID();const {rows}=await db().query(`insert into coin_recharges(id,user_id,amount,method,status,idempotency_key) values($1,$2,$3,$4,'pending',$5) returning *`,[id,userId,amount,method,idempotencyKey||null]);return mapRecharge({...rows[0],username:(await this.getUserById(userId))?.username});
  },
  async approveRecharge(id:string,by:string){const {rows}=await db().query(`update coin_recharges set status='approved',approved_by=$2,updated_at=now() where id=$1 returning *`,[id,by]);return mapRecharge(rows[0]);},
  async rejectRecharge(id:string,by:string){const {rows}=await db().query(`update coin_recharges set status='rejected',approved_by=$2,updated_at=now() where id=$1 returning *`,[id,by]);return mapRecharge(rows[0]);},
  async getRecharges(){const {rows}=await db().query('select r.*,u.username from coin_recharges r join users u on u.id=r.user_id order by r.created_at desc');return rows.map(mapRecharge);},
  async createWithdrawal(userId:string,amount:number,upiId:string,idempotencyKey?:string){if(idempotencyKey){const q=await db().query('select * from withdrawal_requests where idempotency_key=$1',[idempotencyKey]);if(q.rows[0])return mapWithdrawal(q.rows[0]);}const {rows}=await db().query(`insert into withdrawal_requests(id,user_id,amount,upi_id,status,idempotency_key) values($1,$2,$3,$4,'pending',$5) returning *`,['wth_'+randomUUID(),userId,amount,upiId,idempotencyKey||null]);return mapWithdrawal(rows[0]);},
  async approveWithdrawal(id:string,by:string){const {rows}=await db().query(`update withdrawal_requests set status='approved',approved_by=$2,updated_at=now() where id=$1 returning *`,[id,by]);return mapWithdrawal(rows[0]);},
  async rejectWithdrawal(id:string,by:string){const {rows}=await db().query(`update withdrawal_requests set status='rejected',approved_by=$2,updated_at=now() where id=$1 returning *`,[id,by]);return mapWithdrawal(rows[0]);},
  async getWithdrawals(){const {rows}=await db().query('select * from withdrawal_requests order by created_at desc');return rows.map(mapWithdrawal);},
  async getTransactions(userId?:string){const {rows}=await db().query(`select * from wallet_transactions ${userId?'where user_id=$1':''} order by created_at desc`,userId?[userId]:[]);return rows.map(mapTx);},

  async recordGameBet(input:any){const {rows}=await db().query(`insert into bets(id,round_id,user_id,game_id,bet_type,bet_value,amount,multiplier,payout,status,idempotency_key,settled_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict(id) do update set status=excluded.status,payout=excluded.payout,multiplier=excluded.multiplier returning *`,[input.id,input.roundId,input.userId,input.gameId,input.betType,input.betValue||{},input.amount,input.multiplier??0,input.payout??0,input.status,input.idempotencyKey||null,input.settledAt||null]);return rows[0];},
  async settleGameBet(id:string,status:'won'|'lost',multiplier:number,payout:number){const {rows}=await db().query('update bets set status=$2,multiplier=$3,payout=$4,settled_at=now() where id=$1 returning *',[id,status,multiplier,payout]);return rows[0];},
  async recordSettlement(input:any){const {rows}=await db().query(`insert into settlements(id,round_id,game_id,total_bets_count,total_bet_amount,total_payout_amount,net_house_result,outcome_summary,details,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'completed') returning *`,[input.id,input.roundId,input.gameId,input.totalBetsCount,input.totalBetAmount,input.totalPayoutAmount,input.netHouseResult,input.outcomeSummary,input.details||{}]);return rows[0];},
  async recordGameRound(roundId:string,gameId:string,phase:string,resultData:any,roundNumber=0){const phaseMap:any={betting:'betting',lock:'closed',deal:'dealing',dealing:'dealing',running:'in_flight',in_flight:'in_flight',spinning:'spinning',compare:'result',settlement:'settled',result:'result',completed:'settled',crashed:'result',playing:'dealing',showdown:'result',settled:'settled'};const dbPhase=phaseMap[phase]||'result';const {rows}=await db().query(`insert into game_rounds(id,game_id,round_number,phase,result_data) values($1,$2,$3,$4,$5) on conflict(id) do update set phase=excluded.phase,result_data=excluded.result_data,settled_at=case when excluded.phase='settled' then now() else game_rounds.settled_at end returning *`,[roundId,gameId,roundNumber,dbPhase,resultData||{}]);return rows[0];},
  async getActiveGameRounds(){const {rows}=await db().query("select * from game_rounds where phase not in ('settled','result') order by created_at desc");return rows;},

  async saveAuthoritativeGameState(gameId:string,state:any){await db().query(`insert into authoritative_game_states(game_id,round_id,phase,state,version,updated_at) values($1,$2,$3,$4,1,now()) on conflict(game_id) do update set round_id=excluded.round_id,phase=excluded.phase,state=excluded.state,version=authoritative_game_states.version+1,updated_at=now()`,[gameId,state?.roundId||null,state?.phase||'unknown',state]);},
  async getAuthoritativeGameState(gameId:string){const {rows}=await db().query('select state from authoritative_game_states where game_id=$1',[gameId]);return rows[0]?.state||null;},
  async claimGameLease(gameId:string,ownerId:string,leaseMs=10000){const {rows}=await db().query(`insert into game_state_leases(game_id,owner_id,lease_until) values($1,$2,now()+($3::numeric/1000)*interval '1 second') on conflict(game_id) do update set owner_id=excluded.owner_id,lease_until=excluded.lease_until,updated_at=now() where game_state_leases.lease_until<now() or game_state_leases.owner_id=$2 returning owner_id=$2 as claimed`,[gameId,ownerId,leaseMs]);return Boolean(rows[0]?.claimed);},

  async getClaims(){const {rows}=await db().query('select * from platform_claims order by created_at desc');return rows;},
  async createClaim(claim:any){const {rows}=await db().query(`insert into platform_claims(id,user_id,username,amount,reason,status,metadata) values($1,$2,$3,$4,$5,$6,$7) returning *`,[claim.id||'clm_'+randomUUID(),claim.userId,claim.username,claim.amount,claim.reason,claim.status||'pending',claim.metadata||{}]);return rows[0];},
  async updateClaimStatus(id:string,status:string){const {rows}=await db().query('update platform_claims set status=$2,updated_at=now() where id=$1 returning *',[id,status]);return rows[0];},
  async getPolicies(){const {rows}=await db().query("select config from platform_policies where id='default'");return rows[0]?.config||{};},
  async updatePolicies(config:any,updatedBy:string){const {rows}=await db().query(`insert into platform_policies(id,config,updated_by) values('default',$1,$2) on conflict(id) do update set config=excluded.config,updated_by=excluded.updated_by,updated_at=now() returning config`,[config,updatedBy]);return rows[0].config;}
};
