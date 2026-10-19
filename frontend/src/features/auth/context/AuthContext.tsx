import { useCallback, useEffect, useState, type PropsWithChildren } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  getCurrentUser,
  login as loginRequest,
  logoutSession,
  refreshSession,
} from '../api/authApi'
import {
  currentUserQueryKey,
  getAccessToken,
  hasExplicitLogoutMarker,
  notifySessionExpired,
  setExplicitLogoutMarker,
  setAccessToken,
} from '../session'
import type { LoginRequest } from '../types/auth'
import { AuthContext } from './authContextValue'

async function fetchValidatedUser() {
  try {
    return await getCurrentUser()
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) notifySessionExpired()
    throw error
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [hasToken, setHasToken] = useState(Boolean(getAccessToken()))
  const [isRestoringSession, setIsRestoringSession] = useState(
    !getAccessToken() && !hasExplicitLogoutMarker(),
  )
  const currentUser = useQuery({
    queryKey: currentUserQueryKey,
    queryFn: fetchValidatedUser,
    enabled: hasToken,
    retry: false,
    staleTime: 30_000,
    refetchOnMount: 'always',
  })

  useEffect(() => {
    if (getAccessToken() || hasExplicitLogoutMarker()) return

    let active = true
    refreshSession()
      .then((response) => {
        if (!active) return
        setAccessToken(response.accessToken)
        setHasToken(true)
      })
      .catch(() => {
        if (!active) return
        setAccessToken(null)
        setHasToken(false)
      })
      .finally(() => {
        if (active) setIsRestoringSession(false)
      })

    return () => {
      active = false
    }
  }, [])

  const logout = useCallback(async () => {
    setExplicitLogoutMarker(true)
    try {
      await logoutSession()
      setExplicitLogoutMarker(false)
    } catch {
    } finally {
      setAccessToken(null)
      setHasToken(false)
      queryClient.clear()
    }
  }, [queryClient])

  useEffect(() => {
    window.addEventListener('foody:session-expired', logout)
    return () => window.removeEventListener('foody:session-expired', logout)
  }, [logout])

  const login = useCallback(
    async (request: LoginRequest) => {
      const response = await loginRequest(request)
      setExplicitLogoutMarker(false)
      setAccessToken(response.accessToken)
      try {
        await queryClient.fetchQuery({
          queryKey: currentUserQueryKey,
          queryFn: fetchValidatedUser,
          staleTime: 30_000,
        })
        setHasToken(true)
      } catch (error) {
        setAccessToken(null)
        setHasToken(false)
        queryClient.removeQueries({ queryKey: currentUserQueryKey })
        throw error
      }
    },
    [queryClient],
  )

  return (
    <AuthContext.Provider
      value={{
        user: currentUser.data,
        isAuthenticated: hasToken && Boolean(currentUser.data),
        isInitializing: isRestoringSession || (hasToken && currentUser.isPending),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
