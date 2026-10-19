import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appTheme } from '../app/theme/theme'
import { useOrders } from '../features/orders/hooks/useOrders'
import { OrdersPage } from './OrdersPage'

vi.mock('../features/orders/hooks/useOrders', () => ({ useOrders: vi.fn() }))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

function renderPage() {
  vi.mocked(useOrders).mockReturnValue({
    data: { content: [], page: { totalElements: 0, totalPages: 0, number: 0, size: 10 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useOrders>)
  return render(
    <ThemeProvider theme={appTheme}>
      <MemoryRouter initialEntries={['/orders?page=2&status=RECEBIDO']}>
        <OrdersPage />
        <LocationProbe />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('busca de pedidos', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('aplica o termo após o debounce, preserva o status e reinicia a página', async () => {
    renderPage()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar pedidos' }), {
      target: { value: 'Maria' },
    })

    expect(vi.mocked(useOrders)).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'Maria' }),
    )
    await act(async () => vi.advanceTimersByTime(350))

    expect(vi.mocked(useOrders)).toHaveBeenLastCalledWith({
      page: 0,
      size: 10,
      status: 'RECEBIDO',
      search: 'Maria',
    })
    expect(screen.getByTestId('location')).toHaveTextContent('status=RECEBIDO&search=Maria')
  })

  it('limpa o termo pesquisado', async () => {
    renderPage()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar pedidos' }), {
      target: { value: 'Maria' },
    })
    await act(async () => vi.advanceTimersByTime(350))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }))
    await act(async () => vi.advanceTimersByTime(350))

    expect(vi.mocked(useOrders)).toHaveBeenLastCalledWith({
      page: 0,
      size: 10,
      status: 'RECEBIDO',
    })
  })
})
