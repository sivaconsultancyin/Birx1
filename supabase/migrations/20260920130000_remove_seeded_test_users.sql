-- Remove seeded demo application users and their test wallet ledger.
-- These exact IDs were verified as the four seeded test users before this cleanup.
-- Real Supabase Auth users are not touched.

begin;

delete from public.wallet_transactions
where user_id in (
  'usr_owner_001',
  'usr_super_001',
  'usr_admin_001',
  'usr_brix_8849'
);

delete from public.wallets
where user_id in (
  'usr_owner_001',
  'usr_super_001',
  'usr_admin_001',
  'usr_brix_8849'
);

update public.users
set parent_id = null
where parent_id in (
  'usr_owner_001',
  'usr_super_001',
  'usr_admin_001',
  'usr_brix_8849'
);

delete from public.users
where id in (
  'usr_owner_001',
  'usr_super_001',
  'usr_admin_001',
  'usr_brix_8849'
);

commit;
