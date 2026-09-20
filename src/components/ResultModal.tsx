import React from 'react';
import { Trophy, AlertCircle, RotateCcw, X } from 'lucide-react';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  isWin: boolean;
  winAmount: number;
  betAmount?: number;
  multiplier?: number;
  gameName: string;
  summaryText: string;
  onPlayAgain?: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  onClose,
  isWin,
  winAmount,
  betAmount = 0,
  multiplier = 0,
  gameName,
  summaryText,
  onPlayAgain
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="result-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="result-modal-card"
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm rounded-2xl p-6 border text-center shadow-2xl overflow-hidden ${
          isWin
            ? 'bg-gradient-to-b from-amber-950/90 via-slate-900 to-slate-950 border-amber-500/60 shadow-amber-500/20'
            : 'bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-slate-700/60 shadow-black/60'
        }`}
      >
        {/* Ambient Top Glow */}
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-3xl pointer-events-none ${
            isWin ? 'bg-amber-500/30' : 'bg-slate-700/20'
          }`}
        />

        <button
          id="btn-close-result-modal"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative mb-3 flex justify-center">
          {isWin ? (
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-500/40 animate-bounce">
              <Trophy className="w-8 h-8 text-slate-950" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
          )}
        </div>

        <div className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-1">{gameName}</div>
        <h3 className={`text-2xl font-black mb-1 ${isWin ? 'text-amber-400' : 'text-slate-200'}`}>
          {isWin ? 'CONGRATULATIONS!' : 'BETTER LUCK NEXT ROUND'}
        </h3>

        <p className="text-xs text-slate-300 mb-4 px-2">{summaryText}</p>

        {isWin ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-5">
            <div className="text-[11px] uppercase font-bold text-amber-300/80">TOTAL WINNINGS</div>
            <div className="text-3xl font-extrabold text-amber-400 tracking-tight">
              ₹{(winAmount ?? 0).toLocaleString('en-IN')}
            </div>
            {multiplier > 0 && (
              <div className="text-xs text-amber-300/90 mt-0.5 font-semibold">Multiplier: {multiplier}x</div>
            )}
          </div>
        ) : (
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 mb-5 text-xs text-slate-400">
            {betAmount > 0 && <span>Lost Bet: ₹{betAmount}</span>}
          </div>
        )}

        <div className="flex gap-2">
          {onPlayAgain && (
            <button
              id="btn-play-again"
              type="button"
              onClick={() => {
                onClose();
                onPlayAgain();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-transform active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Next Round</span>
            </button>
          )}
          <button
            id="btn-dismiss-result"
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
