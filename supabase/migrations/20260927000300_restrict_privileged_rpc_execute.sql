-- Restrict SECURITY DEFINER financial/game mutation RPCs to server-side service_role.
-- Client roles must use the authenticated application API, not call privileged RPCs directly.
REVOKE EXECUTE ON FUNCTION public.atomic_wallet_debit(text,numeric,public.transaction_type_enum,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_wallet_credit(text,numeric,public.transaction_type_enum,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_place_bets(text,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_settle_round(text,text,jsonb,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.atomic_wallet_debit(text,numeric,public.transaction_type_enum,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.atomic_wallet_credit(text,numeric,public.transaction_type_enum,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.atomic_place_bets(text,text,text,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.atomic_settle_round(text,text,jsonb,jsonb,jsonb,text) TO service_role;


-- Game lease ownership is server-only as well; clients must never claim a game engine lease.
REVOKE EXECUTE ON FUNCTION public.claim_game_lease(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_game_lease(text,text,integer) TO service_role;
