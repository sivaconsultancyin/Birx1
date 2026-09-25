-- Aviator authoritative room state, single-owner lease and Realtime publication
BEGIN;

CREATE TABLE IF NOT EXISTS public.authoritative_game_states (
  game_id text PRIMARY KEY,
  round_id text,
  phase text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_state_leases (
  game_id text PRIMARY KEY,
  owner_id text NOT NULL,
  lease_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.authoritative_game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_state_leases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deny_all_client_access ON public.authoritative_game_states;
CREATE POLICY deny_all_client_access ON public.authoritative_game_states
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_all_client_access ON public.game_state_leases;
CREATE POLICY deny_all_client_access ON public.game_state_leases
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.claim_game_lease(
  p_game_id text,
  p_owner_id text,
  p_lease_until timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_until timestamptz;
BEGIN
  SELECT owner_id, lease_until INTO v_owner, v_until
  FROM public.game_state_leases
  WHERE game_id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.game_state_leases(game_id, owner_id, lease_until, updated_at)
    VALUES (p_game_id, p_owner_id, p_lease_until, now());
    RETURN true;
  END IF;

  IF v_owner = p_owner_id OR v_until <= now() THEN
    UPDATE public.game_state_leases
    SET owner_id = p_owner_id, lease_until = p_lease_until, updated_at = now()
    WHERE game_id = p_game_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_game_lease(text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_game_lease(text,text,timestamptz) TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.authoritative_game_states;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
