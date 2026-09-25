# Database

Supabase/Postgres schema and migrations live under `supabase/migrations/` and server-side Supabase access lives under `src/server/supabase/`.

Database responsibilities: users, wallets, transactions, game history, authoritative game persistence and realtime/persistence support.

Secrets/service-role credentials must never be placed in frontend code.