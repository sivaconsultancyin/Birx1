export interface diceGameModule {
  gameId: 'dice';
  authority: 'server';
  roomScoped: true;
}

/** Game boundary descriptor. The authoritative implementation is currently registered in server.ts. */
export const diceGameModule: diceGameModule = {
  gameId: 'dice',
  authority: 'server',
  roomScoped: true,
};

export default diceGameModule;
