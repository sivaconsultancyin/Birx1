export interface aviatorGameModule {
  gameId: 'aviator';
  authority: 'server';
  roomScoped: true;
}

/** Game boundary descriptor. The authoritative implementation is currently registered in server.ts. */
export const aviatorGameModule: aviatorGameModule = {
  gameId: 'aviator',
  authority: 'server',
  roomScoped: true,
};

export default aviatorGameModule;
