import React from 'react';
import { Wallet as WalletIcon } from 'lucide-react';

interface WalletBalanceProps {
  balance: number;
  isDemo?: boolean;
  onAddMoney?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showAddBtn?: boolean;
}

export const WalletBalance: React.FC<WalletBalanceProps> = ({
  balance,
  isDemo = true,
  onAddMoney,
  size = 'md',
  showAddBtn = true
}) => {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(balance ?? 0);

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  return (
    <div
      id="wallet-balance-container"
      className={`inline-flex items-center gap-2 rounded-full bg-slate-900/90 border border-amber-500/30 shadow-inner backdrop-blur-md ${sizeClasses[size]}`}
    >
      <div className="flex items-center gap-1.5 text-amber-400 font-bold tracking-wide">
        <WalletIcon className="w-3.5 h-3.5 text-amber-400" />
        <span>{formatted}</span>
      </div>

      {isDemo && (
        <span
          id="demo-badge"
          className="text-[10px] uppercase font-extrabold tracking-wider bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40"
        >
          DEMO
        </span>
      )}

      {showAddBtn && onAddMoney && (
        <button
          id="btn-quick-add-money"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddMoney();
          }}
          className="ml-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 font-black text-xs leading-none shadow transition-transform active:scale-90 cursor-pointer"
          title="Add Money"
        >
          +
        </button>
      )}
    </div>
  );
};
