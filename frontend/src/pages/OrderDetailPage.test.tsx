import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order, OrderStatusHistory } from '../features/orders/types/order'
import { sortOrderHistory } from '../features/orders/utils/orderHistory'
import { OrderDetailPage } from './OrderDetailPage'

const { getOrder, getOrderHistory, updateOrderStatus } = vi.hoisted(() => ({
  getOrder: vi.fn(),
  getOrderHistory: vi.fn(),
  updateOrderStatus: vi.fn(),
}))
vi.mock('../features/orders/api/ordersApi', () => ({
  getOrder,
  getOrderHistory,
  updateOrderStatus,
  listOrders: vi.fn(),
  createOrder: vi.fn(),
}))

const id = '7a5f6462-dd57-4fef-aed2-8825b85cef0b'
const order: Order = {
  id,
  customer: { id: 'customer-1', name: 'Ana Silva', email: 'ana@example.com' },
  status: 'EM_PREPARO',
  items: [{ id: 'item-1', productName: 'Marmita', quantity: 2, unitPrice: 24.5, subtotal: 49 }],
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
const received: OrderStatusHistory = {
  id: 'event-1',
  previousStatus: null,
  newStatus: 'RECEBIDO',
  changedAt: '2026-10-19T12:00:00Z',
  changedBy: 'user-1',
}
const preparing: OrderStatusHistory = {
  id: 'event-2',
  previousStatus: 'RECEBIDO',
  newStatus: 'EM_PREPARO',
  changedAt: '2026-10-19T12:10:00Z',
  changedBy: null,
}

function renderDetail(path = `/orders/${id}`) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('detalhes do pedido', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrder.mockResolvedValue(order)
    getOrderHistory.mockResolvedValue([preparing, received])
  })
  afterEach(cleanup)

  it('mostra pedido, itens, total, endereço, datas, progresso e histórico ordenado', async () => {
    renderDetail()
    expect(await screen.findByText('Marmita')).toBeInTheDocument()
    expect(screen.getByText('2 × R$ 24,50')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 49,00').length).toBeGreaterThan(0)
    expect(screen.getByText('Rua das Flores, 12 · Casa 2')).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText(/Atualizado em/)).toBeInTheDocument()
    const header = screen.getByRole('region', { name: 'Cabeçalho do pedido' })
    const actions = screen.getByRole('group', { name: 'Ações disponíveis para este pedido' })
    const nextAction = screen.getByRole('button', { name: 'Saiu para entrega' })
    const title = screen.getByRole('heading', { name: 'Pedido de Ana Silva' })
    const statusChip = header.querySelector('[data-status]')
    const createdAt = screen.getByText(/Criado em/)
    expect(header).toContainElement(actions)
    expect(actions).toContainElement(nextAction)
    expect(statusChip).not.toBeNull()
    expect(title.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      actions.compareDocumentPosition(createdAt) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(actions.parentElement?.parentElement).toBe(statusChip!.parentElement?.parentElement)
    expect(nextAction).toHaveClass('MuiButton-outlined')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('MuiButton-outlined')
    expect(screen.queryByRole('heading', { name: 'Atualizar status' })).not.toBeInTheDocument()
    expect(await screen.findByText('Pedido recebido')).toBeInTheDocument()
    expect(screen.getByText('Recebido → Em preparo')).toBeInTheDocument()
    expect(screen.getByText('Responsável · user-1')).toBeInTheDocument()
    const events = screen.getByRole('list', { name: 'Eventos reais do pedido' })
    expect(events.firstElementChild).toHaveTextContent('Pedido recebido')
    expect(events.lastElementChild).toHaveTextContent('Recebido → Em preparo')
    expect(getOrderHistory).toHaveBeenCalledWith(id)
  })

  it('ordena eventos pela data e usa o ID como desempate estável', () => {
    const later = { ...received, id: 'c', changedAt: '2026-10-20T12:00:00Z' }
    const tieZ = { ...received, id: 'z', changedAt: '2026-10-19T12:00:00Z' }
    const tieA = { ...received, id: 'a', changedAt: '2026-10-19T12:00:00Z' }
    expect(sortOrderHistory([later, tieZ, tieA]).map((event) => event.id)).toEqual(['a', 'z', 'c'])
  })

  it('não faz requisição para UUID inválido', () => {
    renderDetail('/orders/id-invalido')
    expect(screen.getByText('O identificador deste pedido não é válido.')).toBeInTheDocument()
    expect(getOrder).not.toHaveBeenCalled()
  })

  it('leva ao histórico ao ativar o atalho do andamento', async () => {
    renderDetail()
    await screen.findByText('Marmita')
    const historySection = document.getElementById('order-status-history')
    expect(historySection).not.toBeNull()
    const scrollIntoView = vi.fn()
    Object.defineProperty(historySection, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    screen.getByRole('button', { name: 'Ver histórico do pedido' }).click()

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(document.activeElement).toBe(historySection)
  })

  it('apresenta pedido inexistente e falha de rede com mensagens seguras', async () => {
    getOrder.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } })
    const notFound = renderDetail()
    expect(await screen.findByText('Este pedido não foi encontrado.')).toBeInTheDocument()
    notFound.unmount()

    getOrder.mockRejectedValueOnce({ isAxiosError: true })
    renderDetail()
    expect(
      await screen.findByText(
        'Não foi possível conectar à API. Verifique sua conexão e tente novamente.',
      ),
    ).toBeInTheDocument()
  })

  it('mantém os detalhes disponíveis quando o histórico falha e mostra histórico vazio', async () => {
    getOrderHistory.mockRejectedValueOnce({ isAxiosError: true })
    const failedHistory = renderDetail()
    expect(await screen.findByText('Marmita')).toBeInTheDocument()
    expect(
      await screen.findByText(
        'Não foi possível conectar à API. Verifique sua conexão e tente novamente.',
      ),
    ).toBeInTheDocument()
    failedHistory.unmount()

    getOrderHistory.mockResolvedValueOnce([])
    renderDetail()
    expect(
      await screen.findByText('Ainda não há eventos no histórico deste pedido.'),
    ).toBeInTheDocument()
  })

  it('apresenta cancelamento sem confundi-lo com entrega', async () => {
    getOrder.mockResolvedValueOnce({ ...order, status: 'CANCELADO' })
    getOrderHistory.mockResolvedValueOnce([
      received,
      { ...preparing, id: 'event-cancel', previousStatus: 'RECEBIDO', newStatus: 'CANCELADO' },
    ])
    renderDetail()
    expect((await screen.findAllByText('Pedido cancelado')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Entregue')).not.toBeInTheDocument()
    expect(await screen.findByText('Recebido → Cancelado')).toBeInTheDocument()
  })
})
