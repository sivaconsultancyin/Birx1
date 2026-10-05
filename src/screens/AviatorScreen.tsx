/* External UI integration target: adapted from public GitHub frontend patterns; game logic/API remains local. */
/* UI integration: preserve existing game logic; visual layer remains component-driven. */
import React, { useState, useEffect, useRef } from 'react';
import { ExternalAviatorUI } from '../components/external/ExternalAviatorUI.tsx';
import { Plane, AlertTriangle, CheckCircle, TrendingUp, Sparkles, Clock } from 'lucide-react';
import { AviatorBet, AviatorState, Wallet } from '../types.ts';
import { gamesApi } from '../api/client.ts';
import { GameHeader } from '../components/GameHeader.tsx';
import { AmountSelector } from '../components/AmountSelector.tsx';
import { RulesModal } from '../components/RulesModal.tsx';
import { notifyWinLoss } from '../components/WinLossNotification.tsx';

interface AviatorScreenProps {
  wallet: Wallet;
  onUpdateWallet: (w: Wallet) => void;
  onBack: () => void;
  onOpenWallet?: () => void;
}

export const AviatorScreen: React.FC<AviatorScreenProps> = ({
  wallet,
  onUpdateWallet,
  onBack,
  onOpenWallet
}) => {
  const [gameState, setGameState] = useState<AviatorState | null>(null);
  const [currentBet, setCurrentBet] = useState<AviatorBet | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [cashoutResult, setCashoutResult] = useState<{ amount: number; multiplier: number } | null>(null);
  const currentBetRef = useRef<AviatorBet | null>(null);
  currentBetRef.current = currentBet;

  // Poll server state every 180ms to strictly display server-authoritative ticks & crash
  useEffect(() => {
    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const res = await gamesApi.aviator.getState();
        if (!isMounted) return;
        setGameState(res.state);
        if (res.state.phase === 'crashed') {
          if (currentBetRef.current && !currentBetRef.current.cashedOut) {
            notifyWinLoss({ type: 'loss', amount: currentBetRef.current.amount });
            setCurrentBet(null);
          }
        } else if (res.state.currentBet) {
          setCurrentBet(res.state.currentBet);
        } else if (res.state.phase === 'betting') {
          setCurrentBet(null);
        }
      } catch {}
    }, 180);
    return () => { isMounted = false; clearInterval(pollInterval); };
  }, []);

  const handlePlaceBet = async () => {
    if (!gameState || gameState.phase !== 'betting') {
      setErrorMsg('Betting is only open during the countdown phase');
      return;
    }
    if (wallet.balance < betAmount) {
      setErrorMsg('Insufficient balance for this bet');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await gamesApi.aviator.placeBet(betAmount);
      setCurrentBet(res.bet);
      onUpdateWallet(res.wallet);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to place bet');
    } finally {
      setLoading(false);
    }
  };

  const handleCashOut = async () => {
    if (!currentBet || currentBet.cashedOut || gameState?.phase !== 'running') return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await gamesApi.aviator.cashOut();
      setCashoutResult({ amount: res.winAmount, multiplier: res.cashMultiplier });
      onUpdateWallet(res.wallet);
      setCurrentBet(prev => prev ? { ...prev, cashedOut: true, winAmount: res.winAmount } : null);
      notifyWinLoss({ type: 'win', amount: res.winAmount });
    } catch (err: any) {
      setErrorMsg(err.message || 'Cashout failed');
    } finally {
      setLoading(false);
    }
  };

    return (
    <div className="h-screen w-screen flex flex-col bg-[#0f1115] text-[#f3f4f6] overflow-hidden">
      <header className="h-20 glass flex items-center justify-between px-8 border-b border-white/5 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-red-500 p-2.5 rounded-2xl shadow-lg shadow-red-500/20">
            <Plane className="text-white fill-white" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter leading-none">AVIATOR</h1>
            <p className="text-[10px] font-bold text-red-500/80 uppercase tracking-widest mt-1">Real-time Flight</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => setShowRules(true)} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl border border-white/5 transition-all">
            <CheckCircle className="text-amber-400" size={18} /><span className="font-bold text-xs uppercase tracking-widest">Fairness</span>
          </button>
          <div className="flex items-center gap-2 border-l border-white/10 pl-6">
            <span className="text-lg font-black tabular-nums">₹{wallet.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </header>
      <main className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
        <aside className="hidden lg:flex w-80 shrink-0 flex-col gap-4 overflow-hidden">
          <div className="flex-1 glass rounded-3xl p-5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><TrendingUp size={18} className="text-indigo-400" /><h3 className="font-bold uppercase tracking-wider text-xs">Live Bets</h3></div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {gameState?.bets?.map((bet: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl border bg-white/5 border-white/5">
                  <div><p className="text-xs font-bold text-gray-400">{bet.username ?? 'Player'}</p><p className="text-sm font-black">₹{Number(bet.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                </div>
              ))}
            </div>
          </div>
        </aside>
        <section className="flex-1 min-w-0 flex flex-col gap-4 relative">
          <div className="glass rounded-2xl p-2 flex gap-2 overflow-x-auto no-scrollbar">
            <Clock size={16} className="text-gray-500 mt-1 ml-2" />
            {(gameState?.history ?? []).map((h: number, i: number) => (
              <div key={i} className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">{Number(h).toFixed(2)}x</div>
            ))}
          </div>
          <div className="flex-1 glass rounded-[2.5rem] relative flex items-center justify-center overflow-hidden border border-white/5 bg-gradient-to-br from-black/20 to-transparent">
            {/* Fixed horizontal flight lane: X changes with multiplier; Y is ALWAYS 50%. */}
            <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-white/10 pointer-events-none" />
            <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-red-500/35 shadow-[0_0_12px_rgba(239,68,68,0.35)] pointer-events-none" />
            {gameState?.phase === 'running' && (() => {
              const rawX = ((Number(gameState.multiplier || 1) - 1) / 8) * 100;
              const planeX = Math.min(88, Math.max(8, rawX));
              return (
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    left: `${planeX}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%) rotate(-12deg)',
                    willChange: 'left'
                  }}
                >
                  <Plane className="w-12 h-12 text-red-500 fill-red-500 drop-shadow-[0_0_18px_rgba(239,68,68,0.7)]" />
                  <span className="absolute -left-5 top-1/2 w-5 h-1 -translate-y-1/2 rounded-full bg-amber-400 blur-[2px]" />
                </div>
              );
            })()}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <p className="text-7xl sm:text-8xl lg:text-[10rem] font-black tabular-nums tracking-tighter drop-shadow-[0_0_50px_rgba(234,67,53,0.4)] text-white">
                {gameState?.phase === 'crashed' ? Number(gameState.crashMultiplier ?? gameState.multiplier ?? 1).toFixed(2) : Number(gameState?.multiplier ?? 1).toFixed(2)}<span className="text-5xl ml-2 text-red-500">x</span>
              </p>
            </div>
          </div>
          <div className="glass rounded-3xl p-3 sm:p-4 flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 items-center">
            <div className="w-full sm:w-auto"><AmountSelector value={betAmount} onChange={setBetAmount} disabled={loading} /></div>
            <button disabled={loading || !!currentBet || gameState?.phase !== 'betting'} onClick={handlePlaceBet} className="flex-1 min-w-[120px] bg-red-500 hover:bg-red-400 rounded-2xl py-4 font-black uppercase tracking-widest">{gameState?.phase === 'betting' ? 'BET' : 'WAITING'}</button>
            <button disabled={loading || !currentBet || currentBet.cashedOut || gameState?.phase !== 'running'} onClick={handleCashOut} className="flex-1 min-w-[120px] bg-emerald-500 hover:bg-emerald-400 rounded-2xl py-4 font-black uppercase tracking-widest">CASH OUT</button>
          </div>
        </section>
      </main>
    </div>
  );
};
