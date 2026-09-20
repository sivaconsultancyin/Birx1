import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { casinoAudio } from '../../utils/casinoAudio.ts';

export type PhysicalShuffleStage =
  | 'approach'     // 1. Hands move toward deck
  | 'pickup'       // 2. Marcus picks up deck
  | 'split'        // 3. Deck handled between dealers and split into two packets
  | 'angle_grip'   // 4 & 5. Dealers position fingers, wrists, and thumbs
  | 'riffle'       // 6. Visible interleaving riffle shuffle
  | 'bridge'       // 7. Bridge arch & waterfall cascade
  | 'square'       // 8. Square deck naturally
  | 'pause'        // 9. Short natural pause
  | 'complete';    // 10. Ready for deal

interface RealisticLiveShuffleEngineProps {
  onComplete?: () => void;
  className?: string;
}

export const RealisticLiveShuffleEngine: React.FC<RealisticLiveShuffleEngineProps> = ({
  onComplete,
  className = ''
}) => {
  const [stage, setStage] = useState<PhysicalShuffleStage>('approach');
  const [riffleTick, setRiffleTick] = useState<number>(0);

  useEffect(() => {
    // 1. Approach: Hands move to center deck (0ms - 400ms)
    setStage('approach');

    // 2. Pickup: Marcus picks up deck (400ms)
    const tPickup = setTimeout(() => {
      setStage('pickup');
      casinoAudio.playCardDeal();
    }, 450);

    // 3. Split: Handled between dealers and split into 2 packets (900ms)
    const tSplit = setTimeout(() => {
      setStage('split');
      casinoAudio.playCardFlip();
    }, 950);

    // 4 & 5. Angle & Grip: Natural finger, wrist, and hand tension (1450ms)
    const tGrip = setTimeout(() => {
      setStage('angle_grip');
    }, 1450);

    // 6. Riffle: High-frequency alternating flutter (1900ms)
    const tRiffle = setTimeout(() => {
      setStage('riffle');
      casinoAudio.playRiffleShuffle();
      // Tick riffle cards
      const rInterval = setInterval(() => {
        setRiffleTick((t) => (t + 1) % 12);
      }, 50);
      setTimeout(() => clearInterval(rInterval), 650);
    }, 1900);

    // 7. Bridge: Waterfall cascade (2600ms)
    const tBridge = setTimeout(() => {
      setStage('bridge');
    }, 2600);

    // 8. Square: Dealers square deck neatly (3150ms)
    const tSquare = setTimeout(() => {
      setStage('square');
      casinoAudio.playDeckSquare();
    }, 3150);

    // 9. Natural Pause: Deck ready in shoe (3650ms)
    const tPause = setTimeout(() => {
      setStage('pause');
    }, 3650);

    // 10. Complete: Hand off to deal (4000ms)
    const tComplete = setTimeout(() => {
      setStage('complete');
      if (onComplete) onComplete();
    }, 4100);

    return () => {
      clearTimeout(tPickup);
      clearTimeout(tSplit);
      clearTimeout(tGrip);
      clearTimeout(tRiffle);
      clearTimeout(tBridge);
      clearTimeout(tSquare);
      clearTimeout(tPause);
      clearTimeout(tComplete);
    };
  }, [onComplete]);

  // Stage Narrative Label
  const getStageDescription = () => {
    switch (stage) {
      case 'approach':
        return 'Both dealers moving hands toward deck';
      case 'pickup':
        return 'Marcus picking up deck from felt';
      case 'split':
        return 'Elena & Marcus splitting into two 26-card packets';
      case 'angle_grip':
        return 'Aligning thumbs & fingers along bevel';
      case 'riffle':
        return 'Riffling cards interleave in center';
      case 'bridge':
        return 'Arching bridge & waterfall cascade';
      case 'square':
        return 'Squaring edges flush against felt';
      case 'pause':
        return 'Brief pause • Cutting into dealing shoe';
      case 'complete':
        return 'Deck prepared • Beginning deal';
    }
  };

  // Realistic Casino Playing Card Back
  const renderCardPacket = (
    key: string,
    layerCount: number,
    side: 'left' | 'right' | 'center',
    isBridging = false
  ) => (
    <div
      key={key}
      className={`relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-gradient-to-br from-[#7a121d] via-[#450810] to-[#140205] border border-amber-400/70 shadow-[0_6px_16px_rgba(0,0,0,0.85)] p-1 pointer-events-none select-none transition-transform duration-200 ${
        isBridging ? 'shadow-[0_14px_25px_rgba(0,0,0,0.9)]' : ''
      }`}
      style={{
        transform: isBridging
          ? `perspective(400px) rotateX(25deg) ${side === 'left' ? 'rotateY(15deg)' : 'rotateY(-15deg)'}`
          : 'none'
      }}
    >
      {/* Decorative Guilloche Card Back Mesh */}
      <div className="w-full h-full rounded border border-amber-400/40 flex items-center justify-center bg-[radial-gradient(#f59e0b_1.2px,transparent_1.2px)] [background-size:5px_5px] relative overflow-hidden">
        {/* Subtle Edge Layer Thickness Illusion */}
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20 border-l border-amber-500/40" />

        {/* Center Medallion */}
        <div className="w-5 h-7 sm:w-6 sm:h-8 rounded-full border border-amber-400/60 bg-[#2b050a] flex items-center justify-center shadow-inner">
          <span className="text-amber-300 font-serif font-black text-[11px]">♠</span>
        </div>
      </div>

      {/* Layer stack effect underneath */}
      {layerCount > 1 && (
        <div className="absolute -bottom-1 -right-0.5 w-full h-full rounded-lg bg-black/40 -z-10 border-b border-r border-white/10 pointer-events-none" />
      )}
    </div>
  );

  return (
    <div
      className={`relative w-full max-w-md mx-auto h-40 sm:h-44 flex flex-col items-center justify-center select-none overflow-visible ${className}`}
      aria-label="Realistic Physical Casino Card Shuffle by Elena and Marcus"
    >
      {/* Ambient Felt Spotlight */}
      <div className="absolute inset-0 bg-radial from-amber-400/15 via-emerald-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* Stage Status Pill Badge */}
      <div className="absolute top-0 z-30 flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-black/85 border border-amber-500/40 text-[10px] sm:text-[11px] font-mono text-amber-200 backdrop-blur-md shadow-lg">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="font-bold">{getStageDescription()}</span>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ARENA: PHYSICAL ARMS, HANDS & DECK MANIPULATION */}
      {/* ------------------------------------------------------------- */}
      <div className="relative w-72 sm:w-80 h-28 flex items-center justify-center mt-4">
        {/* ----------------------------------------------------------- */}
        {/* ELENA'S HAND & FOREARM (LEFT DEALER) */}
        {/* ----------------------------------------------------------- */}
        <motion.div
          className="absolute -left-16 sm:-left-20 z-20 pointer-events-none flex items-center"
          animate={{
            x:
              stage === 'approach'
                ? 15
                : stage === 'pickup'
                ? 25
                : stage === 'split'
                ? 45
                : stage === 'angle_grip'
                ? 52
                : stage === 'riffle'
                ? 58
                : stage === 'bridge'
                ? 62
                : stage === 'square'
                ? 66
                : stage === 'pause'
                ? 30
                : 0,
            y:
              stage === 'bridge'
                ? -16
                : stage === 'riffle'
                ? -4
                : stage === 'square'
                ? 2
                : 0,
            rotate:
              stage === 'angle_grip'
                ? -12
                : stage === 'riffle'
                ? -8
                : stage === 'bridge'
                ? 10
                : stage === 'square'
                ? -2
                : 0
          }}
          transition={{
            duration: 0.38,
            ease: [0.22, 1, 0.36, 1]
          }}
        >
          {/* Black tailored suit sleeve with satin sheen */}
          <div className="w-18 sm:w-22 h-9 rounded-l-md bg-gradient-to-r from-neutral-950 via-[#181818] to-neutral-900 border-y border-neutral-700 shadow-2xl relative flex items-center justify-end">
            {/* White French Cuff */}
            <div className="w-3 h-8 rounded-sm bg-slate-100 border border-slate-300 shadow-sm relative flex items-center justify-center mr-0.5">
              {/* Gold Cufflink */}
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 border border-amber-800 shadow-xs" />
            </div>

            {/* Anatomical Human Female Hand (Elena) */}
            <div className="w-8 h-8 rounded-r-2xl bg-gradient-to-r from-[#edd3c1] to-[#e6c3ad] border border-[#cf9e84] shadow-md relative flex flex-col justify-between p-0.5">
              {/* Thumb along top bevel */}
              <div className="w-3 h-1.5 rounded-full bg-[#dfb29a] border-t border-[#cf9e84] self-end -mr-1" />
              {/* Knuckles & fingers gripping card edge */}
              <div className="w-full h-1 bg-[#dfb29a] rounded-full" />
              <div className="w-full h-1 bg-[#dfb29a] rounded-full" />
              <div className="w-4 h-1.5 rounded-full bg-[#dfb29a] border-b border-[#cf9e84] self-end -mr-0.5" />
            </div>
          </div>
        </motion.div>

        {/* ----------------------------------------------------------- */}
        {/* MARCUS'S HAND & FOREARM (RIGHT DEALER) */}
        {/* ----------------------------------------------------------- */}
        <motion.div
          className="absolute -right-16 sm:-right-20 z-20 pointer-events-none flex items-center flex-row-reverse"
          animate={{
            x:
              stage === 'approach'
                ? -15
                : stage === 'pickup'
                ? -35
                : stage === 'split'
                ? -45
                : stage === 'angle_grip'
                ? -52
                : stage === 'riffle'
                ? -58
                : stage === 'bridge'
                ? -62
                : stage === 'square'
                ? -66
                : stage === 'pause'
                ? -30
                : 0,
            y:
              stage === 'bridge'
                ? -16
                : stage === 'riffle'
                ? -4
                : stage === 'square'
                ? 2
                : 0,
            rotate:
              stage === 'angle_grip'
                ? 12
                : stage === 'riffle'
                ? 8
                : stage === 'bridge'
                ? -10
                : stage === 'square'
                ? 2
                : 0
          }}
          transition={{
            duration: 0.38,
            ease: [0.22, 1, 0.36, 1]
          }}
        >
          {/* Black tailored suit sleeve with satin sheen */}
          <div className="w-18 sm:w-22 h-9 rounded-r-md bg-gradient-to-l from-neutral-950 via-[#181818] to-neutral-900 border-y border-neutral-700 shadow-2xl relative flex items-center justify-start">
            {/* White French Cuff */}
            <div className="w-3 h-8 rounded-sm bg-slate-100 border border-slate-300 shadow-sm relative flex items-center justify-center ml-0.5">
              {/* Gold Cufflink */}
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 border border-amber-800 shadow-xs" />
            </div>

            {/* Anatomical Human Male Hand (Marcus) */}
            <div className="w-8 h-8 rounded-l-2xl bg-gradient-to-l from-[#e4beaa] to-[#d8af99] border border-[#c4937a] shadow-md relative flex flex-col justify-between p-0.5">
              {/* Thumb along top bevel */}
              <div className="w-3 h-1.5 rounded-full bg-[#caa08a] border-t border-[#b88c74] self-start -ml-1" />
              {/* Knuckles & fingers gripping card edge */}
              <div className="w-full h-1 bg-[#caa08a] rounded-full" />
              <div className="w-full h-1 bg-[#caa08a] rounded-full" />
              <div className="w-4 h-1.5 rounded-full bg-[#caa08a] border-b border-[#b88c74] self-start -ml-0.5" />
            </div>
          </div>
        </motion.div>

        {/* ----------------------------------------------------------- */}
        {/* CARDS DYNAMICS: PICKUP, SPLIT, RIFFLE, BRIDGE, SQUARE */}
        {/* ----------------------------------------------------------- */}
        {/* LEFT PACKET (HELD BY ELENA) */}
        <motion.div
          className="absolute z-10"
          animate={{
            x:
              stage === 'approach'
                ? 0
                : stage === 'pickup'
                ? -10
                : stage === 'split'
                ? -42
                : stage === 'angle_grip'
                ? -36
                : stage === 'riffle'
                ? -18
                : stage === 'bridge'
                ? -8
                : stage === 'square'
                ? 0
                : 0,
            y:
              stage === 'pickup'
                ? -4
                : stage === 'bridge'
                ? -18
                : 0,
            rotate:
              stage === 'split'
                ? -12
                : stage === 'angle_grip'
                ? -8
                : stage === 'riffle'
                ? -4
                : stage === 'bridge'
                ? -1
                : 0
          }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        >
          {renderCardPacket('elena-packet', 4, 'left', stage === 'bridge')}
        </motion.div>

        {/* RIGHT PACKET (HELD BY MARCUS) */}
        <motion.div
          className="absolute z-10"
          animate={{
            x:
              stage === 'approach'
                ? 0
                : stage === 'pickup'
                ? 10
                : stage === 'split'
                ? 42
                : stage === 'angle_grip'
                ? 36
                : stage === 'riffle'
                ? 18
                : stage === 'bridge'
                ? 8
                : stage === 'square'
                ? 0
                : 0,
            y:
              stage === 'pickup'
                ? -4
                : stage === 'bridge'
                ? -18
                : 0,
            rotate:
              stage === 'split'
                ? 12
                : stage === 'angle_grip'
                ? 8
                : stage === 'riffle'
                ? 4
                : stage === 'bridge'
                ? 1
                : 0
          }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        >
          {renderCardPacket('marcus-packet', 4, 'right', stage === 'bridge')}
        </motion.div>

        {/* CENTER INTERLEAVED CARDS DURING RIFFLE */}
        <AnimatePresence>
          {stage === 'riffle' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => {
                const isLeft = idx % 2 === 0;
                return (
                  <motion.div
                    key={`riffle-leaf-${idx}`}
                    className="absolute w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-gradient-to-br from-[#7a121d] via-[#4d0912] to-neutral-950 border border-amber-400/60 shadow-md"
                    initial={{
                      x: isLeft ? -30 : 30,
                      y: -12 - idx * 1.5,
                      rotate: isLeft ? -15 : 15,
                      opacity: 0.8
                    }}
                    animate={{
                      x: (idx - 4.5) * 2,
                      y: -idx * 1.1,
                      rotate: (idx % 2 === 0 ? -1 : 1) * 1.5,
                      opacity: 1
                    }}
                    transition={{
                      duration: 0.32,
                      delay: idx * 0.03,
                      ease: [0.22, 1, 0.36, 1]
                    }}
                  />
                );
              })}
            </div>
          )}
        </AnimatePresence>

        {/* SQUARED UNIFIED DECK UPON CONCLUSION */}
        {(stage === 'square' || stage === 'pause' || stage === 'complete') && (
          <motion.div
            initial={{ scale: 1.06, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="absolute z-25 flex items-center justify-center"
          >
            {renderCardPacket('squared-deck-final', 6, 'center', false)}
          </motion.div>
        )}
      </div>
    </div>
  );
};
