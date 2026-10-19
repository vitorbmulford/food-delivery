import { Box, CircularProgress } from '@mui/material'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/context/useAuth'

function RouteLoading() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress aria-label="Validando sessão" />
    </Box>
  )
}

export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.isInitializing) return <RouteLoading />
  if (!auth.isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    )
  }
  return <Outlet />
}

export function PublicOnly() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.isInitializing) return <RouteLoading />
  if (!auth.isAuthenticated) return <Outlet />
  const from = (location.state as { from?: unknown } | null)?.from
  const destination =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/dashboard'
  return <Navigate to={destination} replace />
}
