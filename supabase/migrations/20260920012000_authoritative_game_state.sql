-- Authoritative game state lease RPC
create or replace function public.claim_game_lease(p_game_id text, p_owner_id text, p_lease_until timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare claimed boolean;
begin
  insert into public.game_state_leases(game_id, owner_id, lease_until, updated_at)
  values(p_game_id,p_owner_id,p_lease_until,now())
  on conflict (game_id) do update
    set owner_id=excluded.owner_id, lease_until=excluded.lease_until, updated_at=now()
    where public.game_state_leases.lease_until < now()
       or public.game_state_leases.owner_id = p_owner_id;
  select owner_id = p_owner_id and lease_until = p_lease_until
    into claimed from public.game_state_leases where game_id=p_game_id;
  return coalesce(claimed,false);
end $$;
revoke all on function public.claim_game_lease(text,text,timestamptz) from public,anon,authenticated;
