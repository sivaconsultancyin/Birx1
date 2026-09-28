# Birx1 PostgreSQL

Self-hosted PostgreSQL runs as a separate service from the Node backend.

Local setup:
1. Set POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD.
2. Set DATABASE_URL to the PostgreSQL service.
3. Run docker compose -f docker-compose.postgres.yml up -d.
4. Verify the backend can reach PostgreSQL.

The existing Supabase repository remains the production data plane until schema, data, authentication dependencies, and RPCs are migrated and verified. Do not point production DATABASE_URL at a blank database.
