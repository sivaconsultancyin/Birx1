import { supabaseRepo, getSupabaseAdmin } from '../supabase/supabaseClient.ts';

export interface RecoveryReport {
  timestamp: string;
  recoveredRoundsCount: number;
  refundedBetsCount: number;
  details: string[];
}

export const gameRecoveryService = {
  // Recover interrupted rounds and refund only bets that were still unresolved.
  async recoverInterruptedRounds(): Promise<RecoveryReport> {
    const details: string[] = [];
    let recoveredRoundsCount = 0;
    let refundedBetsCount = 0;
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Supabase is not configured');

    const { data: activeRounds, error } = await admin
      .from('game_rounds')
      .select('id, game_id, phase')
      .in('phase', ['betting', 'lock', 'deal', 'running', 'spinning', 'dealing', 'in_flight']);

    if (error) throw new Error(error.message);

    for (const round of activeRounds || []) {
      const { data: bets, error: betsError } = await admin
        .from('bets')
        .select('id, user_id, amount, status')
        .eq('round_id', round.id)
        .in('status', ['placed', 'pending']);

      if (betsError) {
        details.push(`Round ${round.id}: bet recovery query failed: ${betsError.message}`);
        continue;
      }

      for (const bet of bets || []) {
        try {
          await supabaseRepo.atomicCredit(
            bet.user_id,
            Number(bet.amount),
            'refund',
            `Automatic refund for interrupted ${round.game_id} round ${round.id}`,
            round.game_id,
            `recovery_refund_${bet.id}`
          );
          await admin.from('bets').update({
            status: 'refunded',
            payout: Number(bet.amount),
            settled_at: new Date().toISOString()
          }).eq('id', bet.id);
          refundedBetsCount++;
        } catch (refundError: any) {
          details.push(`Bet ${bet.id}: refund failed: ${refundError?.message || 'unknown error'}`);
        }
      }

      await admin.from('game_rounds').update({
        phase: 'settled',
        result_data: { recovery: 'interrupted_round_closed', recovered_at: new Date().toISOString() },
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', round.id);

      recoveredRoundsCount++;
      details.push(`Recovered round ${round.id} (${round.game_id}) and closed unresolved bets safely.`);
    }

    return {
      timestamp: new Date().toISOString(),
      recoveredRoundsCount,
      refundedBetsCount,
      details
    };
  }
};
