import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Wifi, Volume2, VolumeX, ShieldCheck, Sparkles } from 'lucide-react';
import { casinoAudio } from '../../utils/casinoAudio.ts';

export type DealerActionState =
  | 'idle'
  | 'betting'
  | 'approach'
  | 'pickup'
  | 'shuffle'
  | 'bridge'
  | 'square'
  | 'pause'
  | 'deal'
  | 'result';

interface RealisticDealerStudioProps {
  actionState?: DealerActionState;
  activeDealer?: 'left' | 'right' | 'both';
  dealerStatusText?: string;
  gameTitle?: string;
  roundId?: string;
  countdown?: number;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  className?: string;
}

export const RealisticDealerStudio: React.FC<RealisticDealerStudioProps> = ({
  actionState = 'idle',
  activeDealer = 'both',
  dealerStatusText,
  gameTitle = 'Live Casino Studio',
  roundId,
  countdown,
  soundEnabled = true,
  onToggleSound,
  className = ''
}) => {
  // Realistic natural blink and subtle posture drift timers
  const [leftBlink, setLeftBlink] = useState(false);
  const [rightBlink, setRightBlink] = useState(false);
  const [leftPosture, setLeftPosture] = useState(0);
  const [rightPosture, setRightPosture] = useState(0);

  useEffect(() => {
    // Elena's natural blink cycles
    const elenaBlinkInterval = setInterval(() => {
      setLeftBlink(true);
      setTimeout(() => setLeftBlink(false), 130);
    }, 3800 + Math.random() * 2400);

    // Marcus's natural blink cycles
    const marcusBlinkInterval = setInterval(() => {
      setRightBlink(true);
      setTimeout(() => setRightBlink(false), 130);
    }, 4500 + Math.random() * 2200);

    // Subtle breathing/posture micro-shifts
    const postureInterval = setInterval(() => {
      setLeftPosture(Math.sin(Date.now() / 2500) * 1.5);
      setRightPosture(Math.cos(Date.now() / 2700) * 1.5);
    }, 80);

    return () => {
      clearInterval(elenaBlinkInterval);
      clearInterval(marcusBlinkInterval);
      clearInterval(postureInterval);
    };
  }, []);

  // Compute live professional croupier callouts
  const getDealerCallout = (dealer: 'left' | 'right') => {
    if (dealerStatusText) return dealerStatusText;
    switch (actionState) {
      case 'approach':
        return dealer === 'left' ? 'Reaching for deck' : 'Preparing shoe';
      case 'pickup':
        return dealer === 'right' ? 'Picking up deck' : 'Receiving cut packet';
      case 'shuffle':
        return dealer === 'left' ? 'Splitting & riffling' : 'Interleaving cards';
      case 'bridge':
        return 'Bridging cascade';
      case 'square':
        return 'Squaring edges flush';
      case 'pause':
        return 'Deck placed in shoe';
      case 'deal':
        if (activeDealer === 'left' || activeDealer === 'both') {
          return dealer === 'left' ? 'Dealing card to table' : 'Verifying count';
        }
        return dealer === 'right' ? 'Dealing card to table' : 'Observing layout';
      case 'result':
        return 'Round complete';
      case 'betting':
      default:
        return 'Place your bets';
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-t-3xl border-t border-x border-amber-600/30 bg-neutral-950 shadow-[0_12px_40px_rgba(0,0,0,0.9)] select-none ${className}`}
      aria-label="Live Casino Studio with Two Human Dealers"
    >
      {/* ----------------------------------------------------------- */}
      {/* BACKGROUND: LUXURY CASINO STUDIO BOKEH & CHANDELIER AMBIANCE */}
      {/* ----------------------------------------------------------- */}
      <div className="absolute inset-0 z-0">
        <img
          src="/assets/dealers/studio_bg.jpg"
          alt="Live Studio Background"
          className="w-full h-full object-cover object-center filter brightness-[0.45] contrast-[1.1] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#04120b] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(245,158,11,0.12),transparent_70%)] pointer-events-none" />
      </div>

      {/* ----------------------------------------------------------- */}
      {/* TOP STUDIO BROADCAST STATUS BAR (EVOLUTION / EZUGI STYLE) */}
      {/* ----------------------------------------------------------- */}
      <div className="relative z-20 flex items-center justify-between px-3 py-1.5 bg-black/60 backdrop-blur-md border-b border-amber-500/20 text-[10px]">
        {/* Live Broadcast Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 font-bold tracking-wider">
            <Radio className="w-2.5 h-2.5 text-red-400 animate-pulse" />
            <span className="text-[9px]">LIVE HD</span>
          </div>

          <div className="flex items-center gap-1 text-slate-300 font-mono hidden sm:flex">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] text-emerald-400">1080p 60fps</span>
          </div>

          {roundId && (
            <div className="flex items-center gap-1 text-amber-300/80 font-mono text-[9px] border-l border-white/10 pl-2">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>#{roundId}</span>
            </div>
          )}
        </div>

        {/* Center Studio Title */}
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span className="font-serif font-black text-amber-200 tracking-wider uppercase text-[11px]">
            {gameTitle}
          </span>
        </div>

        {/* Right Controls: Timer & Sound */}
        <div className="flex items-center gap-2">
          {typeof countdown === 'number' && (
            <div className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold text-[10px]">
              {countdown}s
            </div>
          )}

          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className="p-1 rounded-full bg-black/60 border border-amber-500/30 text-amber-400 hover:text-amber-200 transition-colors cursor-pointer"
              title={soundEnabled ? 'Mute Studio Audio' : 'Enable Studio Audio'}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* DEALERS ARENA: ELENA (LEFT) & MARCUS (RIGHT) BEHIND FELT */}
      {/* ----------------------------------------------------------- */}
      <div className="relative z-10 w-full h-36 sm:h-44 px-3 sm:px-6 flex items-end justify-between pointer-events-none">
        {/* --------------------------------------------------------- */}
        {/* LEFT DEALER: ELENA (Senior Croupier) */}
        {/* --------------------------------------------------------- */}
        <motion.div
          className="relative flex flex-col items-center origin-bottom mb-[-6px]"
          animate={{
            y:
              actionState === 'shuffle' || actionState === 'bridge'
                ? [0, 4, 1]
                : actionState === 'deal' && (activeDealer === 'left' || activeDealer === 'both')
                ? [0, 6, 2]
                : [0, -2, 0],
            rotate:
              actionState === 'shuffle'
                ? 1.5
                : actionState === 'deal' && (activeDealer === 'left' || activeDealer === 'both')
                ? 2
                : [-0.5, 0.5, -0.5]
          }}
          transition={{
            duration: actionState === 'shuffle' ? 0.7 : 4.6,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          style={{ transform: `translateY(${leftPosture}px)` }}
        >
          {/* Dealer Spotlight */}
          <div className="absolute -top-6 -left-6 w-32 h-32 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />

          {/* Croupier Badge */}
          <div className="relative z-20 mb-1 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/80 border border-amber-500/50 text-[9px] text-amber-200 font-medium backdrop-blur-md shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm animate-pulse" />
            <span className="font-bold tracking-tight">ELENA</span>
            <span className="text-amber-400/70 text-[8px]">• Senior Croupier</span>
          </div>

          {/* Elena Realistic Visual Portrait Frame with Gold Filigree */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[2.5px] bg-gradient-to-b from-amber-300 via-amber-600 to-black shadow-[0_8px_25px_rgba(0,0,0,0.85)]">
            <div className="relative w-full h-full rounded-full overflow-hidden bg-neutral-950 border border-amber-300/40">
              {/* Photorealistic Elena Image */}
              <img
                src="/assets/dealers/dealer_female.jpg"
                alt="Elena - Live Casino Dealer"
                className="w-full h-full object-cover object-top scale-110 filter brightness-[1.04] contrast-[1.06]"
                loading="eager"
              />

              {/* Natural Eye Blink Overlay */}
              {leftBlink && (
                <div className="absolute inset-0 bg-[#0d0705]/45 transition-opacity duration-75" />
              )}

              {/* Studio Rim Lighting Gradient */}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-amber-200/25 pointer-events-none" />
            </div>

            {/* Gold Casino Emblem Pin */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 border border-black flex items-center justify-center shadow-md">
              <span className="text-[9px] font-serif font-black text-black">♠</span>
            </div>
          </div>

          {/* Live Action Subtitle */}
          <div className="mt-1 px-2 py-0.5 rounded-full bg-black/70 border border-emerald-500/30 text-[8px] sm:text-[9px] font-mono text-emerald-300 shadow-sm max-w-[110px] truncate text-center">
            {getDealerCallout('left')}
          </div>
        </motion.div>

        {/* --------------------------------------------------------- */}
        {/* CENTER STUDIO EMBLEM: GOLDEN CASINO SHIELD */}
        {/* --------------------------------------------------------- */}
        <div className="flex flex-col items-center mb-4 text-center">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-b from-amber-300/20 via-black/80 to-black border-2 border-amber-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)] mb-1">
            <span className="font-serif font-black text-amber-300 text-sm sm:text-base">ROYAL</span>
          </div>
          <span className="text-[9px] font-mono text-amber-400/80 uppercase tracking-widest">
            VIP TABLE
          </span>
        </div>

        {/* --------------------------------------------------------- */}
        {/* RIGHT DEALER: MARCUS (Lead Croupier) */}
        {/* --------------------------------------------------------- */}
        <motion.div
          className="relative flex flex-col items-center origin-bottom mb-[-6px]"
          animate={{
            y:
              actionState === 'shuffle' || actionState === 'bridge'
                ? [0, 4, 1]
                : actionState === 'deal' && (activeDealer === 'right' || activeDealer === 'both')
                ? [0, 6, 2]
                : [0, -2.2, 0],
            rotate:
              actionState === 'shuffle'
                ? -1.5
                : actionState === 'deal' && (activeDealer === 'right' || activeDealer === 'both')
                ? -2
                : [0.5, -0.5, 0.5]
          }}
          transition={{
            duration: actionState === 'shuffle' ? 0.7 : 4.8,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          style={{ transform: `translateY(${rightPosture}px)` }}
        >
          {/* Dealer Spotlight */}
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />

          {/* Croupier Badge */}
          <div className="relative z-20 mb-1 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/80 border border-amber-500/50 text-[9px] text-amber-200 font-medium backdrop-blur-md shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm animate-pulse" />
            <span className="font-bold tracking-tight">MARCUS</span>
            <span className="text-amber-400/70 text-[8px]">• Lead Croupier</span>
          </div>

          {/* Marcus Realistic Visual Portrait Frame with Gold Filigree */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[2.5px] bg-gradient-to-b from-amber-300 via-amber-600 to-black shadow-[0_8px_25px_rgba(0,0,0,0.85)]">
            <div className="relative w-full h-full rounded-full overflow-hidden bg-neutral-950 border border-amber-300/40">
              {/* Photorealistic Marcus Image */}
              <img
                src="/assets/dealers/dealer_male.jpg"
                alt="Marcus - Live Casino Dealer"
                className="w-full h-full object-cover object-top scale-110 filter brightness-[1.04] contrast-[1.06]"
                loading="eager"
              />

              {/* Natural Eye Blink Overlay */}
              {rightBlink && (
                <div className="absolute inset-0 bg-[#0d0705]/45 transition-opacity duration-75" />
              )}

              {/* Studio Rim Lighting Gradient */}
              <div className="absolute inset-0 bg-gradient-to-tl from-black/40 via-transparent to-amber-200/25 pointer-events-none" />
            </div>

            {/* Gold Casino Emblem Pin */}
            <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 border border-black flex items-center justify-center shadow-md">
              <span className="text-[9px] font-serif font-black text-black">♣</span>
            </div>
          </div>

          {/* Live Action Subtitle */}
          <div className="mt-1 px-2 py-0.5 rounded-full bg-black/70 border border-emerald-500/30 text-[8px] sm:text-[9px] font-mono text-emerald-300 shadow-sm max-w-[110px] truncate text-center">
            {getDealerCallout('right')}
          </div>
        </motion.div>
      </div>

      {/* Bottom Mahogany Table Edge Divider */}
      <div className="relative z-30 w-full h-2 bg-gradient-to-r from-[#381a07] via-[#6d3714] to-[#381a07] border-t border-amber-500/30 shadow-[0_4px_10px_rgba(0,0,0,0.9)]" />
    </div>
  );
};
