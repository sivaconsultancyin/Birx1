import React from 'react';
import { RouletteWheel } from './RouletteWheel.tsx';

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
  const targetWinningColor: 'red' | 'black' | 'green' | null =
    targetWinningNumber === null
      ? null
      : targetWinningNumber === 0
        ? 'green'
        : [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(targetWinningNumber)
          ? 'red'
          : 'black';

  return (
    <RouletteWheel
      isSpinning={isSpinning}
      targetWinningNumber={targetWinningNumber}
      targetWinningColor={targetWinningColor}
      onSpinComplete={onSpinComplete}
      sizeMode="hero"
    />
  );
};
