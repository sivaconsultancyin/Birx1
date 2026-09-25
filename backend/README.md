# Backend

The Node/Express server is `server.ts`.

Game engines are server-authoritative. Each game's API routes, round lifecycle, validation and settlement are isolated by game identifiers.

The backend is the only authority for round state, bets, cash-outs and wallet settlement.