export interface dragon_tigerGameModule {
  gameId: 'dragon-tiger';
  authority: 'server';
  roomScoped: true;
}

/** Game boundary descriptor. The authoritative implementation is currently registered in server.ts. */
export const dragon_tigerGameModule: dragon_tigerGameModule = {
  gameId: 'dragon-tiger',
  authority: 'server',
  roomScoped: true,
};

export default dragon_tigerGameModule;
