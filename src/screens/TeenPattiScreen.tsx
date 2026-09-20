import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TeenPattiState, Wallet } from '../types.ts';
import { gamesApi, subscribeToRealtimeEvents } from '../api/client.ts';
import { GameHeader } from '../components/GameHeader.tsx';
import { TeenPattiTable } from '../components/teenpatti/TeenPattiTable.tsx';
import { RulesModal } from '../components/RulesModal.tsx';
import { notifyWinLoss } from '../components/WinLossNotification.tsx';

interface TeenPattiScreenProps {
  wallet: Wallet;
  onUpdateWallet: (w: Wallet) => void;
  onBack: () => void;
  onOpenWallet?: () => void;
}

export const TeenPattiScreen: React.FC<TeenPattiScreenProps> = ({
  wallet,
  onUpdateWallet,
  onBack,
  onOpenWallet
}) => {
  const [gameState, setGameState] = useState<TeenPattiState | null>(null);
  const [selectedChip, setSelectedChip] = useState<number>(50);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  // Track last handled settlement roundId
  const lastSettledRoundRef = useRef<string>('');

  // Fetch authoritative state from backend
  const refreshState = useCallback(async () => {
    try {
      const res = await gamesApi.teenPatti.getState();
      if (res?.state) {
        setGameState(res.state);

        // Check if there's a settled user outcome for a new round
        if (
          (res.state.phase === 'result' || res.state.phase === 'settlement') &&
          res.state.userSettlement &&
          lastSettledRoundRef.current !== res.state.roundId
        ) {
          lastSettledRoundRef.current = res.state.roundId;
          const s = res.state.userSettlement;
          if ((s.betAmount ?? 0) > 0) {
            const isWin = s.outcome === 'player_win';
            notifyWinLoss({
              type: isWin ? 'win' : 'loss',
              amount: isWin ? (s.grossPayout ?? 0) : (s.betAmount ?? 0)
            });
          }
        }
      }
    } catch {
      // Ignore background network jitter
    }
  }, []);

  // Initial load + periodic sync (every 1.5s for seamless reconnection and timer drift recovery)
  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 1500);
    return () => clearInterval(interval);
  }, [refreshState]);

  // Real-time SSE listener for instant sub-second round events
  useEffect(() => {
    const unsubscribe = subscribeToRealtimeEvents((event) => {
      const evtType = event.event as string;
      const data = event.data;

      if (!evtType) return;

      if (evtType.startsWith('teen_patti_') || evtType === 'wallet_updated') {
        if (data?.state) {
          setGameState(data.state);
        } else {
          // Immediately fetch latest synchronized state
          refreshState();
        }

        if (data?.wallet) {
          onUpdateWallet(data.wallet);
        }

        if (evtType === 'teen_patti_result' || evtType === 'teen_patti_settlement') {
          const settlement = data?.settlement || data?.userSettlement;
          if (settlement && data?.roundId && lastSettledRoundRef.current !== data.roundId) {
            lastSettledRoundRef.current = data.roundId;
            if ((settlement.betAmount ?? 0) > 0) {
              const isWin = settlement.outcome === 'player_win';
              notifyWinLoss({
                type: isWin ? 'win' : 'loss',
                amount: isWin ? (settlement.grossPayout ?? 0) : (settlement.betAmount ?? 0)
              });
            }
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshState, onUpdateWallet]);

  // Place Bet handler
  const handlePlaceBet = async (amount: number) => {
    if (isPlacingBet) return;
    setErrorMsg(null);
    setIsPlacingBet(true);

    try {
      const res = await gamesApi.teenPatti.placeBet(amount);
      if (res.state) {
        setGameState(res.state);
      }
      if (res.wallet) {
        onUpdateWallet(res.wallet);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to place bet');
    } finally {
      setIsPlacingBet(false);
    }
  };

  // See cards action handler
  const handleSeeCards = async () => {
    try {
      await gamesApi.teenPatti.action('see');
      refreshState();
    } catch {
      // ignore
    }
  };

  const rulesData = [
    {
      heading: '1. Trail / Trio (Three of a Kind)',
      description: 'Three cards of the exact same rank (e.g. A-A-A, K-K-K, 7-7-7). Highest possible hand in Teen Patti. Payout: 5×'
    },
    {
      heading: '2. Pure Sequence (Straight Flush)',
      description: 'Three consecutive cards of the same suit (e.g. A-K-Q, A-2-3 of hearts). Second highest hand. Payout: 4×'
    },
    {
      heading: '3. Sequence (Straight / Normal Run)',
      description: 'Three consecutive cards of mixed suits (e.g. A-K-Q or A-2-3 mixed). Payout: 3×'
    },
    {
      heading: '4. Color / Flush',
      description: 'Three cards of the same suit not in sequence (e.g. K-9-4 of spades). Compared by high card. Payout: 2×'
    },
    {
      heading: '5. Pair',
      description: 'Two cards of the same rank (e.g. Q-Q-5). Compared by pair value, then kicker. Payout: 1×'
    },
    {
      heading: '6. High Card',
      description: 'Three unrelated cards with no pair or sequence. Compared by highest rank. Payout: 1×'
    }
  ];

  const payoutsData = [
    { bet: 'Trail / Trio', payout: '5×' },
    { bet: 'Pure Sequence', payout: '4×' },
    { bet: 'Sequence', payout: '3×' },
    { bet: 'Color / Flush', payout: '2×' },
    { bet: 'Pair', payout: '1×' },
    { bet: 'High Card', payout: '1×' }
  ];

  return (
    <div id="screen-teen-patti" className="min-h-screen bg-slate-950 text-white pb-24 max-w-lg mx-auto flex flex-col">
      {/* Game Header */}
      <GameHeader
        title="Teen Patti Live"
        gameId="teen-patti"
        balance={wallet.balance}
        isDemo={wallet.isDemo}
        roundId={gameState?.roundId}
        onBack={onBack}
        onOpenRules={() => setShowRules(true)}
        onOpenWallet={onOpenWallet}
      />

      {/* Error Message Toast */}
      {errorMsg && (
        <div className="mx-3 mt-2 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-medium text-center">
          {errorMsg}
        </div>
      )}

      {/* Main Table Arena */}
      <div className="p-2 sm:p-3 flex-1 flex flex-col items-center">
        {gameState ? (
          <TeenPattiTable
            state={gameState}
            wallet={wallet}
            onPlaceBet={handlePlaceBet}
            onSeeCards={handleSeeCards}
            isPlacingBet={isPlacingBet}
            selectedChip={selectedChip}
            onSelectChip={setSelectedChip}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 text-sm gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <span>Connecting to Teen Patti Table...</span>
          </div>
        )}
      </div>

      {/* Rules & Payouts Modal */}
      <RulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="Teen Patti Rules & Payouts"
        rules={rulesData}
        payouts={payoutsData}
      />
    </div>
  );
};
