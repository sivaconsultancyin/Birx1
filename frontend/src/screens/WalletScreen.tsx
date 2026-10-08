import React, { useState, useEffect } from 'react';
import {
  Wallet as WalletIcon,
  PlusCircle,
  ArrowDownToLine,
  History,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  Smartphone
} from 'lucide-react';
import { Transaction, Wallet } from '../types.ts';
import { walletApi } from '../api/client.ts';
import { TransactionItem } from '../components/TransactionItem.tsx';
import { LoadingState } from '../components/CommonStates.tsx';

interface WalletScreenProps {
  wallet: Wallet;
  initialTab?: 'deposit' | 'withdraw';
  onUpdateWallet: (w: Wallet) => void;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({
  wallet,
  initialTab = 'deposit',
  onUpdateWallet
}) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'transactions'>(initialTab);
  const [depositAmount, setDepositAmount] = useState<number>(500);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(1000);
  const [upiId, setUpiId] = useState<string>('player@okhdfcbank');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'NetBanking' | 'Card'>('UPI');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const quickAmounts = [100, 500, 1000, 2500, 5000, 10000];

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const res = await walletApi.getTransactions();
      setTransactions(res.transactions);
    } catch {
      // ignore
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount < 100) {
      setErrorMsg('Minimum deposit is ₹100');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await walletApi.deposit(depositAmount, paymentMethod);
      onUpdateWallet(res.wallet);
      setSuccessMsg(`Successfully added ₹${depositAmount.toLocaleString('en-IN')} to your wallet!`);
      loadTransactions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmount < 500) {
      setErrorMsg('Minimum withdrawal is ₹500');
      return;
    }
    if (wallet.balance < withdrawAmount) {
      setErrorMsg('Insufficient available balance');
      return;
    }
    if (!upiId || !upiId.includes('@')) {
      setErrorMsg('Please enter a valid UPI ID (e.g., yourname@okhdfcbank)');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await walletApi.withdraw(withdrawAmount, upiId);
      onUpdateWallet(res.wallet);
      setSuccessMsg(`Withdrawal request of ₹${withdrawAmount.toLocaleString('en-IN')} initiated via UPI!`);
      loadTransactions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="screen-wallet" className="px-3 pb-24 space-y-4">
      {/* Wallet Balance Card */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-600/30 via-slate-900 to-slate-950 border border-amber-500/40 p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <WalletIcon className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase font-extrabold tracking-wider text-slate-300">
              Total Balance
            </span>
          </div>
          {wallet.isDemo && (
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Demo Reserve
            </span>
          )}
        </div>

        <div className="text-3xl font-black text-white tracking-tight mb-3">
          ₹{(wallet?.balance ?? 0).toLocaleString('en-IN')}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
          <div>
            <span className="block text-[10px] text-slate-500 uppercase">Deposit Cash</span>
            <span className="font-bold text-white">₹{(wallet?.balance ?? 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] text-slate-500 uppercase">Bonus Cash</span>
            <span className="font-bold text-amber-400">₹{(wallet?.bonus ?? 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
        <button
          id="tab-wallet-deposit"
          type="button"
          onClick={() => {
            setActiveTab('deposit');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'deposit'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Add Money
        </button>

        <button
          id="tab-wallet-withdraw"
          type="button"
          onClick={() => {
            setActiveTab('withdraw');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'withdraw'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Withdraw
        </button>

        <button
          id="tab-wallet-transactions"
          type="button"
          onClick={() => {
            setActiveTab('transactions');
            setErrorMsg(null);
            setSuccessMsg(null);
            loadTransactions();
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'transactions'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          History
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab 1: DEPOSIT */}
      {activeTab === 'deposit' && (
        <form onSubmit={handleDeposit} className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
              Select or Enter Amount
            </label>
            <div className="relative mb-3">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-400">
                ₹
              </span>
              <input
                id="input-deposit-amount"
                type="number"
                min={100}
                value={depositAmount}
                onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-8 pr-4 text-base font-black text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            {/* Quick chips */}
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setDepositAmount(amt)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    depositAmount === amt
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  +₹{amt.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
              Payment Gateway
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`py-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                  paymentMethod === 'UPI'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span className="text-[11px] font-bold">UPI / GPay</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('NetBanking')}
                className={`py-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                  paymentMethod === 'NetBanking'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span className="text-[11px] font-bold">NetBanking</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Card')}
                className={`py-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                  paymentMethod === 'Card'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span className="text-[11px] font-bold">Debit / Credit</span>
              </button>
            </div>
          </div>

          <button
            id="btn-confirm-deposit"
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-transform disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{loading ? 'Processing Deposit...' : `Proceed to Pay ₹${depositAmount}`}</span>
          </button>
        </form>
      )}

      {/* Tab 2: WITHDRAW */}
      {activeTab === 'withdraw' && (
        <form onSubmit={handleWithdraw} className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
              Withdrawal Amount (Min ₹500)
            </label>
            <div className="relative mb-3">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-400">
                ₹
              </span>
              <input
                id="input-withdraw-amount"
                type="number"
                min={500}
                max={wallet.balance}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-8 pr-4 text-base font-black text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
              Receiving UPI ID
            </label>
            <input
              id="input-withdraw-upi"
              type="text"
              placeholder="e.g. mobile@upi or name@okaxis"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 mb-2"
              required
            />

            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Instant direct credit to your bank account via UPI</span>
            </div>
          </div>

          <button
            id="btn-confirm-withdraw"
            type="submit"
            disabled={loading || wallet.balance < 500}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-transform disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>{loading ? 'Processing Withdrawal...' : `Withdraw ₹${withdrawAmount}`}</span>
          </button>
        </form>
      )}

      {/* Tab 3: TRANSACTION HISTORY */}
      {activeTab === 'transactions' && (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} />
          ))}

          {transactions.length === 0 && (
            <div className="text-center py-12 text-xs text-slate-500">No transactions recorded yet</div>
          )}
        </div>
      )}
    </div>
  );
};
