import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { casinoAudio } from '../../utils/casinoAudio.ts';

interface RealisticCardShuffleProps {
  onComplete?: () => void;
  className?: string;
}

type ShuffleStage =
  | 'approach'
  | 'pickup_split'
  | 'riffle'
  | 'bridge'
  | 'square'
  | 'complete';

export const RealisticCardShuffle: React.FC<RealisticCardShuffleProps> = ({
  onComplete,
  className = ''
}) => {
  const [stage, setStage] = useState<ShuffleStage>('approach');

  useEffect(() => {
    // Stage 1: Approach & reach towards center deck
    const t1 = setTimeout(() => {
      setStage('pickup_split');
    }, 350);

    // Stage 2: Split deck into left & right packets held by dealers
    const t2 = setTimeout(() => {
      setStage('riffle');
      casinoAudio.playRiffleShuffle();
    }, 900);

    // Stage 3: Bridge cascade
    const t3 = setTimeout(() => {
      setStage('bridge');
    }, 1700);

    // Stage 4: Square deck neatly
    const t4 = setTimeout(() => {
      setStage('square');
      casinoAudio.playDeckSquare();
    }, 2250);

    // Stage 5: Done & ready to deal
    const t5 = setTimeout(() => {
      setStage('complete');
      if (onComplete) onComplete();
    }, 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete]);

  // Luxury Casino Card Back
  const renderCardBack = (key: string, style?: React.CSSProperties, extraClasses = '') => (
    <div
      key={key}
      style={style}
      className={`absolute w-13 h-19 sm:w-16 sm:h-22 rounded-lg bg-gradient-to-br from-[#73101b] via-[#450810] to-[#140205] border border-amber-400/60 shadow-md p-1 select-none pointer-events-none overflow-hidden ${extraClasses}`}
    >
      <div className="w-full h-full rounded border border-amber-400/30 flex items-center justify-center bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:4px_4px]">
        <div className="w-4 h-6 rounded-full border border-amber-400/50 flex items-center justify-center bg-[#2b050a] shadow-inner">
          <span className="text-amber-300 font-serif font-black text-[10px]">♠</span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`relative w-full max-w-sm mx-auto h-32 sm:h-36 flex items-center justify-center select-none overflow-visible ${className}`}
      aria-label="Two Dealers Shuffling Deck"
    >
      {/* Table Felt Radial Spotlight */}
      <div className="absolute inset-0 bg-radial from-amber-400/10 via-emerald-500/5 to-transparent rounded-full blur-xl pointer-events-none" />

      {/* Stage Status Indicator */}
      <div className="absolute top-1 z-30 px-3 py-0.5 rounded-full bg-black/70 border border-amber-500/30 text-[9px] sm:text-[10px] font-mono text-amber-300 backdrop-blur-sm shadow-md">
        {stage === 'approach' && 'Dealers reaching for deck...'}
        {stage === 'pickup_split' && 'Splitting deck into packets...'}
        {stage === 'riffle' && 'Riffling cards interleaved...'}
        {stage === 'bridge' && 'Bridging & waterfall cascade...'}
        {stage === 'square' && 'Squaring deck neatly...'}
        {stage === 'complete' && 'Deck ready for deal'}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DEALER HANDS & CARDS INTERACTION LAYER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative w-64 sm:w-72 h-24 flex items-center justify-center mt-3">
        {/* LEFT DEALER (ELENA) HAND & SLEEVE */}
        <motion.div
          className="absolute -left-12 sm:-left-16 z-20 pointer-events-none flex items-center"
          animate={{
            x:
              stage === 'approach'
                ? 10
                : stage === 'pickup_split'
                ? 30
                : stage === 'riffle'
                ? 40
                : stage === 'bridge'
                ? 42
                : stage === 'square'
                ? 48
                : 0,
            y: stage === 'bridge' ? -12 : 0,
            rotate: stage === 'riffle' ? -10 : stage === 'bridge' ? 5 : 0
          }}
          transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
        >
          {/* Black tailored sleeve */}
          <div className="w-14 sm:w-16 h-8 rounded-l-md bg-gradient-to-r from-neutral-900 to-black border-y border-neutral-700 shadow-lg relative flex items-center justify-end">
            {/* White French Cuff & Gold Cufflink */}
            <div className="w-2.5 h-7 rounded-sm bg-slate-100 border border-slate-300 shadow-sm relative flex items-center justify-center mr-0.5">
              <div className="w-1 h-1 rounded-full bg-amber-400 border border-amber-600 shadow-xs" />
            </div>
            {/* Dealer Hand with Fingers Gripping Packet */}
            <div className="w-6 h-6 rounded-r-full bg-[#f0cbb5] border border-[#d6a992] shadow-sm relative flex flex-col justify-between p-0.5">
              <div className="w-full h-1 bg-[#dfb29b] rounded-full" />
              <div className="w-full h-1 bg-[#dfb29b] rounded-full" />
            </div>
          </div>
        </motion.div>

        {/* RIGHT DEALER (MARCUS) HAND & SLEEVE */}
        <motion.div
          className="absolute -right-12 sm:-right-16 z-20 pointer-events-none flex items-center flex-row-reverse"
          animate={{
            x:
              stage === 'approach'
                ? -10
                : stage === 'pickup_split'
                ? -30
                : stage === 'riffle'
                ? -40
                : stage === 'bridge'
                ? -42
                : stage === 'square'
                ? -48
                : 0,
            y: stage === 'bridge' ? -12 : 0,
            rotate: stage === 'riffle' ? 10 : stage === 'bridge' ? -5 : 0
          }}
          transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
        >
          {/* Black tailored sleeve */}
          <div className="w-14 sm:w-16 h-8 rounded-r-md bg-gradient-to-l from-neutral-900 to-black border-y border-neutral-700 shadow-lg relative flex items-center justify-start">
            {/* White French Cuff & Gold Cufflink */}
            <div className="w-2.5 h-7 rounded-sm bg-slate-100 border border-slate-300 shadow-sm relative flex items-center justify-center ml-0.5">
              <div className="w-1 h-1 rounded-full bg-amber-400 border border-amber-600 shadow-xs" />
            </div>
            {/* Dealer Hand with Fingers Gripping Packet */}
            <div className="w-6 h-6 rounded-l-full bg-[#e3b8a1] border border-[#c99881] shadow-sm relative flex flex-col justify-between p-0.5">
              <div className="w-full h-1 bg-[#cf9f88] rounded-full" />
              <div className="w-full h-1 bg-[#cf9f88] rounded-full" />
            </div>
          </div>
        </motion.div>

        {/* ----------------------------------------------------------- */}
        {/* CARDS PHYSCIAL MOVEMENT SEQUENCE */}
        {/* ----------------------------------------------------------- */}
        {/* LEFT PACKET */}
        <motion.div
          className="absolute z-10 w-14 h-20"
          initial={{ x: 0, y: 0, rotate: 0 }}
          animate={{
            x:
              stage === 'approach'
                ? 0
                : stage === 'pickup_split'
                ? -34
                : stage === 'riffle'
                ? -16
                : stage === 'bridge'
                ? -6
                : 0,
            y: stage === 'bridge' ? -14 : 0,
            rotate:
              stage === 'pickup_split'
                ? -10
                : stage === 'riffle'
                ? -6
                : stage === 'bridge'
                ? -1
                : 0
          }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {[0, 1, 2, 3].map((i) =>
            renderCardBack(`left-card-${i}`, {
              top: -i * 1.5,
              left: -i * 0.8,
              zIndex: 10 + i
            })
          )}
        </motion.div>

        {/* RIGHT PACKET */}
        <motion.div
          className="absolute z-10 w-14 h-20"
          initial={{ x: 0, y: 0, rotate: 0 }}
          animate={{
            x:
              stage === 'approach'
                ? 0
                : stage === 'pickup_split'
                ? 34
                : stage === 'riffle'
                ? 16
                : stage === 'bridge'
                ? 6
                : 0,
            y: stage === 'bridge' ? -14 : 0,
            rotate:
              stage === 'pickup_split'
                ? 10
                : stage === 'riffle'
                ? 6
                : stage === 'bridge'
                ? 1
                : 0
          }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {[0, 1, 2, 3].map((i) =>
            renderCardBack(`right-card-${i}`, {
              top: -i * 1.5,
              right: -i * 0.8,
              zIndex: 10 + i
            })
          )}
        </motion.div>

        {/* INTERLEAVING RIFFLE FLUTTER IN CENTER */}
        <AnimatePresence>
          {stage === 'riffle' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
                const isLeft = idx % 2 === 0;
                return (
                  <motion.div
                    key={`riffle-leaf-${idx}`}
                    className="absolute w-13 h-19 sm:w-16 sm:h-22 rounded-lg bg-gradient-to-br from-[#7a121d] via-[#4d0912] to-neutral-950 border border-amber-400/50 shadow-md"
                    initial={{
                      x: isLeft ? -26 : 26,
                      y: -15 - idx * 1.8,
                      rotate: isLeft ? -14 : 14,
                      opacity: 0.7
                    }}
                    animate={{
                      x: (idx - 3.5) * 1.8,
                      y: -idx * 1.2,
                      rotate: (idx % 2 === 0 ? -1 : 1) * 2,
                      opacity: 1
                    }}
                    transition={{
                      duration: 0.38,
                      delay: idx * 0.035,
                      ease: [0.22, 1, 0.36, 1]
                    }}
                  />
                );
              })}
            </div>
          )}
        </AnimatePresence>

        {/* SQUARED DECK UPON COMPLETION */}
        {stage === 'square' && (
          <motion.div
            initial={{ scale: 1.05, opacity: 0.9 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="absolute z-25 flex items-center justify-center"
          >
            {renderCardBack('squared-deck-main', {
              top: -2,
              left: -28,
              boxShadow: '0 8px 24px rgba(0,0,0,0.7), 0 0 10px rgba(245,158,11,0.25)'
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
};
