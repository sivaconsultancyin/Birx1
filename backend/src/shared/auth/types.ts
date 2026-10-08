export interface SessionUser {id:string;email?:string;mobile?:string;username?:string;role?:string;}
export interface Session {user:SessionUser;accessToken?:string;expiresAt?:number;}