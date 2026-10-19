import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '../../components/layout/AppLayout'
import { PublicLayout } from '../../components/layout/PublicLayout'
import { DashboardPage } from '../../pages/DashboardPage'
import { LoginPage } from '../../pages/LoginPage'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { OrderDetailPage } from '../../pages/OrderDetailPage'
import { OrdersPage } from '../../pages/OrdersPage'
import { RegisterPage } from '../../pages/RegisterPage'
import { PublicOnly, RequireAuth } from './RouteGuards'

export function AppRouter() {
  return (
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
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
