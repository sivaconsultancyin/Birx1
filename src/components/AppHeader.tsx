import React from 'react';
import { Bell, ArrowLeft } from 'lucide-react';
import { User, Wallet } from '../types.ts';
import { WalletBalance } from './WalletBalance.tsx';

interface AppHeaderProps {
  user: User | null;
  balance?: number;
  wallet?: Wallet;
  notificationCount?: number;
  isDemo?: boolean;
  onOpenWallet: (initialTab?: 'deposit' | 'withdraw') => void;
  onOpenProfile?: () => void;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  user,
  balance,
  wallet,
  notificationCount = 0,
  isDemo = true,
  onOpenWallet,
  onOpenProfile,
  onBack,
  title,
  subtitle
}) => {
  const currentBalance = typeof balance === 'number' ? balance : (wallet?.balance ?? 5000);
  return (
    <header
      id="app-header"
      className="sticky top-0 z-40 w-full bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md px-3.5 py-2.5 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
        {/* Left side: Back button or User info */}
        {onBack ? (
          <div className="flex items-center gap-2.5">
            <button
              id="btn-header-back"
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-transform active:scale-90 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {title && (
              <div>
                <h1 className="text-sm font-black text-white tracking-wide uppercase">{title}</h1>
                {subtitle && <p className="text-[10px] text-amber-400/80 font-medium">{subtitle}</p>}
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={onOpenProfile}
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
            title="Open Profile & Settings"
          >
            <div className="relative">
              <img
                src={
                  user?.avatarUrl ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
                }
                alt={user?.username || 'User'}
                className="w-9 h-9 rounded-full object-cover border-2 border-amber-500/60 ring-2 ring-slate-900 shadow-md"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-950 ring-1 ring-emerald-400" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-wide">
                  {user?.username || 'Brix Player'}
                </span>
                <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {user?.vipTier || 'Gold'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{user?.mobile || '+91 98*** **420'}</p>
            </div>
          </div>
        )}

        {/* Right side: Wallet chip & Quick Actions */}
        <div className="flex items-center gap-2">
          <div onClick={() => onOpenWallet()} className="cursor-pointer">
            <WalletBalance
              balance={currentBalance}
              isDemo={isDemo}
              size="sm"
              onAddMoney={() => onOpenWallet('deposit')}
            />
          </div>

          <button
            id="btn-header-notifications"
            type="button"
            onClick={() => alert('No new notifications')}
            className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
          </button>
        </div>
      </div>
    </header>
  );
};
