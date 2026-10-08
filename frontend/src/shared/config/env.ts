const read = (key:string):string => {
  const value = (import.meta.env?.[key] ?? '').trim();
  return value;
};
export const frontendEnv = Object.freeze({
  apiUrl: read('VITE_API_URL'),
  socketUrl: read('VITE_SOCKET_URL') || read('VITE_API_URL'),
  appEnv: read('VITE_APP_ENV') || 'development'
});
export const requirePublicEnv = (key:keyof typeof frontendEnv):string => {
  const value=frontendEnv[key];
  if(!value) throw new Error(`Missing public frontend environment variable: ${key}`);
  return value;
};