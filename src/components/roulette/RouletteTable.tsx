import React, { useState } from 'react';
import { RouletteBet, RouletteBetType } from '../../types.ts';
import { RED_NUMBERS_SET } from './RouletteWheel.tsx';

interface RouletteTableProps {
  bets: RouletteBet[];
  selectedChip: number;
  isSpinning: boolean;
  disabled?: boolean;
  onAddBet: (bet: RouletteBet) => void;
  onRemoveBet?: (type: RouletteBetType, value?: number, numbers?: number[]) => void;
}

type InsideBetMode = 'straight' | 'split' | 'street' | 'corner' | 'sixline';

export const RouletteTable: React.FC<RouletteTableProps> = ({
  bets,
  selectedChip,
  isSpinning,
  disabled = false,
  onAddBet
}) => {
  const [insideMode, setInsideMode] = useState<InsideBetMode>('straight');
  const [splitFirstNum, setSplitFirstNum] = useState<number | null>(null);

  const isLocked = isSpinning || disabled;

  // Helper to find existing placed bet amount
  const getBetAmount = (type: RouletteBetType, value?: number, numbers?: number[]) => {
    const found = bets.find((b) => {
      if (b.type !== type) return false;
      if (value !== undefined && b.value !== value) return false;
      if (numbers && (!b.numbers || numbers.length !== b.numbers.length || !numbers.every((n) => b.numbers?.includes(n)))) {
        return false;
      }
      return true;
    });
    return found ? found.amount : 0;
  };

  // Helper to place/increase a bet
  const placeBet = (type: RouletteBetType, options?: { value?: number; numbers?: number[]; label?: string }) => {
    if (isLocked) return;
    onAddBet({
      type,
      value: options?.value,
      numbers: options?.numbers,
      amount: selectedChip,
      label: options?.label
    });
  };

  // Number grid: 12 rows of 3 numbers
  // Row 1: [1, 2, 3]
  // Row 2: [4, 5, 6] ...
  const rows = Array.from({ length: 12 }, (_, r) => [r * 3 + 1, r * 3 + 2, r * 3 + 3]);

  // Valid adjacent neighbors for split
  const getAdjacentNeighbors = (num: number): number[] => {
    if (num === 0) return [1, 2, 3];
    const res: number[] = [];
    if (num === 1 || num === 2 || num === 3) res.push(0);
    // Left / Right in row:
    const col = (num - 1) % 3; // 0, 1, 2
    if (col > 0) res.push(num - 1);
    if (col < 2) res.push(num + 1);
    // Up / Down:
    if (num - 3 >= 1) res.push(num - 3);
    if (num + 3 <= 36) res.push(num + 3);
    return res;
  };

  const handleNumberClick = (num: number) => {
    if (isSpinning) return;

    if (insideMode === 'straight') {
      placeBet('straight', { value: num, label: `Straight ${num}` });
    } else if (insideMode === 'split') {
      if (splitFirstNum === null) {
        setSplitFirstNum(num);
      } else if (splitFirstNum === num) {
        setSplitFirstNum(null);
      } else {
        const neighbors = getAdjacentNeighbors(splitFirstNum);
        if (neighbors.includes(num)) {
          const pair = [splitFirstNum, num].sort((a, b) => a - b);
          placeBet('split', { numbers: pair, label: `Split ${pair[0]}-${pair[1]}` });
        }
        setSplitFirstNum(null);
      }
    }
  };

  // Inside Bets mode configs
  const modeConfigs: { mode: InsideBetMode; label: string; payout: string; desc: string }[] = [
    { mode: 'straight', label: 'Straight', payout: '35:1 (36x)', desc: 'Tap any number 0–36' },
    { mode: 'split', label: 'Split', payout: '17:1 (18x)', desc: 'Tap 2 adjacent numbers' },
    { mode: 'street', label: 'Street', payout: '11:1 (12x)', desc: 'Row of 3 numbers' },
    { mode: 'corner', label: 'Corner', payout: '8:1 (9x)', desc: 'Block of 4 numbers' },
    { mode: 'sixline', label: 'Six Line', payout: '5:1 (6x)', desc: 'Double row (6 numbers)' }
  ];

  return (
    <div
      id="roulette-betting-table"
      aria-disabled={isLocked}
      className={`w-full select-none text-white transition-opacity ${isLocked ? 'pointer-events-none opacity-80' : ''}`}
    >
      {/* 1. Inside Bet Mode Selector Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Inside Bets Mode:
          </span>
          <span className="text-[10px] text-amber-400 font-semibold">
            {modeConfigs.find((m) => m.mode === insideMode)?.payout}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
          {modeConfigs.map((m) => {
            const isActive = insideMode === m.mode;
            return (
              <button
                key={m.mode}
                id={`mode-btn-${m.mode}`}
                type="button"
                disabled={isSpinning}
                onClick={() => {
                  setInsideMode(m.mode);
                  setSplitFirstNum(null);
                }}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        {insideMode === 'split' && (
          <div className="mt-1 text-[10px] text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-1 rounded text-center">
            {splitFirstNum === null
              ? 'Tap first number, then tap an adjacent neighbor'
              : `Selected ${splitFirstNum}. Now tap an adjacent number`}
          </div>
        )}
      </div>

      {/* Special Multi-Number Quick Rows when in Street, Corner, or SixLine Mode */}
      {insideMode === 'street' && (
        <div className="mb-2 p-2 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Select Street (3 Numbers • 11:1 Payout):</div>
          <div className="grid grid-cols-4 gap-1">
            {/* Trio 0-1-2 */}
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => placeBet('street', { numbers: [0, 1, 2], label: 'Trio 0-1-2' })}
              className="py-1.5 rounded bg-emerald-950/70 border border-emerald-700/60 text-[10px] font-bold text-emerald-200 relative hover:bg-emerald-900"
            >
              0, 1, 2
              {getBetAmount('street', undefined, [0, 1, 2]) > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                  ₹{getBetAmount('street', undefined, [0, 1, 2])}
                </span>
              )}
            </button>
            {rows.map((row, idx) => {
              const bAmt = getBetAmount('street', undefined, row);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isSpinning}
                  onClick={() => placeBet('street', { numbers: row, label: `Street ${row[0]}-${row[2]}` })}
                  className={`py-1.5 rounded text-[10px] font-bold border relative transition-all active:scale-95 ${
                    bAmt > 0
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {row[0]}-{row[2]}
                  {bAmt > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                      ₹{bAmt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {insideMode === 'corner' && (
        <div className="mb-2 p-2 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Select Corner (4 Numbers • 8:1 Payout):</div>
          <div className="grid grid-cols-4 gap-1 max-h-36 overflow-y-auto pr-1">
            {/* First Four (0, 1, 2, 3) */}
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => placeBet('corner', { numbers: [0, 1, 2, 3], label: 'Basket 0-1-2-3' })}
              className="py-1.5 rounded bg-emerald-950/70 border border-emerald-700/60 text-[10px] font-bold text-emerald-200 relative hover:bg-emerald-900"
            >
              0,1,2,3
              {getBetAmount('corner', undefined, [0, 1, 2, 3]) > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                  ₹{getBetAmount('corner', undefined, [0, 1, 2, 3])}
                </span>
              )}
            </button>
            {/* Standard 4-number corners: rows r and r+1, cols c and c+1 */}
            {Array.from({ length: 11 }, (_, r) => {
              const corners = [
                [r * 3 + 1, r * 3 + 2, (r + 1) * 3 + 1, (r + 1) * 3 + 2],
                [r * 3 + 2, r * 3 + 3, (r + 1) * 3 + 2, (r + 1) * 3 + 3]
              ];
              return corners.map((cGroup, cIdx) => {
                const bAmt = getBetAmount('corner', undefined, cGroup);
                return (
                  <button
                    key={`${r}-${cIdx}`}
                    type="button"
                    disabled={isSpinning}
                    onClick={() => placeBet('corner', { numbers: cGroup, label: `Corner ${cGroup.join(',')}` })}
                    className={`py-1.5 rounded text-[10px] font-bold border relative transition-all active:scale-95 ${
                      bAmt > 0
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {cGroup[0]},{cGroup[1]},{cGroup[2]},{cGroup[3]}
                    {bAmt > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                        ₹{bAmt}
                      </span>
                    )}
                  </button>
                );
              });
            }).flat()}
          </div>
        </div>
      )}

      {insideMode === 'sixline' && (
        <div className="mb-2 p-2 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Select Six Line (6 Numbers • 5:1 Payout):</div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 11 }, (_, idx) => {
              const start = idx * 3 + 1;
              const sixNums = [start, start + 1, start + 2, start + 3, start + 4, start + 5];
              const bAmt = getBetAmount('sixline', undefined, sixNums);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isSpinning}
                  onClick={() => placeBet('sixline', { numbers: sixNums, label: `Six Line ${start}-${start + 5}` })}
                  className={`py-2 rounded text-[10px] font-bold border relative transition-all active:scale-95 ${
                    bAmt > 0
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {start} – {start + 5}
                  {bAmt > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                      ₹{bAmt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Main Roulette Table Grid */}
      <div className="bg-emerald-950/60 p-1.5 rounded-2xl border-2 border-emerald-800/80 shadow-inner">
        {/* Zero Spot (0 GREEN - Single 0) */}
        <div className="mb-1">
          <button
            id="bet-btn-zero"
            type="button"
            disabled={isSpinning}
            onClick={() => handleNumberClick(0)}
            className={`w-full py-1.5 rounded-lg font-black text-xs tracking-wider flex items-center justify-center gap-1.5 relative transition-all active:scale-98 cursor-pointer border ${
              getBetAmount('straight', 0) > 0
                ? 'bg-emerald-500 text-slate-950 ring-2 ring-amber-400 border-amber-400'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-500/50 shadow'
            }`}
          >
            <span>0 GREEN</span>
            <span className="text-[9px] opacity-80 font-bold">(35:1)</span>
            {getBetAmount('straight', 0) > 0 && (
              <span className="absolute right-2 bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full shadow">
                ₹{getBetAmount('straight', 0)}
              </span>
            )}
          </button>
        </div>

        {/* 1-36 Numbers Matrix (12 rows x 3 columns) */}
        <div className="grid grid-cols-3 gap-0.5 sm:gap-1 mb-1">
          {rows.map((row) =>
            row.map((num) => {
              const isRed = RED_NUMBERS_SET.has(num);
              const bAmt = getBetAmount('straight', num);
              const isSplitSelected = splitFirstNum === num;
              const isNeighborOfSplit = splitFirstNum !== null && getAdjacentNeighbors(splitFirstNum).includes(num);

              return (
                <button
                  key={num}
                  id={`bet-num-${num}`}
                  type="button"
                  disabled={isSpinning}
                  onClick={() => handleNumberClick(num)}
                  className={`relative py-1.5 sm:py-2 rounded-md font-black text-xs sm:text-sm transition-all active:scale-95 cursor-pointer border shadow-sm flex items-center justify-center ${
                    isRed
                      ? 'bg-gradient-to-b from-rose-700 to-rose-900 hover:from-rose-600 hover:to-rose-800 text-white border-rose-600/80'
                      : 'bg-gradient-to-b from-slate-900 to-slate-950 hover:from-slate-800 hover:to-slate-900 text-slate-100 border-slate-700/80'
                  } ${
                    bAmt > 0
                      ? 'ring-2 ring-amber-400 border-amber-400'
                      : ''
                  } ${
                    isSplitSelected
                      ? 'ring-2 ring-cyan-400 animate-pulse'
                      : isNeighborOfSplit
                      ? 'ring-2 ring-yellow-400 bg-amber-900/40'
                      : ''
                  }`}
                >
                  <span>{num}</span>
                  {bAmt > 0 && (
                    <span className="absolute -top-1 -right-0.5 bg-amber-400 text-slate-950 text-[8px] font-black px-1 py-0.1 rounded-full shadow-md z-10">
                      ₹{bAmt}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* 3 Columns Bets (2 to 1) */}
        <div className="grid grid-cols-3 gap-1 mb-1">
          {(['col1', 'col2', 'col3'] as const).map((colKey, idx) => {
            const bAmt = getBetAmount(colKey);
            return (
              <button
                key={colKey}
                id={`bet-${colKey}`}
                type="button"
                disabled={isSpinning}
                onClick={() => placeBet(colKey, { label: `Column ${idx + 1} (2:1)` })}
                className={`py-1.5 rounded-lg text-xs font-black tracking-wide border relative transition-all active:scale-95 cursor-pointer ${
                  bAmt > 0
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                    : 'bg-emerald-900/80 hover:bg-emerald-850 text-emerald-100 border-emerald-700/70'
                }`}
              >
                2 to 1
                {bAmt > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full shadow">
                    ₹{bAmt}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 3 Dozens Bets (1st 12, 2nd 12, 3rd 12 - 2:1) */}
        <div className="grid grid-cols-3 gap-1 mb-1">
          {[
            { key: 'dozen1', label: '1st 12', range: '1-12' },
            { key: 'dozen2', label: '2nd 12', range: '13-24' },
            { key: 'dozen3', label: '3rd 12', range: '25-36' }
          ].map(({ key, label, range }) => {
            const bAmt = getBetAmount(key as RouletteBetType);
            return (
              <button
                key={key}
                id={`bet-${key}`}
                type="button"
                disabled={isSpinning}
                onClick={() => placeBet(key as RouletteBetType, { label: `${label} (${range})` })}
                className={`py-1.5 rounded-lg text-xs font-black border relative transition-all active:scale-95 cursor-pointer ${
                  bAmt > 0
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                    : 'bg-slate-900/90 hover:bg-slate-850 text-slate-200 border-slate-700/80'
                }`}
              >
                <div>{label}</div>
                <div className="text-[8px] opacity-70 font-normal">2:1</div>
                {bAmt > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full shadow">
                    ₹{bAmt}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Even Money Outside Bets (1-18, EVEN, RED, BLACK, ODD, 19-36) */}
        <div className="grid grid-cols-6 gap-0.5 sm:gap-1">
          {/* 1-18 */}
          <button
            id="bet-low"
            type="button"
            disabled={isSpinning}
            onClick={() => placeBet('low', { label: 'Low 1-18 (1:1)' })}
            className={`py-1.5 rounded text-[10px] sm:text-[11px] font-black border relative transition-all active:scale-95 cursor-pointer ${
              getBetAmount('low') > 0
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                : 'bg-slate-900/90 hover:bg-slate-850 text-slate-200 border-slate-700'
            }`}
          >
            1-18
            {getBetAmount('low') > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                ₹{getBetAmount('low')}
              </span>
            )}
          </button>

          {/* EVEN */}
          <button
            id="bet-even"
            type="button"
            disabled={isSpinning}
            onClick={() => placeBet('even', { label: 'EVEN (1:1)' })}
            className={`py-1.5 rounded text-[10px] sm:text-[11px] font-black border relative transition-all active:scale-95 cursor-pointer ${
              getBetAmount('even') > 0
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                : 'bg-slate-900/90 hover:bg-slate-850 text-slate-200 border-slate-700'
            }`}
          >
            EVEN
            {getBetAmount('even') > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                ₹{getBetAmount('even')}
              </span>
            )}
          </button>

          {/* RED */}
          <button
            id="bet-red"
            type="button"
            disabled={isSpinning}
            onClick={() => placeBet('red', { label: 'RED (1:1)' })}
            className={`py-1.5 rounded text-[10px] sm:text-[11px] font-black border relative transition-all active:scale-95 cursor-pointer ${
              getBetAmount('red') > 0
                ? 'bg-rose-600 text-white ring-2 ring-amber-400 border-amber-400'
                : 'bg-rose-700 hover:bg-rose-600 text-white border-rose-500 shadow'
            }`}
          >
            RED
            {getBetAmount('red') > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                ₹{getBetAmount('red')}
              </span>
            )}
          </button>

          {/* BLACK */}
          <button
            id="bet-black"
            type="button"
            disabled={isSpinning}
            onClick={() => placeBet('black', { label: 'BLACK (1:1)' })}
            className={`py-1.5 rounded text-[10px] sm:text-[11px] font-black border relative transition-all active:scale-95 cursor-pointer ${
              getBetAmount('black') > 0
                ? 'bg-slate-800 text-white ring-2 ring-amber-400 border-amber-400'
                : 'bg-slate-950 hover:bg-slate-900 text-slate-200 border-slate-700 shadow'
            }`}
          >
            BLACK
            {getBetAmount('black') > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                ₹{getBetAmount('black')}
              </span>
            )}
          </button>

          {/* ODD */}
          <button
            id="bet-odd"
            type="button"
            disabled={isSpinning}
            onClick={() => placeBet('odd', { label: 'ODD (1:1)' })}
            className={`py-1.5 rounded text-[10px] sm:text-[11px] font-black border relative transition-all active:scale-95 cursor-pointer ${
              getBetAmount('odd') > 0
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                : 'bg-slate-900/90 hover:bg-slate-850 text-slate-200 border-slate-700'
            }`}
          >
            ODD
            {getBetAmount('odd') > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                ₹{getBetAmount('odd')}
              </span>
            )}
          </button>

          {/* 19-36 */}
          <button
            id="bet-high"
            type="button"
            disabled={isSpinning}
            onClick={() => placeBet('high', { label: 'High 19-36 (1:1)' })}
            className={`py-1.5 rounded text-[10px] sm:text-[11px] font-black border relative transition-all active:scale-95 cursor-pointer ${
              getBetAmount('high') > 0
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                : 'bg-slate-900/90 hover:bg-slate-850 text-slate-200 border-slate-700'
            }`}
          >
            19-36
            {getBetAmount('high') > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full">
                ₹{getBetAmount('high')}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
