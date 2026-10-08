import type { Socket } from 'socket.io-client';
import { connectSocket, gameNamespace } from '../../../shared/socket/socketClient.ts';
import type { RealtimeEventPayload } from '../../../types.ts';

export const AVIATOR_SOCKET_EVENTS = ['round_started','betting_closed','aviator_tick','result'] as const;
export type AviatorSocketEvent = typeof AVIATOR_SOCKET_EVENTS[number];

export function connectAviatorSocket(): Socket {
  const base=connectSocket();
  const namespace=base.io.socket(gameNamespace('aviator'));
  if(!namespace.connected) namespace.connect();
  return namespace;
}

export function subscribeToAviatorEvents(onEvent:(payload:RealtimeEventPayload)=>void):()=>void{
  const socket=connectAviatorSocket();
  const handlers:Record<string,(data:unknown)=>void>={};
  for(const event of AVIATOR_SOCKET_EVENTS){
    const handler=(data:unknown)=>{
      const payload=(data && typeof data==='object'?data:{}) as Record<string,unknown>;
      onEvent({event,data:payload,timestamp:Date.now()});
    };
    handlers[event]=handler;
    socket.on(event,handler);
  }
  return ()=>{for(const event of AVIATOR_SOCKET_EVENTS) socket.off(event,handlers[event]);};
}
