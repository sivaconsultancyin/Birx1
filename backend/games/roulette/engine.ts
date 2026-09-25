export interface rouletteGameModule {
  gameId: 'roulette';
  authority: 'server';
  roomScoped: true;
}

/** Game boundary descriptor. The authoritative implementation is currently registered in server.ts. */
export const rouletteGameModule: rouletteGameModule = {
  gameId: 'roulette',
  authority: 'server',
  roomScoped: true,
};

export default rouletteGameModule;
