# Birx1 PostgreSQL

Self-hosted PostgreSQL is the target durable database service for the backend.

## Current status

The repository is **not yet cut over** from Supabase. The backend repository implementation still uses Supabase PostgREST/RPC APIs, so production must continue using the current Supabase data plane until the repository adapter and authentication dependencies are migrated and verified.

## Start local PostgreSQL

Set a strong password first:

```bash
export POSTGRES_PASSWORD='replace-with-a-strong-password'
docker compose -f docker-compose.postgres.yml up -d
```

The default local connection is:

```
postgresql://birx1:${POSTGRES_PASSWORD}@localhost:5432/birx1
```

## Migration order

1. Provision PostgreSQL.
2. Apply the portable core schema from `supabase/migrations/20260920000000_supabase_brix_platform.sql` after removing Supabase-specific `auth.uid()` RLS dependencies.
3. Port the atomic wallet/round RPCs to plain PostgreSQL.
4. Replace `backend/supabase/supabaseClient.ts` with a PostgreSQL repository using parameterized SQL and transactions.
5. Migrate existing data and verify row counts/checksums.
6. Run all game, realtime, auth, security, build and E2E tests.
7. Only then switch production `DATABASE_URL` and remove the Supabase data dependency.

Do **not** point production at an empty self-hosted database.
