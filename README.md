# Brix Gaming Platform — Production Foundation

## Architecture

```
Mobile/Web Client
      |
      v
/frontend (React + Vite + TypeScript)
      |
      | HTTPS / Socket.IO
      v
/backend (Node.js + Express + TypeScript)
      |
      v
PostgreSQL / Supabase
```

The frontend never connects directly to PostgreSQL or Supabase service-role APIs.

## Applications

- `/frontend` — independently runnable React/Vite application.
- `/backend` — independently runnable Node/Express application.
- `/database` and Supabase migrations — persistence infrastructure only.

## Game isolation

Frontend game modules live under `frontend/src/games/<game>`.
Backend game modules live under `backend/src/games/<game>`.

Private game code must never be imported by another game. Shared infrastructure belongs under `frontend/src/shared` or `backend/src/shared`.

Each game has reserved frontend layers:

`components/ pages/ api/ socket/ hooks/ types/ constants/ utils/ styles/ assets/ tests/`

Each game has reserved backend layers:

`engine/ routes/ controllers/ services/ repository/ socket/ types/ constants/ events/ validators/ tests/`

Step 1 does not add new gameplay logic. Existing game implementations are preserved in their isolated game modules for the next migration stage.

## Authentication

Authentication is backend-authoritative. The frontend contains session state and protected-route infrastructure only. Server secrets are backend-only.

## Database

The database layer supports PostgreSQL and Supabase PostgreSQL. No game-specific tables are added by the foundation migration.

## Socket architecture

Socket.IO is prepared with isolated namespaces:

`/aviator`, `/roulette`, `/teen-patti`, `/dice`, `/dragon-tiger`, `/andar-bahar`.

Gameplay events are intentionally not implemented in Step 1.

## Environment

Frontend public variables:

- `VITE_API_URL`
- `VITE_SOCKET_URL`
- `VITE_APP_ENV`

Backend/server-only variables include:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `FRONTEND_URL`
- `LOG_LEVEL`

Never put service-role keys, database passwords, tokens, or other secrets in frontend environment files.

## Development

```bash
npm install
npm run dev:frontend
npm run dev:backend
```

Applications can also be started independently:

```bash
cd frontend && npm install && npm run dev
cd backend && npm install && npm run dev
```

## Validation

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Deployment

Deploy frontend and backend as separate services. Configure backend server secrets only on the backend deployment. Configure public frontend URLs only in the frontend deployment.

## Step 1 boundary

This commit establishes infrastructure only. Do not implement, redesign, or modify game gameplay as part of this foundation step.
