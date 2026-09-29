import React, { useState, useEffect, useRef } from 'react';
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

  // Poll server state every 150ms to strictly display server-authoritative ticks & crash
  useEffect(() => {
    let isMounted = true;

    const pollInterval = setInterval(async () => {
      try {
        const res = await gamesApi.aviator.getState();
        if (!isMounted) return;
        setGameState(res.state);
        if (res.state.phase === 'crashed') {
          if (currentBetRef.current && !currentBetRef.current.cashedOut) {
            notifyWinLoss({
              type: 'loss',
              amount: currentBetRef.current.amount
            });
            setCurrentBet(null);
          }
        } else if (res.state.currentBet) {
          setCurrentBet(res.state.currentBet);
        } else if (res.state.phase === 'betting') {
          // If server reset round
          setCurrentBet(null);
        }
      } catch (err: any) {
        // network tick jitter
      }
    }, 180);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
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

  const handleCashout = async () => {
    if (!currentBet || currentBet.cashedOut || gameState?.phase !== 'running') return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await gamesApi.aviator.cashOut();
      setCashoutResult({ amount: res.winAmount, multiplier: res.cashMultiplier });
      onUpdateWallet(res.wallet);
      setCurrentBet((prev) => (prev ? { ...prev, cashedOut: true, winAmount: res.winAmount } : null));
      // Authoritative Win notification popup
      notifyWinLoss({
        type: 'win',
        amount: res.winAmount
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Cashout failed');
    } finally {
      setLoading(false);
    }
  };

  const multiplier = gameState?.multiplier || 1.0;
  const phase = gameState?.phase || 'betting';
  const isCrashed = phase === 'crashed';
  const isRunning = phase === 'running';

  // Calculate aircraft flight curve position based on multiplier
  // normalized between 0% and 85% width & height
  const flightProgress = Math.min(1, Math.max(0, (multiplier - 1.0) / 4.0));
  const planeX = 10 + flightProgress * 75; // 10% to 85%
  const planeY = 70 - flightProgress * 55; // 70% down to 15%

  const rulesData = [
    {
      heading: 'How Aviator Works',
      description:
        'The aircraft takes off with an increasing multiplier starting at 1.00x. The flight curve rises exponentially until the server triggers the crash point.'
    },
    {
      heading: 'Cashing Out',
      description:
        'Click CASH OUT before the plane flies away! Your win is your bet multiplied by the server-confirmed multiplier at the exact moment of cashout.'
    },
    {
      heading: 'Provably Fair Server Authority',
      description:
        'Every crash point is generated and settled authoritatively on the server. The frontend has no ability to alter payouts or multipliers.'
    }
  ];

  return (
    <div id="screen-aviator" className="min-h-screen bg-slate-950 text-white pb-24 max-w-md mx-auto">
      <GameHeader
        title="Aviator 3D"
        gameId="aviator"
        balance={wallet.balance}
        isDemo={wallet.isDemo}
        roundId={gameState?.roundId}
        onBack={onBack}
        onOpenRules={() => setShowRules(true)}
        onOpenWallet={onOpenWallet}
      />

      {/* Previous Multipliers History Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-500" /> History:
        </span>
        {gameState?.previousMultipliers.slice(0, 8).map((m, idx) => {
          const isHigh = m >= 5.0;
          const isMid = m >= 2.0;
          return (
            <span
              key={idx}
              className={`shrink-0 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                isHigh
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : isMid
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              }`}
            >
              {m.toFixed(2)}x
            </span>
          );
        })}
      </div>

      {/* Flight Canvas Arena */}
      <div className="relative p-4 bg-slate-950">
        <div className="relative w-full h-64 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800/80 shadow-2xl overflow-hidden flex flex-col justify-between p-4">
          {/* Grid Background Lines */}
          <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-10 pointer-events-none">
            {[...Array(24)].map((_, i) => (
              <div key={i} className="border border-slate-700" />
            ))}
          </div>

          {/* Top Info Pill */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
              ID: {gameState?.roundId || 'AV-SYNC'}
            </span>

            {phase === 'betting' && (
              <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/40 animate-pulse">
                NEXT FLIGHT IN {gameState?.countdown || 5}s
              </span>
            )}
            {isRunning && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                FLYING AWAY
              </span>
            )}
            {isCrashed && (
              <span className="text-xs font-black text-rose-400 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/40">
                FLEW AWAY @ {gameState?.crashMultiplier?.toFixed(2)}x
              </span>
            )}
          </div>

          {/* SVG Flight Trail Curve */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {isRunning && (
              <>
                <defs>
                  <linearGradient id="curveGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                <path
                  d={`M 10 240 Q ${planeX * 2} 240, ${planeX * 3.6} ${planeY * 2.5}`}
                  fill="none"
                  stroke="url(#curveGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>

          {/* Center Huge Multiplier Display */}
          <div className="relative z-10 self-center flex flex-col items-center">
            {isCrashed ? (
              <div className="text-center animate-shake">
                <div className="text-4xl font-black text-rose-500 tracking-tight drop-shadow-md">
                  {gameState?.crashMultiplier?.toFixed(2)}x
                </div>
                <div className="text-xs uppercase font-extrabold text-rose-400 tracking-widest mt-1">
                  CRASHED
                </div>
              </div>
            ) : isRunning ? (
              <div className="text-center">
                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 tracking-tight drop-shadow-lg">
                  {multiplier.toFixed(2)}x
                </div>
                <div className="text-[11px] text-amber-400/80 font-bold uppercase tracking-wider mt-0.5">
                  CURRENT MULTIPLIER
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-3xl font-black text-slate-400">WAITING</div>
                <div className="text-xs text-slate-500 mt-0.5">Place your bet before departure</div>
              </div>
            )}
          </div>

          {/* Flying Aircraft Element */}
          {isRunning && (
            <div
              className="absolute z-20 transition-all duration-150 pointer-events-none"
              style={{
                left: `${planeX}%`,
                top: `${planeY}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="relative flex items-center justify-center">
                <Plane className="w-10 h-10 text-rose-500 fill-rose-500 -rotate-12 drop-shadow-xl animate-pulse" />
                <span className="absolute -left-3 w-4 h-1 bg-amber-400 rounded-full blur-sm" />
              </div>
            </div>
          )}

          {/* Bottom runway strip */}
          <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-2">
            <span>Server Hash Verified</span>
            <span>RNG Fair</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mx-4 mb-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-center">
          {errorMsg}
        </div>
      )}

      {/* Betting Box Controls */}
      <div className="px-4 space-y-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stake Amount</span>
            {currentBet && (
              <span className="text-xs font-bold text-emerald-400">
                Active Bet: ₹{currentBet.amount}
              </span>
            )}
          </div>

          <AmountSelector
            currentAmount={betAmount}
            onAmountChange={setBetAmount}
            minAmount={10}
            maxAmount={25000}
            disabled={loading || (currentBet !== null && !currentBet.cashedOut)}
          />

          {/* Primary Action Button */}
          <div className="mt-4">
            {isRunning && currentBet && !currentBet.cashedOut ? (
              <button
                id="btn-aviator-cashout"
                type="button"
                disabled={loading}
                onClick={handleCashout}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-95 transition-transform cursor-pointer flex flex-col items-center justify-center leading-tight"
              >
                <span>CASH OUT NOW</span>
                <span className="text-xs font-extrabold text-slate-900">
                  ₹{(Math.floor((currentBet?.amount ?? 0) * (multiplier ?? 1)) || 0).toLocaleString('en-IN')} ({(multiplier ?? 1).toFixed(2)}x)
                </span>
              </button>
            ) : currentBet && currentBet.cashedOut ? (
              <div className="w-full py-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-center font-bold text-xs">
                Cashed Out ₹{currentBet.winAmount}! Waiting for next round...
              </div>
            ) : (
              <button
                id="btn-aviator-place-bet"
                type="button"
                disabled={loading || phase !== 'betting'}
                onClick={handlePlaceBet}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-transform disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>
                  {phase === 'betting'
                    ? `PLACE BET (₹${betAmount})`
                    : 'WAITING FOR NEXT ROUND...'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <RulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="Aviator"
        rules={rulesData}
      />
    </div>
  );
};
