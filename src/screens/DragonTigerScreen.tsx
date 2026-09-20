import React, { useState, useEffect } from 'react';
import { Flame, Shield, Award, RotateCcw, Clock } from 'lucide-react';
import { Card, DragonTigerBetSide, DragonTigerState, Wallet } from '../types.ts';
import { gamesApi } from '../api/client.ts';
import { GameHeader } from '../components/GameHeader.tsx';
import { BettingChip, CHIP_VALUES } from '../components/BettingChip.tsx';
import { Countdown } from '../components/Countdown.tsx';
import { notifyWinLoss } from '../components/WinLossNotification.tsx';
import { RulesModal } from '../components/RulesModal.tsx';

interface DragonTigerScreenProps {
  wallet: Wallet;
  onUpdateWallet: (w: Wallet) => void;
  onBack: () => void;
  onOpenWallet?: () => void;
}

const suitIcons: Record<string, { symbol: string; color: string }> = {
  hearts: { symbol: '♥', color: 'text-rose-500' },
  diamonds: { symbol: '♦', color: 'text-rose-500' },
  clubs: { symbol: '♣', color: 'text-slate-200' },
  spades: { symbol: '♠', color: 'text-slate-200' }
};

export const DragonTigerScreen: React.FC<DragonTigerScreenProps> = ({
  wallet,
  onUpdateWallet,
  onBack,
  onOpenWallet
}) => {
  const [gameState, setGameState] = useState<DragonTigerState | null>(null);
  const [selectedSide, setSelectedSide] = useState<DragonTigerBetSide>('dragon');
  const [selectedChip, setSelectedChip] = useState<number>(100);
  const [betAmounts, setBetAmounts] = useState<{ dragon: number; tiger: number; tie: number }>({
    dragon: 100,
    tiger: 0,
    tie: 0
  });
  const [isDealing, setIsDealing] = useState(false);
  const [revealDragon, setRevealDragon] = useState(true);
  const [revealTiger, setRevealTiger] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultWin, setResultWin] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [countdown, setCountdown] = useState(12);

  useEffect(() => {
    loadState();
    const interval = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : 12));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadState = async () => {
    try {
      const res = await gamesApi.dragonTiger.getState();
      setGameState(res.state);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSelectBet = (side: DragonTigerBetSide) => {
    setSelectedSide(side);
    setBetAmounts((prev) => ({
      ...prev,
      [side]: prev[side] + selectedChip
    }));
  };

  const clearBets = () => {
    setBetAmounts({ dragon: 0, tiger: 0, tie: 0 });
  };

  const totalBet = betAmounts.dragon + betAmounts.tiger + betAmounts.tie;

  const handleDeal = async () => {
    if (totalBet <= 0) {
      setErrorMsg('Place chips on Dragon, Tiger, or Tie');
      return;
    }
    if (wallet.balance < totalBet) {
      setErrorMsg('Insufficient wallet balance');
      return;
    }

    setIsDealing(true);
    setRevealDragon(false);
    setRevealTiger(false);
    setErrorMsg(null);

    try {
      // Find primary bet side
      const primarySide =
        betAmounts.dragon >= betAmounts.tiger && betAmounts.dragon >= betAmounts.tie
          ? 'dragon'
          : betAmounts.tiger >= betAmounts.tie
          ? 'tiger'
          : 'tie';

      const res = await gamesApi.dragonTiger.deal(primarySide, totalBet);

      setTimeout(() => setRevealDragon(true), 600);
      setTimeout(() => setRevealTiger(true), 1200);

      setTimeout(() => {
        setIsDealing(false);
        setResultWin(res.winAmount);
        onUpdateWallet(res.wallet);
        if (gameState) {
          setGameState({
            ...gameState,
            dragonCard: res.dragonCard,
            tigerCard: res.tigerCard,
            winner: res.winner,
            recentResults: res.recentResults
          });
        }
        // Authoritative Win/Loss notification popup
        const isWin = (res.winAmount ?? 0) > 0;
        notifyWinLoss({
          type: isWin ? 'win' : 'loss',
          amount: isWin ? res.winAmount : totalBet
        });
      }, 1600);
    } catch (err: any) {
      setIsDealing(false);
      setRevealDragon(true);
      setRevealTiger(true);
      setErrorMsg(err.message || 'Dealing failed');
    }
  };

  const renderCard = (card: Card | null, isRevealed: boolean, label: string) => {
    if (!card || !isRevealed) {
      return (
        <div className="w-24 h-36 rounded-2xl bg-gradient-to-br from-red-950 via-slate-900 to-red-950 border-2 border-amber-500/60 shadow-2xl flex flex-col items-center justify-center p-2">
          <div className="w-full h-full rounded-xl border border-dashed border-amber-400/40 flex items-center justify-center">
            <span className="text-sm font-black text-amber-400">{label}</span>
          </div>
        </div>
      );
    }

    const suitInfo = suitIcons[card.suit] || suitIcons.hearts;
    return (
      <div className="w-24 h-36 rounded-2xl bg-slate-100 text-slate-950 border-2 border-amber-400 shadow-2xl flex flex-col justify-between p-2 animate-flip-card">
        <div className={`text-sm font-black leading-tight ${suitInfo.color}`}>
          {card.rank}
          <span className="text-xs block">{suitInfo.symbol}</span>
        </div>
        <div className={`text-4xl font-bold self-center ${suitInfo.color}`}>{suitInfo.symbol}</div>
        <div className={`text-sm font-black leading-tight rotate-180 self-end ${suitInfo.color}`}>
          {card.rank}
        </div>
      </div>
    );
  };

  const rulesData = [
    { heading: 'Game Rules', description: 'Dragon and Tiger each receive one card. The higher card value wins (King is highest, Ace is 1).' },
    { heading: 'Dragon Bet (2x)', description: 'Pays 1 to 1 if Dragon card rank is higher than Tiger.' },
    { heading: 'Tiger Bet (2x)', description: 'Pays 1 to 1 if Tiger card rank is higher than Dragon.' },
    { heading: 'Tie Bet (9x / 8:1)', description: 'Pays 8 to 1 if both Dragon and Tiger receive cards of the exact same rank.' }
  ];

  return (
    <div id="screen-dragon-tiger" className="min-h-screen bg-slate-950 text-white pb-24 max-w-md mx-auto">
      <GameHeader
        title="Dragon Tiger"
        gameId="dragon-tiger"
        balance={wallet.balance}
        isDemo={wallet.isDemo}
        roundId={gameState?.roundId}
        onBack={onBack}
        onOpenRules={() => setShowRules(true)}
        onOpenWallet={onOpenWallet}
      />

      {/* History Roadmaps */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Bead Plate:
        </span>
        {gameState?.recentResults.slice(0, 10).map((r, i) => (
          <span
            key={i}
            className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
              r === 'dragon'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                : r === 'tiger'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
            }`}
          >
            {r === 'dragon' ? 'D' : r === 'tiger' ? 'T' : 'X'}
          </span>
        ))}
      </div>

      {/* Battle Arena */}
      <div className="p-4 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-b border-slate-800 flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-3 px-1">
          <Countdown seconds={countdown} maxSeconds={12} label="Round timer" size="sm" />
          <span className="text-xs font-bold text-amber-400">Total Bet: ₹{totalBet}</span>
        </div>

        <div className="w-full flex items-center justify-around py-3">
          {/* Dragon Side */}
          <div className="flex flex-col items-center">
            <div className="text-xs font-black text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>🐉</span> DRAGON
            </div>
            {renderCard(gameState?.dragonCard || null, revealDragon, 'DRAGON')}
          </div>

          {/* VS center badge */}
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-amber-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-700 shadow">
              VS
            </span>
            {gameState?.winner && (
              <span className="text-[10px] uppercase font-bold text-emerald-400 mt-1.5 animate-pulse">
                {gameState.winner} WIN
              </span>
            )}
          </div>

          {/* Tiger Side */}
          <div className="flex flex-col items-center">
            <div className="text-xs font-black text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>🐅</span> TIGER
            </div>
            {renderCard(gameState?.tigerCard || null, revealTiger, 'TIGER')}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mx-3 mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-center">
          {errorMsg}
        </div>
      )}

      {/* Betting Spots */}
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {/* Dragon Spot */}
          <button
            id="bet-spot-dragon"
            type="button"
            disabled={isDealing}
            onClick={() => handleSelectBet('dragon')}
            className={`p-3 rounded-2xl border flex flex-col items-center justify-between text-center transition-all active:scale-95 cursor-pointer relative ${
              betAmounts.dragon > 0
                ? 'bg-rose-950/70 border-rose-500 ring-2 ring-rose-500/50 shadow-lg'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-lg">🐉</span>
            <span className="text-xs font-black text-rose-400 mt-1">DRAGON</span>
            <span className="text-[10px] text-slate-400">1 : 1</span>
            {betAmounts.dragon > 0 && (
              <span className="mt-1 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                ₹{betAmounts.dragon}
              </span>
            )}
          </button>

          {/* Tie Spot */}
          <button
            id="bet-spot-tie"
            type="button"
            disabled={isDealing}
            onClick={() => handleSelectBet('tie')}
            className={`p-3 rounded-2xl border flex flex-col items-center justify-between text-center transition-all active:scale-95 cursor-pointer relative ${
              betAmounts.tie > 0
                ? 'bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-lg">⚖️</span>
            <span className="text-xs font-black text-emerald-400 mt-1">TIE</span>
            <span className="text-[10px] text-amber-400 font-bold">8 : 1</span>
            {betAmounts.tie > 0 && (
              <span className="mt-1 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                ₹{betAmounts.tie}
              </span>
            )}
          </button>

          {/* Tiger Spot */}
          <button
            id="bet-spot-tiger"
            type="button"
            disabled={isDealing}
            onClick={() => handleSelectBet('tiger')}
            className={`p-3 rounded-2xl border flex flex-col items-center justify-between text-center transition-all active:scale-95 cursor-pointer relative ${
              betAmounts.tiger > 0
                ? 'bg-amber-950/70 border-amber-500 ring-2 ring-amber-500/50 shadow-lg'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-lg">🐅</span>
            <span className="text-xs font-black text-amber-400 mt-1">TIGER</span>
            <span className="text-[10px] text-slate-400">1 : 1</span>
            {betAmounts.tiger > 0 && (
              <span className="mt-1 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                ₹{betAmounts.tiger}
              </span>
            )}
          </button>
        </div>

        {/* Chip Denominations */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Select Chip To Bet:
          </div>
          <div className="flex items-center justify-between gap-1">
            {CHIP_VALUES.map((val) => (
              <BettingChip
                key={val}
                value={val}
                isSelected={selectedChip === val}
                onClick={() => setSelectedChip(val)}
                disabled={isDealing}
                size="sm"
              />
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn-dt-clear"
            type="button"
            disabled={isDealing || totalBet === 0}
            onClick={clearBets}
            className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
          >
            Clear
          </button>

          <button
            id="btn-deal-dt"
            type="button"
            disabled={isDealing || totalBet === 0}
            onClick={handleDeal}
            className="flex-1 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-transform disabled:opacity-40 cursor-pointer"
          >
            {isDealing ? 'Dealing Cards...' : `CONFIRM BET (₹${totalBet})`}
          </button>
        </div>
      </div>

      <RulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="Dragon Tiger"
        rules={rulesData}
      />
    </div>
  );
};
