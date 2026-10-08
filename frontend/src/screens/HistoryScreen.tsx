import React, { useState, useEffect } from 'react';
import { History as HistoryIcon, Filter, Trophy, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { GameHistoryRecord, GameId } from '../types.ts';
import { gamesApi } from '../api/client.ts';
import { HistoryItem } from '../components/HistoryItem.tsx';
import { LoadingState } from '../components/CommonStates.tsx';

export const HistoryScreen: React.FC = () => {
  const [history, setHistory] = useState<GameHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [selectedGame, setSelectedGame] = useState<string>('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await gamesApi.getHistory();
      setHistory(res.history);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const filtered = history.filter((item) => {
    const profit = item.netProfit ?? (item.winAmount - item.betAmount);
    if (filter === 'win' && profit <= 0) return false;
    if (filter === 'loss' && profit >= 0) return false;
    if (selectedGame !== 'all' && item.gameId !== selectedGame) return false;
    return true;
  });

  const totalBets = history.reduce((sum, h) => sum + h.betAmount, 0);
  const totalWins = history.reduce((sum, h) => sum + h.winAmount, 0);
  const netPnL = totalWins - totalBets;

  return (
    <div id="screen-history" className="px-3 pb-24 space-y-3">
      {/* Title & Stats Summary */}
      <div className="pt-1 flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <HistoryIcon className="w-5 h-5 text-amber-500" />
            Game History
          </h2>
          <p className="text-[11px] text-slate-400">Audited settlement history</p>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total P&L</span>
          <span
            className={`text-xs font-black ${
              (netPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {(netPnL ?? 0) >= 0 ? `+₹${(netPnL ?? 0).toLocaleString('en-IN')}` : `-₹${Math.abs(netPnL ?? 0).toLocaleString('en-IN')}`}
          </span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`py-1.5 px-3 rounded-xl text-xs font-bold shrink-0 border cursor-pointer ${
            filter === 'all'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}
        >
          All Bets ({history.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter('win')}
          className={`py-1.5 px-3 rounded-xl text-xs font-bold shrink-0 border cursor-pointer ${
            filter === 'win'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
              : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}
        >
          Wins Only
        </button>

        <button
          type="button"
          onClick={() => setFilter('loss')}
          className={`py-1.5 px-3 rounded-xl text-xs font-bold shrink-0 border cursor-pointer ${
            filter === 'loss'
              ? 'bg-rose-500 text-white border-rose-400'
              : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}
        >
          Losses
        </button>
      </div>

      {/* Game Filter Dropdown */}
      <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-xl p-2 text-xs">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-400 font-medium">Game:</span>
        <select
          id="select-history-game"
          value={selectedGame}
          onChange={(e) => setSelectedGame(e.target.value)}
          className="bg-transparent text-white font-bold focus:outline-none cursor-pointer flex-1"
        >
          <option value="all" className="bg-slate-900 text-white">All 6 Games</option>
          <option value="roulette" className="bg-slate-900 text-white">Roulette</option>
          <option value="teen-patti" className="bg-slate-900 text-white">Teen Patti</option>
          <option value="aviator" className="bg-slate-900 text-white">Aviator</option>
          <option value="dice" className="bg-slate-900 text-white">Dice</option>
          <option value="dragon-tiger" className="bg-slate-900 text-white">Dragon Tiger</option>
          <option value="andar-bahar" className="bg-slate-900 text-white">Andar Bahar</option>
        </select>
      </div>

      {/* History List */}
      {loading ? (
        <LoadingState message="Fetching your gameplay record..." />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <HistoryItem key={item.id} record={item} />
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-xs text-slate-500">
              No game records match this filter
            </div>
          )}
        </div>
      )}
    </div>
  );
};
