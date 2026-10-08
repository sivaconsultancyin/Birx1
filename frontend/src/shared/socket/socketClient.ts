import {io,type Socket} from 'socket.io-client';
import {requirePublicEnv} from '../config/env.ts';
let socket:Socket|null=null;
export function getSocket():Socket{
  if(!socket)socket=io(requirePublicEnv('socketUrl'),{autoConnect:false,withCredentials:true,transports:['websocket']});
  return socket;
}
export function connectSocket(){const s=getSocket();if(!s.connected)s.connect();return s;}
export function disconnectSocket(){socket?.disconnect();}
export function gameNamespace(game:string):string{return `/${game}`;}