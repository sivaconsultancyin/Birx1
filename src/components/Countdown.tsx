import React from 'react';
import { Timer } from 'lucide-react';

interface CountdownProps {
  seconds: number;
  maxSeconds?: number;
  label?: string;
  size?: 'sm' | 'md';
  phase?: 'betting' | 'closed' | 'spinning' | 'result';
}

export const Countdown: React.FC<CountdownProps> = ({
  seconds,
  maxSeconds = 15,
  label = 'Betting Closes in',
  size = 'md',
  phase = 'betting'
}) => {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const isUrgent = phase === 'betting' && safeSeconds <= 3;
  const percent = Math.max(0, Math.min(100, (safeSeconds / Math.max(1, maxSeconds)) * 100));
  const phaseLabel =
    phase === 'spinning' ? 'Wheel Spinning' :
    phase === 'closed' ? 'Bets Closed' :
    phase === 'result' ? 'Result In' : label;

  return (
    <div
      id="countdown-timer"
      className="inline-flex min-w-[170px] flex-col gap-1 rounded-xl border border-slate-700/60 bg-slate-950/90 px-3 py-2 backdrop-blur-md transition-all duration-300"
    >
      <div className="flex items-center gap-2">
        <Timer className={`h-4 w-4 transition-colors duration-300 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
        <span className="text-xs font-medium text-slate-400">{phaseLabel}</span>
        <span
          id="countdown-seconds"
          className={`ml-auto font-black tabular-nums tracking-wider transition-all duration-300 ${size === 'sm' ? 'text-sm' : 'text-base'} ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}
        >
          {safeSeconds}s
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full origin-left transition-[width] duration-700 ease-out ${isUrgent ? 'bg-red-500' : 'bg-amber-400'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
