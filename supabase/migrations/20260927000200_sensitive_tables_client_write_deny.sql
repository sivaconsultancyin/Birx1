-- Explicit client-side deny policies for sensitive server-managed tables.
-- These tables are mutated through server/service-role workflows only.
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_recharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client cannot insert wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Client cannot insert wallet transactions"
  ON public.wallet_transactions FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Client cannot update wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Client cannot update wallet transactions"
  ON public.wallet_transactions FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Client cannot delete wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Client cannot delete wallet transactions"
  ON public.wallet_transactions FOR DELETE TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "Client cannot insert coin recharges" ON public.coin_recharges;
CREATE POLICY "Client cannot insert coin recharges"
  ON public.coin_recharges FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Client cannot update coin recharges" ON public.coin_recharges;
CREATE POLICY "Client cannot update coin recharges"
  ON public.coin_recharges FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Client cannot delete coin recharges" ON public.coin_recharges;
CREATE POLICY "Client cannot delete coin recharges"
  ON public.coin_recharges FOR DELETE TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "Client cannot insert withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Client cannot insert withdrawal requests"
  ON public.withdrawal_requests FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Client cannot update withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Client cannot update withdrawal requests"
  ON public.withdrawal_requests FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Client cannot delete withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Client cannot delete withdrawal requests"
  ON public.withdrawal_requests FOR DELETE TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "Client cannot insert settlements" ON public.settlements;
CREATE POLICY "Client cannot insert settlements"
  ON public.settlements FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Client cannot update settlements" ON public.settlements;
CREATE POLICY "Client cannot update settlements"
  ON public.settlements FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Client cannot delete settlements" ON public.settlements;
CREATE POLICY "Client cannot delete settlements"
  ON public.settlements FOR DELETE TO anon, authenticated
  USING (false);
