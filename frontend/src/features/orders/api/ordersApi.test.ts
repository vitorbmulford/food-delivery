import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../../lib/api/client'
import { createOrder, listOrders, updateOrderStatus } from './ordersApi'

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

  it('cria pedido com DTO items e deliveryAddress', async () => {
    const payload = {
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
