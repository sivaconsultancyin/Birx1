export interface andar_baharGameModule {
  gameId: 'andar-bahar';
  authority: 'server';
  roomScoped: true;
}

/** Game boundary descriptor. The authoritative implementation is currently registered in server.ts. */
export const andar_baharGameModule: andar_baharGameModule = {
  gameId: 'andar-bahar',
  authority: 'server',
  roomScoped: true,
};

export default andar_baharGameModule;
