import crypto from 'node:crypto';
import type { AviatorBet, AviatorState } from '../../../types.ts';
import { AVIATOR_ROOM_ID, INITIAL_AVIATOR_STATE } from '../constants.ts';
import { hashSeed, generateCrashPoint } from '../fairness.ts';

export interface AviatorRuntimeDeps {
  acquireGameLease: (gameId: string) => Promise<boolean>;
  safeSaveAuthoritativeGameState: (gameId: string, state: unknown) => Promise<void>;
  safeGetAuthoritativeGameState: (gameId: string) => Promise<unknown>;
}

export class AviatorRuntime {
  state: AviatorState = { ...INITIAL_AVIATOR_STATE, roundId: 'AV-' + crypto.randomInt(1000, 10000) };
  bets = new Map<string, AviatorBet>();
  roundStats = new Map<string, { totalBets: number; totalBetAmount: number; totalPayoutAmount: number }>();
  roundSequence = Date.now();
  lastHydratedVersion = 0;
  authoritativeVersion = 0;
  serverSeed = crypto.randomBytes(32).toString('hex');
  serverSeedHash = hashSeed(this.serverSeed);
  clientSeed = 'brix1-public';
  nonce = 0;
  crashTarget = generateCrashPoint(this.serverSeed, this.clientSeed, this.nonce);
  flightStartedAt = 0;
  lastPersistedFlightSecond = -1;
  timer: NodeJS.Timeout | null = null;
  leaseHeartbeat: NodeJS.Timeout | null = null;
  private settlementMutation: Promise<void> = Promise.resolve();
  constructor(readonly deps: AviatorRuntimeDeps) {}
  withSettlementMutation<T>(fn: () => Promise<T>) { const previous=this.settlementMutation; let release!:()=>void; this.settlementMutation=new Promise<void>(r=>{release=r}); return previous.then(async()=>{try{return await fn()}finally{release()}}); }
  stopLeaseHeartbeat(){if(this.leaseHeartbeat)clearInterval(this.leaseHeartbeat);this.leaseHeartbeat=null;}
  startLeaseHeartbeat(){this.stopLeaseHeartbeat();this.leaseHeartbeat=setInterval(async()=>{try{await this.deps.acquireGameLease('aviator')}catch(e){console.warn('[Aviator] Lease renewal failed',e)}},3000)}
  async persist(){this.authoritativeVersion+=1;await this.deps.safeSaveAuthoritativeGameState('aviator',{...this.state,version:this.authoritativeVersion,roomId:AVIATOR_ROOM_ID,crashTarget:this.crashTarget,serverSeed:this.serverSeed,serverSeedHash:this.serverSeedHash,clientSeed:this.clientSeed,nonce:this.nonce,activeBets:Object.fromEntries(this.bets)})}
  async hydrate(){const persisted=await this.deps.safeGetAuthoritativeGameState('aviator');if(!persisted)return;const p=persisted as Record<string,unknown>;const v=Number(p.version||0);if(v<=this.lastHydratedVersion)return;this.lastHydratedVersion=v;this.authoritativeVersion=Math.max(this.authoritativeVersion,v);if(typeof p.roundId==='string')this.state={...this.state,...p} as AviatorState;if(typeof p.serverSeed==='string')this.serverSeed=p.serverSeed;if(typeof p.serverSeedHash==='string')this.serverSeedHash=p.serverSeedHash;if(typeof p.clientSeed==='string')this.clientSeed=p.clientSeed;if(Number.isFinite(Number(p.nonce)))this.nonce=Number(p.nonce);if(typeof p.crashTarget==='number')this.crashTarget=p.crashTarget;}
}
