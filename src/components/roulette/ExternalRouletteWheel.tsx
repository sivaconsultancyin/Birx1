import React, { useEffect, useMemo, useState } from 'react';

type Props = {
  isSpinning: boolean;
  targetWinningNumber: number | null;
  onSpinComplete?: () => void;
};

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

export const ExternalRouletteWheel: React.FC<Props> = ({
  isSpinning,
  targetWinningNumber,
  onSpinComplete,
}) => {
  const [rotation, setRotation] = useState(0);
  const data = useMemo(() => Array.from({ length: 37 }, (_, n) => n), []);

  useEffect(() => {
    if (!isSpinning) return;
    const target = Math.max(0, targetWinningNumber ?? 0);
    const segment = 360 / data.length;
    const targetAngle = 360 - target * segment;
    setRotation(prev => prev + 360 * 5 + targetAngle - (prev % 360));
    const timer = window.setTimeout(() => onSpinComplete?.(), 4200);
    return () => window.clearTimeout(timer);
  }, [isSpinning, targetWinningNumber, data.length, onSpinComplete]);

  return (
    <div className="relative flex items-center justify-center rounded-full bg-slate-950/80 p-3 shadow-[0_0_50px_rgba(245,158,11,0.18)] border border-amber-500/20">
      <div
        className="relative h-[min(78vw,420px)] w-[min(78vw,420px)] rounded-full border-[10px] border-amber-500 shadow-[inset_0_0_0_3px_#fbbf24,0_0_35px_rgba(245,158,11,.2)] transition-transform duration-[4.2s] ease-out"
        style={{
          transform: `rotate(${rotation}deg)`,
          background: `conic-gradient(${data.map((n) => {
            const color = n === 0 ? '#166534' : RED.has(n) ? '#b91c1c' : '#111827';
            return `${color} ${n * (100 / 37)}% ${(n + 1) * (100 / 37)}%`;
          }).join(',')})`,
        }}
      >
        {data.map((n) => {
          const angle = n * (360 / 37) + (180 / 37);
          return (
            <span
              key={n}
              className="absolute left-1/2 top-1/2 text-[10px] font-bold text-white sm:text-xs"
              style={{
                transform: `rotate(${angle}deg) translateY(-${Math.min(34, 34)}%) rotate(-${angle}deg)`,
                transformOrigin: '0 0',
              }}
            >
              {n}
            </span>
          );
        })}
        <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-400 bg-slate-950 shadow-lg" />
      </div>
      <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 text-amber-300">▼</div>
    </div>
  );
};
