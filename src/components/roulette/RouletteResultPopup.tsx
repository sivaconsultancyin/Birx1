import React, { useEffect, useState } from 'react';
import { Trophy, XCircle, X } from 'lucide-react';
import { RED_NUMBERS_SET } from './RouletteWheel.tsx';

interface RouletteResultPopupProps {
  isOpen: boolean;
  onClose: () => void;
  isWin: boolean;
  winningNumber: number;
  winningColor: 'red' | 'black' | 'green';
  winningCategory?: string;
  winAmount: number;
  betAmount: number;
  netProfit: number;
  roundId: string;
  durationMs?: number;
}

export const RouletteResultPopup: React.FC<RouletteResultPopupProps> = ({
  isOpen,
  onClose,
  isWin,
  winningNumber,
  winningColor,
  winningCategory,
  winAmount,
  betAmount,
  netProfit,
  roundId,
  durationMs = 3500
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isOpen) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    const timer = setTimeout(() => {
      onClose();
    }, durationMs);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [isOpen, durationMs, onClose]);

  if (!isOpen) return null;

  const isRed = RED_NUMBERS_SET.has(winningNumber);
  const isZero = winningNumber === 0;

  return (
    <div
      id="roulette-result-popup"
      role="dialog"
      aria-modal="false"
      aria-label={isWin ? 'Win notification' : 'Loss notification'}
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[88%] max-w-xs rounded-2xl p-3 shadow-2xl backdrop-blur-md border transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
        isWin
          ? 'bg-slate-900/95 border-emerald-500/50 shadow-emerald-500/20'
          : 'bg-slate-900/95 border-rose-500/40 shadow-rose-500/20'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {isWin ? (
            <>
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                YOU WON!
              </span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                YOU LOST
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono font-medium">
            {roundId}
          </span>
          <button
            id="btn-close-result-popup"
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex items-center justify-between bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80">
        {/* Winning Number Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shadow-inner border ${
              isZero
                ? 'bg-emerald-600 border-emerald-400'
                : isRed
                ? 'bg-rose-600 border-rose-400'
                : 'bg-slate-900 border-slate-600'
            }`}
          >
            {winningNumber}
          </div>
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-slate-200">
              {isZero ? '0 GREEN' : `${winningNumber} ${winningColor.toUpperCase()}`}
            </div>
            <div className="text-[10px] text-slate-400 truncate max-w-[110px]">
              {winningCategory ? winningCategory.split(' • ')[1] || 'Single Pocket' : 'Pocket'}
            </div>
          </div>
        </div>

        {/* Outcome Amount */}
        <div className="text-right">
          {isWin ? (
            <>
              <div className="text-base font-black text-emerald-400">
                +₹{(winAmount ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-300/80 font-medium">
                Profit: +₹{(netProfit ?? 0) > 0 ? (netProfit ?? 0).toLocaleString() : (winAmount ?? 0).toLocaleString()}
              </div>
            </>
          ) : (
            <>
              <div className="text-base font-black text-rose-400">
                -₹{(betAmount ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400">
                Try next round!
              </div>
            </>
          )}
        </div>
      </div>

      {/* Auto-Dismiss Progress Bar */}
      <div className="mt-2 h-0.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-75 ease-linear ${
            isWin ? 'bg-emerald-400' : 'bg-rose-400'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
