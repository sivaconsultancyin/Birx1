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
      className="inline-flex w-11 h-11 flex-col items-center justify-center gap-0.5 rounded-full border border-white/20 bg-transparent px-1 py-1 backdrop-blur-0 transition-all duration-300"
    >
      <div className="flex flex-col items-center justify-center gap-0">
        <Timer className={`h-2.5 w-2.5 transition-colors duration-300 ${isUrgent ? 'text-white' : 'text-white'}`} />
        <span className="text-[6px] font-medium text-white/70">{phaseLabel}</span>
        <span
          id="countdown-seconds"
          className={`font-black tabular-nums tracking-wider transition-all duration-300 ${size === 'sm' ? 'text-[11px]' : 'text-base'} ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}
        >
          {safeSeconds}s
        </span>
      </div>
      <div className="hidden">
        <div
          className={`h-full rounded-full origin-left transition-[width] duration-700 ease-out ${isUrgent ? 'bg-white/80' : 'bg-white/50'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
