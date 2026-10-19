import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { OrderStatusActions } from './OrderStatusActions'
import { OrderStatusTimeline } from './OrderStatusTimeline'
import { orderKeys } from '../hooks/useOrders'
import type { Order, OrderStatus } from '../types/order'

const { updateOrderStatus, getOrderHistory } = vi.hoisted(() => ({
  updateOrderStatus: vi.fn(),
  getOrderHistory: vi.fn(),
}))
vi.mock('../api/ordersApi', () => ({
  updateOrderStatus,
  getOrderHistory,
  listOrders: vi.fn(),
  getOrder: vi.fn(),
  createOrder: vi.fn(),
}))

const baseOrder: Order = {
  id: 'order-1',
  customer: { id: 'customer-1', name: 'Ana', email: 'ana@example.com' },
  status: 'RECEBIDO',
  items: [],
  deliveryAddress: {
    street: 'Rua A',
    number: '1',
    complement: '',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001000',
  },
  totalAmount: 0,
  createdAt: '2026-10-19T12:00:00Z',
  updatedAt: '2026-10-19T12:00:00Z',
  coordinates: null,
  geocodingStatus: 'PENDING',
  coordinateSource: null,
  suggestedCoordinates: null,
  geocodingSuggestionLevel: null,
}

function renderActions(status: OrderStatus) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <OrderStatusActions order={{ ...baseOrder, status }} />
    </QueryClientProvider>,
  )
}

describe('ações de status', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('oferece somente a transição permitida e confirma o cancelamento', async () => {
    updateOrderStatus.mockImplementation(async (_id: string, status: OrderStatus) => ({
      ...baseOrder,
      status,
    }))
    renderActions('RECEBIDO')
    expect(screen.getByRole('button', { name: 'Iniciar preparo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar entregue' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Essa alteração não pode ser desfeita.')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
    await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledWith('order-1', 'CANCELADO'))
    expect(await screen.findByRole('status')).toHaveTextContent('Status atualizado.')
  })

  it('não oferece ações para status terminal e informa conflito 409', async () => {
    const conflict = Object.assign(new Error('conflict'), { response: { status: 409 } })
    updateOrderStatus.mockRejectedValue(conflict)
    const { rerender } = renderActions('SAIU_PARA_ENTREGA')
    expect(screen.getByRole('button', { name: 'Marcar entregue' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
      >
        <OrderStatusActions order={{ ...baseOrder, status: 'EM_PREPARO' }} />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Saiu para entrega' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O pedido foi alterado em outra operação.',
    )
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <OrderStatusActions order={{ ...baseOrder, status: 'ENTREGUE' }} />
      </QueryClientProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar preparo' })).not.toBeInTheDocument()
  })

  it('reconsulta a timeline após atualizar o status com sucesso', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const initialHistory = [
      {
        id: 'event-1',
        previousStatus: null,
        newStatus: 'RECEBIDO',
        changedAt: '2026-10-19T12:00:00Z',
        changedBy: null,
      },
    ]
    getOrderHistory.mockResolvedValueOnce(initialHistory).mockResolvedValueOnce([
      ...initialHistory,
      {
        id: 'event-2',
        previousStatus: 'RECEBIDO',
        newStatus: 'EM_PREPARO',
        changedAt: '2026-10-19T12:10:00Z',
        changedBy: null,
      },
    ])
    updateOrderStatus.mockResolvedValue({ ...baseOrder, status: 'EM_PREPARO' })

    render(
      <QueryClientProvider client={queryClient}>
        <>
          <OrderStatusActions order={baseOrder} />
          <OrderStatusTimeline orderId={baseOrder.id} />
        </>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Pedido recebido')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar preparo' }))
    expect(await screen.findByText('Recebido → Em preparo')).toBeInTheDocument()
    expect(getOrderHistory).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryState(orderKeys.history(baseOrder.id))?.isInvalidated).toBe(false)
  })
})
