# Backend Games

Keep each game's authoritative lifecycle independent: state, round, validation, settlement and realtime events.

The shared server handles authentication/wallet infrastructure; game logic remains keyed by game ID and must not leak into another game's state.