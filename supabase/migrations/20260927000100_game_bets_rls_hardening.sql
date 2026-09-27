-- Production authorization hardening for the game-specific persistence tables.
-- Service-role/server-side operations continue to work; browser clients cannot read/write
-- another player's game records directly.
ALTER TABLE public.game_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view own game bets" ON public.game_bets;
CREATE POLICY "Players can view own game bets"
  ON public.game_bets
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id
      FROM public.users u
      WHERE u.auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Players cannot insert game bets directly" ON public.game_bets;
CREATE POLICY "Players cannot insert game bets directly"
  ON public.game_bets
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Players cannot update game bets directly" ON public.game_bets;
CREATE POLICY "Players cannot update game bets directly"
  ON public.game_bets
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Players cannot delete game bets directly" ON public.game_bets;
CREATE POLICY "Players cannot delete game bets directly"
  ON public.game_bets
  FOR DELETE
  TO authenticated
  USING (false);

REVOKE ALL ON TABLE public.game_bets FROM anon;
GRANT SELECT ON TABLE public.game_bets TO authenticated;
