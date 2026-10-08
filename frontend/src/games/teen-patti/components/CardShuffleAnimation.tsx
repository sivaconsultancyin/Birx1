import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface CardShuffleAnimationProps {
  onComplete?: () => void;
  className?: string;
}

export const CardShuffleAnimation: React.FC<CardShuffleAnimationProps> = ({
  onComplete,
  className = ''
}) => {
  const [shuffleStage, setShuffleStage] = useState<'split' | 'riffle' | 'bridge' | 'square'>('split');

  useEffect(() => {
    // Sequence through realistic casino shuffle stages
    const t1 = setTimeout(() => setShuffleStage('riffle'), 450);
    const t2 = setTimeout(() => setShuffleStage('bridge'), 1100);
    const t3 = setTimeout(() => setShuffleStage('square'), 1600);
    const t4 = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  // Card back design template for riffled cards
  const renderCardBack = (key: string, customStyle?: React.CSSProperties) => (
    <div
      key={key}
      style={customStyle}
      className="absolute w-14 h-20 sm:w-16 sm:h-22 rounded-lg bg-gradient-to-br from-red-900 via-red-950 to-neutral-950 border border-amber-500/50 shadow-md p-1 select-none pointer-events-none"
    >
      <div className="w-full h-full rounded border border-amber-400/30 flex items-center justify-center bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:4px_4px]">
        <div className="w-5 h-7 rounded-full border border-amber-400/50 flex items-center justify-center bg-red-950/90 shadow-sm">
          <span className="text-amber-300 font-serif font-black text-[10px]">♠</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative flex flex-col items-center justify-center p-3 select-none ${className}`}>
      {/* Table Felt Glow & Spotlight */}
      <div className="relative w-64 h-32 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/5 via-emerald-400/10 to-amber-400/5 rounded-full blur-xl pointer-events-none" />

        {/* 1. Split & Riffle Packets */}
        <AnimatePresence mode="wait">
          {shuffleStage !== 'square' ? (
            <div className="relative w-48 h-24 flex items-center justify-center">
              {/* Left Packet */}
              <motion.div
                className="relative w-14 h-20 sm:w-16 sm:h-22"
                initial={{ x: 0, rotate: 0 }}
                animate={{
                  x: shuffleStage === 'split' ? -42 : shuffleStage === 'riffle' ? -18 : -6,
                  rotate: shuffleStage === 'split' ? -12 : shuffleStage === 'riffle' ? -6 : -2,
                  y: shuffleStage === 'bridge' ? -14 : 0
                }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {[0, 1, 2, 3].map((i) =>
                  renderCardBack(`left-stack-${i}`, {
                    top: -i * 1.5,
                    left: -i * 0.8,
                    zIndex: 10 + i
                  })
                )}
              </motion.div>

              {/* Interleaving Riffle Cascade in Center */}
              {shuffleStage === 'riffle' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const isLeft = idx % 2 === 0;
                    return (
                      <motion.div
                        key={`riffle-leaf-${idx}`}
                        className="absolute w-14 h-20 sm:w-16 sm:h-22 rounded-lg bg-gradient-to-br from-red-900 to-neutral-950 border border-amber-500/60 shadow-lg"
                        initial={{
                          x: isLeft ? -30 : 30,
                          y: -20 - idx * 2,
                          rotate: isLeft ? -15 : 15,
                          opacity: 0.8
                        }}
                        animate={{
                          x: (idx - 2.5) * 2,
                          y: -idx * 1.2,
                          rotate: (idx % 2 === 0 ? -1 : 1) * 2,
                          opacity: 1
                        }}
                        transition={{
                          duration: 0.35,
                          delay: idx * 0.06,
                          ease: 'easeOut'
                        }}
                        style={{ zIndex: 30 + idx }}
                      >
                        <div className="w-full h-full rounded border border-amber-400/20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:4px_4px]" />
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Bridge Arch Effect */}
              {shuffleStage === 'bridge' && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  initial={{ scaleY: 0.8, y: -4 }}
                  animate={{
                    scaleY: [1.2, 0.95, 1],
                    y: [-18, -6, 0]
                  }}
                  transition={{ duration: 0.45, ease: 'easeInOut' }}
                >
                  <div className="w-20 h-6 border-t-2 border-amber-400/70 rounded-t-full shadow-[0_-5px_15px_rgba(245,158,11,0.3)]" />
                </motion.div>
              )}

              {/* Right Packet */}
              <motion.div
                className="relative w-14 h-20 sm:w-16 sm:h-22 ml-4"
                initial={{ x: 0, rotate: 0 }}
                animate={{
                  x: shuffleStage === 'split' ? 42 : shuffleStage === 'riffle' ? 18 : 6,
                  rotate: shuffleStage === 'split' ? 12 : shuffleStage === 'riffle' ? 6 : 2,
                  y: shuffleStage === 'bridge' ? -14 : 0
                }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {[0, 1, 2, 3].map((i) =>
                  renderCardBack(`right-stack-${i}`, {
                    top: -i * 1.5,
                    left: i * 0.8,
                    zIndex: 20 + i
                  })
                )}
              </motion.div>
            </div>
          ) : (
            /* 2. Unified Squared Deck */
            <motion.div
              key="squared-deck"
              className="relative w-16 h-22 sm:w-18 sm:h-24 flex items-center justify-center"
              initial={{ scale: 0.95, opacity: 0.8 }}
              animate={{ scale: [1, 1.04, 1], opacity: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {[0, 1, 2, 3, 4, 5].map((i) =>
                renderCardBack(`squared-${i}`, {
                  top: -i * 1.8,
                  left: -i * 0.4,
                  zIndex: 40 + i
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Shuffle Stage Status Pill */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-1 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/60 border border-amber-500/40 text-amber-300 text-[11px] font-semibold tracking-wide shadow-md backdrop-blur-md"
      >
        <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
        <span>
          {shuffleStage === 'split'
            ? 'Splitting 52-Card Deck...'
            : shuffleStage === 'riffle'
            ? 'Dealer Riffle Shuffle...'
            : shuffleStage === 'bridge'
            ? 'Bridging & Squaring...'
            : 'Deck Shuffled & Ready to Deal!'}
        </span>
      </motion.div>
    </div>
  );
};
