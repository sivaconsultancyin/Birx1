# Database Games

Game persistence should be separated by game identity. Shared tables may be used where schemas are genuinely common, but round/state records must always carry an explicit game identifier and round identifier.