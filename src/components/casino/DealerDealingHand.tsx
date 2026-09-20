import React from 'react';
import { motion } from 'motion/react';

interface DealerDealingHandProps {
  isDealing: boolean;
  dealerSide?: 'left' | 'right';
  targetPos?: { x: number; y: number };
  onDealRelease?: () => void;
  className?: string;
}

export const DealerDealingHand: React.FC<DealerDealingHandProps> = ({
  isDealing,
  dealerSide = 'left',
  targetPos = { x: 0, y: 50 },
  className = ''
}) => {
  if (!isDealing) return null;

  const isLeft = dealerSide === 'left';

  return (
    <motion.div
      className={`absolute z-30 pointer-events-none flex items-center ${
        isLeft ? 'origin-top-left -top-6 -left-6' : 'origin-top-right -top-6 -right-6 flex-row-reverse'
      } ${className}`}
      initial={{
        opacity: 0,
        x: isLeft ? -20 : 20,
        y: -10,
        rotate: isLeft ? -15 : 15,
        scale: 0.95
      }}
      animate={{
        opacity: [0, 1, 1, 0],
        x: isLeft ? [0, targetPos.x * 0.7, targetPos.x * 0.7, 0] : [0, targetPos.x * 0.7, targetPos.x * 0.7, 0],
        y: [0, targetPos.y * 0.7, targetPos.y * 0.7, -10],
        rotate: isLeft ? [-10, 5, 2, -10] : [10, -5, -2, 10],
        scale: [0.95, 1.02, 1, 0.95]
      }}
      transition={{
        duration: 0.52,
        ease: [0.16, 1, 0.3, 1]
      }}
    >
      {/* Dealer Suit Arm Sleeve */}
      <div
        className={`w-24 sm:w-28 h-10 rounded-md bg-gradient-to-r ${
          isLeft ? 'from-black via-neutral-900 to-neutral-800' : 'from-neutral-800 via-neutral-900 to-black'
        } border-y border-neutral-700 shadow-2xl relative flex items-center ${
          isLeft ? 'justify-end' : 'justify-start'
        }`}
      >
        {/* French Cuff */}
        <div className="w-3.5 h-9 rounded-sm bg-slate-100 border border-slate-300 shadow-sm relative flex items-center justify-center mx-1">
          {/* Gold Cufflink */}
          <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 border border-amber-800 shadow-xs" />
        </div>

        {/* Articulated Human Hand Pitching / Releasing Card */}
        <div
          className={`w-10 h-10 rounded-full ${
            isLeft ? 'bg-[#edd3c1] border-[#cf9e84]' : 'bg-[#e4beaa] border-[#c4937a]'
          } border shadow-lg relative flex flex-col justify-between p-1`}
        >
          {/* Extended Index & Middle Fingers Guiding Card */}
          <div className="w-full h-1.5 bg-[#dfb29a] rounded-full shadow-xs" />
          <div className="w-full h-1.5 bg-[#dfb29a] rounded-full shadow-xs" />
          {/* Thumb Pitch Angle */}
          <div
            className={`w-4 h-2 rounded-full bg-[#dfb29a] ${
              isLeft ? 'self-end -mr-1' : 'self-start -ml-1'
            }`}
          />
        </div>
      </div>
    </motion.div>
  );
};
