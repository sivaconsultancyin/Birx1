-- Production auth/RLS alignment.
-- Supabase Auth user IDs live in users.auth_user_id; public.users.id remains the app-level ID.

CREATE OR REPLACE FUNCTION private.get_auth_user_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$ SELECT u.id FROM public.users u WHERE u.auth_user_id = (select auth.uid()) LIMIT 1; $$;

CREATE OR REPLACE FUNCTION private.get_auth_role()
RETURNS user_role_enum LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$ SELECT u.role FROM public.users u WHERE u.auth_user_id = (select auth.uid()) LIMIT 1; $$;

ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_client_access" ON public.idempotency_records;
CREATE POLICY "deny_all_client_access" ON public.idempotency_records
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Owner can manage all users" ON public.users;
DROP POLICY IF EXISTS "Super Admin can manage Admin and Player" ON public.users;
DROP POLICY IF EXISTS "Admin can manage assigned Players" ON public.users;

CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated USING (
  id = (select private.get_auth_user_id())
  OR (select private.get_auth_role()) IN ('OWNER','SUPER_ADMIN','ADMIN')
);
CREATE POLICY "users_insert" ON public.users FOR INSERT TO authenticated WITH CHECK (
  (select private.get_auth_role()) = 'OWNER'
  OR ((select private.get_auth_role()) = 'SUPER_ADMIN' AND role IN ('ADMIN','PLAYER'))
  OR ((select private.get_auth_role()) = 'ADMIN' AND role = 'PLAYER'
      AND (parent_id = (select private.get_auth_user_id()) OR parent_id IS NULL))
);
CREATE POLICY "users_update" ON public.users FOR UPDATE TO authenticated
USING (
  (select private.get_auth_role()) = 'OWNER'
  OR ((select private.get_auth_role()) = 'SUPER_ADMIN' AND role IN ('ADMIN','PLAYER'))
  OR ((select private.get_auth_role()) = 'ADMIN' AND role = 'PLAYER'
      AND (parent_id = (select private.get_auth_user_id()) OR parent_id IS NULL))
)
WITH CHECK (
  (select private.get_auth_role()) = 'OWNER'
  OR ((select private.get_auth_role()) = 'SUPER_ADMIN' AND role IN ('ADMIN','PLAYER'))
  OR ((select private.get_auth_role()) = 'ADMIN' AND role = 'PLAYER'
      AND (parent_id = (select private.get_auth_user_id()) OR parent_id IS NULL))
);
CREATE POLICY "users_delete" ON public.users FOR DELETE TO authenticated USING (
  (select private.get_auth_role()) = 'OWNER'
  OR ((select private.get_auth_role()) = 'SUPER_ADMIN' AND role IN ('ADMIN','PLAYER'))
  OR ((select private.get_auth_role()) = 'ADMIN' AND role = 'PLAYER'
      AND (parent_id = (select private.get_auth_user_id()) OR parent_id IS NULL))
);

DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT TO authenticated USING (
  user_id = (select private.get_auth_user_id())
  OR (select private.get_auth_role()) IN ('OWNER','SUPER_ADMIN','ADMIN')
);
DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (
  user_id = (select private.get_auth_user_id())
  OR (select private.get_auth_role()) IN ('OWNER','SUPER_ADMIN','ADMIN')
);
DROP POLICY IF EXISTS "Users can view own bets" ON public.bets;
CREATE POLICY "Users can view own bets" ON public.bets FOR SELECT TO authenticated USING (
  user_id = (select private.get_auth_user_id())
  OR (select private.get_auth_role()) IN ('OWNER','SUPER_ADMIN','ADMIN')
);
DROP POLICY IF EXISTS "Users can create own recharge request" ON public.coin_recharges;
CREATE POLICY "Users can create own recharge request" ON public.coin_recharges FOR INSERT TO authenticated
WITH CHECK (user_id = (select private.get_auth_user_id()));
DROP POLICY IF EXISTS "Users can view own recharge requests" ON public.coin_recharges;
CREATE POLICY "Users can view own recharge requests" ON public.coin_recharges FOR SELECT TO authenticated USING (
  user_id = (select private.get_auth_user_id())
  OR (select private.get_auth_role()) IN ('OWNER','SUPER_ADMIN','ADMIN')
);
DROP POLICY IF EXISTS "Users can create own withdrawal request" ON public.withdrawal_requests;
CREATE POLICY "Users can create own withdrawal request" ON public.withdrawal_requests FOR INSERT TO authenticated
WITH CHECK (user_id = (select private.get_auth_user_id()));
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can view own withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING (
  user_id = (select private.get_auth_user_id())
  OR (select private.get_auth_role()) IN ('OWNER','SUPER_ADMIN','ADMIN')
);
DROP POLICY IF EXISTS "Players can read game rounds" ON public.game_rounds;
CREATE POLICY "Players can read game rounds" ON public.game_rounds FOR SELECT TO authenticated USING ((select private.get_auth_role()) = 'PLAYER');
DROP POLICY IF EXISTS "Players can read games" ON public.games;
CREATE POLICY "Players can read games" ON public.games FOR SELECT TO authenticated USING ((select private.get_auth_role()) = 'PLAYER');
DROP POLICY IF EXISTS "Settlements are viewable by admins and owners" ON public.settlements;
CREATE POLICY "Settlements are viewable by admins and owners" ON public.settlements FOR SELECT TO authenticated USING ((select private.get_auth_role()) IN ('OWNER','SUPER_ADMIN','ADMIN'));
