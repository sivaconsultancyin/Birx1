import {createContext,useContext,useMemo,useState, type ReactNode} from 'react';
import type {AuthSession,SessionUser} from './types.ts';
interface AuthContextValue {session:AuthSession; user:SessionUser|null; setSession:(session:AuthSession)=>void; clearSession:()=>void;}
const AuthContext=createContext<AuthContextValue|undefined>(undefined);
export function AuthProvider({children}:{children:ReactNode}){
  const [session,setSessionState]=useState<AuthSession>({user:null,accessToken:null});
  const value=useMemo(()=>({session,user:session.user,setSession:setSessionState,clearSession:()=>setSessionState({user:null,accessToken:null})}),[session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value;}