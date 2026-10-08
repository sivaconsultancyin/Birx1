import React from 'react';
import { GameHistoryEntry } from '../types.ts';

interface HistoryItemProps {
  entry: GameHistoryEntry;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({ entry }) => {
  const isWin = entry.winAmount > 0;
  const net = entry.winAmount - entry.betAmount;

  return (
    <div
      id={`history-entry-${entry.id}`}
      className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-white">{entry.gameName}</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
              isWin
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}
          >
            {isWin ? 'WON' : 'LOST'}
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          {new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
          {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="text-slate-400">
          <span>Bet: </span>
          <span className="text-slate-200 font-semibold">₹{entry.betAmount}</span>
          <span className="mx-1.5">•</span>
          <span className="text-slate-300 font-medium">{entry.outcome}</span>
        </div>

        <div className="text-right font-black">
          <span className={net >= 0 ? 'text-emerald-400' : 'text-slate-400'}>
            {net >= 0 ? `+₹${net}` : `-₹${entry.betAmount}`}
          </span>
          {entry.multiplier > 0 && (
            <span className="text-[10px] text-amber-400/90 ml-1 font-mono">({entry.multiplier}x)</span>
          )}
        </div>
      </div>
    </div>
  );
};
