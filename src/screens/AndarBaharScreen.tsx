import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Sparkles, Clock, RotateCcw, ShieldCheck, Award } from 'lucide-react';
import { AndarBaharDealtCard, AndarBaharSide, AndarBaharState, Card, Wallet } from '../types.ts';
import { gamesApi } from '../api/client.ts';
import { GameHeader } from '../components/GameHeader.tsx';
import { BettingChip, CHIP_VALUES } from '../components/BettingChip.tsx';
import { notifyWinLoss } from '../components/WinLossNotification.tsx';
import { RulesModal } from '../components/RulesModal.tsx';
import { RealisticCasinoTable } from '../components/casino/RealisticCasinoTable.tsx';
import { RealisticLiveShuffleEngine } from '../components/casino/RealisticLiveShuffleEngine.tsx';
import { RealHumanShuffleVideo } from '../components/casino/RealHumanShuffleVideo.tsx';
import { DealerDealingHand } from '../components/casino/DealerDealingHand.tsx';
import { Live3DDealerCanvas } from '../components/casino3d/Live3DDealerCanvas.tsx';
import { PlayingCard } from '../components/teenpatti/PlayingCard.tsx';
import { casinoAudio } from '../utils/casinoAudio.ts';

interface AndarBaharScreenProps {
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

export const AndarBaharScreen: React.FC<AndarBaharScreenProps> = ({
  wallet,
  onUpdateWallet,
  onBack,
  onOpenWallet
}) => {
  const [gameState, setGameState] = useState<AndarBaharState | null>(null);
  const [selectedSide, setSelectedSide] = useState<AndarBaharSide>('andar');
  const [selectedChip, setSelectedChip] = useState<number>(100);
  const [andarBet, setAndarBet] = useState<number>(100);
  const [baharBet, setBaharBet] = useState<number>(0);
  const [isDealing, setIsDealing] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [visibleCards, setVisibleCards] = useState<AndarBaharDealtCard[]>([]);
  const [jokerVisible, setJokerVisible] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [countdown, setCountdown] = useState<number>(10);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(!casinoAudio.isMuted());
  const [liveViewMode, setLiveViewMode] = useState<'3d' | 'classic'>('3d');

  // Ref for card dealing trajectory from shoe
  const shoeRef = useRef<HTMLDivElement>(null);
  const jokerSlotRef = useRef<HTMLDivElement>(null);
  const andarSlotRef = useRef<HTMLDivElement>(null);
  const baharSlotRef = useRef<HTMLDivElement>(null);

  // Prevent double animations on same round
  const animatedRoundsRef = useRef<{ [key: string]: boolean }>({});

  // Dynamic vector calculation from shoe to destination slot
  const getTrajectory = useCallback((targetRef: React.RefObject<HTMLDivElement>) => {
    try {
      if (!shoeRef.current || !targetRef.current) return { x: 70, y: -100 };
      const shoeRect = shoeRef.current.getBoundingClientRect();
      const targetRect = targetRef.current.getBoundingClientRect();
      return {
        x: Math.round(shoeRect.left + shoeRect.width / 2 - (targetRect.left + targetRect.width / 2)),
        y: Math.round(shoeRect.top + shoeRect.height / 2 - (targetRect.top + targetRect.height / 2))
      };
    } catch {
      return { x: 70, y: -100 };
    }
  }, []);

  // Sync state and listen to real-time events
  useEffect(() => {
    loadState();

    // Setup polling for live multiplayer synchronization
    const syncInterval = setInterval(() => {
      loadState(true);
    }, 1200);

    return () => clearInterval(syncInterval);
  }, []);

  const loadState = async (isBackground = false) => {
    try {
      const res = await gamesApi.andarBahar.getState();
      const st = res.state;
      setGameState(st);
      setCountdown(st.countdown ?? 10);

      // Handle server phase transitions
      if (st.phase === 'betting') {
        setIsShuffling(false);
        if (!isDealing) {
          setVisibleCards(st.dealtCards || []);
          setJokerVisible(Boolean(st.jokerCard));
        }
      } else if (st.phase === 'shuffle') {
        setIsShuffling(true);
        setIsDealing(false);
      } else if (st.phase === 'dealing' || st.phase === 'settled') {
        setIsShuffling(false);
        if (!isDealing && st.dealtCards && st.dealtCards.length > 0) {
          setVisibleCards(st.dealtCards);
          setJokerVisible(true);
        }
      }

      // If user bet settled in background
      if (st.userSettlement && !animatedRoundsRef.current[st.roundId + '-settled']) {
        animatedRoundsRef.current[st.roundId + '-settled'] = true;
        if (st.userSettlement.isWin) {
          casinoAudio.playWinChime();
        }
        notifyWinLoss({
          type: st.userSettlement.isWin ? 'win' : 'loss',
          amount: st.userSettlement.isWin ? st.userSettlement.winAmount : st.userSettlement.betAmount
        });
      }
    } catch (err: any) {
      if (!isBackground) setErrorMsg(err.message);
    }
  };

  const handleToggleSound = () => {
    const nextMuted = casinoAudio.toggleMute();
    setSoundEnabled(!nextMuted);
  };

  const handleSelectSide = (side: AndarBaharSide) => {
    casinoAudio.playChipClick();
    setSelectedSide(side);
    if (side === 'andar') setAndarBet((prev) => prev + selectedChip);
    else setBaharBet((prev) => prev + selectedChip);
  };

  const doubleBets = () => {
    casinoAudio.playChipClick();
    setAndarBet((prev) => prev * 2);
    setBaharBet((prev) => prev * 2);
  };

  const clearBets = () => {
    casinoAudio.playChipClick();
    setAndarBet(0);
    setBaharBet(0);
  };

  const totalBet = andarBet + baharBet;

  // Authoritative Deal & Cinematic Shuffle Sequence
  const handleDeal = async () => {
    if (totalBet <= 0) {
      setErrorMsg('Please place chips on Andar or Bahar');
      return;
    }
    if (wallet.balance < totalBet) {
      setErrorMsg('Insufficient wallet balance');
      return;
    }

    setIsDealing(true);
    setIsShuffling(true);
    setVisibleCards([]);
    setJokerVisible(false);
    setErrorMsg(null);

    try {
      const sideToBet = andarBet >= baharBet ? 'andar' : 'bahar';
      const res = await gamesApi.andarBahar.deal(sideToBet, totalBet);

      // Phase 1: 3.8s Realistic Physical Shuffle with Elena & Marcus
      setTimeout(() => {
        setIsShuffling(false);

        // Phase 2: Deal Joker Card to Center Spotlight
        setTimeout(() => {
          setJokerVisible(true);
          casinoAudio.playCardDeal();
          setTimeout(() => casinoAudio.playCardFlip(), 220);

          // Phase 3: Sequentially deal cards alternating to Andar & Bahar
          const allDealt = res.dealtCards || [];
          allDealt.forEach((item, index) => {
            setTimeout(() => {
              setVisibleCards((prev) => [...prev, item]);
              casinoAudio.playCardDeal();
              setTimeout(() => casinoAudio.playCardFlip(), 180);
            }, 750 + (index + 1) * 420);
          });

          const totalAnimDuration = 750 + (allDealt.length + 1) * 420;

          // Phase 4: Settle & Notify
          setTimeout(() => {
            setIsDealing(false);
            onUpdateWallet(res.wallet);

            if (gameState) {
              setGameState({
                ...gameState,
                roundId: res.roundId || gameState.roundId,
                jokerCard: res.jokerCard,
                dealtCards: res.dealtCards,
                winningSide: res.winningSide,
                recentWinners: res.recentWinners
              });
            }

            const isWin = (res.winAmount ?? 0) > 0;
            if (isWin) {
              casinoAudio.playWinChime();
            }

            notifyWinLoss({
              type: isWin ? 'win' : 'loss',
              amount: isWin ? res.winAmount : totalBet
            });
          }, totalAnimDuration + 500);
        }, 550);
      }, 3800);
    } catch (err: any) {
      setIsDealing(false);
      setIsShuffling(false);
      setErrorMsg(err.message || 'Deal failed');
    }
  };

  const andarCards = visibleCards.filter((c) => c.side === 'andar');
  const baharCards = visibleCards.filter((c) => c.side === 'bahar');

  // Compute Dealer Action state for TwoHumanDealers
  const getDealerActionState = () => {
    if (isShuffling) return 'shuffle';
    if (isDealing || gameState?.phase === 'dealing') return 'deal';
    if (gameState?.phase === 'settled') return 'result';
    return 'betting';
  };

  // Natural card stack tilt angles
  const cardTilts = [-2, 1, -1, 2, 0, -1.5, 1.5];

  const rulesData = [
    { heading: 'The Joker Card', description: 'The dealers shuffle the deck and reveal a center Joker / Trump card (e.g. 8 of Spades).' },
    { heading: 'Alternating Deal', description: 'Dealers deal cards one by one alternately onto the Andar (Inside) and Bahar (Outside) trays.' },
    { heading: 'Winning Condition', description: 'The game concludes the exact instant a dealt card matches the rank of the Joker.' },
    { heading: 'Authoritative Payouts', description: 'Andar pays 1.9× (0.9 : 1 profit). Bahar pays 2.0× (1 : 1 profit).' }
  ];

  return (
    <div id="screen-andar-bahar" className="min-h-screen bg-[#040907] text-white pb-24 max-w-md mx-auto">
      {/* Top Standard Navigation Header */}
      <GameHeader
        title="Andar Bahar"
        gameId="andar-bahar"
        balance={wallet.balance}
        isDemo={wallet.isDemo}
        roundId={gameState?.roundId}
        onBack={onBack}
        onOpenRules={() => setShowRules(true)}
        onOpenWallet={onOpenWallet}
      />

      {/* History Road (Past 10 Outcomes) */}
      <div className="bg-black/60 border-b border-amber-500/20 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-400" /> Recent:
        </span>
        {gameState?.recentWinners.slice(0, 12).map((side, i) => (
          <span
            key={i}
            className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border shadow-xs ${
              side === 'andar'
                ? 'bg-blue-600/30 text-blue-300 border-blue-400/60'
                : 'bg-amber-600/30 text-amber-300 border-amber-400/60'
            }`}
          >
            {side === 'andar' ? 'A' : 'B'}
          </span>
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIEW SWITCHER: 3D LIVE DEALER / STUDIO BROADCAST             */}
      {/* ------------------------------------------------------------- */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between px-3 mt-1 mb-2">
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

      {/* ------------------------------------------------------------- */}
      {/* 1. REALISTIC CASINO CARD TABLE WITH TWO HUMAN DEALERS */}
      {/* ------------------------------------------------------------- */}
      <div className="p-2 sm:p-3">
        {liveViewMode === '3d' && (
          <div className="w-full max-w-lg mx-auto mb-2">
            <Live3DDealerCanvas
              gameMode="andar_bahar"
              phase={isShuffling ? 'shuffle' : isDealing ? 'deal' : gameState?.phase || 'betting'}
              roundId={gameState?.roundId}
              countdown={countdown}
              soundEnabled={soundEnabled}
              onToggleSound={handleToggleSound}
              andarBaharData={{
                jokerCard: gameState?.jokerCard,
                dealtCards: visibleCards,
                winner: gameState?.winningSide
              }}
            />
          </div>
        )}

        <RealisticCasinoTable
          gameName="Andar Bahar Live"
          roundId={gameState?.roundId || 'AB-1001'}
          hideStudioHeader={liveViewMode === '3d'}
          phaseLabel={
            isShuffling
              ? 'DEALER SHUFFLE'
              : isDealing
              ? 'DEALING CARDS'
              : gameState?.phase === 'settled'
              ? `${(gameState?.winningSide || 'ANDAR').toUpperCase()} WINS!`
              : 'PLACE YOUR BETS'
          }
          phaseColor={
            isShuffling
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : isDealing
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              : gameState?.phase === 'settled'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
          }
          countdown={countdown}
          dealerActionState={getDealerActionState()}
          activeDealer={visibleCards.length % 2 === 0 ? 'left' : 'right'}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          shoeRef={shoeRef}
        >
          {/* Physical Human Dealing Hand Motion during Card Dealing */}
          <DealerDealingHand
            isDealing={isDealing && !isShuffling}
            dealerSide={visibleCards.length % 2 === 0 ? 'left' : 'right'}
            targetPos={visibleCards.length % 2 === 0 ? { x: -65, y: 75 } : { x: 65, y: 75 }}
          />

          {/* --------------------------------------------------------- */}
          {/* CENTER ARENA: REALISTIC SHUFFLE OR JOKER PEDESTAL */}
          {/* --------------------------------------------------------- */}
          <div className="relative flex flex-col items-center justify-center min-h-[140px] my-1">
            <AnimatePresence mode="wait">
              {isShuffling ? (
                <motion.div
                  key="ab-shuffle"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="w-full flex items-center justify-center py-1"
                >
                  <RealHumanShuffleVideo
                    isShuffling={isShuffling}
                    roundId={gameState?.roundId}
                    gameTitle="Andar Bahar Live"
                    onShuffleFinished={() => setIsShuffling(false)}
                    className="w-full max-w-md mx-auto"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="ab-play-arena"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex flex-col items-center"
                >
                  {/* Joker / Trump Card Spotlight Box */}
                  <div
                    ref={jokerSlotRef}
                    className="relative flex flex-col items-center p-2 rounded-2xl bg-black/40 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                  >
                    <span className="text-[9px] font-black uppercase text-amber-300 tracking-wider mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" /> JOKER / MATCH CARD
                    </span>

                    {jokerVisible && gameState?.jokerCard ? (
                      <PlayingCard
                        card={gameState.jokerCard}
                        isFaceUp={true}
                        size="md"
                        animateDeal={true}
                        dealOrigin={getTrajectory(jokerSlotRef)}
                        naturalRotation={0}
                        isHighlighted={true}
                      />
                    ) : (
                      /* Empty Pedestal Slot */
                      <div className="w-16 h-24 rounded-xl border-2 border-dashed border-amber-500/30 bg-black/40 flex flex-col items-center justify-center select-none shadow-inner">
                        <span className="text-[10px] text-amber-400/50 font-bold font-mono">JOKER</span>
                        <span className="text-[8px] text-slate-500 mt-1">Ready</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* --------------------------------------------------------- */}
          {/* ANDAR VS BAHAR CARD TRAYS (PHYSICAL RUNNING STACKS) */}
          {/* --------------------------------------------------------- */}
          <div className="w-full grid grid-cols-2 gap-2 mt-2">
            {/* ANDAR TRAY (LEFT) */}
            <div
              ref={andarSlotRef}
              className={`rounded-2xl p-2.5 min-h-[120px] transition-all duration-300 flex flex-col justify-between ${
                gameState?.winningSide === 'andar' && !isDealing && !isShuffling
                  ? 'bg-blue-950/60 border-2 border-blue-400 shadow-[0_0_25px_rgba(59,130,246,0.35)]'
                  : 'bg-black/40 border border-blue-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-blue-500/20">
                <span className="text-xs font-black text-blue-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> ANDAR ({andarCards.length})
                </span>
                <span className="text-[10px] font-mono font-bold text-blue-300/80">1.9×</span>
              </div>

              {/* Stack of dealt cards */}
              <div className="flex flex-wrap gap-1.5 min-h-[64px] items-center justify-start overflow-y-auto max-h-24">
                {andarCards.map((item, idx) => {
                  const isMatch = item.card.rank === gameState?.jokerCard?.rank;
                  return (
                    <motion.div
                      key={`andar-card-${idx}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      <PlayingCard
                        card={item.card}
                        isFaceUp={true}
                        size="sm"
                        animateDeal={true}
                        dealOrigin={getTrajectory(andarSlotRef)}
                        naturalRotation={cardTilts[idx % cardTilts.length]}
                        isHighlighted={isMatch}
                      />
                    </motion.div>
                  );
                })}

                {andarCards.length === 0 && (
                  <div className="w-full text-center text-[10px] text-slate-500 py-3 font-mono">
                    {isDealing ? 'Dealing...' : 'Awaiting deal...'}
                  </div>
                )}
              </div>
            </div>

            {/* BAHAR TRAY (RIGHT) */}
            <div
              ref={baharSlotRef}
              className={`rounded-2xl p-2.5 min-h-[120px] transition-all duration-300 flex flex-col justify-between ${
                gameState?.winningSide === 'bahar' && !isDealing && !isShuffling
                  ? 'bg-amber-950/60 border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.35)]'
                  : 'bg-black/40 border border-amber-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-amber-500/20">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> BAHAR ({baharCards.length})
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-300/80">2.0×</span>
              </div>

              {/* Stack of dealt cards */}
              <div className="flex flex-wrap gap-1.5 min-h-[64px] items-center justify-start overflow-y-auto max-h-24">
                {baharCards.map((item, idx) => {
                  const isMatch = item.card.rank === gameState?.jokerCard?.rank;
                  return (
                    <motion.div
                      key={`bahar-card-${idx}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      <PlayingCard
                        card={item.card}
                        isFaceUp={true}
                        size="sm"
                        animateDeal={true}
                        dealOrigin={getTrajectory(baharSlotRef)}
                        naturalRotation={cardTilts[idx % cardTilts.length]}
                        isHighlighted={isMatch}
                      />
                    </motion.div>
                  );
                })}

                {baharCards.length === 0 && (
                  <div className="w-full text-center text-[10px] text-slate-500 py-3 font-mono">
                    {isDealing ? 'Dealing...' : 'Awaiting deal...'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </RealisticCasinoTable>
      </div>

      {errorMsg && (
        <div className="mx-3 mt-1 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-center">
          {errorMsg}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. MOBILE-FIRST BETTING SPOTS & CHIP CONTROLS */}
      {/* ------------------------------------------------------------- */}
      <div className="p-3 space-y-2.5">
        {/* Andar & Bahar Placement Pads */}
        <div className="grid grid-cols-2 gap-2">
          {/* ANDAR BUTTON */}
          <button
            id="bet-andar-btn"
            type="button"
            disabled={isDealing || isShuffling}
            onClick={() => handleSelectSide('andar')}
            className={`p-3 rounded-2xl border flex flex-col items-center justify-between transition-all active:scale-95 cursor-pointer relative select-none ${
              andarBet > 0
                ? 'bg-blue-950/80 border-blue-400 ring-2 ring-blue-500/40 shadow-lg'
                : 'bg-black/50 border-blue-500/30 hover:border-blue-400'
            }`}
          >
            <span className="text-xs font-black text-blue-400 uppercase tracking-wider">
              BET ANDAR (1.9×)
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">First Deal Side</span>
            {andarBet > 0 && (
              <span className="mt-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-[11px] font-black px-3 py-0.5 rounded-full shadow-md">
                ₹{andarBet.toLocaleString('en-IN')}
              </span>
            )}
          </button>

          {/* BAHAR BUTTON */}
          <button
            id="bet-bahar-btn"
            type="button"
            disabled={isDealing || isShuffling}
            onClick={() => handleSelectSide('bahar')}
            className={`p-3 rounded-2xl border flex flex-col items-center justify-between transition-all active:scale-95 cursor-pointer relative select-none ${
              baharBet > 0
                ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-500/40 shadow-lg'
                : 'bg-black/50 border-amber-500/30 hover:border-amber-400'
            }`}
          >
            <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
              BET BAHAR (2.0×)
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Second Deal Side</span>
            {baharBet > 0 && (
              <span className="mt-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-[11px] font-black px-3 py-0.5 rounded-full shadow-md">
                ₹{baharBet.toLocaleString('en-IN')}
              </span>
            )}
          </button>
        </div>

        {/* Multi-denomination Chip Selector */}
        <div className="bg-black/60 border border-amber-500/20 rounded-2xl p-2.5">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider">
              Select Chip:
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Total Bet: <strong className="text-amber-300">₹{totalBet.toLocaleString('en-IN')}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between gap-1">
            {CHIP_VALUES.map((val) => (
              <BettingChip
                key={val}
                value={val}
                isSelected={selectedChip === val}
                onClick={() => {
                  casinoAudio.playChipClick();
                  setSelectedChip(val);
                }}
                disabled={isDealing || isShuffling}
                size="sm"
              />
            ))}
          </div>
        </div>

        {/* Action Controls: Clear, Double, Deal */}
        <div className="flex items-center gap-2">
          <button
            id="btn-ab-clear"
            type="button"
            disabled={isDealing || isShuffling || totalBet === 0}
            onClick={clearBets}
            className="py-3 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 select-none"
          >
            Clear
          </button>

          <button
            id="btn-ab-double"
            type="button"
            disabled={isDealing || isShuffling || totalBet === 0 || wallet.balance < totalBet * 2}
            onClick={doubleBets}
            className="py-3 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 select-none"
          >
            2× Double
          </button>

          <button
            id="btn-deal-ab"
            type="button"
            disabled={isDealing || isShuffling || totalBet === 0}
            onClick={handleDeal}
            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 active:scale-95 transition-transform disabled:opacity-40 cursor-pointer select-none"
          >
            {isShuffling
              ? 'DEALERS SHUFFLING...'
              : isDealing
              ? 'DEALING CARDS...'
              : `CONFIRM DEAL (₹${totalBet.toLocaleString('en-IN')})`}
          </button>
        </div>
      </div>

      {/* Rules Modal */}
      <RulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="Andar Bahar Rules & Payouts"
        rules={rulesData}
      />
    </div>
  );
};
