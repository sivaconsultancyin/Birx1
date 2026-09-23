CREATE OR REPLACE FUNCTION private.get_auth_user_id() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private, pg_temp AS $$ SELECT u.id FROM public.users u WHERE u.auth_user_id = (select auth.uid()) LIMIT 1; $$;
CREATE OR REPLACE FUNCTION private.get_auth_role() RETURNS user_role_enum LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private, pg_temp AS $$ SELECT u.role FROM public.users u WHERE u.auth_user_id = (select auth.uid()) LIMIT 1; $$;
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_client_access" ON public.idempotency_records;
CREATE POLICY "deny_all_client_access" ON public.idempotency_records FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
