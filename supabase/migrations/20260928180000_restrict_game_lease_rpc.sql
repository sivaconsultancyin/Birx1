-- Game lease ownership is server-only; clients must never claim a game engine lease.
REVOKE EXECUTE ON FUNCTION public.claim_game_lease(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_game_lease(text,text,integer) TO service_role;
