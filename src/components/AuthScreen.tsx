import React, { useState } from 'react';
import { KeyRound, User as UserIcon, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import { authApi } from '../api/client.ts';
import { User } from '../types.ts';

interface AuthScreenProps { onSuccess: (user: User) => void; }

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccessMsg(null);
    const digits = mobile.replace(/\D/g, '');
    if (digits.length !== 10) return setError('Please enter a valid 10-digit mobile number.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (mode === 'register' && username.trim().length < 3) return setError('Username must be at least 3 characters.');

    setLoading(true);
    try {
      const res = mode === 'login'
        ? await authApi.login(digits, password)
        : await authApi.register(digits, password, username.trim());
      setSuccessMsg(mode === 'login' ? 'Login successful!' : 'Account created successfully!');
      setTimeout(() => onSuccess(res.user), 300);
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally { setLoading(false); }
  };

  return (
    <div id="auth-screen" className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-6 max-w-md mx-auto">
      <div className="pt-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 p-0.5 shadow-xl shadow-amber-500/20 mb-3">
          <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center font-black text-2xl text-amber-400">BX</div>
        </div>
        <h1 className="text-2xl font-black tracking-wider uppercase">BRIX GAMES</h1>
        <p className="text-xs text-slate-400 mt-1">Play responsibly • 18+ Only</p>
      </div>

      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md my-auto">
        <div className="flex rounded-xl bg-slate-950 p-1 mb-5 border border-slate-800">
          {(['login','register'] as const).map(m => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === m ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>
              {m === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">{error}</div>}
        {successMsg && <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{successMsg}</div>}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Username</label>
              <div className="relative"><UserIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400"/>
                <input id="input-register-username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter gamer handle"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-amber-500" required />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Mobile Number</label>
            <input id="input-mobile-number" type="tel" inputMode="numeric" maxLength={10} value={mobile}
              onChange={e=>setMobile(e.target.value.replace(/\D/g,''))} placeholder="98765 43210"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-amber-500" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Password</label>
            <div className="relative"><KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400"/>
              <input id="input-password" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-amber-500" required />
            </div>
          </div>
          <button id="btn-auth-submit" type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Please wait...' : <><span>{mode === 'login' ? 'Login' : 'Create Account'}</span><ArrowRight className="w-4 h-4"/></>}
          </button>
        </form>
      </div>

      <div className="pb-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><Shield className="w-3.5 h-3.5 text-emerald-500"/><span>Supabase Auth • Server Verified</span></div>
      </div>
    </div>
  );
};
