import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insights } from '../features/insights/insightsApi'
import { useInsights } from '../features/insights/useInsights'
import { InsightsPage } from './InsightsPage'

vi.mock('../features/insights/useInsights', () => ({ useInsights: vi.fn() }))

const response: Insights = {
  from: '2026-10-01',
  to: '2026-10-30',
  current: {
    createdValue: 123.45,
    createdCount: 2,
    deliveredValue: 100,
    deliveredCount: 1,
    cancelledValue: 23.45,
    cancelledCount: 1,
    ongoingValue: 0,
    averageDeliveredTicket: 100,
    itemsSold: 2,
  },
  previous: {
    createdValue: 100,
    createdCount: 2,
    deliveredValue: 80,
    deliveredCount: 1,
    cancelledValue: 0,
    cancelledCount: 0,
    ongoingValue: 0,
    averageDeliveredTicket: 80,
    itemsSold: 1,
  },
  daily: [
    {
      date: '2026-10-01',
      createdValue: 123.45,
      deliveredValue: 100,
      cancelledValue: 23.45,
      createdCount: 2,
      deliveredCount: 1,
      cancelledCount: 1,
    },
  ],
  currentStatusValues: [{ status: 'ENTREGUE', value: 100, count: 1 }],
  hourly: [{ hour: 13, count: 2 }],
  products: [{ name: 'Hambúrguer', quantity: 2, value: 100, sharePercent: 100 }],
  performance: {
    receivedToPreparationMinutes: 5,
    receivedToPreparationCount: 1,
    preparationMinutes: 20,
    preparationCount: 1,
    deliveryMinutes: 15,
    deliveryCount: 1,
    totalMinutes: 40,
    totalCount: 1,
  },
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <InsightsPage />
    </QueryClientProvider>,
  )
}

describe('InsightsPage', () => {
  afterEach(cleanup)
  beforeEach(() => vi.mocked(useInsights).mockReset())

  it('renders real aggregates, Brazilian currency, product and performance information', async () => {
    vi.mocked(useInsights).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    renderPage()
    expect(screen.getByText('Valor dos pedidos criados')).toBeInTheDocument()
    expect(screen.getAllByText(/123,45/).length).toBeGreaterThan(0)
    expect(screen.getByText('Valor dos pedidos entregues')).toBeInTheDocument()
    expect(screen.getByText(/Hambúrguer/)).toBeInTheDocument()
    expect(screen.getByText('40 min')).toBeInTheDocument()
    expect(screen.getByText(/23,5%/)).toBeInTheDocument()
  })

  it('updates the requested date range when the preset changes', async () => {
    vi.mocked(useInsights).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    renderPage()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Período' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Hoje' }))
    await waitFor(() =>
      expect(useInsights).toHaveBeenLastCalledWith(expect.any(String), expect.any(String)),
    )
    const [from, to] = vi.mocked(useInsights).mock.lastCall ?? []
    expect(from).toBe(to)
  })

  it('shows an API error without presenting fabricated metrics', async () => {
    vi.mocked(useInsights).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('offline'),
    } as ReturnType<typeof useInsights>)
    renderPage()
    expect(await screen.findByText(/Não foi possível carregar os Insights/)).toBeInTheDocument()
    expect(screen.queryByText('Valor dos pedidos criados')).not.toBeInTheDocument()
  })
})
