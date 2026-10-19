import { useState, type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { AuthProvider } from '../../features/auth/context/AuthContext'
import { OrderRealtimeProvider } from '../../features/orders/realtime/OrderRealtimeProvider'
import { ColorModeProvider } from '../theme/ColorModeProvider'

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    <ColorModeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <OrderRealtimeProvider>{children}</OrderRealtimeProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ColorModeProvider>
  )
}
