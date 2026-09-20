import React from 'react';
import { Play, Sparkles } from 'lucide-react';
import { GameId } from '../types.ts';

export interface GameCardInfo {
  id: GameId;
  name: string;
  tagline: string;
  badge?: string;
  isLive?: boolean;
  activePlayers: number;
  minBet: number;
  maxPayout: string;
  accentColor: string; // e.g., 'from-amber-500/20 to-rose-500/20'
  iconEmoji: string;
  bannerBg: string;
}

interface GameCardProps {
  game: GameCardInfo;
  onPlay: (id: GameId) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, onPlay }) => {
  return (
    <div
      id={`game-card-${game.id}`}
      onClick={() => onPlay(game.id)}
      className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 cursor-pointer select-none"
    >
      {/* Dynamic ambient gradient background */}
      <div
        className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-30 transition-opacity group-hover:opacity-60 bg-gradient-to-br ${game.accentColor}`}
      />

      <div className="relative flex items-start justify-between gap-3">
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-13 h-13 rounded-2xl bg-slate-800/90 border border-slate-700/60 shadow-md text-2xl group-hover:scale-105 group-hover:border-amber-400/60 transition-transform">
            <span>{game.iconEmoji}</span>
            {game.isLive && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-slate-950"></span>
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white tracking-wide group-hover:text-amber-400 transition-colors">
                {game.name}
              </h3>
              {game.badge && (
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {game.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium line-clamp-1">{game.tagline}</p>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {(game.activePlayers ?? 0).toLocaleString()} playing
              </span>
              <span className="text-amber-400/90 font-semibold">Min: ₹{game.minBet}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 font-semibold">{game.maxPayout}</span>
            </div>
          </div>
        </div>

        {/* Right: Action button */}
        <button
          id={`btn-play-${game.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay(game.id);
          }}
          className="self-center p-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 transition-all group-hover:scale-110 active:scale-95 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  );
};
