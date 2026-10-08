# Database migrations

Migrations are intentionally game-agnostic in Step 1. Game-specific tables are not added here.

Supported targets: PostgreSQL and Supabase PostgreSQL.

Production flow: backend -> database. The frontend never connects directly to PostgreSQL or Supabase.