import { RED_NUMBERS } from './constants.ts';
import type { RouletteBet } from '../../types.ts';

export function computeRouletteSettlement(winningNum: number, bets: RouletteBet[]) {
  const isRed = RED_NUMBERS.includes(winningNum);
  const isZero = winningNum === 0;
  const winningColor: 'red' | 'black' | 'green' = isZero ? 'green' : isRed ? 'red' : 'black';

  const categories: string[] = [];
  if (isZero) {
    categories.push('0 GREEN (Zero Pocket)');
  } else {
    categories.push(`${winningNum} ${winningColor.toUpperCase()}`);
    categories.push(winningNum % 2 === 0 ? 'Even' : 'Odd');
    categories.push(winningNum <= 18 ? 'Low (1-18)' : 'High (19-36)');
    if (winningNum <= 12) categories.push('1st Dozen (1-12)');
    else if (winningNum <= 24) categories.push('2nd Dozen (13-24)');
    else categories.push('3rd Dozen (25-36)');

    if (winningNum % 3 === 1) categories.push('1st Col');
    else if (winningNum % 3 === 2) categories.push('2nd Col');
    else categories.push('3rd Col');
  }
  const winningCategory = categories.join(' • ');

  let totalBet = 0;
  let grossPayout = 0;
  const winningBets: any[] = [];
  const losingBets: any[] = [];

  for (const bet of bets) {
    const amt = Number(bet.amount || 0);
    totalBet += amt;
    let isWin = false;
    let multiplier = 0; // gross multiplier = (payout ratio profit) + 1

    switch (bet.type) {
      case 'straight':
      case 'number': {
        const target = bet.value !== undefined ? bet.value : (bet.numbers?.[0] ?? -1);
        if (target === winningNum) {
          isWin = true;
          multiplier = 36; // 35:1 profit + 1x stake
        }
        break;
      }
      case 'split': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 18; // 17:1 profit + 1x stake
        }
        break;
      }
      case 'street': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 12; // 11:1 profit + 1x stake
        }
        break;
      }
      case 'corner': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 9; // 8:1 profit + 1x stake
        }
        break;
      }
      case 'sixline': {
        if (bet.numbers && bet.numbers.includes(winningNum)) {
          isWin = true;
          multiplier = 6; // 5:1 profit + 1x stake
        }
        break;
      }
      // OUTSIDE BETS (Zero Rule: All outside bets lose when winningNum === 0)
      case 'dozen1': {
        if (!isZero && winningNum >= 1 && winningNum <= 12) {
          isWin = true;
          multiplier = 3; // 2:1 profit + 1x stake
        }
        break;
      }
      case 'dozen2': {
        if (!isZero && winningNum >= 13 && winningNum <= 24) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'dozen3': {
        if (!isZero && winningNum >= 25 && winningNum <= 36) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col1': {
        if (!isZero && winningNum % 3 === 1) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col2': {
        if (!isZero && winningNum % 3 === 2) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'col3': {
        if (!isZero && winningNum % 3 === 0) {
          isWin = true;
          multiplier = 3;
        }
        break;
      }
      case 'red': {
        if (!isZero && isRed) {
          isWin = true;
          multiplier = 2; // 1:1 profit + 1x stake
        }
        break;
      }
      case 'black': {
        if (!isZero && !isRed) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'even': {
        if (!isZero && winningNum % 2 === 0) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'odd': {
        if (!isZero && winningNum % 2 !== 0) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'low': {
        if (!isZero && winningNum >= 1 && winningNum <= 18) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
      case 'high': {
        if (!isZero && winningNum >= 19 && winningNum <= 36) {
          isWin = true;
          multiplier = 2;
        }
        break;
      }
    }

    const payoutAmount = isWin ? amt * multiplier : 0;
    const profit = isWin ? payoutAmount - amt : -amt;

    const resultItem = {
      bet,
      isWin,
      payoutMultiplier: multiplier,
      payoutAmount,
      profit
    };

    if (isWin) {
      grossPayout += payoutAmount;
      winningBets.push(resultItem);
    } else {
      losingBets.push(resultItem);
    }
  }

  const netResult = grossPayout - totalBet;

  return {
    winningColor,
    winningCategory,
    winningBets,
    losingBets,
    totalBet,
    grossPayout,
    netResult
  };
}