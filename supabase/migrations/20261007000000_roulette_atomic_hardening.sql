-- Roulette-only hardening: atomic placement and strict settlement ownership/idempotency.

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlements_round_game_unique
  ON public.settlements(round_id, game_id);

CREATE OR REPLACE FUNCTION public.atomic_place_bets(
  p_user_id TEXT, p_game_id TEXT, p_round_id TEXT, p_bets JSONB, p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_round public.game_rounds%ROWTYPE;
  v_existing JSONB;
  v_total NUMERIC := 0;
  v_bet JSONB;
  v_bet_id TEXT;
  v_ids JSONB := '[]'::jsonb;
  v_debit JSONB;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN RAISE EXCEPTION 'idempotency key is required'; END IF;
  SELECT response_payload INTO v_existing FROM public.idempotency_records WHERE key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT * INTO v_round FROM public.game_rounds WHERE id=p_round_id AND game_id=p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Roulette round not found'; END IF;
  IF v_round.phase <> 'betting' THEN RAISE EXCEPTION 'Roulette betting is closed'; END IF;
  IF jsonb_typeof(p_bets) <> 'array' OR jsonb_array_length(p_bets)=0 THEN RAISE EXCEPTION 'At least one bet is required'; END IF;

  FOR v_bet IN SELECT * FROM jsonb_array_elements(p_bets) LOOP
    IF (v_bet->>'amount') IS NULL OR (v_bet->>'amount')::NUMERIC <= 0 THEN RAISE EXCEPTION 'Invalid bet amount'; END IF;
    v_total := v_total + (v_bet->>'amount')::NUMERIC;
  END LOOP;

  v_debit := public.atomic_wallet_debit(p_user_id,v_total,'bet','Placed bet on '||p_game_id||' round #'||p_round_id,p_game_id,p_idempotency_key,'BET-'||p_round_id||'-'||gen_random_uuid()::text);

  FOR v_bet IN SELECT * FROM jsonb_array_elements(p_bets) LOOP
    v_bet_id := 'roulette:'||p_round_id||':'||p_user_id||':'||gen_random_uuid()::text;
    INSERT INTO public.bets(id,round_id,user_id,game_id,bet_type,bet_value,amount,status,idempotency_key)
    VALUES(v_bet_id,p_round_id,p_user_id,p_game_id,v_bet->>'type',
      jsonb_build_object('value',v_bet->'value','numbers',v_bet->'numbers'),
      (v_bet->>'amount')::NUMERIC,'placed',p_idempotency_key);
    v_ids := v_ids || to_jsonb(v_bet_id);
  END LOOP;

  v_existing := jsonb_build_object('success',true,'roundId',p_round_id,'totalBetPlaced',v_total,'wallet',v_debit->'wallet','betIds',v_ids);
  INSERT INTO public.idempotency_records(key,user_id,action_type,response_payload)
  VALUES(p_idempotency_key,p_user_id,'roulette_bet',v_existing);
  RETURN v_existing;
END; $$;

CREATE OR REPLACE FUNCTION public.atomic_settle_round(
  p_game_id TEXT,p_round_id TEXT,p_result_data JSONB,p_winning_bets JSONB,p_losing_bet_ids JSONB,p_outcome_summary TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_round public.game_rounds%ROWTYPE;
  v_existing public.settlements%ROWTYPE;
  v_win JSONB;
  v_lose TEXT;
  v_user TEXT;
  v_payout NUMERIC;
  v_total_payout NUMERIC:=0;
  v_total_bet NUMERIC:=0;
  v_count INT:=0;
  v_remaining INT;
BEGIN
  SELECT * INTO v_round FROM public.game_rounds WHERE id=p_round_id AND game_id=p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Roulette round not found'; END IF;
  SELECT * INTO v_existing FROM public.settlements WHERE round_id=p_round_id AND game_id=p_game_id LIMIT 1 FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('success',true,'roundId',p_round_id,'alreadySettled',true); END IF;

  FOR v_win IN SELECT * FROM jsonb_array_elements(p_winning_bets) LOOP
    v_user:=v_win->>'userId'; v_payout:=COALESCE((v_win->>'payout')::NUMERIC,0);
    IF v_payout<0 THEN RAISE EXCEPTION 'Invalid payout'; END IF;
    UPDATE public.bets SET status='won',payout=v_payout,multiplier=COALESCE((v_win->>'multiplier')::NUMERIC,0),settled_at=NOW()
      WHERE id=v_win->>'id' AND round_id=p_round_id AND game_id=p_game_id AND user_id=v_user AND status='placed';
    IF NOT FOUND THEN RAISE EXCEPTION 'Winning bet is invalid or already settled'; END IF;
    v_total_payout:=v_total_payout+v_payout; v_total_bet:=v_total_bet+COALESCE((v_win->>'amount')::NUMERIC,0); v_count:=v_count+1;
    IF v_payout>0 THEN PERFORM public.atomic_wallet_credit(v_user,v_payout,'payout','Payout for '||p_game_id||' round #'||p_round_id,p_game_id,'payout_'||(v_win->>'id'),'WIN-'||p_round_id); END IF;
  END LOOP;

  FOR v_lose IN SELECT jsonb_array_elements_text(p_losing_bet_ids) LOOP
    UPDATE public.bets SET status='lost',payout=0,settled_at=NOW()
      WHERE id=v_lose AND round_id=p_round_id AND game_id=p_game_id AND status='placed';
    IF NOT FOUND THEN RAISE EXCEPTION 'Losing bet is invalid or already settled'; END IF;
    v_count:=v_count+1;
  END LOOP;

  SELECT count(*) INTO v_remaining FROM public.bets WHERE round_id=p_round_id AND game_id=p_game_id AND status='placed';
  IF v_remaining>0 THEN RAISE EXCEPTION 'Roulette settlement did not include all placed bets'; END IF;

  UPDATE public.game_rounds SET phase='settled',result_data=p_result_data,settled_at=NOW(),closed_at=COALESCE(closed_at,NOW())
    WHERE id=p_round_id AND game_id=p_game_id;

  INSERT INTO public.settlements(round_id,game_id,total_bets_count,total_bet_amount,total_payout_amount,net_house_result,outcome_summary,details,status)
  VALUES(p_round_id,p_game_id,v_count,v_total_bet,v_total_payout,v_total_bet-v_total_payout,p_outcome_summary,p_result_data,'completed');

  RETURN jsonb_build_object('success',true,'roundId',p_round_id,'settledBetsCount',v_count,'totalPayout',v_total_payout);
END; $$;
