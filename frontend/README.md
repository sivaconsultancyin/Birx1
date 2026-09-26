# Frontend

The browser client is the React/Vite application.

## Responsibilities
- UI/screens/components
- Game presentation and animations
- Calling the backend API
- Receiving live SSE events
- Local UI state only

Game state, betting validation, wallet settlement, Supabase service-role access, and round authority do **not** belong in frontend code.

The main application shell currently lives under `src/`; game-specific screens live under `frontend/games/<game>/`. This is being kept as a compatibility layout while the remaining shared UI is migrated into the frontend boundary.
