import React from 'react';

export const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000];

interface BettingChipProps {
  value: number;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const chipColors: Record<number, { bg: string; border: string; text: string; ring: string }> = {
  10: { bg: 'from-blue-600 to-indigo-700', border: 'border-blue-300/60', text: 'text-white', ring: 'ring-blue-400' },
  50: { bg: 'from-red-600 to-rose-700', border: 'border-red-300/60', text: 'text-white', ring: 'ring-red-400' },
  100: { bg: 'from-emerald-600 to-green-700', border: 'border-emerald-300/60', text: 'text-white', ring: 'ring-emerald-400' },
  500: { bg: 'from-purple-600 to-violet-800', border: 'border-purple-300/60', text: 'text-white', ring: 'ring-purple-400' },
  1000: { bg: 'from-amber-500 to-yellow-600', border: 'border-amber-200/80', text: 'text-slate-950', ring: 'ring-amber-300' },
  5000: { bg: 'from-slate-900 to-zinc-950', border: 'border-amber-400/90', text: 'text-amber-400', ring: 'ring-amber-400' }
};

export const BettingChip: React.FC<BettingChipProps> = ({
  value,
  isSelected = false,
  onClick,
  disabled = false,
  size = 'md'
}) => {
  const scheme = chipColors[value] || chipColors[100];
  const dimensions = size === 'sm' ? 'w-9 h-9 text-[11px]' : 'w-12 h-12 text-xs';

  return (
    <button
      id={`chip-${value}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative flex items-center justify-center rounded-full font-black tracking-tight border-2 dashed transition-all duration-150 select-none cursor-pointer shadow-md ${dimensions} ${scheme.border} bg-gradient-to-br ${scheme.bg} ${scheme.text} ${
        isSelected
          ? `scale-110 shadow-lg ring-4 ring-offset-2 ring-offset-slate-950 ${scheme.ring} z-10 animate-pulse`
          : 'hover:scale-105 active:scale-95 opacity-90 hover:opacity-100'
      } ${disabled ? 'opacity-40 cursor-not-allowed hover:scale-100' : ''}`}
    >
      <div className="absolute inset-1 rounded-full border border-white/20 border-dashed pointer-events-none" />
      <span className="relative drop-shadow">₹{value >= 1000 ? `${value / 1000}k` : value}</span>
    </button>
  );
};
