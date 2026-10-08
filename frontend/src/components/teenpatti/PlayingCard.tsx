import React from 'react';
import { motion } from 'motion/react';
import { Card } from '../../types.ts';

interface PlayingCardProps {
  card?: Card;
  isFaceUp?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'mini';
  isHighlighted?: boolean;
  delay?: number;
  className?: string;
  animateDeal?: boolean;
  dealOrigin?: { x: number; y: number };
  naturalRotation?: number; // subtle angle (-2° to +2°) for human dealer feel
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  isFaceUp = true,
  size = 'md',
  isHighlighted = false,
  delay = 0,
  className = '',
  animateDeal = false,
  dealOrigin,
  naturalRotation = 0
}) => {
  // Dimension tokens optimized for mobile-first responsiveness
  const dimensions = {
    mini: 'w-7 h-10 rounded text-[9px]',
    sm: 'w-11 h-16 rounded-md text-xs',
    md: 'w-16 h-24 sm:w-18 sm:h-26 rounded-xl text-sm',
    lg: 'w-20 h-28 sm:w-24 sm:h-34 rounded-xl text-base'
  };

  const isRed = card?.suit === 'hearts' || card?.suit === 'diamonds';

  const getSuitSymbol = (suit?: Card['suit']) => {
    switch (suit) {
      case 'hearts':
        return '♥';
      case 'diamonds':
        return '♦';
      case 'clubs':
        return '♣';
      case 'spades':
      default:
        return '♠';
    }
  };

  // Luxury Royal Casino Card Back
  const cardBack = (
    <div
      className="w-full h-full rounded-[inherit] bg-gradient-to-br from-[#7a121d] via-[#4d0912] to-[#1a0306] p-1 border-2 border-amber-500/60 shadow-[inset_0_0_12px_rgba(0,0,0,0.8)] flex items-center justify-center relative overflow-hidden select-none"
    >
      {/* Decorative Gold Filigree Border */}
      <div className="w-full h-full rounded-[inherit] border border-amber-400/40 flex items-center justify-center bg-[radial-gradient(#f59e0b_1.2px,transparent_1.2px)] [background-size:6px_6px] opacity-90 relative">
        {/* Ornate Oval Medallion */}
        <div className="w-6 h-9 sm:w-8 sm:h-12 rounded-full border-2 border-amber-400/70 flex items-center justify-center bg-gradient-to-b from-[#3a060c] to-[#120204] shadow-[0_0_8px_rgba(245,158,11,0.3)]">
          <span className="text-amber-300 font-serif font-black text-xs sm:text-sm tracking-tighter drop-shadow-md">
            ♠
          </span>
        </div>
      </div>
    </div>
  );

  // High-Resolution Card Front
  const cardFront = card ? (
    <div
      className={`w-full h-full rounded-[inherit] bg-gradient-to-b from-[#ffffff] via-[#fcfbf9] to-[#f4f2ec] p-1.5 sm:p-2 flex flex-col justify-between border-2 border-slate-200 shadow-md relative overflow-hidden select-none ${
        isRed ? 'text-red-600' : 'text-slate-900'
      }`}
    >
      {/* Subtle glossy sheen reflection line */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent pointer-events-none opacity-60" />

      {/* Top-Left Index */}
      <div className="flex flex-col items-start leading-none font-black tracking-tight z-10">
        <span className="font-serif text-xs sm:text-base">{card.rank}</span>
        <span className="text-[11px] sm:text-sm -mt-0.5">{getSuitSymbol(card.suit)}</span>
      </div>

      {/* Center Suit Pip / Face Emblem */}
      <div className="flex items-center justify-center self-center my-auto z-10">
        <span
          className={`font-serif leading-none select-none drop-shadow-sm transition-transform duration-300 ${
            size === 'mini'
              ? 'text-sm'
              : size === 'sm'
              ? 'text-xl'
              : size === 'md'
              ? 'text-3xl sm:text-4xl'
              : 'text-4xl sm:text-5xl'
          }`}
        >
          {getSuitSymbol(card.suit)}
        </span>
      </div>

      {/* Bottom-Right Rotated Index */}
      <div className="flex flex-col items-end leading-none font-black tracking-tight rotate-180 z-10">
        <span className="font-serif text-xs sm:text-base">{card.rank}</span>
        <span className="text-[11px] sm:text-sm -mt-0.5">{getSuitSymbol(card.suit)}</span>
      </div>
    </div>
  ) : (
    cardBack
  );

  // Trajectory calculation: card travels smoothly from shoe (dealOrigin) to hand slot
  const startX = dealOrigin ? dealOrigin.x : 80;
  const startY = dealOrigin ? dealOrigin.y : -140;

  return (
    <motion.div
      initial={
        animateDeal
          ? {
              opacity: 0,
              scale: 0.5,
              x: startX,
              y: startY,
              rotate: -20,
              boxShadow: '0 25px 35px -5px rgba(0,0,0,0.8)'
            }
          : false
      }
      animate={{
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
        rotate: naturalRotation,
        boxShadow: isHighlighted
          ? '0 0 20px 4px rgba(245, 158, 11, 0.7)'
          : '0 8px 16px -2px rgba(0, 0, 0, 0.5)'
      }}
      transition={{
        duration: 0.48,
        delay,
        ease: [0.16, 1, 0.3, 1]
      }}
      className={`relative select-none transition-shadow duration-300 ${dimensions[size]} ${
        isHighlighted
          ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-emerald-950 scale-[1.03]'
          : ''
      } ${className}`}
      style={{ perspective: 1000 }}
    >
      {/* 3D Rotating Card Container */}
      <motion.div
        className="w-full h-full rounded-[inherit] relative preserve-3d"
        animate={{
          rotateY: isFaceUp ? 0 : 180,
          z: isFaceUp ? 0 : -2
        }}
        transition={{
          duration: 0.52,
          ease: [0.22, 1, 0.36, 1]
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front Face */}
        <div
          className="absolute inset-0 w-full h-full rounded-[inherit] backface-hidden"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          {cardFront}
        </div>

        {/* Back Face */}
        <div
          className="absolute inset-0 w-full h-full rounded-[inherit] backface-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          {cardBack}
        </div>
      </motion.div>
    </motion.div>
  );
};
