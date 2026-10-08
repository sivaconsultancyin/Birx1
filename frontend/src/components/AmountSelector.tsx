import React from 'react';

interface AmountSelectorProps {
  currentAmount: number;
  onAmountChange: (amt: number) => void;
  maxAmount?: number;
  minAmount?: number;
  disabled?: boolean;
}

export const AmountSelector: React.FC<AmountSelectorProps> = ({
  currentAmount,
  onAmountChange,
  maxAmount = 50000,
  minAmount = 10,
  disabled = false
}) => {
  const quickDeltas = [10, 50, 100, 500];

  const handleMultiply = (mult: number) => {
    const next = Math.max(minAmount, Math.min(maxAmount, Math.floor(currentAmount * mult)));
    onAmountChange(next);
  };

  const handleAdd = (delta: number) => {
    const next = Math.max(minAmount, Math.min(maxAmount, currentAmount + delta));
    onAmountChange(next);
  };

  return (
    <div id="amount-selector-container" className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-700/60 rounded-xl p-1.5">
        <button
          id="btn-sub-10"
          type="button"
          disabled={disabled || currentAmount <= minAmount}
          onClick={() => handleAdd(-10)}
          className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center font-bold text-sm cursor-pointer"
        >
          -
        </button>

        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-slate-400 mr-1">₹</span>
          <input
            id="input-bet-amount"
            type="number"
            disabled={disabled}
            value={currentAmount}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) onAmountChange(Math.max(0, val));
            }}
            className="w-24 bg-transparent text-center text-base font-bold text-amber-400 focus:outline-none"
          />
        </div>

        <button
          id="btn-add-10"
          type="button"
          disabled={disabled || currentAmount >= maxAmount}
          onClick={() => handleAdd(10)}
          className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center font-bold text-sm cursor-pointer"
        >
          +
        </button>
      </div>

      <div className="grid grid-cols-6 gap-1 text-[11px] font-semibold">
        {quickDeltas.map((delta) => (
          <button
            key={delta}
            id={`quick-add-${delta}`}
            type="button"
            disabled={disabled}
            onClick={() => handleAdd(delta)}
            className="py-1 px-1 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50 active:scale-95 disabled:opacity-40 cursor-pointer transition-colors"
          >
            +{delta}
          </button>
        ))}
        <button
          id="quick-half"
          type="button"
          disabled={disabled}
          onClick={() => handleMultiply(0.5)}
          className="py-1 px-1 rounded-lg bg-slate-800/80 text-amber-400/90 hover:bg-slate-700 border border-slate-700/50 active:scale-95 disabled:opacity-40 cursor-pointer transition-colors"
        >
          1/2X
        </button>
        <button
          id="quick-double"
          type="button"
          disabled={disabled}
          onClick={() => handleMultiply(2)}
          className="py-1 px-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 active:scale-95 disabled:opacity-40 cursor-pointer font-bold transition-colors"
        >
          2X
        </button>
      </div>
    </div>
  );
};
