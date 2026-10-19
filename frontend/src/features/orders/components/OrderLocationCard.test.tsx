import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '../types/order'
import { orderKeys } from '../hooks/useOrders'
import { OrderLocationCard } from './OrderLocationCard'

const { requestOrderGeocoding, setManualOrderLocation } = vi.hoisted(() => ({
  requestOrderGeocoding: vi.fn(),
  setManualOrderLocation: vi.fn(),
}))
vi.mock('../api/ordersApi', () => ({ requestOrderGeocoding, setManualOrderLocation }))
vi.mock('./OrderMap', () => ({
  OrderMap: ({
    latitude,
    longitude,
    markerLabel,
    onSelect,
  }: {
    latitude?: number
    longitude?: number
    markerLabel?: string
    onSelect?: (coordinates: { latitude: number; longitude: number }) => void
  }) => (
    <button
      data-testid="delivery-map"
      data-latitude={latitude}
      data-longitude={longitude}
      onClick={() => onSelect?.({ latitude: -23.55052, longitude: -46.633309 })}
    >
      {markerLabel}
    </button>
  ),
}))

const baseOrder: Order = {
  id: '7a5f6462-dd57-4fef-aed2-8825b85cef0b',
  customer: { name: 'Ana Silva', phone: '11999999999', email: 'ana@example.com' },
  status: 'EM_PREPARO',
  items: [],
  deliveryAddress: {
    street: 'Rua das Flores',
    number: '12',
    complement: 'Casa 2',
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

function renderCard(order = baseOrder) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(orderKeys.detail(order.id), order)
  const view = render(
    <QueryClientProvider client={queryClient}>
      <OrderLocationCard order={order} onRefresh={vi.fn()} isRefreshing={false} />
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

describe('OrderLocationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('shows the full address and pending status without coordinates', () => {
    renderCard()
    expect(screen.getByRole('heading', { name: 'Localização da entrega' })).toBeInTheDocument()
    expect(screen.getByText('Rua das Flores, 12 · Casa 2')).toBeInTheDocument()
    expect(screen.getByText('Centro · São Paulo/SP')).toBeInTheDocument()
    expect(screen.getByText('CEP 01001000')).toBeInTheDocument()
    expect(screen.getByText('O endereço está sendo localizado.')).toBeInTheDocument()
    expect(screen.queryByTestId('delivery-map')).not.toBeInTheDocument()
  })

  it('shows the interactive map placeholder and real coordinates on success', async () => {
    renderCard({
      ...baseOrder,
      geocodingStatus: 'SUCCESS',
      coordinates: { latitude: -23.55, longitude: -46.63 },
      coordinateSource: 'AUTOMATIC',
    })
    expect(await screen.findByTestId('delivery-map')).toBeInTheDocument()
    expect(screen.getByText('Latitude -23.55, longitude -46.63')).toBeInTheDocument()
    expect(
      screen.getByText(/Não representa a posição em tempo real do entregador/),
    ).toBeInTheDocument()
  })

  it.each([
    ['NOT_FOUND', 'O endereço exato não foi localizado'],
    ['FAILED', 'Ocorreu uma falha ao consultar a localização.'],
  ] as const)('explains the %s state and offers a retry', (geocodingStatus, message) => {
    renderCard({ ...baseOrder, geocodingStatus })
    expect(screen.getByText(new RegExp(message))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar localizar novamente' })).toBeInTheDocument()
    expect(screen.queryByTestId('delivery-map')).not.toBeInTheDocument()
  })

  it('does not show a map for absent or invalid coordinates', () => {
    const absent = renderCard({ ...baseOrder, geocodingStatus: 'SUCCESS' })
    expect(
      screen.getByText(/coordenadas retornadas são inválidas ou estão ausentes/),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('delivery-map')).not.toBeInTheDocument()
    absent.unmount()

    renderCard({
      ...baseOrder,
      geocodingStatus: 'SUCCESS',
      coordinates: { latitude: 91, longitude: 300 },
    })
    expect(
      screen.getByText(/coordenadas retornadas são inválidas ou estão ausentes/),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('delivery-map')).not.toBeInTheDocument()
  })

  it('treats HTTP 202 as accepted, invalidates details, and displays pending feedback', async () => {
    requestOrderGeocoding.mockResolvedValue(202)
    const user = userEvent.setup()
    const { queryClient, rerender } = renderCard({ ...baseOrder, geocodingStatus: 'FAILED' })
    await user.click(screen.getByRole('button', { name: 'Tentar localizar novamente' }))
    expect(requestOrderGeocoding).toHaveBeenCalledWith(baseOrder.id)
    expect(queryClient.getQueryState(orderKeys.detail(baseOrder.id))?.isInvalidated).toBe(true)
    expect(screen.queryByText(/Nova solicitação aceita/)).not.toBeInTheDocument()

    rerender(
      <QueryClientProvider client={queryClient}>
        <OrderLocationCard
          order={{ ...baseOrder, geocodingStatus: 'PENDING' }}
          onRefresh={vi.fn()}
          isRefreshing={false}
        />
      </QueryClientProvider>,
    )
    expect(screen.getByText(/Nova solicitação aceita/)).toBeInTheDocument()

    rerender(
      <QueryClientProvider client={queryClient}>
        <OrderLocationCard
          order={{ ...baseOrder, geocodingStatus: 'FAILED' }}
          onRefresh={vi.fn()}
          isRefreshing={false}
        />
      </QueryClientProvider>,
    )
    await waitFor(() =>
      expect(screen.queryByText(/Nova solicitação aceita/)).not.toBeInTheDocument(),
    )
  })

  it('shows a safe network error when retry fails', async () => {
    requestOrderGeocoding.mockRejectedValue({ isAxiosError: true })
    const user = userEvent.setup()
    renderCard({ ...baseOrder, geocodingStatus: 'NOT_FOUND' })
    await user.click(screen.getByRole('button', { name: 'Tentar localizar novamente' }))
    expect(await screen.findByText(/Não foi possível conectar à API/)).toBeInTheDocument()
  })

  it('lets the customer select and confirm a manual point after NOT_FOUND', async () => {
    const savedOrder: Order = {
      ...baseOrder,
      geocodingStatus: 'SUCCESS',
      coordinates: { latitude: -23.55052, longitude: -46.633309 },
      coordinateSource: 'MANUAL',
    }
    setManualOrderLocation.mockResolvedValue(savedOrder)
    const user = userEvent.setup()
    const { queryClient } = renderCard({ ...baseOrder, geocodingStatus: 'NOT_FOUND' })

    await user.click(screen.getByRole('button', { name: 'Selecionar ponto no mapa' }))
    expect(screen.getByText(/clique no ponto correto da entrega/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar ponto de entrega' })).toBeDisabled()
    await user.click(screen.getByTestId('delivery-map'))
    await user.click(screen.getByRole('button', { name: 'Confirmar ponto de entrega' }))

    expect(setManualOrderLocation).toHaveBeenCalledWith(baseOrder.id, {
      latitude: -23.55052,
      longitude: -46.633309,
    })
    expect(queryClient.getQueryData(orderKeys.detail(baseOrder.id))).toEqual(savedOrder)
  })

  it('opens manual selection automatically at a validated approximate reference without auto-confirming it', async () => {
    const user = userEvent.setup()
    renderCard({
      ...baseOrder,
      geocodingStatus: 'NOT_FOUND',
      suggestedCoordinates: { latitude: -23.5614, longitude: -46.6559 },
      geocodingSuggestionLevel: 'STREET',
    })

    const map = await screen.findByTestId('delivery-map')
    expect(map).toHaveAttribute('data-latitude', '-23.5614')
    expect(map).toHaveAttribute('data-longitude', '-46.6559')
    expect(screen.getByText(/referência aproximada da rua/)).toBeInTheDocument()
    expect(screen.getByText(/não foi confirmada automaticamente/)).toBeInTheDocument()
    expect(
      screen.getByText(/Referência aproximada: latitude -23\.561400, longitude -46\.655900/),
    ).toBeInTheDocument()
    expect(setManualOrderLocation).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirmar ponto de entrega' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Cancelar seleção' }))
    expect(screen.queryByTestId('delivery-map')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar ponto no mapa' })).toBeInTheDocument()
  })

  it('clearly identifies manually confirmed coordinates', async () => {
    renderCard({
      ...baseOrder,
      geocodingStatus: 'SUCCESS',
      coordinates: { latitude: -23.55052, longitude: -46.633309 },
      coordinateSource: 'MANUAL',
    })

    expect(screen.getByText('Localização definida manualmente')).toBeInTheDocument()
    expect(await screen.findByText(/ponto de entrega confirmado manualmente/)).toBeInTheDocument()
  })
})
