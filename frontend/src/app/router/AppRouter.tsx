import { lazy, Suspense } from 'react'
import { Box, Skeleton, Stack } from '@mui/material'
import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '../../components/layout/AppLayout'
import { PublicLayout } from '../../components/layout/PublicLayout'
import { PublicOnly, RequireAuth } from './RouteGuards'

const DashboardPage = lazy(() =>
  import('../../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const InsightsPage = lazy(() =>
  import('../../pages/InsightsPage').then((module) => ({ default: module.InsightsPage })),
)
const CreateOrderPage = lazy(() =>
  import('../../pages/CreateOrderPage').then((module) => ({ default: module.CreateOrderPage })),
)
const LoginPage = lazy(() =>
  import('../../pages/LoginPage').then((module) => ({ default: module.LoginPage })),
)
const NotFoundPage = lazy(() =>
  import('../../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
)
const OrderDetailPage = lazy(() =>
  import('../../pages/OrderDetailPage').then((module) => ({ default: module.OrderDetailPage })),
)
const OrdersPage = lazy(() =>
  import('../../pages/OrdersPage').then((module) => ({ default: module.OrdersPage })),
)
const RegisterPage = lazy(() =>
  import('../../pages/RegisterPage').then((module) => ({ default: module.RegisterPage })),
)

function RouteLoadingFallback() {
  return (
    <Stack role="status" aria-label="Carregando página" spacing={2} sx={{ width: '100%' }}>
      <Skeleton variant="text" width="35%" height={44} />
      <Skeleton variant="text" width="55%" height={24} />
      <Box sx={{ pt: 1 }}>
        <Skeleton variant="rounded" height={180} />
      </Box>
    </Stack>
  )
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/new" element={<CreateOrderPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
