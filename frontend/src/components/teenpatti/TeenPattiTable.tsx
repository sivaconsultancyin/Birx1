import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Shield,
  Award,
  Users,
  Eye,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers,
  Volume2,
  VolumeX
} from 'lucide-react';
import { TeenPattiState, Card, Wallet } from '../../types.ts';
import { PlayingCard } from './PlayingCard.tsx';
import { RealisticDealerStudio, DealerActionState } from '../casino/RealisticDealerStudio.tsx';
import { RealisticLiveShuffleEngine } from '../casino/RealisticLiveShuffleEngine.tsx';
import { RealHumanShuffleVideo } from '../casino/RealHumanShuffleVideo.tsx';
import { DealerDealingHand } from '../casino/DealerDealingHand.tsx';
import { Live3DDealerCanvas } from '../casino3d/Live3DDealerCanvas.tsx';
import { casinoAudio } from '../../utils/casinoAudio.ts';
import { TEEN_PATTI_PAYOUT_MULTIPLIERS } from '../../engines/teenPattiEngine.ts';

interface TeenPattiTableProps {
  state: TeenPattiState;
  wallet: Wallet;
  onPlaceBet: (amount: number) => Promise<void>;
  onSeeCards?: () => void;
  isPlacingBet: boolean;
  selectedChip: number;
  onSelectChip: (chip: number) => void;
}

