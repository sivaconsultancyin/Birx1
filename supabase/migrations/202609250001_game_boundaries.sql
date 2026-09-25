-- Game-specific persistence boundaries.
-- Shared users/wallets/transactions remain common infrastructure.
create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  room_id text,
  round_number bigint not null,
  status text not null,
  state jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists game_rounds_game_round_idx on public.game_rounds(game_id, round_number desc);
create index if not exists game_rounds_room_idx on public.game_rounds(game_id, room_id);

create table if not exists public.game_bets (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  round_id uuid references public.game_rounds(id) on delete cascade,
  user_id uuid,
  amount numeric(20,2) not null check (amount >= 0),
  selection text,
  status text not null default 'pending',
  payout numeric(20,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists game_bets_game_round_idx on public.game_bets(game_id, round_id);
create index if not exists game_bets_user_idx on public.game_bets(user_id);
