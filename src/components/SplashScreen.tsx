import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onFinish, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 250);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div
      id="splash-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-8 max-w-md mx-auto"
    >
      <div className="w-full flex justify-end">
        <span className="text-[10px] font-mono tracking-widest text-amber-400/80 bg-slate-900/80 px-2 py-1 rounded border border-amber-500/20">
          v2.4.0 • PRO
        </span>
      </div>

      <div className="flex flex-col items-center text-center">
        {/* Animated Brand Emblem */}
        <div className="relative mb-6">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-amber-500 to-yellow-400 opacity-20 blur-xl animate-pulse" />
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 p-0.5 shadow-2xl shadow-amber-500/30">
            <div className="w-full h-full rounded-[22px] bg-slate-950 flex flex-col items-center justify-center border border-amber-400/40">
              <span className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500">
                BX
              </span>
              <div className="flex gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-300">
          BRIX GAMES
        </h1>
        <p className="text-xs text-amber-400/90 font-medium tracking-widest uppercase mt-1">
          Premium Indian Gaming Suite
        </p>

        {/* 6 Icons row in splash */}
        <div className="flex items-center gap-2 mt-6 text-lg bg-slate-900/60 px-4 py-2 rounded-full border border-slate-800">
          <span title="Roulette">🎰</span>
          <span title="Teen Patti">🃏</span>
          <span title="Aviator">🚀</span>
          <span title="Dice">🎲</span>
          <span title="Dragon Tiger">🐉</span>
          <span title="Andar Bahar">🪔</span>
        </div>
      </div>

      <div className="w-full max-w-xs flex flex-col items-center">
        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3 border border-slate-700/50">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between w-full text-[11px] text-slate-400 font-medium px-1">
          <span className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Server Authoritative
          </span>
          <span className="text-amber-400 font-mono font-bold">{progress}%</span>
        </div>
      </div>
    </div>
  );
};
