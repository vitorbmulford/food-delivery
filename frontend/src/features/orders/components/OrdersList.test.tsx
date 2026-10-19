import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { appTheme } from '../../../app/theme/theme'
import type { Order } from '../types/order'
import { OrdersList } from './OrdersList'

afterEach(cleanup)

const order: Order = {
  id: 'c3c5a62b-4d7a-4bb0-a8fd-603ac69cb321',
  customer: { id: 'customer-1', name: 'Ana Silva', email: 'ana@example.com' },
  status: 'RECEBIDO',
  items: [
    { id: 'item-1', productName: 'Hambúrguer', quantity: 2, unitPrice: 32.9, subtotal: 65.8 },
  ],
  deliveryAddress: {
    street: 'Rua A',
    number: '10',
    complement: '',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001000',
  },
  totalAmount: 65.8,
  createdAt: '2026-10-19T12:00:00Z',
  updatedAt: '2026-10-19T12:00:00Z',
  coordinates: null,
  geocodingStatus: 'PENDING',
  coordinateSource: null,
  suggestedCoordinates: null,
  geocodingSuggestionLevel: null,
}

function renderList(overrides: Partial<React.ComponentProps<typeof OrdersList>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const props: React.ComponentProps<typeof OrdersList> = {
    orders: [order],
    loading: false,
    error: false,
    page: 0,
    totalPages: 2,
    totalElements: 11,
    status: '',
    onStatusChange: vi.fn(),
    onPageChange: vi.fn(),
    onRetry: vi.fn(),
    onCreate: vi.fn(),
    ...overrides,
  }
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={appTheme}>
          <MemoryRouter>
            <OrdersList {...props} />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    ),
    props,
    queryClient,
  }
}

describe('listagem de pedidos', () => {
  it('exibe dados retornados, navegação e total da página', () => {
    renderList()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('2 un.')).toBeInTheDocument()
    expect(screen.getByText('Hambúrguer')).toBeInTheDocument()
    expect(screen.getByText('R$ 65,80')).toBeInTheDocument()
    expect(screen.getByText('Recebido')).toBeInTheDocument()
    expect(screen.getByText('11 pedidos encontrados')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'c3c5a62b' })).toHaveAttribute(
      'href',
      `/orders/${order.id}`,
    )
  })

  it('mostra skeleton, vazio e erro com opção de retry', () => {
    const { rerender, props, queryClient } = renderList({ loading: true, orders: [] })
    expect(screen.getByLabelText('Carregando pedidos')).toBeInTheDocument()
    rerender(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={appTheme}>
          <MemoryRouter>
            <OrdersList {...props} loading={false} />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    )
    expect(screen.getByText('Nenhum pedido encontrado')).toBeInTheDocument()
    rerender(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={appTheme}>
          <MemoryRouter>
            <OrdersList {...props} loading={false} error />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    )
    expect(screen.getByText('Não foi possível carregar os pedidos.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    expect(props.onRetry).toHaveBeenCalledOnce()
  })

  it('chama mudança de página com índice zero baseado', () => {
    const { props } = renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))
    expect(props.onPageChange).toHaveBeenCalledWith(1)
  })

  it('expõe o filtro de status e notifica a seleção', async () => {
    const { props } = renderList()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Status' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Em preparo' }))
    expect(props.onStatusChange).toHaveBeenCalledWith('EM_PREPARO')
  })
})
