import { createContext } from 'react'
import type { LoginRequest, User } from '../types/auth'

export type AuthContextValue = {
  user: User | undefined
  isAuthenticated: boolean
  isInitializing: boolean
  login: (request: LoginRequest) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