export const TeenPattiTable: React.FC<TeenPattiTableProps> = ({
  state,
  wallet,
  onPlaceBet,
  onSeeCards,
  isPlacingBet,
  selectedChip,
  onSelectChip
}) => {
  // -------------------------------------------------------------
  // ANIMATION & RECONNECTION SYNCHRONIZATION
  // -------------------------------------------------------------
  const [shuffleVisible, setShuffleVisible] = useState(false);
  const [dealProgress, setDealProgress] = useState<number>(0); // 0 = none, 1 = P1, 2 = D1, 3 = P2, 4 = D2, 5 = P3, 6 = D3
  const [dealerRevealProgress, setDealerRevealProgress] = useState<number>(0); // 0 = none, 1 = C1, 2 = C2, 3 = C3
  const [userSeenCards, setUserSeenCards] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(!casinoAudio.isMuted());
  const [liveViewMode, setLiveViewMode] = useState<'3d' | 'classic'>('3d');

  // References for dynamic trajectory calculation from Dealing Shoe to Slots
  const shoeRef = useRef<HTMLDivElement>(null);
  const dealerSlotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const playerSlotRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Prevent duplicate animation triggers for the same roundId
  const playedRoundsRef = useRef<{ [key: string]: boolean }>({});

  const roundId = state.roundId;
  const phase = state.phase;
  const userPlayer = state.players.find((p) => p.isUser) || state.players[0];
  const dealer = state.dealer;

  // Compute live deal origin vector from Dealing Shoe to Card Slot
  const getDealOrigin = useCallback((slotIndex: number, isDealer: boolean) => {
    try {
      const slotEl = isDealer ? dealerSlotRefs.current[slotIndex] : playerSlotRefs.current[slotIndex];
      if (!shoeRef.current || !slotEl) {
        return isDealer ? { x: 70, y: 0 } : { x: 70, y: -160 };
      }
      const shoeRect = shoeRef.current.getBoundingClientRect();
      const slotRect = slotEl.getBoundingClientRect();
      return {
        x: Math.round(shoeRect.left + shoeRect.width / 2 - (slotRect.left + slotRect.width / 2)),
        y: Math.round(shoeRect.top + shoeRect.height / 2 - (slotRect.top + slotRect.height / 2))
      };
    } catch {
      return isDealer ? { x: 70, y: 0 } : { x: 70, y: -160 };
    }
  }, []);

  // Synchronize visual state machine strictly with server-authoritative timestamps
  useEffect(() => {
    if (!roundId) return;

    const shuffleKey = `${roundId}-shuffle`;
    const dealKey = `${roundId}-deal`;
    const compareKey = `${roundId}-compare`;

    // 1. Betting & Lock Phase
    if (phase === 'betting' || phase === 'lock') {
      setShuffleVisible(false);
      setDealProgress(0);
      setDealerRevealProgress(0);
      setUserSeenCards(false);
    }

    // 2. Deal Phase: Server-authoritative 5-second window
    else if (phase === 'deal') {
      const now = Date.now();
      const phaseStart = state.phaseEndsAt ? state.phaseEndsAt - 5000 : now;
      const elapsed = Math.max(0, now - phaseStart);

      // If user connects late (> 1.6s into deal phase), skip shuffle and catch up dealing
      if (elapsed >= 1600) {
        setShuffleVisible(false);
        // Step calculation based on remaining deal window
        const step = Math.min(6, Math.floor((elapsed - 1600) / 380) + 1);
        setDealProgress(step);
      } else {
        // Run authoritative shuffle animation before dealing
        if (!playedRoundsRef.current[shuffleKey]) {
          playedRoundsRef.current[shuffleKey] = true;
          setShuffleVisible(true);
          setDealProgress(0);

          const shuffleTimer = setTimeout(() => {
            setShuffleVisible(false);
          }, 1600);

          return () => clearTimeout(shuffleTimer);
        } else {
          setShuffleVisible(false);
        }

        // Deal cards sequentially one by one after shuffle completes
        if (!playedRoundsRef.current[dealKey]) {
          playedRoundsRef.current[dealKey] = true;
          setDealProgress(0);

          const timers: NodeJS.Timeout[] = [];
          for (let i = 1; i <= 6; i++) {
            const t = setTimeout(() => {
              setDealProgress(i);
              casinoAudio.playCardDeal();
            }, 1600 + (i - 1) * 380);
            timers.push(t);
          }

          return () => timers.forEach(clearTimeout);
        }
      }
    }

    // 3. Compare Phase: Server reveals dealer cards
    else if (phase === 'compare') {
      setShuffleVisible(false);
      setDealProgress(6); // All 6 cards are dealt
      setUserSeenCards(true); // Showdown reveals player hand

      if (!playedRoundsRef.current[compareKey]) {
        playedRoundsRef.current[compareKey] = true;
        // Flip dealer cards sequentially with 3D flip animation
        setDealerRevealProgress(1);
        casinoAudio.playCardFlip();
        const t1 = setTimeout(() => {
          setDealerRevealProgress(2);
          casinoAudio.playCardFlip();
        }, 220);
        const t2 = setTimeout(() => {
          setDealerRevealProgress(3);
          casinoAudio.playCardFlip();
        }, 440);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      } else {
        setDealerRevealProgress(3);
      }
    }

    // 4. Settlement / Result / Completed
    else if (
      phase === 'settlement' ||
      phase === 'result' ||
      phase === 'completed' ||
      phase === 'showdown' ||
      phase === 'settled'
    ) {
      setShuffleVisible(false);
      setDealProgress(6);
      setDealerRevealProgress(3);
      setUserSeenCards(true);
    }
  }, [roundId, phase, state.phaseEndsAt]);

  // Handle local "See Cards" button
  const handleToggleSeeCards = () => {
    setUserSeenCards(true);
    if (onSeeCards) onSeeCards();
  };

  // Phase Display Text & Styling
  const getPhaseBadge = () => {
    switch (phase) {
      case 'betting':
        return {
          label: 'BETTING OPEN',
          bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          dot: 'bg-emerald-400 animate-ping'
        };
      case 'lock':
        return {
          label: 'BETS LOCKED',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400'
        };
      case 'deal':
        return {
          label: shuffleVisible ? 'SHUFFLING DECK' : 'DEALING CARDS',
          bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          dot: 'bg-indigo-400 animate-pulse'
        };
      case 'compare':
        return {
          label: 'DEALER REVEAL',
          bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          dot: 'bg-purple-400 animate-pulse'
        };
      case 'settlement':
      case 'result':
        return {
          label: 'ROUND RESULT',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400'
        };
      default:
        return {
          label: 'ROUND ACTIVE',
          bg: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
          dot: 'bg-slate-400'
        };
    }
  };

  const phaseBadge = getPhaseBadge();

  // Dealing order (Card 1: P1, Card 2: D1, Card 3: P2, Card 4: D2, Card 5: P3, Card 6: D3)
  const isDealerCardDealt = (index: number) => {
    if (phase === 'compare' || phase === 'settlement' || phase === 'result' || phase === 'completed') return true;
    if (phase !== 'deal') return false;
    if (index === 0) return dealProgress >= 2;
    if (index === 1) return dealProgress >= 4;
    if (index === 2) return dealProgress >= 6;
    return false;
  };

  const isPlayerCardDealt = (index: number) => {
    if (phase === 'compare' || phase === 'settlement' || phase === 'result' || phase === 'completed') return true;
    if (phase !== 'deal') return false;
    if (index === 0) return dealProgress >= 1;
    if (index === 1) return dealProgress >= 3;
    if (index === 2) return dealProgress >= 5;
    return false;
  };

  // Reveal states
  const isDealerCardFlipped = (index: number) => {
    if (phase === 'settlement' || phase === 'result' || phase === 'completed') return true;
    if (phase === 'compare') return dealerRevealProgress > index;
    return false;
  };

  const isPlayerCardsVisible =
    userSeenCards ||
    phase === 'compare' ||
    phase === 'result' ||
    phase === 'settlement' ||
    phase === 'completed';

  const isPlayerWinner =
    (phase === 'result' || phase === 'settlement') &&
    state.userSettlement?.outcome === 'player_win';

  const isDealerWinner =
    (phase === 'result' || phase === 'settlement') &&
    state.userSettlement?.outcome === 'dealer_win';

  // Natural dealer card tilt angles (-1.5°, 0°, +1.5°)
  const cardTilts = [-1.5, 0, 1.5];

  const dealerActionState: DealerActionState = shuffleVisible
    ? 'shuffle'
    : phase === 'deal' || phase === 'compare'
    ? 'deal'
    : phase === 'result' || phase === 'settlement'
    ? 'result'
    : 'betting';

  return (
    <div className="w-full flex flex-col items-center">
      {/* ----------------------------------------------------------- */}
      {/* VIEW SWITCHER: 3D LIVE DEALER / STUDIO BROADCAST            */}
      {/* ----------------------------------------------------------- */}
      <div className="w-full max-w-lg flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-amber-500/30 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setLiveViewMode('3d')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              liveViewMode === '3d'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 shadow-md'
                : 'text-amber-200/80 hover:text-white'
            }`}
          >
            3D Live Dealer
          </button>
          <button
            type="button"
            onClick={() => setLiveViewMode('classic')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              liveViewMode === 'classic'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 shadow-md'
                : 'text-amber-200/80 hover:text-white'
            }`}
          >
            Studio Broadcast
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Synchronized 60 FPS</span>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* REALISTIC 3D LIVE DEALER OR STUDIO BROADCAST               */}
      {/* ----------------------------------------------------------- */}
      <div className="w-full max-w-lg mb-2 z-10">
        {liveViewMode === '3d' ? (
          <Live3DDealerCanvas
            gameMode="teenpatti"
            phase={phase}
            roundId={state.roundId}
            countdown={state.countdown}
            soundEnabled={soundEnabled}
            onToggleSound={() => {
              const nextMuted = casinoAudio.toggleMute();
              setSoundEnabled(!nextMuted);
            }}
            teenPattiData={{
              playerCards: userPlayer?.cards,
              dealerCards: dealer?.cards,
              showdown: isDealerCardFlipped(0),
              dealProgress
            }}
          />
        ) : (
          <RealisticDealerStudio
            actionState={dealerActionState}
            activeDealer={dealProgress % 2 === 1 ? 'left' : 'right'}
            gameTitle="Teen Patti Live"
            roundId={state.roundId}
            countdown={state.countdown}
            soundEnabled={soundEnabled}
            onToggleSound={() => {
              const nextMuted = casinoAudio.toggleMute();
              setSoundEnabled(!nextMuted);
            }}
          />
        )}
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 1. CASINO TABLE ARENA (STRICTLY 2 HANDS: DEALER & PLAYER) */}
      {/* ----------------------------------------------------------- */}
      <div className="relative w-full rounded-3xl border-4 border-[#7a481c] bg-gradient-to-b from-[#072418] via-[#051c13] to-[#03140d] p-3 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Felt Decorative Inlay Lines */}
        <div className="absolute inset-2 sm:inset-3 rounded-[24px] border border-amber-500/20 pointer-events-none" />
        <div className="absolute inset-4 sm:inset-5 rounded-[20px] border border-amber-500/10 pointer-events-none" />

        {/* Felt Watermark Badge */}
        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-5 pointer-events-none select-none">
          <span className="text-7xl sm:text-8xl font-serif font-black tracking-widest text-amber-200">
            TEEN PATTI
          </span>
          <span className="text-xs sm:text-sm font-semibold tracking-widest text-amber-300">
            ROYAL CASINO SUITE
          </span>
        </div>

        {/* Top Header Bar: Round ID, Phase Pill & Countdown */}
        <div className="relative z-20 flex items-center justify-between gap-2 mb-3">
          {/* Round ID */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-amber-500/30 text-xs font-mono text-amber-300 backdrop-blur-sm">
            <span className="text-amber-500 text-[10px] font-black">#</span>
            <span>{state.roundId}</span>
          </div>

          {/* Phase Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold tracking-wide backdrop-blur-md shadow-md ${phaseBadge.bg}`}
          >
            <span className={`w-2 h-2 rounded-full ${phaseBadge.dot}`} />
            <span>{phaseBadge.label}</span>
          </div>

          {/* Countdown Clock & Sound Toggle */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-amber-500/30 text-xs font-bold text-amber-300 backdrop-blur-sm">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{state.countdown}s</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextMuted = casinoAudio.toggleMute();
                setSoundEnabled(!nextMuted);
              }}
              className="w-7 h-7 rounded-full bg-black/50 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:text-amber-200 transition-colors shadow-sm cursor-pointer"
              title={soundEnabled ? 'Mute Table Audio' : 'Enable Table Audio'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
            </button>
          </div>
        </div>

        {/* Multiplayer Status Ribbon (No extra hands or avatars on table) */}
        <div className="relative z-20 flex items-center justify-between px-2 mb-3 text-[11px] text-emerald-300/80">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-slate-200">Live Table</span>
            <span className="text-amber-400/90 font-mono">• 16 Players in Room</span>
          </div>
          <span className="text-[10px] text-amber-400/80 font-medium">Shared Player Hand vs Dealer</span>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* 2. DEALER HAND AREA (TOP) */}
        {/* ----------------------------------------------------------- */}
        <div
          className={`relative z-20 flex flex-col items-center p-2 sm:p-3 rounded-2xl transition-all duration-300 ${
            isDealerWinner
              ? 'bg-rose-950/40 border-2 border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.3)]'
              : 'bg-black/20 border border-amber-500/15'
          }`}
        >
          {/* Dealer Title & Rank Pill */}
          <div className="flex items-center justify-between w-full max-w-xs mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 shadow-md flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-amber-300 font-serif font-black text-xs">
                  D
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white tracking-wider uppercase">Dealer Hand</span>
                <span className="text-[9px] text-slate-400">Must Qualify (Q High)</span>
              </div>
            </div>

            {/* Authoritative Dealer Hand Rank Pill when revealed */}
            {dealerRevealProgress >= 3 && dealer?.handRankName && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-300 text-[11px] font-bold shadow-sm"
              >
                {dealer.handRankName}
              </motion.div>
            )}
          </div>

          {/* Dealer 3 Cards Row */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 min-h-[105px]">
            {[0, 1, 2].map((idx) => {
              const card = dealer?.cards?.[idx];
              const isDealt = isDealerCardDealt(idx);
              const isFlipped = isDealerCardFlipped(idx);

              return (
                <div
                  key={`dealer-card-slot-${idx}`}
                  ref={(el) => (dealerSlotRefs.current[idx] = el)}
                  className="relative"
                >
                  {isDealt ? (
                    <PlayingCard
                      card={card}
                      isFaceUp={isFlipped}
                      size="md"
                      animateDeal={phase === 'deal'}
                      dealOrigin={getDealOrigin(idx, true)}
                      naturalRotation={cardTilts[idx]}
                      isHighlighted={isDealerWinner}
                    />
                  ) : (
                    /* Placeholder Card Felt Slot */
                    <div className="w-16 h-24 sm:w-18 sm:h-26 rounded-xl border-2 border-dashed border-amber-500/25 bg-emerald-950/40 flex flex-col items-center justify-center select-none">
                      <span className="text-[10px] text-amber-500/40 font-mono font-bold">DEALER</span>
                      <span className="text-[9px] text-amber-500/30 font-mono">#{idx + 1}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* 3. CENTER FELT ARENA: SHUFFLE ANIMATION OR COMMUNITY POT & SHOE */}
        {/* ----------------------------------------------------------- */}
        <div className="relative z-20 flex items-center justify-between my-3 px-2 min-h-[110px]">
          <AnimatePresence mode="wait">
            {shuffleVisible ? (
              <motion.div
                key="shuffle-arena"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.3 }}
                className="w-full flex items-center justify-center"
              >
                <RealHumanShuffleVideo
                  isShuffling={shuffleVisible}
                  roundId={state.roundId}
                  gameTitle="Teen Patti Live"
                  onShuffleFinished={() => setShuffleVisible(false)}
                  className="w-full max-w-md mx-auto"
                />
              </motion.div>
            ) : (
              <motion.div
                key="pot-arena"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full flex items-center justify-between gap-2 relative"
              >
                {/* Physical Human Dealing Hand Motion during Card Distribution */}
                <DealerDealingHand
                  isDealing={phase === 'deal' && !shuffleVisible && dealProgress > 0 && dealProgress <= 6}
                  dealerSide={dealProgress % 2 === 1 ? 'left' : 'right'}
                  targetPos={dealProgress % 2 === 1 ? { x: 0, y: 80 } : { x: 0, y: -40 }}
                />
                {/* Left Side: Table Rules / Stake Info */}
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider">
                    Game Rules
                  </span>
                  <span className="text-xs font-semibold text-slate-200">Trail Pays 5×</span>
                  <span className="text-[10px] text-emerald-400">Pure Seq Pays 4×</span>
                </div>

                {/* Center: Total Pot Pill */}
                <div className="flex flex-col items-center">
                  <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-gradient-to-b from-black/80 to-slate-950/90 border border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.25)] backdrop-blur-md">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] sm:text-[11px] font-black uppercase text-amber-400 tracking-wider">
                      TOTAL POT
                    </span>
                    <span className="text-base sm:text-xl font-black text-amber-300 font-mono">
                      ₹{(state.pot ?? 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">Shared Player Hand</span>
                </div>

                {/* Right Side: Dealing Shoe (Origin of All Dealt Cards) */}
                <div
                  ref={shoeRef}
                  className="relative flex flex-col items-center p-1.5 rounded-xl bg-black/40 border border-amber-500/30 shadow-inner select-none"
                >
                  <div className="relative w-12 h-16 sm:w-14 sm:h-18 rounded-lg bg-gradient-to-br from-red-950 via-neutral-950 to-black border-2 border-amber-600/60 shadow-lg flex items-center justify-center rotate-[-10deg]">
                    <div className="w-full h-full rounded border border-amber-400/30 flex items-center justify-center bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:4px_4px]">
                      <Layers className="w-5 h-5 text-amber-400/80" />
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-amber-300/80 mt-1 font-bold">SHOE</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* 4. PLAYER HAND AREA (BOTTOM - SINGLE SHARED PLAYER HAND) */}
        {/* ----------------------------------------------------------- */}
        <div
          className={`relative z-20 flex flex-col items-center p-2 sm:p-3 rounded-2xl transition-all duration-300 ${
            isPlayerWinner
              ? 'bg-emerald-950/40 border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.3)]'
              : 'bg-black/20 border border-amber-500/15'
          }`}
        >
          {/* Player Title, See Cards & Hand Rank Pill */}
          <div className="flex items-center justify-between w-full max-w-xs mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-teal-300 font-bold text-xs">
                  P
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white tracking-wider uppercase">Player Hand</span>
                <span className="text-[10px] text-amber-400 font-mono font-semibold">
                  Your Bet: ₹{userPlayer?.currentBet || 0}
                </span>
              </div>
            </div>

            {/* Hand Rank or See Cards Action Button */}
            {isPlayerCardsVisible && userPlayer?.handRankName ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-bold flex items-center gap-1 shadow-sm"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>{userPlayer.handRankName}</span>
                {TEEN_PATTI_PAYOUT_MULTIPLIERS[userPlayer.handRankName] && (
                  <span className="text-amber-400 ml-0.5 font-mono">
                    ({TEEN_PATTI_PAYOUT_MULTIPLIERS[userPlayer.handRankName]}×)
                  </span>
                )}
              </motion.div>
            ) : !isPlayerCardsVisible && phase === 'betting' ? (
              <button
                id="btn-tp-see-cards"
                type="button"
                onClick={handleToggleSeeCards}
                className="px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>See Cards</span>
              </button>
            ) : null}
          </div>

          {/* Player 3 Cards Row */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 min-h-[115px]">
            {[0, 1, 2].map((idx) => {
              const card = userPlayer?.cards?.[idx];
              const isDealt = isPlayerCardDealt(idx);

              return (
                <div
                  key={`player-card-slot-${idx}`}
                  ref={(el) => (playerSlotRefs.current[idx] = el)}
                  className="relative"
                >
                  {isDealt || phase === 'betting' || phase === 'lock' ? (
                    <PlayingCard
                      card={card}
                      isFaceUp={isPlayerCardsVisible}
                      size="lg"
                      animateDeal={phase === 'deal'}
                      dealOrigin={getDealOrigin(idx, false)}
                      naturalRotation={cardTilts[idx]}
                      isHighlighted={isPlayerWinner || (isPlayerCardsVisible && phase === 'betting')}
                    />
                  ) : (
                    /* Placeholder Card Felt Slot */
                    <div className="w-20 h-28 sm:w-24 sm:h-34 rounded-xl border-2 border-dashed border-amber-500/25 bg-emerald-950/40 flex flex-col items-center justify-center select-none">
                      <span className="text-xs text-amber-500/40 font-mono font-bold">PLAYER</span>
                      <span className="text-[10px] text-amber-500/30 font-mono">#{idx + 1}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 5. SETTLEMENT & WINNER NOTIFICATION BANNER */}
      {/* ----------------------------------------------------------- */}
      <AnimatePresence>
        {(phase === 'result' || phase === 'settlement') && state.userSettlement && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className={`w-full mt-3 p-3.5 sm:p-4 rounded-2xl border-2 shadow-2xl backdrop-blur-md ${
              state.userSettlement.outcome === 'player_win'
                ? 'bg-gradient-to-r from-emerald-950/95 to-slate-950/95 border-amber-400 text-amber-100 shadow-emerald-500/20'
                : state.userSettlement.outcome === 'tie'
                ? 'bg-slate-900/95 border-blue-400 text-blue-100 shadow-blue-500/20'
                : 'bg-slate-900/95 border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {state.userSettlement.outcome === 'player_win' ? (
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                ) : state.userSettlement.outcome === 'tie' ? (
                  <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-400 flex items-center justify-center text-blue-400 shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-rose-500/20 border border-rose-400 flex items-center justify-center text-rose-400 shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                )}

                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    {state.userSettlement.outcome === 'player_win'
                      ? 'Player Hand Wins!'
                      : state.userSettlement.outcome === 'tie'
                      ? 'Tie / Push'
                      : 'Dealer Hand Wins'}
                    {state.userSettlement.multiplier > 0 && state.userSettlement.outcome === 'player_win' && (
                      <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400 text-amber-300 font-mono font-bold">
                        {state.userSettlement.multiplier}× Return
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 font-medium">
                    {state.userSettlement.summaryText}
                  </p>
                </div>
              </div>

              {/* Payout Figure */}
              <div className="text-right font-mono shrink-0 pl-2">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Return</span>
                <span
                  className={`text-base sm:text-lg font-black ${
                    (state.userSettlement?.grossPayout ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400'
                  }`}
                >
                  ₹{(state.userSettlement?.grossPayout ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------------- */}
      {/* 6. BETTING TRAY & ACTION CONTROLS (MOBILE-FIRST) */}
      {/* ----------------------------------------------------------- */}
      <div className="w-full mt-3 space-y-2.5">
        {/* Chip Denominations Selector */}
        <div className="flex items-center justify-between gap-1.5 p-2 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          {[50, 100, 200, 500, 1000, 2500].map((chip) => {
            const isSelected = selectedChip === chip;
            return (
              <button
                key={chip}
                id={`chip-btn-${chip}`}
                type="button"
                disabled={phase !== 'betting' || isPlacingBet}
                onClick={() => onSelectChip(chip)}
                className={`relative flex-1 py-2 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-b from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/25 scale-105 ring-2 ring-amber-300'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/50'
                } ${phase !== 'betting' ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
              >
                <span className="text-[9px] leading-tight text-slate-400 font-mono">₹</span>
                <span className="leading-tight">{chip >= 1000 ? `${chip / 1000}k` : chip}</span>
              </button>
            );
          })}
        </div>

        {/* Primary Action Button */}
        <div className="w-full">
          {phase === 'betting' ? (
            <button
              id="btn-tp-place-bet"
              type="button"
              disabled={isPlacingBet || wallet.balance < selectedChip}
              onClick={() => onPlaceBet(selectedChip)}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-amber-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Award className="w-4 h-4 text-slate-950" />
              <span>
                {userPlayer && userPlayer.currentBet > 0
                  ? `Raise Bet (+₹${selectedChip})`
                  : `Place Bet ₹${selectedChip}`}
              </span>
              <span className="text-xs bg-slate-950/20 px-2 py-0.5 rounded font-mono font-bold">
                {state.countdown}s left
              </span>
            </button>
          ) : (
            <div className="w-full py-3.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 text-center">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>
                {phase === 'lock'
                  ? 'Bets locked! Preparing deck...'
                  : phase === 'deal'
                  ? shuffleVisible
                    ? 'Dealer Shuffling 52-Card Deck...'
                    : 'Dealing Cards to Player & Dealer...'
                  : phase === 'compare'
                  ? 'Dealer Cards Reveal...'
                  : 'Settling Round Results...'}
              </span>
            </div>
          )}
        </div>

        {/* Payout Reference Bar */}
        <div className="grid grid-cols-6 gap-1 text-center py-2 px-1 rounded-xl bg-black/50 border border-amber-500/10 text-[10px]">
          <div>
            <span className="text-slate-400 block text-[9px]">Trail</span>
            <span className="text-amber-400 font-bold font-mono">5×</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px]">Pure Seq</span>
            <span className="text-amber-400 font-bold font-mono">4×</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px]">Sequence</span>
            <span className="text-amber-400 font-bold font-mono">3×</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px]">Color</span>
            <span className="text-amber-400 font-bold font-mono">2×</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px]">Pair</span>
            <span className="text-amber-400 font-bold font-mono">1×</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px]">High Card</span>
            <span className="text-amber-400 font-bold font-mono">1×</span>
          </div>
        </div>
      </div>
    </div>
  );
};
