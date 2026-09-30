import React, { useEffect, useMemo, useState } from 'react';

type Props = {
  isSpinning: boolean;
  targetWinningNumber: number | null;
  onSpinComplete?: () => void;
};

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

export const ExternalRouletteWheel: React.FC<Props> = ({ isSpinning, targetWinningNumber, onSpinComplete }) => {
  const [rotation, setRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const data = useMemo(() => ORDER, []);

  useEffect(() => {
    if (!isSpinning) return;
    const idx = Math.max(0, data.indexOf(targetWinningNumber ?? 0));
    const segment = 360 / data.length;
    setRotation(prev => prev + 360 * 5 - (prev % 360) - idx * segment);
    setBallRotation(prev => prev - 360 * 7);
    const timer = window.setTimeout(() => onSpinComplete?.(), 4200);
    return () => window.clearTimeout(timer);
  }, [isSpinning, targetWinningNumber, data, onSpinComplete]);

  return (
    <div className="relative flex items-center justify-center rounded-full bg-black p-2 shadow-[0_0_50px_rgba(245,158,11,0.18)] border border-amber-500/20">
      <div className="relative h-[min(82vw,430px)] w-[min(82vw,430px)] [perspective:900px]">
        <div className="absolute inset-0 rounded-full border-[10px] border-amber-500 bg-[#080808] shadow-[inset_0_0_0_3px_#fbbf24,0_0_35px_rgba(245,158,11,.2)]" />
        <div
          className="absolute inset-[6%] rounded-full border-[7px] border-[#d69a2e] transition-transform duration-[4.2s] ease-out [transform:rotateX(12deg)]"
          style={{
            transform: `rotateX(12deg) rotateZ(${rotation}deg)`,
            background: `conic-gradient(${data.map((n,i) => {
              const color = n === 0 ? '#15803d' : RED.has(n) ? '#b91c1c' : '#111111';
              return `${color} ${i*(100/37)}% ${(i+1)*(100/37)}%`;
            }).join(',')})`,
          }}
        >
          {data.map((n, i) => {
            const angle = i * (360 / 37);
            const rad = angle * Math.PI / 180;
            const x = 50 + Math.sin(rad) * 40;
            const y = 50 - Math.cos(rad) * 40;
            return (
              <span
                key={n}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 text-[11px] font-black text-white drop-shadow-[0_2px_3px_#000] sm:text-sm"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                {n}
              </span>
            );
          })}
        </div>
        <div className="absolute inset-[18%] z-10 rounded-full border-[10px] border-[#9b681b] bg-[radial-gradient(circle,#5d3c12_0,#1b1208_48%,#050505_72%)] shadow-inner" />
        <div
          className="absolute inset-[8%] z-50 pointer-events-none transition-transform duration-[4.2s] ease-out"
          style={{ transform: `rotate(${ballRotation}deg)` }}
        >
          <div className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-full border border-slate-300 bg-white shadow-[0_0_10px_rgba(255,255,255,.95),0_3px_6px_#000]" />
        </div>
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-400 bg-slate-950 shadow-lg" />
      </div>
      <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 text-amber-300 text-lg">▼</div>
    </div>
  );
};
