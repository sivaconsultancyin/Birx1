import React from 'react';
import { PlusCircle, ArrowDownToLine, Flame, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { GameId, User, Wallet } from '../types.ts';
import { ALL_GAMES } from '../data/games.ts';
import { GameCard } from '../components/GameCard.tsx';

interface HomeScreenProps {
  user: User | null;
  wallet: Wallet;
  onPlayGame: (id: GameId) => void;
  onOpenWallet: (initialTab?: 'deposit' | 'withdraw') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  user,
  wallet,
  onPlayGame,
  onOpenWallet
}) => {
  return (
    <div id="screen-home" className="space-y-4 pb-20">
      {/* Wallet Quick Access Strip */}
      <div className="mx-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-4 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              AVAILABLE BALANCE
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-white tracking-tight">
                ₹{(wallet?.balance ?? 0).toLocaleString('en-IN')}
              </span>
              {(wallet?.bonus ?? 0) > 0 && (
                <span className="text-[11px] font-bold text-amber-400">
                  (+₹{wallet?.bonus} bonus)
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-amber-300/80 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
              VIP {user?.vipTier || 'Gold'}
            </span>
          </div>
        </div>

        {/* Deposit & Withdraw Quick Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
          <button
            id="btn-home-add-money"
            type="button"
            onClick={() => onOpenWallet('deposit')}
            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-transform cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Money</span>
          </button>

          <button
            id="btn-home-withdraw"
            type="button"
            onClick={() => onOpenWallet('withdraw')}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-amber-400" />
            <span>Withdraw</span>
          </button>
        </div>
      </div>

      {/* Featured Banner / Announcement */}
      <div className="mx-3 rounded-2xl bg-gradient-to-r from-amber-600/20 via-slate-900 to-slate-950 border border-amber-500/30 p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-lg">
            ⚡
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wide">
              Daily Cashback & VIP Perks
            </h3>
            <p className="text-[11px] text-slate-400">Get up to 10% instant refund on every game</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenWallet('deposit')}
          className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
        >
          Claim →
        </button>
      </div>

      {/* Main Section: Featured Games (EXACTLY 6 Games) */}
      <div className="px-3 space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              Featured Games (6)
            </h2>
          </div>
          <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Tables Active
          </span>
        </div>

        {/* The 6 Cards */}
        <div className="grid grid-cols-1 gap-2.5">
          {ALL_GAMES.map((game) => (
            <GameCard key={game.id} game={game} onPlay={onPlayGame} />
          ))}
        </div>
      </div>

      {/* Trust & Fairness Footer Badges */}
      <div className="mx-3 mt-4 p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-1 text-slate-400 text-[11px]">
        <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>Server Authoritative Gaming Suite</span>
        </div>
        <p className="text-[10px] text-slate-500">
          Fair Play Certified • 256-Bit SSL Secured • Fast UPI Withdrawals
        </p>
      </div>
    </div>
  );
};
