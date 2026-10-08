import {frontendEnv,requirePublicEnv} from '../config/env.ts';
export async function httpRequest<T>(path:string,init:RequestInit={}):Promise<T>{
  const base=requirePublicEnv('apiUrl').replace(/\/$/,'');
  const token=localStorage.getItem('brix_token');
  const response=await fetch(`${base}${path}`,{...init,credentials:'include',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}),...(init.headers||{})}});
  const text=await response.text();
  const data=text?JSON.parse(text):null;
  if(!response.ok)throw new Error(data?.error||`Request failed: ${response.status}`);
  return data as T;
}