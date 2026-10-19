import { act, cleanup, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '../types/order'
import { useOrder } from './useOrders'

const { getOrder } = vi.hoisted(() => ({ getOrder: vi.fn() }))
vi.mock('../api/ordersApi', () => ({ getOrder }))

const pendingOrder: Order = {
  id: '7a5f6462-dd57-4fef-aed2-8825b85cef0b',
  customer: { id: 'customer-1', name: 'Ana Silva', email: 'ana@example.com' },
  status: 'EM_PREPARO',
  items: [],
  deliveryAddress: {
    street: 'Rua das Flores',
    number: '12',
    complement: null,
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001000',
  },
  totalAmount: 49,
  createdAt: '2026-10-19T12:00:00Z',
  updatedAt: '2026-10-19T12:10:00Z',
  coordinates: null,
  geocodingStatus: 'PENDING',
  coordinateSource: null,
  suggestedCoordinates: null,
  geocodingSuggestionLevel: null,
}

describe('useOrder geocoding polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T12:00:00Z'))
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('polls every five seconds while pending and stops after a terminal result', async () => {
    getOrder.mockResolvedValueOnce(pendingOrder).mockResolvedValueOnce({
      ...pendingOrder,
      geocodingStatus: 'SUCCESS',
      coordinates: { latitude: -23.55, longitude: -46.63 },
      coordinateSource: 'AUTOMATIC',
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result, unmount } = renderHook(() => useOrder(pendingOrder.id), { wrapper })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(getOrder).toHaveBeenCalledTimes(1)
    expect(result.current.data?.geocodingStatus).toBe('PENDING')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(getOrder).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => expect(result.current.data?.geocodingStatus).toBe('SUCCESS'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(getOrder).toHaveBeenCalledTimes(2)
    unmount()
    queryClient.clear()
  })
})
