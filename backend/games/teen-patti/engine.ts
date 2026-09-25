export interface teen_pattiGameModule {
  gameId: 'teen-patti';
  authority: 'server';
  roomScoped: true;
}

/** Game boundary descriptor. The authoritative implementation is currently registered in server.ts. */
export const teen_pattiGameModule: teen_pattiGameModule = {
  gameId: 'teen-patti',
  authority: 'server',
  roomScoped: true,
};

export default teen_pattiGameModule;
