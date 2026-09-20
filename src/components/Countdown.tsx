import React from 'react';
import { Timer } from 'lucide-react';

interface CountdownProps {
  seconds: number;
  maxSeconds?: number;
  label?: string;
  size?: 'sm' | 'md';
}

export const Countdown: React.FC<CountdownProps> = ({
  seconds,
  maxSeconds = 15,
  label = 'Betting Closes in',
  size = 'md'
}) => {
  const isUrgent = seconds <= 3;
  const percent = Math.max(0, Math.min(100, (seconds / maxSeconds) * 100));

  return (
    <div
      id="countdown-timer"
      className={`inline-flex items-center gap-2 rounded-xl bg-slate-900/90 border px-3 py-1.5 backdrop-blur-md transition-all ${
        isUrgent
          ? 'border-red-500/80 text-red-400 animate-pulse bg-red-950/40'
          : 'border-slate-700/60 text-slate-300'
      }`}
    >
      <Timer className={`w-4 h-4 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
      <span className="text-xs font-medium text-slate-400">{label}:</span>
      <span
        id="countdown-seconds"
        className={`font-black tracking-wider ${size === 'sm' ? 'text-sm' : 'text-base'} ${
          isUrgent ? 'text-red-400 scale-105' : 'text-amber-400'
        }`}
      >
        {seconds}s
      </span>
    </div>
  );
};
