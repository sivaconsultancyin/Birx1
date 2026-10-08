import { useCallback, useEffect, useRef, useState } from 'react';
import type { AviatorBet, AviatorState, Wallet } from '../../../types.ts';
import { notifyWinLoss } from '../../../components/WinLossNotification.tsx';
import { aviatorApi } from '../api/aviatorApi.ts';
import { subscribeToAviatorEvents } from '../socket/aviatorSocket.ts';

export function useAviatorGame(wallet:Wallet,onUpdateWallet:(wallet:Wallet)=>void){
  const [gameState,setGameState]=useState<AviatorState|null>(null);
  const [currentBet,setCurrentBet]=useState<AviatorBet|null>(null);
  const [loading,setLoading]=useState(false);
  const [errorMsg,setErrorMsg]=useState<string|null>(null);
  const currentBetRef=useRef<AviatorBet|null>(null);
  currentBetRef.current=currentBet;

  const syncState=useCallback(async()=>{
    try{
      const res=await aviatorApi.getState();
      setGameState(res.state);
      setCurrentBet(res.state.currentBet ?? null);
    }catch{ /* realtime reconnect remains authoritative */ }
  },[]);

  useEffect(()=>{
    let mounted=true;
    void syncState();
    const unsubscribe=subscribeToAviatorEvents((payload)=>{
      if(!mounted)return;
      const data=payload.data || {};
      if(payload.event==='aviator_tick'){
        setGameState(prev=>prev?{...prev,roundId:String(data.roundId??prev.roundId),phase:(data.phase??prev.phase) as AviatorState['phase'],multiplier:Number(data.multiplier??prev.multiplier),countdown:Number(data.countdown??prev.countdown)}:null);
      }else if(payload.event==='round_started'){
        void syncState();
      }else if(payload.event==='betting_closed'){
        setGameState(prev=>prev?{...prev,phase:'running'}:prev);
      }else if(payload.event==='result'){
        setGameState(prev=>prev?{...prev,phase:'crashed',multiplier:Number(data.multiplier??prev.multiplier),crashMultiplier:Number(data.multiplier??prev.crashMultiplier??0)}:null);
        const bet=currentBetRef.current;
        if(bet && !bet.cashedOut){notifyWinLoss({type:'loss',amount:bet.amount});setCurrentBet(null);}
        void syncState();
      }
    });
    return()=>{mounted=false;unsubscribe();};
  },[syncState]);

  const placeBet=useCallback(async(amount:number)=>{
    if(!gameState||gameState.phase!=='betting'){setErrorMsg('Betting is only open during the countdown phase');return;}
    if(wallet.balance<amount){setErrorMsg('Insufficient balance for this bet');return;}
    setLoading(true);setErrorMsg(null);
    try{const res=await aviatorApi.placeBet(amount);setCurrentBet(res.bet);onUpdateWallet(res.wallet);}
    catch(err){setErrorMsg(err instanceof Error?err.message:'Failed to place bet');}
    finally{setLoading(false);}
  },[gameState,wallet.balance,onUpdateWallet]);

  const cashOut=useCallback(async()=>{
    if(!currentBet||currentBet.cashedOut||gameState?.phase!=='running')return;
    setLoading(true);setErrorMsg(null);
    try{const res=await aviatorApi.cashOut();onUpdateWallet(res.wallet);setCurrentBet(prev=>prev?{...prev,cashedOut:true,winAmount:res.winAmount}:null);notifyWinLoss({type:'win',amount:res.winAmount});}
    catch(err){setErrorMsg(err instanceof Error?err.message:'Cashout failed');}
    finally{setLoading(false);}
  },[currentBet,gameState?.phase,onUpdateWallet]);

  return {gameState,currentBet,loading,errorMsg,placeBet,cashOut,setErrorMsg};
}
