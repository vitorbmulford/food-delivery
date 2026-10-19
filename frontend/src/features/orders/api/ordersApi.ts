import { apiClient } from '../../../lib/api/client'
import type {
  CreateOrderInput,
  Order,
  OrderFilters,
  OrderPage,
  OrderStatus,
  OrderStatusHistory,
} from '../types/order'
import type { DashboardData } from '../types/dashboard'

export async function getDashboard(from: string, to: string) {
  const { data } = await apiClient.get<DashboardData>('/api/orders/dashboard', {
    params: { from, to },
  })
  return data
}

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

export async function requestOrderGeocoding(id: string) {
  const response = await apiClient.post<void>(`/api/orders/${id}/geocode`)
  if (response.status !== 202) throw new Error('Unexpected geocoding response status')
  return response.status
}

export async function setManualOrderLocation(
  id: string,
  coordinates: { latitude: number; longitude: number },
) {
  const { data } = await apiClient.patch<Order>(`/api/orders/${id}/location`, coordinates)
  return data
}

export async function getOrderHistory(id: string) {
  const { data } = await apiClient.get<OrderStatusHistory[]>(`/api/orders/${id}/history`)
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
