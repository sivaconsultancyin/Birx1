import React, { useMemo } from 'react';
import { Wheel } from 'react-custom-roulette';

type Props = {
  isSpinning: boolean;
  targetWinningNumber: number | null;
  onSpinComplete?: () => void;
};

export const ExternalRouletteWheel: React.FC<Props> = ({
  isSpinning,
  targetWinningNumber,
  onSpinComplete,
}) => {
  const data = useMemo(() => Array.from({ length: 37 }, (_, n) => ({
    option: String(n),
    style: {
      backgroundColor: n === 0 ? '#166534' : [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(n) ? '#b91c1c' : '#111827',
      textColor: '#fff',
    },
  })), []);

  return (
    <div className="relative flex items-center justify-center rounded-full bg-slate-950/80 p-3 shadow-[0_0_50px_rgba(245,158,11,0.18)] border border-amber-500/20">
      <Wheel
        mustStartSpinning={isSpinning}
        prizeNumber={Math.max(0, targetWinningNumber ?? 0)}
        data={data}
        spinDuration={0.8}
        onStopSpinning={onSpinComplete}
        outerBorderWidth={3}
        outerBorderColor="#f59e0b"
        innerBorderWidth={2}
        innerBorderColor="#fbbf24"
        radiusLineWidth={1}
        radiusLineColor="#374151"
        fontSize={14}
        perpendicularText={false}
        textDistance={65}
      />
    </div>
  );
};
