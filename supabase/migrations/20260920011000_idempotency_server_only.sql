-- Idempotency records are server/service-role only.
ALTER TABLE public.idempotency_records DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.idempotency_records FROM PUBLIC, anon, authenticated;
