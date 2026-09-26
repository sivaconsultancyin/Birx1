# Frontend

This directory is the browser-facing game UI boundary.

## Ownership
- React game screens and UI components
- Client-side presentation state and animations
- Backend API/SSE consumption only

## Backend boundary
The frontend must communicate with the server through `src/api/client.ts`.
It must not import anything from `backend/` or use Supabase service-role/database credentials.

## Games
Each game UI lives under `frontend/games/<game>/`.
