# Backend

The authoritative Node/Express API server lives at `backend/server.ts`.

## Responsibilities
- Authentication and authorization middleware
- Game API routes and server-authoritative round lifecycle
- SSE real-time event stream
- Wallet/debit/credit orchestration
- Supabase repository access
- Recovery/lease coordination

Game engines are server-authoritative. Frontend code never owns round state, wallet settlement, or secret Supabase credentials.

`server.ts` at the repository root is only a compatibility entrypoint that imports `backend/server.ts`.
