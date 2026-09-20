import React, { useState, useEffect } from 'react';
import { Dices, RotateCw, Sparkles, TrendingUp } from 'lucide-react';
import { DiceBetType, DiceState, Wallet } from '../types.ts';
import { gamesApi } from '../api/client.ts';
import { GameHeader } from '../components/GameHeader.tsx';
import { AmountSelector } from '../components/AmountSelector.tsx';
import { notifyWinLoss } from '../components/WinLossNotification.tsx';
import { RulesModal } from '../components/RulesModal.tsx';

interface DiceScreenProps {
  wallet: Wallet;
  onUpdateWallet: (w: Wallet) => void;
  onBack: () => void;
  onOpenWallet?: () => void;
}

const diceDots: Record<number, number[][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]]
};

export const DiceScreen: React.FC<DiceScreenProps> = ({
  wallet,
  onUpdateWallet,
  onBack,
  onOpenWallet
}) => {
  const [gameState, setGameState] = useState<DiceState | null>(null);
  const [selectedBetType, setSelectedBetType] = useState<DiceBetType>('over7');
  const [betAmount, setBetAmount] = useState(100);
  const [dice1, setDice1] = useState(4);
  const [dice2, setDice2] = useState(3);
  const [isRolling, setIsRolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultWin, setResultWin] = useState(0);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const res = await gamesApi.dice.getState();
      setGameState(res.state);
      if (res.state.dice1) setDice1(res.state.dice1);
      if (res.state.dice2) setDice2(res.state.dice2);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRoll = async () => {
    if (isRolling) return;
    if (wallet.balance < betAmount) {
      setErrorMsg('Insufficient wallet balance');
      return;
    }

    setIsRolling(true);
    setErrorMsg(null);

    // Visual roll ticker
    const rollTicker = setInterval(() => {
      setDice1(Math.floor(1 + Math.random() * 6));
      setDice2(Math.floor(1 + Math.random() * 6));
    }, 90);

    try {
      const result = await gamesApi.dice.roll(selectedBetType, betAmount);

      setTimeout(() => {
        clearInterval(rollTicker);
        setIsRolling(false);
        setDice1(result.dice1);
        setDice2(result.dice2);
        setResultWin(result.winAmount);
        onUpdateWallet(result.wallet);
        if (gameState) {
          setGameState({
            ...gameState,
            dice1: result.dice1,
            dice2: result.dice2,
            sum: result.sum,
            recentSums: result.recentSums
          });
        }
        // Authoritative Win/Loss notification popup
        const isWin = (result.winAmount ?? 0) > 0;
        notifyWinLoss({
          type: isWin ? 'win' : 'loss',
          amount: isWin ? result.winAmount : betAmount
        });
      }, 1200);
    } catch (err: any) {
      clearInterval(rollTicker);
      setIsRolling(false);
      setErrorMsg(err.message || 'Roll failed');
    }
  };

  const betOptions: { id: DiceBetType; label: string; desc: string; payout: string }[] = [
    { id: 'under7', label: 'Under 7', desc: 'Sum 2, 3, 4, 5, 6', payout: '2.0x' },
    { id: 'exact7', label: 'Lucky 7', desc: 'Exact Sum 7', payout: '5.5x' },
    { id: 'over7', label: 'Over 7', desc: 'Sum 8, 9, 10, 11, 12', payout: '2.0x' },
    { id: 'even', label: 'Even Sum', desc: '2, 4, 6, 8, 10, 12', payout: '1.95x' },
    { id: 'odd', label: 'Odd Sum', desc: '3, 5, 7, 9, 11', payout: '1.95x' },
    { id: 'doubles', label: 'Doubles', desc: 'Matching pair (1-1 .. 6-6)', payout: '5.5x' }
  ];

  const renderDiceFace = (val: number) => {
    const dots = diceDots[val] || diceDots[1];
    return (
      <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-300 shadow-2xl p-2.5 grid grid-cols-3 grid-rows-3 border-2 border-amber-400/40">
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => {
            const hasDot = dots.some(([dr, dc]) => dr === r && dc === c);
            return (
              <div key={`${r}-${c}`} className="flex items-center justify-center">
                {hasDot && (
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-950 shadow-inner inline-block" />
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const currentSum = dice1 + dice2;

  const rulesData = [
    { heading: 'Game Objective', description: 'Predict the combined sum of two authentic 6-sided dice.' },
    { heading: 'Under 7 (2.0x)', description: 'Wins if the total sum is 2, 3, 4, 5, or 6.' },
    { heading: 'Lucky 7 (5.5x)', description: 'Wins if the total sum is exactly 7.' },
    { heading: 'Over 7 (2.0x)', description: 'Wins if the total sum is 8, 9, 10, 11, or 12.' },
    { heading: 'Doubles (5.5x)', description: 'Wins if both dice show the exact same face (e.g., 3 and 3).' }
  ];

  return (
    <div id="screen-dice" className="min-h-screen bg-slate-950 text-white pb-24 max-w-md mx-auto">
      <GameHeader
        title="Royal Dice"
        gameId="dice"
        balance={wallet.balance}
        isDemo={wallet.isDemo}
        roundId={gameState?.roundId}
        onBack={onBack}
        onOpenRules={() => setShowRules(true)}
        onOpenWallet={onOpenWallet}
      />

      {/* Stage: 3D Rolling Arena */}
      <div className="p-4 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-b border-slate-800 flex flex-col items-center">
        {/* Recent Sums Streak */}
        <div className="flex items-center gap-1.5 mb-4 text-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Recent Rolls:</span>
          {gameState?.recentSums.slice(0, 7).map((s, idx) => (
            <span
              key={idx}
              className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] border ${
                s === 7
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : s > 7
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              }`}
            >
              {s}
            </span>
          ))}
        </div>

        {/* Rolling Dice Container */}
        <div className="flex items-center justify-center gap-6 my-3">
          <div className={isRolling ? 'animate-spin' : ''}>{renderDiceFace(dice1)}</div>
          <div className="text-xl font-black text-amber-400">+</div>
          <div className={isRolling ? 'animate-bounce' : ''}>{renderDiceFace(dice2)}</div>
        </div>

        {/* Sum Result Pill */}
        <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-700">
          <span className="text-xs text-slate-400 uppercase font-bold">TOTAL SUM:</span>
          <span className="text-lg font-black text-amber-400">{currentSum}</span>
          <span className="text-xs text-slate-500">
            ({currentSum > 7 ? 'OVER 7' : currentSum < 7 ? 'UNDER 7' : 'EXACT 7'})
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="mx-3 mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-center">
          {errorMsg}
        </div>
      )}

      {/* Betting Options Grid */}
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Choose Bet Type
          </span>
          <span className="text-xs text-amber-400 font-bold">
            Selected: {betOptions.find((b) => b.id === selectedBetType)?.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {betOptions.map((opt) => {
            const isSelected = selectedBetType === opt.id;
            return (
              <button
                key={opt.id}
                id={`dice-bet-${opt.id}`}
                type="button"
                disabled={isRolling}
                onClick={() => setSelectedBetType(opt.id)}
                className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 shadow-md ring-1 ring-amber-400'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white">{opt.label}</span>
                  <span className="text-[10px] font-extrabold text-amber-400 bg-slate-950 px-1.5 py-0.5 rounded">
                    {opt.payout}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Stake Selector */}
        <AmountSelector
          currentAmount={betAmount}
          onAmountChange={setBetAmount}
          minAmount={10}
          maxAmount={20000}
          disabled={isRolling}
        />

        {/* Roll Action Button */}
        <button
          id="btn-roll-dice"
          type="button"
          disabled={isRolling}
          onClick={handleRoll}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-transform disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
        >
          <Dices className={`w-5 h-5 ${isRolling ? 'animate-spin' : ''}`} />
          <span>{isRolling ? 'Rolling Dice...' : `ROLL DICE (₹${betAmount})`}</span>
        </button>
      </div>

      <RulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="Dice"
        rules={rulesData}
      />
    </div>
  );
};
