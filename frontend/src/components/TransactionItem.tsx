import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Award, Dices, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Transaction } from '../types.ts';

interface TransactionItemProps {
  transaction: Transaction;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const isPositive =
    transaction.type === 'deposit' || transaction.type === 'payout' || transaction.type === 'bonus';

  const typeIcons = {
    deposit: ArrowDownLeft,
    withdrawal: ArrowUpRight,
    payout: Award,
    bet: Dices,
    bonus: Award
  };

  const Icon = typeIcons[transaction.type] || Dices;

  const statusBadges = {
    success: { label: 'Success', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    pending: { label: 'Pending', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    failed: { label: 'Failed', color: 'text-red-400 bg-red-500/10 border-red-500/30' }
  };

  const status = statusBadges[transaction.status];

  return (
    <div
      id={`tx-item-${transaction.id}`}
      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
            isPositive
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wide">{transaction.description}</span>
            <span
              className={`text-[9px] uppercase font-black px-1.5 py-0.2 rounded border ${status.color}`}
            >
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
            <span className="font-mono">{transaction.referenceId}</span>
            <span>•</span>
            <span>{transaction?.createdAt ? new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          </div>
        </div>
      </div>

      <div className="text-right">
        <span
          className={`text-sm font-black tracking-tight ${
            isPositive ? 'text-emerald-400' : 'text-slate-300'
          }`}
        >
          {isPositive ? '+' : '-'}₹{(transaction?.amount ?? 0).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  );
};
