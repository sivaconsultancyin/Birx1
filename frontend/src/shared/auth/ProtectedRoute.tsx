import type {ReactNode} from 'react';
import {Navigate} from 'react-router-dom';
import {useAuth} from './AuthProvider.tsx';
export function ProtectedRoute({children}:{children:ReactNode}){const {user}=useAuth();return user?<>{children}</>:<Navigate to="/login" replace/>;}