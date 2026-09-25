# Frontend

The Vite/React client lives under `src/` in this repository. This folder is the architectural boundary for frontend ownership.

## Games
Each game has its own screen and game-specific component namespace under `src/screens` and `src/components/<game>`.

Games: aviator, roulette, teen-patti, dice, dragon-tiger, andar-bahar.

Game state and money settlement never belong in frontend code; the frontend only renders server state and calls the API.