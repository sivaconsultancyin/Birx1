import type { AviatorBet, AviatorState, Wallet } from '../../../types.ts';

const BACKEND_URL = ((import.meta as ImportMeta & { env?: Record<string,string> }).env?.VITE_BACKEND_URL || 'https://brix1-backend.onrender.com').replace(/\/$/,'');
const BASE_URL = `${BACKEND_URL}/api`;

async function request<T>(path:string, options:RequestInit={}):Promise<T>{
  const token=localStorage.getItem('brix_token');
  const response=await fetch(`${BASE_URL}${path}`,{
    ...options,
    credentials:'include',
    headers:{
      'Content-Type':'application/json',
      ...(token?{Authorization:`Bearer ${token}`}:{}),
      'X-Request-Id':crypto.randomUUID(),
      ...(options.headers||{})
    }
  });
  const raw=await response.text();
  let data:unknown=null;
  if(raw.trim()){try{data=JSON.parse(raw);}catch{throw new Error(`Invalid server response (HTTP ${response.status})`);}}
  if(!response.ok) throw new Error((data as {error?:string}|null)?.error || `Server error (${response.status})`);
  if(!data || typeof data!=='object') throw new Error(`Empty server response (HTTP ${response.status})`);
  return data as T;
}

export const aviatorApi={
  getState:()=>request<{state:AviatorState & {currentBet:AviatorBet|null}}>('/aviator/state'),
  placeBet:(amount:number)=>request<{success:boolean;bet:AviatorBet;wallet:Wallet}>('/games/aviator/bet',{method:'POST',body:JSON.stringify({amount})}),
  cashOut:()=>request<{success:boolean;cashMultiplier:number;winAmount:number;wallet:Wallet}>('/games/aviator/cashout',{method:'POST'})
};