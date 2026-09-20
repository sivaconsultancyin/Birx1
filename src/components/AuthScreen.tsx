import React, { useState } from 'react';
import { Phone, KeyRound, User as UserIcon, Shield, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { authApi } from '../api/client.ts';
import { User } from '../types.ts';

interface AuthScreenProps {
  onSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || mobile.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await authApi.sendOtp(mobile);
      setOtpSent(true);
      setSuccessMsg(`OTP sent! (Use demo code: ${res.demoOtp})`);
      setOtp(res.demoOtp); // pre-populate for demo convenience
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setError('Please enter the 4-digit OTP code');
      return;
    }

    if (mode === 'register' && (!username || username.trim().length < 3)) {
      setError('Username must be at least 3 characters');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        const res = await authApi.verifyOtp(mobile, otp);
        setSuccessMsg('Login successful! Redirecting...');
        setTimeout(() => onSuccess(res.user), 600);
      } else {
        const res = await authApi.register(mobile, otp, username);
        setSuccessMsg('Account registered successfully! Redirecting...');
        setTimeout(() => onSuccess(res.user), 600);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoLogin = () => {
    setMobile('9876543210');
    setOtp('1234');
    setUsername('LuckyBrix');
    setOtpSent(true);
    setError(null);
  };

  return (
    <div
      id="auth-screen"
      className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-6 max-w-md mx-auto"
    >
      {/* Brand Header */}
      <div className="pt-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 p-0.5 shadow-xl shadow-amber-500/20 mb-3">
          <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center font-black text-2xl text-amber-400">
            BX
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-wider uppercase text-white">BRIX GAMES</h1>
        <p className="text-xs text-slate-400 mt-1">Play responsibly • 18+ Only</p>
      </div>

      {/* Auth Card */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md my-auto">
        {/* Toggle Mode */}
        <div className="flex rounded-xl bg-slate-950 p-1 mb-5 border border-slate-800">
          <button
            id="tab-login-mode"
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            id="tab-register-mode"
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div
            id="auth-error-msg"
            className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium leading-tight"
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            id="auth-success-msg"
            className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Mobile Number
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 flex items-center gap-1.5 text-slate-400 text-xs font-semibold border-r border-slate-700 pr-2">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  id="input-mobile-number"
                  type="tel"
                  maxLength={10}
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-20 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              id="btn-send-otp"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Sending OTP...</span>
              ) : (
                <>
                  <span>Get OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOrRegister} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative flex items-center">
                  <UserIcon className="absolute left-3.5 w-4 h-4 text-slate-400" />
                  <input
                    id="input-register-username"
                    type="text"
                    placeholder="Enter gamer handle"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Enter 4-Digit OTP
                </label>
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                >
                  Change Number
                </button>
              </div>
              <div className="relative flex items-center">
                <KeyRound className="absolute left-3.5 w-4 h-4 text-slate-400" />
                <input
                  id="input-otp-code"
                  type="text"
                  maxLength={4}
                  placeholder="1234"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-center font-mono tracking-widest text-lg font-bold text-amber-400 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              id="btn-verify-continue"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Verifying...</span>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Demo Fast Fill Button */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
          <button
            id="btn-auto-demo-login"
            type="button"
            onClick={fillDemoLogin}
            className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-amber-300/90 text-xs font-bold border border-amber-500/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Fast Fill Demo Account (1-Click)</span>
          </button>
        </div>
      </div>

      {/* Footer Security Badge */}
      <div className="pb-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>256-Bit SSL Encrypted • Server Auth Verified</span>
        </div>
      </div>
    </div>
  );
};
