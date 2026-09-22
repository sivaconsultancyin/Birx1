-- Production hardening: indexes and SECURITY DEFINER search paths.
-- Safe to apply without changing client-facing RLS behavior.

-- Cover all currently unindexed foreign keys reported by Supabase advisors.
CREATE INDEX IF NOT EXISTS idx_bets_game_id
  ON public.bets(game_id);

CREATE INDEX IF NOT EXISTS idx_coin_recharges_approved_by
  ON public.coin_recharges(approved_by);

CREATE INDEX IF NOT EXISTS idx_coin_recharges_transaction_id
  ON public.coin_recharges(transaction_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_user_id
  ON public.idempotency_records(user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id
  ON public.wallet_transactions(wallet_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_approved_by
  ON public.withdrawal_requests(approved_by);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_transaction_id
  ON public.withdrawal_requests(transaction_id);

-- SECURITY DEFINER functions must use a controlled search_path.
ALTER FUNCTION public.atomic_wallet_debit(
  text,numeric,public.transaction_type_enum,text,text,text,text
) SET search_path = public, pg_temp;

ALTER FUNCTION public.atomic_wallet_credit(
  text,numeric,public.transaction_type_enum,text,text,text,text
) SET search_path = public, pg_temp;

ALTER FUNCTION public.atomic_place_bets(
  text,text,text,jsonb,text
) SET search_path = public, pg_temp;

ALTER FUNCTION public.atomic_settle_round(
  text,text,jsonb,jsonb,jsonb,text
) SET search_path = public, pg_temp;

-- Prevent duplicate bet rows when the same placement request is retried.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bets_user_idempotency_key
  ON public.bets(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
