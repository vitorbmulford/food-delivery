import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setAccessToken } from '../../auth/session'
import { orderKeys } from '../hooks/useOrders'
import { OrderRealtimeProvider } from './OrderRealtimeProvider'

const { mockAuth, mockRefreshSession, mockClients, MockClient } = vi.hoisted(() => {
  const mockClients: Array<{
    active: boolean
    connectHeaders: Record<string, string>
    options: Record<string, unknown>
    activate: ReturnType<typeof vi.fn>
    deactivate: ReturnType<typeof vi.fn>
    subscribe: ReturnType<typeof vi.fn>
  }> = []
  class MockClient {
    active = false
    connectHeaders: Record<string, string>
    options: Record<string, unknown>
    activate = vi.fn(() => {
      this.active = true
    })
    deactivate = vi.fn(async () => {
      this.active = false
    })
    subscribe = vi.fn()

    constructor(options: Record<string, unknown>) {
      this.options = options
      this.connectHeaders = options.connectHeaders as Record<string, string>
      mockClients.push(this)
    }
  }
  return {
    mockAuth: { isAuthenticated: false },
    mockRefreshSession: vi.fn(),
    mockClients,
    MockClient,
  }
})

vi.mock('@stomp/stompjs', () => ({ Client: MockClient }))
vi.mock('../../auth/context/useAuth', () => ({ useAuth: () => mockAuth }))
vi.mock('../../auth/api/authApi', () => ({ refreshSession: mockRefreshSession }))

const orderId = '2b519334-f8d1-456c-9ea9-4f25bb5f2611'
const event = {
  eventType: 'ORDER_STATUS_CHANGED',
  orderId,
  previousStatus: 'EM_PREPARO',
  newStatus: 'SAIU_PARA_ENTREGA',
  historyId: '29d642a1-ef26-4951-a1aa-a58515b6043f',
  changedAt: '2026-10-19T12:00:00Z',
}

function renderRealtime(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <OrderRealtimeProvider>
        <div>Pedidos</div>
      </OrderRealtimeProvider>
    </QueryClientProvider>,
  )
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function clientAt(index: number) {
  const client = mockClients[index]
  if (!client) throw new Error(`Expected STOMP client at index ${index}`)
  return client
}

function messageHandler(index = 0) {
  const handler = clientAt(0).subscribe.mock.calls[index]?.[1]
  if (typeof handler !== 'function')
    throw new Error(`Expected subscription handler at index ${index}`)
  return handler as (message: { body: string }) => void
}

describe('OrderRealtimeProvider', () => {
  beforeEach(() => {
    mockAuth.isAuthenticated = false
    mockRefreshSession.mockReset()
    mockClients.length = 0
    setAccessToken('memory-access-token')
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('connects after authentication and subscribes to the private orders destination', async () => {
    mockAuth.isAuthenticated = true
    const queryClient = makeQueryClient()
    renderRealtime(queryClient)

    await waitFor(() => expect(mockClients).toHaveLength(1))
    expect(clientAt(0).options.brokerURL).toBe('ws://localhost:8080/ws')
    expect(clientAt(0).connectHeaders).toEqual({ Authorization: 'Bearer memory-access-token' })
    act(() => (clientAt(0).options.onConnect as () => void)())
    expect(clientAt(0).subscribe).toHaveBeenCalledWith('/user/queue/orders', expect.any(Function))
    queryClient.clear()
  })

  it('does not connect for an unauthenticated user', () => {
    renderRealtime(makeQueryClient())
    expect(mockClients).toHaveLength(0)
  })

  it('invalidates list, matching details and history after a valid event', async () => {
    mockAuth.isAuthenticated = true
    const queryClient = makeQueryClient()
    const filters = { page: 2, size: 10, status: 'EM_PREPARO' as const }
    const dashboardKey = orderKeys.dashboard('2026-10-13', '2026-10-19')
    queryClient.setQueryData(orderKeys.list(filters), { content: [] })
    queryClient.setQueryData(dashboardKey, { totalCreated: 1 })
    queryClient.setQueryData(orderKeys.detail(orderId), { id: orderId })
    queryClient.setQueryData(orderKeys.history(orderId), [])
    queryClient.setQueryData(orderKeys.detail('88c69b0e-e1da-4d5e-8ac0-0100d3757ca2'), {
      id: 'other',
    })
    renderRealtime(queryClient)
    await waitFor(() => expect(mockClients).toHaveLength(1))
    act(() => (clientAt(0).options.onConnect as () => void)())
    const handler = messageHandler()

    act(() => handler({ body: JSON.stringify(event) }))

    await waitFor(() => {
      expect(queryClient.getQueryState(orderKeys.list(filters))?.isInvalidated).toBe(true)
      expect(queryClient.getQueryState(dashboardKey)?.isInvalidated).toBe(true)
      expect(queryClient.getQueryState(orderKeys.detail(orderId))?.isInvalidated).toBe(true)
      expect(queryClient.getQueryState(orderKeys.history(orderId))?.isInvalidated).toBe(true)
    })
    expect(
      queryClient.getQueryState(orderKeys.detail('88c69b0e-e1da-4d5e-8ac0-0100d3757ca2'))
        ?.isInvalidated,
    ).toBe(false)
    queryClient.clear()
  })

  it('ignores invalid messages without touching the query cache', async () => {
    mockAuth.isAuthenticated = true
    const queryClient = makeQueryClient()
    const filters = { page: 0, size: 10 }
    queryClient.setQueryData(orderKeys.list(filters), { content: [] })
    renderRealtime(queryClient)
    await waitFor(() => expect(mockClients).toHaveLength(1))
    act(() => (clientAt(0).options.onConnect as () => void)())
    const handler = messageHandler()

    act(() => handler({ body: JSON.stringify({ ...event, orderId: 'not-a-uuid' }) }))

    expect(queryClient.getQueryState(orderKeys.list(filters))?.isInvalidated).toBe(false)
    queryClient.clear()
  })

  it('refreshes the token before reconnecting after a connection drop', async () => {
    vi.useFakeTimers()
    mockAuth.isAuthenticated = true
    mockRefreshSession.mockResolvedValue({ accessToken: 'refreshed-access-token' })
    const { unmount } = renderRealtime(makeQueryClient())
    expect(mockClients).toHaveLength(1)

    act(() => (clientAt(0).options.onWebSocketClose as () => void)())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })

    expect(mockRefreshSession).toHaveBeenCalledTimes(1)
    expect(mockClients).toHaveLength(2)
    expect(clientAt(1).connectHeaders).toEqual({
      Authorization: 'Bearer refreshed-access-token',
    })
    unmount()
    vi.useRealTimers()
  })

  it('closes the connection when authentication ends and tolerates Strict Mode remounts', async () => {
    mockAuth.isAuthenticated = true
    const queryClient = makeQueryClient()
    const view = render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <OrderRealtimeProvider>
            <div>Pedidos</div>
          </OrderRealtimeProvider>
        </QueryClientProvider>
      </StrictMode>,
    )
    await waitFor(() => expect(mockClients.some((client) => client.active)).toBe(true))
    mockAuth.isAuthenticated = false
    view.rerender(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <OrderRealtimeProvider>
            <div>Pedidos</div>
          </OrderRealtimeProvider>
        </QueryClientProvider>
      </StrictMode>,
    )
    await waitFor(() => expect(mockClients.every((client) => !client.active)).toBe(true))
    queryClient.clear()
  })
})
