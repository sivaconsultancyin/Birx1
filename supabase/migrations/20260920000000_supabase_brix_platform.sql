-- =====================================================================
-- BRIX VIRTUAL TOKENS - SUPABASE POSTGRESQL AUTHORITATIVE CORE SCHEMA
-- Migration: 20260920000000_supabase_brix_platform.sql
-- Safe, Idempotent, Deterministic, Transaction-Safe
-- =====================================================================

BEGIN;

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------
-- 1. ENUM TYPES
-- -------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.user_role_enum AS ENUM ('OWNER', 'SUPER_ADMIN', 'ADMIN', 'PLAYER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.transaction_type_enum AS ENUM ('deposit', 'withdrawal', 'bet', 'payout', 'bonus', 'refund', 'recharge');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.transaction_status_enum AS ENUM ('pending', 'success', 'failed', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.game_phase_enum AS ENUM ('betting', 'closed', 'spinning', 'dealing', 'in_flight', 'result', 'settled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.bet_status_enum AS ENUM ('placed', 'won', 'lost', 'refunded', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.request_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -------------------------------------------------------------
-- 2. CORE USERS TABLE (Integrated with Supabase Auth or Standalone)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    mobile TEXT,
    username TEXT NOT NULL,
    role public.user_role_enum NOT NULL DEFAULT 'PLAYER',
    parent_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    avatar_url TEXT,
    vip_tier TEXT NOT NULL DEFAULT 'Bronze',
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_parent ON public.users(parent_id);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON public.users(mobile);

-- -------------------------------------------------------------
-- 3. WALLETS TABLE (Authoritative Single Source of Truth)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    bonus NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (bonus >= 0),
    locked_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (locked_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);

-- -------------------------------------------------------------
-- 4. WALLET TRANSACTIONS LEDGER (Immutable Audit Trail)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    wallet_id TEXT REFERENCES public.wallets(id) ON DELETE SET NULL,
    type public.transaction_type_enum NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    status public.transaction_status_enum NOT NULL DEFAULT 'success',
    game_id TEXT,
    description TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    idempotency_key TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_idemp ON public.wallet_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_game ON public.wallet_transactions(game_id);

-- -------------------------------------------------------------
-- 5. COIN RECHARGES (Hierarchical Agent / Admin Recharges)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coin_recharges (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL DEFAULT 'UPI',
    status public.request_status_enum NOT NULL DEFAULT 'pending',
    approved_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recharges_user ON public.coin_recharges(user_id);
CREATE INDEX IF NOT EXISTS idx_recharges_status ON public.coin_recharges(status);

-- -------------------------------------------------------------
-- 6. WITHDRAWAL REQUESTS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    upi_id TEXT,
    bank_details JSONB DEFAULT '{}'::jsonb,
    status public.request_status_enum NOT NULL DEFAULT 'pending',
    approved_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawal_requests(status);

-- -------------------------------------------------------------
-- 7. GAMES CONFIGURATION TABLE (6 Core Games)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    min_bet NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    max_bet NUMERIC(10, 2) NOT NULL DEFAULT 50000.00,
    rules JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 8. GAME ROUNDS TABLE (Server-Authoritative Lifecycle)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_rounds (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    round_number BIGINT NOT NULL,
    phase public.game_phase_enum NOT NULL DEFAULT 'betting',
    server_seed_hash TEXT,
    result_data JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rounds_game_id ON public.game_rounds(game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rounds_phase ON public.game_rounds(phase);

-- -------------------------------------------------------------
-- 9. BETS TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    round_id TEXT NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    bet_type TEXT NOT NULL,
    bet_value JSONB DEFAULT '{}'::jsonb,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    multiplier NUMERIC(10, 2) DEFAULT 0.00,
    payout NUMERIC(15, 2) DEFAULT 0.00 CHECK (payout >= 0),
    status public.bet_status_enum NOT NULL DEFAULT 'placed',
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bets_round ON public.bets(round_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON public.bets(status);
CREATE INDEX IF NOT EXISTS idx_bets_idemp ON public.bets(idempotency_key);

-- -------------------------------------------------------------
-- 10. SETTLEMENTS TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    round_id TEXT NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    total_bets_count INT NOT NULL DEFAULT 0,
    total_bet_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_payout_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    net_house_result NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    outcome_summary TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'completed',
    settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_round ON public.settlements(round_id);
CREATE INDEX IF NOT EXISTS idx_settlements_game ON public.settlements(game_id);

-- -------------------------------------------------------------
-- 11. IDEMPOTENCY RECORDS TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.idempotency_records (
    key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_created ON public.idempotency_records(created_at);

-- -------------------------------------------------------------
-- 12. RPC FUNCTIONS (ATOMIC WALLET DEBIT, CREDIT, SETTLEMENT)
-- -------------------------------------------------------------

-- RPC: Atomic Wallet Debit with Row-Level Locking & Idempotency
CREATE OR REPLACE FUNCTION public.atomic_wallet_debit(
    p_user_id TEXT,
    p_amount NUMERIC,
    p_type public.transaction_type_enum,
    p_description TEXT,
    p_game_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet RECORD;
    v_tx_id TEXT;
    v_ref_id TEXT;
    v_existing_idemp RECORD;
    v_result JSONB;
BEGIN
    -- 1. Check idempotency
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_idemp FROM public.idempotency_records WHERE key = p_idempotency_key;
        IF FOUND THEN
            RETURN v_existing_idemp.response_payload;
        END IF;
    END IF;

    -- 2. Lock wallet row FOR UPDATE
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user: %', p_user_id;
    END IF;

    -- 3. Check sufficient balance
    IF v_wallet.balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance. Current: %, Requested: %', v_wallet.balance, p_amount;
    END IF;

    -- 4. Deduct balance atomically
    UPDATE public.wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO v_wallet;

    -- 5. Record transaction
    v_ref_id := COALESCE(p_reference_id, 'REF-' || floor(random() * 899999 + 100000)::text);
    v_tx_id := gen_random_uuid()::text;

    INSERT INTO public.wallet_transactions (
        id, user_id, wallet_id, type, amount, status, game_id, description, reference_id, idempotency_key
    ) VALUES (
        v_tx_id, p_user_id, v_wallet.id, p_type, p_amount, 'success', p_game_id, p_description, v_ref_id, p_idempotency_key
    );

    v_result := jsonb_build_object(
        'success', true,
        'wallet', jsonb_build_object(
            'balance', v_wallet.balance,
            'bonus', v_wallet.bonus,
            'lockedAmount', v_wallet.locked_amount,
            'currency', v_wallet.currency
        ),
        'transaction', jsonb_build_object(
            'id', v_tx_id,
            'amount', p_amount,
            'type', p_type,
            'referenceId', v_ref_id,
            'createdAt', NOW()
        )
    );

    -- 6. Save idempotency record
    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.idempotency_records (key, user_id, action_type, response_payload)
        VALUES (p_idempotency_key, p_user_id, p_type::text, v_result);
    END IF;

    RETURN v_result;
END;
$$;

-- RPC: Atomic Wallet Credit
CREATE OR REPLACE FUNCTION public.atomic_wallet_credit(
    p_user_id TEXT,
    p_amount NUMERIC,
    p_type public.transaction_type_enum,
    p_description TEXT,
    p_game_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet RECORD;
    v_tx_id TEXT;
    v_ref_id TEXT;
    v_existing_idemp RECORD;
    v_result JSONB;
BEGIN
    -- 1. Check idempotency
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_idemp FROM public.idempotency_records WHERE key = p_idempotency_key;
        IF FOUND THEN
            RETURN v_existing_idemp.response_payload;
        END IF;
    END IF;

    -- 2. Lock wallet row FOR UPDATE
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user: %', p_user_id;
    END IF;

    -- 3. Credit balance atomically
    UPDATE public.wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO v_wallet;

    -- 4. Record transaction
    v_ref_id := COALESCE(p_reference_id, 'REF-' || floor(random() * 899999 + 100000)::text);
    v_tx_id := gen_random_uuid()::text;

    INSERT INTO public.wallet_transactions (
        id, user_id, wallet_id, type, amount, status, game_id, description, reference_id, idempotency_key
    ) VALUES (
        v_tx_id, p_user_id, v_wallet.id, p_type, p_amount, 'success', p_game_id, p_description, v_ref_id, p_idempotency_key
    );

    v_result := jsonb_build_object(
        'success', true,
        'wallet', jsonb_build_object(
            'balance', v_wallet.balance,
            'bonus', v_wallet.bonus,
            'lockedAmount', v_wallet.locked_amount,
            'currency', v_wallet.currency
        ),
        'transaction', jsonb_build_object(
            'id', v_tx_id,
            'amount', p_amount,
            'type', p_type,
            'referenceId', v_ref_id,
            'createdAt', NOW()
        )
    );

    -- 5. Save idempotency record
    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.idempotency_records (key, user_id, action_type, response_payload)
        VALUES (p_idempotency_key, p_user_id, p_type::text, v_result);
    END IF;

    RETURN v_result;
END;
$$;

-- RPC: Atomic Bet Placement
CREATE OR REPLACE FUNCTION public.atomic_place_bets(
    p_user_id TEXT,
    p_game_id TEXT,
    p_round_id TEXT,
    p_bets JSONB,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_amount NUMERIC := 0;
    v_bet_elem JSONB;
    v_debit_res JSONB;
    v_bet_id TEXT;
    v_created_bet_ids TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Calculate total bet amount
    FOR v_bet_elem IN SELECT * FROM jsonb_array_elements(p_bets)
    LOOP
        v_total_amount := v_total_amount + (v_bet_elem->>'amount')::NUMERIC;
    END LOOP;

    -- Debit wallet atomically
    v_debit_res := public.atomic_wallet_debit(
        p_user_id,
        v_total_amount,
        'bet',
        'Placed bet on ' || p_game_id || ' round #' || p_round_id,
        p_game_id,
        p_idempotency_key,
        'BET-' || p_round_id || '-' || floor(random() * 89999 + 10000)::text
    );

    -- Insert individual bet records
    FOR v_bet_elem IN SELECT * FROM jsonb_array_elements(p_bets)
    LOOP
        v_bet_id := gen_random_uuid()::text;
        INSERT INTO public.bets (
            id, round_id, user_id, game_id, bet_type, bet_value, amount, status
        ) VALUES (
            v_bet_id,
            p_round_id,
            p_user_id,
            p_game_id,
            v_bet_elem->>'type',
            COALESCE(v_bet_elem->'value', '{}'::jsonb),
            (v_bet_elem->>'amount')::NUMERIC,
            'placed'
        );
        v_created_bet_ids := array_append(v_created_bet_ids, v_bet_id);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'roundId', p_round_id,
        'totalBetPlaced', v_total_amount,
        'wallet', v_debit_res->'wallet',
        'betIds', to_jsonb(v_created_bet_ids)
    );
END;
$$;

-- RPC: Atomic Game Round Settlement
CREATE OR REPLACE FUNCTION public.atomic_settle_round(
    p_game_id TEXT,
    p_round_id TEXT,
    p_result_data JSONB,
    p_winning_bets JSONB,
    p_losing_bet_ids JSONB,
    p_outcome_summary TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_win_bet JSONB;
    v_lose_id TEXT;
    v_user_id TEXT;
    v_payout NUMERIC;
    v_total_payout NUMERIC := 0;
    v_total_bet NUMERIC := 0;
    v_bets_count INT := 0;
BEGIN
    -- Update Game Round
    UPDATE public.game_rounds
    SET phase = 'settled',
        result_data = p_result_data,
        settled_at = NOW()
    WHERE id = p_round_id;

    -- Process winning bets
    FOR v_win_bet IN SELECT * FROM jsonb_array_elements(p_winning_bets)
    LOOP
        v_user_id := v_win_bet->>'userId';
        v_payout := (v_win_bet->>'payout')::NUMERIC;
        v_total_payout := v_total_payout + v_payout;
        v_total_bet := v_total_bet + (v_win_bet->>'amount')::NUMERIC;
        v_bets_count := v_bets_count + 1;

        -- Update bet record
        UPDATE public.bets
        SET status = 'won',
            payout = v_payout,
            multiplier = (v_win_bet->>'multiplier')::NUMERIC,
            settled_at = NOW()
        WHERE id = v_win_bet->>'id';

        -- Credit user wallet
        IF v_payout > 0 THEN
            PERFORM public.atomic_wallet_credit(
                v_user_id,
                v_payout,
                'payout',
                'Payout for ' || p_game_id || ' round #' || p_round_id,
                p_game_id,
                'payout_' || (v_win_bet->>'id'),
                'WIN-' || p_round_id
            );
        END IF;
    END LOOP;

    -- Process losing bets
    FOR v_lose_id IN SELECT jsonb_array_elements_text(p_losing_bet_ids)
    LOOP
        UPDATE public.bets
        SET status = 'lost',
            payout = 0,
            settled_at = NOW()
        WHERE id = v_lose_id;
        v_bets_count := v_bets_count + 1;
    END LOOP;

    -- Record Settlement
    INSERT INTO public.settlements (
        round_id, game_id, total_bets_count, total_bet_amount, total_payout_amount,
        net_house_result, outcome_summary, details, status
    ) VALUES (
        p_round_id, p_game_id, v_bets_count, v_total_bet, v_total_payout,
        (v_total_bet - v_total_payout), p_outcome_summary, p_result_data, 'completed'
    );

    RETURN jsonb_build_object(
        'success', true,
        'roundId', p_round_id,
        'settledBetsCount', v_bets_count,
        'totalPayout', v_total_payout
    );
END;
$$;

-- -------------------------------------------------------------
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_recharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role_enum
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()::text;
$$;

-- RLS: USERS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid()::text = id OR public.get_auth_role() IN ('OWNER', 'SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "Owner can manage all users" ON public.users;
CREATE POLICY "Owner can manage all users" ON public.users
    FOR ALL USING (public.get_auth_role() = 'OWNER');

DROP POLICY IF EXISTS "Super Admin can manage Admin and Player" ON public.users;
CREATE POLICY "Super Admin can manage Admin and Player" ON public.users
    FOR ALL USING (public.get_auth_role() = 'SUPER_ADMIN' AND role IN ('ADMIN', 'PLAYER'));

DROP POLICY IF EXISTS "Admin can manage assigned Players" ON public.users;
CREATE POLICY "Admin can manage assigned Players" ON public.users
    FOR ALL USING (public.get_auth_role() = 'ADMIN' AND role = 'PLAYER' AND (parent_id = auth.uid()::text OR parent_id IS NULL));

-- RLS: WALLETS
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
CREATE POLICY "Users can view own wallet" ON public.wallets
    FOR SELECT USING (auth.uid()::text = user_id OR public.get_auth_role() IN ('OWNER', 'SUPER_ADMIN', 'ADMIN'));

-- RLS: WALLET TRANSACTIONS
DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions
    FOR SELECT USING (auth.uid()::text = user_id OR public.get_auth_role() IN ('OWNER', 'SUPER_ADMIN', 'ADMIN'));

-- RLS: BETS
DROP POLICY IF EXISTS "Users can view own bets" ON public.bets;
CREATE POLICY "Users can view own bets" ON public.bets
    FOR SELECT USING (auth.uid()::text = user_id OR public.get_auth_role() IN ('OWNER', 'SUPER_ADMIN', 'ADMIN'));

-- RLS: GAMES & ROUNDS (Public read)
DROP POLICY IF EXISTS "Games are readable by everyone" ON public.games;
CREATE POLICY "Games are readable by everyone" ON public.games
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Game rounds are readable by everyone" ON public.game_rounds;
CREATE POLICY "Game rounds are readable by everyone" ON public.game_rounds
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Settlements are viewable by admins and owners" ON public.settlements;
CREATE POLICY "Settlements are viewable by admins and owners" ON public.settlements
    FOR SELECT USING (public.get_auth_role() IN ('OWNER', 'SUPER_ADMIN', 'ADMIN'));

-- -------------------------------------------------------------
-- 14. SEED INITIAL GAMES & DEFAULT ROLES
-- -------------------------------------------------------------
INSERT INTO public.games (id, name, category, status, min_bet, max_bet, rules)
VALUES
    ('roulette', 'European Roulette', 'Table', 'active', 10, 50000, '{"type": "single_zero_37", "payouts": {"straight": 36, "split": 18, "street": 12, "corner": 9, "sixline": 6, "color": 2, "even_odd": 2, "high_low": 2, "dozen": 3, "column": 3}}'),
    ('teen-patti', 'Teen Patti Live', 'Cards', 'active', 50, 25000, '{"type": "3_cards_poker", "hand_ranks": ["trio", "pure_sequence", "sequence", "color", "pair", "high_card"]}'),
    ('aviator', 'Aviator Crash', 'Multiplier', 'active', 10, 20000, '{"type": "curve_crash", "min_mult": 1.00, "max_mult": 100.00}'),
    ('dice', 'Classic Dice', 'Dice', 'active', 10, 10000, '{"type": "2_dice_sum", "payouts": {"low": 2, "high": 2, "seven": 4, "doubles": 5}}'),
    ('dragon-tiger', 'Dragon Tiger', 'Cards', 'active', 20, 30000, '{"type": "2_cards_high", "payouts": {"dragon": 2, "tiger": 2, "tie": 11, "suited_tie": 50}}'),
    ('andar-bahar', 'Andar Bahar Live', 'Cards', 'active', 20, 25000, '{"type": "joker_match", "payouts": {"andar": 1.95, "bahar": 2.00}}')
ON CONFLICT (id) DO NOTHING;

-- Initial Seed Users: Owner, Super Admin, Admin, Player
INSERT INTO public.users (id, email, mobile, username, role, vip_tier, is_demo)
VALUES
    ('usr_owner_001', 'owner@brix.casino', '+91 99999 00001', 'BrixOwner', 'OWNER', 'Platinum', false),
    ('usr_super_001', 'superadmin@brix.casino', '+91 99999 00002', 'ChiefSuperAdmin', 'SUPER_ADMIN', 'Platinum', false),
    ('usr_admin_001', 'admin@brix.casino', '+91 99999 00003', 'MasterAdmin', 'ADMIN', 'Gold', false),
    ('usr_brix_8849', 'player@brix.casino', '+91 98765 43210', 'LuckyBrix', 'PLAYER', 'Gold', true)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Set hierarchy parent relationships
UPDATE public.users SET parent_id = 'usr_owner_001' WHERE id = 'usr_super_001';
UPDATE public.users SET parent_id = 'usr_super_001' WHERE id = 'usr_admin_001';
UPDATE public.users SET parent_id = 'usr_admin_001' WHERE id = 'usr_brix_8849';

-- Seed Wallets
INSERT INTO public.wallets (user_id, balance, bonus, currency, is_demo)
VALUES
    ('usr_owner_001', 5000000.00, 0.00, 'INR', false),
    ('usr_super_001', 1000000.00, 0.00, 'INR', false),
    ('usr_admin_001', 250000.00, 0.00, 'INR', false),
    ('usr_brix_8849', 25000.00, 1000.00, 'INR', true)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
