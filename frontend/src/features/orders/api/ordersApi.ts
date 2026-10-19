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
import {
  DEMO_MODE,
  demoCreateOrder,
  demoDashboard,
  demoGetHistory,
  demoGetOrder,
  demoListOrders,
  demoUpdateOrderStatus,
} from '../../demo/demoData'

export async function getDashboard(from: string, to: string) {
  if (DEMO_MODE) return demoDashboard(from, to)
  const { data } = await apiClient.get<DashboardData>('/api/orders/dashboard', {
    params: { from, to },
  })
  return data
}

export async function listOrders(filters: OrderFilters) {
  if (DEMO_MODE) return demoListOrders(filters.page, filters.size, filters.status, filters.search)
  const { data } = await apiClient.get<OrderPage>('/api/orders', {
    params: {
      page: filters.page,
      size: filters.size,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { search: filters.search } : {}),
    },
  })
  return data
}

export async function getOrder(id: string) {
  if (DEMO_MODE) return demoGetOrder(id)
  const { data } = await apiClient.get<Order>(`/api/orders/${id}`)
  return data
}

export async function requestOrderGeocoding(id: string) {
  if (DEMO_MODE) return demoGetOrder(id).geocodingStatus === 'SUCCESS' ? 202 : 202
  const response = await apiClient.post<void>(`/api/orders/${id}/geocode`)
  if (response.status !== 202) throw new Error('Unexpected geocoding response status')
  return response.status
}

export async function setManualOrderLocation(
  id: string,
  coordinates: { latitude: number; longitude: number },
) {
  if (DEMO_MODE) {
    const order = demoGetOrder(id)
    order.coordinates = coordinates
    order.coordinateSource = 'MANUAL'
    order.geocodingStatus = 'SUCCESS'
    return order
  }
  const { data } = await apiClient.patch<Order>(`/api/orders/${id}/location`, coordinates)
  return data
}

export async function getOrderHistory(id: string) {
  if (DEMO_MODE) return demoGetHistory(id)
  const { data } = await apiClient.get<OrderStatusHistory[]>(`/api/orders/${id}/history`)
  return data
}

export async function createOrder(input: CreateOrderInput) {
  if (DEMO_MODE) return demoCreateOrder(input)
  const { data } = await apiClient.post<Order>('/api/orders', input)
  return data
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  if (DEMO_MODE) return demoUpdateOrderStatus(id, status)
  const { data } = await apiClient.patch<Order>(`/api/orders/${id}/status`, { status })
  return data
}
