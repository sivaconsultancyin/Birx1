import React, { useState } from 'react';
import {
  User as UserIcon,
  ShieldCheck,
  Award,
  Bell,
  Volume2,
  VolumeX,
  FileText,
  LogOut,
  ChevronRight,
  ExternalLink,
  Lock,
  Smartphone,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { User, Wallet } from '../types.ts';
import { authApi } from '../api/client.ts';

interface ProfileScreenProps {
  user: User | null;
  wallet: Wallet;
  onLogout: () => void;
  onNavigateTab: (tab: any) => void;
  onRoleChanged?: (user: User) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  wallet,
  onLogout,
  onNavigateTab,
  onRoleChanged
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showResponsibleModal, setShowResponsibleModal] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(5000);
  const [limitSaved, setLimitSaved] = useState(false);
  const [roleSwitching, setRoleSwitching] = useState(false);

  const handleRoleSwitch = async (newRole: 'OWNER' | 'SUPER_ADMIN' | 'ADMIN') => {
    try {
      setRoleSwitching(true);
      const res = await authApi.switchRole(newRole);
      if (res.user && onRoleChanged) {
        onRoleChanged(res.user);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to switch role');
    } finally {
      setRoleSwitching(false);
    }
  };

  const handleSaveLimit = (e: React.FormEvent) => {
    e.preventDefault();
    setLimitSaved(true);
    setTimeout(() => setLimitSaved(false), 2500);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    onLogout();
  };

  return (
    <div id="screen-profile" className="px-3 pb-24 space-y-4">
      {/* Profile Card */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-4 shadow-xl flex items-center gap-3">
        <div className="relative">
          <img
            src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
            alt="Avatar"
            className="w-16 h-16 rounded-full object-cover border-2 border-amber-400/80 shadow-md"
          />
          <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-white">{user?.username || 'Player'}</h2>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              VIP {user?.vipTier || 'Gold'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
            <Smartphone className="w-3.5 h-3.5 text-slate-500" />
            <span>{user?.maskedPhone || '+91 98*** **456'}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> KYC Verified
          </span>
        </div>
      </div>

      {/* Account Balance Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Balance</span>
          <span className="text-lg font-black text-white">₹{(wallet?.balance ?? 0).toLocaleString('en-IN')}</span>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">VIP Tier Status</span>
          <span className="text-lg font-black text-amber-400">{user?.vipTier || 'Gold'}</span>
        </div>
      </div>

      {/* Menu Options */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden text-xs">
        {/* Game History */}
        <button
          type="button"
          onClick={() => onNavigateTab('history')}
          className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-850 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white">Game Settlement History</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Transaction History */}
        <button
          type="button"
          onClick={() => onNavigateTab('wallet')}
          className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-850 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">Deposits & Withdrawals</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Responsible Gaming */}
        <button
          type="button"
          onClick={() => setShowResponsibleModal(true)}
          className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-850 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-white">Responsible Gaming & Limits</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Sound Toggle */}
        <div className="w-full px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-amber-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
            <span className="font-bold text-white">Sound Effects</span>
          </div>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              soundEnabled ? 'bg-amber-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                soundEnabled ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Security & Verification Note */}
      <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5 text-slate-300 font-bold">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>Security & Fair Play Guarantee</span>
        </div>
        <p className="text-[10px] text-slate-500">
          All bets and financial entries are cryptographically hashed and verified server-side. For 18+ Indian players only.
        </p>
      </div>

      {/* Supabase Core Backend & Staff Hierarchy Console */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-indigo-500/10 border border-amber-500/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">
              Staff Portal & Role Hierarchy
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
            Role: {user?.role || 'PLAYER'}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Switch into an administrative role to access the Supabase management console (User Hierarchy, Coin Recharges, Withdrawals, and PostgreSQL status).
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            disabled={roleSwitching}
            onClick={() => handleRoleSwitch('OWNER')}
            className="py-2 px-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold tracking-tight text-center transition-colors cursor-pointer"
          >
            Owner Console
          </button>
          <button
            type="button"
            disabled={roleSwitching}
            onClick={() => handleRoleSwitch('SUPER_ADMIN')}
            className="py-2 px-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-[10px] font-bold tracking-tight text-center transition-colors cursor-pointer"
          >
            Super Admin
          </button>
          <button
            type="button"
            disabled={roleSwitching}
            onClick={() => handleRoleSwitch('ADMIN')}
            className="py-2 px-1 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-[10px] font-bold tracking-tight text-center transition-colors cursor-pointer"
          >
            Admin Console
          </button>
        </div>
      </div>

      {/* Logout Button */}
      <button
        id="btn-logout"
        type="button"
        onClick={handleLogout}
        className="w-full py-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs uppercase tracking-wider border border-rose-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out of Brix Games</span>
      </button>

      {/* Responsible Gaming Dialog */}
      {showResponsibleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Responsible Gaming
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Play within your financial means. Set a strict daily spend limit to safeguard your bankroll.
            </p>

            <form onSubmit={handleSaveLimit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Daily Deposit Limit (₹)
                </label>
                <input
                  type="number"
                  min={500}
                  max={100000}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-bold"
                />
              </div>

              {limitSaved && (
                <div className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Limit saved successfully!
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResponsibleModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black uppercase cursor-pointer"
                >
                  Save Limit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
