import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Radio } from 'lucide-react';

export type DealerActionState = 'idle' | 'betting' | 'shuffle' | 'deal' | 'result';

interface TwoHumanDealersProps {
  actionState?: DealerActionState;
  activeDealer?: 'left' | 'right' | 'both';
  dealerStatusText?: string;
  gameTitle?: string;
  className?: string;
}

export const TwoHumanDealers: React.FC<TwoHumanDealersProps> = ({
  actionState = 'idle',
  activeDealer = 'both',
  dealerStatusText,
  gameTitle,
  className = ''
}) => {
  // Random ambient blink timers for lifelike realism
  const [leftBlink, setLeftBlink] = useState(false);
  const [rightBlink, setRightBlink] = useState(false);

  useEffect(() => {
    const leftInterval = setInterval(() => {
      setLeftBlink(true);
      setTimeout(() => setLeftBlink(false), 140);
    }, 4200 + Math.random() * 2000);

    const rightInterval = setInterval(() => {
      setRightBlink(true);
      setTimeout(() => setRightBlink(false), 140);
    }, 4800 + Math.random() * 2000);

    return () => {
      clearInterval(leftInterval);
      clearInterval(rightInterval);
    };
  }, []);

  // Compute dealer status subtitle based on game action
  const getDealerSubtitle = (dealerSide: 'left' | 'right') => {
    if (dealerStatusText) return dealerStatusText;
    switch (actionState) {
      case 'shuffle':
        return dealerSide === 'left' ? 'Splitting deck...' : 'Riffling cards...';
      case 'deal':
        return activeDealer === dealerSide || activeDealer === 'both' ? 'Dealing cards' : 'Observing play';
      case 'result':
        return 'Round complete';
      case 'betting':
      default:
        return 'Bets are open';
    }
  };

  return (
    <div
      className={`relative w-full flex items-end justify-between px-2 sm:px-4 pointer-events-none select-none ${className}`}
      aria-label="Two Professional Casino Dealers"
    >
      {/* ------------------------------------------------------------- */}
      {/* LEFT DEALER: ELENA (Senior Croupier) */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        className="relative flex flex-col items-center z-10 origin-bottom"
        animate={{
          y: actionState === 'shuffle' ? [0, 3, 1] : [0, -2, 0],
          scale: actionState === 'shuffle' ? 1.02 : [1, 1.008, 1],
          rotate: actionState === 'shuffle' ? 1.5 : [-0.4, 0.4, -0.4]
        }}
        transition={{
          duration: actionState === 'shuffle' ? 0.8 : 4.5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      >
        {/* Dealer Spotlight Backlight */}
        <div className="absolute -top-4 -left-4 w-24 h-24 sm:w-28 sm:h-28 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

        {/* Live Status Pill */}
        <div className="relative mb-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/75 border border-amber-500/40 text-[9px] sm:text-[10px] text-amber-200 font-medium backdrop-blur-md shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-bold tracking-tight">ELENA</span>
          <span className="text-amber-400/60 hidden sm:inline">• Croupier</span>
        </div>

        {/* Dealer Realistic Portrait Avatar Frame */}
        <div className="relative w-14 h-14 sm:w-18 sm:h-18 rounded-full p-[2px] bg-gradient-to-b from-amber-400 via-amber-700 to-black shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
          <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-950 border border-amber-300/30">
            {/* Elena Image */}
            <img
              src="/assets/dealers/dealer_female.jpg"
              alt="Elena - Live Casino Dealer"
              className="w-full h-full object-cover object-top scale-110 filter brightness-[1.03] contrast-[1.05]"
              loading="eager"
            />

            {/* Realistic Eye Blink Overlay */}
            {leftBlink && (
              <div className="absolute inset-0 bg-[#070b10]/40 transition-opacity duration-75" />
            )}

            {/* Subtle Studio Rim Lighting Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-amber-200/20 pointer-events-none" />
          </div>

          {/* Golden Casino Pin */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 border border-black flex items-center justify-center shadow-md">
            <Sparkles className="w-2.5 h-2.5 text-slate-950 fill-slate-950" />
          </div>
        </div>

        {/* Action Caption */}
        <span className="text-[8px] sm:text-[9px] text-emerald-300/80 font-mono tracking-tight mt-0.5 max-w-[80px] sm:max-w-[100px] truncate text-center">
          {getDealerSubtitle('left')}
        </span>
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* CENTER DEALER CREST / CASINO BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col items-center mb-1 px-2 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-amber-500/30 backdrop-blur-md shadow-inner">
          <Radio className="w-2.5 h-2.5 text-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">
            {gameTitle || 'Live Casino Studio'}
          </span>
          <span className="text-[9px] font-mono text-emerald-400 font-bold">LIVE</span>
        </div>
        <span className="text-[8px] sm:text-[9px] text-amber-300/60 font-sans tracking-wide mt-0.5">
          Two Pro Dealers • Synchronized Shuffle
        </span>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RIGHT DEALER: MARCUS (Lead Croupier) */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        className="relative flex flex-col items-center z-10 origin-bottom"
        animate={{
          y: actionState === 'shuffle' ? [0, 3, 1] : [0, -2.2, 0],
          scale: actionState === 'shuffle' ? 1.02 : [1, 1.008, 1],
          rotate: actionState === 'shuffle' ? -1.5 : [0.4, -0.4, 0.4]
        }}
        transition={{
          duration: actionState === 'shuffle' ? 0.8 : 4.8,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      >
        {/* Dealer Spotlight Backlight */}
        <div className="absolute -top-4 -right-4 w-24 h-24 sm:w-28 sm:h-28 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

        {/* Live Status Pill */}
        <div className="relative mb-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/75 border border-amber-500/40 text-[9px] sm:text-[10px] text-amber-200 font-medium backdrop-blur-md shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-bold tracking-tight">MARCUS</span>
          <span className="text-amber-400/60 hidden sm:inline">• Lead</span>
        </div>

        {/* Dealer Realistic Portrait Avatar Frame */}
        <div className="relative w-14 h-14 sm:w-18 sm:h-18 rounded-full p-[2px] bg-gradient-to-b from-amber-400 via-amber-700 to-black shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
          <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-950 border border-amber-300/30">
            {/* Marcus Image */}
            <img
              src="/assets/dealers/dealer_male.jpg"
              alt="Marcus - Live Casino Dealer"
              className="w-full h-full object-cover object-top scale-110 filter brightness-[1.03] contrast-[1.05]"
              loading="eager"
            />

            {/* Realistic Eye Blink Overlay */}
            {rightBlink && (
              <div className="absolute inset-0 bg-[#070b10]/40 transition-opacity duration-75" />
            )}

            {/* Subtle Studio Rim Lighting Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tl from-black/50 via-transparent to-amber-200/20 pointer-events-none" />
          </div>

          {/* Golden Casino Pin */}
          <div className="absolute -bottom-1 -left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 border border-black flex items-center justify-center shadow-md">
            <Sparkles className="w-2.5 h-2.5 text-slate-950 fill-slate-950" />
          </div>
        </div>

        {/* Action Caption */}
        <span className="text-[8px] sm:text-[9px] text-emerald-300/80 font-mono tracking-tight mt-0.5 max-w-[80px] sm:max-w-[100px] truncate text-center">
          {getDealerSubtitle('right')}
        </span>
      </motion.div>
    </div>
  );
};
