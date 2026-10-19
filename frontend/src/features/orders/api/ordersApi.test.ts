import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../../lib/api/client'
import {
  createOrder,
  getDashboard,
  getOrderHistory,
  listOrders,
  requestOrderGeocoding,
  setManualOrderLocation,
  updateOrderStatus,
} from './ordersApi'

vi.mock('../../../lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

describe('API de pedidos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('consulta página e status usando somente os parâmetros aceitos pela API', async () => {
    const page = {
      content: [],
      page: { totalElements: 0, totalPages: 0, number: 0, size: 10 },
    }
    vi.mocked(apiClient.get).mockResolvedValue({ data: page })

    await expect(listOrders({ page: 2, size: 10, status: 'EM_PREPARO' })).resolves.toEqual(page)
    expect(apiClient.get).toHaveBeenCalledWith('/api/orders', {
      params: { page: 2, size: 10, status: 'EM_PREPARO' },
    })
  })

  it('consulta indicadores agregados com intervalo explícito', async () => {
    const dashboard = { totalCreated: 4, deliveredInPeriod: 2, cancelledInPeriod: 0 }
    vi.mocked(apiClient.get).mockResolvedValue({ data: dashboard })

    await expect(getDashboard('2026-10-13', '2026-10-19')).resolves.toEqual(dashboard)
    expect(apiClient.get).toHaveBeenCalledWith('/api/orders/dashboard', {
      params: { from: '2026-10-13', to: '2026-10-19' },
    })
  })

  it('cria pedido com DTO items e deliveryAddress', async () => {
    const payload = {
      customer: { name: 'Maria Silva', phone: '11999999999', email: null },
      items: [{ productName: 'Marmita', quantity: 2, unitPrice: 24.9 }],
      deliveryAddress: {
        street: 'Rua A',
        number: '10',
        complement: '',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001000',
      },
    }
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 'id-1', ...payload } })

    await createOrder(payload)
    expect(apiClient.post).toHaveBeenCalledWith('/api/orders', payload)
  })

  it('consulta o histórico do endpoint autenticado do pedido', async () => {
    const history = [
      {
        id: 'event-1',
        previousStatus: null,
        newStatus: 'RECEBIDO',
        changedAt: '2026-10-19T12:00:00Z',
        changedBy: 'user-1',
      },
    ]
    vi.mocked(apiClient.get).mockResolvedValue({ data: history })
    await expect(getOrderHistory('order-1')).resolves.toEqual(history)
    expect(apiClient.get).toHaveBeenCalledWith('/api/orders/order-1/history')
  })

  it('solicita nova geocodificação e valida o HTTP 202 aceito pelo backend', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ status: 202 })
    await expect(requestOrderGeocoding('order-1')).resolves.toBe(202)
    expect(apiClient.post).toHaveBeenCalledWith('/api/orders/order-1/geocode')

    vi.mocked(apiClient.post).mockResolvedValueOnce({ status: 200 })
    await expect(requestOrderGeocoding('order-1')).rejects.toThrow(
      'Unexpected geocoding response status',
    )
  })

  it('confirma coordenadas manuais no pedido', async () => {
    const coordinates = { latitude: -23.55052, longitude: -46.633309 }
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: { id: 'order-1', coordinates, coordinateSource: 'MANUAL' },
    })

    await setManualOrderLocation('order-1', coordinates)

    expect(apiClient.patch).toHaveBeenCalledWith('/api/orders/order-1/location', coordinates)
  })

  it('envia o status real no PATCH e propaga erros da API', async () => {
    const response = { data: { id: 'id-1', status: 'EM_PREPARO' } }
    vi.mocked(apiClient.patch).mockResolvedValue(response)
    await expect(updateOrderStatus('id-1', 'EM_PREPARO')).resolves.toEqual(response.data)
    expect(apiClient.patch).toHaveBeenCalledWith('/api/orders/id-1/status', {
      status: 'EM_PREPARO',
    })

    const conflict = Object.assign(new Error('conflict'), { response: { status: 409 } })
    vi.mocked(apiClient.patch).mockRejectedValue(conflict)
    await expect(updateOrderStatus('id-1', 'ENTREGUE')).rejects.toBe(conflict)
  })
})
