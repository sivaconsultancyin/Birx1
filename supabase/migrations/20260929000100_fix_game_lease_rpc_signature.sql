-- Fix authoritative game lease RPC signature to match the server client.
-- The server sends a lease duration in milliseconds; PostgreSQL calculates
-- the expiry from its own clock to avoid host/database clock skew.
BEGIN;

DROP FUNCTION IF EXISTS public.claim_game_lease(text, text, timestamptz);

CREATE OR REPLACE FUNCTION public.claim_game_lease(
  p_game_id text,
  p_owner_id text,
  p_lease_ms integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_until timestamptz;
  v_new_until timestamptz;
BEGIN
  IF p_game_id IS NULL OR length(trim(p_game_id)) = 0 THEN
    RAISE EXCEPTION 'game_id is required';
  END IF;

  IF p_owner_id IS NULL OR length(trim(p_owner_id)) = 0 THEN
    RAISE EXCEPTION 'owner_id is required';
  END IF;

  IF p_lease_ms IS NULL OR p_lease_ms < 1000 OR p_lease_ms > 60000 THEN
    RAISE EXCEPTION 'lease_ms must be between 1000 and 60000';
  END IF;

  v_new_until := now() + make_interval(secs => p_lease_ms::double precision / 1000.0);

  SELECT owner_id, lease_until
    INTO v_owner, v_until
  FROM public.game_state_leases
  WHERE game_id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.game_state_leases(game_id, owner_id, lease_until, updated_at)
    VALUES (p_game_id, p_owner_id, v_new_until, now());
    RETURN true;
  END IF;

  IF v_owner = p_owner_id OR v_until <= now() THEN
    UPDATE public.game_state_leases
    SET owner_id = p_owner_id,
        lease_until = v_new_until,
        updated_at = now()
    WHERE game_id = p_game_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_game_lease(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_game_lease(text, text, integer) TO service_role;

COMMIT;
