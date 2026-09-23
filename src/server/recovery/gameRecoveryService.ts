import { supabaseRepo } from '../supabase/supabaseClient.ts';

export interface RecoveryReport {
  timestamp: string;
  recoveredRoundsCount: number;
  refundedBetsCount: number;
  details: string[];
}

export const gameRecoveryService = {
  async recoverInterruptedRounds(): Promise<RecoveryReport> {
    const details: string[] = [];
    let recoveredRoundsCount = 0;
    const refundedBetsCount = 0;
    try {
      const activeRounds = await supabaseRepo.getActiveGameRounds();
      for (const round of activeRounds) {
        if (round.phase === 'spinning' || round.phase === 'dealing' || round.phase === 'in_flight') {
          round.phase = 'closed';
          round.updatedAt = new Date().toISOString();
          recoveredRoundsCount++;
          details.push(`Recovered round ${round.id} (${round.gameId}) from stuck phase into closed.`);
        }
      }
    } catch (err: any) {
      details.push(`Recovery error: ${err.message}`);
    }
    return { timestamp: new Date().toISOString(), recoveredRoundsCount, refundedBetsCount, details };
  }
};