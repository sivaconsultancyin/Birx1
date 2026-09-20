import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCw,
  Trash2,
  TrendingUp,
  Flame,
  Snowflake,
  RotateCcw,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronUp,
  Lock
} from 'lucide-react';
import {
  RouletteBet,
  RouletteState,
  RouletteHistoryStats,
  Wallet
} from '../types.ts';
import { gamesApi } from '../api/client.ts';
import { GameHeader } from '../components/GameHeader.tsx';
import { BettingChip, CHIP_VALUES } from '../components/BettingChip.tsx';
import { Countdown } from '../components/Countdown.tsx';
import { RulesModal } from '../components/RulesModal.tsx';
import { RouletteWheel, RED_NUMBERS_SET } from '../components/roulette/RouletteWheel.tsx';
import { RouletteTable } from '../components/roulette/RouletteTable.tsx';
import { notifyWinLoss } from '../components/WinLossNotification.tsx';

interface RouletteScreenProps {
  wallet: Wallet;
  onUpdateWallet: (w: Wallet) => void;
  onBack: () => void;
  onOpenWallet?: () => void;
}

// Deterministic settlement calculator matching server rules
function calculatePlayerSettlement(winningNum: number, betsToSettle: RouletteBet[]) {
  const isRed = RED_NUMBERS_SET.has(winningNum);
  const isZero = winningNum === 0;
  const winningColor: 'red' | 'black' | 'green' = isZero ? 'green' : isRed ? 'red' : 'black';

  let totalBet = 0;
  let grossPayout = 0;

  for (const bet of betsToSettle) {
    const amt = Number(bet.amount || 0);
    totalBet += amt;
    let isWin = false;
    let multiplier = 0;

    switch (bet.type) {
      case 'straight':
      case 'number': {
        const target = bet.value !== undefined ? bet.value : (bet.numbers?.[0] ?? -1);
        if (target === winningNum) {
          isWin = true;
          multiplier = 36;
        }
        break;
      }
      case 'split': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 18;
        }
        break;
      }
      case 'street': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 12;
        }
        break;
      }
      case 'corner': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 9;
        }
        break;
      }
      case 'sixline': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 6;
        }
        break;
      }
      case 'dozen1': {
        if (!isZero && winningNum >= 1 && winningNum <= 12) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'dozen2': {
        if (!isZero && winningNum >= 13 && winningNum <= 24) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'dozen3': {
        if (!isZero && winningNum >= 25 && winningNum <= 36) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col1': {
        if (!isZero && winningNum % 3 === 1) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col2': {
        if (!isZero && winningNum % 3 === 2) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col3': {
        if (!isZero && winningNum % 3 === 0) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'red': {
        if (!isZero && isRed) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'black': {
        if (!isZero && !isRed) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'even': {
        if (!isZero && winningNum % 2 === 0) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'odd': {
        if (!isZero && winningNum % 2 !== 0) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'low': {
        if (!isZero && winningNum >= 1 && winningNum <= 18) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'high': {
        if (!isZero && winningNum >= 19 && winningNum <= 36) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
    }

    if (isWin) {
      grossPayout += amt * multiplier;
    }
  }

  const netResult = grossPayout - totalBet;
  return {
    winningColor,
    totalBet,
    grossPayout,
    netResult,
    isWin: grossPayout > 0
  };
}

export const RouletteScreen: React.FC<RouletteScreenProps> = ({
  wallet,
  onUpdateWallet,
  onBack,
  onOpenWallet
}) => {
  // Authoritative Round State
  const [gameState, setGameState] = useState<RouletteState | null>(null);
  const [countdown, setCountdown] = useState<number>(15);

  // Betting State:
  // stagedBets: chips placed on the table by user in current betting phase (not yet confirmed with server)
  // confirmedBets: chips placed and deducted on the server for the current active round
  const [stagedBets, setStagedBets] = useState<RouletteBet[]>([]);
  const [confirmedBets, setConfirmedBets] = useState<RouletteBet[]>([]);
  const [previousBets, setPreviousBets] = useState<RouletteBet[]>([]);
  const [betHistoryStack, setBetHistoryStack] = useState<RouletteBet[][]>([]);
  const [selectedChip, setSelectedChip] = useState<number>(100);

  // Wheel & Result State
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(17);
  const [winningColor, setWinningColor] = useState<'red' | 'black' | 'green' | null>('black');
  const [winningCategory, setWinningCategory] = useState<string | null>(null);

  // UI Modals & Stats
  const [showRules, setShowRules] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stats, setStats] = useState<RouletteHistoryStats | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  // Refs for tracking latest state in async handlers
  const confirmedBetsRef = useRef<RouletteBet[]>([]);
  confirmedBetsRef.current = confirmedBets;
  const currentRoundIdRef = useRef<string>('');
  if (gameState?.roundId) {
    currentRoundIdRef.current = gameState.roundId;
  }

  // Guard to ensure ball spins strictly ONCE per round
  const hasSpunRoundRef = useRef<string>('');

  const isBettingPhase = gameState?.phase === 'betting';

  // 1. Initial State & Real-time Synchronization (SSE + Authoritative Polling)
  useEffect(() => {
    loadState();
    loadStats();

    // Setup SSE connection to listen for synchronized round events
    let sse: EventSource | null = null;
    try {
      sse = new EventSource('/api/realtime');

      const handleServerEvent = (payload: any) => {
        if (!payload || !payload.type) return;

        switch (payload.type) {
          case 'roulette_round_started':
          case 'roulette_betting_open': {
            // Reset spin guard for the brand new round
            hasSpunRoundRef.current = '';

            // New round started by authoritative server
            setGameState((prev) => {
              const currentRound = prev?.roundId;
              const newRound = payload.roundId;
              // If rolling into a new round, save previous bets for Rebet
              if (currentRound && currentRound !== newRound && confirmedBetsRef.current.length > 0) {
                setPreviousBets(JSON.parse(JSON.stringify(confirmedBetsRef.current)));
              }
              return {
                ...(prev || {
                  winningNumber: 0,
                  winningColor: 'green',
                  recentResults: [],
                  serverSeedHash: '',
                  limits: { minimumBet: 10, maximumBet: 50000, maximumExposure: 500000 }
                }),
                roundId: payload.roundId,
                phase: 'betting',
                countdown: payload.countdown || 15
              };
            });

            setCountdown(payload.countdown || 15);
            setConfirmedBets([]);
            setStagedBets([]);
            setBetHistoryStack([]);
            setIsSpinning(false);
            setErrorMsg(null);
            break;
          }

          case 'roulette_betting_closed': {
            setGameState((prev) => (prev ? { ...prev, phase: 'closed', countdown: payload.countdown || 2 } : null));
            setCountdown(payload.countdown || 2);
            // Clear unconfirmed staged chips since betting window has closed
            setStagedBets([]);
            break;
          }

          case 'roulette_spin_started': {
            // Strictly prevent spinning more than once per round
            const rId = payload.roundId || currentRoundIdRef.current;
            if (hasSpunRoundRef.current === rId) {
              break;
            }
            hasSpunRoundRef.current = rId;

            // Server has authoritatively determined the winning pocket before spin starts
            setGameState((prev) => (prev ? { ...prev, phase: 'spinning', countdown: payload.countdown || 6 } : null));
            setCountdown(payload.countdown || 6);
            setWinningNumber(payload.winningNumber);
            setWinningColor(payload.winningColor);
            setIsSpinning(true);
            setStagedBets([]);
            break;
          }

          case 'roulette_result': {
            setGameState((prev) => (prev ? { ...prev, phase: 'result', countdown: payload.countdown || 4 } : null));
            setCountdown(payload.countdown || 4);
            setWinningNumber(payload.winningNumber);
            setWinningColor(payload.winningColor);
            if (payload.winningCategory) setWinningCategory(payload.winningCategory);
            // Do NOT re-trigger spin
            setIsSpinning(false);
            break;
          }

          case 'roulette_settlement': {
            // Trigger settlement evaluation for the player's own confirmed bets
            // Settlement occurs strictly AFTER the single spin and must not re-spin
            setIsSpinning(false);
            const playerBets = confirmedBetsRef.current;
            if (playerBets.length > 0 && payload.winningNumber !== undefined) {
              const settlement = calculatePlayerSettlement(payload.winningNumber, playerBets);
              if (settlement.isWin && settlement.grossPayout > 0) {
                notifyWinLoss({
                  type: 'win',
                  amount: settlement.grossPayout
                });
              } else if (settlement.totalBet > 0) {
                notifyWinLoss({
                  type: 'loss',
                  amount: settlement.totalBet
                });
              }
            }
            loadStats();
            break;
          }

          case 'roulette_wallet_updated': {
            if (payload.wallet) {
              onUpdateWallet(payload.wallet);
            }
            break;
          }
        }
      };

      // Handle standard message
      sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          handleServerEvent(payload);
        } catch {
          // SSE JSON parse ignore
        }
      };

      // Also listen to named events
      const eventNames = [
        'roulette_round_started',
        'roulette_betting_open',
        'roulette_betting_closed',
        'roulette_spin_started',
        'roulette_result',
        'roulette_settlement',
        'roulette_wallet_updated'
      ];
      eventNames.forEach((evt) => {
        sse?.addEventListener(evt, (e: any) => {
          try {
            handleServerEvent(JSON.parse(e.data));
          } catch {
            // ignore
          }
        });
      });
    } catch {
      // SSE fallback
    }

    // 2. High-reliability polling synchronization with single authoritative room
    const syncInterval = setInterval(async () => {
      try {
        const res = await gamesApi.roulette.getRound();
        if (res && res.state) {
          setGameState(res.state);
          setCountdown(res.countdown);

          // Only trigger spin if server entered spinning AND this client hasn't spun for this round
          if (
            res.state.phase === 'spinning' &&
            hasSpunRoundRef.current !== res.state.roundId &&
            res.winningNumber !== null
          ) {
            hasSpunRoundRef.current = res.state.roundId;
            setWinningNumber(res.winningNumber);
            setWinningColor(res.winningColor);
            setIsSpinning(true);
            setStagedBets([]);
          }

          // If server rolled into new round while client was on old round
          if (res.state.phase === 'betting' && currentRoundIdRef.current && currentRoundIdRef.current !== res.state.roundId) {
            hasSpunRoundRef.current = '';
            if (confirmedBetsRef.current.length > 0) {
              setPreviousBets(JSON.parse(JSON.stringify(confirmedBetsRef.current)));
            }
            setConfirmedBets([]);
            setStagedBets([]);
            setIsSpinning(false);
          }
        }
      } catch {
        // network retry
      }
    }, 1200);

    return () => {
      clearInterval(syncInterval);
      if (sse) {
        sse.close();
      }
    };
  }, []);

  const loadState = async () => {
    try {
      const res = await gamesApi.roulette.getRound();
      setGameState(res.state);
      setCountdown(res.countdown || 15);
      if (res.winningNumber !== null) {
        setWinningNumber(res.winningNumber);
        setWinningColor(res.winningColor);
      }
      if (res.winningCategory) {
        setWinningCategory(res.winningCategory);
      }
    } catch {
      // Fallback
    }
  };

  const loadStats = async () => {
    try {
      const hist = await gamesApi.roulette.getHistory();
      setStats(hist);
    } catch {
      // Ignore
    }
  };

  // -------------------------------------------------------------
  // BET SELECTION & MANAGEMENT
  // -------------------------------------------------------------

  // Add chip to staged bets during betting phase
  const handleAddBet = (newBet: RouletteBet) => {
    if (!isBettingPhase || isSpinning) return;
    setErrorMsg(null);

    // Save snapshot for undo
    setBetHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(stagedBets))]);

    setStagedBets((prev) => {
      const idx = prev.findIndex((b) => {
        if (b.type !== newBet.type) return false;
        if (newBet.value !== undefined && b.value !== newBet.value) return false;
        if (
          newBet.numbers &&
          (!b.numbers || newBet.numbers.length !== b.numbers.length || !newBet.numbers.every((n) => b.numbers?.includes(n)))
        ) {
          return false;
        }
        return true;
      });

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].amount += newBet.amount;
        return copy;
      } else {
        return [...prev, newBet];
      }
    });
  };

  // Clear unconfirmed staged chips
  const handleClearBets = () => {
    if (!isBettingPhase || isSpinning || stagedBets.length === 0) return;
    setBetHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(stagedBets))]);
    setStagedBets([]);
  };

  // Undo last staged chip action
  const handleUndoBet = () => {
    if (!isBettingPhase || isSpinning || betHistoryStack.length === 0) return;
    const lastStack = [...betHistoryStack];
    const previousState = lastStack.pop();
    if (previousState !== undefined) {
      setStagedBets(previousState);
      setBetHistoryStack(lastStack);
    }
  };

  // Double staged chips (2x)
  const handleDoubleBets = () => {
    if (!isBettingPhase || isSpinning || stagedBets.length === 0) return;
    setBetHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(stagedBets))]);
    setStagedBets((prev) => prev.map((b) => ({ ...b, amount: b.amount * 2 })));
  };

  // Rebet: Restore previous round's bets into staged bets
  const handleRebet = () => {
    if (!isBettingPhase || isSpinning || previousBets.length === 0) return;
    setBetHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(stagedBets))]);
    setStagedBets(JSON.parse(JSON.stringify(previousBets)));
  };

  // Confirm and place staged bets to the authoritative server
  const handlePlaceBets = async () => {
    if (!isBettingPhase) {
      setErrorMsg('Betting is closed for this round');
      return;
    }
    if (stagedBets.length === 0) {
      setErrorMsg('Select chips and tap the table to place bets');
      return;
    }

    const stagedTotal = stagedBets.reduce((s, b) => s + b.amount, 0);
    if (wallet.balance < stagedTotal) {
      setErrorMsg('Insufficient wallet balance to place this bet');
      return;
    }
    if (stagedTotal < 10) {
      setErrorMsg('Minimum bet is ₹10');
      return;
    }

    setIsPlacingBet(true);
    setErrorMsg(null);

    try {
      const res = await gamesApi.roulette.placeBets(stagedBets);
      if (res && res.success) {
        // Add placed bets to confirmed bets
        setConfirmedBets((prev) => [...prev, ...stagedBets]);
        setStagedBets([]);
        setBetHistoryStack([]);
        if (res.wallet) {
          onUpdateWallet(res.wallet);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to place bet. Please try again.');
    } finally {
      setIsPlacingBet(false);
    }
  };

  // All bets rendered on the table: both confirmed bets locked in server + staged chips
  const allDisplayBets = [...confirmedBets, ...stagedBets];
  const stagedTotal = stagedBets.reduce((s, b) => s + b.amount, 0);
  const confirmedTotal = confirmedBets.reduce((s, b) => s + b.amount, 0);
  const totalBetAmount = stagedTotal + confirmedTotal;

  // -------------------------------------------------------------
  // WHEEL ANIMATION & SETTLEMENT CALLBACK
  // -------------------------------------------------------------
  const handleWheelAnimationComplete = () => {
    setIsSpinning(false);
    // Show win/loss popup if player has confirmed bets in this round
    if (confirmedBets.length > 0 && winningNumber !== null) {
      const settlement = calculatePlayerSettlement(winningNumber, confirmedBets);
      if (settlement.isWin && settlement.grossPayout > 0) {
        notifyWinLoss({
          type: 'win',
          amount: settlement.grossPayout
        });
      } else if (settlement.totalBet > 0) {
        notifyWinLoss({
          type: 'loss',
          amount: settlement.totalBet
        });
      }
      loadStats();
    }
  };

  // Developer / QA Diagnostic Test Spin
  const handleTestNumber = (testNum: number) => {
    if (isSpinning) return;
    setErrorMsg(null);
    hasSpunRoundRef.current = `test-${Date.now()}`;
    const color = testNum === 0 ? 'green' : RED_NUMBERS_SET.has(testNum) ? 'red' : 'black';
    setWinningNumber(testNum);
    setWinningColor(color);
    setWinningCategory(testNum === 0 ? 'Zero' : `${color.toUpperCase()} / ${testNum % 2 === 0 ? 'EVEN' : 'ODD'}`);
    setIsSpinning(true);
  };

  // Rules Data
  const rulesData = [
    {
      heading: 'Single-Zero European Wheel',
      description: 'Contains exactly 37 pockets: numbers 1 to 36 (18 Red, 18 Black) and a single Green 0. House edge is 2.70%.'
    },
    {
      heading: 'Inside Bets',
      description:
        'Straight Up (1 number, pays 35:1). Split (2 adjacent numbers, pays 17:1). Street (3 numbers, pays 11:1). Corner (4 numbers, pays 8:1). Six Line (6 numbers across two rows, pays 5:1).'
    },
    {
      heading: 'Outside Bets',
      description:
        'Dozens (1-12, 13-24, 25-36) and Columns (Col 1, Col 2, Col 3) pay 2:1. Even-Money bets (Red/Black, Even/Odd, Low 1-18/High 19-36) pay 1:1.'
    },
    {
      heading: 'Green Zero (0) Rule',
      description:
        'When the ball lands on 0 (Green), all outside bets lose. Only bets placed on 0 (Straight Up, Split with 0, Trio 0-1-2) win.'
    }
  ];

  const payoutsData = [
    { bet: 'Straight Up (1 num)', payout: '35:1 (36x)' },
    { bet: 'Split (2 nums)', payout: '17:1 (18x)' },
    { bet: 'Street (3 nums)', payout: '11:1 (12x)' },
    { bet: 'Corner (4 nums)', payout: '8:1 (9x)' },
    { bet: 'Six Line (6 nums)', payout: '5:1 (6x)' },
    { bet: 'Dozens (12 nums)', payout: '2:1 (3x)' },
    { bet: 'Columns (12 nums)', payout: '2:1 (3x)' },
    { bet: 'Red / Black', payout: '1:1 (2x)' },
    { bet: 'Even / Odd', payout: '1:1 (2x)' },
    { bet: 'Low / High (18)', payout: '1:1 (2x)' }
  ];

  return (
    <div
      id="screen-roulette"
      className="h-[100dvh] max-h-[100dvh] w-full max-w-md mx-auto flex flex-col overflow-hidden bg-slate-950 text-white relative select-none"
    >
      {/* 1. Header with Live Balance */}
      <GameHeader
        title="European Roulette"
        gameId="roulette"
        balance={wallet.balance}
        isDemo={wallet.isDemo}
        roundId={gameState?.roundId}
        onBack={onBack}
        onOpenRules={() => setShowRules(true)}
        onOpenWallet={onOpenWallet}
      />

      {/* Top Info Bar: Timer, Phase, Carousel, Stats Toggle */}
      <div className="flex-shrink-0 px-3 py-1.5 flex items-center justify-between bg-slate-900/90 border-b border-slate-800/80 z-30">
        <Countdown
          seconds={countdown}
          maxSeconds={isBettingPhase ? 15 : gameState?.phase === 'spinning' ? 6 : 4}
          label={
            isBettingPhase
              ? 'Betting'
              : gameState?.phase === 'closed'
              ? 'Closed'
              : gameState?.phase === 'spinning'
              ? 'Spinning'
              : 'Settled'
          }
          size="sm"
        />

        {/* Recent Numbers Carousel */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5 px-1 max-w-[170px] no-scrollbar">
          {gameState?.recentResults.slice(0, 6).map((num, i) => {
            const isR = RED_NUMBERS_SET.has(num);
            const isG = num === 0;
            return (
              <span
                key={i}
                className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black shadow-sm ${
                  isG
                    ? 'bg-emerald-600 text-white'
                    : isR
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-white border border-slate-700'
                }`}
              >
                {num}
              </span>
            );
          })}
        </div>

        {/* Stats Button */}
        <button
          id="btn-toggle-stats"
          type="button"
          onClick={() => setShowStats(!showStats)}
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          <span>Stats</span>
          {showStats ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Stats Dropdown overlay (absolute so it doesn't cause overflow) */}
      {showStats && stats && (
        <div className="absolute top-[88px] inset-x-2 z-40 p-2.5 bg-slate-900/98 border border-slate-700 rounded-2xl shadow-2xl text-xs backdrop-blur-md">
          <div className="flex items-center justify-between font-bold text-slate-300 text-[11px] mb-2 pb-1 border-b border-slate-800">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Live Table Analytics (Last 50 Spins)
            </span>
            <button
              type="button"
              onClick={() => setShowStats(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-rose-950/40 border border-rose-800/40 p-1.5 rounded-xl">
              <div className="flex items-center gap-1 text-[10px] font-bold text-rose-400 mb-1">
                <Flame className="w-3 h-3 text-rose-500" /> HOT NUMBERS
              </div>
              <div className="flex gap-1.5">
                {stats.hotNumbers.map((n) => (
                  <span
                    key={n}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      n === 0
                        ? 'bg-emerald-600'
                        : RED_NUMBERS_SET.has(n)
                        ? 'bg-rose-600'
                        : 'bg-slate-800'
                    }`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-cyan-950/40 border border-cyan-800/40 p-1.5 rounded-xl">
              <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 mb-1">
                <Snowflake className="w-3 h-3 text-cyan-400" /> COLD NUMBERS
              </div>
              <div className="flex gap-1.5">
                {stats.coldNumbers.map((n) => (
                  <span
                    key={n}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      n === 0
                        ? 'bg-emerald-600'
                        : RED_NUMBERS_SET.has(n)
                        ? 'bg-rose-600'
                        : 'bg-slate-800'
                    }`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center font-bold">
            <div className="p-1 rounded bg-slate-800/60 border border-slate-700">
              <span className="text-rose-400">Red: {stats.redPercentage}%</span> /{' '}
              <span className="text-slate-300">Blk: {stats.blackPercentage}%</span>
            </div>
            <div className="p-1 rounded bg-slate-800/60 border border-slate-700">
              <span className="text-amber-300">Odd: {stats.oddPercentage}%</span> /{' '}
              <span className="text-slate-300">Even: {stats.evenPercentage}%</span>
            </div>
            <div className="p-1 rounded bg-slate-800/60 border border-slate-700">
              <span className="text-cyan-300">1-18: {stats.lowPercentage}%</span> /{' '}
              <span className="text-slate-300">19-36: {stats.highPercentage}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Message Toast */}
      {errorMsg && (
        <div className="absolute top-[88px] inset-x-4 z-50 p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-medium text-center shadow-xl animate-shake">
          {errorMsg}
        </div>
      )}

      {/* 4. Main Stage Area: Houses Wheel and Sliding Betting Panel */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black">
        {/* Ambient Wheel Spotlight Lighting */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.08)_0%,rgba(15,23,42,0.6)_60%,transparent_100%)]" />

        {/* LAYER A: Wheel & Ball Stage */}
        <div
          className={`w-full flex flex-col items-center justify-center transition-all duration-500 ease-out z-10 ${
            isBettingPhase
              ? 'h-[36%] min-h-[160px] max-h-[200px] scale-90'
              : 'flex-1 h-full scale-100 py-2'
          }`}
        >
          {/* Wheel Component */}
          <RouletteWheel
            roundId={gameState?.roundId}
            isSpinning={isSpinning}
            targetWinningNumber={winningNumber}
            targetWinningColor={winningColor}
            onSpinComplete={handleWheelAnimationComplete}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onTestNumber={handleTestNumber}
            sizeMode={isBettingPhase ? 'compact' : 'hero'}
          />

          {/* Under Wheel Status Banner when in Spin/Result Phase */}
          {!isBettingPhase && (
            <div className="mt-2 flex flex-col items-center gap-1.5">
              {gameState?.phase === 'closed' ? (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-wide shadow-lg">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Betting Closed — Starting Spin</span>
                </div>
              ) : gameState?.phase === 'spinning' ? (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold tracking-wide animate-pulse shadow-xl shadow-amber-500/10">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span>Wheel Spinning... Landing on pocket</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-white text-xs font-bold shadow-2xl">
                  <span
                    className={`w-3.5 h-3.5 rounded-full ${
                      winningColor === 'green'
                        ? 'bg-emerald-500'
                        : winningColor === 'red'
                        ? 'bg-rose-500'
                        : 'bg-slate-700'
                    }`}
                  />
                  <span>
                    Winning Number: {winningNumber} {winningColor?.toUpperCase()}
                  </span>
                </div>
              )}

              {/* Locked Stakes Indicator */}
              {confirmedTotal > 0 && (
                <div className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-0.5 rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>
                    Locked: ₹{confirmedTotal} ({confirmedBets.length} bet{confirmedBets.length > 1 ? 's' : ''})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* LAYER B: Betting Panel Bottom Sheet */}
        {/* Visible in betting phase, slides down/out completely when spinning/closed */}
        <div
          id="roulette-betting-bottom-sheet"
          className={`absolute inset-x-0 bottom-0 h-[64%] z-20 flex flex-col justify-end transition-transform duration-500 ease-in-out ${
            isBettingPhase
              ? 'translate-y-0 opacity-100 pointer-events-auto'
              : 'translate-y-[115%] opacity-0 pointer-events-none'
          }`}
        >
          <div className="w-full h-full max-h-full bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 rounded-t-3xl p-2 sm:p-2.5 flex flex-col justify-between overflow-hidden shadow-2xl">
            {/* Top Bar of Betting Panel */}
            <div className="flex items-center justify-between px-1 pb-1 flex-shrink-0 border-b border-slate-850">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>European Table</span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-800/70 px-1.5 py-0.2 rounded-full">
                  Single 0
                </span>
              </div>

              <div className="flex items-center gap-2">
                {confirmedTotal > 0 && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Locked: ₹{confirmedTotal}
                  </span>
                )}
                <div className="text-xs font-bold text-amber-400">
                  Total: ₹{totalBetAmount}
                </div>
              </div>
            </div>

            {/* Scrollable Betting Table Grid (fits neatly within available height) */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-1">
              <RouletteTable
                bets={allDisplayBets}
                selectedChip={selectedChip}
                isSpinning={isSpinning}
                disabled={!isBettingPhase}
                onAddBet={handleAddBet}
              />
            </div>

            {/* Bottom Controls Dock */}
            <div className="flex-shrink-0 pt-1 border-t border-slate-900">
              {/* Chip Denomination Selector */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto py-0.5 px-0.5 no-scrollbar">
                {CHIP_VALUES.map((val) => (
                  <BettingChip
                    key={val}
                    value={val}
                    isSelected={selectedChip === val}
                    onClick={() => setSelectedChip(val)}
                    size="sm"
                  />
                ))}
              </div>

              {/* Quick Action Buttons (Clear, Undo, 2X, Rebet) */}
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                <button
                  id="btn-clear-bets"
                  type="button"
                  disabled={stagedBets.length === 0}
                  onClick={handleClearBets}
                  className="py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>

                <button
                  id="btn-undo-bet"
                  type="button"
                  disabled={betHistoryStack.length === 0}
                  onClick={handleUndoBet}
                  className="py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>

                <button
                  id="btn-double-bets"
                  type="button"
                  disabled={stagedBets.length === 0}
                  onClick={handleDoubleBets}
                  className="py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-amber-400 hover:text-amber-300 border border-slate-800 text-[11px] font-black flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <span>2X</span>
                  <span className="text-[10px] font-normal">Double</span>
                </button>

                <button
                  id="btn-rebet"
                  type="button"
                  disabled={previousBets.length === 0}
                  onClick={handleRebet}
                  className="py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-cyan-400 hover:text-cyan-300 border border-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>Rebet</span>
                </button>
              </div>

              {/* Place / Confirm Bet CTA */}
              <div className="mt-1.5">
                {stagedBets.length > 0 ? (
                  <button
                    id="btn-place-roulette-bets"
                    type="button"
                    disabled={isPlacingBet}
                    onClick={handlePlaceBets}
                    className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {isPlacingBet ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Placing Bet...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {confirmedBets.length > 0
                            ? `Add Bet (+₹${stagedTotal})`
                            : `Place Bet (₹${stagedTotal})`}
                        </span>
                      </>
                    )}
                  </button>
                ) : confirmedBets.length > 0 ? (
                  <div className="w-full py-2 px-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-inner">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      ✓ ₹{confirmedTotal} Locked for Round #{gameState?.roundId}
                    </span>
                  </div>
                ) : (
                  <div className="w-full py-2 px-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 font-medium text-xs text-center flex items-center justify-center gap-2">
                    <span>Select chip & tap table spots to bet (Min ₹10)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. European Roulette Comprehensive Rules Modal */}
      <RulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="European Roulette (Single 0)"
        rules={rulesData}
        payouts={payoutsData}
      />
    </div>
  );
};
