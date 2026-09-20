-- Production hardening
-- 1) idempotency_records is server/service-role only; clients must never read/write it.
REVOKE ALL ON TABLE public.idempotency_records FROM anon, authenticated;

-- 2) Remove duplicate overloaded wallet RPCs. The application calls the text-typed signatures.
DROP FUNCTION IF EXISTS public.atomic_wallet_credit(text, numeric, public.transaction_type_enum, text, text, text, text);
DROP FUNCTION IF EXISTS public.atomic_wallet_debit(text, numeric, public.transaction_type_enum, text, text, text, text);

-- 3) Keep privileged RPCs inaccessible to browser roles.
REVOKE ALL ON FUNCTION public.atomic_wallet_credit(text,numeric,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atomic_wallet_debit(text,numeric,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atomic_place_bets(text,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atomic_settle_round(text,text,jsonb,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
