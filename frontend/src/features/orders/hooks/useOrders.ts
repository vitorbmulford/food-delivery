import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import {
  createOrder,
  getOrder,
  getDashboard,
  getOrderHistory,
  listOrders,
  requestOrderGeocoding,
  setManualOrderLocation,
  updateOrderStatus,
} from '../api/ordersApi'
import type { CreateOrderInput, OrderFilters, OrderStatus } from '../types/order'

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderFilters) => [...orderKeys.lists(), filters] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
  history: (id: string) => [...orderKeys.all, 'history', id] as const,
  dashboards: () => [...orderKeys.all, 'dashboard'] as const,
  dashboard: (from: string, to: string) => [...orderKeys.dashboards(), from, to] as const,
}

export function useDashboard(from: string, to: string) {
  return useQuery({
    queryKey: orderKeys.dashboard(from, to),
    queryFn: () => getDashboard(from, to),
    enabled: Boolean(from && to),
    placeholderData: (previousData) => previousData,
  })
}

export function useOrderHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: orderKeys.history(id),
    queryFn: () => getOrderHistory(id),
    enabled: Boolean(id) && enabled,
  })
}

export function useOrders(filters: OrderFilters) {
  return useQuery({ queryKey: orderKeys.list(filters), queryFn: () => listOrders(filters) })
}

export function useOrder(id: string, enabled = true) {
  const polling = useRef<{ id: string; startedAt: number } | null>(null)
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getOrder(id),
    enabled: Boolean(id) && enabled,
    refetchInterval: (query) => {
      if (query.state.data?.geocodingStatus !== 'PENDING') {
        polling.current = null
        return false
      }
      if (polling.current?.id !== id) polling.current = { id, startedAt: Date.now() }
      return Date.now() - polling.current.startedAt < 120_000 ? 5_000 : false
    },
    refetchIntervalInBackground: false,
  })
}

export function useRequestOrderGeocoding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => requestOrderGeocoding(id),
    onSuccess: (_status, id) => queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) }),
  })
}

export function useSetManualOrderLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      coordinates,
    }: {
      id: string
      coordinates: { latitude: number; longitude: number }
    }) => setManualOrderLocation(id, coordinates),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: orderKeys.dashboards() }),
      ])
    },
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: orderKeys.dashboards() }),
      ])
    },
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      updateOrderStatus(id, status),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.history(order.id) }),
        queryClient.invalidateQueries({ queryKey: orderKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: orderKeys.dashboards() }),
      ])
    },
    onError: async (error, variables) => {
      if (isConflict(error)) {
        const invalidations = [queryClient.invalidateQueries({ queryKey: orderKeys.lists() })]
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.id) }),
        )
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: orderKeys.history(variables.id) }),
        )
        await Promise.all(invalidations)
      }
    },
  })
}

function isConflict(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    error.response.status === 409
  )
}
