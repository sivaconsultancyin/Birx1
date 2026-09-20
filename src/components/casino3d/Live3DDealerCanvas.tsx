import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ThreeCasinoScene, DealCardRequest } from './ThreeCasinoScene.ts';
import { Card as GameCard } from '../../types.ts';
import { Volume2, VolumeX, Sparkles, Video, Eye } from 'lucide-react';
import { casinoAudio } from '../../utils/casinoAudio.ts';

export interface Live3DDealerCanvasProps {
  gameMode: 'teenpatti' | 'andar_bahar';
  phase: string;
  roundId?: string;
  countdown?: number;
  soundEnabled: boolean;
  onToggleSound: () => void;

  // Teen Patti specific cards
  teenPattiData?: {
    playerCards?: GameCard[];
    dealerCards?: GameCard[];
    showdown?: boolean;
    dealProgress?: number;
  };

  // Andar Bahar specific cards
  andarBaharData?: {
    jokerCard?: GameCard | null;
    dealtCards?: Array<{ card: GameCard; side: 'andar' | 'bahar' }>;
    winner?: 'andar' | 'bahar' | null;
  };
}

export const Live3DDealerCanvas: React.FC<Live3DDealerCanvasProps> = ({
  gameMode,
  phase,
  roundId,
  countdown,
  soundEnabled,
  onToggleSound,
  teenPattiData,
  andarBaharData
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ThreeCasinoScene | null>(null);
  const [is3DReady, setIs3DReady] = useState(false);
  const [dealerAction, setDealerAction] = useState<string>('Elena & Marcus Ready');
  const dealtCardIdsRef = useRef<Set<string>>(new Set());
  const lastRoundIdRef = useRef<string>('');

  // 1. Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new ThreeCasinoScene(containerRef.current);
    sceneRef.current = scene;
    setIs3DReady(true);

    const resizeObserver = new ResizeObserver(() => {
      scene.handleResize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // 2. Handle Round Resets
  useEffect(() => {
    if (!sceneRef.current) return;
    if (roundId && roundId !== lastRoundIdRef.current) {
      lastRoundIdRef.current = roundId;
      dealtCardIdsRef.current.clear();
      sceneRef.current.resetRound();
    }
  }, [roundId]);

  // 3. Handle Shuffle Phase
  useEffect(() => {
    if (!sceneRef.current) return;

    if (phase === 'shuffle' || phase === 'reset') {
      setDealerAction('Elena & Marcus Shuffling Deck');
      sceneRef.current.startShuffle(() => {
        setDealerAction('Deck Placed in Shoe — Place Your Bets');
      });
    } else if (phase === 'betting') {
      setDealerAction('Accepting Stakes');
    }
  }, [phase]);

  // 4. Synchronize Teen Patti Cards (Shared Player Hand & Shared Dealer Hand)
  useEffect(() => {
    if (gameMode !== 'teenpatti' || !sceneRef.current || !teenPattiData) return;
    const { playerCards = [], dealerCards = [], showdown = false, dealProgress = 0 } = teenPattiData;

    // Deal Player Cards to center-front of table:
    // Slot 1: (-0.95, 0.05, 0.6)
    // Slot 2: (0, 0.05, 0.6)
    // Slot 3: (0.95, 0.05, 0.6)
    playerCards.forEach((card, idx) => {
      const cardId = `p_${idx}_${card.suit}_${card.value}`;
      if (!dealtCardIdsRef.current.has(cardId) && dealProgress >= (idx * 2 + 1)) {
        dealtCardIdsRef.current.add(cardId);
        const targetX = (idx - 1) * 0.95;

        sceneRef.current?.dealCard({
          id: cardId,
          suit: card.suit,
          rank: card.value,
          targetPos: { x: targetX, y: 0.06, z: 0.65 },
          targetRotY: (idx - 1) * 0.08,
          isFaceUp: true,
          dealerSide: idx % 2 === 0 ? 'left' : 'right'
        });
        setDealerAction(`Elena Dealing Player Card ${idx + 1}`);
      }
    });

    // Deal Dealer Cards to center-back of table:
    // Slot 1: (-0.95, 0.05, -0.4)
    // Slot 2: (0, 0.05, -0.4)
    // Slot 3: (0.95, 0.05, -0.4)
    dealerCards.forEach((card, idx) => {
      const cardId = `d_${idx}_${card.suit}_${card.value}`;
      if (!dealtCardIdsRef.current.has(cardId) && dealProgress >= (idx * 2 + 2)) {
        dealtCardIdsRef.current.add(cardId);
        const targetX = (idx - 1) * 0.95;

        sceneRef.current?.dealCard({
          id: cardId,
          suit: card.suit,
          rank: card.value,
          targetPos: { x: targetX, y: 0.06, z: -0.45 },
          targetRotY: (idx - 1) * 0.08,
          isFaceUp: showdown,
          dealerSide: idx % 2 === 0 ? 'right' : 'left'
        });
        setDealerAction(`Marcus Dealing Dealer Card ${idx + 1}`);
      }
    });

    // If showdown triggered, flip dealer cards
    if (showdown) {
      dealerCards.forEach((card, idx) => {
        const cardId = `d_${idx}_${card.suit}_${card.value}`;
        sceneRef.current?.flipCard(cardId);
      });
      setDealerAction('Showdown — Cards Revealed');
    }
  }, [gameMode, teenPattiData]);

  // 5. Synchronize Andar Bahar Cards (Joker + Alternating Andar/Bahar)
  useEffect(() => {
    if (gameMode !== 'andar_bahar' || !sceneRef.current || !andarBaharData) return;
    const { jokerCard, dealtCards = [] } = andarBaharData;

    // Deal Joker to Center Pedestal
    if (jokerCard) {
      const jokerId = `joker_${jokerCard.suit}_${jokerCard.value}`;
      if (!dealtCardIdsRef.current.has(jokerId)) {
        dealtCardIdsRef.current.add(jokerId);
        sceneRef.current.dealCard({
          id: jokerId,
          suit: jokerCard.suit,
          rank: jokerCard.value,
          targetPos: { x: 0, y: 0.12, z: 0.05 },
          isFaceUp: true,
          dealerSide: 'left'
        });
        setDealerAction(`Elena Deals Joker: ${jokerCard.value}${jokerCard.suit}`);
      }
    }

    // Alternating Andar & Bahar Cards
    dealtCards.forEach((item, idx) => {
      const cardId = `ab_${idx}_${item.side}_${item.card.suit}_${item.card.value}`;
      if (!dealtCardIdsRef.current.has(cardId)) {
        dealtCardIdsRef.current.add(cardId);
        const isAndar = item.side === 'andar';

        // Stack neatly along left (Andar) or right (Bahar) trays
        const slotOffset = (idx % 6) * 0.38;
        const targetX = isAndar ? -1.8 + slotOffset * 0.35 : 1.8 - slotOffset * 0.35;
        const targetZ = 0.55 + slotOffset * 0.15;

        sceneRef.current?.dealCard({
          id: cardId,
          suit: item.card.suit,
          rank: item.card.value,
          targetPos: { x: targetX, y: 0.06 + idx * 0.008, z: targetZ },
          isFaceUp: true,
          dealerSide: isAndar ? 'left' : 'right'
        });
        setDealerAction(`${isAndar ? 'Elena' : 'Marcus'} Dealing ${item.side.toUpperCase()}`);
      }
    });
  }, [gameMode, andarBaharData]);

  return (
    <div
      id="live-3d-dealer-viewport"
      className="relative w-full rounded-2xl overflow-hidden border border-amber-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.85)] bg-[#050b08] select-none"
      style={{ height: '340px' }}
    >
      {/* 3D Canvas Host Element */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP BROADCAST STATUS BAR */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
        {/* Left: HD Live Indicator + Dealers Badge */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/80 border border-emerald-500/40 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              3D LIVE
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-black/70 border border-amber-500/30 text-[10px] text-amber-200 backdrop-blur-md">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>ELENA & MARCUS</span>
          </div>
        </div>

        {/* Right: Round Info & Audio Control */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {countdown !== undefined && countdown > 0 && (
            <div className="px-2.5 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/50 backdrop-blur-md flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-amber-300 uppercase">BET</span>
              <span className="font-mono font-black text-xs text-amber-400">{countdown}s</span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleSound}
            className="w-7 h-7 rounded-lg bg-black/70 border border-white/20 flex items-center justify-center text-amber-300 hover:bg-black/90 active:scale-95 transition-all shadow-md backdrop-blur-md cursor-pointer"
            title={soundEnabled ? 'Mute Studio Audio' : 'Enable Studio Audio'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 text-zinc-500" />}
          </button>
        </div>
      </div>

      {/* DEALER ACTION CALLOUT OVERLAY */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/80 border border-amber-500/40 shadow-lg backdrop-blur-md">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
        <span className="text-[11px] font-semibold text-amber-100 tracking-wide">
          {dealerAction}
        </span>
      </div>

      {/* DEALER SIGNATURES ON SIDES */}
      <div className="absolute bottom-2 left-3 pointer-events-none z-10 flex flex-col text-left opacity-75">
        <span className="text-[9px] font-black uppercase tracking-wider text-amber-400/90">
          Elena V.
        </span>
        <span className="text-[8px] text-zinc-400">Senior Croupier</span>
      </div>

      <div className="absolute bottom-2 right-3 pointer-events-none z-10 flex flex-col text-right opacity-75">
        <span className="text-[9px] font-black uppercase tracking-wider text-amber-400/90">
          Marcus D.
        </span>
        <span className="text-[8px] text-zinc-400">Lead Croupier</span>
      </div>
    </div>
  );
};
