import { apiClient } from '../../../lib/api/client'
import type { CreateOrderInput, Order, OrderFilters, OrderPage, OrderStatus } from '../types/order'

export async function listOrders(filters: OrderFilters) {
  const { data } = await apiClient.get<OrderPage>('/api/orders', {
    params: {
      page: filters.page,
      size: filters.size,
      ...(filters.status ? { status: filters.status } : {}),
    },
  })
  return data
}

export async function getOrder(id: string) {
  const { data } = await apiClient.get<Order>(`/api/orders/${id}`)
  return data
}

export async function createOrder(input: CreateOrderInput) {
  const { data } = await apiClient.post<Order>('/api/orders', input)
  return data
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const { data } = await apiClient.patch<Order>(`/api/orders/${id}/status`, { status })
  return data
}
